const ValidationPipeline = require("../../ValidationPipeline");
const { BaseValidator } = ValidationPipeline;
const { validateVendorPayoutNew } = require("../../../../services/dsa-services");
const { validateLeadPayoutAndBusinessCategory, compareDisbursementAmount, updateFreshLeadDsaId, getBankProductCombination, getMaxDisbursementAmountMessage } = require("../../../../services/finance-services");
const { toIsoDateIST } = require("../../../../helpers/commonhelper");
const { attachVendorPayoutCapsToRow, formatSubventionPayoutLimitSuffix } = require("./erpHelpers");
const ErpError = require("./ErpError");
const payoutSharing = require("../claims/payoutSharing");
const {
    getSameDayBillingPostCutoffMessage,
    getPersonalLoanDisbursementAmountMessage
} = require("../../sharedValidators");

const SOURCE_OBJ = {
    crm: { customer_lead_form: 2, lead_form: 1, upload_excel: 3 },
    web_application: { customer_lead_form: 5, lead_form: 4, instant_claim: 8 },
    ios: { customer_lead_form: 7, lead_form: 6 },
    android: { customer_lead_form: 7, lead_form: 6 }
};

/**
 * Per-lead pipeline: `context` from index is `{ lead, isMaster, finalObj, req }` (lead row + flags + request).
 * With `onCustomError`, handles `type === "custom"` errors then stops.
 */
class ErpValidatorPipeline extends ValidationPipeline {
    async run(context, onCustomError) {
        if (typeof onCustomError !== "function") {
            await super.run(context);
            return { aborted: false };
        }
        for (const validator of this.validators) {
            try {
                await validator.validate(context);
            } catch (error) {
                if (error?.type === "custom") {
                    await onCustomError(error, context);
                    return { aborted: true };
                }
                throw error;
            }
        }
        return { aborted: false };
    }
}

/**
 * Mandatory disbursement date on the lead row.
 */
class LeadDisbursementDateValidator extends BaseValidator {
    async validate(ctx) {
        const lead = ctx.lead;
        const freshLeadId = lead?.fresh_lead_id;
        if (!lead?.disbursement_date) {
            throw new ErpError("Disbursement date is mandatory", 400, { freshLeadId });
        }
    }
}

/**
 * Mandatory loan number + APAC/ref/LOS number on the lead row. Both fields are meant to be
 * enforced before a claim ever reaches fresh_lead_status_id=0 (see AddFreshLeadClaim /
 * editFreshLeadClaim / validateManualReconciliationSave), but that enforcement is spread across
 * multiple creation/edit paths and has had gaps (e.g. createCustomerLoanDetails never enforced
 * it). This is the last gate before NetSuite, so it re-checks unconditionally regardless of how
 * the row got here or who's submitting it.
 */
class LeadLoanApacNumberValidator extends BaseValidator {
    async validate(ctx) {
        const lead = ctx.lead;
        const freshLeadId = lead?.fresh_lead_id;
        if (!lead?.loan_reference_id || !lead?.loan_apac_ref_los_number) {
            throw new ErpError("Loan Number and Application/APAC Number are required before sending to ERP", 400, { freshLeadId });
        }
    }
}

/**
 * Joi-style payout field rules (business_categories, rate/ratio, in-house lock).
 */
class LeadPayoutDetailsValidator extends BaseValidator {
    async validate(ctx) {

        const lead = ctx.lead;
        const freshLeadId = lead?.fresh_lead_id;

        const payoutValidation = await validateLeadPayoutAndBusinessCategory({
            netsuite_product_id: lead?.netsuite_product_id,
            business_categories: lead?.business_categories,
            payout_type: lead?.vendor_payout_type,
            payout_ratio: lead?.vendor_payout_ratio,
            payout_rate: lead?.vendor_payout_rate,
            isFinanceRoot: ctx.isMaster
        });

        if (!payoutValidation.isValid) {
            throw new ErpError(payoutValidation.message || "Payout Not Found", 400, { freshLeadId });
        }
    }
}


/**
 * Same-day billing window.
 */
class LeadSameDayBillingValidator extends BaseValidator {
    async validate(ctx) {
        if (ctx.isMaster) return;

        const lead = ctx.lead;
        const freshLeadId = lead?.fresh_lead_id;

        const msg = getSameDayBillingPostCutoffMessage(!!lead?.same_day_billing);
        if (msg) {
            throw new ErpError(msg, 400, { freshLeadId });
        }
    }
}

/**
 * Personal loan + same-day / to-be-billed: disbursement must not exceed 7 digits.
 */
class LeadPersonalLoanDisbursementValidator extends BaseValidator {
    async validate(ctx) {
        if (ctx.isMaster) return;

        const lead = ctx.lead;
        const freshLeadId = lead?.fresh_lead_id;

        const msg = await getPersonalLoanDisbursementAmountMessage(
            lead?.netsuite_product_id,
            lead?.disbursement_amount,
            !!lead?.same_day_billing,
            !!lead?.to_be_billed
        );
        if (msg) {
            throw new ErpError(msg, 400, { freshLeadId });
        }
    }
}

/**
 * Disbursement amount must not exceed the bank/product's max_payout_amount for the
 * period covering the disbursement date (see getMaxDisbursementAmountMessage).
 */
class LeadMaxDisbursementAmountValidator extends BaseValidator {
    async validate(ctx) {
        if (ctx.isMaster) return;

        const lead = ctx.lead;
        const freshLeadId = lead?.fresh_lead_id;

        const msg = await getMaxDisbursementAmountMessage({
            netsuite_bank_id: lead?.netsuite_bank_id,
            netsuite_product_id: lead?.netsuite_product_id,
            disbursement_amount: lead?.disbursement_amount,
            disbursement_date_iso: toIsoDateIST(lead?.disbursement_date)
        });
        if (msg) {
            throw new ErpError(msg, 400, { freshLeadId });
        }
    }
}

/**
 * Vendor payout caps / collision flags from DSA service.
 */
class LeadVendorPayoutCapsValidator extends BaseValidator {
    async validate(ctx) {
        if (ctx.isMaster) return;

        const lead = ctx.lead;
        const freshLeadId = lead?.fresh_lead_id;
        if (!lead.dsa_id) {
            await updateFreshLeadDsaId(lead)
        }

        if (lead?.user_type == "company" && !lead?.dsa_id) {
            throw new ErpError("Company dsa not found", 500, { freshLeadId });
        }
        let dsa_id = lead?.user_type === "company" ? lead?.registered_by : lead?.dsa_id;

        const bankFile = lead?._erpMatchedBankFile || null;

        const caps = await validateVendorPayoutNew(
            dsa_id,
            lead.netsuite_bank_id,
            lead.netsuite_product_id,
            lead.vendor_payout_type,
            lead.vendor_payout_rate,
            lead.vendor_payout_ratio,
            null,
            false,
            0,
            bankFile?.subvention_percentage ?? null,
            bankFile?.disbursement_amount ?? null,
            toIsoDateIST(lead.disbursement_date)
        );

        attachVendorPayoutCapsToRow(lead, caps);
    }
}


/**
 * Rate / ratio vs expected caps (post vendor service).
 */
class LeadRateRatioCollideValidator extends BaseValidator {
    async validate(ctx) {
        if (ctx.isMaster) return;

        const lead = ctx.lead;
        const freshLeadId = lead?.fresh_lead_id;

        const { vendor_payout_rate, vendor_payout_ratio, payout_collide, avg_achievment } = lead._erpVendorPayoutCaps || {};
        const typeLower = String(lead.vendor_payout_type).toLowerCase();
        const subventionSuffix = formatSubventionPayoutLimitSuffix(lead._erpMatchedBankFileSubvention);
        // avg_achievment is strictly null only when the bank/product combo is known but
        // no ru_bank_product_combination_details row covers this lead's disbursement date
        // (a gap between synced periods) - distinct from the combo having no payout data
        // configured at all, where it defaults to 0 instead. See PLAN-0007 T12.
        const noSlabForDisbDate = avg_achievment === null;

        if (typeLower === "rate" && payout_collide) {
            let message = `Lead Payout Rate greater than Expected ${vendor_payout_rate}${subventionSuffix}`;
            if (noSlabForDisbDate) {
                message = "Customer slab master is not configured for this disbursement date";
            } else if (!vendor_payout_rate) {
                message = "Vendor Payout Rate is not set for this Product";
            }
            throw new ErpError(message, 400, { freshLeadId });
        }
        if (typeLower === "ratio" && payout_collide) {
            let message = `Lead Payout Ratio greater than Expected ${vendor_payout_ratio}${subventionSuffix}`;
            if (noSlabForDisbDate) {
                message = "Customer slab master is not configured for this disbursement date";
            } else if (!vendor_payout_rate) {
                message = "Vendor Payout Ratio is not set for this Product";
            }
            throw new ErpError(message, 400, { freshLeadId });
        }
    }
}

/**
 * Sibling pair (sibling_lead set) must share one disbursement date.
 *
 * The pair represents one loan's payout split across two DSAs, so both halves are one
 * underlying disbursement. Nothing enforces this at claim creation (two separate input
 * contexts, PLAN-0007) or at edit (each half is edited independently, no pair-awareness
 * for this field - contrast PairPayoutTypeMatchValidator, which does assert payout_type
 * match). This mattered less before PLAN-0007's Tier 2 migration, when
 * getBankProductCombination had no date parameter at all and always returned the same
 * avg_achievment regardless of which lead's date you'd use. Now that it's date-range
 * matched, a diverged pair could silently price the combined cap in
 * LeadSiblingCombinedPayoutCapValidator against two different synced periods depending on
 * which half is submitted. Runs first so a mismatch fails fast with a specific message,
 * before the combined-cap check computes anything against a possibly-wrong period.
 */
class LeadSiblingDisbursementDateMatchValidator extends BaseValidator {
    async validate(ctx) {
        if (ctx.isMaster) return;

        const lead = ctx.lead;
        const freshLeadId = lead?.fresh_lead_id;
        const siblingId = lead?.sibling_lead;
        if (!siblingId) return;

        const claimRepository = require("../claims/FreshLeadClaimRepository");
        const sibling = await claimRepository.findById(siblingId, { useMaster: true });
        if (!sibling) {
            throw new ErpError(
                "Sharing case could not be found",
                400,
                { freshLeadId }
            );
        }

        const leadDate = toIsoDateIST(lead.disbursement_date);
        const siblingDate = toIsoDateIST(sibling.disbursement_date);
        if (leadDate !== siblingDate) {
            throw new ErpError(
                "Sharing lead disbursal date mismatch",
                400,
                { freshLeadId }
            );
        }
    }
}

/**
 * Combined payout cap for payout-sharing pairs (sibling_lead set).
 *
 *   rate  : rate_A  + rate_B  <= 0.95 * avg_achievment
 *   ratio : ratio_A + ratio_B <= 95
 *
 * Moved here from claim creation (T68/T69): a pair may be recorded over the combined
 * threshold, but must not be sent to ERP until the combined rates/ratios fit. Per-claim
 * caps remain in LeadRateRatioCollideValidator / LeadPayoutDetailsValidator.
 *
 * Loads the sibling by `meta.sibling_lead` (direct id), not the heuristic loan/bank match.
 * avg_achievment comes from `getBankProductCombination`, never validateVendorPayoutNew
 * (which reports 0 when assigning_payout_percentage is missing). Assumes the pair's dates
 * already match - see LeadSiblingDisbursementDateMatchValidator, which runs first.
 */
class LeadSiblingCombinedPayoutCapValidator extends BaseValidator {
    async validate(ctx) {
        if (ctx.isMaster) return;

        const lead = ctx.lead;
        const freshLeadId = lead?.fresh_lead_id;
        const siblingId = lead?.sibling_lead;
        if (!siblingId) return;

        const claimRepository = require("../claims/FreshLeadClaimRepository");
        const sibling = await claimRepository.findById(siblingId, { useMaster: true });
        if (!sibling) {
            throw new ErpError(
                "Sharing case could not be found",
                400,
                { freshLeadId }
            );
        }

        const type = String(lead.vendor_payout_type || "").trim().toLowerCase();
        const siblingType = String(sibling.vendor_payout_type || "").trim().toLowerCase();
        if (type !== siblingType) {
            throw new ErpError(
                `Payout type must be the same for both leads of a sharing case (got ${type || "empty"} and ${siblingType || "empty"})`,
                400,
                { freshLeadId }
            );
        }

        const isRatio = type === "ratio";
        const a = Number(isRatio ? lead.vendor_payout_ratio : lead.vendor_payout_rate) || 0;
        const b = Number(isRatio ? sibling.vendor_payout_ratio : sibling.vendor_payout_rate) || 0;
        const total = a + b;

        if (isRatio) {
            if (total > payoutSharing.RATIO_CAP_PERCENT) {
                throw new ErpError(
                    "Combined payout of sharing leads exceeds the allowed limit",
                    400,
                    { freshLeadId }
                );
            }
            return;
        }

        const combination = await getBankProductCombination(
            lead.netsuite_bank_id,
            lead.netsuite_product_id,
            toIsoDateIST(lead.disbursement_date)
        );
        const avgAchievment = Number(combination?.avg_achievment) || 0;
        if (!avgAchievment) {
            throw new ErpError(
                "Product payout is not configured for this bank and product",
                400,
                { freshLeadId }
            );
        }

        const cap = payoutSharing.RATE_CAP_FRACTION * avgAchievment;
        // Guard against binary float error at the boundary: 0.55 + 0.40 is 0.9500000000000001.
        if (total - cap > 1e-9) {
            throw new ErpError(
                "Combined payout of sharing leads exceeds the allowed limit",
                400,
                { freshLeadId }
            );
        }
    }
}

/**
 * Tentative bank file disbursement amount vs lead.
 */
class LeadDisbursementAmountCompareValidator extends BaseValidator {
    async validate(ctx) {
        if (ctx.isMaster) return;

        const lead = ctx.lead;
        const freshLeadId = lead?.fresh_lead_id;
        if (!freshLeadId) return;

        const disbursementResult = compareDisbursementAmount({ leadAmount: lead?.disbursement_amount, bankAmount: lead?._erpMatchedBankFile?.disbursement_amount });
        if (!disbursementResult.isValid) {
            throw new ErpError(
                disbursementResult.message || "Disbursement amount validation failed",
                400,
                { freshLeadId }
            );
        }
    }
}

/**
 * Append one { id, source } entry when checks passed for this lead.
 */
class LeadErpSourceBuildValidator extends BaseValidator {
    async validate(ctx) {
        const lead = ctx.lead;
        const freshLeadId = lead?.fresh_lead_id;
        if (!freshLeadId) return;

        const finalObj = ctx.finalObj;
        if (!Array.isArray(finalObj)) return;

        finalObj.push({
            id: freshLeadId,
            claimId: lead.id,
            source: SOURCE_OBJ[lead?.platform]?.[lead?.form_type] || ""
        });
    }
}

module.exports = {
    ErpValidatorPipeline,
    LeadDisbursementDateValidator,
    LeadLoanApacNumberValidator,
    LeadPayoutDetailsValidator,
    LeadVendorPayoutCapsValidator,
    LeadSameDayBillingValidator,
    LeadPersonalLoanDisbursementValidator,
    LeadMaxDisbursementAmountValidator,
    LeadRateRatioCollideValidator,
    LeadSiblingDisbursementDateMatchValidator,
    LeadSiblingCombinedPayoutCapValidator,
    LeadDisbursementAmountCompareValidator,
    LeadErpSourceBuildValidator
};

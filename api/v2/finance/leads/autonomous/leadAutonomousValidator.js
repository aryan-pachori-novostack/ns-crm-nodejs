const ValidationPipeline = require("../../ValidationPipeline");
const {
    getSameDayBillingPostCutoffMessage,
    getPersonalLoanDisbursementAmountMessage
} = require("../../sharedValidators");
const { BaseValidator } = ValidationPipeline;
const AutonomousError = require("./AutonomousError");
const LeadService = require("../../../../services/lead-services");
const FinanceServices = require("../../../../services/finance-services");
const DSAService = require("../../../../services/dsa-services");
const { sanitizeBusinessCategory, toIsoDateIST } = require("../../../../helpers/commonhelper");

/** Only these business categories may be marked Autonomous (ClickUp 86d3rp00d). */
const AUTONOMOUS_ALLOWED_BUSINESS_CATEGORIES = ["11", "21"];

/** Loan TBC - Tranche — the only category a split claim may be Autonomous under (ClickUp 86d40nrva). */
const LOAN_TBC_TRANCHE_CATEGORY = "21";

// `lead.is_split_case` is read straight from `ru_fresh_lead_claims` (SELECT *), where the
// column historically holds "yes", "Yes" and "YES" — write paths now emit lowercase, but
// old rows keep their casing. Normalise before comparing so the split gate below actually
// fires for the "Yes" that the lead-form / split-pair builders wrote.
const isSplitCase = (value) => String(value ?? "").trim().toLowerCase() === "yes";

/**
 * Autonomous eligibility check for a single claim:
 *   1. business_categories must be Loan TBC (11) or Loan TBC - Tranche (21) (ClickUp 86d3rp00d).
 *   2. If is_split_case is "yes", business_categories must specifically be Loan TBC - Tranche (21)
 *      (ClickUp 86d40nrva) — split claims under plain Loan TBC (11) remain ineligible.
 * @returns {{isValid: boolean, message?: string}}
 */
function checkAutonomousSplitEligibility({ business_categories, is_split_case }) {
    const category = sanitizeBusinessCategory(business_categories);
    if (!AUTONOMOUS_ALLOWED_BUSINESS_CATEGORIES.includes(category)) {
        return {
            isValid: false,
            message: "Only Loan TBC / Loan TBC - Tranche business category is allowed for Autonomous"
        };
    }

    if (isSplitCase(is_split_case) && category !== LOAN_TBC_TRANCHE_CATEGORY) {
        return {
            isValid: false,
            message: "Split cases are only eligible for Autonomous under Loan TBC - Tranche business category"
        };
    }

    return { isValid: true };
}

/** Blocks same-day billing after configured cutoff hour (shared rule with ERP pipeline). */
class SameDayBillingTimeValidator extends BaseValidator {
    async validate(context) {
        const msg = getSameDayBillingPostCutoffMessage(!!context.same_day_billing);
        if (msg) {
            throw new AutonomousError(msg, 400);
        }
    }
}

class LeadExistenceValidator extends BaseValidator {
    async validate(context) {
        const { fresh_lead_id } = context;
        const lead = await LeadService.getLeadFormByFreshLeadId(fresh_lead_id);
        if (!lead) {
            throw new AutonomousError("Lead not found", 404);
        }
        context.lead = lead;
    }
}

/** Manual-review banks (SBI) and CAT C / CAT D bank-product combinations are not eligible for autonomous payment. */
class AutonomousBankCategoryValidator extends BaseValidator {
    async validate(context) {
        const { lead } = context;
        if (FinanceServices.isManualReviewBank(lead?.netsuite_bank_id)) {
            throw new AutonomousError("Autonomous payment is not allowed for this bank", 400);
        }
        const bankCategory = await DSAService.getBankCategoryByBankProduct(lead?.netsuite_bank_id, lead?.netsuite_product_id);
        if (bankCategory === "cat c" || bankCategory === "cat d") {
            throw new AutonomousError("Autonomous payment is not allowed for CAT C / CAT D Products", 400);
        }
    }
}

/** Personal loan + same-day / to-be-billed: disbursement must not exceed 7 digits (shared rule with ERP). */
class PersonalLoanDisbursementValidator extends BaseValidator {
    async validate(context) {
        const { lead, same_day_billing, to_be_billed } = context;
        const msg = await getPersonalLoanDisbursementAmountMessage(
            lead?.netsuite_product_id,
            lead?.disbursement_amount,
            !!same_day_billing,
            !!to_be_billed
        );
        if (msg) {
            throw new AutonomousError(msg, 400);
        }
    }
}

/**
 * Enforces business category + split-case eligibility whenever a claim is being turned
 * Autonomous (skipped when the request is turning it off). See `checkAutonomousSplitEligibility`.
 */
class AutonomousSplitCategoryValidator extends BaseValidator {
    async validate(context) {
        const { lead, same_day_billing, to_be_billed } = context;
        if (!same_day_billing || !to_be_billed) return;

        const { isValid, message } = checkAutonomousSplitEligibility({
            business_categories: lead?.business_categories,
            is_split_case: lead?.is_split_case
        });
        if (!isValid) {
            throw new AutonomousError(message, 400);
        }
    }
}

class DisbursementDateValidator extends BaseValidator {
    async validate(context) {
        if (!context.lead?.disbursement_date) {
            throw new AutonomousError("Disbursement date not found for the lead", 400);
        }
    }
}

/** Secured (non-unsecured) products require tentative bank file match (or banker file processed). */
class SecuredLoanTentativeMatchValidator extends BaseValidator {
    async validate(context) {
        const { fresh_lead_id, lead } = context;
        let { product } = await LeadService.getProductOrBankDropdown(
            "product",
            null,
            null,
            null,
            null,
            `p.netsuite_product_id = ${lead?.netsuite_product_id}`
        );
        product = product[0];
        const category = product?.category;
        context.productCategory = category;

        if (typeof category === "string" && category?.toLowerCase() !== "unsecured") {
            const tentativeMatchResult = await LeadService.getTentativeBankFileMatchData(fresh_lead_id);
            if (
                !tentativeMatchResult.is_tentative_matched &&
                !tentativeMatchResult.is_bank_file_matched &&
                !tentativeMatchResult.is_banker_file_processed
            ) {
                throw new AutonomousError(
                    "Tentative bank file match required for Autonomous payment in secured loans",
                    400
                );
            }
        }
    }
}

class DisbursementDatePriorValidator extends BaseValidator {
    async validate(context) {
        const disbursementDate = new Date(context.lead.disbursement_date);
        const currentDate = new Date();
        disbursementDate.setHours(0, 0, 0, 0);
        currentDate.setHours(0, 0, 0, 0);
        context.disbursementDate = disbursementDate;

        if (disbursementDate >= currentDate) {
            throw new AutonomousError("Disbursement date must be prior to the current date", 400);
        }
    }
}

/** Ensures `lead.dsa_id` for company / missing cases (matches v1). */
class LeadDsaResolutionValidator extends BaseValidator {
    async validate(context) {
        let lead = context.lead;
        const is_company = lead?.user_type == "company";
        if (!lead?.dsa_id || is_company) {
            lead = await FinanceServices.updateFreshLeadDsaId(lead, is_company);
        }
        context.lead = lead;
        context.dsa_id = lead.dsa_id;
    }
}

class DsaSameDayBillingEnabledValidator extends BaseValidator {
    async validate(context) {
        const is_same_day_billing_enabled = await DSAService.getDsaSameDayBillingEnabledById(context.dsa_id);
        if (!is_same_day_billing_enabled) {
            throw new AutonomousError("Same day billing is not enabled for this DSA", 400);
        }
    }
}

class DsaPayoutConfiguredValidator extends BaseValidator {
    async validate(context) {
        const { dsa_id, lead } = context;
        const payoutCaps = await DSAService.getDsaPayoutAutonomousByBankProduct(dsa_id, {
            bank_id: lead.netsuite_bank_id,
            product_id: lead.netsuite_product_id
        }, toIsoDateIST(lead.disbursement_date));
        if (!payoutCaps) {
            throw new AutonomousError("DSA payout is not set for this product", 400);
        }
        context.payoutCaps = payoutCaps;
    }
}

class AutonomousSettingsConfiguredValidator extends BaseValidator {
    async validate(context) {
        if (!context.payoutCaps.disb_date_from) {
            throw new AutonomousError("Autonomous payment settings are not configured for this product", 400);
        }
    }
}

class DisbursementDateRangeValidator extends BaseValidator {
    async validate(context) {
        const { disbursementDate, payoutCaps } = context;
        const disbDateFromConfig = new Date(payoutCaps.disb_date_from);
        disbDateFromConfig.setHours(0, 0, 0, 0);
        if (disbursementDate < disbDateFromConfig) {
            throw new AutonomousError("Payout not configured for this date", 400);
        }

        if (payoutCaps.disb_date_to) {
            const disbDateToConfig = new Date(payoutCaps.disb_date_to);
            disbDateToConfig.setHours(0, 0, 0, 0);
            if (disbursementDate > disbDateToConfig) {
                throw new AutonomousError("Payout not configured for this date", 400);
            }
        }
    }
}

class RateRatioCapValidator extends BaseValidator {
    async validate(context) {
        const { pt, rate, ratio, payoutCaps } = context;
        if (pt === "rate") {
            if (payoutCaps.autonomous_rate == null || payoutCaps.autonomous_rate === "") {
                throw new AutonomousError("Autonomous rate cap is not configured for this product", 400);
            }
            if (Number(rate) > Number(payoutCaps.autonomous_rate)) {
                throw new AutonomousError(
                    `Rate cannot exceed configured autonomous rate ${payoutCaps.autonomous_rate}`,
                    400
                );
            }
        } else {
            if (payoutCaps.autonomous_ratio == null || payoutCaps.autonomous_ratio === "") {
                throw new AutonomousError("Autonomous ratio cap is not configured for this product", 400);
            }
            if (payoutCaps.avg_achievment == null || payoutCaps.avg_achievment === "") {
                throw new AutonomousError("Product average achievement is not set for this combination", 400);
            }
            if (Number(ratio) > Number(payoutCaps.autonomous_ratio)) {
                throw new AutonomousError(
                    `Ratio cannot exceed configured autonomous ratio ${payoutCaps.autonomous_ratio}`,
                    400
                );
            }
        }
    }
}

module.exports = {
    SameDayBillingTimeValidator,
    LeadExistenceValidator,
    AutonomousSplitCategoryValidator,
    AutonomousBankCategoryValidator,
    PersonalLoanDisbursementValidator,
    DisbursementDateValidator,
    SecuredLoanTentativeMatchValidator,
    DisbursementDatePriorValidator,
    LeadDsaResolutionValidator,
    DsaSameDayBillingEnabledValidator,
    DsaPayoutConfiguredValidator,
    AutonomousSettingsConfiguredValidator,
    DisbursementDateRangeValidator,
    RateRatioCapValidator,
};

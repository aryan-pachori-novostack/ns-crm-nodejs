const { QueryTypes } = require('sequelize');
const { format } = require('date-fns');

const ValidationPipeline = require("../../ValidationPipeline");
const { BaseValidator } = ValidationPipeline;
const LeadClaimError = require("./LeadClaimError");
const { logger } = require("../../../../helpers/logger");
const { _db2 } = require('../../../../../jobs/db');
const { CalculatePayoutAmount, validatePan } = require("../../../../helpers/commonhelper");
const { checkBankProductLock } = require("../../../../services/bank-services");
const {
    checkIfLoanAndApacNumberIsValid,
    checkIfFreshLeadExist,
    validateBusinessCategory,
    checkIfDuplcateLeadExist,
    additionalLeadFormValidation,
    checkNsContestIdExists,
    matchLeadBankFile,
    onlineLeadCheck,
    validateLeadPayoutAndBusinessCategory,
    validateDisbursementDate,
    deriveClaimMonthFromDisbDate,
    isConfirmationMailAllowedForProductId,
    getMaxDisbursementAmountMessage
} = require("../../../../services/finance-services");
const {
    processSplitCaseFiles,
    updateDsaNsHierarchy,
    validateVendorPayoutNew,
    getCrmHierarchyFromMaterializedPath,
    getVendorDetailsByPan,
    getDsaFullDetailsPhone,
    getBankProductMappedPayout
} = require("../../../../services/dsa-services");
const { updateOrCreateRMUser } = require("../../../../services/user-services");
const { getCompanyDetailsByKey } = require("../../../../services/company-services");
const { getLeadFormField } = require("../../../../v1/controllers/mongo-db");
const claimRepository = require("./FreshLeadClaimRepository");
const {
    isSplitCaseYes
} = require("../uploadExcel/uploadExcelHelpers");

const ist_time_zone = 'Asia/Kolkata';
const INHOUSE_BUSINESS_CATEGORY = 20;
const SPECIAL_CHARACTER_PATTERN_OTHER_THAN_SLASH = /^[^ !*]*$/;
// Letters + spaces only — no digits, no special characters. ClickUp 14ze67x8far.
const ALPHA_ONLY_NAME_PATTERN = /^[a-zA-Z ]*$/;

/**
 * Resolve the vendor into `ctx.dsa`. Dispatch is on `input.vendor_lookup.by` when present
 * (lead form: mobile / company_id); otherwise the Excel PAN path via `derived.pan`.
 * Never branch on `ctx.source.channel` — the adapter chooses the lookup strategy.
 */
class VendorResolutionValidator extends BaseValidator {
    async validate(ctx) {
        const lookup = ctx.input?.vendor_lookup;
        let dsaDetails = null;
        let is_company = false;

        if (lookup?.by === "mobile") {
            dsaDetails = await getDsaFullDetailsPhone(lookup.value);
        } else if (lookup?.by === "company_id") {
            dsaDetails = await getCompanyDetailsByKey(lookup.value, "company_id");
            is_company = Boolean(dsaDetails);
        } else {
            // Excel (and any future PAN-based channel): VendorPanValidator normalised pan onto derived.
            const pan = ctx.derived.pan || ctx.input?.vendor_pan;
            dsaDetails = await getVendorDetailsByPan(pan);
            // Fallback to company details if vendor is missing, deleted, or blacklisted
            if (!dsaDetails || dsaDetails?.is_deleted || dsaDetails?.is_blacklisted) {
                const companyDetails = await getCompanyDetailsByKey(pan);
                if (companyDetails) {
                    dsaDetails = companyDetails;
                    is_company = true;
                }
            }
        }

        if (!dsaDetails) {
            throw new LeadClaimError(`This Lead does not exists `);
        }

        const {
            class_id,
            hierarchy_crm: current_hierarchy_crm,
            materialized_path: current_hierarchy_path,
            partner_id,
            netsuite_vendor_id,
            dsa_mobile_number,
            dsa_id,
            ns_hierarchy,
            business_head_code,
            registered_by_id,
            is_deleted,
            is_blacklisted,
            account_number,
            account_status,
            full_name,
            email_address,
            vendor_name,
            vendor_email
        } = dsaDetails || {};

        ctx.dsa = {
            class_id,
            current_hierarchy_crm,
            current_hierarchy_path,
            partner_id,
            netsuite_vendor_id,
            dsa_mobile_number,
            dsa_id,
            ns_hierarchy,
            business_head_code,
            registered_by_id,
            is_deleted,
            is_blacklisted,
            account_number,
            account_status,
            is_company,
            // Contact details of the vendor the claim is raised for: the DSA itself, or for a company the DSA that
            // registered it (`dsa_mobile_number` is already that DSA's). Used as the claim creator (mail footer /
            // CC) when platform = web_application.
            vendor: {
                name: (is_company ? vendor_name : full_name) || null,
                email: (is_company ? vendor_email : email_address) || null,
                phone: dsa_mobile_number || null
            }
        };
        // Was set by RowFieldExtractionValidator; that validator is gone (its work moved
        // into excelRowAdapter), and this is the first point is_company is known.
        ctx.derived.user_type = is_company ? 'company' : 'individual';
        if (ctx.input) {
            // Keep input in sync for channels that never ran VendorPanValidator.
            if (!ctx.derived.pan && dsaDetails.permanent_account_number) {
                ctx.derived.pan = dsaDetails.permanent_account_number;
            }
        }
    }
}

/** The uploader must sit above this vendor in the hierarchy (or be a lead admin / CEO). */
class UploaderAuthorizationValidator extends BaseValidator {
    async validate(ctx) {
        const { actor: leader, leadAdminDsaId: lead_admin_dsa_id, parentActor: parent_user, isExternal } = ctx.source;
        const { current_hierarchy_path, registered_by_id, dsa_id } = ctx.dsa;

        let isAuthorized = false;
        isAuthorized = current_hierarchy_path?.includes(leader.dsa_id) || registered_by_id?.includes(leader.dsa_id);
        if (isExternal) {
            isAuthorized = (dsa_id === leader.dsa_id) || (registered_by_id === leader.dsa_id);
        }
        if (!isAuthorized && lead_admin_dsa_id) {
            //Lead admin can upload cases from his own hierarchy
            isAuthorized = current_hierarchy_path?.includes(lead_admin_dsa_id) || registered_by_id?.includes(lead_admin_dsa_id);
        }
        // Allow CEO and CEO's Lead admin to upload all cases
        const isCeo = Boolean(leader?.role?.trim().toLowerCase() === "ceo" || parent_user?.role?.trim().toLowerCase() === "ceo");
        if (!isAuthorized && isCeo) {
            isAuthorized = true;
        }
        if (!isAuthorized) {
            throw new LeadClaimError(`The Person Who upload the details is not business Head of this Lead`);
        }
    }
}

class DsaStatusValidator extends BaseValidator {
    async validate(ctx) {
        if (ctx.dsa.is_deleted || ctx.dsa.is_blacklisted) {
            throw new LeadClaimError(` This DSA is Blacklisted / Deleted `);
        }
    }
}

/** confirmation_required parsing plus the SM/ASM contact-completeness rules. */
class ConfirmationContactValidator extends BaseValidator {
    async validate(ctx) {
        const i = ctx.input;

        if (!i.confirmation_required_is_valid) {
            throw new LeadClaimError(`Only yes/no is allowed in Confirmation required`);
        }
        if (i.confirmation_required && (!i.banker_email || !i.banker_mobile || !i.banker_name)) {
            throw new LeadClaimError(`Confirmation required is yes: SM Mail ID, SM Mobile and SM Name are mandatory`);
        }
        if (i.banker_email && (!i.banker_mobile || !i.banker_name)) {
            throw new LeadClaimError(`If SM Mail ID is provided, SM Mobile and SM Name are mandatory`);
        }
        if (i.asm_email && (!i.asm_mobile || !i.asm_name)) {
            throw new LeadClaimError(`If ASM Mail ID is provided, ASM Mobile and ASM Name are mandatory`);
        }

    }
}

/** Lazily backfill NetSuite class id and the human-readable CRM hierarchy. */
class NsHierarchyEnrichmentValidator extends BaseValidator {
    async validate(ctx) {
        if (!ctx.dsa.class_id) {
            const data = await updateDsaNsHierarchy(ctx.derived.pan, ctx.dsa.dsa_id, !ctx.dsa.is_company);
            ctx.dsa.class_id = data?.data?.class_internal_id || null;
        }

        if (!ctx.dsa.current_hierarchy_crm) {
            ctx.dsa.current_hierarchy_crm = await getCrmHierarchyFromMaterializedPath(ctx.dsa.current_hierarchy_path) || "";
        }
    }
}

/** Stamp the request timestamps used on both the insert and update paths. */
class RequestDateValidator extends BaseValidator {
    async validate(ctx) {
        const current_date_in_ist = new Date();
        ctx.derived.request_date = format(current_date_in_ist, 'dd-MMM-yyyy HH:mm:ss', { timeZone: ist_time_zone });
        ctx.derived.request_date_iso = format(current_date_in_ist, 'yyyy-MM-dd', { timeZone: ist_time_zone });
    }
}

class BankProductLockValidator extends BaseValidator {
    async validate(ctx) {
        const bankProductLock = await checkBankProductLock(`${ctx.input.netsuite_bank_id}`, `${ctx.input.netsuite_product_id}`);
        if (!bankProductLock) {
            throw new LeadClaimError(` Wrong product selected `);
        }
    }
}

class LoanApacRequiredValidator extends BaseValidator {
    /**
     * @param {{requireAlways?: boolean}} [config] `requireAlways` demands both
     *   identifiers regardless of `confirmation_required` — the manual edit path's rule.
     *   Default `false` preserves the bulk-upload behaviour.
     */
    constructor({ requireAlways = false } = {}) {
        super();
        this.requireAlways = requireAlways;
    }

    async validate(ctx) {
        const { confirmation_required, loan_reference_id, loan_apac_ref_los_number } = ctx.derived;
        if (this.requireAlways && (!loan_reference_id || !loan_apac_ref_los_number)) {
            throw new LeadClaimError(` Both apac/ref/los number and loan number are mandatory fields `);
        }
        if (!confirmation_required && (!loan_reference_id || !loan_apac_ref_los_number)) {
            throw new LeadClaimError(`Loan number and apac/ref/los number is required `);
        }
    }
}

class DisbursementDateRequiredValidator extends BaseValidator {
    async validate(ctx) {
        const { confirmation_required, is_split_case } = ctx.derived;
        if (isSplitCaseYes(is_split_case) && !ctx.input.disbursement_date_provided) {
            throw new LeadClaimError(`Disbursement Date is Mandatory in split cases`);
        }
        if (!confirmation_required && !ctx.input.disbursement_date_provided) {
            throw new LeadClaimError(`Disb_Date is required when confirmation required is false`);
        }
    }
}

/** Bank+product specific loan/APAC patterns (from Mongo) plus a special-character guard. */
class LoanApacFormatValidator extends BaseValidator {
    async validate(ctx) {
        const { loan_reference_id, loan_apac_ref_los_number } = ctx.derived;
        if (!loan_reference_id || !loan_apac_ref_los_number) return;

        const regexPattern = await getLeadFormField(`${ctx.input.netsuite_bank_id}`, `${ctx.input.netsuite_product_id}`);
        const isValid = checkIfLoanAndApacNumberIsValid(
            regexPattern,
            loan_reference_id,
            loan_apac_ref_los_number
        );
        if (isValid.error) {
            throw new LeadClaimError(isValid.error);
        }

        if (!SPECIAL_CHARACTER_PATTERN_OTHER_THAN_SLASH.test(loan_reference_id) || !SPECIAL_CHARACTER_PATTERN_OTHER_THAN_SLASH.test(loan_apac_ref_los_number)) {
            throw new LeadClaimError(`Loan/App_No or LOS/APAC_No Contains Special Character . `);
        }
    }
}

class MandatoryFieldsValidator extends BaseValidator {
    async validate(ctx) {
        const { customer_full_name, customer_first_name, customer_last_name, city } = ctx.derived;

        if (!customer_full_name) {
            throw new LeadClaimError(` Borrower_Name Is Mandatory Field . `);
        }
        if (!customer_first_name) {
            throw new LeadClaimError(`Borrower_First_Name Is Mandatory Field . `);
        }
        if (!customer_last_name) {
            throw new LeadClaimError(`Borrower_Last_Name Is Mandatory Field . `);
        }
        if (!ctx.input.disbursement_amount) {
            throw new LeadClaimError(`Disbursement/Insurance_Amount Is Mandatory Field . `);
        }
        if (!city) {
            throw new LeadClaimError(`City Is Mandatory Field . `);
        }
        if (!ctx.input.netsuite_bank_id) {
            throw new LeadClaimError(`Bank/Nbfc_ID Is Mandatory Field . `);
        }
        if (!ctx.input.netsuite_product_id) {
            throw new LeadClaimError(`Product_ID Is Mandatory Field . `);
        }
    }
}

/** Customer first/last name: letters and spaces only — no digits or special characters. */
class NameFormatValidator extends BaseValidator {
    async validate(ctx) {
        const { customer_first_name, customer_last_name } = ctx.derived;

        if (customer_first_name && !ALPHA_ONLY_NAME_PATTERN.test(customer_first_name)) {
            throw new LeadClaimError(`Borrower_First_Name Should Contain Only Alphabets . `);
        }
        if (customer_last_name && !ALPHA_ONLY_NAME_PATTERN.test(customer_last_name)) {
            throw new LeadClaimError(`Borrower_Last_Name Should Contain Only Alphabets . `);
        }
    }
}

const cleanCode = (value) => (value ?? '').toString().trim();

/**
 * Team Lead eligibility for a vendor. Returns a user-facing error message, or `null` when
 * the Team Lead is acceptable.
 *
 * - The TL's PAN must exist in `ru_dsa_kyc_data` (via `getVendorDetailsByPan`) on a DSA that
 *   is not deleted/blacklisted.
 * - Same team = the TL and the vendor share a `business_head_code` (the BH's mobile number),
 *   OR the TL *is* the vendor's business head (`vendor.business_head_code` equals the TL's
 *   own mobile number). Two blank codes never count as a match.
 */
const validateTeamLeadForVendor = async (teamLeadPan, vendor) => {
    const tl = await getVendorDetailsByPan(teamLeadPan);
    if (!tl || !tl.dsa_id || tl.is_deleted || tl.is_blacklisted) {
        return "Team Lead Vendor PAN not found";
    }

    const vendorBh = cleanCode(vendor?.business_head_code);
    const sameBh = vendorBh !== '' && vendorBh === cleanCode(tl.business_head_code);
    const tlIsVendorBh = vendorBh !== '' && vendorBh === cleanCode(tl.dsa_mobile_number);
    if (!sameBh && !tlIsVendorBh) {
        return "Team Lead should be of same Team";
    }
    return null;
};

/**
 * Optional "Employee/TL PAN". Blank is fine; anything else must be a well-formed PAN,
 * normalised to uppercase so what is stored (and later sent to the ERP) is canonical,
 * and must pass `validateTeamLeadForVendor`. Runs after vendor resolution (`ctx.dsa`).
 */
class TeamLeadPanValidator extends BaseValidator {
    async validate(ctx) {
        const raw = ctx.input.team_lead;
        if (raw === undefined || raw === null || String(raw).trim() === '') {
            ctx.input.team_lead = null;
            return;
        }
        const pan = String(raw).trim().toUpperCase();
        if (!validatePan(pan)) {
            throw new LeadClaimError(`Employee/TL PAN format is invalid`);
        }
        const teamLeadError = await validateTeamLeadForVendor(pan, ctx.dsa);
        if (teamLeadError) {
            throw new LeadClaimError(teamLeadError);
        }
        ctx.input.team_lead = pan;
    }
}

/**
 * External upload: bank & product are validated above. Auto-populate
 * payout type and rate/ratio (not present in the external Excel).
 */
class ExternalPayoutAutofillValidator extends BaseValidator {
    async validate(ctx) {
        if (!ctx.source.isExternal) return;

        const d = ctx.derived;
        const ext_payout_id = ctx.dsa.is_company ? ctx.dsa.registered_by_id : ctx.dsa.dsa_id;

        if (Number(d.business_categories) === INHOUSE_BUSINESS_CATEGORY) {
            // Inhouse must be Rate with Rate = 0
            d.vendor_payout_type = "rate";
            d.rate = 0;
            ctx.input.payout_type = "rate";
            ctx.input.payout_rate = 0;
            return;
        }

        const { payout_amount_multiplier, type } = await getBankProductMappedPayout(ext_payout_id, ctx.input.netsuite_product_id, ctx.input.netsuite_bank_id, null, false, d.disbursement_date_iso);
        d.vendor_payout_type = type;
        ctx.input.payout_type = type;
        if (type === "ratio") {
            d.ratio = payout_amount_multiplier;
            ctx.input.payout_ratio = payout_amount_multiplier;
        } else {
            d.rate = payout_amount_multiplier;
            ctx.input.payout_rate = payout_amount_multiplier;
        }
    }
}

class PayoutTypeValidator extends BaseValidator {
    async validate(ctx) {
        const vendor_payout_type = ctx.derived.vendor_payout_type;
        if (!vendor_payout_type) {
            throw new LeadClaimError(`Vendor Payout Type Is Mandatory Field . `);
        }
        if (!(vendor_payout_type?.toLowerCase() === "rate" || vendor_payout_type?.toLowerCase() === "ratio")) {
            throw new LeadClaimError(` Invalid Vendor Payout Type `);
        }

        // payout_id is used for both payout validations and master fallback lookups.
        // For company PAN uploads, payout should be taken from the company's owner (`registered_by_id`).
        ctx.derived.payout_id = ctx.dsa.is_company ? ctx.dsa.registered_by_id : ctx.dsa.dsa_id;
    }
}

/**
 * Payout rate/ratio + business-category rules. When the relevant value is zero the
 * master (`ru_dsa_payouts`) value is pulled in and the rules are re-run.
 */
class PayoutDetailsValidator extends BaseValidator {
    async validate(ctx) {
        const d = ctx.derived;

        const payoutValidation = await validateLeadPayoutAndBusinessCategory({
            netsuite_product_id: ctx.input.netsuite_product_id,
            business_categories: d.business_categories,
            payout_type: d.vendor_payout_type,
            payout_ratio: ctx.input.payout_ratio,
            payout_rate: ctx.input.payout_rate,
            isFinanceRoot: Boolean(ctx.source.isFinanceRoot)
        });

        if (payoutValidation.isValid) return;

        const payoutTypeLower = d.vendor_payout_type?.toLowerCase();
        const isInhouse = Number(d.business_categories) === INHOUSE_BUSINESS_CATEGORY;
        const rateNum = Number(ctx.input.payout_rate);
        const ratioNum = Number(ctx.input.payout_ratio);

        // Only fallback when validation failed AND the relevant value is zero (based on payout type).
        // Inhouse is excluded: it must be Rate with Rate=0, so no fallback should apply.
        const shouldTryFallback =
            !isInhouse &&
            ((payoutTypeLower === "rate" && !rateNum) ||
                (payoutTypeLower === "ratio" && !ratioNum));

        if (!shouldTryFallback) {
            throw new LeadClaimError(payoutValidation.message);
        }

        let payout_amount_multiplier;
        let type;
        try {
            ({ payout_amount_multiplier, type } = await getBankProductMappedPayout(
                d.payout_id,
                ctx.input.netsuite_product_id,
                ctx.input.netsuite_bank_id,
                payoutTypeLower,
                false,
                d.disbursement_date_iso
            ));
        } catch (err) {
            throw new LeadClaimError(`Unable to find Rate/Ratio in Master`);
        }

        if (payout_amount_multiplier == null || type !== payoutTypeLower) {
            throw new LeadClaimError(`Unable to find Rate/Ratio in Master`);
        }

        if (payoutTypeLower === "rate") {
            ctx.input.payout_rate = payout_amount_multiplier;
            d.rate = ctx.input.payout_rate;
        } else {
            ctx.input.payout_ratio = payout_amount_multiplier;
            d.ratio = ctx.input.payout_ratio;
        }

        const fallbackPayoutValidation = await validateLeadPayoutAndBusinessCategory({
            netsuite_product_id: ctx.input.netsuite_product_id,
            business_categories: d.business_categories,
            payout_type: d.vendor_payout_type,
            payout_ratio: ctx.input.payout_ratio,
            payout_rate: ctx.input.payout_rate,
            isFinanceRoot: Boolean(ctx.source.isFinanceRoot)
        });

        if (!fallbackPayoutValidation.isValid) {
            throw new LeadClaimError(fallbackPayoutValidation.message);
        }
    }
}

class SplitCaseRequiredValidator extends BaseValidator {
    async validate(ctx) {
        if (!ctx.derived.is_split_case) {
            throw new LeadClaimError(`Is Split Case Is Mandatory Field . `);
        }
        ctx.derived.netsuite_bank_id = ctx.input.netsuite_bank_id;
        ctx.derived.netsuite_product_id = ctx.input.netsuite_product_id;
    }
}

class ConfirmationMailAllowedValidator extends BaseValidator {
    async validate(ctx) {
        const is_confirmation_mail_allowed = await isConfirmationMailAllowedForProductId(ctx.derived.netsuite_product_id);
        ctx.derived.is_confirmation_mail_allowed = is_confirmation_mail_allowed;

        if (ctx.derived.confirmation_required && !is_confirmation_mail_allowed) {
            throw new LeadClaimError("Banker confirmation Mails are not allowed for this product");
        }
    }
}

class NetsuiteVendorIdValidator extends BaseValidator {
    async validate(ctx) {
        if (!ctx.dsa.netsuite_vendor_id) {
            // The PAN is only an *input* on PAN-keyed channels (bulk upload). The lead
            // form identifies by mobile, so its PAN arrives on the resolved vendor
            // instead. Falling back through both keeps this fallback channel-agnostic —
            // without it, binding `undefined` made Sequelize throw a replacement error
            // rather than the intended "NetSuite Vendor Id Not Found" message.
            const pan = ctx.input?.vendor_pan
                || ctx.derived?.pan
                || ctx.dsa.pan
                || ctx.dsa.permanent_account_number
                || null;

            if (pan) {
                const query = ` select netsuite_vendor_id , rdsa.dsa_mobile_number as dsa_mobile_number , rdsa.assigning_payout_percentage from ru_direct_selling_agents rdsa left join ru_dsa_kyc_data rdkd on rdsa.dsa_id=rdkd.dsa_id where rdkd.permanent_account_number = ? `;
                const result = await _db2.query(query, { replacements: [pan], type: QueryTypes.SELECT, useMaster: true });
                ctx.dsa.netsuite_vendor_id = result[0]?.netsuite_vendor_id || null;
            }
        }

        if (!ctx.dsa.netsuite_vendor_id) {
            throw new LeadClaimError(`NetSuite Vendor Id Not Found For This DSA . `);
        }
    }
}

/** Resolve banker/ASM RM users for meta + email. Failures are logged, never fatal. */
class RmUserResolutionValidator extends BaseValidator {
    async validate(ctx) {
        const d = ctx.derived;
        const common = {
            city: d.city || null,
            netsuite_bank_id: d.netsuite_bank_id || null,
            netsuite_product_id: d.netsuite_product_id || null,
            logged_in_user_id: ctx.source.actor?.id || null
        };

        if (d.banker_email) {
            try {
                d.banker_id = await updateOrCreateRMUser({
                    email: d.banker_email || null,
                    phone: d.banker_mobile || null,
                    name: d.banker_name || null,
                    ...common
                });
            } catch (err) {
                logger.error(`uploadLeadFormData: updateOrCreateRMUser banker failed for row ${ctx.source.rowIndex}: ${err.message}`);
            }
        }
        if (d.asm_email) {
            try {
                d.asm_id = await updateOrCreateRMUser({
                    email: d.asm_email || null,
                    phone: d.asm_mobile || null,
                    name: d.asm_name || null,
                    ...common
                });
            } catch (err) {
                logger.error(`uploadLeadFormData: updateOrCreateRMUser asm failed for row ${ctx.source.rowIndex}: ${err.message}`);
            }
        }
    }
}

/**
 * The disbursement date is parsed by the adapter (leniently, never throwing) so that a
 * row with both a bad date and a missing mandatory field still reports the mandatory-field
 * error, exactly as before. This validator only enforces the rule, at its original
 * position in the chain.
 */
class DisbursementDateValidator extends BaseValidator {
    async validate(ctx) {
        if (ctx.input.disbursement_date_is_future) {
            throw new LeadClaimError(`Disbursement Date is Greater Than Current Date. `);
        }
    }
}

class ContestValidator extends BaseValidator {
    async validate(ctx) {
        const { ns_contest_id, disbursement_date_iso } = ctx.derived;
        if (!ns_contest_id) return;

        const { isValid, message } = await checkNsContestIdExists(ns_contest_id, 'lead_form_contest', disbursement_date_iso);
        if (!isValid) {
            throw new LeadClaimError(message);
        }
    }
}

/**
 * An existing claim on the same loan/APAC + bank + product is only allowed when this
 * is a split case, and then only if the business-category combination permits it.
 *
 * On edit of a payout-sharing half, also ignore the known sibling (`previous_lead.sibling_lead`):
 * the pair legitimately shares loan/APAC+bank+product, and self-exclusion alone is not
 * enough. Paired with EditPayoutRestoreValidator's is_split_case restore so a client that
 * omits `is_split_case: true` still edits cleanly.
 */
class FreshLeadExistValidator extends BaseValidator {
    async validate(ctx) {
        const d = ctx.derived;
        if (!d.loan_reference_id || !d.loan_apac_ref_los_number) return;

        let freshLeadClaim = await checkIfFreshLeadExist({
            loan_reference_id: d.loan_reference_id,
            apac_ref_los_number: d.loan_apac_ref_los_number,
            netsuite_bank_id: d.netsuite_bank_id,
            netsuite_product_id: d.netsuite_product_id,
            fresh_lead_id: d.ref_id
        });

        if (!freshLeadClaim) return;

        // Paired-claim edit: the sibling shares loan/APAC+bank+product by design. Drop it
        // from the match list so we only care about *other* existing claims.
        const siblingId = d.previous_lead?.sibling_lead;
        if (siblingId && Array.isArray(freshLeadClaim)) {
            freshLeadClaim = freshLeadClaim.filter((row) => row.fresh_lead_id !== siblingId);
            if (!freshLeadClaim.length) return;
        }

        // A payout-sharing pair must be the FIRST thing written for this loan. Placed
        // before the split-case branch on purpose: after it, `validateBusinessCategory`'s
        // Mongo allow-list could quietly permit the pair on top of an existing claim, and
        // the pair would then be one of several claims on the loan — which silently breaks
        // `payoutSharing.findSiblingClaim`, the only way the two halves can find each
        // other (there is no link column). Fires for whichever half reaches it first;
        // either way nothing is written, because a pair validates fully before any write.
        if (ctx.pair) {
            throw new LeadClaimError(
                ` A claim already exists for this loan reference id , loan apac ref los number, product_id , bank_id — a payout sharing case cannot be added on top of it `
            );
        }

        if (!isSplitCaseYes(d.is_split_case)) {
            throw new LeadClaimError(` Lead Claim Already Present With this loan reference id , loan apac ref los number, product_id , bank_id `);
        }

        freshLeadClaim = await processSplitCaseFiles(freshLeadClaim, d.disbursement_date_iso);

        const isBusinessCategoryValid = await validateBusinessCategory(freshLeadClaim, {
            business_categories: d.business_categories,
            ns_hierarchy: ctx.dsa.ns_hierarchy,
            dsa_id: ctx.dsa.dsa_id,
            business_head_code: ctx.dsa.business_head_code
        });

        if (!isBusinessCategoryValid.isValid) {
            throw new LeadClaimError(isBusinessCategoryValid.message || "Duplicate Claim – Already Claimed by Other Team.");
        }
    }
}

class DisbursementDateAgeValidator extends BaseValidator {
    async validate(ctx) {
        const d = ctx.derived;
        if (!d.disbursement_date_iso) return;

        const isDisursementDateValid = validateDisbursementDate(d.disbursement_date_iso);
        if (!isDisursementDateValid.isValid) {
            throw new LeadClaimError(isDisursementDateValid.message);
        }
        d.claim_month = deriveClaimMonthFromDisbDate(d.disbursement_date_iso);
        ctx.input.claim_month = d.claim_month;
        // Excel echoes the derived claim month back into its report row; other channels
        // have no report, so this is optional bookkeeping, not part of the claim.
        if (ctx.row) ctx.row.claim_month = d.claim_month;
    }
}

/**
 * Disbursement amount must not exceed the bank/product's max_payout_amount for the
 * period covering the disbursement date. Runs after DisbursementDateAgeValidator so the
 * date is already validated.
 */
class MaxDisbursementAmountValidator extends BaseValidator {
    async validate(ctx) {
        const d = ctx.derived;
        const msg = await getMaxDisbursementAmountMessage({
            netsuite_bank_id: d.netsuite_bank_id,
            netsuite_product_id: d.netsuite_product_id,
            disbursement_amount: d.disbursement_amount,
            disbursement_date_iso: d.disbursement_date_iso
        });
        if (msg) {
            throw new LeadClaimError(msg);
        }
    }
}

class AdditionalLeadFormValidator extends BaseValidator {
    async validate(ctx) {
        const isAdditionalValidationSuccess = await additionalLeadFormValidation({
            class_id: ctx.dsa.class_id,
            partner_id: ctx.dsa.partner_id,
            account_number: ctx.dsa.account_number,
            account_status: ctx.dsa.account_status
        });
        if (!isAdditionalValidationSuccess?.isValid) {
            throw new LeadClaimError(isAdditionalValidationSuccess?.message);
        }
    }
}

/** Vendor payout caps + the resulting payout amount. */
class PayoutComputationValidator extends BaseValidator {
    async validate(ctx) {
        const d = ctx.derived;
        const { payout_collide, avg_achievment, vendor_payout_rate, vendor_payout_ratio } =
            await validateVendorPayoutNew(d.payout_id, d.netsuite_bank_id, d.netsuite_product_id, d.vendor_payout_type, d.rate, d.ratio, null, false, 0, null, null, d.disbursement_date_iso);

        const { vendor_payout_amount, payout_collide_value } = CalculatePayoutAmount({
            disbursement_amount: d.disbursement_amount,
            payout_type: d.vendor_payout_type,
            payout_rate: d.rate,
            payout_ratio: d.ratio,
            avg_achievment,
            vendor_payout_rate,
            vendor_payout_ratio,
            payout_collide
        });

        d.payout_collide = payout_collide;
        d.vendor_payout_amount = vendor_payout_amount;
        d.payout_collide_value = payout_collide_value;
    }
}

/** Search main bank files first, then tentative. */
class BankFileMatchValidator extends BaseValidator {
    /**
     * @param {{forUpdate?: boolean, releasePrevious?: boolean}} [config]
     *   `forUpdate` lets the search see a bank file this claim already owns (otherwise a
     *   `claimed = 1` row can never be re-found on an edit). `releasePrevious` records
     *   that a superseded match must be unlinked — the actual UPDATE is a side effect and
     *   is performed by `claimSideEffects`, never here.
     *   Both default `false`, which is exactly the bulk-upload behaviour.
     */
    constructor({ forUpdate = false, releasePrevious = false } = {}) {
        super();
        this.forUpdate = forUpdate;
        this.releasePrevious = releasePrevious;
    }

    async validate(ctx) {
        const d = ctx.derived;
        d.bankFileMatchResult = { is_matched: false, is_tentative_matched: 0, tentative_bank_file_id: null, is_bank_file_matched: 0, bank_file_id: null };

        if (d.loan_reference_id && d.loan_apac_ref_los_number && d.netsuite_bank_id && d.netsuite_product_id) {
            const freshLeadId = ctx.source?.targetFreshLeadId || null;
            d.bankFileMatchResult = await matchLeadBankFile(
                d.netsuite_bank_id,
                d.netsuite_product_id,
                d.loan_reference_id,
                d.loan_apac_ref_los_number,
                d.business_categories,
                0,
                this.forUpdate,
                this.forUpdate ? freshLeadId : null
            );

            if (this.releasePrevious && freshLeadId) {
                const r = d.bankFileMatchResult;
                // Only release when the claim previously held a match that is not the one
                // it now holds — covers both "found nothing" and "found a different row".
                const supersededMain = r.previous_bank_file_id && r.previous_bank_file_id !== r.bank_file_id;
                const supersededTentative = r.previous_tentative_bank_file_id && r.previous_tentative_bank_file_id !== r.tentative_bank_file_id;
                if (supersededMain || supersededTentative) {
                    d.bankFileToRelease = {
                        previous_bank_file_id: supersededMain ? r.previous_bank_file_id : null,
                        previous_tentative_bank_file_id: supersededTentative ? r.previous_tentative_bank_file_id : null
                    };
                }
            }
        }
    }
}

/** Flags the claim as multi-funded; never rejects the row. */
class DuplicateLeadValidator extends BaseValidator {
    async validate(ctx) {
        const d = ctx.derived;
        d.isDuplicate = null;

        if (!d.disbursement_amount || !d.netsuite_bank_id) return;

        d.isDuplicate = await checkIfDuplcateLeadExist({
            first_name: d.customer_first_name,
            last_name: d.customer_last_name,
            disbursement_date_iso: d.disbursement_date_iso,
            disbursement_amount: d.disbursement_amount,
            netsuite_vendor_id: ctx.dsa.netsuite_vendor_id,
            netsuite_product_id: d.netsuite_product_id,
            netsuite_bank_id: d.netsuite_bank_id,
            loan_reference_id: d.loan_reference_id,
            loan_apac_ref_los_number: d.loan_apac_ref_los_number,
            city: d.city,
            fresh_lead_id: d.ref_id,
            dsa_id: ctx.dsa.dsa_id,
            business_categories: d.business_categories,
            payout_type: d.vendor_payout_type,
            payout_rate: d.rate,
            payout_ratio: d.ratio
        });
    }
}

class OnlineLeadValidator extends BaseValidator {
    async validate(ctx) {
        const d = ctx.derived;
        d.is_online_lead = false;

        if (d.loan_reference_id && d.loan_apac_ref_los_number) {
            ({ is_online_lead: d.is_online_lead } = await onlineLeadCheck(
                d.product_name,
                ctx.dsa.dsa_id,
                d.loan_reference_id,
                d.loan_apac_ref_los_number,
                d.netsuite_bank_id,
                d.netsuite_product_id
            ));
        }
    }
}

module.exports = {
    VendorResolutionValidator,
    UploaderAuthorizationValidator,
    DsaStatusValidator,
    ConfirmationContactValidator,
    NsHierarchyEnrichmentValidator,
    RequestDateValidator,
    BankProductLockValidator,
    LoanApacRequiredValidator,
    DisbursementDateRequiredValidator,
    LoanApacFormatValidator,
    MandatoryFieldsValidator,
    NameFormatValidator,
    TeamLeadPanValidator,
    validateTeamLeadForVendor,
    ExternalPayoutAutofillValidator,
    PayoutTypeValidator,
    PayoutDetailsValidator,
    SplitCaseRequiredValidator,
    ConfirmationMailAllowedValidator,
    NetsuiteVendorIdValidator,
    RmUserResolutionValidator,
    DisbursementDateValidator,
    ContestValidator,
    FreshLeadExistValidator,
    DisbursementDateAgeValidator,
    MaxDisbursementAmountValidator,
    AdditionalLeadFormValidator,
    PayoutComputationValidator,
    BankFileMatchValidator,
    DuplicateLeadValidator,
    OnlineLeadValidator
};

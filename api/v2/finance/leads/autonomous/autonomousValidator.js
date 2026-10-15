const moment = require("moment");
const ValidationPipeline = require("../../ValidationPipeline");
const { BaseValidator } = ValidationPipeline;
const AutonomousError = require("./AutonomousError");
const DSAService = require("../../../../services/dsa-services");
const {
    buildAutonomousSettingsContext,
    buildVendorAutonomousRequestContext,
    getMinimumAllowedAutonomousDisbDateFrom,
    getVendorOnboardingStatus,
    isDsaAddressComplete,
    isDsaBankPennyDropVerified
} = require("./autonomousHelper");

// ---------------------------------------------------------------------------
// Reusable checks (vendor autonomous eligibility). Each names the table it reads.
// Validators below only throw AutonomousError — they do not persist anything.
// ---------------------------------------------------------------------------

/**
 * Tables: `ru_onboarding_steps`, `ru_user_onboarding_steps`
 * Individual / biller: steps for that dsa_type.
 * Company owner: individual + company steps (e.g. company_details, company_address, company_agreement).
 */
async function checkVendorOnboardingComplete(dsa_id, identity = null) {
    return getVendorOnboardingStatus(dsa_id, identity);
}

/**
 * Table: `ru_dsa_kyc_data` (via getDsaKycById)
 * Digio KYC when digio_status = 1. Otherwise treat as manual KYC.
 */
function isDigioKycCompleted(kyc) {
    return Number(kyc?.digio_status) === 1;
}

/**
 * Tables: `ru_user_onboarding_steps` (address / company_address),
 *         `ru_dsa_addresses`, `ru_company_addresses`
 */
async function checkVendorAddressComplete(dsa_id) {
    return isDsaAddressComplete(dsa_id);
}

/**
 * Table: `ru_dsa_bank_accounts` (digio_pennydrop_id / digio_pennydrop_verified_at)
 */
async function checkVendorBankPennyDropVerified(dsa_id) {
    return isDsaBankPennyDropVerified(dsa_id);
}

/**
 * Table: `ru_dsa_kyc_data.is_permanent_account_number_verified`
 * This is the AuthBridge PAN check (same flag used in AddBankDetailDsa).
 */
function isAuthBridgePanVerified(kyc) {
    return Number(kyc?.is_permanent_account_number_verified || 0) === 1;
}

/** Company vendors skip AuthBridge PAN (`ru_direct_selling_agents.user_type`). */
function shouldSkipAuthBridgePanCheck(user_type) {
    return String(user_type || "").toLowerCase() === "company";
}

/**
 * Email/mobile: `ru_direct_selling_agents` verification flags (not AuthBridge).
 * PAN: `ru_dsa_kyc_data.is_permanent_account_number_verified` (AuthBridge).
 * Skipped for Digio KYC callers, and for `user_type = company` (PAN only).
 */
async function checkVendorAuthBridgeContacts(dsa_id, kyc = null, options = {}) {
    const emailState = await DSAService.getDsaEmailVerificationState(dsa_id);
    const mobileVerified = await DSAService.checkDsaMobileNumberVerified(dsa_id);
    const email_verified = Number(emailState?.is_email_address_verified) === 1 && Boolean(emailState?.has_email);
    const mobile_verified = Number(mobileVerified) === 1;

    const skip_pan_check = shouldSkipAuthBridgePanCheck(options.user_type);
    const pan_verified = skip_pan_check ? true : isAuthBridgePanVerified(kyc);

    return {
        email_verified,
        mobile_verified,
        pan_verified,
        skip_pan_check,
        verified: email_verified && mobile_verified && pan_verified
    };
}

/**
 * Loads body fields and payout capping onto `context` (runs after finance-root auth).
 */
class AutonomousSettingsContextValidator extends BaseValidator {
    async validate(context) {
        const built = await buildAutonomousSettingsContext(context.req);
        Object.assign(context, built);
    }
}

/**
 * Context loader for vendor autonomous *request* (eligibility only).
 * Does not change save-settings. Fails if the DSA does not exist.
 */
class VendorAutonomousRequestContextValidator extends BaseValidator {
    async validate(context) {
        const built = await buildVendorAutonomousRequestContext(context.req);
        Object.assign(context, built);

        if (!context.dsa_id || !context.dsa) {
            throw new AutonomousError("DSA not found", 404, { code: "dsa_not_found" });
        }
    }
}

/**
 * Minimum allowed autonomous disbursement "from" date (business rule, IST calendar month).
 */
class AutonomousDisbDateFromMinValidator extends BaseValidator {
    async validate(context) {
        const { global_autonomous_disb_date_from } = context;
        if (!global_autonomous_disb_date_from) return;

        const minDisplay = getMinimumAllowedAutonomousDisbDateFrom();
        const fromM = moment(global_autonomous_disb_date_from, "YYYY-MM-DD", true);
        const minM = moment(minDisplay, "DD-MM-YYYY", true);
        if (fromM.isValid() && minM.isValid() && fromM.isBefore(minM, "day")) {
            throw new AutonomousError(
                `Autonomous start date cannot be earlier than ${minDisplay}.`,
                400,
                { code: "disb_date_too_early" }
            );
        }
    }
}

// Autonomous Vendor Payout => Picking the Lowest out of Payout Caping and (Unsecured / Secured Payout)
const MAX_SECURED_PAYOUT_LIMIT = 85;
const MAX_UNSECURED_PAYOUT_LIMIT = 90;

/**
 * Effective max = min(DSA assigning_payout_percentage, hard limit).
 * Falls back to the hard limit when capping is missing/invalid.
 */
function resolveAutonomousPayoutMax(payoutCapping, hardLimit) {
    const cap = Number(payoutCapping);
    if (!Number.isFinite(cap)) return hardLimit;
    return Math.min(cap, hardLimit);
}

/**
 * Validates autonomous_secured_payout against DSA payout capping.
 */
class SecuredPayoutCappingValidator extends BaseValidator {
    async validate(context) {
        const { autonomous_secured_payout, payoutCapping } = context;

        // Old logic (capping only):
        // if (autonomous_secured_payout != null && autonomous_secured_payout > payoutCapping) {
        //     throw new AutonomousError(
        //         `Autonomous Secured Payout cannot be greater than Payout Capping (${payoutCapping}%)`,
        //         400,
        //         { code: "secured_payout_exceeds_capping" }
        //     );
        // }

        // Autonomous Vendor Payout => Picking the Lowest out of Payout Caping and (Unsecured / Secured Payout)
        if (autonomous_secured_payout == null) return;

        const maxAllowed = resolveAutonomousPayoutMax(payoutCapping, MAX_SECURED_PAYOUT_LIMIT);
        if (autonomous_secured_payout > maxAllowed) {
            throw new AutonomousError(
                `Autonomous Secured Payout cannot be greater than ${maxAllowed}%`,
                400,
                { code: "secured_payout_exceeds_capping", max_allowed: maxAllowed }
            );
        }
    }
}

/**
 * Validates autonomous_unsecured_payout against DSA payout capping.
 */
class UnsecuredPayoutCappingValidator extends BaseValidator {
    async validate(context) {
        const { autonomous_unsecured_payout, payoutCapping } = context;

        // Old logic (capping only):
        // if (autonomous_unsecured_payout != null && autonomous_unsecured_payout > payoutCapping) {
        //     throw new AutonomousError(
        //         `Autonomous Unsecured Payout cannot be greater than Payout Capping (${payoutCapping}%)`,
        //         400,
        //         { code: "unsecured_payout_exceeds_capping" }
        //     );
        // }

        // Autonomous Vendor Payout => Picking the Lowest out of Payout Caping and (Unsecured / Secured Payout)
        if (autonomous_unsecured_payout == null) return;

        const maxAllowed = resolveAutonomousPayoutMax(payoutCapping, MAX_UNSECURED_PAYOUT_LIMIT);
        if (autonomous_unsecured_payout > maxAllowed) {
            throw new AutonomousError(
                `Autonomous Unsecured Payout cannot be greater than ${maxAllowed}%`,
                400,
                { code: "unsecured_payout_exceeds_capping", max_allowed: maxAllowed }
            );
        }
    }
}

/**
 * Tables: `ru_onboarding_steps`, `ru_user_onboarding_steps`
 * Fails when any required step for this vendor type is missing or not status = 1.
 */
class OnboardingCompleteValidator extends BaseValidator {
    async validate(context) {
        const status = await checkVendorOnboardingComplete(context.dsa_id, {
            business_mode: context.business_mode,
            dsa_types: context.dsa_types,
            company_id: context.company_id
        });
        context.onboarding = status;
        if (!status.complete) {
            throw new AutonomousError(
                "Onboarding steps are not completed",
                400,
                { code: "onboarding_incomplete", missing_steps: status.missing_steps }
            );
        }
    }
}

/**
 * Table: `ru_dsa_kyc_data.digio_status`
 * Sets `context.isDigioKyc`. Does not fail — AuthBridgeContactValidator uses the flag.
 */
class KycSourceValidator extends BaseValidator {
    async validate(context) {
        const kyc = await DSAService.getDsaKycById(context.dsa_id);
        context.kyc = kyc;
        context.isDigioKyc = isDigioKycCompleted(kyc);
    }
}

/**
 * Tables: `ru_user_onboarding_steps`, `ru_dsa_addresses`
 */
class AddressCompleteValidator extends BaseValidator {
    async validate(context) {
        const missingSteps = context.onboarding?.missing_steps || [];
        const addressMissingInOnboarding = missingSteps.some(
            (step) => step === "address" || step === "company_address"
        );

        const complete = await checkVendorAddressComplete(context.dsa_id);
        context.addressComplete = complete;

        // Onboarding already reports address as incomplete — avoid duplicate failure.
        if (!complete && !addressMissingInOnboarding) {
            throw new AutonomousError("Address is not complete", 400, { code: "address_incomplete" });
        }
    }
}

/**
 * Table: `ru_dsa_bank_accounts` (Digio penny-drop columns)
 */
class BankPennyDropValidator extends BaseValidator {
    async validate(context) {
        const verified = await checkVendorBankPennyDropVerified(context.dsa_id);
        context.bankPennyDropVerified = verified;
        if (!verified) {
            throw new AutonomousError(
                "Bank account verification failed (Penny Drop unsuccessful).",
                400,
                { code: "bank_penny_drop_unverified" }
            );
        }
    }
}

/**
 * Email + mobile verification flags, plus AuthBridge PAN (non-company only).
 * Skipped when KYC was done via Digio (`context.isDigioKyc`).
 */
class AuthBridgeContactValidator extends BaseValidator {
    async validate(context) {
        if (context.isDigioKyc) return;

        const kyc = context.kyc || await DSAService.getDsaKycById(context.dsa_id);
        const contacts = await checkVendorAuthBridgeContacts(context.dsa_id, kyc, {
            user_type: context.user_type
        });
        context.authBridgeContacts = contacts;
        if (contacts.verified) return;

        const missing = [];
        if (!contacts.email_verified) missing.push("email");
        if (!contacts.mobile_verified) missing.push("mobile");
        if (!contacts.skip_pan_check && !contacts.pan_verified) missing.push("pan");

        throw new AutonomousError(
            `Email, mobile or AuthBridge PAN verification incomplete (${missing.join(", ")})`,
            400,
            { code: "authbridge_contact_unverified", missing }
        );
    }
}

module.exports = {
    MAX_SECURED_PAYOUT_LIMIT,
    MAX_UNSECURED_PAYOUT_LIMIT,
    checkVendorOnboardingComplete,
    isDigioKycCompleted,
    isAuthBridgePanVerified,
    shouldSkipAuthBridgePanCheck,
    checkVendorAddressComplete,
    checkVendorBankPennyDropVerified,
    checkVendorAuthBridgeContacts,
    AutonomousSettingsContextValidator,
    VendorAutonomousRequestContextValidator,
    AutonomousDisbDateFromMinValidator,
    SecuredPayoutCappingValidator,
    UnsecuredPayoutCappingValidator,
    OnboardingCompleteValidator,
    KycSourceValidator,
    AddressCompleteValidator,
    BankPennyDropValidator,
    AuthBridgeContactValidator
};

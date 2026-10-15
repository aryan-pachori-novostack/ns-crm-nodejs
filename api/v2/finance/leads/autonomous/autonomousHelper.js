const moment = require("moment");
const { QueryTypes } = require("sequelize");
const { _db2 } = require("../../../../../models");
const { jsonDifference } = require("../../../../helpers/commonhelper");
const ApplicationLogServices = require("../../../../services/application-log-services");
const DSAService = require("../../../../services/dsa-services");
const FinanceService = require("../../../../services/finance-services");

const AUTONOMOUS_REQUEST_MODULE = "request_autonomous_for_vendor";

/**
 * Request Autonomous For Vendor only.
 * Checks global config key `request_autonomous_for_vendor` for allow-listed emails.
 */
async function hasRequestAutonomousForVendorPrivilege(loggedInUser) {
    const email = loggedInUser?.userEmail || loggedInUser?.email || null;
    return FinanceService.hasRequestAutonomousForVendorPrivilege(email);
}

/** Fallback if `ru_onboarding_steps` has no rows for the resolved types. */
const INDIVIDUAL_ONBOARDING_STEPS = [
    "lead_generation",
    "dsa_consent",
    "basic_details",
    "address",
    "kyc",
    "dsa_agreement"
];

/**
 * Same type resolution as getDsaSteps / getUserDsaProfile.
 * Company owner (business_mode = company AND owns the registered company) → individual + company.
 * Company employee or individual / biller → that mode only.
 *
 * Tables: `ru_direct_selling_agents`, `ru_companies`
 */
async function resolveVendorOnboardingTypes(dsa_id) {
    const rows = await _db2.query(
        `
        SELECT
            d.business_mode,
            d.user_type,
            d.company_id,
            c.company_id AS registered_company_id
        FROM ru_direct_selling_agents d
        LEFT JOIN ru_companies c ON c.registered_by = d.dsa_id
        WHERE d.dsa_id = ?
        LIMIT 1
        `,
        { replacements: [dsa_id], type: QueryTypes.SELECT }
    );

    const dsa = rows?.[0];
    if (!dsa) {
        return { business_mode: "individual", user_type: "individual", dsa_types: ["individual"], company_id: null };
    }

    let business_mode = dsa.business_mode || "individual";
    if (business_mode === "company" && dsa.company_id !== dsa.registered_company_id) {
        business_mode = "individual";
    }

    const dsa_types = business_mode === "company" ? ["individual", "company"] : [business_mode];
    return {
        business_mode,
        user_type: dsa.user_type || business_mode || "individual",
        dsa_types,
        company_id: dsa.company_id || dsa.registered_company_id || null
    };
}

/**
 * Minimum allowed "disbursement from" when the rule is:
 * not before the first day of the calendar month before "today" in Asia/Kolkata.
 * Returned as DD-MM-YYYY for display and messages (compare with API dates using moment).
 * Example: 23 Mar 2026 (IST) → "01-02-2026".
 * @param {Date} [referenceDate=new Date()]
 * @returns {string}
 */
function getMinimumAllowedAutonomousDisbDateFrom(referenceDate = new Date()) {
    const istDateStr = referenceDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return moment(istDateStr, "YYYY-MM-DD").startOf("month").subtract(1, "month").format("DD-MM-YYYY");
}

/**
 * Builder: validation + audit context from `req.body` (after route Joi).
 */
async function buildAutonomousSettingsContext(req) {
    const {
        dsa_id,
        autonomous_secured_payout,
        autonomous_unsecured_payout,
        global_autonomous_disb_date_from,
        global_autonomous_disb_date_to
    } = req.body;

    const { assigning_payout_percentage } = (await DSAService.getDsaById(dsa_id)) || {};
    const payoutCapping = Number(assigning_payout_percentage);

    return {
        req,
        dsa_id,
        autonomous_secured_payout,
        autonomous_unsecured_payout,
        global_autonomous_disb_date_from,
        global_autonomous_disb_date_to,
        payoutCapping
    };
}

/**
 * Context for `requestAutonomousForVendor` only (does not save settings).
 * Body is `dsa_id` only. Loads DSA + individual/company type for eligibility checks.
 */
async function buildVendorAutonomousRequestContext(req) {
    const dsa_id = req.body?.dsa_id || null;
    const dsa = dsa_id ? await DSAService.getDsaById(dsa_id) : null;
    const identity = dsa_id
        ? await resolveVendorOnboardingTypes(dsa_id)
        : { business_mode: "individual", user_type: "individual", dsa_types: ["individual"], company_id: null };

    return {
        req,
        dsa_id,
        dsa,
        business_mode: identity.business_mode,
        user_type: identity.user_type,
        dsa_types: identity.dsa_types,
        company_id: identity.company_id
    };
}

/**
 * Application log diff for autonomous settings + same-day billing enablement.
 */
async function recordAutonomousSettingsAudit(context, previousSettings, previousSameDayBilling) {
    const toNum = (v) => (v != null ? Number(v) : null);

    const difference = jsonDifference(
        {
            autonomous_secured_payout: toNum(previousSettings?.autonomous_secured_payout),
            autonomous_unsecured_payout: toNum(previousSettings?.autonomous_unsecured_payout),
            global_autonomous_disb_date_from: previousSettings?.global_autonomous_disb_date_from ?? null,
            global_autonomous_disb_date_to: previousSettings?.global_autonomous_disb_date_to ?? null,
            is_same_day_billing_enabled: Number(previousSameDayBilling)
        },
        {
            autonomous_secured_payout: toNum(context.autonomous_secured_payout),
            autonomous_unsecured_payout: toNum(context.autonomous_unsecured_payout),
            global_autonomous_disb_date_from: context.global_autonomous_disb_date_from ?? null,
            global_autonomous_disb_date_to: context.global_autonomous_disb_date_to ?? null,
            is_same_day_billing_enabled: 1
        }
    );

    const userId = context.req?.loggedInUser?.id || context.req?.dsa?.dsa_id || null;
    if (difference.length) {
        await ApplicationLogServices.bulkCreate(difference, context.dsa_id, "dsa", userId);
    }
}

/**
 * Apply autonomous settings from an approved / privileged Request Autonomous For Vendor.
 * Used only by that flow (validate auto-apply + Approve). Does not change other save APIs.
 */
async function applyVendorAutonomousSettingsFromApproval(payload, userId) {
    const {
        dsa_id,
        autonomous_secured_payout,
        autonomous_unsecured_payout,
        global_autonomous_disb_date_from,
        global_autonomous_disb_date_to
    } = payload || {};

    if (!dsa_id) {
        throw new Error("DSA ID missing in approval payload");
    }

    const previousSettings = await DSAService.getDsaAutonomousSettingsByDsaId(dsa_id);
    const previousSameDayBilling = await DSAService.getDsaSameDayBillingEnabledById(dsa_id);

    await DSAService.saveDsaAutonomousPaymentSettings({
        dsa_id,
        autonomous_secured_payout,
        autonomous_unsecured_payout,
        global_autonomous_disb_date_from,
        global_autonomous_disb_date_to
    });
    await DSAService.saveDsaSameDayBillingStatus(dsa_id, true);
    await DSAService.updateDsaAutonomousPayoutList(
        dsa_id,
        autonomous_secured_payout,
        autonomous_unsecured_payout,
        global_autonomous_disb_date_from,
        global_autonomous_disb_date_to
    );

    await recordAutonomousSettingsAudit(
        {
            req: { loggedInUser: { id: userId || null } },
            dsa_id,
            autonomous_secured_payout,
            autonomous_unsecured_payout,
            global_autonomous_disb_date_from,
            global_autonomous_disb_date_to
        },
        previousSettings,
        previousSameDayBilling
    );
}

/**
 * Tables: `ru_onboarding_steps` (expected steps by dsa_type), `ru_user_onboarding_steps` (status).
 * Complete = every required step for this vendor type has status = 1.
 * Company owners must finish individual + company steps (company_details, company_address, company_agreement, …).
 */
async function getVendorOnboardingStatus(dsa_id, identity = null) {
    const { business_mode, dsa_types, company_id } = identity || await resolveVendorOnboardingTypes(dsa_id);

    const catalog = await _db2.query(
        `
        SELECT o.step, s.status
        FROM ru_onboarding_steps o
        LEFT JOIN ru_user_onboarding_steps s
            ON s.step = o.step AND s.dsa_id = ?
        WHERE o.dsa_type IN (?)
        ORDER BY o.sort_order ASC
        `,
        { replacements: [dsa_id, dsa_types], type: QueryTypes.SELECT }
    );

    const expectedSteps = Array.from(
        new Map((catalog || []).map((row) => [row.step, row])).values()
    );
    const required = expectedSteps.length
        ? expectedSteps.map((row) => row.step)
        : INDIVIDUAL_ONBOARDING_STEPS;

    const completed = new Set(
        expectedSteps.length
            ? expectedSteps.filter((row) => Number(row.status) === 1).map((row) => row.step)
            : []
    );

    if (!expectedSteps.length) {
        const rows = await _db2.query(
            `
            SELECT step, status
            FROM ru_user_onboarding_steps
            WHERE dsa_id = ? AND step IN (?)
            `,
            { replacements: [dsa_id, required], type: QueryTypes.SELECT }
        );
        for (const row of rows || []) {
            if (Number(row.status) === 1) completed.add(row.step);
        }
    }

    const missing_steps = required.filter((step) => !completed.has(step));

    return {
        complete: missing_steps.length === 0,
        business_mode,
        company_id,
        required_steps: required,
        completed_steps: required.filter((step) => completed.has(step)),
        missing_steps
    };
}

/**
 * Tables: `ru_user_onboarding_steps` (address / company_address),
 *         `ru_dsa_addresses`, `ru_company_addresses`.
 */
async function isDsaAddressComplete(dsa_id) {
    const stepRows = await _db2.query(
        `
        SELECT 1 AS ok
        FROM ru_user_onboarding_steps
        WHERE dsa_id = ?
          AND step IN ('address', 'company_address')
          AND status = 1
        LIMIT 1
        `,
        { replacements: [dsa_id], type: QueryTypes.SELECT }
    );
    if (stepRows?.[0]) return true;

    const dsaAddress = await _db2.query(
        `
        SELECT 1 AS ok
        FROM ru_dsa_addresses
        WHERE dsa_id = ?
          AND TRIM(COALESCE(address_line_1, '')) != ''
          AND TRIM(COALESCE(city, '')) != ''
          AND TRIM(COALESCE(state, '')) != ''
          AND TRIM(COALESCE(pin_code, '')) != ''
        LIMIT 1
        `,
        { replacements: [dsa_id], type: QueryTypes.SELECT }
    );
    if (dsaAddress?.[0]) return true;

    const companyAddress = await _db2.query(
        `
        SELECT 1 AS ok
        FROM ru_company_addresses ca
        INNER JOIN ru_companies c ON c.company_id = ca.company_id
        WHERE (c.registered_by = ? OR c.company_id = (
            SELECT company_id FROM ru_direct_selling_agents WHERE dsa_id = ? LIMIT 1
        ))
          AND TRIM(COALESCE(ca.address_line_1, '')) != ''
          AND TRIM(COALESCE(ca.city, '')) != ''
          AND TRIM(COALESCE(ca.state, '')) != ''
          AND TRIM(COALESCE(ca.pin_code, '')) != ''
        LIMIT 1
        `,
        { replacements: [dsa_id, dsa_id], type: QueryTypes.SELECT }
    );
    return Boolean(companyAddress?.[0]);
}

/**
 * Table: `ru_dsa_bank_accounts`.
 * Penny-drop verified = at least one account has Digio penny-drop id or verified_at.
 */
async function isDsaBankPennyDropVerified(dsa_id) {
    const rows = await _db2.query(
        `
        SELECT 1 AS ok
        FROM ru_dsa_bank_accounts
        WHERE dsa_id = ?
          AND (
              digio_pennydrop_verified_at IS NOT NULL
              OR TRIM(COALESCE(digio_pennydrop_id, '')) != ''
          )
        LIMIT 1
        `,
        { replacements: [dsa_id], type: QueryTypes.SELECT }
    );
    return Boolean(rows?.[0]);
}

module.exports = {
    INDIVIDUAL_ONBOARDING_STEPS,
    AUTONOMOUS_REQUEST_MODULE,
    resolveVendorOnboardingTypes,
    buildAutonomousSettingsContext,
    buildVendorAutonomousRequestContext,
    recordAutonomousSettingsAudit,
    hasRequestAutonomousForVendorPrivilege,
    applyVendorAutonomousSettingsFromApproval,
    getMinimumAllowedAutonomousDisbDateFrom,
    getVendorOnboardingStatus,
    isDsaAddressComplete,
    isDsaBankPennyDropVerified
};

const { jsonDifference } = require("../../../../helpers/commonhelper");
const ApplicationLogServices = require("../../../../services/application-log-services");
const DSAService = require("../../../../services/dsa-services");
const ValidationPipeline = require("../../ValidationPipeline");
const { FinanceRootRequiredValidator } = require("../../financeRootPrivilegeAuth");
const {
    recordAutonomousSettingsAudit,
    applyVendorAutonomousSettingsFromApproval,
    hasRequestAutonomousForVendorPrivilege
} = require("./autonomousHelper");
const { buildLeadAutonomousContext, recordLeadAutonomousAudit } = require("./leadAutonomousHelper");
const approvalService = require("../../../../services/approval-services");
const {
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
} = require("./autonomousValidator");
const {
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
    RateRatioCapValidator
} = require("./leadAutonomousValidator");

/**
 * Intended for `safe()`-wrapped routes: returns `{ success, message, statusCode, data }`.
 * Body is validated by `reqValidator` on the route. Throws `FinanceAuthError` on forbidden
 * (`safe()` maps `type: "custom"` to the HTTP response).
 */
exports.disableDsaSameDayBilling = async (req) => {
    const { dsa_id } = req.body;
    const context = { req, dsa_id };
    // Finance-root OR RBAC `request_autonomous_for_vendor` can disable same-day billing.
    const canSkipFinanceRoot = await hasRequestAutonomousForVendorPrivilege(req?.loggedInUser);
    if (!canSkipFinanceRoot) {
        await new ValidationPipeline().use(new FinanceRootRequiredValidator()).run(context);
    }

    const previousRaw = await DSAService.getDsaSameDayBillingEnabledById(context.dsa_id);
    const data = await DSAService.saveDsaSameDayBillingStatus(context.dsa_id, false);

    const difference = jsonDifference(
        { is_same_day_billing_enabled: Number(previousRaw) },
        { is_same_day_billing_enabled: 0 }
    );
    const userId = req?.loggedInUser?.id || req?.dsa?.dsa_id || null;
    if (difference.length) {
        await ApplicationLogServices.bulkCreate(difference, context.dsa_id, "dsa", userId);
    }

    return {
        success: true,
        message: "Success",
        statusCode: 200,
        data
    };
};

/**
 * Save DSA autonomous payment settings (secured/unsecured payouts + dates).
 * Enables same-day billing. Intended for `safe()` + route `reqValidator`.
 */
exports.saveDsaAutonomousPaymentSettings = async (req) => {
    const context = { req };
    const pipeline = new ValidationPipeline();
    // Request Autonomous For Vendor only: users with RBAC `request_autonomous_for_vendor`
    // can write settings without finance-root (same skip rule as disableDsaSameDayBilling).
    const canSkipFinanceRoot = await hasRequestAutonomousForVendorPrivilege(req?.loggedInUser);
    if (!canSkipFinanceRoot) {
        pipeline.use(new FinanceRootRequiredValidator());
    }
    await pipeline
        .use(new AutonomousSettingsContextValidator())
        .use(new AutonomousDisbDateFromMinValidator())
        .use(new SecuredPayoutCappingValidator())
        .use(new UnsecuredPayoutCappingValidator())
        .run(context);

    const previousSettings = await DSAService.getDsaAutonomousSettingsByDsaId(context.dsa_id);
    const previousSameDayBilling = await DSAService.getDsaSameDayBillingEnabledById(context.dsa_id);

    const data = await DSAService.saveDsaAutonomousPaymentSettings(req.body);
    await DSAService.saveDsaSameDayBillingStatus(context.dsa_id, true);
    await DSAService.updateDsaAutonomousPayoutList(
        context.dsa_id,
        context.autonomous_secured_payout,
        context.autonomous_unsecured_payout,
        context.global_autonomous_disb_date_from,
        context.global_autonomous_disb_date_to
    );

    await recordAutonomousSettingsAudit(context, previousSettings, previousSameDayBilling);

    return {
        success: true,
        message: "Success",
        statusCode: 200,
        data
    };
};

/**
 * Update lead form autonomous / same-day billing flags and payout (v1-compatible business rules).
 * Route: `reqValidator(LeadValidationV1.updateLeadFormAutonomousStatus)` + `safe()` — no duplicate Joi in handler.
 */
exports.updateLeadFormAutonomousStatus = async (req) => {
    const context = buildLeadAutonomousContext(req);

    await new ValidationPipeline()
        .use(new SameDayBillingTimeValidator())
        .use(new LeadExistenceValidator())
        .use(new AutonomousSplitCategoryValidator())
        .use(new AutonomousBankCategoryValidator())
        .use(new PersonalLoanDisbursementValidator())
        .use(new DisbursementDateValidator())
        .use(new SecuredLoanTentativeMatchValidator())
        .use(new DisbursementDatePriorValidator())
        .use(new LeadDsaResolutionValidator())
        .use(new DsaSameDayBillingEnabledValidator())
        .use(new DsaPayoutConfiguredValidator())
        .use(new AutonomousSettingsConfiguredValidator())
        .use(new DisbursementDateRangeValidator())
        .use(new RateRatioCapValidator())
        .run(context);

    const { fresh_lead_id, same_day_billing, to_be_billed, pt, rate, ratio, lead, payoutCaps } = context;

    await DSAService.setLeadPayoutRateOrRatio(
        fresh_lead_id,
        pt === "rate" ? "rate" : "ratio",
        pt === "rate" ? rate : null,
        pt === "rate" ? null : ratio,
        0,
        pt === "rate" ? payoutCaps.autonomous_rate : payoutCaps.autonomous_ratio,
        lead?.disbursement_amount,
        pt === "rate" ? null : payoutCaps.avg_achievment,
        same_day_billing ? 1 : 0,
        to_be_billed ? 1 : 0,
        "fresh_lead_id"
    );

    await recordLeadAutonomousAudit(context);

    return {
        success: true,
        message: "Autonomous payment status updated successfully",
        statusCode: 200,
        data: {}
    };
};

const VENDOR_AUTONOMOUS_ACTION_KEY = "requestAutonomousForVendor";
const VENDOR_AUTONOMOUS_ACTION_LABEL = "Request Autonomous For Vendor";

async function collectVendorAutonomousEligibility(req) {
    const context = { req, failures: [] };

    await new ValidationPipeline()
        .use(new VendorAutonomousRequestContextValidator())
        .use(new OnboardingCompleteValidator())
        .use(new KycSourceValidator())
        .use(new AddressCompleteValidator())
        .use(new BankPennyDropValidator())
        .use(new AuthBridgeContactValidator())
        .runCollect(context);

    return context;
}

/** Same payout/date checks as save-dsa-autonomous-payment-settings (no finance-root, no save). */
async function validateVendorAutonomousSettings(req) {
    const context = { req };
    await new ValidationPipeline()
        .use(new AutonomousSettingsContextValidator())
        .use(new AutonomousDisbDateFromMinValidator())
        .use(new SecuredPayoutCappingValidator())
        .use(new UnsecuredPayoutCappingValidator())
        .run(context);
    return context;
}

/**
 * Eligibility check for a vendor autonomous request. Does not save settings or raise approvals.
 * Also used by approval replay after a CEO approves the raised request.
 */
exports.requestAutonomousForVendor = async (req) => {
    // Approval replay (jobs/processors/approvalReplay.js) after CEO approves.
    if (req?.body?._isApprovalReplay === true || req?.loggedInUser?.isApprovalReplay === true) {
        return {
            success: true,
            message: "Success",
            statusCode: 200,
            data: {}
        };
    }

    const context = await collectVendorAutonomousEligibility(req);

    if (context.failures.length) {
        return {
            success: false,
            message: "Autonomous request checks failed",
            statusCode: 400,
            data: { eligible: false, failures: context.failures }
        };
    }

    const requested_by = req?.loggedInUser?.id;
    let hasExistingRequest = false;

    if (requested_by) {
        // Block only while a previous request is still pending.
        // Approved / rejected can be raised again.
        hasExistingRequest = await approvalService.hasRecentApproval({
            requested_by,
            action_key: VENDOR_AUTONOMOUS_ACTION_KEY,
            statuses: ["pending"]
        });
    }

    return {
        success: true,
        message: hasExistingRequest
            ? "Eligible, but a request is already raised"
            : "Eligible for autonomous request",
        statusCode: 200,
        data: {
            eligible: true,
            hasExistingRequest
        }
    };
};

/**
 * Validate payout/date values before raising.
 * Call this on Submit after the user fills settings.
 * Also auto-creates a pending approval with approver_id NULL (assignment logic later).
 */
exports.validateAutonomousRequestSettings = async (req) => {
    await validateVendorAutonomousSettings(req);

    // Request Autonomous For Vendor only: auto-apply + skip permission screen
    // iff the caller has RBAC `request_autonomous_for_vendor`. Anyone else gets
    // false and must raise; this is not finance-root and does not auto-approve raise.
    const hasPrivilege = await hasRequestAutonomousForVendorPrivilege(req?.loggedInUser);

    const {
        dsa_id,
        autonomous_secured_payout,
        autonomous_unsecured_payout,
        global_autonomous_disb_date_from,
        global_autonomous_disb_date_to
    } = req.body;

    if (hasPrivilege) {
        await applyVendorAutonomousSettingsFromApproval(
            {
                dsa_id,
                autonomous_secured_payout,
                autonomous_unsecured_payout,
                global_autonomous_disb_date_from,
                global_autonomous_disb_date_to
            },
            req?.loggedInUser?.id
        );
    }

    // Separate enhancement: always raise a pending request with no approver assigned yet.
    const approvalId = await approvalService.createApproval({
        action_key: VENDOR_AUTONOMOUS_ACTION_KEY,
        action_label: VENDOR_AUTONOMOUS_ACTION_LABEL,
        method: "POST",
        endpoint: "/v2/dsa/save-dsa-autonomous-payment-settings",
        payload: {
            dsa_id,
            autonomous_secured_payout,
            autonomous_unsecured_payout,
            global_autonomous_disb_date_from,
            global_autonomous_disb_date_to
        },
        requested_by: req?.loggedInUser?.id || null,
        approver_id: null
    });

    return {
        success: true,
        message: hasPrivilege
            ? "Success"
            : "Request raised. Please wait for approval.",
        statusCode: 200,
        data: {
            hasRequestAutonomousForVendorPrivilege: hasPrivilege,
            approvalId
        }
    };
};

/**
 * Raise an approval request for vendor autonomous settings.
 * Always pending — never auto-approves, even if the requester has the privilege
 * (privilege holders apply via validate instead). Other approval types unchanged.
 */
exports.raiseAutonomousRequestForVendor = async (req) => {
    const {
        dsa_id,
        autonomous_secured_payout,
        autonomous_unsecured_payout,
        global_autonomous_disb_date_from,
        global_autonomous_disb_date_to
    } = req.body;
    const approver_id = req.body.approver_id || req.body._approverId || null;
    const requested_by = req?.loggedInUser?.id;

    if (!requested_by) {
        return {
            success: false,
            message: "Unauthorized: requester not resolved",
            statusCode: 401,
            data: {}
        };
    }

    if (!approver_id) {
        return {
            success: false,
            message: "Approver is required",
            statusCode: 400,
            data: {}
        };
    }

    const alreadyRequested = await approvalService.hasRecentApproval({
        requested_by,
        action_key: VENDOR_AUTONOMOUS_ACTION_KEY,
        statuses: ["pending"]
    });

    if (alreadyRequested) {
        return {
            success: false,
            message: "You have already raised this request.",
            statusCode: 429,
            data: {}
        };
    }

    await validateVendorAutonomousSettings(req);

    const approvalId = await approvalService.createApproval({
        action_key: VENDOR_AUTONOMOUS_ACTION_KEY,
        action_label: VENDOR_AUTONOMOUS_ACTION_LABEL,
        method: "POST",
        // Replay after CEO approval runs the eligibility endpoint, not this raise endpoint.
        // endpoint: "/v2/dsa/request-autonomous-for-vendor",
        endpoint: "/v2/dsa/save-dsa-autonomous-payment-settings",
        payload: {
            dsa_id,
            autonomous_secured_payout,
            autonomous_unsecured_payout,
            global_autonomous_disb_date_from,
            global_autonomous_disb_date_to
        },
        requested_by,
        approver_id
    });

    return {
        success: true,
        message: "APPROVAL_PENDING",
        statusCode: 202,
        data: {
            status: "APPROVAL_PENDING",
            approvalId
        }
    };
};

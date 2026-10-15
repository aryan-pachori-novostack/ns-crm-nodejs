const ValidationPipeline = require("../../ValidationPipeline");
const { BaseValidator } = ValidationPipeline;
const LeadClaimError = require("../claims/LeadClaimError");
const {
    VendorResolutionValidator,
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
} = require("../claims/claimValidators");

/**
 * Validator chains for the manual lead-form add/edit API.
 *
 * These are **compositions, not new code** — every class below is the same shared
 * validator the bulk Excel upload runs, which is the payoff of T06-T09 making the
 * validators channel-agnostic. The differences between the two flows are expressed by
 * *which* validators are composed and *how they are configured*, never by an
 * `if (channel === …)` inside a validator.
 *
 * Behaviour the plan deliberately unifies here (all user-approved, see the risk
 * register): the manual flow gains the loan/APAC special-character guard and the master
 * rate/ratio fallback; the edit path starts recomputing payout, claim month and the
 * multi-funded flag, which it previously left stale.
 *
 * `UploaderAuthorizationValidator` is deliberately NOT composed here, unlike the Excel
 * pipeline. In `main` it only ever guarded `jobs/processors/uploadLeadFormData.js` (the
 * Excel processor) — the manual `AddFreshLeadClaim`/`add_external_claim` controller never
 * had a hierarchy check at all. Composing it into this pipeline during the 2026-08
 * migration was an unintended behavior change: it went live for the first time ever on
 * the manual channel and immediately rejected valid Lead Admin (and similar
 * backend-access-role) uploads, since those users normally have no personal `dsa_id` and
 * the manual channel never resolves a parent the way the Excel controller does. Leaving
 * it out here restores the exact pre-migration manual-channel behavior; Excel's own
 * pipeline (`uploadExcelPipeline.js`) is unchanged and keeps the check.
 *
 * The `NOT_ALLOWED_BANKS` block (R3) was **removed from both channels** on 2026-08-06 at
 * the user's instruction, and the constant deleted. Note this is a deliberate divergence
 * from `main`, which still rejects bank 9850 on the Excel path
 * (`jobs/processors/uploadLeadFormData.js:758`) — sourcing for that bank is now claimable
 * everywhere.
 */

/**
 * Per-request pipeline. Unlike the Excel batch — which records a row's error and carries
 * on — a single HTTP request has nothing to carry on to, so the first failure propagates
 * and `safe(..., { envelope: "v1" })` turns it into the 400 the client expects.
 */
class LeadFormPipeline extends ValidationPipeline { }

/**
 * The manual flow has no PAN column: the vendor is identified by mobile (or `company_id`
 * for a company), carried on `input.vendor_lookup` by the adapter. Joi has already
 * enforced presence and the 10-digit shape, so this only guards the external branch
 * where the body is the sole source of the number.
 */
class VendorLookupRequiredValidator extends BaseValidator {
    async validate(ctx) {
        const lookup = ctx.input.vendor_lookup;
        if (!lookup?.value) {
            throw new LeadClaimError(
                lookup?.by === "company_id" ? "Company id is mandatory" : "DSA mobile number is mandatory"
            );
        }
    }
}

/**
 * The external route (`dsa/add_external_claim`) arrives with **no actor**:
 * `AuthHelper.authorizeDsaCentralized` sets `req.dsa` and never `req.loggedInUser`
 * (`authhelper.js:646`). The pre-migration controller compensated by synthesising one
 * *after* resolving the vendor — from the resolved DSA, not from the token
 * (`main:controllers/dsa/index.js:8940`).
 *
 * Without it `ctx.source.actor`/`ctx.job.leader` stay null, and both `created_by`
 * (`claimValidators.js`'s `logged_in_user_id`) and the row mapper's leader attribution
 * dereference null on the insert path — every external claim from
 * `ruloans-dashboard-react` (`src/pages/add-new-claim/index.js:914`) would fail.
 *
 * Placed AFTER `VendorResolutionValidator` so it reads the same resolved vendor main
 * used, carrying `dsa_id` (which main's synthesised object lacked).
 */
class ExternalActorValidator extends BaseValidator {
    async validate(ctx) {
        // Gate on "no actor", NOT on `isExternal`. `isExternal` is
        // `Boolean(req.dsa && !req.loggedInUser)`, which is false for the `AUTH_KEY_EXTERNAL`
        // static-token bypass (`authhelper.js:596-599` calls `next()` setting *neither*
        // `req.dsa` nor `req.loggedInUser`). Gating on it left that caller with a null actor
        // and the same 500. Main branched on `!req.loggedInUser` and resolved the vendor from
        // the body, so keying off the missing actor is what actually matches main.
        if (ctx.source.actor) return;

        const dsa = ctx.dsa || {};

        // `id` is what claimRowMapper saves as `created_by`; it used to be `null`, leaving ~all web_application
        // claims with an empty created_by. The creator is the vendor: the DSA, or for a company the DSA that
        // registered it — name / email / phone come from `ctx.dsa.vendor` (VendorResolutionValidator).
        const vendor = dsa.vendor || {};
        ctx.source.actor = {
            id: (dsa.is_company ? (dsa.registered_by_id || dsa.dsa_id) : dsa.dsa_id) || null,
            dsa_id: dsa.dsa_id,
            userPhone: vendor.phone,
            userEmail: vendor.email,
            userName: vendor.name
        };
        // `claimRowMapper` still reads leader/parent_user off `ctx.job`; keep the bridge in
        // step or `created_by` dereferences null on the insert path.
        if (ctx.job) ctx.job.leader = ctx.source.actor;
    }
}

/** A claim that has already moved into ERP cannot be edited. */
class ErpStatusNotEditableValidator extends BaseValidator {
    async validate(ctx) {
        const previous = ctx.derived?.previous_lead;
        if (!previous) return;

        const ERP_STATUSES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        if (ERP_STATUSES.includes(Number(previous.fresh_lead_status_id))) {
            throw new LeadClaimError("Cannot edit this lead form");
        }
    }
}

/**
 * On edit the stored payout is authoritative — the client does not get to change
 * rate/ratio/type through this route, matching the pre-migration controller which
 * overwrote them from the DB before validating.
 *
 * When the claim is half of a payout-sharing pair (`sibling_lead` set), also restore
 * `is_split_case` from the previous row. A paired claim is structurally a split case;
 * if the client omits or sends `false`, FreshLeadExistValidator would otherwise treat
 * the sibling as a duplicate and return a confusing "already present" error.
 */
class EditPayoutRestoreValidator extends BaseValidator {
    async validate(ctx) {
        const previous = ctx.derived?.previous_lead;
        if (!previous) return;

        ctx.input.payout_type = previous.vendor_payout_type;
        ctx.input.payout_rate = previous.vendor_payout_rate;
        ctx.input.payout_ratio = previous.vendor_payout_ratio;
        ctx.derived.vendor_payout_type = previous.vendor_payout_type;
        ctx.derived.rate = previous.vendor_payout_rate;
        ctx.derived.ratio = previous.vendor_payout_ratio;
        ctx.derived.mail_thread_id = previous.mail_thread_id;

        if (previous.sibling_lead) {
            // A paired claim is structurally a split case. Restore it from the previous
            // row, normalised to lowercase — the column stores "yes"/"no" and every
            // reader compares lowercase; older rows may still hold "Yes"/"YES".
            const restored = String(previous.is_split_case ?? "").trim().toLowerCase() || null;
            ctx.input.is_split_case = restored;
            ctx.derived.is_split_case = restored;
        }
    }
}

/**
 * Once a claim has a sibling (it's half of a payout-sharing pair, `sibling_lead` set by
 * `claimPairBuilder` at creation), bank / product / business category can't drift — those
 * fields define the pair. An edit that changes any of them would leave the sibling pointing
 * at a claim that no longer matches, and this endpoint never touches the sibling.
 *
 * Rejects rather than silently restoring (unlike `EditPayoutRestoreValidator`): changing
 * these on a paired claim is a request to leave/reshape the pair, which edit cannot do
 * safely, so surfacing it beats masking it. First mismatch wins (category, then bank,
 * then product) so the message stays field-specific.
 */
class SiblingLeadPairFieldsLockValidator extends BaseValidator {
    async validate(ctx) {
        const previous = ctx.derived?.previous_lead;
        if (!previous?.sibling_lead) return;

        const same = (a, b) => String(a ?? "") === String(b ?? "");

        if (!same(previous.business_categories, ctx.input.business_categories)) {
            throw new LeadClaimError(
                `Cannot change business category — this claim is part of a payout sharing pair`
            );
        }
        if (!same(previous.netsuite_bank_id, ctx.input.netsuite_bank_id)) {
            throw new LeadClaimError(
                `Cannot change bank — this claim is part of a payout sharing pair`
            );
        }
        if (!same(previous.netsuite_product_id, ctx.input.netsuite_product_id)) {
            throw new LeadClaimError(
                `Cannot change product — this claim is part of a payout sharing pair`
            );
        }
    }
}

/** @deprecated name — use SiblingLeadPairFieldsLockValidator */
const SiblingLeadCategoryLockValidator = SiblingLeadPairFieldsLockValidator;

/** Load the claim being edited so the guards above and the audit diff have it. */
class TargetClaimLoadValidator extends BaseValidator {
    async validate(ctx) {
        const target = ctx.source.targetFreshLeadId;
        if (!target) return;

        const claimRepository = require("../claims/FreshLeadClaimRepository");
        const previous = await claimRepository.findWithVendorById(target);
        if (!previous) {
            throw new LeadClaimError("Wrong fresh_lead_id selected");
        }
        ctx.derived.previous_lead = previous;
        ctx.derived.previous_lead_id = previous.id;
    }
}

/** Shared spine both modes run, in the Excel pipeline's proven order. */
const withCommonValidators = (pipeline) => pipeline
    .use(new NsHierarchyEnrichmentValidator())
    .use(new RequestDateValidator())
    .use(new BankProductLockValidator())
    .use(new DisbursementDateRequiredValidator())
    .use(new LoanApacFormatValidator())
    .use(new MandatoryFieldsValidator())
    .use(new NameFormatValidator())
    .use(new ExternalPayoutAutofillValidator())
    .use(new PayoutTypeValidator())
    .use(new PayoutDetailsValidator())
    .use(new SplitCaseRequiredValidator())
    .use(new ConfirmationMailAllowedValidator())
    .use(new NetsuiteVendorIdValidator())
    .use(new RmUserResolutionValidator())
    .use(new DisbursementDateValidator())
    .use(new ContestValidator())
    .use(new FreshLeadExistValidator())
    .use(new DisbursementDateAgeValidator())
    .use(new MaxDisbursementAmountValidator())
    .use(new AdditionalLeadFormValidator())
    .use(new PayoutComputationValidator())
    .use(new DuplicateLeadValidator())
    .use(new OnlineLeadValidator());

const buildLeadFormAddPipeline = () => withCommonValidators(
    new LeadFormPipeline()
        .use(new VendorLookupRequiredValidator())
        .use(new VendorResolutionValidator())
        .use(new ExternalActorValidator())
        .use(new DsaStatusValidator())
        .use(new ConfirmationContactValidator())
        .use(new LoanApacRequiredValidator())
        .use(new TeamLeadPanValidator())
).use(new BankFileMatchValidator());

const buildLeadFormEditPipeline = () => withCommonValidators(
    new LeadFormPipeline()
        .use(new VendorLookupRequiredValidator())
        .use(new VendorResolutionValidator())
        .use(new ExternalActorValidator())
        .use(new DsaStatusValidator())
        .use(new TargetClaimLoadValidator())
        .use(new ErpStatusNotEditableValidator())
        .use(new SiblingLeadPairFieldsLockValidator())
        .use(new EditPayoutRestoreValidator())
        .use(new ConfirmationContactValidator())
        // Edit requires BOTH identifiers, unlike add where they are conditional.
        .use(new LoanApacRequiredValidator({ requireAlways: true }))
        .use(new TeamLeadPanValidator())
)
    // for_update so a changed loan/APAC releases the previously matched bank file
    // instead of leaking it — the bug the Excel edit path still has (risk R12).
    .use(new BankFileMatchValidator({ forUpdate: true, releasePrevious: true }));

module.exports = {
    LeadFormPipeline,
    buildLeadFormAddPipeline,
    buildLeadFormEditPipeline,
    VendorLookupRequiredValidator,
    ExternalActorValidator,
    ErpStatusNotEditableValidator,
    SiblingLeadPairFieldsLockValidator,
    SiblingLeadCategoryLockValidator,
    EditPayoutRestoreValidator,
    TargetClaimLoadValidator
};

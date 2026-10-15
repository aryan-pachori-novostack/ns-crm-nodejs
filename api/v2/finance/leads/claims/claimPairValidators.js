const ValidationPipeline = require("../../ValidationPipeline");
const { BaseValidator } = ValidationPipeline;
const LeadClaimError = require("./LeadClaimError");
const payoutSharing = require("./payoutSharing");

/**
 * Rules that can only be checked once BOTH halves of a payout-sharing pair have been
 * through the full validator chain — the category combination, the combined payout cap,
 * and the invariants the pair builder set up.
 *
 * These live here rather than in `claimValidators.js` because they take a *pair*
 * (`{ primary, sharer }`), not a context. They still throw `LeadClaimError`, and that one
 * choice is what makes every message land correctly on both surfaces with no extra
 * plumbing: the Excel path routes `type === "custom"` to `onRowError` and into the S3
 * report, and the manual route renders it as a 400.
 *
 * Ordering matters — the combination check runs first so that a nonsensical pair produces
 * "wrong categories" rather than a confusing cap message computed from garbage.
 */

/** Same abort protocol as `UploadExcelPipeline`, so the Excel batch can continue. */
class ClaimPairPipeline extends ValidationPipeline {
    async run(pair, onCustomError) {
        if (typeof onCustomError !== "function") {
            await super.run(pair);
            return { aborted: false };
        }
        for (const validator of this.validators) {
            try {
                await validator.validate(pair);
            } catch (error) {
                if (error?.type === "custom") {
                    await onCustomError(error, pair.primary);
                    return { aborted: true };
                }
                throw error;
            }
        }
        return { aborted: false };
    }
}

/**
 * Exactly one category-17 claim, and the partner drawn from {4, 16}.
 *
 * Also the place a half-filled sharing block surfaces: the builder treats ANY of the three
 * fields as intent to pair, so a row with a PAN but no category lands here with a precise
 * message rather than silently writing one ordinary claim.
 */
class PairCategoryComboValidator extends BaseValidator {
    async validate({ primary, sharer }) {
        const missing = payoutSharing.missingSharingFields(primary.input);
        if (missing.length) {
            throw new LeadClaimError(
                `Payout Sharing Case requires all sharing fields. Missing: ${missing.join(", ")}`
            );
        }

        const primaryCategory = Number(primary.derived.business_categories);
        const sharerCategory = Number(sharer.derived.business_categories);

        if (primaryCategory !== payoutSharing.PAYOUT_SHARING_CASE) {
            throw new LeadClaimError(
                `Sharing fields are only allowed on a Payout Sharing Case (business category ${payoutSharing.PAYOUT_SHARING_CASE})`
            );
        }
        if (!payoutSharing.SHARING_PARTNER_CATEGORIES.has(sharerCategory)) {
            throw new LeadClaimError(
                `Sharing business category must be ${[...payoutSharing.SHARING_PARTNER_CATEGORIES].join(" or ")}`
            );
        }
    }
}

/** The two halves must be different DSAs — otherwise it is one claim entered twice. */
class PairDistinctVendorValidator extends BaseValidator {
    async validate({ primary, sharer }) {
        if (!sharer.dsa?.dsa_id) {
            throw new LeadClaimError("Sharing DSA could not be resolved from the PAN provided");
        }
        if (primary.dsa?.dsa_id && primary.dsa.dsa_id === sharer.dsa.dsa_id) {
            throw new LeadClaimError("Sharing DSA must be different from the claiming DSA");
        }
    }
}

/**
 * Defensive. The builder routes one wire value by the pair's shared payout type, so the
 * types match by construction — but `PayoutDetailsValidator`'s master fallback can
 * independently rewrite either context's payout, so assert rather than assume.
 */
class PairPayoutTypeMatchValidator extends BaseValidator {
    async validate({ primary, sharer }) {
        const a = String(primary.derived.vendor_payout_type || "").trim().toLowerCase();
        const b = String(sharer.derived.vendor_payout_type || "").trim().toLowerCase();
        if (a !== b) {
            throw new LeadClaimError(`Payout type must be the same for both leads of a sharing case (got ${a || "empty"} and ${b || "empty"})`);
        }
    }
}

/**
 * The combined-payout cap (rate_A + rate_B <= 0.95 x avg_achievment, ratio <= 95) used to
 * live here and was **deliberately removed on 2026-08-07**.
 *
 * It belongs at **ERP submission**, not at claim creation: a claim should be recordable
 * when it happens and checked when it is actually sent. Enforcing it here blocked entry of
 * claims that are perfectly valid to record.
 *
 * Per-claim payout limits are untouched — each half still goes through
 * `PayoutDetailsValidator` -> `validatePayoutRateRatioLimits` (`MAX_PAYOUT_RATE = 5`, the
 * ratio band) and `PayoutComputationValidator`. Only the *combined* check is gone from
 * create — it is now `LeadSiblingCombinedPayoutCapValidator` in `erp/erpValidators.js`.
 */

/** The builder forces this; assert nothing downstream un-set it. */
class PairSplitCaseFlagValidator extends BaseValidator {
    async validate({ primary, sharer }) {
        for (const ctx of [primary, sharer]) {
            if (String(ctx.derived.is_split_case || "").trim().toLowerCase() !== "yes") {
                throw new LeadClaimError("A payout sharing case must be marked as a split case");
            }
        }
    }
}

/**
 * `ru_dsa_bank_files.fresh_lead_id` is single-valued (`finance-services.js:897`), so if
 * both halves matched the same bank file the second write would clobber the first and
 * leave the first claim pointing at a row that no longer points back.
 *
 * Today this can never fire: categories 4 and 16 are both absent from
 * `ALLOWED_BANK_FILE_MATCH_BUSINESS_CATEGORIES` (`finance-services.js:810`), so a sharer
 * never attempts matching. This is the guard that keeps that true if someone adds 16 to
 * that set later — it strips the match rather than failing the claim, because the
 * matching is an optimisation, not part of the operator's intent.
 */
class PairBankFileOwnershipValidator extends BaseValidator {
    async validate({ sharer }) {
        const match = sharer.derived?.bankFileMatchResult;
        if (!match?.is_matched) return;

        sharer.derived.bankFileMatchResult = {
            is_matched: false,
            is_tentative_matched: 0,
            tentative_bank_file_id: null,
            is_bank_file_matched: 0,
            bank_file_id: null
        };
    }
}

const buildClaimPairPipeline = () => new ClaimPairPipeline()
    .use(new PairCategoryComboValidator())
    .use(new PairDistinctVendorValidator())
    .use(new PairPayoutTypeMatchValidator())
    .use(new PairSplitCaseFlagValidator())
    .use(new PairBankFileOwnershipValidator());

module.exports = {
    ClaimPairPipeline,
    buildClaimPairPipeline,
    PairCategoryComboValidator,
    PairDistinctVendorValidator,
    PairPayoutTypeMatchValidator,
    PairSplitCaseFlagValidator,
    PairBankFileOwnershipValidator
};

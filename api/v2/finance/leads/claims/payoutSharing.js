const { QueryTypes } = require("sequelize");
const { _db2 } = require("../../../../../models");

/**
 * Payout-sharing split cases: the vocabulary shared by the pair builder, the pair
 * validators, and the reconciliation path that mirrors a banker's reply onto the sibling.
 *
 * A payout-sharing case is ONE loan whose payout is split between TWO DSAs. One Excel row
 * (or one `AddFreshLeadClaim` body) carries three extra fields identifying the second DSA,
 * and the system writes two claims atomically:
 *
 *   primary — the originating DSA,  business category 17 (Payout Sharing Case)
 *   sharer  — the second DSA,       business category 4 or 16
 *
 * Before this, `is_split_case` merely *relaxed* the duplicate rejection so a human could
 * enter the second claim by hand; nothing ever produced two claims from one input.
 */

/** Confirmed against `RULoans.picklist_values` (picklist key 612478, module "Lead Forms"). */
const PAYOUT_SHARING_CASE = 17;          // "Payout Sharing Case"      — always the primary
const SHARING_PAYOUT_ZERO_PNL = 4;       // "Sharing Payout-Zero In PNL"
const BACK_OFFICE_CHARGES = 16;          // "Back Office Charges"

/** The categories a sharer may carry. The primary is always 17. */
const SHARING_PARTNER_CATEGORIES = Object.freeze(new Set([SHARING_PAYOUT_ZERO_PNL, BACK_OFFICE_CHARGES]));

/**
 * The combined-payout cap (`rate_A + rate_B <= 0.95 x avg_achievment`, ratio `<= 95`) was
 * removed from the claim-creation path on 2026-08-07 — it belongs at **ERP submission**,
 * where the claim is actually sent, not where it is recorded.
 *
 * Enforced by `LeadSiblingCombinedPayoutCapValidator` in `erp/erpValidators.js`.
 * `finance-services.getBankProductCombination` is the bank/product `avg_achievment`
 * lookup it needs. Note the column really is spelled `avg_achievment`. Only the RATE arm
 * scales by it: a ratio is already a percentage of avg achievement, per
 * `CalculatePayoutAmountMultiplier` (`commonhelper.js:2928`).
 */
const RATE_CAP_FRACTION = 0.95;
const RATIO_CAP_PERCENT = 95;

/**
 * Excel columns AD/AE/AF, taken verbatim from the template attached to ClickUp
 * `86d12pwxa` — "New Payout Claim Format from Mar 2023.xlsx", sheet **CRM MIS Upload
 * Format**, header row (row index 1; row 0 is the "*Mandatory Field" annotation strip).
 *
 * Keys are what `decodeBase64AndReadXLSXForLeadForm` derives via
 * `header.trim().replace(/\/| /g, '_').toLowerCase()` (`commonhelper.js:1647`).
 *
 * ⚠ **`Rate or Ratio  for Sharing` contains a DOUBLE space**, so its key carries two
 * underscores: `rate_or_ratio__for_sharing`. That is a typo in the template, not here.
 * Each entry therefore lists alternates: the first key found on the row wins, so if the
 * typo is ever corrected the single-underscore form keeps working and nobody has to
 * notice.
 *
 * ⚠ A header matching none of the alternates is **silently absent**, and because the
 * sharing fields are opt-in (a claim may legitimately omit them, category 17 included) the
 * row then writes as an ordinary single claim with no error. Nothing catches a header typo
 * for you — if sharing rows stop producing pairs, check these keys against the template
 * first.
 */
const EXCEL_SHARING_KEYS = Object.freeze({
    // AD — "PAN no of Person with whom the claim is getting shared"
    vendorPan: ["pan_no_of_person_with_whom_the_claim_is_getting_shared"],
    // AE — "Rate or Ratio  for Sharing"  (double space in the template)
    payoutValue: ["rate_or_ratio__for_sharing", "rate_or_ratio_for_sharing"],
    // AF — "Business categories For Sharing"
    businessCategories: ["business_categories_for_sharing"]
});

/** First of the candidate column keys actually present on the row. */
const readSharingColumn = (row, candidates) => {
    for (const key of candidates) {
        const value = row?.[key];
        if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return undefined;
};

/** The canonical `input` keys the adapters emit, whatever the channel called them. */
const SHARING_INPUT_KEYS = Object.freeze([
    "sharing_vendor_pan",
    "sharing_payout_value",
    "sharing_business_categories"
]);

const isPresent = (value) => value !== undefined && value !== null && String(value).trim() !== "";

/**
 * Does this input describe a payout-sharing case?
 *
 * ANY of the three fields present is enough to say "the operator intended a pair" — that
 * way a half-filled row is caught by the pair validators with a precise message, rather
 * than silently writing one ordinary claim and losing the sharer.
 *
 * @param {Object} input canonical `LeadClaimContext.input`
 */
const isSharingInput = (input) => SHARING_INPUT_KEYS.some((key) => isPresent(input?.[key]));

/** How many of the three were supplied — lets a validator say which are missing. */
const missingSharingFields = (input) => SHARING_INPUT_KEYS.filter((key) => !isPresent(input?.[key]));

/**
 * Find the other half of a payout-sharing pair.
 *
 * ⚠ **Currently has NO callers anywhere in the codebase.** It was written for a
 * reconciliation-mirroring path (banker replies on the primary's thread → also progress the
 * sharer) that was never built. As of 2026-08-14 that path is no longer planned: each half of
 * a pair now sends its own independent confirmation mail with its own `mail_thread_id`/`RU-`
 * subject (see `claimSideEffects.js`'s `PAIR_SHARER_EFFECTS`), so each claim reconciles on its
 * own via `saveReconciliation`/`autoProgressLeadFromReconciliation` exactly like an ordinary
 * single lead — no sibling lookup needed for that purpose. See
 * [[docs/lead-form/payout-sharing-deferred-work]] for the full history.
 *
 * ⚠ **This lookup is also heuristic** — it does not yet use the `sibling_lead` column added
 * this session (`ru_fresh_lead_claims_meta.sibling_lead`, migration `d902c389`), only the older
 * loan/APAC + bank + product match, which is deterministic solely because
 * `FreshLeadExistValidator` rejects a sharing pair whenever ANY claim already exists for that
 * combination (so a given loan/bank/product can hold at most ONE pair). If a real caller shows
 * up for this function, switch it to read `sibling_lead` directly instead of re-deriving it.
 *
 * @param {Object} claim the claim whose sibling is wanted (needs loan/apac, bank, product,
 *        `business_categories` and `fresh_lead_id`)
 * @returns {Promise<Object|null>} the sibling claim row, or null
 */
const findSiblingClaim = async (claim) => {
    if (!claim) return null;

    const category = Number(claim.business_categories);
    const wantCategories = category === PAYOUT_SHARING_CASE
        ? [...SHARING_PARTNER_CATEGORIES]
        : [PAYOUT_SHARING_CASE];

    // Neither identifier alone is reliable: some banks populate only the loan number,
    // others only the APAC. Match on either, exactly as `checkIfFreshLeadExist` does.
    if (!claim.loan_reference_id && !claim.loan_apac_ref_los_number) return null;

    const sql = `
        SELECT * FROM ru_fresh_lead_claims
        WHERE (loan_reference_id = ? OR loan_apac_ref_los_number = ?)
          AND netsuite_bank_id = ?
          AND netsuite_product_id = ?
          AND business_categories IN (${wantCategories.map(() => "?").join(",")})
          AND fresh_lead_id <> ?
          AND lower(is_split_case) = 'yes'
          AND is_deleted = false
        LIMIT 2`;

    const rows = await _db2.query(sql, {
        replacements: [
            claim.loan_reference_id || null,
            claim.loan_apac_ref_los_number || null,
            claim.netsuite_bank_id,
            claim.netsuite_product_id,
            ...wantCategories,
            claim.fresh_lead_id
        ],
        type: QueryTypes.SELECT,
        // The sibling may have been committed moments ago in the same transaction batch.
        useMaster: true
    });

    // LIMIT 2 rather than 1 on purpose: if the invariant above is ever broken we want to
    // know, not to pick one at random and corrupt the wrong claim.
    if (rows.length > 1) return null;
    return rows[0] || null;
};

module.exports = {
    PAYOUT_SHARING_CASE,
    SHARING_PAYOUT_ZERO_PNL,
    BACK_OFFICE_CHARGES,
    SHARING_PARTNER_CATEGORIES,
    RATE_CAP_FRACTION,
    RATIO_CAP_PERCENT,
    EXCEL_SHARING_KEYS,
    readSharingColumn,
    SHARING_INPUT_KEYS,
    isSharingInput,
    missingSharingFields,
    findSiblingClaim
};

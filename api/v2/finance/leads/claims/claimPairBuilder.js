const { logger } = require("../../../../helpers/logger");
const { buildClaimContext } = require("./claimContext");
const LeadClaimError = require("./LeadClaimError");
const payoutSharing = require("./payoutSharing");

/**
 * Turns ONE claim context into the pair a payout-sharing case needs.
 *
 * Called by each entry point immediately after the adapter and **before any pipeline**,
 * so that both contexts then run the full validator chain independently. Returns `null`
 * when the input carries no sharing fields, which is the overwhelming majority of rows —
 * the non-sharing path is byte-for-byte unchanged.
 *
 * Why here and not in the adapter: the "sharing fields present ⇒ build a pair" rule would
 * otherwise be written once per channel and drift. Why not in a validator: a validator
 * runs *inside* `ValidationPipeline.run`, so giving the sharer the full chain would mean
 * re-entering the pipeline from within itself, and the sharer's error would surface at the
 * wrong ordinal position in the primary's chain.
 */

/**
 * @param {Object} primaryCtx the context the adapter produced
 * @param {Object} options
 * @param {Function} options.mintId channel's uuid function — `node-uuid` for Excel,
 *        `uuid` v4 for the lead form. Injected so this module does not pick a uuid
 *        library on a channel's behalf.
 * @returns {{primary: Object, sharer: Object}|null}
 */
const buildClaimPair = (primaryCtx, { mintId }) => {
    const input = primaryCtx?.input;
    if (!payoutSharing.isSharingInput(input)) return null;

    // Split cases are a CRM-only feature. RuConnect (the external DSA portal) may submit
    // business category 17 like any other category — that is untouched, and never reaches
    // here because a claim with no sharing fields returns above. What is refused is an
    // external submission that actually fills the sharing columns.
    //
    // Refused rather than ignored so the DSA is told why. Pairing would not work for them
    // regardless: `UploaderAuthorizationValidator`'s external branch authorises self-claims
    // only (`claimValidators.js:130-132`), so the sharer could never pass it, and the
    // external Excel path rewrites `vendor_pan` to the uploader's own PAN on every row
    // (`controllers/dsa/index.js:6441`) while leaving AD/AE/AF alone — so the pair would be
    // built from a primary that is not who the sheet says it is.
    //
    // Reachable on both external entry points: `dsa/add_external_claim`, and
    // `dsa/uploadLeadFormDataExternal`, which shares the CRM's controller, Bull job and
    // adapter, so the same template's sharing columns arrive intact.
    if (primaryCtx.source?.isExternal) {
        logger.warn(`payout sharing: refused an external submission carrying sharing fields — `
            + `channel=${primaryCtx.source?.channel} loan=${input.loan_reference_id || input.loan_apac_ref_los_number || "unknown"}`);
        throw new LeadClaimError("Split case (payout sharing) is not allowed from RuConnect");
    }
    // The `AUTH_KEY_EXTERNAL` static-token bypass sets neither `req.dsa` nor
    // `req.loggedInUser`, so `isExternal` is false while there is no identified uploader at
    // all — and a pair has to be attributable to someone.
    if (!primaryCtx.source?.actor?.dsa_id && !primaryCtx.source?.actor?.id) {
        throw new LeadClaimError("Split case (payout sharing) requires an identified uploader");
    }

    // A sharing case IS a split case. Forced here, before phase 1, because
    // `SplitCaseRequiredValidator`, `DisbursementDateRequiredValidator` and
    // `FreshLeadExistValidator` all read it *during* the chain — setting it afterwards
    // would be too late. Both views are written: every consumer reads `derived`, but
    // `input` is the canonical home and they must not drift. Lowercase — the column
    // stores "yes"/"no" and readers compare lowercase.
    primaryCtx.input.is_split_case = "yes";
    primaryCtx.derived.is_split_case = "yes";

    const payoutType = String(input.payout_type || "").trim().toLowerCase();
    const sharedValue = input.sharing_payout_value;

    // A fresh object, never a mutation of the primary's input: `INPUT_BACKFILL_ALLOWED`
    // (`claimContext.js:41`) whitelists only payout_type/rate/ratio for in-place writes,
    // and `fresh_lead_id` is emphatically not on it.
    const sharerInput = {
        ...input,
        fresh_lead_id: mintId(),
        is_split_case: "yes",

        // Identity: the sharer is resolved by PAN, whatever the primary was resolved by.
        vendor_pan: input.sharing_vendor_pan,
        vendor_lookup: { by: "pan", value: input.sharing_vendor_pan },

        business_categories: Number(input.sharing_business_categories),

        // One value field on the wire, routed by the pair's shared payout type. This is
        // what makes "payout types match" true by construction.
        payout_rate: payoutType === "ratio" ? input.payout_rate : sharedValue,
        payout_ratio: payoutType === "ratio" ? sharedValue : input.payout_ratio,

        // The sharing fields describe the pair, not either member. Carrying them onto the
        // sharer would make `isSharingInput(sharer.input)` true and invite a pair of pairs.
        sharing_vendor_pan: undefined,
        sharing_payout_value: undefined,
        sharing_business_categories: undefined
    };

    // A shallow copy, not the same object: `ExternalActorValidator` assigns to
    // `ctx.source.actor` (`leadFormPipeline.js:107`), and any future source-level flag
    // set during one chain must not leak into the other.
    const sharerSource = { ...primaryCtx.source, pairRole: "sharer" };
    primaryCtx.source.pairRole = "primary";

    const sharer = buildClaimContext({
        source: sharerSource,
        input: sharerInput,
        // `raw` is an escape hatch read by entry-point-local validators only; copy the
        // container so neither side can mutate the other's view.
        raw: { ...(primaryCtx.raw || {}) }
    });

    // Excel bookkeeping. `ctx.row` carries `error`, `bucket` and `claim_month` in SINGLE
    // slots, and the report pushes the row object itself. Give the sharer a detached
    // shadow so it can be written to freely and discarded — only the primary's row is
    // ever reported. Without this the sharer's bucket silently overwrites the primary's.
    if (primaryCtx.row) {
        sharer.row = { ...primaryCtx.row };
        sharer.rowIndex = primaryCtx.rowIndex;
    }
    if (primaryCtx.job) sharer.job = primaryCtx.job;

    primaryCtx.pair = { role: "primary", other: sharer };
    sharer.pair = { role: "sharer", other: primaryCtx };

    return { primary: primaryCtx, sharer };
};

module.exports = { buildClaimPair };

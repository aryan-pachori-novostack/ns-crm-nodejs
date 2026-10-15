const { buildLeadFormClaimContext } = require("../claims/adapters/leadFormBodyAdapter");
const { buildLeadFormAddPipeline, buildLeadFormEditPipeline } = require("./leadFormPipeline");
const { saveClaim, saveClaimPair } = require("../claims/FreshLeadClaimService");
const { buildClaimPair } = require("../claims/claimPairBuilder");
const { buildClaimPairPipeline } = require("../claims/claimPairValidators");
const { v4: uuidv4 } = require("uuid");
const LeadClaimError = require("../claims/LeadClaimError");
const { isFinanceRootUser } = require("../../../../services/finance-services");

/**
 * Manual lead-claim add/edit — `POST dsa/AddFreshLeadClaim` and `dsa/add_external_claim`.
 *
 * One route serves both operations, discriminated by `fresh_lead_id` in the body, which
 * is how the pre-migration controller behaved and what the frontend expects.
 *
 * Shape: Joi (transport) -> adapter -> pipeline -> service. The adapter normalises the
 * HTTP body into the same `LeadClaimContext` the Excel upload produces; the pipeline is
 * a composition of shared validators; the service owns the write. No SQL, no business
 * validation and no side effects live in this file — it wires them together.
 *
 * Returns the plain object `safe(..., { envelope: "v1" })` expects so the v1 envelope
 * (`meta.Status` / `Data` / `Token`) is preserved; a `LeadClaimError` with
 * `type: "custom"` is turned into a 400 by the route wrapper.
 */
const addOrEditLeadClaim = async (req) => {
    const isFinanceRoot = await isFinanceRootUser(req?.loggedInUser?.userPhone);
    const ctx = buildLeadFormClaimContext(req, { isFinanceRoot });

    const pipeline = ctx.source.mode === "update"
        ? buildLeadFormEditPipeline()
        : buildLeadFormAddPipeline();

    // A payout-sharing case becomes TWO claims — create-only. Edit never rebuilds a pair
    // (sharing fields are stripped upstream); `buildClaimPair` returns null for every
    // ordinary create, so the common path below is unchanged.
    const pair = ctx.source.mode === "create"
        ? buildClaimPair(ctx, { mintId: uuidv4 })
        : null;

    await pipeline.run(ctx);

    if (!pair) {
        const { fresh_lead_id, created } = await saveClaim(ctx);
        return { success: true, message: "Success", statusCode: 200, data: { fresh_lead_id, created } };
    }

    // The sharer runs the SAME chain, so it gets the same vendor resolution, uploader
    // authorization, payout and duplicate checks the primary got. Its errors are prefixed
    // so an operator can tell which half of the pair was rejected — otherwise
    // "This Lead does not exists" on a form showing a valid DSA is baffling.
    try {
        await pipeline.run(pair.sharer);
    } catch (err) {
        if (err?.type === "custom") throw new LeadClaimError(`Sharing DSA: ${err.message}`, err.statusCode);
        throw err;
    }

    // Pair-level rules run only once both halves are fully resolved — the combined payout
    // cap needs both rates, which do not exist until each chain has applied its own
    // master-rate fallback.
    await buildClaimPairPipeline().run(pair);

    const result = await saveClaimPair(pair);
    return { success: true, message: "Success", statusCode: 200, data: result };
};

module.exports = { addOrEditLeadClaim };

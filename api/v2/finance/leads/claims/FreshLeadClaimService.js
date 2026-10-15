const claimRepository = require("./FreshLeadClaimRepository");
const { logger } = require("../../../../helpers/logger");
const { _db2 } = require("../../../../../models");
const { toClaimInsertRow, toClaimUpdatePatch, toMetaRow, toMetaPatch } = require("./claimRowMapper");
const { runPostWriteEffects, runPairPostWriteEffects } = require("./claimSideEffects");
const LeadClaimError = require("./LeadClaimError");

/**
 * The business-operations boundary for the lead-claim aggregate — the single entry point
 * every channel goes through once its adapter has produced a `LeadClaimContext` and the
 * validator chain has passed.
 *
 * Mostly a write boundary (`saveClaim`), plus the one read the edit screen needs
 * (`getClaimForEdit`). The read lives here rather than being called straight off the
 * repository so that controllers never reach into the data-access layer.
 *
 * **This class coordinates and does nothing else.** It owns no SQL (that is
 * `FreshLeadClaimRepository`), no write-time policy (that is `claimRowMapper`), and no
 * effects (that is `claimSideEffects`). If a method here grows past roughly 25 lines,
 * something has leaked in from one of those three collaborators — that is the God-class
 * tripwire the Service Layer notes warn about, and it is the failure mode that produced
 * the original 1200-line processor.
 *
 * Ordering is deliberate and fixes a pre-existing bug: the claim is written **before**
 * its meta row and before any effect fires. The old code inserted meta and sent the
 * banker email inside the row loop while the claim INSERT happened after it, so a failed
 * INSERT left an orphan meta row and an email referring to a claim that did not exist.
 */

/**
 * The claim and its meta row are one unit — a claim with no meta, or meta with no claim,
 * is not a state any reader can interpret. `inClaimTransaction` makes that atomic.
 *
 * **Effects deliberately run after COMMIT, never inside the transaction.** They send mail,
 * emit Kafka and call NetSuite; none of those can be rolled back, so firing them inside
 * would mean a later rollback leaves an email referring to a claim that no longer exists —
 * a worse version of the orphan-meta bug this ordering already fixes. It also keeps the
 * transaction short, which matters on a table this hot.
 *
 * @param {Function} write receives the transaction; must contain only claim/meta writes
 */
const inClaimTransaction = async (write) => {
    const transaction = await _db2.transaction();
    let settled = false;
    try {
        const result = await write(transaction);
        await transaction.commit();
        settled = true;
        return result;
    } catch (err) {
        // If `commit()` itself rejected, the transaction is already finished — rolling back
        // then throws "Transaction cannot be rolled back because it has been finished with
        // state: commit" and that error replaces the real one, hiding why the write failed.
        if (!settled) {
            try {
                await transaction.rollback();
            } catch (rollbackErr) {
                logger.error(`FreshLeadClaimService: rollback failed: ${rollbackErr.message}`);
            }
        }
        throw err;
    }
};

/** Write a new claim + its meta row atomically, then fire post-write effects. */
const createClaim = async (ctx) => {
    const fresh_lead_id = ctx.input.fresh_lead_id;
    const now = new Date();

    await inClaimTransaction(async (transaction) => {
        await claimRepository.create(toClaimInsertRow(ctx, now), { transaction });
        await claimRepository.createMeta(toMetaRow(ctx, fresh_lead_id, now), { transaction });
    });

    await runPostWriteEffects(ctx, { leadId: fresh_lead_id, isInsert: true });

    return { fresh_lead_id, created: true };
};

/**
 * Write BOTH claims of a payout-sharing pair — four statements, ONE transaction.
 *
 * The user's requirement is all-or-nothing: either both leads land or neither does. That
 * rules out calling `createClaim` twice, which would leave the primary committed (and its
 * banker email sent) if the sharer failed.
 *
 * It also forces the pair rules to be checked BEFORE this point, in memory: the duplicate
 * and sibling-existence queries read via `useMaster` on a pool connection, not on this
 * transaction, so mid-transaction they cannot see the primary's uncommitted row.
 *
 * Create-only by design — an existing pair is edited one claim at a time through the
 * normal path.
 *
 * @param {{primary: Object, sharer: Object}} pair
 */
const createClaimPair = async ({ primary, sharer }) => {
    const now = new Date();   // one timestamp for the pair, so they sort together

    for (const ctx of [primary, sharer]) {
        if (ctx.source.mode === "update") {
            throw new LeadClaimError("A payout sharing case cannot be created against an existing lead");
        }
    }

    await inClaimTransaction(async (transaction) => {
        for (const ctx of [primary, sharer]) {
            const id = ctx.input.fresh_lead_id;
            await claimRepository.create(toClaimInsertRow(ctx, now), { transaction });
            await claimRepository.createMeta(toMetaRow(ctx, id, now), { transaction });
        }
    });

    await runPairPostWriteEffects({ primary, sharer });

    return {
        // The category-17 claim keeps the singular slot, so any caller reading
        // `data.fresh_lead_id` still gets the lead a human would call "the claim".
        fresh_lead_id: primary.input.fresh_lead_id,
        created: true,
        is_payout_sharing_pair: true,
        claims: [
            { fresh_lead_id: primary.input.fresh_lead_id, role: "primary", business_categories: primary.derived.business_categories },
            { fresh_lead_id: sharer.input.fresh_lead_id, role: "sharer", business_categories: sharer.derived.business_categories }
        ]
    };
};

/**
 * Patch an existing claim. Only the columns this channel owns are written, so a manual
 * edit of an Excel-created claim leaves that claim's Excel-sourced columns intact.
 */
const updateClaim = async (ctx, { columnMapping } = {}) => {
    const fresh_lead_id = ctx.source.targetFreshLeadId;
    const now = new Date();

    await inClaimTransaction(async (transaction) => {
        await claimRepository.update(fresh_lead_id, toClaimUpdatePatch(ctx, now), { transaction });
        await claimRepository.updateMeta(fresh_lead_id, toMetaPatch(ctx, now), { transaction });
    });

    await runPostWriteEffects(ctx, {
        leadId: fresh_lead_id,
        isInsert: false,
        previousLead: ctx.derived?.previous_lead,
        recordId: ctx.derived?.previous_lead_id,
        columnMapping
    });

    return { fresh_lead_id, created: false };
};

/** Dispatch on the mode the adapter recorded. */
const saveClaim = async (ctx, options) =>
    (ctx.source.mode === "update" ? updateClaim(ctx, options) : createClaim(ctx, options));

/**
 * The claim shaped for the edit screen — read-side counterpart to `saveClaim`.
 *
 * Exists so callers reach the aggregate through the service rather than the repository.
 * `dsa-services.getFreshLeadClaimForEdit` used to be a `@deprecated` one-line shim over
 * `claimRepository.findForEdit`; deleting it and pointing its five **controller** call
 * sites straight at the repository would have made controllers touch the data-access
 * layer, which is the one thing this module's layering is meant to prevent.
 *
 * @param {string} fresh_lead_id
 * @param {string} [extraColumns] one of `FIND_FOR_EDIT_EXTRA` — never request-derived,
 *        it is spliced into the SELECT list. See the repository's JSDoc.
 * @returns {Promise<{records: Object|null}>} `{ records }` — callers destructure this
 *          exact shape, so it must not become a bare row.
 */
const getClaimForEdit = async (fresh_lead_id, extraColumns = "") =>
    claimRepository.findForEdit(fresh_lead_id, { extraColumns });

module.exports = {
    createClaim,
    updateClaim,
    saveClaim,
    createClaimPair,
    // Alias: entry points branch `pair ? saveClaimPair(pair) : saveClaim(ctx)` rather than
    // teaching `saveClaim` to sniff `ctx.pair` — three other callers depend on its
    // one-context-in, one-`{fresh_lead_id, created}`-out contract.
    saveClaimPair: createClaimPair,
    getClaimForEdit,
    // Re-exported so a caller gets the function and its allowed column-sets from one
    // module instead of importing the repository just for the constants.
    FIND_FOR_EDIT_EXTRA: claimRepository.FIND_FOR_EDIT_EXTRA
};

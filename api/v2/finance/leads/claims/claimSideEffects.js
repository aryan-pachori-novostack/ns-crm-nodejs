const { logger } = require("../../../../helpers/logger");
const { jsonDifference } = require("../../../../helpers/commonhelper");
const { claimMatchedBankFileSource, releaseMatchedBankFileSource } = require("../../../../services/finance-services");
const { insertDsaPayout } = require("../../../../services/dsa-services");
const { sendBankerDisbursalConfirmationEmail } = require("../../../../services/banker-email-service");
const { createActivityLogKafka, handleDsaBusinessStarted } = require("../../../../services/kafka-services");
const { bulkCreate } = require("../../../../services/application-log-services");

/**
 * Everything that happens *after* a lead claim is written: the banker confirmation mail,
 * the Kafka business-started event, the DSA payout bootstrap, the activity-log diff, and
 * linking the matched bank-file row to the claim.
 *
 * Two rules this module exists to hold:
 * - **The repository fires no side effects.** `claimMatchedBankFileSource` used to run off
 *   the tail of `insertOrUpdateLeadMeta`, which made a data-access call quietly send
 *   effects. It lives here now, composed explicitly by the caller.
 * - **A failing side effect never fails the claim.** The row is already committed by the
 *   time any of this runs, so each effect is individually isolated: it logs and returns.
 *   That matches the pre-migration behaviour, where the email and bucket assignment were
 *   already wrapped in their own try/catch.
 *
 * Wired by `FreshLeadClaimService` (PLAN-0006/T11) and shared by every channel, so
 * everything here reads the channel-agnostic `ctx.source` / `ctx.input` rather than the
 * Excel-only `ctx.job` / `ctx.row` bridge.
 */

/**
 * The six post-write effects, named so a caller can select a subset.
 *
 * Exists for payout-sharing pairs, where the bank-file link must fire once for the PAIR
 * while the confirmation mail, payout bootstrap, and business-started event each fire once
 * per CLAIM (see `PAIR_PRIMARY_EFFECTS`/`PAIR_SHARER_EFFECTS` below for why). `runPostWriteEffects`
 * defaults to all of them, so the single-claim path is unchanged.
 */
const EFFECT = Object.freeze({
    RELEASE_BANK_FILE: "releaseSupersededBankFile",
    CLAIM_BANK_FILE: "claimMatchedBankFile",
    ACTIVITY_LOG: "activityLog",
    CONFIRMATION_MAIL: "confirmationEmail",
    BUSINESS_STARTED: "businessStarted",
    PAYOUT_BOOTSTRAP: "dsaPayoutBootstrap"
});
const ALL_EFFECTS = Object.freeze(Object.values(EFFECT));

/** Banker disbursal confirmation mail. Only when required *and* allowed for the product. */
const sendConfirmationEmail = async (ctx, leadId, { isInsert = false } = {}) => {
    const d = ctx.derived;
    // `ctx.source.actor` is the channel-agnostic actor; `ctx.job.leader` is the Excel-only
    // legacy bridge. Reading `ctx.job` unguarded threw for the lead form, which has none.
    const leader = ctx.source?.actor || ctx.job?.leader;

    if (!d.confirmation_required || !d.is_confirmation_mail_allowed) return;

    // Mirrors `dsa-services.js`: insert sends when confirmation is required; edit also
    // requires the user to opt in via `send_email` (the resend dialog on the detail view).
    if (!isInsert && !ctx.input?.send_email) return;

    try {
        // Creator shown in the mail footer and CC'd. platform = web_application (DSA self-service): the VENDOR
        // the claim is raised for (`ctx.dsa.vendor`), whoever triggers the send (e.g. a CRM user re-sending
        // from the detail view). Any other platform: the acting user. On edit the persisted claim's platform decides.
        const platform = ctx.derived?.previous_lead?.platform || (ctx.source?.isExternal ? "web_application" : "crm");
        const vendor = ctx.dsa?.vendor;
        const loggedInUser = platform === "web_application" && vendor
            ? { userEmail: vendor.email, userPhone: vendor.phone, userName: vendor.name }
            : { userEmail: leader?.userEmail, userPhone: leader?.userPhone, userName: leader?.userName };

        await sendBankerDisbursalConfirmationEmail({
            to: d.banker_email,
            cc: d.cc_email_raw,
            data: {
                first_name: d.customer_first_name,
                last_name: d.customer_last_name,
                loan_number: d.loan_reference_id,
                apac_ref_los_number: d.loan_apac_ref_los_number,
                company_name: d.borrower_company_name || '',
                disbursement_amount: d.disbursement_amount,
                disbursement_date_iso: d.disbursement_date_iso,
                product_name: d.product_name,
                bank_name: d.bank_name,
                city: d.city,
                banker_email: d.banker_email,
                banker_mobile: d.banker_mobile,
                asm_email: d.asm_email,
                asm_mobile: d.asm_mobile
            },
            leadId,
            loggedInUser,
            inReplyTo: d.mail_thread_id || undefined
        });
    } catch (emailErr) {
        logger.error(`claimSideEffects: sendBankerDisbursalConfirmationEmail failed for lead ${leadId}: ${emailErr.message}`);
    }
};

/**
 * Link the bank-file row the claim matched to the claim itself. Previously ran off the
 * tail of `insertOrUpdateLeadMeta`; hoisted here so data access stays effect-free.
 */
const claimMatchedBankFile = async (ctx, leadId) => {
    const match = ctx.derived?.bankFileMatchResult;
    if (!match?.is_matched || !leadId) return;

    try {
        await claimMatchedBankFileSource(match, leadId);
    } catch (err) {
        logger.error(`claimSideEffects: claimMatchedBankFileSource failed for lead ${leadId}: ${err.message}`);
    }
};

/**
 * Unlink a bank file this claim previously held but no longer matches — e.g. an edit
 * changed the loan number. Without this the old row stays `claimed = 1` pointing at a
 * claim that has moved on, and is permanently unavailable for future matching.
 *
 * Runs before `claimMatchedBankFile` so a release and a re-claim in the same save cannot
 * fight each other. Flagged by `BankFileMatchValidator({ releasePrevious: true })`.
 */
const releaseSupersededBankFile = async (ctx, leadId) => {
    const toRelease = ctx.derived?.bankFileToRelease;
    if (!toRelease || !leadId) return;

    try {
        await releaseMatchedBankFileSource(
            toRelease.previous_bank_file_id,
            toRelease.previous_tentative_bank_file_id,
            leadId
        );
    } catch (err) {
        logger.error(`claimSideEffects: releaseMatchedBankFileSource failed for lead ${leadId}: ${err.message}`);
    }
};

/**
 * Activity-log diff for an edited claim. Channel-agnostic: the caller supplies the
 * Excel-key -> DB-column mapping (or an identity map for flows whose payload already
 * uses column names).
 *
 * Fire-and-forget in the pre-migration code — kept awaited-but-isolated here so a logging
 * failure is visible without failing the row.
 */
const writeClaimActivityLogs = async ({ previousLead, newData, columnMapping, logType, leadId, actorId, recordId }) => {
    try {
        const mapped = {};
        for (const key in newData) {
            mapped[columnMapping?.[key] || key] = newData[key];
        }

        await createActivityLogKafka({
            old_data: previousLead,
            new_data: mapped,
            log_type: logType,
            application_id: leadId,
            created_by: actorId
        });

        await bulkCreate(jsonDifference(previousLead, mapped), recordId, logType, actorId);
    } catch (err) {
        logger.error(`claimSideEffects: activity log failed for lead ${leadId}: ${err.message}`);
    }
};

/** Kafka "this DSA has started doing business" event — insert path only. */
const emitBusinessStarted = (ctx) => {
    try {
        handleDsaBusinessStarted({
            mode: "offline",
            date: new Date().toISOString(),
            dsa_id: ctx.dsa.dsa_id,
            api_path: ctx.source?.apiPath ?? "dsa/uploadleadformdata",
            form_type: ctx.source?.formType ?? "upload_excel"
        });
    } catch (err) {
        logger.error(`claimSideEffects: handleDsaBusinessStarted failed: ${err.message}`);
    }
};

/**
 * Seed `ru_dsa_payouts` for this DSA + bank + product if it has no row yet, so a later
 * upload has a master rate to fall back on. No-ops when a row already exists.
 */
const bootstrapDsaPayout = async (ctx) => {
    const d = ctx.derived;
    try {
        // MUST be awaited. `insertDsaPayout` is async, so without this the try/catch is
        // inert — a rejection escapes as an unhandled promise rejection, and Node 18
        // defaults to `--unhandled-rejections=throw`, which kills the API process. The
        // pre-migration Excel worker also fired this unawaited, but moving it onto the
        // web-request path is what turned a worker-only wart into a way to take down the API.
        await insertDsaPayout(d.payout_id, d.netsuite_bank_id, d.netsuite_product_id, d.disbursement_date_iso);
    } catch (err) {
        logger.error(`claimSideEffects: insertDsaPayout failed: ${err.message}`);
    }
};

/**
 * Compose the post-write effects for one claim.
 *
 * Order matters and mirrors the pre-migration sequence: bank-file link and meta first
 * (the claim must already exist), then the activity log on edits, then the mail, then the
 * business-started event on inserts, then the payout bootstrap.
 *
 * @param {Object} ctx
 * @param {{leadId: string, isInsert: boolean, previousLead?: Object, recordId?: number,
 *          columnMapping?: Object}} options
 */
const runPostWriteEffects = async (ctx, { leadId, isInsert, previousLead, recordId, columnMapping,
                                          effects = ALL_EFFECTS }) => {
    const on = (effect) => effects.includes(effect);

    if (on(EFFECT.RELEASE_BANK_FILE)) await releaseSupersededBankFile(ctx, leadId);
    if (on(EFFECT.CLAIM_BANK_FILE)) await claimMatchedBankFile(ctx, leadId);

    if (!isInsert && on(EFFECT.ACTIVITY_LOG)) {
        await writeClaimActivityLogs({
            previousLead,
            newData: ctx.row || ctx.input,
            columnMapping,
            logType: "lead_claim_update",
            leadId,
            actorId: ctx.source?.actor?.id || ctx.job?.leader?.id,
            recordId
        });
    }

    if (on(EFFECT.CONFIRMATION_MAIL)) await sendConfirmationEmail(ctx, leadId, { isInsert });

    if (isInsert && on(EFFECT.BUSINESS_STARTED)) {
        emitBusinessStarted(ctx);
    }

    // Awaited so the payout row exists before the response returns, matching main, where
    // the controller awaited `insertDsaPayout` on the add path. Its own try/catch means a
    // failure here logs and never fails the claim.
    if (on(EFFECT.PAYOUT_BOOTSTRAP)) await bootstrapDsaPayout(ctx);
};

/**
 * Post-write effects for a payout-sharing pair.
 *
 * One of the six is pair-scoped and three are claim-scoped, and getting that split wrong is
 * silent in both directions:
 *
 * - **Confirmation mail — BOTH claims, independently, exactly like an ordinary single lead.**
 *   (2026-08-14, explicit product decision — see [[docs/lead-form/payout-sharing-deferred-work]]:
 *   each half of the pair gets its own mail and its own `mail_thread_id`/`RU-` subject, the
 *   same as any non-paired claim would. This was previously primary-only specifically so the
 *   banker got one mail per loan, but that made the sharer claim permanently unreconcilable —
 *   `saveReconciliation` resolves the banker's reply by the `RU-` id in the thread, and a claim
 *   with no thread of its own can never be matched back to. Sending independently means each
 *   claim's reconciliation now works exactly like a normal lead's, with no sibling-mirroring
 *   logic needed. The cost — the banker gets two mails for one loan instead of one — was
 *   accepted as the simpler, more correct tradeoff.
 * - **Bank-file claim — primary only.** `ru_dsa_bank_files.fresh_lead_id` is single-valued
 *   (`finance-services.js:897`); a second write would overwrite the first and leave the
 *   primary pointing at a row that no longer points back. Unaffected by the mail change above.
 * - **Business-started + payout bootstrap — per claim.** Both are keyed on that claim's own
 *   DSA. Skipping them for the sharer would mean the second DSA's activation is never
 *   recorded and it never gets a `ru_dsa_payouts` seed row — which then breaks the master
 *   rate/ratio fallback on its *next* upload.
 * - **Release + activity log** are edit-only and pairs are create-only, so neither applies.
 */
const PAIR_PRIMARY_EFFECTS = Object.freeze([
    EFFECT.CLAIM_BANK_FILE,
    EFFECT.CONFIRMATION_MAIL,
    EFFECT.BUSINESS_STARTED,
    EFFECT.PAYOUT_BOOTSTRAP
]);
const PAIR_SHARER_EFFECTS = Object.freeze([
    EFFECT.CONFIRMATION_MAIL,
    EFFECT.BUSINESS_STARTED,
    EFFECT.PAYOUT_BOOTSTRAP
]);

const runPairPostWriteEffects = async ({ primary, sharer }) => {
    await runPostWriteEffects(primary, {
        leadId: primary.input.fresh_lead_id,
        isInsert: true,
        effects: PAIR_PRIMARY_EFFECTS
    });
    await runPostWriteEffects(sharer, {
        leadId: sharer.input.fresh_lead_id,
        isInsert: true,
        effects: PAIR_SHARER_EFFECTS
    });
};

module.exports = {
    EFFECT,
    ALL_EFFECTS,
    runPairPostWriteEffects,
    sendConfirmationEmail,
    claimMatchedBankFile,
    releaseSupersededBankFile,
    writeClaimActivityLogs,
    emitBusinessStarted,
    bootstrapDsaPayout,
    runPostWriteEffects
};

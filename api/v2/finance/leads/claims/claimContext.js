/**
 * The normalized context every lead-claim entry point produces.
 *
 * This is the piece that makes "at the crux both flows are the same" literally true: a
 * bulk Excel row and a manual lead-form HTTP body are different shapes, but each has an
 * adapter that turns it into one `LeadClaimContext`, and from that point on a single
 * validator library and a single write path serve both.
 *
 * @typedef {Object} LeadClaimSource   WHO and WHERE. Written by the adapter, never by a validator.
 * @property {"upload_excel"|"lead_form"|"instant_claim"|"customer_lead_form"} channel
 * @property {"create"|"update"} mode
 * @property {boolean} isExternal
 * @property {string} platform         -> ru_fresh_lead_claims.platform
 * @property {string} formType         -> ru_fresh_lead_claims.form_type
 * @property {string} apiPath          -> the Kafka business-started event
 * @property {Object|null} actor       the acting user (leader / loggedInUser)
 * @property {Object|null} parentActor backend-access roles act on behalf of a parent
 * @property {string|null} leadAdminDsaId
 * @property {string|null} targetFreshLeadId  excel `ref_id` === manual `fresh_lead_id`
 * @property {string|null} fileName    excel only
 * @property {number|null} rowIndex    excel only
 *
 * @typedef {Object} LeadClaimContext
 * @property {LeadClaimSource} source
 * @property {Object} input    canonical, channel-agnostic field set (see the adapters)
 * @property {Object} dsa      resolved vendor/company — same projection for every flow
 * @property {Object} derived  computed by validators, consumed by claimRowMapper
 * @property {Object} raw      escape hatch; only entry-point-local validators may read it
 */

/**
 * `input` is frozen after the adapter runs, with three documented exceptions that
 * legitimately backfill it — external payout autofill, the master rate/ratio fallback,
 * and the edit-time payout restore. Everything else writes to `derived`.
 *
 * That rule exists because the pre-migration code wrote the same value to two places
 * (`row.rate` *and* `derived.rate`) and they could drift; keeping one canonical home per
 * value is what stops that returning.
 */
const INPUT_BACKFILL_ALLOWED = Object.freeze([
    "payout_type", "payout_rate", "payout_ratio",
    // Paired-claim edit: restore is_split_case from previous when sibling_lead is set
    // (EditPayoutRestoreValidator) so FreshLeadExistValidator does not misfire.
    "is_split_case"
]);


/**
 * Build the legacy `derived` view from the canonical `input`.
 *
 * The shared validators still read `derived` (the pre-migration field names). Only the
 * Excel adapter used to populate it, which meant the lead-form path ran the whole chain
 * against an empty object — every `derived.*` read was `undefined` and the first
 * mandatory check rejected a perfectly valid payload. Deriving it here, centrally, is
 * what makes "channel-agnostic validators" actually true rather than true-for-one-channel.
 *
 * Written from `input` alone, so the two views cannot drift. When the validators finish
 * migrating to `input`, delete this function and the `derived` key with it — one change,
 * one place.
 */
const buildLegacyDerived = (input, source) => ({
    fresh_lead_id: input.fresh_lead_id,
    loan_reference_id: input.loan_reference_id,
    loan_apac_ref_los_number: input.loan_apac_ref_los_number,
    customer_full_name: input.customer_full_name,
    customer_first_name: input.customer_first_name,
    customer_last_name: input.customer_last_name,
    borrower_company_name: input.customer_company_name,
    disbursement_amount: input.disbursement_amount,
    disbursement_date: input.disbursement_date,
    disbursement_date_iso: input.disbursement_date_iso,
    city: input.city,
    netsuite_bank_id: input.netsuite_bank_id,
    netsuite_product_id: input.netsuite_product_id,
    bank_name: input.bank_name,
    product_name: input.product_name,
    vendor_payout_type: input.payout_type,
    rate: input.payout_rate,
    ratio: input.payout_ratio,
    business_categories: input.business_categories,
    is_split_case: input.is_split_case,
    leader_name: input.leader_name,
    sub_leader_name: input.sub_leader_name,
    bh_sub_leader: input.bh_sub_leader,
    vendor_remark: input.vendor_remark,
    ns_contest_id: input.ns_contest_id,
    banker_name: input.banker_name,
    banker_email: input.banker_email,
    banker_mobile: input.banker_mobile,
    asm_name: input.asm_name,
    asm_email: input.asm_email,
    asm_mobile: input.asm_mobile,
    cc_email_raw: input.cc_email,
    confirmation_required: input.confirmation_required,
    expected_billing_month: input.expected_billing_month ?? null,
    claim_month: null,
    ref_id: source.targetFreshLeadId,
    previous_lead: null,
    previous_lead_id: null,
    banker_id: null,
    asm_id: null
});

/**
 * @param {Object} params
 * @param {LeadClaimSource} params.source
 * @param {Object} params.input
 * @param {Object} params.raw   `{ row }` for Excel, `{ body, req }` for the lead form
 * @returns {LeadClaimContext}
 */
const buildClaimContext = ({ source, input, raw }) => ({
    source,
    input,
    dsa: {},
    derived: buildLegacyDerived(input, source),
    raw
});

module.exports = { buildClaimContext, buildLegacyDerived, INPUT_BACKFILL_ALLOWED };

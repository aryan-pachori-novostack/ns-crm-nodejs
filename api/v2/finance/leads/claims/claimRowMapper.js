const { buildCcEmailString } = require("../../../../helpers/commonhelper");
const { deriveBillingMonthFromIso } = require("../../../../services/finance-services");

/**
 * Maps a validated lead-claim context onto `{column: value}` objects for
 * `FreshLeadClaimRepository`.
 *
 * This module is the home for the write-time *policy* that used to sit interleaved
 * with the SQL — `confirmation_required ? 13 : 0`, the `is_split_case` lowercasing,
 * `isDuplicate ? 0 : -1`, the cc-email sanitisation, and so on. The repository
 * therefore contains SQL and nothing else, and this file contains policy and no SQL.
 *
 * **Key order matters.** The repository builds its statements from the keys of the
 * object returned here, so the order below is deliberately identical to the
 * hand-written statements it replaces — that keeps the emitted column list
 * byte-for-byte the same as before the migration.
 *
 * NOTE (PLAN-0006/T06): this currently reads the Excel-era context
 * (`ctx.derived` / `ctx.dsa` / `ctx.job`). When the normalized `LeadClaimContext`
 * lands, the reads move to `ctx.input` / `ctx.source`; the returned shape and key
 * order must not change.
 */

/** Columns written only when a claim is first created; never rewritten on update. */
const CREATE_ONLY_COLUMNS = Object.freeze([
    "fresh_lead_id",
    "created_by",
    "created_at",
    "platform",
    "form_type"
]);

const toLowerOrNull = (value) => value?.toLowerCase() || null;

/**
 * Columns common to create and update, in the order the original statements used.
 * `now` is passed in so a single save writes one consistent timestamp.
 */
const commonClaimColumns = (ctx, now) => {
    const d = ctx.derived;
    const { file_name } = ctx.job;

    return {
        fresh_lead_status_id: d.confirmation_required ? 13 : 0,
        dsa_id: ctx.dsa.dsa_id,
        user_type: d.user_type || null,
        product_name: d.product_name || null,
        claim_month: d.claim_month,
        loan_reference_id: d.loan_reference_id,
        loan_apac_ref_los_number: d.loan_apac_ref_los_number,
        bank_name: d.bank_name || null,
        customer_full_name: d.customer_full_name,
        customer_first_name: d.customer_first_name,
        customer_last_name: d.customer_last_name,
        dsa_mobile_number: ctx.dsa.dsa_mobile_number,
        disbursement_date: d.disbursement_date,
        disbursement_date_iso: d.disbursement_date_iso,
        disbursement_amount: d.disbursement_amount,
        vendor_payout_rate: d.rate ?? 0,
        vendor_payout_amount: d.vendor_payout_amount,
        payout_collide: d.payout_collide,
        payout_collide_value: d.payout_collide_value,
        leader_name: d.leader_name || null,
        sub_leader_name: d.sub_leader_name || null,
        is_split_case: toLowerOrNull(d.is_split_case),
        vendor_payout_type: toLowerOrNull(d.vendor_payout_type),
        business_categories: d.business_categories || null,
        netsuite_bank_id: d.netsuite_bank_id,
        netsuite_product_id: d.netsuite_product_id,
        netsuite_vendor_id: ctx.dsa.netsuite_vendor_id,
        vendor_payout_ratio: d.ratio || null,
        city: d.city || null,
        upload_file_name: file_name,
        bh_sub_leader: d.bh_sub_leader || null,
        vendor_remark: d.vendor_remark || null,
        customer_company_name: d.borrower_company_name ? d.borrower_company_name : '',
        updated_at: now,
        loan_status: "disbursed",
        multi_funded_flag: d.isDuplicate ? 0 : -1,
        claim_pending_flag: 1,
        class_id: ctx.dsa.class_id || null,
        current_hierarchy_crm: ctx.dsa.current_hierarchy_crm || null,
        current_hierarchy_path: ctx.dsa.current_hierarchy_path || null,
        partner_id: ctx.dsa.partner_id || null,
        ns_contest_id: d.ns_contest_id || null
    };
};

/**
 * Full row for a new claim. Column order mirrors the original INSERT statement.
 * @returns {Object} column -> value
 */
const toClaimInsertRow = (ctx, now = new Date()) => {
    const d = ctx.derived;
    const { leader, isExternal } = ctx.job;
    const common = commonClaimColumns(ctx, now);

    return {
        fresh_lead_status_id: common.fresh_lead_status_id,
        fresh_lead_id: d.fresh_lead_id,
        dsa_id: common.dsa_id,
        user_type: common.user_type,
        product_name: common.product_name,
        claim_month: common.claim_month,
        loan_reference_id: common.loan_reference_id,
        loan_apac_ref_los_number: common.loan_apac_ref_los_number,
        bank_name: common.bank_name,
        customer_full_name: common.customer_full_name,
        customer_first_name: common.customer_first_name,
        customer_last_name: common.customer_last_name,
        dsa_mobile_number: common.dsa_mobile_number,
        disbursement_date: common.disbursement_date,
        disbursement_date_iso: common.disbursement_date_iso,
        disbursement_amount: common.disbursement_amount,
        vendor_payout_rate: common.vendor_payout_rate,
        vendor_payout_amount: common.vendor_payout_amount,
        payout_collide: common.payout_collide,
        payout_collide_value: common.payout_collide_value,
        leader_name: common.leader_name,
        sub_leader_name: common.sub_leader_name,
        is_split_case: common.is_split_case,
        vendor_payout_type: common.vendor_payout_type,
        business_categories: common.business_categories,
        request_date: d.request_date,
        request_date_iso: d.request_date_iso,
        netsuite_bank_id: common.netsuite_bank_id,
        netsuite_product_id: common.netsuite_product_id,
        netsuite_vendor_id: common.netsuite_vendor_id,
        vendor_payout_ratio: common.vendor_payout_ratio,
        city: common.city,
        upload_file_name: common.upload_file_name,
        created_by: leader.id,
        bh_sub_leader: common.bh_sub_leader,
        vendor_remark: common.vendor_remark,
        customer_company_name: common.customer_company_name,
        created_at: now,
        updated_at: common.updated_at,
        platform: isExternal ? "web_application" : "crm",
        form_type: ctx.source?.formType ?? "upload_excel",
        loan_status: common.loan_status,
        multi_funded_flag: common.multi_funded_flag,
        claim_pending_flag: common.claim_pending_flag,
        class_id: common.class_id,
        current_hierarchy_crm: common.current_hierarchy_crm,
        current_hierarchy_path: common.current_hierarchy_path,
        partner_id: common.partner_id,
        ns_contest_id: common.ns_contest_id
    };
};

/**
 * Patch for an existing claim — only the columns this channel owns, so a flow never
 * nulls out columns another flow populated. Column order mirrors the original UPDATE.
 *
 * `request_date` is preserved from the existing claim (an edit must not reset when the
 * claim was originally requested) and falls back to the freshly-stamped value.
 * @returns {Object} column -> value
 */
const toClaimUpdatePatch = (ctx, now = new Date()) => {
    const d = ctx.derived;
    const common = commonClaimColumns(ctx, now);

    return {
        fresh_lead_status_id: common.fresh_lead_status_id,
        dsa_id: common.dsa_id,
        user_type: common.user_type,
        product_name: common.product_name,
        claim_month: common.claim_month,
        loan_reference_id: common.loan_reference_id,
        loan_apac_ref_los_number: common.loan_apac_ref_los_number,
        bank_name: common.bank_name,
        customer_full_name: common.customer_full_name,
        customer_first_name: common.customer_first_name,
        customer_last_name: common.customer_last_name,
        dsa_mobile_number: common.dsa_mobile_number,
        disbursement_date: common.disbursement_date,
        disbursement_date_iso: common.disbursement_date_iso,
        disbursement_amount: common.disbursement_amount,
        vendor_payout_rate: common.vendor_payout_rate,
        vendor_payout_amount: common.vendor_payout_amount,
        payout_collide: common.payout_collide,
        payout_collide_value: common.payout_collide_value,
        is_split_case: common.is_split_case,
        vendor_payout_type: common.vendor_payout_type,
        business_categories: common.business_categories,
        request_date: d.previous_lead?.request_date || d.request_date,
        request_date_iso: d.previous_lead?.request_date_iso || d.request_date_iso,
        netsuite_bank_id: common.netsuite_bank_id,
        netsuite_product_id: common.netsuite_product_id,
        netsuite_vendor_id: common.netsuite_vendor_id,
        vendor_payout_ratio: common.vendor_payout_ratio,
        city: common.city,
        customer_company_name: common.customer_company_name,
        updated_at: common.updated_at,
        loan_status: common.loan_status,
        multi_funded_flag: common.multi_funded_flag,
        claim_pending_flag: common.claim_pending_flag,
        class_id: common.class_id,
        current_hierarchy_crm: common.current_hierarchy_crm,
        current_hierarchy_path: common.current_hierarchy_path,
        partner_id: common.partner_id,
        ns_contest_id: common.ns_contest_id,

        // Edit-only columns with no Excel equivalent. `leadFormBodyAdapter` collects them
        // and its comment says they "must survive a round trip" — but nothing wrote them,
        // so a manual edit sent `pf_collected: 5000, loan_type: "HL"` and persisted NULL for
        // both. That is the exact case Phase 5's gate was meant to prove.
        //
        // Spread conditionally, never unconditionally: this patch is applied wholesale, so
        // a key present with an undefined value would null out a column the OTHER channel
        // populated — the "a flow never nulls out columns another flow owns" rule this
        // mapper exists to hold. Excel never sets these, so they stay absent there.
        ...(ctx.input?.pf_collected !== undefined ? { pf_collected: ctx.input.pf_collected } : {}),
        ...(ctx.input?.loan_type !== undefined ? { loan_type: ctx.input.loan_type } : {}),

        // Excel-owned columns. Only the bulk channel populates these, so including them
        // unconditionally ran `SET leader_name = NULL, sub_leader_name = NULL,
        // bh_sub_leader = NULL, upload_file_name = NULL` on every manual edit — destroying
        // the upload provenance and hierarchy attribution of Excel-created claims, which are
        // the majority. `main`'s edit statement never referenced these columns.
        //
        // Phase 5's Gate names this exactly: "edit an Excel-created claim — leader_name /
        // sub_leader_name / bh_sub_leader / upload_file_name must be unchanged".
        ...(ctx.input?.leader_name !== undefined ? { leader_name: common.leader_name } : {}),
        ...(ctx.input?.sub_leader_name !== undefined ? { sub_leader_name: common.sub_leader_name } : {}),
        ...(ctx.input?.bh_sub_leader !== undefined ? { bh_sub_leader: common.bh_sub_leader } : {}),
        ...(ctx.job?.file_name ? { upload_file_name: common.upload_file_name } : {}),

        // `vendor_remark` is omitted when the body does not carry it — the detail-view save
        // sends a subset of fields, and main appended this column only `if (vendor_remark
        // !== undefined)`. Unconditional inclusion silently cleared the remark.
        ...(ctx.input?.vendor_remark !== undefined ? { vendor_remark: common.vendor_remark } : {})
    };
};

/** Shared meta values; `cc_email` is sanitised here because that is policy, not SQL. */
const metaValues = (ctx) => {
    const d = ctx.derived;
    const match = d.bankFileMatchResult || {};

    return {
        confirmation_required: d.confirmation_required ? 1 : 0,
        // Which addresses get stripped is CHANNEL POLICY, declared by the adapter on
        // `input.cc_email_remove`, not decided here. The two channels genuinely differ:
        // the bulk upload has only ever stripped the constant (a known bug — its own
        // template promises more), while the manual flow has always also stripped the
        // banker's and the uploader's own address. Hardcoding either one silently
        // regresses the other, which is exactly what RV1-F1 caught.
        cc_email: buildCcEmailString(d.cc_email_raw, {
            remove: ctx.input?.cc_email_remove || ["cc@ruloans.com"]
        }) || null,
        banker_id: d.banker_id,
        asm_id: d.asm_id,
        expected_billing_month: deriveBillingMonthFromIso(d.expected_billing_month),
        is_tentative_matched: match.is_tentative_matched ? 1 : 0,
        tentative_bank_file_id: match.tentative_bank_file_id || null,
        is_bank_file_matched: match.is_bank_file_matched ? 1 : 0,
        bank_file_id: match.bank_file_id || null,
        is_online_lead: d.is_online_lead ? 1 : 0,
        team_lead: ctx.input?.team_lead || null,
        // Payout-sharing pairs only: the other half's fresh_lead_id. `ctx.pair` is set by
        // `claimPairBuilder` on both contexts before either reaches the write path, and is
        // never set for an ordinary claim or for an edit (pairs are create-only), so this
        // is `null` in every other case. Feeds `metaPatch` too, but `updateMeta`'s fixed
        // SQL doesn't reference the column, so it's a harmless no-op there.
        sibling_lead: ctx.pair?.other?.input?.fresh_lead_id || null
    };
};

/** @returns {Object} column -> value for a new `ru_fresh_lead_claims_meta` row */
const toMetaRow = (ctx, fresh_lead_id, now = new Date()) => ({
    fresh_lead_id,
    ...metaValues(ctx),
    created_at: now,
    updated_at: now
});

/** @returns {Object} column -> value patch for an existing meta row */
const toMetaPatch = (ctx, now = new Date()) => ({
    ...metaValues(ctx),
    updated_at: now
});

module.exports = {
    CREATE_ONLY_COLUMNS,
    toClaimInsertRow,
    toClaimUpdatePatch,
    toMetaRow,
    toMetaPatch
};

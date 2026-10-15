const { QueryTypes } = require('sequelize');
// `models` rather than `jobs/db`: both build an identical Sequelize instance from the
// same env, but `models` is what every `api/` service already uses. T17 puts this
// repository on the web-request path, and pulling in `jobs/db` there would make the API
// process instantiate the Bull worker's connection pools purely to serve a SELECT.
const { _db2 } = require('../../../../../models');

/**
 * The single owner of SQL for the lead-claim aggregate — `ru_fresh_lead_claims` and
 * its 1:1 companion `ru_fresh_lead_claims_meta`.
 *
 * Rules this module exists to enforce (PLAN-0006):
 * - **No policy.** Values arrive already shaped by `claimRowMapper`; nothing here
 *   decides what a column *should* contain.
 * - **No side effects.** No email, no Kafka, no claiming of bank-file rows. Callers
 *   compose those via `claimSideEffects`.
 * - **No other module writes these two tables.** New read/write needs get a method
 *   here rather than an inline query at the call site.
 *
 * Statements for the claims table are built from the *keys* of the row/patch object.
 * That is what lets one repository serve every entry point: the bulk Excel upload and
 * the manual lead form own overlapping-but-different column sets, and a fixed column
 * list would make one flow null out the other's columns on edit.
 */

const CLAIMS_TABLE = 'ru_fresh_lead_claims';
const META_TABLE = 'ru_fresh_lead_claims_meta';

/**
 * Named `extraColumns` snippets for `findForEdit`. Callers must pass one of these
 * (or "") — never request-derived SQL. See JSDoc on `findForEdit`.
 */
exports.FIND_FOR_EDIT_EXTRA = Object.freeze({
    STATUS_AND_DSA_NAME:
        `,claims.fresh_lead_status_id,
         CASE WHEN claims.user_type = 'company' THEN rc.name ELSE d.full_name END as dsa_name,
         CASE WHEN claims.user_type = 'company' THEN rc.pan ELSE k.permanent_account_number END as permanent_account_number,
         claims.dsa_id as company_id,
         CASE WHEN claims.user_type = 'company' THEN 1 ELSE 0 END as is_company`
});

/** `{a: 1, b: 2}` -> `INSERT INTO t (a, b) values (?,?)` + `[1, 2]`. */
const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const assertSafeIdentifiers = (columns, context) => {
    for (const c of columns) {
        if (!IDENTIFIER_RE.test(c)) {
            throw new Error(`FreshLeadClaimRepository: refusing unsafe identifier ${JSON.stringify(c)} in ${context}`);
        }
    }
};

const buildInsert = (table, row) => {
    const columns = Object.keys(row);
    if (!columns.length) {
        throw new Error(`FreshLeadClaimRepository: refusing to INSERT into ${table} with no columns`);
    }
    assertSafeIdentifiers(columns, `INSERT ${table}`);
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) values (${columns.map(() => '?').join(',')})`;
    // undefined would bind as NULL inconsistently across drivers; normalise explicitly.
    const replacements = columns.map((c) => (row[c] === undefined ? null : row[c]));
    return { sql, replacements };
};

/** `{a: 1}` -> `UPDATE t SET a = ? WHERE <whereColumn> = ?` + `[1, whereValue]`. */
const buildUpdate = (table, patch, whereColumn, whereValue) => {
    const columns = Object.keys(patch);
    if (!columns.length) {
        throw new Error(`FreshLeadClaimRepository: refusing to UPDATE ${table} with no columns`);
    }
    assertSafeIdentifiers([...columns, whereColumn], `UPDATE ${table}`);
    const sql = `UPDATE ${table} SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE ${whereColumn} = ?`;
    const replacements = columns.map((c) => (patch[c] === undefined ? null : patch[c]));
    replacements.push(whereValue);
    return { sql, replacements };
};

// ─── ru_fresh_lead_claims — reads ────────────────────────────────────────────

/**
 * @param {string} fresh_lead_id
 * @param {{useMaster?: boolean}} [options] useMaster when the row may have been
 *        written moments ago — read replicas lag behind the primary.
 * @returns {Promise<Object|null>}
 */
exports.findById = async (fresh_lead_id, { useMaster = false } = {}) => {
    const sql = `SELECT * FROM ${CLAIMS_TABLE} WHERE fresh_lead_id = ?`;
    const [row] = await _db2.query(sql, {
        replacements: [fresh_lead_id],
        type: QueryTypes.SELECT,
        useMaster
    });
    return row || null;
};

/**
 * The claim plus the vendor identity fields the edit paths diff against.
 * Reads from the primary: on a bulk upload the target claim can have been written
 * moments earlier by an earlier row in the same batch.
 *
 * Also carries `sibling_lead` off the meta row (not `flc.*`, which has no such column) so
 * `SiblingLeadPairFieldsLockValidator` can tell a paired claim from an ordinary one without a
 * second query.
 * @returns {Promise<Object|null>}
 */
exports.findWithVendorById = async (fresh_lead_id) => {
    const sql = `select flc.* , k.permanent_account_number , d.full_name , m.sibling_lead from ${CLAIMS_TABLE} flc left join ru_dsa_kyc_data k on flc.dsa_mobile_number = k.dsa_mobile_number left join ru_direct_selling_agents d on flc.dsa_mobile_number = d.dsa_mobile_number left join ${META_TABLE} m on m.fresh_lead_id = flc.fresh_lead_id where flc.fresh_lead_id = ?`;
    const [row] = await _db2.query(sql, {
        replacements: [fresh_lead_id],
        type: QueryTypes.SELECT,
        useMaster: true
    });
    return row || null;
};

/**
 * The claim shaped for the edit screen — claim + meta + banker/ASM contacts + contest
 * title, with the column aliases the lead-form UI expects (`first_name`, `loan_number`,
 * `payout_type`, …) rather than the raw column names.
 *
 * ⚠ `extraColumns` is **raw SQL spliced into the SELECT list** — the one place this
 * repository interpolates anything that is not a bind parameter. Callers must pass a
 * member of `FIND_FOR_EDIT_EXTRA` or nothing; **never pass user input here**. Exactly one
 * caller supplies it today — the edit-screen handler in `controllers/dsa/index.js`, via
 * `FreshLeadClaimService.FIND_FOR_EDIT_EXTRA.STATUS_AND_DSA_NAME` — and it is a named
 * constant, not a literal and not request-derived, so there is no injection path.
 *
 * Reached through `FreshLeadClaimService.getClaimForEdit`. Controllers call the service,
 * not this method: `dsa-services` calls it directly only because it is a service itself
 * and importing the claims service from there would close a require cycle
 * (`FreshLeadClaimService` -> `claimSideEffects` -> `dsa-services`).
 *
 * @returns {Promise<{records: Object|null}>} `{ records }` — every caller destructures
 *          this exact shape, so it must not become a bare row.
 */
exports.findForEdit = async (fresh_lead_id, { extraColumns = "" } = {}) => {
    const sql = ` SELECT
        claims.business_categories,
        claims.id,
        claims.fresh_lead_id,
        claims.dsa_mobile_number,
        claims.product_name,
        claims.bank_name,
        claims.netsuite_bank_id as bank_id,
        claims.customer_full_name as full_name,
        claims.customer_first_name as first_name,
        claims.customer_last_name as last_name,
        claims.claim_month,
        claims.loan_reference_id as loan_number,
        claims.loan_apac_ref_los_number as apac_ref_los_number,
        claims.customer_company_name as company_name,
        claims.disbursement_date,
        claims.disbursement_amount,
        claims.city,
        claims.vendor_payout_type as payout_type,
        claims.netsuite_vendor_id,
        claims.netsuite_product_id,
        meta.confirmation_required,
        meta.cc_email,
        meta.expected_billing_month,
        meta.cc_email_date,
        meta.team_lead,
        banker.sp_email as banker_email,
        banker.sp_mobile as banker_mobile,
        banker.sp_name as banker_name,
        asm.sp_email as asm_email,
        asm.sp_mobile as asm_mobile,
        asm.sp_name as asm_name,
        claims.vendor_remark,
        claims.is_split_case,
        claims.claim_confirmation,
        claims.ai_status,
        claims.ns_contest_id,
        events.title as ns_contest_title
        ${extraColumns || ""}
        FROM ${CLAIMS_TABLE} claims
        LEFT JOIN ${META_TABLE} meta ON claims.fresh_lead_id = meta.fresh_lead_id
        LEFT JOIN ru_direct_selling_agents d ON claims.dsa_mobile_number = d.dsa_mobile_number
        LEFT JOIN ru_companies rc ON claims.user_type = 'company' AND rc.company_id = claims.dsa_id
        LEFT JOIN ru_dsa_kyc_data k ON claims.dsa_mobile_number = k.dsa_mobile_number
        LEFT JOIN ru_branch_sales_people banker ON banker.id = meta.banker_id
        LEFT JOIN ru_branch_sales_people asm ON asm.id = meta.asm_id
        LEFT JOIN ru_events events ON claims.ns_contest_id = events.ns_contest_id AND events.type = 'lead_form_contest'
        WHERE claims.fresh_lead_id = ? `;

    const data = await _db2.query(sql, { replacements: [fresh_lead_id], type: QueryTypes.SELECT });
    return { records: data[0] || null };
};

// ─── ru_fresh_lead_claims — writes ───────────────────────────────────────────

/**
 * @param {Object} claimRow column -> value, from `claimRowMapper.toClaimInsertRow`
 * @returns {Promise<void>}
 */
exports.create = async (claimRow, { transaction = null } = {}) => {
    const { sql, replacements } = buildInsert(CLAIMS_TABLE, claimRow);
    await _db2.query(sql, { replacements, type: QueryTypes.INSERT, transaction });
};

/**
 * Only the columns present in `patch` are written, so one entry point never clears
 * columns owned by another.
 * @param {string} fresh_lead_id
 * @param {Object} patch column -> value, from `claimRowMapper.toClaimUpdatePatch`
 * @returns {Promise<void>}
 */
exports.update = async (fresh_lead_id, patch, { transaction = null } = {}) => {
    const { sql, replacements } = buildUpdate(CLAIMS_TABLE, patch, 'fresh_lead_id', fresh_lead_id);
    await _db2.query(sql, { replacements, type: QueryTypes.UPDATE, transaction });
};

// ─── ru_fresh_lead_claims_meta ───────────────────────────────────────────────

/** @returns {Promise<Object|null>} */
exports.findMetaById = async (fresh_lead_id, { useMaster = false } = {}) => {
    const sql = `SELECT * FROM ${META_TABLE} WHERE fresh_lead_id = ?`;
    const [row] = await _db2.query(sql, {
        replacements: [fresh_lead_id],
        type: QueryTypes.SELECT,
        useMaster
    });
    return row || null;
};

/** @param {Object} metaRow from `claimRowMapper.toMetaRow` */
exports.createMeta = async (metaRow, { transaction = null } = {}) => {
    const { sql, replacements } = buildInsert(META_TABLE, metaRow);
    await _db2.query(sql, { replacements, type: QueryTypes.INSERT, transaction });
};

/**
 * Unlike the claims table, every entry point writes the *same* meta columns, and the
 * statement carries two CASE expressions that a key-driven builder cannot express —
 * so this one stays a fixed statement. Closing a claim's confirmation requirement
 * also closes any open mail thread.
 * @param {Object} metaPatch from `claimRowMapper.toMetaPatch`
 */
exports.updateMeta = async (fresh_lead_id, metaPatch, { transaction = null } = {}) => {
    const sql = `UPDATE ${META_TABLE} SET confirmation_required=?, cc_email=?, banker_id=?, asm_id=?, expected_billing_month=?, is_tentative_matched=?, tentative_bank_file_id=?, is_bank_file_matched=?, bank_file_id=?, is_online_lead=?, team_lead=?, mail_status = CASE WHEN confirmation_required = 1 AND ? = 0 THEN 'EMAIL_CLOSED' ELSE mail_status END, mail_closed_at = CASE WHEN confirmation_required = 1 AND ? = 0 THEN ? ELSE mail_closed_at END, updated_at=? WHERE fresh_lead_id=?`;

    const replacements = [
        metaPatch.confirmation_required,
        metaPatch.cc_email,
        metaPatch.banker_id,
        metaPatch.asm_id,
        metaPatch.expected_billing_month,
        metaPatch.is_tentative_matched,
        metaPatch.tentative_bank_file_id,
        metaPatch.is_bank_file_matched,
        metaPatch.bank_file_id,
        metaPatch.is_online_lead,
        metaPatch.team_lead,
        metaPatch.confirmation_required,
        metaPatch.confirmation_required,
        metaPatch.updated_at,
        metaPatch.updated_at,
        fresh_lead_id
    ];

    await _db2.query(sql, {
        replacements: replacements.map((r) => (r === undefined ? null : r)),
        type: QueryTypes.UPDATE,
        transaction
    });
};

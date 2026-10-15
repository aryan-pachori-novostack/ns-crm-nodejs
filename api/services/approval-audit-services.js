'use strict';

const { QueryTypes } = require('sequelize');
const DSAService = require('./dsa-services');
const { CreateWhereQueryFilter, CustomOperatorHandlers } = require('../helpers/commonhelper');

/**
 * Maps MUI DataGrid field names → actual SQL column expressions.
 * Add new fields here as the audit table grows.
 */
const AUDIT_FIELD_MAPPING = (field) => {
    const map = {
        // Status
        request_status:        'a.status',
        // People
        req_raised_by:         'u_req.name',
        req_raised_by_email:   'u_req.email',
        raised_to:             'u_app.name',
        raised_to_email:       'u_app.email',
        // DSA
        dsa_id:                `JSON_UNQUOTE(JSON_EXTRACT(a.payload, '$.dsa_id'))`,
        // Dates
        created_at:            'DATE(a.created_at)',
        updated_at:            'DATE(a.status_updated_at)',
        // Action
        action_key:            'a.action_key',
        action_label:          'a.action_label',
        // Approval id
        approval_id:           'a.id',
    };
    return map[field] || null;
};

const APPROVAL_SELECT = `
  SELECT a.id AS approval_id,
         a.action_key,
         a.action_label,
         a.payload,
         a.status AS request_status,
         a.created_at,
         a.status_updated_at AS updated_at,
         a.remarks,
         u_req.name AS req_raised_by,
         u_req.email AS req_raised_by_email,
         u_app.name AS raised_to,
         u_app.email AS raised_to_email
  FROM api_approvals a
  LEFT JOIN users u_req ON u_req.id = UUID_TO_BIN(a.requested_by)
  LEFT JOIN users u_app ON u_app.id = UUID_TO_BIN(a.approver_id)`;

/** All fields tracked for vendor autonomous approval. Order is preserved in the output. */
const VENDOR_AUTONOMOUS_AUDIT_FIELDS = [
    'autonomous_secured_payout',
    'autonomous_unsecured_payout',
    'global_autonomous_disb_date_from',
    'global_autonomous_disb_date_to',
    'is_same_day_billing_enabled',
];

const DEFAULT_VENDOR_AUTONOMOUS_ACTION_KEY = 'requestAutonomousForVendor';

/** Shown when a value does not exist (never set). */
const NO_VALUE = '-';

/** Approving this action always turns same-day billing on. */
const SAME_DAY_ENABLED_ON_APPROVE = 1;

function parsePayload(payload) {
    if (!payload) return null;
    if (typeof payload === 'object') return payload;
    try {
        return JSON.parse(payload);
    } catch {
        return null;
    }
}

function extractDsaId(payload) {
    const parsed = parsePayload(payload);
    return parsed?.dsa_id ? String(parsed.dsa_id) : null;
}

function toTime(value) {
    if (!value) return 0;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * `api_approvals` timestamps are stored in UTC. Return them shifted to IST with no
 * timezone suffix so the frontend renders Indian time directly without converting.
 */
function toISTString(value) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const ist = new Date(d.getTime() + (5 * 60 + 30) * 60 * 1000);
    return ist.toISOString().replace('Z', '');
}

/** Missing/empty values render as '-'; everything else is passed through untouched. */
function display(value) {
    if (value === null || value === undefined || value === '' || value === 'null') return NO_VALUE;
    return value;
}

/** The settings this approval asks for. Same before and after approval — payload never changes. */
function requestedValues(approval) {
    const payload = parsePayload(approval.payload) || {};
    return {
        autonomous_secured_payout: payload.autonomous_secured_payout ?? null,
        autonomous_unsecured_payout: payload.autonomous_unsecured_payout ?? null,
        global_autonomous_disb_date_from: payload.global_autonomous_disb_date_from ?? null,
        global_autonomous_disb_date_to: payload.global_autonomous_disb_date_to ?? null,
        is_same_day_billing_enabled: SAME_DAY_ENABLED_ON_APPROVE,
    };
}

/** Current live settings for a DSA, used when no earlier approved request exists. */
function currentSettingsAsValues(state) {
    const settings = state?.autonomousSettings || {};
    return {
        autonomous_secured_payout: settings.autonomous_secured_payout ?? null,
        autonomous_unsecured_payout: settings.autonomous_unsecured_payout ?? null,
        global_autonomous_disb_date_from: settings.global_autonomous_disb_date_from ?? null,
        global_autonomous_disb_date_to: settings.global_autonomous_disb_date_to ?? null,
        is_same_day_billing_enabled: state?.sameDayEnabled ?? null,
    };
}

/**
 * Values in effect immediately before `approval` was raised.
 *
 * Only approved requests change these settings, so the previous approved request for the
 * same DSA is the state this one started from. This is derived purely from `api_approvals`,
 * which is why the numbers stay identical whether the request is pending, approved or
 * rejected. Falls back to the DSA's live settings for the earliest request, where there is
 * no prior approval to read from.
 */
function previousValues(approval, approvedHistory, currentState) {
    const selfTime = toTime(approval.created_at);

    let previous = null;
    for (const entry of approvedHistory || []) {
        if (entry.approval_id === approval.approval_id) continue;
        const entryTime = toTime(entry.created_at);
        if (entryTime > selfTime) continue;
        if (entryTime === selfTime && entry.approval_id > approval.approval_id) continue;
        if (!previous || entryTime >= toTime(previous.created_at)) previous = entry;
    }

    if (!previous) return currentSettingsAsValues(currentState);

    const payload = parsePayload(previous.payload) || {};
    return {
        autonomous_secured_payout: payload.autonomous_secured_payout ?? null,
        autonomous_unsecured_payout: payload.autonomous_unsecured_payout ?? null,
        global_autonomous_disb_date_from: payload.global_autonomous_disb_date_from ?? null,
        global_autonomous_disb_date_to: payload.global_autonomous_disb_date_to ?? null,
        is_same_day_billing_enabled: SAME_DAY_ENABLED_ON_APPROVE,
    };
}

/** One audit record: approval metadata plus every tracked field's old and new value inline. */
function buildAuditRecord(approval, oldValues, newValues) {
    const isPending = approval.request_status === 'pending';
    const isApproved = approval.request_status === 'approved';

    const record = {
        approval_id: approval.approval_id,
        action_key: approval.action_key,
        action_label: approval.action_label,
        dsa_id: extractDsaId(approval.payload),
        req_raised_by: approval.req_raised_by || null,
        req_raised_by_email: approval.req_raised_by_email || null,
        raised_to: approval.raised_to || null,
        raised_to_email: approval.raised_to_email || null,
        created_at: toISTString(approval.created_at),
        request_status: approval.request_status,
        updated_at: toISTString(approval.updated_at),
        approved_by: isApproved ? (approval.raised_to || null) : null,
        approved_by_email: isApproved ? (approval.raised_to_email || null) : null,
        updated_by: isPending ? null : (approval.raised_to || null),
        updated_by_email: isPending ? null : (approval.raised_to_email || null),
        remarks: approval.remarks || null,
        // Pending requests have not been acted on, so the raise time is the only event so far.
        changed_at: toISTString(isPending ? approval.created_at : (approval.updated_at || approval.created_at)),
    };

    for (const field of VENDOR_AUTONOMOUS_AUDIT_FIELDS) {
        record[`${field}_old_value`] = display(oldValues[field]);
        record[`${field}_new_value`] = display(newValues[field]);
    }

    return record;
}

async function fetchApprovals(filters) {
    const db = global._db7;
    const {
        filterModel = { items: [], logicOperator: 'and' },
        pageNumber = 0,
        pageSize = 20,
        dsa_id = null,
    } = filters;

    // Always scope to this action_key unless the caller filters on action_key explicitly.
    const hasActionKeyFilter = (filterModel.items || []).some((i) => i.field === 'action_key');
    let baseWhere = hasActionKeyFilter
        ? ' WHERE 1=1 '
        : ` WHERE a.action_key = '${DEFAULT_VENDOR_AUTONOMOUS_ACTION_KEY}' `;

    const bindParams = [];

    // Scope to a single DSA when provided (payload.dsa_id).
    if (dsa_id) {
        baseWhere += ` AND JSON_UNQUOTE(JSON_EXTRACT(a.payload, '$.dsa_id')) = ?`;
        bindParams.push(String(dsa_id));
    }

    // Build SQL conditions from MUI filterModel using the shared utility.
    const whereFilterQuery = CreateWhereQueryFilter(
        { items: filterModel.items || [], logicOperator: filterModel.logicOperator || 'and' },
        AUDIT_FIELD_MAPPING,
        CustomOperatorHandlers(),
        'approval_audit'
    );

    const filterConditions = [];

    for (const [field, operator, value] of whereFilterQuery) {
        if (!field) continue;
        if (Array.isArray(value) && value.length > 0) {
            const flat = value.flat();
            filterConditions.push(`${field} ${operator} (${flat.map(() => '?').join(', ')})`);
            bindParams.push(...flat);
        } else if (value !== null && value !== undefined && value !== '') {
            filterConditions.push(`${field} ${operator} ?`);
            bindParams.push(value);
        } else {
            // isEmpty / isNotEmpty — field already contains the full SQL expression, no value.
            filterConditions.push(`${field}`);
        }
    }

    const logicOp = (filterModel.logicOperator || 'and').toUpperCase();
    if (filterConditions.length) {
        baseWhere += ` AND (${filterConditions.join(` ${logicOp} `)})`;
    }

    const limit = Number(pageSize);
    const offset = Number(pageNumber) * limit;

    const countRows = await db.query(
        `SELECT COUNT(*) AS total
         FROM api_approvals a
         LEFT JOIN users u_req ON u_req.id = UUID_TO_BIN(a.requested_by)
         LEFT JOIN users u_app ON u_app.id = UUID_TO_BIN(a.approver_id)
         ${baseWhere}`,
        { replacements: bindParams, type: QueryTypes.SELECT }
    );

    const approvals = await db.query(
        `${APPROVAL_SELECT} ${baseWhere} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
        { replacements: [...bindParams, limit, offset], type: QueryTypes.SELECT }
    );

    return { approvals, totalApprovals: Number(countRows[0]?.total || 0) };
}

/** Every approved request for these DSAs, so each record can read the state it started from. */
async function fetchApprovedHistory(dsaIds, actionKeys) {
    if (!dsaIds.length || !actionKeys.length) return new Map();

    const dsaPlaceholders = dsaIds.map(() => '?').join(', ');
    const actionPlaceholders = actionKeys.map(() => '?').join(', ');

    const rows = await global._db7.query(
        `SELECT a.id AS approval_id,
                a.payload,
                a.created_at,
                JSON_UNQUOTE(JSON_EXTRACT(a.payload, '$.dsa_id')) AS dsa_id
         FROM api_approvals a
         WHERE a.status = 'approved'
           AND a.action_key IN (${actionPlaceholders})
           AND JSON_UNQUOTE(JSON_EXTRACT(a.payload, '$.dsa_id')) IN (${dsaPlaceholders})
         ORDER BY a.created_at ASC`,
        { replacements: [...actionKeys, ...dsaIds], type: QueryTypes.SELECT }
    );

    const history = new Map();
    for (const row of rows) {
        const key = String(row.dsa_id);
        if (!history.has(key)) history.set(key, []);
        history.get(key).push(row);
    }
    return history;
}

/** Live autonomous settings per DSA, used only as the fallback for the earliest request. */
async function fetchCurrentStates(dsaIds) {
    const states = new Map();
    await Promise.all(
        dsaIds.map(async (dsa_id) => {
            const [autonomousSettings, sameDayEnabled] = await Promise.all([
                DSAService.getDsaAutonomousSettingsByDsaId(dsa_id),
                DSAService.getDsaSameDayBillingEnabledById(dsa_id),
            ]);
            states.set(dsa_id, { autonomousSettings, sameDayEnabled });
        })
    );
    return states;
}

/**
 * Unified audit log: one record per approval request, newest first, with every tracked
 * field's before and after value inline.
 */
async function getVendorAutonomousApprovalAuditLogs(filters = {}) {
    const { approvals, totalApprovals } = await fetchApprovals(filters);

    const dsaIds = [...new Set(approvals.map((a) => extractDsaId(a.payload)).filter(Boolean))];
    const actionKeys = [...new Set(approvals.map((a) => a.action_key).filter(Boolean))];

    const [approvedHistory, currentStates] = await Promise.all([
        fetchApprovedHistory(dsaIds, actionKeys),
        fetchCurrentStates(dsaIds),
    ]);

    const records = approvals.map((approval) => {
        const dsaId = extractDsaId(approval.payload);
        const oldValues = previousValues(approval, approvedHistory.get(dsaId), currentStates.get(dsaId));
        return buildAuditRecord(approval, oldValues, requestedValues(approval));
    });

    // Newest request first. created_at is always set, so ordering never shifts as a
    // request moves from pending to approved or rejected.
    records.sort((a, b) => toTime(b.created_at) - toTime(a.created_at));

    return {
        totalApprovals,
        pageNumber: filters.pageNumber ?? 0,
        pageSize: filters.pageSize ?? 20,
        totalRecords: records.length,
        records,
    };
}

module.exports = {
    getVendorAutonomousApprovalAuditLogs,
    DEFAULT_VENDOR_AUTONOMOUS_ACTION_KEY,
    VENDOR_AUTONOMOUS_AUDIT_FIELDS,
};

'use strict';

const { QueryTypes } = require('sequelize');
const { _db2 } = require('../../models');

const DSA_NAME_SQL = `COALESCE(
  NULLIF(TRIM(full_name), ''),
  NULLIF(TRIM(CONCAT_WS(' ', first_name, middle_name, last_name)), '')
)`;

const APPROVAL_SELECT = `
  SELECT a.*,
         u_req.name AS requested_by_name,
         u_req.email AS requested_by_email,
         u_app.name AS approver_name,
         u_app.email AS approver_email
  FROM api_approvals a
  LEFT JOIN users u_req ON u_req.id = UUID_TO_BIN(a.requested_by)
  LEFT JOIN users u_app ON u_app.id = UUID_TO_BIN(a.approver_id)`;

function parsePayload(payload) {
  if (!payload) return null;
  if (typeof payload === 'object') return payload;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

async function buildReassignPartnerDisplay(rawPayload) {
  const parsed = parsePayload(rawPayload);
  if (!parsed) return null;

  const dsaIds = (parsed.dsaIdArray || []).filter(Boolean);
  const partnerPhone = parsed.partnerPhone || null;

  let dsaNameMap = {};
  if (dsaIds.length) {
    const rows = await _db2.query(
      `SELECT dsa_id, ${DSA_NAME_SQL} AS display_name
       FROM ru_direct_selling_agents
       WHERE dsa_id IN (:dsaIds)`,
      { replacements: { dsaIds }, type: QueryTypes.SELECT }
    );
    dsaNameMap = Object.fromEntries(rows.map((row) => [row.dsa_id, row.display_name || null]));
  }

  let partnerName = null;
  if (partnerPhone) {
    const rows = await _db2.query(
      `SELECT ${DSA_NAME_SQL} AS display_name
       FROM ru_direct_selling_agents
       WHERE dsa_mobile_number = :partnerPhone
       LIMIT 1`,
      { replacements: { partnerPhone }, type: QueryTypes.SELECT }
    );
    partnerName = rows[0]?.display_name || null;
  }

  return {
    'Selected DSAs': dsaIds.map((id) => ({ id, name: dsaNameMap[id] || null })),
    'Target Partner Phone': partnerPhone,
    'Target Partner Name': partnerName,
  };
}

async function resolveDsaName(dsaId) {
  if (!dsaId) return null;
  const rows = await _db2.query(
    `SELECT ${DSA_NAME_SQL} AS display_name
     FROM ru_direct_selling_agents
     WHERE dsa_id = :dsaId
     LIMIT 1`,
    { replacements: { dsaId }, type: QueryTypes.SELECT }
  );
  return rows[0]?.display_name || null;
}

/** Keep stored fields; add dsa_name for list/detail UI. */
async function buildVendorAutonomousDisplay(rawPayload) {
  const parsed = parsePayload(rawPayload);
  if (!parsed) return null;
  return {
    dsa_name: await resolveDsaName(parsed.dsa_id),
    ...parsed
  };
}

/**
 * Human-readable payload for list/detail APIs and approver emails.
 */
const buildDisplayPayload = async (actionKey, rawPayload) => {
  if (actionKey === 'reassignPartner') return buildReassignPartnerDisplay(rawPayload);
  if (actionKey === 'requestAutonomousForVendor') return buildVendorAutonomousDisplay(rawPayload);
  return parsePayload(rawPayload);
};

async function withDisplayPayload(record) {
  if (!record) return record;
  const display = await buildDisplayPayload(record.action_key, record.payload);
  return { ...record, payload: display == null ? null : JSON.stringify(display) };
}

/**
 * Create a new approval entry.
 */
const createApproval = async ({
  action_key,
  action_label,
  method = 'POST',
  endpoint,
  payload,
  requested_by,
  approver_id,
}) => {
  const db = global._db7;
  const payloadStr = payload ? JSON.stringify(payload) : null;
  const result = await db.query(
    `INSERT INTO api_approvals
       (action_key, action_label, method, endpoint, payload,
        requested_by, approver_id, status, created_at, updated_at)
     VALUES
       (:action_key, :action_label, :method, :endpoint, :payload,
        :requested_by, :approver_id, 'pending', NOW(), NOW())`,
    {
      replacements: {
        action_key,
        action_label: action_label || action_key,
        method,
        endpoint,
        payload: payloadStr,
        requested_by,
        approver_id: approver_id || null,
      },
      type: QueryTypes.INSERT,
    }
  );
  return result[0];
};

/**
 * @param {boolean} options.raw - true for replay/job (stored payload, not display format)
 */
const getApprovalById = async (id, { raw = false } = {}) => {
  const db = global._db7;
  const rows = await db.query(
    `${APPROVAL_SELECT} WHERE a.id = :id LIMIT 1`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );
  const record = rows[0] || null;
  if (!record || raw) return record;
  return withDisplayPayload(record);
};

const listApprovalsForUser = async (
  userId,
  {
    page = 0,
    limit = 50,
    status,
    dateFrom,
    dateTo,
    includeUnassignedVendorAutonomous = false,
  } = {}
) => {
  const db = global._db7;
  const offset = page * limit;

  let extraFilters = '';
  const replacements = { userId, limit, offset };

  if (status) {
    extraFilters += ' AND a.status = :status';
    replacements.status = status;
  }
  if (dateFrom) {
    extraFilters += ' AND DATE(a.status_updated_at) >= :dateFrom';
    replacements.dateFrom = dateFrom;
  }
  if (dateTo) {
    extraFilters += ' AND DATE(a.status_updated_at) <= :dateTo';
    replacements.dateTo = dateTo;
  }

  // Default: requester or assigned approver. Privileged users also see unassigned vendor-autonomous requests.
  let visibilityClause = '(a.requested_by = :userId OR a.approver_id = :userId)';
  if (includeUnassignedVendorAutonomous) {
    visibilityClause = `(
      a.requested_by = :userId
      OR a.approver_id = :userId
      OR (
        a.action_key = :vendorAutonomousActionKey
        AND (a.approver_id IS NULL OR a.approver_id = '')
      )
    )`;
    replacements.vendorAutonomousActionKey = 'requestAutonomousForVendor';
  }

  const rows = await db.query(
    `${APPROVAL_SELECT}
     WHERE ${visibilityClause}
     ${extraFilters}
     ORDER BY a.created_at DESC
     LIMIT :limit OFFSET :offset`,
    { replacements, type: QueryTypes.SELECT }
  );

  return Promise.all(rows.map(withDisplayPayload));
};

const listPendingApprovalsForApprover = async (userId) => {
  const db = global._db7;
  return db.query(
    `SELECT * FROM api_approvals WHERE approver_id = :userId AND status = 'pending' ORDER BY created_at ASC`,
    { replacements: { userId }, type: QueryTypes.SELECT }
  );
};

/**
 * Mark approval as approved.
 * Optional `setApproverId`: when provided, also writes that user onto `approver_id`
 * (used for unassigned requestAutonomousForVendor claims).
 */
const approveApproval = async (id, remarks = null, { setApproverId } = {}) => {
  const db = global._db7;
  const setApprover = setApproverId
    ? ', approver_id = :setApproverId'
    : '';
  await db.query(
    `UPDATE api_approvals
        SET status = 'approved', status_updated_at = NOW(), remarks = :remarks, updated_at = NOW()${setApprover}
      WHERE id = :id`,
    {
      replacements: {
        id,
        remarks,
        ...(setApproverId ? { setApproverId } : {}),
      },
      type: QueryTypes.UPDATE,
    }
  );
};

/**
 * Mark approval as rejected.
 * Optional `setApproverId`: when provided, also writes that user onto `approver_id`
 * (used for unassigned requestAutonomousForVendor claims).
 */
const rejectApproval = async (id, remarks = null, { setApproverId } = {}) => {
  const db = global._db7;
  const setApprover = setApproverId
    ? ', approver_id = :setApproverId'
    : '';
  await db.query(
    `UPDATE api_approvals
        SET status = 'rejected', status_updated_at = NOW(), remarks = :remarks, updated_at = NOW()${setApprover}
      WHERE id = :id`,
    {
      replacements: {
        id,
        remarks,
        ...(setApproverId ? { setApproverId } : {}),
      },
      type: QueryTypes.UPDATE,
    }
  );
};

/**
 * Checks whether this requester already has an in-flight request.
 *
 * Table: `api_approvals`
 * - Block if there exists any row with the same (`requested_by`, `action_key`)
 *   whose `status` is still effectively in-flight (pending/approved).
 * - Allow if the last request is `rejected`.
 *
 * Note: `days` is accepted for backward compatibility but is not used for this rule
 * (we no longer need a time-based window; only status-based gating).
 */
const hasRecentApproval = async ({ requested_by, action_key, days, statuses = ["pending", "approved"] }) => {
  const db = global._db7;
  if (!requested_by || !action_key) return false;

  const rows = await db.query(
    `SELECT 1 AS ok
     FROM api_approvals
     WHERE requested_by = :requested_by
       AND action_key = :action_key
       AND status IN (:statuses)
     LIMIT 1`,
    {
      replacements: { requested_by, action_key, statuses },
      type: QueryTypes.SELECT,
    }
  );

  return Boolean(rows?.[0]);
};

const getCrmUsers = async ({ actionKey, search = '', limit = 50 } = {}) => {
  const db = global._db7;
  const searchLike = `%${search}%`;

  if (!actionKey) return [];

  const settings = await _db2.query(
    `SELECT setting_value FROM ru_settings WHERE setting_key = :actionKey LIMIT 1`,
    { replacements: { actionKey }, type: QueryTypes.SELECT }
  );

  if (!settings[0] || !settings[0].setting_value) {
    return [];
  }

  const masterEmails = settings[0].setting_value.split(',').map(e => e.trim().toLowerCase()).filter(e => e);
  if (masterEmails.length === 0) return [];

  return db.query(
    `SELECT BIN_TO_UUID(u.id) AS id, u.name, u.email, r.role AS role_name
     FROM users u
     LEFT JOIN roles r ON u.role = r.id
     WHERE u.isDeleted = 0
       AND u.status = 1
       AND LOWER(u.email) IN (:masterEmails)
       AND (u.name LIKE :search OR u.email LIKE :search)
     ORDER BY u.name ASC
     LIMIT :limit`,
    { replacements: { search: searchLike, limit, masterEmails }, type: QueryTypes.SELECT }
  );
};

module.exports = {
  createApproval,
  getApprovalById,
  listApprovalsForUser,
  listPendingApprovalsForApprover,
  approveApproval,
  rejectApproval,
  getCrmUsers,
  buildDisplayPayload,
  hasRecentApproval,
};

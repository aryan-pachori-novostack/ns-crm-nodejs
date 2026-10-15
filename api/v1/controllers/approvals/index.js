'use strict';

const approvalService = require('../../../services/approval-services');
const { buildRequesterNotificationEmail } = require('../../../helpers/approval-middleware');
const { sendEmail } = require('../../../helpers/commonhelper');
const { logger } = require('../../../helpers/logger');
const ResHelper = require(_pathconst.FilesPath.ResHelper);
const { QueryTypes } = require('sequelize');
const axios = require('axios');
const { _db2 } = require('../../../../models');
const {
  applyVendorAutonomousSettingsFromApproval,
  hasRequestAutonomousForVendorPrivilege
} = require('../../../v2/finance/leads/autonomous/autonomousHelper');

const VENDOR_AUTONOMOUS_ACTION_KEY = 'requestAutonomousForVendor';

/**
 * GET /v1/approvals/list
 * Returns all approvals visible to the logged-in user:
 *   - If approver: all where approver_id = me
 *   - If requester: all where requested_by = me
 *   - If user has `request_autonomous_for_vendor`: also unassigned
 *     requestAutonomousForVendor rows (approver_id IS NULL)
 */
const listApprovals = async (req, res) => {
  try {
    const user = req.loggedInUser;
    let userId = user?.id;

    if (!userId || Buffer.isBuffer(userId)) {
      const rows = await global._db7.query(
        'SELECT BIN_TO_UUID(id) AS id FROM users WHERE email = :email AND is_deleted = 0 LIMIT 1',
        { replacements: { email: user?.userEmail || user?.email }, type: QueryTypes.SELECT }
      );
      userId = rows[0]?.id;
    }
    const { page = 0, limit = 50, status, dateFrom, dateTo } = req.query;
    const includeUnassignedVendorAutonomous = await hasRequestAutonomousForVendorPrivilege(user);
    const approvals = await approvalService.listApprovalsForUser(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      includeUnassignedVendorAutonomous,
    });

    return ResHelper.apiResponse(res, true, 'Success', 200, approvals, '');
  } catch (err) {
    logger.error('[listApprovals]', err);
    return ResHelper.apiResponse(res, false, 'Error fetching approvals', 500, {}, '');
  }
};

/**
 * GET /v1/approvals/:id
 */
const getApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await approvalService.getApprovalById(id);
    if (!record) return ResHelper.apiResponse(res, false, 'Approval not found', 404, {}, '');
    return ResHelper.apiResponse(res, true, 'Success', 200, record, '');
  } catch (err) {
    logger.error('[getApproval]', err);
    return ResHelper.apiResponse(res, false, 'Error', 500, {}, '');
  }
};

/**
 * POST /v1/approvals/:id/approve
 * Body: { remarks? }
 */
const approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;
    const user = req.loggedInUser;

    const record = await approvalService.getApprovalById(id);
    if (!record) return ResHelper.apiResponse(res, false, 'Approval not found', 404, {}, '');
    if (record.status !== 'pending') {
      return ResHelper.apiResponse(res, false, `Already ${record.status}`, 400, {}, '');
    }

    // Check if approver is the assigned one OR is a master (via ru_settings)
    let approverId = user?.id;
    const requesterEmail = user?.userEmail || user?.email || '';
    if (!approverId || Buffer.isBuffer(approverId)) {
      const rows = await global._db7.query(
        'SELECT BIN_TO_UUID(id) AS id FROM users WHERE email = :email LIMIT 1',
        { replacements: { email: requesterEmail }, type: QueryTypes.SELECT }
      );
      approverId = rows[0]?.id;
    }

    const isVendorAutonomous = record.action_key === VENDOR_AUTONOMOUS_ACTION_KEY;

    // Request Autonomous For Vendor only: accept is RBAC `request_autonomous_for_vendor`.
    // Do not use finance-root, CEO, or ru_settings master emails for this action.
    // Other action_keys keep assigned-approver / master-email checks below.
    if (isVendorAutonomous) {
      const canAccept = await hasRequestAutonomousForVendorPrivilege(user);
      if (!canAccept) {
        return ResHelper.apiResponse(res, false, 'Not authorized to approve this request', 403, {}, '');
      }
    } else {
      const settingRows = await _db2.query(
        `SELECT setting_value FROM ru_settings WHERE setting_key = :actionKey LIMIT 1`,
        { replacements: { actionKey: record.action_key }, type: QueryTypes.SELECT }
      );
      const masterEmails = settingRows[0]?.setting_value
        ? settingRows[0].setting_value.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
        : [];
      const isMaster = user?.isSuperAdmin || masterEmails.includes(requesterEmail.toLowerCase());
      if (!isMaster && record.approver_id !== approverId) {
        return ResHelper.apiResponse(res, false, 'Not authorized to approve this request', 403, {}, '');
      }
    }

    let finalRemarks = remarks || null;

    // Request Autonomous For Vendor only: apply on Approve. Other actions stay on 9 PM replay.
    if (isVendorAutonomous) {
      let payload = record.payload;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch (e) {
          return ResHelper.apiResponse(res, false, 'Invalid approval payload', 400, {}, '');
        }
      }
      await applyVendorAutonomousSettingsFromApproval(payload, approverId);
    }

    // Unassigned vendor-autonomous: claim approver_id as the user who acted (from token).
    const claimApproverId =
      isVendorAutonomous && (!record.approver_id || record.approver_id === '')
        ? approverId
        : undefined;

    // Update DB (Mark as approved)
    await approvalService.approveApproval(id, finalRemarks, { setApproverId: claimApproverId });

    // Notify requester of approval
    if (record.requested_by_email) {
      try {
        sendEmail({
          to: record.requested_by_email,
          subject: `[Approved] Your request for "${record.action_label}" (#${id}) has been approved`,
          body: buildRequesterNotificationEmail({
            requesterName: record.requested_by_name,
            actionLabel: record.action_label || record.action_key,
            status: 'approved',
            // This action: approver remarks only. Other actions keep the scheduled-execution copy.
            remarks: isVendorAutonomous
              ? (remarks || '')
              : (finalRemarks || 'Approved by manager. Scheduled for execution at 11:00 PM.'),
            approverName: record.approver_name || user?.name,
            approvalId: id,
          }),
        }, true);
      } catch (e) {
        logger.error('[approveRequest] Email notification failed:', e);
      }
    }

    return ResHelper.apiResponse(res, true, 'Approved successfully', 200, {}, '');
  } catch (err) {
    logger.error('[approveRequest]', err);
    return ResHelper.apiResponse(res, false, `Error approving request: ${err.message}`, 500, {}, '');
  }
};

/**
 * POST /v1/approvals/:id/reject
 * Body: { remarks? }
 */
const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;
    const user = req.loggedInUser;

    const record = await approvalService.getApprovalById(id);
    if (!record) return ResHelper.apiResponse(res, false, 'Approval not found', 404, {}, '');
    if (record.status !== 'pending') {
      return ResHelper.apiResponse(res, false, `Already ${record.status}`, 400, {}, '');
    }

    let approverId = user?.id;
    const requesterEmail = user?.userEmail || user?.email || '';
    if (!approverId || Buffer.isBuffer(approverId)) {
      const rows = await global._db7.query(
        'SELECT BIN_TO_UUID(id) AS id FROM users WHERE email = :email LIMIT 1',
        { replacements: { email: requesterEmail }, type: QueryTypes.SELECT }
      );
      approverId = rows[0]?.id;
    }

    const isVendorAutonomous = record.action_key === VENDOR_AUTONOMOUS_ACTION_KEY;

    // Request Autonomous For Vendor only: reject uses the same RBAC module.
    // Other action_keys keep assigned-approver / master-email checks.
    if (isVendorAutonomous) {
      const canReject = await hasRequestAutonomousForVendorPrivilege(user);
      if (!canReject) {
        return ResHelper.apiResponse(res, false, 'Not authorized to reject this request', 403, {}, '');
      }
    } else {
      const settingRows = await _db2.query(
        `SELECT setting_value FROM ru_settings WHERE setting_key = :actionKey LIMIT 1`,
        { replacements: { actionKey: record.action_key }, type: QueryTypes.SELECT }
      );
      const masterEmails = settingRows[0]?.setting_value
        ? settingRows[0].setting_value.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
        : [];
      const isMaster = user?.isSuperAdmin || masterEmails.includes(requesterEmail.toLowerCase());
      if (!isMaster && record.approver_id !== approverId) {
        return ResHelper.apiResponse(res, false, 'Not authorized to reject this request', 403, {}, '');
      }
    }

    // Unassigned vendor-autonomous: claim approver_id as the user who acted (from token).
    const claimApproverId =
      isVendorAutonomous && (!record.approver_id || record.approver_id === '')
        ? approverId
        : undefined;

    await approvalService.rejectApproval(id, remarks, { setApproverId: claimApproverId });

    // Notify requester
    if (record.requested_by_email) {
      try {
        sendEmail({
          to: record.requested_by_email,
          subject: `[Rejected] Your request for "${record.action_label}" (#${id}) has been rejected`,
          body: buildRequesterNotificationEmail({
            requesterName: record.requested_by_name,
            actionLabel: record.action_label || record.action_key,
            status: 'rejected',
            remarks,
            approverName: record.approver_name || user?.name,
            approvalId: id,
          }),
        }, true);
      } catch (e) {
        logger.error('[rejectRequest] Email notification failed:', e);
      }
    }

    return ResHelper.apiResponse(res, true, 'Rejected successfully', 200, {}, '');
  } catch (err) {
    logger.error('[rejectRequest]', err);
    return ResHelper.apiResponse(res, false, 'Error rejecting request', 500, {}, '');
  }
};

/**
 * GET /v1/approvals/users?search=
 * Returns searchable list of CRM users for approver picker
 */
const getCrmUsers = async (req, res) => {
  try {
    const { search = '', limit = 50, actionKey = '' } = req.query;
    const users = await approvalService.getCrmUsers({ actionKey, search, limit: parseInt(limit) });
    return ResHelper.apiResponse(res, true, 'Success', 200, users, '');
  } catch (err) {
    logger.error('[getCrmUsers]', err);
    return ResHelper.apiResponse(res, false, 'Error fetching users', 500, {}, '');
  }
};

module.exports = {
  listApprovals,
  getApproval,
  approveRequest,
  rejectRequest,
  getCrmUsers,
};

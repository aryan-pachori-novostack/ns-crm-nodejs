'use strict';

/**
 * requireApproval(actionKey, actionLabel)
 * ----------------------------------------
 * Express middleware factory.
 * 
 * When used on a route:
 *  - If the logged-in user has MASTER access (CEO, CTO, CFO, CRM_ADMIN, SUPER_ADMIN) → pass through directly.
 *  - Otherwise → intercept the request, create an api_approvals record, email the chosen approver,
 *    and respond with { status: 'APPROVAL_REQUIRED', approvalId }.
 * 
 * The frontend is expected to detect `status === 'APPROVAL_REQUIRED'` and open the approver-picker modal.
 * 
 * Usage:
 *   router.post('/reassignPartner', AuthHelper.authorize, requireApproval('reassignPartner', 'Reassign DSA Partner'), DSAController.reassignPartner);
 */

const approvalService = require('../services/approval-services');
const { sendEmail } = require('./commonhelper');
const { logger } = require('./logger');
const { _db2 } = require('../../models');

// Roles that bypass approval entirely
// const MASTER_ROLES = ['CEO', 'CTO', 'CFO', 'CRM_ADMIN'];
const MASTER_ROLES = ['CRM_ADMIN'];

/**
 * Get a UUID string from the loggedInUser.
 * The JWT payload stores user.id which may be a UUID string or a Buffer.
 * We use the id directly as uuid string.
 */
const getUserUUID = (user) => {
  if (!user) return null;
  // id is already a uuid string in the JWT payload
  return user.id || null;
};

const buildApproverEmail = ({ approverName, requesterName, actionLabel, payload, approvalId, frontendUrl }) => {
  const payloadPreview = payload
    ? JSON.stringify(payload, null, 2).substring(0, 1000)
    : 'N/A';

  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #2563eb;">🔔 Approval Required</h2>
    <p>Hi <strong>${approverName || 'Approver'}</strong>,</p>
    <p><strong>${requesterName || 'A user'}</strong> has requested approval for the action:</p>
    <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
      <tr>
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold; width: 140px;">Action</td>
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${actionLabel}</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">Approval ID</td>
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">#${approvalId}</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">Payload Preview</td>
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb; font-family: monospace; font-size: 12px; white-space: pre-wrap;">${payloadPreview}</td>
      </tr>
    </table>
    <p>
      <a href="${frontendUrl}" 
         style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
        ✅ Review &amp; Approve / Reject
      </a>
    </p>
    <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
      This is an automated email from the Novostack CRM system.
    </p>
  </div>
  `;
};

/**
 * Build the notification email for requester on resolution.
 */
const buildRequesterNotificationEmail = ({ requesterName, actionLabel, status, remarks, approverName, approvalId }) => {
  const statusColors = { approved: '#16a34a', rejected: '#dc2626' };
  const statusIcon = status === 'approved' ? '✅' : '❌';
  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: ${statusColors[status] || '#374151'};">${statusIcon} Your Request Has Been ${status === 'approved' ? 'Approved' : 'Rejected'}</h2>
    <p>Hi <strong>${requesterName || 'User'}</strong>,</p>
    <p>Your approval request <strong>#${approvalId}</strong> for <strong>${actionLabel}</strong> has been <strong>${status}</strong> by <strong>${approverName || 'an approver'}</strong>.</p>
    ${remarks ? `<p><strong>Remarks:</strong> ${remarks}</p>` : ''}
    <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
      This is an automated email from the Novostack CRM system.
    </p>
  </div>
  `;
};

/**
 * requireApproval middleware factory.
 * @param {string} actionKey   - machine-readable key, e.g. 'reassignPartner'
 * @param {string} actionLabel - human-readable label, e.g. 'Reassign DSA Partner'
 */
const requireApproval = (actionKey, actionLabel) => {
  return async (req, res, next) => {
    try {
      const user = req.loggedInUser;

      // 1. Fetch allowed master emails from ru_settings (_db2 is where ru_settings lives)
      const { QueryTypes } = require('sequelize');

      const settings = await _db2.query(
        `SELECT setting_value FROM ru_settings WHERE setting_key = :actionKey LIMIT 1`,
        { replacements: { actionKey }, type: QueryTypes.SELECT }
      );

      let masterEmails = [];
      if (settings.length > 0 && settings[0].setting_value) {
        masterEmails = settings[0].setting_value.split(',').map(e => e.trim().toLowerCase()).filter(e => e);
      }

      let requesterEmail = user?.userEmail || user?.email;

      // 2. Master roles bypass approval — only if user's email is in the ru_settings list
      if (user?.isSuperAdmin || (requesterEmail && masterEmails.includes(requesterEmail.toLowerCase()))) {
        return next();
      }

      // 3. Bypass approval if this is an automated replay from the approval engine
      if (req.body?._isApprovalReplay === true || req.body?._isApprovalReplay === 'true') {
        delete req.body._isApprovalReplay;
        return next();
      }

      // 4. Check if an approverId was passed in the payload (from frontend modal selection)
      const approverId = req.body?._approverId;

      if (!approverId) {
        // No approver chosen yet — tell frontend to pick one
        return res.status(202).json({
          meta: {
            Status: false,
            code: 202,
            Message: 'APPROVAL_REQUIRED',
          },
          Data: {
            status: 'APPROVAL_REQUIRED',
            actionKey,
            actionLabel,
            message: 'This action requires approval. Please select an approver to proceed.',
          },
        });
      }

      // 5. Approver chosen — fetch approver details from DB (_db7 = CRM users DB)
      const db = global._db7;
      const approverRows = await db.query(
        `SELECT BIN_TO_UUID(id) AS id, name, email FROM users WHERE BIN_TO_UUID(id) = :approverId AND isDeleted = 0 LIMIT 1`,
        { replacements: { approverId }, type: QueryTypes.SELECT }
      );

      const approver = approverRows[0];
      if (!approver) {
        return res.status(400).json({
          meta: { Status: false, code: 400, Message: 'Invalid approver selected' },
          Data: {},
        });
      }

      // 6. Get requester UUID (BIN_TO_UUID from the users table using email)
      let requesterUUID = getUserUUID(user);
      let requesterName = user?.name || user?.userEmail;

      if (!requesterUUID || Buffer.isBuffer(requesterUUID)) {
        const reqRows = await db.query(
          'SELECT BIN_TO_UUID(id) AS id, name, email FROM users WHERE email = :email LIMIT 1',
          { replacements: { email: requesterEmail || null }, type: QueryTypes.SELECT }
        );
        if (reqRows[0]) {
          requesterUUID = reqRows[0].id;
          requesterName = reqRows[0].name || requesterName;
        }
      }

      if (!requesterUUID) {
        return res.status(401).json({
          meta: { Status: false, code: 401, Message: 'Unauthorized: Requester not found' },
          Data: {},
        });
      }

      // 7. Strip internal fields from payload before saving (execution fields only)
      const body = { ...req.body };
      delete body._approverId;
      const displayPayload = await approvalService.buildDisplayPayload(actionKey, body);

      // 8. Create approval record
      const approvalId = await approvalService.createApproval({
        action_key: actionKey,
        action_label: actionLabel || actionKey,
        method: req.method,
        endpoint: req.originalUrl,
        payload: body,
        requested_by: requesterUUID,
        approver_id: approver.id,
      });

      // 9. Send email to approver
      const frontendBase = process.env.CRM_URL || '';
      const approvalPageUrl = `${frontendBase}/approvals?id=${approvalId}`;

      try {
        sendEmail({
          to: approver.email,
          subject: `[Action Required] Approval Requested: ${actionLabel || actionKey} (#${approvalId})`,
          body: buildApproverEmail({
            approverName: approver.name,
            requesterName,
            actionLabel: actionLabel || actionKey,
            payload: displayPayload,
            approvalId,
            frontendUrl: approvalPageUrl,
          }),
        }, true);
      } catch (emailErr) {
        logger.error('[requireApproval] Failed to send approver email:', emailErr);
      }

      // 10. Respond to client — request queued for approval
      return res.status(202).json({
        meta: {
          Status: true,
          code: 202,
          Message: 'APPROVAL_PENDING',
        },
        Data: {
          status: 'APPROVAL_PENDING',
          approvalId,
          message: `Your request has been submitted for approval. Approver (${approver.name}) has been notified via email.`,
        },
      });

    } catch (err) {
      logger.error('[requireApproval] Error:', err);
      return res.status(500).json({
        meta: { Status: false, code: 500, Message: `Approval middleware error: ${err.message}` },
        Data: { stack: err.stack },
      });
    }
  };
};

module.exports = {
  requireApproval,
  buildRequesterNotificationEmail,
  MASTER_ROLES,
};

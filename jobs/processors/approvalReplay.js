'use strict';

const axios = require('axios');
const jwt = require('jwt-simple');
const moment = require('moment');
const approvalService = require('../../api/services/approval-services');
const UserService = require('../../api/services/user-services');
const { logger } = require('../../api/helpers/logger');
const { QueryTypes } = require('sequelize');
const { sendEmail } = require('../../api/helpers/commonhelper');
const { buildRequesterNotificationEmail } = require('../../api/helpers/approval-middleware');

module.exports = async function (job) {
    try {
        logger.info('[approvalReplayJob] Scheduled job running to process approvals...');

        const db = global._db7;
        // Fetch unexecuted approved rows only. Exclude Request Autonomous For Vendor
        // (that action applies on Approve, not via this 9 PM job).
        const approvals = await db.query(
            `SELECT id FROM api_approvals 
             WHERE 
               status = 'approved' 
               AND action_key <> 'requestAutonomousForVendor' 
               AND (remarks IS NULL OR remarks NOT LIKE '%[Executed%')`,
            { type: QueryTypes.SELECT }
        );

        logger.info(`[approvalReplayJob] Found ${approvals.length} approvals to process`);

        for (const approx of approvals) {
            const approvalId = approx.id;
            try {
                const record = await approvalService.getApprovalById(approvalId, { raw: true });
                if (!record) continue;

                logger.info(`[approvalReplayJob] Processing approval #${approvalId} (status: ${record.status})`);

                // 1. Get user details of the requester to generate a fresh JWT token
                const userRows = await db.query(
                    'SELECT email FROM users WHERE id = UUID_TO_BIN(:userId) LIMIT 1',
                    { replacements: { userId: record.requested_by }, type: QueryTypes.SELECT }
                );

                const requesterRow = userRows[0];
                if (!requesterRow) {
                    logger.warn(`[approvalReplayJob] Requester email not found for approval #${approvalId}`);
                    continue;
                }

                const requester = await UserService.findUser(requesterRow.email);
                if (!requester) {
                    logger.warn(`[approvalReplayJob] Requester user details not found for email ${requesterRow.email}`);
                    continue;
                }

                // 2. Generate a fresh JWT token for the requester
                delete requester.password;
                delete requester.dummyPassword;
                requester.tokenUpdateDate = new Date().toISOString();

                const freshToken = jwt.encode({
                    user: requester,
                    isApprovalReplay: true,
                    iat: moment().unix(),
                    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
                }, process.env.TOKEN_SECRET);

                // 3. Prepare Axios replay request
                const payload = record.payload ? JSON.parse(record.payload) : {};
                const protocol = 'http';
                const port = process.env.PORT || 3001;
                const callUrl = `${protocol}://127.0.0.1:${port}${record.endpoint}`;

                const headers = {
                    'Authorization': freshToken,
                    'Content-Type': 'application/json',
                };

                const payloadObj = typeof payload === 'object' && payload !== null ? { ...payload, _isApprovalReplay: true } : payload;

                const axiosRes = await axios.request({
                    method: record.method,
                    url: callUrl,
                    data: payloadObj,
                    headers,
                    timeout: 30000
                });

                if (axiosRes.data && axiosRes.data.meta && axiosRes.data.meta.Status === false) {
                    throw new Error(axiosRes.data.meta.Message || 'Action rejected internally');
                }

                // 4. Update the DB: set status to approved and set execution log in remarks (removing any previous error/execution remarks)
                const timestamp = new Date().toISOString();
                let baseRemarks = '';
                if (record.remarks) {
                    baseRemarks = record.remarks.split('\n')
                        .filter(line => !line.trim().startsWith('[Failed:') && !line.trim().startsWith('[Executed:'))
                        .join('\n').trim();
                }
                const newRemarks = `${baseRemarks}\n[Executed: ${timestamp}]`.trim();

                await db.query(
                    `UPDATE api_approvals 
                     SET status = 'approved', remarks = :remarks, status_updated_at = NOW(), updated_at = NOW() 
                     WHERE id = :id`,
                    { replacements: { id: approvalId, remarks: newRemarks }, type: QueryTypes.UPDATE }
                );

                // 5. Notify requester via email
                if (record.requested_by_email) {
                    try {
                        sendEmail({
                            to: record.requested_by_email,
                            subject: `[Approved] Your request for "${record.action_label}" (#${approvalId}) has been executed`,
                            body: buildRequesterNotificationEmail({
                                requesterName: record.requested_by_name,
                                actionLabel: record.action_label || record.action_key,
                                status: 'approved',
                                remarks: newRemarks,
                                approverName: record.approver_name || 'System Auto-Approval',
                                approvalId,
                            }),
                        }, true);
                    } catch (emailErr) {
                        logger.error(`[approvalReplayJob] Email notification failed for approval #${approvalId}:`, emailErr);
                    }
                }

                logger.info(`[approvalReplayJob] Successfully processed and executed approval #${approvalId}`);
            } catch (err) {
                const errMsg = err.response?.data
                    ? (err.response.data.meta?.Message || err.response.data.Message || JSON.stringify(err.response.data))
                    : err.message;
                logger.error(`[approvalReplayJob] Failed processing approval #${approvalId}:`, errMsg);

                // Set failure in remarks (removing any previous error/execution remarks)
                const timestamp = new Date().toISOString();
                const record = await approvalService.getApprovalById(approvalId, { raw: true });
                let baseRemarks = '';
                if (record && record.remarks) {
                    baseRemarks = record.remarks.split('\n')
                        .filter(line => !line.trim().startsWith('[Failed:') && !line.trim().startsWith('[Executed:'))
                        .join('\n').trim();
                }
                const failedRemarks = `${baseRemarks}\n[Failed: ${errMsg} at ${timestamp}]`.trim();
                await db.query(
                    `UPDATE api_approvals SET remarks = :remarks, updated_at = NOW() WHERE id = :id`,
                    { replacements: { id: approvalId, remarks: failedRemarks }, type: QueryTypes.UPDATE }
                );
            }
        }
    } catch (e) {
        logger.error('[approvalReplayJob] Scheduled job main loop error:', e);
    }
};

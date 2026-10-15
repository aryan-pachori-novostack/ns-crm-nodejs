const { sendEmailWithAttachmentBanker, buildCcEmailString } = require('../helpers/commonhelper');
const { BankerEmailTemplateLeadForm } = require('../../email-templates/BankerEmailTemplateLeadForm');
const { updateLeadMailMetaOnSendSuccess, updateLeadMailMetaOnSendFailure, updateLeadMailMetaOnCrmReply } = require('./finance-services');
const { logger } = require('../helpers/logger');
const { getRetiredMailboxAddresses } = require('../helpers/inbound-mailbox');

const parseEmailList = (raw) => {
    if (!raw) return [];
    return String(raw)
        .split(/[,;]/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
};

const buildCrmReplySignature = (loggedInUser) => {
    if (!loggedInUser) return '';

    const name = loggedInUser.userName || loggedInUser.name;
    const parts = [name, loggedInUser.userEmail].filter(Boolean);
    if (!parts.length) return '';

    return `<p style="margin-top:16px;color:#666;font-size:12px;">Sent from CRM by ${parts.join(' | ')}</p>`;
};

const appendCrmReplySignature = (html, loggedInUser) => {
    const signature = buildCrmReplySignature(loggedInUser);
    if (!signature) return html || '';
    return `${html || ''}${signature}`;
};

/**
 * Sends banker disbursal confirmation email (disbursal PDD status request).
 * Persists mail_thread_id + EMAIL_SENT on success, EMAIL_FAILED on failure.
 * @param {Object} params
 * @param {string} params.to - Banker email
 * @param {string} params.cc - CC emails (comma-separated)
 * @param {Object} params.data - Lead/claim data for template (first_name, last_name, loan_number, etc.)
 * @param {string} params.leadId - Lead/claim ID for subject (RU-{id})
 * @param {Object} [params.loggedInUser] - Optional: { userEmail, userPhone, userName } for CRM signature
 * @param {string} [params.inReplyTo] - Existing Message-ID to reply in same thread
 */
exports.sendBankerDisbursalConfirmationEmail = async ({ to, cc, data, leadId, loggedInUser, inReplyTo }) => {
    const enrichedData = { ...data };
    if (loggedInUser) {
        enrichedData.crm_user_email = loggedInUser?.userEmail;
        enrichedData.crm_user_mobile = loggedInUser?.userPhone;
        enrichedData.crm_user_name = loggedInUser?.userName;
    }

    const toLower = (e) => (e || '').trim().toLowerCase();
    const addToCc = ['cc@ruloans.com'];
    if (loggedInUser?.userEmail && toLower(loggedInUser.userEmail) !== toLower(to)) addToCc.push(loggedInUser.userEmail);
    if (data?.asm_email && toLower(data.asm_email) !== toLower(to)) addToCc.push(data.asm_email);
    // Never CC the retired mailbox (needconfirmation@ruloans.vip) that old claims may still carry in meta.cc_email.
    const ccResolved = buildCcEmailString(cc, { add: addToCc, remove: [to, ...getRetiredMailboxAddresses()] });

    const baseSubject = ` Required Disbursal Confirmation - (${enrichedData?.first_name} ${enrichedData?.last_name}) | RU-${leadId} `;
    const subject = inReplyTo ? `Re:${baseSubject}` : baseSubject;

    try {
        const result = await sendEmailWithAttachmentBanker(null, {
            to,
            subject,
            text: ` Require Disbursal Confirmation with PDD status of – (${enrichedData?.loan_number ? enrichedData?.loan_number + " &" : ""} ${enrichedData?.first_name} ${enrichedData?.last_name}). `,
            body: BankerEmailTemplateLeadForm(enrichedData),
            cc: ccResolved,
            inReplyTo: inReplyTo || undefined,
            references: inReplyTo || undefined
        }, true);

        if (result?.success) {
            await updateLeadMailMetaOnSendSuccess(
                leadId,
                result.threadId || result.messageId,
                { preserveThread: Boolean(inReplyTo) }
            );
            return { success: true, ...result };
        }

        await updateLeadMailMetaOnSendFailure(leadId, result?.error);
        return { success: false, error: result?.error || 'Email send failed' };
    } catch (error) {
        logger.error(`sendBankerDisbursalConfirmationEmail failed for lead ${leadId}: ${error.message}`);
        await updateLeadMailMetaOnSendFailure(leadId, error?.message);
    }
};

/**
 * CRM reply on existing banker thread (HTML body, no attachments).
 * Preserves mail_thread_id and keeps mail_status as EMAIL_RECEIVED.
 */
exports.sendMailThreadReply = async ({ to, cc, subject, html, inReplyTo, references, leadId, loggedInUser }) => {
    const toLower = (e) => (e || '').trim().toLowerCase();
    const toEmails = parseEmailList(to);
    const addToCc = ['cc@ruloans.com'];
    if (loggedInUser?.userEmail && !toEmails.includes(toLower(loggedInUser.userEmail))) {
        addToCc.push(loggedInUser.userEmail);
    }
    const ccResolved = buildCcEmailString(cc, { add: addToCc, remove: [...toEmails, ...getRetiredMailboxAddresses()] });

    const replySubject = subject || `Re: Disbursal Confirmation | RU-${leadId}`;
    const bodyWithSignature = appendCrmReplySignature(html, loggedInUser);
    const plainText = (bodyWithSignature || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const referencesHeader = references || inReplyTo || undefined;

    try {
        const result = await sendEmailWithAttachmentBanker(null, {
            to,
            subject: replySubject,
            text: plainText || ' ',
            body: bodyWithSignature,
            cc: ccResolved,
            inReplyTo: inReplyTo || undefined,
            references: referencesHeader
        }, true);

        if (result?.success) {
            await updateLeadMailMetaOnCrmReply(leadId);
            return { success: true, ...result };
        }

        await updateLeadMailMetaOnSendFailure(leadId, result?.error);
        return { success: false, error: result?.error || 'Reply send failed' };
    } catch (error) {
        logger.error(`sendMailThreadReply failed for lead ${leadId}: ${error.message}`);
        await updateLeadMailMetaOnSendFailure(leadId, error?.message);
        throw error;
    }
};

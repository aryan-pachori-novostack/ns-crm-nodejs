const { erpEmailTemplate } = require("../../../../../email-templates/erpEmailTemplate");
const { uploadArrayToS3, sendEmailWithAttachment } = require("../../../../helpers/commonhelper");
const { buildDsaSummary } = require("./erpHelpers");

/**
 * Create Excel attachment for ERP email and upload to S3
 * @param {Object[]} leads - Lead rows
 * @param {Object} summary - ERP summary
 * @param {boolean} isSuccess - Whether this is for success leads
 * @returns {Promise<string>} S3 URL of the uploaded file
 */
const createErpMailAttachment = async (leads, summary, isSuccess) => {
    try {
        const leadsToShow = isSuccess ? summary.sentToErpArray : summary.notSentToErpArray;
        
        const leadData = leadsToShow.map((leadId, index) => {
            const lead = leads.find(l => l.fresh_lead_id == leadId);
            const errorMsg = !isSuccess ? (summary.errorArray[index] || 'Unknown error') : '';
            
            return {
                'Fresh Lead ID': lead?.fresh_lead_id || 'N/A',
                'Loan Number': lead?.loan_reference_id || 'N/A',
                'Loan APAC Number': lead?.loan_apac_ref_los_number || 'N/A',
                'Customer Name': `${lead?.customer_full_name || ''}`.trim(),
                'Disbursement Amount': lead?.disbursement_amount || 'N/A',
                'Disbursement Date': lead?.disbursement_date || 'N/A',
                'Bank': lead?.bank_name || 'N/A',
                'Product': lead?.product_name || 'N/A',
                'Error': errorMsg
            };
        });
        
        const fileName = isSuccess ? 'erp_success_leads' : 'erp_failed_leads';
        const s3Url = await uploadArrayToS3(leadData, fileName);
        
        console.log("ERP attachment uploaded to S3:", s3Url);
        return s3Url;
    } catch (error) {
        console.error("Failed to create ERP attachment:", error);
        return null;
    }
};

/**
 * Send single ERP email with both success and failure attachments
 * @param {Object[]} leads - Lead rows
 * @param {string|string[]} toEmails - recipients
 * @param {Object} summary - ERP summary
 */
const sendErpEmail = async (leads, toEmails, summary) => {
    try {
        const successAttachmentUrl = summary.successCount > 0 ? await createErpMailAttachment(leads, summary, true) : null;
        const failureAttachmentUrl = summary.errorCount > 0 ? await createErpMailAttachment(leads, summary, false) : null;
        
        const subject = summary.errorCount === 0 
            ? `ERP Submission Success - ${summary.successCount} leads processed`
            : `ERP Submission - ${summary.successCount} success, ${summary.errorCount} failed`;
        
        const htmlBody = erpEmailTemplate({
            leads,
            summary,
            subject,
            successAttachmentUrl,
            failureAttachmentUrl
        });
        
        const attachments = [];
        if (successAttachmentUrl) {
            attachments.push({
                filename: 'ERP_SUCCESS_LEADS.xlsx',
                path: successAttachmentUrl
            });
        }
        if (failureAttachmentUrl) {
            attachments.push({
                filename: 'ERP_FAILED_LEADS.xlsx',
                path: failureAttachmentUrl
            });
        }

        sendEmailWithAttachment(attachments, {
            to: Array.isArray(toEmails) ? toEmails.filter(Boolean).join(",") : toEmails,
            subject,
            body: htmlBody
        }, true);
        console.log("ERP email sent via SMTP");
    } catch (error) {
        console.error("Failed to send ERP email:", error);
    }
};

/**
 * Send DSA-specific ERP summary emails (each DSA gets only its own leads + summary)
 * @param {Map<any, Object[]>} groupedLeads - Map<dsa_id, leads[]>
 * @param {Map<any, Set<string>>} emailRecipientMap - Map<dsa_id, Set<emails>>
 * @param {Object} globalSummary - global ERP summary (across all DSAs)
 */
const sendDsaSpecificEmails = async (groupedLeads, emailRecipientMap, globalSummary) => {
    for (const [dsaId, dsaLeads] of groupedLeads.entries()) {
        const recipients = emailRecipientMap.get(dsaId);
        const toEmails = recipients ? [...recipients].filter(Boolean) : [];
        if (!toEmails.length) continue;

        const dsaSummary = buildDsaSummary(dsaLeads, globalSummary);
        if (dsaSummary.successCount <= 0 && dsaSummary.errorCount <= 0) continue;

        await sendErpEmail(dsaLeads, toEmails, dsaSummary);
    }
};

module.exports = {
    sendErpEmail,
    sendDsaSpecificEmails
};
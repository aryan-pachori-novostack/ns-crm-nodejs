exports.erpEmailTemplate = ({ leads, summary, subject, successAttachmentUrl, failureAttachmentUrl }) => {
    const successLeads = summary.sentToErpArray || [];
    const failedLeads = summary.notSentToErpArray || [];
    const errorMessages = summary.errorArray || [];

    const now = new Date().toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    let tableRows = '';

    successLeads.forEach((leadId, index) => {
        const lead = leads.find(l => l.fresh_lead_id == leadId);
        const rowBg = index % 2 !== 0 ? 'background:#f9fafb;' : 'background:#ffffff;';
        tableRows += `
            <tr style="${rowBg} border-bottom: 1px solid #e5e7eb;">
                <td style="padding:10px 12px; color:#1a56db; font-weight:600; white-space:nowrap;">${lead?.fresh_lead_id || 'N/A'}</td>
                <td style="padding:10px 12px; color:#374151;">${lead?.loan_reference_id || 'N/A'}</td>
                <td style="padding:10px 12px; color:#374151;">${lead?.loan_apac_ref_los_number || 'N/A'}</td>
                <td style="padding:10px 12px; color:#111827; font-weight:500;">${lead?.customer_full_name || '—'}</td>
                <td style="padding:10px 12px; text-align:right; color:#111827; font-weight:600;">${lead?.disbursement_amount || 'N/A'}</td>
                <td style="padding:10px 12px; color:#374151;">${lead?.disbursement_date || 'N/A'}</td>
                <td style="padding:10px 12px; color:#374151;">${lead?.bank_name || 'N/A'}</td>
                <td style="padding:10px 12px; color:#374151;">${lead?.product_name || 'N/A'}</td>
                <td style="padding:10px 12px;"><span style="display:inline-block; font-size:11px; background:#dcfce7; color:#166534; padding:4px 10px; border-radius:4px; font-weight:600; line-height:1;">Success</span></td>
            </tr>`;
    });

    failedLeads.forEach((leadId, index) => {
        const lead = leads.find(l => l.fresh_lead_id == leadId);
        const errorMsg = errorMessages[index] || 'Unknown error';
        const rowBg = (successLeads.length + index) % 2 !== 0 ? 'background:#f9fafb;' : 'background:#ffffff;';
        tableRows += `
            <tr style="${rowBg} border-bottom: 1px solid #e5e7eb;">
                <td style="padding:10px 12px; color:#1a56db; font-weight:600; white-space:nowrap;">${lead?.fresh_lead_id || 'N/A'}</td>
                <td style="padding:10px 12px; color:#374151;">${lead?.loan_reference_id || 'N/A'}</td>
                <td style="padding:10px 12px; color:#374151;">${lead?.loan_apac_ref_los_number || 'N/A'}</td>
                <td style="padding:10px 12px; color:#111827; font-weight:500;">${lead?.customer_full_name || '—'}</td>
                <td style="padding:10px 12px; text-align:right; color:#111827; font-weight:600;">${lead?.disbursement_amount || 'N/A'}</td>
                <td style="padding:10px 12px; color:#374151;">${lead?.disbursement_date || 'N/A'}</td>
                <td style="padding:10px 12px; color:#374151;">${lead?.bank_name || 'N/A'}</td>
                <td style="padding:10px 12px; color:#374151;">${lead?.product_name || 'N/A'}</td>
                <td style="padding:10px 12px; color:#c81e1e; font-size:11px; line-height:1.4;">${errorMsg}</td>
            </tr>`;
    });

    const attachmentRow = (url, label, iconColor) => `
    <div style="padding:12px 16px; border:1px solid #e5e7eb; border-radius:8px; background:#f9fafb;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%; border-collapse:collapse;">
            <tr>
                <td style="width:18px; vertical-align:middle;">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z" stroke="${iconColor}" stroke-width="1.2" fill="none"/>
                        <path d="M9 2v4h4" stroke="${iconColor}" stroke-width="1.2" fill="none"/>
                    </svg>
                </td>
                <td style="font-size:12px; color:#374151; padding-left:10px; font-weight:500;">${label}</td>
                <td style="text-align:right; padding-left:10px;">
                    <a href="${url}" style="display:inline-block; font-size:12px; color:#1a56db; text-decoration:none; font-weight:600; padding:6px 12px; background:#eff6ff; border-radius:6px; min-height:20px; line-height:1;">Download</a>
                </td>
            </tr>
        </table>
    </div>`;
    const attachments = [
        successAttachmentUrl ? attachmentRow(successAttachmentUrl, 'Success Report', '#057a55') : '',
        failureAttachmentUrl ? attachmentRow(failureAttachmentUrl, 'Failure Report', '#c81e1e') : ''
    ].filter(Boolean);

    const attachmentSection = attachments.length
        ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" class="attachment-table" style="width:100%; border-collapse:collapse;">
           <tr>
               ${attachments.map(a => `<td style="padding-right:10px; vertical-align:top;">${a}</td>`).join('<td class="attachment-spacer" style="width:10px;"></td>')}
           </tr>
       </table>`
        : '';

    const total = (summary.successCount || 0) + (summary.errorCount || 0);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>ERP Submission Report</title>
    <style type="text/css">
        @media only screen and (max-width: 600px) {
            .email-container {
                width: 100% !important;
                padding: 16px 12px !important;
            }
            .header-table {
                display: block !important;
            }
            .header-left, .header-right {
                display: block !important;
                width: 100% !important;
                text-align: left !important;
            }
            .header-right {
                margin-top: 8px !important;
            }
            .stats-table {
                display: block !important;
            }
            .stats-card {
                display: block !important;
                width: 100% !important;
                margin-bottom: 8px !important;
            }
            .stats-spacer {
                display: none !important;
            }
            .table-wrapper {
                overflow-x: auto !important;
                -webkit-overflow-scrolling: touch !important;
            }
            .data-table {
                min-width: 800px !important;
            }
            .attachment-table td {
                display: block !important;
                width: 100% !important;
                padding-right: 0 !important;
                padding-bottom: 8px !important;
            }
            .attachment-spacer {
                display: none !important;
            }
        }
    </style>
</head>
<body style="margin:0; padding:0; background:#f3f4f6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f3f4f6;">
        <tr>
            <td style="padding:20px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="email-container" style="max-width:960px; width:100%; margin:0 auto; background:#ffffff; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="padding:24px 24px 20px 24px;">
                            <!-- Header -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="header-table" style="border-bottom:2px solid #1a56db; padding-bottom:12px; margin-bottom:20px;">
                                <tr>
                                    <td class="header-left" style="vertical-align:bottom;">
                                        <div style="font-size:11px; color:#6b7280; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:4px; font-weight:600;">ERP SUBMISSION REPORT</div>
                                        <div style="font-size:18px; font-weight:600; color:#111827; line-height:1.3;">${subject || 'ERP Submission Report'}</div>
                                    </td>
                                    <td class="header-right" style="text-align:right; vertical-align:bottom; font-size:11px; color:#6b7280; white-space:nowrap;">${now}</td>
                                </tr>
                            </table>

                            <!-- Stats Cards -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="stats-table" style="margin-bottom:24px;">
                                <tr>
                                    <td class="stats-card" style="width:33.33%; padding:14px 16px; background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
                                        <div style="font-size:11px; color:#6b7280; margin-bottom:6px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">Total Processed</div>
                                        <div style="font-size:24px; font-weight:700; color:#1a56db; line-height:1.2;">${total}</div>
                                    </td>
                                    <td class="stats-spacer" style="width:8px;"></td>
                                    <td class="stats-card" style="width:33.33%; padding:14px 16px; background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
                                        <div style="font-size:11px; color:#6b7280; margin-bottom:6px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">Sent to ERP</div>
                                        <div style="font-size:24px; font-weight:700; color:#057a55; line-height:1.2;">${summary.successCount || 0}</div>
                                    </td>
                                    <td class="stats-spacer" style="width:8px;"></td>
                                    <td class="stats-card" style="width:33.33%; padding:14px 16px; background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
                                        <div style="font-size:11px; color:#6b7280; margin-bottom:6px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">Failed</div>
                                        <div style="font-size:24px; font-weight:700; color:#c81e1e; line-height:1.2;">${summary.errorCount || 0}</div>
                                    </td>
                                </tr>
                            </table>

                            <!-- Lead Details Section -->
                            <div style="font-size:11px; font-weight:600; color:#6b7280; letter-spacing:0.06em; text-transform:uppercase; margin-bottom:8px;">Lead Details</div>
                            <div class="table-wrapper" style="border-radius:8px; border:1px solid #e5e7eb; overflow:hidden; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="data-table" style="width:100%; border-collapse:collapse; font-size:12px;">
                                    <thead>
                                        <tr style="background:#1a56db;">
                                            <th style="padding:10px 12px; text-align:left; color:#fff; font-weight:600; font-size:11px; white-space:nowrap; border-right:1px solid rgba(255,255,255,0.1);">Lead ID</th>
                                            <th style="padding:10px 12px; text-align:left; color:#fff; font-weight:600; font-size:11px; white-space:nowrap; border-right:1px solid rgba(255,255,255,0.1);">Loan No.</th>
                                            <th style="padding:10px 12px; text-align:left; color:#fff; font-weight:600; font-size:11px; white-space:nowrap; border-right:1px solid rgba(255,255,255,0.1);">APAC Ref</th>
                                            <th style="padding:10px 12px; text-align:left; color:#fff; font-weight:600; font-size:11px; white-space:nowrap; border-right:1px solid rgba(255,255,255,0.1);">Customer</th>
                                            <th style="padding:10px 12px; text-align:right; color:#fff; font-weight:600; font-size:11px; white-space:nowrap; border-right:1px solid rgba(255,255,255,0.1);">Amount</th>
                                            <th style="padding:10px 12px; text-align:left; color:#fff; font-weight:600; font-size:11px; white-space:nowrap; border-right:1px solid rgba(255,255,255,0.1);">Date</th>
                                            <th style="padding:10px 12px; text-align:left; color:#fff; font-weight:600; font-size:11px; white-space:nowrap; border-right:1px solid rgba(255,255,255,0.1);">Bank</th>
                                            <th style="padding:10px 12px; text-align:left; color:#fff; font-weight:600; font-size:11px; white-space:nowrap; border-right:1px solid rgba(255,255,255,0.1);">Product</th>
                                            <th style="padding:10px 12px; text-align:left; color:#fff; font-weight:600; font-size:11px; white-space:nowrap;">Status / Error</th>
                                        </tr>
                                    </thead>
                                    <tbody style="background:#fff;">${tableRows}</tbody>
                                </table>
                            </div>

                            <!-- Attachments Section -->
                            ${attachmentSection ? `<div style="margin-top:20px;">${attachmentSection}</div>` : ''}

                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding:16px 24px; background:#f9fafb; border-top:1px solid #e5e7eb; border-radius:0 0 8px 8px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="font-size:11px; color:#6b7280; line-height:1.5;">
                                        <strong style="color:#111827;">Novostack CRM</strong> - ERP Submission Report<br>
                                        This is an automated notification. Please do not reply to this email.
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
};
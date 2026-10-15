const nodemailer = require("nodemailer");
const { logger } = require("../api/helpers/logger");

const misEmailUser = process.env.MIS_INBOUND_EMAIL || "ruconnect.mis@ruloans.com";
const misEmailPass = process.env.MIS_INBOUND_EMAIL_PASSWORD || "Vp@Rc@0926**";

const misTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: misEmailUser,
        pass: misEmailPass,
    },
});

const lenderConfigs = {
    poonawala: {
        lender_name: "Poonawalla Fincorp",
        emails: [
            "Sourabh.bhaumik@poonawallafincorp.com",
            "mahesh.bhairshetty@poonawallafincorp.com",
            "mohit.manghnani@poonawallafincorp.com",
            "balkrishan.sharma@ruloans.com",
            "toshika.ahlawat@ruloans.com",
            "divya.singh@ruloans.com",
            "mansi.sharma@poonawallafincorp.com",
            "balasaheb.jadhav@poonawallafincorp.com",
            "nitin3@poonawallafincorp.com",
            "Swapnil.sharma@poonawallafincorp.com",
            "Kenneth.rebello@poonawallafincorp.com",
            "cibin.chacko@poonawallafincorp.com",
            "Sushma.bodke@poonawallafincorp.com",
            "tanay.samanta@poonawallafincorp.com",
            "ananya.kumari@novostack.com",
        ],
        // emails: [
        //     "tushar.garg@novostack.com",
        //     "ananya.kumari@novostack.com",
        // ],
        
        notify_on_failure: true,
    },
    hero_fincorp_pl: {
        lender_name: "Hero Fincorp Personal Loan",
        emails: [
            "tarun.chauhan1@herofincorp.com",
            "isha.sharma@herofincorp.com",
            "shubham.mishra1@herofincorp.com",
            "navya.krishnia@herofincorp.com",
            "ananya.kumari@novostack.com",
        ],
        notify_on_failure: true,
    },
    loanwalle_pl: {
        lender_name: "Loanwalle Personal Loan",
        emails: [
            "karanbir.bhatia@fintechcloud.com",
            "avanish.upadhyay@fintechcloud.in",
            "shubham.k@loanwalle.com",
            "hitakshi.lalwani@fintechcloud.com",
            "hritik@duniyafinance.com",
            "shailendra@fintechcloud.com",
            "poorva.vedpathak@fundobaba.com",
            "ananya.kumari@novostack.com",
        ],
        notify_on_failure: true,
    },
    sundaram_hl: {
        lender_name: "Sundaram Home Finance",
        emails: [
            "GBALA@sundaramhome.in",
            "sudhanshu@sundaramhome.in",
            "nishant.shukla@ruloans.com",
            "akshay.sharma@novostack.com",
            "divya.singh@ruloans.com",
            "ANITHAN@sundaramhome.in",
            "mbalaji@sundaramhome.in",
            "rajarajan@sundaramhome.in",
            "padma@sundaramhome.in",
            "ALLI@sundaramhome.in",
            "ananya.kumari@novostack.com",
        ],
        notify_on_failure: true,
    },
    sundaram_lap: {
        lender_name: "Sundaram LAP",
        emails: [
            "GBALA@sundaramhome.in",
            "sudhanshu@sundaramhome.in",
            "nishant.shukla@ruloans.com",
            "akshay.sharma@novostack.com",
            "divya.singh@ruloans.com",
            "ANITHAN@sundaramhome.in",
            "mbalaji@sundaramhome.in",
            "rajarajan@sundaramhome.in",
            "padma@sundaramhome.in",
            "ALLI@sundaramhome.in",
            "ananya.kumari@novostack.com",
        ],
        notify_on_failure: true,
    },
    sbi_credit_card: {
        lender_name: "SBI Credit Card",
        emails: [
            "LGCentralteam@sbicard.com",
            "nupur.gautam1@sbicard.com",
            "gaurav.shirgoankar@sbicard.com",
            "ayushi.gupta1@sbicard.com",
            "sumit.banerji@sbicard.com",
            "ananya.kumari@novostack.com",
        ],
        notify_on_failure: true,
    },
    sbi_cards: {
        lender_name: "SBI Cards",
        emails: [
            "LGCentralteam@sbicard.com",
            "nupur.gautam1@sbicard.com",
            "gaurav.shirgoankar@sbicard.com",
            "ayushi.gupta1@sbicard.com",
            "sumit.banerji@sbicard.com",
            "ananya.kumari@novostack.com",
        ],
        notify_on_failure: true,
    },
};

/**
 * Generates HTML email template for MIS discrepancies.
 */
function renderLenderFailureEmailTemplate({ lenderName, fileName, successCount, failureCount, errorFileS3Url }) {
    const total = successCount + failureCount;
    const successRate = total > 0 ? ((successCount / total) * 100).toFixed(1) : 0;

    return `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #d32f2f; margin-bottom: 8px;">MIS Processing Action Required: ${lenderName}</h2>
            <p style="color: #555; font-size: 14px;">The uploaded MIS file <b>${fileName}</b> has completed processing with some records requiring attention.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background-color: #f5f5f5;">
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Metric</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Value</th>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">File Name</td>
                    <td style="padding: 10px; border: 1px solid #ddd;"><b>${fileName}</b></td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">Total Records</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${total}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">Successfully Processed</td>
                    <td style="padding: 10px; border: 1px solid #ddd; color: #2e7d32; font-weight: bold;">${successCount} (${successRate}%)</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">Failed / Quarantined</td>
                    <td style="padding: 10px; border: 1px solid #ddd; color: #c62828; font-weight: bold;">${failureCount}</td>
                </tr>
            </table>

            ${errorFileS3Url ? `
            <div style="margin: 20px 0; text-align: center;">
                <a href="${errorFileS3Url}" style="background-color: #1976d2; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-weight: bold; display: inline-block;">
                    Download Error Report (.csv)
                </a>
            </div>
            ` : ""}

            <p style="font-size: 12px; color: #888; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">
                This is an automated notification sent by Ruloans CRM MIS Processing Engine. Quarantined records are retained for the configured duration.
            </p>
        </div>
    `;
}

/**
 * Sends summary email to lender when errors/failures occur in MIS processing (bot uploads only).
 */
async function sendLenderNotificationEmail(product, fileName, successCount, failureCount, errorFileS3Url) {
    try {
        const config = lenderConfigs[product];
        if (!config || !config.notify_on_failure || !config.emails || config.emails.length === 0 || process.env.ENVIRONMENT === "dev") {
            return;
        }

        const lenderName = config.lender_name || product;
        const html = renderLenderFailureEmailTemplate({
            lenderName,
            fileName,
            successCount,
            failureCount,
            errorFileS3Url,
        });

        const mailOptions = {
            from: `"Ruloans MIS Engine" <${misEmailUser}>`,
            to: config.emails.join(", "),
            subject: `[ACTION REQUIRED] MIS Upload Report for ${lenderName} - ${failureCount} Failures`,
            html,
        };

        misTransporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                logger.error ? logger.error("Error sending MIS lender notification email:", err) : console.error("Error sending MIS lender notification email:", err);
            } else {
                logger.info ? logger.info(`MIS lender notification email sent to ${config.emails.join(", ")}: ${info?.response}`) : console.log("MIS lender notification email sent:", info?.response);
            }
        });
    } catch (err) {
        logger.error ? logger.error("Error in sendLenderNotificationEmail:", err) : console.error("Error in sendLenderNotificationEmail:", err);
    }
}

module.exports = lenderConfigs;
module.exports.sendLenderNotificationEmail = sendLenderNotificationEmail;
module.exports.renderLenderFailureEmailTemplate = renderLenderFailureEmailTemplate;

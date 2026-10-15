const { logger } = require("../../api/helpers/logger");
const { getLeadFormMailConfirmationStatus, updateLeadFormMailConfirmationStatus, getLeadFormBankerAndAsmDetails } = require("../../api/services/lead-services");
const { updateBankerApplicationStatus, getBankerApplicationsByLeadIds } = require('../../api/v1/controllers/mongo-db');

module.exports = async function (job) {
  try {
    let { application_id, subject, from, body, body_html, thread_id } = job.data;
    console.log({ application_id, subject, from, body, body_html, thread_id });
    updateBankerApplicationStatus({ application_id, subject, from, body, body_html, thread_id });
    const confirmation_reminder_count = await getLeadFormMailConfirmationStatus(application_id)

    if (confirmation_reminder_count !== 3) {
      const emails = await getLeadFormBankerAndAsmDetails(application_id)
      const { asm_email, banker_email } = emails;
      const extractEmail = (email) => {
        if (!email) return '';
        const match = email.match(/<([^>]+)>/);
        return (match ? match[1] : email).toLowerCase().replace(/\s+/g, '');
      };
      const normalizedAsm = extractEmail(asm_email);
      const normalizedBanker = extractEmail(banker_email);
      const normalizedFrom = extractEmail(from);

      let fromMatches = false;
      if (normalizedFrom && (normalizedFrom === normalizedAsm || normalizedFrom === normalizedBanker)) {
        fromMatches = true;
      }

      let prevMailMatches = false;
      if (!fromMatches) {
        let prevMailRecieved = await getBankerApplicationsByLeadIds([application_id]);
        if (Array.isArray(prevMailRecieved) && prevMailRecieved.length > 0) {
          const lastMail = prevMailRecieved[prevMailRecieved.length - 1];
          const mailFrom = extractEmail(lastMail?.from);
          prevMailMatches = mailFrom === normalizedAsm || mailFrom === normalizedBanker;
        }
      }

      if (fromMatches || prevMailMatches) {
        await updateLeadFormMailConfirmationStatus(application_id, 3)
      }
    }
  } catch (e) {
    console.log(e);
    logger(e);
  }
};

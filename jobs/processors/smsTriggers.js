const { QueryTypes } = require("sequelize");
const { logger } = require("../../api/helpers/logger");
const { sendSmsTemplate, sendSMSNew } = require("../../api/helpers/commonhelper");
const { sequelize,_db2 } = require('../db');

const shouldNotify = (value, buffer) => {
    let hour = new Date().getHours();
    let minutes = new Date().getMinutes();
    if (hour == value) {
        return true;
    } else if (hour == value - 1 && minutes > buffer) {
        return true;
    }
    return false;
}

const isTest = Boolean(process.env.ENVIRONMENT == "dev");

const sendJourneyCompletionReminder = async () => {
    try {
        if (shouldNotify(10, 30) && !isTest) {
            let query = ' SELECT dsa_mobile_number, signup_steps_completed FROM ru_direct_selling_agents where signup_steps_completed<5 ';
            const data = await _db2.query(query, { type: QueryTypes.SELECT });
            let message = `"Dear Partner Thank you for Downloading Our RUCONNECT App.\n\nYour Registration seems to be incomplete. Complete your registration today.\n\nRegards,\nRUCONNECT by RULOANS"`;
            for (let i = 0; i < data?.length; i++) {
                const number = data[i]?.dsa_mobile_number;
                // await sendSmsTemplate(number, message);
            }
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
    }
};

const sendNoFileReminder = async () => {
    try {
        if (shouldNotify(10, 30) && !isTest) {
            let query = ' SELECT dsa_mobile_number, first_name, last_name from ru_direct_selling_agents rdsa where (select count(*) from ru_loan_applications rla where rla.dsa_mobile_number= rdsa.dsa_mobile_number) = 0 and  (select count(*) from ru_credit_card_applications rcca  where rcca.dsa_mobile_number= rdsa.dsa_mobile_number) = 0 and (select count(*) from ru_lt_personal_loan_applications rlpla  where rlpla.dsa_mobile_number= rdsa.dsa_mobile_number) = 0 and (select count(*) from ru_indifi_loan_applications rila  where rila.dsa_mobile_number= rdsa.dsa_mobile_number) = 0; ';
            const data = await _db2.query(query, { type: QueryTypes.SELECT });
            for (let i = 0; i < data?.length; i++) {
                const number = data[i]?.dsa_mobile_number;
                const name = data[i]?.first_name || "Dear";
                let message = `"Welcome onboard ${name}\n\nWe\'re glad that you\'ve joined RULOANS, but it seems that you haven\'t started doing business yet.\n\nRegards,\nRUCONNECT by RULOANS"`;
                // await sendSmsTemplate(number, message);
            }
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
    }
}

//When Status Change to Businees Started 
const sendBusinessStartReminder = async (number) => {
    try {
        let message = `"Dear Sir/Madam,
Greetings from Ruloans. 
Congratulations on joining Ruloans as our Partner. We are happy that you have chosen our exclusive program. Please reach out to your manager for any query or support you may require. 
Let us grow together with this association.
Regards,
Team Ruloans"`;
      
        await sendSMSNew('1207162952804032508',message,number);
        
    } catch (err) {
        console.log(err)
        logger.error(err);
    }
}

//When Status Change to Payout Shared
const sendPayoutSharedReminder = async (number) => {
    try {
        let message = `Dear Sir/Madam,
Greetings from Ruloans. 
We have shared the payout structure that's exclusively created for you. We request you to let us know if there are any new files that you would want to share with us.
For any queries, you may contact your designated manager.
Regards,
Team Ruloans`;
        
        await sendSMSNew('1207162952785577688',message,number);
    } catch (err) {
        console.log(err)
        logger.error(err);
    }
}

//When Status Change to Not Interested
const sendNotInterestedReminder = async (number) => {
    try {
        let message = `Dear Sir/Madam,
Greetings from Ruloans. We sincerely hope you are in good health.
Thank you for your interest and time. We would like to keep in touch with you by sending occasional emails. We hope that's fine with you.
You can click on the 'Unsubscribe' link anytime if you feel we are spamming your inbox.
Regards,
Team Ruloans`;
        
        await sendSMSNew('1207162952731224234',message,number);
    } catch (err) {
        console.log(err)
        logger.error(err);
    }
}

//When Status Change to inprocess and Sub status to Assign to RSM
const sendAssignRsmReminder = async (number, name) => {
    try {
        let message = `Reminder - Dear ${name || ""}, you have been assigned a lead. Please log into the CRM to view and update.`;
        await sendSMSNew('1207161708703887889',message,number);
    } catch (err) {
        console.log(err)
        logger.error(err);
    }
}

//When Status Change to inprocess and Sub status to Assign to RSM
const sendAssignRsmReminder2 = async (number, name) => {
    try {
        let message = `Dear ${name}, you have been assigned a lead. Please log into the CRM to view and update.`;
       
        await sendSMSNew('1207161708694689206',message,number);
    } catch (err) {
        console.log(err)
        logger.error(err);
    }
}

//When Status Change to inprocess and Sub status to Manager Approval
const sendManagerApprovalReminder = async (number) => {
    try {
        let message = `Dear Sir/Madam,
Greetings from Ruloans. 
As per our discussion, we have forwarded your special request and now await management approval. We shall keep you informed on the updated status.
Like always, we look forward to beginning this mutually beneficial association.
Regards,
Team Ruloans`;
       
        await sendSMSNew('1207162952692238821',message,number);
    } catch (err) {
        console.log(err)
        logger.error(err);
    }
}

//When Status Change to RNR
const sendRnrReminder = async (number) => {
    try {
        let message = `Dear Sir/Madam,
Greetings from Ruloans.
Thank you for your interest in partnering with Ruloans. We tried contacting you recently but did not get any response.
Kindly let us know what time is convenient for you to connect with us. You can reply back on this mail or call us on 1800 266 7576 between 10 am to 6.30 pm, Monday to Saturday.
We look forward to beginning our association.
Regards,
Team Ruloans`;
      
        await sendSMSNew('1207162952653998123',message,number);
    } catch (err) {
        console.log(err)
        logger.error(err);
    }
}

//When Status Change to inprocess and Sub status to Will visit Office
const sendWillVisitReminder = async (number) => {
    try {
        let message = `Dear Sir/Madam,
Greetings from Ruloans. 
In our recent conversation, we have set up a meeting time at your convenience. We look forward to you visiting our office and beginning our association.
Again, we thank you for choosing Ruloans.
Regards,
Team Ruloans`;
        
        await sendSMSNew('1207162952711413872',message,number);
    } catch (err) {
        console.log(err)
        logger.error(err);
    }
}

module.exports = {
    sendJourneyCompletionReminder,
    sendNoFileReminder,
    shouldNotify,
    sendBusinessStartReminder,
    sendPayoutSharedReminder,
    sendNotInterestedReminder,
    sendAssignRsmReminder,
    sendAssignRsmReminder2,
    sendManagerApprovalReminder,
    sendRnrReminder,
    sendWillVisitReminder
};


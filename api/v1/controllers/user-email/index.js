const User = require("../../../../models/User");
const { logger } = require("../../../helpers/logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let UserEmailValidationV1 = require(_pathconst.ReqModelsPath.UserEmailValidationV1);
const { v4: uuid } = require('uuid');
let UserEmailService = require(_pathconst.ServicesPath.UserEmailService);
let {emailQueueLead,cplq} = require(_pathconst.FilesPath.Queue);


const sendEmail = async (req, res, next) => {
    try {
        const { error } = await UserEmailValidationV1.sendEmail.validate(req.body);
        console.log("ERROR", error)

        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");

        } else {
            let { to_mail, to_cc, to_bcc, subject, body, attachments, isDraft, lead_id } = req.body;
            console.log("email", req.body)
            let status = "pending";
            if (isDraft) {
                status = "draft";
            }
            let user_email = await UserEmailService.create({ to_mail, to_bcc, to_cc, subject, body, send_by: req.loggedInUser.id, status, lead_id });
            let user_email_attachment;
            if (attachments && attachments.length != 0) {
                user_email_attachment = await UserEmailService.createAttachment(user_email.id, attachments);
            }
            emailQueueLead.add({ id: user_email.id })
            ResHelper.apiResponse(res, true, " Success ", 201, {}, "");

        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}


const getEmails = async (req, res, next) => {
    try {
        const { error } = await UserEmailValidationV1.getEmails.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, lead_id, status } = req.body;
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }
            let where = [];
            where.push(['ue.send_by', ` = uuid_to_bin('${req.loggedInUser.id}') `])
            if (lead_id) {
                where.push(['ue.lead_id', ` = uuid_to_bin('${lead_id}') `, null]);
            }
            if (status) {
                where.push(['ue.status', '=', status]);
            }
            let result = await UserEmailService.getEmails(req.loggedInUser.id, where, pageNumber * pageSize, pageSize);
            ResHelper.apiResponse(res, true, " Success ", 200, result, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}



module.exports = {
    sendEmail,
    getEmails
};



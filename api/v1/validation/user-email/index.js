let Joi = require("joi");



const sendEmail = Joi.object({
    to_mail: Joi.string().required(),
    isDraft: Joi.boolean().allow(null),
    to_cc: Joi.string().allow(null,""),
    to_bcc: Joi.string().allow(null,""), 
    subject: Joi.string().allow(null,""),
    body: Joi.string().required(),
    attachments:Joi.array().items(Joi.string()),
    lead_id:Joi.string().required()
 });
 const getEmails = Joi.object({
    pageNumber:Joi.number().allow(null),
    pageSize:Joi.number().allow(null),
    status:Joi.string().allow(null,""),
    lead_id:Joi.string().allow(null,"")
 });

module.exports = { 
  sendEmail,
  getEmails
}
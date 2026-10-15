let path = require('path');
const fs = require('fs');
const config = require("../../config/config");
require('dotenv').config({ path: '.env' });
const { logger } = require("../../api/helpers/logger");
const { sequelize, _db2 } = require('../db');
const { QueryTypes } = require('sequelize');
const nodemailer = require('nodemailer');
const emailValidator = require('deep-email-validator');
const verify = async (email) => {
  try {
    let ans = await emailValidator.validate(email)
    console.log(ans)
    console.log(ans?.validators?.mx?.valid)
    return ans?.validators?.mx?.valid;
  } catch (err) {
    return false;
  }
}
let AWS = require('aws-sdk');
let axios = require('axios');


// configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.SES_ACCESS_KEY,
  secretAccessKey: process.env.SES_SECRET_KEY,
  region: process.env.SES_REGION
});

// create Nodemailer SES transporter
let transporterSES = nodemailer.createTransport({
  SES: new AWS.SES({
    apiVersion: process.env.SES_API_VERSION
  })
});

// // send some mail



const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.FROM_EMAIL,
    pass: process.env.EMAIL_PASSWORD
  }
});

const sendEmailSES = async function (emailBody, attachments, id) {
  let valid = await verify(emailBody.to);
  console.log(emailBody)
  if (valid) {
    transporter.sendMail({
      from: process.env.SES_FROM_EMAIL,
      to: emailBody.to,
      cc: emailBody.cc,
      bcc: emailBody.bcc,
      subject: emailBody.subject,
      text: emailBody.text,
      html: emailBody.html,
      attachments: attachments
    }, async (err, info) => {
      if (err) {
        logger.error("mail not sent")
        return -1;
      } else {
        logger.error('mail sent')
        let query = ` update user_emails set status = ? where id = uuid_to_bin(?) `;
        let bindParams = ['success', id];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
        return 0;
      }
    });
  } else {
    let query = ` update user_emails set status = ? where id = uuid_to_bin(?) `;
    let bindParams = ['invalid', id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
  }
}

module.exports = async function (job) {
  try {
    if (process.env.ENVIRONMENT != 'test') {
      let { id } = job.data;
      let query = ` select bin_to_uuid(u.id) as id, u.to_mail as to_mail,u.status as status, u.to_bcc as bcc , u.to_cc as cc, u.subject as subject ,u.body as body  from user_emails  u where u.id = uuid_to_bin(?) `;
      let bindParams = [id];
      let email = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
      email = email[0] ? email[0] : null;
      if (email) {
        if (email.status == 'pending') {
          query = ` select url from user_email_attachments where email_id = uuid_to_bin(?) `;
          let attachments = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
          let attachment_array = [];
          for (let i = 0; i < attachments.length; i++) {
            if (attachments[i].url) {
              let filename = attachments[i].url.split('email_attachments.')[1];
              attachment_array.push({ filename, path: attachments[i].url });
            }
          }
          let emailBody = {
            to: email.to_mail,
            bcc: email.bcc,
            cc: email.cc,
            subject: email.subject,
            html: email.body
          }
          await sendEmailSES(emailBody, attachment_array, id);
        }
      }
    }
  } catch (e) {
    console.log(e)
  }
};

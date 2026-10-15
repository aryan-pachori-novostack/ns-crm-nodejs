let path = require('path');
const config = require("../../config/config");
const axios = require('axios');
const { logger } = require("../../api/helpers/logger");
const { sequelize, _db2 } = require('../db');
let csvToJson = require('convert-csv-to-json');
const { Parser } = require('json2csv');
let randomstring = require("randomstring");
let DSAService = require('../../api/services/dsa-services');
let fs = require('fs');
const xlsx = require('xlsx')
const nodemailer = require('nodemailer');
const { uploadToS3, uploadArrayToS3, sendEmailWithAttachment } = require("../../api/helpers/commonhelper");
const emailValidator = require('deep-email-validator');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.FROM_EMAIL,
    pass: process.env.EMAIL_PASSWORD
  }
});




const { QueryTypes } = require('sequelize');

async function getLedgerData(id, page_index, user) {
  try {
    let data = JSON.stringify({
      "vendorId": id,
      "pageIndex": page_index
    });

    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${process.env.MS_URL}/api/fresh-lead/save-ledger`,
      headers: {
        'api-key': 'b0.khJGugUKsy9-jt#ruloans',
        'Content-Type': 'application/json'
      },
      data: data
    };

    const response = await axios.request(config);
    //   console.log(JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    console.log(error.message)
    console.error('Error:', error.response ? error.response.data : error.message);
    // ... (existing error handling code)
    return -1;
  }
}

async function getPaymentData(id, page_index, user) {
  try {
    let data = JSON.stringify({
      "iVendorId": id,
      "pageIndex": page_index
    });

    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${process.env.MS_URL}/api/fresh-lead/send-vendor-payment`,
      headers: {
        'api-key': 'b0.khJGugUKsy9-jt#ruloans',
        'Content-Type': 'application/json'
      },
      data: data
    };

    const response = await axios.request(config);
    //   console.log(JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    console.log(error.message)
    console.error('Error:', error.response ? error.response.data : error.message);
    // ... (existing error handling code)
    return -1;
  }
}






const sendEmail = function (emailBody, isHtml) {
  let mailOptions;
  if (isHtml) {
    mailOptions = {
      from: process.env.FROM_EMAIL,
      to: emailBody.to,
      subject: emailBody.subject,
      html: emailBody.body
    };
    console.log(mailOptions)
  } else {
    mailOptions = {
      from: process.env.FROM_EMAIL,
      to: emailBody.to,
      subject: emailBody.subject,
      text: emailBody.body
    };

  }

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
    } else {
      logger.info('Email sent: ' + info.response);
      console.log('Email sent: ' + info.response);
    }
  });
}

function getCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  return `${day}/${month}/${year}_${hours}:${minutes}:${seconds}`;
}

module.exports = async function (job) {
  try {
    let { id, user, name, bhName, has_ratio_of_payout_vs_actual, cc_emails } = job.data;
    //console.log("Here",job.data)
    let query = ` insert into application_logs (application_type,application_id,field,from_value,to_value,updated_by) values ('get_ledger_api',?,?,?,?,uuid_to_bin(?)) `;
    let bindParams = [id, 'process', 'processing Start', '', user.id]

    let result = [];
    let payment = [];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    for (let i = 1; ; i++) {
      let data = await getLedgerData(id, i, user);
      if (data['Code'] == 400) {
        break;
      }
      data = data.data;
      result = result.concat(data)
    }
    for (let i = 1; ; i++) {
      let data = await getPaymentData(id, i, user);
      if (data['Code'] == 400) {
        break;
      }
      data = data.data;
      payment = payment.concat(data)
    }

    if (!has_ratio_of_payout_vs_actual) {
      for (let i = 0; i < result.length; i++) {
        delete result[i]['Ratio of Payout vs Actual']
      }
    }

    let url = await uploadArrayToS3(result, 'leader_download' , "xls")
    let urlPayment = await uploadArrayToS3(payment, 'leader_payment_download' , "xls")

    console.log(url)

    let attachments = [
      {   // use URL as an attachment
        filename: `LEDGER_REPORT_${id}:${name ? name : ''}-${bhName ? bhName : ''}.xls`,
        path: url
      },
      {   // use URL as an attachment
        filename: `PAYMENT_LEDGER_REPORT_${id}:${name ? name : ''}-${bhName ? bhName : ''}.xls`,
        path: urlPayment
      }
    ]
    let sendArray = [user.userEmail, "tusharmunnu@gmail.com", ...(cc_emails || [])]//[  'neeraj.singh@novostack.com']//,'vishal.phule@ruloans.com'];
    for (let k = 0; k < sendArray.length; k++) {
      await sendEmailWithAttachment(attachments, {
        to: sendArray[k],
        subject: ` Attention: Ledger of (${id}:${name ? name : ''}-${bhName ? bhName : ''}) `,
        body: ` Here is Ledger Data Download For User ${name ? name + ':' + id : id} `,
      });
    }

    //console.log(result.length)

    // console.log(result)
    // let url = await uploadToS3("dsaWithStepsNew", base64_new, uniqueString1 + uniqueString, 'application/octet-stream', 'csv');
    // await sendEmail({ to: sentTo, subject: 'Dsa Sign Up Steps Detail File Generated.', body: ` Here is you generated file ${url}.` })
  } catch (e) {
    console.log(e)
  }
};


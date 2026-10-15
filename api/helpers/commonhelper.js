const moment = require("moment");
const pdf2base64 = require('pdf-to-base64');
const { logger } = require("./logger");
const nodemailer = require('nodemailer');
let AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const randomstring = require('randomstring');
const mime = require('mime-types');

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// create a Twilio client
// const accountSid = process.env.TWILIO_ACCOUNT_SID;
// const authToken = process.env.TWILIO_AUTH_TOKEN;
// const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;    

// const client = require('twilio')(accountSid, authToken);
let currentTime = new Date();
let currentOffset = currentTime.getTimezoneOffset();
let ISTOffset = 330;
let { subProductMapping } = require('./constantdata/sub_product_mapping');
const { LEAD_FORMS_IS_SAME_DAY_BILLING_ENABLED_SQL } = require('./apiFieldMappings');


// exports.sendMessage = async function(message){

//     const message = await client.messages.create({
//       from: messagingServiceSid,
//       to: message.to,  // ← your phone number here
//       body: message.body
//     });
//     console.log(message.sid)

// }

const admin = require('firebase-admin');
const serviceAccount = require('../../ruloans-87499-firebase-adminsdk-b6ke2-2f56000bf1.json'); // Replace with the path to your service account key JSON file
const Joi = require("joi");
const { SMPT_DIGISIGN, SMPT_DIGISIGN_PASSWORD, SMPT_HOST, SMPT_PORT_2, SMTP_USER_2, SMPT_PASSWORD_2, BACKEND_ACCESS_ROLES, SALES_ACCESS_ROLES } = require("./constantdata/config");

// Initialize the Firebase Admin SDK with the service account credentials
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // Replace 'your-project-id' with your Firebase project ID
    projectId: 'ruloans-87499',
});

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Builds a deduplicated CC email string.
 * @param {string} cc - Comma-separated emails from form/user input
 * @param {Object} options
 * @param {string[]} [options.add] - Emails to always include (e.g. ['cc@ruloans.com', userEmail])
 * @param {string[]} [options.remove] - Emails to exclude from result (e.g. [receiverEmail])
 * @returns {string} Comma-separated unique emails
 */
exports.buildCcEmailString = (cc, options = {}) => {
    const { add = [], remove = [] } = options;
    const normalizeEmail = (e) => (e || '').trim().toLowerCase();
    const ccSet = new Set();

    add.forEach((e) => {
        const n = normalizeEmail(e);
        if (n) ccSet.add(n);
    });

    const removeSet = new Set(remove.map(normalizeEmail).filter(Boolean));
    const fromForm = (cc || '').split(',').map(normalizeEmail).filter(Boolean);
    fromForm.forEach((email) => {
        if (!removeSet.has(email)) ccSet.add(email);
    });

    return [...ccSet].join(',');
};

exports.getProductInfo = (subProduct) => {
    const product = subProductMapping.find(item => item['Sub Product'] === subProduct);
    if (product) {
        return {
            Product_Group: product.Product_Group,
            Main_Product: product.Main_Product
        };
    } else {
        return null;
    }
}

exports.checkMasterRole = (role) => {
    let isMaster = false
    if (role === "CEO" || role === "CTO" || role == "CFO") {
        isMaster = true;
    }
    return isMaster
}

exports.isBackendAccessRole = (role) => {
    if (!role) return false;
    const backendRoles = (BACKEND_ACCESS_ROLES || "").split(",").map(r => r.trim()).filter(r => r.length > 0);
    return backendRoles.includes(role);
}
exports.isSalesAccessRole = (role) => {
    if (!role) return false;
    const salesRoles = (SALES_ACCESS_ROLES || "").split(",").map(r => r.trim()).filter(r => r.length > 0);
    return salesRoles.includes(role);
}

/**
 * Whether `value` matches one token in `listString` after splitting on commas and newlines and trimming entries.
 * @param {string|null|undefined} listString
 * @param {string|null|undefined} value
 * @returns {boolean}
 */
exports.isInCommaOrNewlineSeparatedList = (listString, value) => {
    if (listString == null || listString === "" || value == null || value === "") {
        return false;
    }
    const needle = String(value).trim();
    if (!needle) {
        return false;
    }
    const tokens = String(listString)
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
    return tokens.includes(needle);
};

/**
 * Parse a comma-separated string into trimmed non-empty string parts.
 * @param {string|number|null|undefined} value
 * @returns {string[]}
 */
exports.parseCommaSeparatedStrings = (value) => {
    const raw = (value ?? "").toString();
    return raw
        .split(",")
        .map((s) => (s || "").toString().trim())
        .filter((s) => s.length > 0);
};

exports.sendPushNotificationHelper = async function (deviceTokens, title, body, image, url) {
    imageUrl = image || "";
    url = url || "";
    // deviceTokens = ["dA9519NDSu2KDTVD1Zu-QI:APA91bHfsaAdUgJlNnGOVtact1gXCA9af5d2hKZDlBBrrbVvt93AeWZux3hOm5p420v2bhFB3PRrbpq2D6mlsgL5gutw0ccSc6adwXRTvOWhwVSgcJ3jaa3zVFQX9OubshCufVdGS8IG", "eBYxbSlyReibxom3yfMYq5:APA91bFLkwImu9jHJXjI6oGnA55iopf1LWFMh0GPLI7mVO2NEVm2ZFa9fDi7QhS_faw_UTz3lqaj3rLgn_CvK4OklXe5_vaK0dNq8BM1NEBsor3SYlo0COLSSq0rsX2Gak2JSWzUL0qm"];
    // deviceTokens = ["desIB_IzS525-aCddGH2N8:APA91bGOKMBjvaRdfp2Ugth_ESfTd61VtcTVSFaRj1klUhA6K7keZAFcucMNwI-w5loKcuOBOOGrGK_b6-B0qD0CrkQyTSRWHf-2oXfpKmXYn3DztNqs5fxecpj6LsGMqBLmVFbwp71H"];
    try {
        const message = {
            notification: {
                title: title,
                body: body,
                image: imageUrl,
            },
            data: {
                title: title,
                body: body,
                image: imageUrl,
                route: url,
            },
            token: deviceTokens,
        };

        console.log(message)

        const response = await admin.messaging().send(message);
        console.log(response);
    } catch (error) {
        console.error('Error sending push notification:', error);
    }
};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.FROM_EMAIL,
        pass: process.env.EMAIL_PASSWORD
    }
});

const transporter_smtp = nodemailer.createTransport({
    host: SMPT_HOST,
    port: SMPT_PORT_2,
    auth: {
        user: SMTP_USER_2,
        pass: SMPT_PASSWORD_2
    }
});

const transporterOpenSign = nodemailer.createTransport({
    host: process.env.SMPT_HOST,
    port: process.env.SMPT_PORT,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMPT_PASSWORD,
    },
});

const { getMailbox } = require('./inbound-mailbox');

// Banker-mailbox SMTP transport (the ZeptoMail relay). Built lazily and cached. `debug: true`
// is intentionally NOT set — it makes nodemailer log the base64 AUTH line (the app password)
// on every send.
let _bankerTransport;
const getBankerTransport = () => {
    if (_bankerTransport) return _bankerTransport;
    const mb = getMailbox();
    _bankerTransport = nodemailer.createTransport({
        host: mb.smtp.host,
        port: mb.smtp.port,
        secure: mb.smtp.secure,
        // auth can differ from the From address / IMAP login (ZeptoMail: "emailapikey" + token)
        auth: { user: mb.smtp.user || mb.email, pass: mb.smtp.pass || mb.password },
        logger: true,
    });
    return _bankerTransport;
};

// smtp.zoho.in drops a copy of every send into the mailbox's Sent
// folder server-side; a relay whose login isn't the mailbox itself (ZeptoMail:
// smtp.user = "emailapikey") does not. When that's the case we re-serialise the exact
// message and IMAP-APPEND it into Sent ourselves so "Fetch from Mailbox" / the mail
// trail shows the outbound before any banker reply arrives.
const relayFilesSentCopy = (mb) => !mb.smtp.user || mb.smtp.user === mb.email;

let _mimeCompiler;
const buildRawMime = async (mailOptions) => {
    if (!_mimeCompiler) {
        _mimeCompiler = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
    }
    const { message } = await _mimeCompiler.sendMail(mailOptions); // does not transmit
    return message; // Buffer, RFC822
};

const appendToMailboxSent = async (mailOptions, messageId) => {
    const mb = getMailbox();
    if (relayFilesSentCopy(mb)) return; // provider already filed it
    try {
        const raw = await buildRawMime({ ...mailOptions, messageId });
        const sentFolder = (mb.folders || []).find((f) => /sent/i.test(f)) || 'Sent';
        const { withImap } = require('../services/gmail-imap-manager');
        await withImap('appendSentCopy', (im) => im.append(sentFolder, raw, ['\\Seen']));
    } catch (err) {
        logger.warn(`banker Sent-copy append failed (${messageId}): ${err?.message}`);
    }
};

const sendEmailMain = (transporter, options, emailBody, isHtml) => {
    let mailOptions;
    if (isHtml) {
        mailOptions = {
            from: process.env.FROM_EMAIL,
            to: emailBody.to,
            subject: emailBody.subject,
            html: emailBody.body,
            ...options
        };
    } else {
        mailOptions = {
            from: process.env.FROM_EMAIL,
            to: emailBody.to,
            subject: emailBody.subject,
            text: emailBody.body
        };
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            logger.error(error);
        } else {
            logger.info('Email sent: ' + info.response);
        }
    });
};

/** CRM login OTP HTML — used by `sendOTPToEmail` in user controller (`otpTemplate` there is separate). Do not reuse for DSA email verification. */
exports.crmLoginOtpEmailTemplate = (otp, validityLabel = '2 minutes') => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Ruloans CRM OTP Verification</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color:#f4f7fa;">
  <table align="center" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7fa; padding:30px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="100%" style="max-width:500px; background:#ffffff; border-radius:10px; box-shadow:0 4px 15px rgba(0,0,0,0.08); overflow:hidden;">
          <tr>
           <td align="center" style="background-color:#666CFF; padding:20px;">
                <table cellpadding="0" cellspacing="0" border="0" style="display:inline-block;">
                  <tr>
                    <td>
                      <img src="https://crm.ruloans.com/images/logo.png" alt="Ruloans" width="40" style="display:block; vertical-align:middle;">
                    </td>
                    <td style="padding-left:10px;">
                      <span style="font-size:20px; font-weight:bold; color:#ffffff; font-family:Arial, sans-serif;">RULoans</span>
                    </td>
                  </tr>
                </table>
          <td>
          </tr>
          <tr>
            <td style="padding:30px; text-align:center;">
              <h1 style="margin:0; color:#333333; font-size:22px;">OTP Verification</h1>
              <p style="margin-top:10px; font-size:15px; color:#555555;">Please use the following OTP to complete your CRM verification. This OTP is valid for <strong>${validityLabel}</strong>.</p>
              <div style="margin:25px 0;">
                <span style="font-size:28px; letter-spacing:10px; font-weight:bold; color:#004aad;">${otp}</span>
              </div>
              <p style="font-size:14px; color:#777777; margin:0;">If you did not request this OTP, please ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f4f7fa; padding:20px; text-align:center; font-size:12px; color:#888888;">
              © ${new Date().getFullYear()} Ruloans Distribution Services Pvt. Ltd.<br>
              All Rights Reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/** DSA email verification OTP (ERP gate / send-dsa-email-verification-otp). Not used for CRM login. */
exports.dsaEmailVerificationOtpEmailTemplate = (otp, validityLabel = '10 minutes') => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>RULOANS — Email Verification OTP</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color:#f4f7fa;">
  <table align="center" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7fa; padding:30px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="100%" style="max-width:500px; background:#ffffff; border-radius:10px; box-shadow:0 4px 15px rgba(0,0,0,0.08); overflow:hidden;">
          <tr>
            <td align="center" style="background-color:#666CFF; padding:20px;">
              <table cellpadding="0" cellspacing="0" border="0" style="display:inline-block;">
                <tr>
                  <td>
                    <img src="https://crm.ruloans.com/images/logo.png" alt="RULOANS" width="40" style="display:block; vertical-align:middle;">
                  </td>
                  <td style="padding-left:10px;">
                    <span style="font-size:20px; font-weight:bold; color:#ffffff; font-family:Arial, sans-serif;">RULOANS</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:30px; text-align:center;">
              <h1 style="margin:0; color:#333333; font-size:22px;">Verify your email address</h1>
              <p style="margin-top:12px; font-size:15px; color:#555555; line-height:1.5;">
                You requested a one-time password (OTP) to verify your email on <strong>RULOANS</strong>.
                Enter the code below to complete verification. This OTP is valid for <strong>${validityLabel}</strong>.
              </p>
              <div style="margin:25px 0;">
                <span style="font-size:28px; letter-spacing:10px; font-weight:bold; color:#004aad;">${otp}</span>
              </div>
              <p style="font-size:14px; color:#777777; margin:0; line-height:1.5;">
                If you did not request this code, please ignore this email. Do not share this OTP with anyone.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f4f7fa; padding:20px; text-align:center; font-size:12px; color:#888888;">
              &copy; ${new Date().getFullYear()} RULOANS Distribution Services Pvt. Ltd.<br>
              All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

exports.sendEmail = function (emailBody, isHtml) {
    sendEmailMain(transporter, {}, emailBody, isHtml)
};

exports.sendEmailSmtp = function (emailBody, isHtml) {
    sendEmailMain(transporter_smtp, { from: process.env.SMTP_FROM_EMAIL }, emailBody, isHtml);
};

exports.sendEmailWithAttachment = function (attachments, emailBody, isHtml, cc) {
    let mailOptions;
    if (isHtml) {
        mailOptions = {
            from: process.env.SMTP_FROM_EMAIL,
            to: emailBody.to,
            attachments: attachments,
            subject: emailBody.subject,
            html: emailBody.body,
            cc: emailBody?.cc || ""
        };
        console.log(mailOptions)
    } else {
        mailOptions = {
            from: process.env.SMTP_FROM_EMAIL,
            to: emailBody.to,
            attachments: attachments,
            subject: emailBody.subject,
            text: emailBody.body
        };

    }
    console.log({
        user: SMTP_USER_2,
        from: process.env.SMTP_FROM_EMAIL
    })


    transporter_smtp.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error)
        } else {
            logger.info('Email sent: ' + info.response);
            console.log('Email sent: ' + info.response);
        }
    });
};
exports.invoiceSignEmail = function (attachments, emailBody, isHtml, cc) {
    let mailOptions;
    if (isHtml) {
        mailOptions = {
            from: process.env.SMPT_DIGISIGN_EMAIL,
            to: emailBody.to,
            attachments: attachments,
            subject: emailBody.subject,
            html: emailBody.body,
            cc: emailBody?.cc || ""
        };
        console.log(mailOptions)
    } else {
        mailOptions = {
            from: process.env.SMPT_DIGISIGN_EMAIL,
            to: emailBody.to,
            attachments: attachments,
            subject: emailBody.subject,
            text: emailBody.body
        };

    }

    transporterOpenSign.sendMail(mailOptions, function (error, info) {
        if (error) {
            logger.error(error);
        } else {
            logger.info('Email sent: ' + info.response);
            console.log('Email sent: ' + info.response);
        }
    });
};
exports.sendEmailWithAttachmentBanker = async function (attachments, emailBody, isHtml) {
    let mailOptions;

    // Every banker mail (new confirmation, resend, CRM reply) goes out from the one live
    // mailbox — INBOUND_EMAIL — through the SMTP relay.
    const fromAddress = getMailbox().email;

    if (isHtml) {
        mailOptions = {
            from: fromAddress,
            to: emailBody.to,
            attachments: attachments,
            subject: emailBody.subject,
            html: emailBody.body,
            cc: emailBody?.cc || ""
        };
    } else {
        mailOptions = {
            from: fromAddress,
            to: emailBody.to,
            attachments: attachments,
            subject: emailBody.subject,
            text: emailBody.body
        };
    }

    if (emailBody.inReplyTo) {
        mailOptions.inReplyTo = emailBody.inReplyTo;
        mailOptions.references = emailBody.references || emailBody.inReplyTo;
    }

    try {
        const info = await getBankerTransport().sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
        logger.info('Email sent: ' + info.response);
        let emails = emailBody?.cc?.split(",");
        const { setBankerEmailStatus } = require("../services/customer-services"); //temp fix for cirsular dependency
        await setBankerEmailStatus([emailBody?.to, ...emails], 0);
        // Keep the mailbox Sent folder complete when SMTP goes via a relay (ZeptoMail).
        await appendToMailboxSent(mailOptions, info.messageId);
        return {
            success: true,
            messageId: info.messageId || null,
            threadId: info.messageId || null,
            response: info.response || null
        };
    } catch (error) {
        console.error('Email failed for:', emailBody.to, error);
        logger.error(error);
        return {
            success: false,
            error: error?.message || 'Email send failed'
        };
    }
};

exports.sendSms = function (number, message) {
    let options = {
        'method': 'GET',
        'url': `https://api.textlocal.in/send/?apikey=${process.env.TEXT_LOCAL_API_KEY}&numbers=${number}&sender=RULOAN&message=${message}`,
        'headers': {
            'Cookie': 'PHPSESSID=sj1er7bdnum3ek14hq0tfmlbu3'
        },
        responseType: "text",
        validateStatus: () => true,
    };
    // console.log(options)
    axios(options)
        .then((response) => {
            console.log(response?.data);
        })
        .catch((error) => {
            throw new Error(error);
        });
};

exports.getSmsTemplate = async function () {
    let options = {
        'method': 'POST',
        url: 'https://api.textlocal.in/get_templates/',
        'headers': {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: `apikey=${process.env.TEXT_LOCAL_API_KEY}`
    }
    const response = await axios.request(options);

    return response.data
}


exports.uploadToS3 = async function (userId, file, t, ContentType, typ) {
    const { ACCESS_KEY_ID, SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET } = process.env;

    AWS.config.setPromisesDependency(require('bluebird'));
    AWS.config.update({ accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY, region: AWS_REGION });

    const s3 = new AWS.S3();

    const base64Data = new Buffer.from(file.replace(/^data:image\/\w+;base64,/, ""), 'base64');

    let type;
    if (typ) {
        type = typ;
    } else {
        type = file.split(';')[0].split('/')[1];
    }
    let k;
    if (!ContentType) {
        ContentType = `image/${type}`;
    }
    // console.log(type)
    if (ContentType == 'application/octet-stream') {
        k = `${userId}/${userId}_${t}.${typ}`;
    } else {
        k = `${userId}/${userId}_${t}.${type}`
    }
    const params = {
        Bucket: S3_BUCKET,
        Key: k, // type is not required
        Body: base64Data,
        ACL: 'public-read',
        ContentEncoding: 'base64', // required
        ContentType // required. Notice the back ticks
    }

    let location = '';
    let key = '';

    const { Location, Key } = await s3.upload(params).promise();
    location = Location;
    key = Key;


    return location;

};

function generateRandomFileName() {
    return randomstring.generate(20);
};

exports.deleteFromS3 = async function (fileUrlOrKey) {
    if (!fileUrlOrKey) return;
    try {
        const { ACCESS_KEY_ID, SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET } = process.env;
        AWS.config.setPromisesDependency(require('bluebird'));
        AWS.config.update({ accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY, region: AWS_REGION });

        const s3 = new AWS.S3();
        let key = fileUrlOrKey;
        if (fileUrlOrKey.includes('.amazonaws.com/')) {
            key = fileUrlOrKey.split('.amazonaws.com/')[1];
        } else if (fileUrlOrKey.includes('.com/')) {
            key = fileUrlOrKey.split('.com/')[1];
        }

        await s3.deleteObject({ Bucket: S3_BUCKET, Key: key }).promise();
    } catch (err) {
        console.warn('[S3] deleteFromS3 warning:', err.message);
    }
};

exports.uploadJsonToS3 = async function (data) {
    const { ACCESS_KEY_ID, SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET } = process.env;

    AWS.config.setPromisesDependency(require('bluebird'));
    AWS.config.update({ accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY, region: AWS_REGION });

    const s3 = new AWS.S3();
    const randomFileName = generateRandomFileName() + '.json';
    const params = {
        Bucket: S3_BUCKET,
        Key: `dashborard/lnt_${randomFileName}`,
        Body: JSON.stringify(data),
    };

    const { Location, Key } = await s3.upload(params).promise();
    return Location;
};

exports.uploadJsonToS3Incred = async function (data) {
    const { ACCESS_KEY_ID, SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET } = process.env;

    AWS.config.setPromisesDependency(require('bluebird'));
    AWS.config.update({ accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY, region: AWS_REGION });

    const s3 = new AWS.S3();
    const randomFileName = generateRandomFileName() + '.json';
    const params = {
        Bucket: S3_BUCKET,
        Key: `dashborard/incred_${randomFileName}`,
        Body: JSON.stringify(data),
    };

    const { Location, Key } = await s3.upload(params).promise();
    return Location;
};

exports.readSamplesFromS3 = async function (filename) {
    const { ACCESS_KEY_ID, SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET } = process.env;

    AWS.config.setPromisesDependency(require('bluebird'));
    AWS.config.update({ accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY, region: AWS_REGION });

    const s3 = new AWS.S3();
    const params = {
        Bucket: S3_BUCKET,
        Key: filename
    };
    try {
        await s3.headObject(params).promise();
        const link = s3.getSignedUrl('getObject', params)
        return { link: link };
    }
    catch (err) {
        return { err: err }
    }
}

exports.uploadJsonToS3FairCent = async function (data) {
    const { ACCESS_KEY_ID, SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET } = process.env;

    AWS.config.setPromisesDependency(require('bluebird'));
    AWS.config.update({ accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY, region: AWS_REGION });

    const s3 = new AWS.S3();
    const randomFileName = generateRandomFileName() + '.json';
    const params = {
        Bucket: S3_BUCKET,
        Key: `dashborard/faircent_${randomFileName}`,
        Body: JSON.stringify(data),
    };

    const { Location, Key } = await s3.upload(params).promise();
    return Location;
};

exports.readJsonFromS3 = async function (filename) {
    const { ACCESS_KEY_ID, SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET } = process.env;

    AWS.config.setPromisesDependency(require('bluebird'));
    AWS.config.update({ accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY, region: AWS_REGION });

    const s3 = new AWS.S3();
    const params = {
        Bucket: S3_BUCKET,
        Key: filename.split('.com/')[1],
    };

    const data = await s3.getObject(params).promise();
    const jsonContent = data.Body.toString('utf-8');
    const jsonData = JSON.parse(jsonContent);
    return jsonData;
};

exports.removeSpecialCharacter = function (string) {
    let finalString = string.replace(/[^a-zA-Z ]/g, "");
    return finalString;
};

exports.asyncForEach = async (array, callback) => {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array)
    }
};

exports.asyncForEachObject = async (array, callback) => {
    for (const [key, value] of Object.entries(array)) {
        await callback(key, value, array)

    }
};

exports.minuteDiffence = (date1, date2) => {
    let diffMs = (date1 - date2);
    let diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000);
    return diffMins;
};

exports.getDate = (date) => {
    if (date) {
        date = date.toDateString().split("T");
        return date[0];
    }
    return "";
};

exports.capitalizeFLetter = (input) => {
    return input.replace(/^./, input[0].toUpperCase());
};

exports.getUniqueKeys = (array, keyName) => {
    let flags = [], output = [], l = array.length, i;
    for (i = 0; i < l; i++) {
        if (flags[array[i][keyName]]) continue;
        flags[array[i][keyName]] = true;
        output.push(array[i][keyName]);
    }
    return output;
};

exports.createMeetingString = (meetingSeetings) => {
    let meetingSettingsString = "";
    if (meetingSeetings.length) {
        for (let i = 0; i < meetingSeetings.length; i++) {
            let key = meetingSeetings[i].setting_name;
            let val = meetingSeetings[i].setting_value;
            meetingSettingsString += '&' + key + '=' + val;
        }
    }
    return meetingSettingsString;
};

exports.comparer = (list1, list2, isUnion) => {
    let result = [];

    for (let i = 0; i < list1.length; i++) {
        let item1 = list1[i],
            found = false;
        for (let j = 0; j < list2.length && !found; j++) {
            found = "F" + item1.event_booth_id === list2[j].meetingID;
            if (found) {
                item1.participantCount = list2[j].participantCount;
            } else {
                item1.participantCount = 0;
            }
        }
        // if (found === !!isUnion) { // isUnion is coerced to boolean
        result.push(item1);
        // }
    }
    return result;
};

exports.comparerDate = (list1, list2, isUnion) => {

    for (let j = 0; j < list2.length; j++) {
        // let date = new Date(new Date(list2[j].date).getTime() + (ISTOffset + currentOffset) * 60000).getDate().toString();
        // let startTime = new Date(new Date(list2[j].date).getTime() + (ISTOffset + currentOffset) * 60000).getHours();
        // let endTime = new Date(new Date(list2[j].date_end).getTime() + (ISTOffset + currentOffset) * 60000).getHours();
        // list1 = list1.filter(dataList1 =>
        //     ((dataList1.getDate().toString() == date) && ((dataList1.getHours() >= + startTime) && (dataList1.getHours() <= + endTime))));
        let startDate = new Date(new Date(list2[j].date).getTime() + (ISTOffset + currentOffset) * 60000);
        let endDate = new Date(new Date(list2[j].date_end).getTime() + (ISTOffset + currentOffset) * 60000);
        list1 = list1.filter(dataList1 => {
            let timeNow = dataList1;
            if ((timeNow.getDate() == startDate.getDate()) && (timeNow.getTime() >= startDate.getTime() && timeNow.getTime() <= endDate.getTime())) {
                return false;
            } else {
                return true;
            }

        }
        )
    }
    list1 = list1.map(data => {
        data = moment(data).format("DD-MMM-YYYY HH:mm:ss");
        return data;
    })

    return list1;
};

exports.differenceInseconds = (startTime, endTime) => {
    let result = [];

    let duration = moment.duration(endTime.diff(startTime));
    return duration;
};

exports.isValidDateTimeFn = (data) => {
    let curDate = new Date();
    let eventDate = this.getDate(data.event_date);
    let startDate = new Date(eventDate + " " + data.start_time);
    let endDate = new Date(eventDate + " " + data.end_time);
    if (endDate >= curDate) {
        this.isEventCompleted = false;
    } else {
        this.isEventCompleted = true;

    }
    if ((startDate <= curDate) && (endDate >= curDate)) {
        return true;
    } else {
        return false
    }
};

exports.getDateArray = (startDate, endDate, addFn, interval) => {
    addFn = addFn || Date.prototype.addDays;
    interval = interval || 1;

    let retVal = [];
    let current = new Date(new Date(startDate.getTime() + (ISTOffset + currentOffset) * 60000).setHours(0, 0, 0));

    while (current <= endDate) {
        retVal.push(new Date(current.getTime() + (ISTOffset + currentOffset) * 60000));
        current = addFn.call(current, interval);
    }

    return retVal;
};

Date.prototype.addHours = function (h) {
    this.setTime(this.getTime() + (h * 60 * 60 * 1000));
    return this;
};


exports.isValidClaimMonth = (claimMonth, ref_id, is_contest = false) => {
    // Current date
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth(); // 0-based index for month
    const currentYear = currentDate.getFullYear();
    const lastDayOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const isInLastThreeDays = currentDate.getDate() >= lastDayOfCurrentMonth - 2;

    // Parse claimMonth (e.g., "Jan 2024")
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const [claimMonthStr, claimYearStr] = claimMonth.split(" ");
    const claimMonthIndex = monthNames.indexOf(claimMonthStr);
    const claimYear = parseInt(claimYearStr);

    if (claimMonthIndex === -1 || isNaN(claimYear)) {
        return false;
    }

    // Calculate last month and its year
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    // Check if the claim month and year match the previous month and year
    if (claimMonthIndex === lastMonth && claimYear === lastMonthYear) {
        return true;
    }

    // Check if the claim month and year match the current month and year and it's the last three days
    if (isInLastThreeDays && claimMonthIndex === currentMonth && claimYear === currentYear) {
        return true;
    }

    // For contest claims, allow current month even if not in last three days
    if (is_contest && claimMonthIndex === currentMonth && claimYear === currentYear) {
        return true;
    }

    if (ref_id) {
        if (isInLastThreeDays && claimMonthIndex === currentMonth && claimYear === currentYear) {
            return true;
        }
        if (claimYear <= currentYear && (claimYear < currentYear || claimMonthIndex < currentMonth)) {
            return true
        }
    }

    return false;
};

exports.isUuid = (id) => {
    let patt = new RegExp("[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}");
    return patt.test(id);
};

exports.pdf2base64 = (file) => {
    return pdf2base64(file)
        .then(
            (response) => {
                return ({ status: 200, response: response }); //cGF0aC90by9maWxlLmpwZw==
            }
        )
        .catch(
            (error) => {
                return ({ status: 500, response: error });                //Exepection error....
            }
        )
};

exports.compareArrayObject = (otherArray) => {
    return function (current) {
        return otherArray.filter(function (other) {
            return other.session_name == current.session_name
        }).length == 0;
    }
};

exports.objectToQueryString = (obj) => {
    let str = [];
    for (let p in obj)
        if (obj.hasOwnProperty(p)) {
            str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
        }
    return str.join("&");
};


exports.LOAN_PATTERN = {
    "9905:216": ["^.{15}$"],
    "9905:208": ["^.{15}$", "^.{15}$"],
    "9894:207": ["^[A-Za-z]{7}\\d{10}$"],
    "9894:306": ["^[A-Za-z]{7}\\d{10}$"],
    "9894:305": ["^[A-Za-z]{7}\\d{10}$"],
    "9894:313": ["^[A-Za-z]{7}\\d{10}$"],
    "9894:303": ["^[A-Za-z]{7}\\d{10}$"],
    "9894:209": ["^[A-Za-z]{7}\\d{10}$"],
    "9894:206": ["^[A-Za-z]{7}\\d{10}$"],
    "9905:207": ["^.{15}$"],
    "9805:208": ["^.{9}$", "^.{8}$"],
    "9805:209": ["^.{9}$"],
    "9805:224": ["^.{9}$"],
    "9805:215": ["^.{9}$", "^.{12}$"],
    "9805:206": ["^.{9}$"],
    "9805:237": ["^.{9}$"],
    "9746:208": ["^.{14}$"],
    "9793:225": ["^.{11}$", "^.{13}$"],
    "9782:215": ["^.{10}$"],
    "9740:208": ["^[A-Za-z]\\d{16}$"],
    "9740:209": ["^[A-Za-z]\\d{16}$"],
    "9744:206": ["^[A-Za-z0-9]{3}\\d{12}$"],
    "9744:215": ["^[A-Za-z0-9]{3}\\d{12}$"],
    "28243:234": ["^\\d{10}$"],
    "28243:259": ["^\\d{10}$"],
    "28243:208": ["^\\d{10}$"],
    "28243:209": ["^\\d{10}$"],
    "28243:224": ["^\\d{10}$"],
    "28243:232": ["^\\d{10}$"],
    "28971:208": ["^\\d{15}$"],
    "28971:209": ["^\\d{15}$"],
    "9884:208": ["^\\d{11}$"],
    "9884:209": ["^\\d{11}$"],
    "9748:208": ["^\\d{11}$"],
    "9748:209": ["^\\d{11}$"],
    "9747:208": ["^\\d{14}$", "^[A-Za-z]{6}-\\d{11}-[A-Za-z]{3}$"],
    "9747:209": ["^\\d{14}$", "^[A-Za-z]{6}-\\d{11}-[A-Za-z]{3}$"],
    "28257:215": ["^.{20}$"],
    "9905:215": ["^.{15}$"],
    "9905:206": ["^.{15}$"],
    "9905:271": ["^.{15}$"],
    "9905:209": ["^.{15}$"],
    "9905:233": ["^.{16}$"],
    "9905:224": ["^.{15}$"],
    "9888:208": ["^.{21}$"],
    "9888:209": ["^.{21}$"],
    "488806:721": ["^.{21}$"],
    "488806:209": ["^.{21}$"],
    "488806:206": ["^.{21}$"],
    "488806:237": ["^.{8}$"],
    "488806:223": ["^.{21}$"],
    "488806:615": ["^.{8}$"],
    "488806:215": ["^.{21}$"],
    "488806:291": ["^.{8}$"],
    "9760:209": ["^.{16}$", "^.{18}$"],
    "9760:208": ["^.{16}$"],
    "9780:264": ["^.{16}$"],
    "9780:209": ["^.{16}$", "^\\d{6}$"],
    "9781:208": ["^\\d{15}$", "^\\d{14}$", "^\\d{22}$"],
    "9825:208": ["^.{10}$"],
    "9725:208": ["^\\d{9}$"],
    "9726:208": ["^.{20}$", "^.{15}$"],
    "9726:209": ["^.{20}$", "^.{15}$"],
    "9725:209": ["^\\d{9}$"],
    "9825:287": ["^.{10}$"],
    "9825:231": ["^.{11}$"],
    "9825:209": ["^.{11}$"],
    "411568:208": ["^.{15}$"],
    "9792:232": ["^.{9}$"],
    "9792:224": ["^.{9}$"],
    "9821:216": ["^.{14}$"],
    "9821:208": ["^.{14}$"],
    "28640:206": ["^.{13}$"],
    "9929:208": ["^.{13}$"],
    "30238:208": ["^.{22}$"],
    "30238:209": ["^.{22}$"],
    "9901:208": ["^.{15}$"],
    "9901:209": ["^.{15}$"],
    "9857:224": ["^.{13}$"],
    "9742:232": ["^.{15}$"],
    "9742:224": ["^.{15}$"],
    "9792:206": ["^.{9}$"],
    "9792:271": ["^.{9}$"],
    "9792:215": ["^.{9}$"],
    "9792:639": ["^.{9}$"],
    "9792:636": ["^.{9}$"],
    "9792:270": ["^.{9}$"],
    "9792:246": ["^.{9}$"],
    "9803:230": ["^.{16}$"],
    "9803:209": ["^.{16}$"],
    "1180272:215": ["^.{17}$"],
    "9803:208": ["^.{16}$"],
    "9803:1224": ["^.{16}$"],
    "28140:215": ["^.{7}$"],
    "9803:231": ["^.{16}$"],
    "9803:634": ["^.{16}$"],
    "9803:215": ["^.{9}$", "^.{8}$", "^.{12}$"],
    "9803:1227": ["^.{16}$"],
    "9803:1228": ["^.{16}$"],
    "9803:206": ["^.{16}$"],
    "9803:239": ["^.{16}$"],
};

exports.LOS_PATTERN = {
    "9905:216": ["^.{7}$"],
    "9905:208": ["^.{7}$"],
    "9894:207": ["^[A-Za-z]{7}\\d{10}$"],
    "9894:306": ["^[A-Za-z]{7}\\d{10}$"],
    "9894:305": ["^[A-Za-z]{7}\\d{10}$"],
    "9894:313": ["^[A-Za-z]{7}\\d{10}$"],
    "9894:303": ["^[A-Za-z]{7}\\d{10}$"],
    "9894:209": ["^[A-Za-z]{7}\\d{10}$"],
    "9894:206": ["^[A-Za-z]{7}\\d{10}$"],
    "28243:234": ["^\\d{10}$"],
    "28243:259": ["^\\d{10}$"],
    "28243:208": ["^\\d{10}$"],
    "28243:209": ["^\\d{10}$"],
    "28243:224": ["^\\d{10}$"],
    "28243:232": ["^\\d{10}$"],
    "28971:208": ["^\\d{15}$"],
    "28971:209": ["^\\d{15}$"],
    "9884:208": ["^\\d{11}$"],
    "9884:209": ["^\\d{11}$"],
    "9748:208": ["^\\d{11}$"],
    "9748:209": ["^\\d{11}$"],
    "9747:208": ["^\\d{14}$", "^[A-Za-z]{6}-\\d{11}-[A-Za-z]{3}$"],
    "9747:209": ["^\\d{14}$", "^[A-Za-z]{6}-\\d{11}-[A-Za-z]{3}$"],
    "9905:207": ["^.{7}$"],
    "9805:208": ["^.{9}$"],
    "9805:209": ["^.{9}$"],
    "9805:224": ["^.{9}$"],
    "9805:215": ["^.{9}$", "^.{12}$"],
    "9805:206": ["^.{9}$"],
    "9805:237": ["^.{9}$"],
    "9746:208": ["^[A-Za-z]{3}\\d{12}$"],
    "9793:225": ["^.{11}$", "^.{13}$"],
    "9782:215": ["^.{10}$"],
    "9740:208": ["^[A-Za-z]\\d{16}$"],
    "9740:209": ["^[A-Za-z]\\d{16}$"],
    "9744:206": ["^[A-Za-z0-9]{3}\\d{12}$"],
    "9744:215": ["^[A-Za-z0-9]{3}\\d{12}$"],
    "28257:215": ["^.{20}$"],
    "9905:215": ["^.{15}$"],
    "9905:206": ["^.{15}$"],
    "9905:271": ["^.{15}$"],
    "9905:209": ["^.{7}$"],
    "9905:233": ["^.{8}$"],
    "9905:224": ["^.{15}$"],
    "9888:208": ["^.{21}$"],
    "9888:209": ["^.{21}$"],
    "488806:721": ["^.{21}$"],
    "488806:209": ["^.{21}$"],
    "488806:206": ["^.{21}$"],
    "488806:223": ["^.{21}$"],
    "488806:237": ["^.{8}$"],
    "488806:615": ["^.{8}$"],
    "488806:215": ["^.{21}$"],
    "488806:291": ["^.{8}$"],
    "9760:209": ["^.{8}$", "^.{18}$"],
    "9760:208": ["^.{8}$"],
    "9780:264": ["^.{16}$"],
    "9780:209": ["^.{16}$", "^[a-zA-Z]{9}\\d{7}$"],
    "9781:208": ["^\\d{15}$", "^\\d{22}$"],
    "9825:208": ["^.{10}$"],
    "9825:287": ["^.{10}$"],
    "9825:231": ["^.{11}$"],
    "9825:209": ["^.{11}$"],
    "9725:208": ["^\\d{9}$"],
    "9725:209": ["^\\d{9}$"],
    "9726:208": ["^.{20}$", "^.{15}$"],
    "9726:209": ["^.{20}$", "^.{15}$"],
    "411568:208": ["^.{15}$"],
    "9792:232": ["^.{9}$"],
    "9792:224": ["^.{9}$"],
    "9821:216": ["^.{15}$"],
    "9821:208": ["^.{15}$"],
    "28640:206": ["^.{13}$"],
    "9929:208": ["^.{7}$"],
    "9804:230": ["^.{16}$"],
    "30238:208": ["^.{12}$"],
    "30238:209": ["^.{12}$"],
    "9901:208": ["^.{15}$"],
    "9901:209": ["^.{15}$"],
    "9857:224": ["^.{13}$"],
    "9742:232": ["^.{8}$"],
    "9742:224": ["^.{8}$"],
    "9792:206": ["^.{9}$"],
    "9792:271": ["^.{9}$"],
    "9792:215": ["^.{9}$"],
    "28140:215": ["^.{7}$"],
    "1180272:215": ["^.{17}$"],
    "9792:639": ["^.{9}$"],
    "9792:636": ["^.{9}$"],
    "9792:270": ["^.{9}$"],
    "9792:246": ["^.{9}$"],
    "9803:230": ["^.{11}$", "^.{10}$"],
    "9803:209": ["^.{11}$", "^.{10}$"],
    "9803:208": ["^.{11}$", "^.{10}$"],
    "9803:1224": ["^.{11}$", "^.{10}$"],
    "9803:231": ["^.{11}$", "^.{10}$"],
    "9803:634": ["^.{9}$", "^.{8}$", "^.{12}$"],
    "9803:215": ["^.{9}$", "^.{8}$", "^.{12}$"],
    "9803:1227": ["^.{9}$", "^.{8}$", "^.{12}$"],
    "9803:1228": ["^.{9}$", "^.{8}$", "^.{12}$"],
    "9803:206": ["^.{9}$", "^.{8}$"],
    "9803:239": ["^.{9}$", "^.{8}$", "^.{12}$"]
};

exports.BANK_PRODUCT_LOCK = {
    '9793': ['225'],
    '823343': ['289'],
    '81447': ['289'],
    '153159': ['289'],
    '881892': ['289'],
    '9758': ['717'],
    '904136': ['717'],
    '9882': ['717'],
    '28249': ['290'],
    '9795': ['290'],
    '31950': ['290'],
    '9862': ['290'],
};

exports.renderLogMessage = (data) => {
    let { user_name, lead_first_name, lead_last_name, type, to_value, from_value, operation_type } = data;
    let renderTemplate = {
        'lead-create': ` ${user_name} created lead ${lead_first_name} ${lead_last_name} `,
        'lead-details-create': ` ${user_name} added details for lead ${lead_first_name} ${lead_last_name} `,
        'lead-details-update': ` ${user_name} updated details value ${type}: from ${from_value} -> ${to_value} lead ${lead_first_name} ${lead_last_name} `,
        'lead-home-address-create': `${user_name} added home address for lead ${lead_first_name} ${lead_last_name} `,
        'lead-additional-information-create': `${user_name} added additional infromation for lead ${lead_first_name} ${lead_last_name} `,
        'lead-business-address-create': `${user_name} added buisness address for lead ${lead_first_name} ${lead_last_name} `,
        'lead-home-address-update': `${user_name} updated home address value ${type}: from ${from_value} -> ${to_value} for lead ${lead_first_name} ${lead_last_name} `,
        'lead-additional-information-update': `${user_name} updated additional information value ${type}: from ${from_value} -> ${to_value} for lead ${lead_first_name} ${lead_last_name} `,
        'lead-buisness-address-update': `${user_name} updated buisness address value ${type}: from ${from_value} -> ${to_value} for lead ${lead_first_name} ${lead_last_name} `,
        'lead-assigned-to-changed': `${user_name} updated assigned_to : from ${from_value} -> ${to_value} for lead ${lead_first_name} ${lead_last_name} `,
        'lead-comment-create': `${user_name} created comment: from ${from_value} ->for lead ${lead_first_name} ${lead_last_name} `,
        'call-log-create': `${user_name} created call_logs: remark-> ${from_value} ->with status-> ${to_value} for lead ${lead_first_name} ${lead_last_name} `,
        'updated-assigned-to': `${user_name} updated assign to from ${from_value} -> ${to_value} for lead ${lead_first_name} ${lead_last_name} `,
    }
    return renderTemplate[operation_type];
};

exports.uploadArrayToS3 = async (array, name, file_type = null) => {
    let fileName;
    try {

        const { ACCESS_KEY_ID, SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET } = process.env;

        AWS.config.setPromisesDependency(require('bluebird'));
        AWS.config.update({ accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY, region: AWS_REGION });
        fileName = `${name || "result_lead_claim_upload"}_${generateRandomFileName()}.xlsx`;
        // Create an XLSX workbook and add a worksheet
        const workbook = xlsx.utils.book_new();
        if (array.length == 0) {
            array.push({ 'No Data Present': '' })
        }
        const worksheet = xlsx.utils.json_to_sheet(array, { header: Object.keys(array[0]) }); // Use the keys of the first object as column headers


        // Add the worksheet to the workbook
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

        // Save the workbook to a file
        xlsx.writeFile(workbook, fileName, { bookType: file_type || "xlsx" });

        // Upload the XLSX file to S3
        const s3 = new AWS.S3();
        const uploadParams = {
            Bucket: S3_BUCKET,
            Key: `excel_data/${fileName}`,
            Body: fs.createReadStream(fileName),
        };

        const s3UploadResult = await s3.upload(uploadParams).promise();

        // Get the S3 file location
        const s3FileLocation = s3UploadResult.Location;

        // Log the S3 file location or perform any other necessary actions
        console.log('File uploaded to S3:', s3FileLocation);

        // Cleanup: Delete the local XLSX file
        fs.unlinkSync(fileName);

        return s3FileLocation;
    } catch (error) {
        console.log(error)
        if (fileName && fs.existsSync(fileName)) {
            fs.unlinkSync(fileName);
        }
        console.error('Error uploading array to S3:', error);
        throw error;
    }
}

exports.stateCodes = {
    'JAMMU AND KASHMIR': '01',
    'HIMACHAL PRADESH': '02',
    'PUNJAB': '03',
    'CHANDIGARH': '04',
    'UTTARAKHAND': '05',
    'HARYANA': '06',
    'DELHI': '07',
    'RAJASTHAN': '08',
    'UTTAR PRADESH': '09',
    'BIHAR': '10',
    'SIKKIM': '11',
    'ARUNACHAL PRADESH': '12',
    'NAGALAND': '13',
    'MANIPUR': '14',
    'MIZORAM': '15',
    'TRIPURA': '16',
    'MEGHALAYA': '17',
    'ASSAM': '18',
    'WEST BENGAL': '19',
    'JHARKHAND': '20',
    'ODISHA': '21',
    'CHATTISGARH': '22',
    'MADHYA PRADESH': '23',
    'GUJARAT': '24',
    'DADRA AND NAGAR HAVELI AND DAMAN AND DIU (NEWLY MERGED UT)': '26*',
    'MAHARASHTRA': '27',
    'ANDHRA PRADESH(BEFORE DIVISION)': '28',
    'KARNATAKA': '29',
    'GOA': '30',
    'LAKSHADWEEP': '31',
    'KERALA': '32',
    'TAMIL NADU': '33',
    'PUDUCHERRY': '34',
    'ANDAMAN AND NICOBAR ISLANDS': '35',
    'TELANGANA': '36',
    'ANDHRA PRADESH (NEWLY ADDED)': '37',
    'LADAKH (NEWLY ADDED)': '38',
    'OTHER TERRITORY': '97',
    'CENTRE JURISDICTION': '99'
};


exports.jsonDifference = (obj1, obj2) => {
    let keys1 = Object.keys(obj1);
    let keys2 = Object.keys(obj2);
    let commonKeys = keys1.filter(key => keys2.includes(key) && obj1[key] !== obj2[key]);

    let ans = commonKeys.map(key => [key, obj1[key], obj2[key]]);
    return ans;
};

exports.jsonDifferenceForNestedObjects = (obj1, obj2) => {
    const getDifferences = (o1, o2, path = "") => {
        if (typeof o1 !== "object" || typeof o2 !== "object" || o1 === null || o2 === null) {
            return o1 !== o2 ? [[path, o1, o2]] : [];
        }

        if (Array.isArray(o1) && Array.isArray(o2)) {
            let differences = [];
            for (let i = 0; i < Math.max(o1.length, o2.length); i++) {
                differences.push(...getDifferences(o1[i], o2[i], `${path}[${i}]`));
            }
            return differences;
        }

        let diff = [];
        const allKeys = new Set([...Object.keys(o1), ...Object.keys(o2)]);
        allKeys.forEach((key) => {
            // Simplifying the path by checking if it contains 'customer_incomes' or 'customer_addresses' and removing it
            let simplifiedKey = path ? `${path}.${key}` : key;
            simplifiedKey = simplifiedKey.replace(/customer_incomes\[\d+\]\./g, "").replace(/customer_addresses\[\d+\]\./g, "");

            diff.push(...getDifferences(o1[key], o2[key], simplifiedKey));
        });

        return diff;
    };

    let differences = getDifferences(obj1, obj2);
    return differences.map(diff => {
        const [field, oldValue, newValue] = diff;
        // Stripping the array index and part of the path if it contains 'customer_incomes' or 'customer_addresses'
        const simplifiedField = field.replace(/customer_incomes\[\d+\]\./g, "").replace(/customer_addresses\[\d+\]\./g, "");
        return [simplifiedField, oldValue, newValue];
    });
};

exports.getDsaMobileNumbers = (data) => {
    return data.map(item => item.dsa_mobile_number);
};

const getSumByKey = (arr, key) => {
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
        if (!isNaN(parseInt(arr[i][key]))) sum += parseInt(arr[i][key]);
    }
    return sum;
    //return arr.reduce((accumulator, current) => accumulator + Number(current[key]), 0)
};

exports.mergeLntChilds = async (array1, array2, i) => {
    try {
        return new Promise(resolve => {
            let j = 0;
            const mergedArray = array1.map(item => {
                let childs = array2.filter(data => data.parent === item.phone);
                return {
                    ...item,
                    childs,
                    total_disbursed_amount: isNaN(parseInt(item.total_disbursed_amount)) ? getSumByKey(childs, 'total_disbursed_amount') : parseInt(item.total_disbursed_amount) + getSumByKey(childs, 'total_disbursed_amount'),
                    "total_rejected": isNaN(parseInt(item.total_rejected)) ? getSumByKey(childs, 'total_rejected') : parseInt(item.total_rejected) + getSumByKey(childs, 'total_rejected'),
                    "total_disbursed": isNaN(parseInt(item.total_disbursed)) ? getSumByKey(childs, 'total_disbursed') : parseInt(item.total_disbursed) + getSumByKey(childs, 'total_disbursed'),
                    "total_approved": isNaN(parseInt(item.total_approved)) ? getSumByKey(childs, 'total_approved') : parseInt(item.total_approved) + getSumByKey(childs, 'total_approved'),
                    "total_in_progress": isNaN(parseInt(item.total_in_progress)) ? getSumByKey(childs, 'total_in_progress') : parseInt(item.total_in_progress) + getSumByKey(childs, 'total_in_progress'),
                    "total_approved_amount": isNaN(parseInt(item.total_approved_amount)) ? getSumByKey(childs, 'total_approved_amount') : parseInt(item.total_approved_amount) + getSumByKey(childs, 'total_approved_amount'),
                };
                // if (i === 2) {
                //     return {
                //         ...item,
                //         total_disbursed_amount: isNaN(parseInt(item.total_disbursed_amount)) ? getSumByKey(childs, 'total_disbursed_amount') : parseInt(item.total_disbursed_amount) + getSumByKey(childs, 'total_disbursed_amount'),
                //         "total_rejected": isNaN(parseInt(item.total_rejected)) ? getSumByKey(childs, 'total_rejected') : parseInt(item.total_rejected) + getSumByKey(childs, 'total_rejected'),
                //         "total_disbursed": isNaN(parseInt(item.total_disbursed)) ? getSumByKey(childs, 'total_disbursed') : parseInt(item.total_disbursed) + getSumByKey(childs, 'total_disbursed'),
                //         "total_approved": isNaN(parseInt(item.total_approved)) ? getSumByKey(childs, 'total_approved') : parseInt(item.total_approved) + getSumByKey(childs, 'total_approved'),
                //         "total_in_progress": isNaN(parseInt(item.total_in_progress)) ? getSumByKey(childs, 'total_in_progress') : parseInt(item.total_in_progress) + getSumByKey(childs, 'total_in_progress'),
                //     };
                // } else {
                //     return {
                //         ...item,
                //         childs,
                //         total_disbursed_amount: isNaN(parseInt(item.total_disbursed_amount)) ? getSumByKey(childs, 'total_disbursed_amount') : parseInt(item.total_disbursed_amount) + getSumByKey(childs, 'total_disbursed_amount'),
                //         "total_rejected": isNaN(parseInt(item.total_rejected)) ? getSumByKey(childs, 'total_rejected') : parseInt(item.total_rejected) + getSumByKey(childs, 'total_rejected'),
                //         "total_disbursed": isNaN(parseInt(item.total_disbursed)) ? getSumByKey(childs, 'total_disbursed') : parseInt(item.total_disbursed) + getSumByKey(childs, 'total_disbursed'),
                //         "total_approved": isNaN(parseInt(item.total_approved)) ? getSumByKey(childs, 'total_approved') : parseInt(item.total_approved) + getSumByKey(childs, 'total_approved'),
                //         "total_in_progress": isNaN(parseInt(item.total_in_progress)) ? getSumByKey(childs, 'total_in_progress') : parseInt(item.total_in_progress) + getSumByKey(childs, 'total_in_progress'),
                //     };
                // }
            });

            resolve(mergedArray);

        });
    } catch (err) {
        console.log("Merge Childs 1", i)
    }
};

exports.mergeCibilChilds = async (array1, array2, i) => {
    return new Promise(resolve => {
        const mergedArray = array1.map(item => {
            let childs = array2.filter(data => data.parent === item.phone);
            return {
                ...item,
                childs,
                total_cibil_processed: isNaN(parseInt(item.total_cibil_processed)) ? getSumByKey(childs, 'total_cibil_processed') : parseInt(item.total_cibil_processed) + getSumByKey(childs, 'total_cibil_processed'),
            };
        });

        resolve(mergedArray);
    });
};

exports.mergeIndifiChilds = (array1, array2) => {
    return array1.map(item => {
        let childs = array2.filter(data => data.parent == item.phone);
        return {
            ...item, childs,
            total_disbursed_amount: isNaN(parseInt(item.total_disbursed_amount)) ? getSumByKey(childs, 'total_disbursed_amount') : parseInt(item.total_disbursed_amount) + getSumByKey(childs, 'total_disbursed_amount'),
            "total_rejected": isNaN(parseInt(item.total_rejected)) ? getSumByKey(childs, 'total_rejected') : parseInt(item.total_rejected) + getSumByKey(childs, 'total_rejected'),
            "total_basic_details_captured": isNaN(parseInt(item.total_basic_details_captured)) ? getSumByKey(childs, 'total_basic_details_captured') : parseInt(item.total_basic_details_captured) + getSumByKey(childs, 'total_basic_details_captured'),
            "total_consent_signed": isNaN(parseInt(item.total_consent_signed)) ? getSumByKey(childs, 'total_consent_signed') : parseInt(item.total_consent_signed) + getSumByKey(childs, 'total_consent_signed'),
            "total_disbursed": isNaN(parseInt(item.total_disbursed)) ? getSumByKey(childs, 'total_disbursed') : parseInt(item.total_disbursed) + getSumByKey(childs, 'total_disbursed'),
            "total_pending": isNaN(parseInt(item.total_pending)) ? getSumByKey(childs, 'total_pending') : parseInt(item.total_pending) + getSumByKey(childs, 'total_pending'),
            "total_promoter_details_captured": isNaN(parseInt(item.total_promoter_details_captured)) ? getSumByKey(childs, 'total_promoter_details_captured') : parseInt(item.total_promoter_details_captured) + getSumByKey(childs, 'total_promoter_details_captured'),
            "total_loan_details_saved": isNaN(parseInt(item.total_loan_details_saved)) ? getSumByKey(childs, 'total_loan_details_saved') : parseInt(item.total_loan_details_saved) + getSumByKey(childs, 'total_loan_details_saved'),
        }
    });
};

exports.mergeBajaCreditCardChilds = (array1, array2) => {
    return array1.map(item => {
        let childs = array2.filter(data => data.parent == item.phone);
        return {
            ...item, childs,
            "total_rejected": item.total_rejected + getSumByKey(childs, 'total_rejected'),
            "total_pending": item.total_pending + getSumByKey(childs, 'total_pending'),
            "total_approved": item.total_approved + getSumByKey(childs, 'total_approved'),
            "total_consent_signed": item.total_consent_signed + getSumByKey(childs, 'total_consent_signed'),
            "total_basic_detail_saved": item.total_basic_detail_saved + getSumByKey(childs, 'total_basic_detail_saved'),
            "total_in_progress": isNaN(parseInt(item.total_in_progress)) ? getSumByKey(childs, 'total_in_progress') : parseInt(item.total_in_progress) + getSumByKey(childs, 'total_in_progress'),
        }
    });
};

// exports.sortDSATreeArray = (array) => {
//     let treeArray =
//     return array.map(item => {

//         return {
//             ...item, childs,
//             total_disbursed_amount: item.total_disbursed_amount + getSumByKey(childs, 'total_disbursed_amount'),
//             "total_rejected": item.total_rejected + getSumByKey(childs, 'total_rejected'),
//             "total_disbursed": item.total_disbursed + getSumByKey(childs, 'total_disbursed'),
//             "total_approved": item.total_approved + getSumByKey(childs, 'total_approved'),
//             "total_in_progress": item.total_in_progress + getSumByKey(childs, 'total_in_progress'),
//         }
//     });
// }

exports.validURL = (str) => {
    let expression = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi;
    let regex = new RegExp(expression);
    return Boolean(str?.match(regex)?.length);
};

exports.getAllDSA = (array, type = "default") => {
    const uniqueArray = [];
    const uniquePhones = new Set();

    array.forEach((item) => {
        for (let i = 1; i <= 10; i++) {
            const dsa = item[`dsa${i}`];
            if (dsa) {
                const dsaParts = dsa.split("|");
                const phone = dsaParts[1];
                if (!uniquePhones.has(phone)) {
                    uniquePhones.add(phone);
                    if (type == "cibil") {
                        uniqueArray.push({
                            level: i,
                            parent: dsaParts[2],
                            dsa: `${dsaParts[0]}(${phone})`,
                            phone: phone,
                            total_cibil_processed: 0
                        });
                    } else {
                        uniqueArray.push({
                            level: i,
                            parent: dsaParts[2],
                            dsa: `${dsaParts[0]}(${phone})`,
                            phone: phone,
                            total_rejected: 0,
                            total_pending: 0,
                            total_approved: 0,
                            total_consent_signed: 0,
                            total_basic_detail_saved: 0,
                        });
                    }
                }
            }
        }
    });
    return { users: uniqueArray, uniquePhone: [...uniquePhones] }
};

exports.sendSmsTemplate = (number, message) => {
    let options = {
        'method': 'GET',
        'url': `https://api.textlocal.in/send/?apikey=${process.env.TEXT_LOCAL_API_KEY}&numbers=${number}&sender=${process.env.TEXT_LOCAL_SENDER}&message=${message}`,
        'headers': {
            'Cookie': 'PHPSESSID=sj1er7bdnum3ek14hq0tfmlbu3'
        },
        responseType: "text",
        validateStatus: () => true,
    };
    axios(options)
        .then((response) => {
            console.log(response?.data);
        })
        .catch((error) => {
            throw new Error(error);
        });
};

let _smsRoundRobinCounter = 0;

const _sendSMSVendor1 = async (templateId, templateText, formattedPhone, serviceType) => {
    const messageId = uuidv4();
    const encodedText = encodeURIComponent(templateText);
    const url = `https://automate.nexgplatforms.com/api/v1/sentsms?username=${process.env.NEXGPL_USERNAME}&password=${process.env.NEXGPL_PASSWORD}&contactnumber=${formattedPhone}&entityid=1201159972577186406&header=${process.env.NEXGPL_FROM || 'RULOAN'}&message=${encodedText}&messageType=normal&messageid=${messageId}&serviceType=${serviceType}&templateid=${templateId}`;
    const response = await axios.request({ method: 'get', maxBodyLength: Infinity, url, headers: {} });
    return response.data;
};

const _sendSMSVendor2 = async (templateId, templateText, formattedPhone, serviceType) => {
    const encodedText = encodeURIComponent(templateText);
    const url = `https://smsapi.chatbot.team/index.php/sms/urlsms?sender=${process.env.NEXGPL_FROM || 'RULOAN'}&numbers=${formattedPhone}&message=${encodedText}&messagetype=TXT&reponse=Y&apikey=${process.env.CHATBOT_TEAM_API_KEY}&templateid=${templateId}`;
    const response = await axios.request({ method: 'get', maxBodyLength: Infinity, url, headers: {} });
    return response.data;
};

exports.sendSMSNew = async (templateId, templateText, phone, serviceType = 'otp') => {
    try {
        let formattedPhone = phone;
        if (phone && phone.length === 10) {
            formattedPhone = `91${phone}`;
        }

        const useVendor2 = (_smsRoundRobinCounter++ % 2) === 1;
        const vendor = useVendor2 ? 2 : 1;

        try {
            const result = useVendor2
                ? await _sendSMSVendor2(templateId, templateText, formattedPhone, serviceType)
                : await _sendSMSVendor1(templateId, templateText, formattedPhone, serviceType);
            return result;
        } catch (vendorError) {
            console.error(`sendSMSNew - Vendor ${vendor} failed, falling back:`, vendorError.message);
            const result = useVendor2
                ? await _sendSMSVendor1(templateId, templateText, formattedPhone, serviceType)
                : await _sendSMSVendor2(templateId, templateText, formattedPhone, serviceType);
            return result;
        }
    } catch (error) {
        console.error('sendSMSNew - Error:', error.message);
        console.error('sendSMSNew - Error Details:', error);
    }
}

// Function to divide the array into chunks and process them concurrently
exports.processArrayInChunks = async (array, applicationData, chunkSize) => {
    const chunks = [];
    const totalChunks = Math.ceil(array.length / chunkSize);

    //console.log(2.52,array.length , chunkSize,totalChunks)
    // Divide the array into chunks
    for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = start + chunkSize;
        const chunk = array.slice(start, end);
        chunks.push(chunk);
    }
    //console.log(2.55,chunks)

    // Process each chunk concurrently
    const processedResults = await Promise.all(chunks.map(c => {
        //   console.log(2.6,JSON.stringify(c[0]))
        // return c.map(async (item) => {
        //     const match = await applicationData.find(async (obj) => {
        //         return obj.dsa_mobile_number === item.phone;
        //     });
        //     return { ...item, ...match };
        // })

        return Promise.all(c.map(async (item) => {
            const match = await findMatchingApplicationData(item.phone, applicationData);
            return { ...item, ...match };
        }));
    }));
    // console.log("###2.8",applicationData)

    // Merge the processed results back
    console.log("?&&&&85", processedResults.length)
    let finalResult = [];
    for (let i = 0; i < processedResults.length; i++) {
        finalResult = finalResult.concat(processedResults[i])
    }
    // const mergedResult = processedResults.reduce((merged, result) => {
    //     // Merge the processed result with the merged result logic
    //     // ...
    //     finalResult = finalResult.concat(m)
    //     return merged;
    // }, []);
    //console.log("2.999",finalResult)
    console.log("2.999", finalResult.length)
    return finalResult;
};

function findMatchingApplicationData(phone, applicationData) {
    return new Promise((resolve, reject) => {
        const match = applicationData.find(obj => {
            return obj.dsa_mobile_number === phone;
        });
        resolve(match);
    });
};

exports.getLastSpendDates = () => {
    const currentDate = moment();
    const currentMonth = currentDate.month(); // Get the current month (0-indexed)
    let currentYear = currentDate.year() - 1;
    const lastYearFinancialStart = moment().subtract(1, 'year').month(3).startOf('month'); // Start of financial year (April 1st) of the previous year
    const lastSpendDates = {};
    let yearChanged = false;

    // Iterate through months within the financial year
    for (let month = lastYearFinancialStart.month(); month <= (lastYearFinancialStart.month() + 11); month++) {
        let tempMonth = month;
        if (month >= 12) {
            if (!yearChanged) {
                currentYear += 1;
                yearChanged = true;
            }
            tempMonth = month % 12;
        }
        const lastDateOfMonth =
            month === currentMonth && currentDate.date() === 1
                ? currentDate.format('YYYY-MM-DD') // If current date is the first date of the current month
                : moment().year(currentYear).month(tempMonth).endOf('month').format('YYYY-MM-DD');

        const monthName = moment().month(tempMonth).format("MMMM");
        lastSpendDates[monthName] = lastDateOfMonth;
    }

    return lastSpendDates;
};

exports.formatCurrentDate = (date, startingHour, startingMinutes, startingSeconds) => {
    let currentDate = new Date(date);
    currentDate.setHours(startingHour, startingMinutes, startingSeconds);
    return currentDate
};

exports.checkMaskingAllowed = (role) => {
    return Boolean(role != "CEO" & process.env.IS_EXPORT_MASKED == "true");
};

exports.generateRandomString = (length) => {
    const characters = '0123456789';
    let randomString = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        randomString += characters.charAt(randomIndex);
    }

    return randomString;
};

exports.decodeBase64AndReadXLSXForLeadForm = (base64String) => {
    let tempFilePath;
    try {
        // Decode the base64 string to binary data
        const binaryData = Buffer.from(base64String, 'base64');

        // Write the binary data to a temporary file (detecting file type based on content)
        let rand = randomstring.generate(20);
        tempFilePath = path.join(__dirname, `temp${rand}`);
        fs.writeFileSync(tempFilePath, binaryData);

        // Read the file content and detect the file type
        const fileContent = fs.readFileSync(tempFilePath, 'utf-8');
        const isXlsx = fileContent.startsWith('PK');

        // Read the file based on its type (XLSX or CSV)
        let result;
        if (isXlsx) {
            // For XLSX files
            const workbook = xlsx.readFile(tempFilePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

            const headers = data[0];
            result = data.slice(1).map((row) => {
                const obj = {};

                row.forEach((value, index) => {
                    if (headers[index]) {
                        const key = headers[index]?.trim().replace(/\/| /g, '_').toLowerCase();

                        /* if (key === 'bank_claim_month') {
                            let parts = value.split(' : ');
                            let monthParts = parts[2];
                            let month = monthParts.split(' ');
                            monthParts = month[0];
                            let year = month[1];
                            monthParts = monthParts.substring(0, 3);
                            monthParts = monthParts + ' ' + year;
                            obj[key] = monthParts;
                        } else {
                            obj[key] = value;
                        } */
                        // Keep first non-empty value when duplicate headers normalize to the same key
                        // (e.g. Loan_status + Loan Status → loan_status). Empty later cols must not wipe it.
                        const isBlank = value === undefined || value === null || String(value).trim() === '';
                        if (!(key in obj) || !isBlank) {
                            obj[key] = value;
                        }
                    }
                });
                return obj;
            });
        } else {
            // For CSV files
            const csvData = fileContent;
            const rows = csvData.split('\n');
            const headers = rows[0].split(',');

            result = rows.slice(1).map((row) => {
                const values = row.split(',');
                const obj = {};
                values.forEach((value, index) => {
                    const key = headers[index]?.trim().replace(/\/| /g, '_').toLowerCase();
                    const isBlank = value === undefined || value === null || String(value).trim() === '';
                    if (!(key in obj) || !isBlank) {
                        obj[key] = value;
                    }
                });
                return obj;
            });
        }

        // Cleanup: Delete the temporary file
        console.log(tempFilePath);
        fs.unlinkSync(tempFilePath);

        return result;
    } catch (error) {
        console.log(tempFilePath);
        fs.unlinkSync(tempFilePath);
        console.error('Error:', error);
        return [-1];
    }
};

// Function to remove formatting from Excel base64 and convert back to Excel base64
exports.removeFormattingFromExcelBase64Async = async (excelBase64) => {
    try {
        // Decode the base64 string to binary data
        const binaryData = Buffer.from(excelBase64, 'base64');

        // Read the Excel binary data
        const workbook = xlsx.read(binaryData, { type: 'buffer' });

        // Check if the file is XLSX (PK signature at the beginning of the file)
        const isXlsx = binaryData[0] === 80 && binaryData[1] === 75;

        // Create a new workbook without formatting (applies only to XLSX files)
        let newWorkbook;
        if (isXlsx) {
            newWorkbook = xlsx.utils.book_new();
            const newWorksheet = xlsx.utils.aoa_to_sheet(xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }));
            xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, 'Sheet1');
        } else {
            // If the file is CSV, return the original base64 without formatting
            return excelBase64;
        }

        // Write the new workbook to binary buffer
        const newExcelBinaryData = xlsx.write(newWorkbook, { bookType: 'xlsx', type: 'buffer' });

        // Encode the new Excel data to base64
        const newExcelBase64 = Buffer.from(newExcelBinaryData).toString('base64');
        return newExcelBase64;
    } catch (error) {
        throw error;
    }
};

exports.decodeBase64AndReadXLSXForLeadFormResult = (base64String) => {
    let tempFilePath;
    try {
        // Decode the base64 string to binary data
        const binaryData = Buffer.from(base64String, 'base64');
        let rand = randomstring.generate(20);

        // Write the binary data to a temporary file (detecting file type based on content)
        tempFilePath = path.join(__dirname, `temp1${rand}`);
        fs.writeFileSync(tempFilePath, binaryData);

        // Read the file content and detect the file type
        const fileContent = fs.readFileSync(tempFilePath, 'utf-8');
        const isXlsx = fileContent.startsWith('PK');

        // Read the file based on its type (XLSX or CSV)
        let result;
        if (isXlsx) {
            // For XLSX files
            const workbook = xlsx.readFile(tempFilePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

            const headers = data[0];
            result = data.slice(1).map((row) => {
                const obj = {};
                row.forEach((value, index) => {
                    if (headers[index]) {
                        const key = headers[index]?.trim().replace(/\/| /g, '_').toLowerCase();
                        const isBlank = value === undefined || value === null || String(value).trim() === '';
                        if (!(key in obj) || !isBlank) {
                            obj[key] = value;
                        }
                    }

                });
                return obj;
            });
        } else {
            // For CSV files
            const csvData = fileContent;
            const rows = csvData.split('\n');
            const headers = rows[0].split(',');

            result = rows.slice(1).map((row) => {
                const values = row.split(',');
                const obj = {};
                values.forEach((value, index) => {
                    const key = headers[index]?.trim().replace(/\/| /g, '_').toLowerCase();
                    const isBlank = value === undefined || value === null || String(value).trim() === '';
                    if (!(key in obj) || !isBlank) {
                        obj[key] = value;
                    }
                });
                return obj;
            });
        }

        // Cleanup: Delete the temporary file
        fs.unlinkSync(tempFilePath);

        return result;
    } catch (error) {
        fs.unlinkSync(tempFilePath);
        console.error('Error:', error);
        return [-1];
    }
};

exports.validatePan = (panNumber) => {
    let pan = panNumber?.trim();
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    return panRegex.test(pan.toUpperCase());
};

exports.ccStatusMapping = {
    'bajaj_credit_card': {
        'sent_to_bank': 'approved',
        'approved': 'approved',
        'auto_qc_pending': 'pending',
        'awaiting_docs_for_pickup': 'pending',
        'bank_verification_pending': 'pending',
        'bfl_underwriting': 'pending',
        'fcu_pending': 'pending',
        'for_re_sale': 'pending',
        'open': 'pending',
        'pre_onboarding': 'pending',
        'psf_curing': 'pending',
        'qc_pending': 'pending',
        'self_sourcing_consent_pending': 'pending',
        'soft_qc_pending': 'pending',
        'telecaller_curing': 'pending',
        'verification_call_pending': 'pending',
        'rejected': 'rejected'
    },
    'hdfc_credit_card': {
        "risk": "pending",
        "send_to_ecpv": "pending",
        "underwriter": "pending",
        "decline_dump": "rejected",
        "approved_cases": "approved",
        "dap_final": "approved",
        "indexing": "approved"
    },
    'loanwalle_pl': {
        "COMPLETE_REGISTRATION": "pending",
        "VRIFY_EMAIL_OTP": "pending",
        "ADD_EMPLOYEMENT": "pending",
        "SEND_AADHAAR_OTP": "pending",

        "BRE_APPROVED": "approved",
        "VERIFY_AADHAAR_KYC": "approved",
        "REFERENCE_ADDED": "approved",
        "REJECT_AADHAR_KYC": "approved",
        "SANCTION_COMPLETED": "approved",
        "KYC_DOC_UPLOADED": "approved",
        "DISBURSAL_INI": "approved",
        "AA_FAILED": "approved",
        "BRE_REJECT": "approved",

        "DISBURSED": "disbursed",
        "CLOSED": "disbursed",

        "PENDING_EMPLOYEMENT_WITH_SELF_EMPLOYEED": "rejected",
        "HARD_REJECT": "rejected",
        "BRE_MANUALLY_REJECT": "rejected",
        "KYC_MANUALLY_REJECT": "rejected",
        "MANUALLY_REJECT": "rejected"
    },
    'rupi_credit_card': {
        "app_installed": "pending",
        "mobile_otp_verified": "pending",
        "fd_plan_selected": "pending",
        "pan_verified": "pending",
        "uid_verified": "pending",
        "bav_initiated": "pending",
        "bav_completed": "pending",
        "fd_payment_initialized": "pending",
        "vkyc_initiated": "pending",
        "vkyc_failed": "rejected",
        "approved": "approved"
    },
    'scb_credit_card': {
        "approved": "approved",
        "": "pending",
        "rejected": "rejected"
    },
    'abfl_pl': {
        "1_1_primary_screen_personal_": "pending",
        "1_2_primary_screen_professional_": "pending",
        "2_offer_screen": "pending",
        "3_under_kyc": "approved",
        "4_mandate_screen": "approved",
        "4_1_mandate_retriggered": "approved",
        "5_review_offer_screen": "approved",
        "6_congratulation_screen_disbursed_": "disbursed",
        "7_1_rejected_at_bre": "rejected",
        "7_2_rejected_at_kyc": "rejected",
        "7_4_bre_nsdl_reject": "rejected",
        "7_7_bre_ntc_reject": "rejected",
        "7_9_offer_validity_expired": "rejected",
    },
    "zype_pl": {
        "accept": "approved",
        "application_not_complete": "pending",
        "rejected": "rejected",
    },
    "mirae_pl": {
        "completed": "disbursed",
        "follow_up": "pending",
        "rejected": "rejected",
    },
    "icici_cc": {
        "drop": "rejected",
        "success": "approved",
        "reject": "rejected",
        "inprocess": "pending",
    },
    "poonawala": {
        "rejected": "rejected",
        "credit_approval": "approved",
        "drop_off": "pending",
        "disbursement": "disbursed",
    },
    "sundaram_hl": {
        "pending": "pending",
        "approved": "approved",
        "rejected ": "rejected",
        "disbursed": "disbursed",
    },
    "incred_pl": {
        "Pending": "pending",
        "Approved": "approved",
        "Rejected ": "rejected",
        "Disbursed": "disbursed",
    },
    "motilal_hl": {
        "HOT": "pending",
        "NI": "rejected",
        "PRE-LOGIN ": "approved",
        "SH": "pending",
        "LBNS - L0": "approved",
        "SOFT": "approved",
        "SEND BACK": "approved",
        "HARD": "approved",
        "QC-WIP": "approved",
        "SUP-WIP": "approved",
        "CREDIT RE-LOOK": "approved",
        "CUW-WIP": "approved",
        "RELOOK INITIATED": "approved",
        "CANCEL": "rejected",
        "PD": "disbursed",
        "FD": "disbursed",
        "SUD": "approved",
        "REJECT": "rejected",
        "PL": "approved",
        "Pros": "approved",
        "SS": "approved",
    },
    "motilal_lap": {
        "LEAD": "pending",
        "REJ": "rejected",
        "DISBURSED": "disbursed",
        "DEAL": "pending",
        "SANCTION": "approved"
    },
    "piramal_pl": {
        "DISBURSED:Disbursed": "disbursed",
        "LOAN_CREATED:Disbursed": "disbursed",
        "CANCELLED:Cancelled": "rejected",
        "IN_PROGRESS:Pending with Partner": "pending",
        "REJECTED:Rejected": "rejected",
        "SANCTIONED:Sanctioned": "approved",
        "SANCTIONED_EXPIRED:Sanctioned": "approved",
        "SANCTION_PENDING_VERIFICATION:At Login Stage": "pending",
        "LOAN_CREATION_REQUESTED:Sanctioned": "approved",
        "RECEIVED:Pending with Partner": "pending"
    },
    "piramal_hl": {
        "IN_PROGRESS:": "pending",
        "REJECTED:": "rejected",
        "SANCTIONED:Sanctioned CNI": "approved",
        "CANCELLED:": "REJECTED",
        "LAN_GENERATED:LAN Generated": "disbursed",
        "QDE:Rejected": "Approved",
        "FINANCIAL_SANCTION:Sanctioned CNI": "approved",
        "FINANCIAL_SANCTION:Rejected": "rejected",
        "LOAN_CREATED:": "Disbursed",
        "LD_GENERATION:Sanctioned CNI": "approved",
        "SUBMITTED:": "Approved",
        "COLLATERAL_SANCTION:Sanctioned CNI": "approved",
        "SANCTION_PENDING_VERIFICATION:": "approved",
        "UNDER_REVIEW:": "Approved",
        "PRE_LOGIN_REJECT:Pre-Login Reject": "rejected",
        "LOAN_CREATION_REQUESTED:": "approved",
        "LD_GENERATION:Cancelled": "approved",
        "RECEIVED:": "approved",
        "SANCTIONED_EXPIRED:": "approved",
        "DOCKET_LOGGED_IN:LAN Generated": "approved"
    },
    "piramal_bl": {
        "CANCELLED:Pre Login": "rejected",
        "WIP at Ruloans:Pre Login": "pending",
        "Login Query:Login": "pending",
        "Credit Reject:Login": "rejected",
        "Scorcard Reject:Pre Login": "rejected",
        "WIP at Credit:Login": "pending",
        "SANCTIONED:Login": "approved",
        "DISBURSED:Login": "disbursed"
    },
    "hdfc_personal_loan": {
        "login": "pending",
        "approved": "approved",
        "reject": "rejected",
        "disbursed": "disbursed",
        "abnd": "in_process"
    },
    "hero_fincorp_pl": {
        // "offers": "approved",
        // "in_progress": "pending",
        // "disbursed": "disbursed",
        // "cancelled": "rejected"
        "pan": "inprogress",
        "add_address": "inprogress",
        "loan_amount": "inprogress",
        "bre_cpv_tvr": "approved",
        "personal_details": "inprogress",
        "ckyc": "inprogress",
        "offers": "approved",
        "closed": "rejected",
        "cancelled": "rejected",
        "disbursed": "disbursed"
    },
    "tata_pl": {
        "approved": "approved",
        "incomplete_journey": "pending",
        "no_offer": "rejected",
        "disbursed": "disbursed"
    },
    "shubham_hl": {
        "Login": "approved",
        "New": "pending",
        "Under Follow Up Tele-calling": "pending",
        "Under Follow Up at Branch": "pending",
        "House Visit Fixed": "pending",
        "Converted": "pending",
        "Document Collected": "pending",
        "Not Interested": "rejected",
        "Not Converted": "rejected",
        "Hold": "rejected",
        "Reject": "rejected",
        "Disbursed": "disbursed"
    },
    "shubham_lap": {
        "Login": "approved",
        "New": "pending",
        "Under Follow Up Tele-calling": "pending",
        "Under Follow Up at Branch": "pending",
        "House Visit Fixed": "pending",
        "Converted": "pending",
        "Document Collected": "pending",
        "Not Interested": "rejected",
        "Not Converted": "rejected",
        "Hold": "rejected",
        "Reject": "rejected",
        "Disbursed": "disbursed"
    },
    // Unity Small Bank Digital PIL (unity_smb_pl) only. Loan_status → CRM status.
    // Login → pending; Credit/PSD → approved; Completed → disbursed; Rejected → rejected.
    // BRE1_DECISION approved/enhancement is applied in the processor, not here.
    // Disbursal sheet (Unity email 20 Aug 2026) also sends Loan Status with the same Completed → disbursed map.
    "unity_smb_pl": {
        "login": "pending",
        "credit": "approved",
        "psd": "approved",
        "completed": "disbursed",
        "rejected": "rejected"
    }
};

exports.ccSubStageMapping = {
    'scb_credit_card': {
        "APPROVED": "Approved",
        "": "application approved WIP/ kyc pending",
        "REJECTED": null
    },
    "icici_cc": {
        "drop": "Incomplete",
        "success": "Card Created",
        "reject": "Rejected",
        "inprocess": "Inprocess",
    }
};

exports.formatSignupDate = (date) => {
    // Create a new Date object
    date = new Date(date);

    // Define months array
    let months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Get the individual components of the date
    let day = date.getDate();
    let month = months[date.getMonth()];
    let year = date.getFullYear();
    let hours = date.getHours();
    let minutes = date.getMinutes();
    let seconds = date.getSeconds();

    // Format the date string
    let formattedDate = day + '-' + month + '-' + year + ' ' + hours + ':' + minutes + ':' + seconds;

    return formattedDate; // Output: 08-Dec-2022 15:14:16
};

exports.generateNestedObjects = (objects) => {
    const rootObjects = [];
    const map = {};

    // Create a map for easy access by dsa_mobile_number
    objects.forEach(obj => {
        map[obj.dsa_mobile_number] = obj;
        obj.childs = []; // Initialize childs array
    });

    // Build the hierarchy
    objects.forEach(obj => {
        const parentObj = map[obj.partner_code];
        if (parentObj) {
            parentObj.childs.push(obj);
        } else {
            rootObjects.push(obj); // If no parent, it's a root object
        }
    });

    // Remove parent_code from root objects
    rootObjects.forEach(obj => delete obj.partner_code);

    // Function to recursively sum values from lowest child to root level and store the sum in parent
    function sumValues(parent) {
        let sum = 0;
        parent.childs.forEach(child => {
            if (child.childs.length > 0) {
                sum += sumValues(child); // Recursively sum child values
            }
            for (const key in child) {
                if (key.startsWith('total_')) {
                    parent[key] = (parent[key] || 0) + child[key]; // Sum child's value to parent
                }
            }
        });
        return sum;
    }

    // Calculate and set the sum for each object in the hierarchy
    rootObjects.forEach(obj => {
        obj.total_sum = sumValues(obj); // Add a new property to store the sum
    });

    return rootObjects;
};

exports.mergeArrays = (left, right) => {
    const map = new Map();

    // Store values from right array in the map using dsa_id as the key
    right.forEach(item => map.set(item.dsa_id, item));

    // Replace values in the left array with values from the map if dsa_id matches
    const merged = left.map(item => {
        if (map.has(item.dsa_id)) {
            return map.get(item.dsa_id);
        }
        return item;
    });

    return merged;
};

exports.getChildLevels = (data, parentMobileNumber, field = "dsa_mobile_number") => {
    let immediateChilds = [];

    function findImmediateChilds(array) {
        for (const item of array) {
            if (item[field] === parentMobileNumber) {
                immediateChilds = [item, ...item.childs];
                delete item.childs; // Remove child array from this object
                return;
            }
            if (item.childs && item.childs.length > 0) {
                findImmediateChilds(item.childs);
            }
        }
    }

    findImmediateChilds(data);

    let finalArray = [];

    for (i = 0; i < immediateChilds?.length; i++) {
        let { childs, ...rest } = immediateChilds[i];
        if (i == 0) {
            finalArray?.push({ ...rest, childs: [] });
        } else {
            finalArray[0]?.childs.push(rest)
        }
    };

    return finalArray;
};

exports.formatDateIndianFormat = (date) => {
    const originalDate = new Date(date);
    function getMonthName(monthIndex) {
        const months = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        ];
        return months[monthIndex];
    };
    return `${originalDate.getDate()}-${getMonthName(originalDate.getMonth())}-${originalDate.getFullYear()} ${originalDate.getHours()}:${originalDate.getMinutes()}:${originalDate.getSeconds()}`;
};

exports.checkWhereInQueryString = (string, type = "where") => {
    let where = string;
    if (string.includes(type)) {
        where += " and "
    } else {
        where += `${type} `
    };
    return where;
};

exports.makeRequest = (options) => {
    return new Promise((resolve, reject) => {
        const opts = options && typeof options === 'object' ? { ...options } : options;
        if (opts && opts.url == null && opts.uri != null) {
            opts.url = opts.uri;
        }
        if (opts && opts.data == null && Object.prototype.hasOwnProperty.call(opts, "body")) {
            opts.data = opts.body;
            delete opts.body;
        }
        if (opts && Object.prototype.hasOwnProperty.call(opts, "json")) {
            delete opts.json;
        }
        if (opts && opts.validateStatus == null) {
            opts.validateStatus = () => true;
        }

        axios(opts)
            .then((response) => {
                resolve({
                    body: response?.data,
                    statusCode: response?.status,
                    headers: response?.headers,
                });
            })
            .catch((error) => reject(error));
    });
};

const LOAN_TYPE_REGISTRY = {
    credit_card: { table_name: 'ru_cc_applications', meta_table: 'ru_cc_application_metas', meta_prefix: 'ru_cc_application' },
    personal_loan: { table_name: 'ru_personal_loan_applications', meta_table: 'ru_personal_loan_application_metas', meta_prefix: 'ru_personal_loan_application' },
    education_loan: { table_name: 'ru_education_loan_applications', meta_table: 'ru_education_loan_application_metas', meta_prefix: 'ru_education_loan_application' },
    car_loan: { table_name: 'ru_car_loan_applications', meta_table: 'ru_car_loan_application_metas', meta_prefix: 'ru_car_loan_application' },
    used_car_loan: { table_name: 'ru_used_car_loan_applications', meta_table: 'ru_used_car_loan_application_metas', meta_prefix: 'ru_used_car_loan_application' },
    car_refinance: { table_name: 'ru_car_refinance_applications', meta_table: 'ru_car_refinance_application_metas', meta_prefix: 'ru_car_refinance_application' },
    gold_loan: { table_name: 'ru_gold_loan_applications', meta_table: 'ru_gold_loan_application_metas', meta_prefix: 'ru_gold_loan_application' },
    business_loan: { table_name: 'ru_bl_applications', meta_table: 'ru_bl_application_metas', meta_prefix: 'ru_bl_application' },
    home_loan: { table_name: 'ru_hl_applications', meta_table: 'ru_hl_application_metas', meta_prefix: 'ru_hl_application' },
    solar_loan: { table_name: 'ru_solar_loan_applications', meta_table: 'ru_solar_loan_applications_meta', meta_prefix: 'ru_solar_loan_application' },
    machinery_loan: { table_name: 'ru_machinery_loan_applications', meta_table: 'ru_machinery_loan_application_metas', meta_prefix: 'ru_machinery_loan_application' },
    loan_against_property: { table_name: 'ru_lap_applications', meta_table: 'ru_lap_application_metas', meta_prefix: 'ru_lap_application' },
    loan_against_security: { table_name: 'ru_las_applications', meta_table: 'ru_las_application_metas', meta_prefix: 'ru_las_application' },
    lap: { table_name: 'ru_lap_applications', meta_table: 'ru_lap_application_metas', meta_prefix: 'ru_lap_application', is_alias: true },
    las: { table_name: 'ru_las_applications', meta_table: 'ru_las_application_metas', meta_prefix: 'ru_las_application', is_alias: true },
};

const LOAN_TYPE_ALIASES = {
    lap: 'loan_against_property',
    las: 'loan_against_security',
};

exports.LOAN_TYPE_REGISTRY = LOAN_TYPE_REGISTRY;

exports.getLoanTableInfo = (loan_type, key) => {
    if (!loan_type) return null;
    const normalized = LOAN_TYPE_ALIASES[loan_type] ?? loan_type;
    const info = LOAN_TYPE_REGISTRY[normalized];
    if (!info) return null;
    return key ? info[key] : info;
};

exports.normalizeLoanType = (loan_type) => LOAN_TYPE_ALIASES[loan_type] ?? loan_type;
exports.getTableNameFromLoanType = (loan_type, key) => exports.getLoanTableInfo(loan_type, key);
/** Main-table columns used for loan APAC / reference filters (absent on solar_loan and car_refinance). */
const LOAN_APAC_REF_WHERE_COLUMNS = ['pl.loan_apac_ref_los_number', 'pl.loan_reference_id'];

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Per loan-type capabilities for getApplicationsByProductAndLoanType list queries.
 */
exports.getLoanListQueryProfile = (loanType) => {
    const profile = {
        metaHasBankBranch: true,
        metaHasVentileScore: loanType !== 'solar_loan',
        hasSubStatus: true,
        hasLoanApacRef: loanType !== 'solar_loan' && loanType !== 'car_refinance',
        // solar + LAS store UUID-ish ids that need CONVERT/... COLLATE joins
        useSolarJoins: loanType === 'solar_loan' || loanType === 'loan_against_security',
    };
    if (loanType === 'car_refinance') {
        profile.metaHasBankBranch = false;
        profile.metaHasVentileScore = false;
        profile.hasSubStatus = false;
        profile.hasLoanApacRef = false;
    }
    if (loanType === 'loan_against_security') {
        // LAS meta uses disbursement_date (aliased in list SQL) and has no bank_branch / ventile
        profile.metaHasBankBranch = false;
        profile.metaHasVentileScore = false;
    }
    return profile;
};

/** Rewrites one predicate that references loan APAC / reference columns for tables that lack them. */
const neutralizeLoanApacRefSqlFragment = (fragment) => {
    let result = String(fragment ?? '');
    if (!LOAN_APAC_REF_WHERE_COLUMNS.some((col) => result.includes(col))) {
        return result;
    }

    for (const col of LOAN_APAC_REF_WHERE_COLUMNS) {
        const escapedCol = escapeRegExp(col);

        result = result.replace(
            new RegExp(`\\(${escapedCol} is null OR TRIM\\(${escapedCol}\\) = ''\\)`, 'gi'),
            '1=1'
        );
        result = result.replace(
            new RegExp(`\\(${escapedCol} is not null AND TRIM\\(${escapedCol}\\) <> ''\\)`, 'gi'),
            '1=0'
        );
        result = result.replace(
            new RegExp(`${escapedCol}\\s+in\\s*\\([^)]*\\)`, 'gi'),
            '1=0'
        );
        result = result.replace(
            new RegExp(`${escapedCol}\\s*(=|!=|<>|>=|<=|>|<)\\s*('(?:[^'\\\\]|\\\\.)*'|\\d+)`, 'gi'),
            '1=0'
        );
        result = result.replace(
            new RegExp(`${escapedCol}\\s+(?:not\\s+)?like\\s+'(?:[^'\\\\]|\\\\.)*'`, 'gi'),
            '1=0'
        );
        result = result.replace(
            new RegExp(`${escapedCol}\\s+is\\s+not\\s+null`, 'gi'),
            '1=0'
        );
        result = result.replace(
            new RegExp(`${escapedCol}\\s+is\\s+null`, 'gi'),
            '1=1'
        );
    }

    return result;
};

/**
 * Adjusts shared WHERE tuples for loan types whose main table lacks APAC / reference columns.
 * Prevents Unknown column errors when getAllApplications applies one filter to every loan table.
 */
exports.normalizeLoanApplicationWhere = (where, queryProfile) => {
    if (!where?.length || queryProfile?.hasLoanApacRef) {
        return where;
    }

    return where.map(([field, op, val]) => {
        const fieldStr = String(field ?? '');

        if (LOAN_APAC_REF_WHERE_COLUMNS.includes(fieldStr)) {
            return ['1=0', '', null];
        }

        if (LOAN_APAC_REF_WHERE_COLUMNS.some((col) => fieldStr.includes(col))) {
            return [neutralizeLoanApacRefSqlFragment(fieldStr), op, val];
        }

        return [field, op, val];
    });
};

exports.LOAN_APAC_REF_FILTER_FIELDS = ['loan_apac_ref_los_number', 'loan_reference_id'];

exports.partitionFilterModelItems = (filterModel, fields) => {
    const fieldSet = new Set(fields);
    const matched = [];
    const rest = [];
    for (const item of filterModel?.items || []) {
        (fieldSet.has(item.field) ? matched : rest).push(item);
    }
    return { matched, rest };
};

/** Builds a WHERE fragment for loan APAC / reference filterModel items (safe for tables without those columns). */
exports.buildLoanApacRefFilterWhereClause = (filterItems, logicOperator, dbFieldMapping) => {
    if (!filterItems?.length) {
        return null;
    }

    const operatorHandlers = exports.CustomOperatorHandlers();
    const filters = filterItems
        .map(({ field, operator, value }) => {
            const dbField = dbFieldMapping(field);
            const handler = operatorHandlers[operator];
            if (!dbField || !handler) {
                return null;
            }
            const result = handler(dbField, value);
            if (!result) {
                return null;
            }
            const [sqlField, op, val] = result;
            const clause = exports.formatGetLeadFormsFilterClause(sqlField, op, val);
            return clause ? neutralizeLoanApacRefSqlFragment(clause) : null;
        })
        .filter(Boolean);

    if (!filters.length) {
        return null;
    }

    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
    return `(${filters.join(logicOp)})`;
};

exports.generateLoanUnionQuery = () => {
    const queries = Object.entries(LOAN_TYPE_REGISTRY)
        .filter(([key, info]) => !info.is_alias && key !== "credit_card")
        .map(([key, { table_name, meta_table }]) => {
            const isLas = key === "loan_against_security";
            const metaDisbursedDateExpr = isLas ? "metas.disbursement_date" : "metas.disbursed_date";
            const caCityExpr = isLas ? "CAST(pla.city AS CHAR)" : "ca.city";
            const caStateExpr = isLas ? "CAST(pla.state AS CHAR)" : "ca.state";
            const caJoinLine = isLas
                ? ""
                : `    left join RULoans.ru_customer_addresses ca ON ca.id = pla.address_id
`;

            return `SELECT 
        '${key}' AS table_name,
        CAST(pla.application_id AS CHAR) AS application_id,
        CAST(pla.product_id AS CHAR) AS product_id,
        CAST(pla.applied_loan_amount AS DECIMAL(18,2)) AS applied_loan_amount,
        CAST(pla.approved_loan_amount AS DECIMAL(18,2)) AS approved_loan_amount,
        CAST(pla.loan_tenure AS UNSIGNED) AS loan_tenure,
        CAST(pla.disbursed_loan_amount AS DECIMAL(18,2)) AS disbursed_loan_amount,
        CAST(${metaDisbursedDateExpr} AS DATETIME) AS disbursed_date,
        CAST(pla.sub_stage AS CHAR) as sub_stage,
        CAST(pla.dsa_id AS CHAR) as dsa_id,
        CAST(pla.customer_id AS CHAR) as customer_id,
        CAST(pla.stage AS CHAR) as stage,
        CAST(pla.status AS CHAR) as status,
        CAST(pla.created_at AS CHAR) as created_at,
        lp.product_name AS product_name,
        lp.journey_type AS journey_type,
        '${key}' AS loan_type_name,
        dsa.dsa_mobile_number AS dsa_mobile_number,
        dsa.full_name AS full_name,
        dsa.materialized_path AS materialized_path,
        ${caCityExpr},
        ${caStateExpr},
        utm.utm_source, 
        utm.utm_medium, 
        utm.utm_campaign, 
        utm.utm_content, 
        utm.utm_channel, 
        utm.utm_term, 
        utm.utm_id, 
        utm.utm_adgroup, 
        utm.utm_main_source,
        utm.utm_device,
        utm.page_source,
        utm.source_from,
        utm.adgroupid,
        utm.campaignid,
        utm.ad,
        utm.mt,
        utm.adpos,
        utm.gad,
        utm.gclid
    FROM RULoans.${table_name} pla
    left join RULoans.${meta_table} metas ON pla.application_id = metas.application_id
    left join RULoans.loan_applications utm ON pla.application_id = utm.application_id
${caJoinLine}    left join \`${process.env.DATABASE3_NAME}\`.ru_loans_products lp ON pla.product_id = lp.id AND lp.status = 1
    left join \`${process.env.DATABASE3_NAME}\`.ru_loans_types lt ON lp.loan_type_id = lt.id
    left join RULoans.ru_direct_selling_agents dsa ON pla.dsa_id = dsa.dsa_id`});

    return queries.join("\nUNION ALL\n");
};

exports.dsaFilterQueryBuilder = (query, filter, offset, limit) => {
    const mainTableArray = ["cm", "rfp", "k", "pvs", "rc", "bh", "p", "cl", "pvss"];
    const presentAlias = []

    if (filter) {
        const filterParts = filter.split(/\s+/);
        const aliasTableMatcher = {
            "cm": "LEFT JOIN ru_direct_selling_agents cm ON c.channel_manager_code = cm.dsa_mobile_number",
            "k": "LEFT JOIN ru_dsa_kyc_data k ON c.dsa_id = k.dsa_id",
            "pvs": "LEFT JOIN picklist_values pvs ON c.dsa_status = pvs.id",
            "rc": "LEFT JOIN ru_companies rc ON rc.company_id = c.company_id",
            "bh": "LEFT JOIN ru_direct_selling_agents bh ON c.business_head_code = bh.dsa_mobile_number",
            "p": "LEFT JOIN ru_direct_selling_agents p ON c.partner_code = p.dsa_mobile_number",
            "cl": `LEFT JOIN (SELECT cl1.* FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY createdAt DESC) AS rn FROM CRMTest.call_logs) cl1 WHERE cl1.rn = 1) AS cl ON cl.user_id = c.dsa_id`,
            "pvss": "LEFT JOIN picklist_values pvss ON c.dsa_sub_status = pvss.id",
            "rfp": "LEFT JOIN ru_referrals rf ON rf.referred_id = c.dsa_id LEFT JOIN ru_direct_selling_agents rfp ON rfp.dsa_id = rf.referrer_id",
        };

        mainTableArray.forEach(prefix => {
            if (filterParts.some(part => part.startsWith(prefix + "."))) {
                presentAlias.push(prefix);
            }
        })

        if (presentAlias.length) {
            presentAlias.forEach(alias => {
                query += ` ${aliasTableMatcher[alias]} `;
            });

            query += ` WHERE ${filter} `;
        }
    }


    if (Boolean(offset !== null || offset != undefined) && limit) {
        console.log("reached here", offset, limit)
        query += ` offset ${offset} limit ${limit} `;
    }

    return query;
}

exports.customerQueryBuilder = (query, filter, offset, limit) => {
    const mainTableArray = ["dsa", "sp"];
    const presentAlias = []

    if (filter) {
        const filterParts = filter.split(/\s+/);
        const aliasTableMatcher = {
            "dsa": "LEFT JOIN ru_direct_selling_agents dsa ON c.dsa_mobile_number = dsa.dsa_mobile_number",
            "sp": "LEFT JOIN ru_direct_selling_agents sp ON c.sp_mobile_number = sp.dsa_mobile_number",
        };

        mainTableArray.forEach(prefix => {
            if (filterParts.some(part => part.startsWith(prefix + "."))) {
                presentAlias.push(prefix);
            }
        })

        if (presentAlias.length) {
            presentAlias.forEach(alias => {
                query += ` ${aliasTableMatcher[alias]} `;
            });

            query += ` WHERE ${filter} `;
        }
    }

    if (Boolean(offset !== null || offset != undefined) && limit) {
        console.log("reached here", offset, limit)
        query += ` offset ${offset} limit ${limit} `;
    }

    return query;
}

exports.arrayKeysToString = (array) => {
    return array.map(item => `'${item}'`).join(",");
}

exports.claculateClaimMonth = () => {

    const date = new Date();
    const today = date.getDate();
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

    let targetDate = date;
    if (lastDayOfMonth - today < 3) {
        targetDate = date; // Last 3 days — use this month
    } else {
        targetDate = new Date(date.getFullYear(), date.getMonth() - 1, 1); // else , use last month
    }

    const month = targetDate.toLocaleString('en-US', { month: 'short' });
    const year = targetDate.getFullYear();
    const claim_month = `${month} ${year}`;

    return claim_month;
}

exports.callNsApi = async (data) => {
    const { api, payload } = data;

    try {
        let options = {
            method: 'POST',
            data: {
                endpoint: api,
                payload
            },
            url: `${process.env.MS_URL}/api/netsuite/get-response`,
            headers: {
                'api-key': process.env.AUTH_KEY_RULOANS_BANK_CLAIM,
                'Content-Type': 'application/json'
            },
            validateStatus: () => true,
        };
        console.log(options);
        const response = await axios(options);
        return response?.data;
    } catch (e) {
        return e;
    }
};

exports.sanitizeBusinessCategory = (category) => {
    if (category == null || category === undefined) return "0"; // Null or undefined → return "0"
    const categoryStr = String(category).trim();
    return /^\d+$/.test(categoryStr) ? categoryStr : "0"; // Only allow numbers, else return "0"
};

// 'sv-SE' is used (not 'en-CA') because it reliably formats as YYYY-MM-DD across
// Node/ICU versions; en-CA's separator/ordering has changed across ICU updates.
const istDateFormatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
});

// Converts a date/datetime value to a 'YYYY-MM-DD' string in IST (Asia/Kolkata).
// Using toISOString().split('T')[0] instead truncates to the UTC calendar date, which
// is off by one for any IST-local date serialized as a UTC instant (e.g. a browser
// sending midnight IST as '...T18:30:00.000Z' the previous day).
exports.toIsoDateIST = (date) => {
    if (!date) return null;
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return null;
    return istDateFormatter.format(parsed);
};

exports.generateWhereClause = (whereObj) => {
    const conditions = Object.entries(whereObj)
        .map(([key, value]) => {
            if (typeof value === "string") {
                return `${key} = '${value}'`;
            }
            return `${key} = ${value}`;
        })
        .join(" AND ");

    return conditions ? `WHERE ${conditions}` : "";
};

exports.formatDate = (date) => {
    let formattedDate = moment(new Date(date)).format("DD-MM-YYYY");
    return formattedDate
};

exports.mapObjectKeys = (obj, mapping) => {
    let newObj = {};

    for (let key in obj) {
        let newKey = key;
        for (let targetKey in mapping) {
            if (Array.isArray(mapping[targetKey])) {
                if (mapping[targetKey].some(alias => key.includes(alias))) {
                    newKey = targetKey;
                    break;
                }
            } else if (key === mapping[targetKey]) {
                newKey = targetKey;
                break;
            }
        }
        newObj[newKey] = obj[key];
    };

    return newObj;
};

exports.formatDate = (date) => {
    let formattedDate = moment(new Date(date)).format("DD-MM-YYYY");
    return formattedDate
};


const keyMappingFilters = {
    channel_partner: {
        fieldMap: {
            'customer_full_name': `case when c.full_name is not null and c.full_name <> '' then c.full_name else CONCAT_WS(' ', c.first_name, c.middle_name, c.last_name) end`,
            'customer_id': 'c.dsa_id',
            'pan_number': 'k.permanent_account_number',
            'profession': 'c.profession',
            'partner_full_name': 'p.full_name',
            'business_head_name': 'bh.full_name',
            'customer_mobile_number': 'c.dsa_mobile_number',
            'home_address_city': 'CASE WHEN address.city IS NULL THEN c.home_address_city ELSE address.city END',
            'home_address_state': 'CASE WHEN address.state IS NULL THEN c.home_address_state ELSE address.state END',
            'status': 'pvs.value',
            'sub_status': 'pvss.value',
            'email_address': 'c.email_address',
            'zip_code': 'CASE WHEN address.pin_code IS NULL THEN c.home_address_pincode ELSE address.pin_code END',
            'utm_source': 'c.utm_source',
            'utm_medium': 'c.utm_medium',
            'utm_campaign': 'c.utm_campaign',
            'utm_channel': 'c.utm_channel',
            'utm_term': 'c.utm_term',
            'utm_content': 'c.utm_content',
            'utm_id': 'c.utm_id',
            'campaignid': 'c.campaignid',
            'adgroupid': 'c.adgroupid',
            'ad': 'c.ad',
            'mt': 'c.mt',
            'adpos': 'c.adpos',
            'gad': 'c.gad',
            'gclid': 'c.gclid',
            'utm_adgroup': 'c.utm_adgroup',
            'utm_main_source': 'c.utm_main_source',
            'utm_device': 'c.utm_device',
            'partner_joining_date': 'DATE(c.created_at)',
            'partner_assigned_date': 'DATE(c.partner_assigned_date)',
            'dsa_status_updated_at': 'DATE(c.dsa_status_updated_at)',
            'call_remark_date': 'DATE(c.call_remark_date)',
            'signup_steps': 'c.signup_steps_completed',
            'is_employee': `CASE WHEN c.is_employee = 1 then 'Yes' ELSE 'No' END`,
            'dsa_verification_status': 'c.dsa_verification_status',
            'user_type': 'c.user_type',
            'old_new_dsa': 'k.is_dsa_new',
            'previous_partner_name': 'pp.full_name',
            'channel_manager_name': 'cm.full_name',
            'referrer_name': 'rfp.full_name',
            'updated_at': 'DATE(c.updated_at)',
            'company_name': 'rc.name',
            'page_source': 'c.page_source',
            'consent_otp_verified': `CASE
                                      WHEN (
                                          SELECT COUNT(*) 
                                          FROM ru_user_onboarding_steps s 
                                          LEFT JOIN ru_onboarding_steps o ON o.step = s.step 
                                          WHERE s.dsa_id = c.dsa_id AND s.status = 1 AND s.step = 'dsa_consent'
                                      ) > 0
                                      then 'Yes' WHEN c.consent_otp_verified_at is not null THEN 'Yes'
                                      ELSE 'No' end`,
            'hierarchy_crm': 'c.hierarchy_crm',
            'ns_hierarchy': 'k.ns_hierarchy',
            'salesperson_name': 'sp.name',
            'initial_partner_name': 'ip.full_name',
            'joining_signed': `CASE WHEN k.mou_signed_date IS NULL then 'No' ELSE 'Yes' END`,
            'payout_signed': `CASE WHEN k.payout_agreement_signed_date IS NULL then 'No' ELSE 'Yes' END`,
            'onboarding_steps': `(SELECT GROUP_CONCAT(DISTINCT s.step ORDER BY o.sort_order asc)  FROM ru_user_onboarding_steps s LEFT JOIN ru_onboarding_steps o ON o.step = s.step WHERE dsa_id = c.dsa_id AND status = 1)`,
            'salesperson_assigned_date': 'date(c.salesperson_assigned_date)',
            'is_manual_business_started': `CASE WHEN (meta.is_manual_business_started = 0 OR meta.is_manual_business_started IS NULL) THEN "No" ELSE "Yes" END`,
            'manual_business_started_date': `meta.manual_business_started_date`,

            'is_online_business_started': `CASE WHEN (meta.is_online_business_started = 0 OR meta.is_online_business_started IS NULL) THEN "No" ELSE "Yes" END`,
            'online_business_started_date': `meta.online_business_started_date`,

            'is_offline_business_started': `CASE WHEN (meta.is_offline_business_started = 0 OR meta.is_offline_business_started IS NULL) THEN "No" ELSE "Yes" END`,
            'offline_business_started_date': `meta.offline_business_started_date`,

            'salesperson_assigned_date': 'date(c.salesperson_assigned_date)',
        },

        // nonDerived: used for isEmpty/isNotEmpty — returns raw column so IS NULL check works correctly
        nonDerived: {
            'partner_full_name':  'c.partner_code',
            'salesperson_name':   'c.salesperson_id',
            'home_address_state': 'c.home_address_state',
            'home_address_city':  'c.home_address_city',
            'zip_code':           'c.home_address_pincode',
            // status/sub_status are picklist FKs on the base table. Filtering the joined
            // label (pvs.value / pvss.value) with TRIM() scans the whole population that
            // renders as "Cold" and times out, so emptiness is checked on the raw FK.
            'status':             'c.dsa_status',
            'sub_status':         'c.dsa_sub_status',
        }
    },

    dsa_call_log: {
        fieldMap: {
            'dsa_name': 'd.full_name',
            'sales_person': 'd.salesperson_id',
            'createdAt': 'date(c.createdAt)',
            'remarks': 'c.remarks',
            'call_status': 'c.call_status',
            'dsa_sub_status': 'd.dsa_sub_status',
            'dsa_status': 'd.dsa_status',
            'hierarchy_crm': 'd.hierarchy_crm',
            'salesperson_assigned_date': 'd.salesperson_assigned_date',
        },
        nonDerived: {
            'sales_person': 'd.salesperson_id'
        }
    }
};

// Generates a WHERE clause that checks both ru_direct_selling_agents and ru_dsa_addresses for isEmpty / isNotEmpty.
exports.buildAddressFilterClause = (field, mode) => {
    const cfg = {
        state: {
            col: 'c.home_address_state',
            subCol: 'state',
        },
        city: {
            col: 'c.home_address_city',
            subCol: 'city',
        },
        zip: {
            col: 'c.home_address_pincode',
            subCol: 'pin_code',
        },
    };

    const f = cfg[field];
    if (!f) return null;

    if (mode === 'isEmpty') {
        return (
            `((${f.col} IS NULL OR TRIM(${f.col}) = '')` +
            ` AND c.dsa_id NOT IN (SELECT dsa_id FROM ru_dsa_addresses WHERE ${f.subCol} IS NOT NULL AND TRIM(${f.subCol}) <> ''))`
        );
    }

    if (mode === 'isNotEmpty') {
        return (
            `(${f.col} IS NOT NULL AND TRIM(${f.col}) <> ''` +
            ` OR c.dsa_id IN (SELECT dsa_id FROM ru_dsa_addresses WHERE ${f.subCol} IS NOT NULL AND TRIM(${f.subCol}) <> ''))`
        );
    }

    return null;
};

exports.getRuloansCustomerApiFieldMapping = (field, original = true, key) => {
    let { nonDerived, fieldMap } = keyMappingFilters[key];
    let mapObj = original ? nonDerived : fieldMap;
    let result = mapObj[field] || fieldMap[field];
    return result || field;
};

// Numeric FK columns where TRIM(col) = '' is meaningless and only forces a full scan.
const NULL_ONLY_EMPTY_FIELDS = new Set([
    'c.dsa_status',
    'c.dsa_sub_status',
]);

exports.CustomOperatorHandlers = (extensions = {}) => {
    const operatorHandlers = {
        // String operators
        contains: (dbField, value) =>
            value != null ? [dbField, ' like ', `%${value}%`] : null,

        doesNotContain: (dbField, value) =>
            value != null ? [dbField, ' not like ', `%${value}%`] : null,

        equals: (dbField, value) =>
            value != null ? [dbField, ' = ', value] : null,

        is: (dbField, value) =>
            value != null ? [dbField, ' = ', value] : null,

        doesNotEqual: (dbField, value) =>
            value != null ? [dbField, ' != ', value] : null,

        not: (dbField, value) =>
            value != null ? [dbField, ' != ', value] : null,

        startsWith: (dbField, value) =>
            value != null ? [dbField, ' like ', `${value}%`] : null,

        endsWith: (dbField, value) =>
            value != null ? [dbField, ' like ', `%${value}`] : null,

        // isEmpty: (dbField) => [`(${dbField} is null OR TRIM(${dbField}) = '')`, '', ''],

        // isNotEmpty: (dbField) => [`(${dbField} is not null AND TRIM(${dbField}) <> '')`, '', ''],

        isEmpty: (dbField) => NULL_ONLY_EMPTY_FIELDS.has(dbField)
            ? [`(${dbField} is null)`, '', '']
            : [`(${dbField} is null OR TRIM(${dbField}) = '')`, '', ''],

        isNotEmpty: (dbField) => NULL_ONLY_EMPTY_FIELDS.has(dbField)
            ? [`(${dbField} is not null)`, '', '']
            : [`(${dbField} is not null AND TRIM(${dbField}) <> '')`, '', ''],

        isAnyOf: (dbField, value) => {
            let valArr = value;
            if (typeof value === 'string') {
                valArr = value.split(',').map(s => s.trim()).filter(Boolean);
            }
            if (Array.isArray(valArr) && valArr.length > 0) {
                return [dbField, ' in ', [valArr]];
            }
            return null;
        },

        // Date operators
        after: (dbField, value) =>
            value != null ? [dbField, ' > ', value] : null,

        onOrAfter: (dbField, value) =>
            value != null ? [dbField, ' >= ', value] : null,

        before: (dbField, value) =>
            value != null ? [dbField, ' < ', value] : null,

        onOrBefore: (dbField, value) =>
            value != null ? [dbField, ' <= ', value] : null,

        isOn: (dbField, value) =>
            value != null ? [dbField, ' isOn ', value] : null,

        // Number operators
        '=': (dbField, value) =>
            value != null ? [dbField, ' = ', value] : null,

        '!=': (dbField, value) =>
            value != null ? [dbField, ' != ', value] : null,

        '>': (dbField, value) =>
            value != null ? [dbField, ' > ', value] : null,

        '>=': (dbField, value) =>
            value != null ? [dbField, ' >= ', value] : null,

        '<': (dbField, value) =>
            value != null ? [dbField, ' < ', value] : null,

        '<=': (dbField, value) =>
            value != null ? [dbField, ' <= ', value] : null,
    };

    return {
        ...operatorHandlers,
        ...extensions,
    };
}

const LEAD_FORMS_BOOLEAN_FILTER_DB_FIELDS = new Set([
    'flc.same_day_billing',
    LEAD_FORMS_IS_SAME_DAY_BILLING_ENABLED_SQL,
    // Comes from a LEFT JOIN, so claims with no meta row are NULL and must count as 0.
    'flcm.is_online_lead',
    'flcm.is_bank_file_matched',
]);

/** Escape single quotes for manual SQL string literals (MySQL: double the quote). */
const escapeSqlStringLiteral = (value) => String(value).replace(/\\/g, '\\\\').replace(/'/g, "''");

const quoteSqlStringLiteral = (value) => `'${escapeSqlStringLiteral(value)}'`;

const extractLeadFormsDateOnly = (val) => {
    if (val == null) return null;
    if (typeof val === 'string') {
        const m = val.match(/^(\d{4}-\d{2}-\d{2})/);
        return m ? m[1] : null;
    }
    return null;
};

const parseLeadFormsFilterBooleanValue = (val) => {
    if (val === true || val === 1 || val === '1') {
        return true;
    }
    if (val === false || val === 0 || val === '0') {
        return false;
    }
    if (typeof val === 'string') {
        const normalized = val.trim().toLowerCase();
        if (normalized === 'true') {
            return true;
        }
        if (normalized === 'false') {
            return false;
        }
    }
    return null;
};

/**
 * Builds one WHERE fragment for getLeadForms filterModel (supports MUI "is" + string "true"/"false").
 * String values are escaped; booleans use 0/1 only. isEmpty/isNotEmpty pass a full expression in `field`.
 */
exports.formatGetLeadFormsFilterClause = (field, op, val) => {
    if (!field) {
        return null;
    }

    const opTrim = String(op || '').trim();

    // isEmpty / isNotEmpty handlers return the full predicate in field and leave op empty.
    // [getAllLntApplications isEmpty] — do not add exists/not-exists branch here; use default handlers only.
    if (!opTrim) {
        if (field.startsWith('(') || /\bis\s+null\b/i.test(field)) {
            return field;
        }
        return null;
    }

    if (opTrim === 'is null' || opTrim === 'is not null') {
        return `${field} ${op}`;
    }

    if (opTrim === 'in') {
        const values = Array.isArray(val?.[0]) ? val[0] : (Array.isArray(val) ? val : [val]);
        const joinedStr = values
            .map((v) => {
                if (typeof v === 'string') {
                    return quoteSqlStringLiteral(v);
                }
                if (typeof v === 'number' && Number.isFinite(v)) {
                    return v;
                }
                return null;
            })
            .filter((v) => v !== null)
            .join(',');
        if (!joinedStr) {
            return null;
        }
        return `${field} in (${joinedStr})`;
    }

    if (opTrim === 'isOn' && field === 'flc.created_at') {
        const dateStr = extractLeadFormsDateOnly(val);
        if (!dateStr) {
            return null;
        }
        return `${field} >= "${dateStr} 00:00:00" and ${field} < DATE_ADD("${dateStr}", INTERVAL 1 DAY)`;
    }

    if (LEAD_FORMS_BOOLEAN_FILTER_DB_FIELDS.has(field)) {
        const boolVal = parseLeadFormsFilterBooleanValue(val);
        if (boolVal === null) {
            return null;
        }
        const isNegated = ['not', '!=', 'doesNotEqual'].includes(opTrim);
        const matchTrue = boolVal !== isNegated;
        if (matchTrue) {
            return `${field} = 1`;
        }
        return `(${field} = 0 OR ${field} IS NULL)`;
    }

    if (val === null || val === undefined) {
        return null;
    }

    const opLower = opTrim.toLowerCase();

    if (typeof val === 'number' && Number.isFinite(val)) {
        return `${field}${op}${val}`;
    }

    if (typeof val === 'boolean') {
        return `${field}${op}${val ? 1 : 0}`;
    }

    return `${field}${op}${quoteSqlStringLiteral(val)}`;
};

exports.CreateWhereQueryFilter = (filterModel, dbFieldMapping, operatorHandlers, key = "channel_partner") => {
    const whereFilter = [];

    let nonDerivedOperator = ['isEmpty', 'isNotEmpty'];

    if (filterModel?.items && filterModel?.items.length) {
        filterModel.items
            .map(({ field, operator, value }) => {

                const dbField = dbFieldMapping(field, nonDerivedOperator?.includes(operator), key);
                const handler = operatorHandlers[operator];

                if (!handler) return null;

                const result = handler(dbField, value);
                console.log("result", result);
                if (result) {
                    whereFilter.push(result)
                }
            })
            .filter(Boolean);
    }
    return whereFilter;
};

exports.filtersJoiObject = Joi.object({
    pageNumber: Joi.number().default(0),
    pageSize: Joi.number().default(100),
    filterModel: Joi.object({
        items: Joi.array().items(
            Joi.object({
                field: Joi.string().required(),
                operator: Joi.string().required(),
                fromInput: Joi.string().allow(null, ""),
                id: Joi.number(),
                value: Joi.alternatives().try(
                    Joi.string().allow('', null),
                    Joi.number().allow(null),
                    Joi.boolean().allow(null),
                    Joi.object({
                        startDate: Joi.string().isoDate().allow(null, ''),
                        endDate: Joi.string().isoDate().allow(null, '')
                    }).allow(null),
                    Joi.array().items(Joi.alternatives().try(Joi.string(), Joi.number())).allow(null)
                ).default(null)
            })
        ).default([]),
    }).default({ items: [] }),
    logicOperator: Joi.string().valid("and", "or").allow(null, ""),
    sortBy: Joi.string().allow(null, ''),
    sortDirection: Joi.string().valid('asc', 'desc').allow(null, ''),
});

exports.uploadToS3FormData = async function (folder, file, t) {
    const { ACCESS_KEY_ID, SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET } = process.env;

    AWS.config.setPromisesDependency(require('bluebird'));
    AWS.config.update({
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
        region: AWS_REGION
    });

    const s3 = new AWS.S3();

    // Determine file extension and content type
    const fileExtension = path.extname(file.name); // e.g., .jpg, .pdf
    const contentType = mime.lookup(file.name) || 'application/octet-stream';

    const key = `${folder}/${t}${fileExtension}`;

    const params = {
        Bucket: S3_BUCKET,
        Key: key,
        Body: file.data, // `file.data` is available via express-fileupload
        ACL: 'public-read',
        ContentType: contentType
    };

    const { Location } = await s3.upload(params).promise();

    return Location;
};

exports.CalculatePayoutAmountMultiplier = (avg_achievment, max_payout_capping, rate, ratio, global_payout_percentage = 0) => {

    let final_rate = rate || 0;
    let final_ratio = ratio || global_payout_percentage;
    if (max_payout_capping) {
        final_ratio = Math.min(final_ratio, max_payout_capping);
    }
    if (avg_achievment) {
        const expected_rate = (avg_achievment * final_ratio) / 100;
        final_rate = rate > 0 ? Math.min(expected_rate, final_rate) : expected_rate
    }

    return ({ final_rate: Number(final_rate.toFixed(4)), final_ratio: Number(final_ratio.toFixed(4)) })
}

exports.CalculatePayoutAmount = ({
    disbursement_amount,
    payout_type,
    payout_rate,
    payout_ratio,
    avg_achievment,
    vendor_payout_rate,
    vendor_payout_ratio,
    payout_collide
}) => {
    /* let payout_collide_value = payout_type?.toLowerCase() === "rate"
        ? vendor_payout_rate
        : vendor_payout_ratio; */

    let vendor_payout_amount = 0;

    //if (!payout_collide) {
    if (payout_type?.toLowerCase() === "ratio" && payout_ratio) {
        vendor_payout_amount = (Number(disbursement_amount) * (Number(payout_ratio) * Number(avg_achievment) / 100)) / 100;
    } else if (payout_type?.toLowerCase() === "rate" && payout_rate) {
        vendor_payout_amount = (Number(disbursement_amount) * Number(payout_rate)) / 100;
    }
    //}

    if (isNaN(vendor_payout_amount)) {
        vendor_payout_amount = 0;
    }

    return {
        vendor_payout_amount,
        payout_collide_value: vendor_payout_rate
    };
};

exports.CalculateSubventionDeduction = ({
    bank_file_subvention_amount,
    bank_file_disbursement_amount,
    avg_achievment,
}) => {
    const subventionAmount = Number(bank_file_subvention_amount);
    const disbursementAmount = Number(bank_file_disbursement_amount);

    if (!subventionAmount || !disbursementAmount || subventionAmount <= 0 || disbursementAmount <= 0) {
        return { subvention_rate: 0, subvention_ratio: 0 };
    }

    const subvention_rate = subventionAmount / disbursementAmount;
    const avg = Number(avg_achievment) || 0;
    const subvention_ratio = avg > 0 ? (subvention_rate / avg) * 100 : 0;

    return {
        subvention_rate: Number(subvention_rate.toFixed(4)),
        subvention_ratio: Number(subvention_ratio.toFixed(4)),
    };
};

exports.ApplySubventionToPayoutCaps = ({
    max_expected_rate,
    max_expected_ratio,
    subvention_rate,
    subvention_ratio,
}) => {
    return {
        max_expected_rate: Math.max(0, Number((Number(max_expected_rate) - Number(subvention_rate)).toFixed(4))),
        max_expected_ratio: Math.max(0, Number((Number(max_expected_ratio) - Number(subvention_ratio)).toFixed(4))),
    };
};

exports.areSlabsNonOverlapping = (slabs) => {
    slabs.sort((a, b) => a.disb_amount_from - b.disb_amount_from);

    for (let i = 0; i < slabs.length; i++) {
        const current = slabs[i];

        if (current.disb_amount_from < 0 || current.disb_amount_to < 0) {
            return false;
        }

        if (current.disb_amount_to < current.disb_amount_from) {
            return false;
        }

        const next = slabs[i + 1];
        if (next && current.disb_amount_to >= next.disb_amount_from) {
            return false;
        }
    }

    return true;
};

exports.getHierarchySalesPerson = (loggedInUser, alias = "c") => {
    const { role, id, materialized_path, materialized_path_depth } = loggedInUser;
    let pathQuery = materialized_path ? `or ${alias}.materialized_path like "%${materialized_path}%" and ${alias}.materialized_path_depth >= ${materialized_path_depth}` : "";

    let query = { sales_query: "" };
    if (this.isSalesAccessRole(role)) {
        query = {
            sales_query: `WITH user_tree AS (SELECT u.id, u.name, u.phone, u.parent, u.dsa_id FROM CRMTest.users u WHERE u.status = 1 AND u.isDeleted = 0 AND u.sales_admin = "${id}")`,
            sales_query_where: `EXISTS (SELECT 1 FROM user_tree ut WHERE (BINARY ${alias}.materialized_path LIKE CONCAT('%', ut.dsa_id, '%') OR ${alias}.salesperson_id = bin_to_uuid(ut.id)))`
        }
    };

    if (role == "TELE_SUPERVISOR") {
        query = {
            sales_query: `WITH RECURSIVE user_tree AS (
            SELECT
              u.id,
              u.name,
              u.parent,
              u.phone,
              CAST(bin_to_uuid(u.id) AS CHAR(200)) AS path
            FROM CRMTest.users u
            WHERE u.id = uuid_to_bin('${id}')
    
            UNION ALL
    
            SELECT
              c.id,
              c.name,
              c.parent,
              c.phone,
              CONCAT(ut.path, ',', bin_to_uuid(c.id))
            FROM CRMTest.users c
            INNER JOIN user_tree ut ON c.parent = ut.id
            WHERE c.status = 1 AND FIND_IN_SET(bin_to_uuid(c.id), ut.path) = 0)`,

            sales_query_where: `(${alias}.salesperson_id in (SELECT bin_to_uuid(id) FROM user_tree) ${pathQuery})`
        }
    };
    return query;
};

exports.getImageUrl = (column) => {
    let baseUrl = 'https://ruloans-bucket.s3.ap-south-1.amazonaws.com/';
    let url = `case when ${column} = "dsaDocuments/" then null else Concat("${baseUrl}", ${column}) end as ${column?.split(".")[1]}`;
    return url;
};

exports.nextDaySkippingSunday = (inputDate) => {
    const d = new Date(inputDate);
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) { // 0 = Sunday
        d.setDate(d.getDate() + 1);
    }
    return d;
};

/**
 * Generate password from customer name and mobile number
 * Logic:
 * 1. If name is "SURESH KUMAR" and mobile is "98X XXX 1234", password will be "sure1234"
 * 2. If name contains initials like "D. K. SURESH" and mobile is "98X XXX 1234", password will be "dksu1234"
 * 3. If first name doesn't have enough (4 letters), take from last name as reference
 * 
 * @param {string} fullName - Customer full name
 * @param {string} mobileNumber - Customer mobile number
 * @returns {string} Generated password
 */
exports.generatePasswordFromNameAndMobile = (fullName, mobileNumber) => {
    if (!fullName || !mobileNumber) {
        throw new Error('Full name and mobile number are required');
    }
    const last4Digits = mobileNumber.toString().slice(-4);
    const cleanName = fullName.trim().toUpperCase();
    const nameParts = cleanName.split(/\s+/);

    let passwordPrefix = '';
    if (nameParts.length === 1) {
        passwordPrefix = nameParts[0].substring(0, 4);
    } else {
        let nameChars = '';

        for (let i = 0; i < nameParts.length; i++) {
            const part = nameParts[i];

            if (part.length <= 2 && (part.length === 1 || part.endsWith('.'))) {
                nameChars += part.charAt(0);
            } else {
                if (nameChars.length < 4) {
                    const charsNeeded = 4 - nameChars.length;
                    nameChars += part.substring(0, Math.min(charsNeeded, part.length));
                }
            }

            if (nameChars.length >= 4) {
                break;
            }
        }

        if (nameChars.length < 4 && nameParts.length > 1) {
            const lastName = nameParts[nameParts.length - 1];
            const remaining = 4 - nameChars.length;
            nameChars += lastName.substring(0, remaining);
        }

        passwordPrefix = nameChars.substring(0, 4);
    }

    passwordPrefix = passwordPrefix.padEnd(4, 'x');
    const password = (passwordPrefix + last4Digits).toLowerCase();
    return password;
};

exports.matchesRegex = function (inputString, regexPattern) {
    const regex = new RegExp("^" + regexPattern + "$");
    return regex.test(inputString);
};

/** Format display name to snake_case (e.g. "Insurance LPP" -> "insurance_lpp"). */
exports.formatEventName = (event_name) => {
    if (!event_name) return null;
    return String(event_name).trim().toLowerCase().replace(/\s+/g, '_');
};

let path = require('path');
const config = require("../../config/config");
const { logger } = require("../../api/helpers/logger");
const { sequelize,_db2 } = require('../db');
let csvToJson = require('convert-csv-to-json');
const { Parser } = require('json2csv');
let randomstring = require("randomstring");
let DSAService = require('../../api/services/dsa-services');
let fs = require('fs');
const xlsx = require('xlsx')
const nodemailer = require('nodemailer');
const { uploadToS3 } = require("../../api/helpers/commonhelper");
const emailValidator = require('deep-email-validator');
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.FROM_EMAIL,
        pass: process.env.EMAIL_PASSWORD
    }
});

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

module.exports = async function (job) {
    try {
        let { base64, sentTo } = job.data;
        const decodedBase64String = Buffer.from(base64, 'base64').toString();
        const filename = await fs.writeFileSync('uploadDsaStep.csv', decodedBase64String)
        let json = csvToJson.fieldDelimiter(',').getJsonFromCsv("uploadDsaStep.csv");
        let idArr = [];
        for (let i = 0; i < json.length; i++) {
            idArr.push(json[i]['"id"'].split('"')[1]);
        }
        const dsa = await DSAService.downloadDsaWithStepWhereIn(idArr);
        for (let i = 0; i < json.length; i++) {
            json[i]['mobile_number'] = json[i]['"mobile_number"'].split('"')[1] ? json[i]['"mobile_number"'].split('"')[1] : json[i]['"mobile_number"'];
            delete json[i]['"mobile_number"'];
            json[i]['id'] = json[i]['"id"'].split('"')[1] ? json[i]['"id"'].split('"')[1] : json[i]['"id"'];
            delete json[i]['"id"'];
            json[i]['name'] = json[i]['"name"'].split('"')[1] ? json[i]['"name"'].split('"')[1] : json[i]['"name"'];
            delete json[i]['"name"'];
            json[i]['email'] = json[i]['"email"'].split('"')[1] ? json[i]['"email"'].split('"')[1] : json[i]['"email"'];
            delete json[i]['"email"'];
            json[i]['sign_up_steps'] = json[i]['"sign_up_steps"'].split('"')[1] ? json[i]['"sign_up_steps"'].split('"')[1] : json[i]['"sign_up_steps"'];
            delete json[i]['"sign_up_steps"'];
            for (let j = 0; j < dsa.length; j++) {
                if (json[i]['id'] == dsa[j].id) {
                    json[i]['new_sign_up_steps'] = dsa[j].sign_up_steps;
                }
            }
        }
        let fields = Object.keys(json[0]);
        for (let i = 0; i < fields.length; i++) {
            fields[i] = fields[i].split('"')[1] ? fields[i].split('"')[1] : fields[i];
        }
        const opts = { fields };
        const parser = new Parser(opts);
        const csv = parser.parse(json);
        await fs.promises.writeFile(appRoot + '/tempDsaStepNew.csv', csv);
        let base64_new = await fs.promises.readFile(appRoot + '/tempDsaStepNew.csv', 'base64')
        let uniqueString = randomstring.generate();
        let uniqueString1 = randomstring.generate();
        let url = await uploadToS3("dsaWithStepsNew", base64_new, uniqueString1 + uniqueString, 'application/octet-stream', 'csv');
        await sendEmail({ to: sentTo, subject: 'Dsa Sign Up Steps Detail File Generated.', body: ` Here is you generated file ${url}.` })
    } catch (e) {
        console.log(e)
    }
};


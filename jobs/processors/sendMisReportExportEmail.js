const { _db2 } = require('../db');
const { QueryTypes } = require('sequelize');
const { Parser } = require('json2csv');
let randomstring = require("randomstring");
const fs = require('fs');
const { sendEmailWithAttachment, uploadToS3, uploadArrayToS3 } = require('../../api/helpers/commonhelper');
const { DSAExportTemplate } = require('../../email-templates/DSAExportTemplate');

module.exports = async function (job) {
    try {
        let { query, queryCount, loggedInUser, bindParams, subject, filename, offset, fileType = null } = job?.data;
        let totalCount;
        console.log(offset, "=====")
        offset = offset || 20000;

        if (bindParams) {
            totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
            totalCount = totalCount[0].totalCount;
        } else {
            totalCount = await _db2.query(queryCount, { type: QueryTypes.SELECT });
            totalCount = totalCount[0].totalCount;
        };

        let dsa = [];
        let urls = [];
        let loopCount = Math.ceil(totalCount / offset);
        for (let i = 0; i < loopCount; i++) {
            let queryTemp = query + ` limit ${i * offset}, ${offset} `;
            let resultTemp;

            if (bindParams) {
                resultTemp = await _db2.query(queryTemp, { replacements: bindParams, type: QueryTypes.SELECT });
            } else {
                resultTemp = await _db2.query(queryTemp, { type: QueryTypes.SELECT });
            };

            dsa = dsa.concat(resultTemp);
            if (dsa.length >= 100000 || i == loopCount - 1) {
                let uniqueString = randomstring.generate();
                let uniqueString1 = randomstring.generate();
                let url = ''
                if (fileType == 'xlsx') {
                    url = await uploadArrayToS3(dsa, filename || `mis_report`);
                }
                else {
                    let fields = Object.keys(dsa[0]);
                    const opts = { fields };
                    const parser = new Parser(opts);
                    const csv = parser.parse(dsa);
                    await fs.promises.writeFile(appRoot + '/temp.csv', csv);
                    let base64 = await fs.promises.readFile(appRoot + '/temp.csv', 'base64')
                    url = await uploadToS3(filename || `mis_report`, base64, uniqueString1 + uniqueString, 'application/octet-stream', 'csv');
                }
                dsa = [];
                urls.push(url);
            }
        }

        sendEmailWithAttachment(null, {
            to: [loggedInUser?.userEmail],//loggedInUser.userEmail,
            subject: subject || ` Combined MIS Report `,
            text: ` Here is your Dsa Export as Requested. `,
            body: DSAExportTemplate(urls)
        }, true);

    } catch (e) {
        console.log(e)
    }
};
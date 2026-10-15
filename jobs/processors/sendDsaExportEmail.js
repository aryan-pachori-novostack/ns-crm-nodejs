const { _db2 } = require('../db');
const { QueryTypes } = require('sequelize');
const { Parser } = require('json2csv');
let randomstring = require("randomstring");
const fs = require('fs');
const { sendEmailWithAttachment, uploadToS3 } = require('../../api/helpers/commonhelper');
const { DSAExportTemplate } = require('../../email-templates/DSAExportTemplate');

module.exports = async function (job) {
    try {
        let { query, loggedInUser, bindParams } = job.data;

        let dsa = [];
        let urls = [];
        let defaultLimit = 10000;
        let currentLimit = defaultLimit;
        let offset = 0;

        while (true) {
            let resultTemp = null;
            let querySuccess = false;
            let maxRetries = 4;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    let queryTemp = query + ` limit ${offset},${currentLimit} `;
                    resultTemp = await _db2.query(queryTemp, { replacements: bindParams || [], type: QueryTypes.SELECT });
                    querySuccess = true;
                    break;
                } catch (queryErr) {
                    console.error(`DSA Export Query failed at offset ${offset} with limit ${currentLimit} (attempt ${attempt}/${maxRetries}):`, queryErr.message || queryErr);
                    currentLimit = Math.floor(currentLimit / 2);
                    if (currentLimit < 500 || attempt === maxRetries) {
                        console.error(`Reached minimum limit or max retries at offset ${offset}. Aborting batch query.`);
                        break;
                    }
                }
            }

            if (!querySuccess || !resultTemp || resultTemp.length === 0) {
                break;
            }

            dsa = dsa.concat(resultTemp);
            offset += currentLimit;

            // If retrieved data is smaller than the requested limit, we have fetched the last batch
            if (resultTemp.length < currentLimit) {
                break;
            }

            currentLimit = defaultLimit;

            if (dsa.length >= 100000) {
                let fields = Object.keys(dsa[0]);
                const opts = { fields };
                const parser = new Parser(opts);
                const csv = parser.parse(dsa);
                await fs.promises.writeFile(appRoot + '/temp.csv', csv);
                let base64 = await fs.promises.readFile(appRoot + '/temp.csv', 'base64');
                let uniqueString = randomstring.generate();
                let uniqueString1 = randomstring.generate();
                let url = await uploadToS3(`channel_partners`, base64, uniqueString1 + uniqueString, 'application/octet-stream', 'csv');
                dsa = [];
                urls.push(url);
            }
        }

        if (dsa.length > 0) {
            let fields = Object.keys(dsa[0]);
            const opts = { fields };
            const parser = new Parser(opts);
            const csv = parser.parse(dsa);
            await fs.promises.writeFile(appRoot + '/temp.csv', csv);
            let base64 = await fs.promises.readFile(appRoot + '/temp.csv', 'base64');
            let uniqueString = randomstring.generate();
            let uniqueString1 = randomstring.generate();
            let url = await uploadToS3(`channel_partners`, base64, uniqueString1 + uniqueString, 'application/octet-stream', 'csv');
            dsa = [];
            urls.push(url);
        }

        if (urls.length > 0) {
            sendEmailWithAttachment(null, {
                to: [loggedInUser?.userEmail],
                subject: ` Dsa Export `,
                text: ` Here is your Dsa Export as Requested. `,
                body: DSAExportTemplate(urls)
            }, true);
        } else {
            console.log("No data exported or URLs generated.");
        }

    } catch (e) {
        console.error("Error in sendDsaExportEmail processor:", e);
    }
};
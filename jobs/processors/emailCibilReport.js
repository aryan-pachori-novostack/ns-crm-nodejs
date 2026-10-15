const { _db2 } = require('../db');
const { QueryTypes } = require('sequelize');
const moment = require('moment');
const { sendEmailWithAttachment } = require('../../api/helpers/commonhelper');
const { CibilReportTemplate } = require('../../email-templates/CibilReportTemplate');
let formattedDate = (date = new Date()) => { return moment(new Date(date)).format("YYYY-MM-DD") };

const dbQuery = async (searial_no, dateQuery) => {
    let query;
    query = `select count(*) as count from cibil_users_transactions where status = "Failure" and ${dateQuery} `;
    let totalFailed = await _db2.query(query, { type: QueryTypes.SELECT });
    query = `select count(*) as count from cibil_users_transactions where status = 'Success' and ${dateQuery} `;
    let totalSuccess = await _db2.query(query, { type: QueryTypes.SELECT });
    query = `select count(*) as count from cibil_users_transactions r where r.status not in ('Failure', 'Success') and ${dateQuery} `;
    let totalPending = await _db2.query(query, { type: QueryTypes.SELECT });
    let obj = {
        serial_no: searial_no,
        frequency: searial_no == 3 ? `YTD (${new Date()?.getFullYear()})` : searial_no == 2 ? `MTD (${new Date().toLocaleDateString('en-us', { month: "long" })})` : `FTD (${formattedDate()})`,
        total_pending: totalPending[0]?.count,
        total_success: totalSuccess[0]?.count,
        total_failed: totalFailed[0]?.count,
    }
    return obj;
};

module.exports = async function (job) {
    try {
        if (process.env.ENVIRONMENT != 'test') {
            const startDate = moment().subtract(1, 'days').toISOString().split('T')[0];
            let resultArr = [];
            let financialYearQuery = ` updated_at >= (CASE
                        WHEN MONTH(CURRENT_DATE) >= 4 THEN DATE_FORMAT(CURRENT_DATE, '%Y-04-01')
                        ELSE DATE_FORMAT(CURRENT_DATE - INTERVAL 1 YEAR, '%Y-04-01')
                     END)
                     AND updated_at < (CASE
                        WHEN MONTH(CURRENT_DATE) >= 4 THEN DATE_FORMAT(CURRENT_DATE + INTERVAL 1 YEAR, '%Y-04-01')
                        ELSE DATE_FORMAT(CURRENT_DATE, '%Y-04-01')
                     END) `;

            resultArr.push(await dbQuery(1, ` DATE(updated_at) = CURRENT_DATE - INTERVAL 1 DAY `));
            resultArr.push(await dbQuery(2, ` MONTH(updated_at) = MONTH(CURRENT_DATE) AND YEAR(updated_at) = YEAR(CURRENT_DATE) `));
            resultArr.push(await dbQuery(3, ` ${financialYearQuery} `));
            // let sendArray = ["tushar.garg@novostack.com", "rohan.bhagde@ruloans.com", "kaushik.mehta@ruloans.com", "balkrishan.sharma@ruloans.com", "Ashwini.reddy@ruloans.com", "akshay.sharma@novostack.com"];
            // let sendArray = ["akshay.sharma@novostack.com"];
            for (let k = 0; k < sendArray.length; k++) {
                await sendEmailWithAttachment(null, {
                    to: sendArray[k],
                    subject: ` Cibil Report for the date ${formattedDate(startDate)} `,
                    text: ` Here is Cibil Report for the date ${formattedDate(startDate)} `,
                    body: CibilReportTemplate(resultArr)
                }, true);
            }
        }

    } catch (e) {
        console.log(e)
    }
};

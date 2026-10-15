const { _db2 } = require('../db');
const { QueryTypes } = require('sequelize');
const moment = require('moment');
const { sendEmailWithAttachment, formatCurrentDate } = require('../../api/helpers/commonhelper');
const { BhReportTemplate } = require('../../email-templates/BhReportTemplate');

function sumSteps(data) {
    let totalAll = {
        signUpStep1: 0,
        signUpStep2: 0,
        signUpStep3: 0,
        signUpStep4: 0,
        signUpStep5: 0,
        signUpStep6: 0,
        total: 0
    };

    // Iterate over each object in the data
    Object.values(data).forEach(obj => {
        // Iterate over each step in the object
        Object.keys(obj).forEach(step => {
            if (step !== 'total') {
                // Add the step value to the totalAll object
                totalAll[step] += obj[step];
            }
        });
    });

    // Calculate the total across all steps
    totalAll.total = Object.values(totalAll).reduce((acc, val) => acc + val, 0);

    return totalAll;
};

const getOnboardingReport = async (startDate, endDate) => {
    let result = {};
    let bindParams = [startDate, endDate];
    let query1 = ` select count(*) as count,IFNULL(utm_main_source, 'null') as utm_main_source from ru_direct_selling_agents where signup_steps_completed = 1 and DATE(created_at) between DATE(?) AND DATE(?) group by utm_main_source `;
    let query2 = ` select count(*) as count,IFNULL(utm_main_source, 'null') as utm_main_source from ru_direct_selling_agents where signup_steps_completed = 2 and DATE(created_at) between DATE(?) AND DATE(?) group by utm_main_source `;
    let query3 = ` select count(*) as count,IFNULL(utm_main_source, 'null') as utm_main_source from ru_direct_selling_agents where signup_steps_completed = 3 and DATE(created_at) between DATE(?) AND DATE(?) group by utm_main_source `;
    let query4 = ` select count(*) as count,IFNULL(utm_main_source, 'null') as utm_main_source from ru_direct_selling_agents where signup_steps_completed = 4 and DATE(created_at) between DATE(?) AND DATE(?) group by utm_main_source `;
    let query5 = ` select count(*) as count,IFNULL(utm_main_source, 'null') as utm_main_source from ru_direct_selling_agents where signup_steps_completed = 5 and DATE(created_at) between DATE(?) AND DATE(?) group by utm_main_source `;
    let query6 = ` select count(*) as count,IFNULL(utm_main_source, 'null') as utm_main_source from ru_direct_selling_agents where signup_steps_completed = 6 and DATE(created_at) between DATE(?) AND DATE(?) group by utm_main_source `;
    let query7 = ` select count(*) as count,IFNULL(utm_main_source, 'null') as utm_main_source from ru_direct_selling_agents where DATE(created_at) between DATE(?) AND DATE(?) group by utm_main_source `;
    let count1 = await _db2.query(query1, { replacements: bindParams, type: QueryTypes.SELECT });
    let count2 = await _db2.query(query2, { replacements: bindParams, type: QueryTypes.SELECT });
    let count3 = await _db2.query(query3, { replacements: bindParams, type: QueryTypes.SELECT });
    let count4 = await _db2.query(query4, { replacements: bindParams, type: QueryTypes.SELECT });
    let count5 = await _db2.query(query5, { replacements: bindParams, type: QueryTypes.SELECT });
    let count6 = await _db2.query(query6, { replacements: bindParams, type: QueryTypes.SELECT });
    let count7 = await _db2.query(query7, { replacements: bindParams, type: QueryTypes.SELECT });
    const allArrays = [count1, count2, count3, count4, count5, count6].flat();
    const allArraysDup = [count1, count2, count3, count4, count5, count6];

    // Calculate total count for each utm_main_source
    const totalCounts = allArrays.reduce((result, item) => {
        const utmSource = item.utm_main_source || 'null';
        result[utmSource] = (result[utmSource] || 0) + item.count;
        return result;
    }, {});

    const keys = Object.keys(totalCounts);
    for (let i = 0; i < keys.length; i++) {
        let total = 0;
        let tempArr = {};
        for (let j = 0; j < allArraysDup.length; j++) {
            for (let k = 0; k < allArraysDup[j].length; k++) {
                // console.log(allArraysDup[j][k],allArraysDup[j][k]['utm_main_source'] == keys[i],keys[i])
                if (!allArraysDup[j][k]['utm_main_source'] || allArraysDup[j][k]['utm_main_source'] == keys[i]) {
                    tempArr[`signUpStep${j + 1}`] = allArraysDup[j][k]['count'];
                    total += allArraysDup[j][k]['count'];
                }

            }
        }
        tempArr['total'] = total;
        const requiredProperties = ['signUpStep1', 'signUpStep2', 'signUpStep3', 'signUpStep4', 'signUpStep5', 'signUpStep6'];

        // Ensure properties exist in the object
        for (const property of requiredProperties) {
            if (!tempArr.hasOwnProperty(property)) {
                tempArr[property] = 0;
            }
        }
        result[keys[i]] = tempArr;
    };
    return result;
};

module.exports = async function (job) {
    try {
        if (Boolean(process.env.ENVIRONMENT != 'test')) {

            let currentDate = new Date();
            let startDate = new Date(currentDate);
            // const startYear = new Date(moment(new Date(0)).startOf('year').toISOString());
            const currentYear = currentDate.getFullYear();
            let startYear = new Date(moment(new Date(`${currentYear}-04-01`)).startOf('day').toISOString());

            startDate.setDate(currentDate.getDate() - 1);
            let formattedDate = moment(startDate).format("DD-MM-YYYY");
            startDate = formatCurrentDate(startDate, 0, 1, 0);

            let endDate = formatCurrentDate(startDate, 23, 59, 0);

            let query = ` select d.dsa_mobile_number, d.email_address from ru_direct_selling_agents d where d.dsa_mobile_number="9987884000" `;
            let users = await _db2.query(query, { type: QueryTypes.SELECT });

            const ftdOnboardingData = await getOnboardingReport(startDate, endDate);
            const ytdOnboardingData = await getOnboardingReport(startYear, endDate);

            if (Object?.keys(ytdOnboardingData)?.length) {
                ytdOnboardingData["Grand Total"] = sumSteps(ytdOnboardingData)
            };

            if (Object?.keys(ftdOnboardingData)?.length) {
                ftdOnboardingData["Grand Total"] = sumSteps(ftdOnboardingData)
            };


            const ftdLntData = [];
            const ytdLntData = [];

            let emailObj = {
                email: users[0]?.email_address,
                onboardingData: [{ ...ftdOnboardingData, frequency: "FTD" }, { ...ytdOnboardingData, frequency: "YTD" }],
                lntData: [{ ...ftdLntData, frequency: "FTD" }, { ...ytdLntData, frequency: "YTD" }],
            };

            // let emailArr = ["tushar.garg@novostack.com"];
            let emailArr = ["tushar.garg@novostack.com", "kaushik.mehta@ruloans.com", "neeraj.singh@novostack.com", "rohan.bhagde@ruloans.com", "pranali.salunke@ruloans.com", "balkrishan.sharma@ruloans.com", "sameer.misra@ruloans.com", "umesh.bankey@ruloans.com"];

            for (let j = 0; j < emailArr.length; j++) {
                sendEmailWithAttachment(null, {
                    to: emailArr[j],
                    subject: ` Daily Report for (${formattedDate}). `,
                    text: ` Here is the daily report for (${formattedDate}). `,
                    body: BhReportTemplate(emailObj?.onboardingData, emailObj?.lntData, "CEO", formattedDate)
                }, true);
            };
        }
    } catch (e) {
        console.log(e)
    }
};
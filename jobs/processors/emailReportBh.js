const { _db2 } = require('../db');
const { QueryTypes } = require('sequelize');
const moment = require('moment');
const { sendEmailWithAttachment, processArrayInChunks, mergeLntChilds, getAllDSA, asyncForEach } = require('../../api/helpers/commonhelper');
const { BhReportTemplate } = require('../../email-templates/BhReportTemplate');
const { getDsaTreeArray } = require('../../api/services/dsa-services');
let DSAService = require(_pathconst.ServicesPath.DSAService);

let formatDate = (date) => {
    let formattedDate = moment(new Date(date)).format("DD-MM-YYYY");
    return formattedDate
};

const getChildPhones = async (number) => {
    let childPhones = [];
    if (number) {
        let getCurrentChilds = await DSAService.getCurrentChildsWhereIn(number);
        childPhones = [number];
        let temp = [];
        for (let i = 0; i < getCurrentChilds.length; i++) {
            temp.push(getCurrentChilds[i].customer_mobile_number)
        }
        childPhones = childPhones.concat(temp);
        if (childPhones.length != 0) getCurrentChilds = await DSAService.getCurrentChildsWhereIn(childPhones);
        temp = [];
        for (let i = 0; i < getCurrentChilds.length; i++) {
            temp.push(getCurrentChilds[i].customer_mobile_number)
        }
        childPhones = childPhones.concat(temp);
        if (childPhones.length != 0) getCurrentChilds = await DSAService.getCurrentChildsWhereIn(childPhones);
        temp = [];
        for (let i = 0; i < getCurrentChilds.length; i++) {
            temp.push(getCurrentChilds[i].customer_mobile_number)
        }
        childPhones = childPhones.concat(temp);
        if (childPhones.length != 0) getCurrentChilds = await DSAService.getCurrentChildsWhereIn(childPhones);
        temp = [];
        for (let i = 0; i < getCurrentChilds.length; i++) {
            temp.push(getCurrentChilds[i].customer_mobile_number)
        }
        childPhones = childPhones.concat(temp);
    }
    return childPhones;
};

const getOnboardingReport = async (bindParams) => {
    let result = {};
    let query1 = ` select count(*) as count from ru_direct_selling_agents where signup_steps_completed = 1 and dsa_mobile_number in (?) and DATE(created_at) between DATE(?) AND DATE(?)  `;
    let query2 = ` select count(*) as count from ru_direct_selling_agents where signup_steps_completed = 2 and dsa_mobile_number in (?) and DATE(created_at) between DATE(?) AND DATE(?) `;
    let query3 = ` select count(*) as count from ru_direct_selling_agents where signup_steps_completed = 3 and dsa_mobile_number in (?) and DATE(created_at) between DATE(?) AND DATE(?) `;
    let query4 = ` select count(*) as count from ru_direct_selling_agents where signup_steps_completed = 4 and dsa_mobile_number in (?) and DATE(created_at) between DATE(?) AND DATE(?) `;
    let query5 = ` select count(*) as count from ru_direct_selling_agents where signup_steps_completed = 5 and dsa_mobile_number in (?) and DATE(created_at) between DATE(?) AND DATE(?) `;
    let query6 = ` select count(*) as count from ru_direct_selling_agents where signup_steps_completed = 6 and dsa_mobile_number in (?) and DATE(created_at) between DATE(?) AND DATE(?) `;
    let query7 = ` select count(*) as count from ru_direct_selling_agents where dsa_mobile_number in (?) and DATE(created_at) between DATE(?) AND DATE(?) `;
    let count1 = await _db2.query(query1, { replacements: bindParams, type: QueryTypes.SELECT });
    let count2 = await _db2.query(query2, { replacements: bindParams, type: QueryTypes.SELECT });
    let count3 = await _db2.query(query3, { replacements: bindParams, type: QueryTypes.SELECT });
    let count4 = await _db2.query(query4, { replacements: bindParams, type: QueryTypes.SELECT });
    let count5 = await _db2.query(query5, { replacements: bindParams, type: QueryTypes.SELECT });
    let count6 = await _db2.query(query6, { replacements: bindParams, type: QueryTypes.SELECT });
    let count7 = await _db2.query(query7, { replacements: bindParams, type: QueryTypes.SELECT });
    result["signUpStep1"] = count1[0].count;
    result["signUpStep2"] = count2[0].count;
    result["signUpStep3"] = count3[0].count;
    result["signUpStep4"] = count4[0].count;
    result["signUpStep5"] = count5[0].count;
    result["signUpStep6"] = count6[0].count;
    result["total"] = count7[0].count;
    return result;
};

const getLntReport = async (phone, startDate, endDate) => {
    let dsaTree = await getDsaTreeArray(phone);
    let dsaSortedArray = getAllDSA(dsaTree);
    let finalArrayDisbursed = [];
    let finalArrayLogin = [];

    let applicationDataDisbursed = await DSAService.getLntDashboardByPhoneNumbers(dsaSortedArray.uniquePhone, false, startDate, endDate);
    const mergedArrayDisbursed = await processArrayInChunks(dsaSortedArray.users, applicationDataDisbursed, 1000)

    finalArrayDisbursed = await mergeLntChilds(mergedArrayDisbursed.filter(e => e.level == 6), mergedArrayDisbursed.filter(e => e.level == 7));

    await asyncForEach([5, 4, 3, 2, 1], async (index, i, array) => {
        finalArrayDisbursed = await mergeLntChilds(mergedArrayDisbursed.filter(e => e.level == index), finalArrayDisbursed, index);
    });
    let applicationDataLogin = await DSAService.getLntDashboardByPhoneNumbers(dsaSortedArray.uniquePhone, false, null, null, startDate, endDate);
    const mergedArrayLogin = await processArrayInChunks(dsaSortedArray.users, applicationDataLogin, 1000)

    finalArrayLogin = await mergeLntChilds(mergedArrayLogin.filter(e => e.level == 6), mergedArrayLogin.filter(e => e.level == 7));

    await asyncForEach([5, 4, 3, 2, 1], async (index, i, array) => {
        finalArrayLogin = await mergeLntChilds(mergedArrayLogin.filter(e => e.level == index), finalArrayLogin, index);
    });

    let login = finalArrayLogin[0];
    let disbursed = finalArrayDisbursed[0];
    delete login?.childs;
    delete disbursed?.childs;

    let result = { disbursed, login };

    return result
};

module.exports = async function (job) {
    try {
        if (process.env.ENVIRONMENT != 'test') {

            let endDate = new Date();

            let startDate = new Date(endDate);
            startDate.setDate(endDate.getDate() - 30);

            startDate = startDate.toISOString();
            endDate = endDate.toISOString();

            let query = ` select d.dsa_mobile_number, d.email_address, r.role from ru_direct_selling_agents d left join CRMTest.users u on d.dsa_mobile_number = u.phone left join CRMTest.roles r on u.role = r.id where r.role = "BUSINESS_HEAD" `;
            let users = await _db2.query(query, { type: QueryTypes.SELECT });
            let emailArr = [];
            // for (i = 0; i < 5; i++) {
            for (i = 0; i < users?.length; i++) {
                let childPhones = await getChildPhones(users[i]?.dsa_mobile_number);
                if (childPhones?.length > 1) {
                    emailArr.push({
                        email: users[i]?.email_address,
                        onboardingData: await getOnboardingReport([childPhones, startDate, endDate]),
                        lntData: await getLntReport(users[i]?.dsa_mobile_number, startDate, endDate)
                    })
                }
            }

            for (let k = 0; k < emailArr?.length; k++) {
                await sendEmailWithAttachment(null, {
                    to: emailArr[k]?.email,
                    subject: ` Monthly Report for (${formatDate(startDate)}) - (${formatDate(endDate)}). `,
                    text: ` Here is the monthly report for (${formatDate(startDate)}) - (${formatDate(endDate)}). `,
                    body: BhReportTemplate(emailArr[k]?.onboardingData, emailArr[k]?.lntData)
                }, true);
            };
        }
    } catch (e) {
        console.log(e)
    }
};
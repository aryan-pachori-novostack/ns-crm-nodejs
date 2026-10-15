const { logger } = require("../../api/helpers/logger");
const { getDsaTreeArray } = require("../../api/services/dsa-services");
const { getAllDSA, mergeBajaCreditCardChilds, uploadJsonToS3 } = require("../../api/helpers/commonhelper");
const DSAService = require("../../api/services/dsa-services");
const moment = require('moment');
const { sequelize } = require("../../models");
const { QueryTypes } = require("sequelize");

module.exports = async function (job) {
    try {
        // let {date } = job.data;
        // let currentDate;
        // if(date){
        //     currentDate = new Date(date)
        // }else{
        //     currentDate = new Date()
        // }
        // currentDate = currentDate.toISOString().split('T')[0];
        // // Get the start date of the current month
        // const startDate = moment(currentDate).startOf('month').toISOString();
        // // Get the end date of the current month
        // const endDate = moment(currentDate).endOf('month').toISOString();
       
        // let dsaTree = await getDsaTreeArray('9987884000');
       
        // let dsaSortedArray = getAllDSA(dsaTree);
        // let finalArray = [];
        // if (!(dsaSortedArray.uniquePhone && dsaSortedArray.uniquePhone.length)) {
        //     return;
        // }

        // let applicationData = await DSAService.getBajajCCDashboardByPhoneNumbers(dsaSortedArray.uniquePhone, false, startDate, endDate, null, null, true);
        // const mergedArray = dsaSortedArray.users.map((item) => {
        //     const match = applicationData.find((obj) => {
        //         return obj.dsa_mobile_number === item.phone;
        //     });
        //     return { ...item, ...match };
        // });

        // finalArray = mergeBajaCreditCardChilds(mergedArray.filter(e => e.level == 6), mergedArray.filter(e => e.level == 7));
        // finalArray = mergeBajaCreditCardChilds(mergedArray.filter(e => e.level == 5), finalArray);
        // finalArray = mergeBajaCreditCardChilds(mergedArray.filter(e => e.level == 4), finalArray);
        // finalArray = mergeBajaCreditCardChilds(mergedArray.filter(e => e.level == 3), finalArray);
        // finalArray = mergeBajaCreditCardChilds(mergedArray.filter(e => e.level == 2), finalArray);
        // finalArray = mergeBajaCreditCardChilds(mergedArray.filter(e => e.level == 1), finalArray);
        // finalArray = finalArray?.sort((a, b) => (a.total_approved > b.total_approved ? -1 : 1));

        // let link = await uploadJsonToS3({ data: finalArray });
        // let query = ` insert into report_files(date,type,link,created_at,updated_at) values(?,?,?,now(),now())`;
        // let bindParams = [currentDate, "bajaj_credit_card", link];
        // await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    } catch (err) {
        logger.error(err);
    }
};
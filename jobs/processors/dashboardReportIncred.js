let path = require('path');
const config = require("../../config/config");
const { logger } = require("../../api/helpers/logger");
const { sequelize, _db2 } = require('../db');
const { QueryTypes } = require('sequelize');
const moment = require('moment');
const { getDsaTreeArray } = require("../../api/services/dsa-services");
const { uploadToS3, getDsaMobileNumbers, mergeLntChilds, mergeIndifiChilds, sortDSATreeArray, getAllDSA, mergeBajaCreditCardChilds, processArrayInChunks, asyncForEach, uploadJsonToS3Incred, readJsonFromS3 } = require("../../api/helpers/commonhelper");
const DSAService = require("../../api/services/dsa-services");

module.exports = async function (job) {
  try {

    let { date } = job.data;
    let currentDate;
    if (date) {
      currentDate = new Date(date)
    } else {
      currentDate = new Date()
    }
    // Get the start date of the current month
    const startDate = moment(currentDate).startOf('month').toISOString();

    // Get the end date of the current month
    const endDate = moment(currentDate).endOf('month').toISOString();
    console.log('****2Current Date', currentDate)
    console.log('Start Date:', startDate);
    console.log('End Date:', endDate);

    currentDate = currentDate.toISOString().split('T')[0];

    let dsaTree = await getDsaTreeArray('9987884000');
    let dsaSortedArray = getAllDSA(dsaTree);
    let finalArrayDisbursed = [];
    let finalArrayLogin = [];
    //console.log("here",dsaSortedArray)
    console.log("###1", '9987884000', new Date())
    if (!(dsaSortedArray && dsaSortedArray.uniquePhone.length)) {

    } else {

      let applicationDataDisbursed = await DSAService.getIncredDashboardByPhoneNumbers(dsaSortedArray.uniquePhone, false, startDate, endDate, null, null, true);

      if (applicationDataDisbursed?.length) {
        const mergedArrayDisbursed = await processArrayInChunks(dsaSortedArray.users, applicationDataDisbursed, 1000)

        finalArrayDisbursed = await mergeLntChilds(mergedArrayDisbursed.filter(e => e.level == 6), mergedArrayDisbursed.filter(e => e.level == 7));

        await asyncForEach([5, 4, 3, 2, 1], async (index, i, array) => {
          finalArrayDisbursed = await mergeLntChilds(mergedArrayDisbursed.filter(e => e.level == index), finalArrayDisbursed, index);
        });
      };
      
      let applicationDataLogin = await DSAService.getIncredDashboardByPhoneNumbers(dsaSortedArray.uniquePhone, false, null, null, startDate, endDate, true);

      if (applicationDataLogin?.length) {
        const mergedArrayLogin = await processArrayInChunks(dsaSortedArray.users, applicationDataLogin, 1000)

        finalArrayLogin = await mergeLntChilds(mergedArrayLogin.filter(e => e.level == 6), mergedArrayLogin.filter(e => e.level == 7));

        await asyncForEach([5, 4, 3, 2, 1], async (index, i, array) => {
          finalArrayLogin = await mergeLntChilds(mergedArrayLogin.filter(e => e.level == index), finalArrayLogin, index);
        });
      };
    };
    //await MongoServices.insertData(currentDate,{disbursed:finalArrayDisbursed,login:finalArrayLogin});
    console.log("****23here")
    let link = await uploadJsonToS3Incred({ disbursed: finalArrayDisbursed, login: finalArrayLogin })
    console.log("link")
    let query = ` insert into incred_report_files(date,link,created_at,updated_at) values(?,?,now(),now())`;
    let bindParams = [currentDate, link];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
  } catch (e) {
    console.log(e)
    logger.error(e)
  }
};


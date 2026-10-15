const { logger } = require("../../api/helpers/logger");
const { getDsaTreeArray } = require("../../api/services/dsa-services");
const { getAllDSA, uploadJsonToS3, mergeIndifiChilds, processArrayInChunks, asyncForEach } = require("../../api/helpers/commonhelper");
const DSAService = require("../../api/services/dsa-services");
const moment = require('moment');
const { sequelize } = require("../../models");
const { QueryTypes } = require("sequelize");

module.exports = async function (job) {
    try {
        let { date } = job.data;
        let currentDate;
        if (date) {
            currentDate = new Date(date)
        } else {
            currentDate = new Date()
        }
        currentDate = currentDate.toISOString().split('T')[0];
        // Get the start date of the current month
        const startDate = moment(currentDate).startOf('month').toISOString();
        // Get the end date of the current month
        const endDate = moment(currentDate).endOf('month').toISOString();
        let dsaTree = await getDsaTreeArray('9987884000');
        let dsaSortedArray = getAllDSA(dsaTree);
        let finalArrayDisbursed = [];
        let finalArrayLogin = [];
        if (!(dsaSortedArray && dsaSortedArray.uniquePhone.length)) {
            return
        } else {
            let applicationDataDisbursed = await DSAService.getIndifiDashboardByPhoneNumbers(dsaSortedArray.uniquePhone, false, startDate, endDate, null, null, true);

            if (applicationDataDisbursed?.length) {
                const mergedArrayDisbursed = await processArrayInChunks(dsaSortedArray.users, applicationDataDisbursed, 1000)

                finalArrayDisbursed = await mergeIndifiChilds(mergedArrayDisbursed.filter(e => e.level == 6), mergedArrayDisbursed.filter(e => e.level == 7));

                await asyncForEach([5, 4, 3, 2, 1], async (index, i, array) => {
                    finalArrayDisbursed = await mergeIndifiChilds(mergedArrayDisbursed.filter(e => e.level == index), finalArrayDisbursed, index);
                });
            };

            let applicationDataLogin = await DSAService.getIndifiDashboardByPhoneNumbers(dsaSortedArray.uniquePhone, false, null, null, startDate, endDate, true);

            if (applicationDataLogin?.length) {
                const mergedArrayLogin = await processArrayInChunks(dsaSortedArray.users, applicationDataLogin, 1000)

                finalArrayLogin = await mergeIndifiChilds(mergedArrayLogin.filter(e => e.level == 6), mergedArrayLogin.filter(e => e.level == 7));

                await asyncForEach([5, 4, 3, 2, 1], async (index, i, array) => {
                    finalArrayLogin = await mergeIndifiChilds(mergedArrayLogin.filter(e => e.level == index), finalArrayLogin, index);
                });
            };

            let link = await uploadJsonToS3({ disbursed: finalArrayDisbursed, login: finalArrayLogin });

            let query = `insert into report_files(date,type,link,created_at,updated_at) values(?,?,?,now(),now())`;
            let bindParams = [currentDate, "indifi", link];
            await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
        }

    } catch (err) {
        logger.error(err);
    }
};
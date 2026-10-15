const moment = require('moment');
const randomstring = require('randomstring');
const { logger } = require("../../api/helpers/logger");
let DSAService = require("../../api/services/dsa-services");
const { sequelize,_db2,_db5 } = require('../db');
const { QueryTypes } = require('sequelize');
const fs = require('fs').promises;
const { uploadToS3, mergeLntChilds, getAllDSA, processArrayInChunks, asyncForEach, sendEmailWithAttachment } = require("../../api/helpers/commonhelper");
const { generatePDF } = require('../../api/helpers/GeneratePdf');

module.exports = async function (job) {
    try {
        if (process.env.ENVIRONMENT != 'test' ||true) {
            let currentDate = new Date();
            let prevDate = new Date();
            let query = ` select * from lnt_email_count where date = ? `;
            let queryDate = currentDate.toISOString().split('T')[0];
            let bindParams = [queryDate]
            let count = await _db5.query(query,{replacements:bindParams,type:QueryTypes.SELECT});
            console.log("###43",count)
            if(count[0]){
                return;
            }else{
                query = ` insert into lnt_email_count(date,count) values(?,?) `;
                bindParams = [queryDate,1];
                await sequelize.query(query,{replacements:bindParams,type:QueryTypes.INSERT})
                console.log("here i am ", new Date())
                
                prevDate.setDate(prevDate.getDate() - 1);
                const currentDay = currentDate.getDate();
                const currentMonth = currentDate.getMonth() + 1; // Months are zero-based, so January is 0
                const currentYear = currentDate.getFullYear();
                let presentDate = `${currentYear}-${currentMonth}-${currentDay}`
    
                const prevDateDay = prevDate.getDate();
                const prevDateMonth = prevDate.getMonth() + 1; // Months are zero-based, so January is 0
                const prevDateYear = prevDate.getFullYear();
    
                prevDate = `${prevDateYear}-${prevDateMonth}-${prevDateDay}`;
                let prevDataShow = `${prevDateDay}-${prevDateMonth}-${prevDateYear}`;
                console.log(prevDate)
                currentDate = moment(currentDate).endOf('month').toISOString();
    
                // Get the end date of the current month
                const startDateOfMonth = moment(currentDate).startOf('month').toISOString();
                let dsaTree = await DSAService.getDsaTreeArray('9987884000');
                let dsaSortedArray = getAllDSA(dsaTree);
                let finalArray = [];
                let finalArrayDaily = [];
                //console.log("here",dsaSortedArray)
                console.log("###1", '9987884000', new Date())
                if (!(dsaSortedArray && dsaSortedArray.uniquePhone.length)) {
                    console.log("Here Nothing Happend")
                } else {
    
                    let applicationData = await DSAService.getLntDashboardByPhoneNumbers(dsaSortedArray.uniquePhone, false, new Date(startDateOfMonth).toISOString(), new Date(currentDate).toISOString());
                    let applicationDataDaily = await DSAService.getLntDashboardByPhoneNumbers(dsaSortedArray.uniquePhone, false, prevDate);
                    console.log("I am here 123")
    
                    const mergedArray = await processArrayInChunks(dsaSortedArray.users, applicationData, 1000)
                    const mergedArrayDaily = await processArrayInChunks(dsaSortedArray.users, applicationDataDaily, 1000)
    
    
                    finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == 6), mergedArray.filter(e => e.level == 7));
    
    
                    await asyncForEach([5, 4, 3, 2, 1], async (index, i, array) => {
                        finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == index), finalArray, index);
                    });
    
                    finalArrayDaily = await mergeLntChilds(mergedArrayDaily.filter(e => e.level == 6), mergedArrayDaily.filter(e => e.level == 7));
    
    
                    await asyncForEach([5, 4, 3, 2, 1], async (index, i, array) => {
                        finalArrayDaily = await mergeLntChilds(mergedArrayDaily.filter(e => e.level == index), finalArrayDaily, index);
                    });
                    let tempData = [];
                    let childs = finalArray[0]?.childs;
                    delete finalArray[0].childs;
                    tempData.push(finalArray[0]);
                    for (let k = 0; k < childs.length; k++) {
                        delete childs[k].childs;
                        tempData.push(childs[k])
                    }
                    tempData.sort((a, b) => b.total_disbursed_amount - a.total_disbursed_amount);
    
                    let tempDataDaily = [];
                    let childsDaily = finalArrayDaily[0]?.childs;
                    delete finalArrayDaily[0].childs;
                    tempDataDaily.push(finalArrayDaily[0]);
                    for (let k = 0; k < childsDaily.length; k++) {
                        delete childsDaily[k].childs;
                        tempDataDaily.push(childsDaily[k])
                    }
                    for (let i = 0; i < tempData.length; i++) {
                        tempData[i]['total_disbursed_daily'] = 0;
                    }
                    for (let i = 0; i < tempData.length; i++) {
                        for (let j = 0; j < tempDataDaily.length; j++) {
                            if (tempData[i]['phone'] == tempDataDaily[j]['phone']) {
                                tempData[i]['total_disbursed_daily'] = tempDataDaily[j]['total_disbursed_amount']
                            }
                        }
                        try {
                            const pdfBuffer = await generatePDF("lntEmailReport", { data: tempData, prevDate: prevDataShow });
    
                            await fs.writeFile(appRoot + 'reportLnt.pdf', pdfBuffer);
                            const base64String = await pdfBuffer.toString('base64');
    
                            // Implement your S3 upload logic here
                            // Example:
                            let url = await uploadToS3("lnt_report_email", base64String, randomstring.generate() + randomstring.generate(), 'application/pdf', 'pdf');
                            let attachments = [
                                {   // use URL as an attachment
                                    filename: 'MIS_LNT_REPORT.pdf',
                                    path: url
                                }
                            ]
                            let sendArray = [  'neeraj.singh@novostack.com'];//['kaushik.mehta@ruloans.com', 'ashwini.reddy@ruloans.com', 'rohan.bhagde@ruloans.com', 'neeraj.singh@novostack.com'];
                            for (let k = 0; k < sendArray.length; k++) {
                                await sendEmailWithAttachment(attachments, {
                                    to: sendArray[k],
                                    subject: ` Mis Lnt Report for the date ${presentDate}`,
                                    text: ` Here is MIS LNT REPORT For the Day ${presentDate} `,
                                });
                            }
                        } catch (err) {
                            logger.error(e)
                            ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
                        }
                    };
                }
            }
           
        };
    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};


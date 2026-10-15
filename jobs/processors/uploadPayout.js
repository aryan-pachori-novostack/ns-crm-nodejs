const { logger } = require("../../api/helpers/logger");
const { sequelize } = require('../db');
const { QueryTypes } = require('sequelize');
const { uploadArrayToS3, getProductInfo, jsonDifference } = require("../../api/helpers/commonhelper");
const { v4: uuid } = require('uuid');
const xlsx = require('xlsx');
const { bulkCreate } = require("../../api/services/application-log-services");


const addSlabs = async (id, json) => {
    let query = ` select * from payouts where payout_uuid = ? `;
    let bindParams = [id];
    let payout = await _db7.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    payout = payout[0];
    //console.log(id,payout)
    for (let i = 1; i <= 10; i++) {
        if (json[`Payout_Rate_${i}`]) {
            let rate = json[`Payout_Rate_${i}`]//parseFloat(json[`Payout_Rate_${i}`]) * 100;
            let disb_amount_from = parseInt(json[`Disb_Amt_${i}_From`]);
            let disb_amount_to = parseInt(json[`Disb_Amt_${i}_To`]);
            query = ` insert into payout_slabs (payout_id,rate,disb_amount_from,disb_amount_to) values(?,?,?,?) `;
            bindParams = [payout.id, rate, disb_amount_from ? disb_amount_from : 0, disb_amount_to ? disb_amount_to : 0];
            await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
        }
    }

}

function excelDateToJSDate(date) {
    return new Date(Math.round((date - 25569) * 86400 * 1000));
}


module.exports = async function (job) {
    try {
        let { file, loggedInUser } = job.data;
        let query = null;
        const buf = Buffer.from(file, 'base64')
        const sheet = await xlsx.read(buf, { type: 'buffer' })
        await xlsx.writeFile(sheet, "uploadPayout.xlsx");
        const fileData = xlsx.readFile('uploadPayout.xlsx');
        let sheetNames = fileData.SheetNames;
        let faliureCount = 0;
        let payoutDetailsError = [];

        let error = '';
        const json = xlsx.utils.sheet_to_json(fileData.Sheets[sheetNames[0]]);
        for (let i = 0; i < json.length; i++) {
            try {
                error = '';
                if (json[i]['Applicable_Month_From']) json[i]['Applicable_Month_From'] = excelDateToJSDate(json[i]['Applicable_Month_From'])
                if (json[i]['Applicable_Month_To']) json[i]['Applicable_Month_To'] = excelDateToJSDate(json[i]['Applicable_Month_To'])
                if (json[i]['Month_Start_from']) json[i]['Month_Start_from'] = json[i]['Month_Start_from']
                if (json[i]['Month_Ends_on']) json[i]['Month_Ends_on'] = json[i]['Month_Ends_on']
                if (json[i]['Average_Payout_Percentage']) json[i]['Average_Payout_Percentage'] = parseFloat(json[i]['Average_Payout_Percentage']) * 100;
                if (json[i]['Minimum_PF']) json[i]['Minimum_PF'] = json[i]['Minimum_PF'];
                if (json[i]['Minimum_IRR']) json[i]['Minimum_IRR'] = json[i]['Minimum_IRR'];
                if (json[i]['Minimum_Insurance']) json[i]['Minimum_Insurance'] = json[i]['Minimum_Insurance'];
                if (json[i]['Bank_Internal_Id']) json[i]['Bank_Internal_Id'] = json[i]['Bank_Internal_Id'];
                if (json[i]['Product_Id']) json[i]['Product_Id'] = json[i]['Product_Id'];
                if (json[i]['Agreement_Expired_By']) {
                    json[i]['Agreement_Expired_By'] = new Date(json[i]['Agreement_Expired_By'])
                }
                if (json[i]['Enrollment_Date']) {
                    json[i]['Enrollment_Date'] = new Date(json[i]['Enrollment_Date'])
                }
                if (!json[i]['Bank_Internal_Id']) {
                    json[i]['Bank_Internal_Id'] = '';
                    error = `Bank Internal Id Is Mandatory Field . `
                    let tempR = json[i];
                    tempR.error = error;
                    faliureCount++;
                    payoutDetailsError.push(tempR)
                    continue;
                }
                if (!json[i]['Product_Id']) {
                    json[i]['Product_Id'];
                    error = `Product Id Is Mandatory Field . `
                    let tempR = json[i];
                    tempR.error = error;
                    faliureCount++;
                    payoutDetailsError.push(tempR)
                    continue;
                }
                if (!json[i]['Product']) {//product is sub_product
                    error = ` Sub Product Is Mandatory Field . `
                    let tempR = json[i];
                    tempR.error = error;
                    faliureCount++;
                    payoutDetailsError.push(tempR)
                    continue;
                }
                let id = parseInt(json[i]['ID']);
                let productInfo = getProductInfo(json[i]['Product']);
                if (!productInfo) {
                    json[i]['Main_Product'] = null;
                    json[i]['Product_Group'] = null;
                } else {
                    json[i]['Main_Product'] = productInfo['Main_Product'];
                    json[i]['Product_Group'] = productInfo['Product_Group'];
                }
                if (id) {
                    let payout_query = ` select * from payouts where id = ? `;
                    let payout_bindParams = [id];
                    let payout = await _db7.query(payout_query, { replacements: payout_bindParams, type: QueryTypes.SELECT });
                    payout = payout[0];
                    let { agreement_expired_by, enrollment_date, created_at, ...rest } = payout;
                    if (payout) {
                        query = ` delete from payout_slabs where payout_id = ? `;
                        bindParams = [payout.id];
                        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.DELETE });
                        query = `  update payouts set bank_name =? ,bank_id = ?, product_id = ?,registered_on_company_name =? ,main_product =? ,sub_product =? ,product_group =? ,agreement_expired_by =? ,enrollment_date =? ,billing_mode =? ,login_code =? ,product =? ,address =? ,max_payout =? ,billing_date_from =? ,billing_date_to =? ,applicable_from =? ,applicable_to =? ,remarks =?   ,updated_at =? ,avg_achievment =? ,short_name =?, type = ?, company_category = ?, billing_cycle = ?, payment_term = ?, minimum_pf = ?, minimum_irr = ?, minimum_insurance = ?, link = ?, updated_at = ?   where id = ? `;
                        bindParams = [json[i]['Bank_Name'] || "", json[i]['Bank_Internal_Id'], json[i]['Product_Id'], json[i]['Registered_on_Company_Name'] || "", json[i]['Main_Product'] || "", json[i]['Sub_Product_Group'] || "", json[i]['Product_Group'] || "", json[i]['Agreement_Expired_By'] || "", json[i]['Enrollment_Date'] || "", json[i]['Billing_Mode'] || "", json[i]['Login_Code'] || "", json[i]['Product'] || "", json[i]['address'] || "", json[i]['Max_Payout_for_Single_Case'] || "", json[i]['Month_Start_from'] || "", json[i]['Month_Ends_on'] || "", json[i]['Applicable_Month_From'] || "", json[i]['Applicable_Month_To'] || "", json[i]['Remark'] || "", new Date(), json[i]['Average_Payout_Percentage'] || "", json[i]['short_name'] || "", json[i]['Payout_Type'] || "", json[i]['Company_Category'] || "", json[i]['billing_cycle'] || "", json[i]['Payment_Term'] || "", json[i]['Minimum_PF'] || "", json[i]['Minimum_IRR'] || "", json[i]['Minimum_Insurance'] || "", json[i]['Link'] || "", new Date(), id];
                        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });

                        let payout_new = await _db7.query(payout_query, { replacements: payout_bindParams, type: QueryTypes.SELECT });
                        payout_new = payout_new[0];

                        let { agreement_expired_by, enrollment_date, created_at, updated_at, ...rest_new } = payout_new;
                        await bulkCreate(jsonDifference(rest, rest_new), payout.id, "payout", loggedInUser?.id);
                        addSlabs(payout.payout_uuid, json[i]);
                    } else {
                        let uid = uuid();
                        query = `  insert into payouts ( payout_uuid,bank_name ,bank_id,product_id,registered_on_company_name ,main_product ,sub_product ,product_group ,agreement_expired_by ,enrollment_date ,billing_mode ,login_code ,product ,address ,max_payout ,billing_date_from ,billing_date_to ,applicable_from ,applicable_to ,remarks   ,updated_at,created_at ,avg_achievment ,short_name, type, company_category, billing_cycle, payment_term, minimum_pf, minimum_irr, minimum_insurance, link) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) `;
                        bindParams = [uid, json[i]['Bank_Name'] || "", json[i]['Bank_Internal_Id'], json[i]['Product_Id'], json[i]['Registered_on_Company_Name'] || "", json[i]['Main_Product'] || "", json[i]['Sub_Product_Group'] || "", json[i]['Product_Group'] || "", json[i]['Agreement_Expired_By'] || "", json[i]['Enrollment_Date'] || "", json[i]['Billing_Mode'] || "", json[i]['Login_Code'] || "", json[i]['Product'] || "", json[i]['address'] || "", json[i]['Max_Payout_for_Single_Case'] || "", json[i]['Month_Start_from'] || "", json[i]['Month_Ends_on'] || "", json[i]['Applicable_Month_From'] || "", json[i]['Applicable_Month_To'] || "", json[i]['Remark'] || "", new Date(), new Date(), json[i]['Average_Payout_Percentage'] || "", json[i]['short_name'] || "", json[i]['Payout_Type'] || "", json[i]['Company_Category'] || "", json[i]['billing_cycle'] || "", json[i]['Payment_Term'] || "", json[i]['Minimum_PF'] || "", json[i]['Minimum_IRR'] || "", json[i]['Minimum_Insurance'] || "", json[i]['Link'] || ""];
                        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

                        await ApplicationLogServices.bulkCreate([["payout", "", "created"]], payout.id, "payout", loggedInUser?.id);
                        await addSlabs(uid, json[i]);
                    }
                } else {
                    let uid = uuid();
                    query = `  insert into payouts (  payout_uuid,bank_name,bank_id,product_id ,registered_on_company_name ,main_product ,sub_product ,product_group ,agreement_expired_by ,enrollment_date ,billing_mode ,login_code ,product ,address ,max_payout ,billing_date_from ,billing_date_to ,applicable_from ,applicable_to ,remarks  ,updated_at,created_at ,avg_achievment ,short_name, type, company_category, billing_cycle, payment_term, minimum_pf, minimum_irr, minimum_insurance, link,status) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) `;
                    bindParams = [uid, json[i]['Bank_Name'] || "", json[i]['Bank_Internal_Id'], json[i]['Product_Id'], json[i]['Registered_on_Company_Name'] || "", json[i]['Main_Product'] || "", json[i]['Sub_Product_Group'] || "", json[i]['Product_Group'] || "", json[i]['Agreement_Expired_By'] || "", json[i]['Enrollment_Date'] || "", json[i]['Billing_Mode'] || "", json[i]['Login_Code'] || "", json[i]['Product'] || "", json[i]['address'] || "", json[i]['Max_Payout_for_Single_Case'] || "", json[i]['Month_Start_from'] || "", json[i]['Month_Ends_on'] || "", json[i]['Applicable_Month_From'] || "", json[i]['Applicable_Month_To'] || "", json[i]['Remark'] || "", new Date(), new Date(), json[i]['Average_Payout_Percentage'] || "", json[i]['short_name'] || "", json[i]['Payout_Type'] || "", json[i]['Company_Category'] || "", json[i]['billing_cycle'] || "", json[i]['Payment_Term'] || "", json[i]['Minimum_PF'] || "", json[i]['Minimum_IRR'] || "", json[i]['Minimum_Insurance'] || "", json[i]['Link'] || "", json[i]['Status'] || ""];
                    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

                    await ApplicationLogServices.bulkCreate([["payout", "", "created"]], payout.id, "payout", loggedInUser?.id);
                    await addSlabs(uid, json[i]);
                }
                payoutDetailsError.push({ ...json[i], error: '' });
            } catch (err) {
                error = err.message;
                logger.error(`Payout Upload Error ${i}: ${err.message}`)
                json[i].error = `Error Into The Data Provided. Please Provide all the Mandatory Fields and all fields in desired format`;
                faliureCount++;
                console.log(err)
                logger.error(err)
            }

        }
        let file_name = await uploadArrayToS3(payoutDetailsError);
        query = ` insert into application_logs (application_type, application_id, field,from_value,to_value,updated_by, createdAt, updatedAt) values ('payout_upload',?,?,?,?,uuid_to_bin(?),?,?) `
        await sequelize.query(query, { replacements: ['', file_name, json.length - faliureCount, faliureCount, loggedInUser.id, new Date(), new Date()], type: QueryTypes.INSERT });
    } catch (e) {
        console.log(e)
    }
};


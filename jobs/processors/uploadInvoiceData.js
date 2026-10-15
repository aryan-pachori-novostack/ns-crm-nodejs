let path = require('path');
const config = require("../../config/config");
const { logger } = require("../../api/helpers/logger");
const { uploadArrayToS3, validatePan } = require("../../api/helpers/commonhelper");
const { sequelize, _db2 } = require('../db');
const { format, parse } = require('date-fns');
const { QueryTypes } = require('sequelize');
let fs = require('fs');
let uuid = require('node-uuid');
const ist_time_zone = 'Asia/Kolkata';
const xlsx = require('xlsx');
const { findBankNameById, findProductNameById } = require('../../api/services/lead-services');
const { da } = require('date-fns/locale');
function parseDateFromString(dateString) {
    const [day, month, year] = dateString.split('/');
    // Note: Months are zero-based in JavaScript Date object, so we subtract 1
    return new Date(year, month - 1, day);
}
function trimObject(arr) {
    let arrTemp = [];
    for(let i=0;i<arr.length;i++){
        let obj = arr[i];
        if (typeof obj !== 'object' || obj === null) {
            return obj;
          }
        
          const trimmedObject = {};
        
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              const trimmedKey = key.trim();
              const value = obj[key];
              //console.log(value)
              const trimmedValue = typeof value == 'string' ? value.trim() : value;
        
              trimmedObject[trimmedKey] = trimmedValue;
            }
         }   
        
        arrTemp.push(trimmedObject)   
    }
    
    return arrTemp;
  }

function formatDateToCustomString(date) {
    const options = { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    return date.toLocaleDateString('en-US', options).replace(/,/g, '');
}


function isValidDateFormat(inputString) {
    // Define a regular expression for DD/MM/YYYY format
    const dateFormatRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;

    // Test if the input string matches the defined format
    return dateFormatRegex.test(inputString);
}

function parseDateFromString(dateString) {
    const [day, month, year] = dateString.split('/');
    // Note: Months are zero-based in JavaScript Date object, so we subtract 1
    return new Date(year, month - 1, day);
}


module.exports = async function (job) {
    try {
        let query;
        let bindParams;
        let count = [];
        let { data, user, result, file_name} = job.data;
        console.log(job.data)
        data = trimObject(data)
        let successCount = 0;
        let faliureCount = 0;
        let userDetailsError = [];
       
        for (let i = 0; i < data.length; i++) {
            try {

                let error = null;

                let invoice_id = uuid();


                if (!data[i].vendor_pan) {
                    error = `Vendor Pan Is Mandatory Field . `
                    let tempR = data[i];
                    tempR.error = error;
                    faliureCount++;
                    userDetailsError.push(tempR)
                    continue;
                }
                if (data[i]?.vendor_pan && !validatePan(data[i]?.vendor_pan)) {
                    error = `Vendor Pan Is Invalid . `
                    let tempR = data[i];
                    tempR.error = error;
                    faliureCount++;
                    userDetailsError.push(tempR)
                    continue;
                }
                if (!data[i].class) {
                    error = `Vendor Class Is Mandatory Field . `
                    let tempR = data[i];
                    tempR.error = error;
                    faliureCount++;
                    userDetailsError.push(tempR)
                    continue;
                }
                if (!data[i].base_payout_amount || isNaN(parseFloat(data[i].base_payout_amount))) {
                    error = `Base Payout Amount Is Mandatory Field And Must be a Number. `
                    let tempR = data[i];
                    tempR.error = error;
                    faliureCount++;
                    userDetailsError.push(tempR)
                    continue;
                }
                if (!data[i].transaction_date) {
                    error = ` Transaction Date is  Mandatory Field . `
                    let tempR = data[i];
                    tempR.error = error;
                    faliureCount++;
                    userDetailsError.push(tempR)
                    continue;
                }

                let transaction_date = data[i].transaction_date?parseDateFromString(data[i].transaction_date):null;                                                   
                let vendor_pan = data[i].vendor_pan;                                                  
                let vendor_class = data[i].class;                                               
                let vendor_name = data[i].vendor_name;                                                 
                let base_payout_amount = data[i].base_payout_amount;                                         
                let created_by  = user.id;
                let expense_category  = data[i].expense_category;
    

                let bindParams = [vendor_pan];
                let query = `  select rdsa.dsa_mobile_number as mobile_number , rdsa.email_address as email_address,rdsa.company_name as company_name , rdsa.gstin, rdsa.full_name as name, rdsa.gst_registration_type as gst_registration_type,rdsa.home_address_house_number as address_house_number,rdsa.home_address_area as address_area,rdsa.home_address_city as address_city,rdsa.home_address_state as address_state,rdsa.home_address_pincode as address_pincode from ru_direct_selling_agents rdsa left join ru_dsa_kyc_data rdkd on rdsa.dsa_id = rdkd.dsa_id where rdkd.permanent_account_number = ? `;
                let vendor = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
                vendor = vendor[0];
                if(!vendor){
                    error = ` Vendor  is  Not Present In the System . `
                    let tempR = data[i];
                    tempR.error = error;
                    faliureCount++;
                    userDetailsError.push(tempR)
                    continue;
                }

                if(!expense_category){
                    error = ` Expense Category Is Mandatory . `
                    let tempR = data[i];
                    tempR.error = error;
                    faliureCount++;
                    userDetailsError.push(tempR)
                    continue;
                }

                let supply_type = vendor.address_state == 'Maharashtra' ? 'IntraState' :  'Interstate' ;
                let gst_registration_type = vendor.gst_registration_type;
                let place_of_supply = 'Maharashtra';
                let cgst_percentage = 9;
                let sgst_percentage = 9;
                let igst_percentage = 18;
                let cgst_amount = vendor.gstin? (supply_type == 'IntraState' ? (9/100)* base_payout_amount : 0 ): 0;
                let sgst_amount = vendor.gstin? (supply_type == 'IntraState' ? (9/100)* base_payout_amount : 0 ): 0;
                let igst_amount = vendor.gstin? (supply_type == 'IntraState' ?  0 : (18/100)* base_payout_amount ): 0;

                let vendor_mobile_number = vendor.mobile_number;
                let vendor_email_address = vendor.email_address;
                let vendor_company_name = vendor.company_name;
                let vendor_gstin = vendor.gstin;
                let vendor_full_name = vendor.name;
                let vendor_address_house_number = vendor.address_house_number;
                let vendor_address_area = vendor.address_area;
                let vendor_address_city = vendor.address_city;
                let vendor_address_state = vendor.address_state;
                let vendor_address_pincode = vendor.address_pincode;
                const replacements = [
                   invoice_id,
                   transaction_date,
                   vendor_pan,
                   vendor_class,
                   vendor.name,
                   base_payout_amount,
                   created_by,
                   expense_category,
                   supply_type,gst_registration_type,place_of_supply,cgst_percentage,sgst_percentage,igst_percentage,cgst_amount ,sgst_amount,igst_amount,vendor_mobile_number,vendor_email_address,vendor_company_name,vendor_gstin,vendor_full_name,vendor_address_house_number,vendor_address_area,vendor_address_city,vendor_address_state,vendor_address_pincode
                ];

                console.log(replacements)
                //////console.log(replacements)

                const insertQuery = `
        INSERT INTO ru_invoice (invoice_id, transaction_date, vendor_pan, vendor_class, vendor_name,  base_payout_amount,created_by,expense_category,supply_type,gst_registration_type,place_of_supply,cgst_percentage,sgst_percentage,igst_percentage,cgst_amount ,sgst_amount,igst_amount,vendor_mobile_number,vendor_email_address,vendor_company_name,vendor_gstin,vendor_full_name,vendor_address_house_number,vendor_address_area,vendor_address_city,vendor_address_state,vendor_address_pincode) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) `;

                // Execute the raw query with bind parameters
                await _db2.query(insertQuery, {
                    replacements,
                    type: sequelize.QueryTypes.INSERT,
                })
                let invoice = await _db2.query(` select * from ru_invoice where invoice_id = ? `, {replacements:[invoice_id],type:QueryTypes.SELECT});
                invoice = invoice[0];
                const invoiceNumberPrefix = 'RL/22-23/';
                const invoiceNumber = `${invoiceNumberPrefix}${String(invoice.id).padStart(3, '0')}`;
                await _db2.query(` update ru_invoice set invoice_number = ? where invoice_id = ? `,{replacements:[invoiceNumber,invoice_id], type:QueryTypes.UPDATE})
            } catch (err1) {
                error = err1.message;
                console.log(error)
                data[i].error = `Error Into The Data Provided. Please Provide all the Mandatory Fields and all fields in desired format`;
                faliureCount++;
                ////console.log("Err",err1)
            }

            userDetailsError.push(data[i])

        }

        ////console.log(userDetailsError)
        let file = await uploadArrayToS3(userDetailsError, "invoice_upload_logs");
        query = ` insert into application_logs (application_type, application_id, field,from_value,to_value,updated_by) values ('invoice_upload',?,?,?,?,uuid_to_bin(?)) `

        //// //console.log(lead_admin_id?lead_admin_id:user.id,lead_admin_id,user.id)
        ////console.log([file_name, file,data.length-faliureCount,faliureCount,user.id,lead_admin_id])
        await sequelize.query(query, { replacements: [file_name, file, data.length - faliureCount, faliureCount, user.id, new Date(), new Date()], type: QueryTypes.INSERT });
                                                           
                                                          
               //  let file = await uploadArrayToS3(userDetailsError);
        // query = ` insert into application_logs (application_type, application_id, field,from_value,to_value,updated_by) values ('invoice_upload',?,?,?,?,uuid_to_bin(?)) `
        // await sequelize.query(query, { replacements: [file_name, file, data.length - faliureCount, faliureCount, user.id, new Date(), new Date()], type: QueryTypes.INSERT });

    } catch (e) {
        console.log(e)
        logger(e)
    }
};


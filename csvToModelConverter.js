const { logger } = require('./api/helpers/logger');
const {sequelize, BankDetail, PayoutList} = require('./models');

const migrateBankDetails = ()=>{
    const csv = require('csv-parser')
    const fs = require('fs')
    const datas = [];
    
    fs.createReadStream('BankDetails.csv')
      .pipe(csv())
      .on('data', async (results) => {
        datas.push(results)
        try{
            await BankDetail.create({
                bank_nbfc_name: results.bank_nbfc_name,
                product: results.product,
                market_and_sub_type: results.market_and_sub_type,
                state: results.state,
                city: results.city,
                company: results.company,
                login_code: results.login_code,
                location: results.location,
                sales_manager: results.sales_manager,
                sales_manager_mobile: results.sales_manager_mobile,
                sales_manager_email: results.sales_manager_email,
                sales_manager_code: results.sales_manager_code,
                assistant_sales_manager: results.assistant_sales_manager,
                assistant_sales_manager_mobile: results.assistant_sales_manager_mobile,
                assistant_sales_manager_email: results.assistant_sales_manager_email,
                regional_sales_manager: results.regional_sales_manager,
                regional_sales_manager_mobile: results.regional_sales_manager_mobile,
                regional_sales_manager_email: results.regional_sales_manager_email,
                zonal_sales_manager: results.zonal_sales_manager,
                zonal_sales_manager_mobile: results.zonal_sales_manager_mobile,
                zonal_sales_manager_email: results.zonal_sales_manager_email,
                national_sales_manager: results.national_sales_manager,
                national_sales_manager_mobile: results.national_sales_manager_mobile,
                national_sales_manager_email: results.national_sales_manager_email,
                login_process: results.login_process,
                company_category_list: results.company_category_list,
                product_and_policy: results.product_and_policy,
                branch_address: results.branch_address,
            });
        }
           catch(err){
            logger.error(err)
           }
    })
      .on('end', async () => {

      })
}

const migratePayoutLists = ()=>{
    const csv = require('csv-parser')
    const fs = require('fs')
    const datas = [];
    
    fs.createReadStream('PayoutsList.csv')
      .pipe(csv())
      .on('data', async (results) => {
        try{
            await PayoutList.create({
                bank_nbfc_name: results.bank_nbfc_name,
                main_product: results.main_product,
                product: results.product,
                company_name: results.company_name,
                login_code: results.login_code,
                product_group: results.product_group,
                sub_product_group: results.sub_product_group,
                gst_reimbursement: results.gst_reimbursement,
                invoice_remark: results.invoice_remark,
                billing_month_from: results.billing_month_from,
                billing_month_to: results.billing_month_to,
                applicable_from: results.applicable_from,
                applicable_till: results.applicable_till,
                max_payout_for_single_case: results.max_payout_for_single_case,
                payout_percentage: results.payout_percentage,
                payout_type: results.payout_type,
                remark: results.remark,
                expire_on: results.expire_on,
                status: results.status,
                last_updated_on: results.last_updated_on,
                payout_rate_1: results.payout_rate_1,
                disb_amount_from_payout_1: results.disb_amount_from_payout_1,
                disb_amount_to_payout_1: results.disb_amount_to_payout_1,
                payout_rate_2: results.payout_rate_2,
                disb_amount_from_payout_2: results.disb_amount_from_payout_2,
                disb_amount_to_payout_2: results.disb_amount_to_payout_2,
                payout_rate_3: results.payout_rate_3,
                disb_amount_from_payout_3: results.disb_amount_from_payout_3,
                disb_amount_to_payout_3: results.disb_amount_to_payout_3,
                payout_rate_4: results.payout_rate_4,
                disb_amount_from_payout_4: results.disb_amount_from_payout_4,
                disb_amount_to_payout_4: results.disb_amount_to_payout_4,
                payout_rate_5: results.payout_rate_5,
                disb_amount_from_payout_5: results.disb_amount_from_payout_5,
                disb_amount_to_payout_5: results.disb_amount_to_payout_5,
                payout_rate_6: results.payout_rate_6,
                disb_amount_from_payout_6: results.disb_amount_from_payout_6,
                disb_amount_to_payout_6: results.disb_amount_to_payout_6,
                payout_rate_7: results.payout_rate_7,
                disb_amount_from_payout_7: results.disb_amount_from_payout_7,
                disb_amount_to_payout_7: results.disb_amount_to_payout_7,
                payout_rate_8: results.payout_rate_8,
                disb_amount_from_payout_8: results.disb_amount_from_payout_8,
                disb_amount_to_payout_8: results.disb_amount_to_payout_8,
                payout_rate_9: results.payout_rate_9,
                disb_amount_from_payout_9: results.disb_amount_from_payout_9,
                disb_amount_to_payout_9: results.disb_amount_to_payout_9,
                payout_rate_10: results.payout_rate_10,
                disb_amount_from_payout_10: results.disb_amount_from_payout_10,
                disb_amount_to_payout_10: results.disb_amount_to_payout_10
            });
        }
           catch(err){
            logger.error(err)
           }
    })
      .on('end', async () => {
        
      })
}

migrateBankDetails();
migratePayoutLists();
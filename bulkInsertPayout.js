const { logger } = require('./api/helpers/logger');
const {sequelize} = require('./models');
const csv = require('csv-parser')
const fs = require('fs');
const { QueryTypes } = require('sequelize');
let id= 0;

const migratePayouts = ()=>{
    fs.createReadStream('Payout.csv')
      .pipe(csv())
      .on('data', async (data) => {
        try{
          let keys = Object.keys(data);  
          let dataObject = makeObject(data,keys);
          id=id+1;
          await insertData(id,dataObject);
        }
           catch(err){
            logger.error(err)
           }
    })
      .on('end', async () => {
      })
}

const makeObject = (data,keys) => {
    let dataObj = {};
    console.log(keys)
    dataObj.bank_name = data[keys[4]];
    dataObj.registered_on_company_name = data[keys[2]];
    dataObj.main_product = data[keys[5]];
    dataObj.sub_product = data[keys[9]];
    dataObj.agreement_expired_by = data[keys[1]]?new Date(data[keys[1]]):null;
    dataObj.enrollment_date =  data[keys[0]]?new Date(data[keys[0]]):null;
    dataObj.invoice_remark = data[keys[6]];
    dataObj.login_code = data[keys[3]];
    dataObj.product_group = data[keys[7]];
    dataObj.product = data[keys[8]];
    dataObj.address = data[keys[10]];
    dataObj.max_payout = data[keys[11]];
    dataObj.billing_date_from = data[keys[12]];
    dataObj.billing_date_to = data[keys[13]];
    dataObj.applicable_from = data[keys[14]];
    dataObj.applicable_to = data[keys[15]];
    dataObj.remarks = data[keys[16]];
    dataObj.type = data[keys[18]];
    dataObj.avg_achievment = validateFloat(data[keys[19]]);
    let payoutRate = [];
    for(let i=0;i<=30;i=i+3){
        if(data[keys[20+i]]){
            payoutRate.push({
                rate_percentage:validateFloat(data[keys[20+i]]),
                disb_amount_from:validateFloat(data[keys[21+i]]),
                disb_amount_to:validateFloat(data[keys[22+i]])
            });
        }
    }
    dataObj.payoutRate = payoutRate;
    return dataObj;
}

const insertData = async (id,data) =>{
    let query = `insert into payouts (id,bank_name,avg_achievment ,registered_on_company_name,main_product ,sub_product ,agreement_expired_by ,enrollment_date,product,invoice_remark ,login_code ,product_group,address,max_payout ,billing_date_from ,billing_date_to ,applicable_from ,applicable_to ,remarks ,type ) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) `;
    let bindParams =  [id,data.bank_name ,data.avg_achievment,data.registered_on_company_name,data.main_product ,data.sub_product ,data.agreement_expired_by ,data.enrollment_date,data.product,data.invoice_remark ,data.login_code ,data.product_group,data.address,data.max_payout ,data.billing_date_from ,data.billing_date_to ,data.applicable_from ,data.applicable_to ,data.remarks ,data.type];
    const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    for(let i=0;i<data.payoutRate.length;i++){
        query = `insert into payout_rate (payout_id,rate_percentage,disb_amount_from,disb_amount_to) values (?,?,?,?) `;
        bindParams = [id,data.payoutRate[i].rate_percentage,data.payoutRate[i].disb_amount_from,data.payoutRate[i].disb_amount_to];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }
}

const validateFloat =(number)=>{
    try{
        number = parseFloat(number);
        if(isNaN(number) || !number ){
            number=0;
        }
        return number;
    }catch(error){
        return 0;
    }
}

// const validate = (data,keys) => {
//        try{

//        }catch(err){
//           data.error = err.message;
//           errorArray.push(data);
//        }
// }

// const writeError = async () =>  {
//     jsonexport(errorArray, function(err, csv) {
//         if (err) return console.error(err);
//         fs.writeFile('error.csv', csv, function(err) {
//           if (err) return console.error(err);
//           console.log('output.csv saved');
//         });
//       });      
// }

migratePayouts();
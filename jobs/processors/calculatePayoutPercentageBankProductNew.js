let path = require('path');
const config = require("../../config/config");
const { logger } = require("../../api/helpers/logger");
const { sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');

module.exports = async function (job) {
  try {
    let {id,payout_percenatge,phone} = job.data;
    console.log(payout_percenatge,"234K")
    let query;
    let bindParams = [];
    let results;
    if(phone){
      query = `select internalId as id ,averageAchievement from bank_product_payout_new `;
      results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
      for(let i=0;i<results.length;i++){
        if(i==0) query = ` insert into lead_payout_new(payout_id,phone,percentage) values (?,?,?) `;
        else{
          query += `, (?,?,?) `
        }
        console.log(results[i].averageAchievement,payout_percenatge,results[i].averageAchievement*payout_percenatge/100)
        bindParams = bindParams.concat([results[i].id,phone,results[i].averageAchievement*payout_percenatge/100]);
      }
      if(results.length){
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
      }
    }else{
      query = `select id,averageAchievement from bank_product_payout_new `;
      bindParams = [];
      results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
      for(let i=0;i<results.length;i++){
        if(i==0) query = ` insert into lead_payout_new(payout_id,user_id,percentage) values  (?,uuid_to_bin(?),?,?) `;
        else{
          query += `, (?,uuid_to_bin(?),?,?) `
        }
        bindParams = bindParams.concat([results[i].id,id,payout_percenatge*results[i].averageAchievement/100]);
        //
      }
      if(results.length){
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
      }
    }  
  } catch (e) {
    console.log(e)
  }
};


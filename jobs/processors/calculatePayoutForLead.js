let path = require('path');
const config = require("../../config/config");
const { logger } = require("../../api/helpers/logger");
const { sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');

module.exports = async function (job) {
  try {
    let { id, payout_percentage, phone, update, locked_payout } = job.data;
    if (!update) update = false;
    let query;
    let bindParams = [];
    let results;
    if (phone) {
      query = `select id,avg_achievment from payouts ${locked_payout?.length ? ` where id not in (${locked_payout}) ` : ""} `;
      results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
      for (let i = 0; i < results.length; i++) {
        if (i == 0) query = ` insert into lead_payout(payout_id,phone,percentage,is_updated) values (?,?,?,?) `;
        else {
          query += `, (?,?,?,?) `
        }
        bindParams = bindParams.concat([results[i].id, phone, results[i].avg_achievment * payout_percentage / 100, update]);
      }
      if (results.length) {
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
      }
    } else {
      query = `select id,avg_achievment from payouts ${locked_payout?.length ? ` where id not in (${locked_payout}) ` : ""} `;
      bindParams = [];
      results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
      for (let i = 0; i < results.length; i++) {
        if (i == 0) query = ` insert into lead_payout(payout_id,user_id,percentage,is_updated) values  (?,uuid_to_bin(?),?,?) `;
        else {
          query += `, (?,uuid_to_bin(?),?,?) `
        }
        bindParams = bindParams.concat([results[i].id, id, payout_percentage * results[i].avg_achievment / 100, true]);
        //
      }
      if (results.length) {
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
      }
    }
  } catch (e) {
    console.log(e)
  }
};


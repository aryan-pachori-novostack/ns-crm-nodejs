let path = require('path');
const config = require("../../config/config");
const { logger } = require("../../api/helpers/logger");
const { Sequelize } = require('sequelize');
const { sequelize,_db2 } = require('../db');
const { QueryTypes } = require('sequelize');

// let db2;
// //creating global connection for second database (RULOANS DATABASE) [Neeraj Singh]
// if(!process.env.DATABASE_HOST_READ){
//   console.log("Here123")
//   db2 = new Sequelize(process.env.DATABASE2_NAME, process.env.DATABASE_USER_NAME, process.env.DATABASE_PASSWORD, {
//   host: process.env.DATABASE_HOST,
//   dialect: process.env.DATABASE_DIALECT,
// });
// }else{
//   console.log("Here1234")
//   db2 = new Sequelize(process.env.DATABASE2_NAME, null, null, {
//     dialect: process.env.DATABASE_DIALECT,
//     port: 3306,
//     replication: {
//       read: [
//         { host: process.env.DATABASE_HOST_READ, username: process.env.DATABASE_USER_NAME_READ, password: process.env.DATABASE_PASSWORD_READ }
//       ],
//       write: { host: process.env.DATABASE_HOST, username: process.env.DATABASE_USER_NAME, password: process.env.DATABASE_PASSWORD }
//     },
//     pool: { // If you want to override the options used for the read/write pool you can do so here
//       max: 100,
//       idle: 30000
//     },
//   })
// }
module.exports = async function (job) {
  try {
    let bindParams = [];
    let query1  = ` select count(*) as count from ru_direct_selling_agents dsa where signup_steps_completed = 1 `;
    let query2  = ` select count(*) as count from ru_direct_selling_agents dsa where signup_steps_completed = 2 `;
    let query3  = ` select count(*) as count from ru_direct_selling_agents dsa where signup_steps_completed = 3 `;
    let query4  = ` select count(*) as count from ru_direct_selling_agents dsa where signup_steps_completed = 4 `;
    let query5  = ` select count(*) as count from ru_direct_selling_agents dsa where signup_steps_completed = 5 `;
    let query6  = ` select count(*) as count from ru_direct_selling_agents dsa where signup_steps_completed = 6 `;
    let query7  = ` select count(*) as count from ru_direct_selling_agents dsa  `;
    let count1 = await _db2.query(query1, { replacements: bindParams, type: QueryTypes.SELECT });
    let count2 = await _db2.query(query2, { replacements: bindParams, type: QueryTypes.SELECT });
    let count3 = await _db2.query(query3, { replacements: bindParams, type: QueryTypes.SELECT });
    let count4 = await _db2.query(query4, { replacements: bindParams, type: QueryTypes.SELECT });
    let count5 = await _db2.query(query5, { replacements: bindParams, type: QueryTypes.SELECT });
    let count6 = await _db2.query(query6, { replacements: bindParams, type: QueryTypes.SELECT });
    signUpStep1 = count1[0].count;
    signUpStep2 = count2[0].count;
    signUpStep3 = count3[0].count;
    signUpStep4 = count4[0].count;
    signUpStep5 = count5[0].count;
    signUpStep6 = count6[0].count;
    console.log(signUpStep1)
    let createQuery = ` insert into dsa_step_wise_count (step_1_count,step_2_count,step_3_count,step_4_count,step_5_count,step_6_count) values (?,?,?,?,?,?) `;
    bindParams = [signUpStep1 ,signUpStep2,signUpStep3 ,signUpStep4,signUpStep5 ,signUpStep6];
    await sequelize.query(createQuery, { replacements: bindParams, type: QueryTypes.INSERT });
  } catch (e) {
    console.log(e)
  }
};


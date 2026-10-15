'use strict';
const {sequelize} = require('../models');
const { QueryTypes } = require('sequelize');
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    let data = [
      {
       id:1,
       value: 'SPOKEN'
      },
      {
        id:2,
        value: 'RNR'
      }
    ];
    for(let i=0;i<data.length;i++){
      let query = ` insert into call_status(id,value) values (?,?)`;
      let bindParams = [data[i].id,data[i].value,data[i].step_number,data[i].parent_id];
      await sequelize.query(query, {replacements:bindParams, type: QueryTypes.INSERT });
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('call_status', null, {});
  }
};

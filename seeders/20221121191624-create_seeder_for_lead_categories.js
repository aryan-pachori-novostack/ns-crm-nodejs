'use strict';
const {sequelize} = require('../models');
const { QueryTypes } = require('sequelize');
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    let data = [
      {
       id:1,
       value: 'Complete',
      },
      {
        id:2,
        value: 'Referral',
      }
    ];
    for(let i=0;i<data.length;i++){
      let query = ` insert into lead_categories(id,value) values (?,?)`;
      let bindParams = [data[i].id,data[i].value];
      await sequelize.query(query, {replacements:bindParams, type: QueryTypes.INSERT });
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('lead_categories', null, {});
  }
};

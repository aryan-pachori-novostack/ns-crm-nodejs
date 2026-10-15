'use strict';
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    let data = [
      {
        id: 1,
        value: 'Leads',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        value: 'Customer',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        value: 'Call',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    for (let i = 0; i < data.length; i++) {
      let query = ` insert into modules(id,value, createdAt, updatedAt) values (?,?,?,?)`;
      let bindParams = [data[i].id, data[i].value, data[i].createdAt, data[i].updatedAt];
      await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('modules', null, {});
  }
};

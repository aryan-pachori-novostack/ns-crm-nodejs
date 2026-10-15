'use strict';
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    let data = [
      {
        id: 1,
        value: 'Lead type',
        module_id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        value: 'Lead source',
        module_id: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        value: 'Profession',
        module_id: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        value: 'Category',
        module_id: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        value: 'Potential',
        module_id: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        value: 'Salutation',
        module_id: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        value: 'Previous bank department',
        module_id: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        value: 'Previous bank verticle',
        module_id: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        value: 'Previous loan type',
        module_id: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        value: 'Bank leave duration',
        module_id: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        value: 'Monthly disbursement',
        module_id: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        value: 'Loan type',
        module_id: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        value: 'Status',
        module_id: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        value: 'Status',
        module_id: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (let i = 0; i < data.length; i++) {
      let query = ` insert into picklist_keys(id, value, module_id, createdAt, updatedAt) values (?,?,?,?,?)`;
      let bindParams = [data[i].id, data[i].value, data[i].module_id, data[i].createdAt, data[i].updatedAt];
      await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('picklist_keys', null, {});
  }
};


'use strict';
let uuid = require('uuid');
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    let data = [
      {
        id: uuid.v4(),
        role: 'CEO',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid.v4(),
        role: 'CRM_ADMIN',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid.v4(),
        role: 'ACCOUNTS_HEAD',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid.v4(),
        role: 'ACCOUNTS_EXECUTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid.v4(),
        role: 'ROUNE_ADMIN',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid.v4(),
        role: 'TELE_SUPERVISOR',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid.v4(),
        role: 'TELE_CALLER',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid.v4(),
        role: 'HR',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid.v4(),
        role: 'VERIFICATION_AGENCY',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid.v4(),
        role: 'MIS_EXECUTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid.v4(),
        role: 'CRM_EXECUTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid.v4(),
        role: 'REGIONAL_HEAD',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid.v4(),
        role: 'BUSINESS_HEAD',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid.v4(),
        role: 'HUB_HEAD',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid.v4(),
        role: 'SALES_HEAD',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid.v4(),
        role: 'MANAGERS',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid.v4(),
        role: 'PARTNERS',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid.v4(),
        role: 'BACKEND',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid.v4(),
        role: 'LEAD_ADMIN',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid.v4(),
        role: 'TECH_HEAD',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid.v4(),
        role: 'CFO',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid.v4(),
        role: 'SALES_ADMIN',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    for (let i = 0; i < data.length; i++) {
      let query = ` insert into roles(id,role,createdAt,updatedAt) values (UUID_TO_BIN(?),?,?,?)`;
      let bindParams = [data[i].id, data[i].role, data[i].createdAt, data[i].updatedAt];
      await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('roles', null, {});
  }
};

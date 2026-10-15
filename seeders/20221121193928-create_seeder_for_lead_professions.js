'use strict';
const {sequelize} = require('../models');
const { QueryTypes } = require('sequelize');
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    let data = [
      {
       id:1,
       value: 'Builder',
      },
      {
        id:2,
        value: 'Chartered Accountant',
      },
      {
        id:3,
        value: 'DSA/DST',
      },
      {
        id:4,
        value: 'Ex-banker',
      },
      {
        id:5,
        value: 'Financial Consualtant',
      },
      {
        id:6,
        value: 'Freelancer',
      },
      {
        id:7,
        value: 'Insurance Advisor',
      },
      {
        id:8,
        value: 'Loan Agent',
      },
      {
        id:9,
        value: 'Mutual Fund Agent',
      },
      {
        id:10,
        value: 'Tax Consulatant',
      },
      {
        id:11,
        value: 'Financial Analyst',
      },
      {
        id:12,
        value: 'Banker',
      }
    ];
    for(let i=0;i<data.length;i++){
      let query = ` insert into lead_professions(id,value) values (?,?)`;
      let bindParams = [data[i].id,data[i].value];
      await sequelize.query(query, {replacements:bindParams, type: QueryTypes.INSERT });
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('lead_professions', null, {});
  }
};

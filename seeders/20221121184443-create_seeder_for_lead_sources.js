'use strict';
const {sequelize} = require('../models');
const { QueryTypes } = require('sequelize');
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    let data = [
      {
       id:1,
       value: 'CHAT',
      },
      {
        id:2,
        value: 'FACEBOOK',
      },
      {
        id:3,
        value: 'GOOGLE',
      },
      {
        id:4,
        value: 'LINKEDIN',
      },
      {
        id:5,
        value: 'MANUAL ENTRY',
      },
      {
        id:6,
        value: 'PRIMARY EMAIL',
      },
      {
        id:7,
        value: 'TOLL-FREE',
      },
      {
        id:8,
        value: 'WEBSITE ORGANIC',
      },
      {
        id:9,
        value: 'WEBSITE- HUB MANAGER',
      },
      {
        id:10,
        value: 'VAPI BRANDING',
      }
    ];
    for(let i=0;i<data.length;i++){
      let query = ` insert into lead_sources(id,value) values (?,?)`;
      let bindParams = [data[i].id,data[i].value];
      await sequelize.query(query, {replacements:bindParams, type: QueryTypes.INSERT });
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('lead_sources', null, {});
  }
};

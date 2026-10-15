'use strict';
const {sequelize} = require('../models');
const { QueryTypes } = require('sequelize');
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    let data = [
      {
       id:1,
      name: 'ACTIVE',
      },
      {
        id:2,
       name: 'INACTIVE',
      },
      {
        id:3,
       name: 'BLOCKED',
      }
    ];
    for(let i=0;i<data.length;i++){
      let query = ` insert into status(id,name) values (?,?)`;
      let bindParams = [data[i].id,data[i].name];
      await sequelize.query(query, {replacements:bindParams, type: QueryTypes.INSERT });
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('status', null, {});
  }
};

'use strict';
let uuid = require('uuid');
const {sequelize} = require('../models');
const { QueryTypes } = require('sequelize');
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    let data = [
      {
       id:uuid.v4(),
       role: 'NEW_USER',
       createdAt: new Date(),
       updatedAt: new Date()
      }
    ];
    for(let i=0;i<data.length;i++){
      let query = ` insert into roles(id,role,createdAt,updatedAt) values (UUID_TO_BIN(?),?,?,?)`;
      let bindParams = [data[i].id,data[i].role,data[i].createdAt,data[i].updatedAt];
      await sequelize.query(query, {replacements:bindParams, type: QueryTypes.INSERT });
    }
  },

  async down (queryInterface, Sequelize) {
     await queryInterface.bulkDelete('roles', null, {});
  }
};

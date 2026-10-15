'use strict';
const {sequelize} = require('../models');
const { QueryTypes } = require('sequelize');
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    let data = [
      {
        id:1,
        value:"aadhar_card"
      },
      {
        id:2,
        value:"pan_card"
      },
      {
        id:3,
        value:"joining_agreement"
      }
    ];
    for(let i=0;i<data.length;i++){
      let query = ` insert into lead_document_types(id,value) values(?,?)`;
      let bindParams = [data[i].id,data[i].value,data[i].step_number,data[i].parent_id];
      await sequelize.query(query, {replacements:bindParams, type: QueryTypes.INSERT });
    }
  },

  async down (queryInterface, Sequelize) {
  }
};

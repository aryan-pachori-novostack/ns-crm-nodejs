'use strict';
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    let data = {id: 4, value: "aadhar_card"}

    let query = ` insert into lead_document_types(id,value) values(?,?)`;
    let bindParams = [data.id, data.value];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

    query = `UPDATE lead_document_types SET value='aadhar_card_front' where id=1`;
    await sequelize.query(query, { type: QueryTypes.UPDATE });
  },

  async down(queryInterface, Sequelize) {

    let query = `DELETE FROM lead_document_types WHERE id=4`
    await sequelize.query(query, { type: QueryTypes.DELETE });

    query = `UPDATE lead_document_types SET value='aadhar_card' where id=1`;
    await sequelize.query(query, { type: QueryTypes.UPDATE });
  }
};
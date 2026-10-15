'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.createTable('lead_document_types', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER,
        autoIncrement:true
      },
      value: {
        type: Sequelize.STRING
      }
    });
  },

  async down(queryInterface, Sequelize) {

    await queryInterface.dropTable('lead_document_types');

  }
};

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('lead_documents', 'lead_id', {
      type: 'VARBINARY(16)',
      allowNull: false
    });

  },

  async down(queryInterface, Sequelize) {

    await queryInterface.removeColumn('lead_documents', 'lead_id');
  }
};

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('user_emails', 'lead_id', {
      type: 'VARBINARY(16)',
      allowNull: false
    });

  },

  async down(queryInterface, Sequelize) {

    await queryInterface.removeColumn('user_emails', 'lead_id');
  }
};

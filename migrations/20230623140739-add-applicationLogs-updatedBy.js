'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {

    await queryInterface.addColumn('application_logs', 'updated_by', {
      type: 'VARBINARY(16)',
      allowNull: true
    });

  },

  async down(queryInterface) {
    await queryInterface.removeColumn('application_logs', 'updated_by');
  }
};
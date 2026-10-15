'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'users', // table name
      'sales_admin', // new field name
      {
        type: Sequelize.STRING,
        allowNull: true
      },
    );
    await queryInterface.addColumn(
      'users', // table name
      'lead_admin', // new field name
      {
        type: Sequelize.STRING,
        allowNull: true
      },
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'sales_admin');
    await queryInterface.removeColumn('users', 'lead_admin');
  }
};
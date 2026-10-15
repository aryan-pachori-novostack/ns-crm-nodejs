'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('leads',
      'is_deleted',
      {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      });
  },

  async down(queryInterface, Sequelize) {

    await queryInterface.dropTable('leads');

  }
};

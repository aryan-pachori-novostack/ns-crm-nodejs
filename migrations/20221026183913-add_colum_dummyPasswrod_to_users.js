'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'users', // table name
      'dummyPassword', // new field name
      {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'dummyPassword');
  }
};

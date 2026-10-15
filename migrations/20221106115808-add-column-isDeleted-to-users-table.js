'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
   await queryInterface.addColumn(
    'users', // table name
    'isDeleted', // new field name
    {
      type: Sequelize.BOOLEAN,
      defaultValue:false
    },
  );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'isDeleted');
  }
};

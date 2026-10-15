'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('users', 'payout', {
      type: Sequelize.BOOLEAN,
      defaultValue:false
    });

    await queryInterface.addColumn('users', 'bank', {
      type: Sequelize.BOOLEAN,
      defaultValue:false
    });

  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'payout');
    await queryInterface.removeColumn('users', 'bank');
  }
};

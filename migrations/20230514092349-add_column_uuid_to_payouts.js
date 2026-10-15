'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('payouts', 'payout_uuid', {
      type: Sequelize.UUID
    });


  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('payouts', 'payout_uuidd');
  }
};
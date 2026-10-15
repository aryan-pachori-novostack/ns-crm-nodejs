'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('lead_payout', 'phone', {
      type: Sequelize.STRING
    });

  },

  async down(queryInterface, Sequelize) {

    await queryInterface.removeColumn('lead_payout', 'phone');
  }
};

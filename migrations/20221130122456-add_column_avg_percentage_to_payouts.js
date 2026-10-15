'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('lead_payout', 'percentage', {
      type: Sequelize.FLOAT,
      allowNull: false
    });

  },

  async down(queryInterface, Sequelize) {

    await queryInterface.removeColumn('lead_payout', 'percentage');
  }
};

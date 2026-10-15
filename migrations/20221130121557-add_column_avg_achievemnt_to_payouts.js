'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('payouts', 'avg_achievment', {
      type: Sequelize.FLOAT,
      allowNull: false
    });

  },

  async down(queryInterface, Sequelize) {

    await queryInterface.removeColumn('payouts', 'avg_achievment');
  }
};

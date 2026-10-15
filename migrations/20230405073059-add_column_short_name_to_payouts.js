'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('payouts', 'short_name', {
      type: Sequelize.STRING,
    });



  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('payouts', 'short_name');
  }
};

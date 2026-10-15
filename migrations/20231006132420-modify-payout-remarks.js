'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.changeColumn('payouts', 'remarks', {
      type: Sequelize.TEXT,
      allowNull: false,
    });

  },

  async down(queryInterface, Sequelize) {

    await queryInterface.changeColumn('payouts', 'remarks', {
      type: Sequelize.STRING,
      allowNull: false,
    });
   
  }
};

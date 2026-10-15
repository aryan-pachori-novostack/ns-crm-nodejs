'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // await queryInterface.addColumn('bank_details', 'ifsc_code', { type: Sequelize.STRING(15) });
    await queryInterface.addColumn('bank_details', 'branch_name', { type: Sequelize.STRING(150) })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('bank_details', 'ifsc_code');
    await queryInterface.removeColumn('bank_details', 'branch_name');
  }
};

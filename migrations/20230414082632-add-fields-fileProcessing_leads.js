'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('lead_additional_information', 'file_process_method', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('lead_additional_information', 'file_process_with_whom', {
      type: Sequelize.STRING,
      allowNull: true
    });

  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('lead_additional_information', 'file_process_method');
    await queryInterface.removeColumn('lead_additional_information', 'file_process_with_whom');
  }
};

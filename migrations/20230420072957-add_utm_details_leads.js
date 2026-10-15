'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('leads', 'utm_content', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('leads', 'utm_medium', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('leads', 'utm_term', {
      type: Sequelize.STRING,
    });

  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('leads', 'utm_content');
    await queryInterface.removeColumn('leads', 'utm_medium');
    await queryInterface.removeColumn('leads', 'utm_term');
  }
};
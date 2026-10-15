'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('leads', 'is_converted', {
      type: Sequelize.BOOLEAN
    });

  },

  async down(queryInterface, Sequelize) {

    await queryInterface.removeColumn('leads', 'is_converted');
  }
};

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('users', 'status', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue:1
    });

  },

  async down(queryInterface, Sequelize) {

    await queryInterface.removeColumn('users', 'status');
  }
};

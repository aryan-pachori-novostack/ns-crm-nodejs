'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.changeColumn('list_filters', 'filters', {
      type: Sequelize.TEXT,
      allowNull: false,
    });

  },

  async down(queryInterface, Sequelize) {

    await queryInterface.changeColumn('list_filters', 'filters', {
      type: Sequelize.STRING,
      allowNull: false,
    });
   
  }
};
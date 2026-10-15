'use strict';
const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.changeColumn('leads', 'pan', {
      type: DataTypes.STRING,
      allowNull: true
    });

  },

  async down(queryInterface, Sequelize) {

    await queryInterface.changeColumn('leads', 'pan', {
      type: DataTypes.STRING,
      allowNull: false
    });

  }
};

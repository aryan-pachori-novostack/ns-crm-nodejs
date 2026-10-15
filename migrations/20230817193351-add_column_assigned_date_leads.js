'use strict';

const { Sequelize } = require('../models');

/** @type {import('sequelize-cli').Migration} */
module.exports = {

  async up(queryInterface) {

    await queryInterface.addColumn('leads', 'assigned_to_date', {
      type: Sequelize.DATE,
      allowNull: true
    });

  },

  async down(queryInterface) {
    await queryInterface.removeColumn('leads', 'assigned_to_date');
  }
};

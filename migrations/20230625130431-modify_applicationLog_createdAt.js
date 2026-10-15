'use strict';

const { sequelize } = require('../models');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('application_logs', 'createdAt',
      {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    );
    await queryInterface.changeColumn('application_logs', 'updatedAt',
      {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('application_logs', 'createdAt',
      {
        type: Sequelize.DATE,
      }
    );
    await queryInterface.changeColumn('application_logs', 'updatedAt',
      {
        type: Sequelize.DATE,
      }
    );
  }
};
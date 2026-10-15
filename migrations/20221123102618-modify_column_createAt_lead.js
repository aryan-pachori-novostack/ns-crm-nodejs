'use strict';

const { sequelize } = require('../models');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.changeColumn('leads', 'createdAt',
      {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    );
    await queryInterface.changeColumn('leads', 'updatedAt',
      {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.changeColumn('users', 'createdAt',
    {
      defaultValue: null,
    }
    );
    await queryInterface.changeColumn('users', 'updatedAt',
      {
        defaultValue: null,
      }
    );
  }
};

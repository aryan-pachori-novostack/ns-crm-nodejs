'use strict';

const { sequelize } = require('../models');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('lead_comments', 'comment',
      {
        type: Sequelize.TEXT,
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('lead_comments', 'comment',
      {
        type: Sequelize.STRING,
      }
    );
  }
};

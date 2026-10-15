'use strict';

const { BOOLEAN } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {

    await queryInterface.addColumn('users', 'backend_access', {
      type: BOOLEAN
    });


  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'backend_access');
  }
};

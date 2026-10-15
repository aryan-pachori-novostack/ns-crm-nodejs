'use strict';

const { INTEGER } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {

    await queryInterface.addColumn('leads', 'sub_status', {
      type: INTEGER
    });


  },

  async down(queryInterface) {
    await queryInterface.removeColumn('leads', 'sub_status');
  }
};

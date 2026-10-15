'use strict';

const { INTEGER } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {

    await queryInterface.addColumn('picklist_keys', 'parent_id', {
      type: INTEGER
    });


  },

  async down(queryInterface) {
    await queryInterface.removeColumn('picklist_keys', 'parent_id');
  }
};

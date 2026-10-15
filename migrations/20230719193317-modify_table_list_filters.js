'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('list_filters', 'created_at', {
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });

    await queryInterface.addColumn('list_filters', 'updated_at', {
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });

    await queryInterface.changeColumn('call_logs', 'remarks', {
      type: Sequelize.TEXT
    });

  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('list_filters', 'created_at');
    await queryInterface.removeColumn('list_filters', 'updated_at');
    await queryInterface.changeColumn('call_logs', 'remarks', {
      type: Sequelize.STRING
    });
  }
};
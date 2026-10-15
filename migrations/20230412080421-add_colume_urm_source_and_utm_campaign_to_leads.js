'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('leads', 'utm_source', {
      type: Sequelize.STRING
    });

    await queryInterface.addColumn('leads', 'utm_campaign', {
      type: Sequelize.STRING
    });

    await queryInterface.addColumn('leads', 'reapply_count', {
      type: Sequelize.STRING
    });

    await queryInterface.addColumn('leads', 'external_id', {
      type: Sequelize.STRING
    });

  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('leads', 'utm_source');
    await queryInterface.removeColumn('leads', 'utm_campaign');
    await queryInterface.removeColumn('leads', 'external_id');
    await queryInterface.removeColumn('leads', 'reapply_count');
  }
};

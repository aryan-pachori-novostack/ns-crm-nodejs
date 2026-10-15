'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('communication_settings', 'template_id', {
      type: Sequelize.STRING,
      allowNull: false
    });
    await queryInterface.addColumn('communication_settings', 'template', {
      type: Sequelize.TEXT,
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('communication_settings', 'template_id');
    await queryInterface.removeColumn('communication_settings', 'template');
  }
};

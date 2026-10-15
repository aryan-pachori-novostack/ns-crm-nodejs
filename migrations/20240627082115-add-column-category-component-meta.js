'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('crm_component_meta', 'category', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('crm_component_meta', 'sub_category', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('crm_component_meta', 'category');
    await queryInterface.removeColumn('crm_component_meta', 'sub_category');
  }
};

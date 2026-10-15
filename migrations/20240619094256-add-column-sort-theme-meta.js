'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('crm_component_meta', 'sort_order', {
      type: Sequelize.STRING
    });
    await queryInterface.addColumn('crm_component_meta', 'expiration_date', {
      type: Sequelize.DATE,
      defaultValue: null
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('crm_component_meta', 'sort_order');
    await queryInterface.removeColumn('crm_component_meta', 'expiration_date');
  }
};

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('lead_payout', 'payout_lock', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: 0
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('lead_payout', 'payout_lock');
  }
};

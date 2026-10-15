'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('payouts', 'bank_id', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.addColumn('payouts', 'product_id', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('payouts', 'bank_id');
    await queryInterface.removeColumn('payouts', 'payout_id');
  }
};

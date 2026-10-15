'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('bank_product_payout_new', {
      internalId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
      },
      bankInstitution: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      productItem: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      productParentItem: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      productGroup: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      invoiceRemark: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      averageAchievement: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('bank_product_payout_new');
  }
};

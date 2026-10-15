'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('products_new', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      internalId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      displayName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      subType: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      mainProduct: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      basePrice: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      class: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      productCategory: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      shortProductNameAsPerVendor: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      correlatedItem: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('products_new');
  }
};

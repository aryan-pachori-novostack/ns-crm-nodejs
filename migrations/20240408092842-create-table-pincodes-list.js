'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('pincodes_list', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      pincode: {
        type: Sequelize.STRING(100),
      },
      office_name: {
        type: Sequelize.STRING(100),
      },
      office_type: {
        type: Sequelize.STRING(100),
      },
      country: {
        type: Sequelize.STRING(100),
      },
      city: {
        type: Sequelize.STRING(100),
      },
      region: {
        type: Sequelize.STRING(100),
      },
      circle: {
        type: Sequelize.STRING(100),
      },
      taluk: {
        type: Sequelize.STRING(100),
      },
      district: {
        type: Sequelize.STRING(100),
      },
      state: {
        type: Sequelize.STRING(100),
      },
      related_suboffice: {
        type: Sequelize.STRING(100),
      },
      related_head_office: {
        type: Sequelize.STRING(100),
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('pincodes_list');
  },
};
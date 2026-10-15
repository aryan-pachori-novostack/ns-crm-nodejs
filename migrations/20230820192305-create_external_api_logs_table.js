'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('external_api_logs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT,
      },
      user_id: {
        type: Sequelize.STRING,
      },
      api: {
        type: Sequelize.STRING,
      },
      api_type: {
        type: Sequelize.STRING,
      },
      header: {
        type: Sequelize.TEXT,
      },
      payload: {
        type: Sequelize.TEXT,
      },
      response: {
        type: Sequelize.TEXT,
      },
      error_message: {
        type: Sequelize.STRING,
      },
      has_error: {
        type: Sequelize.INTEGER,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('external_api_logs', ['api_type']);
    await queryInterface.addIndex('external_api_logs', ['api']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('external_api_logs');
  }
};

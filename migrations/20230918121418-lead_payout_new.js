'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('lead_payout_new', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      payout_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      user_id: {
        type: 'VARBINARY(16)'
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      percentage: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      phone: {
        type: Sequelize.STRING
      },
      is_updated: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      }
    });

    await queryInterface.addIndex('lead_payout_new', ['phone'], {
      name: 'phone_payout_index_new'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('lead_payout_new');
  }
};

'use strict';

const { sequelize } = require('../models');
let uuid = require('node-uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('leads', 'prefix',
      {
        type: Sequelize.INTEGER,
      }
    );
    await queryInterface.changeColumn('leads', 'user_fname',
      {
        type: Sequelize.STRING,
      }
    );
    await queryInterface.changeColumn('leads', 'user_mname',
      {
        type: Sequelize.STRING,
      }
    );
    await queryInterface.changeColumn('leads', 'user_lname',
      {
        type: Sequelize.STRING,
      }
    );
    await queryInterface.changeColumn('leads', 'assigned_to',
      {
        type: 'VARBINARY(16)',
      }
    );
    await queryInterface.changeColumn('leads', 'channel_manager',
      {
        type: 'VARBINARY(16)'
      })
    await queryInterface.changeColumn('leads', 'payout_percentage',
      {
        type: Sequelize.FLOAT
      })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('leads', 'prefix',
      {
        type: Sequelize.STRING,
        allowNull: false
      }
    );
    await queryInterface.changeColumn('leads', 'user_fname',
      {
        type: Sequelize.STRING,
        allowNull: false
      }
    );
    await queryInterface.changeColumn('leads', 'user_mname',
      {
        type: Sequelize.STRING,
        allowNull: false
      }
    );
    await queryInterface.changeColumn('leads', 'user_lname',
      {
        type: Sequelize.STRING,
        allowNull: false
      }
    );
    await queryInterface.changeColumn('leads', 'assigned_to',
      {
        type: 'VARBINARY(16)',
        allowNull: false,
      }
    );
    await queryInterface.changeColumn('leads', 'channel_manager',
      {
        type: 'VARBINARY(16)',
        allowNull: false,
      })
    await queryInterface.changeColumn('leads', 'payout_percentage',
      {
        type: Sequelize.FLOAT
      })
  }
};
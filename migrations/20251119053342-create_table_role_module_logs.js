'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('role_module_logs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      role_id: {
        type: 'VARBINARY(16)',
        allowNull: false
      },
      module_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'rbac_modules',
          key: 'id'
        },
        allowNull: true,
        onDelete: 'CASCADE'
      },
      action: {
        type: Sequelize.ENUM('CREATE', 'UPDATE', 'DELETE'),
        allowNull: false
      },
      old_values: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Previous permission values before change'
      },
      new_values: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'New permission values after change'
      },
      updated_by_user_id: {
        type: 'VARBINARY(16)',
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'NO ACTION'
      },
      updated_on: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create indexes for faster queries
    await queryInterface.addIndex('role_module_logs', ['role_id'], {
      name: 'role_module_logs_role_id_idx'
    });

    await queryInterface.addIndex('role_module_logs', ['module_id'], {
      name: 'role_module_logs_module_id_idx'
    });

    await queryInterface.addIndex('role_module_logs', ['updated_by_user_id'], {
      name: 'role_module_logs_updated_by_user_id_idx'
    });

    await queryInterface.addIndex('role_module_logs', ['updated_on'], {
      name: 'role_module_logs_updated_on_idx'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('role_module_logs');
  }
};

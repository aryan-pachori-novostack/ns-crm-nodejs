'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('role_modules', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      role_id: {
        type: 'VARBINARY(16)',
        references: {
          model: 'roles',
          key: 'id'
        },
        allowNull: false,
        onDelete: 'CASCADE'
      },
      module_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'rbac_modules',
          key: 'id'
        },
        allowNull: false,
        onDelete: 'CASCADE'
      },
      create: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      read: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      update: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      delete: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      updated_on: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_by_user_id: {
        type: 'VARBINARY(16)',
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'NO ACTION'
      }
    });

    // Create indexes
    await queryInterface.addIndex('role_modules', ['role_id', 'module_id'], {
      unique: true,
      name: 'role_modules_role_module_unique'
    });

    // Create trigger to automatically add new modules to all roles
    await queryInterface.sequelize.query(`
      CREATE TRIGGER after_rbac_module_insert
      AFTER INSERT ON rbac_modules
      FOR EACH ROW
      BEGIN
        INSERT INTO role_modules (role_id, module_id, \`create\`, \`read\`, \`update\`, \`delete\`, updated_on)
        SELECT
          r.id,
          NEW.id,
          0,
          0,
          0,
          0,
          NOW()
        FROM roles r;
      END;
    `);
  },

  async down (queryInterface, Sequelize) {
    // Drop trigger first
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS after_rbac_module_insert;
    `);

    await queryInterface.dropTable('role_modules');
  }
};

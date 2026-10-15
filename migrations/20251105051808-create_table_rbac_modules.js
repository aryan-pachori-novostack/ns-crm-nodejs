'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('rbac_modules', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      alias: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      parent_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'rbac_modules',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      is_deleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    }, {
      timeStamp: true,
      createdAt: true,
      updatedAt: true
    });

    // Create trigger to automatically populate role_modules when a new module is inserted
    await queryInterface.sequelize.query(`
      CREATE TRIGGER after_rbac_module_insert
      AFTER INSERT ON rbac_modules
      FOR EACH ROW
      BEGIN
        IF NEW.is_active = 1 AND NEW.is_deleted = 0 THEN
          INSERT INTO role_modules (role_id, module_id, \`create\`, \`read\`, \`update\`, \`delete\`, updated_on)
          SELECT
            r.id as role_id,
            NEW.id as module_id,
            CASE WHEN r.role = 'CEO' THEN 1 ELSE 0 END as \`create\`,
            CASE WHEN r.role = 'CEO' THEN 1 ELSE 0 END as \`read\`,
            CASE WHEN r.role = 'CEO' THEN 1 ELSE 0 END as \`update\`,
            CASE WHEN r.role = 'CEO' THEN 1 ELSE 0 END as \`delete\`,
            CURRENT_TIMESTAMP as updated_on
          FROM roles r;
        END IF;
      END;
    `);
  },

  async down (queryInterface, Sequelize) {
    // Drop trigger first
    await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS after_rbac_module_insert');

    // Then drop table
    await queryInterface.dropTable('rbac_modules');
  }
};

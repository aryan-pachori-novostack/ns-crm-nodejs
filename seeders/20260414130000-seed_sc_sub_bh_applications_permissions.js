'use strict';
const uuid = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const roleName = 'SC_SUB_BH';

      // 1) Create role if missing
      let [role] = await queryInterface.sequelize.query(
        'SELECT id, role FROM roles WHERE role = ? LIMIT 1',
        {
          replacements: [roleName],
          type: queryInterface.sequelize.QueryTypes.SELECT,
          transaction
        }
      );

      if (!role) {
        const roleId = uuid.v4();
        await queryInterface.sequelize.query(
          'INSERT INTO roles (id, role, createdAt, updatedAt) VALUES (UUID_TO_BIN(?), ?, ?, ?)',
          {
            replacements: [roleId, roleName, new Date(), new Date()],
            type: queryInterface.sequelize.QueryTypes.INSERT,
            transaction
          }
        );

        [role] = await queryInterface.sequelize.query(
          'SELECT id, role FROM roles WHERE role = ? LIMIT 1',
          {
            replacements: [roleName],
            type: queryInterface.sequelize.QueryTypes.SELECT,
            transaction
          }
        );
      }

      if (!role) {
        throw new Error(`Role "${roleName}" could not be created/fetched`);
      }

      // 2) Ensure role has default permission rows for all active modules
      //    (required so role-access screen can enable/disable module permissions)
      const allModules = await queryInterface.sequelize.query(
        `SELECT id
         FROM rbac_modules
         WHERE is_deleted = 0
           AND is_active = 1`,
        {
          type: queryInterface.sequelize.QueryTypes.SELECT,
          transaction
        }
      );

      for (const moduleRow of allModules) {
        await queryInterface.sequelize.query(
          `INSERT INTO role_modules (role_id, module_id, \`create\`, \`read\`, \`update\`, \`delete\`, updated_on)
           VALUES (?, ?, 0, 0, 0, 0, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE
             updated_on = updated_on`,
          {
            replacements: [role.id, moduleRow.id],
            type: queryInterface.sequelize.QueryTypes.INSERT,
            transaction
          }
        );
      }

      // 3) Grant Application section permissions (applications + all children)
      const applicationModules = await queryInterface.sequelize.query(
        `SELECT id
         FROM rbac_modules
         WHERE is_deleted = 0
           AND is_active = 1
           AND alias LIKE 'applications%'`,
        {
          type: queryInterface.sequelize.QueryTypes.SELECT,
          transaction
        }
      );

      for (const moduleRow of applicationModules) {
        await queryInterface.sequelize.query(
          `INSERT INTO role_modules (role_id, module_id, \`create\`, \`read\`, \`update\`, \`delete\`, updated_on)
           VALUES (?, ?, 0, 1, 1, 0, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE
             \`create\` = VALUES(\`create\`),
             \`read\` = VALUES(\`read\`),
             \`update\` = VALUES(\`update\`),
             \`delete\` = VALUES(\`delete\`),
             updated_on = CURRENT_TIMESTAMP`,
          {
            replacements: [role.id, moduleRow.id],
            type: queryInterface.sequelize.QueryTypes.INSERT,
            transaction
          }
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const roleName = 'SC_SUB_BH';

      const [role] = await queryInterface.sequelize.query(
        'SELECT id FROM roles WHERE role = ? LIMIT 1',
        {
          replacements: [roleName],
          type: queryInterface.sequelize.QueryTypes.SELECT,
          transaction
        }
      );

      if (!role) {
        await transaction.commit();
        return;
      }

      // Remove all role-module mappings for this role so undo remains reliable
      // even if permissions were edited after running the seed.
      await queryInterface.sequelize.query(
        'DELETE FROM role_modules WHERE role_id = ?',
        {
          replacements: [role.id],
          type: queryInterface.sequelize.QueryTypes.DELETE,
          transaction
        }
      );

      // Remove role created by this seed.
      await queryInterface.sequelize.query(
        'DELETE FROM roles WHERE id = ? AND role = ?',
        {
          replacements: [role.id, roleName],
          type: queryInterface.sequelize.QueryTypes.DELETE,
          transaction
        }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Grant read access to all roles for ONLY the "Help & Support" modules (139, 140, 141)
    // - This seeder MUST NOT affect any other module_id
    // - It only touches role_modules rows where module_id IN (139, 140, 141)
    //
    // Why needed:
    // A DB trigger auto-creates role_modules rows when a module is inserted,
    // but by default it grants permissions to CEO only. We want these 3 modules
    // readable by ALL roles so the menu is visible to everyone.

    // Module IDs for "Help & Support" menu:
    // 139 = Help & Support (parent), 140 = HelpDesk, 141 = User Guide
    const needHelpModuleIds = [139, 140, 141];

    // Use a transaction so partial updates cannot happen (safety)
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Pre-check: ensure the 3 modules exist in rbac_modules before touching role_modules
      // (prevents foreign-key failures and makes intent explicit)
      const existingModules = await queryInterface.sequelize.query(
        'SELECT id FROM rbac_modules WHERE id IN (:moduleIds)',
        {
          replacements: { moduleIds: needHelpModuleIds },
          type: queryInterface.sequelize.QueryTypes.SELECT,
          transaction
        }
      );

      if (existingModules.length !== needHelpModuleIds.length) {
        // Throwing here ensures we do NOT modify role_modules at all if modules are missing
        throw new Error(
          `Help & Support RBAC modules missing. Expected module IDs ${needHelpModuleIds.join(', ')}, found ${existingModules.map(m => m.id).join(', ')}`
        );
      }

      // Query to get all roles from the database
      const roles = await queryInterface.sequelize.query(
        'SELECT id FROM roles ORDER BY id',
        { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
      );

      // For each role and each Help & Support module, insert-or-update ONLY that (role_id, module_id)
      // - INSERT sets create/update/delete to 0 and read to 1 for new rows
      // - ON DUPLICATE KEY UPDATE updates ONLY read + updated_on (does not touch C/U/D for existing rows)
      for (const role of roles) {
        for (const moduleId of needHelpModuleIds) {
          const insertOrUpdateQuery = `
            INSERT INTO role_modules (role_id, module_id, \`create\`, \`read\`, \`update\`, \`delete\`, updated_on)
            VALUES (?, ?, 0, 1, 0, 0, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE
              \`read\` = 1,
              updated_on = CURRENT_TIMESTAMP
          `;

          await queryInterface.sequelize.query(insertOrUpdateQuery, {
            replacements: [role.id, moduleId],
            type: queryInterface.sequelize.QueryTypes.INSERT,
            transaction
          });
        }
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down (queryInterface, Sequelize) {
    // Rollback: Remove read permissions for "Help & Support" modules from all non-CEO roles
    // This will make the menu only visible to CEO again (as per default trigger behavior)
    await queryInterface.sequelize.query(
      `UPDATE role_modules 
       SET \`read\` = 0, updated_on = CURRENT_TIMESTAMP 
       WHERE module_id IN (139, 140, 141) 
       AND role_id NOT IN (SELECT id FROM roles WHERE role = 'CEO')`,
      { type: queryInterface.sequelize.QueryTypes.UPDATE }
    );
  }
};


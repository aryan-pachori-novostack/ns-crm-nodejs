'use strict';

/**
 * Inserts ONLY:
 *   rbac_modules row for Applications > All Applications
 *   alias: applications_all_applications
 *
 * Does NOT update/delete any existing module.
 * Uses next free id (MAX(id)+1) so it never collides with existing rows
 * (e.g. id 144 is already Applications > LAS / applications_las).
 *
 * CEO-only access comes from DB trigger after_rbac_module_insert.
 */

const MODULE_ALIAS = 'applications_all_applications';
const MODULE_NAME = 'Applications > All Applications';
const PARENT_MODULE_ID = 28; // Applications — referenced only, never updated

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const parentModule = await queryInterface.sequelize.query(
      'SELECT id FROM rbac_modules WHERE id = :parentId LIMIT 1',
      {
        replacements: { parentId: PARENT_MODULE_ID },
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );

    if (parentModule.length === 0) {
      throw new Error(
        `Parent module Applications (id: ${PARENT_MODULE_ID}) does not exist. Run the base module seeder first.`
      );
    }

    // Idempotent: only our alias counts as "already exists"
    const existingOurs = await queryInterface.sequelize.query(
      'SELECT id, alias FROM rbac_modules WHERE alias = :alias LIMIT 1',
      {
        replacements: { alias: MODULE_ALIAS },
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );

    if (existingOurs.length > 0) {
      console.log(
        `Module already exists (id: ${existingOurs[0].id}, alias: ${existingOurs[0].alias}). Skipping insert.`
      );
      return;
    }

    const [maxRow] = await queryInterface.sequelize.query(
      'SELECT COALESCE(MAX(id), 0) AS maxId FROM rbac_modules',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    const newId = Number(maxRow.maxId) + 1;

    const timestamp = new Date();
    await queryInterface.bulkInsert('rbac_modules', [
      {
        id: newId,
        name: MODULE_NAME,
        alias: MODULE_ALIAS,
        parent_id: PARENT_MODULE_ID,
        is_active: true,
        is_deleted: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]);

    console.log(
      `Inserted rbac_modules id=${newId} alias=${MODULE_ALIAS} (parent_id=${PARENT_MODULE_ID}).`
    );
  },

  async down(queryInterface, Sequelize) {
    // Resolve OUR module only by alias — never delete by a guessed numeric id
    const ours = await queryInterface.sequelize.query(
      'SELECT id FROM rbac_modules WHERE alias = :alias LIMIT 1',
      {
        replacements: { alias: MODULE_ALIAS },
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );

    if (ours.length === 0) {
      console.log(`Module alias=${MODULE_ALIAS} not found. Nothing to undo.`);
      return;
    }

    const moduleId = ours[0].id;

    // Only role_modules for THIS module
    await queryInterface.bulkDelete('role_modules', { module_id: moduleId }, {});

    // Only this module row
    await queryInterface.bulkDelete('rbac_modules', { id: moduleId }, {});

    console.log(`Removed rbac_modules id=${moduleId} and its role_modules rows.`);
  },
};

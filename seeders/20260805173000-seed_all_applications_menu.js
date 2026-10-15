'use strict';

/**
 * Inserts/fixes ONLY the "All Applications" menu under Applications.
 *
 * - Looks up module by alias applications_all_applications (must run modules seeder first)
 * - Never updates other menus' order/name/path
 * - If a previous bad insert linked this menu to the wrong module (e.g. applications_las / id 144),
 *   this seeder corrects ONLY that All Applications row
 */

const MENU_NAME = 'All Applications';
const MENU_PATH = '/applications/all-applications';
const PARENT_MENU_ID = 28; // Applications menu — referenced only
const MODULE_ALIAS = 'applications_all_applications';
const MENU_ORDER = 0; // Top child under Applications

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const parentMenu = await queryInterface.sequelize.query(
      'SELECT id FROM menu WHERE id = :parentId AND is_deleted = 0 LIMIT 1',
      {
        replacements: { parentId: PARENT_MENU_ID },
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );

    if (parentMenu.length === 0) {
      throw new Error(
        `Parent menu Applications (id: ${PARENT_MENU_ID}) not found. Run the base menu seeder first.`
      );
    }

    const moduleRows = await queryInterface.sequelize.query(
      'SELECT id FROM rbac_modules WHERE alias = :alias LIMIT 1',
      {
        replacements: { alias: MODULE_ALIAS },
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );

    if (moduleRows.length === 0) {
      throw new Error(
        `RBAC module alias=${MODULE_ALIAS} not found. Run 20260805172900-seed_all_applications_modules.js first.`
      );
    }

    const moduleId = moduleRows[0].id;
    const timestamp = new Date();

    // Find existing All Applications menu by name+path+parent (our row only)
    const existingMenu = await queryInterface.sequelize.query(
      `SELECT id, module_id, \`order\`
       FROM menu
       WHERE name = :name
         AND path = :path
         AND parent_id = :parentId
       LIMIT 1`,
      {
        replacements: {
          name: MENU_NAME,
          path: MENU_PATH,
          parentId: PARENT_MENU_ID,
        },
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );

    if (existingMenu.length > 0) {
      const row = existingMenu[0];
      // Fix only our row if it points at the wrong module or wrong order
      if (Number(row.module_id) !== Number(moduleId) || Number(row.order) !== MENU_ORDER) {
        await queryInterface.sequelize.query(
          `UPDATE menu
           SET module_id = :moduleId,
               \`order\` = :orderVal,
               updatedAt = :updatedAt
           WHERE id = :id
             AND name = :name
             AND path = :path
             AND parent_id = :parentId`,
          {
            replacements: {
              moduleId,
              orderVal: MENU_ORDER,
              updatedAt: timestamp,
              id: row.id,
              name: MENU_NAME,
              path: MENU_PATH,
              parentId: PARENT_MENU_ID,
            },
          }
        );
        console.log(
          `Updated existing All Applications menu id=${row.id} → module_id=${moduleId}, order=${MENU_ORDER}.`
        );
      } else {
        console.log(
          `All Applications menu already correct (id: ${row.id}, module_id: ${row.module_id}). Skipping.`
        );
      }
      return;
    }

    const [maxRow] = await queryInterface.sequelize.query(
      'SELECT COALESCE(MAX(id), 0) AS maxId FROM menu',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    const newId = Number(maxRow.maxId) + 1;

    await queryInterface.bulkInsert('menu', [
      {
        id: newId,
        name: MENU_NAME,
        module_id: moduleId,
        parent_id: PARENT_MENU_ID,
        order: MENU_ORDER,
        path: MENU_PATH,
        is_deleted: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]);

    console.log(
      `Inserted menu id=${newId} name=${MENU_NAME} module_id=${moduleId} parent_id=${PARENT_MENU_ID} order=${MENU_ORDER}.`
    );
  },

  async down(queryInterface, Sequelize) {
    // Delete ONLY the All Applications menu row
    await queryInterface.bulkDelete(
      'menu',
      {
        name: MENU_NAME,
        path: MENU_PATH,
        parent_id: PARENT_MENU_ID,
      },
      {}
    );

    console.log(
      `Removed menu name=${MENU_NAME} path=${MENU_PATH} parent_id=${PARENT_MENU_ID}.`
    );
  },
};

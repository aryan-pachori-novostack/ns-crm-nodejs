'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const timestamp = new Date();

    // 1. Add to rbac_modules
    const [existingModule] = await queryInterface.sequelize.query(
      `SELECT id FROM rbac_modules WHERE alias = 'lead_sp_assignment_report' LIMIT 1;`
    );

    let moduleId;
    if (existingModule.length === 0) {
      const [result] = await queryInterface.sequelize.query(
        `INSERT INTO rbac_modules (name, alias, parent_id, is_active, is_deleted, createdAt, updatedAt) 
         VALUES ('DSA > Reports DSA > Lead SP Assignment', 'lead_sp_assignment_report', 20, 1, 0, NOW(), NOW());`
      );
      moduleId = result;
    } else {
      moduleId = existingModule[0].id;
    }

    // 2. Add to menu
    const [existingMenu] = await queryInterface.sequelize.query(
      `SELECT id FROM menu WHERE name = 'Lead SP Assignment' AND parent_id = 20 LIMIT 1;`
    );

    if (existingMenu.length === 0) {
      await queryInterface.sequelize.query(
        `INSERT INTO menu (name, module_id, parent_id, \`order\`, path, is_deleted, createdAt, updatedAt) 
         VALUES ('Lead SP Assignment', ${moduleId}, 20, 3, '/new-reports/lead-sp-assignment', 0, NOW(), NOW());`
      );
    }

    // 3. Grant access to Roles (CEO, etc.)
    const rolesToGrant = ['CEO', 'ADMIN', 'Super Admin'];
    const [roles] = await queryInterface.sequelize.query(
      `SELECT id FROM ru_roles WHERE name IN (${rolesToGrant.map(r => `'${r}'`).join(',')});`
    );

    if (roles.length > 0) {
      for (const role of roles) {
        const [existingPerm] = await queryInterface.sequelize.query(
          `SELECT id FROM role_modules WHERE role_id = ${role.id} AND module_id = ${moduleId} LIMIT 1;`
        );
        if (existingPerm.length === 0) {
          await queryInterface.sequelize.query(
            `INSERT INTO role_modules (role_id, module_id, \`read\`, \`write\`, \`edit\`, \`delete\`, createdAt, updatedAt) 
             VALUES (${role.id}, ${moduleId}, 1, 0, 0, 0, NOW(), NOW());`
          );
        }
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const [existingModule] = await queryInterface.sequelize.query(
      `SELECT id FROM rbac_modules WHERE alias = 'lead_sp_assignment_report' LIMIT 1;`
    );

    if (existingModule.length > 0) {
      const moduleId = existingModule[0].id;
      await queryInterface.sequelize.query(`DELETE FROM role_modules WHERE module_id = ${moduleId};`);
      await queryInterface.sequelize.query(`DELETE FROM menu WHERE module_id = ${moduleId};`);
      await queryInterface.sequelize.query(`DELETE FROM rbac_modules WHERE id = ${moduleId};`);
    }
  }
};

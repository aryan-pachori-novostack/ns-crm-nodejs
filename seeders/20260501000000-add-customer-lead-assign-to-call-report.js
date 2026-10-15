'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    
    // 1. Find Customers root module and menu
    const [customersModule] = await queryInterface.sequelize.query(
      `SELECT id FROM rbac_modules WHERE (name = 'Customers' OR alias = 'customers') AND parent_id IS NULL LIMIT 1;`
    );
    const customersModuleId = customersModule[0].id;

    const [customersMenu] = await queryInterface.sequelize.query(
      `SELECT id FROM menu WHERE name = 'Customers' AND parent_id IS NULL LIMIT 1;`
    );
    const customersMenuId = customersMenu[0].id;

    // Rename child Customers (ID 26) to 'All Customers' to avoid title conflict with parent
    await queryInterface.sequelize.query(
      `UPDATE menu SET name = 'All Customers' WHERE parent_id = ${customersMenuId} AND name = 'Customers';`
    );
    await queryInterface.sequelize.query(
      `UPDATE rbac_modules SET name = 'All Customers' WHERE parent_id = ${customersModuleId} AND name = 'Customers';`
    );

    // 2. Create/Update 'Reports' folder under Customers
    // First, create the module for the folder
    const [existingReportsModule] = await queryInterface.sequelize.query(
      `SELECT id FROM rbac_modules WHERE alias = 'customers_reports' LIMIT 1;`
    );

    let reportsModuleId;
    if (existingReportsModule.length === 0) {
      const [result] = await queryInterface.sequelize.query(
        `INSERT INTO rbac_modules (name, alias, parent_id, is_active, is_deleted, createdAt, updatedAt) 
         VALUES ('Reports Customer', 'customers_reports', ${customersModuleId}, 1, 0, NOW(), NOW());`
      );
      reportsModuleId = result;
    } else {
      reportsModuleId = existingReportsModule[0].id;
      await queryInterface.sequelize.query(
        `UPDATE rbac_modules SET parent_id = ${customersModuleId}, name = 'Reports Customer' WHERE id = ${reportsModuleId};`
      );
    }

    // Then, create the menu for the folder
    const [existingReportsMenu] = await queryInterface.sequelize.query(
      `SELECT id FROM menu WHERE name IN ('Reports', 'Reports Customer') AND parent_id = ${customersMenuId} LIMIT 1;`
    );

    let reportsMenuId;
    if (existingReportsMenu.length === 0) {
      const [result] = await queryInterface.sequelize.query(
        `INSERT INTO menu (name, module_id, parent_id, \`order\`, path, is_deleted, createdAt, updatedAt) 
         VALUES ('Reports Customer', ${reportsModuleId}, ${customersMenuId}, 90, '', 0, NOW(), NOW());`
      );
      reportsMenuId = result;
    } else {
      reportsMenuId = existingReportsMenu[0].id;
      await queryInterface.sequelize.query(
        `UPDATE menu SET name = 'Reports Customer', module_id = ${reportsModuleId}, path = '' WHERE id = ${reportsMenuId};`
      );
    }

    // 3. Create/Update the Report itself under the Reports folder
    const [existingReportModule] = await queryInterface.sequelize.query(
      `SELECT id FROM rbac_modules WHERE alias = 'customer_lead_assign_to_call_report' LIMIT 1;`
    );

    let reportModuleId;
    if (existingReportModule.length === 0) {
      const [result] = await queryInterface.sequelize.query(
        `INSERT INTO rbac_modules (name, alias, parent_id, is_active, is_deleted, createdAt, updatedAt) 
         VALUES ('Customer Lead Assign To Call', 'customer_lead_assign_to_call_report', ${reportsModuleId}, 1, 0, NOW(), NOW());`
      );
      reportModuleId = result;
    } else {
      reportModuleId = existingReportModule[0].id;
      await queryInterface.sequelize.query(
        `UPDATE rbac_modules SET parent_id = ${reportsModuleId}, name = 'Customer Lead Assign To Call' WHERE id = ${reportModuleId};`
      );
    }

    const [existingReportMenu] = await queryInterface.sequelize.query(
      `SELECT id FROM menu WHERE path = '/new-reports/customer-lead-assign-to-call' LIMIT 1;`
    );

    if (existingReportMenu.length === 0) {
      await queryInterface.sequelize.query(
        `INSERT INTO menu (name, module_id, parent_id, \`order\`, path, is_deleted, createdAt, updatedAt) 
         VALUES ('Customer Lead Assign To Call', ${reportModuleId}, ${reportsMenuId}, 1, '/new-reports/customer-lead-assign-to-call', 0, NOW(), NOW());`
      );
    } else {
      await queryInterface.sequelize.query(
        `UPDATE menu SET parent_id = ${reportsMenuId}, module_id = ${reportModuleId} WHERE id = ${existingReportMenu[0].id};`
      );
    }

    // 4. Grant permissions to roles for BOTH the folder and the report
    const rolesToGrant = ['CEO', 'ADMIN', 'Super Admin'];
    const [roles] = await queryInterface.sequelize.query(
      `SELECT BIN_TO_UUID(id) as id FROM roles WHERE role IN (${rolesToGrant.map(r => `'${r}'`).join(',')});`
    );

    if (roles.length > 0) {
      const modulesToGrant = [reportsModuleId, reportModuleId];
      for (const role of roles) {
        for (const modId of modulesToGrant) {
          const [existingPerm] = await queryInterface.sequelize.query(
            `SELECT id FROM role_modules WHERE role_id = UUID_TO_BIN('${role.id}') AND module_id = ${modId} LIMIT 1;`
          );
          if (existingPerm.length === 0) {
            await queryInterface.sequelize.query(
              `INSERT INTO role_modules (role_id, module_id, \`read\`, \`write\`, \`edit\`, \`delete\`, createdAt, updatedAt) 
               VALUES (UUID_TO_BIN('${role.id}'), ${modId}, 1, 0, 0, 0, NOW(), NOW());`
            );
          } else {
            await queryInterface.sequelize.query(
              `UPDATE role_modules SET \`read\` = 1 WHERE role_id = UUID_TO_BIN('${role.id}') AND module_id = ${modId};`
            );
          }
        }
      }
    }
  },

  async down(queryInterface, Sequelize) {
    // Basic cleanup logic if needed
  }
};

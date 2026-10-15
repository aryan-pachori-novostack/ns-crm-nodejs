'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Insert cross join of roles and modules
    // For CEO role, set all permissions (create, read, update, delete) to true
    // For other roles, set all permissions to false (default)
    await queryInterface.sequelize.query(`
      INSERT INTO role_modules (role_id, module_id, \`create\`, \`read\`, \`update\`, \`delete\`, updated_on)
      SELECT
        r.id as role_id,
        m.id as module_id,
        CASE WHEN r.role = 'CEO' THEN 1 ELSE 0 END as \`create\`,
        CASE WHEN r.role = 'CEO' THEN 1 ELSE 0 END as \`read\`,
        CASE WHEN r.role = 'CEO' THEN 1 ELSE 0 END as \`update\`,
        CASE WHEN r.role = 'CEO' THEN 1 ELSE 0 END as \`delete\`,
        CURRENT_TIMESTAMP as updated_on
      FROM roles r
      CROSS JOIN rbac_modules m
      WHERE m.is_deleted = 0 AND m.is_active = 1
      ORDER BY r.id, m.id;
    `);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('role_modules', null, {});
  }
};

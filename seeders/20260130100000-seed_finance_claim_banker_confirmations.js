'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const timestamp = new Date();
    const moduleId = 142;

    // 1. Insert RBAC module under Finance > Claim (parent_id: 69)
    await queryInterface.bulkInsert('rbac_modules', [
      {
        id: moduleId,
        name: 'Finance > Claim > Banker Confirmations',
        alias: 'finance_claim_banker_confirmations',
        parent_id: 69,
        is_active: true,
        is_deleted: false,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ], {});

     // role_modules are auto-populated by DB trigger after_rbac_module_insert
  },

  async down(queryInterface, Sequelize) {
    const moduleId = 142;
    await queryInterface.bulkDelete('role_modules', { module_id: moduleId }, {});
    await queryInterface.bulkDelete('rbac_modules', { id: moduleId }, {});
  }
};

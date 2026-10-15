'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const timestamp = new Date();

    // Mirrors 20251105051854-seed_rbac_modules.js (Education Loan, id 51)
    const modulesData = [
      {
        id: 144,
        name: 'Applications > LAS',
        alias: 'applications_las',
        parent_id: 28,
        is_active: true,
        is_deleted: false
      }
    ];

    await queryInterface.bulkInsert(
      'rbac_modules',
      modulesData.map((module) => ({
        ...module,
        createdAt: timestamp,
        updatedAt: timestamp
      })),
      {}
    );

    // Mirrors 20251105051900-seed_menu.js (Education Loan, id 51)
    // Each menu item references its own module (module_id = menu id for 1:1 mapping)
    const menuData = [
      {
        id: 144,
        name: 'LAS',
        module_id: 144,
        parent_id: 28,
        order: 16,
        path: '/applications/las',
        is_deleted: false
      }
    ];

    await queryInterface.bulkInsert(
      'menu',
      menuData.map((menu) => ({
        ...menu,
        createdAt: timestamp,
        updatedAt: timestamp
      })),
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('menu', { id: 144 }, {});
    await queryInterface.bulkDelete('role_modules', { module_id: 144 }, {});
    await queryInterface.bulkDelete('rbac_modules', { id: 144 }, {});
  }
};

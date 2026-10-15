'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Each menu item gets its own module with full hierarchical naming
    // Format: ParentModule > ChildModule > GrandchildModule... 
    const modulesData = [
      // Level 0 - Root menu item (Help & Support - parent module)
      { id: 139, name: 'Help & Support', alias: 'help_and_support', parent_id: null, is_active: true, is_deleted: false },

      // Level 1 - Help & Support children
      { id: 140, name: 'Help & Support > HelpDesk', alias: 'help_and_support_helpdesk', parent_id: 139, is_active: true, is_deleted: false },
      { id: 141, name: 'Help & Support > User Guide', alias: 'help_and_support_user_guide', parent_id: 139, is_active: true, is_deleted: false }
    ];

    const timestamp = new Date();
    const dataToInsert = modulesData.map(module => ({
      ...module,
      createdAt: timestamp,
      updatedAt: timestamp
    }));

    await queryInterface.bulkInsert('rbac_modules', dataToInsert, {});
  },

  async down (queryInterface, Sequelize) {
    // Delete only the modules we added (child modules first, then parent)
    await queryInterface.bulkDelete('rbac_modules', {
      id: {
        [Sequelize.Op.in]: [140, 141, 139]  // Delete HelpDesk, User Guide modules, then Help & Support module
      }
    }, {});
  }
};


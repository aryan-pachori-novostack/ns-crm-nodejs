'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Getting the current timestamp for knowing when the Menu's were created
    const timestamp = new Date();
    
    const helpMenuData = [
      // Parent menu "Need Help" - root level menu (parent_id: null)
      { 
        id: 132, 
        name: 'Help & Support', 
        module_id: 139,  // Links to the corresponding module
        parent_id: null,  // Root level menu, no parent
        order: 14,  // Order after Career menu (order 13)
        path: '',  // Empty path as it's a parent menu
        is_deleted: false
      },
      // Sub-menu "HelpDesk" - child of "Need Help"
      { 
        id: 133, 
        name: 'HelpDesk', 
        module_id: 140,  // Links to the corresponding module
        parent_id: 132,  // Parent is "Need Help" menu (id: 132)
        order: 1,  // First child menu
        path: 'https://helpdesk.ruloans.com/',  // Path for the HelpDesk page
        is_deleted: false
      },
      // Sub-menu "Guide" - child of "Need Help"
      { 
        id: 134, 
        name: 'User Guide', 
        module_id: 141,  // Links to the corresponding module
        parent_id: 132,  // Parent is "Need Help" menu (id: 132)
        order: 2,  // Second child menu
        path: 'https://docs.ruloans.com/crm/features/dsa/channel-partner/call-logs',  // Path for the Guide page
        is_deleted: false
      }
    ];
    const dataToInsert = helpMenuData.map(menu => ({
      ...menu,
      createdAt: timestamp,
      updatedAt: timestamp
    }));

    await queryInterface.bulkInsert('menu', dataToInsert, {});
  },

  async down (queryInterface, Sequelize) {
    // Delete only the specific menu items we added (132, 133, 134)
    // This ensures we don't accidentally delete other menus 
    await queryInterface.bulkDelete('menu', {
      id: {
        [Sequelize.Op.in]: [132, 133, 134]  // Delete only Need Help, HelpDesk, and User Guide menus
      }
    }, {});
  }
};
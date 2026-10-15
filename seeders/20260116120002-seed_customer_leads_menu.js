'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Getting the current timestamp for knowing when the Menu's were created
    const timestamp = new Date();
    
    const customerLeadsMenuData = [
      // Sub-menu "Leads" - child of "Customers" (parent_id: 25)
      { 
        id: 136, 
        name: 'Leads', 
        module_id: 143,  // Links to the corresponding module (Customers > Leads)
        parent_id: 25,  // Parent is "Customers" menu (id: 25)
        order: 3,  // Third child menu (after "Customers" order 1, "Customer Queries" order 2)
        path: '/customers/applications',  // Path for the Leads page
        is_deleted: false
      }
    ];
    const dataToInsert = customerLeadsMenuData.map(menu => ({
      ...menu,
      createdAt: timestamp,
      updatedAt: timestamp
    }));

    await queryInterface.bulkInsert('menu', dataToInsert, {});
  },

  async down (queryInterface, Sequelize) {
    // Delete only the specific menu item we added (136)
    // This ensures we don't accidentally delete other menus 
    await queryInterface.bulkDelete('menu', {
      id: {
        [Sequelize.Op.in]: [136]  // Delete only Leads menu
      }
    }, {});
  }
};


'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add "Leads" module as a child under Customers module (module_id: 25)
    // Format: Customers > Leads
    const modulesData = [
      // Level 1 - Customers children
      { id: 143, name: 'Customers > Leads', alias: 'customers_leads', parent_id: 25, is_active: true, is_deleted: false }
    ];

    // Check if parent module exists
    const parentModule = await queryInterface.sequelize.query(
      'SELECT id FROM rbac_modules WHERE id = 25',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (parentModule.length === 0) {
      throw new Error('Parent module with id 25 (Customers) does not exist. Please run the base module seeder first.');
    }

    // Check if module already exists
    const existingModule = await queryInterface.sequelize.query(
      'SELECT id, alias FROM rbac_modules WHERE id = 143 OR alias = :alias',
      {
        replacements: { alias: 'customers_leads' },
        type: queryInterface.sequelize.QueryTypes.SELECT
      }
    );

    if (existingModule.length > 0) {
      console.log('Module already exists:', existingModule);
      return; // Skip insertion if already exists
    }

    const timestamp = new Date();
    const dataToInsert = modulesData.map(module => ({
      ...module,
      createdAt: timestamp,
      updatedAt: timestamp
    }));

    await queryInterface.bulkInsert('rbac_modules', dataToInsert, {});
  },

  async down (queryInterface, Sequelize) {
    // Delete only the module we added
    await queryInterface.bulkDelete('rbac_modules', {
      id: {
        [Sequelize.Op.in]: [143]  // Delete Leads module
      }
    }, {});
  }
};


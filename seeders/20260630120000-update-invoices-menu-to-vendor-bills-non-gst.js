'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkUpdate(
      'menu',
      { name: 'Vendor Bills(Non GST)', path: '/vendor-bills-non-gst' },
      { id: 89 }
    );

    await queryInterface.bulkUpdate(
      'menu',
      { path: '/vendor-bills-non-gst/analytics' },
      { id: 88 }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkUpdate(
      'menu',
      { name: 'Invoices', path: '/invoices' },
      { id: 89 }
    );

    await queryInterface.bulkUpdate(
      'menu',
      { path: '/invoices/analytics' },
      { id: 88 }
    );
  }
};

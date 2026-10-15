'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Update display names and paths only for menu ids 77 and 78.
    await queryInterface.bulkUpdate(
      'menu',
      { name: 'Bank-wise RM', path: '/bank-wise-rm' },
      { id: 77 }
    );

    await queryInterface.bulkUpdate(
      'menu',
      { name: 'NS Bank File Search', path: '/ns-bank-file-search' },
      { id: 78 }
    );

    await queryInterface.bulkUpdate(
      'rbac_modules',
      { name: 'Finance > Finance Tools > Bank-wise RM' },
      { id: 77 }
    );

    await queryInterface.bulkUpdate(
      'rbac_modules',
      { name: 'Finance > Finance Tools > NS Bank File Search' },
      { id: 78 }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkUpdate(
      'menu',
      { name: 'Find Banks', path: '/find-banks' },
      { id: 77 }
    );

    await queryInterface.bulkUpdate(
      'menu',
      { name: 'Bank Files', path: '/bank-files' },
      { id: 78 }
    );

    await queryInterface.bulkUpdate(
      'rbac_modules',
      { name: 'Finance > Finance Tools > Find Banks' },
      { id: 77 }
    );

    await queryInterface.bulkUpdate(
      'rbac_modules',
      { name: 'Finance > Finance Tools > Bank Files' },
      { id: 78 }
    );
  }
};

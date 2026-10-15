'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.renameColumn('picklist_keys', 'moduleId', 'module_id');
    await queryInterface.renameColumn('picklist_values', 'keyId', 'key_id');
    await queryInterface.renameColumn('picklist_values', 'parentId', 'parent_id');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.renameColumn('picklist_keys', 'module_id', 'moduleId');
    await queryInterface.renameColumn('picklist_values', 'key_id', 'keyId');
    await queryInterface.renameColumn('picklist_values', 'parent_id', 'parentId');
  }
};

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.createTable('email_template_fields', {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING
      },
      key: {
        type: Sequelize.STRING
      },
      parent_id: {
        type: Sequelize.INTEGER
      },
      type: {
        type: Sequelize.ENUM('module', 'general'),
        defaultValue: 'module'
      },

    });

  },

  async down(queryInterface, Sequelize) {

    await queryInterface.dropTable('email_template_fields');
  }
};

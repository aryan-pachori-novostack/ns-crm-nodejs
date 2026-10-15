'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('crm_component_configs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      platform:{
        allowNull:false,
        type:Sequelize.STRING
      },
      module: {
        type: Sequelize.STRING,
        allowNull:false
      },
      placement: {
        type: Sequelize.STRING,
        allowNull:false
      },
      component_type: {
        type: Sequelize.STRING,
        allowNull:false
      },
      title: {
        type: Sequelize.STRING,
        allowNull:false
      },
      sub_title: {
        type: Sequelize.STRING
      },
      description: {
        type: Sequelize.STRING
      },
      section: {
        type: Sequelize.STRING,
        allowNull:false
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('crm_component_configs');
  }
};
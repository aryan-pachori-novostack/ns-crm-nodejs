'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('dsa_step_wise_count', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      step_1_count:{
        type: Sequelize.INTEGER,
        allowNull: false
      },
      step_2_count:{
        type: Sequelize.INTEGER,
        allowNull: false
      },
      step_3_count:{
        type: Sequelize.INTEGER,
        allowNull: false
      },
      step_4_count:{
        type: Sequelize.INTEGER,
        allowNull: false
      },
      step_5_count:{
        type: Sequelize.INTEGER,
        allowNull: false
      },
      step_6_count:{
        type: Sequelize.INTEGER,
        allowNull: false
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
    await queryInterface.dropTable('dsa_step_wise_count');
  }
};
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    
    await queryInterface.createTable('lead_status', { 
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      } ,
      value:{
        type:Sequelize.STRING,
        allowNull: false
      },
      step_number:{
        type:Sequelize.INTEGER
      },
      parent_id:{
        type:Sequelize.INTEGER
      }
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('lead_status');
  }
};

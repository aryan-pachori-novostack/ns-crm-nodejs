'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    
    await queryInterface.createTable('lead_tags', { 
      id: {
        type: 'VARBINARY(16)', //changing this to Sequelize.UUID does not make any difference
        primaryKey: true,
        defaultValue:Sequelize.UUIDV4
      },
      user_id: {
        type: 'VARBINARY(16)', 
        allowNull:false
      },
      tag_id: {
        type: 'VARBINARY(16)', 
        allowNull:false
      },
      tag_id: {
        type: 'VARBINARY(16)',
        allowNull:false 
      },
      tagged_by:{
        type: 'VARBINARY(16)',
        allowNull:false
      },
      createdAt:{
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt:{
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    },{
      timeStamp: true,
      createdAt: true,
      updatedAt: true
    }
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('lead_tags');
  }
};

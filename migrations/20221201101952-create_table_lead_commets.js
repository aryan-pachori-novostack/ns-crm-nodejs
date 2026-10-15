'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    
    await queryInterface.createTable('lead_comments', { 
      id: {
        type: 'VARBINARY(16)', //changing this to Sequelize.UUID does not make any difference
        primaryKey: true,
        defaultValue:Sequelize.UUIDV4
      },
      lead_id: {
        type: 'VARBINARY(16)', 
        allowNull:false
      },
      comment: {
        type: Sequelize.STRING, 
        allowNull:false
      },
      attachment_url: {
        type: Sequelize.STRING
      },
      is_deleted: {
        type: Sequelize.BOOLEAN,
        defaultValue:false
      },
      parent_id: {
        type: 'VARBINARY(16)', 
        allowNull:false
      },
      created_by: {
        type: 'VARBINARY(16)', 
        allowNull:false
      },
      updated_by: {
        type: 'VARBINARY(16)'
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
    await queryInterface.dropTable('lead_comments');
  }
};

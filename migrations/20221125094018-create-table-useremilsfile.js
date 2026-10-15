'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    
      await queryInterface.createTable('user_emails', 
      { 
          id: {
            type: 'VARBINARY(16)', 
            primaryKey: true,
            defaultValue:Sequelize.UUIDV4
          },
          to_mail: {
            type:Sequelize.STRING, 
            allowNull:false
          }, 
          to_cc: {
            type:Sequelize.STRING, 
            allowNull:false
          },
          to_bcc: {
            type:Sequelize.STRING, 
            allowNull:false 
          }, 
          subject: {
            type:Sequelize.STRING, 
            allowNull:false 
          },
          body: {
            type:Sequelize.TEXT, 
            allowNull:false 
          },
          status: {
            type: Sequelize.ENUM('draft', 'success','pending','failure'),
            defaultValue: 'pending'
          },
          send_by: {
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
          },
  });
},

  async down (queryInterface, Sequelize) {
  
      await queryInterface.dropTable('user_emails');
     
  }
};

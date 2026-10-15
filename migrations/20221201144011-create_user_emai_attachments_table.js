'use strict';

const { sequelize } = require('../models');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
 
      await queryInterface.createTable('user_email_attachments', 
      {
        id:{
          allowNull:false,
          type: 'VARBINARY(16)', //changing this to Sequelize.UUID does not make any difference
          primaryKey: true,
          defaultValue:Sequelize.UUIDV4
        },
        email_id : {
          allowNull: false,
          type: 'VARBINARY(16)'
        },
        url : {
          type : Sequelize.STRING ,
          allowNull :false
        },

  });
}, 

  async down (queryInterface, Sequelize) {
  
      await queryInterface.dropTable('user_email_attachments');
     
  }
};

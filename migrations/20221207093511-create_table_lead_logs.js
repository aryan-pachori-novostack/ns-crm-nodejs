'use strict';

const { sequelize } = require('../models');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
 
      await queryInterface.createTable('lead_logs', 
      {
        id:{
          allowNull:false,
          type: 'VARBINARY(16)', //changing this to Sequelize.UUID does not make any difference
          primaryKey: true,
          defaultValue:Sequelize.UUIDV4
        },
        lead_id : {
          allowNull: false,
          type: 'VARBINARY(16)'
        },
        updated_by: {
          allowNull:false,
          type:'VARBINARY(16)'
        },
        type_value:{
          type:Sequelize.STRING,
          allowNull:false
        },
        from_value:{
          type:Sequelize.STRING
        },
        to_value:{
          type:Sequelize.STRING
        },
        operation_type:{
          type:Sequelize.STRING,
          allowNull:false
        },
        created_at:{
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at:{
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }

  });
}, 

  async down (queryInterface, Sequelize) {
  
      await queryInterface.dropTable('lead_logs');
     
  }
};

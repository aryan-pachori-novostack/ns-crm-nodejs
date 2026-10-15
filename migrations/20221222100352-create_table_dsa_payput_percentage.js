'use strict';

const { sequelize } = require('../models');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
 
      await queryInterface.createTable('dsa_global_payouts_percentage', 
      {
        id:{
          allowNull:false,
          type: 'VARBINARY(16)', //changing this to Sequelize.UUID does not make any difference
          primaryKey: true,
          defaultValue:Sequelize.UUIDV4
        },
       phone:{
        allowNull:false,
        type:Sequelize.STRING
       },
       payout_percentage:{
        allowNull:false,
        type:Sequelize.FLOAT
       }

  });
}, 

  async down (queryInterface, Sequelize) {
  
      await queryInterface.dropTable('dsa_global_payouts_percentage');
     
  }
};

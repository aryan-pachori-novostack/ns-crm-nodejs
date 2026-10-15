'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('star_leads', { 
      id: {
        type: 'VARBINARY(16)', //changing this to Sequelize.UUID does not make any difference
        primaryKey: true,
        defaultValue:Sequelize.UUIDV4
      },
      lead_id: {
        type: 'VARBINARY(16)', 
        allowNull:false
      },
      user_id: {
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
     await queryInterface.dropTable('star_leads');
  }
};

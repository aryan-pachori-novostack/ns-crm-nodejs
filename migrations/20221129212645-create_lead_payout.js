'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
      await queryInterface.createTable('lead_payout', 
      { 
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        payout_id: {
          type: Sequelize.INTEGER,
          allowNull:false
        },
        user_id: {
          type: 'VARBINARY(16)'
        },
        created_at:{
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
         },
         updated_at:{
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
         }
      }, {
        timeStamp: true,
        createdAt: true,
        updatedAt: true
      });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('lead_payout');
  }
};

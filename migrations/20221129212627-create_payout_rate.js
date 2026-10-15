'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
      await queryInterface.createTable('payout_rate', 
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
       rate_percentage: {
          type: Sequelize.FLOAT,
          allowNull:false
        },
        disb_amount_from: {
          type: Sequelize.FLOAT
        },
        disb_amount_to: {
          type: Sequelize.FLOAT
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
    await queryInterface.dropTable('payout_rate');
  }
};

'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('leads', {
      id: {
        type: 'VARBINARY(16)', //changing this to Sequelize.UUID does not make any difference
        primaryKey: true,
        defaultValue:Sequelize.UUIDV4
      },
      mobile:{
        type: Sequelize.STRING,
        allowNull:false
      },
      prefix:{
        type: Sequelize.STRING,
        allowNull:false
      },
      user_fname:{
          type: Sequelize.STRING,
          allowNull:false
      },
      user_mname:{
        type: Sequelize.STRING
      },
      user_lname:{
        type: Sequelize.STRING,
        allowNull:false
      },
      email:{
        type: Sequelize.STRING,
        allowNull:false
      },
      source:{
        type: Sequelize.STRING
      },
      lead_source:{
        type: Sequelize.INTEGER
      },
      status:{
        type: Sequelize.INTEGER
      },
      assigned_to:{
        type: 'VARBINARY(16)',
        allowNull:false
      },
      pan:{
        type: Sequelize.STRING,
        allowNull:false
      },
      is_fresh_lead:{
        type: Sequelize.BOOLEAN
      },
      profession:{
        type: Sequelize.INTEGER
      },
      category:{
        type: Sequelize.INTEGER
      },
      alt_mobile:{
        type:Sequelize.STRING
      },
      channel_manager:{
        type: 'VARBINARY(16)',
        allowNull:false
      },
      potential:{
        type: Sequelize.INTEGER
      },
      dob:{
        type:Sequelize.DATE
      },
      lead_type:{
        type: Sequelize.INTEGER
      }, 
      payout_percentage:{
        type: Sequelize.FLOAT,
        allowNull:false
      },  
      createdAt:{
        type: Sequelize.DATE
      },
      updatedAt:{
          type: Sequelize.DATE
      }
    },{
      timeStamp: true,
      createdAt: true,
      updatedAt: true
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('leads');
  }
};

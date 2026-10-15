'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('lead_additional_information', {
      id: {
        type: 'VARBINARY(16)', //changing this to Sequelize.UUID does not make any difference
        primaryKey: true,
        defaultValue:Sequelize.UUIDV4
      },
      lead_id:{
        type: 'VARBINARY(16)',
        allowNull:false
      },
      has_done_loan_buisness:{
        type: Sequelize.BOOLEAN,
        defaultValue:false
      },
      year_loan_buisness:{
          type: Sequelize.INTEGER
      },
      has_coonector_code:{
        type: Sequelize.BOOLEAN,
        defaultValue:false
      },
      has_reapplied:{
          type: Sequelize.BOOLEAN,
          defaultValue:false
      },
      secondary_email:{
        type: Sequelize.STRING
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
    await queryInterface.dropTable('lead_additional_information');
  }
};

'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('lead_address', {
      id: {
        type: 'VARBINARY(16)', //changing this to Sequelize.UUID does not make any difference
        primaryKey: true,
        defaultValue:Sequelize.UUIDV4
      },
      lead_id:{
        type: 'VARBINARY(16)',
        allowNull:false
      },
      address:{
        type: Sequelize.STRING,
        allowNull:false
      },
      city:{
          type: Sequelize.STRING,
          allowNull:false
      },
      state:{
        type: Sequelize.STRING,
        allowNull:false
      },
      pincode:{
          type: Sequelize.STRING,
          allowNull:true
      },
      type:{
        type: Sequelize.STRING,
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
    await queryInterface.dropTable('lead_address');
  }
};

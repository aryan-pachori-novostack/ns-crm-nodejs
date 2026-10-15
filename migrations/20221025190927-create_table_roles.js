'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('roles', {
      id: {
        type: 'VARBINARY(16)', //changing this to Sequelize.UUID does not make any difference
        primaryKey: true,
        defaultValue:Sequelize.UUIDV4
      },
      role:{
        type: Sequelize.STRING,
        allowNull:false,
        unique: true
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
    await queryInterface.dropTable('roles');
  }
};

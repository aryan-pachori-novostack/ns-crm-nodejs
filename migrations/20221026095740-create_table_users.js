'use strict';
let uuid = require('node-uuid');
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: 'VARBINARY(16)', //changing this to Sequelize.UUID does not make any difference
        primaryKey: true,
        defaultValue:Sequelize.UUIDV4
      },
      name: {
        type: Sequelize.STRING
      },
      email: {
        type: Sequelize.STRING,
        allowNull:false,
        unique:true
      },
      phone: {
        type: Sequelize.STRING
      },
      password: {
        type: Sequelize.STRING,
        allowNull:false
      },
      role:{
        type: 'VARBINARY(16)', 
        references: {
          model: 'roles',
          key: 'id',
        },
        allowNull:false,
      },
      createdBy:{
        type: 'VARBINARY(16)', 
        references: {
          model: 'users',
          key: 'id',
        }
      },
      parent:{
        type: 'VARBINARY(16)', 
        references: {
          model: 'users',
          key: 'id',
        }
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
    await queryInterface.dropTable('users');
  }
};

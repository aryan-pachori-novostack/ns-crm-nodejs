'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('call_logs', {
      id:{
        allowNull: false,
        primaryKey: true,
        type: 'VARBINARY(16)',
        defaultValue: Sequelize.UUIDV4
      },
      user_type:{
        allowNull:false,
        type:Sequelize.STRING
      },
      user_id: {
        type: Sequelize.STRING,
        allowNull:false
      },
      call_status: {
        type: Sequelize.INTEGER,
        allowNull:false
      },
      remarks: {
        type: Sequelize.STRING,
        allowNull:false
      },
      createdBy: {
        type: Sequelize.STRING,
        allowNull:false
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('call_logs');
  }
};
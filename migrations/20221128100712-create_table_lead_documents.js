'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.createTable('lead_documents', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: 'VARBINARY(16)',
        defaultValue: Sequelize.UUIDV4
      },
      title: {
        type: Sequelize.STRING
      },
      file_path: {
        type: Sequelize.STRING
      },
      type: {
        type: Sequelize.INTEGER,
        allowNull:false
      },
      assigned_to: {
        type: 'VARBINARY(16)',
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      created_by: {
        type: 'VARBINARY(16)',
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_by: {
        type: Sequelize.STRING
      }
    });
  },

  async down(queryInterface, Sequelize) {

    await queryInterface.dropTable('lead_documents');

  }
};

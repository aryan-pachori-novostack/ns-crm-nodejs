'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('lead_comments', 'status_id', {
      type: Sequelize.INTEGER,
      allowNull:false
    });

  },

  async down(queryInterface, Sequelize) {

    await queryInterface.removeColumn('lead_comments', 'status_id');
  }
};

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add the dsa_id column to lead_payout table
    await queryInterface.addColumn('lead_payout', 'dsa_id', {
      type: Sequelize.STRING(100),
      allowNull: true, // set to false if you want it required
    });

    // Add an index on the dsa_id column
    await queryInterface.addIndex('lead_payout', ['dsa_id'], {
      name: 'lead_payout_dsa_id_idx'
    });

  },

  async down(queryInterface, Sequelize) {
    // Remove the index on dsa_id column
    await queryInterface.removeIndex('lead_payout', 'lead_payout_dsa_id_idx');

    // Remove the dsa_id column from lead_payout table
    await queryInterface.removeColumn('lead_payout', 'dsa_id');
  }
};

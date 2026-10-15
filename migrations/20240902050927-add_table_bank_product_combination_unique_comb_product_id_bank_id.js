'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Adding a unique constraint on the combination of bank_id and product_id
    await queryInterface.addConstraint('bank_product_combinations', {
      fields: ['bank_id', 'product_id'],
      type: 'unique',
      name: 'unique_bank_product_combinations' // Optional: specify a name for the constraint
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Removing the unique constraint
    await queryInterface.removeConstraint('bank_product_combinations', 'unique_bank_product_combinations');
  }
};

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('payouts', 'type_of_payout', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('payouts', 'company_category', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('payouts', 'billing_cycle', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('payouts', 'payment_term', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('payouts', 'minimum_pf', {
      type: Sequelize.INTEGER,
    });

    await queryInterface.addColumn('payouts', 'minimum_irr', {
      type: Sequelize.INTEGER,
    });

    await queryInterface.addColumn('payouts', 'minimum_insurance', {
      type: Sequelize.INTEGER,
    });

    await queryInterface.addColumn('payouts', 'link', {
      type: Sequelize.STRING,
    });

    await queryInterface.renameColumn('payouts', 'invoice_remark', 'billing_mode');

  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('payouts', 'type_of_payout');
    await queryInterface.removeColumn('payouts', 'company_category');
    await queryInterface.removeColumn('payouts', 'billing_cycle');
    await queryInterface.removeColumn('payouts', 'payment_term');
    await queryInterface.removeColumn('payouts', 'minimum_pf');
    await queryInterface.removeColumn('payouts', 'minimum_irr');
    await queryInterface.removeColumn('payouts', 'minimum_insurance');
    await queryInterface.removeColumn('payouts', 'link');
    await queryInterface.renameColumn('payouts', 'billing_mode', 'invoice_remark');
  }
};
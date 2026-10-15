'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payouts',
      {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        bank_name: {
          type: Sequelize.STRING
        },
        registered_on_company_name: {
          type: Sequelize.STRING
        },
        main_product: {
          type: Sequelize.STRING
        },
        sub_product: {
          type: Sequelize.STRING
        },
        product_group: {
          type: Sequelize.STRING
        },
        agreement_expired_by: {
          type: Sequelize.DATE
        },
        enrollment_date: {
          type: Sequelize.DATE
        },
        invoice_remark: {
          type: Sequelize.STRING
        },
        login_code: {
          type: Sequelize.STRING
        },
        product: {
          type: Sequelize.STRING
        },
        address: {
          type: Sequelize.STRING
        },
        max_payout: {
          type: Sequelize.STRING
        },
        billing_date_from: {
          type: Sequelize.STRING
        },
        billing_date_to: {
          type: Sequelize.STRING
        },
        applicable_from: {
          type: Sequelize.STRING
        },
        applicable_to: {
          type: Sequelize.STRING
        },
        remarks: {
          type: Sequelize.STRING
        },
        type: {
          type: Sequelize.STRING
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      }, {
      timeStamp: true,
      createdAt: true,
      updatedAt: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('payouts');
  }
};

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
      await queryInterface.createTable('payouts_list', 
      { 
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        bank_nbfc_name: {
          type: Sequelize.STRING
        },
        main_product: {
          type: Sequelize.STRING
        },
        product: {
          type: Sequelize.STRING
        },
        company_name: {
          type: Sequelize.STRING
        },
        login_code: {
          type: Sequelize.STRING
        },
        product_group: {
          type: Sequelize.STRING
        },
        sub_product_group: {
          type: Sequelize.STRING
        },
        gst_reimbursement: {
          type: Sequelize.STRING
        },
        invoice_remark: {
          type: Sequelize.STRING
        },
        billing_month_from: {
          type: Sequelize.STRING
        },
        billing_month_to: {
          type: Sequelize.STRING
        },
        applicable_from: {
          type: Sequelize.STRING
        },
        applicable_till: {
          type: Sequelize.STRING
        },
        max_payout_for_single_case: {
          type: Sequelize.STRING
        },
        payout_percentage: {
          type: Sequelize.STRING
        },
        payout_type: {
          type: Sequelize.STRING
        },
        remark: {
          type: Sequelize.STRING
        },
        expire_on: {
          type: Sequelize.STRING
        },
        status: {
          type: Sequelize.STRING
        },
        last_updated_on: {
          type: Sequelize.STRING
        },
        payout_rate_1: {
          type: Sequelize.STRING
        },
        disb_amount_from_payout_1: {
          type: Sequelize.INTEGER
        },
        disb_amount_to_payout_1: {
          type: Sequelize.INTEGER
        },
        payout_rate_2: {
          type: Sequelize.STRING
        },
        disb_amount_from_payout_2: {
          type: Sequelize.INTEGER
        },
        disb_amount_to_payout_2: {
          type: Sequelize.INTEGER
        },
        payout_rate_3: {
          type: Sequelize.STRING
        },
        disb_amount_from_payout_3: {
          type: Sequelize.INTEGER
        },
        disb_amount_to_payout_3: {
          type: Sequelize.INTEGER
        },
        payout_rate_4: {
          type: Sequelize.STRING
        },
        disb_amount_from_payout_4: {
          type: Sequelize.INTEGER
        },
        disb_amount_to_payout_4: {
          type: Sequelize.INTEGER
        },
        payout_rate_5: {
          type: Sequelize.STRING
        },
        disb_amount_from_payout_5: {
          type: Sequelize.INTEGER
        },
        disb_amount_to_payout_5: {
          type: Sequelize.INTEGER
        },
        payout_rate_6: {
          type: Sequelize.STRING
        },
        disb_amount_from_payout_6: {
          type: Sequelize.INTEGER
        },
        disb_amount_to_payout_6: {
          type: Sequelize.INTEGER
        },
        payout_rate_7: {
          type: Sequelize.STRING
        },
        disb_amount_from_payout_7: {
          type: Sequelize.INTEGER
        },
        disb_amount_to_payout_7: {
          type: Sequelize.INTEGER
        },
        payout_rate_8: {
          type: Sequelize.STRING
        },
        disb_amount_from_payout_8: {
          type: Sequelize.INTEGER
        },
        disb_amount_to_payout_8: {
          type: Sequelize.INTEGER
        },
        payout_rate_9: {
          type: Sequelize.STRING
        },
        disb_amount_from_payout_9: {
          type: Sequelize.INTEGER
        },
        disb_amount_to_payout_9: {
          type: Sequelize.INTEGER
        },
        payout_rate_10: {
          type: Sequelize.STRING
        },
        disb_amount_from_payout_10: {
          type: Sequelize.INTEGER
        },
        disb_amount_to_payout_10: {
          type: Sequelize.INTEGER
        },
        createdAt:{
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
         },
         updatedAt:{
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
         }
      }, {
        timeStamp: true,
        createdAt: true,
        updatedAt: true
      });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('payouts_listt');
  }
};

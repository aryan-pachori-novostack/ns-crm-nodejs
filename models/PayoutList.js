'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PayoutList extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  PayoutList.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    bank_nbfc_name:DataTypes.STRING,
    main_product:DataTypes.STRING,
    product:DataTypes.STRING,
    company_name:DataTypes.STRING,
    login_code:DataTypes.STRING,
    product_group:DataTypes.STRING,
    sub_product_group:DataTypes.STRING,
    gst_reimbursement:DataTypes.STRING,
    invoice_remark:DataTypes.STRING,
    billing_month_from:DataTypes.STRING,
    billing_month_to:DataTypes.STRING,
    applicable_from:DataTypes.STRING,
    applicable_till:DataTypes.STRING,
    max_payout_for_single_case:DataTypes.STRING,
    payout_percentage:DataTypes.STRING,
    payout_type:DataTypes.STRING,
    remark:DataTypes.STRING,
    expire_on:DataTypes.STRING,
    status:DataTypes.STRING,
    last_updated_on:DataTypes.STRING,
    payout_rate_1:DataTypes.STRING,
    disb_amount_from_payout_1:DataTypes.INTEGER,
    disb_amount_to_payout_1:DataTypes.INTEGER,
    payout_rate_2:DataTypes.STRING,
    disb_amount_from_payout_2:DataTypes.INTEGER,
    disb_amount_to_payout_2:DataTypes.INTEGER,
    payout_rate_3:DataTypes.STRING,
    disb_amount_from_payout_3:DataTypes.INTEGER,
    disb_amount_to_payout_3:DataTypes.INTEGER,
    payout_rate_4:DataTypes.STRING,
    disb_amount_from_payout_4:DataTypes.INTEGER,
    disb_amount_to_payout_4:DataTypes.INTEGER,
    payout_rate_5:DataTypes.STRING,
    disb_amount_from_payout_5:DataTypes.INTEGER,
    disb_amount_to_payout_5:DataTypes.INTEGER,
    payout_rate_6:DataTypes.STRING,
    disb_amount_from_payout_6:DataTypes.INTEGER,
    disb_amount_to_payout_6:DataTypes.INTEGER,
    payout_rate_7:DataTypes.STRING,
    disb_amount_from_payout_7:DataTypes.INTEGER,
    disb_amount_to_payout_7:DataTypes.INTEGER,
    payout_rate_8:DataTypes.STRING,
    disb_amount_from_payout_8:DataTypes.INTEGER,
    disb_amount_to_payout_8:DataTypes.INTEGER,
    payout_rate_9:DataTypes.STRING,
    disb_amount_from_payout_9:DataTypes.INTEGER,
    disb_amount_to_payout_9:DataTypes.INTEGER,
    payout_rate_10:DataTypes.STRING,
    disb_amount_from_payout_10:DataTypes.INTEGER,
    disb_amount_to_payout_10:DataTypes.INTEGER,
  }, {
    sequelize,
    tableName: 'payouts_list',
    modelName: 'PayoutList',
  });
  return PayoutList;
};
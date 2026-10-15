'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class BankDetail extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  BankDetail.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    bank_nbfc_name: DataTypes.STRING,
    product: DataTypes.STRING,
    market_and_sub_type: DataTypes.STRING,
    state: DataTypes.STRING,
    city: DataTypes.STRING,
    company: DataTypes.STRING,
    login_code: DataTypes.STRING,
    location: DataTypes.STRING,
    sales_manager: DataTypes.STRING,
    sales_manager_mobile: DataTypes.STRING,
    sales_manager_email: DataTypes.STRING,
    sales_manager_code: DataTypes.STRING,
    assistant_sales_manager: DataTypes.STRING,
    assistant_sales_manager_mobile: DataTypes.STRING,
    assistant_sales_manager_email: DataTypes.STRING,
    regional_sales_manager: DataTypes.STRING,
    regional_sales_manager_mobile: DataTypes.STRING,
    regional_sales_manager_email: DataTypes.STRING,
    zonal_sales_manager: DataTypes.STRING,
    zonal_sales_manager_mobile: DataTypes.STRING,
    zonal_sales_manager_email: DataTypes.STRING,
    national_sales_manager: DataTypes.STRING,
    national_sales_manager_mobile: DataTypes.STRING,
    national_sales_manager_email: DataTypes.STRING,
    login_process: DataTypes.STRING,
    company_category_list: DataTypes.STRING,
    product_and_policy: DataTypes.STRING,
    branch_address: DataTypes.STRING,
    remark: DataTypes.STRING
  }, {
    sequelize,
    tableName:'bank_details',
    modelName: 'BankDetail',
  });
  return BankDetail;
};
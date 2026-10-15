'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
      await queryInterface.createTable('bank_details', 
        {
           id: {
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
            type: Sequelize.INTEGER
           },
           bank_nbfc_name: {
            type: Sequelize.STRING
           },
           product: {
            type: Sequelize.STRING
           },
           market_and_sub_type: {
            type: Sequelize.STRING
           },
           state: {
            type: Sequelize.STRING
           },
           city: {
            type: Sequelize.STRING
           },
           company: {
            type: Sequelize.STRING
           },
           login_code: {
            type: Sequelize.STRING
           },
           location: {
            type: Sequelize.STRING
           },
           sales_manager: {
            type: Sequelize.STRING
           },
           sales_manager_mobile: {
            type: Sequelize.STRING
           },
           sales_manager_email: {
            type: Sequelize.STRING
           },
           sales_manager_code: {
            type: Sequelize.STRING
           },
           assistant_sales_manager: {
            type: Sequelize.STRING
           },
           assistant_sales_manager_mobile: {
            type: Sequelize.STRING
           },
           assistant_sales_manager_email: {
            type: Sequelize.STRING
           },
           regional_sales_manager: {
            type: Sequelize.STRING
           },
           regional_sales_manager_mobile: {
            type: Sequelize.STRING
           },
           regional_sales_manager_email: {
            type: Sequelize.STRING
           },
           zonal_sales_manager: {
            type: Sequelize.STRING
           },
           zonal_sales_manager_mobile: {
            type: Sequelize.STRING
           },
           zonal_sales_manager_email: {
            type: Sequelize.STRING
           },
           national_sales_manager: {
            type: Sequelize.STRING
           },
           national_sales_manager_mobile: {
            type: Sequelize.STRING
           },
           national_sales_manager_email: {
            type: Sequelize.STRING
           },
           login_process: {
            type: Sequelize.STRING
           },
           company_category_list: {
            type: Sequelize.STRING
           },
           product_and_policy: {
            type: Sequelize.STRING
           },
           branch_address: {
            type: Sequelize.STRING
           },
           remark: {
            type: Sequelize.STRING
           },
           createdAt:{
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
           },
           updatedAt:{
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
           }
        },
        {
          timeStamps: true,
          createdAt: true,
          updatedAt: true
        });
  },
  
  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('bank_details');
  }
};

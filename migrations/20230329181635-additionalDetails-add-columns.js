'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('lead_additional_information', 'loan_type', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('lead_additional_information', 'have_office', {
      type: Sequelize.BOOLEAN,
    });
    
    await queryInterface.addColumn('lead_additional_information', 'is_office_rented', {
      type: Sequelize.BOOLEAN,
    });

    await queryInterface.addColumn('lead_additional_information', 'number_of_staff', {
      type: Sequelize.INTEGER,
    });

    await queryInterface.addColumn('lead_additional_information', 'heard_of_ruloans', {
      type: Sequelize.BOOLEAN,
    });

    await queryInterface.addColumn('lead_additional_information', 'where_you_heard', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('lead_additional_information', 'monthly_disbursement', {
      type: Sequelize.INTEGER,
    });

    await queryInterface.addColumn('lead_additional_information', 'purpose_of_joining', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('lead_additional_information', 'bank_leave_duration', {
      type: Sequelize.INTEGER,
    });

    await queryInterface.addColumn('lead_additional_information', 'previous_loan_type', {
      type: Sequelize.INTEGER,
    });

    await queryInterface.addColumn('lead_additional_information', 'previous_bank_verticle', {
      type: Sequelize.INTEGER,
    });

    await queryInterface.addColumn('lead_additional_information', 'previous_bank_department', {
      type: Sequelize.INTEGER,
    });


    await queryInterface.addColumn('lead_additional_information', 'current_payout_pl', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('lead_additional_information', 'current_payout_bl', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('lead_additional_information', 'current_payout_hl', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('lead_additional_information', 'current_payout_lap', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('lead_additional_information', 'current_payout_ncl', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('lead_additional_information', 'current_payout_ucl', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('lead_additional_information', 'current_payout_car_refinance', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('lead_additional_information', 'current_payout_od_cc', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('lead_additional_information', 'current_payout_gl', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('lead_additional_information', 'current_payout_project_loan', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('lead_additional_information', 'current_payout_el', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('lead_additional_information', 'current_payout_msme_loan', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('lead_additional_information', 'current_payout_working_loan', {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('lead_additional_information', 'is_crm_user', {
      type: Sequelize.BOOLEAN,
    });

  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('lead_additional_information', 'loan_type');

    await queryInterface.addColumn('lead_additional_information', 'have_office');
    
    await queryInterface.addColumn('lead_additional_information', 'is_office_rented');

    await queryInterface.addColumn('lead_additional_information', 'number_of_staff');

    await queryInterface.addColumn('lead_additional_information', 'heard_of_ruloans');

    await queryInterface.addColumn('lead_additional_information', 'where_you_heard');

    await queryInterface.addColumn('lead_additional_information', 'monthly_disbursement');

    await queryInterface.addColumn('lead_additional_information', 'purpose_of_joining');

    await queryInterface.addColumn('lead_additional_information', 'bank_leave_duration');

    await queryInterface.addColumn('lead_additional_information', 'previous_loan_type');

    await queryInterface.addColumn('lead_additional_information', 'previous_bank_verticle');

    await queryInterface.addColumn('lead_additional_information', 'previous_bank_department');

    await queryInterface.addColumn('lead_additional_information', 'current_payout_pl');

    await queryInterface.addColumn('lead_additional_information', 'current_payout_bl');

    await queryInterface.addColumn('lead_additional_information', 'current_payout_hl');

    await queryInterface.addColumn('lead_additional_information', 'current_payout_lap');

    await queryInterface.addColumn('lead_additional_information', 'current_payout_ncl');

    await queryInterface.addColumn('lead_additional_information', 'current_payout_ucl');

    await queryInterface.addColumn('lead_additional_information', 'current_payout_car_refinance');

    await queryInterface.addColumn('lead_additional_information', 'current_payout_od_cc');

    await queryInterface.addColumn('lead_additional_information', 'current_payout_gl');

    await queryInterface.addColumn('lead_additional_information', 'current_payout_project_loan');

    await queryInterface.addColumn('lead_additional_information', 'current_payout_el');

    await queryInterface.addColumn('lead_additional_information', 'current_payout_msme_loan');

    await queryInterface.addColumn('lead_additional_information', 'current_payout_working_loan');

    await queryInterface.addColumn('lead_additional_information', 'is_crm_user');
  }
};

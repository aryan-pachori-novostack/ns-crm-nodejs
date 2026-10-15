'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Each menu item gets its own module with full hierarchical naming
    // Format: ParentModule > ChildModule > GrandchildModule...
    const modulesData = [
      // Level 0 - Root menu items (id matches menu id for consistency)
      { id: 1, name: 'Dashboard', alias: 'dashboard', parent_id: null, is_active: true, is_deleted: false },
      { id: 19, name: 'DSA', alias: 'dsa', parent_id: null, is_active: true, is_deleted: false },
      { id: 25, name: 'Customers', alias: 'customers', parent_id: null, is_active: true, is_deleted: false },
      { id: 28, name: 'Applications', alias: 'applications', parent_id: null, is_active: true, is_deleted: false },
      { id: 68, name: 'Finance', alias: 'finance', parent_id: null, is_active: true, is_deleted: false },
      { id: 91, name: 'Products', alias: 'products', parent_id: null, is_active: true, is_deleted: false },
      { id: 95, name: 'Content', alias: 'content', parent_id: null, is_active: true, is_deleted: false },
      { id: 98, name: 'Users', alias: 'users', parent_id: null, is_active: true, is_deleted: false },
      { id: 101, name: 'Tools', alias: 'tools', parent_id: null, is_active: true, is_deleted: false },
      { id: 106, name: 'Marketing', alias: 'marketing', parent_id: null, is_active: true, is_deleted: false },
      { id: 117, name: 'Activity Logs', alias: 'activity_logs', parent_id: null, is_active: true, is_deleted: false },
      { id: 124, name: 'Settings', alias: 'settings', parent_id: null, is_active: true, is_deleted: false },
      { id: 129, name: 'Career', alias: 'career', parent_id: null, is_active: true, is_deleted: false },

      // Level 1 - Dashboard children
      { id: 2, name: 'Dashboard > MIS', alias: 'dashboard_mis', parent_id: 1, is_active: true, is_deleted: false },
      { id: 7, name: 'Dashboard > Graphs', alias: 'dashboard_graphs', parent_id: 1, is_active: true, is_deleted: false },
      { id: 11, name: 'Dashboard > Analytics', alias: 'dashboard_analytics', parent_id: 1, is_active: true, is_deleted: false },
      { id: 12, name: 'Dashboard > New MIS', alias: 'dashboard_new_mis', parent_id: 1, is_active: true, is_deleted: false },

      // Level 2 - MIS children
      { id: 3, name: 'Dashboard > MIS > Recharge', alias: 'dashboard_mis_recharge', parent_id: 2, is_active: true, is_deleted: false },
      { id: 4, name: 'Dashboard > MIS > Loans', alias: 'dashboard_mis_loans', parent_id: 2, is_active: true, is_deleted: false },
      { id: 5, name: 'Dashboard > MIS > Lead Forms', alias: 'dashboard_mis_lead_forms', parent_id: 2, is_active: true, is_deleted: false },
      { id: 6, name: 'Dashboard > MIS > Combined MIS', alias: 'dashboard_mis_combined_mis', parent_id: 2, is_active: true, is_deleted: false },

      // Level 2 - Graphs children
      { id: 8, name: 'Dashboard > Graphs > Cibil', alias: 'dashboard_graphs_cibil', parent_id: 7, is_active: true, is_deleted: false },
      { id: 9, name: 'Dashboard > Graphs > Channel Partners', alias: 'dashboard_graphs_channel_partners', parent_id: 7, is_active: true, is_deleted: false },
      { id: 10, name: 'Dashboard > Graphs > Lead Forms', alias: 'dashboard_graphs_lead_forms', parent_id: 7, is_active: true, is_deleted: false },

      // Level 2 - New MIS children
      { id: 13, name: 'Dashboard > New MIS > City Wise MIS', alias: 'dashboard_new_mis_city_wise_mis', parent_id: 12, is_active: true, is_deleted: false },
      { id: 14, name: 'Dashboard > New MIS > Combined MIS', alias: 'dashboard_new_mis_combined_mis', parent_id: 12, is_active: true, is_deleted: false },
      { id: 15, name: 'Dashboard > New MIS > Product Wise MIS', alias: 'dashboard_new_mis_product_wise_mis', parent_id: 12, is_active: true, is_deleted: false },
      { id: 16, name: 'Dashboard > New MIS > Monthly Comparison', alias: 'dashboard_new_mis_monthly_comparison', parent_id: 12, is_active: true, is_deleted: false },
      { id: 17, name: 'Dashboard > New MIS > Yearly MIS', alias: 'dashboard_new_mis_yearly_mis', parent_id: 12, is_active: true, is_deleted: false },
      { id: 18, name: 'Dashboard > New MIS > Business MIS', alias: 'dashboard_new_mis_business_mis', parent_id: 12, is_active: true, is_deleted: false },

      // Level 1 - DSA children
      { id: 20, name: 'DSA > Reports DSA', alias: 'dsa_reports_dsa', parent_id: 19, is_active: true, is_deleted: false },
      { id: 23, name: 'DSA > Channel Partners', alias: 'dsa_channel_partners', parent_id: 19, is_active: true, is_deleted: false },
      { id: 24, name: 'DSA > Call Logs', alias: 'dsa_call_logs', parent_id: 19, is_active: true, is_deleted: false },

      // Level 2 - Reports DSA children
      { id: 21, name: 'DSA > Reports DSA > Sales Report', alias: 'dsa_reports_dsa_sales_report', parent_id: 20, is_active: true, is_deleted: false },
      { id: 22, name: 'DSA > Reports DSA > Call Report', alias: 'dsa_reports_dsa_call_report', parent_id: 20, is_active: true, is_deleted: false },

      // Level 2 - Channel Partners children
      { id: 134, name: 'DSA > Channel Partners > Assign SP', alias: 'dsa_channel_partners_assign_sp', parent_id: 23, is_active: true, is_deleted: false },
      { id: 135, name: 'DSA > Channel Partners > Bulk Assign SP', alias: 'dsa_channel_partners_bulk_assign_sp', parent_id: 23, is_active: true, is_deleted: false },
      { id: 136, name: 'DSA > Channel Partners > Assign Partner', alias: 'dsa_channel_partners_assign_partner', parent_id: 23, is_active: true, is_deleted: false },
      { id: 137, name: 'DSA > Channel Partners > Bulk Assign Partner', alias: 'dsa_channel_partners_bulk_assign_partner', parent_id: 23, is_active: true, is_deleted: false },

      // Level 1 - Customers children
      { id: 26, name: 'Customers > Customers', alias: 'customers_customers', parent_id: 25, is_active: true, is_deleted: false },
      { id: 27, name: 'Customers > Customer Queries', alias: 'customers_customer_queries', parent_id: 25, is_active: true, is_deleted: false },

      // Level 1 - Applications children
      { id: 29, name: 'Applications > Reports Application', alias: 'applications_reports_application', parent_id: 28, is_active: true, is_deleted: false },
      { id: 32, name: 'Applications > Personal Loan', alias: 'applications_personal_loan', parent_id: 28, is_active: true, is_deleted: false },
      { id: 42, name: 'Applications > Home Loan', alias: 'applications_home_loan', parent_id: 28, is_active: true, is_deleted: false },
      { id: 47, name: 'Applications > Business Loan', alias: 'applications_business_loan', parent_id: 28, is_active: true, is_deleted: false },
      { id: 51, name: 'Applications > Education Loan', alias: 'applications_education_loan', parent_id: 28, is_active: true, is_deleted: false },
      { id: 52, name: 'Applications > Car Loan', alias: 'applications_car_loan', parent_id: 28, is_active: true, is_deleted: false },
      { id: 53, name: 'Applications > Car Refinance', alias: 'applications_car_refinance', parent_id: 28, is_active: true, is_deleted: false },
      { id: 54, name: 'Applications > Used Car Loan', alias: 'applications_used_car_loan', parent_id: 28, is_active: true, is_deleted: false },
      { id: 55, name: 'Applications > Gold Loan', alias: 'applications_gold_loan', parent_id: 28, is_active: true, is_deleted: false },
      { id: 56, name: 'Applications > Machinery Loan', alias: 'applications_machinery_loan', parent_id: 28, is_active: true, is_deleted: false },
      { id: 57, name: 'Applications > LAP', alias: 'applications_lap', parent_id: 28, is_active: true, is_deleted: false },
      { id: 62, name: 'Applications > Bureau', alias: 'applications_bureau', parent_id: 28, is_active: true, is_deleted: false },
      { id: 64, name: 'Applications > BBPS', alias: 'applications_bbps', parent_id: 28, is_active: true, is_deleted: false },
      { id: 66, name: 'Applications > Credit Card', alias: 'applications_credit_card', parent_id: 28, is_active: true, is_deleted: false },
      { id: 67, name: 'Applications > Solar Loan', alias: 'applications_solar_loan', parent_id: 28, is_active: true, is_deleted: false },

      // Level 2 - Reports Application children
      { id: 30, name: 'Applications > Reports Application > Business Report', alias: 'applications_reports_application_business_report', parent_id: 29, is_active: true, is_deleted: false },
      { id: 31, name: 'Applications > Reports Application > City Wise Report', alias: 'applications_reports_application_city_wise_report', parent_id: 29, is_active: true, is_deleted: false },

      // Level 2 - Personal Loan children
      { id: 33, name: 'Applications > Personal Loan > All PL Applications', alias: 'applications_personal_loan_all_pl_applications', parent_id: 32, is_active: true, is_deleted: false },
      { id: 34, name: 'Applications > Personal Loan > Old PL', alias: 'applications_personal_loan_old_pl', parent_id: 32, is_active: true, is_deleted: false },

      // Level 3 - Old PL children
      { id: 35, name: 'Applications > Personal Loan > Old PL > Bajaj Finance Applications', alias: 'applications_personal_loan_old_pl_bajaj_finance_applications', parent_id: 34, is_active: true, is_deleted: false },
      { id: 36, name: 'Applications > Personal Loan > Old PL > Prefr Applications', alias: 'applications_personal_loan_old_pl_prefr_applications', parent_id: 34, is_active: true, is_deleted: false },
      { id: 37, name: 'Applications > Personal Loan > Old PL > Fibe Applications', alias: 'applications_personal_loan_old_pl_fibe_applications', parent_id: 34, is_active: true, is_deleted: false },
      { id: 38, name: 'Applications > Personal Loan > Old PL > Incred Applications', alias: 'applications_personal_loan_old_pl_incred_applications', parent_id: 34, is_active: true, is_deleted: false },
      { id: 39, name: 'Applications > Personal Loan > Old PL > Pending Applications', alias: 'applications_personal_loan_old_pl_pending_applications', parent_id: 34, is_active: true, is_deleted: false },
      { id: 40, name: 'Applications > Personal Loan > Old PL > L&T PL Applications', alias: 'applications_personal_loan_old_pl_lnt_pl_applications', parent_id: 34, is_active: true, is_deleted: false },
      { id: 41, name: 'Applications > Personal Loan > Old PL > PaySense Applications', alias: 'applications_personal_loan_old_pl_paysense_applications', parent_id: 34, is_active: true, is_deleted: false },

      // Level 2 - Home Loan children
      { id: 43, name: 'Applications > Home Loan > All HL Applications', alias: 'applications_home_loan_all_hl_applications', parent_id: 42, is_active: true, is_deleted: false },
      { id: 44, name: 'Applications > Home Loan > Old HL', alias: 'applications_home_loan_old_hl', parent_id: 42, is_active: true, is_deleted: false },

      // Level 3 - Old HL children
      { id: 45, name: 'Applications > Home Loan > Old HL > Pending Applications', alias: 'applications_home_loan_old_hl_pending_applications', parent_id: 44, is_active: true, is_deleted: false },
      { id: 46, name: 'Applications > Home Loan > Old HL > Piramal Applications', alias: 'applications_home_loan_old_hl_piramal_applications', parent_id: 44, is_active: true, is_deleted: false },

      // Level 2 - Business Loan children
      { id: 48, name: 'Applications > Business Loan > All BL Applications', alias: 'applications_business_loan_all_bl_applications', parent_id: 47, is_active: true, is_deleted: false },
      { id: 49, name: 'Applications > Business Loan > Old BL', alias: 'applications_business_loan_old_bl', parent_id: 47, is_active: true, is_deleted: false },

      // Level 3 - Old BL children
      { id: 50, name: 'Applications > Business Loan > Old BL > Indifi BL Applications', alias: 'applications_business_loan_old_bl_indifi_bl_applications', parent_id: 49, is_active: true, is_deleted: false },

      // Level 2 - LAP children
      { id: 58, name: 'Applications > LAP > All LAP Applications', alias: 'applications_lap_all_lap_applications', parent_id: 57, is_active: true, is_deleted: false },
      { id: 59, name: 'Applications > LAP > Old LAP', alias: 'applications_lap_old_lap', parent_id: 57, is_active: true, is_deleted: false },

      // Level 3 - Old LAP children
      { id: 60, name: 'Applications > LAP > Old LAP > Piramal Applications', alias: 'applications_lap_old_lap_piramal_applications', parent_id: 59, is_active: true, is_deleted: false },
      { id: 61, name: 'Applications > LAP > Old LAP > Pending Applications', alias: 'applications_lap_old_lap_pending_applications', parent_id: 59, is_active: true, is_deleted: false },

      // Level 2 - Bureau children
      { id: 63, name: 'Applications > Bureau > Cibil', alias: 'applications_bureau_cibil', parent_id: 62, is_active: true, is_deleted: false },

      // Level 2 - BBPS children
      { id: 65, name: 'Applications > BBPS > Recharge', alias: 'applications_bbps_recharge', parent_id: 64, is_active: true, is_deleted: false },

      // Level 1 - Finance children
      { id: 69, name: 'Finance > Claim', alias: 'finance_claim', parent_id: 68, is_active: true, is_deleted: false },
      { id: 76, name: 'Finance > Finance Tools', alias: 'finance_finance_tools', parent_id: 68, is_active: true, is_deleted: false },
      { id: 81, name: 'Finance > Meta Data', alias: 'finance_meta_data', parent_id: 68, is_active: true, is_deleted: false },
      { id: 87, name: 'Finance > Invoices', alias: 'finance_invoices', parent_id: 68, is_active: true, is_deleted: false },

      // Level 2 - Claim children
      { id: 70, name: 'Finance > Claim > Payout', alias: 'finance_claim_payout', parent_id: 69, is_active: true, is_deleted: false },
      { id: 71, name: 'Finance > Claim > Direct Claims', alias: 'finance_claim_direct_claims', parent_id: 69, is_active: true, is_deleted: false },
      { id: 72, name: 'Finance > Claim > Customer Leads', alias: 'finance_claim_customer_leads', parent_id: 69, is_active: true, is_deleted: false },
      { id: 73, name: 'Finance > Claim > Consolidated Leads', alias: 'finance_claim_consolidated_leads', parent_id: 69, is_active: true, is_deleted: false },
      { id: 74, name: 'Finance > Claim > Instant Claim', alias: 'finance_claim_instant_claim', parent_id: 69, is_active: true, is_deleted: false },
      { id: 75, name: 'Finance > Claim > Ledger', alias: 'finance_claim_ledger', parent_id: 69, is_active: true, is_deleted: false },

      // Level 2 - Finance Tools children
      { id: 77, name: 'Finance > Finance Tools > Find Banks', alias: 'finance_finance_tools_find_banks', parent_id: 76, is_active: true, is_deleted: false },
      { id: 78, name: 'Finance > Finance Tools > Bank Files', alias: 'finance_finance_tools_bank_files', parent_id: 76, is_active: true, is_deleted: false },
      { id: 79, name: 'Finance > Finance Tools > Business Category Validation', alias: 'finance_finance_tools_business_category_validation', parent_id: 76, is_active: true, is_deleted: false },
      { id: 80, name: 'Finance > Finance Tools > Ledger Export', alias: 'finance_finance_tools_ledger_export', parent_id: 76, is_active: true, is_deleted: false },

      // Level 2 - Meta Data children
      { id: 82, name: 'Finance > Meta Data > Banks', alias: 'finance_meta_data_banks', parent_id: 81, is_active: true, is_deleted: false },
      { id: 83, name: 'Finance > Meta Data > Payouts', alias: 'finance_meta_data_payouts', parent_id: 81, is_active: true, is_deleted: false },
      { id: 84, name: 'Finance > Meta Data > Netsuite Banks', alias: 'finance_meta_data_netsuite_banks', parent_id: 81, is_active: true, is_deleted: false },
      { id: 85, name: 'Finance > Meta Data > Netsuite Products', alias: 'finance_meta_data_netsuite_products', parent_id: 81, is_active: true, is_deleted: false },
      { id: 86, name: 'Finance > Meta Data > Bank Product Combination', alias: 'finance_meta_data_bank_product_combination', parent_id: 81, is_active: true, is_deleted: false },

      // Level 2 - Invoices children
      { id: 88, name: 'Finance > Invoices > Analytics', alias: 'finance_invoices_analytics', parent_id: 87, is_active: true, is_deleted: false },
      { id: 89, name: 'Finance > Invoices > Invoices', alias: 'finance_invoices_invoices', parent_id: 87, is_active: true, is_deleted: false },
      { id: 90, name: 'Finance > Invoices > Office Expenses', alias: 'finance_invoices_office_expenses', parent_id: 87, is_active: true, is_deleted: false },

      // Level 1 - Products children
      { id: 92, name: 'Products > Products', alias: 'products_products', parent_id: 91, is_active: true, is_deleted: false },
      { id: 93, name: 'Products > Loan Types', alias: 'products_loan_types', parent_id: 91, is_active: true, is_deleted: false },
      { id: 94, name: 'Products > Bulk Upload RM', alias: 'products_bulk_upload_rm', parent_id: 91, is_active: true, is_deleted: false },
      { id: 138, name: 'Products > Products > Pincodes', alias: 'products_products_pincodes', parent_id: 91, is_active: true, is_deleted: false },

      // Level 1 - Content children
      { id: 96, name: 'Content > Hyperlink Content', alias: 'content_hyperlink_content', parent_id: 95, is_active: true, is_deleted: false },
      { id: 97, name: 'Content > Content Manager', alias: 'content_content_manager', parent_id: 95, is_active: true, is_deleted: false },

      // Level 1 - Users children
      { id: 99, name: 'Users > CRM Users', alias: 'users_crm_users', parent_id: 98, is_active: true, is_deleted: false },
      { id: 100, name: 'Users > RM Users', alias: 'users_rm_users', parent_id: 98, is_active: true, is_deleted: false },

      // Level 1 - Tools children
      { id: 102, name: 'Tools > Callers', alias: 'tools_callers', parent_id: 101, is_active: true, is_deleted: false },
      { id: 103, name: 'Tools > List Filters', alias: 'tools_list_filters', parent_id: 101, is_active: true, is_deleted: false },
      { id: 104, name: 'Tools > Reminder', alias: 'tools_reminder', parent_id: 101, is_active: true, is_deleted: false },
      { id: 105, name: 'Tools > Pincode', alias: 'tools_pincode', parent_id: 101, is_active: true, is_deleted: false },

      // Level 1 - Marketing children
      { id: 107, name: 'Marketing > Analytics', alias: 'marketing_analytics', parent_id: 106, is_active: true, is_deleted: false },
      { id: 108, name: 'Marketing > Bulk Calling', alias: 'marketing_bulk_calling', parent_id: 106, is_active: true, is_deleted: false },
      { id: 109, name: 'Marketing > Events', alias: 'marketing_events', parent_id: 106, is_active: true, is_deleted: false },
      { id: 110, name: 'Marketing > Marketing Assets', alias: 'marketing_marketing_assets', parent_id: 106, is_active: true, is_deleted: false },
      { id: 111, name: 'Marketing > Email', alias: 'marketing_email', parent_id: 106, is_active: true, is_deleted: false },
      { id: 112, name: 'Marketing > WhatsApp', alias: 'marketing_whatsapp', parent_id: 106, is_active: true, is_deleted: false },
      { id: 113, name: 'Marketing > Send SMS', alias: 'marketing_send_sms', parent_id: 106, is_active: true, is_deleted: false },
      { id: 114, name: 'Marketing > Notifications', alias: 'marketing_notifications', parent_id: 106, is_active: true, is_deleted: false },

      // Level 2 - Notifications children
      { id: 115, name: 'Marketing > Notifications > App Notifications', alias: 'marketing_notifications_app_notifications', parent_id: 114, is_active: true, is_deleted: false },
      { id: 116, name: 'Marketing > Notifications > CRM Notifications', alias: 'marketing_notifications_crm_notifications', parent_id: 114, is_active: true, is_deleted: false },

      // Level 1 - Activity Logs children
      { id: 118, name: 'Activity Logs > Export', alias: 'activity_logs_export', parent_id: 117, is_active: true, is_deleted: false },
      { id: 119, name: 'Activity Logs > Login', alias: 'activity_logs_login', parent_id: 117, is_active: true, is_deleted: false },
      { id: 120, name: 'Activity Logs > Lead Form Upload', alias: 'activity_logs_lead_form_upload', parent_id: 117, is_active: true, is_deleted: false },
      { id: 121, name: 'Activity Logs > DSA Upload', alias: 'activity_logs_dsa_upload', parent_id: 117, is_active: true, is_deleted: false },
      { id: 122, name: 'Activity Logs > Invoice Upload', alias: 'activity_logs_invoice_upload', parent_id: 117, is_active: true, is_deleted: false },
      { id: 123, name: 'Activity Logs > Application Update', alias: 'activity_logs_application_update', parent_id: 117, is_active: true, is_deleted: false },

      // Level 1 - Settings children
      { id: 125, name: 'Settings > Picklist Dependencies', alias: 'settings_picklist_dependencies', parent_id: 124, is_active: true, is_deleted: false },
      { id: 126, name: 'Settings > SMS Triggers', alias: 'settings_sms_triggers', parent_id: 124, is_active: true, is_deleted: false },
      { id: 127, name: 'Settings > Global Configuration', alias: 'settings_global_configuration', parent_id: 124, is_active: true, is_deleted: false },
      { id: 128, name: 'Settings > Blacklisted Users', alias: 'settings_blacklisted_users', parent_id: 124, is_active: true, is_deleted: false },
      { id: 131, name: 'Settings > Role Management', alias: 'settings_role_management', parent_id: 124, is_active: true, is_deleted: false },

      // Level 1 - Career children
      { id: 130, name: 'Career > Jobs', alias: 'career_jobs', parent_id: 129, is_active: true, is_deleted: false }
    ];

    const timestamp = new Date();
    const dataToInsert = modulesData.map(module => ({
      ...module,
      createdAt: timestamp,
      updatedAt: timestamp
    }));

    await queryInterface.bulkInsert('rbac_modules', dataToInsert, {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('rbac_modules', null, {});
  }
};

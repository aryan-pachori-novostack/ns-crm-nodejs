exports.Roles = ['CEO', 'CRM_ADMIN', 'ACCOUNTS_HEAD', 'ACCOUNTS_EXECUTIVE', 'ROUNE_ADMIN', 'TELE_SUPERVISOR', 'TELE_CALLER', 'HR', 'VERIFICATION_AGENCY', 'MIS_EXECUTIVE', 'CRM_EXECUTIVE', 'REGIONAL_HEAD', 'BUSINESS_HEAD', 'LEAD_ADMIN', 'VENDOR', 'HUB_HEAD', 'SALES_HEAD', 'MANAGERS', 'PARTNERS', 'BACKEND', 'LEAD_ADMIN', 'TECH_HEAD', 'CFO', 'CTO', 'SALES_ADMIN', 'BASE_USER'];
exports.mergeDsaTables = {
    "kyc#dsa_id#both": [
        "ru_dsa_kyc_data"
    ],

    "applications#dsa_mobile_number": [
        "ru_credit_card_applications",
        "ru_direct_claims",
        "ru_dsa_bank_files",
        "ru_dsa_claims",
        "ru_dsa_queries",
        "ru_home_loan_applications",
        "ru_indifi_loan_applications",
        "ru_loan_applications",
        "ru_lt_personal_loan_applications",
        "ru_references",
        "ru_axis_cc_applications",
        "ru_loan_application_documents",
        "ru_pf_personal_loan_applications"
    ],

    "applications#dsa_id": [
        "ru_bl_applications",
        "ru_car_loan_applications",
        "ru_car_refinance_applications",
        "ru_cc_applications",
        "ru_dsa_additional_information",
        "ru_dsa_addresses",
        "ru_dsa_expenses",
        "ru_dsa_leads",
        "ru_dsa_metas",
        "ru_dsa_verification_documents",
        "ru_education_loan_applications",
        "ru_gold_loan_applications",
        "ru_hl_applications",
        "ru_invoice",
        "ru_personal_loan_applications",
        "ru_bbps_payments",
        "ru_netsuite_vendor_slab_master"
    ],

    "applications#dsa_id#both": [
        "ru_credit_saison_personal_loan_applications",
        "ru_credit_vidya_personal_loan_applications",
        "ru_customers",
        "ru_dsa_bank_accounts",
        "ru_dsa_remarks",
        "ru_fibe_personal_loan_applications",
        "ru_incred_personal_loan_applications",
        "ru_l_a_p_applications",
        "ru_pay_u_personal_loan_applications",
        "ru_piramal_home_loan_applications",
        "ru_piramal_lap_applications",
        "ru_bajaj_finance_personal_loan_applications",
        "ru_business_loan_applications",
        "ru_credit_scores",
        "ru_faircent_personal_loan_applications",
        "ru_fresh_lead_claims"
    ],

    "invoices#dsa_id": [
        "ru_dsa_addresses",
        "ru_dsa_expenses",
        "ru_invoice",
        "ru_dsa_expense_items",
        "ru_expense_activity_logs"
    ],

    "banks#dsa_id#both": [
        "ru_dsa_bank_accounts",
    ],

    "payouts#dsa_id": [
        "ru_dsa_payouts",
    ]
};
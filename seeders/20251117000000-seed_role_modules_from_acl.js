'use strict';

/**
 * Role Modules Seeder - Generated from ACL Permissions + API Actions
 * Features:
 * - Uses actual API actions (not inferred)
 * - Auto-grants read if create/update/delete exists
 * - Propagates permissions to parent modules (same permissions)
 * - Updates existing records instead of inserting duplicates
 * - Skips CEO (managed separately)
 *
 * Generated: 2025-11-17T06:13:28.234Z
 * Source: ACL permissions + API-RBAC mapping
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const roles = await queryInterface.sequelize.query('SELECT id, role FROM roles ORDER BY id', { type: queryInterface.sequelize.QueryTypes.SELECT });
    const modules = await queryInterface.sequelize.query('SELECT id, alias FROM rbac_modules WHERE is_deleted = 0 AND is_active = 1 ORDER BY id', { type: queryInterface.sequelize.QueryTypes.SELECT });

    const roleMap = {};
    roles.forEach(r => roleMap[r.role] = r.id);
    const moduleMap = {};
    modules.forEach(m => moduleMap[m.alias] = m.id);

    const roleModulesData = [];

    // CRM_ADMIN permissions (38 modules)
    if (roleMap['CRM_ADMIN'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_ADMIN'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['CRM_ADMIN'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    // ACCOUNTS_HEAD permissions (38 modules)
    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_HEAD'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_HEAD'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    // ACCOUNTS_EXECUTIVE permissions (38 modules)
    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ACCOUNTS_EXECUTIVE'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['ACCOUNTS_EXECUTIVE'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    // ROUNE_ADMIN permissions (38 modules)
    if (roleMap['ROUNE_ADMIN'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['ROUNE_ADMIN'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['ROUNE_ADMIN'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    // TELE_SUPERVISOR permissions (45 modules)
    if (roleMap['TELE_SUPERVISOR'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['dsa_reports']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['dsa_reports'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['dsa_reports_dsa']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['dsa_reports_dsa'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['dsa_reports_dsa_call']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['dsa_reports_dsa_call'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['dsa_reports_dsa_call_report']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['dsa_reports_dsa_call_report'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['finance_invoices']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['finance_invoices'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['finance_invoices_office']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['finance_invoices_office'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['finance_invoices_office_expenses']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['finance_invoices_office_expenses'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_SUPERVISOR'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['TELE_SUPERVISOR'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    // TELE_CALLER permissions (45 modules)
    if (roleMap['TELE_CALLER'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['dsa_reports']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['dsa_reports'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['dsa_reports_dsa']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['dsa_reports_dsa'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['dsa_reports_dsa_call']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['dsa_reports_dsa_call'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['dsa_reports_dsa_call_report']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['dsa_reports_dsa_call_report'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['finance_invoices']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['finance_invoices'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['finance_invoices_office']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['finance_invoices_office'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['finance_invoices_office_expenses']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['finance_invoices_office_expenses'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TELE_CALLER'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['TELE_CALLER'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    // HR permissions (53 modules)
    if (roleMap['HR'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['dsa_reports']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['dsa_reports'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['dsa_reports_dsa']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['dsa_reports_dsa'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['dsa_reports_dsa_call']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['dsa_reports_dsa_call'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['dsa_reports_dsa_call_report']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['dsa_reports_dsa_call_report'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['finance_finance']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['finance_finance'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['finance_finance_tools']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['finance_finance_tools'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['finance_finance_tools_find']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['finance_finance_tools_find'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['finance_finance_tools_find_banks']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['finance_finance_tools_find_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['finance_invoices']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['finance_invoices'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['finance_invoices_office']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['finance_invoices_office'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['finance_invoices_office_expenses']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['finance_invoices_office_expenses'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['finance_meta_data_payouts']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['finance_meta_data_payouts'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['settings']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['settings'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['settings_blacklisted']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['settings_blacklisted'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['settings_blacklisted_users']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['settings_blacklisted_users'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['users'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HR'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['HR'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    // VERIFICATION_AGENCY permissions (38 modules)
    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['users'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VERIFICATION_AGENCY'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['VERIFICATION_AGENCY'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    // MIS_EXECUTIVE permissions (53 modules)
    if (roleMap['MIS_EXECUTIVE'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['dsa_reports']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['dsa_reports'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['dsa_reports_dsa']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['dsa_reports_dsa'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['dsa_reports_dsa_call']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['dsa_reports_dsa_call'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['dsa_reports_dsa_call_report']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['dsa_reports_dsa_call_report'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['finance_finance']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['finance_finance'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['finance_finance_tools']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['finance_finance_tools'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['finance_finance_tools_find']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['finance_finance_tools_find'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['finance_finance_tools_find_banks']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['finance_finance_tools_find_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['finance_invoices']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['finance_invoices'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['finance_invoices_office']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['finance_invoices_office'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['finance_invoices_office_expenses']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['finance_invoices_office_expenses'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['finance_meta_data_payouts']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['finance_meta_data_payouts'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['settings']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['settings'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['settings_blacklisted']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['settings_blacklisted'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['settings_blacklisted_users']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['settings_blacklisted_users'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MIS_EXECUTIVE'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['MIS_EXECUTIVE'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    // CRM_EXECUTIVE permissions (38 modules)
    if (roleMap['CRM_EXECUTIVE'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CRM_EXECUTIVE'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['CRM_EXECUTIVE'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    // REGIONAL_HEAD permissions (40 modules)
    if (roleMap['REGIONAL_HEAD'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['finance_claim_instant']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['finance_claim_instant'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['finance_claim_instant_claim']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['finance_claim_instant_claim'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['REGIONAL_HEAD'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['REGIONAL_HEAD'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    // BUSINESS_HEAD permissions (51 modules)
    if (roleMap['BUSINESS_HEAD'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['applications_bbps']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['applications_bbps'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['applications_bbps_recharge']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['applications_bbps_recharge'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['applications_reports']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['applications_reports'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['applications_reports_application']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['applications_reports_application'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['dashboard']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['dashboard'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['dashboard_mis']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['dashboard_mis'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['dashboard_mis_recharge']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['dashboard_mis_recharge'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['finance_claim_instant']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['finance_claim_instant'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['finance_claim_instant_claim']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['finance_claim_instant_claim'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['finance_invoices']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['finance_invoices'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['finance_invoices_invoices']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['finance_invoices_invoices'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['finance_invoices_office']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['finance_invoices_office'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['finance_invoices_office_expenses']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['finance_invoices_office_expenses'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BUSINESS_HEAD'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['BUSINESS_HEAD'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    // LEAD_ADMIN permissions (40 modules)
    if (roleMap['LEAD_ADMIN'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['finance_claim_instant']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['finance_claim_instant'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['finance_claim_instant_claim']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['finance_claim_instant_claim'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['LEAD_ADMIN'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['LEAD_ADMIN'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    // VENDOR permissions (40 modules)
    if (roleMap['VENDOR'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['finance_claim_instant']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['finance_claim_instant'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['finance_claim_instant_claim']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['finance_claim_instant_claim'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['VENDOR'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['VENDOR'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    // HUB_HEAD permissions (38 modules)
    if (roleMap['HUB_HEAD'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['HUB_HEAD'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['HUB_HEAD'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    // SALES_HEAD permissions (38 modules)
    if (roleMap['SALES_HEAD'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_HEAD'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['SALES_HEAD'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    // MANAGERS permissions (38 modules)
    if (roleMap['MANAGERS'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['MANAGERS'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['MANAGERS'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    // PARTNERS permissions (38 modules)
    if (roleMap['PARTNERS'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['PARTNERS'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['PARTNERS'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    // BACKEND permissions (40 modules)
    if (roleMap['BACKEND'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['finance_claim_instant']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['finance_claim_instant'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['finance_claim_instant_claim']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['finance_claim_instant_claim'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['BACKEND'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['BACKEND'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    // TECH_HEAD permissions (55 modules)
    if (roleMap['TECH_HEAD'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['content']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['content'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['content_content']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['content_content'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['content_content_manager']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['content_content_manager'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['finance_invoices']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['finance_invoices'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['finance_invoices_invoices']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['finance_invoices_invoices'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['finance_invoices_office']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['finance_invoices_office'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['finance_invoices_office_expenses']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['finance_invoices_office_expenses'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['marketing'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['marketing_events']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['marketing_events'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['products']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['products'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['products_loan']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['products_loan'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['products_loan_types']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['products_loan_types'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['products_products']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['products_products'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['settings']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['settings'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['settings_global']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['settings_global'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['settings_global_configuration']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['settings_global_configuration'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['settings_sms']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['settings_sms'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['settings_sms_triggers']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['settings_sms_triggers'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['TECH_HEAD'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['TECH_HEAD'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    // CFO permissions (57 modules)
    if (roleMap['CFO'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['applications_bbps']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['applications_bbps'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['applications_bbps_recharge']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['applications_bbps_recharge'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['applications_reports']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['applications_reports'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['applications_reports_application']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['applications_reports_application'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['dashboard']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['dashboard'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['dashboard_mis']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['dashboard_mis'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['dashboard_mis_recharge']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['dashboard_mis_recharge'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['finance_finance']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['finance_finance'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['finance_finance_tools']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['finance_finance_tools'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['finance_finance_tools_business']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['finance_finance_tools_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['finance_finance_tools_business_category']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['finance_finance_tools_business_category'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['finance_finance_tools_business_category_validation']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['finance_finance_tools_business_category_validation'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['finance_invoices']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['finance_invoices'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['finance_invoices_invoices']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['finance_invoices_invoices'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['finance_invoices_office']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['finance_invoices_office'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['finance_invoices_office_expenses']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['finance_invoices_office_expenses'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['finance_meta_data_netsuite']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['finance_meta_data_netsuite'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['finance_meta_data_netsuite_banks']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['finance_meta_data_netsuite_banks'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['finance_meta_data_netsuite_products']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['finance_meta_data_netsuite_products'], create: 1, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CFO'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['CFO'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    // CTO permissions (46 modules)
    if (roleMap['CTO'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['finance_finance']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['finance_finance'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['finance_finance_tools']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['finance_finance_tools'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['finance_finance_tools_business']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['finance_finance_tools_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['finance_finance_tools_business_category']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['finance_finance_tools_business_category'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['finance_finance_tools_business_category_validation']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['finance_finance_tools_business_category_validation'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['finance_meta_data_netsuite']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['finance_meta_data_netsuite'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['finance_meta_data_netsuite_banks']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['finance_meta_data_netsuite_banks'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['finance_meta_data_netsuite_products']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['finance_meta_data_netsuite_products'], create: 1, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['CTO'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['CTO'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    // SALES_ADMIN permissions (38 modules)
    if (roleMap['SALES_ADMIN'] && moduleMap['applications']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['applications_business']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['applications_business'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['applications_business_loan']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['applications_business_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['applications_business_loan_all']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['applications_business_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['applications_business_loan_all_bl']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['applications_business_loan_all_bl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['applications_business_loan_all_bl_applications']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['applications_business_loan_all_bl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['applications_home']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['applications_home'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['applications_home_loan']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['applications_home_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['applications_home_loan_all']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['applications_home_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['applications_home_loan_all_hl']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['applications_home_loan_all_hl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['applications_home_loan_all_hl_applications']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['applications_home_loan_all_hl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['applications_personal']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['applications_personal'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['applications_personal_loan']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['applications_personal_loan'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['applications_personal_loan_all']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['applications_personal_loan_all'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['applications_personal_loan_all_pl']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['applications_personal_loan_all_pl'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['applications_personal_loan_all_pl_applications']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['applications_personal_loan_all_pl_applications'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['customers']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['customers_customers']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['customers_customers'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['dsa']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['dsa'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['dsa_channel']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['dsa_channel'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['dsa_channel_partners']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['dsa_channel_partners'], create: 0, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['finance']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['finance'], create: 1, read: 1, update: 1, delete: 1, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['finance_claim']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['finance_claim'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['finance_claim_payout']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['finance_claim_payout'], create: 1, read: 1, update: 1, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['finance_meta']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['finance_meta'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['finance_meta_data']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['finance_meta_data'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['finance_meta_data_banks']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['finance_meta_data_banks'], create: 1, read: 1, update: 0, delete: 1, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['marketing']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['marketing'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['marketing_bulk']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['marketing_bulk'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['marketing_bulk_calling']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['marketing_bulk_calling'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['marketing_notifications']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['marketing_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['marketing_notifications_app']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['marketing_notifications_app'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['marketing_notifications_app_notifications']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['marketing_notifications_app_notifications'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['marketing_send']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['marketing_send'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['marketing_send_sms']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['marketing_send_sms'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['users']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['users_crm']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['users_crm'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    if (roleMap['SALES_ADMIN'] && moduleMap['users_crm_users']) {
      roleModulesData.push({ role_id: roleMap['SALES_ADMIN'], module_id: moduleMap['users_crm_users'], create: 0, read: 1, update: 0, delete: 0, updated_on: new Date() });
    }

    let updatedCount = 0, insertedCount = 0;

    for (const data of roleModulesData) {
      const existing = await queryInterface.sequelize.query('SELECT id FROM role_modules WHERE role_id = ? AND module_id = ?', { replacements: [data.role_id, data.module_id], type: queryInterface.sequelize.QueryTypes.SELECT });
      if (existing.length > 0) {
        await queryInterface.sequelize.query('UPDATE role_modules SET `create` = ?, `read` = ?, `update` = ?, `delete` = ?, updated_on = NOW() WHERE role_id = ? AND module_id = ?', { replacements: [data.create, data.read, data.update, data.delete, data.role_id, data.module_id] });
        updatedCount++;
      } else {
        await queryInterface.bulkInsert('role_modules', [data], {});
        insertedCount++;
      }
    }
    console.log(`✅ Updated ${updatedCount} role-module mappings`);
    console.log(`✅ Inserted ${insertedCount} new role-module mappings`);
    console.log(`✅ Total processed: ${roleModulesData.length}`);
  },

  async down(queryInterface, Sequelize) {
    const roles = await queryInterface.sequelize.query("SELECT id FROM roles WHERE role != 'CEO'", { type: queryInterface.sequelize.QueryTypes.SELECT });
    for (const role of roles) {
      await queryInterface.sequelize.query('DELETE FROM role_modules WHERE role_id = ?', { replacements: [role.id] });
    }
  }
};
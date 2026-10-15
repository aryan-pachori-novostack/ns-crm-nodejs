let DSAControllerV1 = require(_pathconst.ControllersPath.DSAControllerV1);
const safe = require("../../../helpers/safe");
const LeadFormClaimController = require(_pathconst.FilesPath.LeadFormClaimController);
const DSAControllerV2 = require(_pathconst.ControllersPath.DSAControllerV2);
const EmailChangeController = require("../../controllers/emailChange/index.js");
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js')
const ExportMiddleware = require('../../../helpers/acl-middleware/export-middleware.js');
const express = require("express");
const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let LeadControllerV1 = require(_pathconst.ControllersPath.LeadControllerV1);
const MongoDBControllerV1 = require(_pathconst.ControllersPath.MongoDBControllerV1);
const { requireApproval } = require('../../../helpers/approval-middleware');
const reqValidator = require('../../../helpers/request-validator');
let DSAValidationV1 = require(_pathconst.ReqModelsPath.DSAValidationV1);

const isExportBody = (req) => {
    const { is_export } = req.body || {};
    return is_export === true || is_export === 'true' || is_export === 1;
};

// getApplicationsByProductAndLoanType is shared across every loan-type tab (car loan, home
// loan, ...) -- req.body.loan_type tells us which. Maps that to the specific rbac_modules
// alias for that tab so export permission can be granted per loan type, not just for the
// whole "applications" module at once. Unmapped/future loan types fall back to the generic
// 'applications' alias (previous behavior) so nothing silently becomes ungated.
const LOAN_TYPE_EXPORT_ALIAS = {
    car_loan: 'applications_car_loan',
    used_car_loan: 'applications_used_car_loan',
    car_refinance: 'applications_car_refinance',
    machinery_loan: 'applications_machinery_loan',
    education_loan: 'applications_education_loan',
    gold_loan: 'applications_gold_loan',
    solar_loan: 'applications_solar_loan',
    loan_against_property: 'applications_lap_all_lap_applications',
    personal_loan: 'applications_personal_loan_all_pl_applications',
    business_loan: 'applications_business_loan_all_bl_applications',
    home_loan: 'applications_home_loan_all_hl_applications',
    credit_card: 'applications_credit_card',
};
const resolveApplicationsExportAlias = (req) => LOAN_TYPE_EXPORT_ALIAS[req?.body?.loan_type] || 'applications';

router.post("/getRuloansCustomers", AuthHelper.authorize, RBACMiddleware.authorize(["finance", "dsa_channel_partners"], 'read'), ExportMiddleware.authorizeExport('dsa_channel_partners', isExportBody), DSAControllerV1.getRuloansCustomers);
router.post("/getRuloansCustomersDropDown", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getRuloansCustomersDropDown);
router.post("/getCustomersByCompany", AuthHelper.authorize, RBACMiddleware.authorize(["finance", "dsa_channel_partners"], 'read'), DSAControllerV1.getDsasByCompanyId);
router.post("/getStaticSignUpSteps", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getStaticSignUpSteps);
router.post("/getDsaCity", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getDsaCity);
router.post("/getDsaState", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getDsaState);
router.post("/getZipCodeList", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getZipCodeList);
router.post("/getPartnerList", AuthHelper.authorize, RBACMiddleware.authorize(["dsa_channel_partners", "applications_personal_loan_old_pl_pending_applications"], 'read'), DSAControllerV1.getPartnerList);
router.post("/getDsaUserDetails", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'read'), DSAControllerV1.getDsaUserDetails);
router.post("/getLoanApplications", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'read'), DSAControllerV1.getLoanApplications);
router.post("/getCreditCardApplications", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'read'), DSAControllerV1.getCreditCardApplications);
router.post("/getLntLoanApplications", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getLntLoanApplications);
router.post("/getCustomerUserDetails", AuthHelper.authorize, RBACMiddleware.authorize('customers_customers', 'read'), DSAControllerV1.getCustomerUserDetails);
router.post("/getCustomerLoanApplications", AuthHelper.authorize, RBACMiddleware.authorize('customers_customers', 'read'), ExportMiddleware.authorizeExport('customers_customers', isExportBody), DSAControllerV1.getCustomerLoanApplications);
router.post("/getCustomerCreditCardApplications", AuthHelper.authorize, RBACMiddleware.authorize('customers_customers', 'read'), DSAControllerV1.getCustomerCreditCardApplications);
router.post("/getCustomerLntApplications", AuthHelper.authorize, RBACMiddleware.authorize('customers_customers', 'read'), DSAControllerV1.getCustomerLntApplications);
router.post("/getCustomerLoanDocuments", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getCustomerLoanDocuments);
router.post("/getCustomerLoanCapturedDetails", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getCustomerLoanCapturedDetails);
router.post("/getCustomerCreditCardCapturedDetails", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getCustomerCreditCardCapturedDetails);
router.post("/getCustomerLoanSuggestedBanks", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getCustomerLoanSuggestedBanks);
router.post("/getSuggestedBanksList", AuthHelper.authorize, DSAControllerV1.getSuggestedBanksList);
router.post("/getLoanType", AuthHelper.authorize, RBACMiddleware.authorize(["dsa_channel_partners", "customers_customers"], 'read'), DSAControllerV1.getLoanType);
router.post("/getAllLoanApplications", AuthHelper.authorize, RBACMiddleware.authorize('applications_personal_loan_old_pl_pending_applications', 'read'), ExportMiddleware.authorizeExport('applications_personal_loan_old_pl_pending_applications', isExportBody), DSAControllerV1.getAllLoanApplications);
router.post("/getAllCreditCardApplications", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getAllCreditCardApplications);
router.post("/getCustomerState", AuthHelper.authorize, RBACMiddleware.authorize(["dsa_channel_partners", "customers_customers"], 'read'), DSAControllerV1.getCustomerState);
router.post("/getCustomerCity", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getCustomerCity);
router.post("/getCustomers", AuthHelper.authorize, RBACMiddleware.authorize('customers_customers', 'read'), DSAControllerV1.getCustomers)
router.post("/getDsaTree", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getDsaTree)
router.post("/getDsaChild", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getDsaChild)
router.post("/getDsaTreeWithCount", AuthHelper.authorize, RBACMiddleware.authorize("dashboard_mis_loans", "read"), ExportMiddleware.authorizeExport('dashboard_mis_loans', isExportBody), DSAControllerV1.getDsaTreeCount)
router.post("/getUnverifiedDsa", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getUnverifiedDsa)
router.post("/updateDsaVerifyStatus", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.updateDsaVerifyStatus)
router.post("/getDsaUserCapturedDetailsPdf", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getDsaUserCapturedDetailsPdf)
router.post("/uploadDsaVerificationDocument", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.uploadDsaVerificationDocument)
router.post("/getDsaVerificationDocument", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getDsaVerificationDocument)
router.post("/downloadDsaList", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.downloadDsaList)
router.post("/downloadAllLoanApplicationsList", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.downloadAllLoanApplicationsList)
router.post("/downloadAllCreditCardApplicationsList", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.downloadAllCreditCardApplicationsList);
router.post("/reassignPartner", AuthHelper.authorize, RBACMiddleware.authorize(['dsa_channel_partners_assign_partner', 'dsa_channel_partners_bulk_assign_partner'], 'update'), requireApproval('reassignPartner', 'Reassign DSA Partner'), DSAControllerV1.reassignPartner);
router.post("/reassignPartnerExternal", DSAControllerV1.reassignPartnerExternal);
router.post("/reassignPartnerWorker",AuthHelper.authorizeDsaCentralized, DSAControllerV1.reassignPartner);
router.post("/getLntApplicationById", AuthHelper.authorize, RBACMiddleware.authorize('applications_personal_loan_old_pl_lnt_pl_applications', 'read'), DSAControllerV1.getLntApplicationById);
router.post("/getCreditCardApplicationById", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getCreditCardApplicationById);
router.post("/getAllLntApplications", AuthHelper.authorize, RBACMiddleware.authorize('applications_personal_loan_old_pl_lnt_pl_applications', 'read'), ExportMiddleware.authorizeExport('applications_personal_loan_old_pl_lnt_pl_applications', isExportBody), DSAControllerV1.getAllLntApplications);
router.post("/getAllIndifiApplications", AuthHelper.authorize, RBACMiddleware.authorize('applications_business_loan_old_bl_indifi_bl_applications', 'read'), ExportMiddleware.authorizeExport('applications_business_loan_old_bl_indifi_bl_applications', isExportBody), DSAControllerV1.getAllIndifiApplications);
router.post("/getIndifiApplicationDetailsById", AuthHelper.authorize, RBACMiddleware.authorize('customers_customers', 'read'), DSAControllerV1.getIndifiApplicationDetailsById);
router.post("/getPayoutByPanNumber", AuthHelper.externalAuth, DSAControllerV1.getPayoutByPanNumber);
router.post("/refreshDsaKycVendorBranchExternal", AuthHelper.authorizeDsaCentralized, DSAControllerV1.refreshDsaKycVendorBranchFromNsExternal);
router.post("/getLntForDashboard", AuthHelper.authorize, RBACMiddleware.authorize(["dashboard_mis_loans", "applications_personal_loan_all_pl_applications", "applications_home_loan_all_hl_applications"], 'read'), ExportMiddleware.authorizeExport('dashboard_mis_loans', isExportBody), DSAControllerV1.getLntForDashboardV2);
router.post("/getIncredForDashboard", AuthHelper.authorize, aclPermissions.getPermissions, ExportMiddleware.authorizeExport('dashboard_mis_loans', isExportBody), DSAControllerV1.getIncredForDashboardV2);
router.post("/getFaircentForDashboard", AuthHelper.authorize, RBACMiddleware.authorize('dashboard_mis_loans', 'read'), ExportMiddleware.authorizeExport('dashboard_mis_loans', isExportBody), DSAControllerV1.getFaircentForDashboardV2);
router.post("/getBajajPLForDashboard", AuthHelper.authorize, aclPermissions.getPermissions, ExportMiddleware.authorizeExport('dashboard_mis_loans', isExportBody), DSAControllerV1.getBajajPLForDashboardV2);
router.post("/getCreditVidyaForDashboard", AuthHelper.authorize, aclPermissions.getPermissions, ExportMiddleware.authorizeExport('dashboard_mis_loans', isExportBody), DSAControllerV1.getCreditVidyaForDashboardV2);
router.post("/getCreditSasionForDashboard", AuthHelper.authorize, aclPermissions.getPermissions, ExportMiddleware.authorizeExport('dashboard_mis_loans', isExportBody), DSAControllerV1.getCreditSasionForDashboard);
router.post("/getPiramalForDashboard", AuthHelper.authorize, RBACMiddleware.authorize('dashboard_mis_loans', 'read'), ExportMiddleware.authorizeExport('dashboard_mis_loans', isExportBody), DSAControllerV1.getPiramalForDashboardV2);
router.post("/getYearlyPaysenseReport", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getYearlyPaysenseReport);
router.post("/getPaysenseForDashboard", AuthHelper.authorize, aclPermissions.getPermissions, ExportMiddleware.authorizeExport('dashboard_mis_loans', isExportBody), DSAControllerV1.getPaysenseForDashboardV2);
router.post("/getYearlyFibeReport", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getYearlyFibeReport);
router.post("/getFibeForDashboard", AuthHelper.authorize, aclPermissions.getPermissions, ExportMiddleware.authorizeExport('dashboard_mis_loans', isExportBody), DSAControllerV1.getFibeForDashboardV2);
router.post("/getIndifiForDashboard", AuthHelper.authorize, RBACMiddleware.authorize('dashboard_mis_loans', 'read'), ExportMiddleware.authorizeExport('dashboard_mis_loans', isExportBody), DSAControllerV1.getIndifiForDashboardV2);
router.post("/getCreditCardForDashboard", AuthHelper.authorize, RBACMiddleware.authorize('dashboard_mis_loans', 'read'), ExportMiddleware.authorizeExport('dashboard_mis_loans', isExportBody), DSAControllerV1.getAllCCForDashBoard);
router.post("/getLoanForDashboard", AuthHelper.authorize, RBACMiddleware.authorize('dashboard_mis_loans', 'read'), ExportMiddleware.authorizeExport('dashboard_mis_loans', isExportBody), DSAControllerV1.getLoanForDashboardV2);
router.post("/getApplicationCountForDashboard", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getApplicationCountForDashboard);
router.post("/getLntApplicationStage", AuthHelper.authorize, RBACMiddleware.authorize('applications_personal_loan_old_pl_lnt_pl_applications', 'read'), DSAControllerV1.getLntApplicationStage);
router.post("/getDsaIdByPhone", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getDsaIdByPhone);
router.post("/getLntApplicationSubStage", AuthHelper.authorize, RBACMiddleware.authorize('applications_personal_loan_old_pl_lnt_pl_applications', 'read'), DSAControllerV1.getLntApplicationSubStage);
router.post("/updateChannelPartnerStatus", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.updateChannelPartnerStatus);
router.post("/downloadDsaWithStep", AuthHelper.authorize, RBACMiddleware.authorize('dashboard_analytics', 'read'), ExportMiddleware.authorizeExport('dashboard_analytics'), DSAControllerV1.downloadDsaWithStep);
router.post("/uploadDsaWithStep", AuthHelper.authorize, RBACMiddleware.authorize('dashboard_analytics', 'create'), DSAControllerV1.uploadDsaWithStep);
router.post("/getGraphData", AuthHelper.authorize, RBACMiddleware.authorize('dashboard_graphs_channel_partners', 'read'), DSAControllerV1.getGraphData);
router.post("/sendWelcomeSms", AuthHelper.authorizeDsaCentralized, DSAControllerV1.sendWelcomeSms);
router.post("/sendAgreementSignedSms", AuthHelper.authorizeDsaCentralized, DSAControllerV1.sendAgreementSignedSms);
router.post("/getCreditCardApplicationStatus", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getCreditCardApplicationStatus);
router.post("/getIndifiApplicationStatus", AuthHelper.authorize, RBACMiddleware.authorize(["customers_customers", "applications_business_loan_old_bl_indifi_bl_applications"], 'read'), DSAControllerV1.getIndifiApplicationStatus);
router.post("/getDsaTreeDownload", AuthHelper.authorize, aclPermissions.getPermissions, ExportMiddleware.authorizeExport('dsa_channel_partners'), DSAControllerV1.getDsaTreeDownload);
router.post("/editSubAssignee", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.editSubAssignee);
router.post("/editUserType", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'update'), DSAControllerV1.editUserType);
router.post("/insertLastMonthsLntReport", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.insertLastMonthsLntReport);
router.post("/insertLastMonthsIncredReport", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.insertLastMonthsIncredReport);
router.post("/insertLastMonthsFaircentReport", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.insertLastMonthsFaircentReport);
router.post("/insertLastMonthDashboardReport", DSAControllerV1.insertLastMonthDashboardReport);
router.post("/getCibilInitiated", AuthHelper.authorize, RBACMiddleware.authorize(['dashboard_mis_loans', 'dashboard_graphs_cibil'], 'read'), DSAControllerV1.getCibilInitiated);
router.post("/getCibilList", AuthHelper.authorize, RBACMiddleware.authorize('applications_bureau_cibil', 'read'), ExportMiddleware.authorizeExport('applications_bureau_cibil', isExportBody), DSAControllerV1.getCibilList);
router.post("/getCibilDetail", AuthHelper.authorize, aclPermissions.getPermissions, ExportMiddleware.authorizeExport('applications_bureau_cibil'), DSAControllerV1.getCibilDetail);
router.post("/getCustomerCapturedDetails", AuthHelper.authorize, RBACMiddleware.authorize('customers_customers', 'read'), DSAControllerV1.getCustomerCapturedDetails);
router.post("/getYearlyLntReport", AuthHelper.authorize, DSAControllerV1.getYearlyLntReport);
router.post("/getYearlyIncredReport", AuthHelper.authorize, DSAControllerV1.getYearlyIncredReport);
router.post("/getYearlyFaircentReport", AuthHelper.authorize, DSAControllerV1.getYearlyFaircentReport);
router.post("/getYearlyDashboardReport", AuthHelper.authorize, DSAControllerV1.getYearlyCCReport);
router.post("/getYearlyBajajPLReport", AuthHelper.authorize, DSAControllerV1.getYearlyBajajPLReport);
router.post("/getYearlyCreditVidyaReport", AuthHelper.authorize, DSAControllerV1.getYearlyCreditVidyaReport);
router.post("/getYearlyCreditSasionReport", AuthHelper.authorize, DSAControllerV1.getYearlyCreditSasionReport);
router.post("/getYearlyPiramalReport", AuthHelper.authorize, DSAControllerV1.getYearlyPiramalReport);
router.post("/downloadAllLoanApplications", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.downloadAllLoanApplications);
router.post("/sendAppNotification", AuthHelper.authorize, RBACMiddleware.authorize('marketing_notifications_app_notifications', 'read'), DSAControllerV1.sendAppNotification);
router.post("/sendPushNotification", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.sendPushNotification);
router.post("/getAllPayoutRequest", AuthHelper.authorize, RBACMiddleware.authorize('finance_claim_direct_claims', 'read'), DSAControllerV1.getAllPayoutRequest);
router.post("/getPayoutRequest", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'read'), DSAControllerV1.getPayoutRequest);
router.post("/getDsaKycData", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'read'), DSAControllerV1.getDsaKycData);
router.post("/getDsaKycDataExternal", AuthHelper.authorizeDsa, DSAControllerV1.getDsaKycDataExternal);
router.post("/uploadDsaKycData", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.uploadDsaKycData);
router.post("/updateBhExternal", AuthHelper.externalAuth, DSAControllerV1.updateBhExternal);
router.post("/getAllFibeApplications", AuthHelper.authorize, RBACMiddleware.authorize(['applications_personal_loan_old_pl_fibe_applications', 'customers'], 'read'), ExportMiddleware.authorizeExport('applications_personal_loan_old_pl_fibe_applications', isExportBody), DSAControllerV1.getAllFibeApplications);
router.post("/getAllPayUApplications", AuthHelper.authorize, RBACMiddleware.authorize(['applications_personal_loan_old_pl_paysense_applications', 'customers'], 'read'), ExportMiddleware.authorizeExport('applications_personal_loan_old_pl_paysense_applications', isExportBody), DSAControllerV1.getAllPayUApplications);
router.post("/getAllBajajApplications", AuthHelper.authorize, RBACMiddleware.authorize(["applications_personal_loan_old_pl_bajaj_finance_applications", "customers"], 'read'), ExportMiddleware.authorizeExport('applications_personal_loan_old_pl_bajaj_finance_applications', isExportBody), DSAControllerV1.getAllBajajApplications);
router.post("/getAllIncredApplications", AuthHelper.authorize, RBACMiddleware.authorize(['applications_personal_loan_old_pl_incred_applications', 'customers'], 'read'), ExportMiddleware.authorizeExport('applications_personal_loan_old_pl_incred_applications', isExportBody), DSAControllerV1.getAllIncredApplications);
router.post("/getAllCreditSaisonApplications", AuthHelper.authorize, aclPermissions.getPermissions, ExportMiddleware.authorizeExport('applications_personal_loan', isExportBody), DSAControllerV1.getAllCreditSaisonApplications);
router.post("/getAllPiramalApplications", AuthHelper.authorize, RBACMiddleware.authorize(['applications_home_loan_old_hl_piramal_applications', 'customers'], 'read'), ExportMiddleware.authorizeExport('applications_home_loan_old_hl_piramal_applications', isExportBody), DSAControllerV1.getAllPiramalApplications);
router.post("/getAllCreditVidyaApplications", AuthHelper.authorize, RBACMiddleware.authorize(['applications_personal_loan_old_pl_prefr_applications', 'customers'], 'read'), ExportMiddleware.authorizeExport('applications_personal_loan_old_pl_prefr_applications', isExportBody), DSAControllerV1.getAllCreditVidyaApplications);
router.post("/getStageFilterList", AuthHelper.authorize, DSAControllerV1.getStageFilterList);
router.post("/sendSearchEngineOtp", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.sendSearchEngineOtp);
router.post("/verifySearchEngineOtp", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.verifySearchEngineOtp);
router.post("/uploadLeadFormData", AuthHelper.authorize, RBACMiddleware.authorize(["finance_claim_payout", "finance_claim_consolidated_leads", "finance_claim_instant_claim"], 'create'), DSAControllerV1.uploadLeadFormData);
router.post("/uploadLeadFormDataExternal", AuthHelper.authorizeDsaCentralized, DSAControllerV1.uploadLeadFormData);
router.post("/uploadInvoiceData", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.uploadInvoiceData);
router.post("/updateCCApplications", AuthHelper.authorize, RBACMiddleware.authorize(["applications_personal_loan_all_pl_applications", "applications_home_loan_all_hl_applications"], 'update'), DSAControllerV1.updateCCApplications);
router.post("/uploadAndEditDsa", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.uploadAndEditDsa);
router.post("/deleteLeadFormData", AuthHelper.authorize, RBACMiddleware.authorize(["finance_claim_payout", "finance_claim_consolidated_leads", "finance_claim_instant_claim", "finance_claim_customer_leads"], 'delete'), DSAControllerV1.deleteLeadFormData);
router.post("/deleteLeadFormDataExternal", AuthHelper.authorizeDsaCentralized, DSAControllerV1.deleteLeadFormData);
router.post("/updateClaimPendingStatus", AuthHelper.authorize, RBACMiddleware.authorize(["finance_claim_payout", "finance_claim_consolidated_leads", "finance_claim_instant_claim", "finance_claim_customer_leads"], 'update'), DSAControllerV1.updateClaimPendingStatus);
router.post("/updateMultiFundedStatus", AuthHelper.authorize, RBACMiddleware.authorize(["finance_claim_payout", "finance_claim_consolidated_leads", "finance_claim_instant_claim", "finance_claim_customer_leads"], 'update'), DSAControllerV1.updateMultiFundedStatus);
router.post("/moveToPendingLeadForm", AuthHelper.authorize, RBACMiddleware.authorize(["finance_claim_payout"], 'update'), DSAControllerV1.moveToPendingLeadForm);
router.post("/moveToPendingLeadFormBankerProcessed", AuthHelper.authorize, RBACMiddleware.authorize(["finance_claim_banker_confirmations"], 'update'), DSAControllerV1.moveToPendingLeadFormBankerProcessed);
router.post("/getAllDsaLeads", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'read'), DSAControllerV1.getAllDsaLeads);
router.post("/getAllPendingHlApplications", AuthHelper.authorize, RBACMiddleware.authorize('applications_home_loan_old_hl_pending_applications', 'read'), ExportMiddleware.authorizeExport('applications_home_loan_old_hl_pending_applications', isExportBody), DSAControllerV1.getAllPendingHlApplications);
router.post("/getAllPendingHlApplicationsExternal", AuthHelper.authorizeDsaCentralized, DSAControllerV1.getAllPendingHlApplications);
router.post("/getAllPendingLAPApplications", AuthHelper.authorize, RBACMiddleware.authorize('applications_lap_old_lap_pending_applications', 'read'), ExportMiddleware.authorizeExport('applications_lap_old_lap_pending_applications', isExportBody), DSAControllerV1.getAllPendingLAPApplications);
router.post("/getAllPendingLAPApplicationsExternal", AuthHelper.authorizeDsaCentralized, DSAControllerV1.getAllPendingLAPApplications);
router.post("/getAllPiramalLapApplications", AuthHelper.authorize, RBACMiddleware.authorize('applications_lap_old_lap_piramal_applications', 'read'), ExportMiddleware.authorizeExport('applications_lap_old_lap_piramal_applications', isExportBody), DSAControllerV1.getAllPiramalLapApplications);
router.post("/getLeadClaimUploadLogs", AuthHelper.authorize, RBACMiddleware.authorize('activity_logs_lead_form_upload', 'read'), DSAControllerV1.getLeadClaimUploadLogs);
router.post("/getLeadClaimUploadLogsExternal", AuthHelper.authorizeDsaCentralized, DSAControllerV1.getLeadClaimUploadLogs);
router.post("/getDsaUploadLogs", AuthHelper.authorize, RBACMiddleware.authorize('activity_logs', 'read'), DSAControllerV1.getDsaUploadLogs);
router.post("/getLeadClaimUpdateLogs", AuthHelper.authorize, RBACMiddleware.authorize('activity_logs_export', 'update'), DSAControllerV1.getLeadClaimUpdateLogs);
router.post("/createCommunicationSettings", AuthHelper.authorize, RBACMiddleware.authorize('settings_sms_triggers', 'create'), DSAControllerV1.createCommunicationSettings);
router.post("/getCommunicationSettings", AuthHelper.authorize, RBACMiddleware.authorize('settings_sms_triggers', 'read'), DSAControllerV1.getCommunicationSettings);
router.post("/deleteCommunicationSettings", AuthHelper.authorize, RBACMiddleware.authorize('settings_sms_triggers', 'delete'), DSAControllerV1.deleteCommunicationSettings);

router.post("/createRemainder", AuthHelper.authorize, RBACMiddleware.authorize('tools_reminder', 'create'), DSAControllerV1.createRemainder);
router.post("/getAllRemainder", AuthHelper.authorize, RBACMiddleware.authorize('tools_reminder', 'read'), DSAControllerV1.getAllRemainder);
router.post("/getAllUpcomingRemainder", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getAllUpcomingRemainder);

router.post("/getAllMissedRemainder", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getAllMissedRemainder);
router.post("/deleteRemainder", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.deleteRemainder);
router.post("/markAllPastRemainderAsRead", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.markAllPastRemainderAsRead);
router.post("/markRemainderAsRead", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.markRemainderAsRead);

router.post("/checkSendSMSNew", DSAControllerV1.checkSendSMSNew);
router.post("/getDsaDataForEdit", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getDsaDataForEdit);
router.post("/getDsaCityState", AuthHelper.authorize, RBACMiddleware.authorize('tools_list_filters', 'read'), DSAControllerV1.getDsaCityState);
router.post("/createOrEditDsa", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.createOrEditDsa);
router.post("/getPersonalLoanMisForDsa", AuthHelper.authorize, RBACMiddleware.authorize('dashboard_mis_combined_mis', 'read'), ExportMiddleware.authorizeExport('dashboard_mis_combined_mis', isExportBody), DSAControllerV1.getPersonalLoanMisForDsa);

router.post("/updateLeadFormPayoutType", AuthHelper.authorize, RBACMiddleware.authorize('finance_claim_payout', 'update'), DSAControllerV1.updateLeadFormPayoutType);
router.post("/getLedger", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getLedger);
router.post("/mergeDsa", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.mergeDsa);
router.post("/getAllCCApplications", AuthHelper.authorize, RBACMiddleware.authorize('applications_credit_card', 'read'), ExportMiddleware.authorizeExport('applications_credit_card', isExportBody), DSAControllerV1.getAllCCApplications);
router.post("/getAllCCApplicationsExternal", AuthHelper.authorizeDsa, DSAControllerV1.getAllCCApplications);
router.post("/getAllCCProducts", AuthHelper.authorize, RBACMiddleware.authorize(['dashboard_mis_loans', 'applications'], 'read'), DSAControllerV1.getAllCCProducts);

router.post("/getAllInvoices", AuthHelper.authorize, aclPermissions.getPermissions, ExportMiddleware.authorizeExport('finance_invoices_invoices', isExportBody), DSAControllerV1.getAllInvoices);
router.post("/deleteInvoice", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.deleteInvoice);
router.post("/updateInvoice", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.updateInvoice);
router.post("/updateInvoiceNumber", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.updateInvoiceNumber);
router.post("/updateInvoiceNumberExternal", AuthHelper.authorizeDsaCentralized, DSAControllerV1.updateInvoiceNumber);
router.post("/acceptOrRejectInvoice", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.acceptOrRejectInvoice);
router.post("/uploadReverseInvoice", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.uploadReverseInvoice);
router.post("/downloadInvoice", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.downloadInvoice);
router.post("/downloadInvoiceExternal", AuthHelper.authorizeDsaCentralized, DSAControllerV1.downloadInvoice);
router.post("/signInvoice", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.signInvoice);
router.post("/signInvoiceExternal", AuthHelper.externalAuth, DSAControllerV1.signInvoice);
router.post("/signInvoiceWebhook", DSAControllerV1.signInvoiceWebhook);
router.post("/sendInvoiceSignOtpSms", DSAControllerV1.sendInvoiceSignOtpSms);
router.post("/getRefreshPayoutStatusForDsa", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getRefreshPayoutStatusForDsa);

router.post("/editDsaNSVendorId", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'update'), DSAControllerV1.editDsaNSVendorId);
router.post("/getAllDsaDopdown", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getAllDsaDopdown);
router.post("/getAllDsaDopdownExternal", AuthHelper.authorizeDsaCentralized, DSAControllerV1.getAllDsaDopdown);
router.post('/getDsaPartnerExternal', AuthHelper.authorizeDsaCentralized, DSAControllerV1.getDsaPartner)
router.post('/getDsaPartner', AuthHelper.authorize, RBACMiddleware.authorize('finance_invoices_office_expenses', 'read'), DSAControllerV1.getDsaPartner)

router.post("/pushDSAToNS", AuthHelper.authorize, aclPermissions.getPermissions, LeadControllerV1.pushDSAToNS);
router.post("/pushDSAToNSExternal", AuthHelper.authorizeDsaCentralized, LeadControllerV1.pushDSAToNS);
router.post("/getAllGlobalConfiguration", AuthHelper.authorize, DSAControllerV1.getAllGlobalConfiguration);
router.get("/get-global-configuration", AuthHelper.authorizeDsa, DSAControllerV1.getAllGlobalConfiguration);
router.post("/CreateEditGlobalConfiguration", AuthHelper.authorize, RBACMiddleware.authorize('settings_global_configuration', 'create'), DSAControllerV1.CreateEditGlobalConfiguration);
router.post("/DeleteGlobalConfiguration", AuthHelper.authorize, RBACMiddleware.authorize('settings_global_configuration', 'delete'), DSAControllerV1.DeleteGlobalConfiguration);
router.post("/AddBankDetailDsa", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.AddBankDetailDsa);
router.post("/getBankDetailsDsa", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getBankDetailsDsa);

router.post("/AddFreshLeadClaim", AuthHelper.authorize, RBACMiddleware.authorize('finance_claim_payout', 'create'), reqValidator(DSAValidationV1.AddFreshLeadClaim), safe(LeadFormClaimController.addOrEditLeadClaim, { envelope: "v1" }));
router.post("/add_external_claim", AuthHelper.authorizeDsaCentralized, reqValidator(DSAValidationV1.AddFreshLeadClaim), safe(LeadFormClaimController.addOrEditLeadClaim, { envelope: "v1" }));
router.post("/getFreshLeadClaimForEdit", AuthHelper.authorize, RBACMiddleware.authorize('finance_claim_payout', 'update'), DSAControllerV1.getFreshLeadClaimForEdit);
router.post("/updateLeadByReconciliation", AuthHelper.authorize, RBACMiddleware.authorize(['finance_claim_banker_confirmations'], 'update'), DSAControllerV1.updateLeadByReconciliation);
router.post("/refreshApplicationStatus", AuthHelper.authorize, RBACMiddleware.authorize(["applications_personal_loan_old_pl_bajaj_finance_applications", "applications_personal_loan_old_pl_fibe_applications", "applications_home_loan_old_hl_piramal_applications"], 'read'), DSAControllerV1.refreshApplicationStatus);
router.post("/get-status-refresh", AuthHelper.authorize, RBACMiddleware.authorize('applications_personal_loan_all_pl_applications', 'read'), DSAControllerV1.getStatusRefresh);
router.post("/updateDirectClaimAccess", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'update'), DSAControllerV1.updateDirectClaimAccess);
router.post("/getApplicationsByProductAndLoanType", AuthHelper.authorize, RBACMiddleware.authorize('applications', 'read'), ExportMiddleware.authorizeExport(resolveApplicationsExportAlias, isExportBody), DSAControllerV1.getApplicationsByProductAndLoanType);
router.post("/getAllApplications", AuthHelper.authorize, RBACMiddleware.authorize('applications_all_applications', 'read'), ExportMiddleware.authorizeExport('applications_all_applications', isExportBody), DSAControllerV1.getAllApplicationsExternal);
router.post("/getUtmJourneyUrl", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getUtmJourneyUrl);
router.post("/getAllLoanApplicationsExternal", AuthHelper.authorizeDsaCentralized, DSAControllerV1.getApplicationsByProductAndLoanType);
router.post("/getAllApplicationsExternal", AuthHelper.authorizeDsaCentralized, DSAControllerV1.getAllApplicationsExternal);
router.post("/editSigningPayout", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'update'), DSAControllerV1.editSigningPayout);
router.post("/editSigningPayoutExternal", AuthHelper.authorizeDsaCentralized, DSAControllerV1.editSigningPayout);
router.post("/updateDsaAutoErpStatus", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'update'), DSAControllerV1.updateDsaAutoErpStatus)
router.post("/getAllPlForDashboard", AuthHelper.authorize, RBACMiddleware.authorize('dashboard_mis_loans', 'read'), ExportMiddleware.authorizeExport('dashboard_mis_loans', isExportBody), DSAControllerV1.getAllPlForDashboard);
router.post("/getAllPayoutClaimForDashboard", AuthHelper.authorize, RBACMiddleware.authorize('dashboard_mis_loans', 'read'), ExportMiddleware.authorizeExport('dashboard_mis_loans', isExportBody), DSAControllerV1.getAllPayoutClaimForDashboard);
router.post("/getYearlyPlReport", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getYearlyPlReport);
router.post("/getYearlyPayoutClaimReport", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getYearlyPayoutClaimReport);
router.post("/getYearlyPayoutClaimReport", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getYearlyPayoutClaimReport);
router.post("/getYearlyLogiFormReport", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getYearlyLogiFormReport);
router.post("/getLoginFormForDashboard", AuthHelper.authorize, RBACMiddleware.authorize('dashboard_mis_loans', 'read'), ExportMiddleware.authorizeExport('dashboard_mis_loans', isExportBody), DSAControllerV1.getLoginFormForDashboard);
router.post("/getCombinedLoanApplications", AuthHelper.authorize, RBACMiddleware.authorize('customers_customers', 'read'), ExportMiddleware.authorizeExport('customers_customers', isExportBody), DSAControllerV1.getCombinedLoanApplications);
router.post("/getUtmJourneyUrlExternal", AuthHelper.authorizeDsaCentralized, DSAControllerV1.getUtmJourneyUrl);
router.post("/getMisMongoDB", AuthHelper.authorize, RBACMiddleware.authorize('dashboard_mis_loans', 'read'), ExportMiddleware.authorizeExport('dashboard_mis_loans', isExportBody), MongoDBControllerV1.getMisMongoDB);
router.post("/getYearlyMisMongoDB", AuthHelper.authorize, RBACMiddleware.authorize('dashboard_new_mis_yearly_mis', 'read'), MongoDBControllerV1.getYearlyMisMongoDB);
router.post("/getCityWiseMisMongoDB", AuthHelper.authorize, RBACMiddleware.authorize('dashboard_new_mis_city_wise_mis', 'read'), MongoDBControllerV1.getCityWiseMisMongoDB);
router.post("/getLenderBusinessReport", AuthHelper.authorize, RBACMiddleware.authorize('dashboard_new_mis_business_mis', 'read'), MongoDBControllerV1.getLenderBusinessReport);
router.post("/getMonthlyComparision", AuthHelper.authorize, RBACMiddleware.authorize('dashboard_new_mis_monthly_comparison', 'read'), MongoDBControllerV1.getMonthlyComparision);
router.post("/getBusinessDetailsForDsa", AuthHelper.authorize, aclPermissions.getPermissions, MongoDBControllerV1.getBusinessDetailsForDsa);
router.post("/withdrawDsaConsent", AuthHelper.authorizeDsaCentralized, DSAControllerV1.withdrawDsaConsent);
router.post("/withdrawDsaConsentCrm", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.withdrawDsaConsent);
router.post("/fetchDigioDoduments", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.fetchDigioDoduments);
router.post("/reassignCustomerPartner", AuthHelper.authorize, RBACMiddleware.authorize('customers_customers', 'update'), DSAControllerV1.reassignCustomerPartner);
router.post("/updateLntApplicationById", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.updateLntApplicationById);
router.post("/changeDsaEmployeeStatus", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.changeDsaEmployeeStatus);
router.post("/updateDsaEmployee", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'update'), DSAControllerV1.updateDsaEmployee);
router.post("/updateLoanApplication", AuthHelper.authorize, RBACMiddleware.authorize(["applications_personal_loan_all_pl_applications", "applications_home_loan_all_hl_applications", "applications_business_loan_all_bl_applications"], 'update'), DSAControllerV1.updateLoanApplication);
router.post("/send-email-message", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.sendEmailMessage);
router.post("/send-whatsapp-message", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.sendWhatsappMessage);
router.post("/downloadSampleFormat", AuthHelper.authorize, DSAControllerV1.downloadLeadFormSample)
router.post("/send-push-notification", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.sendPushNotificationToKafka)
router.post("/send-sms", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.sendSmsToKafka)
router.post("/editCustomers", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.editCustomers);
router.post("/updateCustomerFields", AuthHelper.authorizeDsaCentralized, DSAControllerV1.updateCustomerFields);
router.post("/updateCustomerFieldsCrm", AuthHelper.authorize, RBACMiddleware.authorize('customers_customers', 'update'), DSAControllerV1.updateCustomerFields);
router.post("/getCompanyList", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getCompanyList);
router.post("/getRMList", AuthHelper.authorize, RBACMiddleware.authorize('applications_personal_loan_all_pl_applications', 'read'), DSAControllerV1.getRMList);
router.post("/assignRM", AuthHelper.authorize, RBACMiddleware.authorize(["applications_home_loan_all_hl_applications", "applications_business_loan_all_bl_applications"], 'read'), DSAControllerV1.assignRM);
router.post("/getDsaParentRecursively", AuthHelper.authorize, RBACMiddleware.authorize(["applications_personal_loan_all_pl_applications", "applications_home_loan_all_hl_applications"], 'read'), DSAControllerV1.getDsaParentRecursively)
router.post("/getLoanDetails", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getLoanDetails);
router.post("/editLoanDetails", AuthHelper.authorize, RBACMiddleware.authorize(["applications_personal_loan_all_pl_applications", "applications_home_loan_all_hl_applications", "applications_business_loan_all_bl_applications"], 'update'), DSAControllerV1.editLoanDetails);
router.post("/updateClaimPendingStatusExternal", AuthHelper.authorizeDsa, DSAControllerV1.updateClaimPendingStatusExternal);
router.post("/bulkCalling", AuthHelper.authorize, RBACMiddleware.authorize('marketing_bulk_calling', 'read'), DSAControllerV1.bulkCalling);
router.post("/bulkCallingslashrtc", AuthHelper.authorize, RBACMiddleware.authorize('marketing_bulk_calling', 'read'), DSAControllerV1.bulkCallingslashrtc);
router.post("/validateVendorPayout", AuthHelper.authorize, RBACMiddleware.authorize('finance_claim_instant_claim', 'read'), DSAControllerV1.validateVendorPayout);
router.post("/notificationStats", AuthHelper.authorize, RBACMiddleware.authorize(['marketing_analytics', 'marketing_bulk_calling', 'marketing_send_sms', 'marketing_notifications'], 'read'), DSAControllerV1.notificationStats);
router.post("/modifyPermissions", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'update'), DSAControllerV1.modifyPermissions);
router.get("/get-permissions", AuthHelper.authorizeDsa, DSAControllerV1.modifyPermissions);
router.post("/toggleNotificationDsa", AuthHelper.authorizeDsa, DSAControllerV1.toggleNotificationDsa);
router.post("/instantClaimApplicationExternal", AuthHelper.authorizeDsa, DSAControllerV1.instantClaimApplication);
router.post("/getCrmUsers", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getCrmUsers);
router.post("/updateLeadCaseBusinessCategory", AuthHelper.authorize, RBACMiddleware.authorize('finance_finance_tools_business_category_validation', 'update'), DSAControllerV1.updateLeadCaseBusinessCategory);
router.post("/getAllLeadCaseBusinessCategory", AuthHelper.authorize, RBACMiddleware.authorize('finance_finance_tools_business_category_validation', 'read'), DSAControllerV1.getAllLeadCaseBusinessCategory);
router.post("/getDsaTaxDetails", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'read'), DSAControllerV1.getDsaTaxDetails);
router.post("/updateBillerUniversal", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'update'), DSAControllerV1.updateBillerUniversal);
router.post("/updateDsaTaxInformation", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'update'), DSAControllerV1.updateDsaTaxInformation);
router.post("/getSalesPersons", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'read'), DSAControllerV1.getSalesPersons);
router.post("/assignSalesPerson", AuthHelper.authorize, RBACMiddleware.authorize(['dsa_channel_partners_assign_sp', 'dsa_channel_partners_bulk_assign_sp'], 'update'), DSAControllerV1.assignSalesPerson);
router.post("/getCrmUsers", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.getCrmUsers);
router.post("/updateDsaMobileNumber", AuthHelper.authorize, aclPermissions.getPermissions, DSAControllerV1.updateDsaMobileNumber);
router.post("/updateDsaClassInfo", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'update'), DSAControllerV1.updateDsaClassInfo);
router.post("/updateDsaMobileNumberExternal", AuthHelper.authorizeDsaCentralized, DSAControllerV1.updateDsaMobileNumber);
router.post("/getAllPincodes", AuthHelper.authorize, RBACMiddleware.authorize('tools_pincode', 'read'), DSAControllerV1.getAllPincodes);
router.post("/editOrDeletePincode", AuthHelper.authorize, RBACMiddleware.authorize('tools_pincode', 'update'), DSAControllerV1.editOrDeletePincode);
router.post("/addPincode", AuthHelper.authorize, RBACMiddleware.authorize('tools_pincode', 'create'), DSAControllerV1.addPincode);
router.post("/getAllLoanApplicationsExternalStaticAuth", AuthHelper.externalAuth, DSAControllerV1.getApplicationsByProductAndLoanType);
router.get("/getActivePartnersCount", AuthHelper.authorizeDsaCentralized, DSAControllerV1.getActivePartnersCount)
router.post("/vendormetrics", AuthHelper.authorizeDsaCentralized, RBACMiddleware.authorize('dashboard_vendor_management', 'read', true), DSAControllerV1.getVendorMetrics);
router.post("/getVendorDashboardList", AuthHelper.authorizeDsaCentralized, RBACMiddleware.authorize('dashboard_vendor_management', 'read', true), ExportMiddleware.authorizeExport('dashboard_vendor_management', isExportBody), DSAControllerV1.getVendorDashboardList);
router.post("/getVendorDashboardListCounts", AuthHelper.authorizeDsaCentralized, RBACMiddleware.authorize('dashboard_vendor_management', 'read', true), DSAControllerV1.getVendorDashboardListCounts);
router.post("/vendormetricsExternal", AuthHelper.authorizeDsaCentralized, DSAControllerV1.getVendorMetrics);
router.post("/getVendorDashboardListExternal", AuthHelper.authorizeDsaCentralized,DSAControllerV1.getVendorDashboardList);
router.post("/getVendorDashboardListCountsExternal", AuthHelper.authorizeDsaCentralized, DSAControllerV1.getVendorDashboardListCounts);
router.post("/getVendorDashboardByDsaId", AuthHelper.authorizeDsaCentralized, DSAControllerV1.getVendorDashboardByDsaId);
router.post("/getVendorBranchSummaryMetrics", AuthHelper.authorizeDsaCentralized, RBACMiddleware.authorize('dashboard_vendor_management', 'read', true), DSAControllerV1.getVendorBranchSummaryMetrics);
router.post("/getVendorBranchList", AuthHelper.authorizeDsaCentralized, RBACMiddleware.authorize('dashboard_vendor_management', 'read', true), DSAControllerV1.getVendorBranchList);
router.post("/getVendorBranchDsaList", AuthHelper.authorizeDsaCentralized, RBACMiddleware.authorize('dashboard_vendor_management', 'read', true), DSAControllerV1.getVendorBranchDsaList);
router.post("/getVendorBranchSummaryMetricsExternal", AuthHelper.authorizeDsaCentralized, DSAControllerV1.getVendorBranchSummaryMetrics);
router.post("/getVendorBranchListExternal", AuthHelper.authorizeDsaCentralized, DSAControllerV1.getVendorBranchList);
router.post("/getVendorBranchDsaListExternal", AuthHelper.authorizeDsaCentralized, DSAControllerV1.getVendorBranchDsaList);
router.post("/listDsaLeadsExternal", AuthHelper.authorizeDsaCentralized, LeadControllerV1.listDsaLeads);
router.get("/getDsaLeadByIdExternal", AuthHelper.authorizeDsaCentralized, LeadControllerV1.getDsaLeadById);
router.post("/getLeadLogsByLeadIdExternal", AuthHelper.authorizeDsaCentralized, LeadControllerV1.getLeadLogsByLeadId);
router.post("/getCallLogsByLeadIdExternal", AuthHelper.authorizeDsaCentralized, LeadControllerV1.getCallLogsByLeadId);
router.post("/getLeadEntriesByLeadIdExternal", AuthHelper.authorizeDsaCentralized, LeadControllerV1.getLeadEntriesByLeadId);
router.post("/captureDsaLeadCallDataExternal", AuthHelper.authorizeDsaCentralized, LeadControllerV1.captureDsaLeadCallData);

// Vendor hierarchy compact view (data from vendor_hierarchy_snapshot)
router.post("/getVendorHierarchyCompactChildren", AuthHelper.authorizeDsaCentralized, RBACMiddleware.authorize('dashboard_vendor_management', 'read', true), DSAControllerV1.getCompactViewChildren);
router.get("/getVendorHierarchyCompactNode/:dsaId", AuthHelper.authorizeDsaCentralized, RBACMiddleware.authorize('dashboard_vendor_management', 'read', true), DSAControllerV1.getCompactNodeDetails);

// For Saving Claim Draft in mongo (CRM — RBAC); B2B uses same handlers with authorizeDsaCentralized
router.post("/saveLeadClaimDraftMongo", AuthHelper.authorize, RBACMiddleware.authorize('finance_claim_payout', 'create'), MongoDBControllerV1.saveLeadClaimDraftMongo);
router.post("/getLeadClaimDraftsMongo", AuthHelper.authorize, RBACMiddleware.authorize('finance_claim_payout', 'read'), MongoDBControllerV1.getLeadClaimDraftsMongo);
router.post("/deleteLeadClaimDraftMongo", AuthHelper.authorize, RBACMiddleware.authorize('finance_claim_payout', 'create'), MongoDBControllerV1.deleteLeadClaimDraftMongo);
router.post("/saveLeadClaimDraftMongoExternal", AuthHelper.authorizeDsaCentralized, MongoDBControllerV1.saveLeadClaimDraftMongo);
router.post("/getLeadClaimDraftsMongoExternal", AuthHelper.authorizeDsaCentralized, MongoDBControllerV1.getLeadClaimDraftsMongo);
router.post("/deleteLeadClaimDraftMongoExternal", AuthHelper.authorizeDsaCentralized, MongoDBControllerV1.deleteLeadClaimDraftMongo);

// Public — admin email-change verify link (no auth). GET .../v1/dsa/verifyDsaEmail?token=
router.get("/verifyDsaEmail", EmailChangeController.verifyEmailPublic);

const methodNotAllowed = (req, res) =>
  ResHelper.apiResponse(
    res,
    false,
    `Method ${req.method} not allowed. Use POST with JSON body.`,
    405,
    {},
    ""
  );

// CRM user management — change DSA email (CEO / BUSINESS_HEAD / LEAD_ADMIN; role check in controller)
router.get("/changeDsaEmail", methodNotAllowed);
router.get("/change-email", methodNotAllowed);
router.post("/changeDsaEmail", AuthHelper.authorize, EmailChangeController.adminChangeEmail);
router.post("/resendDsaVerificationEmail", AuthHelper.authorize, EmailChangeController.adminResendVerificationEmail);
// kebab-case aliases
router.post("/change-email", AuthHelper.authorize, EmailChangeController.adminChangeEmail);
router.post("/resend-verification-email", AuthHelper.authorize, EmailChangeController.adminResendVerificationEmail);

// DSA profile — self-service email change (OTP sub-routes)
router.post(
    "/changeDsaEmail/sendOtpOld",
    AuthHelper.authorizeDsaCentralized,
    RBACMiddleware.authorize("dsa_channel_partners", "update", true),
    EmailChangeController.sendOtpOld
);
router.post(
    "/changeDsaEmail/verifyOtpOld",
    AuthHelper.authorizeDsaCentralized,
    RBACMiddleware.authorize("dsa_channel_partners", "update", true),
    EmailChangeController.verifyOtpOld
);
router.post(
    "/changeDsaEmail/resendOtpOld",
    AuthHelper.authorizeDsaCentralized,
    RBACMiddleware.authorize("dsa_channel_partners", "update", true),
    EmailChangeController.resendOtpOld
);
router.post(
    "/changeDsaEmail/sendOtpNew",
    AuthHelper.authorizeDsaCentralized,
    RBACMiddleware.authorize("dsa_channel_partners", "update", true),
    EmailChangeController.sendOtpNew
);
router.post(
    "/changeDsaEmail/verifyOtpNew",
    AuthHelper.authorizeDsaCentralized,
    RBACMiddleware.authorize("dsa_channel_partners", "update", true),
    EmailChangeController.verifyOtpNew
);
router.post(
    "/changeDsaEmail/resendOtpNew",
    AuthHelper.authorizeDsaCentralized,
    RBACMiddleware.authorize("dsa_channel_partners", "update", true),
    EmailChangeController.resendOtpNew
);
router.post(
    "/change-email/send-otp-old",
    AuthHelper.authorizeDsaCentralized,
    RBACMiddleware.authorize("dsa_channel_partners", "update", true),
    EmailChangeController.sendOtpOld
);
router.post(
    "/change-email/verify-otp-old",
    AuthHelper.authorizeDsaCentralized,
    RBACMiddleware.authorize("dsa_channel_partners", "update", true),
    EmailChangeController.verifyOtpOld
);
router.post(
    "/change-email/resend-otp-old",
    AuthHelper.authorizeDsaCentralized,
    RBACMiddleware.authorize("dsa_channel_partners", "update", true),
    EmailChangeController.resendOtpOld
);
router.post(
    "/change-email/send-otp-new",
    AuthHelper.authorizeDsaCentralized,
    RBACMiddleware.authorize("dsa_channel_partners", "update", true),
    EmailChangeController.sendOtpNew
);
router.post(
    "/change-email/verify-otp-new",
    AuthHelper.authorizeDsaCentralized,
    RBACMiddleware.authorize("dsa_channel_partners", "update", true),
    EmailChangeController.verifyOtpNew
);
router.post(
    "/change-email/resend-otp-new",
    AuthHelper.authorizeDsaCentralized,
    RBACMiddleware.authorize("dsa_channel_partners", "update", true),
    EmailChangeController.resendOtpNew
);

// B2B external — re-verify already-verified DSA email (OTP; not admin verification link)
router.post(
    "/sendDsaEmailReverificationOtpExternal",
    AuthHelper.authorizeDsaCentralized,
    DSAControllerV2.sendDsaEmailReverificationOtpExternal
);
router.post(
    "/verifyDsaEmailReverificationOtpExternal",
    AuthHelper.authorizeDsaCentralized,
    DSAControllerV2.verifyDsaEmailReverificationOtpExternal
);
router.post(
    "/send-dsa-email-reverification-otp-external",
    AuthHelper.authorizeDsaCentralized,
    DSAControllerV2.sendDsaEmailReverificationOtpExternal
);
router.post(
    "/verify-dsa-email-reverification-otp-external",
    AuthHelper.authorizeDsaCentralized,
    DSAControllerV2.verifyDsaEmailReverificationOtpExternal
);

module.exports = router;
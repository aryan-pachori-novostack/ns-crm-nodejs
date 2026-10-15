
let LeadControllerV1 = require(_pathconst.ControllersPath.LeadControllerV1);
let LeadValidationV1 = require(_pathconst.ReqModelsPath.LeadValidationV1);
let LeadErpController = require(_pathconst.ControllersPath.LeadErpController);
const LeadAutonomousFinance = require(_pathconst.ControllersPath.LeadAutonomousFinance);
const LeadPayoutController = require(_pathconst.ControllersPath.LeadPayoutController);
const LeadReferenceController = require(_pathconst.ControllersPath.LeadReferenceController);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');
const express = require("express");
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js');
const ExportMiddleware = require('../../../helpers/acl-middleware/export-middleware.js');
const reqValidator = require('../../../helpers/request-validator.js');
const safe = require('../../../helpers/safe.js');
const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);

// getLeadForms is shared across all 4 Finance > Claim sub-pages (Payout, Customer Leads,
// Consolidated Leads, Instant Claim), distinguished by req.body.moduleName (the FE already
// knows which page it is -- see LeadForm.js's moduleName prop). Whitelisted against the real
// rbac_modules aliases rather than trusted as-is, so a client can't pass an arbitrary alias
// to have this route checked against an unrelated module's export grant. Anything unmapped
// falls back to the parent 'finance_claim' alias (previous behavior).
const FINANCE_CLAIM_EXPORT_ALIASES = new Set([
    'finance_claim_payout',
    'finance_claim_customer_leads',
    'finance_claim_consolidated_leads',
    'finance_claim_instant_claim',
]);
const resolveFinanceClaimExportAlias = (req) => {
    const moduleName = req?.body?.moduleName;
    return FINANCE_CLAIM_EXPORT_ALIASES.has(moduleName) ? moduleName : 'finance_claim';
};

router.post("/createLead", AuthHelper.authorize, aclPermissions.getPermissions, LeadControllerV1.create);
router.post("/createExternalLead", AuthHelper.authorizeDsaCentralized, LeadControllerV1.createExternal);
router.post("/createLeadV2", AuthHelper.authorize, aclPermissions.getPermissions, LeadControllerV1.createV2);
router.post("/deleteLead", AuthHelper.authorize, aclPermissions.getPermissions, LeadControllerV1.deleteLead);
router.post("/getProductOrBankDropdown", AuthHelper.authorize, RBACMiddleware.authorize("finance", 'read'), LeadControllerV1.getProductOrBankDropdown);
router.post("/getProductOrBankDropdownExternal", AuthHelper.authorizeDsa, (req, res, next) => {
    // Existing handler keeps POST body only when req.loggedInUser is set.
    // DSA External has req.dsa, not loggedInUser — map it so body is not replaced with query.
    req.loggedInUser = req.loggedInUser || req.dsa;
    next();
}, LeadControllerV1.getProductOrBankDropdown);
router.get("/get-ns-bank-product", AuthHelper.authorizeDsaCentralized, LeadControllerV1.getProductOrBankDropdown);
router.post("/getAllLead", AuthHelper.authorize, aclPermissions.getPermissions, ExportMiddleware.authorizeExport('customers_leads', (req) => req.body?.is_export === true), LeadControllerV1.leads);
router.post("/getLead", AuthHelper.authorize, aclPermissions.getPermissions, LeadControllerV1.lead);
router.post("/getLeadV2", AuthHelper.authorize, aclPermissions.getPermissions, LeadControllerV1.leadV2);
router.post("/updateLead", AuthHelper.authorize, aclPermissions.getPermissions, LeadControllerV1.update);
router.post("/followLead", AuthHelper.authorize, aclPermissions.getPermissions, LeadControllerV1.followLead);
router.post("/unFollowLead", AuthHelper.authorize, aclPermissions.getPermissions, LeadControllerV1.unFollowLead);
router.post("/getStaredLeadForUser", AuthHelper.authorize, aclPermissions.getPermissions, LeadControllerV1.getStaredLeadForUser);
router.post("/getLeadPayouts", AuthHelper.authorize, aclPermissions.getPermissions, LeadControllerV1.getLeadPayouts);
router.post("/convertLeadDsaPayout", AuthHelper.externalAuth, LeadControllerV1.convertLeadDsaPayout);
router.post("/updateLeadDsaPayout", AuthHelper.authorize, LeadControllerV1.updateLeadDsaPayout);
router.post("/getDsaPayoutHook", AuthHelper.externalAuth, LeadControllerV1.getDsaPayoutHook);
router.post("/downloadLeadList", AuthHelper.authorize, aclPermissions.getPermissions, LeadControllerV1.downloadLeadList);
router.post("/getDsaPayoutUpdatedHook", AuthHelper.externalAuth, LeadControllerV1.getDsaPayoutUpdatedHook);
router.post("/updateLeadPayout", AuthHelper.authorize, aclPermissions.getPermissions, LeadControllerV1.updateLeadPayout);
router.post("/getCallStatus", AuthHelper.authorize, aclPermissions.getPermissions, LeadControllerV1.getCallStatus);
router.post("/updateAssignee", AuthHelper.authorize, aclPermissions.getPermissions, LeadControllerV1.updateAssignee);
router.post("/getLeadReport", AuthHelper.authorize, aclPermissions.getPermissions, LeadControllerV1.getLeadReport);
router.post("/getLeadFormDetailsById", AuthHelper.authorize, RBACMiddleware.authorize('finance', 'read'), LeadControllerV1.getLeadFormDetailsById);
router.post("/getLeadFormRemarks", AuthHelper.authorize, RBACMiddleware.authorize('finance', 'read'), LeadControllerV1.getLeadFormRemarks);
router.post("/updateLeadFormRemark", AuthHelper.authorize, RBACMiddleware.authorize('finance', 'update'), LeadControllerV1.updateLeadFormRemark);
router.post("/getLeadForms", AuthHelper.authorize, RBACMiddleware.authorize('finance', 'read'), ExportMiddleware.authorizeExport(resolveFinanceClaimExportAlias, (req) => req.body?.is_export === true), LeadControllerV1.getLeadForms);
router.post("/getLeadFormsExternal", AuthHelper.authorizeDsaCentralized, LeadControllerV1.getLeadForms);
// router.post("/sendLeadFormToErp", AuthHelper.authorize, RBACMiddleware.authorize('finance_claim_instant_claim', 'read'), LeadControllerV1.sendLeadFormToErp);
router.post(
    "/sendLeadFormToErp",
    AuthHelper?.authorizeDsaCentralized,
    reqValidator(LeadValidationV1?.sendLeadFormToErp, "body"),
    safe(LeadErpController?.sendLeadFormToErpSSE, { isSSE: true })
);
router.post("/verifyPanViaAuthBridgeV2", AuthHelper.authorize, RBACMiddleware.authorize('finance_claim_instant_claim', 'read'), LeadControllerV1.verifyPanViaAuthBridgeV2);
router.post("/getLeadPayoutDetails", AuthHelper.authorize, aclPermissions.getPermissions, LeadControllerV1.getLeadPayoutDetails);
router.post("/getLeadPayoutDetailsExternal", AuthHelper.authorizeDsaCentralized, LeadControllerV1.getLeadPayoutDetails);
router.post("/getNetsuiteBankList", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_netsuite_banks', 'read'), LeadControllerV1.getNetsuiteBankList);
router.post("/exportNetsuiteBankList", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_netsuite_banks', 'read'), ExportMiddleware.authorizeExport('finance_meta_data_netsuite_banks'), LeadControllerV1.exportNetsuiteBankList);
router.post("/getNetsuiteProductList", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_netsuite_products', 'read'), LeadControllerV1.getNetsuiteProductList);
router.post("/setBankFileOnVcf", AuthHelper.authorize, aclPermissions.getPermissions, LeadControllerV1.setBankFileOnVcf);
// Static-key (AUTH_KEY_EXTERNAL) service variant for the not-found bank-file scheduler
// (ruloans-schedulers -> autoNotFoundMainBankFile). Reuses the same controller.
router.post("/setBankFileOnVcfExternal", AuthHelper.externalAuth, LeadControllerV1.setBankFileOnVcf);
router.post("/createOrUpdateNetsuiteProduct", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_netsuite_products', ['create', 'update']), LeadControllerV1.createOrUpdateNetsuiteProduct);
router.post(
    "/getLeadFormReference",
    AuthHelper.authorize,
    RBACMiddleware.authorize('finance', 'read'),
    reqValidator(LeadValidationV1.getLeadFormReference, "body"),
    safe(LeadReferenceController.getLeadFormReference, { envelope: 'v1' })
);
router.post("/downloadLeadPayout", AuthHelper.authorize, aclPermissions.getPermissions, LeadControllerV1.downloadLeadPayout);
router.post("/downloadLeadPayoutExternal", AuthHelper.authorizeDsa, LeadControllerV1.downloadLeadPayoutExternal);
router.post("/getDsaPayoutExternal", AuthHelper.authorizeDsa, LeadControllerV1.getDsaPayoutExternal);
router.post("/getAllBankProductCombination", AuthHelper.authorize, RBACMiddleware.authorize(['finance_meta_data_bank_product_combination', 'products_products'], 'read'), LeadControllerV1.getAllBankProductCombination);
router.post("/getAllBankProductCombinationExternal", AuthHelper.authorizeDsaCentralized, LeadControllerV1.getAllBankProductCombination);
router.post("/editBusinessCategory", AuthHelper.authorize, RBACMiddleware.authorize('finance_claim_consolidated_leads', 'update'), LeadControllerV1.editBusinessCategory);
router.post(
    "/updateLeadFormAutonomousStatus",
    AuthHelper.authorize,
    RBACMiddleware.authorize("finance_claim_payout", "update"),
    reqValidator(LeadValidationV1.updateLeadFormAutonomousStatus, "body"),
    safe(LeadAutonomousFinance.updateLeadFormAutonomousStatus)
);

router.post(
    "/getLeadPayoutDefaults",
    AuthHelper.authorize,
    RBACMiddleware.authorize("finance_claim_payout", "read"),
    reqValidator(LeadValidationV1.getLeadPayoutDefaults, "body"),
    safe(LeadPayoutController.getLeadPayoutDefaults)
);
router.post("/updateTentativeBankFileMatch", AuthHelper.authorize, RBACMiddleware.authorize('finance_finance_tools_find_banks', 'create'), LeadControllerV1.updateTentativeBankFileMatch);
router.post("/reconciliation", LeadControllerV1.saveReconciliation);
router.post("/getReconciliationMail", AuthHelper.authorize, RBACMiddleware.authorize(['finance_claim_banker_confirmations'], 'read'), LeadControllerV1.getReconciliationMail);
router.post("/getReconciliationMailTrail", AuthHelper.authorize, RBACMiddleware.authorize('finance', 'read'), LeadControllerV1.getReconciliationMailTrail);
router.post("/getMailTrailFromMailbox", AuthHelper.authorize, RBACMiddleware.authorize('finance', 'read'), LeadControllerV1.getMailTrailFromMailbox);
router.post("/saveMailTrailFromMailbox", AuthHelper.authorize, RBACMiddleware.authorize('finance', 'update'), LeadControllerV1.saveMailTrailFromMailbox);
router.post("/downloadLatestMailTrailEml", AuthHelper.authorize, RBACMiddleware.authorize('finance', 'read'), LeadControllerV1.downloadLatestMailTrailEml);
router.post("/getLeadMailThreadReplyOptions", AuthHelper.authorize, RBACMiddleware.authorize('finance', 'read'), LeadControllerV1.getLeadMailThreadReplyOptions);
router.post("/replyMailThread", AuthHelper.authorize, RBACMiddleware.authorize('finance', 'update'), LeadControllerV1.replyMailThread);
router.get("/reconciliationEditableFields", AuthHelper.authorize, RBACMiddleware.authorize(['finance_claim_payout', 'finance_claim_banker_confirmations'], 'read'), LeadControllerV1.getReconciliationEditableFields);
router.post("/setLeadOnHold", AuthHelper.authorize, RBACMiddleware.authorize(['finance_claim_banker_confirmations'], 'update'), LeadControllerV1.setLeadOnHold);
router.get("/getDsaLeadBuckets", AuthHelper.authorizeDsaCentralized, RBACMiddleware.authorize('dsa_leads', 'read'), LeadControllerV1.getDsaLeadBuckets);
router.post("/activationDashboardMetrics", AuthHelper.authorizeDsaCentralized, RBACMiddleware.authorize('dsa_leads', 'read'), LeadControllerV1.activationDashboardMetrics);
router.get("/getDsaLeadBucketsExternal", AuthHelper.authorizeDsaCentralized, LeadControllerV1.getDsaLeadBuckets);
router.post("/listDsaLeads", AuthHelper.authorizeDsaCentralized, RBACMiddleware.authorize('dsa_leads', 'read'), LeadControllerV1.listDsaLeads);
router.post("/assignSalesPerson", AuthHelper.authorizeDsaCentralized, RBACMiddleware.authorize('dsa_leads', 'update'), LeadControllerV1.assignLeadSalesPerson);
router.post("/updateDsaLeadStatus", AuthHelper.authorizeDsaCentralized, RBACMiddleware.authorize('dsa_leads', 'update'), LeadControllerV1.updateDsaLeadStatus);
router.post("/updateLeadRemarks", AuthHelper.authorizeDsaCentralized, RBACMiddleware.authorize('dsa_leads', 'update'), LeadControllerV1.updateLeadRemarks);
router.get("/getDsaLeadById", AuthHelper.authorizeDsaCentralized, RBACMiddleware.authorize('dsa_leads', 'read'), LeadControllerV1.getDsaLeadById);
router.post("/getLeadEntriesByLeadId", AuthHelper.authorizeDsaCentralized, RBACMiddleware.authorize('dsa_leads', 'read'), LeadControllerV1.getLeadEntriesByLeadId);
router.post("/getCallLogsByLeadId", AuthHelper.authorizeDsaCentralized, RBACMiddleware.authorize('customers_leads', 'read'), LeadControllerV1.getCallLogsByLeadId);
router.post("/getLeadLogsByLeadId", AuthHelper.authorizeDsaCentralized, RBACMiddleware.authorize('customers_leads', 'read'), LeadControllerV1.getLeadLogsByLeadId);
router.post("/captureDsaLeadCallData", AuthHelper.authorizeDsaCentralized, RBACMiddleware.authorize('customers_leads', 'read'), LeadControllerV1.captureDsaLeadCallData);

module.exports = router;
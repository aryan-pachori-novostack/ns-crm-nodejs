let CustomerControllerV1 = require(_pathconst.ControllersPath.CustomerControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js');
const ExportMiddleware = require('../../../helpers/acl-middleware/export-middleware.js');
const express = require("express");
const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);

const isExportBody = (req) => {
    const is_export = req.body?.is_export ?? req.query?.is_export;
    return is_export === true || is_export === 'true' || is_export === 1;
};


router.post("/createCustomerWithPan", AuthHelper.authorize, RBACMiddleware.authorize('finance_claim_customer_leads', 'create'), CustomerControllerV1.createCustomerWithPan);
router.post("/create-customer-external", AuthHelper.authorizeDsaCentralized, CustomerControllerV1.createCustomerWithPan);

router.post("/getCustomerDetailsLeadForm", AuthHelper.authorize, RBACMiddleware.authorize('finance_claim_customer_leads', 'read'), CustomerControllerV1.getCustomerDetailsLeadForm);
router.get("/get-customers-details", AuthHelper.authorizeDsaCentralized, CustomerControllerV1.getCustomerDetailsLeadForm);

router.post("/createCustomerBasicDetails", AuthHelper.authorize, RBACMiddleware.authorize('finance_claim_customer_leads', 'create'), CustomerControllerV1.createCustomerBasicDetails);
router.post("/create-customer-basic-details", AuthHelper.authorizeDsaCentralized, CustomerControllerV1.createCustomerBasicDetails);

router.post("/createCustomerAddressDetails", AuthHelper.authorize, RBACMiddleware.authorize('finance_claim_customer_leads', 'create'), CustomerControllerV1.createCustomerAddressDetails);
router.post("/create-customer-address-details", AuthHelper.authorizeDsaCentralized, CustomerControllerV1.createCustomerAddressDetails);

router.post("/createCustomerCompanyDetails", AuthHelper.authorize, RBACMiddleware.authorize('finance_claim_customer_leads', 'create'), CustomerControllerV1.createCustomerCompanyDetails);
router.post("/create-customer-company-details", AuthHelper.authorizeDsaCentralized, CustomerControllerV1.createCustomerCompanyDetails);

router.post("/createCustomerLoanDetails", AuthHelper.authorize, RBACMiddleware.authorize('finance_claim_customer_leads', 'create'), CustomerControllerV1.createCustomerLoanDetails);
router.post("/create-customer-loan-details", AuthHelper.authorizeDsaCentralized, CustomerControllerV1.createCustomerLoanDetails);

router.post("/sendConsentOtp", AuthHelper.authorize, RBACMiddleware.authorize('finance_claim_customer_leads', 'read'), CustomerControllerV1.sendConsentOtp);
router.post("/send-consent-otp", AuthHelper.authorizeDsaCentralized, CustomerControllerV1.sendConsentOtp);

router.post("/updateLoanStatus", AuthHelper.authorize, RBACMiddleware.authorize(["finance_claim_payout","finance_claim_consolidated_leads","finance_claim_instant_claim"], 'update'), CustomerControllerV1.updateLoanStatus);
router.post("/updateLoanStatusExternal", AuthHelper.authorizeDsaCentralized, CustomerControllerV1.updateLoanStatus);
router.post("/updateLeadFormExternal", AuthHelper.authorizeDsaCentralized, CustomerControllerV1.updateLeadFormExternal);
router.post("/sendQueryReply", AuthHelper.authorize, RBACMiddleware.authorize('customers_customer_queries', 'read'), CustomerControllerV1.sendQueryReply);
router.post("/getQueryByCustomerId", AuthHelper.authorize, RBACMiddleware.authorize('customers_customers', 'read'), CustomerControllerV1.getQueryByCustomerId);
router.get("/customer-leads/:customer_id", AuthHelper.authorize, RBACMiddleware.authorize('customers_customers', 'read'), ExportMiddleware.authorizeExport('customers_leads', isExportBody), CustomerControllerV1.getCustomerLeadsByCustomerId);
router.post("/sendOtp", AuthHelper.authorizeDsaCentralized, CustomerControllerV1.sendOtpExternal);
router.post("/manage-customer-mobile-otp", AuthHelper.authorizeDsaCentralized, CustomerControllerV1.manageCustomerMobileOtpExternal);
router.post("/getCustomerMobileHistory", AuthHelper.authorizeDsaCentralized, CustomerControllerV1.getCustomerMobileHistoryExternal);
router.post("/sendOtpCrm", AuthHelper.authorize, RBACMiddleware.authorize('applications_personal_loan_all_pl_applications', 'read'), CustomerControllerV1.sendOtp);
router.post("/sendOtpMobileVerification", AuthHelper.authorize, RBACMiddleware.authorize('customers_customers', 'read'), CustomerControllerV1.sendOtpMobileVerification);
router.post("/verifyCustomerOtp", AuthHelper.authorizeDsaCentralized, CustomerControllerV1.verifyCustomerOtp);
router.post("/verifyCustomerOtpCrm", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'read'), CustomerControllerV1.verifyCustomerOtp);
router.post("/verifyCustomerMobile", AuthHelper.authorize, RBACMiddleware.authorize('customers_customers', 'read'), CustomerControllerV1.verifyCustomerMobile);
router.post("/getCustomerByIdExternal",AuthHelper.authorizeDsa, CustomerControllerV1.getCustomerByIdExternal);
router.post("/getCustomerByDsaExternal", AuthHelper.authorizeDsa, CustomerControllerV1.getCustomerByDsaExternal);
router.post("/toggleNotification", AuthHelper.authorizeCustomer, CustomerControllerV1.toggleNotificationCustomer);
router.post("/get-loan-details", AuthHelper.authorize, RBACMiddleware.authorize('customers_leads', 'read'), ExportMiddleware.authorizeExport('customers_leads', isExportBody), CustomerControllerV1.getLoanDetails);
// router.post("/get-loan-details", AuthHelper.authorize, RBACMiddleware.authorize('customers_customers', 'read'), CustomerControllerV1.getLoanDetails);

module.exports = router;
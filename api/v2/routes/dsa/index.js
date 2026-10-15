let DSAControllerV2 = require(_pathconst.ControllersPath.DSAControllerV2);
const VendorPayoutFinance = require(_pathconst.ControllersPath.VendorPayoutFinance);
const express = require("express");
const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);
let DSAValidationV2 = require(_pathconst.ReqModelsPath.DSAValidationV2);
let AutonomousControllerV2 = require(_pathconst.ControllersPath.AutonomousControllerV2);
const MongoDBControllerV1 = require(_pathconst.ControllersPath.MongoDBControllerV1);
const RBACMiddleware = require("../../../helpers/acl-middleware/rbac-middleware.js");
const reqValidator = require("../../../helpers/request-validator");
const safe = require("../../../helpers/safe");


// #post
router.post("/add-basic-details", AuthHelper?.authorizeDsaCentralized, RBACMiddleware.authorize('dsa_channel_partners', 'create', true), DSAControllerV2?.addDsaBasicDetails);
router.post(
    "/send-dsa-email-verification-otp",
    AuthHelper?.authorizeDsaCentralized,
    RBACMiddleware.authorize("dsa_channel_partners", "create", true),
    DSAControllerV2?.sendDsaEmailAddressVerificationOtp
);
router.post(
    "/verify-dsa-email-verification-otp",
    AuthHelper?.authorizeDsaCentralized,
    RBACMiddleware.authorize("dsa_channel_partners", "create", true),
    DSAControllerV2?.verifyDsaEmailAddressVerificationOtp
);
// B2B external — re-verify email that is already verified (OTP only; not admin link flow)
router.post(
    "/send-dsa-email-reverification-otp-external",
    AuthHelper?.authorizeDsaCentralized,
    DSAControllerV2?.sendDsaEmailReverificationOtpExternal
);
router.post(
    "/verify-dsa-email-reverification-otp-external",
    AuthHelper?.authorizeDsaCentralized,
    DSAControllerV2?.verifyDsaEmailReverificationOtpExternal
);
router.post("/add-address", AuthHelper?.authorizeDsaCentralized, DSAControllerV2.addAddressDetails);
router.post("/add-Kyc", AuthHelper?.authorizeDsaCentralized, RBACMiddleware.authorize('dsa_channel_partners', 'create', true), DSAControllerV2.addDsaKyc);
router.post("/add-company-details", AuthHelper?.authorizeDsaCentralized, DSAControllerV2.addCompanyDetails);
router.post("/upload-document", AuthHelper?.authorizeDsaCentralized, RBACMiddleware.authorize('dsa_channel_partners', 'create', true), DSAControllerV2.uploadDocumentsCentralized);
router.post("/add-dsa-phone", AuthHelper?.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'create', true), DSAControllerV2?.addDsaPhone);
router.post("/update-global-payout-percentage", AuthHelper?.authorizeDsaCentralized, DSAControllerV2?.updateGlobalPayoutPercentage);
router.post("/update-global-payout-percentage-external", AuthHelper?.authorizeDsaCentralized, DSAControllerV2?.updateGlobalPayoutPercentage);
router.post("/add-bank-details", AuthHelper?.authorizeDsaCentralized, RBACMiddleware.authorize('dsa_channel_partners', 'read', true), DSAControllerV2?.AddBankDetailDsa);
router.post("/add-bank-details-external", AuthHelper?.authorizeDsaCentralized, DSAControllerV2?.AddBankDetailDsa);
router.post(
    "/update-bank-account-type",
    AuthHelper?.authorizeDsaCentralized,
    RBACMiddleware.authorize('dsa_channel_partners', 'read', true),
    reqValidator(DSAValidationV2?.updateBankAccountType, "body"),
    DSAControllerV2?.updateBankAccountType
);
router.post(
    "/update-bank-account-type-external",
    AuthHelper?.authorizeDsaCentralized,
    reqValidator(DSAValidationV2?.updateBankAccountType, "body"),
    DSAControllerV2?.updateBankAccountType
);
router.post(
    "/get-pending-bank-verification-list",
    AuthHelper?.authorizeDsaCentralized,
    RBACMiddleware.authorize('dsa_channel_partners', 'read', true),
    reqValidator(DSAValidationV2?.getPendingBankVerificationList, "body"),
    DSAControllerV2?.getPendingBankVerificationList
);
router.post(
    "/get-pending-bank-verification-list-external",
    AuthHelper?.authorize,
    reqValidator(DSAValidationV2?.getPendingBankVerificationList, "body"),
    DSAControllerV2?.getPendingBankVerificationList
);
router.post(
    "/update-bank-account-status",
    AuthHelper?.authorizeDsaCentralized,
    RBACMiddleware.authorize('dsa_channel_partners', 'update', true),
    reqValidator(DSAValidationV2?.updateBankAccountStatus, "body"),
    DSAControllerV2?.updateBankAccountStatus
);
router.post(
    "/update-bank-account-status-external",
    AuthHelper?.authorize,
    reqValidator(DSAValidationV2?.updateBankAccountStatus, "body"),
    DSAControllerV2?.updateBankAccountStatus
);
router.post("/instantClaimApplications", AuthHelper?.authorizeDsa, DSAControllerV2?.instantClaimApplications);
router.post("/instantClaimAllEligibleApplication", AuthHelper?.authorizeDsa, DSAControllerV2?.instantClaimAllEligibleApplication);
router.post("/setLeadPayoutRateOrRatio", AuthHelper?.authorizeDsaCentralized, DSAControllerV2?.setLeadPayoutRateOrRatio);
router.post(
    "/updateDsaMasterPayout",
    AuthHelper?.authorizeDsaCentralized,
    reqValidator(DSAValidationV2?.updateDsaMasterPayout, "body"),
    safe(VendorPayoutFinance?.updateDsaMasterPayout)
);
router.post("/sendSetPayoutReminderEmail", AuthHelper.authorizeDsa, DSAControllerV2.sendSetPayoutReminderEmail);
router.post("/getDsaPayoutList", AuthHelper?.authorizeDsaCentralized, DSAControllerV2?.getDsaPayoutList);
router.post("/getLedgerDetails", AuthHelper?.authorize, DSAControllerV2?.getLedgerDetails);
router.post("/getLedger", AuthHelper?.authorizeDsaCentralized, DSAControllerV2?.getLedger);
router.post("/saveDsaPayoutDeal", AuthHelper?.authorizeDsaCentralized, DSAControllerV2?.saveDsaPayoutDeal);
router.post(
    "/save-dsa-autonomous-payment-settings",
    AuthHelper?.authorizeDsaCentralized,
    reqValidator(DSAValidationV2?.saveDsaAutonomousPaymentSettings, "body"),
    safe(AutonomousControllerV2?.saveDsaAutonomousPaymentSettings)
);
router.post(
    "/request-autonomous-for-vendor",
    AuthHelper?.authorizeDsaCentralized,
    reqValidator(DSAValidationV2?.requestAutonomousForVendor, "body"),
    safe(AutonomousControllerV2?.requestAutonomousForVendor)
);
router.post(
    "/validate-autonomous-request-settings",
    AuthHelper?.authorizeDsaCentralized,
    reqValidator(DSAValidationV2?.saveDsaAutonomousPaymentSettings, "body"),
    safe(AutonomousControllerV2?.validateAutonomousRequestSettings)
);
router.post(
    "/raise-autonomous-request-for-vendor",
    AuthHelper?.authorizeDsaCentralized,
    reqValidator(DSAValidationV2?.raiseAutonomousRequestForVendor, "body"),
    safe(AutonomousControllerV2?.raiseAutonomousRequestForVendor)
);
router.post("/change-company-owner", AuthHelper?.authorizeDsaCentralized, RBACMiddleware.authorize('dsa_channel_partners', 'delete', true), DSAControllerV2?.changeCompanyOwner);
router.post(
    "/channel-partners/:dsa_id/verify-pan-authbridge",
    AuthHelper?.authorizeDsaCentralized,
    RBACMiddleware.authorize('dsa_channel_partners', 'update', true),
    DSAControllerV2?.verifyPanViaAuthBridgeSingleUser
);
router.post(
    "/bulk-authbridge-verification/stream",
    AuthHelper?.authorize,
    RBACMiddleware.authorize('finance_finance_tools_bulk_authbridge_verification', 'read', true),
    DSAControllerV2?.bulkAuthbridgeVerificationStream
);

// #patch
router.patch("/switch-business-mode", AuthHelper?.authorizeDsaCentralized, RBACMiddleware.authorize('dsa_channel_partners', 'read', true), DSAControllerV2.switchBusinessMode);
router.post("/switch-business-mode", AuthHelper?.authorizeDsaCentralized, RBACMiddleware.authorize('dsa_channel_partners', 'read', true), DSAControllerV2.switchBusinessMode);

// #get
router.get("/get-basic-details", AuthHelper?.authorizeDsaCentralized, DSAControllerV2?.getDsaBasicDetails);
router.get("/get-company-details", AuthHelper?.authorizeDsaCentralized, DSAControllerV2?.getCompanyDetails);
router.get("/get-address", AuthHelper?.authorizeDsaCentralized, DSAControllerV2?.getAddressDetails);
router.get("/get-company-address", AuthHelper?.authorizeDsaCentralized, DSAControllerV2?.getCompanyAddressDetails);
router.get("/get-dsa-steps", AuthHelper?.authorizeDsaCentralized, DSAControllerV2?.getDsaSteps);
router.get("/get-owned-company", AuthHelper?.authorizeDsaCentralized, DSAControllerV2?.getOwnedCompanyByPan);
router.get("/get-overall-report", AuthHelper?.authorizeDsaCentralized, MongoDBControllerV1?.getDsaOverallReport);
router.get("/get-dsa-payout-details", AuthHelper?.authorizeDsaCentralized, DSAControllerV2?.getDsaPayoutDetails);
router.get(
    "/get-dsa-same-day-billing",
    AuthHelper?.authorizeDsaCentralized,
    reqValidator(DSAValidationV2?.getDsaSameDayBilling, "query"),
    safe(DSAControllerV2?.getDsaSameDayBilling)
);
router.get("/get-dsa-autonomous-settings", AuthHelper?.authorizeDsaCentralized, DSAControllerV2?.getDsaAutonomousSettings);
router.get("/getBankProductMappedPayout", AuthHelper?.authorizeDsaCentralized, DSAControllerV2?.getBankProductMappedPayout);
router.get("/get-bank-details", AuthHelper?.authorizeDsaCentralized, DSAControllerV2?.getBankDetailDsa);
router.get("/get-bank-details-external", AuthHelper?.authorizeDsaCentralized, DSAControllerV2?.getBankDetailDsa);
router.get("/getDsaEligiblePayoutDetails", AuthHelper?.authorizeDsa, DSAControllerV2?.getDsaEligiblePayoutDetails)
router.get("/getDsaDealDescription", AuthHelper?.authorizeDsaCentralized, DSAControllerV2?.getDsaDealDescription)

router.post("/disable-dsa-same-day-billing",
    AuthHelper?.authorizeDsaCentralized,
    reqValidator(DSAValidationV2?.disableDsaSameDayBilling, "body"),
    safe(AutonomousControllerV2?.disableDsaSameDayBilling)
);

router.post("/sync-llm-utm-sources", AuthHelper?.authorizeDsaCentralized, DSAControllerV2?.syncLlmUtmSources);

router.post(
    "/save-mou-agreement",
    AuthHelper?.authorizeDsaCentralized,
    reqValidator(DSAValidationV2?.saveMouAgreement, "body"),
    safe(DSAControllerV2?.saveMouAgreement)
);

module.exports = router;
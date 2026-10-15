let UserControllerV1 = require(_pathconst.ControllersPath.UserControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js')
const ExportMiddleware = require('../../../helpers/acl-middleware/export-middleware.js');

const express = require("express");
const { sendNotificationByEmail } = require('../../../services/socket-services.js');


const router = express.Router();
var AuthHelper = require(_pathconst.FilesPath.AuthHelper);

const isExportBody = (req) => {
    const { is_export } = req.body || {};
    return is_export === true || is_export === 'true' || is_export === 1;
};
var UserValidationV1 = require(_pathconst.ReqModelsPath.UserValidationV1);
var NotificationControllerV1 = require(_pathconst.ControllersPath.NotificationControllerV1);

router.post("/signUpCEO", UserControllerV1.signUpCEO);
router.get("/loginCEO", UserControllerV1.loginCEOGet);
router.post("/loginCEO", UserControllerV1.loginCEO);
router.post("/loginCEO/verify-otp", UserControllerV1.loginCEOVerifyOtp);
router.post("/logout", AuthHelper.authorizeWithoutRedis, UserControllerV1.logout);
router.post("/sendOTPToEmail", UserControllerV1.sendOTPToEmail);
router.post("/changePassword", AuthHelper.authorizeWithoutRedis, UserControllerV1.changePassword);
router.post("/changePasswordNew", AuthHelper.authorize, UserControllerV1.changePasswordNew);
router.post("/resetPasswordLink", UserControllerV1.resetPasswordLink);
router.post("/resetPassword", UserControllerV1.resetPassword);
router.post("/getAllUsers", AuthHelper.authorize, RBACMiddleware.authorize('users_crm_users', 'read'), ExportMiddleware.authorizeExport('users_crm_users', isExportBody), UserControllerV1.getAllUsers);
router.post("/getTelecallerDailyCapacity", AuthHelper.authorize, RBACMiddleware.authorize('users_crm_users', 'read'), UserControllerV1.getTelecallerDailyCapacity);
router.post("/getTelecallerDailyCapacityHistory", AuthHelper.authorize, RBACMiddleware.authorize('users_crm_users', 'read'), UserControllerV1.getTelecallerDailyCapacityHistory);
router.post("/updateTelecallerDailyCapacity", AuthHelper.authorize, RBACMiddleware.authorize('users_crm_users', 'update'), UserControllerV1.updateTelecallerDailyCapacity);
router.post("/getAllRmUsers", AuthHelper.authorize, RBACMiddleware.authorize('users_rm_users', 'read'), UserControllerV1.getAllRmUsers);
// CRM API to fetch RM details by email (sp_email in payload).
router.post("/getRmUserByEmail", AuthHelper.authorize, RBACMiddleware.authorize('finance_claim_payout', 'read'), UserControllerV1.getRmUserByEmail);
// External API to fetch RM details by email (sp_email via query params).
router.get("/getRmUserByEmailExternal", AuthHelper.authorizeDsaCentralized, UserControllerV1.getRmUserByEmail);
router.get("/get-rm-details-external", AuthHelper.authorizeDsaCentralized, UserControllerV1.getRmUserByPhone);
router.post("/deleteRmUser", AuthHelper.authorize, RBACMiddleware.authorize('users_rm_users', 'delete'), UserControllerV1.deleteRmUser);
router.post("/createRmUser", AuthHelper.authorize, RBACMiddleware.authorize('users_rm_users', 'create'), UserControllerV1.createRmUser);
router.post("/getProductDropdown", AuthHelper.authorize, aclPermissions.getPermissions, UserControllerV1.getProductDropdown);
router.post("/addUser", AuthHelper.authorize, RBACMiddleware.authorize('users_crm_users', 'create'), UserControllerV1.addUser);
router.post("/validateOtp", AuthHelper.authorize, aclPermissions.getPermissions, UserControllerV1.validateOtp);//validateOtp
router.post("/resendOtp", AuthHelper.authorize, aclPermissions.getPermissions, UserControllerV1.resendOtp);
router.post("/getRoles", AuthHelper.authorize, RBACMiddleware.authorize(["dsa_channel_partners","users_crm_users"], 'read'), UserControllerV1.getRoles);
router.post("/deleteUser", AuthHelper.authorize, RBACMiddleware.authorize('users_crm_users', 'delete'), UserControllerV1.deleteUser);
router.post("/updateUser", AuthHelper.authorize, RBACMiddleware.authorize('users_crm_users', 'update'), UserControllerV1.updateUser);
router.post("/getParentRole", AuthHelper.authorize, RBACMiddleware.authorize('users_crm_users', 'read'), UserControllerV1.getParentRole);
router.post("/getChildRoles", AuthHelper.authorize, aclPermissions.getPermissions, UserControllerV1.getChildRoles);
router.post("/getUserByRole", AuthHelper.authorize, aclPermissions.getPermissions, UserControllerV1.getUserByRole);
router.post("/getUserByBusinessHead", AuthHelper.authorize, aclPermissions.getPermissions, UserControllerV1.getUserByBusinessHead);
router.post("/getUserById", AuthHelper.authorize, aclPermissions.getPermissions, UserControllerV1.getUserById);
router.post("/getUserTrustedDevices", AuthHelper.authorize, UserControllerV1.getUserTrustedDevices);
router.post("/revokeTrustedDevice", AuthHelper.authorize, UserControllerV1.revokeTrustedDeviceHandler);
router.post("/resetPasswordLinkUrl", UserControllerV1.resetPasswordLinkUrl);
router.post("/verifyResetPasswordLink", UserControllerV1.verifyResetPasswordLink);
router.post("/changePasswordByAdmin", AuthHelper.authorize, RBACMiddleware.authorize('users_crm_users', 'read'), UserControllerV1.changePasswordByAdmin);
router.post("/updateStatus", AuthHelper.authorize, RBACMiddleware.authorize('users_crm_users', 'update'), UserControllerV1.updateStatus);
router.post("/reactivateUser", AuthHelper.authorize, RBACMiddleware.authorize('users_crm_users', 'update'), UserControllerV1.reactivateUser);
router.post("/getUserDsaProfile", AuthHelper.authorize, aclPermissions.getPermissions, UserControllerV1.getUserDsaProfile);
router.post("/updatePayoutStatus", AuthHelper.authorize, RBACMiddleware.authorize('users_crm_users', 'update'), UserControllerV1.updatePayoutStatus);
router.post("/updateBankStatus", AuthHelper.authorize, RBACMiddleware.authorize('users_crm_users', 'update'), UserControllerV1.updateBankStatus);
router.post("/updateBackendAccessStatus", AuthHelper.authorize, RBACMiddleware.authorize('users_crm_users', 'update'), UserControllerV1.updateBackendAccessStatus);
router.post("/updateBankFilePayoutAccessStatus", AuthHelper.authorize, RBACMiddleware.authorize('users_crm_users', 'update'), UserControllerV1.updateBankFilePayoutAccessStatus);
router.post("/updateBankFileAccessStatus", AuthHelper.authorize, RBACMiddleware.authorize('users_crm_users', 'update'), UserControllerV1.updateBankFileAccessStatus);
router.post("/addCallerId", AuthHelper.authorize, RBACMiddleware.authorize('tools_callers', 'create'), UserControllerV1.addCallerId);
router.post("/updateCallerId", AuthHelper.authorize, RBACMiddleware.authorize('tools_callers', 'update'), UserControllerV1.updateCallerId);
router.post("/getCallerId", AuthHelper.authorize, aclPermissions.getPermissions, UserControllerV1.getCallerId);
router.post("/getAllCallerId", AuthHelper.authorize, RBACMiddleware.authorize('tools_callers', 'read'), UserControllerV1.getAllCallerId);
router.post("/clickToCall", AuthHelper.authorize, aclPermissions.getPermissions, UserControllerV1.clickToCall);
router.post("/despositionWebhook", UserControllerV1.despositionWebhook);
router.post("/getUserActivityLogs", AuthHelper.authorize, RBACMiddleware.authorize('activity_logs_export', 'read'), UserControllerV1.getUserActivityLogs);
router.post("/getUserPushNotificationLogs", AuthHelper.authorize, UserControllerV1.getUserPushNotificationLogs);
router.post("/getUserPushNotificationLogsReaded", AuthHelper.authorize, aclPermissions.getPermissions, UserControllerV1.getUserPushNotificationLogsReaded);
router.post("/markasReadNotification", AuthHelper.authorize, aclPermissions.getPermissions, UserControllerV1.markasReadNotification);
router.post("/markAllasReadNotification", AuthHelper.authorize, aclPermissions.getPermissions, UserControllerV1.markAllasReadNotification);

//blacklisted users
router.post("/getAllBlacklistedUsers", AuthHelper.authorize, RBACMiddleware.authorize('settings_blacklisted_users', 'read'), UserControllerV1.getAllBlacklistedUsers);
router.post("/insertBlacklistedUser", AuthHelper.authorize, RBACMiddleware.authorize('settings_blacklisted_users', 'create'), UserControllerV1.insertBlacklistedUser);
router.post("/deleteBlacklistedUser", AuthHelper.authorize, RBACMiddleware.authorize('settings_blacklisted_users', 'delete'), UserControllerV1.deleteBlacklistedUser);
router.post("/bulkApproveRMUser", AuthHelper.authorize, UserControllerV1.bulkApproveRMUser);
router.post("/bulkUploadRmUsers", AuthHelper.authorize, RBACMiddleware.authorize('users_rm_users', 'create'), UserControllerV1.bulkUploadRmUsers);
router.post("/getSampleTemplateData", AuthHelper.authorize, UserControllerV1.getSampleTemplateData);
router.post("/send-notification-crm", AuthHelper.authorizeDsaCentralized, UserControllerV1.sendSocketNotificationCRM);

router.post("/createNotificationTemplate", AuthHelper.authorize, aclPermissions.getPermissions, NotificationControllerV1.createTemplate);
router.post("/getNotificationTemplates", AuthHelper.authorize, RBACMiddleware.authorize('marketing_notifications', 'read'), NotificationControllerV1.getTemplatesByType);
router.post("/getNotificationTemplateById", AuthHelper.authorize, RBACMiddleware.authorize('marketing_notifications', 'read'), NotificationControllerV1.getTemplateById)
router.post("/deleteNotificationTemplate", AuthHelper.authorize, aclPermissions.getPermissions, NotificationControllerV1.deleteTemplate)
router.post("/updateNotificationTemplate", AuthHelper.authorize, aclPermissions.getPermissions, NotificationControllerV1.updateTemplate)
router.post("/get-sms-template", AuthHelper.authorize, RBACMiddleware.authorize("marketing_send_sms", "read"), NotificationControllerV1.getSMSNotificationTemplate)
router.get("/get-user-dynamic-routes", AuthHelper.authorizeDsaCentralized, UserControllerV1.getUserDynamicRoutes);

// For Getting RM users Details By Email
//router.post("/loginCEO", AuthHelper.authorize, aclPermissions.getPermissions, UserControllerV1.get);

module.exports = router;
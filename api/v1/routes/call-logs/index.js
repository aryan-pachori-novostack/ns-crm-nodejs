let CallLogControllerV1 = require(_pathconst.ControllersPath.CallLogControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js')
const ExportMiddleware = require('../../../helpers/acl-middleware/export-middleware.js');

const express = require("express");

const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);

const isExportBody = (req) => {
    const { is_export } = req.body || {};
    return is_export === true || is_export === 'true' || is_export === 1;
};

router.post("/createCallLogs", AuthHelper.authorize, RBACMiddleware.authorize(["dsa_channel_partners","customers_customers"], 'create'), CallLogControllerV1.createCallLogs);
router.post("/getAllCallLogs", AuthHelper.authorize, RBACMiddleware.authorize(["dsa_channel_partners","customers_customers"], 'read'), CallLogControllerV1.getAllCallLogs);
router.post("/getCallReport", AuthHelper.authorize, RBACMiddleware.authorize('dsa_reports_dsa_call_report', 'read'), ExportMiddleware.authorizeExport('dsa_reports_dsa_call_report', isExportBody), CallLogControllerV1.getCallReport);
router.post("/getCallReportWithComments", AuthHelper.authorize, RBACMiddleware.authorize('dsa_reports_dsa_call_report', 'read'), ExportMiddleware.authorizeExport('dsa_reports_dsa_call_report'), CallLogControllerV1.getCallReportWithComments);
router.post("/getPendingCallCount", AuthHelper.authorize, RBACMiddleware.authorize('dsa_reports_dsa_call_report', 'read'), CallLogControllerV1.getPendingCallCount);
router.post("/getDsaStatusChangedByUser", AuthHelper.authorize, RBACMiddleware.authorize('dsa_reports_dsa_call_report', 'read'), CallLogControllerV1.getDsaStatusChangedByUser);
router.post("/clickToCallSlashRtc", AuthHelper.authorize, RBACMiddleware.authorize('customers_customers', 'read'), CallLogControllerV1.clickToCallSlashRtc);
router.post("/slashRTCDispositionApi", AuthHelper.externalAuth, CallLogControllerV1.slashRTCDispositionApi);
router.post("/getCallLogs", AuthHelper.authorize, RBACMiddleware.authorize('dsa_call_logs', 'read'), ExportMiddleware.authorizeExport('dsa_call_logs', isExportBody), CallLogControllerV1.getCallLogs);

module.exports = router; 
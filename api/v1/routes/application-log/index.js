let ApplicationLogControllerV1 = require(_pathconst.ControllersPath.ApplicationLogControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');

const express = require("express");
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js');

const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);
router.post("/getApplicationLogs",AuthHelper.authorize, RBACMiddleware.authorize(["applications","dsa_channel_partners","customers_customers", "finance", "products"], 'read'), ApplicationLogControllerV1.getLog);
router.post("/getActivityLogs",AuthHelper.authorize,RBACMiddleware.authorize(["dsa_channel_partners","customers_customers","finance_invoices_office_expenses"], 'read'), ApplicationLogControllerV1.getActivityLogs);
router.post("/getVendorAutonomousApprovalAuditLogs", AuthHelper.authorize, RBACMiddleware.authorize(["finance", "dsa_channel_partners"], 'read'), ApplicationLogControllerV1.getVendorAutonomousApprovalAuditLogs);
module.exports = router;
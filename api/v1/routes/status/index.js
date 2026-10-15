let StatusControllerV1 = require(_pathconst.ControllersPath.StatusControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js');

const express = require("express");

const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);
router.post("/getStatus", AuthHelper.authorize, RBACMiddleware.authorize('users_crm_users', 'read'), StatusControllerV1.getStatus);
router.post("/getStatusById", AuthHelper.authorize, aclPermissions.getPermissions, StatusControllerV1.getStatusById);
router.post("/addGlobalStatus", StatusControllerV1.addGlobalStatus);

module.exports = router;
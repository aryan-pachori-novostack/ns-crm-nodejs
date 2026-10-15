let PicklistKeysControllerV1 = require(_pathconst.ControllersPath.PicklistKeysControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js');

const express = require("express");

const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);

router.post("/createPicklistKeys",AuthHelper.authorize, RBACMiddleware.authorize('settings_picklist_dependencies', 'create'), PicklistKeysControllerV1.createPicklistKeys);
router.post("/getPicklistKeys", AuthHelper.authorize, RBACMiddleware.authorize('settings_picklist_dependencies', 'read'), PicklistKeysControllerV1.getPicklistKeys);
router.post("/deletePicklistKeys", AuthHelper.authorize, RBACMiddleware.authorize('settings_picklist_dependencies', 'delete'), PicklistKeysControllerV1.deleteKey);

module.exports = router;
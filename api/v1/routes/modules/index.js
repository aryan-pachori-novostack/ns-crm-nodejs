let ModulesControllerV1 = require(_pathconst.ControllersPath.ModulesControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');

const express = require("express");
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js');

const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);

router.post("/createModules",AuthHelper.authorize, aclPermissions.getPermissions, ModulesControllerV1.createModules);
router.post("/getModules",AuthHelper.authorize, RBACMiddleware.authorize('settings_picklist_dependencies', 'read'), ModulesControllerV1.getModules);
router.post("/getFullModules", ModulesControllerV1.getFullModules);

module.exports = router;
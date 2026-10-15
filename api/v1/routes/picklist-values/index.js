let PicklistValuesControllerV1 = require(_pathconst.ControllersPath.PicklistValuesControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js');

const express = require("express");

const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);

router.post("/createPicklistValues", AuthHelper.authorize, RBACMiddleware.authorize('settings_picklist_dependencies', 'create'), PicklistValuesControllerV1.createPicklistValues);
router.post("/getPicklistValues", AuthHelper.authorize, RBACMiddleware.authorize('settings_picklist_dependencies', 'read'), PicklistValuesControllerV1.getPicklistValues);
router.post("/getPicklistFromValues", AuthHelper.authorize, aclPermissions.getPermissions, PicklistValuesControllerV1.getPicklistFromValues);
router.post("/deletePicklistValues", AuthHelper.authorize, RBACMiddleware.authorize('settings_picklist_dependencies', 'delete'), PicklistValuesControllerV1.deleteValue);
router.post("/getChildValues", AuthHelper.authorize, RBACMiddleware.authorize(['dsa_channel_partners', 'settings_picklist_dependencies', 'activity_logs', 'applications', 'content'], 'read'), PicklistValuesControllerV1.getChildValues);
router.post("/getPicklistValuesExternal",  AuthHelper.externalPassportAuth, PicklistValuesControllerV1.getPicklistValuesExternal);
router.post("/getPicklistValuesExternalAuth",  AuthHelper.authorizeDsaCentralized, PicklistValuesControllerV1.getPicklistValuesExternal);

module.exports = router;
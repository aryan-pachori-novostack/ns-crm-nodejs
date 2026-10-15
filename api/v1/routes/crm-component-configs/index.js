let CrmComponentConfigControllerV1 = require(_pathconst.ControllersPath.CrmComponentConfigControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js')

const express = require("express");

const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);
router.post("/createCrmComponentConfigs", AuthHelper.authorize, RBACMiddleware.authorize('content_content_manager', 'create'), CrmComponentConfigControllerV1.createCrmComponentConfigs);
router.post("/getAllCrmComponentConfigs", AuthHelper.authorize, RBACMiddleware.authorize('content_content_manager', 'read'), CrmComponentConfigControllerV1.getAllCrmComponentConfigs);
router.post("/deleteCrmComponentConfigs", AuthHelper.authorize, RBACMiddleware.authorize('content_content_manager', 'delete'), CrmComponentConfigControllerV1.deleteCrmComponentConfigs);
router.post("/editCrmComponentConfigs", AuthHelper.authorize, RBACMiddleware.authorize('content_content_manager', 'update'), CrmComponentConfigControllerV1.editCrmComponentConfigs);
router.post("/createCrmComponentMeta", AuthHelper.authorize, aclPermissions.getPermissions, CrmComponentConfigControllerV1.createCrmComponentMeta);
router.post("/editCrmComponentMeta", AuthHelper.authorize, aclPermissions.getPermissions, CrmComponentConfigControllerV1.createCrmComponentMeta);
router.post("/getAllGlobalTagsByType", AuthHelper.authorize, CrmComponentConfigControllerV1.getAllGlobalTagsByType);
router.post("/getAllGlobalTagsByTypeExternal", AuthHelper.authorizeDsaCentralized, CrmComponentConfigControllerV1.getAllGlobalTagsByType);
router.post("/getCrmComponentMetaForConfig", AuthHelper.authorize, aclPermissions.getPermissions, CrmComponentConfigControllerV1.getCrmComponentMetaForConfig);
router.post("/getConfigAndMeta", AuthHelper.externalAuth, CrmComponentConfigControllerV1.getMetaExternal);
router.post("/getConfigAndMetaUnauth", AuthHelper.externalAuth, CrmComponentConfigControllerV1.getMetaExternal);
module.exports = router;
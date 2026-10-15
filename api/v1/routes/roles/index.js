const RolesController = require('../../controllers/roles');
const AuthHelper = require(_pathconst.FilesPath.AuthHelper);
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js');

const router = require('express').Router();

router.post("/getAllRoles", AuthHelper.authorize, RBACMiddleware.authorize('settings_role_management', 'read'), RolesController.getRoles);
router.post("/add", AuthHelper.authorize, RBACMiddleware.authorize('settings_role_management', 'create'), RolesController.addRole);
router.get("/modules/:roleId", AuthHelper.authorize, RBACMiddleware.authorize('settings_role_management', 'update'), RolesController.getRoleModules);
router.put("/modules/:roleId", AuthHelper.authorize, RBACMiddleware.authorize('settings_role_management', 'update'), RolesController.updateRoleModules);
router.delete("/delete/:roleId", AuthHelper.authorize, RBACMiddleware.authorize('settings_role_management', 'delete'), RolesController.deleteRole);
router.get("/logs/:roleId", AuthHelper.authorize, RBACMiddleware.authorize('settings_role_management', 'read'), RolesController.getRoleModuleLogs);
router.get("/rules/:roleId", AuthHelper.authorize, RBACMiddleware.authorize('settings_role_management', 'read'), RolesController.getRbacRules);
router.put("/rules/:roleId", AuthHelper.authorize, RBACMiddleware.authorize('settings_role_management', 'update'), RolesController.updateRbacRules);

module.exports = router;
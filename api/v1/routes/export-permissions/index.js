const ExportPermissionsController = require('../../controllers/export-permissions');
const AuthHelper = require(_pathconst.FilesPath.AuthHelper);
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js');
const ExportMiddleware = require('../../../helpers/acl-middleware/export-middleware.js');

const router = require('express').Router();

// User-level export permissions -- surfaced in the CRM user's profile.
// Viewing follows the same module permission as the profile's Advanced tab;
// granting/editing is CEO-only (no role-level export permission any more).
router.get(
    "/user/:userId",
    AuthHelper.authorize,
    RBACMiddleware.authorize('users_crm_users', 'read'),
    ExportPermissionsController.getUserExportPermissions
);
router.put(
    "/user/:userId",
    AuthHelper.authorize,
    ExportMiddleware.requireCeo,
    ExportPermissionsController.updateUserExportPermissions
);

// Self-service check: no admin RBAC gate -- any authenticated user can ask this
// about themselves, used by FE pages that need to hide/show their own Export
// button (esp. ones where export never calls a distinct backend endpoint, so
// there's no request for the export middleware to intercept).
router.get(
    "/check/:moduleAlias",
    AuthHelper.authorize,
    ExportPermissionsController.checkMyExportPermission
);

// Flat module list, used by the user-profile panel's "add module" picker.
router.get(
    "/modules",
    AuthHelper.authorize,
    RBACMiddleware.authorize('users_crm_users', 'read'),
    ExportPermissionsController.listExportableModules
);

module.exports = router;

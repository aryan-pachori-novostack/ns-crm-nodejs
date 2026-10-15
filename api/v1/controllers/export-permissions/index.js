const ExportPermissionService = require('../../../services/export-permission-service');
const ResHelper = require('../../../helpers/response/response');

/**
 * Self-service check: "can the current logged-in user export this module right now".
 * No admin RBAC gate -- any authenticated user can ask this about themselves, since
 * FE pages need it to decide whether to even show the Export button (e.g. find-payouts,
 * where export re-uses the same list-fetch endpoint client-side with no distinct
 * backend export call to intercept -- the FE gate is the only enforcement point there).
 */
const checkMyExportPermission = async (req, res) => {
    try {
        const { moduleAlias } = req.params;
        if (!moduleAlias) return ResHelper.apiResponse(res, false, "moduleAlias is required", 400, null, "");

        if (req.loggedInUser?.isSuperAdmin) {
            return ResHelper.apiResponse(res, true, "Success", 200, { allowed: true }, "");
        }

        const userId = req.loggedInUser?.id;
        if (!userId) return ResHelper.apiResponse(res, false, "Unable to identify user", 403, { allowed: false }, "");

        const result = await ExportPermissionService.checkExportPermission({
            userId, moduleAlias, requestIp: req.ip, dryRun: true
        });

        return ResHelper.apiResponse(res, true, "Success", 200, { allowed: result.allowed }, "");
    } catch (error) {
        console.error('Error in checkMyExportPermission:', error);
        return ResHelper.apiResponse(res, false, "Internal server error", 500, { allowed: false }, error.message);
    }
};

const getUserExportPermissions = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) return ResHelper.apiResponse(res, false, "User ID is required", 400, null, "");

        const result = await ExportPermissionService.getModulesWithExportPermissions('user', userId);
        return ResHelper.apiResponse(res, result.success, result.message, result.statusCode, result.data || null, result.error || "");
    } catch (error) {
        console.error('Error in getUserExportPermissions:', error);
        return ResHelper.apiResponse(res, false, "Internal server error", 500, null, error.message);
    }
};

const updateUserExportPermissions = async (req, res) => {
    try {
        const { userId } = req.params;
        const { modules } = req.body;
        const updatedBy = req.loggedInUser?.id;

        if (!userId) return ResHelper.apiResponse(res, false, "User ID is required", 400, null, "");
        if (!modules || !Array.isArray(modules)) return ResHelper.apiResponse(res, false, "Modules array is required", 400, null, "");

        // modules: [{ module_id, enabled, ip_restricted, ip_networks? }] -- ip_networks
        // is required when ip_restricted is true (validated in the service layer).
        const result = await ExportPermissionService.updateExportPermissions('user', userId, modules, updatedBy);
        return ResHelper.apiResponse(res, result.success, result.message, result.statusCode, result.data || null, result.error || "");
    } catch (error) {
        console.error('Error in updateUserExportPermissions:', error);
        return ResHelper.apiResponse(res, false, "Internal server error", 500, null, error.message);
    }
};

const listExportableModules = async (req, res) => {
    try {
        const result = await ExportPermissionService.listExportableModules();
        return ResHelper.apiResponse(res, result.success, result.message || "Success", result.statusCode, result.data || null, result.error || "");
    } catch (error) {
        console.error('Error in listExportableModules:', error);
        return ResHelper.apiResponse(res, false, "Internal server error", 500, null, error.message);
    }
};

module.exports = {
    getUserExportPermissions,
    updateUserExportPermissions,
    checkMyExportPermission,
    listExportableModules
};

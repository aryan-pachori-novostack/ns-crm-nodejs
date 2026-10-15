const RolesService = require('../../../services/roles-service.js');
const ResHelper = require('../../../helpers/response/response');

const getRoles = async (req, res) => {
    const { pageNumber, pageSize, filterModel, sortBy, sortDirection } = { ...req.params, ...req.body };
    if (!pageNumber, !pageSize) return res.sendStatus(400);
    const roles = await RolesService.getAllRoles({ pageNumber, pageSize, sortBy, sortDirection, filterModel });
    ResHelper.apiResponse(res, true, "Success", 200, roles, "");
}

const deleteRole = async (req, res) => {
    try {
        const { roleId } = req.params;
        const userId = req.loggedInUser?.id;

        if (!roleId) {
            return ResHelper.apiResponse(res, false, "Role ID is required", 400, null, "");
        }

        const result = await RolesService.deleteRole(roleId, userId);

        return ResHelper.apiResponse(
            res,
            result.success,
            result.message,
            result.statusCode,
            result.data || null,
            result.error || ""
        );
    } catch (error) {
        console.log('Error in deleteRole controller:', error);
        return ResHelper.apiResponse(res, false, "Internal server error", 500, null, error.message);
    }
}

const addRole = async (req, res) => {
    try {
        const { roleName } = req.body;
        const userId = req.loggedInUser?.id;

        if (!roleName) {
            return ResHelper.apiResponse(res, false, "Role name is required", 400, null, "");
        }

        const result = await RolesService.addRole(roleName, userId);

        return ResHelper.apiResponse(
            res,
            result.success,
            result.message,
            result.statusCode,
            result.data || null,
            result.error || ""
        );
    } catch (error) {
        console.log('Error in addRole controller:', error);
        return ResHelper.apiResponse(res, false, "Internal server error", 500, null, error.message);
    }
}

const getRoleModules = async (req, res) => {
    try {
        const { roleId } = req.params;

        if (!roleId) {
            return ResHelper.apiResponse(res, false, "Role ID is required", 400, null, "");
        }

        const result = await RolesService.getRoleModules(roleId);

        return ResHelper.apiResponse(
            res,
            result.success,
            result.message,
            result.statusCode,
            result.data || null,
            result.error || ""
        );
    } catch (error) {
        console.log('Error in getRoleModules controller:', error);
        return ResHelper.apiResponse(res, false, "Internal server error", 500, null, error.message);
    }
}

const updateRoleModules = async (req, res) => {
    try {
        const { roleId } = req.params;
        const { modules } = req.body;
        const userId = req.loggedInUser?.id;

        if (!roleId) {
            return ResHelper.apiResponse(res, false, "Role ID is required", 400, null, "");
        }

        if (!modules || !Array.isArray(modules) || modules.length === 0) {
            return ResHelper.apiResponse(res, false, "Modules array is required and cannot be empty", 400, null, "");
        }

        const result = await RolesService.updateRoleModules(roleId, modules, userId);

        return ResHelper.apiResponse(
            res,
            result.success,
            result.message,
            result.statusCode,
            result.data || null,
            result.error || ""
        );
    } catch (error) {
        console.log('Error in updateRoleModules controller:', error);
        return ResHelper.apiResponse(res, false, "Internal server error", 500, null, error.message);
    }
}

const getRoleModuleLogs = async (req, res) => {
    try {
        const { roleId } = req.params;
        const { pageNumber = 0, pageSize = 20 } = req.query;

        if (!roleId) {
            return ResHelper.apiResponse(res, false, "Role ID is required", 400, null, "");
        }

        const result = await RolesService.getRoleModuleLogs(roleId, {
            pageNumber: parseInt(pageNumber),
            pageSize: parseInt(pageSize)
        });

        return ResHelper.apiResponse(
            res,
            result.success,
            result.message,
            result.statusCode,
            result.data || null,
            result.error || ""
        );
    } catch (error) {
        console.log('Error in getRoleModuleLogs controller:', error);
        return ResHelper.apiResponse(res, false, "Internal server error", 500, null, error.message);
    }
}


const getRbacRules = async (req, res) => {
    try {
        const { roleId } = req.params;

        if (!roleId) {
            return ResHelper.apiResponse(res, false, "Role ID is required", 400, null, "");
        }

        const result = await RolesService.getRbacRules(roleId);

        return ResHelper.apiResponse(
            res,
            result.success,
            result.message,
            result.statusCode,
            result.data || null,
            result.error || ""
        );
    } catch (error) {
        console.log('Error in getRbacRules controller:', error);
        return ResHelper.apiResponse(res, false, "Internal server error", 500, null, error.message);
    }
}

const updateRbacRules = async (req, res) => {
    try {
        const { roleId } = req.params;
        const { rules } = req.body;
        const userId = req.loggedInUser?.id;

        if (!roleId) {
            return ResHelper.apiResponse(res, false, "Role ID is required", 400, null, "");
        }

        const result = await RolesService.updateRbacRules(roleId, rules, userId);

        return ResHelper.apiResponse(
            res,
            result.success,
            result.message,
            result.statusCode,
            result.data || null,
            result.error || ""
        );
    } catch (error) {
        console.log('Error in updateRbacRules controller:', error);
        return ResHelper.apiResponse(res, false, "Internal server error", 500, null, error.message);
    }
}

module.exports = {
    getRoles,
    deleteRole,
    addRole,
    getRoleModules,
    updateRoleModules,
    getRoleModuleLogs,
    getRbacRules,
    updateRbacRules
}
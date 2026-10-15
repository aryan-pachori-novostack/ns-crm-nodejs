const { sequelize } = require("../../../models");
const { QueryTypes } = require("sequelize");
const client = require("../redis-client");

// Constants
const CACHE_TTL_SECONDS = 3600;
const SUPER_ADMIN_CACHE_KEY = 'super_admin_permissions';
const MASTER_HOSTS = [
    "crm.ruloans.com",
    "crm-dev.ruloans.com",
    "crm-uat.ruloans.com",
    "ruloans-crm-reactjs-uat.vercel.app",
    "localhost"
];

/**
 * Check if request is from master host (for DSA centralized APIs)
 */
function checkMasterHost(req) {
    const referer = req.headers.referer || req.headers.referrer || '';
    return MASTER_HOSTS.some(host => referer.includes(host));
}

/**
 * Check if user has required permission for a single module
 */
function hasPermission(permissions, moduleName, action) {
    const modulePermissions = permissions?.modules?.[moduleName];
    if (!modulePermissions) return false;

    return modulePermissions[action] === 1 || modulePermissions[action] === true;
}

/**
 * Check if user has all required actions for a module
 */
function hasAllActionsForModule(permissions, moduleName, actions) {
    return actions.every(action => hasPermission(permissions, moduleName, action));
}

/**
 * Build mapping object from authorize parameters
 */
function buildMapping(moduleName, action) {
    const isModuleArray = Array.isArray(moduleName);
    const actions = Array.isArray(action) ? action : [action];

    return isModuleArray
        ? { modules: moduleName, actions }
        : { module: moduleName, actions };
}

/**
 * Check permissions based on mapping configuration
 * Handles single module, multiple modules (OR logic), and multiple actions (AND logic)
 */
function checkPermissions(permissions, mapping) {
    if (!mapping) return false;

    const { actions } = mapping;

    // Handle multiple modules (OR logic - user needs permission in ANY ONE module)
    if (mapping.modules) {
        return mapping.modules.some(moduleName =>
            hasAllActionsForModule(permissions, moduleName, actions)
        );
    }

    // Handle single module with multiple actions (AND logic - user needs ALL actions)
    if (mapping.module) {
        return hasAllActionsForModule(permissions, mapping.module, actions);
    }

    return false;
}

/**
 * Build permissions object from module results
 */
function buildModulesPermissions(moduleResults) {
    return moduleResults.reduce((acc, m) => {
        acc[m.alias] = {
            create: m.create,
            read: m.read,
            update: m.update,
            delete: m.delete
        };
        return acc;
    }, {});
}

/**
 * Build full permissions object for super admin
 */
function buildSuperAdminModules(modules) {
    return modules.reduce((acc, m) => {
        acc[m.alias] = {
            create: 1,
            read: 1,
            update: 1,
            delete: 1
        };
        return acc;
    }, {});
}

/**
 * Get cache key for role permissions
 */
function getRoleCacheKey(role) {
    // Ensure role is a Buffer before calling toString('hex')
    const roleStr = Buffer.isBuffer(role) ? role.toString('hex') : role.toString();
    return `${roleStr}_permissions`;
}

module.exports = {
    /**
     * Main authorization middleware
     *
     * Supports multiple calling patterns:
     * 1. Single module/action: RBACMiddleware.authorize('module', 'action')
     * 2. Multiple modules (OR logic): RBACMiddleware.authorize(['mod1', 'mod2'], 'action')
     * 3. Multiple actions (AND logic): RBACMiddleware.authorize('module', ['read', 'update'])
     * 4. Both arrays: RBACMiddleware.authorize(['mod1', 'mod2'], ['read', 'update'])
     * 5. With DSA centralized: RBACMiddleware.authorize('module', 'action', true)
     */
    authorize: (moduleName, action, isDSACentralised = false) => {
        return async (req, res, next) => {
            try {
                // For routes not in CSV (auto-detect with no params), allow through
                if (!moduleName) {
                    return next();
                }

                // Check DSA centralized restriction
                if (isDSACentralised && !checkMasterHost(req)) {
                    return next();
                }

                // Super admin bypass - has all permissions
                if (req.loggedInUser?.isSuperAdmin) {
                    return next();
                }

                // DSA / B2B session (MS token → req.dsa) — not a CRM user role
                if (req.dsa?.dsa_id || req.dsa?.id) {
                    return next();
                }

                const mapping = buildMapping(moduleName, action);

                // Get user's own permissions
                const roleData = req.loggedInUser?.role_id?.data;

                if (!roleData) {
                    return res.status(403).json({ error: 'No role assigned' });
                }

                const permissions = await module.exports.getPermissions(Buffer.from(roleData));
                const authorized = checkPermissions(permissions, mapping);

                if (!authorized) {
                    return res.status(403).json({ error: 'Insufficient permissions' });
                }

                next();
            } catch (error) {
                console.error('RBAC Middleware Error:', error.message);
                return res.status(403).json({ error: 'Authorization failed' });
            }
        };
    },

    /**
     * Get user permissions from cache or database
     * Returns: { modules: { module_alias: { create, read, update, delete } }, menu: [...] }
     * @param {Buffer} role - Role ID buffer
     * @param {boolean} isSuperAdmin - If true, returns all modules with full permissions
     */
    getPermissions: async (role, isSuperAdmin = false) => {
        try {
            // Super admin gets all modules with full permissions
            if (isSuperAdmin) {
                try {
                    const cached = await client.getAsync(SUPER_ADMIN_CACHE_KEY);
                    if (cached) {
                        client.expire(SUPER_ADMIN_CACHE_KEY, CACHE_TTL_SECONDS);
                        return JSON.parse(cached);
                    }
                } catch (redisError) {
                    console.warn('Redis Read Error (SuperAdmin), falling back to DB:', redisError.message);
                }

                const allModulesQuery = `
                    SELECT id, alias
                    FROM rbac_modules
                    WHERE is_active = 1 AND is_deleted = 0
                `;
                const allModules = await sequelize.query(allModulesQuery, { type: QueryTypes.SELECT });

                const allMenuQuery = `
                    SELECT *
                    FROM menu
                    WHERE is_deleted = 0
                `;
                const menu = await sequelize.query(allMenuQuery, { type: QueryTypes.SELECT });

                const rules = [];

                const result = {
                    modules: buildSuperAdminModules(allModules),
                    menu,
                    rules
                };

                try {
                    await client.setAsync(SUPER_ADMIN_CACHE_KEY, JSON.stringify(result), "EX", CACHE_TTL_SECONDS);
                } catch (redisError) {
                    console.warn('Redis Write Error (SuperAdmin):', redisError.message);
                }
                return result;
            }

            const cacheKey = getRoleCacheKey(role);
            try {
                const cached = await client.getAsync(cacheKey);
                if (cached) {
                    client.expire(cacheKey, CACHE_TTL_SECONDS);
                    return JSON.parse(cached);
                }
            } catch (redisError) {
                console.warn('Redis Read Error (Role), falling back to DB:', redisError.message);
            }

            const getModuleQuery = `
                SELECT m.id, m.alias, rm.create, rm.read, rm.update, rm.delete
                FROM role_modules rm
                INNER JOIN rbac_modules m ON m.id = rm.module_id
                WHERE rm.role_id = ? AND rm.read = 1 AND m.is_active = 1 AND m.is_deleted = 0
            `;
            const moduleResult = await sequelize.query(getModuleQuery, {
                replacements: [role],
                type: QueryTypes.SELECT
            });

            const modules = buildModulesPermissions(moduleResult);

            let menu = [];
            if (moduleResult.length > 0) {
                const getMenuQuery = `
                    SELECT *
                    FROM menu
                    WHERE module_id IN (:moduleIds) AND is_deleted = 0
                `;
                menu = await sequelize.query(getMenuQuery, {
                    replacements: { moduleIds: moduleResult.map(m => m.id) },
                    type: QueryTypes.SELECT
                });
            }

            const getRulesQuery = `
                SELECT resource_type, resource_key, resource_list, visible
                FROM rbac_rules
                WHERE role_id = ?
            `;
            const rules = await sequelize.query(getRulesQuery, {
                replacements: [role],
                type: QueryTypes.SELECT
            });

            const result = { modules, menu, rules };
            // Prevent caching empty/failed queries to prevent negative caching lockout
            if (moduleResult && moduleResult.length > 0) {
                try {
                    await client.setAsync(cacheKey, JSON.stringify(result), "EX", CACHE_TTL_SECONDS);
                } catch (redisError) {
                    console.warn('Redis Write Error (Role):', redisError.message);
                }
            }
            return result;
        } catch (error) {
            console.error('Get Permissions Error:', error.message);
            return { modules: {}, menu: [] };
        }
    },

    hasPermission
};


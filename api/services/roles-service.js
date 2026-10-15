const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../models");
const client = require("../helpers/redis-client");
const { broadcastMessage } = require('./socket-services');
const rbacMiddleware = require('../helpers/acl-middleware/rbac-middleware');
const { CreateWhereQueryFilter, CustomOperatorHandlers } = require("../helpers/commonhelper");
const { roleFieldMapping } = require("../helpers/apiFieldMappings");

const getAllRoles = async ({ pageNumber, pageSize, sortBy = "id", sortDirection = "ASC", filterModel }) => {
    try {
        const where = CreateWhereQueryFilter(filterModel, roleFieldMapping, CustomOperatorHandlers());

        // Build WHERE clause with named parameters
        const replacements = {};
        const whereStatementArray = where.map((item, index) => {
            const paramName = `param${index}`;
            if (item[2] == '') {
                return `${item[0]} ${item[1]}`;
            }
            replacements[paramName] = item[2]; // item[2] is the value
            return `${item[0]} ${item[1]} :${paramName}`;
        });

        const whereStatement = whereStatementArray.length > 0
            ? `WHERE ${whereStatementArray.join(' AND ')}`
            : '';

        const sort = `ORDER BY ${sortBy} ${sortDirection}`

        const offset = pageNumber * pageSize;
        replacements.offset = offset;
        replacements.pageSize = pageSize;
        const baseQuery = ` SELECT 
                                BIN_TO_UUID(r.id) as id, 
                                r.role, 
                                COALESCE(u.number_of_users, 0) as number_of_users,
                                COALESCE(rm.create_permission_count, 0) as create_permission_count,
                                COALESCE(rm.read_permission_count, 0) as read_permission_count,
                                COALESCE(rm.update_permission_count, 0) as update_permission_count,
                                COALESCE(rm.delete_permission_count, 0) as delete_permission_count
                            FROM roles r
                            LEFT JOIN (
                                SELECT role, COUNT(*) as number_of_users
                                FROM users
                                WHERE isDeleted = false
                                GROUP BY role
                            ) u ON r.id = u.role
                            LEFT JOIN (
                                SELECT 
                                    role_id,
                                    SUM(CASE WHEN \`create\` = 1 THEN 1 ELSE 0 END) as create_permission_count,
                                    SUM(CASE WHEN \`read\` = 1 THEN 1 ELSE 0 END) as read_permission_count,
                                    SUM(CASE WHEN \`update\` = 1 THEN 1 ELSE 0 END) as update_permission_count,
                                    SUM(CASE WHEN \`delete\` = 1 THEN 1 ELSE 0 END) as delete_permission_count
                                FROM role_modules
                                GROUP BY role_id
                            ) rm ON r.id = rm.role_id
                            ORDER BY r.role
                            `
        // Query to get paginated roles
        const roleQuery = `SELECT *
                            FROM (${baseQuery}) X
                            ${whereStatement}
                            ${sort}
                            LIMIT :offset, :pageSize`;

        // Query to get total count of distinct roles
        // Must use the same subquery structure to support filtering on calculated fields like number_of_users
        const countQuery = `SELECT COUNT(*) as total
                            FROM (${baseQuery}) X
                            ${whereStatement}`;

        // For count query, only use filter replacements (not offset/pageSize)
        const countReplacements = { ...replacements };
        delete countReplacements.offset;
        delete countReplacements.pageSize;

        const [records, countResult] = await Promise.all([
            sequelize.query(roleQuery, { replacements, type: QueryTypes.SELECT }),
            sequelize.query(countQuery, { replacements: countReplacements, type: QueryTypes.SELECT })
        ]);

        return {
            records,
            totalRecords: countResult[0]?.total || 0
        };
    } catch (error) {
        console.log(error)
    }
}

const deleteRole = async (roleId, userId) => {
    try {
        // Check if the role exists
        const roleCheckQuery = `SELECT BIN_TO_UUID(id) as id, role
                                FROM roles
                                WHERE id = UUID_TO_BIN(?)`;

        const roleExists = await sequelize.query(roleCheckQuery, {
            replacements: [roleId],
            type: QueryTypes.SELECT
        });

        if (!roleExists || roleExists.length === 0) {
            return {
                success: false,
                message: 'Role not found',
                statusCode: 404
            };
        }

        // Check if any users have this role
        const userCountQuery = `SELECT COUNT(*) as userCount
                                FROM users
                                WHERE role = UUID_TO_BIN(?) AND isDeleted = false`;

        const userCountResult = await sequelize.query(userCountQuery, {
            replacements: [roleId],
            type: QueryTypes.SELECT
        });

        const userCount = userCountResult[0]?.userCount || 0;

        if (userCount > 0) {
            return {
                success: false,
                message: `Cannot delete role. ${userCount} user(s) are currently assigned to this role`,
                statusCode: 400,
                data: { userCount }
            };
        }

        // Get existing role_modules before delete for logging
        const getExistingModulesQuery = `
            SELECT module_id, \`create\`, \`read\`, \`update\`, \`delete\`
            FROM role_modules
            WHERE role_id = UUID_TO_BIN(?)
        `;
        const existingModules = await sequelize.query(getExistingModulesQuery, {
            replacements: [roleId],
            type: QueryTypes.SELECT
        });

        // Log the deletion of role modules
        if (userId && existingModules.length > 0) {
            const logValues = existingModules.map(() =>
                `(UUID_TO_BIN(?), ?, 'DELETE', ?, NULL, UUID_TO_BIN(?), CURRENT_TIMESTAMP)`
            ).join(', ');

            const insertLogsQuery = `
                INSERT INTO role_module_logs (role_id, module_id, action, old_values, new_values, updated_by_user_id, updated_on)
                VALUES ${logValues}
            `;

            const logReplacements = [];
            existingModules.forEach(module => {
                logReplacements.push(roleId);
                logReplacements.push(module.module_id);
                logReplacements.push(JSON.stringify({
                    create: module.create,
                    read: module.read,
                    update: module.update,
                    delete: module.delete
                }));
                logReplacements.push(userId);
            });

            await sequelize.query(insertLogsQuery, {
                replacements: logReplacements,
                type: QueryTypes.INSERT
            });
        }

        // Delete role_modules entries first
        const deleteRoleModulesQuery = `DELETE FROM role_modules WHERE role_id = UUID_TO_BIN(?)`;
        await sequelize.query(deleteRoleModulesQuery, {
            replacements: [roleId],
            type: QueryTypes.DELETE
        });

        // Delete the role
        const deleteRoleQuery = `DELETE FROM roles WHERE id = UUID_TO_BIN(?)`;
        await sequelize.query(deleteRoleQuery, {
            replacements: [roleId],
            type: QueryTypes.DELETE
        });

        return {
            success: true,
            message: 'Role deleted successfully',
            statusCode: 200
        };
    } catch (error) {
        console.log('Error deleting role:', error);
        return {
            success: false,
            message: 'Error deleting role',
            statusCode: 500,
            error: error.message
        };
    }
}

const addRole = async (roleName, userId) => {
    try {
        // Check if role name already exists
        const roleExistsQuery = `SELECT id FROM roles WHERE role = ?`;
        const existingRole = await sequelize.query(roleExistsQuery, {
            replacements: [roleName],
            type: QueryTypes.SELECT
        });

        if (existingRole && existingRole.length > 0) {
            return {
                success: false,
                message: 'Role name already exists',
                statusCode: 400
            };
        }

        // Insert the new role
        const insertRoleQuery = `INSERT INTO roles (id, role) VALUES (UUID_TO_BIN(UUID()), ?)`;
        await sequelize.query(insertRoleQuery, {
            replacements: [roleName],
            type: QueryTypes.INSERT
        });

        // Get the newly created role ID as binary
        const getRoleQuery = `SELECT id, BIN_TO_UUID(id) as uuid FROM roles WHERE role = ?`;
        const roleResult = await sequelize.query(getRoleQuery, {
            replacements: [roleName],
            type: QueryTypes.SELECT
        });

        const newRoleIdBinary = roleResult[0].id;
        const newRoleId = roleResult[0].uuid;

        // Insert role_modules entries for all active modules with default permissions (all false)
        const insertRoleModulesQuery = `
            INSERT INTO role_modules (role_id, module_id, \`create\`, \`read\`, \`update\`, \`delete\`, updated_on, updated_by_user_id)
            SELECT
                ?,
                id,
                0,
                0,
                0,
                0,
                CURRENT_TIMESTAMP,
                ${userId ? 'UUID_TO_BIN(?)' : 'NULL'}
            FROM rbac_modules
            WHERE is_deleted = 0 AND is_active = 1
        `;

        const replacements = userId ? [newRoleIdBinary, userId] : [newRoleIdBinary];

        await sequelize.query(insertRoleModulesQuery, {
            replacements,
            type: QueryTypes.INSERT
        });

        // Log the creation of role (single entry)
        if (userId) {
            const insertLogQuery = `
                INSERT INTO role_module_logs (role_id, module_id, action, old_values, new_values, updated_by_user_id, updated_on)
                VALUES (UUID_TO_BIN(?), NULL, 'CREATE', NULL, NULL, UUID_TO_BIN(?), CURRENT_TIMESTAMP)
            `;

            await sequelize.query(insertLogQuery, {
                replacements: [newRoleId, userId],
                type: QueryTypes.INSERT
            });
        }

        return {
            success: true,
            message: 'Role created successfully',
            statusCode: 201,
            data: { roleId: newRoleId, roleName }
        };
    } catch (error) {
        console.log('Error creating role:', error);
        return {
            success: false,
            message: 'Error creating role',
            statusCode: 500,
            error: error.message
        };
    }
}

const getRoleModules = async (roleId) => {
    try {
        // Check if the role exists
        const roleCheckQuery = `SELECT BIN_TO_UUID(id) as id, role FROM roles WHERE id = UUID_TO_BIN(?)`;
        const roleExists = await sequelize.query(roleCheckQuery, {
            replacements: [roleId],
            type: QueryTypes.SELECT
        });

        if (!roleExists || roleExists.length === 0) {
            return {
                success: false,
                message: 'Role not found',
                statusCode: 404
            };
        };

        // Get role_modules with module details
        let excludeCondtions = `(
        m.name NOT LIKE '%Callers'
        AND m.name NOT LIKE '%Reminder'
        AND m.name NOT LIKE '%Ledger Export'
        AND m.name NOT LIKE '%Marketing Assets')`;

        const getRoleModulesQuery = `
            SELECT
                BIN_TO_UUID(rm.role_id) as role_id,
                r.role,
                rm.module_id,
                m.name as module_name,
                rm.\`create\`,
                rm.\`read\`,
                rm.\`update\`,
                rm.\`delete\`,
                m.parent_id,
                m.alias
            FROM role_modules rm
            INNER JOIN roles r ON r.id = rm.role_id
            INNER JOIN rbac_modules m ON m.id = rm.module_id
            WHERE rm.role_id = UUID_TO_BIN(?)
            AND m.is_deleted = 0 AND m.is_active = 1 and ${excludeCondtions} ORDER BY m.name ASC
        `;

        const roleModules = await sequelize.query(getRoleModulesQuery, {
            replacements: [roleId],
            type: QueryTypes.SELECT
        });

        return {
            success: true,
            message: 'Role modules retrieved successfully',
            statusCode: 200,
            data: {
                role: roleExists[0].role,
                roleId: roleExists[0].id,
                modules: roleModules
            }
        };
    } catch (error) {
        console.log('Error getting role modules:', error);
        return {
            success: false,
            message: 'Error getting role modules',
            statusCode: 500,
            error: error.message
        };
    }
}

const updateRoleModules = async (roleId, modules, userId) => {
    try {
        // Check if the role exists
        const roleCheckQuery = `SELECT BIN_TO_UUID(id) as id, role FROM roles WHERE id = UUID_TO_BIN(?)`;
        const roleExists = await sequelize.query(roleCheckQuery, {
            replacements: [roleId],
            type: QueryTypes.SELECT
        });

        if (!roleExists || roleExists.length === 0) {
            return {
                success: false,
                message: 'Role not found',
                statusCode: 404
            };
        }

        // Get role ID as binary
        const getRoleBinaryQuery = `SELECT id FROM roles WHERE id = UUID_TO_BIN(?)`;
        const roleBinaryResult = await sequelize.query(getRoleBinaryQuery, {
            replacements: [roleId],
            type: QueryTypes.SELECT
        });

        const roleIdBinary = roleBinaryResult[0].id;

        // Get existing role_modules before update for logging
        const getExistingModulesQuery = `
            SELECT module_id, \`create\`, \`read\`, \`update\`, \`delete\`
            FROM role_modules
            WHERE role_id = UUID_TO_BIN(?)
        `;
        const existingModules = await sequelize.query(getExistingModulesQuery, {
            replacements: [roleId],
            type: QueryTypes.SELECT
        });

        // Create a map of existing modules for easy lookup
        const existingModulesMap = {};
        existingModules.forEach(module => {
            existingModulesMap[module.module_id] = {
                create: module.create,
                read: module.read,
                update: module.update,
                delete: module.delete
            };
        });

        // Delete existing role_modules for this role
        const deleteQuery = `DELETE FROM role_modules WHERE role_id = UUID_TO_BIN(?)`;
        await sequelize.query(deleteQuery, {
            replacements: [roleId],
            type: QueryTypes.DELETE
        });

        // Prepare logs for changes
        const logs = [];

        // Insert new role_modules
        if (modules && Array.isArray(modules) && modules.length > 0) {
            const roleModulesValues = modules.map(() =>
                `(?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ${userId ? 'UUID_TO_BIN(?)' : 'NULL'})`
            ).join(', ');

            const insertRoleModulesQuery = `
                INSERT INTO role_modules (role_id, module_id, \`create\`, \`read\`, \`update\`, \`delete\`, updated_on, updated_by_user_id)
                VALUES ${roleModulesValues}
            `;

            const replacements = [];
            modules.forEach(module => {
                replacements.push(roleIdBinary);
                replacements.push(module.module_id);
                replacements.push(module.create ? 1 : 0);
                replacements.push(module.read ? 1 : 0);
                replacements.push(module.update ? 1 : 0);
                replacements.push(module.delete ? 1 : 0);
                if (userId) {
                    replacements.push(userId);
                }

                // Prepare log entry
                const oldValues = existingModulesMap[module.module_id] || null;
                const newValues = {
                    create: module.create ? 1 : 0,
                    read: module.read ? 1 : 0,
                    update: module.update ? 1 : 0,
                    delete: module.delete ? 1 : 0
                };

                // Determine action type
                let action = 'UPDATE';
                if (!oldValues) {
                    action = 'CREATE';
                }

                // Only log if there are actual changes or it's a new module
                if (!oldValues ||
                    oldValues.create !== newValues.create ||
                    oldValues.read !== newValues.read ||
                    oldValues.update !== newValues.update ||
                    oldValues.delete !== newValues.delete) {
                    logs.push({
                        module_id: module.module_id,
                        action,
                        old_values: oldValues,
                        new_values: newValues
                    });
                }
            });

            await sequelize.query(insertRoleModulesQuery, {
                replacements,
                type: QueryTypes.INSERT
            });

            // Insert logs if there are any changes
            if (logs.length > 0 && userId) {
                const logValues = logs.map(() =>
                    `(UUID_TO_BIN(?), ?, ?, ?, ?, UUID_TO_BIN(?), CURRENT_TIMESTAMP)`
                ).join(', ');

                const insertLogsQuery = `
                    INSERT INTO role_module_logs (role_id, module_id, action, old_values, new_values, updated_by_user_id, updated_on)
                    VALUES ${logValues}
                `;

                const logReplacements = [];
                logs.forEach(log => {
                    logReplacements.push(roleId);
                    logReplacements.push(log.module_id);
                    logReplacements.push(log.action);
                    logReplacements.push(log.old_values ? JSON.stringify(log.old_values) : null);
                    logReplacements.push(JSON.stringify(log.new_values));
                    logReplacements.push(userId);
                });

                await sequelize.query(insertLogsQuery, {
                    replacements: logReplacements,
                    type: QueryTypes.INSERT
                });
            }
        }

        // Invalidate Redis cache for this role
        const roleIdHex = roleIdBinary.toString('hex');
        const cacheKey = `${roleIdHex}_permissions`;
        await client.delAsync(cacheKey);
        console.log(`Cache invalidated for role: ${roleIdHex}`);

        // Fetch new permissions and broadcast via socket
        const permissions = await rbacMiddleware.getPermissions(roleIdBinary);
        const socketData = {
            role_id: roleId,
            permissions: permissions
        };
        console.log('Broadcasting role_module_updated event with data:', JSON.stringify(socketData));
        const broadcastResult = broadcastMessage('role_module_updated', socketData);
        console.log('Broadcast result:', broadcastResult);

        return {
            success: true,
            message: 'Role modules updated successfully',
            statusCode: 200,
            data: {
                roleId,
                roleName: roleExists[0].role,
                modulesUpdated: modules.length
            }
        };
    } catch (error) {
        console.log('Error updating role modules:', error);
        return {
            success: false,
            message: 'Error updating role modules',
            statusCode: 500,
            error: error.message
        };
    }
}

const getRoleModuleLogs = async (roleId, { pageNumber = 0, pageSize = 20 } = {}) => {
    try {
        // Check if the role exists
        const roleCheckQuery = `SELECT BIN_TO_UUID(id) as id, role FROM roles WHERE id = UUID_TO_BIN(?)`;
        const roleExists = await sequelize.query(roleCheckQuery, {
            replacements: [roleId],
            type: QueryTypes.SELECT
        });

        if (!roleExists || roleExists.length === 0) {
            return {
                success: false,
                message: 'Role not found',
                statusCode: 404
            };
        }

        const offset = pageNumber * pageSize;

        // Get logs with module and user details
        const getLogsQuery = `
            SELECT
                rml.id,
                BIN_TO_UUID(rml.role_id) as role_id,
                rml.module_id,
                m.name as module_name,
                rml.action,
                rml.old_values,
                rml.new_values,
                BIN_TO_UUID(rml.updated_by_user_id) as updated_by_user_id,
                u.name as updated_by_user_name,
                rml.updated_on
            FROM role_module_logs rml
            LEFT JOIN rbac_modules m ON m.id = rml.module_id
            LEFT JOIN users u ON u.id = rml.updated_by_user_id
            WHERE rml.role_id = UUID_TO_BIN(?)
            ORDER BY rml.updated_on DESC
            LIMIT ?, ?
        `;

        const logs = await sequelize.query(getLogsQuery, {
            replacements: [roleId, offset, pageSize],
            type: QueryTypes.SELECT
        });

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM role_module_logs
            WHERE role_id = UUID_TO_BIN(?)
        `;

        const countResult = await sequelize.query(countQuery, {
            replacements: [roleId],
            type: QueryTypes.SELECT
        });

        return {
            success: true,
            message: 'Role module logs retrieved successfully',
            statusCode: 200,
            data: {
                role: roleExists[0].role,
                roleId: roleExists[0].id,
                logs,
                totalRecords: countResult[0]?.total || 0
            }
        };
    } catch (error) {
        console.log('Error getting role module logs:', error);
        return {
            success: false,
            message: 'Error getting role module logs',
            statusCode: 500,
            error: error.message
        };
    }
}

const getRbacRules = async (roleId) => {
    try {
        const query = `
            SELECT 
                BIN_TO_UUID(role_id) as role_id,
                resource_type,
                resource_key,
                resource_list,
                visible
            FROM rbac_rules
            WHERE role_id = UUID_TO_BIN(?)
        `;

        const rules = await sequelize.query(query, {
            replacements: [roleId],
            type: QueryTypes.SELECT
        });

        return {
            success: true,
            data: rules,
            statusCode: 200
        };
    } catch (error) {
        console.log('Error getting RBAC rules:', error);
        return { success: false, message: 'Error getting RBAC rules', statusCode: 500 };
    }
}

const updateRbacRules = async (roleId, rules, userId) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const roleIdBin = UUID_TO_BIN(roleId);

        // 1. Fetch Mapping & Existing Rules
        const [rbacModules, oldRules] = await Promise.all([
            sequelize.query(`SELECT id, alias FROM rbac_modules`, { type: QueryTypes.SELECT, transaction }),
            sequelize.query(`SELECT resource_type, resource_key, resource_list, visible FROM rbac_rules WHERE role_id = ?`, {
                replacements: [roleIdBin], type: QueryTypes.SELECT, transaction
            })
        ]);

        const aliasToId = Object.fromEntries(rbacModules.map(m => [m.alias, m.id]));

        // Helper to group rules by module alias
        const groupRules = (list) => list.reduce((acc, r) => {
            if (!acc[r.resource_key]) acc[r.resource_key] = {};
            acc[r.resource_key][r.resource_type] = { list: r.resource_list || '', visible: r.visible ? 1 : 0 };
            return acc;
        }, {});

        const oldMap = groupRules(oldRules);
        const newMap = groupRules(rules || []);

        // 2. Identify Minimal Diff for Logging
        const logEntriesRaw = [];
        const allKeys = [...new Set([...Object.keys(oldMap), ...Object.keys(newMap)])];

        allKeys.forEach(moduleAlias => {
            const o = oldMap[moduleAlias] || {}, n = newMap[moduleAlias] || {};
            const diffOld = {}, diffNew = {};
            let changed = false;

            ['column', 'button'].forEach(type => {
                if (JSON.stringify(o[type]) !== JSON.stringify(n[type])) {
                    changed = true;
                    if (o[type]) diffOld[type] = o[type];
                    if (n[type]) diffNew[type] = n[type];
                }
            });

            if (changed && userId) {
                logEntriesRaw.push([
                    roleIdBin, aliasToId[moduleAlias] || null, 'GRANULAR_UPDATE',
                    JSON.stringify(diffOld), JSON.stringify(diffNew), UUID_TO_BIN(userId)
                ]);
            }
        });

        // 3. Sync Database
        await sequelize.query(`DELETE FROM rbac_rules WHERE role_id = ?`, { replacements: [roleIdBin], transaction });

        if (rules?.length > 0) {
            const values = rules.map(() => `(?, ?, ?, ?, ?)`).join(', ');
            const replacements = rules.flatMap(r => [roleIdBin, r.resource_type, r.resource_key, r.resource_list || '', r.visible ? 1 : 0]);
            await sequelize.query(`INSERT INTO rbac_rules (role_id, resource_type, resource_key, resource_list, visible) VALUES ${values}`, {
                replacements, transaction, type: QueryTypes.INSERT
            });
        }

        if (logEntriesRaw.length > 0) {
            const logValues = logEntriesRaw.map(() => `(?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`).join(', ');
            await sequelize.query(`INSERT INTO role_module_logs (role_id, module_id, action, old_values, new_values, updated_by_user_id, updated_on) VALUES ${logValues}`, {
                replacements: logEntriesRaw.flat(), transaction, type: QueryTypes.INSERT
            });
        }

        await transaction.commit();

        // 4. Cache Invalidation & Real-time Update
        const cacheKey = `${roleIdBin.toString('hex')}_permissions`;
        await client.delAsync(cacheKey);

        const permissions = await rbacMiddleware.getPermissions(roleIdBin);
        broadcastMessage('role_module_updated', { role_id: roleId, permissions });

        return { success: true, message: 'RBAC rules updated successfully', statusCode: 200 };
    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('Error updating RBAC rules:', error);
        return { success: false, message: 'Error updating RBAC rules', statusCode: 500 };
    }
}

const getModuleColumnsByRole = async (roleId, resourceKey, resourceType = 'column') => {
    try {
        const query = `
            SELECT rr.resource_list, rr.visible 
            FROM rbac_rules rr 
            LEFT JOIN roles r ON r.id = rr.role_id 
            WHERE r.role = ? 
            AND rr.resource_key = ? 
            AND rr.resource_type = ? 
            LIMIT 1
        `;

        const [rule] = await sequelize.query(query, {
            replacements: [roleId, resourceKey, resourceType],
            type: QueryTypes.SELECT
        });

        return rule || null;
    } catch (error) {
        console.error('Error in getModuleColumnsByRole:', error);
        return null;
    }
}

// Helper function since it's used in multiple places in this file
function UUID_TO_BIN(uuid) {
    return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

module.exports = {
    getAllRoles,
    deleteRole,
    addRole,
    getRoleModules,
    updateRoleModules,
    getRoleModuleLogs,
    getRbacRules,
    updateRbacRules,
    getModuleColumnsByRole
}
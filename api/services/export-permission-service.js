const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../models");
const { createActivityLogKafka } = require("./kafka-services");

// Helper (same pattern used in roles-service.js)
function UUID_TO_BIN(uuid) {
    return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

/**
 * Log an export-related audit event into the existing generic application_logs table
 * (application_type/application_id/field/from/to/updated_by/ip/created_at) -- no new
 * audit table needed, reuses the same mechanism EventLogs/mobile-history already use.
 */
const logExportEvent = async ({ applicationId, moduleAlias, field, from, to, updatedBy, ip }, transaction) => {
    try {
        await sequelize.query(
            `INSERT INTO application_logs (application_type, application_id, field, from_value, to_value, updated_by, ip, createdAt, updatedAt)
             VALUES ('export', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            {
                replacements: [
                    String(applicationId),
                    field,
                    from != null ? JSON.stringify(from) : null,
                    to != null ? JSON.stringify(to) : null,
                    updatedBy ? UUID_TO_BIN(updatedBy) : null,
                    ip || null
                ],
                type: QueryTypes.INSERT,
                ...(transaction ? { transaction } : {})
            }
        );
    } catch (error) {
        // Audit logging must never block the actual permission check/export flow.
        console.error('Error writing export audit log:', error.message);
    }

    try {
        // ref_id is the performing CRM user's id (not the module) -- CrmUser-scoped
        // logs are always keyed by the user's own id, matching every other CrmUser event.
        await createActivityLogKafka({
            log_type: to?.allowed ? 'export_allowed' : 'export_blocked',
            application_id: updatedBy,
            created_by: updatedBy,
            old_data: {},
            new_data: { module_alias: moduleAlias, ip, ...to }
        });
    } catch (error) {
        // Kafka logging must never block the actual permission check/export flow either.
    }
};

/**
 * Log a CEO grant/revoke/IP-restriction edit made on the export-permissions panel
 * itself -- distinct from logExportEvent (which logs actual export ATTEMPT outcomes
 * as export_allowed/export_blocked). Reusing those two log_types for permission edits
 * would mislabel every edit as "blocked" (they have no `allowed` field to key off of)
 * and gives no way to tell which module changed -- so this is its own event/log_type,
 * carrying the module name so the CRM user's activity log is actually legible.
 */
const logExportPermissionChange = async ({ moduleId, moduleName, from, to, updatedBy }) => {
    try {
        await createActivityLogKafka({
            log_type: 'export_permission_updated',
            application_id: updatedBy,
            created_by: updatedBy,
            old_data: { module_id: moduleId, module_name: moduleName, ...from },
            new_data: { module_id: moduleId, module_name: moduleName, ...to }
        });
    } catch (error) {
        // Kafka logging must never block the actual save.
    }
};

/**
 * Get the full exportable module tree (rbac_modules) merged with whatever
 * export_permissions rows already exist for the given owner (role or user).
 */
const getModulesWithExportPermissions = async (ownerType, ownerId) => {
    try {
        const ownerIdBin = UUID_TO_BIN(ownerId);

        const query = `
            SELECT
                m.id AS module_id,
                m.name AS module_name,
                m.alias,
                m.parent_id,
                COALESCE(ep.enabled, 0) AS enabled,
                COALESCE(ep.ip_restricted, 0) AS ip_restricted,
                ep.ip_networks,
                ep.updated_on,
                u.name AS updated_by_name
            FROM rbac_modules m
            LEFT JOIN export_permissions ep
                ON ep.module_id = m.id AND ep.owner_type = :ownerType AND ep.owner_id = :ownerIdBin
            LEFT JOIN users u ON u.id = ep.updated_by_user_id
            WHERE m.is_deleted = 0 AND m.is_active = 1
              -- Only real pages/menu items, not category/grouping nodes (e.g. "Finance",
              -- "Claim", "BBPS", "Bureau") -- granting export on a parent category alias
              -- does nothing since no route is ever gated by it, only leaf-page aliases are.
              -- One structural exception: "DSA > Channel Partners" (dsa_channel_partners)
              -- IS itself a real exportable page (backs getRuloansCustomers), but its
              -- children are button-level actions (Assign/Bulk Assign Partner/SP), not
              -- sub-pages -- so it's force-included despite having children, and those 4
              -- action-level children are force-excluded despite being leaves.
              AND m.alias NOT IN (
                  'dsa_channel_partners_assign_partner', 'dsa_channel_partners_assign_sp',
                  'dsa_channel_partners_bulk_assign_partner', 'dsa_channel_partners_bulk_assign_sp'
              )
              AND (
                  m.alias = 'dsa_channel_partners'
                  OR NOT EXISTS (
                      SELECT 1 FROM rbac_modules child
                      WHERE child.parent_id = m.id AND child.is_deleted = 0 AND child.is_active = 1
                  )
              )
            ORDER BY m.name ASC
        `;

        const modules = await sequelize.query(query, {
            replacements: { ownerType, ownerIdBin },
            type: QueryTypes.SELECT
        });

        return {
            success: true,
            message: 'Export permissions retrieved successfully',
            statusCode: 200,
            data: { ownerType, ownerId, modules }
        };
    } catch (error) {
        console.error('Error getting export permissions:', error);
        return { success: false, message: 'Error getting export permissions', statusCode: 500, error: error.message };
    }
};

/**
 * Replace all export_permissions rows for a given owner (role or user) --
 * same delete-then-reinsert pattern as updateRoleModules in roles-service.js.
 * `modules` = [{ module_id, enabled, ip_networks? }]
 */
const updateExportPermissions = async (ownerType, ownerId, modules, updatedByUserId) => {
    let transaction;
    try {
        if (ownerType !== 'user') {
            return { success: false, message: 'Invalid owner type', statusCode: 400 };
        }
        if (!Array.isArray(modules)) {
            return { success: false, message: 'modules array is required', statusCode: 400 };
        }

        const enabledModules = modules.filter(m => m.enabled);
        const restrictedWithoutIp = enabledModules.find(
            m => m.ip_restricted && (!Array.isArray(m.ip_networks) || m.ip_networks.length === 0)
        );
        if (restrictedWithoutIp) {
            return { success: false, message: 'IP restriction is on but no IP was provided for one or more modules', statusCode: 400 };
        }

        transaction = await sequelize.transaction();
        const ownerIdBin = UUID_TO_BIN(ownerId);

        const existingRows = await sequelize.query(
            `SELECT module_id, enabled, ip_restricted, ip_networks FROM export_permissions WHERE owner_type = ? AND owner_id = ?`,
            { replacements: [ownerType, ownerIdBin], type: QueryTypes.SELECT, transaction }
        );
        const existingMap = Object.fromEntries(existingRows.map(r => [r.module_id, r]));

        await sequelize.query(
            `DELETE FROM export_permissions WHERE owner_type = ? AND owner_id = ?`,
            { replacements: [ownerType, ownerIdBin], type: QueryTypes.DELETE, transaction }
        );

        if (enabledModules.length > 0) {
            const values = enabledModules.map(() => `(?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`).join(', ');
            const replacements = [];
            enabledModules.forEach(m => {
                const ipRestricted = Boolean(m.ip_restricted);
                const ipNetworks = ipRestricted && m.ip_networks ? JSON.stringify(m.ip_networks) : null;
                replacements.push(ownerType, ownerIdBin, m.module_id, 1, ipRestricted ? 1 : 0, ipNetworks, updatedByUserId ? UUID_TO_BIN(updatedByUserId) : null);
            });

            await sequelize.query(
                `INSERT INTO export_permissions (owner_type, owner_id, module_id, enabled, ip_restricted, ip_networks, updated_by_user_id, updated_on)
                 VALUES ${values}`,
                { replacements, type: QueryTypes.INSERT, transaction }
            );
        }

        await transaction.commit();

        // Audit: log grant/revoke/IP-restriction diffs (best-effort, outside the transaction).
        // Compares the full {enabled, ip_restricted, ip_networks} shape, not just `enabled` --
        // toggling IP restriction or editing IPs on an already-enabled module is exactly the
        // kind of change a CEO needs a trail for, and was previously silent.
        const newMap = Object.fromEntries(modules.map(m => [m.module_id, m]));
        const allModuleIds = [...new Set([...Object.keys(existingMap).map(Number), ...modules.map(m => m.module_id)])];

        const normalize = (row) => ({
            enabled: Boolean(row?.enabled),
            ip_restricted: Boolean(row?.ip_restricted),
            ip_networks: row?.ip_restricted ? (parseIpNetworks(row?.ip_networks) || []) : []
        });

        const changedModuleIds = allModuleIds.filter(moduleId => {
            const before = normalize(existingMap[moduleId]);
            const after = normalize(newMap[moduleId]);
            return before.enabled !== after.enabled
                || before.ip_restricted !== after.ip_restricted
                || JSON.stringify(before.ip_networks) !== JSON.stringify(after.ip_networks);
        });

        if (changedModuleIds.length > 0) {
            const moduleNameRows = await sequelize.query(
                `SELECT id, name FROM rbac_modules WHERE id IN (:moduleIds)`,
                { replacements: { moduleIds: changedModuleIds }, type: QueryTypes.SELECT }
            );
            const moduleNameById = Object.fromEntries(moduleNameRows.map(r => [r.id, r.name]));

            for (const moduleId of changedModuleIds) {
                await logExportPermissionChange({
                    moduleId,
                    moduleName: moduleNameById[moduleId] || null,
                    from: normalize(existingMap[moduleId]),
                    to: normalize(newMap[moduleId]),
                    updatedBy: updatedByUserId
                });
            }
        }

        return {
            success: true,
            message: 'Export permissions updated successfully',
            statusCode: 200,
            data: { ownerType, ownerId, modulesUpdated: modules.length }
        };
    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('Error updating export permissions:', error);
        return { success: false, message: 'Error updating export permissions', statusCode: 500, error: error.message };
    }
};

/**
 * Core export-authorization check, called by the export middleware on every
 * export-tagged request.
 *
 * User-level only -- no role-level fallback. No user-level row -> deny by default.
 *
 * IP restriction is now an explicit admin-set flag (`ip_restricted`), not an
 * auto-bind-on-first-export: if a user-level row is enabled and `ip_restricted`
 * is false, the export is allowed regardless of request IP. If `ip_restricted`
 * is true, the request IP must match one of the admin-entered `ip_networks`.
 *
 * @param {boolean} [dryRun] - When true (self-check/"can I export" UI queries, not a
 *   real export attempt): performs the same read-only logic but never writes audit
 *   log rows.
 */
const checkExportPermission = async ({ userId, moduleAlias, requestIp, dryRun = false }) => {
    try {
        const moduleRow = await sequelize.query(
            `SELECT id FROM rbac_modules WHERE alias = ? AND is_deleted = 0 AND is_active = 1 LIMIT 1`,
            { replacements: [moduleAlias], type: QueryTypes.SELECT }
        );
        const moduleId = moduleRow[0]?.id;
        if (!moduleId) {
            return { allowed: false, reason: 'Unknown export module' };
        }

        const userIdBin = userId ? UUID_TO_BIN(userId) : null;
        if (!userIdBin) {
            return { allowed: false, reason: 'blocked' };
        }

        const userRows = await sequelize.query(
            `SELECT id, enabled, ip_restricted, ip_networks FROM export_permissions WHERE owner_type = 'user' AND owner_id = ? AND module_id = ? LIMIT 1`,
            { replacements: [userIdBin, moduleId], type: QueryTypes.SELECT }
        );
        const userRow = userRows[0];

        if (!userRow || !userRow.enabled) {
            if (!dryRun) await logExportEvent({ applicationId: moduleId, moduleAlias, field: 'export_attempt', to: { blocked: true, reason: 'user_disabled' }, updatedBy: userId, ip: requestIp });
            return { allowed: false, reason: 'blocked' };
        }

        if (!userRow.ip_restricted) {
            if (!dryRun) await logExportEvent({ applicationId: moduleId, moduleAlias, field: 'export_attempt', to: { allowed: true }, updatedBy: userId, ip: requestIp });
            return { allowed: true };
        }

        const networks = parseIpNetworks(userRow.ip_networks);
        if (ipMatchesAny(requestIp, networks)) {
            if (!dryRun) await logExportEvent({ applicationId: moduleId, moduleAlias, field: 'export_attempt', to: { allowed: true }, updatedBy: userId, ip: requestIp });
            return { allowed: true };
        }

        if (!dryRun) await logExportEvent({ applicationId: moduleId, moduleAlias, field: 'export_attempt', to: { blocked: true, reason: 'ip_mismatch' }, updatedBy: userId, ip: requestIp });
        return { allowed: false, reason: 'ip_mismatch' };
    } catch (error) {
        console.error('Error checking export permission:', error);
        // Fail closed -- an error in the permission check should never silently allow export.
        return { allowed: false, reason: 'error' };
    }
};

/** Parse the ip_networks JSON column defensively -- MySQL JSON columns come back
 * already-parsed via mysql2, but guard against a raw string just in case. */
function parseIpNetworks(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/** Match an IP against a list of exact IPs or CIDR blocks (IPv4 only for CIDR). */
function ipMatchesAny(ip, networks) {
    if (!ip) return false;
    return networks.some(net => {
        if (!net) return false;
        if (!net.includes('/')) return net === ip;
        return ipInCidr(ip, net);
    });
}

function ipInCidr(ip, cidr) {
    try {
        const [range, bitsStr] = cidr.split('/');
        const bits = parseInt(bitsStr, 10);
        const ipToLong = (addr) => addr.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
        if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip) || !/^\d+\.\d+\.\d+\.\d+$/.test(range)) return false;
        const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
        return (ipToLong(ip) & mask) === (ipToLong(range) & mask);
    } catch {
        return false;
    }
}

/**
 * Flat list of every active module, for the "which module" picker in the
 * unified Add Export Permission screen. Includes parent_id so the FE can
 * render a breadcrumb path (e.g. "Applications > Personal Loan > Bajaj").
 */
const listExportableModules = async () => {
    try {
        const modules = await sequelize.query(
            `SELECT id AS module_id, name AS module_name, alias, parent_id
             FROM rbac_modules m
             WHERE is_deleted = 0 AND is_active = 1
               AND m.alias NOT IN (
                   'dsa_channel_partners_assign_partner', 'dsa_channel_partners_assign_sp',
                   'dsa_channel_partners_bulk_assign_partner', 'dsa_channel_partners_bulk_assign_sp'
               )
               AND (
                   m.alias = 'dsa_channel_partners'
                   OR NOT EXISTS (
                       SELECT 1 FROM rbac_modules child
                       WHERE child.parent_id = m.id AND child.is_deleted = 0 AND child.is_active = 1
                   )
               )
             ORDER BY name ASC`,
            { type: QueryTypes.SELECT }
        );
        return { success: true, statusCode: 200, data: modules };
    } catch (error) {
        console.error('Error listing exportable modules:', error);
        return { success: false, message: 'Error listing modules', statusCode: 500, error: error.message };
    }
};

module.exports = {
    getModulesWithExportPermissions,
    updateExportPermissions,
    checkExportPermission,
    logExportEvent,
    listExportableModules
};

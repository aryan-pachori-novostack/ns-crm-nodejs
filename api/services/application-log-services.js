const { result } = require("lodash");
const { sequelize } = require("../../models");
const { QueryTypes } = require("sequelize");
let ResHelper = require(_pathconst.FilesPath.ResHelper);

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Store change logs in application_logs (from → to, by whom, when).
 * @param {Array<[string, any, any]>} difference - Array of [field, from_value, to_value]
 * @param {string} application_id - Entity id (e.g. lead_id, dsa_id)
 * @param {string} application_type - e.g. 'dsa_lead_update', 'expense_update', 'lead_claim_update'
 * @param {string|null} updated_by - CRM user UUID (who made the change)
 * @param {string|null} ip - Client device IP
 */
const bulkCreate = async (difference, application_id, application_type, updated_by, ip = null) => {
    const validUserUuid = (updated_by && uuidPattern.test(String(updated_by).trim())) ? String(updated_by).trim() : null;
    for (let i = 0; i < difference?.length; i++) {
        let query = `insert into application_logs (application_id, application_type, field, from_value, to_value, updated_by, ip) values (?,?,?,?,?,uuid_to_bin(?),?)`;
        let bindParams = [application_id, application_type, difference[i][0], difference[i][1], difference[i][2], validUserUuid, ip || null];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }
};

const getLog = async ({ application_id, application_type, field }) => {
    let query = `select u.name as user_name, a.application_id, a.from_value, a.to_value, a.createdAt as created_at, a.field as type, a.ip from application_logs a left join users u on a.updated_by = u.id where 1=1 `;
    let bindParams = [];
    if (application_type) {
        query += ` and a.application_type=? `;
        bindParams.push(application_type);
    }
    if (application_id) {
        query += ` and a.application_id=? `;
        bindParams.push(application_id);
    }
    if (field) {
        query += ` and a.field=? `;
        bindParams.push(field);
    }
    query += ` order by a.createdAt desc `;
    let result = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return result;
};
const createExportLog = async (req, type = "post_export", res = null, url = null) => {
    let api = url || `${req.protocol}://${req.hostname}${req.originalUrl}`;
    let user_id = req?.loggedInUser?.id;
    req.body["ip"] = req.socket.remoteAddress;
    let payload = JSON.stringify(req?.body);
    let response = ResHelper.apiResponse("", true, "Success", 200, "", "");

    let query = ` insert into external_api_logs(user_id, api, api_type, payload, response, has_error, error_message, header) values(?,?,?,?,?,?,?,?) `;

    let bindParams = [user_id, api, type, payload, res ? JSON.stringify(res) : JSON.stringify(response), false, "", ""];
    await sequelize.query(query, { type: QueryTypes.INSERT, replacements: bindParams });
    return;
};
const hexToUUID = (hex) => {
    if (!/^[0-9a-fA-F]{32}$/.test(hex)) return null;
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const getActivityLogs = async (results) => {
    try {
        if (!Array.isArray(results) || results.length === 0) {
            return [];
        }

        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const hexPattern = /^[0-9a-f]{32}$/i;

        const crmUserIds = new Set();

        for (const log of results) {
            const fields = ['createdBy', 'from', 'to'];

            fields.forEach(field => {
                const rawValue = typeof log[field] === 'string' ? log[field].trim() : '';
                if (uuidPattern.test(rawValue)) {
                    crmUserIds.add(rawValue);
                } else if (hexPattern.test(rawValue)) {
                    const uuid = hexToUUID(rawValue);
                    if (uuid) crmUserIds.add(uuid);
                }
            });
        }

        const userMap = {};

        if (crmUserIds.size > 0) {
            const uuidBinParams = [...crmUserIds].map(uuid => `uuid_to_bin('${uuid}')`).join(',');
            const usersQuery = `
                SELECT bin_to_uuid(id) AS id, name 
                FROM users 
                WHERE id IN (${uuidBinParams})
            `;
            const users = await sequelize.query(usersQuery, { type: QueryTypes.SELECT });

            users.forEach(user => {
                userMap[user.id.toLowerCase()] = user.name;
            });
        }

        const logsWithNames = results.map(log => {
            const resolve = (value) => {
                if (typeof value !== 'string') return value;
                const trimmed = value.trim();
                const uuid = uuidPattern.test(trimmed) ? trimmed : (hexPattern.test(trimmed) ? hexToUUID(trimmed) : null);
                return uuid && userMap[uuid.toLowerCase()] ? userMap[uuid.toLowerCase()] : value;
            };

            return {
                ...log,
                createdBy: resolve(log.createdBy),
                from: log.from === '-' ? '-' : resolve(log.from),
                to: log.to === '-' ? '-' : resolve(log.to),
            };
        });

        return logsWithNames;

    } catch (error) {
        console.error('Error fetching activity logs:', error);
        return [];
    }
};




const getActivityLogsApp = async (results) => {
   
    try {
        // Extract all unique createdBy values (filter out non-UUID values like 'Admin')
        const createdByValues = [...new Set(results.map(log => log.ref_id))].filter(id => 
            typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        );

        let userMap = {};
        
        if (createdByValues.length > 0) {
            // Convert UUID strings to binary format for the query
            const uuidBinParams = createdByValues.map(uuid => 
                `uuid_to_bin('${uuid}')`).join(',');
            
            // Fetch user names for these createdBy values
            const usersQuery = `
                SELECT bin_to_uuid(id) AS id, name 
                FROM users 
                WHERE id IN (${uuidBinParams})
            `;
              
            const users = await sequelize.query(usersQuery, {
                type: QueryTypes.SELECT
            });

            // Create mapping of user IDs to names
            users.forEach(user => {
                userMap[user.id] = user.name;
            });
           
        }

        // Map names back to results
        const logsWithNames = results.map(log => ({
            ...log,
            ref_id: userMap[log.ref_id] || log.ref_id 
        }));
        return logsWithNames;
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        throw error;
    }
};
module.exports = { bulkCreate, getLog, createExportLog, getActivityLogs, getActivityLogsApp };

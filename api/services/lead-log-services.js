const { sequelize, PicklistValue } = require('../../models');
const { QueryTypes, where } = require('sequelize');
const { v4: uuid } = require('uuid');
let CommonHelper = require(_pathconst.FilesPath.CommonHelper);
const { sendBusinessStartReminder, sendPayoutSharedReminder, sendNotInterestedReminder, sendAssignRsmReminder, sendManagerApprovalReminder, sendWillVisitReminder, sendAssignRsmReminder2 } = require("../../jobs/processors/smsTriggers");

const picklistDependency = ["loan_type", "monthly_disbursement", "bank_leave_duration", "previous_loan_type", "previous_bank_verticle", "previous_bank_department", "prefix", "status", "potential", "category", "profession", "lead_source", "lead_type", "call-log-create", "sub_status"];

const sendSms = ({ status, sub_status, number, name }) => {
    if (status == "Business Started") {
        sendBusinessStartReminder(number);
    }
    if (status == "Payout Shared") {
        sendPayoutSharedReminder(number);
    }
    if (status == "Not Interested") {
        sendNotInterestedReminder(number);
    }
    if (status == "Inprocess" && sub_status == "Assign to RSM") {
        sendAssignRsmReminder2(number, name);
    }
    if (status == "Inprocess" && sub_status == "Manager Approval") {
        sendManagerApprovalReminder(number);
    }
    if (status == "Inprocess" && sub_status == "Will visit Office") {
        sendWillVisitReminder(number)
    }
}

const create = async (data) => {
    let { lead_id, updated_by, type, from, to, operation_type } = data;
    let id = uuid();

    if (picklistDependency?.includes(operation_type)) {
        let data1 = await PicklistValue?.findOne({ where: { id: to }, raw: true });
        to = data1?.value;
    }

    let bindParams = [id, lead_id, updated_by, type, from, to, operation_type];
    let query = ` insert into lead_logs (id, lead_id, updated_by, type_value, from_value, to_value, operation_type) values(uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),?,?,?,?)  `;
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    return true;
}

const bulkCreate = async (data) => {
    let { lead_id, diffrence, updated_by, operation_type, user_mobile, user_fname } = data;
    let smsObj = { number: user_mobile, name: user_fname };
    for (let i = 0; i < diffrence.length; i++) {
        if (picklistDependency?.includes(diffrence[i][0])) {
            let data1 = await PicklistValue?.findOne({ where: { id: diffrence[i][1] }, raw: true });
            diffrence[i][1] = data1?.value || null;

            let data2 = await PicklistValue?.findOne({ where: { id: diffrence[i][2] }, raw: true });
            diffrence[i][2] = data2?.value || null;

            if (diffrence[i][0] == "status" || "sub_status") {
                smsObj[diffrence[i][0]] = data2?.value;
            }
        } else if (diffrence[i][0] == "channel_manager" || diffrence[i][0] == "assigned_to") {
            let query = 'SELECT BIN_TO_UUID(u.id) as id ,u.name as userName,u.isDeleted as isDeleted,u.email as userEmail,u.phone as userPhone,r.role as role ,p.name as parentName, p.email as parentEmail, c.name as creatorName ,u.tokenUpdatedAt as tokenUpdatedAt, c.email as creatorEmail  FROM users u left join roles r on u.role = r.id left join users p on u.parent = p.id left join users c on u.createdBy = c.id  where u.id = uuid_to_bin(?) ';

            if (diffrence[i][1]) {
                let data1 = await sequelize.query(query, { replacements: [diffrence[i][1]], type: QueryTypes.SELECT });
                diffrence[i][1] = data1[0]?.userName;
            } else {
                diffrence[i][1] = null;
            }

            if (diffrence[i][1]) {
                let data2 = await sequelize.query(query, { replacements: [diffrence[i][2]], type: QueryTypes.SELECT });
                diffrence[i][2] = data2[0]?.userName;
            } else {
                diffrence[i][1] = null;
            }
        }
        let id = uuid();
        let bindParams = [id, lead_id, updated_by, diffrence[i][0], diffrence[i][1], diffrence[i][2], operation_type];
        let query = ` insert into lead_logs (id,lead_id , updated_by, type_value, from_value, to_value, operation_type) values(uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),?,?,?,?)  `;
        let result = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }
    sendSms(smsObj);
    return true;
}

const get = async (where, offset, limit) => {
    let bindParams = [];
    let and = false;
    let query = ` select bin_to_uuid(ll.id) as id,bin_to_uuid(ll.lead_id) as lead_id, bin_to_uuid(ll.updated_by) as user_id,l.user_fname as lead_first_name,l.user_lname as lead_last_name,u.name as user_name, ll.type_value as type, ll.from_value as from_value, ll.to_value as to_value, ll.operation_type as operation_type,ll.created_at as created_at from lead_logs ll left join leads l on ll.lead_id = l.id left join users u on ll.updated_by = u.id   `;
    let queryCount = ` select count(*) as totalCount from lead_logs ll left join leads l on ll.lead_id = l.id left join users u on ll.updated_by = u.id   `;
    if (where && where.length != 0) {
        for (let i = 0; i < where.length; i++) {
            if (and == false) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            } else {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (where[i][2]) {
                query += where[i][0] + where[i][1] + ' ? ';
                queryCount += where[i][0] + where[i][1] + ' ? ';
                bindParams.push(where[i][2]);
            } else {
                query += where[i][0] + where[i][1] + ' ';
                queryCount += where[i][0] + where[i][1] + '  ';
            }
        }
    }
    query += ` order by ll.created_at desc limit ${offset},${limit} `;
    let logs = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    for (let i = 0; i < logs.length; i++) {
        logs[i].message = CommonHelper.renderLogMessage({ user_name: logs[i].user_name, lead_first_name: logs[i].lead_first_name, lead_last_name: logs[i].lead_last_name, type: logs[i].type, to_value: logs[i].to_value, from_value: logs[i].from_value, operation_type: logs[i].operation_type });
    }
    let totalCount = await sequelize.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    return { logs, totalCount: totalCount[0].totalCount };
}

/**
 * Check if a file with the same name has already been uploaded by the same user
 * @param {string} userId - The user ID (UUID string)
 * @param {string} fileName - The file name to check
 * @param {string} applicationType - Optional application type filter (default: 'lead_claim_upload')
 * @returns {Promise<boolean>} - Returns true if file already exists, false otherwise
 */
const checkFileAlreadyExists = async (userId, fileName, applicationType = 'lead_claim_upload') => {
    let query = `SELECT * FROM application_logs WHERE updated_by = uuid_to_bin(?) AND application_id = ? AND application_type = ? ORDER BY createdAt DESC LIMIT 1`;
    let bindParams = [userId, fileName, applicationType];
    let result = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return result && result.length > 0;
}

const logLeadErpSubmission = async (leadIds, updatedBy) => {
    if (!leadIds?.length) return;
    
    const values = leadIds.map(id => 
        `('lead_claim_update', '${id}', 'pending_to_erp', 'waiting', 'erp', uuid_to_bin('${updatedBy}'))`
    ).join(", ");

    const query = `INSERT INTO application_logs (application_type, application_id, field, from_value, to_value, updated_by) VALUES ${values}`;
    
    await sequelize.query(query, { type: QueryTypes.INSERT });
}

module.exports = {
    get,
    create,
    bulkCreate,
    checkFileAlreadyExists,
    logLeadErpSubmission
}
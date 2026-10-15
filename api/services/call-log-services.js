const { sequelize, PicklistValue, _db2 } = require('../../models');
const { QueryTypes } = require('sequelize');
const { v4: uuid } = require('uuid');
const { sendRnrReminder } = require('../../jobs/processors/smsTriggers');
const { getChildValues } = require('./picklist-values-services');
const { formatSignupDate } = require('../helpers/commonhelper');

function updateParentTableWithOldStatus(logs, parentTable) {
    // Create a map to store the latest log for each application_id
    const latestLogsMap = {};

    // Iterate through the logs to find the latest entry for each application_id
    logs.forEach(log => {
        if (log.application_type === 'dsa' && log.field === 'dsa_status_name') {
            const appId = log.application_id;
            const currentLog = latestLogsMap[appId];

            if (!currentLog || new Date(log.updatedAt) > new Date(currentLog.updatedAt)) {
                latestLogsMap[appId] = log;
            }
        }
    });

    // Update the parent table with the latest from_value and rearrange the columns
    const updatedParentTable = parentTable.map(entry => {
        const appId = entry.dsa_id;
        const updatedEntry = {
            ...entry, // Spread the entry first
            old_status: latestLogsMap[appId] ? latestLogsMap[appId].from_value : null, // Add old_dsa_status next
        };
        // Swap old_dsa_status and status if they exist in the entry
        if (updatedEntry.old_status !== undefined && updatedEntry.status !== undefined) {
            const { old_status, status, dsa_id, ...rest } = updatedEntry;
            return { status, old_status, ...rest };
        }
        return updatedEntry;
    });

    return updatedParentTable;
};

const createCallLogs = async (user_type, user_id, call_status, remarks, created_by, id) => {
    let query;
    let bindParams;

    let data2 = await PicklistValue?.findOne({ where: { id: call_status }, raw: true });
    if (id) {
        query = ` update call_logs set call_status=?, remarks = ?, updatedAt = ? where id = ? `
        bindParams = [call_status, remarks, new Date(), id];
    } else {
        query = ` insert into  call_logs(user_type,user_id,call_status,remarks,createdBy, createdAt, updatedAt) values (?,?,?,?,?,?,?)`
        bindParams = [user_type, user_id, call_status, remarks, created_by, new Date(), new Date()];
    }
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

    if (user_type == "customer") {
        query = ` select * from ru_customer_metas where customer_id = ? `;
        bindParams = [user_id];
        let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        if (data?.length) {
            query = ` update ru_customer_metas set last_communication_at = ?, updated_at = ? where customer_id = ? `;
            bindParams = [new Date(), new Date(), user_id];
            await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
        } else {
            query = ` INSERT INTO ru_customer_metas (customer_id, last_communication_at, created_at, updated_at) VALUES (?, ?, ?, ?) `;
            bindParams = [user_id, new Date(), new Date(), new Date()];
            await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
        };
    } else {
        query = ` update ru_direct_selling_agents set call_remark_date = ? where dsa_id = ? `
        bindParams = [new Date(), user_id];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    };

    //Sms striggers 
    if (data2?.value == "RNR" && !id) {
        query = `select dsa_mobile_number as mobile from ru_direct_selling_agents where dsa_id = ?`;
        bindParams = [user_id];
        let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        sendRnrReminder(data[0]?.mobile);
    };

    return;
};

const getAllCallLogs = async ({ user_type, user_id, remark, call_status, created_time_end, created_time_start, tags }) => {
    let bindParams = [user_type, user_id];
    let query = ` select tm.tags, c.id, c.createdAt, c.user_type, c.user_id, c.call_status, c.remarks, u.name as createdBy from call_logs c left join users u on c.createdBy = bin_to_uuid(u.id) left join RULoans.ru_tags_master tm on tm.reference_id = c.id where user_type = ? and user_id =? `;

    if (Boolean(remark?.length)) {
        query += ` and remarks like '%${remark}%' `;
    };

    if (Boolean(call_status)) {
        query += ` and call_status = ${call_status} `;
    };

    if (Boolean(tags)) {
        query += ` and tm.tags like "%${tags}%" `;
    };

    if (Boolean(created_time_start)) {
        query += ` and DATE(c.createdAt) between DATE("${created_time_start}") and DATE("${created_time_end}") `;
    };

    query += ` order by c.createdAt DESC `;

    let call_logs = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return call_logs;
    // We didn't need to destructure the result here - the results were returned directly
};

const getCallLogsWithType = async (data) => {
    const { teleCallerId, startDateFilter, endDateFilter, startDateAssignFilter, endDateAssignFilter } = data;

    let query1 = ` select ub.name as assigned_to_name, d.dsa_id, ub.phone as assigned_to, pv.value as call_status from call_logs cl left join RULoans.ru_direct_selling_agents d on BINARY d.dsa_id = BINARY cl.user_id  left join picklist_values pv on cl.call_status = pv.id left join CRMTest.users ub on bin_to_uuid(ub.id) = cl.createdBy where cl.user_type = "dsa" and ub.phone in (?) `;
    let query2 = ` select name, phone as id from CRMTest.users where phone in (?) `;
    let query3 = ` select dsa_mobile_number as id, partner_code as id, count(distinct dsa_mobile_number) as total_assigned from RULoans.ru_direct_selling_agents where partner_code in (?) `;

    if (Boolean(startDateFilter)) {
        query1 += ` and DATE(cl.createdAt) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `;
        query3 += ` and DATE(partner_assigned_date) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `;
    };

    if (Boolean(startDateAssignFilter)) {
        query1 += `and DATE(d.partner_assigned_date) between DATE("${startDateAssignFilter}") and DATE("${endDateAssignFilter}")`;
        query3 += `and DATE(partner_assigned_date) between DATE("${startDateAssignFilter}") and DATE("${endDateAssignFilter}")`;
    };

    query1 += ` group by cl.id `;
    query3 += ` group by partner_code `;

    let bindParams = [teleCallerId];
    let call_logs = await sequelize.query(query1, { replacements: bindParams, type: QueryTypes.SELECT });

    bindParams = [teleCallerId];
    let users = await sequelize.query(query2, { replacements: bindParams, type: QueryTypes.SELECT });
    let total_assigned = await sequelize.query(query3, { replacements: bindParams, type: QueryTypes.SELECT });

    for (i = 0; i < users?.length; i++) {
        let count = total_assigned?.filter((obj) => obj?.id == users[i]?.id);
        users[i]["total_assigned"] = count[0]?.total_assigned || 0;
    };

    return { users, call_logs }
};

const getCallReport = async (data) => {
    const { users, call_logs } = await getCallLogsWithType(data);
    let result = [];
    let totalObj = { assigned_to_name: "Grand Total", assigned_to: uuid(), rnr: 0, spoken: 0, total_assigned: 0, total_called: 0 }
    for (let i = 0; i < users?.length; i++) {
        let obj = { assigned_to_name: users[i]?.name, assigned_to: users[i].id, rnr: 0, spoken: 0, total_assigned: users[i]?.total_assigned, total_called: 0 };
        let details = call_logs.filter((obj) => obj?.assigned_to == users[i].id);
        if (details) {
            let rnrCount = details.filter((obj) => obj?.call_status == "RNR")?.length;
            let spokenCount = details.filter((obj) => obj?.call_status == "Spoken")?.length;
            let totalCount = rnrCount + spokenCount;
            obj["rnr"] = rnrCount;
            obj["spoken"] = spokenCount;
            obj["total_called"] = totalCount;
            totalObj["rnr"] += rnrCount;
            totalObj["spoken"] += spokenCount;
            totalObj["total_called"] += totalCount;
            totalObj["total_assigned"] += obj["total_assigned"];
        }
        result.push(obj)
    }
    return [...result, totalObj];
};

const getCallReportWithComments = async (data) => {
    const { teleCallerId, startDateFilter, endDateFilter, startDateAssignFilter, endDateAssignFilter } = data;
    let query = ` select d.dsa_id, d.profession, d.full_name as partner_name, d.partner_assigned_date, pp.full_name as previous_partner_name, d.email_address as email, d.dsa_mobile_number as mobile, (d.signup_steps_completed/6)*100 as signup_steps, case when d.user_type is null then "channel_partner" else d.user_type end as user_type, d.home_address_city as city, d.home_address_state as state, ds.value as status, p.full_name as caller_name, pv.value as call_status, cl.remarks as comments, ub.name as createdBy, cl.createdAt from call_logs cl left join RULoans.ru_direct_selling_agents d on BINARY d.dsa_id = BINARY cl.user_id left join  RULoans.ru_direct_selling_agents p on p.dsa_mobile_number = d.partner_code left join  RULoans.ru_direct_selling_agents pp on pp.dsa_mobile_number = d.previous_partner_code left join picklist_values pv on cl.call_status = pv.id left join users ub on bin_to_uuid(ub.id) = cl.createdBy left join picklist_values ds on ds.id = d.dsa_status where ub.phone in (?) `;

    if (Boolean(startDateFilter)) {
        query += `and DATE(cl.createdAt) between DATE("${startDateFilter}") and DATE("${endDateFilter}")`;
    };

    if (Boolean(startDateAssignFilter)) {
        query += `and DATE(d.partner_assigned_date) between DATE("${startDateAssignFilter}") and DATE("${endDateAssignFilter}")`;
    };

    let bindParams = [teleCallerId];
    let call_logs = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    let dsa_id = [];
    for (i = 0; i < call_logs?.length; i++) {
        dsa_id.push(call_logs[i]?.dsa_id)
    };

    if (dsa_id?.length) {
        let queryLogs = ` WITH latest_updates AS (
            SELECT
                application_id,
                MAX(updatedAt) AS latest_update
            FROM
                application_logs
            GROUP BY
                application_id
        )
        SELECT
            al.*
        FROM
            application_logs al
        INNER JOIN latest_updates lu 
            ON al.application_id = lu.application_id 
            AND al.updatedAt = lu.latest_update
        WHERE
            al.field = 'dsa_status_name' 
            AND al.application_id IN (?) `;
        let update_logs = await sequelize.query(queryLogs, { replacements: [dsa_id], type: QueryTypes.SELECT });
        call_logs = updateParentTableWithOldStatus(update_logs, call_logs);
    };

    // console.log(call_logs);
    return call_logs;
};

const getPendingCallCount = async (data) => {
    const { teleCallerId, startDateFilter, endDateFilter, status } = data;
    let query = ` select STRAIGHT_JOIN SQL_NO_CACHE p.full_name, 
    ( select count(*) from RULoans.ru_direct_selling_agents where partner_code = d.partner_code ${status?.length ? ` and dsa_status in (${status}) ` : ""} ) as total_count, 
    ( select count(*) from RULoans.ru_direct_selling_agents where partner_code = d.partner_code ${status?.length ? ` and dsa_status in (${status}) ` : ""} ) - count(distinct d.dsa_id ) as total_called, 
    count(distinct d.dsa_id) as total_pending 
    from RULoans.ru_direct_selling_agents d inner join RULoans.ru_direct_selling_agents p on d.partner_code = p.dsa_mobile_number where d.partner_code in (?) `;
    // from RULoans.ru_direct_selling_agents d inner join RULoans.ru_direct_selling_agents p on d.partner_code = p.dsa_mobile_number inner join call_logs cl on cl.user_id = binary d.dsa_id where d.partner_code in (?) `;

    if (Boolean(startDateFilter)) {
        query += ` and ( DATE(d.call_remark_date) not between DATE("${startDateFilter}") and DATE("${endDateFilter}") or d.call_remark_date is null ) `;
    };

    if (status?.length) {
        query += ` and (d.dsa_status in (${status}) or d.dsa_status is null) `
    };

    query += ` group by d.partner_code `

    let bindParams = [teleCallerId];
    let result = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    return result;
};

const getDsaStatusChangedByUser = async (data) => {
    const { teleCallerId, startDateFilter, endDateFilter, status } = data;

    let statusList = await getChildValues({ module: "Customer", key: "Status", parent_id: null });

    if (status?.length) {
        statusList = statusList.filter((obj) => status.includes(obj?.value))
    };

    let exportQuery = "";
    for (i = 0; i < statusList?.length; i++) {
        exportQuery += `, CASE WHEN pv.value = '${statusList[i]?.label}' THEN count(al.to_value) END AS '${statusList[i]?.label}' `;
    };

    let query = ` select u.phone, u.name, 
    (select count(distinct dsa_id) from RULoans.ru_direct_selling_agents where binary partner_code = u.phone) as total_assigned,
    count(distinct al.application_id) as status_changed
    ${exportQuery}
    from application_logs al inner join users u on al.updated_by = u.id inner join picklist_values pv on pv.id =  al.to_value where al.field = "dsa_status" and u.phone in (?) `;

    if (Boolean(startDateFilter)) {
        query += ` and DATE(al.createdAt) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `;
    };

    if (status?.length) {
        query += ` and al.to_value in (${status}) `
    };

    query += ` group by al.updated_by, al.to_value `;

    let bindParams = [teleCallerId];
    let result = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let resultArr = [];

    for (i = 0; i < teleCallerId?.length; i++) {
        let data = result?.filter((obj) => obj?.phone == teleCallerId[i]);
        if (data?.length) {
            const { name, phone, total_assigned, status_changed, ...rest } = data[i]
            const obj = { name, phone, total_assigned, status_changed };
            const staticKeys = ["name", "phone", "total_assigned", "status_changed"];
            const keys = Object.keys(data[i]);
            for (j = 0; j < data?.length; j++) {
                for (k = 0; k < keys?.length; k++) {
                    if (!staticKeys?.includes(keys[k])) {
                        if (data[j][keys[k]]) {
                            if (!obj[keys[k]]) {
                                obj[keys[k]] = 0
                            }
                            obj[keys[k]] = obj[keys[k]] + data[j][keys[k]] ? data[j][keys[k]] : 0;
                        }
                    }
                }
            }
            resultArr.push(obj)
        }
    };

    return resultArr;
};

const getCallReportWithCommentsB2C = async (data) => {
    const { teleCallerId, startDateFilter, endDateFilter, startDateAssignFilter, endDateAssignFilter } = data;
    let query = ` select c.full_name as customer_name, d.full_name as caller_name, pv.value as call_status, cl.remarks as comments, ub.name as createdBy, cl.createdAt from call_logs cl left join RULoans.ru_customers c on BINARY c.customer_id = BINARY cl.user_id left join RULoans.ru_direct_selling_agents d on BINARY c.dsa_mobile_number = d.dsa_mobile_number  left join picklist_values pv on cl.call_status = pv.id left join users ub on bin_to_uuid(ub.id) = cl.createdBy where ub.phone in (?) `;

    if (Boolean(startDateFilter)) {
        query += `and DATE(cl.createdAt) between DATE("${startDateFilter}") and DATE("${endDateFilter}")`;
    };

    let bindParams = [teleCallerId];
    let call_logs = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    return call_logs;
};

const getCallLogsWithTypeB2C = async (data) => {
    const { teleCallerId, startDateFilter, endDateFilter } = data;

    let query1 = ` select ub.name as assigned_to_name, ub.phone as assigned_to, pv.value as call_status from call_logs cl left join picklist_values pv on cl.call_status = pv.id left join CRMTest.users ub on bin_to_uuid(ub.id) = cl.createdBy where cl.user_type = 'customer' and ub.phone in (?) `;
    let query2 = ` select name, phone as id from CRMTest.users where phone in (?) `;
    let query3 = ` select dsa_mobile_number as id, count(distinct dsa_mobile_number) as total_assigned from RULoans.ru_customers where dsa_mobile_number in (?) `;
    if (Boolean(startDateFilter)) {
        query1 += ` and DATE(cl.createdAt) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `;
    };

    query1 += ` group by cl.id `;
    query3 += ` group by dsa_mobile_number `;

    let bindParams = [teleCallerId];
    let call_logs = await sequelize.query(query1, { replacements: bindParams, type: QueryTypes.SELECT });

    console.log(call_logs, "===")

    bindParams = [teleCallerId];
    let users = await sequelize.query(query2, { replacements: bindParams, type: QueryTypes.SELECT });
    let total_assigned = await sequelize.query(query3, { replacements: bindParams, type: QueryTypes.SELECT });

    for (i = 0; i < users?.length; i++) {
        let count = total_assigned?.filter((obj) => obj?.id == users[i]?.id);
        users[i]["total_assigned"] = count[0]?.total_assigned || 0;
    };

    return { users, call_logs }
};

const getCallReportB2C = async (data) => {
    const { users, call_logs } = await getCallLogsWithTypeB2C(data);
    let result = [];
    let totalObj = { assigned_to_name: "Grand Total", assigned_to: uuid(), rnr: 0, spoken: 0, total_assigned: 0, total_called: 0 }
    for (let i = 0; i < users?.length; i++) {
        let obj = { assigned_to_name: users[i]?.name, assigned_to: users[i].id, rnr: 0, spoken: 0, total_assigned: users[i]?.total_assigned, total_called: 0 };
        let details = call_logs.filter((obj) => obj?.assigned_to == users[i].id);
        if (details) {
            let rnrCount = details.filter((obj) => obj?.call_status == "RNR")?.length;
            let spokenCount = details.filter((obj) => obj?.call_status == "Spoken")?.length;
            let totalCount = rnrCount + spokenCount;
            obj["rnr"] = rnrCount;
            obj["spoken"] = spokenCount;
            obj["total_called"] = totalCount;
            totalObj["rnr"] += rnrCount;
            totalObj["spoken"] += spokenCount;
            totalObj["total_called"] += totalCount;
            totalObj["total_assigned"] += obj["total_assigned"];
        }
        result.push(obj)
    }
    return [...result, totalObj];
};

const getPendingCallCountB2C = async (data) => {
    const { teleCallerId, startDateFilter, endDateFilter } = data;
    let query = ` select STRAIGHT_JOIN SQL_NO_CACHE dsa.full_name, 
    ( select count(*) from RULoans.ru_customers where dsa_mobile_number = d.dsa_mobile_number ) as total_count, 
    ( select count(*) from RULoans.ru_customers where dsa_mobile_number = d.dsa_mobile_number ) - count(distinct d.customer_id ) as total_called, 
    count(distinct d.customer_id) as total_pending 
    from RULoans.ru_customers d left join RULoans.ru_direct_selling_agents dsa on dsa.dsa_mobile_number = d.dsa_mobile_number left join RULoans.ru_customer_metas dm on dm.customer_id = d.customer_id where d.dsa_mobile_number in (?) `;

    if (Boolean(startDateFilter)) {
        query += ` and ( DATE(dm.last_communication_at) not between DATE("${startDateFilter}") and DATE("${endDateFilter}") or dm.last_communication_at is null ) `;
    };

    query += ` group by d.dsa_mobile_number `

    let bindParams = [teleCallerId];
    let result = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    return result;
};

const createCustomerSlashRtc = async (data) => {
    let id = uuid();
    const { phone, customerName, campaignId, campaignName } = data;

    if (campaignName == "B2C") {
        let query = ` insert into ru_customers (dsa_id, dsa_mobile_number, customer_id, customer_mobile_number, full_name, utm_medium, utm_campaign, campaign_id, source_from) values (?,?,?,?,?,?,?,?,4)  `
        let bindParams = ["703c6c65-62a1-4934-bf70-87eb32d734c4", "9999999999", id, phone, customerName || null, "Slash-RTC", campaignName || null, campaignId || null];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    };

    if (campaignName == "B2B") {
        let query = ` insert into ru_direct_selling_agents (dsa_id, dsa_mobile_number, full_name, utm_medium, utm_campaign, campaignid, signup_steps_completed, signup_date) values (?,?,?,?,?,?,?,?)  `
        let bindParams = [id, phone, customerName || null, "Slash-RTC", campaignName || null, campaignId || null, 1, formatSignupDate(new Date())];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    };

    return id;
};

const createCallLogSlashRtc = async (data) => {
    const { user_id, employeeId, disposeComment, campaignName, firstDispose, referenceId, leadSetId, leadSetName, processId, processName, modeOfCalling, callStartDatetime, callEndDatetime, disconnectedBy, recordUrl, agentTalkTimesec, callTransferFlag, numberOfHold, disposeTime, customerPhoneAnswered, customerHangupCause, agentHangupCause, customerPstnHangupCause, agentPstnHangupCause } = data;
    let user_type = campaignName == "B2C" ? "customer" : "dsa";

    let query = ` select pv.* from modules m left join picklist_keys pk on m.id = pk.module_id left join picklist_values pv on pv.key_id = pk.id where m.value = "Call" and pk.value = "Status" and pv.value = ? `;
    let bindParams = [firstDispose];
    let picklist = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    query = ` insert into call_logs (call_status, user_type, user_id, remarks, createdBy, disposition, call_id, createdAt, updatedAt, lead_set_id, lead_set_name, process_id, process_name, mode_of_calling, call_start_datetime, call_end_datetime, disconnected_by, record_url, agent_talk_time_sec, call_transfer_flag, number_of_hold, dispose_time, customer_phone_answered, customer_hangup_cause, agent_hangup_cause, customer_pstn_hangup_cause, agent_pstn_hangup_cause, json_response) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) `;
    bindParams = [picklist[0]?.id || null, user_type, user_id || null, disposeComment || null, employeeId || null, firstDispose || null, referenceId || null, new Date(), new Date(), leadSetId || null, leadSetName || null, processId || null, processName || null, modeOfCalling || null, callStartDatetime || null, callEndDatetime || null, disconnectedBy || null, recordUrl || null, agentTalkTimesec || null, callTransferFlag || null, numberOfHold || null, disposeTime || null, customerPhoneAnswered || null, customerHangupCause || null, agentHangupCause || null, customerPstnHangupCause || null, agentPstnHangupCause || null, JSON.stringify(data)];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

    return;
};

function hasAnyAlias(conditions, aliases) {
    const flat = conditions.flat();
    return aliases.some(alias =>
        flat.some(item => typeof item === 'string' && item.includes(alias))
    );
};

const getCallLogs = async (data) => {
    let { offset, limit, whereFilterQuery, logicOperator, loggedInUser, sortBy, sortDirection } = data;
    logicOperator = logicOperator || `and`;

    let sales_query = !["CEO", "CTO"]?.includes(loggedInUser?.role) ? `WITH RECURSIVE user_tree AS (SELECT u.id,
                                    u.name,
                                    u.parent,
                                    u.phone,
                                    CAST(bin_to_uuid(u.id) AS CHAR(200)) AS path
                             FROM CRMTest.users u
                             WHERE u.status = 1
                               AND u.isDeleted = 0
                               AND (u.sales_admin = "${loggedInUser?.id}" or u.id = uuid_to_bin("${loggedInUser?.id}"))

                             UNION ALL

                             SELECT c.id,
                                    c.name,
                                    c.parent,
                                    c.phone,
                                    CONCAT(ut.path, ',', bin_to_uuid(c.id))
                             FROM CRMTest.users c
                                      INNER JOIN user_tree ut ON c.parent = ut.id
                             WHERE c.status = 1 and FIND_IN_SET(bin_to_uuid(c.id), ut.path) = 0)` : "";

    let query = ` ${sales_query} SELECT d.full_name as dsa_name, d.salesperson_assigned_date, c.id, c.createdAt, c.user_type, c.user_id, c.call_status, c.remarks, status.value as dsa_status, sub_status.value as dsa_sub_status, call_status.value as call_status, d.hierarchy_crm, sp.name as sales_person 
    from call_logs c
    left join RULoans.ru_direct_selling_agents d on d.dsa_id = c.user_id 
    left join RULoans.picklist_values status on d.dsa_status = status.id
    left join RULoans.picklist_values sub_status on d.dsa_sub_status = sub_status.id
    left join picklist_values call_status on c.call_status = call_status.id
    left join users sp on sp.id = uuid_to_bin(d.salesperson_id) ${sales_query ? ` where c.createdBy REGEXP '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' and uuid_to_bin(c.createdBy) in (select id from user_tree)` : ""} `;

    let queryCount = `${sales_query} select count(distinct c.id) as totalCount from call_logs c 
    left join picklist_values call_status on c.call_status = call_status.id
    ${hasAnyAlias(whereFilterQuery, [`status.`, `sub_status`, `sp.`, `d.`]) ? `left join RULoans.ru_direct_selling_agents d on d.dsa_id = c.user_id` : ""}`;

    queryCount += sales_query ? ` where c.createdBy REGEXP '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' and uuid_to_bin(c.createdBy) in (select id from user_tree)` : "";

    let and = sales_query ? true : false;
    let bindParams = [];

    if (whereFilterQuery && whereFilterQuery.length != 0) {
        for (let i = 0; i < whereFilterQuery.length; i++) {
            if (and == false) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            } else {
                if (i == 0) {
                    query += ` and `;
                    queryCount += ` and `;
                    and = true;
                }
                else {
                    query += ` ${logicOperator} `;
                    queryCount += ` ${logicOperator} `;
                    and = true;
                }
            }
            // Check if operator is IS NULL or IS NOT NULL - these don't need parameter placeholders
            const operator = whereFilterQuery[i][1]?.trim().toLowerCase() || '';
            const isNullOperator = operator === 'is null' || operator === 'is not null';
            
            if (isNullOperator || whereFilterQuery[i][2] === null || whereFilterQuery[i][2] === undefined || whereFilterQuery[i][2] === '') {
                // For IS NULL/IS NOT NULL or when value is null/undefined/empty, don't add parameter placeholder
                query += whereFilterQuery[i][0] + whereFilterQuery[i][1] + ' ';
                queryCount += whereFilterQuery[i][0] + whereFilterQuery[i][1] + ' ';
            } else {
                query += whereFilterQuery[i][0] + whereFilterQuery[i][1] + ' ? ';
                queryCount += whereFilterQuery[i][0] + whereFilterQuery[i][1] + ' ? ';
                bindParams.push(whereFilterQuery[i][2]);
            }
        };
    };
    query += ` order by ${sortBy || "createdAt"} ${sortDirection || "DESC"} limit ${offset}, ${limit} `;

    let records = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let count = await sequelize.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });

    count = count[0]?.totalCount || 0;
    return { records, totalRecords: count };
};

module.exports = {
    createCallLogs,
    getAllCallLogs,
    getCallReport,
    getCallReportWithComments,
    getPendingCallCount,
    getDsaStatusChangedByUser,
    getCallReportWithCommentsB2C,
    getCallReportB2C,
    getPendingCallCountB2C,
    createCustomerSlashRtc,
    createCallLogSlashRtc,
    getCallLogs
};
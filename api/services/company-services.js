const { _db2 } = require('../../models');
const { QueryTypes } = require('sequelize');
const { generateWhereClause, mapObjectKeys } = require('../helpers/commonhelper');
const { sqlPreferredBankAccountJoinByCompanyId } = require('../helpers/apiFieldMappings');
const { createActivityLogKafka } = require('./kafka-services');

// Generic raw SELECT query executor
exports.runRawQuery = async (query, bindParams = []) => {
    const records = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return records;
};

exports.getAllCompany = async (offset, limit, where, user_query = "", orderBy = "") => {
    const queryWhere = (where || "").replace(/\bru_companies\./g, 'rc.');
    let query = ` ${user_query || ""} SELECT DISTINCT rc.*, rca.city, rca.state, rca.country, rca.pin_code FROM ru_companies rc LEFT JOIN (SELECT rca.* FROM (SELECT rca.*, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY created_at DESC) AS rn FROM ru_company_addresses rca) rca WHERE rca.rn = 1) rca ON rc.company_id = rca.company_id LEFT JOIN ru_direct_selling_agents dsa ON rc.company_id = dsa.company_id ${queryWhere} `;
    if (orderBy) {
        query += ` order by ${orderBy.replace(/\bru_companies\./g, 'rc.')} `;
    }
    query += limit ? ` limit ${offset}, ${limit} ` : "";
    let records = await _db2.query(query, { type: QueryTypes.SELECT });

    query = ` ${user_query || ""} select count(distinct rc.id) as count from ru_companies rc LEFT JOIN ru_direct_selling_agents dsa ON rc.company_id = dsa.company_id ${queryWhere} `;
    let totalRecords = await _db2.query(query, { type: QueryTypes.SELECT });

    return { records, totalRecords: totalRecords[0]?.count || 0 };
};

exports.getCompanyDetailsById = async (where) => {
    let query = ` SELECT rc.*, rca.city, rca.state, rca.country, rca.pin_code, dsa.dsa_mobile_number as registered_by_mobile FROM ru_companies rc left join ru_direct_selling_agents dsa on dsa.dsa_id = rc.registered_by  LEFT JOIN (SELECT rca.* FROM ru_company_addresses rca INNER JOIN (SELECT company_id, MAX(created_at) AS latest_created_at FROM ru_company_addresses GROUP BY company_id) latest ON rca.company_id = latest.company_id AND rca.created_at = latest.latest_created_at) rca ON rc.company_id = rca.company_id ${where || ""} `;
    let data = await _db2.query(query, { type: QueryTypes.SELECT });
    return { records: data[0] || null };
};

exports.getAllCompanyDocuments = async (company_id) => {
    let basePath = process.env.S3_BASE_PATH;
    let getImageUrl = (column) => {
        let url = `case when ${column} in ("dsaDocuments/", "") then null when ${column} like "%${basePath}%" then ${column} else Concat("${basePath}", ${column}) end as ${column?.split(".")[1]}`;
        return url;
    };
    let query = ` select c.*, ${getImageUrl("c.doc_path")} from ru_company_documents c where company_id = ? `;
    let bindParams = [company_id];
    let records = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return { records };
};


exports.fetchCompanyWithOwnership = async (id, key = "pan") => {
    where = key?.includes("=") ? key : ` ${key} = ?`;
    let query = ` select * from ru_companies where ${where} `;
    let bindParams = [id];
    let records = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let response = null;

    if (records[0]) {
        query = ` select * from ru_company_documents where company_id = ? `;
        bindParams = [records[0]?.company_id];
        let documents = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

        query = ` select * from ru_company_addresses where company_id = ? `;
        bindParams = [records[0]?.company_id];
        let addresses = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

        response = records?.length ? { ...records[0], documents, addresses } : null;
    };

    return response;
};

exports.selectServiceDynamic = async (table, where, join = null, columns = null, array = false) => {
    columns = columns || `*`;
    let query = ` select ${columns} from ${table} p ${join || ""} where ${where} `;
    let records = await _db2.query(query, { type: QueryTypes.SELECT });

    let data = records[0] || null;
    return array ? records : data;
};

exports.upsertDataSingleTable = async (data, table, where = false, log_data) => {
    if (!data || Object.keys(data).length === 0) {
        throw new Error("No data provided for upsert");
    };

    console.log(data, "====");
    data = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
    );

    Object.keys(data).forEach(key => {
        if (data[key] === '' || (typeof data[key] === 'string' && data[key].trim() === '')) {
            data[key] = null;
        }
    });

    let keys = Object.keys(data);
    let values = Object.values(data);

    const insertClause = keys.map((key) => `${key}`).join(", ");
    let old_data = {};

    if (where) {
        let query = ` select ${insertClause} from ${table} ${generateWhereClause(where)} `;
        let isExisting = await _db2.query(query, { type: QueryTypes.SELECT });
        isExisting = isExisting[0];

        if (isExisting) {
            const setClause = keys.map((key) => `${key} = ?`).join(", ");
            const updateQuery = `update ${table} set ${setClause} ${generateWhereClause(where)}`;
            await _db2.query(updateQuery, { replacements: values, type: QueryTypes.UPDATE });
            old_data = isExisting || {};
        }

        else {
            const placeholders = keys.map(() => '?').join(", ");
            let query = ` insert into ${table} (${insertClause}) values (${placeholders}) `;
            await _db2.query(query, { replacements: values, type: QueryTypes.INSERT });
        };
    }

    else {
        const placeholders = keys.map(() => '?').join(", ");
        let query = ` insert into ${table} (${insertClause}) values (${placeholders}) `;
        await _db2.query(query, { replacements: values, type: QueryTypes.INSERT });
    };


    let mapping = {
        "name": ["first_name", "first"],
        "age": ["years_old", "yrs"]
    };

    createActivityLogKafka({ ...log_data, old_data: mapObjectKeys(old_data, mapping), new_data: mapObjectKeys(data, mapping) });
    return;
};

exports.getCompanyDetailsByKey = async (value, searchBy = 'pan') => {
    let whereCondition;
    if (searchBy === 'company_id') {
        whereCondition = 'rc.company_id = ?';
    } else {
        whereCondition = 'rc.pan = ?';
    }

    let query = ` select dsa.assigning_payout_percentage, dsa.full_name as vendor_name, dsa.email_address as vendor_email, rc.ns_internal_id as netsuite_vendor_id , p.dsa_id as partner_id, p.full_name, dsa.materialized_path , dsa.hierarchy_crm, dsa.dsa_id as registered_by_id, dsa.business_head_code, rc.pan as permanent_account_number, dsa.dsa_mobile_number as dsa_mobile_number, rc.company_id as dsa_id , 0 as is_blacklisted , 0 as is_deleted , null as class_id , null as ns_hierarchy , company_bank.account_number, company_bank.status as account_status  from ru_companies rc left join ru_direct_selling_agents dsa on dsa.dsa_id = rc.registered_by left join ru_direct_selling_agents p on dsa.partner_code = p.dsa_mobile_number ${sqlPreferredBankAccountJoinByCompanyId("company_bank", "rc.company_id")} where ${whereCondition} `;
    let bindParams = [value];
    let records = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return records[0] || null;
};

exports.handleCompanyOnboardingSteps = async (dsa_id) => {
    const companySteps = ['company_details', 'company_address', 'company_agreement'];

    for (const step of companySteps) {
        // Check if step exists
        const existingStep = await _db2.query(
            `SELECT id FROM ru_user_onboarding_steps WHERE dsa_id = ? AND step = ?`,
            { replacements: [dsa_id, step], type: QueryTypes.SELECT }
        );

        if (existingStep.length > 0) {
            // Update existing step
            await _db2.query(
                `UPDATE ru_user_onboarding_steps SET status = 0 WHERE dsa_id = ? AND step = ?`,
                { replacements: [dsa_id, step], type: QueryTypes.UPDATE }
            );
        } else {
            // Insert new step
            await _db2.query(
                `INSERT INTO ru_user_onboarding_steps (dsa_id, step, status) VALUES (?, ?, 0)`,
                { replacements: [dsa_id, step], type: QueryTypes.INSERT }
            );
        }
    }
};

exports.getDsasByCompanyId = async (company_id, pageNumber = 0, pageSize = 10, search = '') => {
    let offset = pageNumber * pageSize;
    let whereClause = 'WHERE company_id = ? AND is_deleted = 0';
    let bindParams = [company_id];

    if (search && search.trim()) {
        whereClause += ` AND (full_name LIKE ? OR dsa_mobile_number LIKE ? OR email_id LIKE ?)`;
        let searchPattern = `%${search.trim()}%`;
        bindParams.push(searchPattern, searchPattern, searchPattern);
    }

    // Get total count
    let countQuery = `SELECT COUNT(*) as totalCount FROM ru_direct_selling_agents ${whereClause}`;
    let countResult = await _db2.query(countQuery, { replacements: bindParams, type: QueryTypes.SELECT });
    let totalCount = countResult[0].totalCount;

    // Get paginated results
    let dataQuery = `SELECT dsa_id as customer_id, full_name as customer_full_name, dsa_mobile_number, company_id, is_deleted FROM ru_direct_selling_agents ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    let dataBindParams = [...bindParams, pageSize, offset];
    let results = await _db2.query(dataQuery, { replacements: dataBindParams, type: QueryTypes.SELECT });

    return { results, totalCount };
};
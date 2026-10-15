let axios = require("axios");
const { reportsBaseUrl } = require("../helpers/constantdata/config");
const querystring = require('querystring');
const { QueryTypes } = require("sequelize");
const { LOAN_TYPE_REGISTRY } = require("../helpers/commonhelper");
const { type } = require("os");
const CustomerServices = require("./customer-services");
const { _db2 } = require("../../models");

const tables = Object.entries(LOAN_TYPE_REGISTRY)
    // remove credit_card, registry aliases (lap/las) and loan_against_security (not reported before the registry refactor)
    .filter(([key, value]) => key !== "credit_card" && key !== "loan_against_security" && !value.is_alias)
    .map(([key, value]) => ({
        main: value.table_name,
        meta: value.meta_table,
        key
    }));


const getLntReport = (data) => {
    return new Promise(async (resolve, reject) => {
        try {
            const queryParams = querystring.stringify(data);
            const url = reportsBaseUrl + 'getLntReports?' + queryParams;
            const response = await axios.get(url);
            resolve(response.data);
        } catch (error) {
            reject(error);
        }
    });
};

function groupAndSum(data, groupByKey) {
    return Object.values(
        data.reduce((acc, item) => {
            const key = item[groupByKey]; // dynamically choose the column to group by

            if (!acc[key]) {
                // initialize with current item (convert numeric strings to numbers)
                acc[key] = { ...item };
                for (let k in acc[key]) {
                    if (!isNaN(acc[key][k])) {
                        acc[key][k] = Number(acc[key][k]);
                    }
                }
            } else {
                // sum up numeric values
                for (let k in item) {
                    if (!isNaN(item[k])) {
                        acc[key][k] += Number(item[k]);
                    }
                }
            }

            return acc;
        }, {})
    );
};

const getBusinessReport = async (data = {}) => {
    let { loan_type_filter, status_filter, city_filter, report_type = "lender_wise", dsa_id, limit = 50, offset = 0, start_date, end_date, date_type, state } = data;

    // type mappings
    let typeMapping = {
        lender_wise: {
            select_field: "rlp.product_name",
            group_field: "lender,loan_type",
            select_alias: "lender",
            frontend_columns: ["loan_type", "lender", "total_applications", "disbursed_applications", "approved_applications", "disbursed_loan_amount"]
        },
        city_wise: {
            select_field: "ca.city",
            group_field: "city",
            select_alias: "city",
            frontend_columns: ["city", "total_applications", "disbursed_applications", "approved_applications", "disbursed_loan_amount"]
        }
    };

    const allExist = (loan_type_filter && loan_type_filter?.length) ? loan_type_filter.every(type => tables.some(tbl => tbl.key === type)) : true;

    if (!allExist) {
        return {
            columns: typeMapping[report_type].frontend_columns,
            data: { records: [], totalRecords: 0 },
            status: false,
            message: "Some loan types are still unavaialble for reporting."
        };
    };

    // loan tables
    let table_filtered = tables;
    if (loan_type_filter) {
        table_filtered = tables.filter(t => loan_type_filter.includes(t.key));
    };

    // build union query (include status in SELECT for filtering)
    const COLLATION = "utf8mb4_general_ci"; // or match your DB default collation

    const unionQueries = table_filtered.map(tbl => {
        return `
        SELECT
            '${tbl.key}' AS loan_type,
            CONVERT(${typeMapping[report_type].select_field} USING utf8mb4) COLLATE ${COLLATION} AS ${typeMapping[report_type].select_alias},
            CONVERT(pl.status USING utf8mb4) COLLATE ${COLLATION} AS status,
            pl.id,
            d.materialized_path,
            pl.disbursed_loan_amount,
            ca.state
        FROM ${tbl.main} pl
        LEFT JOIN ${tbl.meta} pm ON pm.application_id = pl.application_id
        LEFT JOIN \`${process.env.DATABASE3_NAME}\`.ru_loans_products rlp ON rlp.id = pl.product_id and rlp.status = 1
        LEFT JOIN RULoans.ru_customer_addresses ca  ON ca.id = pl.address_id
        LEFT JOIN ru_direct_selling_agents d ON d.dsa_id = pl.dsa_id ${start_date ? `where DATE(${date_type}) between "${start_date}" and "${end_date}"` : ""}
    `;
    }).join(" UNION ALL ");


    // wrap and apply filters before aggregation
    const query = `
        WITH combined AS (
            ${unionQueries}
        )
        SELECT loan_type, ${typeMapping[report_type].select_alias}, 
              COUNT(DISTINCT id) AS total_applications,
              COUNT(DISTINCT CASE WHEN status = 'disbursed' THEN id END) AS disbursed_applications,
              COUNT(DISTINCT CASE WHEN status = 'approved' THEN id END) AS approved_applications,
              SUM(CASE WHEN status = 'disbursed' THEN disbursed_loan_amount ELSE 0 END) AS disbursed_loan_amount
              
        FROM combined
        WHERE loan_type is not null and ${typeMapping[report_type].select_alias} is not null
        ${loan_type_filter ? ` AND loan_type IN (:loan_type)` : ""}
        ${city_filter ? ` AND ${typeMapping[report_type].select_alias} IN (:city_filter)` : ""}
         ${state ? ` AND state LIKE CONCAT('%', :state, '%')` : ""}
        ${status_filter ? ` AND status IN (:status_filter)` : ""}
        ${dsa_id ? ` AND materialized_path like "%${dsa_id}%"` : ""}
        GROUP BY ${typeMapping[report_type].group_field} order by ${date_type == "pm.disbursed_date" ? `disbursed_applications` : `total_applications`} desc  LIMIT :limit OFFSET :offset
    `;


    const countQuery = ` WITH combined AS (
            ${unionQueries}
        )
        SELECT count(distinct ${typeMapping[report_type].select_alias}) AS count
        FROM combined
        WHERE loan_type is not null and ${typeMapping[report_type].select_alias} is not null
        ${loan_type_filter ? ` AND loan_type IN (:loan_type)` : ""}
        ${city_filter ? ` AND ${typeMapping[report_type].select_alias} IN (:city_filter)` : ""}
        ${state ? ` AND state LIKE CONCAT('%', :state, '%')` : ""}
        ${status_filter ? ` AND status IN (:status_filter)` : ""}
        ${dsa_id ? ` AND materialized_path like "%${dsa_id}%"` : ""}`;

    // execute query
    const rows = await _db2.query(query, {
        replacements: {
            loan_type: loan_type_filter || [],
            city_filter: city_filter || [],
            state: state || null,
            status_filter: status_filter || [],
            limit,
            offset
        },
        type: QueryTypes.SELECT
    });

    const totalCount = await _db2.query(countQuery, {
        replacements: {
            loan_type: loan_type_filter || [],
            city_filter: city_filter || [],
            state,
            status_filter: status_filter || []
        },
        type: QueryTypes.SELECT
    });

    return {
        columns: typeMapping[report_type].frontend_columns,
        data: {
            records: rows,
            totalRecords: totalCount[0]?.count || 0
        },
        status: true
    };
};


const getSalesReport = async ({ offset, limit, where, where_dsa, type, call_status, where_query }) => {
    // Fetch picklist statuses
    let query = `SELECT pv.value, pv.id 
                 FROM picklist_values pv 
                 LEFT JOIN picklist_keys pk ON pv.key_id = pk.id 
                 LEFT JOIN modules m ON m.id = pk.module_id 
                 WHERE m.value = 'Call' AND pk.value = 'Status'
                 ${call_status ? `AND pv.value = "${call_status}"` : ""}`;
    const status_list = await _db2.query(query, { type: QueryTypes.SELECT });
    const lookup = Object.fromEntries(status_list.map(item => [item.id, item.value]));
    const status_ids = status_list.map(obj => obj.id);

    // Common latest_logs CTE
    const latest_logs = `WITH latest AS (
    SELECT cl.*
    FROM CRMTest.call_logs cl
    INNER JOIN (
        SELECT user_id, MAX(createdAt) AS max_createdAt
        FROM CRMTest.call_logs
        WHERE user_type = 'dsa'
          AND ${where_query}
        GROUP BY user_id
    ) AS t
    ON cl.user_id = t.user_id
    AND cl.createdAt = t.max_createdAt
    WHERE cl.user_type = 'dsa' AND cl.call_status IN (${status_ids}) ${where ? `AND ${where}` : ""})

    ${where_dsa ? `, latest_address AS (
        SELECT dsa.dsa_id,
               COALESCE(lda.city, dsa.home_address_city) AS city,
               COALESCE(lda.state, dsa.home_address_state) AS state
        FROM ru_direct_selling_agents dsa
        LEFT JOIN (
            SELECT ra.*, ROW_NUMBER() OVER (PARTITION BY ra.dsa_id ORDER BY ra.id DESC) AS rn
            FROM ru_dsa_addresses ra
        ) lda ON lda.dsa_id = dsa.dsa_id AND lda.rn = 1
        WHERE dsa.dsa_id IS NOT NULL ${where_dsa ? `AND ${where_dsa}` : ""}
    )` : ""}`;

    let report;
    let totalCount;

    // counts_only
    if (type === "count") {
        query = `${latest_logs} 
                 SELECT COUNT(DISTINCT cl.user_id) AS count, cl.call_status
                 FROM latest cl
                 ${where_dsa ? `INNER JOIN latest_address lad ON lad.dsa_id = cl.user_id` : ""}
                 INNER JOIN ru_direct_selling_agents dsa ON dsa.dsa_id = cl.user_id
                 WHERE cl.user_type = 'dsa'
                 GROUP BY cl.call_status`;
        const result = await _db2.query(query, { type: QueryTypes.SELECT });
        report = {
            records: result.map(item => ({
                ...item,
                call_status: lookup[item.call_status] || item.call_status,
                columns: ["call_status", "count"]
            }))
        };
    }

    // caller summary counts
    else if (type === "detail") {
        query = `${latest_logs} 
            SELECT cl.createdBy, cl.call_status, COUNT(DISTINCT cl.user_id) AS user_count, u.name AS created_by, cl.createdBy as created_by_id
            FROM latest cl
            LEFT JOIN CRMTest.users u ON bin_to_uuid(u.id) = cl.createdBy
            ${where_dsa ? `INNER JOIN latest_address lad ON lad.dsa_id = cl.user_id` : ""}
            INNER JOIN ru_direct_selling_agents dsa ON dsa.dsa_id = cl.user_id
            WHERE cl.user_type = 'dsa'
            GROUP BY cl.createdBy, cl.call_status, u.name
            ORDER BY u.name`;

        const counts = await _db2.query(query, { type: QueryTypes.SELECT });

        const grouped = {};
        counts.forEach(c => {
            if (!grouped[c.createdBy]) grouped[c.createdBy] = { created_by_id: c.created_by_id, created_by: c.created_by, call_status_counts: [] };
            grouped[c.createdBy].call_status_counts.push(`${lookup[c.call_status] || c.call_status}:${c.user_count}`);
        });

        const allRecords = Object.values(grouped).map(item => ({
            created_by: item.created_by,
            created_by_id: item.created_by_id,
            call_status_counts: item.call_status_counts.join(" | ")
        }));

        totalCount = allRecords.length;
        const records = allRecords.slice(offset, offset + limit);

        report = { records, totalRecords: totalCount, columns: ["created_by", "call_status_counts"] };
    }

    // full caller details
    else if (type === "details_by_user") {
        // fetch data with offset/limit
        query = `${latest_logs} SELECT cl.id, cl.user_id as dsa_id, CONCAT_WS(' ', dsa.first_name, dsa.middle_name, dsa.last_name) AS dsa_full_name,  cl.remarks, CASE WHEN cl.id IS NOT NULL THEN 'Done' ELSE 'Pending' END AS tag, cl.call_status, DATE(cl.createdAt) as created_at, u.name as created_by 
        FROM latest cl left 
        join CRMTest.users u on bin_to_uuid(u.id) = cl.createdBy 
        ${where_dsa ? `inner join latest_address lad on lad.dsa_id = cl.user_id` : ""}
        inner join ru_direct_selling_agents dsa on dsa.dsa_id = cl.user_id
        where cl.user_type = "dsa" order by cl.id desc limit ${offset}, ${limit} `;
        report = await _db2.query(query, { type: QueryTypes.SELECT });

        let queryCount = `${latest_logs} SELECT count(distinct dsa.id) as count 
        FROM latest cl 
        left join CRMTest.users u on bin_to_uuid(u.id) = cl.createdBy 
        ${where_dsa ? `inner join latest_address lad on lad.dsa_id = cl.user_id` : ""}
        inner join ru_direct_selling_agents dsa on dsa.dsa_id = cl.user_id
        where cl.user_type = "dsa"`;
        totalCount = await _db2.query(queryCount, { type: QueryTypes.SELECT });


        let tags = `SELECT * from ru_tags_master where reference_id in (?)`;
        tags = report?.length ? await _db2.query(tags, { replacements: [report?.map((obj) => obj?.id)], type: QueryTypes.SELECT }) : [];
        const lookup_tags = Object.fromEntries(tags.map(item => [item.reference_id, item.tags]));

        report = {
            records: report.map(item => ({
                ...item,
                call_status: lookup[item.call_status] || item.call_status,
                tag: lookup_tags[item.id] || "Pending"
            })),
            totalRecords: totalCount[0]?.count || 0,
            columns: ["dsa_id", "dsa_full_name", "remarks", "tag", "call_status", "created_at", "created_by"],
        };
    };

    return report;
};

const getLeadResponseTimeSqlSnippets = (metric, dsaAlias = 'c', callLogAlias = 'cl', inlineCallLogTarget = null) => {
    const targetTime = metric === 'assignment' 
        ? `${dsaAlias}.salesperson_assigned_date` 
        : (inlineCallLogTarget || `${callLogAlias}.first_call_time`);
    
    const baseTime = metric === 'assignment' 
        ? (dsaAlias === 'la' ? `${dsaAlias}.created_at` : `${dsaAlias}.partner_assigned_date`) 
        : `${dsaAlias}.salesperson_assigned_date`;

    // Adjust baseTime: 
    // 1. If Sunday, move to Monday 10:00
    // 2. If after 20:00 (8 PM), move to 10:00 next day
    // 3. Special case: if baseTime is between 18:00 (6 PM) and 20:00:
    //    - If called (targetTime) same day between 18:00 and 20:00, consider same day (use original baseTime)
    //    - Else consider 10:00 next working day
    // 4. If before 10:00, move to 10:00 same day
    const adjustedBaseTime = `
        CASE 
            WHEN DAYOFWEEK(${baseTime}) = 1 -- Sunday
            THEN TIMESTAMP(DATE_ADD(DATE(${baseTime}), INTERVAL 1 DAY), '10:00:00')
            WHEN TIME(${baseTime}) >= '20:00:00' 
            THEN CASE 
                WHEN DAYOFWEEK(DATE_ADD(DATE(${baseTime}), INTERVAL 1 DAY)) = 1 -- Next day is Sunday
                THEN TIMESTAMP(DATE_ADD(DATE(${baseTime}), INTERVAL 2 DAY), '10:00:00')
                ELSE TIMESTAMP(DATE_ADD(DATE(${baseTime}), INTERVAL 1 DAY), '10:00:00')
            END
            WHEN TIME(${baseTime}) >= '18:00:00' AND TIME(${baseTime}) < '20:00:00'
            THEN CASE 
                WHEN DATE(${targetTime}) = DATE(${baseTime}) AND TIME(${targetTime}) BETWEEN '18:00:00' AND '20:00:00'
                THEN ${baseTime}
                ELSE CASE 
                    WHEN DAYOFWEEK(DATE_ADD(DATE(${baseTime}), INTERVAL 1 DAY)) = 1 -- Next day is Sunday
                    THEN TIMESTAMP(DATE_ADD(DATE(${baseTime}), INTERVAL 2 DAY), '10:00:00')
                    ELSE TIMESTAMP(DATE_ADD(DATE(${baseTime}), INTERVAL 1 DAY), '10:00:00')
                END
            END
            WHEN TIME(${baseTime}) < '10:00:00'
            THEN TIMESTAMP(DATE(${baseTime}), '10:00:00')
            ELSE ${baseTime}
        END`;

    const sundays = `FLOOR((DATEDIFF(${targetTime}, ${adjustedBaseTime}) + DAYOFWEEK(${adjustedBaseTime}) - 1) / 7)`;

    const adjM = `GREATEST(TIMESTAMPDIFF(MINUTE, ${adjustedBaseTime}, ${targetTime}) - (CASE WHEN ${targetTime} IS NOT NULL THEN ${sundays} * 10 * 60 ELSE 0 END), 0)`;
    
    const adjD = `GREATEST(FLOOR((TIMESTAMPDIFF(MINUTE, ${adjustedBaseTime}, ${targetTime}) - (CASE WHEN ${targetTime} IS NOT NULL THEN ${sundays} * 10 * 60 ELSE 0 END)) / (10 * 60)), 0)`;

    return { targetTime, baseTime, sundays, adjustedBaseTime, adjM, adjD };
};

const getLeadResponseTimeCountSelect = (adjM, adjD, idCol = '*') => {
    return `
        COUNT(${idCol}) as total_leads,
        COUNT(CASE WHEN ${adjD} > 1 THEN 1 END) as 2_plus_day,
        COUNT(CASE WHEN ${adjD} = 1 THEN 1 END) as next_day,
        COUNT(CASE WHEN ${adjD} = 0 AND ${adjM} > 480 THEN 1 END) as same_day,
        COUNT(CASE WHEN ${adjD} = 0 AND ${adjM} BETWEEN 241 AND 480 THEN 1 END) as hour_4_8,
        COUNT(CASE WHEN ${adjD} = 0 AND ${adjM} BETWEEN 0 AND 240 THEN 1 END) as hour_0_4
    `;
};

const formatLeadResponseTimeRows = (records, telecallerCol = 'telecaller') => {
    return records.map(item => {
        const hour_0_4 = Number(item.hour_0_4 || 0);
        const hour_4_8 = Number(item.hour_4_8 || 0);
        const same_day = Number(item.same_day || 0);
        const next_day = Number(item.next_day || 0);
        const two_plus_day = Number(item['2_plus_day'] || 0);
        const total_leads = Number(item.total_leads || 0);

        const assigned = hour_0_4 + hour_4_8 + same_day + next_day + two_plus_day;
        const remainder = total_leads - assigned;

        const result = {
            business_head: item.business_head,
            total_leads,
            hour_0_4,
            hour_4_8,
            same_day,
            next_day,
            '2_plus_day': two_plus_day,
            next_day_plus: next_day + two_plus_day, // For DSA Report
            unassigned_leads: remainder,           // For DSA Report
            not_called: remainder                  // For Customer Report
        };

        if (item[telecallerCol] !== undefined) {
            result[telecallerCol] = item[telecallerCol] || 'Unassigned';
        }

        return result;
    });
};

const dsaLeadResponseTimeReport = async (data = {}, isExport = false) => {
    let { business_head, start_date, end_date, limit = 10, offset = 0, type = "summary", metric = "call", bh_code } = data;

    let replacements = { limit: parseInt(limit), offset: parseInt(offset) };

    // --- BH INNER JOIN conditions (bh.* alias, goes into ON clause) ---
    let bhExtraClauses = [`bh.partner_code = '9987884000'`];
    if (business_head) {
        bhExtraClauses.push(`CONCAT_WS(' ', bh.first_name, NULLIF(bh.middle_name,''), bh.last_name) LIKE :business_head`);
        replacements.business_head = `%${business_head}%`;
    }

    const { targetTime, adjM, adjD, baseTime } = getLeadResponseTimeSqlSnippets(metric, 'c', 'cl');

    // --- Outer WHERE conditions ---
    let dsaWhereClauses = [];
    
    if (start_date) {
        dsaWhereClauses.push(`${baseTime} >= :start_date`);
        replacements.start_date = `${start_date} 00:00:00`;
    }
    if (end_date) {
        dsaWhereClauses.push(`${baseTime} < :end_date`);
        replacements.end_date = `${end_date} 23:59:59`;
    }
    if (bh_code) {
        dsaWhereClauses.push(`bh.dsa_mobile_number = :bh_code`);
        replacements.bh_code = `${bh_code}`;
    }

    const bh_name_expr = `TRIM(CONCAT_WS(' ', bh.first_name, NULLIF(bh.middle_name,''), bh.last_name))`;
    let select_columns = `${bh_name_expr} as business_head`;
    let group_by = `bh.dsa_mobile_number`;
    let frontend_columns = ["business_head", "total_leads", "hour_0_4", "hour_4_8", "same_day", "next_day_plus", "unassigned_leads"];

    let usersJoin = "";
    if (type === "detailed") {
        usersJoin = `LEFT JOIN CRMTest.users u ON u.id = UUID_TO_BIN(c.salesperson_id)`;
        select_columns = `${bh_name_expr} as business_head, CASE WHEN COALESCE(u.name, u.email) IS NOT NULL THEN COALESCE(u.name, u.email) ELSE 'Unassigned' END as telecaller`;
        group_by = `bh.dsa_mobile_number, COALESCE(u.name, u.email)`;
        frontend_columns = ["business_head", "telecaller", "total_leads", "hour_0_4", "hour_4_8", "same_day", "next_day_plus", "unassigned_leads"];
    }

    const outerWhereStr = dsaWhereClauses.length > 0 ? `WHERE ${dsaWhereClauses.join(" AND ")}` : "";
    const bhJoinExtra = bhExtraClauses.length > 0 ? `AND ${bhExtraClauses.join(" AND ")}` : "";

    const query = `
        SELECT
            ${select_columns},
           ${getLeadResponseTimeCountSelect(adjM, adjD, 'c.dsa_id')}
            
        FROM ru_direct_selling_agents c
        INNER JOIN ru_direct_selling_agents bh ON c.business_head_code = bh.dsa_mobile_number ${bhJoinExtra}
        ${metric === 'call' ? `
        LEFT JOIN (
            SELECT user_id, createdBy, DATE_SUB(MIN(createdAt), INTERVAL '5:30' HOUR_MINUTE) as first_call_time
            FROM CRMTest.call_logs
            WHERE user_type = 'dsa' 
              ${start_date ? 'AND DATE_SUB(createdAt, INTERVAL "5:30" HOUR_MINUTE) >= :start_date' : ''}
            GROUP BY user_id, createdBy
        ) cl ON cl.user_id = c.dsa_id AND cl.createdBy = ${CustomerServices.getSalespersonIdSnippet('c')} COLLATE utf8mb4_0900_ai_ci
        ` : ''}
        ${usersJoin}
        ${outerWhereStr}
        GROUP BY ${group_by}
        ORDER BY bh.dsa_mobile_number DESC
        ${isExport ? '' : 'LIMIT :limit OFFSET :offset'}
    `;

    const countQuery = `
        SELECT COUNT(*) as count FROM (
            SELECT 1
            FROM ru_direct_selling_agents c
            INNER JOIN ru_direct_selling_agents bh ON c.business_head_code = bh.dsa_mobile_number ${bhJoinExtra}
            ${usersJoin}
            ${outerWhereStr}
            GROUP BY ${group_by}
        ) as t
    `;


    const rows = await _db2.query(query, {
        replacements,
        type: QueryTypes.SELECT
    });

    const addUnassignedLeads = (data) => {
        return formatLeadResponseTimeRows(data, 'telecaller');
    };

    if (isExport) {
        return { records: addUnassignedLeads(rows), status: true };
    };

    const totalCount = await _db2.query(countQuery, {
        replacements,
        type: QueryTypes.SELECT
    });

    return {
        columns: frontend_columns,
        records: addUnassignedLeads(rows),
        totalRecords: totalCount[0]?.count || 0,
        status: true
    };
};


const customerLeadAssignToCallReport = async (data = {}, isExport = false) => {
    let { telecaller, start_date, end_date, limit = 10, offset = 0, metric = 'call' } = data;

    let replacements = { limit: parseInt(limit), offset: parseInt(offset) };

    const { targetTime, adjM, adjD, baseTime } = getLeadResponseTimeSqlSnippets(metric, 'la', 'cl');

    // --- WHERE on loan_applications ---
    let whereClauses = [`la.salesperson_id IS NOT NULL`, `la.salesperson_id != ''`];
    if (start_date) {
        whereClauses.push(`${baseTime} >= :start_date`);
        replacements.start_date = `${start_date} 00:00:00`;
    }
    if (end_date) {
        whereClauses.push(`${baseTime} < :end_date`);
        replacements.end_date = `${end_date} 23:59:59`;
    }

    if (telecaller) {
        whereClauses.push(`COALESCE(sp.name, sp.email) LIKE :telecaller`);
        replacements.telecaller = `%${telecaller}%`;
    }

    const outerWhereStr = `WHERE ${whereClauses.join(' AND ')}`;

    const query = `
        SELECT
            COALESCE(sp.name, sp.email, 'Unassigned') as telecaller,
            ${getLeadResponseTimeCountSelect(adjM, adjD, 'la.id')}
        FROM loan_applications la
        ${CustomerServices.getSalespersonJoinSnippet('la', 'sp')}
        ${metric === 'call' ? `
        LEFT JOIN (
            SELECT entity_type_id, created_by, MIN(created_at) as first_call_time
            FROM ru_call_logs
            WHERE entity = 'customer' AND entity_type = 'leads'
              ${start_date ? 'AND created_at >= :start_date' : ''}
            GROUP BY entity_type_id, created_by
        ) cl ON cl.entity_type_id = la.id AND cl.created_by = ${CustomerServices.getSalespersonIdSnippet('la')}
        ` : ''}
        ${outerWhereStr}
        GROUP BY la.salesperson_id
        ORDER BY total_leads DESC
        ${isExport ? '' : 'LIMIT :limit OFFSET :offset'}
    `;

    const countQuery = `
        SELECT COUNT(*) as count FROM (
            SELECT 1
            FROM loan_applications la
            ${CustomerServices.getSalespersonJoinSnippet('la', 'sp')}
            ${outerWhereStr}
            GROUP BY la.salesperson_id
        ) as t
    `;

    const rows = await _db2.query(query, { replacements, type: QueryTypes.SELECT });

    if (isExport) {
        return { records: formatLeadResponseTimeRows(rows), status: true };
    }

    const totalCount = await _db2.query(countQuery, { replacements, type: QueryTypes.SELECT });
    return {
        records: formatLeadResponseTimeRows(rows),
        totalRecords: totalCount[0]?.count || 0,
        status: true
    };
};

module.exports = {
    getLntReport,
    getBusinessReport,
    getSalesReport,
    dsaLeadResponseTimeReport,
    getLeadResponseTimeSqlSnippets,
    customerLeadAssignToCallReport
};

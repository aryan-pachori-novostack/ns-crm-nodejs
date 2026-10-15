const { sequelize, _db2 } = require("../../models");
const { QueryTypes } = require('sequelize');

const getOnboardingGraph = async (startDateFilter, endDateFilter, childPhones) => {
    let query = ' SELECT signup_steps_completed as step, count(*) as step_count from ru_direct_selling_agents ';
    if (startDateFilter) {
        query += ` where DATE(created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `;
    };
    if (childPhones) {
        query += ` and (dsa_mobile_number in (
            WITH RECURSIVE DSAHierarchy AS(
                SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = '${childPhones}'
                UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
            ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
        )) `
    };
    query += `group by signup_steps_completed order by signup_steps_completed asc`;
    let dsa = await _db2.query(query, { type: QueryTypes.SELECT });
    let mapping = {
        1: "16% (Mobile Number Verified)",
        2: "33% (DSA Basic Details Saved)",
        3: "50% (DSA Address Details Saved)",
        4: "66% (KYC Completed)",
        5: "83% (DSAJoining Agreement Signed)",
        6: "100% (Payout Agreement Signed)"
    };
    let keys = Object.keys(mapping);
    let resultObj = {};
    for (i = 0; i < keys?.length; i++) {
        resultObj[mapping[i + 1]] = Boolean(dsa[i]?.step) ? dsa[i]?.step_count : 0;
    }
    let labels = Object.keys(resultObj);
    let data = Object.values(resultObj);
    return { labels, data };
};

const getUserTypeGraph = async (startDateFilter, endDateFilter, childPhones) => {
    let query = ` select case when user_type is null then "channel_partner" else user_type end as user_type, count(*) as user_type_count from ru_direct_selling_agents  `;
    if (startDateFilter) {
        query += ` where DATE(created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `
    };
    if (childPhones) {
        query += ` and (dsa_mobile_number in (
            WITH RECURSIVE DSAHierarchy AS(
                SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = '${childPhones}'
                UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
            ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
        )) `
    };
    query += `group by user_type order by user_type asc`
    let dsa = await _db2.query(query, { type: QueryTypes.SELECT });

    let parsedDsa = { channel_partner: 0, customer: 0, referal_partner: 0 };
    for (i = 0; i < dsa?.length; i++) {
        parsedDsa[dsa[i]?.user_type] += dsa[i]?.user_type_count;
    }

    let labels = Object.keys(parsedDsa);
    let data = Object.values(parsedDsa);

    return { labels, data };
}

const getDsaSourceGraph = async (startDateFilter, endDateFilter, childPhones) => {
    let query = ` select utm_main_source, count(utm_main_source) as utm_main_source_count from ru_direct_selling_agents `;
    if (startDateFilter) {
        query += ` where DATE(created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `
    };
    if (childPhones) {
        query += ` and (dsa_mobile_number in (
            WITH RECURSIVE DSAHierarchy AS(
                SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = '${childPhones}'
                UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
            ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
        )) `
    };
    query += `group by utm_main_source order by utm_main_source asc`
    let dsa = await _db2.query(query, { type: QueryTypes.SELECT });
    let parsedDsa = {};
    for (i = 0; i < dsa?.length; i++) {
        if (dsa[i]?.utm_main_source) {
            if (parsedDsa[dsa[i]?.utm_main_source]) {
                parsedDsa[dsa[i]?.utm_main_source] += dsa[i]?.utm_main_source_count;
            } else {
                parsedDsa[dsa[i]?.utm_main_source] = dsa[i]?.utm_main_source_count;
            }
        }
    }

    let labels = Object.keys(parsedDsa);
    let data = Object.values(parsedDsa);

    return { labels, data };
}

const getDsaStatusGraph = async (type, startDateFilter, endDateFilter, childPhones) => {
    const column = { dsa_status: "dsa_status" };
    let query = ` select case when pv.value is null then "Cold" else pv.value end as value from modules m left join picklist_keys pk on pk.module_id = m.id left join picklist_values pv on pv.key_id = pk.id where m.value = "Customer" and pk.value = "Status" `;
    let picklistValues = await sequelize.query(query, { type: QueryTypes.SELECT });
    let parsedDsa = {};
    for (i = 0; i < picklistValues?.length; i++) {
        parsedDsa[picklistValues[i]?.value] = 0;
    };

    query = ` select case when pv.value is null then "Cold" else pv.value end as value, count(pv.value) as value_count from ru_direct_selling_agents l left join picklist_values pv on l.${column[type]} = pv.id where l.${column[type]} is not null `;
    if (startDateFilter) {
        query += ` and DATE(l.created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `
    };
    if (childPhones) {
        query += ` and (l.dsa_mobile_number in (
            WITH RECURSIVE DSAHierarchy AS(
                SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = '${childPhones}'
                UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
            ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
        )) `
    };
    query += ` group by l.${column[type]} `
    let leads = await _db2.query(query, { type: QueryTypes.SELECT });

    for (i = 0; i < leads?.length; i++) {
        parsedDsa[leads[i]?.value] += leads[i]?.value_count;
    }

    let labels = Object.keys(parsedDsa);
    let data = Object.values(parsedDsa);

    return { labels, data };
}

const getPayoutAgreementGraph = async (startDateFilter, endDateFilter, childPhones) => {
    let query = ` select case when is_payout_agreement_signed = 0 then "no" else "yes" end as status_name, count(*) as status_count from ru_dsa_kyc_data  `;
    if (startDateFilter) {
        query += ` where DATE(created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `
    };
    if (childPhones) {
        query += ` and (dsa_mobile_number in (
            WITH RECURSIVE DSAHierarchy AS(
                SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = '${childPhones}'
                UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
            ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
        )) `
    };
    query += `group by is_payout_agreement_signed`
    let count = await _db2.query(query, { type: QueryTypes.SELECT });

    let parsedCount = { yes: 0, no: 0 };
    if (count?.length) {
        for (i = 0; i < count?.length; i++) {
            let { status_name, status_count } = count[i];
            parsedCount[status_name] = status_count;
        };
    }

    let labels = Object.keys(parsedCount);
    let data = Object.values(parsedCount);

    return { labels, data };
}

const verificationStatusGraph = async (startDateFilter, endDateFilter, childPhones) => {
    let query = ` select dsa_verification_status as status_name, count(*) as status_count from ru_direct_selling_agents `;
    if (startDateFilter) {
        query += ` where DATE(created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `
    };
    if (childPhones) {
        query += ` and (dsa_mobile_number in (
            WITH RECURSIVE DSAHierarchy AS(
                SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = '${childPhones}'
                UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
            ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
        )) `
    };
    query += `group by dsa_verification_status`
    let count = await _db2.query(query, { type: QueryTypes.SELECT });

    let parsedCount = { unverified: 0, verified: 0, pending: 0 };
    if (count?.length) {
        for (i = 0; i < count?.length; i++) {
            let { status_name, status_count } = count[i];
            parsedCount[status_name] = status_count;
        };
    }

    let labels = Object.keys(parsedCount);
    let data = Object.values(parsedCount);

    return { labels, data };
};

const agreementSignedGraph = async (startDateFilter, endDateFilter, childPhones) => {
    let query = ` select case when is_mou_signed = 0 then "no" else "yes" end as status_name, count(is_mou_signed) as status_count from ru_dsa_kyc_data  `;
    if (startDateFilter) {
        query += ` where DATE(created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `
    };
    if (childPhones) {
        query += ` and (dsa_mobile_number in (
            WITH RECURSIVE DSAHierarchy AS(
                SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = '${childPhones}'
                UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
            ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
        )) `
    };
    query += `group by is_mou_signed`
    let count = await _db2.query(query, { type: QueryTypes.SELECT });

    let parsedCount = { yes: 0, no: 0 };
    if (count?.length) {
        for (i = 0; i < count?.length; i++) {
            let { status_name, status_count } = count[i];
            parsedCount[status_name] = status_count;
        };
    }

    let labels = Object.keys(parsedCount);
    let data = Object.values(parsedCount);

    return { labels, data };
};

const getLeadFormGraph = async (where, bifurcation) => {
    let query = ` SELECT 
    SUM(CASE  WHEN flc.fresh_lead_status_id=13 and flc.is_deleted = 0 THEN 1 ELSE 0 END) AS waiting,
    SUM(CASE WHEN flc.fresh_lead_status_id = 13 AND flc.is_deleted = 0 THEN ROUND(disbursement_amount) ELSE 0 END) AS total_amount,

    SUM(CASE  WHEN flc.fresh_lead_status_id=0 and flc.is_deleted = 0 THEN 1 ELSE 0 END) AS pending,
    SUM(CASE WHEN flc.fresh_lead_status_id = 0 AND flc.is_deleted = 0 THEN ROUND(disbursement_amount) ELSE 0 END) AS pending_amount,

    SUM(CASE  WHEN flc.fresh_lead_status_id not in (0,13) and flc.is_deleted = 0 THEN 1 ELSE 0 END) AS sent_to_erp,
    SUM(CASE WHEN flc.fresh_lead_status_id NOT IN (0, 13) AND flc.is_deleted = 0 THEN ROUND(disbursement_amount) ELSE 0 END) AS sent_to_erp_amount,

    SUM(CASE  WHEN flc.is_deleted = 1 THEN 1 ELSE 0 END) AS deleted,
    SUM(CASE WHEN flc.is_deleted = 1 THEN ROUND(disbursement_amount) ELSE 0 END) AS deleted_amount,

    SUM(CASE WHEN flc.fresh_lead_status_id  in (1,6) and flc.is_deleted = 0 THEN 1 ELSE 0 END) AS approved, 
    SUM(CASE WHEN flc.fresh_lead_status_id IN (1, 6) and flc.is_deleted = 0 THEN ROUND(disbursement_amount) ELSE 0 END) AS approved_amount,

    SUM(CASE  WHEN flc.fresh_lead_status_id  in (2,5,9,10,11,12) and flc.is_deleted = 0 THEN 1 ELSE 0 END) AS wip,
    SUM(CASE WHEN flc.fresh_lead_status_id IN (2, 5, 9, 10, 11, 12) and flc.is_deleted = 0 THEN ROUND(disbursement_amount) ELSE 0 END) AS wip_amount,

    SUM(CASE  WHEN flc.fresh_lead_status_id  in (4) and flc.is_deleted = 0 THEN 1 ELSE 0 END) AS not_found,
        SUM(CASE WHEN flc.fresh_lead_status_id IN (4) and flc.is_deleted = 0 THEN ROUND(disbursement_amount) ELSE 0 END) AS not_found_amount,

    SUM(CASE  WHEN flc.fresh_lead_status_id  in (3,7,8) and flc.is_deleted = 0 THEN 1 ELSE 0 END) AS error,
    SUM(CASE WHEN flc.fresh_lead_status_id IN (3, 7, 8) and flc.is_deleted = 0 THEN ROUND(disbursement_amount) ELSE 0 END) AS error_amount    

    FROM ru_fresh_lead_claims flc ${where} ${bifurcation || ""} `;
    let data = await _db2.query(query, { type: QueryTypes.SELECT });
    return data[0] || null;
};

const getLeadFormGraphMIS = async (offset, limit, where, bifurcation) => {
    let query = ` 
    SELECT 
        d.full_name AS dsa_name, 
        flc.dsa_mobile_number AS dsa_mobile, 

        SUM(CASE WHEN flc.fresh_lead_status_id = 13 AND flc.is_deleted = 0 THEN 1 ELSE 0 END) AS waiting,
        SUM(CASE WHEN flc.fresh_lead_status_id = 13 AND flc.is_deleted = 0 THEN ROUND(disbursement_amount) ELSE 0 END) AS waiting_amount,

        SUM(CASE WHEN flc.fresh_lead_status_id = 0 AND flc.is_deleted = 0 THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN flc.fresh_lead_status_id = 0 AND flc.is_deleted = 0 THEN ROUND(disbursement_amount) ELSE 0 END) AS pending_amount,

        SUM(CASE WHEN flc.fresh_lead_status_id NOT IN (0, 13) AND flc.is_deleted = 0 THEN 1 ELSE 0 END) AS sent_to_erp,
        SUM(CASE WHEN flc.fresh_lead_status_id NOT IN (0, 13) AND flc.is_deleted = 0 THEN ROUND(disbursement_amount) ELSE 0 END) AS sent_to_erp_amount,

        SUM(CASE WHEN flc.is_deleted = 1 THEN 1 ELSE 0 END) AS deleted,
        SUM(CASE WHEN flc.is_deleted = 1 THEN ROUND(disbursement_amount) ELSE 0 END) AS deleted_amount,

        SUM(CASE WHEN flc.fresh_lead_status_id IN (1, 6) and flc.is_deleted = 0 THEN 1 ELSE 0 END) AS approved, 
        SUM(CASE WHEN flc.fresh_lead_status_id IN (1, 6) and flc.is_deleted = 0 THEN ROUND(disbursement_amount) ELSE 0 END) AS approved_amount, 

        SUM(CASE WHEN flc.fresh_lead_status_id IN (2, 5, 9, 10, 11, 12) and flc.is_deleted = 0 THEN 1 ELSE 0 END) AS wip,
        SUM(CASE WHEN flc.fresh_lead_status_id IN (2, 5, 9, 10, 11, 12) and flc.is_deleted = 0 THEN ROUND(disbursement_amount) ELSE 0 END) AS wip_amount,

        SUM(CASE WHEN flc.fresh_lead_status_id IN (4) and flc.is_deleted = 0 THEN 1 ELSE 0 END) AS not_found,
        SUM(CASE WHEN flc.fresh_lead_status_id IN (4) and flc.is_deleted = 0 THEN ROUND(disbursement_amount) ELSE 0 END) AS not_found_amount,

        SUM(CASE WHEN flc.fresh_lead_status_id IN (3, 7, 8) and flc.is_deleted = 0 THEN 1 ELSE 0 END) AS error,
        SUM(CASE WHEN flc.fresh_lead_status_id IN (3, 7, 8) and flc.is_deleted = 0 THEN ROUND(disbursement_amount) ELSE 0 END) AS error_amount    

    FROM ru_fresh_lead_claims flc LEFT JOIN ru_direct_selling_agents d ON d.dsa_mobile_number = flc.dsa_mobile_number ${where} ${bifurcation || ""} `;

    let total = await _db2.query(query, { type: QueryTypes.SELECT });

    if (total?.length) {
        total[0].dsa_name = "Total";
        total[0].dsa_mobile = "-";
    };

    query += ` group by flc.dsa_mobile_number `;
    if (limit) {
        query += ` order by flc.created_at desc limit ${offset}, ${limit} `
    };

    let data = await _db2.query(query, { type: QueryTypes.SELECT });
    data = [...total, ...data];

    let queryCount = ` select count(distinct flc.dsa_mobile_number) as totalCount FROM ru_fresh_lead_claims flc left join ru_direct_selling_agents d on d.dsa_mobile_number = flc.dsa_mobile_number ${where} ${bifurcation || ""} `;
    let totalCount = await _db2.query(queryCount, { type: QueryTypes.SELECT });
    return { records: data || null, totalRecords: totalCount[0]?.totalCount || 0 };
};

module.exports = {
    getOnboardingGraph,
    getUserTypeGraph,
    getDsaSourceGraph,
    getDsaStatusGraph,
    getPayoutAgreementGraph,
    verificationStatusGraph,
    agreementSignedGraph,
    getLeadFormGraph,
    getLeadFormGraphMIS
};
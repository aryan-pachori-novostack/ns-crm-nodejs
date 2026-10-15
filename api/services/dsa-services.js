const { QueryTypes } = require('sequelize');
const { sequelize, _db2, _db3 } = require('../../models');
const crypto = require("crypto");
const moment = require("moment");
const { uploadArrayToS3, formatSignupDate, formatDateIndianFormat, sendEmailWithAttachmentBanker, claculateClaimMonth, callNsApi, sanitizeBusinessCategory, getTableNameFromLoanType, getLoanTableInfo, getLoanListQueryProfile, normalizeLoanApplicationWhere, CalculatePayoutAmountMultiplier, CalculatePayoutAmount, CalculateSubventionDeduction, ApplySubventionToPayoutCaps, generateLoanUnionQuery, CreateWhereQueryFilter, CustomOperatorHandlers, getImageUrl, makeRequest, sendEmailSmtp, dsaEmailVerificationOtpEmailTemplate, jsonDifference, toIsoDateIST, buildAddressFilterClause } = require("../../api/helpers/commonhelper");
const { getVendorDashboardListApiFieldMapping, getVendorBranchListApiFieldMapping, getCompactSearchFieldMapping, SQL_BANK_ACCOUNT_CHEQUE_IMAGE, SQL_BANK_ACCOUNT_PASSBOOK_IMAGE, sqlPreferredBankAccountJoinByDsaId, sqlPreferredBankAccountJoinByDsaOrCompanyId } = require("../../api/helpers/apiFieldMappings");
const { v4: uuid } = require('uuid');
const { InstantClaimEmailTemplate } = require('../../email-templates/InstantClaimEmailTemplate');
const { updateOrCreateRMUser } = require('./user-services');
const { mergeDsaTables } = require('../helpers/constantdata/data');
const { checkIfLoanAndApacNumberIsValid, checkIfFreshLeadExist, validateBusinessCategory, checkIfDuplcateLeadExist, updateFreshLeadDsaId, additionalLeadFormValidation, checkNsContestIdExists, matchLeadBankFile, onlineLeadCheck, validateDisbursementDate, deriveClaimMonthFromDisbDate, deriveBillingMonthFromIso, validateLeadPayoutAndBusinessCategory, validateProductBusinessCategory, insertOrUpdateLeadMeta, isConfirmationMailAllowedForProductId, claimMatchedBankFileSource, releaseMatchedBankFileSource, syncMetaOnStatusZero, validateReconciliationDiscrepancies, isFinanceRootUser, isManualReviewBank, getBankCategoryByBankProduct } = require('./finance-services');
const { sendBankerDisbursalConfirmationEmail } = require('./banker-email-service');
const { connectKafkaProducer, sendToKafkaEngine, EmailSendEmailPayout, SendPayoutNotificationCRM, createActivityLogKafka } = require("../services/kafka-services");
const { updatePartnerAndHierarchy } = require('./hierarchy-services');
const { getCompanyDetailsByKey } = require('./company-services');
const { InstantClaimErrorEmailTemplate } = require('../../email-templates/instantClaimErrorEmailTemplate');
const { unclaimedInstantClaimEmailTemplate } = require('../../email-templates/unclaimedInstantClaimEmailTemplate');
const { is } = require('bluebird');
const { AUTHBRIDGE_API_URL, AUTHBRIDGE_API_KEY, AUTHBRIDGE_DOC_TYPE_PAN, SYSTEM_BOT_UUID } = require('../helpers/constantdata/config');
const ApplicationLogServices = require('./application-log-services');
const claimRepository = require('../v2/finance/leads/claims/FreshLeadClaimRepository');
const { logger } = require('../helpers/logger');
const axios = require('axios');


let checkForMainTable = (where, alias_array) => {
    if (!where || !alias_array) {
        return false;
    };
    for (let i = 0; i < where.length; i++) {
        for (let j = 0; j < alias_array.length; j++) {
            if (where[i][0]?.includes(`${alias_array[j]}.`)) {
                return true;
            };
        };
    };
    return false;
};

const getCreatorEmailForFreshLeadById = async (application_id) => {
    let query = ` select rflc.created_by from ru_fresh_lead_claims rflc where rflc.fresh_lead_id = ? `;
    let lead = await _db2.query(query, { replacements: [application_id], type: QueryTypes.SELECT });
    let userEmail;
    let userName;
    lead = lead[0];
    if (lead.created_by) {
        let user = await sequelize.query(` select * from users where bin_to_uuid(id) = ? `, { replacements: [lead.created_by], type: QueryTypes.SELECT });
        user = user[0];
        if (user) {
            userEmail = user.email;
            userName = user.name;
        } else {
            user = await _db2.query(` select * from ru_direct_selling_agents where dsa_id = ? `, { replacements: [lead.created_by], type: QueryTypes.SELECT });
            user = user[0];
            if (user) {
                userEmail = user.email_address;
                userName = user.full_name;
            }
        }
    }
    return { dsa_email_address: userEmail, dsa_name: userName };
};

const getDistinctSingleProperty = async (columnName, where, asName, childEmails, offset, limit, notBlacklisted) => {
    if (!childEmails) {
        childEmails = null;
    }
    else if (childEmails.length == 0) {
        childEmails = null;
    }
    let bindParams = [];
    let query = ' SELECT distinct ' + columnName + ' as ' + asName + ' FROM ru_direct_selling_agents c ';
    let and = false;
    if (where && where.length != 0) {
        and = true;
        query += ' where ';
        for (let i = 0; i < where.length; i++) {
            if (where[i][2] == "like") {
                if (i == 0) query += ` ${where[i][0]} like '%${where[i][1]}%' `;
                else query += ` and ${where[i][0]} like '%${where[i][1]}%' `;
            } else {
                if (i == 0) query += where[i][0] + ' = ? ';
                else query += ' and ' + where[i][0] + ' = ? ';
                bindParams.push(where[i][1])
            }
        }
    }
    if (notBlacklisted) {
        if (and === true) {
            query += ` and c.dsa_status <> 51 `;
        } else {
            query += ` where c.dsa_status <> 51 `;
            and = true;
        }
    }

    if (childEmails) {
        query += ` ${and === false ? "where" : "and"} c.dsa_mobile_number in (
                WITH RECURSIVE DSAHierarchy AS (
                    SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
                    UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) `;
        and = true;
        bindParams.push(childEmails);
    };

    if (and === false) {
        query += 'where ' + columnName + ' is not null ';
    } else {
        query += ' and ' + columnName + ' is not null ';
    }
    query += ' order by ' + columnName + ' asc ';
    if (offset || limit) query += ` limit ${offset},${limit} `;
    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results;
    // We didn't need to destructure the result here - the results were returned directly
};

const getRuloansCustomersDownload = async (where, search, childPhones, allow_masking, filterQuery, loggedInUser, call_status) => {
    let bindParams = [];
    let and = filterQuery ? true : false;
    let masked_query = allow_masking ? `CONCAT(LEFT(k.permanent_account_number, 1), '*******', RIGHT(k.permanent_account_number, 2)) AS pan_number, CONCAT('*****', RIGHT(c.dsa_mobile_number, 5)) AS mobile_number` : `permanent_account_number AS pan_number, c.dsa_mobile_number AS mobile_number`;
    let call_logs_query = call_status ? `LEFT JOIN CRMTest.call_logs cl ON cl.user_id = c.dsa_id AND cl.createdAt = c.call_remark_date` : "";

    let query = `
    SELECT distinct
        c.full_name AS name,
        c.profession,
        c.email_address AS email,
        c.home_address_city AS city,
        c.home_address_state AS state,
        c.home_address_pincode AS zip_code,
        c.user_type,
        c.hierarchy_crm,
        ${masked_query},
        p.full_name AS partner_name,
        pp.full_name AS previous_partner_name,
        cm.full_name AS channel_manager_name,
        c.created_at AS partner_joining_date,
        bh.full_name AS business_head_name,
        CASE 
        WHEN pvs.value IS NULL THEN "Cold"
        ELSE pvs.value 
    END AS status,
    pvss.value AS sub_status,
    c.dsa_status_updated_at,
        c.dsa_verification_status AS verification_status,
        CONCAT((c.signup_steps_completed / 6) * 100, "%") AS signup_steps,
        CASE 
            WHEN k.mou_signed_date IS NULL THEN "No"
            ELSE "Yes" 
        END AS joining_signed,
        CASE 
            WHEN k.payout_agreement_signed_date IS NULL THEN "No"
            ELSE "Yes" 
        END AS payout_signed,
        CASE 
        WHEN c.consent_otp_verified_at IS NULL THEN "No"
        ELSE "Yes" 
        END AS consent_otp_verified,
        c.consent_otp_verified_at,
        rfp.full_name as referrer_name,
        rdl.utm_source,
        c.page_source,
        rdl.utm_medium,
        rdl.utm_campaign,
        rdl.utm_channel,
        rdl.utm_term,
        CASE 
            WHEN rdl.utm_main_source IS NULL THEN c.utm_main_source
            ELSE rdl.utm_main_source 
        END AS utm_main_source,
        CASE 
            WHEN rdl.utm_device IS NULL THEN c.utm_device
            ELSE rdl.utm_device 
        END AS utm_device,
        case when c.is_employee = binary 1 then "yes" else "no" end as is_employee
    FROM 
        ru_direct_selling_agents c
    LEFT JOIN 
        ru_dsa_kyc_data k ON c.dsa_id = k.dsa_id
    LEFT JOIN 
        ru_direct_selling_agents p ON c.partner_code = p.dsa_mobile_number
    LEFT JOIN 
        ru_direct_selling_agents pp ON c.previous_partner_code = pp.dsa_mobile_number
    LEFT JOIN 
        picklist_values pvs ON c.dsa_status = pvs.id
    LEFT JOIN 
        picklist_values pvss ON c.dsa_sub_status = pvss.id
    LEFT JOIN 
        ru_dsa_leads rdl ON rdl.dsa_id = c.dsa_id
    LEFT JOIN 
        ru_direct_selling_agents bh ON c.business_head_code = bh.dsa_mobile_number
    LEFT JOIN 
        ru_direct_selling_agents cm ON cm.dsa_mobile_number = c.channel_manager_code
    LEFT JOIN 
        ru_referrals rf ON rf.referred_id = c.dsa_id
        LEFT JOIN ru_direct_selling_agents rfp ON rfp.dsa_id = (SELECT rfp_inner.referrer_id FROM ru_referrals rfp_inner WHERE rfp_inner.referred_id = c.dsa_id ORDER BY rfp_inner.created_at ASC LIMIT 1)
   
    ${call_logs_query} ${filterQuery} `;

    let queryCount = ` SELECT  count(distinct c.dsa_id) as totalCount from ru_direct_selling_agents  c left join ru_dsa_kyc_data k on c.dsa_id= k.dsa_id left join ru_direct_selling_agents p on c.partner_code = p.dsa_mobile_number left join picklist_values pvs on c.dsa_status = pvs.id left join picklist_values pvss on c.dsa_sub_status = pvss.id left join ru_dsa_leads rdl on rdl.dsa_id = c.dsa_id left join ru_direct_selling_agents bh on c.business_head_code = bh.dsa_mobile_number  LEFT JOIN ru_direct_selling_agents pp ON c.previous_partner_code = pp.dsa_mobile_number LEFT JOIN ru_direct_selling_agents cm ON cm.dsa_mobile_number = c.channel_manager_code LEFT JOIN ru_referrals rf ON rf.referred_id = c.dsa_id  LEFT JOIN ru_direct_selling_agents rfp ON rfp.dsa_id = (SELECT rfp_inner.referrer_id FROM ru_referrals rfp_inner WHERE rfp_inner.referred_id = c.dsa_id ORDER BY rfp_inner.created_at ASC LIMIT 1) ${call_logs_query} ${filterQuery} `;

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
    if (childPhones) {
        query += ` ${and === false ? "where" : "and"} c.dsa_mobile_number in (
                WITH RECURSIVE DSAHierarchy AS (
                    SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
                    UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) `;
        queryCount += ` ${and === false ? "where" : "and"} c.dsa_mobile_number in (
                WITH RECURSIVE DSAHierarchy AS (
                    SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
                    UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) `;
        bindParams.push(childPhones);
        and = true;
    };
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += ` order by c.created_at desc  `;
    const totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });

    if (totalCount[0].totalCount > 100000) {
        // sendDsaExportEmailQueue.add({ query, queryCount, loggedInUser });
        let emailQuery = { query, queryCount, loggedInUser }
        console.log(emailQuery)
        return { results: "email", totalCount: totalCount[0].totalCount || 0, emailQuery };
    } else {
        const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        return { results, totalCount: totalCount[0].totalCount || 0 };
    }

};

const getUniqueDsaDownload = async (where, search, childPhones, allow_masking, filterQuery, loggedInUser, call_status) => {
    let bindParams = [];
    let and = filterQuery ? true : false;
    let masked_query = allow_masking ? ` concat(left(k.permanent_account_number, 1), '*******', right(k.permanent_account_number, 2)) as pan_number, CONCAT('*****', RIGHT(c.dsa_mobile_number, 5)) as mobile_number ` : ` permanent_account_number as pan_number, c.dsa_mobile_number as mobile_number `;
    let call_logs_join = call_status ? `LEFT JOIN (
        SELECT cl1.* 
        FROM CRMTest.call_logs cl1
        INNER JOIN (
            SELECT user_id, MAX(createdAt) AS last_call 
            FROM CRMTest.call_logs 
            GROUP BY user_id
        ) AS cl2 ON cl1.user_id = cl2.user_id AND cl1.createdAt = cl2.last_call
    ) AS cl ON cl.user_id = c.dsa_id ` : ` LEFT JOIN CRMTest.call_logs cl ON cl.user_id = c.dsa_id `;

    let query = ` SELECT distinct
    c.salutation,
    c.dsa_id as ru_dsa_id,
    c.first_name,
    c.middle_name,
    c.last_name,
    c.gender,
    c.date_of_birth,
    c.email_address AS email,
    c.profession,
    ${masked_query},
    c.home_address_house_number,
    c.home_address_area,
    c.home_address_city,
    c.home_address_state,
    c.home_address_pincode,
    c.office_address_house_number,
    c.office_address_area,
    c.office_address_city,
    c.office_address_state,
    c.office_address_pincode,
    c.user_type,
    c.hierarchy_crm,
    p.full_name AS partner_name,
    pp.full_name AS previous_partner_name,
    cm.full_name as channel_manager_name,
    c.partner_code,
    c.created_at AS partner_joining_date,
    c.channel_manager_code,
    bh.full_name AS business_head_name,
    CASE WHEN pvs.value IS NULL THEN "Cold" ELSE pvs.value END AS status,
    pvss.value AS sub_status,
    c.dsa_status_updated_at,
    c.dsa_verification_status AS verification_status,
    CONCAT((c.signup_steps_completed / 6) * 100, "%") AS signup_steps,
    CASE WHEN k.mou_signed_date IS NULL THEN "No" ELSE "Yes" END AS joining_signed,
    CASE WHEN k.payout_agreement_signed_date IS NULL THEN "No" ELSE "Yes" END AS payout_signed,
    CASE WHEN c.consent_otp_verified_at IS NULL THEN "No" ELSE "Yes" END AS consent_otp_verified,
    c.consent_otp_verified_at,
    rfp.full_name as referrer_name,
    c.utm_source,
    c.utm_medium,
    c.utm_campaign,
    c.utm_channel,
    c.utm_term,
    c.utm_main_source,
    c.page_source,
    c.utm_device,
    c.company_name,
    c.gstin,
    rdai.*,
    GROUP_CONCAT(cl.remarks ORDER BY cl.createdAt DESC SEPARATOR '|') AS remarks,
    c.last_modified_by,
    case when c.is_employee = 1 then "yes" else "no" end as is_employee
  FROM ru_direct_selling_agents c
  LEFT JOIN ru_dsa_kyc_data k ON c.dsa_id = k.dsa_id
  LEFT JOIN ru_direct_selling_agents p ON c.partner_code = p.dsa_mobile_number
  LEFT JOIN ru_direct_selling_agents pp ON c.previous_partner_code = pp.dsa_mobile_number
  LEFT JOIN ru_direct_selling_agents bh ON c.business_head_code = bh.dsa_mobile_number
  LEFT JOIN picklist_values pvs ON c.dsa_status = pvs.id
  LEFT JOIN picklist_values pvss ON c.dsa_sub_status = pvss.id
  LEFT JOIN ru_dsa_additional_information rdai ON rdai.dsa_id = c.dsa_id
  ${call_logs_join}
  LEFT JOIN ru_direct_selling_agents cm ON cm.dsa_mobile_number = c.channel_manager_code
  LEFT JOIN ru_referrals rf ON rf.referred_id = c.dsa_id
  LEFT JOIN ru_direct_selling_agents rfp ON rfp.dsa_id = (SELECT rfp_inner.referrer_id FROM ru_referrals rfp_inner WHERE rfp_inner.referred_id = c.dsa_id ORDER BY rfp_inner.created_at ASC LIMIT 1) ${filterQuery} `;

    let queryCount = ` SELECT  count(distinct c.dsa_id) as totalCount from ru_direct_selling_agents  c left join ru_dsa_kyc_data k on c.dsa_id= k.dsa_id left join ru_direct_selling_agents p on c.partner_code= p.dsa_mobile_number left join ru_direct_selling_agents bh on c.business_head_code = bh.dsa_mobile_number left join picklist_values pvs on c.dsa_status = pvs.id left join picklist_values pvss on c.dsa_sub_status = pvss.id  left join ru_dsa_additional_information rdai on binary rdai.dsa_id = c.dsa_id  LEFT JOIN ru_direct_selling_agents pp ON c.previous_partner_code = pp.dsa_mobile_number LEFT JOIN ru_direct_selling_agents cm ON cm.dsa_mobile_number = c.channel_manager_code LEFT JOIN ru_referrals rf ON rf.referred_id = c.dsa_id     LEFT JOIN ru_direct_selling_agents rfp ON rfp.dsa_id = (SELECT rfp_inner.referrer_id FROM ru_referrals rfp_inner WHERE rfp_inner.referred_id = c.dsa_id ORDER BY rfp_inner.created_at ASC LIMIT 1) ${call_logs_join} ${filterQuery} `;
    l
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
    if (childPhones) {
        query += ` ${and === false ? "where" : "and"} c.dsa_mobile_number in (
                WITH RECURSIVE DSAHierarchy AS (
                    SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
                    UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) `;
        queryCount += ` ${and === false ? "where" : "and"} c.dsa_mobile_number in (
                WITH RECURSIVE DSAHierarchy AS (
                    SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
                    UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) `;
        bindParams.push(childPhones);
        and = true;
    };
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += ` group by c.dsa_id `;

    const totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });

    if (totalCount[0].totalCount > 100000) {
        // sendDsaExportEmailQueue.add({ query, queryCount, loggedInUser });
        let emailQuery = { query, queryCount, loggedInUser }
        return { results: "email", totalCount: totalCount[0].totalCount || 0, emailQuery };
    } else {
        const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        return { results, totalCount: totalCount[0].totalCount || 0 };
    }

    // We didn't need to destructure the result here - the results were returned directly
};

const getRuloansCustomers = async (body) => {
    const {
        where,
        search,
        offset,
        limit,
        user_query,
        having,
        filterQuery,
        call_created_order,
        call_status,
        is_export,
        allow_duplicates,
        orderBy,
        whereFilterQuery,
        logicOperator = "and"
    } = body;
    const whereArr = Array.isArray(where) ? where : [];
    const whereFilterArr = Array.isArray(whereFilterQuery) ? whereFilterQuery : [];
    const searchArr = Array.isArray(search) ? search : [];

    let bindParams = [];
    let and = filterQuery ? true : false;

    let hasCallStatus = Boolean(call_status || (filterQuery && filterQuery.includes("cl.")) || (whereArr && whereArr.some(item => item[0]?.includes("cl."))) || (whereFilterArr && whereFilterArr.some(item => item[0]?.includes("cl."))));
    let call_logs_query = hasCallStatus ? `LEFT JOIN CRMTest.call_logs cl ON cl.user_id = c.dsa_id AND cl.createdAt = c.call_remark_date` : "";

    let remarksColumn = is_export ? `(SELECT GROUP_CONCAT(CONCAT(remarks, ' (', createdAt, ')') SEPARATOR ' || ') FROM CRMTest.call_logs cl WHERE cl.user_id = c.dsa_id) AS remarks` : "";

    let is_export_joins = "";
    if (is_export) {
        is_export_joins = `${allow_duplicates ? `LEFT JOIN ru_dsa_leads rdl ON rdl.dsa_id = c.dsa_id` : ""}
        LEFT JOIN ru_direct_selling_agents cm ON c.channel_manager_code = cm.dsa_mobile_number
        ${call_logs_query}`;
    } else {
        is_export_joins = `${allow_duplicates ? `LEFT JOIN ru_dsa_leads rdl ON rdl.dsa_id = c.dsa_id` : ""}
        LEFT JOIN ru_direct_selling_agents cm ON c.channel_manager_code = cm.dsa_mobile_number
        ${filterQuery || ""}
        ${call_logs_query}`;
    }

    let query = "";
    
    if (is_export) {
        query = `
        ${user_query || ""}
        SELECT DISTINCT
            c.first_name AS first_name,
            c.middle_name AS middle_name,
            c.last_name AS last_name,
            CASE 
            WHEN c.full_name IS NOT NULL AND c.full_name <> '' 
                THEN c.full_name
            ELSE CONCAT_WS(' ', c.first_name, c.middle_name, c.last_name)
            END AS full_name,
            c.profession AS profession,
            c.email_address AS mail_id,
            CASE
                WHEN (
                    SELECT COUNT(*) 
                    FROM ru_user_onboarding_steps s 
                    LEFT JOIN ru_onboarding_steps o ON o.step = s.step 
                    WHERE s.dsa_id = c.dsa_id AND s.status = 1 AND s.step = 'dsa_consent'
                ) > 0 OR c.consent_otp_verified_at IS NOT NULL
                   THEN c.dsa_mobile_number
                   ELSE CONCAT('XXXXXX', RIGHT(c.dsa_mobile_number, 4))
                   END AS contact_number,
            CASE 
                WHEN c.consent_otp_verified_at IS NOT NULL THEN 'Yes'
                ELSE 'No'
                END AS is_phone_verified,
                rc.name AS company_name,
                c.company_id,
            
            CASE WHEN address.city IS NULL THEN c.home_address_city ELSE address.city END AS city,
            CASE WHEN address.state IS NULL THEN c.home_address_state ELSE address.state END AS state,
            CASE WHEN address.pin_code IS NULL THEN c.home_address_pincode ELSE address.pin_code END AS home_address_pincode,
            c.user_type AS user_type,
            c.hierarchy_crm AS hierarchy_crm,
            CASE WHEN pvs.value IS NULL THEN 'Cold' ELSE pvs.value END AS status,
            pvss.value AS sub_status,
            c.dsa_status_updated_at AS dsa_status_updated_at,
            pp.full_name AS previous_partner_name,
            p.full_name AS partner_name,
            p.dsa_mobile_number AS partner_code,
            DATE(c.created_at) AS partner_joining_date,
            bh.full_name AS business_head_name,
            sp.name AS salesperson_name
            ${remarksColumn ? `, ${remarksColumn}` : ""},
            (SELECT GROUP_CONCAT(DISTINCT s.step ORDER BY o.sort_order ASC)
                FROM ru_user_onboarding_steps s
                LEFT JOIN ru_onboarding_steps o ON o.step = s.step
                WHERE dsa_id = c.dsa_id AND status = 1
            ) AS onboarding_steps,
            c.utm_source,
            c.utm_medium,
            c.utm_campaign,
            c.utm_channel,
            c.utm_term,
            c.utm_main_source,
            c.utm_content,
            c.page_source
        FROM ru_direct_selling_agents c
        LEFT JOIN ru_companies rc ON rc.company_id = c.company_id
        LEFT JOIN ru_dsa_kyc_data k ON c.dsa_id = k.dsa_id
        LEFT JOIN ru_direct_selling_agents p ON c.partner_code = p.dsa_mobile_number
        LEFT JOIN ru_direct_selling_agents bh ON c.business_head_code = bh.dsa_mobile_number
        LEFT JOIN picklist_values pvs ON c.dsa_status = pvs.id
        LEFT JOIN picklist_values pvss ON c.dsa_sub_status = pvss.id
        LEFT JOIN ru_direct_selling_agents pp ON c.previous_partner_code = pp.dsa_mobile_number
        LEFT JOIN CRMTest.users sp ON sp.id = UUID_TO_BIN(c.salesperson_id)
        LEFT JOIN ru_dsa_addresses address ON address.id = (
            SELECT rdd.id FROM ru_dsa_addresses rdd WHERE rdd.dsa_id = c.dsa_id ORDER BY rdd.id DESC LIMIT 1
        )
        ${is_export_joins}
        `;
    } else {
        query = `
        ${user_query || ""}
        SELECT DISTINCT
        c.access_control,
        c.page_source,
        c.is_direct_claim_enabled,
        c.dsa_id AS customer_id,
        c.profession,
        c.user_type,
        c.dsa_verification_status AS dsa_verification_status,
        c.first_name AS customer_first_name,
        c.email_address,
        c.last_name AS customer_last_name,
        c.middle_name AS customer_middle_name,
        CASE 
            WHEN c.full_name IS NOT NULL AND c.full_name <> '' 
                THEN c.full_name
            ELSE CONCAT_WS(' ', c.first_name, c.middle_name, c.last_name)
            END AS customer_full_name,
        c.partner_assigned_date,
        c.call_remark_date,
        c.dsa_mobile_number as customer_mobile_number,
        c.is_employee,
        c.hierarchy_crm,
        c.assigned_to,
        k.ns_hierarchy,

        p.first_name AS partner_first_name,
        p.last_name AS partner_last_name,
        p.middle_name AS partner_middle_name,
        p.full_name AS partner_full_name,

        pp.full_name AS previous_partner_name,
        ip.full_name AS initial_partner_name,
        p.dsa_mobile_number AS partner_mobile_number,
        c.created_at AS partner_joining_date,
        bh.full_name AS business_head_name,
        DATE(c.created_at) AS created_at,

        CASE WHEN address.city IS NULL THEN c.home_address_city ELSE address.city END AS city,
        CASE WHEN address.state IS NULL THEN c.home_address_state ELSE address.state END AS state,
        CASE WHEN address.pin_code IS NULL THEN c.home_address_pincode ELSE address.pin_code END AS zip_code,

        k.permanent_account_number AS pan_number,

        CASE
            WHEN pvs.value IS NULL THEN 'Cold'
            ELSE pvs.value
        END AS status,

        pvss.value AS sub_status,
        k.is_permanent_account_number_verified AS pan_number_verified,

        CASE
            WHEN k.mou_signed_date IS NULL THEN 0
            ELSE 1
        END AS joining_signed,

        k.mou_signed_date AS joining_date,

        CASE
            WHEN k.payout_agreement_signed_date IS NULL THEN 0
            ELSE 1
        END AS payout_signed,

        c.dsa_status_updated_at,
        c.utm_source,
        c.utm_medium,
        c.utm_campaign,
        c.utm_channel,
        c.utm_term,
        c.utm_main_source,
        c.utm_device,
        c.utm_content,
        c.updated_at,

        CASE
            WHEN (
                SELECT COUNT(*) 
                FROM ru_user_onboarding_steps s 
                LEFT JOIN ru_onboarding_steps o ON o.step = s.step 
                WHERE s.dsa_id = c.dsa_id AND s.status = 1 AND s.step = 'dsa_consent'
            ) > 0
            then 'Yes' WHEN c.consent_otp_verified_at is not null THEN 'Yes'
            ELSE 'No' end as consent_otp_verified,

        c.consent_otp_verified_at,
        c.is_deleted,
        c.is_blacklisted,
        rc.name AS company_name,
        c.company_id,
        cm.full_name AS channel_manager_name,
        rfp.full_name as referrer_name,
        rfp.dsa_mobile_number as referrer_mobile,
        k.is_dsa_new AS old_new_dsa,
        sp.name AS salesperson_name,
        c.salesperson_assigned_date,
        case when (meta.is_manual_business_started = 0 or meta.is_manual_business_started is null) then "No" else "Yes" end as is_manual_business_started, 
        meta.manual_business_started_date, 
        case when (meta.is_online_business_started = 0 or meta.is_online_business_started is null) then "No" else "Yes" end as is_online_business_started, 
        meta.online_business_started_date, 
        case when (meta.is_offline_business_started = 0 or meta.is_offline_business_started is null) then "No" else "Yes" end as is_offline_business_started, 
        meta.offline_business_started_date
       ${remarksColumn ? `, ${remarksColumn}` : ""}

        ${allow_duplicates ? `,rdl.utm_medium, rdl.utm_campaign, rdl.utm_channel, rdl.utm_term` : ""},
        (SELECT GROUP_CONCAT(DISTINCT s.step ORDER BY o.sort_order asc)  FROM ru_user_onboarding_steps s LEFT JOIN ru_onboarding_steps o ON o.step = s.step WHERE dsa_id = c.dsa_id AND status = 1) AS onboarding_steps

        FROM ru_direct_selling_agents c
        LEFT JOIN ru_dsa_kyc_data k ON c.dsa_id = k.dsa_id 
        LEFT JOIN ru_dsa_metas meta ON meta.id = (SELECT m2.id FROM ru_dsa_metas m2 WHERE m2.dsa_id = c.dsa_id ORDER BY m2.id DESC LIMIT 1)
        LEFT JOIN ru_direct_selling_agents p ON c.partner_code = p.dsa_mobile_number
        LEFT JOIN ru_direct_selling_agents bh ON c.business_head_code = bh.dsa_mobile_number
        LEFT JOIN picklist_values pvs ON c.dsa_status = pvs.id
        LEFT JOIN picklist_values pvss ON c.dsa_sub_status = pvss.id
        LEFT JOIN ru_direct_selling_agents pp ON c.previous_partner_code = pp.dsa_mobile_number
        LEFT JOIN ru_direct_selling_agents ip ON c.initial_partner_code = ip.dsa_mobile_number
        LEFT JOIN ru_companies rc ON rc.company_id = c.company_id
        -- rf is never selected or filtered here and a DSA can have many referral rows,
        -- so this join only duplicated rows for DISTINCT to collapse again.
        -- LEFT JOIN ru_referrals rf ON rf.referred_id = c.dsa_id
        LEFT JOIN ru_direct_selling_agents rfp ON rfp.dsa_id = (SELECT rfp_inner.referrer_id FROM ru_referrals rfp_inner WHERE rfp_inner.referred_id = c.dsa_id ORDER BY rfp_inner.created_at ASC LIMIT 1)
        LEFT JOIN CRMTest.users sp ON sp.id = UUID_TO_BIN(c.salesperson_id)
        LEFT JOIN ru_dsa_addresses address ON address.id = (
            SELECT rdd.id FROM ru_dsa_addresses rdd WHERE rdd.dsa_id = c.dsa_id ORDER BY rdd.id DESC LIMIT 1
        )

        ${is_export_joins}
        `;
    }

    let queryCount = ` ${user_query || ""} select count(distinct c.dsa_id) as totalCount from ru_direct_selling_agents c `;
    queryCount = allow_duplicates ? ` ${user_query} select count(c.dsa_id) as totalCount from ru_direct_selling_agents c LEFT JOIN ru_dsa_leads rdl ON rdl.dsa_id = c.dsa_id ` : queryCount;

    const getConditionalJoins = () => {
        const allWhereKeys = whereArr.concat(whereFilterArr)
            .map(item => item[0])
            .join('|');

        const joinConditions = [
            ["k.", `LEFT JOIN ru_dsa_kyc_data k ON c.dsa_id = k.dsa_id`],
            ["p.", `LEFT JOIN ru_direct_selling_agents p ON c.partner_code = p.dsa_mobile_number`],
            ["bh.", `LEFT JOIN ru_direct_selling_agents bh ON c.business_head_code = bh.dsa_mobile_number`],
            ["pvs.", `LEFT JOIN picklist_values pvs ON c.dsa_status = pvs.id`],
            ["pvss.", `LEFT JOIN picklist_values pvss ON c.dsa_sub_status = pvss.id`],
            ["pp.", `LEFT JOIN ru_direct_selling_agents pp ON c.previous_partner_code = pp.dsa_mobile_number`],
            ["cm.", `LEFT JOIN ru_direct_selling_agents cm ON c.channel_manager_code = cm.dsa_mobile_number`],
            ["rc.", `LEFT JOIN ru_companies rc ON rc.company_id = c.company_id`],
            ["rfp.", `LEFT JOIN ru_direct_selling_agents rfp ON rfp.dsa_id = (SELECT rfp_inner.referrer_id FROM ru_referrals rfp_inner WHERE rfp_inner.referred_id = c.dsa_id ORDER BY rfp_inner.created_at ASC LIMIT 1)`],
            ["sp.", `LEFT JOIN CRMTest.users sp ON sp.id = UUID_TO_BIN(c.salesperson_id)`],
            ["ip.", `LEFT JOIN ru_direct_selling_agents ip ON c.initial_partner_code = ip.dsa_mobile_number`],
            ["address.", `LEFT JOIN ru_dsa_addresses address ON address.id = (SELECT rdd.id FROM ru_dsa_addresses rdd WHERE rdd.dsa_id = c.dsa_id ORDER BY rdd.id DESC LIMIT 1)`],
            ["meta.", `LEFT JOIN ru_dsa_metas meta ON meta.id = (SELECT m2.id FROM ru_dsa_metas m2 WHERE m2.dsa_id = c.dsa_id ORDER BY m2.id DESC LIMIT 1)`]
        ];

        let joins = joinConditions
            .filter(([alias]) => allWhereKeys.includes(alias))
            .map(([, joinSql]) => joinSql)
            .join('\n');

        joins = (search && search?.length)
            ? (joins.includes("LEFT JOIN ru_dsa_kyc_data k ON c.dsa_id = k.dsa_id")
                ? joins.replace(/LEFT JOIN ru_dsa_kyc_data k ON c\.dsa_id = k\.dsa_id/, "LEFT JOIN ru_dsa_kyc_data k ON c.dsa_id = k.dsa_id")
                : joins + " LEFT JOIN ru_dsa_kyc_data k ON c.dsa_id = k.dsa_id")
            : joins;

        return joins;
    };

    queryCount += `${getConditionalJoins()} ${call_logs_query} ${filterQuery || ""}`;

    // Builds a dual-table WHERE clause for address filter items targeting state / city / zip.
    const transformAddressClause = (item) => {
        if (!item || !Array.isArray(item)) return null;

        const fieldSql = item[0] || '';
        const opSql   = item[1] || '';
        const val      = item[2] !== undefined && item[2] !== null ? item[2] : null;

        const addrField =
            (fieldSql.includes('address.state')    || fieldSql.includes('home_address_state'))                                    ? 'state' :
            (fieldSql.includes('address.city')     || fieldSql.includes('home_address_city'))                                     ? 'city'  :
            (fieldSql.includes('address.pin_code') || fieldSql.includes('home_address_pincode') || fieldSql.includes('zip_code')) ? 'zip'   :
            null;

        if (!addrField) return null;

        // isEmpty/isNotEmpty — detect from expression, generate dual-table IS NULL SQL
        if (opSql === '' && (val === null || val === '')) {
            const isNotEmpty = /is\s+not\s+null/i.test(fieldSql);
            const isEmpty    = !isNotEmpty && /is\s+null/i.test(fieldSql);
            if (isEmpty)    return buildAddressFilterClause(addrField, 'isEmpty');
            if (isNotEmpty) return buildAddressFilterClause(addrField, 'isNotEmpty');
        }

        return null;
    };

    if (whereArr && whereArr.length !== 0) {
        for (let i = 0; i < whereArr.length; i++) {
            if (and === false && i === 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            } else if (i === 0 && and === true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            } else {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }

            let addrClause = transformAddressClause(whereArr[i]);
            if (addrClause) {
                query += addrClause + ' ';
                queryCount += addrClause + ' ';
            } else if (whereArr[i][2] !== null && whereArr[i][2] !== undefined) {
                query += whereArr[i][0] + whereArr[i][1] + ' ? ';
                queryCount += whereArr[i][0] + whereArr[i][1] + ' ? ';
                bindParams.push(whereArr[i][2]);
            } else {
                const isOnboardingSteps = whereArr[i][0]?.includes("ru_user_onboarding_steps");
                const isNotEmpty = whereArr[i][1]?.includes("is not null") || whereArr[i][0]?.includes("is not null");
                const isEmpty = whereArr[i][1]?.includes("is null") || whereArr[i][0]?.includes("is null");

                if (isOnboardingSteps && (isNotEmpty || isEmpty)) {
                    const clause = isNotEmpty ? "EXISTS" : "NOT EXISTS";
                    query += `${clause} (SELECT 1 FROM ru_user_onboarding_steps s WHERE s.dsa_id = c.dsa_id and s.status = 1) `;
                    queryCount += `${clause} (SELECT 1 FROM ru_user_onboarding_steps s WHERE s.dsa_id = c.dsa_id and s.status = 1) `;
                } else {
                    query += whereArr[i][0] + whereArr[i][1] + ' ';
                    queryCount += whereArr[i][0] + whereArr[i][1] + ' ';
                }
            }
        }
    }

    if (whereFilterArr && whereFilterArr.length !== 0) {
        for (let i = 0; i < whereFilterArr.length; i++) {
            if (and === false) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            } else {
                if (i === 0) {
                    query += ` and `;
                    queryCount += ` and `;
                    and = true;
                } else {
                    query += ` ${logicOperator} `;
                    queryCount += ` ${logicOperator} `;
                    and = true;
                }
            }

            let addrClause = transformAddressClause(whereFilterArr[i]);
            if (addrClause) {
                query += addrClause + ' ';
                queryCount += addrClause + ' ';
            } else if (whereFilterArr[i][2] !== null && whereFilterArr[i][2] !== undefined && whereFilterArr[i][2] !== '') {
                query += whereFilterArr[i][0] + whereFilterArr[i][1] + ' ? ';
                queryCount += whereFilterArr[i][0] + whereFilterArr[i][1] + ' ? ';
                bindParams.push(whereFilterArr[i][2]);
            } else {
                let onboardingSteps = {
                    " is not null ": "EXISTS",
                    " is null ": "NOT EXISTS",
                };

                const isOnboardingSteps = whereFilterArr[i][0]?.includes("ru_user_onboarding_steps");
                const isNotEmpty = whereFilterArr[i][1]?.includes("is not null") || whereFilterArr[i][0]?.includes("is not null");
                const isEmpty = whereFilterArr[i][1]?.includes("is null") || whereFilterArr[i][0]?.includes("is null");

                if (isOnboardingSteps && (isNotEmpty || isEmpty)) {
                    const clause = isNotEmpty ? "EXISTS" : "NOT EXISTS";
                    query += `${clause} (SELECT 1 FROM ru_user_onboarding_steps s WHERE s.dsa_id = c.dsa_id and s.status = 1) `;
                    queryCount += `${clause} (SELECT 1 FROM ru_user_onboarding_steps s WHERE s.dsa_id = c.dsa_id and s.status = 1) `;
                } else {
                    query += whereFilterArr[i][0] + whereFilterArr[i][1] + ' ';
                    queryCount += whereFilterArr[i][0] + whereFilterArr[i][1] + ' ';
                }
            }
        }
    }

    if (searchArr && searchArr.length !== 0) {
        for (let i = 0; i < searchArr.length; i++) {
            if (and === false && i === 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            } else if (i === 0 && and === true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i === 0) {
                query += ' ( ';
                queryCount += ' ( ';
            }
            if (i !== 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += searchArr[i][0] + ' ' + searchArr[i][1] + ' ? ';
            queryCount += searchArr[i][0] + ' ' + searchArr[i][1] + ' ? ';
            if (i === searchArr.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(searchArr[i][2]);
        }
    }

    query += `${having || ""} `;
    queryCount += `${having || ""} `;

    if (is_export) {
        const emailQuery = { query, queryCount, bindParams };
        return { results: "email", emailQuery };
    }


    if (call_created_order) {
        query += ` order by c.call_remark_date ${call_created_order} limit ${offset},${limit} `;
    } else if (orderBy) {
        query += ` order by ${orderBy} limit ${offset}, ${limit} `;
    } else {
        query += ` order by c.id desc limit ${offset},${limit} `;
    }

    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    const totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });

    let phoneArr = [];
    for (let i = 0; i < (results?.length || 0); i++) {
        phoneArr.push(results[i]?.customer_mobile_number);
    }

    if (phoneArr.length) {
        let phoneBind = [phoneArr];
        let active_status = await sequelize.query(
            ` select s.name as active_status, u.phone from users u left join status s on u.status= s.id where u.phone in (?) `,
            { replacements: phoneBind, type: QueryTypes.SELECT }
        );

        for (let i = 0; i < (results?.length || 0); i++) {
            let exist = active_status.filter((obj) => obj.phone == results[i]?.customer_mobile_number);
            results[i]["active_status"] = exist?.length ? exist[0]?.active_status : null;
        }
    }

    return { results, totalCount: totalCount[0]?.totalCount };
};


function calculateCompletionPercentage(onboarding_steps) {
    if (!Array.isArray(onboarding_steps) || onboarding_steps.length === 0) {
        return 0;
    };

    const completedSteps = onboarding_steps.filter(step => step.status === 1).length;
    const totalSteps = onboarding_steps.length;

    const percentage = (completedSteps / totalSteps) * 100;
    return Math.round(percentage); // or use toFixed(2) for decimal precision
};

const getDsaUserDetailsWithLoanAndCreditCardDetails = async (id, childPhones) => {
    let bindParams = [id];
    let baseUrl = 'https://ruloans-bucket.s3.ap-south-1.amazonaws.com/';
    let getImageUrl = (column) => {
        let url = `case when ${column} = "dsaDocuments/" then null else Concat("${baseUrl}", ${column}) end as ${column?.split(".")[1]}`;
        return url;
    };

    let fileQuery = ` ${getImageUrl("k.address_proof_back_image_filename")},
                      ${getImageUrl("k.mou_filename")},
                      ${getImageUrl("k.pan_card_front_image_filename")},
                      ${getImageUrl("k.address_proof_front_image_filename")},
                      ${getImageUrl("k.display_picture_filename")} `;

    let query = ` SELECT 
        k.netsuite_vendor_id, 
    
        -- Partner Info
        p.full_name AS partner_name,
        p.email_address AS partner_email,
        p.dsa_mobile_number AS partner_mobile_number,
        CASE WHEN c.is_deleted = 1 OR c.is_blacklisted = 1 THEN 0 ELSE 1 END AS is_active,
        -- Customer/DSA Info
        c.dsa_id AS customer_id,
        c.dsa_id AS dsa_id,
        c.full_name AS full_name,
        c.is_universal,
        c.dsa_mobile_number AS customer_mobile_number,
        c.is_mobile_number_verified,
        c.dsa_mobile_number as customer_mobile_number,
        c.email_address AS email,
        c.class_assignee_name,
        c.class_assignee_email,
        c.user_type,
        c.is_email_address_verified,
        c.dsa_status AS status,
        c.is_employee AS employee,
        address.address_line_2 AS address_area,
        address.address_line_1 AS house_number,
        address.city AS city,
        address.state AS state,
        address.pin_code AS zip_code,
    
        -- Status & Consent
        CASE WHEN pvs.value IS NULL THEN "Cold" ELSE pvs.value END AS status_name,
        CASE WHEN c.consent_otp_verified_at IS NULL THEN "No" ELSE "Yes" END AS consent_otp_verified,
        c.consent_otp_verified_at,
        (SELECT description FROM ru_dsa_consents WHERE dsa_id = c.dsa_id AND consent_type = 'withdrawn' ORDER BY created_at DESC LIMIT 1) AS withdraw_consent_reason,
    
        -- Additional Info
        c.dsa_sub_status AS sub_status,
        c.profession,
        c.home_address_pincode AS zip_code,
        k.permanent_account_number AS pan_number,
        k.mou_signed_date,
        k.latest_mou_signed_date,
        k.is_payout_agreement_signed AS is_payout_agreement_signed,
        CASE WHEN c.user_type = 'company' AND rc.company_id IS NOT NULL THEN rc.is_pan_verified ELSE k.is_permanent_account_number_verified END AS authbridge_pan_verification_status,
        bh.full_name AS business_head_name,
        c.dsa_status_updated_at,
        c.company_id,
        c.business_mode,
        c.assigning_payout_percentage,
        c.access_control,
        c.is_direct_claim_enabled,
        c.signup_steps_completed,
        c.hierarchy_crm,
        k.ns_hierarchy,
        k.vendor_code,
        k.branch_code,
        c.gender,
        c.business_mode,
        k.digio_doc_id,
        crm.dsa_id AS crm_dsa_id,
        c.utm_source,
        c.utm_medium,
        c.utm_campaign,
        c.utm_channel,
        c.utm_term,
        c.utm_main_source,
        c.utm_device,
        c.utm_content,
        sp.name AS salesperson_name, 
        sp.phone as salesperson_phone,
        c.salesperson_assigned_date,
        rfp.full_name as referrer_name,
        rfp.dsa_mobile_number as referrer_mobile,
        CASE WHEN meta.is_manual_business_started = 1 THEN 'Yes' ELSE 'No' END AS is_manual_business_started,
        meta.manual_business_started_date,
        
        CASE WHEN meta.is_online_business_started = 1 THEN 'Yes' ELSE 'No' END AS is_online_business_started,
        meta.online_business_started_date,
        
        CASE WHEN meta.is_offline_business_started = 1 THEN 'Yes' ELSE 'No' END AS is_offline_business_started,
        meta.offline_business_started_date,
        rc.registered_by,
    
        -- Dynamic File Query
        ${fileQuery}
    
    FROM ru_direct_selling_agents c
    
    -- KYC & Hierarchy
    LEFT JOIN ru_dsa_kyc_data k ON c.dsa_id = k.dsa_id
    LEFT JOIN ru_direct_selling_agents p ON c.partner_code = p.dsa_mobile_number
    LEFT JOIN ru_direct_selling_agents bh ON bh.dsa_mobile_number = c.business_head_code
    LEFT JOIN picklist_values pvs ON c.dsa_status = pvs.id
    LEFT JOIN CRMTest.users crm ON binary c.dsa_id = crm.dsa_id
    LEFT JOIN CRMTest.users sp ON bin_to_uuid(sp.id) = c.salesperson_id
    LEFT JOIN ru_referrals rf ON rf.referred_id = c.dsa_id
    LEFT JOIN ru_direct_selling_agents rfp ON rfp.dsa_id = (SELECT rfp_inner.referrer_id FROM ru_referrals rfp_inner WHERE rfp_inner.referred_id = c.dsa_id ORDER BY rfp_inner.created_at ASC LIMIT 1)
    LEFT JOIN ru_dsa_metas meta ON meta.dsa_id = c.dsa_id 
    LEFT JOIN ru_companies rc ON rc.company_id = c.company_id 
    
    left JOIN (
    SELECT rdd.*
    FROM ru_dsa_addresses rdd
    INNER JOIN (
        SELECT dsa_id, MAX(created_at) AS max_created_at
        FROM ru_dsa_addresses
        GROUP BY dsa_id
    ) latest_rdd ON rdd.dsa_id = latest_rdd.dsa_id AND rdd.created_at = latest_rdd.max_created_at
    ) address ON address.dsa_id = c.dsa_id
    
    -- Final Filter
    WHERE c.dsa_id = ? `;

    let user = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    user = user[0] ? user[0] : null;
    if (!user) return user;

    query = ' select * from ru_dsa_verification_documents where dsa_id = ? ';
    bindParams = [user.dsa_id]
    let docs = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let urls = [];
    for (let i = 0; i < docs.length; i++) urls.push(docs[i].url);
    user.verification_documents = urls;

    let dsa_type = user?.business_mode == "company" ? ["individual", "company"] : [user?.business_mode || "individual"];

    query = `SELECT o.step, s.status FROM ru_onboarding_steps o LEFT JOIN ru_user_onboarding_steps s ON o.step = s.step  AND s.dsa_id = ? WHERE o.dsa_type IN (?) ORDER BY o.sort_order ASC`;
    bindParams = [user.dsa_id, Array.isArray(dsa_type) ? dsa_type : [dsa_type]];

    let steps = await _db2.query(query, {
        replacements: bindParams,
        type: QueryTypes.SELECT
    });

    const uniqueSteps = Array.from(
        new Map(steps.map(obj => [obj.step, obj])).values()
    );
    user['onboarding_steps'] = uniqueSteps;
    user['onboarding_steps_percentage'] = `${calculateCompletionPercentage(uniqueSteps)}%`;
    user.employee = Boolean(Number(user.employee));

    return user;
};

const getUserDsaProfileByPhone = async (phone) => {
    let bindParams = [phone];
    let baseUrl = 'https://ruloans-bucket.s3.ap-south-1.amazonaws.com/';
    let query = ` SELECT  (select count(*) from ru_credit_card_applications cc where cc.dsa_mobile_number = c.dsa_mobile_number) as creditCardSubmited, (select count(*) from ru_loan_applications l  where l.dsa_mobile_number = c.dsa_mobile_number) as loanSubmited,p.full_name as partner_name,p.email_address as partner_email,p.dsa_mobile_number as partner_mobile_number,c.dsa_id as customer_id,c.dsa_id as dsa_id,c.full_name as full_name,c.dsa_mobile_number as customer_mobile_number,c.email_address as email,c.home_address_area as address_area,c.home_address_house_number as house_number,c.home_address_city as city,c.home_address_state as state ,c.home_address_pincode  as zip_code,k.permanent_account_number as pan_number ,Concat("${baseUrl}",k.mou_filename) as mou_filename,k.is_payout_agreement_signed as is_payout_agreement_signed,Concat("${baseUrl}",k.pan_card_front_image_filename) as pan_card_front_image_filename,Concat("${baseUrl}",k.address_proof_front_image_filename) as address_proof_front_image_filename,Concat("${baseUrl}",k.address_proof_back_image_filename) as address_proof_back_image_filename from  ru_direct_selling_agents c left join ru_dsa_kyc_data k on c.dsa_id= k.dsa_id left join ru_direct_selling_agents p on c.partner_code= p.dsa_mobile_number where c.dsa_mobile_number = ? `;
    let user = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    user = user[0] ? user[0] : null;
    if (!user) return user;
    query = ' select * from ru_dsa_verification_documents where dsa_id = ? ';
    bindParams = [user.dsa_id]
    let docs = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let urls = [];
    for (let i = 0; i < docs.length; i++) urls.push(docs[i].url);
    user.verification_documents = urls;
    return user;
}

const getRuloansCustomersKyc = async (where, offset, limit) => {
    let bindParams = [];
    let query = ' SELECT  *  FROM ru_dsa_kyc_data ';
    let queryCount = ' SELECT  count(*) as totalCount FROM ru_dsa_kyc_data ';
    if (where && where.length != 0) {
        query += ' where ';
        queryCount += ' where ';
        for (let i = 0; i < where.length; i++) {
            if (i == 0) {
                query += where[i][0] + ' = ? ';
                queryCount += where[i][0] + ' = ? ';
            }
            else {
                query += ' and ' + where[i][0] + ' = ? ';
                queryCount += ' and ' + where[i][0] + ' = ? ';
            }
            bindParams.push(where[i][1])
        }
    }
    query += ` order by created_at desc limit ${offset},${limit} `;
    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    const totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    return { results, totalCount: totalCount[0].totalCount };
    // We didn't need to destructure the result here - the results were returned directly
}

const getCreditCardApplications = async (id, where, search, offset, limit) => {
    let bindParams = [];
    let query = ' SELECT  cc.*,rccb.bank_name as bank_name,rcsl.cc_application_status_description as application_status,ccm.credit_score, d.full_name as customer_name , d.customer_mobile_number as customer_mobile_number,d.address_state as state,d.address_city as city,d.email_address as customer_email_address  from ru_direct_selling_agents  c  left join ru_credit_card_applications cc on c.dsa_mobile_number = cc.dsa_mobile_number left join ru_credit_card_applications_meta ccm on cc.cc_application_id = ccm.cc_application_id left join ru_customers d on cc.permanent_account_number = d.permanent_account_number left join ru_cc_application_status_list rcsl on cc.application_status = rcsl.cc_application_status_id left join ru_credit_card_banks rccb on cc.bank_id = rccb.bank_id  ';
    let queryCount = ' SELECT  count(*) as totalCount from ru_direct_selling_agents  c  left join ru_credit_card_applications cc on c.dsa_mobile_number = cc.dsa_mobile_number left join ru_customers d on cc.permanent_account_number = d.permanent_account_number  ';
    let and = false;
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
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += ` order by cc.created_at desc limit ${offset},${limit} `;
    const totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    const creditCardApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return { creditCardApplications: creditCardApplications, totalCount: totalCount[0].totalCount };
}

const getLntLoanApplications = async (id, where, search, offset, limit) => {
    let bindParams = [];
    let query = ' SELECT   lt.*,ltm.failure_reason as failure_reason,ltm.app_ref as app_ref,ltm.sub_stage as sub_stage,ltm.stage as stage,ltls.application_status_description as status, d.full_name as customer_name , d.customer_mobile_number as customer_mobile_number,d.address_state as state,d.address_city as city,d.email_address as customer_email_address  from ru_lt_personal_loan_applications lt  left join  ru_direct_selling_agents c on lt.dsa_mobile_number = c.dsa_mobile_number left join ru_customers d on lt.permanent_account_number = d.permanent_account_number left join ru_lt_personal_loan_application_status_list ltls on lt.application_status = ltls.application_status_id left join ru_lt_personal_loan_applications_meta ltm on lt.application_id = ltm.application_id ';
    let queryCount = ' SELECT  count(*) as totalCount  from ru_lt_personal_loan_applications lt  left join  ru_direct_selling_agents c on lt.dsa_mobile_number = c.dsa_mobile_number left join ru_customers d on lt.permanent_account_number = d.permanent_account_number left join ru_lt_personal_loan_application_status_list ltls on lt.application_status = ltls.application_status_id left join ru_lt_personal_loan_applications_meta ltm on lt.application_id = ltm.application_id ';
    let and = false;
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
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += ` order by lt.created_at desc limit ${offset},${limit} `;
    const totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    const lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return { lntApplications: lntApplications, totalCount: totalCount[0].totalCount };
}
const getAllCreditCardApplications = async (count_only, where, search, offset, limit, childPhones, loggedInUser) => {
    let bindParams = [];
    let query = ' SELECT  cc.*,rccb.bank_name as bank_name,rcsl.cc_application_status_description as application_status,ccm.credit_score as credit_score, ccm.bfl_mcp_check_failed_reason as failure_reason, c.full_name as dsa_name,d.full_name as customer_name,d.address_state as state,d.address_city as city , d.customer_mobile_number as customer_mobile_number, sa.name as assigned_to_name, sab.name as assigned_by_name from ru_credit_card_applications cc left join ru_direct_selling_agents   c on cc.dsa_mobile_number = c.dsa_mobile_number left join ru_credit_card_applications_meta ccm on cc.cc_application_id = ccm.cc_application_id left join ru_customers d on cc.permanent_account_number = d.permanent_account_number left join ru_cc_application_status_list rcsl on cc.application_status = rcsl.cc_application_status_id left join ru_credit_card_banks rccb on cc.bank_id = rccb.bank_id left join CRMTest.users sa on cc.assigned_to = bin_to_uuid(sa.id) left join CRMTest.users sab on cc.assigned_by = bin_to_uuid(sab.id) ';
    let queryCount = ' SELECT  count(*) as totalCount from  ru_credit_card_applications cc ';
    let and = false;

    if (where?.lentgh || search?.length) {
        queryCount += ` left join ru_direct_selling_agents   c on cc.dsa_mobile_number = c.dsa_mobile_number left join ru_credit_card_applications_meta ccm on cc.cc_application_id = ccm.cc_application_id left join ru_customers d on cc.permanent_account_number = d.permanent_account_number left join ru_cc_application_status_list rcsl on cc.application_status = rcsl.cc_application_status_id left join ru_credit_card_banks rccb on cc.bank_id = rccb.bank_id `;
    };

    if (loggedInUser) {
        query += ` where (cc.assigned_to = '${loggedInUser}' `;
        queryCount += ` where (cc.assigned_to = '${loggedInUser}' `;
        and = true;
    }

    if (childPhones) {
        query += ` ${and === false ? "where" : "or"} cc.dsa_mobile_number in (
                WITH RECURSIVE DSAHierarchy AS (
                    SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
                    UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) )`;
        queryCount += ` ${and === false ? "where" : "or"} cc.dsa_mobile_number in (
                WITH RECURSIVE DSAHierarchy AS (
                    SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
                    UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) )`;
        bindParams.push(childPhones);
        and = true;
    };

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

    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += ` order by cc.created_at desc limit ${offset},${limit}  `;
    let totalCount = [{ totalCount: limit }]
    let creditCardApplications = [];

    if (count_only) {
        totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    } else {
        creditCardApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    };
    return { creditCardApplications: creditCardApplications, totalCount: totalCount[0].totalCount };
}

const getLoanApplications = async (id, where, search, offset, limit, suggestedBanksFilter) => {
    let bindParams = [];
    let querySuggestedBanks;
    let suggestedBanks;
    let applicationIds = [];
    if (suggestedBanksFilter) {
        querySuggestedBanks = `select application_id  from ru_eligible_banks_data where bank_name = '${suggestedBanksFilter}'`;
        suggestedBanks = await _db2.query(querySuggestedBanks, { replacements: bindParams, type: QueryTypes.SELECT });
        for (let i = 0; i < suggestedBanks.length; i++) {
            if (suggestedBanks[i].application_id != null) applicationIds.push(suggestedBanks[i].application_id);
        }
    }
    let query = ` SELECT  l.*,JSON_EXTRACT(lm.eligible_banks_data, '$.data.eligibleBank[*].bank_name') AS eligible_bank_names,lst.application_status_description as status,lt.loan_name as loan_type,lt.required_documents_id_list as documents_list,d.full_name as customer_name ,d.address_state as state,d.address_city as city, d.email_address as customer_email_address,d.customer_mobile_number as customer_mobile_number from  ru_loan_applications l left join ru_direct_selling_agents c on l.dsa_mobile_number = c.dsa_mobile_number left join ru_customers d on l.permanent_account_number = d.permanent_account_number left join ru_eligible_banks_data b on l.application_id = b.application_id left join ru_loan_types lt on l.loan_type = lt.id left join ru_loan_application_status_list as lst on l.application_status = lst.application_status_id left join ru_loan_applications_meta lm on l.application_id = lm.application_id `;
    let queryCount = ' SELECT  count(*) as totalCount from ru_direct_selling_agents  c left join ru_loan_applications l on c.dsa_mobile_number = l.dsa_mobile_number left join ru_customers d on l.permanent_account_number = d.permanent_account_number  left join ru_loan_types lt on l.loan_type = lt.id ';
    let and = false;
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
    if (applicationIds && applicationIds.length != 0) {
        if (and == true) {
            query += ' and  l.application_id in (?) ';
            queryCount += ' and  l.application_id in (?) ';
            bindParams.push(applicationIds);
        } else {
            query += ' where  l.application_id in (?) ';
            queryCount += ' where  l.application_id in (?) ';
            bindParams.push(applicationIds);
        }
    }
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += ` order by l.created_at desc limit ${offset},${limit} `;
    const totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    let loanApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    applicationIds = [];
    let maxLength;
    for (let i = 0; i < loanApplications.length; i++) {
        if (loanApplications[i].documents_list && loanApplications[i].documents_list != 0) {
            maxLength = loanApplications[i].documents_list.length;
            console.log("MaxLength", maxLength)
            let documentListQuery = 'select key_name_2 from ru_documents_lists where id in (?) ';
            let params = [loanApplications[i].documents_list];
            let documentKeys = await _db2.query(documentListQuery, { replacements: params, type: QueryTypes.SELECT });
            let documentQuery = 'select * from ru_loan_application_documents where application_id = ? ';
            params = [loanApplications[i].application_id];
            let document = await _db2.query(documentQuery, { replacements: params, type: QueryTypes.SELECT });
            document = document[0] ? document[0] : null;
            if (document && documentKeys && documentKeys.length != 0) {
                let count = 0;
                for (let i = 0; i < documentKeys.length; i++) {
                    if (document[documentKeys[i].key_name_2] != null) count++;
                }
                loanApplications[i].document_percentage = count / maxLength * 100;
            } else {
                loanApplications[i].document_percentage = 0;
            }
        } else {
            loanApplications[i].document_percentage = 0;
        }
    }
    if (loanApplications.length != 0) {
        for (let i = 0; i < loanApplications.length; i++) {
            applicationIds.push(loanApplications[i].application_id);
        }
        querySuggestedBanks = 'select application_id , bank_name from ru_eligible_banks_data where application_id in (?) ';
        bindParams = [applicationIds]
        suggestedBanks = await _db2.query(querySuggestedBanks, { replacements: bindParams, type: QueryTypes.SELECT });
        for (let j = 0; j < suggestedBanks.length; j++) {
            for (let i = 0; i < loanApplications.length; i++) {
                if (loanApplications[i].application_id === suggestedBanks[j].application_id) {
                    if (!loanApplications[i].suggestedBanks) {
                        loanApplications[i].suggestedBanks = [];
                    }
                    loanApplications[i].suggestedBanks.push(suggestedBanks[j].bank_name);
                }
            }
        }
    }
    return { loanApplications: loanApplications, totalCount: totalCount[0].totalCount };
}

const getAllLoanApplications = async (where, search, offset, limit, suggestedBanksFilter, childPhones, loggedInUser, allow_masking, is_export) => {
    let bindParams = [];
    let querySuggestedBanks;
    let suggestedBanks;
    let applicationIds = [];
    if (suggestedBanksFilter) {
        querySuggestedBanks = `select application_id  from ru_eligible_banks_data where bank_name = '${suggestedBanksFilter}'`;
        suggestedBanks = await _db2.query(querySuggestedBanks, { replacements: bindParams, type: QueryTypes.SELECT });
        for (let i = 0; i < suggestedBanks.length; i++) {
            if (suggestedBanks[i].application_id != null) applicationIds.push(suggestedBanks[i].application_id);
        }
    }
    let exportQuery = allow_masking ? ` concat(left(l.permanent_account_number, 1), '*******', right(l.permanent_account_number, 2)) as permanent_account_number, concat('*****', right(d.customer_mobile_number, 5)) as customer_mobile_number, concat('*****', right(l.dsa_mobile_number, 5)) as dsa_mobile_number ` : ` l.permanent_account_number, d.customer_mobile_number, l.dsa_mobile_number `;
    let query = ` SELECT  distinct l.*,JSON_EXTRACT(lm.eligible_banks_data, '$.data.eligibleBank[*].bank_name') AS eligible_bank_names ,c.full_name as dsa_name,lst.application_status_description as status,d.address_state as state,d.address_city as city ,lt.loan_name as loan_type,lt.required_documents_id_list as documents_list,d.full_name as customer_name , sa.name as assigned_to_name, sab.name as assigned_by_name, lm.cibil_range as cibil, ${exportQuery} from ru_loan_applications l left join ru_direct_selling_agents  c   on l.dsa_mobile_number = c.dsa_mobile_number left join ru_customers d on l.permanent_account_number = d.permanent_account_number left join ru_eligible_banks_data b on l.application_id = b.application_id left join ru_loan_types lt on l.loan_type = lt.id left join ru_loan_application_status_list as lst on l.application_status = lst.application_status_id left join CRMTest.users sa on l.assigned_to = bin_to_uuid(sa.id) left join CRMTest.users sab on l.assigned_by = bin_to_uuid(sab.id) left join ru_loan_applications_meta lm on l.application_id = lm.application_id `;
    let queryCount = ' SELECT  count(*) as totalCount from  ru_loan_applications l ';
    let and = false;

    if (checkForMainTable(where, ["l", "d", "lt", "lst", "c", "sa", "sab", "lm"]) || search?.length) {
        queryCount += ` left join ru_direct_selling_agents  c   on l.dsa_mobile_number = c.dsa_mobile_number left join ru_customers d on l.permanent_account_number = d.permanent_account_number left join ru_eligible_banks_data b on l.application_id = b.application_id left join ru_loan_types lt on l.loan_type = lt.id left join ru_loan_application_status_list as lst on l.application_status = lst.application_status_id left join CRMTest.users sa on l.assigned_to = bin_to_uuid(sa.id) left join CRMTest.users sab on l.assigned_by = bin_to_uuid(sab.id) left join ru_loan_applications_meta lm on l.application_id = lm.application_id `;
    };

    if (loggedInUser) {
        query += ` where (l.assigned_to = '${loggedInUser}' `;
        queryCount += ` where (l.assigned_to = '${loggedInUser}' `;
        and = true;
    };

    if (childPhones) {
        query += ` ${and === false ? "where" : "or"} l.dsa_mobile_number in (
                WITH RECURSIVE DSAHierarchy AS (
                    SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
                    UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) )`;
        queryCount += ` ${and === false ? "where" : "or"} l.dsa_mobile_number in (
                WITH RECURSIVE DSAHierarchy AS (
                    SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
                    UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) )`;
        and = true;
        bindParams.push(childPhones);
    };

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
    if (applicationIds && applicationIds.length != 0) {
        if (and == true) {
            query += ' and  l.application_id in (?) ';
            queryCount += ' and  l.application_id in (?) ';
            bindParams.push(applicationIds);
        } else {
            query += ' where  l.application_id in (?) ';
            queryCount += ' where  l.application_id in (?) ';
            bindParams.push(applicationIds);
        }
    }

    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += ` order by l.created_at desc `;

    if (is_export) {
        return { query, queryCount, bindParams };
    };

    if (limit) {
        query += ` limit ${offset},${limit} `
    };

    const totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    let loanApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    applicationIds = [];
    let maxLength;

    for (let i = 0; i < loanApplications.length; i++) {
        if (loanApplications[i].documents_list && loanApplications[i].documents_list != 0) {
            maxLength = loanApplications[i].documents_list.length;
            loanApplications[i].documents_list = loanApplications[i].documents_list.split(',')
            let documentListQuery = 'select key_name_2 from ru_documents_lists where id in (?) ';
            let params = [loanApplications[i].documents_list];
            let documentKeys = await _db2.query(documentListQuery, { replacements: params, type: QueryTypes.SELECT });
            //console.log("MaxLength",documentKeys)
            let documentQuery = 'select * from ru_loan_application_documents where application_id = ? ';
            params = [loanApplications[i].application_id];
            let document = await _db2.query(documentQuery, { replacements: params, type: QueryTypes.SELECT });
            document = document[0] ? document[0] : null;
            if (document && documentKeys && documentKeys.length != 0) {
                let count = 0;
                for (let j = 0; j < documentKeys.length; j++) {
                    if (document[documentKeys[j].key_name_2] != null) count++;
                }
                loanApplications[i].document_percentage = count / maxLength * 100;
            } else {
                loanApplications[i].document_percentage = 0;
            }
        } else {
            loanApplications[i].document_percentage = 0;
        }
    }
    if (loanApplications.length != 0) {
        for (let i = 0; i < loanApplications.length; i++) {
            applicationIds.push(loanApplications[i].application_id);
        }
        querySuggestedBanks = 'select application_id , bank_name from ru_eligible_banks_data where application_id in (?) and application_id is not null ';
        bindParams = [applicationIds]
        suggestedBanks = await _db2.query(querySuggestedBanks, { replacements: bindParams, type: QueryTypes.SELECT });
        for (let j = 0; j < suggestedBanks.length; j++) {
            for (let i = 0; i < loanApplications.length; i++) {
                if (loanApplications[i].application_id === suggestedBanks[j].application_id) {
                    if (!loanApplications[i].suggestedBanks) {
                        loanApplications[i].suggestedBanks = [];
                    }
                    loanApplications[i].suggestedBanks.push(suggestedBanks[j].bank_name);
                }
            }
        }
    }
    return { loanApplications: loanApplications, totalCount: totalCount[0].totalCount };
}

const getCustomerUserDetails = async (where) => {
    let query = ` SELECT DISTINCT c.id, sp.full_name as sp_name, c.sp_mobile_number, dsa.full_name as dsa_name, c.dsa_mobile_number, (select count(*) from ru_credit_card_applications cc where cc.dsa_mobile_number = c.dsa_mobile_number) as creditCardSubmited, (select count(*) from ru_loan_applications l where l.dsa_mobile_number = c.dsa_mobile_number) as loanSubmited, (select count(*) from ru_lt_personal_loan_applications lt where lt.dsa_mobile_number = c.dsa_mobile_number) as lntCount, c.first_name as first_name, c.address_state as state, c.address_city as city, c.last_name as last_name, c.full_name as full_name, c.email_address as email_address, c.customer_mobile_number as customer_mobile_number, c.permanent_account_number as permanent_account_number, c.is_mobile_number_verified as is_mobile_number_verified, c.customer_id, (SELECT description FROM ru_customer_consents WHERE customer_id = c.customer_id AND consent_type = 'withdrawn' ORDER BY created_at DESC LIMIT 1) AS withdraw_consent_reason, c.is_active FROM ru_customers c LEFT JOIN ru_direct_selling_agents dsa ON c.dsa_mobile_number = dsa.dsa_mobile_number LEFT JOIN ru_direct_selling_agents sp ON c.sp_mobile_number = sp.dsa_mobile_number ${where} LIMIT 1 `;
    const customer = await _db2.query(query, { type: QueryTypes.SELECT });
    return customer[0] ? customer[0] : null;
};

const getCustomerLoanApplications = async (pan, where, search, offset, limit, noLimit) => {
    let bindParams = [];
    let query = ' SELECT  distinct l.*,lab.bank_name as bank_name, lst.application_status_description as status,c.full_name as dsa_name,lt.loan_name as loan_type,c.email_address as dsa_email,c.dsa_id as dsa_id,c.dsa_mobile_number as dsa_mobile_number from ru_loan_applications  l left join  ru_direct_selling_agents c on l.dsa_mobile_number = c.dsa_mobile_number left join ru_loan_applications_meta lam on l.application_id = lam.application_id left join ru_loan_application_banks lab on lam.selected_bank_id = lab.id left join ru_loan_types lt on l.loan_type = lt.id left join ru_loan_application_status_list as lst on l.application_status = lst.application_status_id ';
    let queryCount = ' SELECT  count(*) as totalCount from ru_loan_applications  l left join  ru_direct_selling_agents c on l.dsa_mobile_number = c.dsa_mobile_number left join ru_loan_types lt on l.loan_type = lt.id ';
    let and = false;
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
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    if (noLimit == true) query += `order by l.created_at desc`;
    else query += `order by l.created_at desc limit ${offset},${limit} `;
    const totalCount = noLimit == true ? [{ totalCount: 0 }] : await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    const loanApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let maxLength;
    for (let i = 0; i < loanApplications.length; i++) {
        if (loanApplications[i].documents_list && loanApplications[i].documents_list != 0) {
            maxLength = loanApplications[i].documents_list.length;
            let documentListQuery = 'select key_name_2 from ru_documents_lists where id in (?) ';
            let params = [loanApplications[i].documents_list];
            let documentKeys = await _db2.query(documentListQuery, { replacements: params, type: QueryTypes.SELECT });
            let documentQuery = 'select * from ru_loan_application_documents where application_id = ? ';
            params = [loanApplications[i].application_id];
            let document = await _db2.query(documentQuery, { replacements: params, type: QueryTypes.SELECT });
            document = document[0] ? document[0] : null;
            if (document && documentKeys && documentKeys.length != 0) {
                let count = 0;
                for (let i = 0; i < documentKeys.length; i++) {
                    if (document[documentKeys[i].key_name_2] != null) count++;
                }
                loanApplications[i].document_percentage = count / maxLength * 100;
            } else {
                loanApplications[i].document_percentage = 0;
            }
        } else {
            loanApplications[i].document_percentage = 0;
        }
    }
    return { loanApplications: loanApplications, totalCount: totalCount[0].totalCount };
}

const tomerLoanApplications = async (pan, where, search, offset, limit, noLimit) => {
    let bindParams = [];
    let query = ' SELECT  distinct l.*,lab.bank_name as bank_name, lst.application_status_description as status,c.full_name as dsa_name,lt.loan_name as loan_type,c.email_address as dsa_email,c.dsa_id as dsa_id,c.dsa_mobile_number as dsa_mobile_number from ru_loan_applications  l left join  ru_direct_selling_agents c on l.dsa_mobile_number = c.dsa_mobile_number left join ru_loan_applications_meta lam on l.application_id = lam.application_id left join ru_loan_application_banks lab on lam.selected_bank_id = lab.id left join ru_loan_types lt on l.loan_type = lt.id left join ru_loan_application_status_list as lst on l.application_status = lst.application_status_id ';
    let and = false;
    if (pan?.length) { query += ` where l.permanent_account_number in (?) ` };
    bindParams.push(pan)
    if (noLimit == true) query += `order by l.created_at desc`;
    else query += `order by l.created_at desc limit ${offset},${limit} `;
    const loanApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let maxLength;
    for (let i = 0; i < loanApplications.length; i++) {
        if (loanApplications[i].documents_list && loanApplications[i].documents_list != 0) {
            maxLength = loanApplications[i].documents_list.length;
            let documentListQuery = 'select key_name_2 from ru_documents_lists where id in (?) ';
            let params = [loanApplications[i].documents_list];
            let documentKeys = await _db2.query(documentListQuery, { replacements: params, type: QueryTypes.SELECT });
            let documentQuery = 'select * from ru_loan_application_documents where application_id = ? ';
            params = [loanApplications[i].application_id];
            let document = await _db2.query(documentQuery, { replacements: params, type: QueryTypes.SELECT });
            document = document[0] ? document[0] : null;
            if (document && documentKeys && documentKeys.length != 0) {
                let count = 0;
                for (let i = 0; i < documentKeys.length; i++) {
                    if (document[documentKeys[i].key_name_2] != null) count++;
                }
                loanApplications[i].document_percentage = count / maxLength * 100;
            } else {
                loanApplications[i].document_percentage = 0;
            }
        } else {
            loanApplications[i].document_percentage = 0;
        }
    }
    return loanApplications;
}

const getAllCustomerLntApplications = async (pan, where, search, offset, limit, noLimit) => {
    let bindParams = [];
    let and = false;
    let query = ' SELECT  distinct lt.*,ltm.failure_reason as failure_reason,ltm.sub_stage as sub_stage,ltm.stage as stage,ltls.application_status_description as status ,c.full_name as dsa_name,c.email_address as dsa_email,c.dsa_id as dsa_id,c.dsa_mobile_number as dsa_mobile_number from ru_lt_personal_loan_applications lt   left join  ru_direct_selling_agents c on  lt.dsa_mobile_number = c.dsa_mobile_number left join ru_lt_personal_loan_application_status_list ltls on lt.application_status = ltls.application_status_id left join ru_lt_personal_loan_applications_meta ltm on lt.application_id = ltm.application_id ';
    if (pan?.length) { query += ` where lt.permanent_account_number in (?) ` };
    bindParams.push(pan)
    if (noLimit == true) query += `order by lt.created_at desc`;
    else query += `order by lt.created_at desc limit ${offset},${limit} `;
    const lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return lntApplications;
}

const getAllCutomerCreditCardApplications = async (pan, where, search, offset, limit, noLimit) => {
    let bindParams = [];
    let and = false;
    let query = ' SELECT  distinct cc.*,rcb.bank_name as bank_name,ccm.credit_score as credit_score,c.full_name as dsa_name,c.email_address as dsa_email,c.dsa_id as dsa_id,c.dsa_mobile_number as dsa_mobile_number from ru_credit_card_applications cc   left join  ru_direct_selling_agents c on cc.dsa_mobile_number = c.dsa_mobile_number left join ru_credit_card_applications_meta ccm on cc.cc_application_id = ccm.cc_application_id  left join ru_credit_card_banks rcb on cc.bank_id = rcb.id  ';
    if (pan?.length) { query += ` where cc.permanent_account_number in (?) ` };
    bindParams.push(pan)
    if (noLimit == true) query += `order by cc.created_at desc`;
    else query += `order by cc.created_at desc limit ${offset},${limit} `;
    const creditCardApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return creditCardApplications;
}

const getCutomerCreditCardApplications = async (pan, where, search, offset, limit, noLimit) => {
    let bindParams = [];
    let and = false;
    let query = ' SELECT  distinct cc.*,rcb.bank_name as bank_name,ccm.credit_score as credit_score,c.full_name as dsa_name,c.email_address as dsa_email,c.dsa_id as dsa_id,c.dsa_mobile_number as dsa_mobile_number from ru_credit_card_applications cc   left join  ru_direct_selling_agents c on cc.dsa_mobile_number = c.dsa_mobile_number left join ru_credit_card_applications_meta ccm on cc.cc_application_id = ccm.cc_application_id  left join ru_credit_card_banks rcb on cc.bank_id = rcb.id  ';
    let queryCount = ' SELECT  count(*) as totalCount from ru_credit_card_applications cc   left join  ru_direct_selling_agents c on cc.dsa_mobile_number = c.dsa_mobile_number  left join ru_credit_card_applications_meta ccm on cc.cc_application_id = ccm.cc_application_id ';
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
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    if (noLimit == true) query += `order by cc.created_at desc`;
    else query += `order by cc.created_at desc limit ${offset},${limit} `;
    const totalCount = noLimit == true ? [{ totalCount: 0 }] : await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    const creditCardApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return { creditCardApplications: creditCardApplications, totalCount: totalCount[0].totalCount };
}

const getCustomerLoanDocuments = async (applicationId) => {
    let bindParams = [applicationId];
    let basePath = 'https://ruloans-bucket.s3.ap-south-1.amazonaws.com/';
    let query = ` select d.id as id, d.application_id as application_id, concat('${basePath}',d.passport_size_picture_file_path) as passport_size_picture_file_path,concat('${basePath}',d.aadhaar_card_front_image_file_path) as aadhaar_card_front_image_file_path,concat('${basePath}',d.aadhaar_card_back_image_file_path) as aadhaar_card_back_image_file_path,concat('${basePath}',d.address_proof_front_image_file_path) as address_proof_front_image_file_path,concat('${basePath}',d.address_proof_back_image_file_path) as address_proof_back_image_file_path,concat('${basePath}',d.pan_card_front_image_file_path) as pan_card_front_image_file_path,concat('${basePath}',d.form_16_file_path) as form_16_file_path,concat('${basePath}',d.form_26_file_path) as form_26_file_path,concat('${basePath}',d.company_id_card_file_path) as company_id_card_file_path,concat('${basePath}',d.salary_slips_file_path) as salary_slips_file_path,concat('${basePath}',d.bank_statement_salary_account_file_path) as bank_statement_salary_account_file_path,
    concat('${basePath}',d.existing_loan_details_file_path) as existing_loan_details_file_path,concat('${basePath}',d.performa_invoice_file_path) as performa_invoice_file_path,concat('${basePath}',d.rc_file_path) as rc_file_path,concat('${basePath}',d.vehicle_insurance_file_path) as vehicle_insurance_file_path,concat('${basePath}',d.property_papers_file_path) as property_papers_file_path,concat('${basePath}',d.foreclosure_letter_file_path) as foreclosure_letter_file_path,concat('${basePath}',d.itr_file_path) as itr_file_path,concat('${basePath}',d.bank_statement_savings_account_file_path) as bank_statement_savings_account_file_path,concat('${basePath}',d.bank_statement_current_account_file_path) as bank_statement_current_account_file_path,concat('${basePath}',d.ownership_proof_file_path) as ownership_proof_file_path,concat('${basePath}',d.gst_certificate_file_path) as gst_certificate_file_path,concat('${basePath}',d.gst_returns_file_path) as gst_returns_file_path,concat('${basePath}',d.business_continuity_proof_file_path) as business_continuity_proof_file_path,concat('${basePath}',d.company_pan_card_file_path) as company_pan_card_file_path,
    concat('${basePath}',d.coi_file_path) as coi_file_path ,concat('${basePath}',d.moa_file_path) as mao_file_path,concat('${basePath}',d.aoa_file_path) as aoa_file_path,concat('${basePath}',d.shareholding_pattern_file_path) as shareholding_pattern_file_path,concat('${basePath}',d.partnership_deed_file_path) as partnership_deed_file_path,concat('${basePath}',d.company_pan_card_partnership_file_path) as company_pan_card_partnership_file_path,concat('${basePath}',d.login_fee_cheque_file_path) as login_fee_cheque_file_path,concat('${basePath}',d.sanction_letter_file_path) as sanction_letter_file_path, d.created_at as created_at,d.updated_at as updated_at from ru_loan_application_documents d where d.application_id= ? `;
    const documents = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return documents[0] ? documents[0] : null;
}
const getCustomerLoanCapturedDetails = async (applicationId) => {
    let bindParams = [applicationId];
    let query = ' SELECT  l.application_date as application_date,l.salary_per_annum as salary_per_annum,lst.application_status_description as status,lt.loan_name as loan_type,l.loan_amount as loan_amount,l.organisation_name as organisation_name,l.profession_type as profession_type,l.permanent_account_number as customer_pan_number ,c.full_name as dsa_name,c.email_address as dsa_email from ru_loan_applications  l left join  ru_direct_selling_agents c on l.dsa_mobile_number = c.dsa_mobile_number left join ru_loan_types lt on l.loan_type = lt.id left join  ru_loan_application_status_list as lst on l.application_status = lst.application_status_id  where l.application_id = ? ';
    const customerCapturedDetails = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return customerCapturedDetails[0] ? customerCapturedDetails[0] : null;
}

const getCustomerCreditCardCapturedDetails = async (applicationId) => {
    let bindParams = [applicationId];
    let query = ' SELECT  cc.application_date as application_date,cc.age as customer_age,cc.customer_mobile_number as cutomer_mobile_number,cc.email_address as customer_email_address,cc.pincode as customer_pincode,cc.full_name as customer_name,cc.permanent_account_number as customer_pan_number ,c.full_name as dsa_name,c.email_address as dsa_email from ru_credit_card_applications cc   left join  ru_direct_selling_agents c on cc.dsa_mobile_number = c.dsa_mobile_number where cc.cc_application_id = ? ';
    const customerCapturedDetails = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return customerCapturedDetails[0] ? customerCapturedDetails[0] : null;
}

const getCustomerLntApplications = async (pan, where, search, offset, limit, noLimit) => {
    let bindParams = [];
    let and = false;
    let query = ' SELECT  distinct lt.*,ltm.failure_reason as failure_reason,ltm.sub_stage as sub_stage,ltm.stage as stage,ltls.application_status_description as status ,c.full_name as dsa_name,c.email_address as dsa_email,c.dsa_id as dsa_id,c.dsa_mobile_number as dsa_mobile_number from ru_lt_personal_loan_applications lt   left join  ru_direct_selling_agents c on  lt.dsa_mobile_number = c.dsa_mobile_number left join ru_lt_personal_loan_application_status_list ltls on lt.application_status = ltls.application_status_id left join ru_lt_personal_loan_applications_meta ltm on lt.application_id = ltm.application_id ';
    let queryCount = ' SELECT  count(*) as totalCount from ru_lt_personal_loan_applications lt  left join  ru_direct_selling_agents c on  lt.dsa_mobile_number = c.dsa_mobile_number left join ru_lt_personal_loan_application_status_list ltls on lt.application_status = ltls.application_status_id left join ru_lt_personal_loan_applications_meta ltm on lt.application_id = ltm.application_id  ';
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
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    if (noLimit == true) query += `order by lt.created_at desc`;
    else query += `order by lt.created_at desc limit ${offset},${limit} `;
    const totalCount = noLimit == true ? [{ totalCount: 0 }] : await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    const lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return { lntApplications: lntApplications, totalCount: totalCount[0].totalCount };
}


const getCustomerLoanSuggestedBanks = async (applicationId) => {
    let bindParams = [applicationId];
    let query = ' SELECT bank_name,bank_logo_image,eligibility_as_per_multiplier as offered_loan_amount from ru_normal_pl_eligible_banks b where b.application_id = ? ';
    const customerLoanSuggestedBanks = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return customerLoanSuggestedBanks;
}

const getSuggestedBanksList = async () => {
    let query = ' SELECT distinct b.bank_name as bank_name from ru_eligible_banks_data b  ';
    const suggestedBanks = await _db2.query(query, { type: QueryTypes.SELECT });
    return suggestedBanks;
}

const getLoanType = async (for_product) => {
    let query;
    let loanTypes = [];
    if (for_product) {
        query = ' SELECT distinct id, alias, lt.name as loan_type from ru_loans_types lt ';
        loanTypes = await _db3.query(query, { type: QueryTypes.SELECT });
    } else {
        query = ' SELECT distinct lt.loan_name as loan_type from ru_loan_types lt ';
        loanTypes = await _db2.query(query, { type: QueryTypes.SELECT });
    };
    return loanTypes;
};

const getCustomerState = async () => {

    let bindParams = [];
    let query = ' SELECT  distinct state  FROM master_pin_codes c ';
    query += ` order by c.state asc `
    const results = await _db3.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results;
    // We didn't need to destructure the result here - the results were returned directly
}

const getCustomerCity = async (where) => {

    let bindParams = [];
    let and = false;
    let query = ' SELECT  distinct city as state FROM master_pin_codes c ';
    if (where && where.length != 0) {
        for (let i = 0; i < where.length; i++) {
            if (and == false) {
                query += ' where ';
                and = true;
            } else {
                query += ' and ';
                and = true;
            }
            if (where[i][2]) {
                query += where[i][0] + where[i][1] + ' ? ';
                bindParams.push(where[i][2]);
            } else {
                query += where[i][0] + where[i][1] + ' ';
            }
        }
    }
    query += ` order by c.city asc `;
    const results = await _db3.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results;
    // We didn't need to destructure the result here - the results were returned directly
};

const getCustomers = async (where, search, offset, limit, childPhones, tagsFilter, includeJoins, call_status, statusFilter, filterQuery) => {
    let anonymous_customer_admin = childPhones ? await getAllGlobalConfiguration(0, 1, "", "anonymous_customer_admin") : null;
    anonymous_customer_admin = Boolean(anonymous_customer_admin && anonymous_customer_admin["lntApplications"]) ? anonymous_customer_admin["lntApplications"]["setting_value"]?.split(",") : [];

    let bindParams = [];
    let and = false;

    const loanObj = {
        "personal_loan": `LEFT JOIN ru_personal_loan_applications la ON c.customer_id = la.customer_id`,
        "business_loan": `LEFT JOIN ru_bl_applications la ON c.customer_id = la.customer_id`,
        "machinery_loan": `LEFT JOIN ru_machinery_loan_applications la ON c.customer_id = la.customer_id`,
        "car_loan": `LEFT JOIN ru_car_loan_applications la ON c.customer_id = la.customer_id`,
        "car_refinance": `LEFT JOIN ru_car_refinance_applications la ON c.customer_id = la.customer_id`,
        "credit_card": `LEFT JOIN ru_cc_applications la ON c.customer_id = la.customer_id`,
        "education_loan": `LEFT JOIN ru_education_loan_applications la ON c.customer_id = la.customer_id`,
        "home_loan": `LEFT JOIN ru_hl_applications la ON c.customer_id = la.customer_id`,
        "gold_loan": `LEFT JOIN ru_gold_loan_applications la ON c.customer_id = la.customer_id`,
        "lap": `LEFT JOIN ru_lap_applications la ON c.customer_id = la.customer_id`,
        "loan_against_property": `LEFT JOIN ru_lap_applications la ON c.customer_id = la.customer_id`,
        "used_car_loan": `LEFT JOIN ru_used_car_loan_applications la ON c.customer_id = la.customer_id`,
        "solar_loan": `LEFT JOIN ru_solar_loan_applications la ON c.customer_id = la.customer_id`,

    };
    let call_logs_query = call_status ? ` LEFT JOIN (SELECT cl1.* FROM ( SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY createdAt DESC) AS rn FROM CRMTest.call_logs) cl1 WHERE cl1.rn = 1) AS cl ON cl.user_id = c.customer_id ` : "";
    let cutomer_query = statusFilter ? ` LEFT JOIN (SELECT cq.customer_id, cq.status FROM RULoans.ru_customer_queries cq WHERE cq.created_at = (SELECT MAX(cq2.created_at) FROM RULoans.ru_customer_queries cq2 WHERE cq2.customer_id = cq.customer_id)) cq ON cq.customer_id = c.customer_id ` : "";
    let customer_leads_utm_query = ` LEFT JOIN ru_customers_leads cl_utm ON cl_utm.id = (SELECT cl_sub.id FROM ru_customers_leads cl_sub WHERE cl_sub.customer_id = c.customer_id ORDER BY cl_sub.id ASC LIMIT 1) `;

    let query = ` SELECT distinct sp.dsa_mobile_number as sp_mobile_number, sp.full_name as sp_name, dsa.full_name as dsa_name, c.id, c.customer_id, c.dsa_mobile_number, c.salutation, c.first_name, c.middle_name, c.last_name, c.full_name, c.father_full_name AS father_name, c.mother_full_name AS mother_name, c.customer_mobile_number, c.is_mobile_number_verified, c.email_address, c.date_of_birth, c.age, c.gender, c.permanent_account_number, c.address_house_number, c.address_area, c.address_city, c.address_state,c.device_type, c.source_from, c.address_pincode, c.customer_created_date, c.created_at, c.updated_at, c.is_active,
                  cl_utm.utm_source AS utm_source,
                  cl_utm.utm_medium AS utm_medium,
                  cl_utm.utm_campaign AS utm_campaign,
                  cl_utm.utm_channel AS utm_channel,
                  cl_utm.utm_term AS utm_term,
                  cl_utm.ad_group_id AS adgroupid,
                  cl_utm.campaign_id AS campaignid,
                  cl_utm.ad AS ad,
                  cl_utm.mt AS mt,
                  cl_utm.adpos AS adpos,
                  cl_utm.gad AS gad,
                  cl_utm.gclid AS gclid,
                  cl_utm.fbclid AS fbclid,
                  cl_utm.utm_content AS utm_content,
                  cl_utm.utm_id AS utm_id,
                  cl_utm.utm_adgroup AS utm_adgroup,
                  cl_utm.utm_main_source AS utm_main_source,
                  cl_utm.page_source AS page_source
                  FROM ru_customers c
                  LEFT JOIN ru_direct_selling_agents dsa ON c.dsa_mobile_number = dsa.dsa_mobile_number
                  LEFT JOIN ru_direct_selling_agents sp ON c.sp_mobile_number = sp.dsa_mobile_number
                  ${cutomer_query} ${call_logs_query} ${customer_leads_utm_query} ${tagsFilter ? loanObj[tagsFilter] : ""} `;

    // Only include the cl_utm join in the count query if a UTM filter is active
    const needsUtmJoinInCount = where.some(
        (w) => typeof w[0] === 'string' && w[0].includes('cl_utm.')
    );
    let queryCount = ` SELECT COUNT(distinct c.id) as totalCount FROM  ru_customers c 
                ${includeJoins ? `LEFT JOIN ru_direct_selling_agents dsa ON c.dsa_mobile_number = dsa.dsa_mobile_number LEFT JOIN ru_direct_selling_agents sp ON c.sp_mobile_number = sp.dsa_mobile_number` : ""}
                ${cutomer_query} ${call_logs_query} ${needsUtmJoinInCount ? customer_leads_utm_query : ''} ${tagsFilter ? loanObj[tagsFilter] : ""} `;

    if (filterQuery) {
        query += filterQuery;
        queryCount += filterQuery;
    } else {
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
                if (where[i][2] || where[i][2] === 0) {
                    query += where[i][0] + where[i][1] + ' ? ';
                    queryCount += where[i][0] + where[i][1] + ' ? ';
                    bindParams.push(where[i][2]);
                } else {
                    query += where[i][0] + where[i][1] + ' ';
                    queryCount += where[i][0] + where[i][1] + '  ';
                }
            }
        };
    };

    if (childPhones) {
        query += `
            ${and === false ? "WHERE" : "AND"} (
                c.dsa_mobile_number IN (
                    WITH RECURSIVE DSAHierarchy AS (
                        SELECT dsa_mobile_number, partner_code
                        FROM ru_direct_selling_agents
                        WHERE dsa_mobile_number = ?
                        UNION ALL
                        SELECT t.dsa_mobile_number, t.partner_code
                        FROM ru_direct_selling_agents t
                        INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                    ) 
                    SELECT dsa_mobile_number
                    FROM DSAHierarchy
                )
                OR c.sp_mobile_number IN (
                    WITH RECURSIVE DSAHierarchy AS (
                        SELECT dsa_mobile_number, partner_code
                        FROM ru_direct_selling_agents
                        WHERE dsa_mobile_number = ?
                        UNION ALL
                        SELECT t.dsa_mobile_number, t.partner_code
                        FROM ru_direct_selling_agents t
                        INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                    ) 
                    SELECT dsa_mobile_number
                    FROM DSAHierarchy
                )
                ${anonymous_customer_admin?.includes(childPhones) ? `OR c.dsa_mobile_number is null OR c.dsa_mobile_number = "" ` : ""}
            )
        `;
        queryCount += `
            ${and === false ? "WHERE" : "AND"} (
                c.dsa_mobile_number IN (
                    WITH RECURSIVE DSAHierarchy AS (
                        SELECT dsa_mobile_number, partner_code
                        FROM ru_direct_selling_agents
                        WHERE dsa_mobile_number = ?
                        UNION ALL
                        SELECT t.dsa_mobile_number, t.partner_code
                        FROM ru_direct_selling_agents t
                        INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                    ) 
                    SELECT dsa_mobile_number
                    FROM DSAHierarchy
                )
                OR c.sp_mobile_number IN (
                    WITH RECURSIVE DSAHierarchy AS (
                        SELECT dsa_mobile_number, partner_code
                        FROM ru_direct_selling_agents
                        WHERE dsa_mobile_number = ?
                        UNION ALL
                        SELECT t.dsa_mobile_number, t.partner_code
                        FROM ru_direct_selling_agents t
                        INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                    ) 
                    SELECT dsa_mobile_number
                    FROM DSAHierarchy
                )
                
                ${anonymous_customer_admin?.includes(childPhones) ? `OR c.dsa_mobile_number is null ` : ""
            })`;
        and = true;
        bindParams.push(childPhones, childPhones, childPhones, childPhones);
    };

    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    };
    query += ` order by c.created_at desc limit ${offset},${limit} `;
    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    const totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    return { results, totalCount: totalCount[0].totalCount };
};

const getCustomerDetails = async (customer_id) => {
    let bindParams = [customer_id];
    let query = `
       SELECT
    c.first_name,
    c.last_name,
    c.email_address,
    c.customer_mobile_number,
    c.permanent_account_number,
    c.is_mobile_number_verified,
    c.gender,
    c.date_of_birth,
    c.father_full_name,
    c.mother_full_name,
    JSON_ARRAYAGG(
        JSON_OBJECT(
            'address_id', a.id,
            'address_type_id', a.address_type_id,
            'address_line_1', a.address_line_1,
            'address_line_2', a.address_line_2,
            'address_line_3', a.address_line_3,
            'pin_code', a.pin_code,
            'city', a.city,
            'state', a.state,
            'country', a.country,
            'landmark', a.landmark
        )
    ) AS customer_addresses,
    (
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'income_id', i.income_id,
                'employee_type', i.employee_type,
                'monthly_income', i.monthly_income,
                'customer_company_id', i.customer_company_id,
                'employment_start_date', i.employment_start_date,
                'employment_end_date', i.employment_end_date,
                'profession', i.profession,
                'salary_mode', i.salary_mode,
                'income_type', i.income_type,
                'business_vintage', i.business_vintage,
                'business_turnover', i.business_turnover,
                'total_work_exp', i.total_work_exp,
                'nature_of_business', i.nature_of_business,
                'company_details', JSON_OBJECT(
                    'company_name', cc.company_name,
                    'company_type', cc.company_type,
                    'company_phone', cc.phone,
                    'company_email', cc.email_address,
                    'website_url', cc.website_url,
                    'incorp_date', cc.incorp_date,
                    'gstin', cc.gstin,
                    'company_address', JSON_OBJECT(
                        'address_type_id', ca.address_type_id,
                        'address_line_1', ca.address_line_1,
                        'address_line_2', ca.address_line_2,
                        'address_line_3', ca.address_line_3,
                        'pin_code', ca.pin_code,
                        'city', ca.city,
                        'state', ca.state,
                        'country', ca.country
                    )
                )
            )
        )
        FROM ru_customer_income_details i
        LEFT JOIN ru_customer_companies cc ON cc.id = i.customer_company_id
        LEFT JOIN ru_customer_company_address_mappings ccam ON ccam.customer_company_id = cc.id
        LEFT JOIN ru_company_addresses ca ON ca.id = ccam.company_address_id
        WHERE i.customer_id = c.customer_id
    ) AS customer_incomes
FROM
    ru_customers AS c
LEFT JOIN
    ru_customer_addresses AS a ON c.customer_id = a.customer_id
WHERE
    c.customer_id = ?
GROUP BY
    c.customer_id
    `;

    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    console.log(results)
    return results[0] ? results[0] : results;
};

const getCustomerApplicationLogs = async (customer_id) => {
    let bindParams = [customer_id];
    let query = `
       SELECT
    c.first_name,
    c.last_name,
    c.email_address,
    c.customer_mobile_number,
    c.permanent_account_number,
    c.is_mobile_number_verified,
    c.gender,
    c.date_of_birth,
    c.father_full_name,
    c.mother_full_name,
    JSON_ARRAYAGG(
        JSON_OBJECT(
            'address_id', a.id,
            'address_type_id', a.address_type_id,
            'address_line_1', a.address_line_1,
            'address_line_2', a.address_line_2,
            'address_line_3', a.address_line_3,
            'pin_code', a.pin_code,
            'city', a.city,
            'state', a.state,
            'country', a.country,
            'landmark', a.landmark
        )
    ) AS customer_addresses,
    (
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'income_id', i.income_id,
                'employee_type', i.employee_type,
                'monthly_income', i.monthly_income,
                'customer_company_id', i.customer_company_id,
                'employment_start_date', i.employment_start_date,
                'employment_end_date', i.employment_end_date,
                'profession', i.profession,
                'salary_mode', i.salary_mode,
                'income_type', i.income_type,
                'business_vintage', i.business_vintage,
                'business_turnover', i.business_turnover,
                'total_work_exp', i.total_work_exp,
                'nature_of_business', i.nature_of_business
            )
        )
        FROM ru_customer_income_details i
        WHERE i.customer_id = c.customer_id
    ) AS customer_incomes
FROM
    ru_customers AS c
LEFT JOIN
    ru_customer_addresses AS a ON c.customer_id = a.customer_id
WHERE
    c.customer_id = ?
GROUP BY
    c.customer_id
    `;

    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    console.log(results);
    return results[0] ? results[0] : results;
};


const updateCustomerFields = async (customerId, customerUpdates, addressUpdates, incomeUpdates) => {
    try {
        if (!customerId) {
            return { success: false, message: "Customer ID is required" };
        }

        const transaction = await _db2.transaction();

        try {
            // Update `ru_customers` table
            if (Object.keys(customerUpdates).length > 0) {
                const customerFields = Object.keys(customerUpdates)
                    .map((key) => `${key} = ?`)
                    .join(", ");
                const customerValues = Object.values(customerUpdates);

                const customerQuery = `
                    UPDATE ru_customers 
                    SET ${customerFields} 
                    WHERE customer_id = ?
                `;

                await _db2.query(customerQuery, {
                    replacements: [...customerValues, customerId],
                    type: QueryTypes.UPDATE,
                    transaction,
                });
            }


            if (Object.keys(addressUpdates).length > 0 && addressUpdates.address_id) {
                // Extract the keys excluding `address_id`
                const addressFields = Object.keys(addressUpdates)
                    .filter(key => key !== "address_id") // Exclude `address_id`
                    .map((key) => `${key} = ?`)
                    .join(", ");

                console.log("Fields to update:", addressFields);

                // Ensure values are ordered according to the filtered keys
                const addressValues = Object.keys(addressUpdates)
                    .filter(key => key !== "address_id") // Exclude `address_id`
                    .map(key => addressUpdates[key]);   // Map the values in the same order as keys

                console.log("Ordered address values:", addressValues);
                console.log("Address Updates:", addressUpdates);

                const addressQuery = `
                    UPDATE ru_customer_addresses 
                    SET ${addressFields} 
                    WHERE customer_id = ? AND id = ?
                `;

                await _db2.query(addressQuery, {
                    replacements: [...addressValues, customerId, addressUpdates.address_id],
                    type: QueryTypes.UPDATE,
                    transaction,
                });
            }



            // Update `ru_customer_income_details` table
            if (Object.keys(incomeUpdates).length > 0 && incomeUpdates.income_id) {
                console.log("incomeUpdates", incomeUpdates);
                const incomeFields = Object.keys(incomeUpdates)
                    .filter(key => key !== "income_id")
                    .map((key) => `${key} = ?`)
                    .join(", ");
                const incomeValues = Object.values(incomeUpdates).filter((value, index) => index !== 0);
                console.log("incomeFields", incomeFields);
                console.log("incomeValues", incomeValues);
                const incomeQuery = `
                    UPDATE ru_customer_income_details 
                    SET ${incomeFields} 
                    WHERE customer_id = ? AND income_id = ?
                `;

                await _db2.query(incomeQuery, {
                    replacements: [...incomeValues, customerId, incomeUpdates.income_id],
                    type: QueryTypes.UPDATE,
                    transaction,
                });
            }

            await transaction.commit(); // Commit transaction

            return { success: true };
        } catch (error) {
            await transaction.rollback(); // Rollback transaction on failure
            logger.error("Database transaction failed: ", error);
            return { success: false, message: "Database transaction failed" };
        }
    } catch (error) {
        logger.error("Error in updateCustomerData service: ", error);
        return { success: false, message: "Service execution failed" };
    }
};

const getDsaByIdForTree = async (dsaId) => {
    let bindParams = [dsaId];
    let query = ` SELECT  c.dsa_id as customer_id, c.dsa_verification_status as dsa_verification_status ,c.first_name as customer_first_name, c.last_name as cumstomer_last_name, c.full_name as customer_full_name, c.dsa_mobile_number as customer_mobile_number, k.permanent_account_number as pan_number from ru_direct_selling_agents  c left join ru_dsa_kyc_data k on c.dsa_id = k.dsa_id  where c.dsa_id = ? `;
    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
}

const getCurrentChilds = async (mobileNumer) => {
    let bindParams = [mobileNumer];
    let query = ` SELECT  c.dsa_id as customer_id, c.first_name as customer_first_name, c.last_name as cumstomer_last_name, c.full_name as customer_full_name, c.dsa_mobile_number as customer_mobile_number, k.permanent_account_number as pan_number from ru_direct_selling_agents  c left join ru_dsa_kyc_data k on c.dsa_id = k.dsa_id  where c.partner_code = ? order by c.id asc `;
    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results;

}

const getCurrentChildsWithCount = async (mobileNumer) => {
    let bindParams = [mobileNumer];
    let query = ` SELECT(select count(*)  from ru_direct_selling_agents d where(d.signup_steps_completed / 6) * 100 <= 25 and d.partner_code = c.dsa_mobile_number) as upto_25_percentage, (select count(*)  from ru_direct_selling_agents d where(d.signup_steps_completed / 6) * 100 <= 50 and(d.signup_steps_completed / 6) * 100 > 25 and d.partner_code = c.dsa_mobile_number ) as upto_50_percentage, (select count(*)  from ru_direct_selling_agents d where(d.signup_steps_completed / 6) * 100 <= 75 and(d.signup_steps_completed / 6) * 100 > 50 and d.partner_code = c.dsa_mobile_number ) as upto_75_percentage, (select count(*)  from ru_direct_selling_agents d where(d.signup_steps_completed / 6) * 100 <= 100 and(d.signup_steps_completed / 6) * 100 > 75 and d.partner_code = c.dsa_mobile_number ) as over_75_percentage, c.dsa_id as customer_id, c.first_name as customer_first_name, c.last_name as cumstomer_last_name, c.full_name as customer_full_name, c.dsa_mobile_number as customer_mobile_number, k.permanent_account_number as pan_number from ru_direct_selling_agents  c left join ru_dsa_kyc_data k on c.dsa_id = k.dsa_id  where c.partner_code = ? order by c.id asc `;
    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results;

}

const getCurrentChildsWhereIn = async (mobileNumers) => {
    let bindParams = [mobileNumers];
    let query = ` SELECT  c.dsa_id as customer_id, c.first_name as customer_first_name, c.last_name as cumstomer_last_name, c.full_name as customer_full_name, c.dsa_mobile_number as customer_mobile_number, k.permanent_account_number as pan_number from ru_direct_selling_agents  c left join ru_dsa_kyc_data k on c.dsa_id = k.dsa_id  where c.partner_code in (?) order by c.id asc `;
    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    // console.log("*****1")
    // console.log(results)
    return results;
};

const getDsaByPhone = async (mobileNumber, where) => {
    let bindParams = [mobileNumber];
    let query = ` SELECT c.is_direct_claim_enabled, c.business_head_code, c.dsa_id as customer_id, c.dsa_verification_status as dsa_verification_status, c.first_name as customer_first_name, c.last_name as cumstomer_last_name, c.full_name as customer_full_name, c.dsa_mobile_number as customer_mobile_number, k.permanent_account_number as pan_number from ru_direct_selling_agents  c left join ru_dsa_kyc_data k on c.dsa_id = k.dsa_id  where c.dsa_mobile_number = ? ${where ? `and DATE(c.created_at)${where}` : ""} `;
    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
};

const checkDsaExistsByMobile = async (mobileNumber) => {
    let query = `SELECT dsa_id, dsa_mobile_number FROM ru_direct_selling_agents WHERE dsa_mobile_number = ?`;
    const results = await _db2.query(query, { replacements: [mobileNumber], type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
};

const getDsaFullDetailsPhone = async (dsa_mobile_number) => {
    let query = ` select rdsa.*, rdkd.netsuite_vendor_id , rdkd.permanent_account_number , rdkd.ns_hierarchy , rdkd.class_id , p.dsa_id as partner_id , rdkb.account_number, rdkb.status as account_status from ru_direct_selling_agents rdsa left join ru_direct_selling_agents p on rdsa.partner_code = p.dsa_mobile_number left join ru_dsa_kyc_data rdkd  on rdsa.dsa_id = rdkd.dsa_id ${sqlPreferredBankAccountJoinByDsaId("rdkb", "rdsa.dsa_id")} where rdsa.dsa_mobile_number = ? `;
    let result = await _db2.query(query, { replacements: [dsa_mobile_number], type: QueryTypes.SELECT });
    if (result.length > 0) {
        result = result[0];
    }
    else {
        result = null;
    }
    return result;
};

const getDsaById = async (id) => {
    let bindParams = [id];
    let query = ` SELECT c.signup_steps_completed, c.assigning_payout_percentage, c.global_payouts_percentage, c.is_direct_claim_enabled , c.is_auto_erp, c.dsa_id as customer_id, c.partner_code,c.is_universal, c.dsa_verification_status as dsa_verification_status, c.first_name as customer_first_name, c.last_name as cumstomer_last_name, c.full_name as customer_full_name, c.dsa_mobile_number as customer_mobile_number, k.permanent_account_number as pan_number, c.company_id, c.vendor_deal_description,c.minimum_allowed_discount, c.is_same_day_billing_enabled,
    case when (k.mou_filename is null or k.mou_filename = "") then false else true end as mou_uploaded
    from ru_direct_selling_agents c left join ru_dsa_kyc_data k on c.dsa_id = k.dsa_id  where c.dsa_id = ? `;
    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
};

/** Single-column fetch; use when only same-day billing is needed (avoids heavy getDsaById join). */
const getDsaSameDayBillingEnabledById = async (dsa_id) => {
    const query = `SELECT is_same_day_billing_enabled FROM ru_direct_selling_agents WHERE dsa_id = ? LIMIT 1`;
    const results = await _db2.query(query, { replacements: [dsa_id], type: QueryTypes.SELECT });
    if (!results[0]) return null;
    return results[0].is_same_day_billing_enabled;
};

const getDsaAutonomousSettingsByDsaId = async (dsa_id) => {
    let query = `
        SELECT
            dsa_id,
            TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM CAST(autonomous_secured_payout AS CHAR))) AS autonomous_secured_payout,
            TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM CAST(autonomous_unsecured_payout AS CHAR))) AS autonomous_unsecured_payout,
            global_autonomous_disb_date_from,
            global_autonomous_disb_date_to
        FROM ru_dsa_autonomous_settings
        WHERE dsa_id = ?
        LIMIT 1
    `;
    const results = await _db2.query(query, { replacements: [dsa_id], type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
};

const saveDsaAutonomousPaymentSettings = async ({
    dsa_id,
    autonomous_secured_payout,
    autonomous_unsecured_payout,
    global_autonomous_disb_date_from,
    global_autonomous_disb_date_to,
}) => {
    const query = `
        INSERT INTO ru_dsa_autonomous_settings (
            dsa_id,
            autonomous_secured_payout,
            autonomous_unsecured_payout,
            global_autonomous_disb_date_from,
            global_autonomous_disb_date_to
        ) VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            autonomous_secured_payout = VALUES(autonomous_secured_payout),
            autonomous_unsecured_payout = VALUES(autonomous_unsecured_payout),
            global_autonomous_disb_date_from = VALUES(global_autonomous_disb_date_from),
            global_autonomous_disb_date_to = VALUES(global_autonomous_disb_date_to),
            updated_at = NOW()
    `;
    await _db2.query(query, {
        replacements: [
            dsa_id,
            autonomous_secured_payout,
            autonomous_unsecured_payout,
            global_autonomous_disb_date_from,
            global_autonomous_disb_date_to,
        ],
        type: QueryTypes.INSERT,
    });
    return true;
};

const getDsaByPrimaryId = async (id, key = "id") => {
    let bindParams = [id];
    let query = ` SELECT c.is_deleted, c.dsa_id, c.partner_code, c.dsa_verification_status as dsa_verification_status, c.full_name as full_name, c.dsa_mobile_number as dsa_mobile_number, c.access_control as access_control, c.is_direct_claim_enabled as is_direct_claim_enabled , c.assigning_payout_percentage, k.permanent_account_number as pan_number , k.netsuite_vendor_id as netsuite_vendor_id from ru_direct_selling_agents  c left join ru_dsa_kyc_data k on c.dsa_id = k.dsa_id where c.${key} = ? `;
    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let data = results[0] ? results[0] : null;
    return key == "id" ? data : results;
};

const getDsaKycById = async (id) => {
    let bindParams = [id];
    let query = ` SELECT * from  ru_dsa_kyc_data k where k.dsa_id = ? `;
    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
}

const getDsaKycByVendorId = async (vendor_id, dsa_id) => {
    let bindParams = [vendor_id, dsa_id];
    let query = ` SELECT * from  ru_dsa_kyc_data k where k.netsuite_vendor_id = ? and k.dsa_id <> ? `;
    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
}

const editDsaNSVendorId = async (dsa_id, vendor_id, dsa_mobile_number) => {
    let bindParams = [vendor_id, dsa_id];
    let query = ` update ru_dsa_kyc_data set netsuite_vendor_id = ? where dsa_id = ? `;
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });

    query = ` update ru_fresh_lead_claims set netsuite_vendor_id = ? where dsa_mobile_number = ? `;
    bindParams = [vendor_id, dsa_mobile_number]
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
};

const mergeDsa = async (mergeId, mergeToId, loggedInUser) => {
    let query = ` delete from ru_dsa_kyc_data where dsa_id = ? `;
    await _db2.query(query, { replacements: [mergeId], type: QueryTypes.UPDATE });
    query = ` update ru_dsa_kyc_data set dsa_id = ? where dsa_id = ? `;
    await _db2.query(query, { replacements: [mergeId, mergeToId], type: QueryTypes.UPDATE });
    query = ` update ru_direct_selling_agents set is_deleted = true where dsa_id = ? `;
    await _db2.query(query, { replacements: [mergeToId], type: QueryTypes.UPDATE });
    query = ` insert into application_logs(application_type, field, from_value, to_value, updated_by) values('dsa_merge', '',?,?, uuid_to_bin(?)) `;
    await sequelize.query(query, { replacements: [mergeId, mergeToId, loggedInUser.id], type: QueryTypes.INSERT });
}

const addCommunicationApplicationLog = async (dsa_id, template, template_id, partner_code) => {
    let query = `insert into application_logs(application_id, application_type, field, from_value, to_value, updated_by) values(?,?,?,?,?, uuid_to_bin(?))`
    let bindParams = [dsa_id, 'sms', partner_code, template_id, '', null];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
}
const getDsaByPhoneWithPercentage = async (mobileNumber, childPhones) => {
    let bindParams = [childPhones, childPhones, childPhones, childPhones, mobileNumber];
    let query = ` SELECT(select count(*)  from ru_direct_selling_agents d where(d.signup_steps_completed / 6) * 100 <= 25 and d.partner_code in (?)) as upto_25_percentage, (select count(*)  from ru_direct_selling_agents d where(d.signup_steps_completed / 6) * 100 <= 50 and(d.signup_steps_completed / 6) * 100 > 25  and d.partner_code in (?) ) as upto_50_percentage, (select count(*)  from ru_direct_selling_agents d where(d.signup_steps_completed / 6) * 100 <= 75 and(d.signup_steps_completed / 6) * 100 > 50  and d.partner_code in (?)) as upto_75_percentage, (select count(*)  from ru_direct_selling_agents d where(d.signup_steps_completed / 6) * 100 <= 100 and(d.signup_steps_completed / 6) * 100 > 75 and(d.signup_steps_completed / 6) * 100 <= 100 and d.partner_code in (?)) as over_75_percentage, c.dsa_id as customer_id, c.dsa_verification_status as dsa_verification_status, c.first_name as customer_first_name, c.last_name as cumstomer_last_name, c.full_name as customer_full_name, c.dsa_mobile_number as customer_mobile_number, k.permanent_account_number as pan_number from ru_direct_selling_agents  c left join ru_dsa_kyc_data k on c.dsa_id = k.dsa_id  where c.dsa_mobile_number = ? `;
    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
}
const getDsaByPan = async (panNumber, extra) => {
    let bindParams = [panNumber];
    let query = ` SELECT  c.hsn_hsc_number as hsc_hsn_number, c.dsa_id as customer_id, c.dsa_verification_status as dsa_verification_status, c.first_name as customer_first_name, c.last_name as cumstomer_last_name, c.full_name as customer_full_name, c.dsa_mobile_number as customer_mobile_number, k.permanent_account_number as pan_number, k.address_proof_number as aadhar_number from ru_direct_selling_agents  c left join ru_dsa_kyc_data k on c.dsa_id = k.dsa_id  where k.permanent_account_number = ? ${extra || ""} `;
    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
}

const updateDsaVerifyStatus = async (dsaId, status) => {
    let bindParams = [status, dsaId];
    let query = ' update ru_direct_selling_agents set dsa_verification_status = ? where dsa_id = ? ';
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
}

const getDsaByAIId = async (id, key = "id") => {
    let bindParams = [id];
    let query = ` SELECT * from ru_direct_selling_agents where ${key} = ? `;
    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
}

const updateDsaVerifyStatusWithAssignTo = async (dsaId, status, userId) => {
    let bindParams = [status, userId, dsaId];
    let query = ' update ru_direct_selling_agents set dsa_verification_status = ?,assigned_to=? where dsa_id = ? ';
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
}

const updateDsaAutoErpStatus = async (dsa_id, is_auto_erp) => {
    let bindParams = [is_auto_erp, dsa_id];
    let query = ' update ru_direct_selling_agents set is_auto_erp = ? where dsa_id = ? ';
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
}

const getDsaIsAutoErpById = async (dsa_id) => {
    const results = await _db2.query(
        'SELECT is_auto_erp FROM ru_direct_selling_agents WHERE dsa_id = ? LIMIT 1',
        { replacements: [dsa_id], type: QueryTypes.SELECT }
    );
    return results[0] !== undefined ? results[0] : null;
};

const getDsaByIdForAutoErpValidation = async (id) => {
    let bindParams = [id];
    let query = `
        SELECT 
            c.assigning_payout_percentage,
            c.company_id,
            k.class_id,
            p.dsa_id AS partner_id,
            CASE 
                WHEN c.user_type = 'company' AND rc.company_id IS NOT NULL THEN rc.is_pan_verified 
                ELSE k.is_permanent_account_number_verified 
            END AS authbridge_pan_verification_status,
            rdkb.account_number,
            rdkb.status AS account_status
        FROM ru_direct_selling_agents c
        LEFT JOIN ru_dsa_kyc_data k ON c.dsa_id = k.dsa_id 
        LEFT JOIN ru_direct_selling_agents p ON c.partner_code = p.dsa_mobile_number
        ${sqlPreferredBankAccountJoinByDsaOrCompanyId("rdkb", "c.dsa_id", "c.company_id")}
        LEFT JOIN ru_companies rc ON c.company_id = rc.company_id
        WHERE c.dsa_id = ?
    `;
    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
};

const getDsaUserCapturedDetails = async (dsaId) => {
    let bindParams = [dsaId];
    let query = ' select c.dsa_mobile_number as mobile_number,c.salutation as salutation,c.first_name as first_name,c.middle_name as middle_name, c.last_name as last_name,c.email_address as email_address, c.company_name as company_name,c.password as password,c.date_of_birth as date_of_birth,c.partner_code as partner_code,c.home_address_house_number as home_address_house_number,c.home_address_pincode as home_address_pincode,c.home_address_city as home_address_city,c.home_address_state as home_address_state,c.office_address_house_number as office_address_house_number,c.office_address_area as office_address_area,c.office_address_pincode as coffice_address_pincode,c.office_address_city as office_address_city,c.office_address_state as office_address_state,k.permanent_account_number as pan_number,k.display_picture_filename as display_picture_filename,k.address_proof_number as address_proof_number ,k.address_proof_front_image_filename as address_proof_front_image_filename,k.address_proof_back_image_filename as address_proof_back_image_filename, k.permanent_account_number as permanent_account_number,k.pan_card_front_image_filename as pan_card_front_image_filename from ru_direct_selling_agents c left join ru_dsa_kyc_data k on c.dsa_id = k.dsa_id where c.dsa_id = ? ';
    let dsa = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return dsa[0]
}
const addDsaVerificationDocument = async (dsaId, url) => {
    let bindParams = [dsaId, url];
    let query = ' insert into ru_dsa_verification_documents (dsa_id,url) values(?,?) ';
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
}

const getDsaVerificationDocument = async (dsaId, url) => {
    let bindParams = [dsaId];
    let query = ' select * from ru_dsa_verification_documents where dsa_id = ? ';
    return await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
};

const getPartnerHierarchyCount = async (prtner_mobile, nearest_child = false) => {
    let query = `WITH RECURSIVE parent_hierarchy AS (
                 -- Anchor member: Start with the given DSA mobile number
                 SELECT 
                     dsa_mobile_number,
                     partner_code,
                     materialized_path_depth,
                     1 AS depth
                 FROM 
                     ru_direct_selling_agents
                 WHERE 
                     dsa_mobile_number = "${prtner_mobile}"
             
                 UNION ALL
             
                 -- Recursive member: Go up the hierarchy (depth-guarded to prevent circular loops)
                 SELECT 
                     parent.dsa_mobile_number,
                     parent.partner_code,
                     parent.materialized_path_depth,
                     child.depth + 1
                 FROM 
                     ru_direct_selling_agents parent
                 INNER JOIN 
                     parent_hierarchy child ON parent.dsa_mobile_number = child.partner_code
                 WHERE
                     child.depth < 20
             ) SELECT * FROM parent_hierarchy LIMIT 100`;

    let dsa = await _db2.query(query, { type: QueryTypes.SELECT });
    let prevCount = dsa[0]?.materialized_path_depth ? dsa[0]?.materialized_path_depth : 0;

    const nearest_dsa = dsa
        .filter((item) => item.materialized_path_depth <= 4)
        .sort((a, b) => b.materialized_path_depth - a.materialized_path_depth);

    let data = prevCount <= 4 ? dsa[0] : nearest_dsa[0];
    data = nearest_child ? data : prevCount;

    return data;
};

const updatePartnerHierarchyCount = async (dsa_id, prevCount) => {
    let count = prevCount + 1;
    let query = ` update ru_direct_selling_agents set heirarchy_level =? where dsa_id =? `;
    let bindParams = [count, dsa_id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return
};

const reassignPartner = async (dsaId, partnerPhone, prevCount, isExternal = false) => {
    dsaId = dsaId.toString();

    let query = ` select c.heirarchy_level, c.dsa_mobile_number, p.full_name as partner, p.dsa_mobile_number as partner_phone, c.business_head_code, s.name as sales_person_name, CONCAT_WS(' ', bh.first_name, bh.middle_name, bh.last_name) AS business_head from ru_direct_selling_agents c left join ru_direct_selling_agents p on p.dsa_mobile_number = c.partner_code left join ru_direct_selling_agents bh on bh.dsa_mobile_number = c.business_head_code left join CRMTest.users s on s.id = uuid_to_bin(c.salesperson_id) where c.dsa_id = ? `;
    let bindParams = [dsaId];
    let prevData = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    prevData = prevData || [];


    if (prevData[0]?.dsa_mobile_number == partnerPhone) {
        let status = "69";
        return { status };
    };

    let data = await updatePartnerAndHierarchy(dsaId, partnerPhone);

    query = ` select CONCAT_WS(' ', d.first_name, d.middle_name, d.last_name) AS partner, d.dsa_mobile_number as partner_phone, CONCAT_WS(' ', bh.first_name, bh.middle_name, bh.last_name) AS business_head from ru_direct_selling_agents d left join ru_direct_selling_agents bh on bh.dsa_mobile_number = d.business_head_code where d.dsa_mobile_number = ? `;
    bindParams = [partnerPhone];
    let newData = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    let isNullSP = Boolean(!prevData[0]?.business_head_code || (prevData[0]?.business_head_code != data?.business_head))

    newData[0] = { ...newData[0], sales_person_name: isNullSP ? null : "" };

    console.log(prevData, newData);

    if (prevData?.length) {
        let { dsa_mobile_number, signup_steps_completed, ...rest } = prevData[0];
        let { sales_person_name, ...rest2 } = rest;
        return { prevData: isNullSP ? rest : rest2, newData: newData[0], business_head: data?.business_head || null };
    };

    let { sales_person_name, ...rest } = newData[0];
    return { prevData: {}, newData: isNullSP ? newData[0] : rest, business_head: data?.business_head || null };
};

const reassignPartnerVerification = async (dsaId, userId) => {
    dsaId = dsaId.toString();
    let bindParams = [userId, dsaId];
    let query = ' update  ru_direct_selling_agents c set assigned_to = ? where dsa_id = ? ';
    return await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
};

const getRuloansCustomersDropDown = async (search, offset, limit) => {
    let bindParams = [];
    let query = ` select c.first_name, c.last_name, CONCAT(c.first_name, c.last_name) as full_name, c.dsa_mobile_number as mobile_number from ru_direct_selling_agents c   `;
    let queryCount = `select count(*) as totalCount, c.first_name, c.last_name, CONCAT(c.first_name, c.last_name) as full_name, c.dsa_mobile_number as mobile_number from ru_direct_selling_agents c    `;
    if (search) {
        query += ` where full_name like '%${search}%' `;
        queryCount += ` where full_name like '%${search}%' `;
    }
    query += ` order by c.full_name asc limit ${offset},${limit} `
    let dsa = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    return { results: dsa, totalCount: totalCount[0].totalCount };
}

const getLntApplicationById = async (application_id) => {
    let bindParams = [application_id];
    let query = `SELECT  lt.*, CAST((Case WHEN ltm.sub_stage = 'Online Welcome Kit' Then ltm.bre_max_eligibility ELSE 0 END) as UNSIGNED) as disbursed_amount, ltm.failure_reason as failure_reason, ltm.app_ref as app_ref, ltm.sub_stage as sub_stage, ltm.stage as stage, ltls.application_status_description as status, d.full_name as customer_name, d.customer_mobile_number as customer_mobile_number, d.address_state as state, d.address_city as city, d.email_address as customer_email_address, c.full_name as dsa_name  from ru_lt_personal_loan_applications lt  left join  ru_direct_selling_agents c on lt.dsa_mobile_number = c.dsa_mobile_number left join ru_customers d on lt.permanent_account_number = d.permanent_account_number left join ru_lt_personal_loan_application_status_list ltls on lt.application_status = ltls.application_status_id  left join ru_lt_personal_loan_applications_meta ltm on lt.application_id = ltm.application_id where lt.application_id = ? `;
    let lnt = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return lnt[0];
}
const getCreditCardApplicationById = async (application_id) => {
    let bindParams = [application_id];
    let query = ' SELECT   cc.*,rccb.bank_name as bank_name,rcsl.cc_application_status_description as application_status,ccm.credit_score as credit_score, ccm.bfl_mcp_check_failed_reason as failure_reason, c.full_name as dsa_name,c.email_address as dsa_email,c.dsa_id as dsa_id,c.dsa_mobile_number as dsa_mobile_number from ru_credit_card_applications cc   left join  ru_direct_selling_agents c  on cc.dsa_mobile_number = c.dsa_mobile_number left join ru_credit_card_applications_meta ccm on cc.cc_application_id = ccm.cc_application_id left join ru_cc_application_status_list rcsl on cc.application_status = rcsl.cc_application_status_id left join ru_credit_card_banks rccb on cc.bank_id = rccb.bank_id  where cc.cc_application_id = ?';
    let lnt = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return lnt[0];
}

const getAllLntApplications = async (where, search, offset, limit, childPhones, loggedInUser, allow_masking, is_export) => {
    let bindParams = [];

    let exportQuery = allow_masking ? ` concat(left(lt.permanent_account_number, 1), '*******', right(lt.permanent_account_number, 2)) as permanent_account_number, concat('*****', right(d.customer_mobile_number, 5)) as customer_mobile_number, concat('*****', right(lt.dsa_mobile_number, 5)) as dsa_mobile_number ` : ` lt.permanent_account_number, d.customer_mobile_number, lt.dsa_mobile_number`;

    let query = ` SELECT  lt.id as id, lt.application_id as application_id, lt.application_date_iso as login_date, lt.application_status as application_status, lt.customer_mobile_number, lt.employment_type as employment_type, lt.salary_per_annum as salary_per_annum, lt.loan_amount as loan_amount, lt.loan_tenure as loan_tenure, lt.total_work_exp as total_work_exp, lt.created_at as created_at, lt.updated_at as updated_at, CAST((Case WHEN ltm.sub_stage = 'Online Welcome Kit' Then ltm.bre_max_eligibility ELSE 0 END) as UNSIGNED) as disbursed_amount, ltm.failure_reason as failure_reason, ltm.app_ref as app_ref, ltm.sub_stage as sub_stage, ltm.stage as stage, ltm.disbursal_date_iso as disbursal_date, (CASE
        WHEN lt.application_status = '1' THEN 'Customer Basic Details Saved'
        WHEN lt.application_status = '2' THEN 'Consent Form Signed'
        WHEN lt.application_status = '3' THEN 'Application In Process'
        WHEN lt.application_status = '4' THEN 'Lead Generated'
        WHEN lt.application_status = '5' THEN 'Application In Process'
        WHEN lt.application_status = '6' THEN 'Application Rejected'
        WHEN lt.application_status = '7' THEN 'Loan Disbursed'
        ELSE "NA"
    END)AS status, c.full_name as dsa_name, d.full_name as customer_name, d.address_state as state, d.address_city as city, d.email_address as customer_email_address, lt.assigned_to, lt.assigned_by, bh.full_name as business_head_name, ${exportQuery} from ru_lt_personal_loan_applications lt  left join  ru_direct_selling_agents c on lt.dsa_mobile_number = c.dsa_mobile_number left join  ru_direct_selling_agents bh on bh.dsa_mobile_number = c.business_head_code left join ru_customers d on lt.permanent_account_number = d.permanent_account_number  left join ru_lt_personal_loan_applications_meta ltm on lt.application_id = ltm.application_id`;
    // [getAllLntApplications isEmpty] — count uses count(lt.id); no count(*) override for ltm.stage/sub_stage isEmpty.
    let queryCount = ' SELECT  count(lt.id) as totalCount  from ru_lt_personal_loan_applications lt ';

    if (checkForMainTable(where, ["lt", "ltm", "c", "d", "bh"]) || search?.length) {
        queryCount += ` left join  ru_direct_selling_agents c on lt.dsa_mobile_number = c.dsa_mobile_number left join  ru_direct_selling_agents bh on bh.dsa_mobile_number = c.business_head_code left join ru_customers d on lt.permanent_account_number = d.permanent_account_number left join ru_lt_personal_loan_applications_meta ltm on lt.application_id = ltm.application_id`
    };

    let and = false;

    if (loggedInUser) {
        query += ` where(lt.assigned_to = '${loggedInUser}' `;
        queryCount += ` where(lt.assigned_to = '${loggedInUser}' `;
        and = true;
    }

    if (childPhones) {
        query += ` ${and === false ? "where" : "or"} lt.dsa_mobile_number in (
            WITH RECURSIVE DSAHierarchy AS(
                SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
                UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
            ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
        ))`;
        queryCount += ` ${and === false ? "where" : "or"} lt.dsa_mobile_number in (
    WITH RECURSIVE DSAHierarchy AS(
        SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
        UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
    ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) )`;
        and = true;
        bindParams.push(childPhones);
    };

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
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += ` order by lt.created_at desc `;

    if (is_export) {
        return { query, queryCount, bindParams };
    };

    query += ` limit ${offset},${limit} `;
    const totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    const lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    let assignArr = [];
    let assignUsers = [];
    for (i = 0; i < lntApplications?.length; i++) {
        if (lntApplications[i]?.assigned_to) {
            assignArr.push(lntApplications[i]?.assigned_to);
        }
        if (lntApplications[i]?.assigned_by) {
            assignArr.push(lntApplications[i]?.assigned_by);
        }
    }

    if (assignArr?.length) {
        query = ` select bin_to_uuid(id) as id, name from users where bin_to_uuid(id) in (?)`;
        bindParams = [assignArr];
        assignUsers = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    };

    for (i = 0; i < lntApplications?.length; i++) {
        const { assigned_to, assigned_by } = lntApplications[i];
        if (assignArr?.length) {
            lntApplications[i].assigned_to_name = assignUsers.filter((obj) => assigned_to == obj?.id)[0]?.name || null;
            lntApplications[i].assigned_by_name = assignUsers.filter((obj) => assigned_by == obj?.id)[0]?.name || null;
            delete lntApplications[i]?.assigned_to;
            delete lntApplications[i]?.assigned_by;
        };
    };

    return { lntApplications: lntApplications, totalCount: totalCount[0].totalCount };
}

const getAllIndifiApplications = async (count_only, where, search, offset, limit, childPhones, loggedInUser) => {
    let bindParams = [];
    let query = ` SELECT  rifl.id, rifl.application_id, riflm.request_id, rifl.application_date, rifl.application_status, rifl.dsa_mobile_number, rifl.customer_mobile_number, rifl.permanent_account_number, rifl.loan_amount, rifl.loan_tenure, rifl.facility_type, rifl.business_id, rifl.business_name, rifl.business_type, rifl.incorporation_date, rifl.average_monthly_revenue, rifl.business_nature, rifl.segment_category_id, rifl.segment_category_name, rifl.consent_otp_verified_at_date, rifl.application_submitted_at_date, rifl.status_last_checked_on_date, rifl.created_at, rifl.updated_at, riflm.indifi_application_id as indifi_application_id, riflm.requested_loan_amount as requested_loan_amount, riflm.offered_loan_amount as offered_loan_amount, riflm.disbursal_date_iso as disbursed_date, riflst.application_status_description as status, c.full_name as dsa_name, d.full_name as customer_name, d.address_state as state, d.address_city as city, d.email_address as customer_email_address, riflm.state as stage, riflm.status AS sub_stage, riflm.indifi_application_id from ru_indifi_loan_applications rifl  left join  ru_direct_selling_agents c on rifl.dsa_mobile_number = c.dsa_mobile_number left join ru_customers d on rifl.permanent_account_number = d.permanent_account_number left join ru_indifi_loan_application_status_list riflst on rifl.application_status = riflst.application_status_id left join ru_indifi_loan_applications_meta riflm on rifl.application_id = riflm.application_id`;
    let queryCount = ' SELECT  count(*) as totalCount  from ru_indifi_loan_applications rifl ';
    let and = false;


    if (where?.length || search?.length) {
        queryCount += ` left join  ru_direct_selling_agents c on rifl.dsa_mobile_number = c.dsa_mobile_number left join ru_customers d on rifl.permanent_account_number = d.permanent_account_number left join ru_indifi_loan_application_status_list riflst on rifl.application_status = riflst.application_status_id left join ru_indifi_loan_applications_meta riflm on rifl.application_id = riflm.application_id`;
    };

    if (loggedInUser) {
        query += ` where(rifl.assigned_to = '${loggedInUser}' `;
        queryCount += ` where(rifl.assigned_to = '${loggedInUser}' `;
        and = true;
    }

    if (childPhones) {
        query += ` ${and === false ? "where" : "or"} rifl.dsa_mobile_number in (
        WITH RECURSIVE DSAHierarchy AS(
            SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
            UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
        ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
    ))`;
        queryCount += ` ${and === false ? "where" : "or"} rifl.dsa_mobile_number in (
    WITH RECURSIVE DSAHierarchy AS(
        SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
        UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
    ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) )`;
        bindParams.push(childPhones);
        and = true;
    };

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
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += ` order by rifl.created_at desc limit ${offset},${limit} `;
    let totalCount = [{ totalCount: limit }]
    let lntApplications = [];

    if (count_only) {
        totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    } else {
        lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    };

    return { lntApplications: lntApplications, totalCount: totalCount[0].totalCount };
}


const getAllFibeApplications = async (where, search, offset, limit, childPhones, allow_masking) => {
    let bindParams = [];
    let exportQuery = allow_masking ? ` concat(left(rfpla.pan, 1), '*******', right(rfpla.pan, 2)) as pan, concat('*****', right(rfpla.mobilenumber, 5)) as mobilenumber, concat('*****', right(rfpla.dsa_mobile_number, 5)) as dsa_mobile_number ` : ` rfpla.pan, rfpla.mobilenumber, rfpla.dsa_mobile_number`;
    let query = ` SELECT rfpla.disburse_amount, rfpla.stage, rfpla.sub_stage, rfpla.application_id, concat(rfpla.firstname, " ", rfpla.lastname) as full_name, rfpla.esRefId, rfpla.agentId, rfpla.salary, rfpla.agentName, rfpla.agentMobileNo, rfpla.sanctionLimit, rfpla.profession, rfpla.status, rfpla.reason, rfpla.inPrincipleLimit, rfpla.inPrincipleTenure, rfpla.disbursed_date, rfpla.created_at, rfpla.updated_at, bh.full_name as business_head_name, c.full_name as dsa_name, ${exportQuery} from ru_fibe_personal_loan_applications rfpla left join ru_direct_selling_agents c on rfpla.dsa_mobile_number = c.dsa_mobile_number left join ru_direct_selling_agents bh on c.business_head_code = bh.dsa_mobile_number`;
    let queryCount = ' SELECT  count(*) as totalCount from ru_fibe_personal_loan_applications rfpla ';
    let and = false;

    if (checkForMainTable(where, ["rfpla", "bh", "c"]) || search?.length) {
        queryCount += ` left join ru_direct_selling_agents c on rfpla.dsa_mobile_number = c.dsa_mobile_number left join ru_direct_selling_agents bh on c.business_head_code = bh.dsa_mobile_number`;
    };

    // if (loggedInUser) {
    //     query += ` where rifl.assigned_to = '${loggedInUser}' `;
    //     queryCount += ` where rifl.assigned_to = '${loggedInUser}' `;
    //     and = true;
    // }

    if (childPhones) {
        query += ` ${and === false ? "where" : "and"} rfpla.dsa_mobile_number in (
    WITH RECURSIVE DSAHierarchy AS(
        SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
        UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
    ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              )`;
        queryCount += ` ${and === false ? "where" : "and"} rfpla.dsa_mobile_number in (
    WITH RECURSIVE DSAHierarchy AS(
        SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
        UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
    ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              )`;
        bindParams.push(childPhones);
        and = true;
    };

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
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += ` order by rfpla.created_at desc limit ${offset},${limit} `;
    const totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    const lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return { lntApplications: lntApplications, totalCount: totalCount[0].totalCount };
}

const getAllPayUApplications = async (where, search, offset, limit, childPhones, allow_masking) => {
    let bindParams = [];
    let exportQuery = allow_masking ? ` concat(left(rpula.pan, 1), '*******', right(rpula.pan, 2)) as pan, concat('*****', right(rpula.phone, 5)) as phone, concat('*****', right(rpula.dsa_mobile_number, 5)) as dsa_mobile_number ` : ` rpula.pan, rpula.phone, rpula.dsa_mobile_number`;
    let query = ` SELECT  CASE WHEN rpula.status = 'disbursed' THEN  rpula.approved_limit ELSE 0 END AS disburse_amount, rpula.app_reference_id, rpula.monthly_income, rpula.application_id, rpula.email, rpula.approved_limit, rpula.employment_type, rpula.status, rpula.rejected_reason, concat(rpula.first_name, " ", rpula.last_name) as full_name, rpula.disbursed_date, rpula.created_at, rpula.updated_at, bh.full_name as business_head_name, c.full_name as dsa_name, ${exportQuery} from ru_pay_u_personal_loan_applications rpula left join  ru_direct_selling_agents c on rpula.dsa_mobile_number = c.dsa_mobile_number left join ru_direct_selling_agents bh on c.business_head_code = bh.dsa_mobile_number left join ru_global_status_meta rgs on binary rpula.status = binary rgs.status  `;
    let queryCount = ' SELECT  count(*) as totalCount from ru_pay_u_personal_loan_applications rpula ';
    let and = false;

    if (checkForMainTable(where, ["rpula", "c", "bh", "rgs"]) || search?.length) {
        queryCount += ` left join  ru_direct_selling_agents c on rpula.dsa_mobile_number = c.dsa_mobile_number left join ru_direct_selling_agents bh on c.business_head_code = bh.dsa_mobile_number left join ru_global_status_meta rgs on binary rpula.status = binary rgs.status `;
    };

    // if (loggedInUser) {
    //     query += ` where rifl.assigned_to = '${loggedInUser}' `;
    //     queryCount += ` where rifl.assigned_to = '${loggedInUser}' `;
    //     and = true;
    // }

    if (childPhones) {
        query += ` ${and === false ? "where" : "and"} rpula.dsa_mobile_number in (
    WITH RECURSIVE DSAHierarchy AS(
        SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
        UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
    ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              )`;
        queryCount += ` ${and === false ? "where" : "and"} rpula.dsa_mobile_number in (
    WITH RECURSIVE DSAHierarchy AS(
        SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
        UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
    ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              )`;
        bindParams.push(childPhones);
        and = true;
    };

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
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += ` order by rpula.created_at desc limit ${offset},${limit} `;
    const totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    const lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    query = ` select rgs.status, rgs.sub_status, rgs.description as status_description, rgs.ru_status, rgs.actions_required, rgs.action_description from ru_global_status_meta rgs where rgs.vendor = "payu" `;
    let globalStatus = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    for (i = 0; i < lntApplications?.length; i++) {
        let status = globalStatus.filter((obj) => obj.status == lntApplications[i]?.status);
        lntApplications[i]["sub_status"] = status[0]?.sub_status || null;
        lntApplications[i]["status_description"] = status[0]?.status_description || null;
        lntApplications[i]["ru_status"] = status[0]?.ru_status || null;
        lntApplications[i]["actions_required"] = status[0]?.actions_required || null;
        lntApplications[i]["action_description"] = status[0]?.action_description || null;
    };

    return { lntApplications: lntApplications, totalCount: totalCount[0].totalCount };
}


const getIndifiApplicationDetailsById = async (application_id) => {
    let bindParams = [application_id];
    let query = ` SELECT  rifl.id, rifl.application_id, rifl.application_date, rifl.application_status, rifl.dsa_mobile_number, rifl.customer_mobile_number, rifl.permanent_account_number, rifl.loan_amount, rifl.loan_tenure, rifl.facility_type, rifl.business_id, rifl.business_name, rifl.business_type, rifl.incorporation_date, rifl.average_monthly_revenue, rifl.business_nature, rifl.segment_category_id, rifl.segment_category_name, rifl.consent_otp_verified_at_date, rifl.application_submitted_at_date, rifl.status_last_checked_on_date, rifl.created_at, rifl.updated_at, riflm.indifi_application_id as indifi_application_id, riflm.requested_loan_amount as requested_loan_amount, riflm.offered_loan_amount as offered_loan_amount, riflm.disbursal_date_iso as disbursed_date, riflst.application_status_description as status, c.full_name as dsa_name, d.full_name as customer_name, d.customer_mobile_number as customer_mobile_number, d.address_state as state, d.address_city as city, d.email_address as customer_email_address  from ru_indifi_loan_applications rifl  left join  ru_direct_selling_agents c on rifl.dsa_mobile_number = c.dsa_mobile_number left join ru_customers d on rifl.permanent_account_number = d.permanent_account_number left join ru_indifi_loan_application_status_list riflst on rifl.application_status = riflst.application_status_id left join ru_indifi_loan_applications_meta riflm on rifl.application_id = riflm.application_id where rifl.application_id = ? `;
    const lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return lntApplications[0];
}

const getLntForDashboard = async (childPhones) => {
    let bindParams = [childPhones, childPhones, childPhones, childPhones, childPhones, childPhones, childPhones, childPhones, childPhones, childPhones, childPhones, childPhones, childPhones, childPhones, childPhones, childPhones];
    let query = ` SELECT  count(*) as totalCount, sum(ltm.bre_max_eligibility) as disbursedAmount, (SELECT count(*) from     ru_lt_personal_loan_applications lt1 left join ru_direct_selling_agents  c1  on lt1.dsa_mobile_number = c1.dsa_mobile_number   left join ru_customers d1 on lt1.permanent_account_number = d1.permanent_account_number left join ru_lt_personal_loan_application_status_list ltls1 on lt1.application_status = ltls1.application_status_id left join ru_lt_personal_loan_applications_meta ltm1 on lt1.application_id = ltm1.application_id where ltm1.sub_stage = "REJECTED"  and lt1.dsa_mobile_number in (?)) as rejectedCount, (SELECT count(*) from     ru_lt_personal_loan_applications lt1 left join ru_direct_selling_agents  c1  on lt1.dsa_mobile_number = c1.dsa_mobile_number   left join ru_customers d1 on lt1.permanent_account_number = d1.permanent_account_number left join ru_lt_personal_loan_application_status_list ltls1 on lt1.application_status = ltls1.application_status_id left join ru_lt_personal_loan_applications_meta ltm1 on lt1.application_id = ltm1.application_id where ltm1.sub_stage = "Application Form" and lt1.dsa_mobile_number in (?)) as applicationFormCount, (SELECT count(*) from     ru_lt_personal_loan_applications lt1 left join ru_direct_selling_agents  c1  on lt1.dsa_mobile_number = c1.dsa_mobile_number   left join ru_customers d1 on lt1.permanent_account_number = d1.permanent_account_number left join ru_lt_personal_loan_application_status_list ltls1 on lt1.application_status = ltls1.application_status_id left join ru_lt_personal_loan_applications_meta ltm1 on lt1.application_id = ltm1.application_id where ltm1.sub_stage = "EXPIRED" and lt1.dsa_mobile_number in (?)) as expiredCount, (SELECT count(*) from     ru_lt_personal_loan_applications lt1 left join ru_direct_selling_agents  c1  on lt1.dsa_mobile_number = c1.dsa_mobile_number   left join ru_customers d1 on lt1.permanent_account_number = d1.permanent_account_number left join ru_lt_personal_loan_application_status_list ltls1 on lt1.application_status = ltls1.application_status_id left join ru_lt_personal_loan_applications_meta ltm1 on lt1.application_id = ltm1.application_id where ltm1.sub_stage = "Online Welcome Kit" and lt1.dsa_mobile_number in (?)) as onlineWelcomeKitCount, (SELECT count(*) from     ru_lt_personal_loan_applications lt1 left join ru_direct_selling_agents  c1  on lt1.dsa_mobile_number = c1.dsa_mobile_number   left join ru_customers d1 on lt1.permanent_account_number = d1.permanent_account_number left join ru_lt_personal_loan_application_status_list ltls1 on lt1.application_status = ltls1.application_status_id left join ru_lt_personal_loan_applications_meta ltm1 on lt1.application_id = ltm1.application_id where ltm1.sub_stage = "Offer details" and lt1.dsa_mobile_number in (?)) as offerDetailsCount, (SELECT count(*) from     ru_lt_personal_loan_applications lt1 left join ru_direct_selling_agents  c1  on lt1.dsa_mobile_number = c1.dsa_mobile_number   left join ru_customers d1 on lt1.permanent_account_number = d1.permanent_account_number left join ru_lt_personal_loan_application_status_list ltls1 on lt1.application_status = ltls1.application_status_id left join ru_lt_personal_loan_applications_meta ltm1 on lt1.application_id = ltm1.application_id where ltm1.sub_stage = "Insurance details" and lt1.dsa_mobile_number in (?)) as InsuranceDetailsCount, (SELECT count(*) from     ru_lt_personal_loan_applications lt1 left join ru_direct_selling_agents  c1  on lt1.dsa_mobile_number = c1.dsa_mobile_number   left join ru_customers d1 on lt1.permanent_account_number = d1.permanent_account_number left join ru_lt_personal_loan_application_status_list ltls1 on lt1.application_status = ltls1.application_status_id left join ru_lt_personal_loan_applications_meta ltm1 on lt1.application_id = ltm1.application_id where ltm1.sub_stage = "Address details" and lt1.dsa_mobile_number in (?)) as addressDetailsCount, (SELECT count(*) from     ru_lt_personal_loan_applications lt1 left join ru_direct_selling_agents  c1  on lt1.dsa_mobile_number = c1.dsa_mobile_number   left join ru_customers d1 on lt1.permanent_account_number = d1.permanent_account_number left join ru_lt_personal_loan_application_status_list ltls1 on lt1.application_status = ltls1.application_status_id left join ru_lt_personal_loan_applications_meta ltm1 on lt1.application_id = ltm1.application_id where ltm1.sub_stage = "Mandate Setup" and lt1.dsa_mobile_number in (?)) as madateSetupCount, (SELECT count(*) from     ru_lt_personal_loan_applications lt1 left join ru_direct_selling_agents  c1  on lt1.dsa_mobile_number = c1.dsa_mobile_number   left join ru_customers d1 on lt1.permanent_account_number = d1.permanent_account_number left join ru_lt_personal_loan_application_status_list ltls1 on lt1.application_status = ltls1.application_status_id left join ru_lt_personal_loan_applications_meta ltm1 on lt1.application_id = ltm1.application_id where ltm1.sub_stage = "eKYC" and lt1.dsa_mobile_number in (?)) as ekycCount, (SELECT count(*) from     ru_lt_personal_loan_applications lt1 left join ru_direct_selling_agents  c1  on lt1.dsa_mobile_number = c1.dsa_mobile_number   left join ru_customers d1 on lt1.permanent_account_number = d1.permanent_account_number left join ru_lt_personal_loan_application_status_list ltls1 on lt1.application_status = ltls1.application_status_id left join ru_lt_personal_loan_applications_meta ltm1 on lt1.application_id = ltm1.application_id where ltm1.sub_stage = "Document Verification" and lt1.dsa_mobile_number in (?)) as documentVerificationCount, (SELECT count(*) from     ru_lt_personal_loan_applications lt1 left join ru_direct_selling_agents  c1  on lt1.dsa_mobile_number = c1.dsa_mobile_number   left join ru_customers d1 on lt1.permanent_account_number = d1.permanent_account_number left join ru_lt_personal_loan_application_status_list ltls1 on lt1.application_status = ltls1.application_status_id left join ru_lt_personal_loan_applications_meta ltm1 on lt1.application_id = ltm1.application_id where ltm1.sub_stage = "Other details" and lt1.dsa_mobile_number in (?)) as otherDetailsCount, (SELECT count(*) from     ru_lt_personal_loan_applications lt1 left join ru_direct_selling_agents  c1  on lt1.dsa_mobile_number = c1.dsa_mobile_number   left join ru_customers d1 on lt1.permanent_account_number = d1.permanent_account_number left join ru_lt_personal_loan_application_status_list ltls1 on lt1.application_status = ltls1.application_status_id left join ru_lt_personal_loan_applications_meta ltm1 on lt1.application_id = ltm1.application_id where ltm1.sub_stage = "Bank details" and lt1.dsa_mobile_number in (?)) as bankDetailsCount, (SELECT count(*) from     ru_lt_personal_loan_applications lt1 left join ru_direct_selling_agents  c1  on lt1.dsa_mobile_number = c1.dsa_mobile_number   left join ru_customers d1 on lt1.permanent_account_number = d1.permanent_account_number left join ru_lt_personal_loan_application_status_list ltls1 on lt1.application_status = ltls1.application_status_id left join ru_lt_personal_loan_applications_meta ltm1 on lt1.application_id = ltm1.application_id where ltm1.sub_stage = "Loan Sanction With Eligibility" and lt1.dsa_mobile_number in (?)) as loanSanctionWithEligibilityCount, (SELECT count(*) from     ru_lt_personal_loan_applications lt1 left join ru_direct_selling_agents  c1  on lt1.dsa_mobile_number = c1.dsa_mobile_number   left join ru_customers d1 on lt1.permanent_account_number = d1.permanent_account_number left join ru_lt_personal_loan_application_status_list ltls1 on lt1.application_status = ltls1.application_status_id left join ru_lt_personal_loan_applications_meta ltm1 on lt1.application_id = ltm1.application_id where ltm1.sub_stage = "Awaiting For Sanction" and lt1.dsa_mobile_number in (?)) as awaitingForSactionCount, (SELECT count(*) from     ru_lt_personal_loan_applications lt1 left join ru_direct_selling_agents  c1  on lt1.dsa_mobile_number = c1.dsa_mobile_number   left join ru_customers d1 on lt1.permanent_account_number = d1.permanent_account_number left join ru_lt_personal_loan_application_status_list ltls1 on lt1.application_status = ltls1.application_status_id left join ru_lt_personal_loan_applications_meta ltm1 on lt1.application_id = ltm1.application_id where ltm1.sub_stage = "" or ltm1.sub_stage is null and lt1.dsa_mobile_number in (?)) as yetToBeDecidedCount  from    ru_direct_selling_agents  c left join ru_lt_personal_loan_applications lt on c.dsa_mobile_number = lt.dsa_mobile_number left join ru_customers d on lt.permanent_account_number = d.permanent_account_number left join ru_lt_personal_loan_application_status_list ltls on lt.application_status = ltls.application_status_id left join ru_lt_personal_loan_applications_meta ltm on lt.application_id = ltm.application_id where lt.dsa_mobile_number in (?)`;
    let lnt = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return lnt[0];
}

const getCreditCardForDashboard = async (childPhones) => {
    let bindParams = [childPhones];
    let query = `  SELECT count(*) as totalCount, rcasl.cc_application_status_description as description  from  ru_credit_card_applications cc left join ru_direct_selling_agents  c  on cc.dsa_mobile_number = c.dsa_mobile_number  left join ru_cc_application_status_list rcasl on cc.application_status = rcasl.cc_application_status_id left join ru_customers d on cc.permanent_account_number = d.permanent_account_number  where c.dsa_mobile_number in (?) group by rcasl.cc_application_status_description  `;
    let lnt = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    query = '  SELECT  count(*) as totalCount from  ru_credit_card_applications cc left join ru_direct_selling_agents  c  on cc.dsa_mobile_number = c.dsa_mobile_number left join ru_customers d on cc.permanent_account_number = d.permanent_account_number  where c.dsa_mobile_number in (?) ';
    let status_wise = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let lntCount = lnt;
    let lntCountResult = { totalCount: 0, approvedCount: 0, rejectedCount: 0, pendingCount: 0, consentCount: 0, basicDetailCount: 0 };
    for (let i = 0; i < lntCount.length; i++) {
        if (lntCount[i]['description'] == 'Approved') {
            lntCountResult.approvedCount = lntCount[i].totalCount;
        }
        if (lntCount[i]['description'] == 'Rejected') {
            lntCountResult.rejectedCount = lntCount[i].totalCount;
        }
        if (lntCount[i]['description'] == 'Pending') {
            lntCountResult.pendingCount = lntCount[i].totalCount;
        }
        if (lntCount[i]['description'] == 'Consent Form Signed') {
            lntCountResult.consentCount = lntCount[i].totalCount;
        }
        if (lntCount[i]['description'] == 'Customer Basic Details Saved') {
            lntCountResult.basicDetailCount = lntCount[i].totalCount;
        }
    }
    lntCountResult.totalCount = lntCountResult.approvedCount + lntCountResult.rejectedCount + lntCountResult.pendingCount + lntCountResult.basicDetailCount + lntCountResult.consentCount;
    return lntCountResult;
}

const getLoanForDashboard = async (childPhones, where) => {
    let bindParams = [childPhones];
    console.log(childPhones.length, "888GG")
    let query = `SELECT  count(*) as totalCount  from ru_loan_applications l  left join ru_direct_selling_agents  c on l.dsa_mobile_number = c.dsa_mobile_number left join ru_customers d on l.permanent_account_number = d.permanent_account_number  left join ru_loan_types lt on l.loan_type = lt.id where c.dsa_mobile_number in (?) ${where ? `and DATE(l.created_at)${where}` : ""} `;
    let lnt = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return lnt[0].totalCount;
};

const getLoanForDashboardV2 = async (childPhones, where) => {
    let bindParams = [childPhones];
    let query = ` SELECT
l.permanent_account_number,
    l.dsa_mobile_number,
    CONCAT(REPEAT('-', 0),
        c.full_name,
        ' (',
        c.dsa_mobile_number,
        ')') AS dsa,
            c.dsa_id,
            c.partner_code,
            count(*) as total_count  
    from ru_loan_applications l  left join ru_direct_selling_agents  c on l.dsa_mobile_number = c.dsa_mobile_number left join ru_customers d on l.permanent_account_number = d.permanent_account_number  left join ru_loan_types lt on l.loan_type = lt.id where `;
    query += ` c.dsa_mobile_number in (
    WITH RECURSIVE DSAHierarchy AS(
        SELECT dsa_mobile_number, partner_code
            FROM ru_direct_selling_agents
            WHERE dsa_mobile_number = ?
        UNION ALL
            SELECT t.dsa_mobile_number, t.partner_code
            FROM ru_direct_selling_agents t
            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
    ) 
        SELECT dsa_mobile_number
        FROM DSAHierarchy )`
    query += ` ${where ? `and DATE(l.created_at)${where}` : ""} group by l.dsa_mobile_number `;
    let lnt = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return lnt;
};

const getDsaTreeCount = async (phone, dateFilter) => {
    let bindParams = [];

    let query = `SELECT
CONCAT(REPEAT('-', 0),
    t1.full_name,
    ' (',
    t1.dsa_mobile_number,
    ')') AS dsa,
        COUNT(DISTINCT t5.dsa_mobile_number) + COUNT(DISTINCT t4.dsa_mobile_number) + COUNT(DISTINCT t3.dsa_mobile_number) + COUNT(DISTINCT t2.dsa_mobile_number) AS total_count,
            COUNT(DISTINCT CASE
                    WHEN ROUND(t2.signup_steps_completed / 5 * 100, 2) = ROUND(1 / 5 * 100, 2) THEN t2.dsa_mobile_number
                    ELSE NULL
                END) + COUNT(DISTINCT CASE
                    WHEN ROUND(t3.signup_steps_completed / 5 * 100, 2) = ROUND(1 / 5 * 100, 2) THEN t3.dsa_mobile_number
                    ELSE NULL
                END) + COUNT(DISTINCT CASE
                    WHEN ROUND(t4.signup_steps_completed / 5 * 100, 2) = ROUND(1 / 5 * 100, 2) THEN t4.dsa_mobile_number
                    ELSE NULL
                END) + COUNT(DISTINCT CASE
                    WHEN ROUND(t5.signup_steps_completed / 5 * 100, 2) = ROUND(1 / 5 * 100, 2) THEN t5.dsa_mobile_number
                    ELSE NULL
                END) AS 16_percent,
    COUNT(DISTINCT CASE
                    WHEN ROUND(t2.signup_steps_completed / 5 * 100, 2) = ROUND(2 / 5 * 100, 2) THEN t2.dsa_mobile_number
                    ELSE NULL
                END) + COUNT(DISTINCT CASE
                    WHEN ROUND(t3.signup_steps_completed / 5 * 100, 2) = ROUND(2 / 5 * 100, 2) THEN t3.dsa_mobile_number
                    ELSE NULL
                END) + COUNT(DISTINCT CASE
                    WHEN ROUND(t4.signup_steps_completed / 5 * 100, 2) = ROUND(2 / 5 * 100, 2) THEN t4.dsa_mobile_number
                    ELSE NULL
                END) + COUNT(DISTINCT CASE
                    WHEN ROUND(t5.signup_steps_completed / 5 * 100, 2) = ROUND(2 / 5 * 100, 2) THEN t5.dsa_mobile_number
                    ELSE NULL
                END) AS 33_percent,
    COUNT(DISTINCT CASE
                    WHEN ROUND(t2.signup_steps_completed / 5 * 100, 2) = ROUND(3 / 5 * 100, 2) THEN t2.dsa_mobile_number
                    ELSE NULL
                END) + COUNT(DISTINCT CASE
                    WHEN ROUND(t3.signup_steps_completed / 5 * 100, 2) = ROUND(3 / 5 * 100, 2) THEN t3.dsa_mobile_number
                    ELSE NULL
                END) + COUNT(DISTINCT CASE
                    WHEN ROUND(t4.signup_steps_completed / 5 * 100, 2) = ROUND(3 / 5 * 100, 2) THEN t4.dsa_mobile_number
                    ELSE NULL
                END) + COUNT(DISTINCT CASE
                    WHEN ROUND(t5.signup_steps_completed / 5 * 100, 2) = ROUND(3 / 5 * 100, 2) THEN t5.dsa_mobile_number
                    ELSE NULL
                END) AS 50_percent,
    COUNT(DISTINCT CASE
                    WHEN ROUND(t2.signup_steps_completed / 5 * 100, 2) = ROUND(3.5 / 5 * 100, 2) THEN t2.dsa_mobile_number
                    ELSE NULL
                END) + COUNT(DISTINCT CASE
                    WHEN ROUND(t3.signup_steps_completed / 5 * 100, 2) = ROUND(3.5 / 5 * 100, 2) THEN t3.dsa_mobile_number
                    ELSE NULL
                END) + COUNT(DISTINCT CASE
                    WHEN ROUND(t4.signup_steps_completed / 5 * 100, 2) = ROUND(3.5 / 5 * 100, 2) THEN t4.dsa_mobile_number
                    ELSE NULL
                END) + COUNT(DISTINCT CASE
                    WHEN ROUND(t5.signup_steps_completed / 5 * 100, 2) = ROUND(3.5 / 5 * 100, 2) THEN t5.dsa_mobile_number
                    ELSE NULL
                END) AS 66_percent,
    COUNT(DISTINCT CASE
                    WHEN ROUND(t2.signup_steps_completed / 5 * 100, 2) = ROUND(4 / 5 * 100, 2) THEN t2.dsa_mobile_number
                    ELSE NULL
                END) + COUNT(DISTINCT CASE
                    WHEN ROUND(t3.signup_steps_completed / 5 * 100, 2) = ROUND(4 / 5 * 100, 2) THEN t3.dsa_mobile_number
                    ELSE NULL
                END) + COUNT(DISTINCT CASE
                    WHEN ROUND(t4.signup_steps_completed / 5 * 100, 2) = ROUND(4 / 5 * 100, 2) THEN t4.dsa_mobile_number
                    ELSE NULL
                END) + COUNT(DISTINCT CASE
                    WHEN ROUND(t5.signup_steps_completed / 5 * 100, 2) = ROUND(4 / 5 * 100, 2) THEN t5.dsa_mobile_number
                    ELSE NULL
                END) AS 83_percent,
    COUNT(DISTINCT CASE
                    WHEN (ROUND(t2.signup_steps_completed / 5 * 100, 2) = ROUND(5 / 5 * 100, 2) or ROUND(t2.signup_steps_completed / 5 * 100, 2) = ROUND(6 / 5 * 100, 2)) THEN t2.dsa_mobile_number
                    ELSE NULL
                END) + COUNT(DISTINCT CASE
                    WHEN (ROUND(t3.signup_steps_completed / 5 * 100, 2) = ROUND(5 / 5 * 100, 2) or ROUND(t3.signup_steps_completed / 5 * 100, 2) = ROUND(6 / 5 * 100, 2)) THEN t3.dsa_mobile_number
                    ELSE NULL
                END) + COUNT(DISTINCT CASE
                   WHEN (ROUND(t4.signup_steps_completed / 5 * 100, 2) = ROUND(5 / 5 * 100, 2) or ROUND(t4.signup_steps_completed / 5 * 100, 2) = ROUND(6 / 5 * 100, 2)) THEN t4.dsa_mobile_number
                    ELSE NULL
                END) + COUNT(DISTINCT CASE
                    WHEN (ROUND(t5.signup_steps_completed / 5 * 100, 2) = ROUND(5 / 5 * 100, 2) or ROUND(t5.signup_steps_completed / 5 * 100, 2) = ROUND(6 / 5 * 100, 2)) THEN t5.dsa_mobile_number
                    ELSE NULL
                END) AS 100_percent
FROM
            ru_direct_selling_agents t1
                LEFT JOIN
            ru_direct_selling_agents t2 ON t1.dsa_mobile_number = t2.partner_code
                LEFT JOIN
            ru_direct_selling_agents t3 ON t2.dsa_mobile_number = t3.partner_code
                LEFT JOIN
            ru_direct_selling_agents t4 ON t3.dsa_mobile_number = t4.partner_code
                LEFT JOIN
            ru_direct_selling_agents t5 ON t4.dsa_mobile_number = t5.partner_code
WHERE
t1.partner_code = ${phone} or  t1.dsa_mobile_number = ${phone}
            ${dateFilter || ""}
        GROUP BY t1.dsa_mobile_number
        having total_count
        ORDER BY total_count desc; `;
    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getSingleDsaTreeCount = async (phone, where) => {
    let bindParams = [];

    let query = `SELECT
CONCAT(REPEAT('-', 0),
    t1.full_name,
    ' (',
    t1.dsa_mobile_number,
    ') (Directly Reporting)') AS dsa,
        COUNT(DISTINCT t2.dsa_mobile_number) AS total_count,
            COUNT(DISTINCT CASE
                    WHEN ROUND(t2.signup_steps_completed / 5 * 100, 2) = ROUND(1 / 5 * 100, 2) THEN t2.dsa_mobile_number
                    ELSE NULL
                END)  AS 16_percent,
    COUNT(DISTINCT CASE
                    WHEN ROUND(t2.signup_steps_completed / 5 * 100, 2) = ROUND(2 / 5 * 100, 2) THEN t2.dsa_mobile_number
                    ELSE NULL
                END)  AS 33_percent,
    COUNT(DISTINCT CASE
                    WHEN ROUND(t2.signup_steps_completed / 5 * 100, 2) = ROUND(3 / 5 * 100, 2) THEN t2.dsa_mobile_number
                    ELSE NULL
                END)  AS 50_percent,
    COUNT(DISTINCT CASE
                    WHEN ROUND(t2.signup_steps_completed / 5 * 100, 2) = ROUND(3.5 / 5 * 100, 2) THEN t2.dsa_mobile_number
                    ELSE NULL
                END)  AS 66_percent,
    COUNT(DISTINCT CASE
                    WHEN ROUND(t2.signup_steps_completed / 5 * 100, 2) = ROUND(4 / 5 * 100, 2) THEN t2.dsa_mobile_number
                    ELSE NULL
                END) AS 83_percent,
    COUNT(DISTINCT CASE
                    WHEN ROUND(t2.signup_steps_completed / 5 * 100, 2) = ROUND(5 / 5 * 100, 2) OR ROUND(t2.signup_steps_completed / 5 * 100, 2) = ROUND(6 / 5 * 100, 2) THEN t2.dsa_mobile_number
                    ELSE NULL
                END) AS 100_percent
FROM
            ru_direct_selling_agents t1
                LEFT JOIN
            ru_direct_selling_agents t2 ON   t1.dsa_mobile_number = t2.partner_code
WHERE
t1.dsa_mobile_number = ${phone}
            ${where ? `AND ${where}` : ""}
        GROUP BY t1.dsa_mobile_number
        ORDER BY total_count DESC;`;

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount[0];
};

const getLntDashboard = async (phone) => {
    let bindParams = [];

    let query = `SELECT
CONCAT(REPEAT('-', 0),
    t1.dsa_name,
    ' (',
    t1.dsa_mobile_number,
    ')') AS dsa,
        SUM(CASE WHEN t5.sub_stage = 'REJECTED' THEN 1 ELSE 0 END) + SUM(CASE WHEN t4.sub_stage = 'REJECTED' THEN 1 ELSE 0 END) + SUM(CASE WHEN t3.sub_stage = 'REJECTED' THEN 1 ELSE 0 END) + SUM(CASE WHEN t2.sub_stage = 'REJECTED' THEN 1 ELSE 0 END) + SUM(CASE WHEN t1.sub_stage = 'REJECTED' THEN 1 ELSE 0 END)  AS total_rejected,
            SUM(CASE WHEN t5.sub_stage = 'Online Welcome Kit' THEN 1 ELSE 0 END) + SUM(CASE WHEN t4.sub_stage = 'Online Welcome Kit' THEN 1 ELSE 0 END) + SUM(CASE WHEN t3.sub_stage = 'Online Welcome Kit' THEN 1 ELSE 0 END) + SUM(CASE WHEN t2.sub_stage = 'Online Welcome Kit' THEN 1 ELSE 0 END) + SUM(CASE WHEN t1.sub_stage = 'Online Welcome Kit' THEN 1 ELSE 0 END)  AS total_disbursed,
                SUM(CASE WHEN t5.sub_stage in ("eKYC", "Mandate Setup", "Document Verification", "Insurance details", "Address details", "Bank details", "Loan Sanction With Eligibility", "Other details", "E-DOC") THEN 1 ELSE 0 END) + SUM(CASE WHEN t4.sub_stage in ("eKYC", "Mandate Setup", "Document Verification", "Insurance details", "Address details", "Bank details", "Loan Sanction With Eligibility", "Other details", "E-DOC") THEN 1 ELSE 0 END) + SUM(CASE WHEN t3.sub_stage in ("eKYC", "Mandate Setup", "Document Verification", "Insurance details", "Address details", "Bank details", "Loan Sanction With Eligibility", "Other details", "E-DOC") THEN 1 ELSE 0 END) + SUM(CASE WHEN t2.sub_stage in ("eKYC", "Mandate Setup", "Document Verification", "Insurance details", "Address details", "Bank details", "Loan Sanction With Eligibility", "Other details", "E-DOC") THEN 1 ELSE 0 END) + SUM(CASE WHEN t1.sub_stage in ("eKYC", "Mandate Setup", "Document Verification", "Insurance details", "Address details", "Bank details", "Loan Sanction With Eligibility", "Other details", "E-DOC") THEN 1 ELSE 0 END)  AS total_approved,
                    SUM(CASE WHEN t5.sub_stage in ('Application Form', "EXPIRED", "Offer details") THEN 1 ELSE 0 END) + SUM(CASE WHEN t4.sub_stage in ('Application Form', "EXPIRED", "Offer details")  THEN 1 ELSE 0 END) + SUM(CASE WHEN t3.sub_stage in ('Application Form', "EXPIRED", "Offer details")  THEN 1 ELSE 0 END) + SUM(CASE WHEN t2.sub_stage in ('Application Form', "EXPIRED", "Offer details")  THEN 1 ELSE 0 END) + SUM(CASE WHEN t1.sub_stage in ('Application Form', "EXPIRED", "Offer details")  THEN 1 ELSE 0 END)  AS total_in_progress,
                        SUM(Case WHEN t1.sub_stage = 'Online Welcome Kit'Then t1.bre_max_eligibility ELSE 0 END) + SUM(Case WHEN t2.sub_stage = 'Online Welcome Kit'Then t2.bre_max_eligibility ELSE 0 END) + SUM(Case WHEN t3.sub_stage = 'Online Welcome Kit'Then t3.bre_max_eligibility ELSE 0 END) + SUM(Case WHEN t4.sub_stage = 'Online Welcome Kit'Then t4.bre_max_eligibility ELSE 0 END) + SUM(Case WHEN t5.sub_stage = 'Online Welcome Kit'Then t5.bre_max_eligibility ELSE 0 END) as total_disbursed_amount

FROM
        dsa_application_view t1
            LEFT JOIN
        dsa_application_view t2 ON t1.dsa_mobile_number = t2.partner_code
            LEFT JOIN
        dsa_application_view t3 ON t2.dsa_mobile_number = t3.partner_code
            LEFT JOIN
        dsa_application_view t4 ON t3.dsa_mobile_number = t4.partner_code
            LEFT JOIN
        dsa_application_view t5 ON t4.dsa_mobile_number = t5.partner_code
WHERE
t1.partner_code = ${phone} 
    GROUP BY t1.dsa_mobile_number
    ORDER BY total_disbursed DESC;
`;
    //     let query = `  WITH RECURSIVE cte AS(
    //     SELECT dsa_mobile_number, partner_code, sub_stage,bre_max_eligibility,dsa_name, 1 AS level
    //     FROM dsa_application_view
    //     UNION ALL
    //     SELECT dsa_application_view.dsa_name,dsa_application_view.dsa_mobile_number,dsa_application_view.bre_max_eligibility, dsa_application_view.partner_code, dsa_application_view.sub_stage, cte.level + 1
    //     FROM dsa_application_view
    //     JOIN cte ON  cte.dsa_mobile_number =dsa_application_view.partner_code 
    //     WHERE cte.level < 3
    //   )
    //   SELECT  CONCAT(REPEAT('-', 0),
    //               dsa_name,
    //               ' (',
    //               dsa_mobile_number,
    //               ')') AS dsa,
    //   SUM(CASE WHEN sub_stage = 'REJECTED' THEN 1 ELSE 0 END) AS total_rejected,
    //   SUM(CASE WHEN sub_stage = 'Online Welcome Kit' THEN 1 ELSE 0 END) AS total_disbursed ,
    //   SUM(CASE WHEN sub_stage in ("eKYC","Mandate Setup","Document Verification","Insurance details","Address details","Bank details","Loan Sanction With Eligibility","Other details","E-DOC")THEN 1 ELSE 0 END) AS total_approved ,
    //   SUM(CASE WHEN sub_stage in ('Application Form',"EXPIRED","Offer details") THEN 1 ELSE 0 END) AS total_in_progress ,
    //   SUM(CASE WHEN sub_stage = 'Online Welcome Kit' THEN bre_max_eligibility ELSE 0 END) AS total_disbursed_amount  

    //   FROM cte WHERE partner_code = ${phone} group by dsa  order by total_disbursed_amount desc ;`
    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
}

const getIncredDashboard = async (phone) => {
    let bindParams = [];

    let query = `SELECT 
        CONCAT(REPEAT('-', 0),
                t1.dsa_name,
                ' (',
                t1.dsa_mobile_number,
                ')') AS dsa,
        SUM(CASE WHEN t5.status = 'Loan Rejected' THEN 1 ELSE 0 END) + SUM(CASE WHEN t4.status = 'Loan Rejected' THEN 1 ELSE 0 END)+SUM(CASE WHEN t3.status = 'Loan Rejected' THEN 1 ELSE 0 END)+SUM(CASE WHEN t2.status = 'Loan Rejected' THEN 1 ELSE 0 END)+SUM(CASE WHEN t1.status = 'Loan Rejected' THEN 1 ELSE 0 END)  AS total_rejected,
    	SUM(CASE WHEN t5.status = 'Loan Disbursed' THEN 1 ELSE 0 END)+SUM(CASE WHEN t4.status = 'Loan Disbursed' THEN 1 ELSE 0 END)+SUM(CASE WHEN t3.status = 'Loan Disbursed' THEN 1 ELSE 0 END)+SUM(CASE WHEN t2.status = 'Loan Disbursed' THEN 1 ELSE 0 END)+SUM(CASE WHEN t1.status = 'Loan Disbursed' THEN 1 ELSE 0 END) AS total_disbursed,
    	SUM(CASE WHEN t5.status = 'Loan Approved'  THEN 1 ELSE 0 END)+SUM(CASE WHEN t4.status = 'Loan Approved'  THEN 1 ELSE 0 END)+SUM(CASE WHEN t3.status = 'Loan Approved'  THEN 1 ELSE 0 END)+SUM(CASE WHEN t2.status = 'Loan Approved'  THEN 1 ELSE 0 END)+SUM(CASE WHEN t1.status = 'Loan Approved'  THEN 1 ELSE 0 END)  AS total_approved,
    	SUM(CASE WHEN t5.status = 'Application Pending'  THEN 1 ELSE 0 END)+SUM(CASE WHEN t4.status = 'Application Pending'  THEN 1 ELSE 0 END)+SUM(CASE WHEN t3.status = 'Application Pending'  THEN 1 ELSE 0 END)+SUM(CASE WHEN t2.status = 'Application Pending'  THEN 1 ELSE 0 END) +SUM(CASE WHEN t1.status = 'Application Pending'  THEN 1 ELSE 0 END)  AS total_in_progress,
    	SUM(CASE WHEN t5.status = 'Loan Disbursed' THEN  t5.loan_amount ELSE 0 END)+SUM(CASE WHEN t4.status = 'Loan Disbursed' THEN  t4.loan_amount ELSE 0 END)+SUM(CASE WHEN t3.status = 'Loan Disbursed' THEN  t3.loan_amount ELSE 0 END)+SUM(CASE WHEN t2.status = 'Loan Disbursed' THEN  t2.loan_amount ELSE 0 END) + SUM(CASE WHEN t1.status = 'Loan Disbursed' THEN  t1.loan_amount ELSE 0 END) as total_disbursed_amount

    FROM
        dsa_application_view_incred t1
            LEFT JOIN
        dsa_application_view_incred t2 ON t1.dsa_mobile_number = t2.partner_code
            LEFT JOIN
        dsa_application_view_incred t3 ON t2.dsa_mobile_number = t3.partner_code
            LEFT JOIN
        dsa_application_view_incred t4 ON t3.dsa_mobile_number = t4.partner_code
            LEFT JOIN
        dsa_application_view_incred t5 ON t4.dsa_mobile_number = t5.partner_code
    WHERE
        t1.partner_code = ${phone} 
    GROUP BY t1.dsa_mobile_number
    ORDER BY total_disbursed DESC;
            `;
    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
}

const getFairCentDashboard = async (phone) => {
    let bindParams = [];

    let query = `SELECT 
        CONCAT(REPEAT('-', 0),
                t1.dsa_name,
                ' (',
                t1.dsa_mobile_number,
                ')') AS dsa,
        SUM(CASE WHEN t5.status = 'Loan Rejected' THEN 1 ELSE 0 END) + SUM(CASE WHEN t4.status = 'Loan Rejected' THEN 1 ELSE 0 END)+SUM(CASE WHEN t3.status = 'Loan Rejected' THEN 1 ELSE 0 END)+SUM(CASE WHEN t2.status = 'Loan Rejected' THEN 1 ELSE 0 END)+SUM(CASE WHEN t1.status = 'Loan Rejected' THEN 1 ELSE 0 END)  AS total_rejected,
    	SUM(CASE WHEN t5.status = 'Loan Disbursed' THEN 1 ELSE 0 END)+SUM(CASE WHEN t4.status = 'Loan Disbursed' THEN 1 ELSE 0 END)+SUM(CASE WHEN t3.status = 'Loan Disbursed' THEN 1 ELSE 0 END)+SUM(CASE WHEN t2.status = 'Loan Disbursed' THEN 1 ELSE 0 END)+SUM(CASE WHEN t1.status = 'Loan Disbursed' THEN 1 ELSE 0 END) AS total_disbursed,
    	SUM(CASE WHEN t5.status = 'Loan Approved'  THEN 1 ELSE 0 END)+SUM(CASE WHEN t4.status = 'Loan Approved'  THEN 1 ELSE 0 END)+SUM(CASE WHEN t3.status = 'Loan Approved'  THEN 1 ELSE 0 END)+SUM(CASE WHEN t2.status = 'Loan Approved'  THEN 1 ELSE 0 END)+SUM(CASE WHEN t1.status = 'Loan Approved'  THEN 1 ELSE 0 END)  AS total_approved,
    	SUM(CASE WHEN t5.status = 'Application Pending'  THEN 1 ELSE 0 END)+SUM(CASE WHEN t4.status = 'Application Pending'  THEN 1 ELSE 0 END)+SUM(CASE WHEN t3.status = 'Application Pending'  THEN 1 ELSE 0 END)+SUM(CASE WHEN t2.status = 'Application Pending'  THEN 1 ELSE 0 END) +SUM(CASE WHEN t1.status = 'Application Pending'  THEN 1 ELSE 0 END)  AS total_in_progress,
    	SUM(CASE WHEN t5.status = 'Loan Disbursed' THEN  t5.loan_amount ELSE 0 END)+SUM(CASE WHEN t4.status = 'Loan Disbursed' THEN  t4.loan_amount ELSE 0 END)+SUM(CASE WHEN t3.status = 'Loan Disbursed' THEN  t3.loan_amount ELSE 0 END)+SUM(CASE WHEN t2.status = 'Loan Disbursed' THEN  t2.loan_amount ELSE 0 END) + SUM(CASE WHEN t1.status = 'Loan Disbursed' THEN  t1.loan_amount ELSE 0 END) as total_disbursed_amount

    FROM
        dsa_application_view_faircent t1
            LEFT JOIN
        dsa_application_view_faircent t2 ON t1.dsa_mobile_number = t2.partner_code
            LEFT JOIN
        dsa_application_view_faircent t3 ON t2.dsa_mobile_number = t3.partner_code
            LEFT JOIN
        dsa_application_view_faircent t4 ON t3.dsa_mobile_number = t4.partner_code
            LEFT JOIN
        dsa_application_view_faircent t5 ON t4.dsa_mobile_number = t5.partner_code
    WHERE
        t1.partner_code = ${phone} 
    GROUP BY t1.dsa_mobile_number
    ORDER BY total_disbursed DESC;
            `;
    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getAllDsaForMis = async (phone, level) => {
    let query = ` SELECT 
                  CONCAT(REPEAT('-', 0),
                  full_name,
                  ' (',
                  dsa_mobile_number,
                  ')') AS dsa,
                  dsa_mobile_number,
                  dsa_id,
                  partner_code,
                  ${level ? "as level," : ""} 
            CAST(0 AS UNSIGNED) AS total_rejected,
            CAST(0 AS UNSIGNED) AS total_disbursed,
            CAST(0 AS UNSIGNED) AS total_approved,
            CAST(0 AS UNSIGNED) AS total_in_progress,
            CAST(0 AS UNSIGNED) as total_disbursed_amount,
            CAST(0 AS UNSIGNED) AS total_approved_amount
            FROM ru_direct_selling_agents where `;

    query += ` dsa_mobile_number in (
        WITH RECURSIVE DSAHierarchy AS (
            SELECT dsa_mobile_number, partner_code
            FROM ru_direct_selling_agents
            WHERE dsa_mobile_number = ?
            UNION ALL
            SELECT t.dsa_mobile_number, t.partner_code
            FROM ru_direct_selling_agents t
            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
        ) 
        SELECT dsa_mobile_number
        FROM DSAHierarchy
    ) `;

    let bindParams = [phone];

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getDirectDsaForMis = async (phone, offset, limit, isChild, where, is_combined_mis) => {
    let query = ` SELECT 
                  CONCAT(REPEAT('-', 0),
                  c.full_name,
                  ' (',
                  c.dsa_mobile_number,
                  ')') AS dsa,
                  c.dsa_mobile_number,
                  c.dsa_id,
                  c.partner_code,
                  c.created_at,
                  c.utm_main_source,
                  c.home_address_city,
                  c.home_address_state,
                  bh.full_name as business_head_name,
                  s.value as dsa_status,
                  ss.value as dsa_sub_status,
            CAST(0 AS UNSIGNED) AS total_rejected,
            CAST(0 AS UNSIGNED) AS total_disbursed,
            CAST(0 AS UNSIGNED) AS total_approved,
            CAST(0 AS UNSIGNED) AS total_in_progress,
            CAST(0 AS UNSIGNED) as total_disbursed_amount,
            CAST(0 AS UNSIGNED) AS total_approved_amount
            FROM ru_direct_selling_agents c  
            left join ru_direct_selling_agents bh on c.business_head_code = bh.dsa_mobile_number
            left join picklist_values s on s.id = c.dsa_status  
            left join picklist_values ss on s.id = c.dsa_sub_status `;

    let directQuery = ` SELECT 
                  CONCAT(REPEAT('-', 0),
                  c.full_name,
                  ' (',
                  c.dsa_mobile_number,
                  ')') AS dsa,
                  c.dsa_mobile_number,
                  c.dsa_id,
                  c.partner_code,
                  c.created_at,
                  c.utm_main_source,
                  c.home_address_city,
                  c.home_address_state,
                  bh.full_name as business_head_name,
                  s.value as dsa_status,
                  ss.value as dsa_sub_status,
            CAST(0 AS UNSIGNED) AS total_rejected,
            CAST(0 AS UNSIGNED) AS total_disbursed,
            CAST(0 AS UNSIGNED) AS total_approved,
            CAST(0 AS UNSIGNED) AS total_in_progress,
            CAST(0 AS UNSIGNED) as total_disbursed_amount,
            CAST(0 AS UNSIGNED) AS total_approved_amount
            FROM ru_direct_selling_agents c  
            left join ru_direct_selling_agents bh on c.business_head_code = bh.dsa_mobile_number
            left join picklist_values s on s.id = c.dsa_status  
            left join picklist_values ss on s.id = c.dsa_sub_status `;

    let queryCount = ` SELECT count(distinct c.dsa_id) as count FROM ru_direct_selling_agents c left join ru_direct_selling_agents bh on c.business_head_code = bh.dsa_mobile_number left join picklist_values s on s.id = c.dsa_status left join picklist_values ss on s.id = c.dsa_sub_status `;

    let limitQuery = limit ? `limit ${offset}, ${Boolean(offset == 0 && !isChild) ? limit - 1 : limit}` : "";
    if (is_combined_mis) {
        // query += ` where c.dsa_mobile_number is not null ${where} limit ${offset}, ${limit} `;
        query += ` where c.dsa_mobile_number is not null ${where} ${limitQuery} `;
        directQuery += ` where c.dsa_mobile_number = ? `;
        queryCount += ` where c.dsa_mobile_number is not null ${where} `;
    } else {
        // query += ` where c.partner_code = ? limit ${offset}, ${limit} `;
        query += ` where c.partner_code = ? ${limitQuery} `;
        directQuery += ` where c.dsa_mobile_number = ? `;
        queryCount += ` where (c.dsa_mobile_number = ? or c.partner_code = ?) `;
    };

    let bindParams = [phone, phone];
    let records = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let totalRecords = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    let directChild = offset == 0 ? await _db2.query(directQuery, { replacements: bindParams, type: QueryTypes.SELECT }) : [];

    return { records: [...records, ...directChild], totalRecords: totalRecords[0]?.count || 0 };
};

const getLntDashboardByPhoneNumbers = async (phone, level, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, isCron = false) => {

    let bindParams = [];
    bindParams.push(phone);
    bindParams.push(phone)
    let query = `SELECT 
    CONCAT(REPEAT('-', 0),
            dsa_name,
            ' (',
            dsa_mobile_number,
            ')') AS dsa,
            dsa_mobile_number,
            dsa_id,
            partner_code,
            ${level ? "as level," : ""} 
    CAST(SUM(CASE WHEN sub_stage = 'REJECTED' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_rejected,
    CAST(SUM(CASE WHEN sub_stage = 'Online Welcome Kit' THEN 1 ELSE 0 END) AS UNSIGNED )   AS total_disbursed,
    CAST(SUM(CASE WHEN sub_stage in ("eKYC","Mandate Setup","Document Verification","Insurance details","Address details","Bank details","Loan Sanction With Eligibility","Other details","E-DOC") THEN 1 ELSE 0 END) AS UNSIGNED ) AS total_approved,
    CAST(SUM(CASE WHEN sub_stage not in ('REJECTED','Online Welcome Kit',"eKYC","Mandate Setup","Document Verification","Insurance details","Address details","Bank details","Loan Sanction With Eligibility","Other details","E-DOC") or sub_stage  is null THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_in_progress,
    CAST(SUM(CASE WHEN sub_stage = 'Online Welcome Kit' THEN bre_max_eligibility ELSE 0 END) AS UNSIGNED ) as total_disbursed_amount,
    CAST(SUM(CASE WHEN sub_stage in ("eKYC","Mandate Setup","Document Verification","Insurance details","Address details","Bank details","Loan Sanction With Eligibility","Other details","E-DOC") THEN bre_max_eligibility ELSE 0 END) AS UNSIGNED ) AS total_approved_amount
FROM
    dsa_application_view t1
WHERE `
    if (startDateFilter && endDateFilter) {
        if (isCron) {
            query += `month(disbursal_date)  = month("${endDateFilter}") and `;
        } else {
            query += `DATE(disbursal_date)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
        }
    } else if (startDateFilter) {
        query += `DATE(disbursal_date) = DATE("${startDateFilter}") and `
    } else if (endDateFilter) {
        query += `DATE(disbursal_date) = DATE("${endDateFilter}") and `
    }

    if (startDateLoginFilter && endDateLoginFilter) {
        if (isCron) {
            query += `month(created_at)  = month("${endDateLoginFilter}") and `;
        } else {
            query += `DATE(created_at)  between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
        }
    } else if (startDateLoginFilter) {
        query += `DATE(created_at) = DATE("${startDateLoginFilter}") and `
    } else if (endDateLoginFilter) {
        query += `DATE(created_at) = DATE("${endDateLoginFilter}") and `
    }

    query += ` dsa_mobile_number in (?) GROUP BY dsa_mobile_number
            ORDER BY total_disbursed DESC;`

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getLntDashboardByPhoneNumbersV2 = async (phone, level, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, isCron = false) => {
    let bindParams = [];
    bindParams.push(phone);
    bindParams.push(phone)
    let query = ` SELECT 
    CONCAT(REPEAT('-', 0),
    dsa_name,
    ' (',
    dsa_mobile_number,
    ')') AS dsa,
    dsa_mobile_number,
    dsa_id,
    partner_code,
    ${level ? "as level," : ""} 
    CAST(SUM(CASE WHEN sub_stage = 'REJECTED' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_rejected,
    CAST(SUM(CASE WHEN sub_stage = 'Online Welcome Kit' THEN 1 ELSE 0 END) AS UNSIGNED )   AS total_disbursed,
    CAST(SUM(CASE WHEN sub_stage in ("eKYC","Mandate Setup","Document Verification","Insurance details","Address details","Bank details","Loan Sanction With Eligibility","Other details","E-DOC") THEN 1 ELSE 0 END) AS UNSIGNED ) AS total_approved,
    CAST(SUM(CASE WHEN sub_stage not in ('REJECTED','Online Welcome Kit',"eKYC","Mandate Setup","Document Verification","Insurance details","Address details","Bank details","Loan Sanction With Eligibility","Other details","E-DOC") or sub_stage  is null THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_in_progress,
    CAST(SUM(CASE WHEN sub_stage = 'Online Welcome Kit' THEN bre_max_eligibility ELSE 0 END) AS UNSIGNED ) as total_disbursed_amount,
    CAST(SUM(CASE WHEN sub_stage in ("eKYC","Mandate Setup","Document Verification","Insurance details","Address details","Bank details","Loan Sanction With Eligibility","Other details","E-DOC") THEN bre_max_eligibility ELSE 0 END) AS UNSIGNED ) AS total_approved_amount
    FROM dsa_application_view t1 WHERE `;

    if (startDateFilter && endDateFilter) {
        if (isCron) {
            query += `month(t1.disbursal_date)  = month("${endDateFilter}") and `;
        } else {
            query += `DATE(t1.disbursal_date)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
        }
    };

    if (startDateLoginFilter && endDateLoginFilter) {
        if (isCron) {
            query += `month(t1.reated_at)  = month("${endDateLoginFilter}") and `;
        } else {
            query += `DATE(t1.created_at)  between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
        }
    };

    query += ` dsa_mobile_number in (
        WITH RECURSIVE DSAHierarchy AS (
            SELECT dsa_mobile_number, partner_code
            FROM ru_direct_selling_agents
            WHERE dsa_mobile_number = ?
            UNION ALL
            SELECT t.dsa_mobile_number, t.partner_code
            FROM ru_direct_selling_agents t
            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
        ) 
        SELECT dsa_mobile_number
        FROM DSAHierarchy
      ) GROUP BY dsa_mobile_number ORDER BY total_disbursed DESC `

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getIncredDashboardByPhoneNumbers = async (phone, level, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, isCron = false) => {
    let bindParams = [];
    bindParams.push(phone);
    bindParams.push(phone)
    let query = ` SELECT 
    CONCAT(REPEAT('-', 0),
            dsa_name,
            ' (',
            dsa_mobile_number,
            ')') AS dsa,
            dsa_mobile_number,
            dsa_id,
            partner_code,
            ${level ? "as level," : ""} 
            CAST(SUM(CASE WHEN status = 'Loan Rejected' THEN 1 ELSE 0 END)  AS UNSIGNED )  AS total_rejected,
            CAST(SUM(CASE WHEN status = 'Loan Disbursed' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_disbursed,
            CAST(SUM(CASE WHEN status = 'Loan Approved'  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_approved,
            CAST(SUM(CASE WHEN status not in ('Loan Rejected','Loan Disbursed','Loan Approved') or status  is null  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_in_progress,
            CAST(SUM(CASE WHEN status = 'Loan Disbursed' THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_disbursed_amount,
            CAST(SUM(CASE WHEN status = 'Loan Approved' THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_approved_amount
FROM
    dsa_application_view_incred t1
WHERE `
    if (startDateFilter && endDateFilter) {
        if (isCron) {
            query += `month(disbursal_date) = month("${endDateFilter}") and `;
        } else {
            query += `DATE(disbursal_date)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
        }
    } else if (startDateFilter) {
        query += `DATE(disbursal_date) = DATE("${startDateFilter}") and `
    } else if (endDateFilter) {
        query += `DATE(disbursal_date) = DATE("${endDateFilter}") and `
    }

    if (startDateLoginFilter && endDateLoginFilter) {
        if (isCron) {
            query += `month(created_at) = month("${endDateLoginFilter}") and `;
        } else {
            query += `DATE(created_at)  between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
        }
    } else if (startDateLoginFilter) {
        query += `DATE(created_at) = DATE("${startDateLoginFilter}") and `
    } else if (endDateLoginFilter) {
        query += `DATE(created_at) = DATE("${endDateLoginFilter}") and `
    }

    if (!Boolean(startDateLoginFilter || startDateFilter)) {
        query += ` created_at is not null and `
    }

    query += ` dsa_mobile_number in (?) GROUP BY dsa_mobile_number
            ORDER BY total_disbursed DESC;`

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getIncredDashboardByPhoneNumbersV2 = async (phone, level, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, isCron = false) => {
    let bindParams = [];
    bindParams.push(phone);
    bindParams.push(phone)
    let query = ` SELECT 
    CONCAT(REPEAT('-', 0),
    dsa_name,
    ' (',
    dsa_mobile_number,
    ')') AS dsa,
    dsa_mobile_number,
    dsa_id,
    partner_code,
    ${level ? "as level," : ""} 
    CAST(SUM(CASE WHEN status = 'Loan Rejected' THEN 1 ELSE 0 END)  AS UNSIGNED )  AS total_rejected,
            CAST(SUM(CASE WHEN status = 'Loan Disbursed' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_disbursed,
            CAST(SUM(CASE WHEN status = 'Loan Approved'  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_approved,
            CAST(SUM(CASE WHEN status not in ('Loan Rejected','Loan Disbursed','Loan Approved') or status  is null  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_in_progress,
            CAST(SUM(CASE WHEN status = 'Loan Disbursed' THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_disbursed_amount,
            CAST(SUM(CASE WHEN status = 'Loan Approved' THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_approved_amount
FROM
    dsa_application_view_incred t1 WHERE `;

    if (startDateFilter && endDateFilter) {
        if (isCron) {
            query += `month(t1.disbursal_date)  = month("${endDateFilter}") and `;
        } else {
            query += `DATE(t1.disbursal_date)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
        }
    };

    if (startDateLoginFilter && endDateLoginFilter) {
        if (isCron) {
            query += `month(t1.reated_at)  = month("${endDateLoginFilter}") and `;
        } else {
            query += `DATE(t1.created_at)  between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
        }
    };

    query += ` dsa_mobile_number in (
        WITH RECURSIVE DSAHierarchy AS (
            SELECT dsa_mobile_number, partner_code
            FROM ru_direct_selling_agents
            WHERE dsa_mobile_number = ?
            UNION ALL
            SELECT t.dsa_mobile_number, t.partner_code
            FROM ru_direct_selling_agents t
            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
        ) 
        SELECT dsa_mobile_number
        FROM DSAHierarchy
      ) GROUP BY dsa_mobile_number ORDER BY total_disbursed DESC `

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getBajajPLDashboardByPhoneNumbers = async (phone, level, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, isCron = false) => {
    let bindParams = [];
    bindParams.push(phone);
    bindParams.push(phone)
    let query = `SELECT 
    CONCAT(REPEAT('-', 0),
            dsa_name,
            ' (',
            dsa_mobile_number,
            ')') AS dsa,
            dsa_mobile_number,
            dsa_id,
            partner_code,
            ${level ? "as level," : ""} 
            CAST(SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END)  AS UNSIGNED )  AS total_rejected,
            CAST(SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_disbursed,
            CAST(SUM(CASE WHEN status = 1  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_approved,
            CAST(SUM(CASE WHEN status not in (1,2,3) or status  is null THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_in_progress,
            CAST(SUM(CASE WHEN status = 3 THEN  disburse_amount ELSE 0 END) AS UNSIGNED )  AS total_disbursed_amount,
            CAST(SUM(CASE WHEN status = 1 THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_approved_amount
FROM
    dsa_application_view_bajajPL t1
WHERE `
    if (startDateFilter && endDateFilter) {
        if (isCron) {
            query += ` month(disbursal_date) = month("${endDateFilter}") and `;
        } else {
            query += ` DATE(disbursal_date)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
        }
    } else if (startDateFilter) {
        query += `DATE(disbursal_date) = DATE("${startDateFilter}") and `
    } else if (endDateFilter) {
        query += `DATE(disbursal_date) = DATE("${endDateFilter}") and `
    }

    if (startDateLoginFilter && endDateLoginFilter) {
        if (isCron) {
            query += ` month(created_at) = month("${endDateLoginFilter}") and `;
        } else {
            query += `DATE(created_at)  between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
        }
    } else if (startDateLoginFilter) {
        query += `DATE(created_at) = DATE("${startDateLoginFilter}") and `
    } else if (endDateLoginFilter) {
        query += `DATE(created_at) = DATE("${endDateLoginFilter}") and `
    }

    if (!Boolean(startDateLoginFilter || startDateFilter)) {
        query += ` created_at is not null and `
    }

    query += ` dsa_mobile_number in (?) GROUP BY dsa_mobile_number
            ORDER BY total_disbursed DESC;`

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getBajajPLDashboardByPhoneNumbersV2 = async (phone, level, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, isCron = false) => {
    let bindParams = [];
    bindParams.push(phone);
    bindParams.push(phone)
    let query = ` SELECT 
    CONCAT(REPEAT('-', 0),
            dsa_name,
            ' (',
            dsa_mobile_number,
            ')') AS dsa,
            dsa_mobile_number,
            dsa_id,
            partner_code,
            ${level ? "as level," : ""} 
            CAST(SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END)  AS UNSIGNED )  AS total_rejected,
            CAST(SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_disbursed,
            CAST(SUM(CASE WHEN status = 1  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_approved,
            CAST(SUM(CASE WHEN status not in (1,2,3) or status  is null THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_in_progress,
            CAST(SUM(CASE WHEN status = 3 THEN  disburse_amount ELSE 0 END) AS UNSIGNED )  AS total_disbursed_amount,
            CAST(SUM(CASE WHEN status = 1 THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_approved_amount
FROM
    dsa_application_view_bajajPL t1 WHERE `;

    if (startDateFilter && endDateFilter) {
        if (isCron) {
            query += `month(t1.disbursal_date)  = month("${endDateFilter}") and `;
        } else {
            query += `DATE(t1.disbursal_date)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
        }
    };

    if (startDateLoginFilter && endDateLoginFilter) {
        if (isCron) {
            query += `month(t1.reated_at)  = month("${endDateLoginFilter}") and `;
        } else {
            query += `DATE(t1.created_at)  between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
        }
    };

    query += ` dsa_mobile_number in (
        WITH RECURSIVE DSAHierarchy AS (
            SELECT dsa_mobile_number, partner_code
            FROM ru_direct_selling_agents
            WHERE dsa_mobile_number = ?
            UNION ALL
            SELECT t.dsa_mobile_number, t.partner_code
            FROM ru_direct_selling_agents t
            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
        ) 
        SELECT dsa_mobile_number
        FROM DSAHierarchy
      ) GROUP BY dsa_mobile_number ORDER BY total_disbursed DESC `

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getCreditVidyaDashboardByPhoneNumbers = async (phone, level, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, isCron = false) => {
    let bindParams = [];
    bindParams.push(phone);
    bindParams.push(phone)
    let query = `SELECT 
    CONCAT(REPEAT('-', 0),
            dsa_name,
            ' (',
            dsa_mobile_number,
            ')') AS dsa,
            dsa_mobile_number,
            dsa_id,
            partner_code,
            ${level ? "as level," : ""} 
            CAST(SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END)  AS UNSIGNED )  AS total_rejected,
            CAST(SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_disbursed,
            CAST(SUM(CASE WHEN status = 1  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_approved,
            CAST(SUM(CASE WHEN status not in (1,2,3) or status  is null THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_in_progress,
            CAST(SUM(CASE WHEN status = 3 THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_disbursed_amount,
            CAST(SUM(CASE WHEN status = 1 THEN  desired_loan_amount ELSE 0 END) AS UNSIGNED )  AS total_approved_amount
FROM
    dsa_application_view_creditVidya t1
WHERE `
    if (startDateFilter && endDateFilter) {
        if (isCron) {
            query += `month(disbursal_date) = month("${endDateFilter}") and `;
        } else {
            query += `DATE(disbursal_date)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
        }
    } else if (startDateFilter) {
        query += `DATE(disbursal_date) = DATE("${startDateFilter}") and `
    } else if (endDateFilter) {
        query += `DATE(disbursal_date) = DATE("${endDateFilter}") and `
    }

    if (startDateLoginFilter && endDateLoginFilter) {
        if (isCron) {
            query += `month(created_at) = month("${endDateLoginFilter}") and `;
        } else {
            query += `DATE(created_at)  between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
        }
    } else if (startDateLoginFilter) {
        query += `DATE(created_at) = DATE("${startDateLoginFilter}") and `
    } else if (endDateLoginFilter) {
        query += `DATE(created_at) = DATE("${endDateLoginFilter}") and `
    }

    if (!Boolean(startDateLoginFilter || startDateFilter)) {
        query += ` created_at is not null and `
    }

    query += ` dsa_mobile_number in (?) GROUP BY dsa_mobile_number
            ORDER BY total_disbursed DESC;`

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getCreditVidyaDashboardByPhoneNumbersV2 = async (phone, level, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, isCron = false) => {
    let bindParams = [];
    bindParams.push(phone);
    bindParams.push(phone)
    let query = ` SELECT 
    CONCAT(REPEAT('-', 0),
            dsa_name,
            ' (',
            dsa_mobile_number,
            ')') AS dsa,
            dsa_mobile_number,
            dsa_id,
            partner_code,
            ${level ? "as level," : ""} 
            CAST(SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END)  AS UNSIGNED )  AS total_rejected,
            CAST(SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_disbursed,
            CAST(SUM(CASE WHEN status = 1  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_approved,
            CAST(SUM(CASE WHEN status not in (1,2,3) or status  is null THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_in_progress,
            CAST(SUM(CASE WHEN status = 3 THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_disbursed_amount,
            CAST(SUM(CASE WHEN status = 1 THEN  desired_loan_amount ELSE 0 END) AS UNSIGNED )  AS total_approved_amount
FROM
    dsa_application_view_creditVidya t1 WHERE `;

    if (startDateFilter && endDateFilter) {
        if (isCron) {
            query += `month(t1.disbursal_date)  = month("${endDateFilter}") and `;
        } else {
            query += `DATE(t1.disbursal_date)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
        }
    };

    if (startDateLoginFilter && endDateLoginFilter) {
        if (isCron) {
            query += `month(t1.reated_at)  = month("${endDateLoginFilter}") and `;
        } else {
            query += `DATE(t1.created_at)  between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
        }
    };

    query += ` dsa_mobile_number in (
        WITH RECURSIVE DSAHierarchy AS (
            SELECT dsa_mobile_number, partner_code
            FROM ru_direct_selling_agents
            WHERE dsa_mobile_number = ?
            UNION ALL
            SELECT t.dsa_mobile_number, t.partner_code
            FROM ru_direct_selling_agents t
            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
        ) 
        SELECT dsa_mobile_number
        FROM DSAHierarchy
      ) GROUP BY dsa_mobile_number ORDER BY total_disbursed DESC `

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getCreditSasionDashboardByPhoneNumbers = async (phone, level, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, isCron = false) => {
    let bindParams = [];
    bindParams.push(phone);
    bindParams.push(phone)
    let query = `SELECT 
    CONCAT(REPEAT('-', 0),
            dsa_name,
            ' (',
            dsa_mobile_number,
            ')') AS dsa,
            dsa_mobile_number,
            dsa_id,
            partner_code,
            ${level ? "as level," : ""} 
            CAST(SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END)  AS UNSIGNED )  AS total_rejected,
            CAST(SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_disbursed,
            CAST(SUM(CASE WHEN status = 1  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_approved,
            CAST(SUM(CASE WHEN status not in (1,2,3) or status is null  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_in_progress,
            CAST(SUM(CASE WHEN status = 3 THEN  disburse_amount ELSE 0 END) AS UNSIGNED )  AS total_disbursed_amount,
            CAST(SUM(CASE WHEN status = 1 THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_approved_amount
FROM
    dsa_application_view_creditSasion t1
WHERE `
    if (startDateFilter && endDateFilter) {
        if (isCron) {
            query += `month(disbursal_date) = month("${endDateFilter}") and `;
        } else {
            query += `DATE(disbursal_date)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
        }
    } else if (startDateFilter) {
        query += `DATE(disbursal_date) = DATE("${startDateFilter}") and `
    } else if (endDateFilter) {
        query += `DATE(disbursal_date) = DATE("${endDateFilter}") and `
    }

    if (startDateLoginFilter && endDateLoginFilter) {
        if (isCron) {
            query += `month(created_at) = month("${endDateLoginFilter}") and `;
        } else {
            query += `DATE(created_at)  between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
        }
    } else if (startDateLoginFilter) {
        query += `DATE(created_at) = DATE("${startDateLoginFilter}") and `
    } else if (endDateLoginFilter) {
        query += `DATE(created_at) = DATE("${endDateLoginFilter}") and `
    }

    if (!Boolean(startDateLoginFilter || startDateFilter)) {
        query += ` created_at is not null and `
    }

    query += ` dsa_mobile_number in (?) GROUP BY dsa_mobile_number
            ORDER BY total_disbursed DESC;`

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
}


const getPiramalDashboardByPhoneNumbers = async (phone, level, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, isCron = false, application_type = "hl") => {
    let bindParams = [];
    bindParams.push(phone);
    bindParams.push(phone)
    let query = `SELECT 
    CONCAT(REPEAT('-', 0),
            dsa_name,
            ' (',
            dsa_mobile_number,
            ')') AS dsa,
            dsa_mobile_number,
            dsa_id,
            partner_code,
            ${level ? "as level," : ""} 
            CAST(SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END)  AS UNSIGNED )  AS total_rejected,
            CAST(SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_disbursed,
            CAST(SUM(CASE WHEN status = 1  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_approved,
            CAST(SUM(CASE WHEN status not in (1,2,3) or status is null  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_in_progress,
            CAST(SUM(CASE WHEN status = 3 THEN  disburse_amount ELSE 0 END) AS UNSIGNED )  AS total_disbursed_amount,
            CAST(SUM(CASE WHEN status = 1 THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_approved_amount
FROM
    ${application_type == "piramal_lap" ? "dsa_application_view_piramal_lap t1" : "dsa_application_view_piramal t1"}
WHERE `
    if (startDateFilter && endDateFilter) {
        if (isCron) {
            query += `month(disbursal_date) = month("${endDateFilter}") and `;
        } else {
            query += `DATE(disbursal_date)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
        }
    } else if (startDateFilter) {
        query += `DATE(disbursal_date) = DATE("${startDateFilter}") and `
    } else if (endDateFilter) {
        query += `DATE(disbursal_date) = DATE("${endDateFilter}") and `
    }

    if (startDateLoginFilter && endDateLoginFilter) {
        if (isCron) {
            query += `month(created_at) = month("${endDateLoginFilter}") and `;
        } else {
            query += `DATE(created_at)  between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
        }
    } else if (startDateLoginFilter) {
        query += `DATE(created_at) = DATE("${startDateLoginFilter}") and `
    } else if (endDateLoginFilter) {
        query += `DATE(created_at) = DATE("${endDateLoginFilter}") and `
    }

    query += ` dsa_mobile_number in (?) GROUP BY dsa_mobile_number
            ORDER BY total_disbursed DESC;`

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getPiramalDashboardByPhoneNumbersV2 = async (phone, level, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, isCron = false, application_type = "hl") => {
    let bindParams = [];
    bindParams.push(phone);
    bindParams.push(phone)
    let query = ` SELECT 
    CONCAT(REPEAT('-', 0),
            dsa_name,
            ' (',
            dsa_mobile_number,
            ')') AS dsa,
            dsa_mobile_number,
            dsa_id,
            partner_code,
            ${level ? "as level," : ""} 
            CAST(SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END)  AS UNSIGNED )  AS total_rejected,
            CAST(SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_disbursed,
            CAST(SUM(CASE WHEN status = 1  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_approved,
            CAST(SUM(CASE WHEN status not in (1,2,3) or status is null  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_in_progress,
            CAST(SUM(CASE WHEN status = 3 THEN  disburse_amount ELSE 0 END) AS UNSIGNED )  AS total_disbursed_amount,
            CAST(SUM(CASE WHEN status = 1 THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_approved_amount
FROM
    ${application_type == "piramal_lap" ? "dsa_application_view_piramal_lap t1" : "dsa_application_view_piramal t1"} WHERE `;

    if (startDateFilter && endDateFilter) {
        if (isCron) {
            query += `month(t1.disbursal_date)  = month("${endDateFilter}") and `;
        } else {
            query += `DATE(t1.disbursal_date)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
        }
    };

    if (startDateLoginFilter && endDateLoginFilter) {
        if (isCron) {
            query += `month(t1.reated_at)  = month("${endDateLoginFilter}") and `;
        } else {
            query += `DATE(t1.created_at)  between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
        }
    };

    query += ` dsa_mobile_number in (
        WITH RECURSIVE DSAHierarchy AS (
            SELECT dsa_mobile_number, partner_code
            FROM ru_direct_selling_agents
            WHERE dsa_mobile_number = ?
            UNION ALL
            SELECT t.dsa_mobile_number, t.partner_code
            FROM ru_direct_selling_agents t
            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
        ) 
        SELECT dsa_mobile_number
        FROM DSAHierarchy
      ) GROUP BY dsa_mobile_number ORDER BY total_disbursed DESC `

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};


const getFairCentDashboardByPhoneNumbers = async (phone, level, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, isCron = false) => {
    let bindParams = [];
    bindParams.push(phone);
    bindParams.push(phone)
    let query = `SELECT 
    CONCAT(REPEAT('-', 0),
            dsa_name,
            ' (',
            dsa_mobile_number,
            ')') AS dsa,
            dsa_mobile_number,
            dsa_id,
            partner_code,
            ${level ? "as level," : ""} 
            CAST(SUM(CASE WHEN status = 'Loan Rejected' THEN 1 ELSE 0 END)  AS UNSIGNED )  AS total_rejected,
            CAST(SUM(CASE WHEN status = 'Loan Disbursed' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_disbursed,
            CAST(SUM(CASE WHEN status = 'Loan Approved'  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_approved,
            CAST(SUM(CASE WHEN status not in ('Loan Rejected','Loan Disbursed','Loan Approved') or status  is null  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_in_progress,
            CAST(SUM(CASE WHEN status = 'Loan Disbursed' THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_disbursed_amount,
            CAST(SUM(CASE WHEN status = 'Loan Approved' THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_approved_amount
FROM
    dsa_application_view_faircent t1
WHERE `
    if (startDateFilter && endDateFilter) {
        if (isCron) {
            query += `month(disbursal_date) = month("${endDateFilter}") and `;
        } else {
            query += `DATE(disbursal_date)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
        }
    } else if (startDateFilter) {
        query += `DATE(disbursal_date) = DATE("${startDateFilter}") and `
    } else if (endDateFilter) {
        query += `DATE(disbursal_date) = DATE("${endDateFilter}") and `
    }

    if (startDateLoginFilter && endDateLoginFilter) {
        if (isCron) {
            query += `month(created_at) = month("${endDateLoginFilter}") and `;
        } else {
            query += `DATE(created_at)  between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
        }
    } else if (startDateLoginFilter) {
        query += `DATE(created_at) = DATE("${startDateLoginFilter}") and `
    } else if (endDateLoginFilter) {
        query += `DATE(created_at) = DATE("${endDateLoginFilter}") and `
    }
    if (!Boolean(startDateLoginFilter || startDateFilter)) {
        query += ` created_at is not null and `
    }
    query += ` dsa_mobile_number in (?) GROUP BY dsa_mobile_number
            ORDER BY total_disbursed DESC;`

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getFairCentDashboardByPhoneNumbersV2 = async (phone, level, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, isCron = false) => {
    let bindParams = [];
    bindParams.push(phone);
    bindParams.push(phone)
    let query = ` SELECT 
    CONCAT(REPEAT('-', 0),
    dsa_name,
    ' (',
    dsa_mobile_number,
    ')') AS dsa,
    dsa_mobile_number,
    dsa_id,
    partner_code,
    ${level ? "as level," : ""} 
    CAST(SUM(CASE WHEN status = 'Loan Rejected' THEN 1 ELSE 0 END)  AS UNSIGNED )  AS total_rejected,
            CAST(SUM(CASE WHEN status = 'Loan Disbursed' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_disbursed,
            CAST(SUM(CASE WHEN status = 'Loan Approved'  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_approved,
            CAST(SUM(CASE WHEN status not in ('Loan Rejected','Loan Disbursed','Loan Approved') or status  is null  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_in_progress,
            CAST(SUM(CASE WHEN status = 'Loan Disbursed' THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_disbursed_amount,
            CAST(SUM(CASE WHEN status = 'Loan Approved' THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_approved_amount
FROM
    dsa_application_view_faircent t1
WHERE `;

    if (startDateFilter && endDateFilter) {
        if (isCron) {
            query += `month(t1.disbursal_date)  = month("${endDateFilter}") and `;
        } else {
            query += `DATE(t1.disbursal_date)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
        }
    };

    if (startDateLoginFilter && endDateLoginFilter) {
        if (isCron) {
            query += `month(t1.reated_at)  = month("${endDateLoginFilter}") and `;
        } else {
            query += `DATE(t1.created_at)  between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
        }
    };

    query += ` dsa_mobile_number in (
        WITH RECURSIVE DSAHierarchy AS (
            SELECT dsa_mobile_number, partner_code
            FROM ru_direct_selling_agents
            WHERE dsa_mobile_number = ?
            UNION ALL
            SELECT t.dsa_mobile_number, t.partner_code
            FROM ru_direct_selling_agents t
            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
        ) 
        SELECT dsa_mobile_number
        FROM DSAHierarchy
      ) GROUP BY dsa_mobile_number ORDER BY total_disbursed DESC `

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getIndifiDashboardByPhoneNumbers = async (phone, level, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, isCron = false) => {
    let bindParams = [];
    bindParams.push(phone);
    bindParams.push(phone)
    let query = `SELECT 
    CONCAT(REPEAT('-', 0),
            dsa_name,
            ' (',
            dsa_mobile_number,
            ')') AS dsa,
            dsa_mobile_number,
            dsa_id,
            partner_code,
            ${level ? "as level," : ""} 
    CAST(SUM(CASE WHEN state='loan_active' THEN 1 ELSE 0 END) AS UNSIGNED)  AS total_disbursed,
    CAST(SUM(CASE WHEN application_status_description = 'Business Details Saved' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_basic_details_captured,
    CAST(SUM(CASE WHEN application_status_description = 'Consent Form Signed' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_consent_signed,
    CAST(SUM(CASE WHEN (state !='loan_active'  and state  != 'rejected') or state is null  THEN 1 ELSE 0 END) AS UNSIGNED )   AS total_pending,
    CAST(SUM(CASE WHEN state = 'rejected'  THEN 1 ELSE 0 END) AS UNSIGNED )   AS total_rejected,
    CAST(SUM(CASE WHEN state  = 'loan_active' THEN indifi_amount ELSE 0 END)  AS UNSIGNED ) as total_disbursed_amount,
    CAST(SUM(CASE WHEN application_status_description = 'Promoter Details Saved' THEN 1 ELSE 0 END)  AS UNSIGNED ) as total_promoter_details_captured,
    CAST(SUM(CASE WHEN application_status_description = 'Loan Details Saved' THEN 1 ELSE 0 END)  AS UNSIGNED ) as total_loan_details_saved

FROM dsa_indifi_application_view t1
WHERE `
    if (startDateFilter && endDateFilter) {
        if (isCron) {
            query += `month(disbursal_date) = month("${endDateFilter}") and `;
        } else {
            query += `DATE(disbursal_date)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
        }
    } else if (startDateFilter) {
        query += `DATE(disbursal_date) = DATE("${startDateFilter}") and `
    } else if (endDateFilter) {
        query += `DATE(disbursal_date) = DATE("${endDateFilter}") and `
    }

    if (startDateLoginFilter && endDateLoginFilter) {
        if (isCron) {
            query += `month(application_date) = month("${endDateLoginFilter}") and `;
        } else {
            query += `DATE(application_date)  between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
        }
    } else if (startDateLoginFilter) {
        query += `DATE(application_date) = DATE("${startDateLoginFilter}") and `
    } else if (endDateLoginFilter) {
        query += `DATE(application_date) = DATE("${endDateLoginFilter}") and `
    }

    console.log(query)
    query += ` dsa_mobile_number in (?) GROUP BY dsa_mobile_number
            ORDER BY total_disbursed_amount DESC;`

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getIndifiDashboardByPhoneNumbersV2 = async (phone, level, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, isCron = false) => {
    let bindParams = [];
    bindParams.push(phone);
    bindParams.push(phone)
    let query = ` SELECT 
    CONCAT(REPEAT('-', 0),
            dsa_name,
            ' (',
            dsa_mobile_number,
            ')') AS dsa,
            dsa_mobile_number,
            dsa_id,
            partner_code,
            ${level ? "as level," : ""} 
    CAST(SUM(CASE WHEN state='loan_active' THEN 1 ELSE 0 END) AS UNSIGNED)  AS total_disbursed,
    CAST(SUM(CASE WHEN application_status_description = 'Business Details Saved' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_basic_details_captured,
    CAST(SUM(CASE WHEN application_status_description = 'Consent Form Signed' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_consent_signed,
    CAST(SUM(CASE WHEN (state !='loan_active'  and state  != 'rejected') or state is null  THEN 1 ELSE 0 END) AS UNSIGNED )   AS total_pending,
    CAST(SUM(CASE WHEN state = 'rejected'  THEN 1 ELSE 0 END) AS UNSIGNED )   AS total_rejected,
    CAST(SUM(CASE WHEN state  = 'loan_active' THEN indifi_amount ELSE 0 END)  AS UNSIGNED ) as total_disbursed_amount,
    CAST(SUM(CASE WHEN application_status_description = 'Promoter Details Saved' THEN 1 ELSE 0 END)  AS UNSIGNED ) as total_promoter_details_captured,
    CAST(SUM(CASE WHEN application_status_description = 'Loan Details Saved' THEN 1 ELSE 0 END)  AS UNSIGNED ) as total_loan_details_saved

FROM dsa_indifi_application_view t1
WHERE `;

    if (startDateFilter && endDateFilter) {
        if (isCron) {
            query += `month(t1.disbursal_date)  = month("${endDateFilter}") and `;
        } else {
            query += `DATE(t1.disbursal_date)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
        }
    };

    if (startDateLoginFilter && endDateLoginFilter) {
        if (isCron) {
            query += `month(t1.reated_at)  = month("${endDateLoginFilter}") and `;
        } else {
            query += `DATE(t1.created_at)  between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
        }
    };

    query += ` dsa_mobile_number in (
        WITH RECURSIVE DSAHierarchy AS (
            SELECT dsa_mobile_number, partner_code
            FROM ru_direct_selling_agents
            WHERE dsa_mobile_number = ?
            UNION ALL
            SELECT t.dsa_mobile_number, t.partner_code
            FROM ru_direct_selling_agents t
            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
        ) 
        SELECT dsa_mobile_number
        FROM DSAHierarchy
      ) GROUP BY dsa_mobile_number ORDER BY total_disbursed DESC `

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getBajajCCDashboardByPhoneNumbers = async (phone, level, startDateFilter, endDateFilter, isCron = false) => {
    let bindParams = [];
    bindParams.push(phone);
    bindParams.push(phone)
    let query = `SELECT 
    CONCAT(REPEAT('-', 0),
            dsa_name,
            ' (',
            dsa_mobile_number,
            ')') AS dsa,
            dsa_mobile_number,
            dsa_id,
            partner_code,
            ${level ? "as level," : ""} 
    CAST(SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_rejected,
    CAST(SUM(CASE WHEN status not in ('Rejected','Approved','Consent Form Signed','Customer Basic Details Saved') or status  is null THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_pending,
    CAST(SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_approved,
    CAST(SUM(CASE WHEN status = 'Consent Form Signed' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_consent_signed,
    CAST(SUM(CASE WHEN status = 'Customer Basic Details Saved' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_basic_detail_saved
    
FROM
dsa_bfl_cc_view t1
WHERE `
    if (startDateFilter && endDateFilter) {
        if (isCron) {
            query += ` month(created_at)  = month("${endDateFilter}") and `;
        } else {
            query += ` DATE(created_at)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
        }
    } else if (startDateFilter) {
        query += `DATE(created_at) = DATE("${startDateFilter}") and `
    } else if (endDateFilter) {
        query += `DATE(created_at) = DATE("${endDateFilter}") and `
    }

    if (!Boolean(startDateFilter)) {
        query += ` created_at is not null and `
    }

    query += ` dsa_mobile_number in (?) GROUP BY dsa_mobile_number
            ORDER BY total_approved DESC;`

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getAllCCForDashBoard = async (product_id, phone, level, startDateFilter, endDateFilter) => {
    let bindParams = [];
    bindParams.push(phone);
    let query = `SELECT 
    CONCAT(REPEAT('-', 0),
            dsa_name,
            ' (',
            dsa_mobile_number,
            ')') AS dsa,
            dsa_mobile_number,
            dsa_id,
            partner_code,
            ${level ? "as level," : ""} 
    CAST(SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_rejected,
    CAST(SUM(CASE WHEN status = 'Pending/WIP' or status is null THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_in_progress,
    CAST(SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_approved
    
    FROM
    dsa_bfl_cc_view t1
    WHERE `

    if (startDateFilter) {
        query += ` DATE(created_at)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
    };

    query += ` dsa_mobile_number in (
        WITH RECURSIVE DSAHierarchy AS (
            SELECT dsa_mobile_number, partner_code
            FROM ru_direct_selling_agents
            WHERE dsa_mobile_number = ?
            UNION ALL
            SELECT t.dsa_mobile_number, t.partner_code
            FROM ru_direct_selling_agents t
            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
        ) 
        SELECT dsa_mobile_number
        FROM DSAHierarchy
      ) `;

    query += ` and product_id = ${product_id} `;

    query += ` GROUP BY dsa_mobile_number ORDER BY total_approved DESC `;

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getDsaTreeArray = async (phone, level, startDateFilter, endDateFilter) => {
    let bindParams = [];
    let query = `
    
    SELECT 
    CONCAT(
            t1.full_name,
            ' |',
            t1.dsa_mobile_number
            ) AS dsa1,
            CONCAT(
            t2.full_name,
            ' |',
            t2.dsa_mobile_number,'|',t1.dsa_mobile_number) AS dsa2,
            CONCAT(
            t3.full_name,
            ' |',
            t3.dsa_mobile_number,'|',t2.dsa_mobile_number) AS dsa3,
            CONCAT(
            t4.full_name,
            ' |',
            t4.dsa_mobile_number,'|',t3.dsa_mobile_number) AS dsa4,
            CONCAT(
            t5.full_name,
            ' |',
            t5.dsa_mobile_number,'|',t4.dsa_mobile_number) AS dsa5,
            CONCAT(
            t6.full_name,
            ' |',
            t6.dsa_mobile_number,'|',t5.dsa_mobile_number) AS dsa6,
            CONCAT(
            t7.full_name,
            ' |',
            t7.dsa_mobile_number,'|',t6.dsa_mobile_number) AS dsa7,
            CONCAT(
                t8.full_name,
                ' |',
                t8.dsa_mobile_number,'|',t7.dsa_mobile_number) AS dsa8,
                CONCAT(
                    t9.full_name,
                    ' |',
                    t9.dsa_mobile_number,'|',t8.dsa_mobile_number) AS dsa9
FROM
    ru_direct_selling_agents t1
        LEFT JOIN
    ru_direct_selling_agents t2 ON t1.dsa_mobile_number = t2.partner_code
        LEFT JOIN
    ru_direct_selling_agents t3 ON t2.dsa_mobile_number = t3.partner_code
        LEFT JOIN
    ru_direct_selling_agents t4 ON t3.dsa_mobile_number = t4.partner_code
        LEFT JOIN
    ru_direct_selling_agents t5 ON t4.dsa_mobile_number = t5.partner_code
    LEFT JOIN
    ru_direct_selling_agents t6 ON t5.dsa_mobile_number = t6.partner_code
    LEFT JOIN
    ru_direct_selling_agents t7 ON t6.dsa_mobile_number = t7.partner_code
    LEFT JOIN
    ru_direct_selling_agents t8 ON t7.dsa_mobile_number = t8.partner_code
    LEFT JOIN
    ru_direct_selling_agents t9 ON t8.dsa_mobile_number = t9.partner_code
        WHERE
         t1.dsa_mobile_number = '${phone}'
; `


    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
}

const getDsaChild = async (partnerPhone) => {
    let bindParams = [partnerPhone];
    let query = ' select id ,dsa_id ,dsa_mobile_number ,partner_code ,signup_steps_completed ,salutation ,first_name ,last_name ,full_name ,email_address  from ru_direct_selling_agents dsa where dsa.partner_code = ? ';
    let dsa = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return dsa;
}


const createCommunicationSettings = async (from, to, frequency, template, template_id) => {
    let bindParams = [from, to, frequency, template, template_id];
    let query = `  insert into communication_settings(from_value,to_value,frequency,template,template_id) values(?,?,?,?,?) `;
    await sequelize.query(query, { replacements: [from, to, frequency, template, template_id], type: QueryTypes.INSERT });
}
const getLntApplicationStage = async () => {
    let bindParams = [];
    let query = ` select distinct stage from ru_lt_personal_loan_applications_meta ltm  where stage is not  null and stage != '' `;
    let stage = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return stage;
}

const getInvoiceById = async (invoice_id, column) => {
    let bindParams = [invoice_id];
    let invoiceSelect = ` 
    e.city,
    e.sign_url,
    e.expense_id as id, 
    e.bill_date as transaction_date, 
    e.invoice_number as invoice_number, 
    d.gstin as vendor_gstin, 
    d.company_name as vendor_company_name,
    d.dsa_mobile_number as vendor_mobile_number,
    d.email_address as vendor_email_address,
    CONCAT_WS(', ', da.address_line_1, da.address_line_2, da.address_line_3) AS vendor_address_house_number,
    ei.expense_type,
    kyc.permanent_account_number as vendor_pan, 
    da.pin_code as vendor_pincode, 
    da.state as vendor_state, 
    da.city as vendor_city, 
    d.full_name as vendor_name, 
    kyc.class_id as vendor_class, 
    e.sgst as sgst_percentage, 
    e.cgst as cgst_percentage, 
    e.igst as igst_percentage, 
    e.created_at, 
    e.status, 
    e.memo,
    SUM(ei.amount) as base_payout_amount, 
    SUM(ei.tax_amount) as amount_inc_gst `;

    let query = ` SELECT ${invoiceSelect} FROM ru_dsa_expenses e 
     LEFT JOIN (
         SELECT ei.*
         FROM ru_dsa_expense_items ei
         WHERE ei.updated_at = (
             SELECT MAX(updated_at)
             FROM ru_dsa_expense_items
             WHERE expense_id = ei.expense_id
         )
     ) ei ON ei.expense_id = e.expense_id
     LEFT JOIN ru_direct_selling_agents d ON e.dsa_id = d.dsa_id 
     LEFT JOIN (
         SELECT da.*
         FROM ru_dsa_addresses da
         WHERE da.updated_at = (
             SELECT MAX(updated_at)
             FROM ru_dsa_addresses
             WHERE dsa_id = da.dsa_id
         )
     ) da ON da.dsa_id = d.dsa_id
     LEFT JOIN ru_dsa_kyc_data kyc ON e.dsa_id = kyc.dsa_id 
     LEFT JOIN CRMTest.users u ON BIN_TO_UUID(u.id) = e.created_by 
     WHERE e.expense_id = ? GROUP BY e.expense_id`;

    let invoice = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    if (invoice[0]) {
        query = `SELECT * FROM ru_dsa_expense_items WHERE expense_id = ?`;
        let items = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        invoice[0]["list_items"] = items;
    }

    let data = invoice[0];
    if (!data) {
        return null;
    }

    if (column) {
        return { bill_number: data[column] };
    }

    return data;
};
const downloadInvoice = async (invoice_id) => {
    let bindParams = [invoice_id];
    let query = ` select sign_url from ru_dsa_expenses where expense_id = ? `;
    let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return data[0];
}

const updateInvoiceSignById = async ({ sign_id, sign_url, invoice_id }) => {
    let query = ` update ru_dsa_expenses set sign_id=?, sign_url=? where expense_id = ?  `;
    let bindParams = [sign_id || null, sign_url || null, invoice_id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return;
};

const E_SIGN_STATUS_RANK = {
    e_sign_created: 1,
    e_sign_viewed: 2,
    e_sign_signed: 3,
    e_sign_completed: 4,
    e_sign_declined: 100,
};

const shouldApplyEsignStatus = (currentAlias, incomingAlias) => {
    if (incomingAlias === 'e_sign_completed' || incomingAlias === 'e_sign_declined') {
        return true;
    }
    const currentRank = E_SIGN_STATUS_RANK[currentAlias] || 0;
    const incomingRank = E_SIGN_STATUS_RANK[incomingAlias] || 0;
    return incomingRank >= currentRank;
};

const signInvoiceWebhook = async ({ status_alias, sign_url, sign_cert_url, sign_completed_at, sign_id }) => {
    const expenseQuery = ` select e.*, bin_to_uuid(u.id) as crm_id from ru_dsa_expenses e left join ru_direct_selling_agents d on d.dsa_id = e.dsa_id left join CRMTest.users u on u.email = d.email_address where sign_id = ? `;
    let bindParams = [sign_id];
    let data = await _db2.query(expenseQuery, { replacements: bindParams, type: QueryTypes.SELECT, useMaster: true });

    if (!data[0]) {
        return null;
    }

    const previousStatusAlias = data[0].status_alias;

    if (!shouldApplyEsignStatus(previousStatusAlias, status_alias)) {
        return { ...data[0], previous_status_alias: previousStatusAlias, status_updated: false };
    }

    let query;
    if (status_alias === 'e_sign_completed') {
        query = ` update ru_dsa_expenses set status_alias=?, status='Approved', sign_url=?, sign_cert_url=?, sign_completed_at=? where sign_id = ? `;
        bindParams = [status_alias || null, sign_url || null, sign_cert_url || null, sign_completed_at || null, sign_id];
    } else if (status_alias === 'e_sign_declined') {
        query = ` update ru_dsa_expenses set status_alias=?, status='Rejected', sign_url=?, sign_cert_url=?, sign_completed_at=? where sign_id = ? `;
        bindParams = [status_alias || null, sign_url || null, sign_cert_url || null, sign_completed_at || null, sign_id];
    } else {
        query = ` update ru_dsa_expenses set status_alias=?, sign_url=?, sign_cert_url=?, sign_completed_at=? where sign_id = ? `;
        bindParams = [status_alias || null, sign_url || null, sign_cert_url || null, sign_completed_at || null, sign_id];
    }

    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE, useMaster: true });

    const refreshed = await _db2.query(expenseQuery, { replacements: [sign_id], type: QueryTypes.SELECT, useMaster: true });
    const invoice = refreshed[0] || data[0] || null;
    if (!invoice) {
        return null;
    }
    return { ...invoice, previous_status_alias: previousStatusAlias, status_updated: true };
};
const getAllPincodes = async (pageNumber, pageSize, where = []) => {
    const normalizedPage = pageNumber < 1 ? 0 : pageNumber
    const offset = normalizedPage * pageSize

    let whereSQL = ''
    let replacements = {
        limit: pageSize,
        offset
    }

    if (where.length) {
        const conditions = where.map((condition, index) => {
            const [column, operator, value] = condition
            const key = `filter_${index}`
            replacements[key] = value
            return `${column} ${operator} :${key}`
        })

        whereSQL = `WHERE ${conditions.join(' AND ')}`
    }

    const query = `
    SELECT * 
    FROM CRMTest.pincodes_list
    ${whereSQL}
    LIMIT :limit 
    OFFSET :offset
  `

    const countQuery = `
    SELECT COUNT(*) AS count
    FROM CRMTest.pincodes_list
    ${whereSQL}
  `

    const records = await _db2.query(query, {
        type: QueryTypes.SELECT,
        replacements
    })

    const totalCountResult = await _db2.query(countQuery, {
        type: QueryTypes.SELECT,
        replacements
    })

    return {
        records,
        totalRecords: totalCountResult[0].count
    }
}

const editPincode = async (pincodeId, data) => {

    const allowedFields = [
        'office_name',
        'office_type',
        'country',
        'city',
        'region',
        'circle',
        'taluk',
        'district',
        'state',
        'related_suboffice',
        'related_head_office'
    ];


    const updateData = _.pick(data, allowedFields);

    if (_.isEmpty(updateData)) {
        throw new Error('No valid fields provided for update');
    }


    const setClauses = [];
    const replacements = { pincodeId };

    Object.entries(updateData).forEach(([key, value], index) => {
        const paramName = `field_${index}`;
        setClauses.push(`${key} = :${paramName}`);
        replacements[paramName] = value;
    });

    const updateQuery = `
    UPDATE CRMTest.pincodes_list
    SET ${setClauses.join(', ')}
    WHERE id = :pincodeId
  `;


    const result = await _db2.query(updateQuery, {
        type: QueryTypes.UPDATE,
        replacements,
    });

    return { message: 'Pincode updated successfully', updatedFields: updateData };
};
const deletePincode = async (pincodeId) => {
    const deleteQuery = `
    DELETE FROM CRMTest.pincodes_list
    WHERE id = :pincodeId
  `;

    const result = await _db2.query(deleteQuery, {
        type: QueryTypes.DELETE,
        replacements: { pincodeId }
    });

    return {
        message: 'Pincode deleted successfully',
        data: { pincodeId }
    };
};
const addPincode = async (
    pincode,
    office_name,
    office_type,
    country,
    city,
    region,
    circle,
    taluk,
    district,
    state,
    related_suboffice,
    related_head_office
) => {
    const insertQuery = `
        INSERT INTO CRMTest.pincodes_list 
        (pincode, office_name, office_type, country, city, region, circle, taluk, district, state, related_suboffice, related_head_office)
        VALUES 
        (:pincode, :office_name, :office_type, :country, :city, :region, :circle, :taluk, :district, :state, :related_suboffice, :related_head_office)
    `;

    await _db2.query(insertQuery, {
        type: QueryTypes.INSERT,
        replacements: {
            pincode,
            office_name,
            office_type,
            country,
            city,
            region,
            circle,
            taluk,
            district,
            state,
            related_suboffice,
            related_head_office
        }
    });

    return { pincode, office_name, city, state };
};

const getInvoiceByInvoiceNumber = async (invoice_number) => {
    let bindParams = [invoice_number];
    let query = ` select * from ru_invoice where invoice_number = ?  `;
    let invoice = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return invoice[0];
};

const updateInvoice = async (transaction_date, vendor_pan, vendor_class, vendor_name, base_payout_amount, invoice_number, supply_type, gst_registration_type, place_of_supply, cgst_percentage, sgst_percentage, igst_percentage, cgst_amount, sgst_amount, igst_amount, vendor_mobile_number, vendor_email_address, vendor_company_name, vendor_gstin, vendor_full_name, vendor_address_house_number, vendor_address_area, vendor_address_city, vendor_address_state, vendor_address_pincode, has_reverse_invoice, status, remark, invoice_id) => {
    let status_alias = status == "1" ? "sent_for_approval" : status == "2" ? "completed" : "pending";
    let bindParams = [new Date(), transaction_date, vendor_pan, vendor_class, vendor_name, base_payout_amount, invoice_number, supply_type, gst_registration_type, place_of_supply, cgst_percentage, sgst_percentage, igst_percentage, cgst_amount, sgst_amount, igst_amount, vendor_mobile_number, vendor_email_address, vendor_company_name, vendor_gstin, vendor_full_name, vendor_address_house_number, vendor_address_area, vendor_address_city, vendor_address_state, vendor_address_pincode, has_reverse_invoice, status, remark, status_alias, invoice_id];
    let query = ` update ru_invoice set updated_at = ?, transaction_date = ?,vendor_pan = ?,vendor_class = ?,vendor_name = ?,base_payout_amount = ?,invoice_number = ?,supply_type = ?,gst_registration_type = ?,place_of_supply = ?,cgst_percentage = ?,sgst_percentage = ?,igst_percentage = ?,cgst_amount = ?,sgst_amount = ?,igst_amount = ?,vendor_mobile_number = ?,vendor_email_address = ?,vendor_company_name = ?,vendor_gstin = ?,vendor_full_name = ?,vendor_address_house_number = ?,vendor_address_area = ?,vendor_address_city = ?,vendor_address_state = ?,vendor_address_pincode = ?,has_reverse_invoice = ?,status = ?,remark = ?, status_alias = ? where invoice_id = ?  `;
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
};

const getLntApplicationSubStage = async () => {
    let bindParams = [];
    let query = ` select distinct sub_stage from ru_lt_personal_loan_applications_meta ltm where sub_stage is not null and sub_stage !='' `;
    let subStage = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return subStage;
}
const getDsaIdByPhone = async (phone) => {
    let bindParams = [phone];
    let query = ` select dsa_id from ru_direct_selling_agents d where d.dsa_mobile_number=?`;
    let dsa = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return dsa[0];
};

const updateChannelPartnerStatus = async (data) => {
    let { dsa_id, status, sub_status } = data;
    let query = ` update ru_direct_selling_agents set dsa_status=?, dsa_sub_status=?,last_communication_at = ?,dsa_status_updated_at=? where dsa_id=?`;
    let bindParams = [status, sub_status || null, new Date(), new Date(), dsa_id];
    let dsa = await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return dsa;
};

const getOnChangeCommunication = async (status, dsa_id) => {
    let query = ` select dsa_status from ru_direct_selling_agents dsa where dsa.dsa_id = ? `;
    let bindParams = [dsa_id];
    let dsa = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let dsa_status = dsa[0] ? dsa[0].dsa_status : null;

    let from_value = null;
    let to_value = null;
    if (dsa_status) {
        query = ` select value from picklist_values where id = ? `;
        from_value = await sequelize.query(query, { replacements: [dsa_status], type: QueryTypes.SELECT });
        from_value = from_value[0] ? from_value[0].value : null;
    }
    if (status) {
        query = ` select value from picklist_values where id = ? `;
        to_value = await sequelize.query(query, { replacements: [status], type: QueryTypes.SELECT });
        to_value = to_value[0] ? to_value[0].value : null;
    }

    query = ` select * from communication_settings where frequency is null  `;
    bindParams = [];

    let condition = false;
    if (from_value) {
        if (!condition) {
            query += ` and ( `
            condition = true;
        } else {
            query += ` or `
        }
        query += `  from_value = ? `
        bindParams.push(from_value)

    }
    if (to_value) {
        if (!condition) {
            query += ` and ( `
            condition = true;
        } else {
            query += ` or `
        }
        query += ` to_value = ? `
        bindParams.push(to_value)
    }
    if (condition) {
        query += ` ) `;
    }

    bindParams = [from_value, to_value];
    let comm = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return comm;
};

const getTimeBasedCommunication = async () => {

    query = ` select * from communication_settings where frequency is not null  `;
    bindParams = [];
    let comm = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return comm;
};

const downloadDsaWithStep = async (startDateFilter, endDateFilter) => {
    let query = ` select dsa_mobile_number as mobile_number,dsa_id as id, full_name as name,email_address as email,(signup_steps_completed/6)*100 as sign_up_steps from ru_direct_selling_agents  `;
    if (startDateFilter) {
        query += ` where DATE(created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `
    }
    query += ` order by id desc`
    let bindParams = [];
    let dsa = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return dsa;
}

const downloadDsaWithStepWhereIn = async (idArr) => {
    let query = ` select dsa_mobile_number as mobile_number,dsa_id as id, full_name as name,email_address as email,(signup_steps_completed/6)*100 as sign_up_steps from ru_direct_selling_agents where dsa_id in (?) order by id desc `;
    let bindParams = [idArr];
    let dsa = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return dsa;
}

const getCreditCardApplicationStatus = async () => {
    let query = ` select * from  ru_cc_application_status_list`;
    let status = await _db2.query(query, { type: QueryTypes.SELECT });
    return status;
}

const getIndifiApplicationStatus = async () => {
    let query = ` select * from  ru_indifi_loan_application_status_list`;
    let status = await _db2.query(query, { type: QueryTypes.SELECT });
    return status;
}

const getDsaTreeDownload = async () => {
    let query = `SELECT
    CONCAT(
            t1.full_name,
            ' |',
            t1.dsa_mobile_number
            ) AS Ceo,
            CONCAT(
            t2.full_name,
            ' |',
            t2.dsa_mobile_number) AS lv1,
            CONCAT(
            t3.full_name,
            ' |',
            t3.dsa_mobile_number) AS lv2,
            CONCAT(
            t4.full_name,
            ' |',
            t4.dsa_mobile_number) AS lv3,
            CONCAT(
            t5.full_name,
            ' |',
            t5.dsa_mobile_number) AS lv4,
            CONCAT(
            t6.full_name,
            ' |',
            t6.dsa_mobile_number) AS lv5,
            CONCAT(
            t7.full_name,
            ' |',
            t7.dsa_mobile_number) AS lv6,
            CONCAT(
            t8.full_name,
            ' |',
            t8.dsa_mobile_number) AS lv7,
            CONCAT(
            t9.full_name,
            ' |',
            t9.dsa_mobile_number) AS lv8,
            CONCAT(
            t10.full_name,
            ' |',
            t10.dsa_mobile_number) AS lv9

FROM
    ru_direct_selling_agents t1
        LEFT JOIN
    ru_direct_selling_agents t2 ON t1.dsa_mobile_number = t2.partner_code
        LEFT JOIN
    ru_direct_selling_agents t3 ON t2.dsa_mobile_number = t3.partner_code
        LEFT JOIN
    ru_direct_selling_agents t4 ON t3.dsa_mobile_number = t4.partner_code
        LEFT JOIN
    ru_direct_selling_agents t5 ON t4.dsa_mobile_number = t5.partner_code
    LEFT JOIN
    ru_direct_selling_agents t6 ON t5.dsa_mobile_number = t6.partner_code
    LEFT JOIN
    ru_direct_selling_agents t7 ON t6.dsa_mobile_number = t7.partner_code
    LEFT JOIN
    ru_direct_selling_agents t8 ON t7.dsa_mobile_number = t8.partner_code
    LEFT JOIN
    ru_direct_selling_agents t9 ON t8.dsa_mobile_number = t9.partner_code
    LEFT JOIN
    ru_direct_selling_agents t10 ON t9.dsa_mobile_number = t10.partner_code
        WHERE
         t1.dsa_mobile_number = '9987884000'`;
    let status = await _db2.query(query, { type: QueryTypes.SELECT });
    return status;
}

const editSubAssignee = async (data) => {
    const table = { lnt: "ru_lt_personal_loan_applications", credit_card: "ru_credit_card_applications", loan: "ru_loan_applications", indifi: "ru_indifi_loan_applications" };
    const { sub_assignee, assigned_by, id, table_name } = data;
    let query;
    let bindParams;
    //get previous assignee
    query = `select sa.name as assigned_to, sab.name as assigned_by from ${table[table_name]} a left join CRMTest.users sa on a.assigned_to = bin_to_uuid(sa.id) left join CRMTest.users sab on a.assigned_by = bin_to_uuid(sab.id) where a.id=?`
    bindParams = [id];
    let previousData = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    //Update assignee
    query = ` update ${table[table_name]} set assigned_to=?, assigned_by=? where id=? `
    bindParams = [sub_assignee, assigned_by, id]
    let results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

    //get updated assignee
    query = `select sa.name as assigned_to, sab.name as assigned_by from ${table[table_name]} a left join CRMTest.users sa on a.assigned_to = bin_to_uuid(sa.id) left join CRMTest.users sab on a.assigned_by = bin_to_uuid(sab.id) where a.id=? `
    bindParams = [id];
    let newData = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    return { newData: newData[0], previousData: previousData[0] };
}

const editUserType = async ({ user_type, dsa_id }) => {
    // Get previous data
    let query = `select user_type, business_mode from ru_direct_selling_agents where dsa_id=?`;
    let bindParams = [dsa_id];
    let previousData = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    // Update user type
    query = `update ru_direct_selling_agents set user_type = ?, company_id = null ${user_type == "biller" ? `,business_mode = "biller"` : ` ,business_mode = "individual"`} where dsa_id=?`;
    bindParams = [user_type, dsa_id];
    let dsa = await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });

    // Remove company onboarding steps when company_id is set to null
    const companySteps = ['company_details', 'company_address', 'company_agreement'];
    for (const step of companySteps) {
        await _db2.query(
            `DELETE FROM ru_user_onboarding_steps WHERE dsa_id = ? AND step = ?`,
            { replacements: [dsa_id, step], type: QueryTypes.DELETE }
        );
    }

    // Get new data
    query = `select user_type, business_mode from ru_direct_selling_agents where dsa_id=?`;
    bindParams = [dsa_id];
    let newData = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    return { newData: newData[0], previousData: previousData[0] };
};

const getCibilInitiated = async (where) => {
    let query;

    query = `select count(*) as count from RuCibil.cibil_transactions r where r.status = 'Failure' ${where || ""} `;
    let totalFailed = await _db2.query(query, { type: QueryTypes.SELECT });

    query = `select count(*) as count from RuCibil.cibil_transactions r where r.status = 'Success' ${where || ""} `;
    let totalSuccess = await _db2.query(query, { type: QueryTypes.SELECT });

    query = `select count(*) as count from RuCibil.cibil_transactions r where r.status not in ('Failure', 'Success') ${where || ""} `;
    let totalPending = await _db2.query(query, { type: QueryTypes.SELECT });

    return { totalFailed: totalFailed[0]?.count, totalSuccess: totalSuccess[0]?.count, totalPending: totalPending[0]?.count };
};

const getCibilList = async (count_only, offset, limit, where) => {
    let query;

    query = ` select c.customer_id, cs.id, cs.dsa_id, c.full_name as customer_name, p.full_name as partner_name, bh.full_name as business_head_name, c.dsa_mobile_number, c.address_state as state, c.address_city as city, cs.mobile_number, cs.permanent_account_number, cs.email, cs.credit_score, cs.created_at, cs.updated_at, cs.last_checked_date_iso  from ru_credit_scores cs left join ru_customers c on cs.mobile_number = c.customer_mobile_number left join ru_direct_selling_agents p on c.dsa_mobile_number = p.dsa_mobile_number left join ru_direct_selling_agents bh on bh.dsa_mobile_number = p.business_head_code where service_provider="cibil" ${where} `;
    query += ` order by cs.last_checked_date_iso desc `;
    if (offset || limit) { query += ` limit ${offset}, ${limit} ` };

    let queryCount = ` select count(*) as count from ru_credit_scores cs left join ru_customers c on cs.mobile_number = c.customer_mobile_number left join ru_direct_selling_agents p on cs.dsa_mobile_number = p.dsa_mobile_number  left join ru_direct_selling_agents bh on bh.dsa_mobile_number = p.business_head_code where service_provider="cibil" ${where} `;

    let totalCount = [{ totalCount: limit }]
    let result = [];

    if (count_only) {
        totalCount = await _db2.query(queryCount, { type: QueryTypes.SELECT });
    } else {
        result = await _db2.query(query, { type: QueryTypes.SELECT });
    };

    return { records: result, totalCount: totalCount[0]?.count };
}

const getCibilDetail = async (id) => {
    let query = `select d.full_name as dsa_name, cs.report_url from ru_credit_scores cs left join ru_direct_selling_agents d on cs.dsa_id = d.dsa_id where service_provider="cibil" and cs.id=? `;
    let bindParams = [id];
    let result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return result;
}

const getLntReportLinkByDate = async (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const monthDate = `${year}-${month}`;
    let query = ` SELECT *
    FROM lnt_report_files
    WHERE DATE_FORMAT(date, '%Y-%m') = ?
    ORDER BY created_at DESC
    LIMIT 1`
    //  let query = 'select * from lnt_report_files where date = ? ';
    let bindParams = [monthDate];
    let links = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return links[0];
}

const getIncredReportLinkByDate = async (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const monthDate = `${year}-${month}`;
    let query = ` SELECT *
    FROM incred_report_files
    WHERE DATE_FORMAT(date, '%Y-%m') = ?
    ORDER BY created_at DESC
    LIMIT 1`
    let bindParams = [monthDate];
    let links = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return links[0];
}

const getFaircentReportLinkByDate = async (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const monthDate = `${year}-${month}`;
    let query = ` SELECT *
    FROM faircent_report_files
    WHERE DATE_FORMAT(date, '%Y-%m') = ?
    ORDER BY created_at DESC
    LIMIT 1`
    let bindParams = [monthDate];
    let links = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return links[0];
}

const getReportLinkByDate = async (type, date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const monthDate = `${year}-${month}`;
    let query = ` SELECT *
    FROM report_files
    WHERE DATE_FORMAT(date, '%Y-%m') = ?
    and type = ? ORDER BY created_at DESC
    LIMIT 1`
    //  let query = 'select * from lnt_report_files where date = ? ';
    let bindParams = [monthDate, type];
    let links = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return links[0];
}


/**
 * @service help to get ru_customer captured details
 */
const getCustomerCapturedDetails = async ({ pan }) => {
    let columns = [
        'dsa_mobile_number',
        'salutation',
        'full_name',
        'father_full_name',
        'mother_full_name',
        'customer_mobile_number',
        'is_mobile_number_verified',
        'email_address',
        'date_of_birth',
        'age',
        'gender',
        'permanent_account_number',
        'address_house_number',
        'address_building',
        'address_area',
        'address_city',
        'address_state',
        'address_pincode',
        'office_address_house_number',
        'office_address_building',
        'office_address_area',
        'office_address_city',
        'office_address_state',
        'office_address_pincode',
        'communication_address',
        'created_at',
        'updated_at'
    ];

    let query = `SELECT`;

    for (let i = 0; i < columns.length; i++) {
        query += ` IFNULL(${columns[i]}, '') AS ${columns[i]}`;

        if (i !== columns.length - 1) {
            query += ',';
        }
    }

    query += ` FROM ru_customers WHERE permanent_account_number = ?`;

    let bindParams = [pan];
    let details = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT, limit: 1 });
    return details;
};

const getSalesPersons = async (userId, allowedRoleNames, pageNumber, pageSize, search, disableHierachy) => {
    // Dynamic placeholders for allowedRoleNames
    const rolePlaceholders = allowedRoleNames.map((_, idx) => `:role${idx}`).join(', ');

    let bh = [];

    let query = `select bin_to_uuid(id) as id from users where sales_admin = "${userId}"`;
    bh = !disableHierachy ? await sequelize.query(query, { type: QueryTypes.SELECT }) : [];
    bh = bh.map((obj) => obj?.id);


    let hierarchy = !disableHierachy ? `WITH RECURSIVE user_tree AS (
        SELECT
          u.id,
          u.name,
          u.parent,
          u.phone,
          r.role,
          u.name AS hierarchy,  -- 👈 Start with root user's name
          CAST(bin_to_uuid(u.id) AS CHAR(1000)) AS path
        FROM CRMTest.users u
        INNER JOIN CRMTest.roles r ON u.role = r.id
        WHERE bin_to_uuid(u.id) in (:start_user_id)
  
        UNION ALL
  
        SELECT
          c.id,
          c.name,
          c.parent,
          c.phone,
          r.role,
          CONCAT(ut.hierarchy, ' => ', c.name) AS hierarchy,  -- 👈 Append child name to hierarchy path
          CONCAT(ut.path, ',', bin_to_uuid(c.id)) AS path
        FROM CRMTest.users c
        INNER JOIN user_tree ut ON c.parent = ut.id
        INNER JOIN CRMTest.roles r ON c.role = r.id
        WHERE c.status = 1 AND FIND_IN_SET(bin_to_uuid(c.id), ut.path) = 0
    )`
        :
        `WITH RECURSIVE user_tree AS (
      -- Base case: Start from root-level users (no parent)
      SELECT 
        u.id,
        u.name,
        u.phone,
        u.parent,
        u.name AS hierarchy,
        CAST(BIN_TO_UUID(u.id) AS CHAR(1000)) AS path,
        FALSE AS cycle_detected,
        r.role
      FROM CRMTest.users u
      INNER JOIN CRMTest.roles r ON u.role = r.id
      WHERE u.parent IS NULL
    
      UNION ALL
    
      -- Recursive case: Add children of previous level
      SELECT 
        c.id,
        c.name,
        c.phone,
        c.parent,
        CONCAT(ut.hierarchy, ' => ', c.name) AS hierarchy,
        CONCAT(ut.path, ',', BIN_TO_UUID(c.id)) AS path,
        FIND_IN_SET(BIN_TO_UUID(c.id), ut.path) > 0 AS cycle_detected,
        r.role
      FROM CRMTest.users c
      INNER JOIN CRMTest.roles r ON c.role = r.id
      JOIN user_tree ut ON c.parent = ut.id
      WHERE FIND_IN_SET(BIN_TO_UUID(c.id), ut.path) = 0 -- Prevent cycle
    )`;

    query = `
      ${hierarchy}
      SELECT
        bin_to_uuid(uh.id) AS id,
        uh.name,
        uh.phone,
        uh.role AS role_name,
         bin_to_uuid(uh.parent) as parent,
        uh.hierarchy
      FROM user_tree uh
      WHERE (
        uh.role IN (${rolePlaceholders})
      )
      ${search ? `AND uh.name LIKE LOWER(CONCAT('%', :search, '%'))` : ""}
      LIMIT :offset, :limit;
    `;

    const bindParams = {
        start_user_id: [...bh, userId],
        search: search?.trim() || null,
        limit: parseInt(pageSize),
        offset: (parseInt(pageNumber) - 1) * parseInt(pageSize),
    };

    // Bind each allowed role
    allowedRoleNames.forEach((role, idx) => {
        bindParams[`role${idx}`] = role;
    });

    const users = await _db2.query(query, {
        replacements: bindParams,
        type: QueryTypes.SELECT,
    });

    return users;
};

const getDsaApiTokens = async () => {
    let bindParams = [];
    let query = ` select api_token from ru_direct_selling_agents limit 0,10 `;
    let api_tokens = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let tokenArray = [];
    for (let i = 0; i < api_tokens.length; i++) {
        tokenArray.push(api_tokens[i].api_token);
    }
    return tokenArray;
}

const getAllPayoutRequest = async (offset, limit, where) => {
    let bindParams = [];
    let query = ` select rdc.netsuite_product_id, rdc.netsuite_bank_id, rdc.id, rdc.claim_month as claim_month , rdc.request_date_iso as date_of_claim,rdc.vendor_payout_amount as payout_amount,rdc.product_name as product,rdcsl.payout_status_description as payout_status,rdc.loan_reference_id as loan_number,d.full_name as dsa_name,rdc.bank_name as bank_name, rdc.customer_first_name as customer_first_name, rdc.customer_last_name as customer_last_name, CONCAT_WS(" ", rdc.customer_first_name, rdc.customer_last_name) as customer_full_name, rdc.disbursement_date_iso as disbursement_date_iso,rdc.disbursement_amount as  disbursement_amount from ru_direct_claims rdc inner join ru_direct_selling_agents d on  binary rdc.dsa_mobile_number = binary d.dsa_mobile_number inner join ru_dsa_claims_status_list rdcsl on binary rdc.payout_status_id = binary rdcsl.payout_status_id ${where || ""} order by rdc.created_at desc `;
    let queryCount = ` select count(rdc.id) as totalCount from ru_direct_claims rdc inner join ru_direct_selling_agents d on binary rdc.dsa_mobile_number = binary d.dsa_mobile_number ${where || ""} `;
    query += ` limit ${offset},${limit} `;
    let payout_request = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });

    return { payout_request, totalCount: totalCount[0].totalCount };
}

const getPayoutRequest = async (offset, limit, dsaMobile) => {
    let bindParams = [dsaMobile];
    let query = ` select rdc.id, rdc.claim_month as claim_month , rdc.request_date_iso as date_of_claim,rdc.vendor_payout_amount as payout_amount,rdc.product_name as product,rdcsl.payout_status_description as payout_status,rdc.loan_reference_id as loan_number,d.full_name as dsa_name,rdc.bank_name as bank_name, rdc.customer_first_name as customer_first_name, rdc.customer_last_name as customer_last_name, CONCAT_WS(" ", rdc.customer_first_name, rdc.customer_last_name) as customer_full_name, rdc.disbursement_date_iso as disbursement_date_iso,rdc.disbursement_amount as  disbursement_amount from ru_dsa_claims rdc left join ru_direct_selling_agents d on binary rdc.dsa_mobile_number = binary d.dsa_mobile_number left join ru_dsa_claims_status_list rdcsl on binary rdc.payout_status_id = binary rdcsl.payout_status_id where rdc.dsa_mobile_number = ? order by rdc.created_at desc `;
    let queryCount = ` select count(*) as totalCount from ru_dsa_claims rdc left join ru_direct_selling_agents d on binary rdc.dsa_mobile_number = binary d.dsa_mobile_number where rdc.dsa_mobile_number = ? `;
    query += ` limit ${offset},${limit} `;
    let payout_request = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });

    return { payout_request, totalCount: totalCount[0].totalCount };
}


const getDsaGlobalPayoutPercentageNew = async (dsa_id) => {
    let bindParams = [dsa_id];
    let selectQuery = ` select global_payouts_percentage from  ru_direct_selling_agents where dsa_id = ? `;
    let result = await _db2.query(selectQuery, { type: QueryTypes.SELECT, replacements: bindParams });
    return result[0];
};

// const updateDsaStatusByPhone = async (phone,status) => {
//     let bindParams = [status,phone];
//     let selectQuery = ` update ru_direct_selling_agents  set dsa_status = ? where dsa_mobile_number = ? `;
//     let result = await sequelize.query(selectQuery, { type: QueryTypes.UPDATE, replacements: bindParams });
// };

const getBusinessHeadRecursively = async (partner_code) => {
    let bindParams = [partner_code];
    let selectQuery = ` WITH RECURSIVE Ancestors AS (
        SELECT full_name, dsa_mobile_number, partner_code, email_address
        FROM RULoans.ru_direct_selling_agents
        WHERE dsa_mobile_number = ?
        
        UNION
        
        SELECT p.full_name, p.dsa_mobile_number, p.partner_code, p.email_address
        FROM RULoans.ru_direct_selling_agents p
        JOIN Ancestors a ON p.dsa_mobile_number = a.partner_code
    )
    SELECT * FROM Ancestors;
     `;
    let result = await _db2.query(selectQuery, { type: QueryTypes.SELECT, replacements: bindParams });
    let businessHead = result?.filter((obj) => obj?.partner_code == "9987884000")[0];
    return businessHead;
};
const updateBillerUniversal = async (biller_universal, dsa_id) => {

    const universal = biller_universal == true ? 1 : 0;
    const query = 'UPDATE ru_direct_selling_agents SET is_universal = ? WHERE dsa_id = ?'
    const result = await _db6.query(
        query,
        { type: QueryTypes.UPDATE, replacements: [universal, dsa_id] }
    );

    return result;
};



const getDsaKycData = async (dsa_id) => {
    let bindParams = [dsa_id];
    let basePath = 'https://ruloans-bucket.s3.ap-south-1.amazonaws.com/';
    let selectQuery = ` select d.company_name, case when k.company_gst_certificate_filename = "dsaDocuments/" then null else concat('${basePath}', k.company_gst_certificate_filename) end as company_gst_certificate_filename, case when k.display_picture_filename = "dsaDocuments/" then null else concat('${basePath}',k.display_picture_filename) end as display_picture_filename, case when k.address_proof_front_image_filename = "dsaDocuments/" then null else concat('${basePath}',k.address_proof_front_image_filename) end as address_proof_front_image_filename, case when k.address_proof_back_image_filename = "dsaDocuments/" then null else concat('${basePath}',k.address_proof_back_image_filename) end as address_proof_back_image_filename, case when k.pan_card_front_image_filename = "dsaDocuments/" then null else concat('${basePath}',k.pan_card_front_image_filename) end as pan_card_front_image_filename, permanent_account_number, address_proof_number, case when k.mou_filename = "dsaDocuments/" then null else concat('${basePath}', k.mou_filename) end as mou_filename from ru_dsa_kyc_data k left join ru_direct_selling_agents d on d.dsa_id = k.dsa_id where k.dsa_id = ? `;
    let result = await _db6.query(selectQuery, { type: QueryTypes.SELECT, replacements: bindParams });
    return result[0];
};

const getDsaKycDataExternal = async (dsa_id) => {
    let bindParams = [dsa_id];
    let basePath = 'https://ruloans-bucket.s3.ap-south-1.amazonaws.com/';
    let selectQuery = ` select d.company_name, case when k.company_gst_certificate_filename = "dsaDocuments/" then null else concat('${basePath}', k.company_gst_certificate_filename) end as company_gst_certificate_filename, case when k.display_picture_filename = "dsaDocuments/" then null else concat('${basePath}',k.display_picture_filename) end as display_picture_filename, case when k.address_proof_front_image_filename = "dsaDocuments/" then null else concat('${basePath}',k.address_proof_front_image_filename) end as address_proof_front_image_filename, case when k.address_proof_back_image_filename = "dsaDocuments/" then null else concat('${basePath}',k.address_proof_back_image_filename) end as address_proof_back_image_filename, case when k.pan_card_front_image_filename = "dsaDocuments/" then null else concat('${basePath}',k.pan_card_front_image_filename) end as pan_card_front_image_filename,case when k.mou_filename = "dsaDocuments/" then null else concat('${basePath}',k.mou_filename) end as mou_filename, permanent_account_number, address_proof_number from ru_dsa_kyc_data k left join ru_direct_selling_agents d on d.dsa_id = k.dsa_id where k.dsa_id = ? `;
    let result = await _db6.query(selectQuery, { type: QueryTypes.SELECT, replacements: bindParams });
    return result[0];
};

const updateDsaKycData = async (data) => {
    let { dsa_id, isKycExist, ...rest } = data;
    let bindParams = [];
    let query = ``;
    let keys = Object.keys(rest);

    let selectQuery = ` select full_name, dsa_mobile_number from ru_direct_selling_agents where dsa_id = '${dsa_id}' `;
    let dsaName = await _db6.query(selectQuery, { type: QueryTypes.SELECT, replacements: bindParams });

    if (!isKycExist) {
        let selectQuery = ` insert into ru_dsa_kyc_data (dsa_id, dsa_mobile_number) values (?,?) `;
        await _db6.query(selectQuery, { type: QueryTypes.UPDATE, replacements: [dsa_id, dsaName[0]?.dsa_mobile_number] });
    };

    rest["aadhaar_card_full_name"] = dsaName[0]?.full_name;

    for (i = 0; i < keys?.length; i++) {
        if (rest[keys[i]]) {
            query += ` ${keys[i]} = ? ${Boolean(i < keys.length - 1) ? "," : ""} `;
            bindParams.push(rest[keys[i]])
        }
    };

    selectQuery = ` update ru_dsa_kyc_data set ${query} where dsa_id = '${dsa_id}' `;
    let result = await _db6.query(selectQuery, { type: QueryTypes.UPDATE, replacements: bindParams });
};

const updateDsaSignUpSteps = async (dsaId, step) => {
    let bindParams = [step, dsaId];
    let selectQuery = ` update ru_direct_selling_agents set signup_steps_completed = ? where dsa_id = ? `;
    let result = await _db2.query(selectQuery, { type: QueryTypes.UPDATE, replacements: bindParams });
}

const updateBhExternal = async (data) => {
    const { dsa_mobile, business_head } = data;
    query = `update ru_direct_selling_agents set business_head_code = ? where dsa_mobile_number = ?`;
    bindParams = [business_head || null, dsa_mobile];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return;
};

const getNotificationUsers = async (where, offset, limit, childPhones, isCountOnly = true) => {

    let bindParams = [];
    let and = true;
    let query = ' SELECT c.firebase_token, c.dsa_mobile_number as dsa_mobile from ru_direct_selling_agents  c left join ru_dsa_kyc_data k on c.dsa_id= k.dsa_id left join ru_direct_selling_agents p on c.partner_code= p.dsa_mobile_number left join ru_direct_selling_agents bh on c.business_head_code = bh.dsa_mobile_number left join picklist_values pvs on c.dsa_status = pvs.id where LENGTH(c.firebase_token) > 0 ';
    let queryCount = ' select count(*) as count FROM ru_direct_selling_agents  c left join ru_dsa_kyc_data k on c.dsa_id= k.dsa_id left join ru_direct_selling_agents p on c.partner_code= p.dsa_mobile_number left join picklist_values pvs on c.dsa_status = pvs.id where LENGTH(c.firebase_token) > 0 ';

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
    if (childPhones) {
        if (and === false) {
            query += `  where c.dsa_mobile_number in (?) `;
            queryCount += `  where c.dsa_mobile_number in (?) `;
            bindParams.push(childPhones);
            and = true;
        } else {
            query += `  and c.dsa_mobile_number in (?) `;
            queryCount += `  and c.dsa_mobile_number in (?) `;
            bindParams.push(childPhones);
        }
    }

    query += `order by c.created_at desc  limit ${offset},${limit} `;

    let results = [];
    let totalCount = [{ count: 0 }];

    if (isCountOnly) {
        totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    } else {
        results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    };

    return { results, totalCount: totalCount[0].count || 0 };
    // We didn't need to destructure the result here - the results were returned directly
};

const getFibeDashboardByPhoneNumbers = async (phone, level, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, isCron = false) => {
    let bindParams = [];
    bindParams.push(phone);
    bindParams.push(phone)
    let query = `SELECT 
    CONCAT(REPEAT('-', 0),
            dsa_name,
            ' (',
            dsa_mobile_number,
            ')') AS dsa,
            dsa_mobile_number,
            dsa_id,
            partner_code,
            ${level ? "as level," : ""} 
            CAST(SUM(CASE WHEN status in ("error", "failure", "REJECTED") THEN 1 ELSE 0 END)  AS UNSIGNED) AS total_rejected,
            CAST(SUM(CASE WHEN status = 'LOAN_TAKEN' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_disbursed,
            CAST(SUM(CASE WHEN status = 'APPROVED'  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_approved,
            CAST(SUM(CASE WHEN status not in ("error", "failure", "REJECTED", "LOAN_TAKEN", "APPROVED") or status  is null THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_in_progress,
            CAST(SUM(CASE WHEN status = 'LOAN_TAKEN' THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_disbursed_amount,
            CAST(SUM(CASE WHEN status = 'APPROVED' THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_approved_amount
FROM
    dsa_application_view_fibe t1
WHERE `
    if (startDateFilter && endDateFilter) {
        if (isCron) {
            query += `month(disbursal_date) = month("${endDateFilter}") and `;
        } else {
            query += `DATE(disbursal_date)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
        }
    } else if (startDateFilter) {
        query += `DATE(disbursal_date) = DATE("${startDateFilter}") and `
    } else if (endDateFilter) {
        query += `DATE(disbursal_date) = DATE("${endDateFilter}") and `
    }

    if (startDateLoginFilter && endDateLoginFilter) {
        if (isCron) {
            query += `month(created_at) = month("${endDateLoginFilter}") and `;
        } else {
            query += `DATE(created_at)  between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
        }
    } else if (startDateLoginFilter) {
        query += `DATE(created_at) = DATE("${startDateLoginFilter}") and `
    } else if (endDateLoginFilter) {
        query += `DATE(created_at) = DATE("${endDateLoginFilter}") and `
    }

    if (!Boolean(startDateLoginFilter || startDateFilter)) {
        query += ` created_at is not null and `
    }

    query += ` dsa_mobile_number in (?) GROUP BY dsa_mobile_number
            ORDER BY total_disbursed DESC;`

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getFibeDashboardByPhoneNumbersV2 = async (phone, level, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, isCron = false) => {
    let bindParams = [];
    bindParams.push(phone);
    bindParams.push(phone)
    let query = ` SELECT 
    CONCAT(REPEAT('-', 0),
    dsa_name,
    ' (',
    dsa_mobile_number,
    ')') AS dsa,
    dsa_mobile_number,
    dsa_id,
    partner_code,
    ${level ? "as level," : ""} 
    CAST(SUM(CASE WHEN status in ("error", "failure", "REJECTED") THEN 1 ELSE 0 END)  AS UNSIGNED) AS total_rejected,
            CAST(SUM(CASE WHEN status = 'LOAN_TAKEN' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_disbursed,
            CAST(SUM(CASE WHEN status = 'APPROVED'  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_approved,
            CAST(SUM(CASE WHEN status not in ("error", "failure", "REJECTED", "LOAN_TAKEN", "APPROVED") or status  is null THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_in_progress,
            CAST(SUM(CASE WHEN status = 'LOAN_TAKEN' THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_disbursed_amount,
            CAST(SUM(CASE WHEN status = 'APPROVED' THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_approved_amount
FROM
    dsa_application_view_fibe t1
WHERE `;

    if (startDateFilter && endDateFilter) {
        if (isCron) {
            query += `month(t1.disbursal_date)  = month("${endDateFilter}") and `;
        } else {
            query += `DATE(t1.disbursal_date)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
        }
    };

    if (startDateLoginFilter && endDateLoginFilter) {
        if (isCron) {
            query += `month(t1.reated_at)  = month("${endDateLoginFilter}") and `;
        } else {
            query += `DATE(t1.created_at)  between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
        }
    };

    query += ` dsa_mobile_number in (
        WITH RECURSIVE DSAHierarchy AS (
            SELECT dsa_mobile_number, partner_code
            FROM ru_direct_selling_agents
            WHERE dsa_mobile_number = ?
            UNION ALL
            SELECT t.dsa_mobile_number, t.partner_code
            FROM ru_direct_selling_agents t
            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
        ) 
        SELECT dsa_mobile_number
        FROM DSAHierarchy
      ) GROUP BY dsa_mobile_number ORDER BY total_disbursed DESC `

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getPaysenseDashboardByPhoneNumbers = async (phone, level, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, isCron = false) => {
    let bindParams = [];
    bindParams.push(phone);
    bindParams.push(phone)
    let query = `SELECT 
    CONCAT(REPEAT('-', 0),
            dsa_name,
            ' (',
            dsa_mobile_number,
            ')') AS dsa,
            dsa_mobile_number,
            dsa_id,
            partner_code,
            ${level ? "as level," : ""} 
            CAST(SUM(CASE WHEN status  like '%reject%' THEN 1 ELSE 0 END)  AS UNSIGNED )  AS total_rejected,
            CAST(SUM(CASE WHEN status like '%disbursed%' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_disbursed,
            CAST(SUM(CASE WHEN status like '%approved%'  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_approved,
            CAST(SUM(CASE WHEN (status not like '%reject%' and status not like '%disbursed%' and status not like '%approved%') or status  is null THEN 1 ELSE 0 END) AS UNSIGNED ) AS total_in_progress,
            CAST(SUM(CASE WHEN status like '%disbursed%' THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_disbursed_amount,
            CAST(SUM(CASE WHEN status like '%approved%' THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_approved_amount
FROM
    dsa_application_view_paysense t1
WHERE `
    if (startDateFilter && endDateFilter) {
        if (isCron) {
            query += `month(disbursal_date) = month("${endDateFilter}") and `;
        } else {
            query += `DATE(disbursal_date)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
        }
    } else if (startDateFilter) {
        query += `DATE(disbursal_date) = DATE("${startDateFilter}") and `
    } else if (endDateFilter) {
        query += `DATE(disbursal_date) = DATE("${endDateFilter}") and `
    }

    if (startDateLoginFilter && endDateLoginFilter) {
        if (isCron) {
            query += `month(created_at) = month("${endDateLoginFilter}") and `;
        } else {
            query += `DATE(created_at)  between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
        }
    } else if (startDateLoginFilter) {
        query += `DATE(created_at) = DATE("${startDateLoginFilter}") and `
    } else if (endDateLoginFilter) {
        query += `DATE(created_at) = DATE("${endDateLoginFilter}") and `
    }

    if (!Boolean(startDateLoginFilter || startDateFilter)) {
        query += ` created_at is not null and `
    }

    query += ` dsa_mobile_number in (?) GROUP BY dsa_mobile_number
            ORDER BY total_disbursed DESC;`

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getPaysenseDashboardByPhoneNumbersV2 = async (phone, level, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, isCron = false) => {
    let bindParams = [];
    bindParams.push(phone);
    bindParams.push(phone)
    let query = ` SELECT 
    CONCAT(REPEAT('-', 0),
            dsa_name,
            ' (',
            dsa_mobile_number,
            ')') AS dsa,
            dsa_mobile_number,
            dsa_id,
            partner_code,
            ${level ? "as level," : ""} 
            CAST(SUM(CASE WHEN status  like '%reject%' THEN 1 ELSE 0 END)  AS UNSIGNED )  AS total_rejected,
            CAST(SUM(CASE WHEN status like '%disbursed%' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_disbursed,
            CAST(SUM(CASE WHEN status like '%approved%'  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_approved,
            CAST(SUM(CASE WHEN (status not like '%reject%' and status not like '%disbursed%' and status not like '%approved%') or status  is null THEN 1 ELSE 0 END) AS UNSIGNED ) AS total_in_progress,
            CAST(SUM(CASE WHEN status like '%disbursed%' THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_disbursed_amount,
            CAST(SUM(CASE WHEN status like '%approved%' THEN  loan_amount ELSE 0 END) AS UNSIGNED )  AS total_approved_amount
FROM
    dsa_application_view_paysense t1
WHERE `;

    if (startDateFilter && endDateFilter) {
        if (isCron) {
            query += `month(t1.disbursal_date)  = month("${endDateFilter}") and `;
        } else {
            query += `DATE(t1.disbursal_date)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
        }
    };

    if (startDateLoginFilter && endDateLoginFilter) {
        if (isCron) {
            query += `month(t1.reated_at)  = month("${endDateLoginFilter}") and `;
        } else {
            query += `DATE(t1.created_at)  between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
        }
    };

    query += ` dsa_mobile_number in (
        WITH RECURSIVE DSAHierarchy AS (
            SELECT dsa_mobile_number, partner_code
            FROM ru_direct_selling_agents
            WHERE dsa_mobile_number = ?
            UNION ALL
            SELECT t.dsa_mobile_number, t.partner_code
            FROM ru_direct_selling_agents t
            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
        ) 
        SELECT dsa_mobile_number
        FROM DSAHierarchy
      ) GROUP BY dsa_mobile_number ORDER BY total_disbursed DESC `

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getAllBajajApplications = async (count_only, where, search, offset, limit, childPhones, allow_masking) => {
    let bindParams = [];
    let exportQuery = allow_masking ? ` concat(left(rbpla.pan, 1), '*******', right(rbpla.pan, 2)) as pan, concat('*****', right(rbpla.mobile_number, 5)) as mobile_number, concat('*****', right(rbpla.dsa_mobile_number, 5)) as dsa_mobile_number ` : ` rbpla.pan, rbpla.mobile_number, rbpla.dsa_mobile_number `;
    let query = ` SELECT CASE WHEN custom_status = 0 THEN 'Pending' WHEN custom_status = 1 THEN 'Approved/Completed' WHEN custom_status = 2 THEN 'Rejected' WHEN custom_status = 3 THEN 'Dsibursed' end as status, rbpla.application_id, rbpla.lan,rbpla.requested_loan_amount, concat (rbpla.first_name, " ", rbpla.last_name) as full_name, rbpla.mobile_number, rbpla.salutation, rbpla.requested_tenor_in_months, rbpla.requested_tenor_in_months, rbpla.stage, rbpla.sub_stage, rbpla.disburse_amount, rbpla.disburse_date, rbpla.created_at, rbpla.updated_at, rbpla.partner_unique_id, rbpla.employment_type, rbpla.response_message, bh.full_name as business_head_name, c.full_name as dsa_name, ${exportQuery}, rbsp.sp_name as rm_name, rbsp.sp_mobile as rm_number from ru_bajaj_finance_personal_loan_applications rbpla left join ru_direct_selling_agents c on rbpla.dsa_mobile_number = c.dsa_mobile_number left join ru_direct_selling_agents bh on c.business_head_code = bh.dsa_mobile_number left join ru_branch_sales_people rbsp on rbpla.partner_sales_allocation_id = rbsp.sp_id `;
    let queryCount = ' SELECT  count(distinct rbpla.application_id) as totalCount from ru_bajaj_finance_personal_loan_applications rbpla ';
    let and = false;

    if (checkForMainTable(where, ["rbpla", "bh", "c", "rbsp"]) || search?.length) {
        queryCount += ` left join ru_direct_selling_agents c on rbpla.dsa_mobile_number = c.dsa_mobile_number left join ru_direct_selling_agents bh on c.business_head_code = bh.dsa_mobile_number left join ru_branch_sales_people rbsp on rbpla.partner_sales_allocation_id = rbsp.sp_id `;
    };

    if (childPhones) {
        query += ` ${and === false ? "where" : "and"} rbpla.dsa_mobile_number in (
                WITH RECURSIVE DSAHierarchy AS (
                    SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
                    UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) `;
        queryCount += ` ${and === false ? "where" : "and"} rbpla.dsa_mobile_number in (
                WITH RECURSIVE DSAHierarchy AS (
                    SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
                    UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) `;
        bindParams.push(childPhones);
        and = true;
    };

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
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += ` group by rbpla.application_id order by rbpla.created_at desc limit ${offset},${limit} `;
    let totalCount = [{ totalCount: limit }]
    let lntApplications = [];

    if (count_only) {
        totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    } else {
        lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    };
    return { lntApplications: lntApplications, totalCount: totalCount[0].totalCount };
}

const getAllIncredApplications = async (where, search, offset, limit, childPhones, allow_masking) => {
    let bindParams = [];
    let exportQuery = allow_masking ? ` concat(left(ripla.pan, 1), '*******', right(ripla.pan, 2)) as pan, concat('*****', right(ripla.mobile, 5)) as mobile, concat('*****', right(ripla.dsa_mobile_number, 5)) as dsa_mobile_number ` : ` ripla.pan, ripla.mobile, ripla.dsa_mobile_number `;
    let query = ` SELECT ripla.application_id, concat(ripla.fname, " ", ripla.lname) as full_name, ripla.email, ripla.incred_application_id, ripla.emp_monthly_salary, ripla.employment_type, ripla.bank_account_holder_name, ripla.bank_account_number, ripla.bank_account_type, ripla.ifsc_code, ripla.loan_amount, ripla.max_loan_tenure, ripla.reason, ripla.stage, ripla.sub_stage, ripla.status, ripla.disburse_amount, ripla.disburse_date, ripla.created_at, ripla.updated_at, bh.full_name as business_head_name, c.full_name as dsa_name, ${exportQuery} from ru_incred_personal_loan_applications ripla left join ru_direct_selling_agents c on ripla.dsa_mobile_number = c.dsa_mobile_number left join ru_direct_selling_agents bh on c.business_head_code = bh.dsa_mobile_number `;
    let queryCount = ' SELECT  count(*) as totalCount from ru_incred_personal_loan_applications ripla ';
    let and = false;

    if (checkForMainTable(where, ["ripla", "bh", "c"]) || search?.length) {
        queryCount += ` left join ru_direct_selling_agents c on ripla.dsa_mobile_number = c.dsa_mobile_number left join ru_direct_selling_agents bh on c.business_head_code = bh.dsa_mobile_number `;
    };

    // if (loggedInUser) {
    //     query += ` where rifl.assigned_to = '${loggedInUser}' `;
    //     queryCount += ` where rifl.assigned_to = '${loggedInUser}' `;
    //     and = true;
    // }

    if (childPhones) {
        query += ` ${and === false ? "where" : "and"} ripla.dsa_mobile_number in (
                WITH RECURSIVE DSAHierarchy AS (
                    SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
                    UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) `;
        queryCount += ` ${and === false ? "where" : "and"} ripla.dsa_mobile_number in (
                WITH RECURSIVE DSAHierarchy AS (
                    SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
                    UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) `;
        bindParams.push(childPhones);
        and = true;
    };

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
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += ` order by ripla.created_at desc limit ${offset},${limit}  `;
    const totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    const lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return { lntApplications: lntApplications, totalCount: totalCount[0].totalCount };
};

const getAllCreditSaisonApplications = async (where, search, offset, limit, childPhones, allow_masking) => {
    let bindParams = [];
    let exportQuery = allow_masking ? ` concat(left(rcspla.pan, 1), '*******', right(rcspla.pan, 2)) as pan, concat('*****', right(rcspla.phone_number, 5)) as phone_number, concat('*****', right(rcspla.dsa_mobile_number, 5)) as dsa_mobile_number ` : ` rcspla.pan, rcspla.phone_number, rcspla.dsa_mobile_number `;
    let query = ` SELECT rcspla.application_id, concat(rcspla.first_name, " ", rcspla.last_name) as full_name, rcspla.pan, rcspla.employment_type, rcspla.application_status, rcspla.stage, rcspla.sub_stage, rcspla.disburse_amount, rcspla.disburse_date, rcspla.created_at, rcspla.updated_at, rcspla.reason, bh.full_name as business_head_name, c.full_name as dsa_name, ${exportQuery} from ru_credit_saison_personal_loan_applications rcspla left join ru_direct_selling_agents c on rcspla.dsa_mobile_number = c.dsa_mobile_number left join ru_direct_selling_agents bh on c.business_head_code = bh.dsa_mobile_number `;
    let queryCount = ' SELECT  count(*) as totalCount from ru_credit_saison_personal_loan_applications rcspla left join ru_direct_selling_agents c on rcspla.dsa_mobile_number = c.dsa_mobile_number left join ru_direct_selling_agents bh on c.business_head_code = bh.dsa_mobile_number ';
    let and = false;

    // if (loggedInUser) {
    //     query += ` where rifl.assigned_to = '${loggedInUser}' `;
    //     queryCount += ` where rifl.assigned_to = '${loggedInUser}' `;
    //     and = true;
    // }

    if (childPhones) {
        query += ` ${and === false ? "where" : "and"} rcspla.dsa_mobile_number in (
                WITH RECURSIVE DSAHierarchy AS (
                    SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
                    UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) `;
        queryCount += ` ${and === false ? "where" : "and"} rcspla.dsa_mobile_number in (
                WITH RECURSIVE DSAHierarchy AS (
                    SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
                    UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) `;
        bindParams.push(childPhones);
        and = true;
    };

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
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += ` order by rcspla.created_at desc limit ${offset},${limit}  `;
    const totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    const lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return { lntApplications: lntApplications, totalCount: totalCount[0].totalCount };
};

const getAllPiramalApplications = async (count_only, where, search, offset, limit, childPhones, allow_masking) => {
    let bindParams = [];
    let exportQuery = allow_masking ? ` concat(left(rphla.pan, 1), '*******', right(rphla.pan, 2)) as pan, concat('*****', right(rphla.mobile_number, 5)) as mobile_number, concat('*****', right(rphla.dsa_mobile_number, 5)) as dsa_mobile_number ` : ` rphla.pan, rphla.mobile_number, rphla.dsa_mobile_number `;
    let query = ` SELECT sp.sp_name, sp.sp_mobile, rphla.lead_id, rphla.application_id, rphla.occupation_type, rphla.branch_name, rphla.branch_code, concat(rphla.first_name, " ", rphla.last_name) as full_name, rphla.email, rphla.requested_amount, rphla.requested_tenure, rphla.lead_status as stage, rphla.reject_reason, rphla.status as lead_status, rphla.risk_decision_type as sub_stage, rphla.disburse_amount, rphla.disburse_date, rphla.created_at, rphla.updated_at, bh.full_name as business_head_name, c.full_name as dsa_name, ${exportQuery} from ru_piramal_home_loan_applications rphla left join ru_direct_selling_agents c on rphla.dsa_mobile_number = c.dsa_mobile_number left join ru_direct_selling_agents bh on c.business_head_code = bh.dsa_mobile_number left join ru_branch_sales_people sp on sp.id = rphla.sales_person_id  `;
    let queryCount = ' SELECT  count(*) as totalCount from ru_piramal_home_loan_applications rphla ';
    let and = false;

    if (checkForMainTable(where, ["rphla", "c", "bh", "sp"]) || search?.length) {
        queryCount += ` left join ru_direct_selling_agents c on rphla.dsa_mobile_number = c.dsa_mobile_number left join ru_direct_selling_agents bh on c.business_head_code = bh.dsa_mobile_number left join ru_branch_sales_people sp on sp.id = rphla.sales_person_id `;
    };

    // if (loggedInUser) {
    //     query += ` where rifl.assigned_to = '${loggedInUser}' `;
    //     queryCount += ` where rifl.assigned_to = '${loggedInUser}' `;
    //     and = true;
    // }

    if (childPhones) {
        query += ` ${and === false ? "where" : "and"} rphla.dsa_mobile_number in (
                WITH RECURSIVE DSAHierarchy AS (
                    SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
                    UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) `;
        queryCount += ` ${and === false ? "where" : "and"} rphla.dsa_mobile_number in (
                WITH RECURSIVE DSAHierarchy AS (
                    SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
                    UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) `;
        bindParams.push(childPhones);
        and = true;
    };

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
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += ` order by rphla.created_at desc limit ${offset},${limit}  `;
    let totalCount = [{ totalCount: limit }]
    let lntApplications = [];

    if (count_only) {
        totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    } else {
        lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    };
    return { lntApplications: lntApplications, totalCount: totalCount[0].totalCount };
};

const getAllCreditVidyaApplications = async (count_only, where, search, offset, limit, childPhones, allow_masking, is_export) => {
    let bindParams = [];
    let exportQuery = allow_masking ? ` concat(left(rcvpla.pan, 1), '*******', right(rcvpla.pan, 2)) as pan, concat('*****', right(rcvpla.mobile_number, 5)) as mobile_number, concat('*****', right(rcvpla.dsa_mobile_number, 5)) as dsa_mobile_number ` : ` rcvpla.pan, rcvpla.mobile_number, rcvpla.dsa_mobile_number `;
    let query = ` SELECT CASE WHEN custom_status = 0 THEN 'Pending' WHEN custom_status = 1 THEN 'Approved/Completed' WHEN custom_status = 2 THEN 'Rejected' WHEN custom_status = 3 THEN 'Disbursed' end as status, rcvpla.application_id, concat(rcvpla.first_name, " ", rcvpla.last_name) as full_name, rcvpla.employment_type, rcvpla.desired_loan_amount, rcvpla.reject_reason, rcvpla.desired_loan_amount as loan_amount, rcvpla.stage, rcvpla.sub_stage, rcvpla.loan_amount as disburse_amount, rcvpla.disburse_date, rcvpla.created_at, rcvpla.updated_at, bh.full_name as business_head_name, c.full_name as dsa_name, ${exportQuery} from ru_credit_vidya_personal_loan_applications rcvpla left join ru_direct_selling_agents c on rcvpla.dsa_mobile_number = c.dsa_mobile_number left join ru_direct_selling_agents bh on c.business_head_code = bh.dsa_mobile_number `;
    let queryCount = ' SELECT  count(*) as totalCount from ru_credit_vidya_personal_loan_applications rcvpla ';
    let and = false;

    if (checkForMainTable(where, ["rcvpla", "bh", "c"]) || search?.length) {
        queryCount += ` left join ru_direct_selling_agents c on rcvpla.dsa_mobile_number = c.dsa_mobile_number left join ru_direct_selling_agents bh on c.business_head_code = bh.dsa_mobile_number `;
    };

    // if (loggedInUser) {
    //     query += ` where rifl.assigned_to = '${loggedInUser}' `;
    //     queryCount += ` where rifl.assigned_to = '${loggedInUser}' `;
    //     and = true;
    // }

    if (childPhones) {
        query += ` ${and === false ? "where" : "and"} rcvpla.dsa_mobile_number in (
                WITH RECURSIVE DSAHierarchy AS (
                    SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
                    UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) `;
        queryCount += ` ${and === false ? "where" : "and"} rcvpla.dsa_mobile_number in (
                WITH RECURSIVE DSAHierarchy AS (
                    SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
                    UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) `;
        bindParams.push(childPhones);
        and = true;
    };

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
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += ` order by rcvpla.created_at desc   `;
    if (is_export) {
        return { query, queryCount, bindParams };
    };
    query += `  limit ${offset},${limit}  `;
    let totalCount = [{ totalCount: limit }]
    let lntApplications = [];

    if (count_only) {
        totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    } else {
        lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    };
    return { lntApplications: lntApplications, totalCount: totalCount[0].totalCount };
};

const getStageFilterList = async (where, columns) => {
    let query = ` select distinct ${columns} from ${where} `
    let list = await _db2.query(query, { type: QueryTypes.SELECT });
    let stage = [];
    let sub_stage = [];
    let status = [];
    if (list?.length) {
        for (i = 0; i < list?.length; i++) {
            if (list[i]?.stage?.length && !stage.includes(list[i]?.stage)) {
                stage.push(list[i]?.stage);
            }
            if (list[i]?.sub_stage?.length && !sub_stage.includes(list[i]?.sub_stage)) {
                sub_stage.push(list[i]?.sub_stage);
            }
            if (list[i]?.status?.length && !status.includes(list[i]?.status)) {
                status.push(list[i]?.status);
            }
        }
    }
    return { stage, sub_stage, status };
};

const saveOtp = async (otp, mobile, type) => {
    let query = ` insert into otp_logs(otp,mobile,otp_type) values(?,?,?) `;
    await sequelize.query(query, { replacements: [otp, mobile, type], type: QueryTypes.INSERT });
};
const getOtp = async (mobile, type) => {
    let query = ` select * from  otp_logs where mobile = ? and otp_type = ?  and is_used = false order by id desc  `;
    let otps = await sequelize.query(query, { replacements: [mobile, type], type: QueryTypes.SELECT });
    return otps[0];
};
const getDsaMobileByEmail = async (email) => {
    let query = ` select dsa_id, dsa_mobile_number, full_name from ru_direct_selling_agents where email_address = ? limit 1 `;
    let result = await _db2.query(query, { replacements: [email], type: QueryTypes.SELECT });
    return result[0] || null;
};

const saveOtpDb2 = async (otp, mobile, type) => {
    // Check if a record already exists with the same mobile_number and otp_type
    const queryCheck = `
        SELECT id, is_otp_used 
        FROM ru_otp_logs 
        WHERE mobile_number = ? AND otp_type = ?
    `;
    const existingRecord = await _db2.query(queryCheck, {
        replacements: [mobile, type],
        type: QueryTypes.SELECT,
    });

    if (existingRecord.length > 0) {

        const record = existingRecord[0];
        const queryUpdate = `
            UPDATE ru_otp_logs 
            SET otp = ?, updated_at = NOW(), is_otp_used = CASE WHEN is_otp_used = '1' THEN '0' ELSE is_otp_used END
            WHERE id = ?
        `;
        await _db2.query(queryUpdate, {
            replacements: [otp, record.id],
            type: QueryTypes.UPDATE,
        });
    } else {

        const queryInsert = `
            INSERT INTO ru_otp_logs (otp, mobile_number, otp_type, is_otp_used, created_at, updated_at) 
            VALUES (?, ?, ?, '0', NOW(), NOW())
        `;
        await _db2.query(queryInsert, {
            replacements: [otp, mobile, type],
            type: QueryTypes.INSERT,
        });
    }
};
const getOtpDb2 = async (mobile, type) => {
    let query = ` select * from  ru_otp_logs where mobile_number = ? and otp_type = ? and is_otp_used = false order by id desc  `;
    let otps = await _db2.query(query, { replacements: [mobile, type], type: QueryTypes.SELECT });
    return otps[0];
};



const verifyOtpById = async (id) => {
    let query = ` update otp_logs set is_used = true where id = ? `;
    await sequelize.query(query, { replacements: [id], type: QueryTypes.UPDATE });
};

const verifyOtpByIdDb2 = async (id) => {
    let query = ` update ru_otp_logs set is_otp_used = true where id = ? `;
    await _db2.query(query, { replacements: [id], type: QueryTypes.UPDATE });
};
const checkIfMobileNumberIsValid = async (customer_id) => {
    let query = ` select customer_mobile_number from ru_customers where customer_id = ? `;
    let customer = await _db2.query(query, { replacements: [customer_id], type: QueryTypes.SELECT });
    return customer[0];
};
const getBHVendors = async (phone) => {
    let query = ` select dsa_kyc.permanent_account_number as pan,dsa.dsa_mobile_number as dsa_mobile_number,dsa.dsa_id as dsa_id , dsa_kyc.ns_hierarchy as ns_hierarchy, dsa.is_blacklisted , dsa.is_deleted , dsa.business_head_code, p.dsa_id as partner_id , dsa_kyc.class_id , dsa.materialized_path , dsa.hierarchy_crm from ru_direct_selling_agents dsa left join ru_dsa_kyc_data dsa_kyc on dsa.dsa_id = dsa_kyc.dsa_id left join ru_direct_selling_agents p on dsa.partner_code = p.dsa_mobile_number where dsa.business_head_code = ?  or dsa.dsa_mobile_number = ? `;
    return await _db2.query(query, { replacements: [phone, phone], type: QueryTypes.SELECT });
};


// lookup: { bank_product_combinations_id } (UUID) or { bank_id, product_id }
const getDsaPayoutAutonomousByBankProduct = async (dsa_id, lookup = {}, disb_date = null) => {
    const { bank_id, product_id, bank_product_combinations_id } = lookup;
    let whereClause;
    let bindParams;
    if (bank_product_combinations_id) {
        whereClause = `rdp.dsa_id = ? AND rdp.bank_product_combinations_id = ? AND bpc.status = 1`;
        bindParams = [dsa_id, bank_product_combinations_id];
    } else if (bank_id != null && bank_id !== '' && product_id != null && product_id !== '') {
        whereClause = `rdp.dsa_id = ? AND bpc.bank_id = ? AND bpc.product_id = ? AND bpc.status = 1`;
        bindParams = [dsa_id, bank_id, product_id];
    } else {
        return null;
    }

    const detailLateralJoin = disb_date
        ? `LEFT JOIN LATERAL (
            SELECT d1.avg_achievment
            FROM ru_bank_product_combination_details d1
            WHERE d1.bank_product_combinations_id = bpc.bank_product_combinations_id
              AND (d1.applicable_from IS NULL OR d1.applicable_from <= ?)
              AND (d1.applicable_till IS NULL OR d1.applicable_till >= ?)
            ORDER BY d1.applicable_from DESC, d1.id DESC
            LIMIT 1
          ) d ON true`
        : `LEFT JOIN LATERAL (
            SELECT d1.avg_achievment
            FROM ru_bank_product_combination_details d1
            WHERE d1.bank_product_combinations_id = bpc.bank_product_combinations_id
            ORDER BY d1.created_at DESC, d1.id DESC
            LIMIT 1
          ) d ON true`;

    const query = `
        SELECT rdp.autonomous_rate, rdp.autonomous_ratio, rdp.disb_date_from, rdp.disb_date_to, d.avg_achievment
        FROM ru_dsa_payouts rdp
        INNER JOIN ru_bank_product_combinations bpc
            ON rdp.bank_product_combinations_id = BIN_TO_UUID(bpc.bank_product_combinations_id)
        ${detailLateralJoin}
        WHERE ${whereClause}
        LIMIT 1
        `;
    const replacements = disb_date ? [disb_date, disb_date, ...bindParams] : bindParams;

    const rows = await _db2.query(query, {
        replacements,
        type: QueryTypes.SELECT,
    });
    return rows[0] || null;
};

const setLeadPayoutRateOrRatio = async (
    id,
    payout_type,
    payout_rate,
    payout_ratio,
    payout_collide,
    payout_collide_value,
    disbursement_amount,
    avg_achievment,
    same_day_billing = 0,
    to_be_billed = 0,
    key = 'id'
) => {
    let query = `UPDATE ru_fresh_lead_claims SET payout_collide = ?, payout_collide_value = ? ,  same_day_billing = ? , to_be_billed = ? `;
    let bindParams = [payout_collide, payout_collide_value, same_day_billing, to_be_billed];

    let vendor_payout_rate = null;
    let vendor_payout_ratio = null;

    if (payout_type?.toLowerCase() === "ratio") {
        vendor_payout_ratio = payout_ratio;
        query += `, vendor_payout_ratio = ?, vendor_payout_rate = NULL , vendor_payout_type = 'ratio'`;
        bindParams.push(vendor_payout_ratio);
    } else {
        vendor_payout_rate = payout_rate;
        query += `, vendor_payout_rate = ?, vendor_payout_ratio = NULL , vendor_payout_type = 'rate'`;
        bindParams.push(vendor_payout_rate);
    }

    let vendor_payout_amount = null;
    //if (!payout_collide) {
    if (payout_type?.toLowerCase() === "ratio" && payout_ratio) {
        vendor_payout_amount = (disbursement_amount * (payout_ratio * avg_achievment / 100)) / 100;
    } else if (payout_type?.toLowerCase() === "rate" && payout_rate) {
        vendor_payout_amount = (disbursement_amount * payout_rate) / 100;
    }
    //}

    query += `, vendor_payout_amount = ? WHERE ${key} = ?`;
    bindParams.push(vendor_payout_amount, id);

    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
}



const getAllDsaLeads = async (dsa_id) => {
    let bindParams = [dsa_id];
    let query = ` select * from ru_dsa_leads where dsa_id = ? ORDER BY created_at DESC`;
    let queryCount = ` select count(*) as count from ru_dsa_leads where dsa_id = ? `;

    const records = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    const totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });

    return { records, totalCount: totalCount[0]?.count };
};

const getLeadClaimUpdateLogs = async (offset, limit, id, fields = null) => {
    let bindParams = [id];
    let fieldCondition = '';
    if (Array.isArray(fields) && fields.length > 0) {
        const placeholders = fields.map(() => '?').join(',');
        fieldCondition = ` and al.field in (${placeholders}) `;
        bindParams = [id, ...fields];
    }
    let query = ` select al.*,u.name,u.email,u.phone from application_logs  al left join users u on al.updated_by = u.id  where al.application_id = ? and application_type = 'lead_claim_update' ${fieldCondition} order by al.createdAt desc `;
    let countQuery = ` select count(*) as totalCount from application_logs  al left join users u on al.updated_by = u.id  where al.application_id = ? and application_type = 'lead_claim_update' ${fieldCondition} `;
    if (offset || limit) query += ` limit ${offset},${limit} `;
    const records = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    const totalCount = await sequelize.query(countQuery, { replacements: bindParams, type: QueryTypes.SELECT });
    return { records, totalCount: totalCount[0].totalCount };
};

const getLeadClaimUploadLogs = async (phones, offset, limit, loggedInUser, where, isExternal = false) => {
    let bindParams = [phones];
    let query;
    let countQuery;
    const logTypeCase = `case when application_type = 'lead_claim_upload' then "Upload" else "Delete" end as log_type`;
    const baseWhere = `((application_type = 'lead_claim_upload' and field is not null) or application_type = 'lead_claim_delete')`;
    if (!phones) {
        if (isExternal) {
            query = ` select al.*, TRIM(LEADING '0' FROM LOWER(HEX(al.updated_by))) as updated_by, d.full_name as name, d.email_address as email, d.dsa_mobile_number as phone, ${logTypeCase} from application_logs al left join RULoans.ru_direct_selling_agents d on TRIM(LEADING '0' FROM LOWER(HEX(al.updated_by))) = LOWER(REPLACE(d.dsa_id,'-','')) where ${baseWhere} and al.is_external = 1 and TRIM(LEADING '0' FROM LOWER(HEX(al.updated_by))) = LOWER(REPLACE('${loggedInUser.id}','-','')) ${where ? ' and ' + where : ''} `;
            countQuery = ` select count(*) as totalCount from application_logs al left join RULoans.ru_direct_selling_agents d on TRIM(LEADING '0' FROM LOWER(HEX(al.updated_by))) = LOWER(REPLACE(d.dsa_id,'-','')) where ${baseWhere} and al.is_external = 1 and TRIM(LEADING '0' FROM LOWER(HEX(al.updated_by))) = LOWER(REPLACE('${loggedInUser.id}','-','')) ${where ? ' and ' + where : ''} `;
        } else {
            query = ` select al.*, u.name, u.email, u.phone, ${logTypeCase} from application_logs al left join users u on al.updated_by = u.id where ${baseWhere} and al.is_external = 0 and bin_to_uuid(updated_by) = '${loggedInUser.id}' ${where ? ' and ' + where : ''} `;
            countQuery = ` select count(*) as totalCount from application_logs al left join users u on al.updated_by = u.id where ${baseWhere} and al.is_external = 0 and bin_to_uuid(updated_by) = '${loggedInUser.id}' ${where ? ' and ' + where : ''} `;
        }
        query += ` order by al.id desc `
        if (offset || limit) query += ` limit ${offset},${limit} `;
    } else {
        let userQuery = `WITH RECURSIVE CRMHierarchy AS (
                SELECT 
                    id,
                    phone
                FROM users
                WHERE phone = ?

                UNION ALL

                SELECT 
                    t.id,
                    t.phone
                FROM users t
                INNER JOIN CRMHierarchy ch 
                    ON t.parent = ch.id
            )

            SELECT 
                BIN_TO_UUID(id) AS id
            FROM CRMHierarchy`;
        users = await sequelize.query(userQuery, { replacements: [phones], type: QueryTypes.SELECT });
        let ids = [];
        for (let i = 0; i < users.length; i++) {
            ids.push(users[i].id)
        }
        bindParams = [ids];
        query = ` select al.*,u.name,u.email,u.phone, case when application_type = 'lead_claim_upload' then "Upload" else "Delete" end as log_type from application_logs  al left join users u on al.updated_by = u.id  where  ((application_type = 'lead_claim_upload' and field is not null) or  application_type = 'lead_claim_delete') and bin_to_uuid(updated_by) in (?) ${where ? ' and ' + where : ''} `;
        query += ` order by al.id desc `
        if (offset || limit) query += ` limit ${offset},${limit} `;
        countQuery = ` select count(*) as totalCount from application_logs  al left join users u on al.updated_by = u.id    where  ((application_type = 'lead_claim_upload' and field is not null) or  application_type = 'lead_claim_delete') and bin_to_uuid(updated_by) in (?) ${where ? ' and ' + where : ''}`;
    }
    const records = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    const totalCount = await sequelize.query(countQuery, { replacements: bindParams, type: QueryTypes.SELECT });
    return { records, totalCount: totalCount[0].totalCount };
};

const getDsaUploadLogs = async (childPhones, offset, limit, application_type, where) => {
    let match = application_type == "cc_mis_update" ? ` al.application_type like '%${application_type}%' ` : ` al.application_type = '${application_type}' `;
    let query = ` select al.*,u.name,u.email,u.phone, case when ${match} then "Upload" else "Delete" end as log_type from application_logs  al left join users u on al.updated_by = u.id  where ${match} ${where ? ' and ' + where : ''}`;
    let countQuery = ` select count(*) as totalCount from application_logs  al left join users u on al.updated_by = u.id  where ${match} ${where ? ' and ' + where : ''}`;
    if (childPhones) {
        query += ` and u.phone in (${childPhones}) `;
        countQuery += ` and u.phone in (${childPhones}) `;
    };
    query += ` order by al.id desc `
    if (offset || limit) query += ` limit ${offset},${limit} `;
    const records = await sequelize.query(query, { type: QueryTypes.SELECT });
    const totalCount = await sequelize.query(countQuery, { type: QueryTypes.SELECT });
    return { records, totalCount: totalCount[0].totalCount };
};


const deleteLeadFormData = async (id, userId, status, isExternal = false) => {
    let bindParams = [id];
    let query = ` update ru_fresh_lead_claims set is_deleted = ${status} where fresh_lead_id in (?) `;
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });

    query = ` select flc.id, flc.city, flc.leader_name, flc.payout_collide, ROUND(flc.payout_collide_value, 2) as payout_collide_value, flc.fresh_lead_id, flc.request_date, flc.request_date_iso, flc.fresh_lead_status_id, flc.product_name, flc.claim_month, flc.loan_reference_id, flc.loan_reference_id_type, flc.loan_apac_ref_los_number, flc.bank_name, flc.customer_full_name, flc.customer_first_name, flc.customer_middle_name, flc.customer_last_name, flc.customer_company_name, flc.dsa_mobile_number, flc.disbursement_date, flc.disbursement_date_iso, flc.disbursement_amount, flc.city, ROUND(flc.vendor_payout_rate, 2) as vendor_payout_rate, flc.vendor_payout_ratio, ROUND(flc.vendor_payout_amount, 2) as vendor_payout_amount, flc.max_upfront_payout_percentage, flc.max_vendor_payout_percentage, flc.created_at, flc.updated_at, d.full_name as dsa_name from ru_fresh_lead_claims flc left join ru_direct_selling_agents d on d.dsa_mobile_number = flc.dsa_mobile_number where fresh_lead_id in (?) `;
    let leadForms = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    const updatedByPlaceholder = isExternal ? "UNHEX(LPAD(REPLACE(?,'-',''),32,'0'))" : 'uuid_to_bin(?)';
    const externalLogColumns = isExternal ? ', is_external' : '';
    const externalLogValues = isExternal ? ', 1' : '';

    if (status == 1) {
        let file = await uploadArrayToS3(leadForms, "lead_claim_deleted");
        query = ` insert into application_logs (application_type,field,from_value,to_value,updated_by${externalLogColumns}) values ('lead_claim_delete',?,?,?,${updatedByPlaceholder}${externalLogValues}) `;
        await sequelize.query(query, { replacements: [file, id?.length, id?.length, userId], type: QueryTypes.INSERT });
    };

    let from_value = status == 1 ? 'No' : 'Yes';
    let to_value = status == 1 ? 'Yes' : 'No';
    bindParams = [];
    for (let i = 0; i < leadForms?.length; i++) {
        if (i == 0) {
            query = ` insert into application_logs (application_type, application_id, field, from_value, to_value, updated_by${externalLogColumns}) values ('lead_claim_update', ?, 'is_deleted', ?, ?, ${updatedByPlaceholder}${externalLogValues}) `;
        }
        else {
            query += `, ('lead_claim_update', ?, 'is_deleted', ?, ?, ${updatedByPlaceholder}${externalLogValues}) `;
        }
        bindParams = bindParams.concat([leadForms[i]?.id, from_value, to_value, userId]);
    };
    if (leadForms?.length) {
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }
    return true;
};

const moveToPendingLeadForm = async (id, userId, vendor_remark, banker_file_processed) => {
    //Id can be an array of ids or a single id
    //we need to check whether the fresh lead of the particular id have apac_ref_los_number and loan_number both
    //If not then we need to remove that ID from the array of ids
    let validIds = [];
    for (let freshLeadId of id) {
        const checkQuery = `SELECT loan_apac_ref_los_number, loan_reference_id, claim_confirmation FROM ru_fresh_lead_claims WHERE fresh_lead_id = ?`;
        const result = await _db2.query(checkQuery, { replacements: [freshLeadId], type: QueryTypes.SELECT });

        if (result.length > 0) {
            const { loan_apac_ref_los_number, loan_reference_id, claim_confirmation } = result[0];
            const hasValue = (v) => String(v ?? '').trim() !== '';
            // Only add to validIds if both fields are present and non-blank after trim
            if (hasValue(loan_apac_ref_los_number) && hasValue(loan_reference_id)) {
                validIds.push(freshLeadId);
            }
        }
    }
    const buildErrorMsg = `leads without apac/ref/los number and loan number are not moved to pending`;

    if (validIds.length == 0) {
        return { status: false, errorMsg: buildErrorMsg, code: 401 }
    }
    let updateBindParams = [validIds];
    let setClause = ' fresh_lead_status_id = 0 ';
    if (vendor_remark !== undefined && vendor_remark !== null) {
        setClause += ' , vendor_remark = ? ';
        updateBindParams = [vendor_remark, validIds];
    }
    if (banker_file_processed === true) {
        setClause += ' , is_banker_file_processed = 1 ';
    }
    let query = ` update ru_fresh_lead_claims set ${setClause} where fresh_lead_id in (?) `;
    const data = await _db2.query(query, { replacements: updateBindParams, type: QueryTypes.UPDATE });

    await syncMetaOnStatusZero(validIds);

    let from_value = "No";
    let to_value = "Yes";
    query = ` select id from ru_fresh_lead_claims where fresh_lead_id in (?) `;
    let leadForms = await _db2.query(query, { replacements: [validIds], type: QueryTypes.SELECT });

    bindParams = [];
    for (let i = 0; i < leadForms?.length; i++) {
        if (i == 0) {
            query = ` insert into application_logs (application_type, application_id, field, from_value, to_value, updated_by) values ('lead_claim_update', ?, 'waiting_to_pending', ?, ?, uuid_to_bin(?)) `;
        }
        else {
            query += `, ('lead_claim_update', ?, 'waiting_to_pending', ?, ?, uuid_to_bin(?)) `;
        }
        bindParams = bindParams.concat([leadForms[i]?.id, from_value, to_value, userId]);
    };
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    if (validIds.length < id.length) {
        return { status: false, errorMsg: buildErrorMsg, code: 400 }
    }
    return true;
};

const getLeadFormid = async (fresh_lead_id) => {
    let query = 'select id from ru_fresh_lead_claims where fresh_lead_id = ?'
    let bindParams = [fresh_lead_id]
    let result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return result[0].id || null
}

const updateClaimPendingStatus = async (id, value, userId) => {
    let query = ` update ru_fresh_lead_claims set claim_pending_flag = (?) where fresh_lead_id in (?) `
    let bindParams = [value, id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    query = ` insert into application_logs (application_type, application_id, field, from_value, to_value, updated_by) values ('lead_claim_update', ?, 'claim_lead_form', ?, ?, uuid_to_bin(?)) `;
    let lead_id = await getLeadFormid(id[0]);
    bindParams = [lead_id, "No", "Yes", userId || null];
    for (let i = 0; i < id?.length; i++) {
        if (i !== 0) {
            lead_id = await getLeadFormid(id[i])
            query += `, ('lead_claim_update', ?, 'awaited_to_progress', ?, ?, uuid_to_bin(?)) `;
            bindParams = bindParams.concat([lead_id, "No", "Yes", userId || null]);
        }
    };
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    return;
};

const checkClaimAccess = async (fresh_lead_ids, phone) => {
    let validIds = [];
    for (let id of fresh_lead_ids) {
        const checkQuery = `SELECT dsa_mobile_number, loan_status, fresh_lead_status_id FROM ru_fresh_lead_claims WHERE fresh_lead_id = ?`;
        const result = await _db2.query(checkQuery, { replacements: [id], type: QueryTypes.SELECT });

        if (result.length > 0) {
            const { dsa_mobile_number, loan_status, fresh_lead_status_id } = result[0];
            const isErpStatus = [1, 6, 2, 5, 9, 10, 11, 12, 4, 3, 7, 8].includes(fresh_lead_status_id);
            if (dsa_mobile_number == phone && loan_status == "disbursed" && !isErpStatus) {
                validIds.push(id);
            }
        }
    }
    return validIds;
}


const updateMultiFundedStatus = async (id, value, remarks, userId) => {
    remarks = remarks || {};

    let caseClause = 'CASE fresh_lead_id\n';

    let remarks_length = Object.keys(remarks).length
    let caseClauseParams = [];

    for (const [id, remark] of Object.entries(remarks)) {
        caseClause += `  WHEN ? THEN ? \n`;
        caseClauseParams.push(id, remark);
    }
    caseClause += 'END';

    let query = ` update ru_fresh_lead_claims set multi_funded_flag = (?)${remarks_length ? `, vendor_remark = ${caseClause} ` : " "} where fresh_lead_id in (?) `;
    let bindParams = [value, ...caseClauseParams, id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    let from_value = "pending";
    let to_value = value == 1 ? "confirmed" : "rejected";
    if (value == 0) {
        from_value = "confirmed"
        to_value = "pending"
    }
    bindParams = [];
    for (let i = 0; i < id?.length; i++) {
        if (i == 0) {
            query = ` insert into application_logs (application_type, application_id, field, from_value, to_value, updated_by) values ('lead_claim_update', ?, 'multi_funded_status', ?, ?, uuid_to_bin(?)) `;
        }
        else {
            query += `, ('lead_claim_update', ?, 'multi_funded_status', ?, ?, uuid_to_bin(?)) `;
        }
        let lead_id = await getLeadFormid(id[i]);
        bindParams = bindParams.concat([lead_id, from_value, to_value, userId || null]);
    };
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    return true;
};

const getCommunicationSettings = async () => {

    let query = ` select * from communication_settings `;

    const records = await sequelize.query(query, { replacements: [], type: QueryTypes.SELECT });
    return records;
};

const deleteCommunicationSettings = async (id) => {
    let query = ` delete from communication_settings where id = ? `;
    const records = await sequelize.query(query, { replacements: [id], type: QueryTypes.DELETE });
};

const createRemainder = async (message, remainder_at, user_id, created_for) => {
    let query = ` insert into remainders (message,remainder_at,created_by,created_for) values (?,?,?,?) `;
    await sequelize.query(query, { replacements: [message, remainder_at, user_id, created_for || user_id], type: QueryTypes.INSERT });
    return true;
};

const getAllRemainder = async (offset, limit, user_id) => {
    let query = ` SELECT r.*,u.name as created_by_name,u.name as created_for_name,c.name FROM remainders r left join users u on  r.created_by = bin_to_uuid(u.id) left join users c on r.created_for = bin_to_uuid(c.id) where created_for = ? `;
    // let query = `select r.*,u.name as created_by_name,u.name as created_for_name,c.name from remainders r where created_for = ? left join users u on  r.created_by = bin_to_uuid(?) left join users c on r.created_for = bin_to_uuid(?) `;
    let queryCount = `select count(*) as totalCount from remainders where created_for = ? `;
    let bindParams = [user_id]
    if (offset || limit) query += ` limit ${offset},${limit} `;
    let remainders = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let totalCount = await sequelize.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    return { remainders, totalCount: totalCount[0].totalCount };
};

const getAllUpcomingRemainder = async (user_id) => {
    let currentDate = new Date();
    let dateAfter24Hours = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    currentDate = currentDate.toISOString();
    dateAfter24Hours = dateAfter24Hours.toISOString();
    let query = `SELECT r.*,u.name as created_by_name,u.name as created_for_name,c.name
    FROM remainders r left join users u on  r.created_by = bin_to_uuid(u.id) left join users c on r.created_for = bin_to_uuid(c.id)  WHERE r.is_read = 0 and r.created_for = ? and
    DATE(remainder_at)  between DATE("${currentDate}") and DATE("${dateAfter24Hours}") `;
    let bindParams = [user_id,]
    let remainders = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    // console.log(remainders)
    return remainders;
}

const getAllMissedRemainder = async (offset, limit, user_id) => {
    let currentDate = new Date();
    currentDate = currentDate.toISOString();
    let query = ` SELECT r.*,u.name as created_by_name,u.name as created_for_name,c.name FROM remainders r left join users u on  r.created_by = bin_to_uuid(u.id) left join users c on r.created_for = bin_to_uuid(c.id)  WHERE r.is_read = 0 and r.created_for = ? and DATE(remainder_at)  < DATE("${currentDate}") `;
    let queryCount = `SELECT count(*) FROM remainders r left join users u on  r.created_by = bin_to_uuid(u.id) left join users c on r.created_for = bin_to_uuid(c.id)  WHERE r.is_read = 0 and r.created_for = ? and DATE(remainder_at)  < DATE("${currentDate}") `;
    let bindParams = [user_id]
    let remainders = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let totalCount = await sequelize.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    // console.log(remainders)
    return { remainders, totalCount: totalCount[0].totalCount };
}


const getLeadCLaimById = async (id) => {
    let query = ` select flc.*, rc.registered_by, flcm.is_tentative_matched, flcm.is_bank_file_matched, flcm.tentative_bank_file_id, flcm.bank_file_id from ru_fresh_lead_claims flc left join ru_companies rc on flc.user_type = 'company' and flc.dsa_id = rc.company_id left join ru_fresh_lead_claims_meta flcm on flcm.fresh_lead_id = flc.fresh_lead_id where flc.id = ? `;
    let bindParams = [id]
    let claims = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return claims[0];
}

const updateLeadFormPayoutType = async (id, vendor_payout_type, user_id) => {
    let query = ` update ru_fresh_lead_claims set vendor_payout_type =  ?, vendor_payout_amount = ? , vendor_payout_rate = 0 , vendor_payout_ratio = 0 , payout_collide = 1  , updated_at = ? where  id = ? `;
    let bindParams = [vendor_payout_type?.toLowerCase(), null, new Date(), id]
    let claims = await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    query = ` insert into application_logs (application_type,application_id,field,from_value,to_value,updated_by) values ('lead_claim_update',?,?,?,?,uuid_to_bin(?)) `

    await sequelize.query(query, { replacements: [id, 'vendor_payout_type', vendor_payout_type == 'Rate' ? 'Ratio' : 'Rate', vendor_payout_type, user_id], type: QueryTypes.INSERT });
}

const deleteRemainder = async (remainder_id) => {
    let query = ` delete from   remainders
    WHERE id = ? `;
    await sequelize.query(query, { replacements: [remainder_id], type: QueryTypes.DELETE });
    return;
}

const markRemainderAsRead = async (id) => {
    let currentDate = new Date();
    currentDate = currentDate.toISOString();
    let query = `update remainders set is_read = ?
    WHERE  id = ? `;
    let bindParams = [1, id]
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
};

const markAllPastRemainderAsRead = async (user_id) => {
    let currentDate = new Date();
    currentDate = currentDate.toISOString();
    let query = `update remainders set is_read = ?
    WHERE  created_for = ? and
    DATE(remainder_at)  < DATE("${currentDate}")  
     `;
    let bindParams = [1, user_id]
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
};

const getDsaDataForEdit = async (dsa_id, forLogs = false) => {
    let query = ` select c.hsn_hsc_number, c.gst_registration_type, c.utm_main_source, c.company_name, c.gstin, c.salutation, c.dsa_id, GROUP_CONCAT(distinct cal.remarks, ' : ', DATE(cal.createdAt), ' : (', calu.name, ')' ORDER BY cal.remarks SEPARATOR ' | ') AS calling_note, c.first_name, c.middle_name, c.last_name, c.email_address, c.dsa_mobile_number, c.partner_code, CONCAT(p.first_name, ' ', COALESCE(p.middle_name, ''), ' ', p.last_name)  as partner_name, c.channel_manager_code, CONCAT(cmp.first_name, ' ', COALESCE(cmp.middle_name, ''), ' ', cmp.last_name) AS channel_manager_name, c.dsa_status, ds.value as dsa_status_name, c.dsa_sub_status, dss.value as dsa_sub_status_name, case when c.consent_otp_verified_at is not null then "Yes" else "No" end as consent_verified, c.gender, kyc.permanent_account_number, ls.value as last_status, bh.full_name as bh_name, c.user_type, c.profession, lmo.full_name as last_modified_by, DATE(c.dsa_status_updated_at) as dsa_status_updated_at, DATE(c.partner_assigned_date) as partner_assigned_date, c.date_of_birth, DATE(c.updated_at) as updated_at, c.home_address_house_number, c.home_address_area, c.home_address_city, c.home_address_state, c.home_address_pincode, c.office_address_house_number, c.office_address_area, c.office_address_city, c.office_address_state, c.office_address_pincode, cad.description, cad.potential, cad.alternate_mobile, cad.has_done_loan_buisness, cad.year_loan_buisness, cad.personal_loan_payout, cad.personal_loan_business_amount, cad.business_loan_payout, cad.business_loan_business_amount, cad.housing_loan_payout, cad.housing_loan_business_amount, cad.loan_against_property_payout, cad.loan_against_property_business_amount, cad.gold_loan_payout, cad.gold_loan_business_amount, cad.car_loan_payout, cad.car_loan_business_amount, cad.msme_loan_payout, cad.msme_loan_business_amount, cad.education_loan_payout, cad.education_loan_business_amount, cad.project_loan_payout, cad.project_loan_business_amount, cad.professional_loan_payout, cad.professional_loan_business_amount, cad.od_or_credit_card_payout, cad.od_or_credit_card_business_amount, cad.working_capital_loan_payout, cad.working_capital_loan_business_amount, cad.do_you_have_connector_code, cad.bank_or_nbfc_name_for_connector, cad.other_bank_for_connector, cad.do_you_have_dsa_code, cad.bank_or_nbfc_name_for_dsa, cad.do_you_refer_or_do_end_to_end_files, cad.other_bank_for_dsa, cad.do_you_have_office, cad.banker_ref, cad.have_you_heard_of_ruloans_before, cad.where_or_how, cad.what_is_the_purpose_of_joining_ruloans, cad.bank_leave_duration, cad.type_of_loans_in_previous_bank, cad.previous_bank_department, cad.previous_bank_verticle, rdl.utm_source, rdl.utm_medium, rdl.utm_campaign, rdl.utm_channel, rdl.utm_term, rdl.utm_main_source from ru_direct_selling_agents c left join ru_direct_selling_agents p on p.dsa_mobile_number = c.partner_code left join ru_direct_selling_agents bh on bh.dsa_mobile_number = c.business_head_code left join ru_direct_selling_agents lmo on lmo.dsa_mobile_number = c.last_modified_by left join ru_direct_selling_agents cmp on cmp.dsa_mobile_number = c.channel_manager_code left join ru_dsa_kyc_data kyc on kyc.dsa_id = c.dsa_id left join picklist_values ls on ls.id = c.last_status left join CRMTest.call_logs cal on cal.user_id = c.dsa_id left join CRMTest.users calu on cal.createdBy = bin_to_uuid(calu.id) left join ru_dsa_additional_information cad on binary cad.dsa_id = c.dsa_id left join ru_dsa_leads rdl on rdl.dsa_id = c.dsa_id left join picklist_values ds on ds.id = c.dsa_status left join picklist_values dss on ds.id = c.dsa_sub_status where c.dsa_id = ? `;
    let bindParams = [dsa_id];
    let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    if (data?.length) {
        if (forLogs) {
            let { dsa_sub_status, partner_code, channel_manager_code, ...rest } = data[0];
            data = rest;
        } else {
            let { dsa_status_name, dsa_sub_status_name, ...rest } = data[0];
            data = rest;
        }
    }
    return data || null;
};

const getDsaWithEmailAndPhone = async (email_address, dsa_mobile_number, permanent_account_number) => {
    let query = ``;
    let bindParams = [];
    if (permanent_account_number) {
        bindParams = [email_address, dsa_mobile_number, permanent_account_number];
        query = ` select * from ru_direct_selling_agents c left join ru_dsa_kyc_data kyc on kyc.dsa_id = c.dsa_id where c.email_address = (?) or c.dsa_mobile_number = (?) or kyc.permanent_account_number = (?) `;
    } else {
        bindParams = [email_address, dsa_mobile_number];
        query = ` select * from ru_direct_selling_agents c left join ru_dsa_kyc_data kyc on kyc.dsa_id = c.dsa_id where c.email_address = (?) or c.dsa_mobile_number = (?)  `;
    }

    let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return data || null;
};

const getSignUpSteps = async (dsa_id) => {
    let query = ` select signup_steps_completed from ru_direct_selling_agents where dsa_id = ? `;
    let bindParams = [dsa_id];
    let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return data[0]?.signup_steps_completed || 0;
};

const getPersonalLoanMisForDsa = async (offset, limit, joiningDateFilterStart, joiningDateFilterEnd, bhCode, subProduct, loginDateFilterStart, loginDateFilterEnd, disbursedDateFilterStart, disbursedDateFilterEnd, utm_main_source, city, state, status, sub_status, is_export) => {
    let export_query = `, SUM(aplv.rejected) AS rejected_count, SUM(aplv.disbursed) AS disbursed_count, SUM(aplv.approved) AS approved_count, SUM(aplv.progress) AS total_progress, SUM(aplv.disbursed_amount) AS total_disbursed_amount, SUM(aplv.approved_amount) AS total_approved_amount `
    // if (is_export) {
    //     export_query += `, SUM(CASE WHEN binary aplv.type = 'lnt' THEN aplv.rejected ELSE 0 END) AS lnt_rejected_count,
    //     SUM(CASE WHEN binary aplv.type = 'lnt' THEN aplv.disbursed ELSE 0 END) AS lnt_disbursed_count,
    //     SUM(CASE WHEN binary aplv.type = 'lnt' THEN aplv.approved ELSE 0 END) AS lnt_approved_count,
    //     SUM(CASE WHEN binary aplv.type = 'lnt' THEN aplv.progress ELSE 0 END) AS lnt_total_progress,
    //     SUM(CASE WHEN binary aplv.type = 'lnt' THEN aplv.disbursed_amount ELSE 0 END) AS lnt_total_disbursed_amount,
    //     SUM(CASE WHEN binary aplv.type = 'lnt' THEN aplv.approved_amount ELSE 0 END) AS lnt_total_approved_amount

    //     , SUM(CASE WHEN binary aplv.type = 'incred' THEN aplv.rejected ELSE 0 END) AS incred_rejected_count,
    //     SUM(CASE WHEN binary aplv.type = 'incred' THEN aplv.disbursed ELSE 0 END) AS incred_disbursed_count,
    //     SUM(CASE WHEN binary aplv.type = 'incred' THEN aplv.approved ELSE 0 END) AS incred_approved_count,
    //     SUM(CASE WHEN binary aplv.type = 'incred' THEN aplv.progress ELSE 0 END) AS incred_total_progress,
    //     SUM(CASE WHEN binary aplv.type = 'incred' THEN aplv.disbursed_amount ELSE 0 END) AS incred_total_disbursed_amount,
    //     SUM(CASE WHEN binary aplv.type = 'incred' THEN aplv.approved_amount ELSE 0 END) AS incred_total_approved_amount

    //     , SUM(CASE WHEN binary aplv.type = 'faircent' THEN aplv.rejected ELSE 0 END) AS faircent_rejected_count,
    //     SUM(CASE WHEN binary aplv.type = 'faircent' THEN aplv.disbursed ELSE 0 END) AS faircent_disbursed_count,
    //     SUM(CASE WHEN binary aplv.type = 'faircent' THEN aplv.approved ELSE 0 END) AS faircent_approved_count,
    //     SUM(CASE WHEN binary aplv.type = 'faircent' THEN aplv.progress ELSE 0 END) AS faircent_total_progress,
    //     SUM(CASE WHEN binary aplv.type = 'faircent' THEN aplv.disbursed_amount ELSE 0 END) AS faircent_total_disbursed_amount,
    //     SUM(CASE WHEN binary aplv.type = 'faircent' THEN aplv.approved_amount ELSE 0 END) AS faircent_total_approved_amount

    //     , SUM(CASE WHEN binary aplv.type = 'fibe' THEN aplv.rejected ELSE 0 END) AS fibe_rejected_count,
    //     SUM(CASE WHEN binary aplv.type = 'fibe' THEN aplv.disbursed ELSE 0 END) AS fibe_disbursed_count,
    //     SUM(CASE WHEN binary aplv.type = 'fibe' THEN aplv.approved ELSE 0 END) AS fibe_approved_count,
    //     SUM(CASE WHEN binary aplv.type = 'fibe' THEN aplv.progress ELSE 0 END) AS fibe_total_progress,
    //     SUM(CASE WHEN binary aplv.type = 'fibe' THEN aplv.disbursed_amount ELSE 0 END) AS fibe_total_disbursed_amount,
    //     SUM(CASE WHEN binary aplv.type = 'fibe' THEN aplv.approved_amount ELSE 0 END) AS fibe_total_approved_amount

    //     , SUM(CASE WHEN binary aplv.type = 'bajaj' THEN aplv.rejected ELSE 0 END) AS bajaj_rejected_count,
    //     SUM(CASE WHEN binary aplv.type = 'bajaj' THEN aplv.disbursed ELSE 0 END) AS bajaj_disbursed_count,
    //     SUM(CASE WHEN binary aplv.type = 'bajaj' THEN aplv.approved ELSE 0 END) AS bajaj_approved_count,
    //     SUM(CASE WHEN binary aplv.type = 'bajaj' THEN aplv.progress ELSE 0 END) AS bajaj_total_progress,
    //     SUM(CASE WHEN binary aplv.type = 'bajaj' THEN aplv.disbursed_amount ELSE 0 END) AS bajaj_total_disbursed_amount,
    //     SUM(CASE WHEN binary aplv.type = 'bajaj' THEN aplv.approved_amount ELSE 0 END) AS bajaj_total_approved_amount

    //     , SUM(CASE WHEN binary aplv.type = 'prefer' THEN aplv.rejected ELSE 0 END) AS prefer_rejected_count,
    //     SUM(CASE WHEN binary aplv.type = 'prefer' THEN aplv.disbursed ELSE 0 END) AS prefer_disbursed_count,
    //     SUM(CASE WHEN binary aplv.type = 'prefer' THEN aplv.approved ELSE 0 END) AS prefer_approved_count,
    //     SUM(CASE WHEN binary aplv.type = 'prefer' THEN aplv.progress ELSE 0 END) AS prefer_total_progress,
    //     SUM(CASE WHEN binary aplv.type = 'prefer' THEN aplv.disbursed_amount ELSE 0 END) AS prefer_total_disbursed_amount,
    //     SUM(CASE WHEN binary aplv.type = 'prefer' THEN aplv.approved_amount ELSE 0 END) AS prefer_total_approved_amount

    //     , SUM(CASE WHEN binary aplv.type = 'paysense' THEN aplv.rejected ELSE 0 END) AS paysense_rejected_count,
    //     SUM(CASE WHEN binary aplv.type = 'paysense' THEN aplv.disbursed ELSE 0 END) AS paysense_disbursed_count,
    //     SUM(CASE WHEN binary aplv.type = 'paysense' THEN aplv.approved ELSE 0 END) AS paysense_approved_count,
    //     SUM(CASE WHEN binary aplv.type = 'paysense' THEN aplv.progress ELSE 0 END) AS paysense_total_progress,
    //     SUM(CASE WHEN binary aplv.type = 'paysense' THEN aplv.disbursed_amount ELSE 0 END) AS paysense_total_disbursed_amount,
    //     SUM(CASE WHEN binary aplv.type = 'paysense' THEN aplv.approved_amount ELSE 0 END) AS paysense_total_approved_amount `;
    // };

    // if (is_export && subProduct) {
    //     export_query = `, SUM(CASE WHEN binary aplv.type = '${subProduct}' THEN aplv.rejected ELSE 0 END) AS ${subProduct}_rejected_count,
    //     SUM(CASE WHEN binary aplv.type = '${subProduct}' THEN aplv.disbursed ELSE 0 END) AS ${subProduct}_disbursed_count,
    //     SUM(CASE WHEN binary aplv.type = '${subProduct}' THEN aplv.approved ELSE 0 END) AS ${subProduct}_approved_count,
    //     SUM(CASE WHEN binary aplv.type = '${subProduct}' THEN aplv.progress ELSE 0 END) AS ${subProduct}_total_progress,
    //     SUM(CASE WHEN binary aplv.type = '${subProduct}' THEN aplv.disbursed_amount ELSE 0 END) AS ${subProduct}_total_disbursed_amount,
    //     SUM(CASE WHEN binary aplv.type = '${subProduct}' THEN aplv.approved_amount ELSE 0 END) AS ${subProduct}_total_approved_amount `;
    // };

    let query = ` SELECT pvs.value as dsa_status, pvss.value as dsa_sub_status, c.home_address_city, c.home_address_state, aplv.dsa_mobile_number, c.utm_source as utm_source, c.utm_medium as utm_medium, c.utm_campaign as utm_campaign, c.utm_channel as utm_channel, c.utm_term as utm_term, c.utm_device as utm_device, c.profession as profession, c.full_name AS dsa_name, c.utm_main_source, d.full_name AS business_head_code ${export_query} FROM all_personal_loan_application_view aplv LEFT JOIN  ru_direct_selling_agents c ON aplv.dsa_mobile_number = c.dsa_mobile_number LEFT JOIN ru_direct_selling_agents d ON c.business_head_code = d.dsa_mobile_number left join picklist_values pvs on pvs.id = c.dsa_status left join picklist_values pvss on pvss.id = c.dsa_sub_status `;
    let querySum = ` SELECT  SUM(aplv.rejected) AS rejected_count, SUM(aplv.disbursed) AS disbursed_count, SUM(aplv.approved) AS approved_count, SUM(aplv.progress) AS total_progress, SUM(aplv.disbursed_amount) AS total_disbursed_amount, SUM(aplv.approved_amount) AS total_approved_amount FROM all_personal_loan_application_view aplv LEFT JOIN  ru_direct_selling_agents c ON aplv.dsa_mobile_number = c.dsa_mobile_number LEFT JOIN ru_direct_selling_agents d ON c.business_head_code = d.dsa_mobile_number left join picklist_values pvs on pvs.id = c.dsa_status left join picklist_values pvss on pvss.id = c.dsa_sub_status `;
    let queryCount = ` select aplv.dsa_mobile_number from all_personal_loan_application_view aplv LEFT JOIN  ru_direct_selling_agents c ON aplv.dsa_mobile_number = c.dsa_mobile_number LEFT JOIN ru_direct_selling_agents d ON c.business_head_code = d.dsa_mobile_number left join picklist_values pvs on pvs.id = c.dsa_status left join picklist_values pvss on pvss.id = c.dsa_sub_status `;
    let and = false;
    let bindParams = [];

    if (joiningDateFilterStart) {
        if (!and) {
            query += ` where(DATE(c.created_At)  between DATE("${joiningDateFilterStart}") and DATE("${joiningDateFilterEnd}")) `;
            querySum += ` where(DATE(c.created_At)  between DATE("${joiningDateFilterStart}") and DATE("${joiningDateFilterEnd}")) `;
            queryCount += ` where(DATE(c.created_At)  between DATE("${joiningDateFilterStart}") and DATE("${joiningDateFilterEnd}")) `;
            and = true;
        } else {
            query += ` and(DATE(c.created_At)  between DATE("${joiningDateFilterStart}") and DATE("${joiningDateFilterEnd}")) `;
            querySum += ` and(DATE(c.created_At)  between DATE("${joiningDateFilterStart}") and DATE("${joiningDateFilterEnd}")) `;
            queryCount += ` and(DATE(c.created_At)  between DATE("${joiningDateFilterStart}") and DATE("${joiningDateFilterEnd}")) `;
        }
    };

    if (loginDateFilterStart) {
        if (!and) {
            query += ` where(DATE(aplv.login_date)  between DATE("${loginDateFilterStart}") and DATE("${loginDateFilterEnd}")) `;
            querySum += ` where(DATE(aplv.login_date)  between DATE("${loginDateFilterStart}") and DATE("${loginDateFilterEnd}")) `;
            queryCount += ` where(DATE(aplv.login_date)  between DATE("${loginDateFilterStart}") and DATE("${loginDateFilterEnd}")) `;
            and = true;
        } else {
            query += ` and(DATE(aplv.login_date)  between DATE("${loginDateFilterStart}") and DATE("${loginDateFilterEnd}")) `;
            querySum += ` and(DATE(aplv.login_date)  between DATE("${loginDateFilterStart}") and DATE("${loginDateFilterEnd}")) `;
            queryCount += ` and(DATE(aplv.login_date)  between DATE("${loginDateFilterStart}") and DATE("${loginDateFilterEnd}")) `;

        }
    };

    if (disbursedDateFilterStart) {
        if (!and) {
            query += ` where(DATE(aplv.disbursal_date)  between DATE("${disbursedDateFilterStart}") and DATE("${disbursedDateFilterEnd}")) `;
            querySum += ` where(DATE(aplv.disbursal_date)  between DATE("${disbursedDateFilterStart}") and DATE("${disbursedDateFilterEnd}")) `;
            queryCount += ` where(DATE(aplv.disbursal_date)  between DATE("${disbursedDateFilterStart}") and DATE("${disbursedDateFilterEnd}")) `;
            and = true;
        } else {
            query += ` and(DATE(aplv.disbursal_date)  between DATE("${disbursedDateFilterStart}") and DATE("${disbursedDateFilterEnd}")) `;
            querySum += ` and(DATE(aplv.disbursal_date)  between DATE("${disbursedDateFilterStart}") and DATE("${disbursedDateFilterEnd}")) `;
            queryCount += ` and(DATE(aplv.disbursal_date)  between DATE("${disbursedDateFilterStart}") and DATE("${disbursedDateFilterEnd}")) `;
        }
    };

    if (subProduct) {
        if (!and) {
            query += ` where binary aplv.type = ? `;
            querySum += ` where binary aplv.type = ? `;
            queryCount += ` where binary aplv.type = ? `;
            bindParams.push(subProduct)
            and = true;
        } else {
            query += ` and binary aplv.type = binary ? `;
            querySum += ` and binary aplv.type = binary ? `;
            queryCount += ` and binary aplv.type = binary ? `;
            bindParams.push(subProduct)
        }
    };

    if (bhCode) {
        if (!and) {
            query += ` where c.business_head_code = ? `;
            querySum += ` where c.business_head_code = ? `;
            queryCount += ` where c.business_head_code = ? `;
            bindParams.push(bhCode)
            and = true;
        } else {
            query += ` and c.business_head_code = ? `;
            querySum += ` and c.business_head_code = ? `;
            queryCount += ` and c.business_head_code = ? `;
            bindParams.push(bhCode)
        }
    };

    if (utm_main_source) {
        if (!and) {
            query += ` where c.utm_main_source like '%${utm_main_source}%' `;
            querySum += ` where c.utm_main_source like '%${utm_main_source}%' `;
            queryCount += ` where c.utm_main_source like '%${utm_main_source}%' `;
            bindParams.push(utm_main_source)
            and = true;
        } else {
            query += ` and c.utm_main_source like '%${utm_main_source}%' `;
            querySum += ` and c.utm_main_source like '%${utm_main_source}%' `;
            queryCount += ` and c.utm_main_source like '%${utm_main_source}%' `;
            bindParams.push(utm_main_source)
        }
    };

    if (city) {
        if (!and) {
            query += ` where c.home_address_city like '%${city}%' `;
            querySum += ` where c.home_address_city like '%${city}%' `;
            queryCount += ` where c.home_address_city like '%${city}%' `;
            bindParams.push(city)
            and = true;
        } else {
            query += ` and c.home_address_city like '%${city}%' `;
            querySum += ` and c.home_address_city like '%${city}%' `;
            queryCount += ` and c.home_address_city like '%${city}%' `;
            bindParams.push(city)
        }
    };

    if (state) {
        if (!and) {
            query += ` where c.home_address_state like '%${state}%' `;
            querySum += ` where c.home_address_state like '%${state}%' `;
            queryCount += ` where c.home_address_state like '%${state}%' `;
            bindParams.push(state)
            and = true;
        } else {
            query += ` and c.home_address_state like '%${state}%' `;
            querySum += ` and c.home_address_state like '%${state}%' `;
            queryCount += ` and c.home_address_state like '%${state}%' `;
            bindParams.push(state)
        }
    };

    if (status) {
        if (!and) {
            query += ` where pvs.value like '%${status}%' `;
            querySum += ` where pvs.value like '%${status}%' `;
            queryCount += ` where pvs.value like '%${status}%' `;
            bindParams.push(status)
            and = true;
        } else {
            query += ` and pvs.value like '%${status}%' `;
            querySum += ` and pvs.value like '%${status}%' `;
            queryCount += ` and pvs.value like '%${status}%' `;
            bindParams.push(status)
        }
    };

    if (sub_status) {
        if (!and) {
            query += ` where pvss.value like '%${sub_status}%' `;
            querySum += ` where pvss.value like '%${sub_status}%' `;
            queryCount += ` where pvss.value like '%${sub_status}%' `;
            bindParams.push(sub_status)
            and = true;
        } else {
            query += ` and pvss.value like '%${sub_status}%' `;
            querySum += ` and pvss.value like '%${sub_status}%' `;
            queryCount += ` and pvss.value like '%${sub_status}%' `;
            bindParams.push(sub_status)
        }
    };

    query += ` GROUP BY aplv.dsa_mobile_number `
    queryCount += ` GROUP BY aplv.dsa_mobile_number `

    queryCount = ` select count(*) as totalCount from(${queryCount}) c `;

    if (is_export) {
        return { query, queryCount, bindParams };
    } else {
        if (offset || limit) query += ` limit ${offset},${limit} `;
        let result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        let resultSum = await _db2.query(querySum, { replacements: bindParams, type: QueryTypes.SELECT });
        let totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
        result = [...resultSum, ...result]
        return { result: result, totalCount: totalCount[0].totalCount, };
    }
}

const updateLastStatus = async (dsa_id, old_status) => {
    let query = ` UPDATE ru_direct_selling_agents set last_status =?, dsa_status_updated_at =? where dsa_id =? `;
    let bindParams = [old_status, new Date(), dsa_id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return;
};

const getUserByBusinessHead = async (phone, where, offset, limit) => {
    let query = ` select business_head_code, dsa_mobile_number from ru_direct_selling_agents where dsa_mobile_number = '${phone}' `;
    let data = await _db2.query(query, { type: QueryTypes.SELECT });
    let users = [];
    let totalCount = 0;

    if (data?.length && !data[0]?.business_head_code) {
        data[0].business_head_code = data[0].dsa_mobile_number
    };

    if (data[0]?.business_head_code) {
        query = ` select full_name as userName, dsa_mobile_number as userPhone from ru_direct_selling_agents where business_head_code = '${data[0]?.business_head_code}' ${where || ""} `;
        if (offset || limit) query += ` limit ${offset},${limit} `;
        users = await _db2.query(query, { type: QueryTypes.SELECT });

        query = ` select count(*) as count from ru_direct_selling_agents where business_head_code = '${data[0]?.business_head_code}' ${where || ""} `;
        let userCount = await _db2.query(query, { type: QueryTypes.SELECT });
        totalCount = userCount[0]?.count || 0;
    };

    return { users, totalCount };
};

const getDsaCityState = async (state) => {
    let query;
    if (state?.length) {
        query = ` select distinct home_address_city as value from ru_direct_selling_agents where home_address_city is not null and home_address_state = '${state}' order by home_address_city asc `;
    } else {
        query = ` select distinct home_address_state as value from ru_direct_selling_agents where home_address_state is not null order by home_address_state asc `;
    }
    let data = await _db2.query(query, { type: QueryTypes.SELECT });
    return data
};

// const createDsa = async (data, loggedInUser) => {
//     const { dsa_id, channel_manager_code, last_modified_by, first_name, middle_name, last_name, email_address, dsa_mobile_number, partner_code, dsa_status, dsa_sub_status, gender, profession, date_of_birth, user_type, utm_main_source, permanent_account_number, description, potential, alternate_mobile, has_done_loan_buisness, year_loan_buisness, personal_loan_payout, personal_loan_business_amount, business_loan_payout, business_loan_business_amount, housing_loan_payout, housing_loan_business_amount, loan_against_property_payout, loan_against_property_business_amount, gold_loan_payout, gold_loan_business_amount, car_loan_payout, car_loan_business_amount, msme_loan_payout, msme_loan_business_amount, education_loan_payout, education_loan_business_amount, project_loan_payout, project_loan_business_amount, professional_loan_payout, professional_loan_business_amount, od_or_credit_card_payout, od_or_credit_card_business_amount, working_capital_loan_payout, working_capital_loan_business_amount, do_you_have_connector_code, bank_or_nbfc_name_for_connector, other_bank_for_connector, do_you_have_dsa_code, bank_or_nbfc_name_for_dsa, do_you_refer_or_do_end_to_end_files, other_bank_for_dsa, do_you_have_office, banker_ref, have_you_heard_of_ruloans_before, where_or_how, what_is_the_purpose_of_joining_ruloans, bank_leave_duration, type_of_loans_in_previous_bank, previous_bank_department, previous_bank_verticle, home_address_house_number, home_address_area, home_address_city, home_address_state, home_address_pincode, office_address_house_number, office_address_area, office_address_city, office_address_state, office_address_pincode, salutation, company_name, gstin, signup_steps_completed } = data;
//     let dsa_id_new = uuid();
//     let full_name = `${ first_name }${ middle_name ? " " + middle_name : "" }${ last_name ? " " + last_name : "" } `;

//     let query = ` select * from ru_direct_selling_agents where dsa_id = ? `
//     let bindParams = [dsa_id];
//     let dsa = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
//     if (dsa[0]) {
//         let query = `UPDATE ru_direct_selling_agents SET channel_manager_code =?, last_status = ?, signup_steps_completed =?, company_name =?, gstin =?, salutation =?, full_name =?, last_modified_by =?, first_name =?, middle_name =?, last_name =?, email_address =?, dsa_mobile_number =?, partner_code =?, dsa_status =?, dsa_sub_status =?, gender =?, user_type =?, profession =?, date_of_birth =?, home_address_house_number =?, home_address_area =?, home_address_city =?, home_address_state =?, home_address_pincode =?, office_address_house_number =?, office_address_area =?, office_address_city =?, office_address_state =?, office_address_pincode =? WHERE dsa_id =? `;
//         let bindParams = [channel_manager_code || null, dsa[0].dsa_status == dsa_status ? dsa[0].last_status : dsa[0].dsa_status, signup_steps_completed || null, company_name || null, gstin || null, salutation || null, full_name || null, last_modified_by || null, first_name || null, middle_name || null, last_name || null, email_address || null, dsa_mobile_number || null, partner_code || null, dsa_status || null, dsa_sub_status || null, gender || null, user_type || null, profession || null, date_of_birth || null, home_address_house_number || null, home_address_area || null, home_address_city || null, home_address_state || null, home_address_pincode || null, office_address_house_number || null, office_address_area || null, office_address_city || null, office_address_state || null, office_address_pincode || null, dsa_id];
//         await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
//         let newData = await getDsaDataForEdit(dsa_id, true);
//         if (newData?.partner_code != dsa[0]?.partner_code) {
//             await reassignPartner(dsa_id, partner_code);
//         }
//         let difference = jsonDifference(dsa[0], newData);
//         const userId = loggedInUser;
//         await ApplicationLogServices.bulkCreate(difference, dsa_id, "dsa", userId);
//     } else {
//         let query = ` insert into ru_direct_selling_agents(dsa_id, channel_manager_code, signup_steps_completed, company_name, gstin, salutation, full_name, last_modified_by, first_name, middle_name, last_name, email_address, dsa_mobile_number, partner_code, dsa_status, dsa_sub_status, gender, user_type, profession, date_of_birth, home_address_house_number, home_address_area, home_address_city, home_address_state, home_address_pincode, office_address_house_number, office_address_area, office_address_city, office_address_state, office_address_pincode) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) `;
//         let bindParams = [dsa_id || dsa_id_new, channel_manager_code || null, signup_steps_completed || null, company_name || null, gstin || null, salutation || null, full_name || null, last_modified_by || null, first_name || null, middle_name || null, last_name || null, email_address || null, dsa_mobile_number || null, partner_code || null, dsa_status || null, dsa_sub_status || null, gender || null, user_type || null, profession || null, date_of_birth || null, home_address_house_number || null, home_address_area || null, home_address_city || null, home_address_state || null, home_address_pincode || null, office_address_house_number || null, office_address_area || null, office_address_city || null, office_address_state || null, office_address_pincode || null];
//         await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
//     }

//     query = ` select * from ru_dsa_kyc_data where dsa_id = ? `
//     bindParams = [dsa_id];
//     dsa = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
//     if (dsa[0]) {
//         query = `UPDATE ru_dsa_kyc_data SET permanent_account_number =?, pan_full_name =? WHERE dsa_id =? `;
//         bindParams = [permanent_account_number || null, full_name || null, dsa_id];
//         await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
//     } else {
//         query = ` insert into ru_dsa_kyc_data(dsa_id, permanent_account_number, pan_full_name) values(?,?,?) `
//         bindParams = [dsa_id || dsa_id_new, permanent_account_number || null, full_name || null];
//         await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
//     }

//     query = ` select * from ru_dsa_additional_information where dsa_id = ? `
//     bindParams = [dsa_id];
//     dsa = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
//     if (dsa[0]) {
//         query = `UPDATE ru_dsa_additional_information SET description =?, potential =?, alternate_mobile =?, has_done_loan_buisness =?, year_loan_buisness =?, personal_loan_payout =?, personal_loan_business_amount =?, business_loan_payout =?, business_loan_business_amount =?, housing_loan_payout =?, housing_loan_business_amount =?, loan_against_property_payout =?, loan_against_property_business_amount =?, gold_loan_payout =?, gold_loan_business_amount =?, car_loan_payout =?, car_loan_business_amount =?, msme_loan_payout =?, msme_loan_business_amount =?, education_loan_payout =?, education_loan_business_amount =?, project_loan_payout =?, project_loan_business_amount =?, professional_loan_payout =?, professional_loan_business_amount =?, od_or_credit_card_payout =?, od_or_credit_card_business_amount =?, working_capital_loan_payout =?, working_capital_loan_business_amount =?, do_you_have_connector_code =?, bank_or_nbfc_name_for_connector =?, other_bank_for_connector =?, do_you_have_dsa_code =?, bank_or_nbfc_name_for_dsa =?, do_you_refer_or_do_end_to_end_files =?, other_bank_for_dsa =?, do_you_have_office =?, banker_ref =?, have_you_heard_of_ruloans_before =?, where_or_how =?, what_is_the_purpose_of_joining_ruloans =?, bank_leave_duration =?, type_of_loans_in_previous_bank =?, previous_bank_department =?, previous_bank_verticle =? WHERE dsa_id =? `;
//         bindParams = [description || null, potential || null, alternate_mobile || null, has_done_loan_buisness || null, year_loan_buisness || null, personal_loan_payout || null, personal_loan_business_amount || null, business_loan_payout || null, business_loan_business_amount || null, housing_loan_payout || null, housing_loan_business_amount || null, loan_against_property_payout || null, loan_against_property_business_amount || null, gold_loan_payout || null, gold_loan_business_amount || null, car_loan_payout || null, car_loan_business_amount || null, msme_loan_payout || null, msme_loan_business_amount || null, education_loan_payout || null, education_loan_business_amount || null, project_loan_payout || null, project_loan_business_amount || null, professional_loan_payout || null, professional_loan_business_amount || null, od_or_credit_card_payout || null, od_or_credit_card_business_amount || null, working_capital_loan_payout || null, working_capital_loan_business_amount || null, do_you_have_connector_code || null, bank_or_nbfc_name_for_connector || null, other_bank_for_connector || null, do_you_have_dsa_code || null, bank_or_nbfc_name_for_dsa || null, do_you_refer_or_do_end_to_end_files || null, other_bank_for_dsa || null, do_you_have_office || null, banker_ref || null, have_you_heard_of_ruloans_before || null, where_or_how || null, what_is_the_purpose_of_joining_ruloans || null, bank_leave_duration || null, type_of_loans_in_previous_bank || null, previous_bank_department || null, previous_bank_verticle || null, dsa_id];
//         await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
//     } else {
//         query = ` insert into ru_dsa_additional_information(dsa_id, description, potential, alternate_mobile, has_done_loan_buisness, year_loan_buisness, personal_loan_payout, personal_loan_business_amount, business_loan_payout, business_loan_business_amount, housing_loan_payout, housing_loan_business_amount, loan_against_property_payout, loan_against_property_business_amount, gold_loan_payout, gold_loan_business_amount, car_loan_payout, car_loan_business_amount, msme_loan_payout, msme_loan_business_amount, education_loan_payout, education_loan_business_amount, project_loan_payout, project_loan_business_amount, professional_loan_payout, professional_loan_business_amount, od_or_credit_card_payout, od_or_credit_card_business_amount, working_capital_loan_payout, working_capital_loan_business_amount, do_you_have_connector_code, bank_or_nbfc_name_for_connector, other_bank_for_connector, do_you_have_dsa_code, bank_or_nbfc_name_for_dsa, do_you_refer_or_do_end_to_end_files, other_bank_for_dsa, do_you_have_office, banker_ref, have_you_heard_of_ruloans_before, where_or_how, what_is_the_purpose_of_joining_ruloans, bank_leave_duration, type_of_loans_in_previous_bank, previous_bank_department, previous_bank_verticle) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) `
//         bindParams = [dsa_id || dsa_id_new, description || null, potential || null, alternate_mobile || null, has_done_loan_buisness || null, year_loan_buisness || null, personal_loan_payout || null, personal_loan_business_amount || null, business_loan_payout || null, business_loan_business_amount || null, housing_loan_payout || null, housing_loan_business_amount || null, loan_against_property_payout || null, loan_against_property_business_amount || null, gold_loan_payout || null, gold_loan_business_amount || null, car_loan_payout || null, car_loan_business_amount || null, msme_loan_payout || null, msme_loan_business_amount || null, education_loan_payout || null, education_loan_business_amount || null, project_loan_payout || null, project_loan_business_amount || null, professional_loan_payout || null, professional_loan_business_amount || null, od_or_credit_card_payout || null, od_or_credit_card_business_amount || null, working_capital_loan_payout || null, working_capital_loan_business_amount || null, do_you_have_connector_code || null, bank_or_nbfc_name_for_connector || null, other_bank_for_connector || null, do_you_have_dsa_code || null, bank_or_nbfc_name_for_dsa || null, do_you_refer_or_do_end_to_end_files || null, other_bank_for_dsa || null, do_you_have_office || null, banker_ref || null, have_you_heard_of_ruloans_before || null, where_or_how || null, what_is_the_purpose_of_joining_ruloans || null, bank_leave_duration || null, type_of_loans_in_previous_bank || null, previous_bank_department || null, previous_bank_verticle || null];
//         await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
//     }

//     return;
// };

const createDsa = async (data, dsa_id_new) => {
    const { hsn_hsc_number, gst_registration_type, dsa_id, channel_manager_code, last_modified_by, first_name, middle_name, last_name, email_address, dsa_mobile_number, partner_code, dsa_status, dsa_sub_status, gender, profession, date_of_birth, user_type, utm_main_source, permanent_account_number, description, potential, alternate_mobile, has_done_loan_buisness, year_loan_buisness, personal_loan_payout, personal_loan_business_amount, business_loan_payout, business_loan_business_amount, housing_loan_payout, housing_loan_business_amount, loan_against_property_payout, loan_against_property_business_amount, gold_loan_payout, gold_loan_business_amount, car_loan_payout, car_loan_business_amount, msme_loan_payout, msme_loan_business_amount, education_loan_payout, education_loan_business_amount, project_loan_payout, project_loan_business_amount, professional_loan_payout, professional_loan_business_amount, od_or_credit_card_payout, od_or_credit_card_business_amount, working_capital_loan_payout, working_capital_loan_business_amount, do_you_have_connector_code, bank_or_nbfc_name_for_connector, other_bank_for_connector, do_you_have_dsa_code, bank_or_nbfc_name_for_dsa, do_you_refer_or_do_end_to_end_files, other_bank_for_dsa, do_you_have_office, banker_ref, have_you_heard_of_ruloans_before, where_or_how, what_is_the_purpose_of_joining_ruloans, bank_leave_duration, type_of_loans_in_previous_bank, previous_bank_department, previous_bank_verticle, home_address_house_number, home_address_area, home_address_city, home_address_state, home_address_pincode, office_address_house_number, office_address_area, office_address_city, office_address_state, office_address_pincode, salutation, company_name, gstin, signup_steps_completed } = data;
    let full_name = `${first_name}${middle_name ? " " + middle_name : ""}${last_name ? " " + last_name : ""} `;

    if (dsa_id) {
        let query = `UPDATE ru_direct_selling_agents SET hsn_hsc_number = ?, gst_registration_type = ?, channel_manager_code =?, signup_steps_completed =?, company_name =?, gstin =?, salutation =?, full_name =?, last_modified_by =?, first_name =?, middle_name =?, last_name =?, email_address =?, dsa_mobile_number =?, dsa_status =?, dsa_sub_status =?, gender =?, user_type =?, profession =?, date_of_birth =?, home_address_house_number =?, home_address_area =?, home_address_city =?, home_address_state =?, home_address_pincode =?, office_address_house_number =?, office_address_area =?, office_address_city =?, office_address_state =?, office_address_pincode =?, utm_main_source =? WHERE dsa_id =? `;
        let bindParams = [hsn_hsc_number || null, gst_registration_type || null, channel_manager_code || null, signup_steps_completed || null, company_name || null, gstin || null, salutation || null, full_name || null, last_modified_by || null, first_name || null, middle_name || null, last_name || null, email_address || null, dsa_mobile_number || null, dsa_status || null, dsa_sub_status || null, gender || null, user_type || null, profession || null, date_of_birth || null, home_address_house_number || null, home_address_area || null, home_address_city || null, home_address_state || null, home_address_pincode || null, office_address_house_number || null, office_address_area || null, office_address_city || null, office_address_state || null, office_address_pincode || null, utm_main_source || null, dsa_id];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    } else {
        let query = ` insert into ru_direct_selling_agents(hsn_hsc_number, gst_registration_type, dsa_id, channel_manager_code, signup_steps_completed, company_name, gstin, salutation, full_name, last_modified_by, first_name, middle_name, last_name, email_address, dsa_mobile_number, dsa_status, dsa_sub_status, gender, user_type, profession, date_of_birth, home_address_house_number, home_address_area, home_address_city, home_address_state, home_address_pincode, office_address_house_number, office_address_area, office_address_city, office_address_state, office_address_pincode, utm_main_source, signup_date) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) `;
        let bindParams = [hsn_hsc_number || null, gst_registration_type || null, dsa_id_new, channel_manager_code || null, signup_steps_completed || null, company_name || null, gstin || null, salutation || null, full_name || null, last_modified_by || null, first_name || null, middle_name || null, last_name || null, email_address || null, dsa_mobile_number || null, dsa_status || null, dsa_sub_status || null, gender || null, user_type || null, profession || null, date_of_birth || null, home_address_house_number || null, home_address_area || null, home_address_city || null, home_address_state || null, home_address_pincode || null, office_address_house_number || null, office_address_area || null, office_address_city || null, office_address_state || null, office_address_pincode || null, utm_main_source || null, formatSignupDate(new Date())];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    };

    if (dsa_id) {
        query = ` select * from ru_dsa_kyc_data  where dsa_id =? `;
        bindParams = [dsa_id];
        let dsa_kyc = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        dsa_kyc = dsa_kyc[0];
        if (dsa_kyc) {
            query = `UPDATE ru_dsa_kyc_data SET permanent_account_number =?, pan_full_name =?, dsa_mobile_number =? WHERE dsa_id =? `;
            bindParams = [permanent_account_number || null, full_name || null, dsa_mobile_number, dsa_id];
            await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
        } else {
            query = `insert into  ru_dsa_kyc_data (dsa_id,permanent_account_number,pan_full_name, dsa_mobile_number) values (?,?,?,?) `;
            bindParams = [dsa_id, permanent_account_number || null, full_name || null, dsa_mobile_number];
            await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
        }

    } else {
        query = ` insert into ru_dsa_kyc_data(dsa_id, permanent_account_number, pan_full_name, dsa_mobile_number) values(?,?,?,?) `
        bindParams = [dsa_id_new, permanent_account_number || null, full_name || null, dsa_mobile_number];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }

    if (dsa_id) {
        query = `UPDATE ru_dsa_leads SET utm_main_source =? WHERE dsa_id =? `;
        bindParams = [utm_main_source || null, dsa_id];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    } else {
        query = ` insert into ru_dsa_leads(dsa_id, utm_main_source) values(?,?) `
        bindParams = [dsa_id_new, utm_main_source || null];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }

    if (dsa_id) {
        query = `UPDATE ru_dsa_additional_information SET description =?, potential =?, alternate_mobile =?, has_done_loan_buisness =?, year_loan_buisness =?, personal_loan_payout =?, personal_loan_business_amount =?, business_loan_payout =?, business_loan_business_amount =?, housing_loan_payout =?, housing_loan_business_amount =?, loan_against_property_payout =?, loan_against_property_business_amount =?, gold_loan_payout =?, gold_loan_business_amount =?, car_loan_payout =?, car_loan_business_amount =?, msme_loan_payout =?, msme_loan_business_amount =?, education_loan_payout =?, education_loan_business_amount =?, project_loan_payout =?, project_loan_business_amount =?, professional_loan_payout =?, professional_loan_business_amount =?, od_or_credit_card_payout =?, od_or_credit_card_business_amount =?, working_capital_loan_payout =?, working_capital_loan_business_amount =?, do_you_have_connector_code =?, bank_or_nbfc_name_for_connector =?, other_bank_for_connector =?, do_you_have_dsa_code =?, bank_or_nbfc_name_for_dsa =?, do_you_refer_or_do_end_to_end_files =?, other_bank_for_dsa =?, do_you_have_office =?, banker_ref =?, have_you_heard_of_ruloans_before =?, where_or_how =?, what_is_the_purpose_of_joining_ruloans =?, bank_leave_duration =?, type_of_loans_in_previous_bank =?, previous_bank_department =?, previous_bank_verticle =? WHERE dsa_id =? `;
        bindParams = [description || null, potential || null, alternate_mobile || null, has_done_loan_buisness || null, year_loan_buisness || null, personal_loan_payout || null, personal_loan_business_amount || null, business_loan_payout || null, business_loan_business_amount || null, housing_loan_payout || null, housing_loan_business_amount || null, loan_against_property_payout || null, loan_against_property_business_amount || null, gold_loan_payout || null, gold_loan_business_amount || null, car_loan_payout || null, car_loan_business_amount || null, msme_loan_payout || null, msme_loan_business_amount || null, education_loan_payout || null, education_loan_business_amount || null, project_loan_payout || null, project_loan_business_amount || null, professional_loan_payout || null, professional_loan_business_amount || null, od_or_credit_card_payout || null, od_or_credit_card_business_amount || null, working_capital_loan_payout || null, working_capital_loan_business_amount || null, do_you_have_connector_code || null, bank_or_nbfc_name_for_connector || null, other_bank_for_connector || null, do_you_have_dsa_code || null, bank_or_nbfc_name_for_dsa || null, do_you_refer_or_do_end_to_end_files || null, other_bank_for_dsa || null, do_you_have_office || null, banker_ref || null, have_you_heard_of_ruloans_before || null, where_or_how || null, what_is_the_purpose_of_joining_ruloans || null, bank_leave_duration || null, type_of_loans_in_previous_bank || null, previous_bank_department || null, previous_bank_verticle || null, dsa_id];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    } else {
        query = ` insert into ru_dsa_additional_information(dsa_id, description, potential, alternate_mobile, has_done_loan_buisness, year_loan_buisness, personal_loan_payout, personal_loan_business_amount, business_loan_payout, business_loan_business_amount, housing_loan_payout, housing_loan_business_amount, loan_against_property_payout, loan_against_property_business_amount, gold_loan_payout, gold_loan_business_amount, car_loan_payout, car_loan_business_amount, msme_loan_payout, msme_loan_business_amount, education_loan_payout, education_loan_business_amount, project_loan_payout, project_loan_business_amount, professional_loan_payout, professional_loan_business_amount, od_or_credit_card_payout, od_or_credit_card_business_amount, working_capital_loan_payout, working_capital_loan_business_amount, do_you_have_connector_code, bank_or_nbfc_name_for_connector, other_bank_for_connector, do_you_have_dsa_code, bank_or_nbfc_name_for_dsa, do_you_refer_or_do_end_to_end_files, other_bank_for_dsa, do_you_have_office, banker_ref, have_you_heard_of_ruloans_before, where_or_how, what_is_the_purpose_of_joining_ruloans, bank_leave_duration, type_of_loans_in_previous_bank, previous_bank_department, previous_bank_verticle) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) `
        bindParams = [dsa_id_new, description || null, potential || null, alternate_mobile || null, has_done_loan_buisness || null, year_loan_buisness || null, personal_loan_payout || null, personal_loan_business_amount || null, business_loan_payout || null, business_loan_business_amount || null, housing_loan_payout || null, housing_loan_business_amount || null, loan_against_property_payout || null, loan_against_property_business_amount || null, gold_loan_payout || null, gold_loan_business_amount || null, car_loan_payout || null, car_loan_business_amount || null, msme_loan_payout || null, msme_loan_business_amount || null, education_loan_payout || null, education_loan_business_amount || null, project_loan_payout || null, project_loan_business_amount || null, professional_loan_payout || null, professional_loan_business_amount || null, od_or_credit_card_payout || null, od_or_credit_card_business_amount || null, working_capital_loan_payout || null, working_capital_loan_business_amount || null, do_you_have_connector_code || null, bank_or_nbfc_name_for_connector || null, other_bank_for_connector || null, do_you_have_dsa_code || null, bank_or_nbfc_name_for_dsa || null, do_you_refer_or_do_end_to_end_files || null, other_bank_for_dsa || null, do_you_have_office || null, banker_ref || null, have_you_heard_of_ruloans_before || null, where_or_how || null, what_is_the_purpose_of_joining_ruloans || null, bank_leave_duration || null, type_of_loans_in_previous_bank || null, previous_bank_department || null, previous_bank_verticle || null];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }

    return;
};

const getDsaChildRecursively = async (dsa_mobile_number, column = "dsa_mobile_number") => {
    let query = ` WITH RECURSIVE DSAHierarchy AS(
            SELECT dsa_mobile_number, partner_code, dsa_id
        FROM ru_direct_selling_agents
        WHERE dsa_mobile_number = ?
            UNION ALL
        SELECT t.dsa_mobile_number, t.partner_code, t.dsa_id
        FROM ru_direct_selling_agents t
        INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
        )
      SELECT dsa_mobile_number, dsa_id
      FROM DSAHierarchy;
        `;
    let data = await _db2.query(query, { replacements: [dsa_mobile_number], type: QueryTypes.SELECT });
    let arr = [];

    for (i = 0; i < data?.length; i++) {
        arr.push(data[i][column])
    }

    return arr;
};

const getDsaParentRecursively = async (dsaMobileNumber, column) => {
    const hierarchyQuery =
        `WITH RECURSIVE DSAHierarchy AS (
            SELECT dsa_mobile_number, partner_code, dsa_id,
            case when concat(first_name, ' ', last_name) is null then dsa_mobile_number else concat(first_name, ' ', last_name) end as full_name
      FROM ru_direct_selling_agents
      WHERE dsa_mobile_number = ?
      UNION ALL
      SELECT t.dsa_mobile_number, t.partner_code, t.dsa_id,
      case when concat(t.first_name, ' ', t.last_name) is null then t.dsa_mobile_number else concat(t.first_name, ' ', t.last_name) end as full_name
      FROM ru_direct_selling_agents t
      INNER JOIN DSAHierarchy d ON t.dsa_mobile_number = d.partner_code
      WHERE t.dsa_mobile_number IS NOT NULL
  )
  SELECT dsa_id, dsa_mobile_number, full_name
  FROM DSAHierarchy;`;

    let results = await _db2.query(hierarchyQuery, {
        replacements: [dsaMobileNumber],
        type: QueryTypes.SELECT,
    });
    results = results.map(row => row[column || "dsa_id"]);
    if (!column) {
        results.push(process.env.KM_DSA_ID);
    };

    return results;
};

const getDsaChildVendorsRecursively = async (dsa_mobile_number) => {
    let query = ` 
    WITH RECURSIVE DSAHierarchy AS(
                SELECT dsa.dsa_mobile_number as dsa_mobile_number, dsa.partner_code as partner_code,dsa.dsa_id as dsa_id,dsa_kyc.permanent_account_number as pan ,dsa_kyc.ns_hierarchy as ns_hierarchy, dsa.is_blacklisted , dsa.is_deleted , dsa.business_head_code , dsa_kyc.class_id, dsa.materialized_path, dsa.hierarchy_crm, p.dsa_id as partner_id
            FROM ru_direct_selling_agents dsa left join ru_dsa_kyc_data dsa_kyc on dsa.dsa_id = dsa_kyc.dsa_id left join ru_direct_selling_agents p on dsa.partner_code = p.dsa_mobile_number
            WHERE dsa.dsa_mobile_number = ?
                UNION ALL
            SELECT t.dsa_mobile_number as dsa_mobile_number , t.partner_code as partner_code ,t.dsa_id as dsa_id ,dsa_kyc.permanent_account_number as pan ,dsa_kyc.ns_hierarchy as ns_hierarchy, t.is_blacklisted , t.is_deleted , t.business_head_code , dsa_kyc.class_id, t.materialized_path, t.hierarchy_crm, p.dsa_id AS partner_id 
            FROM ru_direct_selling_agents t left join ru_dsa_kyc_data dsa_kyc on t.dsa_id = dsa_kyc.dsa_id left join ru_direct_selling_agents p on t.partner_code = p.dsa_mobile_number 
            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
            )
          SELECT dsa_mobile_number,partner_code,dsa_id,pan,ns_hierarchy,is_blacklisted,is_deleted,business_head_code , class_id, materialized_path, hierarchy_crm, partner_id
         FROM DSAHierarchy;    
        `;
    let data = await _db2.query(query, { replacements: [dsa_mobile_number], type: QueryTypes.SELECT });
    // let arr = [];

    // for (i = 0; i < data?.length; i++) {
    //     arr.push(data[i]?.dsa_mobile_number)
    // }
    return data;
};


const getAllPendingHlApplications = async (count_only, where, search, offset, limit, childPhones, dsa_mobile_number) => {
    let bindParams = [];
    let query = ` select rhla.*, c.address_pincode, bh.full_name as business_head_name, c.full_name as customer_name, d.full_name as dsa_name, rdp.profession_name, rhlps.application_status_description from ru_home_loan_applications rhla left join ru_customers c on rhla.customer_mobile_number = c.customer_mobile_number left join ru_direct_selling_agents d on rhla.dsa_mobile_number = d.dsa_mobile_number left join ru_direct_selling_agents bh on d.business_head_code = bh.dsa_mobile_number left join ru_piramal_home_loan_applications pl on pl.application_id = rhla.application_id left join ru_dsa_professions rdp on rdp.id = rhla.profession_type left join ru_home_loan_applications_status_list rhlps on rhlps.application_status_id = rhla.application_status`;
    let queryCount = ' SELECT count(*) as totalCount from ru_home_loan_applications rhla left join ru_piramal_home_loan_applications pl on pl.application_id = rhla.application_id ';
    let and = false;

    if (where?.length > 1 || search?.length) {
        queryCount += ` left join ru_customers c on rhla.customer_mobile_number = c.customer_mobile_number left join ru_direct_selling_agents d on rhla.dsa_mobile_number = d.dsa_mobile_number left join ru_direct_selling_agents bh on d.business_head_code = bh.dsa_mobile_number left join ru_dsa_professions rdp on rdp.id = rhla.profession_type left join ru_home_loan_applications_status_list rhlps on rhlps.application_status_id = rhla.application_status`;
    };

    if (childPhones) {
        query += ` ${and === false ? "where" : "and"} rhla.dsa_mobile_number in (
            WITH RECURSIVE DSAHierarchy AS(
                SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
                UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
            ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              )`;
        queryCount += ` ${and === false ? "where" : "and"} rhla.dsa_mobile_number in (
    WITH RECURSIVE DSAHierarchy AS(
        SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
        UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
    ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              )`;
        bindParams.push(childPhones);
        and = true;
    };

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
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += ` order by rhla.created_at desc limit ${offset},${limit} `;
    let totalCount = [{ totalCount: limit }]
    let lntApplications = [];

    if (count_only) {
        totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    } else {
        lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        if (dsa_mobile_number) {
            totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
        };
    };

    return { lntApplications: lntApplications, totalCount: totalCount[0].totalCount };
};

const getAllPiramalLapApplications = async (count_only, where, search, offset, limit, childPhones) => {
    let bindParams = [];
    let query = ` select sp.sp_name, sp.sp_mobile, rlpa.lead_id, rlpa.reject_reason, concat(rlpa.first_name, ' ', rlpa.last_name) as full_name, bh.full_name as business_head_name, d.full_name as dsa_name, rlpa.dsa_mobile_number, rlpa.application_id, rlpa.first_name, rlpa.middle_name, rlpa.last_name, rlpa.pan, rlpa.mobile_number, rlpa.profession, rlpa.occupation_type, rlpa.requested_amount, rlpa.lead_status as stage, rlpa.risk_decision_type as sub_stage, rlpa.disburse_amount, rlpa.disburse_date, rlpa.approved_tenure, rlpa.status as lead_status, rlpa.created_at, rlpa.updated_at from ru_piramal_lap_applications rlpa left join ru_direct_selling_agents d on rlpa.dsa_mobile_number = d.dsa_mobile_number left join ru_direct_selling_agents bh on d.business_head_code = bh.dsa_mobile_number left join ru_branch_sales_people sp on sp.id = rlpa.sales_person_id `;
    let queryCount = ' SELECT count(*) as totalCount from ru_piramal_lap_applications rlpa ';
    let and = false;

    if (Boolean(where?.length) || search?.length) {
        queryCount += ` left join ru_direct_selling_agents d on rlpa.dsa_mobile_number = d.dsa_mobile_number left join ru_direct_selling_agents bh on d.business_head_code = bh.dsa_mobile_number left join ru_branch_sales_people sp on sp.id = rlpa.sales_person_id `;
    };

    if (childPhones) {
        query += ` ${and === false ? "where" : "and"} rlpa.dsa_mobile_number in (
    WITH RECURSIVE DSAHierarchy AS(
        SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
        UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
    ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              )`;
        queryCount += ` ${and === false ? "where" : "and"} rlpa.dsa_mobile_number in (
    WITH RECURSIVE DSAHierarchy AS(
        SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
        UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
    ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              )`;
        bindParams.push(childPhones);
        and = true;
    };

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
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += ` order by rlpa.created_at desc limit ${offset},${limit} `;
    let totalCount = [{ totalCount: limit }];
    let lntApplications = [];

    if (count_only) {
        totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    } else {
        lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    };
    return { lntApplications: lntApplications, totalCount: totalCount[0].totalCount };
};

const getAllPendingLAPApplications = async (count_only, where, search, offset, limit, childPhones, dsa_mobile_number) => {
    let bindParams = [];
    let query = ` select rhla.*, c.address_pincode, bh.full_name as business_head_name, c.full_name as customer_name, d.full_name as dsa_name, rdp.profession_name, rhlps.application_status_description from ru_l_a_p_applications rhla left join ru_customers c on rhla.customer_mobile_number = c.customer_mobile_number left join ru_direct_selling_agents d on rhla.dsa_mobile_number = d.dsa_mobile_number left join ru_direct_selling_agents bh on d.business_head_code = bh.dsa_mobile_number left join ru_piramal_lap_applications pl on pl.application_id = rhla.application_id left join ru_dsa_professions rdp on rdp.id = rhla.profession_type left join ru_home_loan_applications_status_list rhlps on rhlps.application_status_id = rhla.application_status`;
    let queryCount = ' SELECT count(*) as totalCount from ru_l_a_p_applications rhla left join ru_piramal_lap_applications pl on pl.application_id = rhla.application_id ';
    let and = false;

    console.log(where?.length > 1)

    if (Boolean(where?.length > 1) || search?.length) {
        queryCount += ` left join ru_customers c on rhla.customer_mobile_number = c.customer_mobile_number left join ru_direct_selling_agents d on rhla.dsa_mobile_number = d.dsa_mobile_number left join ru_direct_selling_agents bh on d.business_head_code = bh.dsa_mobile_number left join ru_home_loan_applications_status_list rhlps on rhlps.application_status_id = rhla.application_status left join ru_dsa_professions rdp on rdp.id = rhla.profession_type`;
    };

    if (childPhones) {
        query += ` ${and === false ? "where" : "and"} rhla.dsa_mobile_number in (
    WITH RECURSIVE DSAHierarchy AS(
        SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
        UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
    ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              )`;
        queryCount += ` ${and === false ? "where" : "and"} rhla.dsa_mobile_number in (
    WITH RECURSIVE DSAHierarchy AS(
        SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
        UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
    ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              )`;
        bindParams.push(childPhones);
        and = true;
    };

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
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += ` order by rhla.created_at desc limit ${offset},${limit} `;
    let totalCount = [{ totalCount: limit }];
    let lntApplications = [];

    if (count_only) {
        totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    } else {
        lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        if (dsa_mobile_number) {
            totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
        };
    };

    return { lntApplications: lntApplications, totalCount: totalCount[0].totalCount };
};

const getAllCCApplications = async (count_only, where, search, offset, limit, childPhones, send_combined_count) => {
    let bindParams = [];
    let db_name = process.env.ENVIRONMENT == "dev" ? `ruloans-service` : `RUService`;
    let query = " select cc.*, c.customer_id, c.permanent_account_number, c.full_name, c.customer_mobile_number as mobile_number, d.full_name as dsa_name, d.dsa_mobile_number, bh.full_name as business_head_name, ca.city, ca.pin_code from ru_cc_applications cc left join ru_customers c on c.customer_id = cc.customer_id left join ru_direct_selling_agents d on d.dsa_id = cc.dsa_id left join ru_direct_selling_agents bh on bh.dsa_mobile_number = d.business_head_code left join ru_customer_addresses ca on ca.id = cc.address_id";
    let queryCount = ' SELECT  count(*) as totalCount from ru_cc_applications cc left join ru_customer_addresses ca on ca.id = cc.address_id ';
    let and = false;

    if (checkForMainTable(where, ["cc", "c", "d", "bh"]) || search?.length) {
        queryCount += " left join ru_customers c on c.customer_id = cc.customer_id left join ru_direct_selling_agents d on d.dsa_id = cc.dsa_id left join ru_direct_selling_agents bh on bh.dsa_mobile_number = d.business_head_code ";
    };

    if (childPhones) {
        query += ` ${and === false ? "where" : "and"} cc.dsa_id in (
    WITH RECURSIVE DSAHierarchy AS(
        SELECT dsa_mobile_number, partner_code, dsa_id
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
        UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code, t.dsa_id
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
    ) 
                SELECT dsa_id
                FROM DSAHierarchy
              )`;
        queryCount += ` ${and === false ? "where" : "and"} cc.dsa_id in (
    WITH RECURSIVE DSAHierarchy AS(
        SELECT dsa_mobile_number, partner_code, dsa_id
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ?
        UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code, t.dsa_id
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
    ) 
                SELECT dsa_id
                FROM DSAHierarchy
              )`;
        bindParams.push(childPhones);
        and = true;
    };

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
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += ` order by cc.updated_at desc limit ${offset},${limit} `;
    let totalCount = [{ totalCount: limit }]
    let lntApplications = [];

    if (!send_combined_count) {
        if (count_only) {
            totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
        } else {
            lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        };
    } else {
        totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
        lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    };


    if (lntApplications?.length) {
        const productIds = lntApplications.map(app => app.product_id);
        let query = ` select p.*, lt.alias as loan_type from ru_loans_products p inner join ru_loans_types lt on lt.id = p.loan_type_id where p.id in (${productIds}) `;
        let products = await _db3.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        for (i = 0; i < lntApplications?.length; i++) {
            const product = products.find(p => p.id == lntApplications[i]?.product_id);
            lntApplications[i]["product_description"] = product ? product["product_name"] : "Pending";
            lntApplications[i]["product_vendor"] = product ? product["product_vendor"] : "Pending";
            lntApplications[i]["journey_type"] = product ? product["journey_type"] : "Pending";
            lntApplications[i]["loan_type"] = product ? product["loan_type"] : "Pending";
        }
    };

    return { lntApplications: lntApplications, totalCount: totalCount[0].totalCount };
};

const deleteInvoice = async (invoice_id) => {
    let bindParams = [invoice_id];
    let query = ` update ru_invoice set is_deleted = true where invoice_id = ?  `;
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.DELETE });
};

const getAllInvoices = async (offset, limit, where) => {
    let bindParams = [];
    let query = ` select ri.*, d.dsa_id as vendor_id, case when ri.has_reverse_invoice = 0 then "No" else "Yes" end as has_reverse_invoice_value, case when ri.status = 0 then "Pending" when ri.status = 1 then "Reverse Invoice Recieved" else "Completed" end as status_value, (ri.base_payout_amount + ri.cgst_amount + ri.sgst_amount + ri.igst_amount) as amount_inc_gst, d.gstin from ru_invoice ri left join ru_direct_selling_agents d on ri.vendor_mobile_number = binary d.dsa_mobile_number ${where || ""} `;
    let queryCount = ` SELECT count(*) as totalCount from ru_invoice ri left join ru_direct_selling_agents d on ri.vendor_mobile_number = binary d.dsa_mobile_number ${where || ""} `;

    query += ` order by ri.created_at desc limit ${offset},${limit} `;

    totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    return { lntApplications: lntApplications, totalCount: totalCount[0].totalCount };
};

const getAllCCProducts = async (where) => {
    let query = ` SELECT p.*, 
            CASE 
                WHEN p.status = "0" THEN CONCAT(p.product_description, ' (Inactive)')
                WHEN p.status = "4" THEN CONCAT(p.product_description, ' (Limited Access)')
                WHEN p.status = "2" THEN CONCAT(p.product_description, ' (UAT Active)')
                ELSE p.product_description 
            END AS product_description,
            CASE 
                WHEN p.status = "0" THEN CONCAT(p.product_name, ' (Inactive)')
                WHEN p.status = "4" THEN CONCAT(p.product_name, ' (Limited Access)')
                WHEN p.status = "2" THEN CONCAT(p.product_name, ' (UAT Active)')
                ELSE p.product_name 
            END AS product_name
        FROM ru_loans_products p 
        LEFT JOIN ru_loans_types t ON t.id = p.loan_type_id 
    ${where}`;

    let lntApplications = await _db3.query(query, { type: QueryTypes.SELECT });
    return lntApplications;
};

const updateInvoiceNumber = async (invoice_number, expense_id) => {
    const rows = await _db2.query(
        `SELECT 1 FROM ru_dsa_expenses WHERE expense_id = ? LIMIT 1`,
        { replacements: [expense_id], type: QueryTypes.SELECT }
    );
    if (!rows?.length) {
        return false;
    }

    await _db2.query(
        `UPDATE ru_dsa_expenses SET invoice_number = ? WHERE expense_id = ?`,
        { replacements: [invoice_number, expense_id], type: QueryTypes.UPDATE }
    );
    return true;
};

const acceptOrRejectInvoice = async (status, remark, invoice_id) => {
    let query = " update ru_dsa_expenses set status = ?, memo = ? where id = ? ";
    let bindParams = [status, remark, invoice_id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE })
    return;
};

const uploadReverseInvoice = async (url, invoice_id) => {
    let query = " update ru_invoice set reverse_invoice_url = ?, status =?,  has_reverse_invoice = ?, is_rejected = ? where invoice_id = ? ";
    let bindParams = [url, 1, 1, 0, invoice_id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE })
    return;
};

const getBasicDetails = async (url, invoice_id) => {
    let query = " select * from ru_ruloans_basic_details ";
    let detials = await _db2.query(query, { replacements: [], type: QueryTypes.SELECT })
    return detials[0];
};

const getBankDetailsByPan = async (pan) => {
    let query = " select * from  ru_dsa_bank_accounts rdba left join ru_dsa_kyc_data rdkd  on   binary rdba.dsa_id = binary rdkd.dsa_id where rdkd.permanent_account_number = ? ";
    let detials = await _db2.query(query, { replacements: [pan], type: QueryTypes.SELECT })
    return detials[0];
};

const getDsaBHName = async (dsa_mobile_number) => {
    let query = " select bh.full_name as name from ru_direct_selling_agents rdsa left join ru_direct_selling_agents bh on rdsa.business_head_code = bh.dsa_mobile_number where rdsa.dsa_mobile_number = ? ";
    let detials = await _db2.query(query, { replacements: [dsa_mobile_number], type: QueryTypes.SELECT })
    return detials[0] ? detials[0].name : null;
};

const getRefreshPayoutStatusForDsa = async (phone) => {
    let query = " select * from payouts order by updated_at desc ";
    let payouts = await sequelize.query(query, { replacements: [], type: QueryTypes.SELECT })
    payouts = payouts[0];
    query = " select * from lead_payout where phone = ? and created_at < ? ";
    let lead_payout = await sequelize.query(query, { replacements: [phone, payouts.updated_at], type: QueryTypes.SELECT })
    lead_payout = lead_payout[0];
    return lead_payout ? true : false;
};

const getAllDsaDopdown = async (offset, limit, where, get_company = false, company_where = "") => {
    let bindParams = [];
    let query = "";
    let queryCount = "";

    const match = where ? where.match(/and\s+\(\s*d\.full_name\s+like\s+'([^']+)%'\s+or\s+d\.dsa_mobile_number\s+like\s+'([^']+)%'\s+or\s+kyc\.permanent_account_number\s+like\s+'([^']+)%'\s*\)/i) : null;

    if (match) {
        const searchTerm = match[1];
        let baseWhere = where.replace(match[0], '').trim();
        if (baseWhere.endsWith("and")) {
            baseWhere = baseWhere.slice(0, -3).trim();
        }

        const dsaColumns = `d.assigning_payout_percentage, d.dsa_id, kyc.netsuite_vendor_id, kyc.permanent_account_number, kyc.class_id, kyc.ns_hierarchy, d.dsa_mobile_number, d.partner_code, d.business_head_code, COALESCE(d.full_name, CONCAT_WS(' ', d.first_name, d.middle_name, d.last_name), d.dsa_mobile_number) as full_name`;

        const branch1 = `select ${dsaColumns} from ru_direct_selling_agents d left join ru_dsa_kyc_data kyc on kyc.dsa_id = d.dsa_id ${baseWhere} and d.full_name like '${searchTerm}%'`;
        const branch2 = `select ${dsaColumns} from ru_direct_selling_agents d left join ru_dsa_kyc_data kyc on kyc.dsa_id = d.dsa_id ${baseWhere} and d.dsa_mobile_number like '${searchTerm}%'`;
        const branch3 = `select ${dsaColumns} from ru_direct_selling_agents d inner join ru_dsa_kyc_data kyc on kyc.dsa_id = d.dsa_id ${baseWhere} and kyc.permanent_account_number like '${searchTerm}%'`;

        query = `select dsa_main.*, COALESCE(u.isDeleted, 0) as isDeleted, false as is_company from (
            ${branch1}
            UNION
            ${branch2}
            UNION
            ${branch3}
        ) as dsa_main left join (
            select phone, MIN(isDeleted) as isDeleted 
            from CRMTest.users 
            group by phone
        ) u on u.phone = dsa_main.dsa_mobile_number`;

        const dsaCountPart = `select count(*) as totalCount from (
            select d.dsa_id from ru_direct_selling_agents d left join ru_dsa_kyc_data kyc on kyc.dsa_id = d.dsa_id ${baseWhere} and d.full_name like '${searchTerm}%'
            UNION
            select d.dsa_id from ru_direct_selling_agents d left join ru_dsa_kyc_data kyc on kyc.dsa_id = d.dsa_id ${baseWhere} and d.dsa_mobile_number like '${searchTerm}%'
            UNION
            select d.dsa_id from ru_direct_selling_agents d inner join ru_dsa_kyc_data kyc on kyc.dsa_id = d.dsa_id ${baseWhere} and kyc.permanent_account_number like '${searchTerm}%'
        ) as u`;

        if (get_company) {
            query += ` 
            UNION ALL
            select d.assigning_payout_percentage, rc.company_id as dsa_id, ns_internal_id as netsuite_vendor_id, rc.pan as permanent_account_number, null as class_id, null as ns_hierarchy, d.dsa_mobile_number, d.partner_code as partner_code, d.business_head_code as business_head_code, rc.name as full_name, 0 as isDeleted, true as is_company from ru_companies rc left join ru_direct_selling_agents d on d.dsa_id = rc.registered_by ${company_where || ""} `;

            queryCount = `
            select sum(totalCount) as totalCount from (
                select totalCount from (${dsaCountPart}) as sub_cnt
                UNION ALL
                select count(*) as totalCount from ru_companies rc left join ru_direct_selling_agents d on d.dsa_id = rc.registered_by ${company_where || ""}
            ) as combined_counts `;
        } else {
            queryCount = dsaCountPart;
        }
    } else {
        query = `select d.assigning_payout_percentage, d.dsa_id, kyc.netsuite_vendor_id, kyc.permanent_account_number, kyc.class_id, kyc.ns_hierarchy, d.dsa_mobile_number,d.partner_code,d.business_head_code, COALESCE(d.full_name, CONCAT_WS(' ', d.first_name, d.middle_name, d.last_name), d.dsa_mobile_number) as full_name, COALESCE(u.isDeleted, 0) as isDeleted, false as is_company from ru_direct_selling_agents d left join ru_dsa_kyc_data kyc on kyc.dsa_id = d.dsa_id left join (select phone, MIN(isDeleted) as isDeleted from CRMTest.users group by phone) u on u.phone = d.dsa_mobile_number ${where || ""} `;
        queryCount = `select count(*) as totalCount from ru_direct_selling_agents d left join ru_dsa_kyc_data kyc on kyc.dsa_id = d.dsa_id ${where || ""} `;

        if (get_company) {
            query += ` 
            UNION ALL
            select d.assigning_payout_percentage, rc.company_id as dsa_id, ns_internal_id as netsuite_vendor_id, rc.pan as permanent_account_number, null as class_id, null as ns_hierarchy, d.dsa_mobile_number, d.partner_code as partner_code, d.business_head_code as business_head_code, rc.name as full_name, 0 as isDeleted, true as is_company from ru_companies rc left join ru_direct_selling_agents d on d.dsa_id = rc.registered_by ${company_where || ""} `;

            queryCount = `
            select sum(totalCount) as totalCount from (
                select count(*) as totalCount from ru_direct_selling_agents d left join ru_dsa_kyc_data kyc on kyc.dsa_id = d.dsa_id ${where || ""}
                UNION ALL
                select count(*) as totalCount from ru_companies rc left join ru_direct_selling_agents d on d.dsa_id = rc.registered_by ${company_where || ""}
            ) as combined_counts `;
        }
    }

    // Add ORDER BY and limit
    // Use full_name (column alias) instead of d.full_name to work with UNION queries
    // Order by full_name (non-empty values first, then empty/null values last)
    query += ` ORDER BY (full_name IS NULL OR full_name = '') ASC, full_name ASC limit ${offset},${limit} `;

    const totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    const lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });


    return { lntApplications: lntApplications, totalCount: totalCount[0].totalCount };
};

const getAllDsaDopdownNsHierarchyUniqueClass = async (offset, limit, where) => {
    let bindParams = [];
    const fromJoin = ` from ru_direct_selling_agents d inner join ru_dsa_kyc_data kyc on kyc.dsa_id = d.dsa_id ${where || ""} `;
    const classFilter = ` and kyc.class_id is not null and trim(coalesce(kyc.class_id, '')) <> '' `;

    const query = `select kyc.class_id, max(kyc.ns_hierarchy) as ns_hierarchy ${fromJoin} ${classFilter} group by kyc.class_id order by ns_hierarchy asc, kyc.class_id asc limit ${offset},${limit} `;

    const queryCount = `select count(*) as totalCount from ( select kyc.class_id ${fromJoin} ${classFilter} group by kyc.class_id ) as unique_class_rows `;

    const totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    const lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    return { lntApplications: lntApplications, totalCount: totalCount[0].totalCount };
};

const getAllVendor = async (offset, limit, where, skipOrderBy = false) => {
    let bindParams = [];
    // Using materialized path for hierarchy filtering (passed in where clause)
    let query = `select 
       d.dsa_id,
       kyc.netsuite_vendor_id,
       kyc.permanent_account_number,
       kyc.class_id,
       kyc.ns_hierarchy,
       d.dsa_mobile_number,
       d.partner_code,
       d.business_head_code,
       d.full_name

from ru_direct_selling_agents d left join ru_dsa_kyc_data kyc on kyc.dsa_id = d.dsa_id
   ${where || ""} `;

    if (skipOrderBy) {
        query += ` limit ${offset},${limit} `;
    } else {
        query += ` ORDER BY d.full_name limit ${offset},${limit} `;
    }
    const queryCount = `select count(*) as totalCount from ru_direct_selling_agents d left join ru_dsa_kyc_data kyc on kyc.dsa_id = d.dsa_id ${where || ""} `;

    const [lntApplications, totalCountResult] = await Promise.all([
        _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT }),
        _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT })
    ]);

    return {
        lntApplications,
        totalCount: Array.isArray(totalCountResult) && totalCountResult.length ? totalCountResult[0]?.totalCount || 0 : 0
    };
};

const getLoggedInUserDsaAndBhDetails = async (userId) => {
    let additionalDsaDetails = [];
    try {
        let userQuery = `SELECT dsa_id FROM CRMTest.users WHERE id = uuid_to_bin(?) AND dsa_id IS NOT NULL`;
        let userResult = await _db2.query(userQuery, {
            replacements: [userId],
            type: QueryTypes.SELECT
        });

        if (userResult && userResult.length > 0 && userResult[0].dsa_id) {
            // Get logged-in user's DSA details
            let dsaQuery = `SELECT 
                d.dsa_id,
                d.materialized_path,
                kyc.netsuite_vendor_id,
                kyc.permanent_account_number,
                kyc.class_id,
                kyc.ns_hierarchy,
                d.dsa_mobile_number,
                d.partner_code,
                d.business_head_code,
                d.full_name
            FROM ru_direct_selling_agents d 
            LEFT JOIN ru_dsa_kyc_data kyc ON kyc.dsa_id = d.dsa_id
            WHERE d.dsa_id = ? AND d.is_deleted = 0`;

            let dsaResult = await _db2.query(dsaQuery, {
                replacements: [userResult[0].dsa_id],
                type: QueryTypes.SELECT
            });

            if (dsaResult && dsaResult.length > 0) {
                additionalDsaDetails.push(dsaResult[0]);

                // Get business head's DSA details if business_head_code exists
                let bhMobileNumber = dsaResult[0].business_head_code;
                if (bhMobileNumber) {
                    let bhQuery = `SELECT 
                        d.dsa_id,
                        kyc.netsuite_vendor_id,
                        kyc.permanent_account_number,
                        kyc.class_id,
                        kyc.ns_hierarchy,
                        d.dsa_mobile_number,
                        d.partner_code,
                        d.business_head_code,
                        d.full_name
                    FROM ru_direct_selling_agents d 
                    LEFT JOIN ru_dsa_kyc_data kyc ON kyc.dsa_id = d.dsa_id
                    WHERE d.dsa_mobile_number = ? AND d.is_deleted = 0`;

                    let bhResult = await _db2.query(bhQuery, {
                        replacements: [bhMobileNumber],
                        type: QueryTypes.SELECT
                    });

                    if (bhResult && bhResult.length > 0) {
                        additionalDsaDetails.push(bhResult[0]);
                    }
                }
            }
        }
    } catch (err) {
        // Error handling - could be logged if needed
    }

    return additionalDsaDetails;
};

const getLoggedInDsaDetailsForDropdown = async (dsaId) => {
    try {
        let dsaQuery = `SELECT 
            d.dsa_id,
            kyc.netsuite_vendor_id,
            kyc.permanent_account_number,
            kyc.class_id,
            kyc.ns_hierarchy,
            d.dsa_mobile_number,
            d.partner_code,
            d.business_head_code,
            d.full_name,
            d.user_type
        FROM ru_direct_selling_agents d 
        LEFT JOIN ru_dsa_kyc_data kyc ON kyc.dsa_id = d.dsa_id
        WHERE d.dsa_id = ? AND d.is_deleted = 0`;

        let dsaResult = await _db2.query(dsaQuery, {
            replacements: [dsaId],
            type: QueryTypes.SELECT
        });

        return dsaResult && dsaResult.length > 0 ? dsaResult[0] : null;
    } catch (err) {
        return null;
    }
};

const getDsaPartner = async (partner_code) => {
    const query = `
        SELECT
            dsa.dsa_id,
            dsa.full_name,
            dsa.dsa_mobile_number,
            dsa.business_head_code,
            kyc.class_id
        FROM
            ru_direct_selling_agents AS dsa
        LEFT JOIN
            ru_dsa_kyc_data AS kyc
        ON
            dsa.dsa_id = kyc.dsa_id
        WHERE
            dsa.dsa_mobile_number = ?;
    `;

    const data = await _db2.query(query, {
        replacements: [partner_code],
        type: QueryTypes.SELECT
    });

    return data[0] || null;
};

const getAllGlobalConfiguration = async (offset, limit, where, setting_key) => {
    if (setting_key) {
        const settingKeys = setting_key.split(',').map(k => k.trim()).filter(Boolean);

        const query = `
            SELECT * FROM ru_settings 
            WHERE setting_key IN (:settingKeys)
        `;

        const lntApplications = await _db2.query(query, {
            replacements: { settingKeys },
            type: QueryTypes.SELECT
        });

        return {
            lntApplications: settingKeys.length === 1
                ? lntApplications[0] || null
                : lntApplications
        };
    }

    let query = `SELECT * FROM ru_settings ${where || ""}`;
    let queryCount = `SELECT count(*) as totalCount FROM ru_settings ${where || ""}`;

    query += ` ORDER BY created_at DESC LIMIT ${offset}, ${limit}`;

    const totalCount = await _db2.query(queryCount, { type: QueryTypes.SELECT });
    const lntApplications = await _db2.query(query, { type: QueryTypes.SELECT });

    return {
        lntApplications,
        totalCount: totalCount[0].totalCount
    };
};

const CreateEditGlobalConfiguration = async (data) => {
    let { id, key, value } = data;
    if (id) {
        let query = ` update ru_settings set setting_key=?, setting_value=?, updated_at=? where id=? `;
        let bindParams = [key, value, new Date(), id];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    } else {
        let query = ` insert into ru_settings(setting_key, setting_value, updated_at, created_at) values(?,?,?,?) `;
        let bindParams = [key, value, new Date(), new Date()];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }
    return;
};

const DeleteGlobalConfiguration = async (data) => {
    let { id } = data;
    let query = ` delete from ru_settings where id=? `;
    let bindParams = [id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.DELETE });
    return;
};

const getDsaUsersLists = async (filter, offset = 0, limit = 100) => {
    let query = `${filter?.includes("cl.") ? ` WITH recent_calls AS (
    SELECT cl.user_id, MAX(cl.createdAt) AS last_call
    FROM CRMTest.call_logs cl
    WHERE cl.call_status = '21'
    GROUP BY cl.user_id
    ) `: ""}
    select c.* from ru_direct_selling_agents c `;
    if (filter) {
        query += ` LEFT JOIN ru_direct_selling_agents cm ON c.channel_manager_code = cm.dsa_mobile_number
    LEFT JOIN ru_dsa_kyc_data k ON c.dsa_id = k.dsa_id
    LEFT JOIN picklist_values pvs ON c.dsa_status = pvs.id
    LEFT JOIN ru_companies rc ON rc.company_id = c.company_id
    LEFT JOIN ru_direct_selling_agents bh ON c.business_head_code = bh.dsa_mobile_number
    LEFT JOIN ru_direct_selling_agents p ON c.partner_code = p.dsa_mobile_number
    ${filter?.includes("cl.") ? `LEFT JOIN recent_calls cl ON cl.user_id = c.dsa_id` : ""}
    LEFT JOIN picklist_values pvss ON c.dsa_sub_status = pvss.id
    LEFT JOIN ru_referrals rf ON rf.referred_id = c.dsa_id LEFT JOIN ru_direct_selling_agents rfp ON rfp.dsa_id = rf.referrer_id where ${filter} `
    }
    query += `limit ${offset},${limit} `
    let data = await _db2.query(query, { replacements: [], type: QueryTypes.SELECT });
    return data;
};

const getDsaUsersListCount = async (filter) => {
    let query = ` WITH recent_calls AS (
                 SELECT cl.user_id, MAX(cl.createdAt) AS last_call
                 FROM CRMTest.call_logs cl
                 WHERE cl.call_status = '21'
                 GROUP BY cl.user_id
                 ) 
                 select count(distinct c.dsa_id) as totalCount from ru_direct_selling_agents c `;
    if (filter) {
        query += ` LEFT JOIN ru_direct_selling_agents cm ON c.channel_manager_code = cm.dsa_mobile_number 
                   LEFT JOIN ru_dsa_kyc_data k ON c.dsa_id = k.dsa_id 
                   LEFT JOIN picklist_values pvs ON c.dsa_status = pvs.id
                   LEFT JOIN ru_companies rc ON rc.company_id = c.company_id
                   LEFT JOIN ru_direct_selling_agents bh ON c.business_head_code = bh.dsa_mobile_number
                   LEFT JOIN ru_direct_selling_agents p ON c.partner_code = p.dsa_mobile_number
                   LEFT JOIN recent_calls cl ON cl.user_id = c.dsa_id
                   LEFT JOIN picklist_values pvss ON c.dsa_sub_status = pvss.id
                   LEFT JOIN ru_referrals rf ON rf.referred_id = c.dsa_id LEFT JOIN ru_direct_selling_agents rfp ON rfp.dsa_id = rf.referrer_id where ${filter} `
    }

    let data = await _db2.query(query, { replacements: [], type: QueryTypes.SELECT });
    return data;
};

const getDsaUsersListsBulkCalling = async (filter) => {
    let query = ` select dsa_mobile_number as mobile_number , full_name , email_address from ru_direct_selling_agents c where ${filter} `;
    let data = await _db2.query(query, { replacements: [], type: QueryTypes.SELECT });
    return data
};

const getCustomerFirebaseTokens = async (filter, offset, limit) => {
    let query = ` select cm.firebase_token , c.id from ru_customer_metas cm join ru_customers c on cm.customer_id = c.customer_id `;
    if (filter) {
        query += ` LEFT JOIN ru_direct_selling_agents dsa ON c.dsa_mobile_number = dsa.dsa_mobile_number 
                    LEFT JOIN ru_direct_selling_agents sp ON c.sp_mobile_number = sp.dsa_mobile_number where ${filter} `;
    }
    query += `limit ${offset},${limit} `
    let data = await _db2.query(query, { replacements: [], type: QueryTypes.SELECT });
    return data;
};

const getCustomerFirebaseTokenCount = async (filter) => {
    let query = ` select count(cm.firebase_token) from ru_customer_metas cm join ru_customers c on cm.customer_id = c.customer_id `;
    if (filter) {
        query += ` LEFT JOIN ru_direct_selling_agents dsa ON c.dsa_mobile_number = dsa.dsa_mobile_number 
                    LEFT JOIN ru_direct_selling_agents sp ON c.sp_mobile_number = sp.dsa_mobile_number where ${filter} `;
    }
    let data = await _db2.query(query, { replacements: [], type: QueryTypes.SELECT });
    return data[0].count;
};

const getCustomerBulkCalling = async (filter) => {
    let query = `
    SELECT c.customer_mobile_number as mobile_number, c.full_name ,c.email_address
    FROM ru_customers c 
    WHERE ${filter}
`;
    let data = await _db2.query(query, { replacements: [], type: QueryTypes.SELECT });




    return data;
};


const getBankDetailsDsa = async (dsa_id) => {
    let query = ` select account_holder_name as accountHolderName, account_type as accountType, account_number as accountNumber, bank_name as bankName, ifsc, bank_account_id as bankAccountId, remarks from ru_dsa_bank_accounts where dsa_id = ? `;
    let bindParams = [dsa_id];
    let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return data[0] || null;
};

const checkIfBankDetailsExist = async (netsuite_internal_id, netsuite_vendor_internal_id, CRM_Bank_AC_ID, dsa_id) => {
    let query = `SELECT * FROM ru_dsa_bank_accounts WHERE `;
    let conditions = [];
    let bindParams = [];

    if (netsuite_internal_id) {
        conditions.push('netsuite_internal_id = ?');
        bindParams.push(netsuite_internal_id);
    }
    if (netsuite_vendor_internal_id) {
        conditions.push('netsuite_vendor_internal_id = ?');
        bindParams.push(netsuite_vendor_internal_id);
    }
    if (CRM_Bank_AC_ID) {
        conditions.push('bank_account_id = ?');
        bindParams.push(CRM_Bank_AC_ID);
    }

    if (conditions.length === 0) {
        return false;
    }
    query += conditions.join(' OR ');

    let isExist = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    if (isExist.length && isExist[0].dsa_id != dsa_id) {
        //if mobile number start with "2222" or "3333" then first clear the value
        if (isExist[0].dsa_mobile_number && (isExist[0].dsa_mobile_number.startsWith("2222") || isExist[0].dsa_mobile_number.startsWith("3333"))) {
            query = ` update ru_dsa_bank_accounts set netsuite_internal_id = null, netsuite_vendor_internal_id = null, bank_account_id = null where dsa_id = ? `;
            await _db2.query(query, { replacements: [isExist[0].dsa_id], type: QueryTypes.UPDATE });
            return false;
        }
        return true;
    }

    return false;
};

/** NS Bank_Details.Type → CRM ru_dsa_bank_accounts.tag */
const normalizeNsBankTag = (type) => {
    const normalized = String(type || "").trim().toLowerCase();
    return normalized === "primary" ? "primary" : "secondary";
};

const normalizeNsId = (value) => {
    const normalized = String(value ?? "").trim();
    return normalized || null;
};

const bankAccountScopeClause = (company_id) => ({
    clause: company_id
        ? "AND company_id = ?"
        : "AND (company_id IS NULL OR company_id = '')",
    bind: company_id ? [company_id] : [],
});

const findBankAccountRowForNsSync = async (dsa_id, {
    netsuite_internal_id,
    account_number,
    ifsc,
    bank_name,
    company_id,
}) => {
    if (netsuite_internal_id) {
        const rows = await _db2.query(
            `SELECT * FROM ru_dsa_bank_accounts WHERE dsa_id = ? AND netsuite_internal_id = ? LIMIT 1`,
            { replacements: [dsa_id, netsuite_internal_id], type: QueryTypes.SELECT }
        );
        if (rows[0]) return rows[0];
    }

    const { clause: scopeClause, bind: scopeBind } = bankAccountScopeClause(company_id);

    if (account_number && ifsc && bank_name) {
        const rows = await _db2.query(
            `SELECT * FROM ru_dsa_bank_accounts WHERE dsa_id = ? ${scopeClause}
             AND account_number = ? AND ifsc = ? AND bank_name = ?
             AND (netsuite_internal_id IS NULL OR netsuite_internal_id = '' OR netsuite_internal_id = ?)
             ORDER BY
               CASE WHEN LOWER(COALESCE(status, '')) IN ('pending', 'pending_verification') THEN 0 ELSE 1 END,
               CASE WHEN netsuite_internal_id IS NULL OR netsuite_internal_id = '' THEN 0 ELSE 1 END,
               id ASC
             LIMIT 1`,
            {
                replacements: [dsa_id, ...scopeBind, account_number, ifsc, bank_name, netsuite_internal_id || ""],
                type: QueryTypes.SELECT,
            }
        );
        if (rows[0]) return rows[0];
    }

    return null;
};

const updateDsaBankDetails = async (dsa_id, data) => {
    const {
        dsa_mobile_number, CRM_Bank_AC_ID, account_holder_name, account_number, bank_name, ifsc,
        netsuite_vendor_internal_id, account_type, netsuite_internal_id, platform, user_type, company_id,
        tag = "primary",
        status = "approved",
    } = data;

    const existingRow = await findBankAccountRowForNsSync(dsa_id, {
        netsuite_internal_id,
        account_number,
        ifsc,
        bank_name,
        company_id,
    });

    const bank_account_id = CRM_Bank_AC_ID || existingRow?.bank_account_id || null;

    if (existingRow) {
        const rowBelongsToIndividual = existingRow.company_id === null || existingRow.company_id === "";
        if (company_id && rowBelongsToIndividual) {
            const err = new Error("Bank account already synced with the registered DSA");
            err.code = "BANK_ACCOUNT_ALREADY_SYNCED_WITH_DSA";
            throw err;
        }

        const effectiveCompanyId = company_id ? company_id : null;

        const query = `UPDATE ru_dsa_bank_accounts SET account_holder_name = ?, dsa_mobile_number = ?, bank_account_id = ?, account_number = ?, account_type = ?, bank_name = ?, ifsc = ?, netsuite_internal_id = ?, netsuite_vendor_internal_id = ?, platform = ?, user_type = ?, company_id = ?, tag = ?, status = ? WHERE id = ?`;
        const bindParams = [account_holder_name, dsa_mobile_number, bank_account_id, account_number, account_type, bank_name, ifsc, netsuite_internal_id || null, netsuite_vendor_internal_id || null, platform, user_type, effectiveCompanyId, tag, status, existingRow.id];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });

        try {
            await createActivityLogKafka({
                log_type: effectiveCompanyId ? "company_bank_details_ns_sync" : "dsa_bank_details_ns_sync",
                // company_id must win when present — dsa_id is still the representative's own id
                // even on a company-owned row, so checking it first files the log under the wrong
                // entity and it never shows up on the company's own activity log.
                application_id: effectiveCompanyId || dsa_id,
                created_by: "ns_sync",
                old_data: {
                    account_number: existingRow.account_number,
                    bank_name: existingRow.bank_name,
                    ifsc: existingRow.ifsc,
                    tag: existingRow.tag,
                    status: existingRow.status
                },
                new_data: { account_number, bank_name, ifsc, tag, status }
            });
        } catch (e) {
            // Kafka logging should never block the NS sync
        }
    } else {
        const query = `INSERT INTO ru_dsa_bank_accounts (dsa_id, dsa_mobile_number, bank_account_id, account_holder_name, account_number, account_type, bank_name, ifsc, netsuite_internal_id, netsuite_vendor_internal_id, platform, user_type, company_id, tag, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const bindParams = [dsa_id, dsa_mobile_number, bank_account_id, account_holder_name, account_number, account_type, bank_name, ifsc, netsuite_internal_id || null, netsuite_vendor_internal_id || null, platform, user_type, company_id, tag, status];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

        try {
            await createActivityLogKafka({
                log_type: company_id ? "company_bank_details_ns_sync" : "dsa_bank_details_ns_sync",
                application_id: company_id || dsa_id,
                created_by: "ns_sync",
                old_data: {},
                new_data: { account_number, bank_name, ifsc, tag, status }
            });
        } catch (e) {
            // Kafka logging should never block the NS sync
        }
    }
};

/** NS bank sync: upsert by Bank_Details_InternalId; link pending CRM rows with matching account/ifsc/bank. */
const syncDsaBankDetailsFromNs = async (dsa_id, { bankDetailsList = [], internalid, dsa_mobile_number, user_type, company_id }) => {
    const banks = Array.isArray(bankDetailsList) ? bankDetailsList : [];
    let syncedCount = 0;
    const skipped = [];
    let removedCount = 0;
    const nsReportedIds = [];

    for (const bank of banks) {
        const {
            Account_Number,
            Name,
            IFSC_Code,
            Bank_Name,
            Bank_Details_InternalId,
            CRM_Bank_AC_ID: rawCrmBankAcId,
            Type,
        } = bank || {};

        if (!Account_Number || !Name || !IFSC_Code || !Bank_Name) {
            continue;
        }

        const nsInternalId = normalizeNsId(Bank_Details_InternalId);
        if (!nsInternalId) {
            continue;
        }

        nsReportedIds.push(nsInternalId);
        const tag = normalizeNsBankTag(Type);
        const CRM_Bank_AC_ID = normalizeNsId(rawCrmBankAcId);
        const vendorInternalId = normalizeNsId(internalid);

        try {
            await updateDsaBankDetails(dsa_id, {
                account_holder_name: Name,
                dsa_mobile_number,
                CRM_Bank_AC_ID,
                account_number: Account_Number,
                bank_name: Bank_Name,
                ifsc: IFSC_Code,
                account_type: "Savings",
                netsuite_internal_id: nsInternalId,
                netsuite_vendor_internal_id: tag === "primary" ? vendorInternalId : null,
                platform: "crm",
                user_type,
                company_id: company_id || null,
                tag,
                status: "approved",
            });
            syncedCount++;
        } catch (e) {
            if (e.code === "BANK_ACCOUNT_ALREADY_SYNCED_WITH_DSA") {
                skipped.push({ netsuite_internal_id: nsInternalId, message: e.message });
                continue;
            }
            throw e;
        }
    }

    {
        const { clause: scopeClause, bind: scopeBind } = bankAccountScopeClause(company_id || null);
        const staleIdPlaceholders = nsReportedIds.length ? nsReportedIds.map(() => "?").join(",") : null;
        const staleClause = staleIdPlaceholders
            ? `AND netsuite_internal_id NOT IN (${staleIdPlaceholders})`
            : `AND netsuite_internal_id != ''`;
        const stale = await _db2.query(
            `SELECT id, netsuite_internal_id, account_number, bank_name, ifsc, tag, status FROM ru_dsa_bank_accounts
             WHERE dsa_id = ? ${scopeClause}
               AND netsuite_internal_id IS NOT NULL
               ${staleClause}`,
            { replacements: [dsa_id, ...scopeBind, ...nsReportedIds], type: QueryTypes.SELECT }
        );
        removedCount = stale.length;
        if (removedCount) {
            const staleIds = stale.map((row) => row.id);
            const idPlaceholders = staleIds.map(() => "?").join(",");
            await _db2.query(
                `DELETE FROM ru_dsa_bank_accounts WHERE id IN (${idPlaceholders})`,
                { replacements: staleIds, type: QueryTypes.DELETE }
            );
            logger.warn(`NS no longer reports bank account(s) [${stale.map((r) => r.netsuite_internal_id).join(", ")}] for dsa_id=${dsa_id} company_id=${company_id || null}; removed ${removedCount} stale CRM row(s)`);

            for (const row of stale) {
                try {
                    await createActivityLogKafka({
                        log_type: company_id ? "company_bank_details_ns_sync_deleted" : "dsa_bank_details_ns_sync_deleted",
                        application_id: company_id || dsa_id,
                        created_by: "ns_sync",
                        old_data: {
                            account_number: row.account_number,
                            bank_name: row.bank_name,
                            ifsc: row.ifsc,
                            tag: row.tag,
                            status: row.status
                        },
                        new_data: {}
                    });
                } catch (e) {
                    // Kafka logging should never block the NS sync
                }
            }
        }
    }

    return { syncedCount, skipped, removedCount };
};

const getProductMaxPayoutCapping = async (product_id, bank_id) => {
    let query = ` select max_payout_capping from ru_bank_product_combinations where product_id = ? and bank_id = ? `;
    let bindParams = [product_id, bank_id];
    let max_product_cap = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    max_product_cap = max_product_cap[0]?.max_payout_capping;
    return max_product_cap;
}

const processSplitCaseFiles = async (data, disbursement_date_iso) => {
    const firstBusinessCategory = [];
    const dsa_ids = [];
    const ns_hierarchy = [];
    const business_head_codes = []

    await Promise.all(
        data.map(async (lead) => {
            // Operation 1: Update missing DSA IDs first if needed
            if (!lead.dsa_id) {
                await updateFreshLeadDsaId(lead);
            }

            // Operation 2: Fetch missing NS hierarchies if empty
            /* if (!lead.ns_hierarchy && lead.permanent_account_number && lead.dsa_id) {
                const nsResponse = await updateDsaNsHierarchy(lead.permanent_account_number, lead.dsa_id);
                if (nsResponse?.isValid) {
                    lead.ns_hierarchy = nsResponse?.data?.class;
                }
            } */
        })
    );

    // Collect AFTER the async backfill so array order always matches `data`'s
    // order (oldest claim first, from checkIfFreshLeadExist): validateBusinessCategory
    // keys on firstBusinessCategory[0], and pushing inside Promise.all made the
    // order depend on which leads awaited the DSA-id backfill.
    for (const lead of data) {
        if (lead?.disbursement_date_iso && disbursement_date_iso == lead?.disbursement_date_iso) {
            firstBusinessCategory.push(sanitizeBusinessCategory(lead.business_categories));
        }
        dsa_ids.push(lead.dsa_id);
        business_head_codes.push(lead.business_head_code)
        //ns_hierarchy.push(lead.ns_hierarchy);
    }

    // Return the collected arrays if needed
    return {
        firstBusinessCategory,
        dsa_ids,
        ns_hierarchy,
        business_head_codes
    };
};

const getBankProductMappedPayout = async (dsa_id, product_id, bank_id, payout_type = null, for_autonomous = false, disb_date = null) => {

    let bankProductCombinationQuery;
    let bankProductCombinationBindParams = [bank_id, product_id];
    if (disb_date) {
        bankProductCombinationQuery = ` SELECT d.avg_achievment, bpc.max_payout_capping , BIN_TO_UUID(bpc.bank_product_combinations_id) AS bank_product_combinations_id , np.category
          FROM ru_bank_product_combinations bpc
          left join ru_netsuite_products np on bpc.product_id = np.netsuite_product_id
          LEFT JOIN LATERAL (
            SELECT d1.avg_achievment
            FROM ru_bank_product_combination_details d1
            WHERE d1.bank_product_combinations_id = bpc.bank_product_combinations_id
              AND (d1.applicable_from IS NULL OR d1.applicable_from <= ?)
              AND (d1.applicable_till IS NULL OR d1.applicable_till >= ?)
            ORDER BY d1.applicable_from DESC, d1.id DESC
            LIMIT 1
          ) d ON true
          WHERE bpc.bank_id = ? AND bpc.product_id = ?`;
        bankProductCombinationBindParams = [disb_date, disb_date, bank_id, product_id];
    } else {
        bankProductCombinationQuery = ` SELECT d.avg_achievment, bpc.max_payout_capping , BIN_TO_UUID(bpc.bank_product_combinations_id) AS bank_product_combinations_id , np.category
          FROM ru_bank_product_combinations bpc
          left join ru_netsuite_products np on bpc.product_id = np.netsuite_product_id
          LEFT JOIN LATERAL (
            SELECT d1.avg_achievment
            FROM ru_bank_product_combination_details d1
            WHERE d1.bank_product_combinations_id = bpc.bank_product_combinations_id
            ORDER BY d1.created_at DESC, d1.id DESC
            LIMIT 1
          ) d ON true
          WHERE bpc.bank_id = ? AND bpc.product_id = ?`;
    }
    const [bankProductCombinationData = {}] = await _db2.query(bankProductCombinationQuery, { replacements: bankProductCombinationBindParams, type: QueryTypes.SELECT }) || [];
    const { avg_achievment = null, max_payout_capping = null, bank_product_combinations_id = null, category = null } = bankProductCombinationData;

    if (!bank_product_combinations_id) {
        return { payout_amount_multiplier: null, type: "rate" };
    }

    const payoutQuery = ` SELECT rate, ratio , autonomous_rate, autonomous_ratio, default_payout_type FROM ru_dsa_payouts WHERE bank_product_combinations_id = ? AND dsa_id = ? `;
    const [payoutData = {}] = await _db2.query(payoutQuery, { replacements: [bank_product_combinations_id, dsa_id], type: QueryTypes.SELECT }) || [];
    const { rate = null, ratio = null, autonomous_rate = null, autonomous_ratio = null, default_payout_type = null } = payoutData;

    let cappedPayoutPercentage, masterRate, masterRatio;

    if (for_autonomous) {
        const dsaAutonomousPayoutData = await _db2.query(
            `select autonomous_unsecured_payout , autonomous_secured_payout from ru_dsa_autonomous_settings where dsa_id = ?`,
            { replacements: [dsa_id], type: QueryTypes.SELECT }
        );

        const [{ autonomous_unsecured_payout = null, autonomous_secured_payout = null } = {}] = dsaAutonomousPayoutData || [];
        cappedPayoutPercentage = (typeof category === 'string' && category?.toLowerCase() !== 'unsecured') ? autonomous_secured_payout : autonomous_unsecured_payout;
        masterRate = autonomous_rate || 0;
        masterRatio = autonomous_ratio || 0;
    } else {
        const global_payout_percentage = await getDsaGlobalPayoutPercentageNew(dsa_id);
        cappedPayoutPercentage = global_payout_percentage?.global_payouts_percentage || 50;
        masterRate = rate || 0;
        masterRatio = ratio || 0;
    }

    const { final_rate, final_ratio } = CalculatePayoutAmountMultiplier(avg_achievment, max_payout_capping, masterRate, masterRatio, Number(cappedPayoutPercentage));

    if (for_autonomous) {
        return { payout_amount_multiplier: final_rate, type: "rate" };
    }

    const type_to_check = payout_type || default_payout_type;
    if (type_to_check == "ratio") {
        return { payout_amount_multiplier: final_ratio, type: "ratio" };
    } else if (type_to_check == "rate") {
        return { payout_amount_multiplier: final_rate, type: "rate" };
    }

    return { payout_amount_multiplier: final_rate, type: "rate" };
}






const isProductEligibleAutonomous = async (bank_product_combinations_id, netsuite_product_id) => {
    if (!bank_product_combinations_id && !netsuite_product_id) {
        return { is_eligible: false, category: null };
    }

    let query, bindParams;

    if (bank_product_combinations_id) {
        query = `
            SELECT LOWER(np.category) AS category
            FROM ru_bank_product_combinations bpc
            LEFT JOIN ru_netsuite_products np ON bpc.product_id = np.netsuite_product_id
            WHERE bpc.bank_product_combinations_id = UUID_TO_BIN(?)
            LIMIT 1
        `;
        bindParams = [bank_product_combinations_id];
    } else {
        query = `
            SELECT LOWER(np.category) AS category
            FROM ru_netsuite_products np
            WHERE np.netsuite_product_id = ?
            LIMIT 1
        `;
        bindParams = [netsuite_product_id];
    }

    const [result = {}] = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT }) || [];
    const category = result?.category || null;
    const eligibleCategories = ['secured', 'unsecured'];
    const is_eligible = eligibleCategories.includes(category);

    return { is_eligible, category };
};

const validateVendorPayoutNew = async (dsa_id, bank_id, product_id, payout_type, payout_rate, payout_ratio, bank_product_combinations_id = null, for_autonomous = false, autonomous_ratio = 0, bank_file_subvention_amount = null, bank_file_disbursement_amount = null, disb_date = null) => {

    let assigning_payout_percentage = 0;
    if (!for_autonomous) {
        let query = ` SELECT assigning_payout_percentage FROM ru_direct_selling_agents WHERE dsa_id = ?`;
        let [data = {}] = await _db2.query(query, { replacements: [dsa_id], type: QueryTypes.SELECT }) || [];
        assigning_payout_percentage = data?.assigning_payout_percentage;
        if (!assigning_payout_percentage) {
            return { payout_collide: true, vendor_payout_ratio: null, vendor_payout_rate: null, avg_achievment: 0 };
        }
    }

    let whereClause = '';
    let bindParams = [];

    if (bank_product_combinations_id) {
        whereClause = `WHERE bpc.bank_product_combinations_id = UUID_TO_BIN(?)`;
        bindParams = [bank_product_combinations_id];
    } else {
        whereClause = `WHERE bpc.bank_id = ? AND bpc.product_id = ?`;
        bindParams = [bank_id, product_id];
    }

    let query;
    if (disb_date) {
        query = ` SELECT d.avg_achievment, bpc.max_payout_capping, bpc.autonomous_payout_capping
          FROM ru_bank_product_combinations bpc
          LEFT JOIN LATERAL (
            SELECT d1.avg_achievment
            FROM ru_bank_product_combination_details d1
            WHERE d1.bank_product_combinations_id = bpc.bank_product_combinations_id
              AND (d1.applicable_from IS NULL OR d1.applicable_from <= ?)
              AND (d1.applicable_till IS NULL OR d1.applicable_till >= ?)
            ORDER BY d1.applicable_from DESC, d1.id DESC
            LIMIT 1
          ) d ON true
          ${whereClause}`;
        bindParams = [disb_date, disb_date, ...bindParams];
    } else {
        query = ` SELECT d.avg_achievment, bpc.max_payout_capping, bpc.autonomous_payout_capping
          FROM ru_bank_product_combinations bpc
          LEFT JOIN LATERAL (
            SELECT d1.avg_achievment
            FROM ru_bank_product_combination_details d1
            WHERE d1.bank_product_combinations_id = bpc.bank_product_combinations_id
            ORDER BY d1.created_at DESC, d1.id DESC
            LIMIT 1
          ) d ON true
          ${whereClause}`;
    }
    let [data = {}] = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT }) || [];
    let { avg_achievment = 0, max_payout_capping, autonomous_payout_capping } = data

    let payout_percentage = for_autonomous ? autonomous_ratio : assigning_payout_percentage;
    // Only apply product autonomous_payout_capping when set — Math.min(x, null) coerces null→0 and
    // incorrectly collapses the max autonomous rate (false "Product details are incomplete").
    if (for_autonomous && autonomous_payout_capping != null && autonomous_payout_capping !== '') {
        payout_percentage = Math.min(Number(payout_percentage), Number(autonomous_payout_capping));
    }

    let { final_rate: max_expected_rate, final_ratio: max_expected_ratio } = CalculatePayoutAmountMultiplier(avg_achievment, max_payout_capping, 0, 0, Number(payout_percentage))
    const { subvention_rate, subvention_ratio } = CalculateSubventionDeduction({
        bank_file_subvention_amount,
        bank_file_disbursement_amount,
        avg_achievment,
    });
    ({ max_expected_rate, max_expected_ratio } = ApplySubventionToPayoutCaps({
        max_expected_rate,
        max_expected_ratio,
        subvention_rate,
        subvention_ratio,
    }));
    if (payout_type.toLowerCase() === "rate") {
        if (payout_rate <= max_expected_rate) {
            return { payout_collide: false, vendor_payout_ratio: max_expected_ratio, vendor_payout_rate: max_expected_rate, avg_achievment };
        }
    } else {
        if (payout_ratio <= max_expected_ratio) {
            return { payout_collide: false, vendor_payout_ratio: max_expected_ratio, vendor_payout_rate: max_expected_rate, avg_achievment };
        }
    }

    return {
        payout_collide: true,
        vendor_payout_ratio: max_expected_ratio,
        vendor_payout_rate: max_expected_rate,
        avg_achievment
    };
};

const insertDsaPayout = async (dsa_id, bank_id, product_id, disb_date) => {

    let query, bindParams;
    if (disb_date) {
        query = ` select rdp.id as dsa_payout_id , BIN_TO_UUID(bpc.bank_product_combinations_id) as bank_product_combinations_id , d.avg_achievment , bpc.max_payout_capping from ru_bank_product_combinations bpc
      left join ru_dsa_payouts rdp on BIN_TO_UUID(bpc.bank_product_combinations_id) = (rdp.bank_product_combinations_id) and rdp.dsa_id = ?
      LEFT JOIN LATERAL (
        SELECT d1.avg_achievment
        FROM ru_bank_product_combination_details d1
        WHERE d1.bank_product_combinations_id = bpc.bank_product_combinations_id
          AND (d1.applicable_from IS NULL OR d1.applicable_from <= ?)
          AND (d1.applicable_till IS NULL OR d1.applicable_till >= ?)
        ORDER BY d1.applicable_from DESC, d1.id DESC
        LIMIT 1
      ) d ON true
      where bpc.bank_id = ? and bpc.product_id = ? order by rdp.id desc limit 1 `
        bindParams = [dsa_id, disb_date, disb_date, bank_id, product_id]
    } else {
        query = ` select rdp.id as dsa_payout_id , BIN_TO_UUID(bpc.bank_product_combinations_id) as bank_product_combinations_id , d.avg_achievment , bpc.max_payout_capping from ru_bank_product_combinations bpc
      left join ru_dsa_payouts rdp on BIN_TO_UUID(bpc.bank_product_combinations_id) = (rdp.bank_product_combinations_id) and rdp.dsa_id = ?
      LEFT JOIN LATERAL (
        SELECT d1.avg_achievment
        FROM ru_bank_product_combination_details d1
        WHERE d1.bank_product_combinations_id = bpc.bank_product_combinations_id
        ORDER BY d1.created_at DESC, d1.id DESC
        LIMIT 1
      ) d ON true
      where bpc.bank_id = ? and bpc.product_id = ? order by rdp.id desc limit 1 `
        bindParams = [dsa_id, bank_id, product_id]
    }
    let [data = {}] = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT }) || [];
    let { bank_product_combinations_id, dsa_payout_id, avg_achievment, max_payout_capping } = data

    if (dsa_payout_id || !bank_product_combinations_id || !avg_achievment) {
        return null
    }

    const globalPayoutData = await getDsaGlobalPayoutPercentageNew(dsa_id);
    let global_payout_percentage = globalPayoutData?.global_payouts_percentage || 50;
    let { final_rate } = CalculatePayoutAmountMultiplier(avg_achievment, max_payout_capping, 0, 0, global_payout_percentage)

    query = ` insert into ru_dsa_payouts (dsa_id , rate , bank_product_combinations_id , payout_lock , created_at , updated_at) values (? , ? , ?, 0 ,? ,?)`
    bindParams = [dsa_id, final_rate, bank_product_combinations_id, new Date(), new Date()]
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

    return
}


const updateDirectClaimAccess = async (dsa_mobile_number, status) => {
    let query = ` update ru_direct_selling_agents set is_direct_claim_enabled=?,is_fibe_pl_direct_claim_enabled = ?,is_paysense_pl_direct_claim_enabled = ?,is_incred_pl_direct_claim_enabled = ?,is_bajaj_pl_direct_claim_enabled= ?,is_lt_pl_direct_claim_enabled = ?,is_prefr_pl_direct_claim_enabled = ? where dsa_mobile_number=? `
    let bindParams = [status, status, status, status, status, status, status, dsa_mobile_number];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return;
};

/**
 * SQL fragments for loan_against_security only (ru_las_applications / ru_las_application_metas).
 * Maps LAS columns to the same plm / address column names the shared list API expects elsewhere.
 */
const getLoanAgainstSecurityApplicationsSqlFragments = (metaTableName) => {
    const meta = metaTableName || "ru_las_application_metas";
    return {
        metaJoinQuery: `LEFT JOIN LATERAL (
                SELECT 
                    plm1.disbursement_date AS disbursed_date,
                    CAST(NULL AS CHAR) AS offered_loan_tenure,
                    plm1.sales_person_id,
                    CAST(NULL AS UNSIGNED) AS bank_branch_id,
                    CAST(NULL AS DECIMAL(10,4)) AS ventile_score
                FROM ${meta} plm1 
                WHERE plm1.application_id = CONVERT(pl.application_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
                ORDER BY plm1.created_at DESC
                LIMIT 1
                ) plm ON TRUE`,
        countQueryMetaJoinSql: `LEFT JOIN (
                SELECT lm.application_id,
                    lm.disbursement_date AS disbursed_date,
                    CAST(NULL AS CHAR) AS offered_loan_tenure,
                    lm.sales_person_id,
                    CAST(NULL AS UNSIGNED) AS bank_branch_id,
                    CAST(NULL AS DECIMAL(10,4)) AS ventile_score
                FROM ${meta} lm
                INNER JOIN (
                    SELECT application_id, MAX(created_at) AS max_created_at
                    FROM ${meta}
                    GROUP BY application_id
                ) lmx ON lm.application_id = lmx.application_id AND lm.created_at = lmx.max_created_at
            ) plm ON plm.application_id = CONVERT(pl.application_id USING utf8mb4) COLLATE utf8mb4_unicode_ci`,
        addressSelectSql: `CONCAT_WS(', ', NULLIF(pl.city, ''), NULLIF(pl.state, '')) AS customer_address, pl.city AS city, CAST(NULL AS CHAR) AS pin_code`,
        rcaJoinSql: "",
    };
};

const getApplicationsByProductAndLoanType = async (loan_type, count_only, where, offset, limit, user_query, dsa_mobile_number, is_export, countJoins = {}) => {
    // Simple "all" support: call existing logic per loan type, then merge
    if (loan_type === "all") {
        const loanTypes = [
            "education_loan", "personal_loan", "business_loan", "car_loan", "car_refinance",
            "home_loan", "gold_loan", "loan_against_property", "used_car_loan", "machinery_loan", "solar_loan",
            "loan_against_security",
        ];
        const start = Number(offset) || 0;
        const size = Number(limit) || 100;
        // allSettled so one broken meta schema (e.g. car_refinance missing bank_branch_id) doesn't fail the whole request
        const settled = await Promise.allSettled(
            loanTypes.map((lt) =>
                getApplicationsByProductAndLoanType(lt, count_only, where, 0, start + size, user_query, dsa_mobile_number, is_export, countJoins)
            )
        );
        const results = settled.filter((r) => r.status === "fulfilled").map((r) => r.value);
        const totalCount = results.reduce((sum, r) => sum + Number(r?.totalCount || 0), 0);
        if (count_only) {
            return { lntApplications: [], totalCount };
        }
        const lntApplications = results
            .flatMap((r) => r?.lntApplications || [])
            .map((app) => ({
                ...app,
                // Explicit loan type key for FE (personal_loan, home_loan, etc.)
                loan_type: app.retail_category || app.loan_type,
            }))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(start, start + size);
        return { lntApplications, totalCount };
    }

    let bindParams = [];
    const _loanInfo = getLoanTableInfo(loan_type);
    const tableName = _loanInfo?.table_name;
    if (!tableName) {
        return { lntApplications: [], totalCount: 0 };
    }

    const metaTableName = _loanInfo?.meta_table || getTableNameFromLoanType(loan_type, "meta_table");
    const queryProfile = getLoanListQueryProfile(loan_type);
    let effectiveWhere = normalizeLoanApplicationWhere(where, queryProfile);
    const isLas = loan_type === "loan_against_security";
    const useUuidJoins = !!queryProfile.useSolarJoins;

    // When loan_type=all, shared filters may reference rca.*; rewrite for LAS schema
    if (isLas && effectiveWhere?.length) {
        effectiveWhere = effectiveWhere.map(([field, op, val]) => {
            const f = String(field ?? '').trim();
            if (f === 'rca.city') return ['pl.city', op, val];
            if (f === 'rca.pin_code') return ["CONCAT(IFNULL(pl.city,''), IFNULL(pl.state,''))", op, val];
            // offered_loan_tenure is always NULL on LAS meta — neutralize so "all" city lists still work
            if (f.includes('plm.offered_loan_tenure')) return ['1=1', '', null];
            return [field, op, val];
        });
    }

    let metaJoinQuery;
    let addressSelectSql;
    let rcaJoinSql;
    let countQueryMetaJoinSql;

    if (isLas) {
        const las = getLoanAgainstSecurityApplicationsSqlFragments(metaTableName);
        metaJoinQuery = las.metaJoinQuery;
        addressSelectSql = las.addressSelectSql;
        rcaJoinSql = las.rcaJoinSql;
        countQueryMetaJoinSql = las.countQueryMetaJoinSql;
    } else {
        const metaSelectCols = [
            "plm1.disbursed_date",
            "plm1.offered_loan_tenure",
            "plm1.sales_person_id",
        ];
        if (queryProfile.metaHasBankBranch) metaSelectCols.push("plm1.bank_branch_id");
        if (queryProfile.metaHasVentileScore) metaSelectCols.push("plm1.ventile_score");

        metaJoinQuery = `LEFT JOIN LATERAL (
                SELECT 
                    ${metaSelectCols.join(",\n                    ")}
                FROM ${metaTableName} plm1 
                WHERE plm1.application_id = pl.application_id
                ORDER BY plm1.created_at DESC
                LIMIT 1
                ) plm ON TRUE`;
        addressSelectSql = `TRIM(BOTH ',' FROM CONCAT_WS(',', NULLIF(rca.address_line_1, ''), NULLIF(rca.address_line_2, ''), NULLIF(rca.address_line_3, ''), NULLIF(rca.pin_code, ''), NULLIF(rca.city, ''), NULLIF(rca.state, ''))) AS customer_address, rca.city, rca.pin_code`;
        rcaJoinSql = "left join ru_customer_addresses rca on rca.id = pl.address_id ";
        countQueryMetaJoinSql = `LEFT JOIN ${metaTableName} plm ON plm.application_id = pl.application_id`;
    }

    const bankJoin = queryProfile.metaHasBankBranch
        ? "left join CRMTest.bank_details bank on plm.bank_branch_id = bank.id"
        : "left join CRMTest.bank_details bank on 1=0";

    const subStatusSelect = queryProfile.hasSubStatus ? "pl.sub_status" : "NULL AS sub_status";
    const ventileScoreSelect = queryProfile.metaHasVentileScore ? ", plm.ventile_score" : "";
    const loanApacRefSelect = queryProfile.hasLoanApacRef
        ? " ,pl.loan_apac_ref_los_number, pl.loan_reference_id"
        : (loan_type === "solar_loan" ? "" : " ,NULL AS loan_apac_ref_los_number, NULL AS loan_reference_id");
    // LAS application table has no customer_mobile_number column
    const customerMobileSelect = isLas
        ? "c.customer_mobile_number AS customer_mobile_number"
        : "COALESCE(NULLIF(pl.customer_mobile_number, ''), c.customer_mobile_number) AS customer_mobile_number";
    const dsaJoin = useUuidJoins
        ? "LEFT JOIN ru_direct_selling_agents d ON d.dsa_id = CONVERT(pl.dsa_id USING utf8mb4) COLLATE utf8mb4_unicode_ci"
        : "left join ru_direct_selling_agents d on d.dsa_id = pl.dsa_id";
    const customerJoin = useUuidJoins
        ? "LEFT JOIN ru_customers c ON c.customer_id = CONVERT(pl.customer_id USING utf8mb4) COLLATE utf8mb4_unicode_ci"
        : "left join ru_customers c on c.customer_id = pl.customer_id";

    const utmOnClause = useUuidJoins
        ? "utm.application_id = CONVERT(pl.application_id USING utf8mb4) COLLATE utf8mb4_unicode_ci"
        : "utm.application_id = pl.application_id";

    let utm_join = `LEFT JOIN (
                    SELECT
                        application_id,
                        MAX(updated_at) AS updated_at,
                        utm_source, page_source, source_from,
                        utm_medium, utm_campaign, utm_content,
                        utm_channel, utm_term, utm_id, adgroupid,
                        ad, mt, adpos, gad, gclid, fbclid,
                        utm_main_source, utm_device, utm_adgroup,
                        campaignid
                    FROM loan_applications
                    GROUP BY application_id
                ) utm ON ${utmOnClause}`;

    let query = ` ${user_query || ""} SELECT utm.campaignid, utm.utm_source, utm.page_source, utm.source_from, utm.utm_medium, utm.utm_campaign, utm.utm_content, utm.utm_channel, utm.utm_term, utm.utm_id, utm.adgroupid, utm.utm_campaign, utm.ad, utm.mt, utm.adpos, utm.gad, utm.gclid, utm.fbclid, utm.utm_main_source, utm.utm_device, utm.utm_adgroup, "${loan_type}" as retail_category, bank.branch_name, bank.ifsc_code, bank.location as rpc, ${addressSelectSql}, ${subStatusSelect}, rm.sp_name, rm.sp_email, rm.sp_mobile, plm.disbursed_date, pl.id, pl.application_id, pl.external_id, pl.dsa_id, pl.customer_id, pl.product_id, pl.applied_loan_amount, pl.approved_loan_amount, pl.disbursed_loan_amount, pl.loan_tenure, pl.stage, pl.sub_stage, pl.status, pl.status_description, pl.application_submitted_at, pl.claim_status${loanApacRefSelect}, pl.application_ref, pl.created_at, pl.updated_at, c.full_name as customer_full_name, c.email_address as customer_email, ${customerMobileSelect}, c.permanent_account_number as customer_pan, d.full_name as partner_name, d.dsa_mobile_number as partner_mobile, d.hierarchy_crm , d.is_direct_claim_enabled , d.assigning_payout_percentage, 
                bh.full_name as bh_name, plm.offered_loan_tenure${ventileScoreSelect} from ${tableName} pl ${dsaJoin}  left join ru_direct_selling_agents bh on bh.dsa_mobile_number = d.business_head_code ${customerJoin} 
                ${metaJoinQuery}
                left join ru_branch_sales_people rm on rm.id = plm.sales_person_id ${bankJoin} ${rcaJoinSql} ${utm_join}`;
    let queryCount = ` ${user_query || ""} SELECT  count(distinct pl.application_id) as totalCount from ${tableName} pl ${dsaJoin} `;
    let and = false;

    if (effectiveWhere?.length) {
        const customerCountJoin = useUuidJoins
            ? "LEFT JOIN ru_customers c ON c.customer_id = CONVERT(pl.customer_id USING utf8mb4) COLLATE utf8mb4_unicode_ci"
            : "LEFT JOIN ru_customers c ON c.customer_id = pl.customer_id";

        // rm and bank depend on plm — include plm whenever either is needed
        const needsPlm = countJoins.plm || countJoins.rm || countJoins.bank;

        queryCount += [
            countJoins.bh ? "LEFT JOIN ru_direct_selling_agents bh ON bh.dsa_mobile_number = d.business_head_code" : "",
            countJoins.c ? customerCountJoin : "",
            needsPlm ? countQueryMetaJoinSql : "",
            countJoins.rm ? "LEFT JOIN ru_branch_sales_people rm ON rm.id = plm.sales_person_id" : "",
            countJoins.bank
                ? (queryProfile.metaHasBankBranch
                    ? "LEFT JOIN CRMTest.bank_details bank ON plm.bank_branch_id = bank.id"
                    : "LEFT JOIN CRMTest.bank_details bank ON 1=0")
                : "",
            (countJoins.rca && !isLas) ? "LEFT JOIN ru_customer_addresses rca ON rca.id = pl.address_id" : "",
            countJoins.utm ? utm_join : "",
        ].filter(Boolean).join(" ");
    }

    if (dsa_mobile_number) {
        query += ` ${and === false ? "where" : "and"} d.dsa_mobile_number = ?`
        queryCount += ` ${and === false ? "where" : "and"} d.dsa_mobile_number = ?`
        bindParams.push(dsa_mobile_number);
        and = true;
    };

    if (effectiveWhere && effectiveWhere.length != 0) {
        for (let i = 0; i < effectiveWhere.length; i++) {
            if (and == false) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            } else {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (effectiveWhere[i][2]) {
                query += effectiveWhere[i][0] + effectiveWhere[i][1] + ' ? ';
                queryCount += effectiveWhere[i][0] + effectiveWhere[i][1] + ' ? ';
                bindParams.push(effectiveWhere[i][2]);
            } else {
                query += effectiveWhere[i][0] + effectiveWhere[i][1] + ' ';
                queryCount += effectiveWhere[i][0] + effectiveWhere[i][1] + '  ';
            }
        }
    };

    query += ` order by pl.created_at desc `;
    if (!is_export) {
        query += `limit ${offset},${limit}`
    };
    let totalCount = [{ totalCount: limit }]
    let lntApplications = [];

    if (is_export) {
        return ({ query, queryCount, bindParams });
    };

    if (count_only) {
        totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    } else {
        // Run data + count (when needed) in parallel instead of sequentially
        const [dataResult, countResult] = await Promise.all([
            _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT }),
            dsa_mobile_number ? _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT }) : Promise.resolve(null),
        ]);
        lntApplications = dataResult;
        if (dsa_mobile_number) totalCount = countResult;
    };

    if (lntApplications?.length) {
        const productIds = lntApplications.map(app => app.product_id);
        let query = ` select p.*, lt.alias as loan_type from ru_loans_products p inner join ru_loans_types lt on lt.id = p.loan_type_id where p.id in (${productIds}) `;
        let products = await _db3.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

        // Fire all per-row payout queries in parallel instead of one-by-one in the loop
        const payoutPromises = lntApplications.map(async (app, i) => {
            const product = products.find(p => p.id == app?.product_id);
            lntApplications[i]["product_description"] = product ? product["product_name"] : "Pending";
            lntApplications[i]["product_vendor"] = product ? product["product_vendor"] : "Pending";
            lntApplications[i]["journey_type"] = product ? product["journey_type"] : "Pending";
            lntApplications[i]["loan_type"] = product ? product["loan_type"] : "Pending";
            lntApplications[i]["is_product_claim_enabled"] = product ? product["is_claim_enabled"] : null;
            lntApplications[i]["is_payout_set"] = false;
            lntApplications[i]["claim_amount"] = null;
            let dsa_id = lntApplications[i]["dsa_id"];
            if (product && product["ns_bank_product_id"]) {
                let query = ` select rdp.rate from ru_bank_product_combinations bpc left join ru_dsa_payouts rdp on (rdp.bank_product_combinations_id) = BIN_TO_UUID(bpc.bank_product_combinations_id) where bpc.id = ? and rdp.dsa_id = ?`;
                let bindParams = [product["ns_bank_product_id"], dsa_id];
                let [data = {}] = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
                let { rate } = data;
                if (rate) {
                    lntApplications[i]["claim_amount"] = (rate / 100) * lntApplications[i]['disbursed_loan_amount'];
                    lntApplications[i]["is_payout_set"] = true;
                } else {
                    lntApplications[i]["is_payout_set"] = false;
                }
            }
        });
        await Promise.all(payoutPromises);
    };

    return { lntApplications: lntApplications, totalCount: totalCount[0].totalCount };
};


const editSigningPayout = async (dsa_id, assigning_payout_percentage, updateGlobalPayoutPercentage) => {
    let setFields = `assigning_payout_percentage = ?`;
    let bindParams = [assigning_payout_percentage];

    if (updateGlobalPayoutPercentage === true) {
        setFields += `, global_payouts_percentage = ?`;
        bindParams.push(assigning_payout_percentage);
    }

    bindParams.push(dsa_id);

    const query = `
        UPDATE ru_direct_selling_agents 
        SET ${setFields} 
        WHERE dsa_id = ?
    `;

    await _db2.query(query, {
        replacements: bindParams,
        type: QueryTypes.UPDATE
    });

    return;
};

const getAllPlDashboardByPhoneNumbers = async (productId, phone, level, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, loan_type) => {
    let tableObj = { "el": "dsa_application_view_all_el", "pl": "dsa_application_view_all_pl" };
    let bindParams = [];
    bindParams.push(phone);
    let query = ` SELECT 
    CONCAT(REPEAT('-', 0),
    dsa_name,
    ' (',
    dsa_mobile_number,
    ')') AS dsa,
    dsa_mobile_number,
    dsa_id,
    partner_code,
    ${level ? "as level," : ""} 
    CAST(SUM(CASE WHEN status = 'Reject' THEN 1 ELSE 0 END)  AS UNSIGNED )  AS total_rejected,
            CAST(SUM(CASE WHEN status = 'Disbursed' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_disbursed,
            CAST(SUM(CASE WHEN status = 'Approved'  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_approved,
            CAST(SUM(CASE WHEN status not in ('Approved', 'Disbursed', 'Reject') or status  is null  THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_in_progress,
            CAST(SUM(CASE WHEN status = 'Disbursed' THEN  disbursed_loan_amount ELSE 0 END) AS UNSIGNED )  AS total_disbursed_amount,
            CAST(SUM(CASE WHEN status = 'Approved' THEN  approved_loan_amount ELSE 0 END) AS UNSIGNED )  AS total_approved_amount
    FROM
    ${tableObj[loan_type]} t1 WHERE t1.product_id=${productId} and `;

    if (startDateFilter) {
        query += `DATE(t1.disbursed_date)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
    };

    if (startDateLoginFilter) {
        query += `DATE(t1.created_at)  between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
    };

    query += ` dsa_mobile_number in (
        WITH RECURSIVE DSAHierarchy AS (
            SELECT dsa_mobile_number, partner_code
            FROM ru_direct_selling_agents
            WHERE dsa_mobile_number = ?
            UNION ALL
            SELECT t.dsa_mobile_number, t.partner_code
            FROM ru_direct_selling_agents t
            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
        ) 
        SELECT dsa_mobile_number
        FROM DSAHierarchy
      ) GROUP BY dsa_mobile_number ORDER BY total_disbursed DESC `

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getPayoutClaimDashboardByPhoneNumbers = async (phone, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter) => {
    let bindParams = [];
    bindParams.push(phone);
    let query = ` SELECT 
    CONCAT(REPEAT('-', 0),
    dsa_name,
    ' (',
    dsa_mobile_number,
    ')') AS dsa,
    dsa_mobile_number,
    dsa_id,
    partner_code,
    CAST(SUM(CASE WHEN status in (1,6) THEN 1 ELSE 0 END)  AS UNSIGNED )  AS total_approved,
            CAST(SUM(CASE WHEN status in (2,5,9,10,11,12) THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_wip,
            CAST(SUM(CASE WHEN status in (4) THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_not_found,
            CAST(SUM(CASE WHEN status in (3,7,8) THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_rejected,
            CAST(SUM(CASE WHEN disbursed_date is not null THEN  disbursed_loan_amount ELSE 0 END) AS UNSIGNED )  AS total_disbursed_loan_amount,
            CAST(SUM(CASE WHEN vendor_payout_amount is not null THEN  vendor_payout_amount ELSE 0 END) AS UNSIGNED )  AS total_vendor_payout_amount,
            CAST(SUM(CASE WHEN netsuite_vendor_bill_amount is not null THEN netsuite_vendor_bill_amount ELSE 0 END) AS UNSIGNED )  AS total_netsuite_vendor_bill_amount
    FROM
    dsa_application_view_payout_claims t1 WHERE (upload_file_name is not null or loan_status = "disbursed") and `;

    if (startDateFilter) {
        query += `DATE(t1.disbursed_date)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
    };

    if (startDateLoginFilter) {
        query += `DATE(t1.created_at)  between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
    };

    query += ` dsa_mobile_number in (
        WITH RECURSIVE DSAHierarchy AS (
            SELECT dsa_mobile_number, partner_code
            FROM ru_direct_selling_agents
            WHERE dsa_mobile_number = ?
            UNION ALL
            SELECT t.dsa_mobile_number, t.partner_code
            FROM ru_direct_selling_agents t
            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
        ) 
        SELECT dsa_mobile_number
        FROM DSAHierarchy
      ) GROUP BY dsa_mobile_number ORDER BY total_approved DESC `

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getYearlyPlReport = async (dsa_mobile_number, product_id, loan_type) => {
    let tableObj = { "el": "dsa_application_view_all_el", "pl": "dsa_application_view_all_pl" };
    let query = ` SELECT 
    MONTH(created_at) AS month,
    CAST(SUM(CASE WHEN status = 'Reject' THEN 1 ELSE 0 END) AS UNSIGNED) AS total_rejected,
    CAST(SUM(CASE WHEN status = 'Disbursed' THEN 1 ELSE 0 END) AS UNSIGNED) AS total_disbursed,
    CAST(SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) AS UNSIGNED) AS total_approved,
    CAST(SUM(CASE WHEN status NOT IN ('Approved', 'Disbursed', 'Reject') OR status IS NULL THEN 1 ELSE 0 END) AS UNSIGNED) AS total_in_progress,
    CAST(SUM(CASE WHEN status = 'Disbursed' THEN disbursed_loan_amount ELSE 0 END) AS UNSIGNED) AS total_disbursed_amount,
    CAST(SUM(CASE WHEN status = 'Approved' THEN approved_loan_amount ELSE 0 END) AS UNSIGNED) AS total_approved_amount
    FROM
    ${tableObj[loan_type]} t1 
    WHERE dsa_mobile_number IN (
        WITH RECURSIVE DSAHierarchy AS (
            SELECT dsa_mobile_number, partner_code
            FROM ru_direct_selling_agents
            WHERE dsa_mobile_number = '${dsa_mobile_number}'
            UNION ALL
            SELECT t.dsa_mobile_number, t.partner_code
            FROM ru_direct_selling_agents t
            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
        ) 
        SELECT dsa_mobile_number
        FROM DSAHierarchy
    ) 
    and MONTH(created_at) is not null
    and t1.product_id=${product_id}
    GROUP BY 
    MONTH(created_at)
    ORDER BY 
    total_disbursed DESC `;
    let bindParams = [dsa_mobile_number];
    let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return data;
};

const getYearlyPayoutClaimReport = async (dsa_mobile_number) => {
    let query = ` SELECT 
    MONTH(created_at) AS month,
   CAST(SUM(CASE WHEN status in (1,6) THEN 1 ELSE 0 END)  AS UNSIGNED )  AS total_approved,
            CAST(SUM(CASE WHEN status in (2,5,9,10,11,12) THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_wip,
            CAST(SUM(CASE WHEN status in (4) THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_not_found,
            CAST(SUM(CASE WHEN status in (3,7,8) THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_rejected,
            CAST(SUM(CASE WHEN disbursed_date is not null THEN  disbursed_loan_amount ELSE 0 END) AS UNSIGNED )  AS total_disbursed_loan_amount,
            CAST(SUM(CASE WHEN vendor_payout_amount is not null THEN  vendor_payout_amount ELSE 0 END) AS UNSIGNED )  AS total_vendor_payout_amount,
            CAST(SUM(CASE WHEN netsuite_vendor_bill_amount is not null THEN netsuite_vendor_bill_amount ELSE 0 END) AS UNSIGNED )  AS total_netsuite_vendor_bill_amount
    FROM
    dsa_application_view_payout_claims t1 WHERE (upload_file_name is not null or loan_status = "disbursed") and dsa_mobile_number IN (
        WITH RECURSIVE DSAHierarchy AS (
            SELECT dsa_mobile_number, partner_code
            FROM ru_direct_selling_agents
            WHERE dsa_mobile_number = '${dsa_mobile_number}'
            UNION ALL
            SELECT t.dsa_mobile_number, t.partner_code
            FROM ru_direct_selling_agents t
            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
        ) 
        SELECT dsa_mobile_number
        FROM DSAHierarchy
    ) 
    and MONTH(created_at) is not null
    GROUP BY 
    MONTH(created_at)
    ORDER BY 
    total_approved DESC `;
    let bindParams = [dsa_mobile_number];
    let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return data;
};

const getYearlyCCReport = async (phone, product_id) => {
    let bindParams = [];
    bindParams.push(phone);
    let query = `SELECT 
    MONTH(created_at) AS month,
    CAST(SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_rejected,
    CAST(SUM(CASE WHEN status = 'Pending/WIP' or status is null THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_in_progress,
    CAST(SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) AS UNSIGNED )  AS total_approved
    
    FROM
    dsa_bfl_cc_view t1
    WHERE `

    query += ` dsa_mobile_number in (
        WITH RECURSIVE DSAHierarchy AS (
            SELECT dsa_mobile_number, partner_code
            FROM ru_direct_selling_agents
            WHERE dsa_mobile_number = ?
            UNION ALL
            SELECT t.dsa_mobile_number, t.partner_code
            FROM ru_direct_selling_agents t
            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
        ) 
        SELECT dsa_mobile_number
        FROM DSAHierarchy
      ) `;

    query += ` and product_id = ${product_id} `;

    query += ` GROUP BY MONTH(created_at) ORDER BY total_approved DESC `;

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const withdrawDsaConsent = async ({ dsa_id, phone, consent_type, reason = null, userId = null }) => {
    const insertConsentQuery = `
        INSERT INTO ru_dsa_consents (dsa_id, consent_type, description, created_at, updated_at)
        VALUES (?, ?, ?, NOW(), NOW())
    `;
    await _db2.query(insertConsentQuery, {
        replacements: [dsa_id, consent_type?.toLowerCase(), reason],
        type: QueryTypes.INSERT
    });

    const isWithdrawn = consent_type === 'WITHDRAWN';

    const [dsaInfo] = await _db2.query(
        "SELECT dsa_mobile_number, partner_code, business_head_code, first_name, last_name FROM ru_direct_selling_agents WHERE dsa_id = ?",
        { replacements: [dsa_id], type: QueryTypes.SELECT }
    );

    // Update DSA status and communication preferences
    let query = ` UPDATE ru_direct_selling_agents SET email_communication = ?, whatsapp_communication = ?, sms_communication = ?, notification_communication = ?, is_deleted = ?, is_blacklisted = ? WHERE dsa_id = ? `;
    let bindParams = isWithdrawn ? [0, 0, 0, 0, 1, 1, dsa_id] : [1, 1, 1, 1, 0, 0, dsa_id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });

    // Update user status
    query = ` UPDATE users SET status = ? WHERE phone = ? `;
    bindParams = isWithdrawn ? [0, phone] : [1, phone];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });

    // Update onboarding steps status
    const [row] = await _db2.query(
        "SELECT id FROM ru_user_onboarding_steps WHERE dsa_id=? AND step='dsa_consent'",
        { replacements: [dsa_id], type: QueryTypes.SELECT }
    );

    await _db2.query(
        row
            ? "UPDATE ru_user_onboarding_steps SET status=? WHERE dsa_id=? AND step='dsa_consent'"
            : "INSERT INTO ru_user_onboarding_steps (status, dsa_id, step) VALUES (?, ?, 'dsa_consent')",
        { replacements: [isWithdrawn ? 0 : 1, dsa_id] }
    );

    // Hierarchy Reassignment for direct children and descendants (if WITHDRAWN)
    if (dsaInfo && isWithdrawn) {
        const removed_dsa_mobile = dsaInfo.dsa_mobile_number;
        const parent_partner_code = dsaInfo.partner_code || '';
        const parent_business_head_code = dsaInfo.business_head_code || null;

        // 1. Update partner_code for direct children
        await _db2.query(
            "UPDATE ru_direct_selling_agents SET partner_code = ? WHERE partner_code = ? AND is_deleted = 0",
            { replacements: [parent_partner_code, removed_dsa_mobile], type: QueryTypes.UPDATE }
        );

        // 2. Update business_head_code for direct children / descendants who had this removed DSA as business head
        await _db2.query(
            "UPDATE ru_direct_selling_agents SET business_head_code = ? WHERE business_head_code = ? AND is_deleted = 0",
            { replacements: [parent_business_head_code, removed_dsa_mobile], type: QueryTypes.UPDATE }
        );

        // 3. Update hierarchy columns for all descendants whose materialized_path contains this dsa_id
        let updates = [];
        let replacements = {};

        // Replace dsa_id from materialized_path
        updates.push("materialized_path = TRIM(TRAILING '/' FROM REPLACE(CONCAT(materialized_path, '/'), :replace_id_slash, '/'))");
        replacements.replace_id_slash = `/${dsa_id}/`;

        // Construct full name for name replace
        const removed_dsa_name = (dsaInfo.first_name || dsaInfo.last_name)
            ? `${dsaInfo.first_name || ''} ${dsaInfo.last_name || ''}`.trim()
            : '';

        // Replace name/mobile from hierarchy_crm using CONCAT + REPLACE + TRIM
        let hierarchyCrmExpr = "CONCAT(hierarchy_crm, '/')";
        if (removed_dsa_name) {
            hierarchyCrmExpr = `REPLACE(${hierarchyCrmExpr}, :replace_name_slash, '/')`;
            replacements.replace_name_slash = `/${removed_dsa_name}/`;
        }
        hierarchyCrmExpr = `REPLACE(${hierarchyCrmExpr}, :replace_mobile_slash, '/')`;
        replacements.replace_mobile_slash = `/${removed_dsa_mobile}/`;

        updates.push(`hierarchy_crm = TRIM(TRAILING '/' FROM ${hierarchyCrmExpr})`);

        // Update materialized_path_depth and heirarchy_level (decrement by 1)
        updates.push("materialized_path_depth = CASE WHEN materialized_path_depth IS NOT NULL AND materialized_path_depth > 0 THEN materialized_path_depth - 1 ELSE 0 END");
        updates.push("heirarchy_level = CASE WHEN heirarchy_level IS NOT NULL AND heirarchy_level > 0 THEN heirarchy_level - 1 ELSE 0 END");

        replacements.like_id_slash = `%/${dsa_id}/%`;
        replacements.like_id_end = `%/${dsa_id}`;
        replacements.removed_dsa_id = dsa_id;

        const updateDescendantsQuery = `
                UPDATE ru_direct_selling_agents 
                SET ${updates.join(', ')} 
                WHERE (materialized_path LIKE :like_id_slash OR materialized_path LIKE :like_id_end)
                  AND dsa_id != :removed_dsa_id
            `;

        await _db2.query(updateDescendantsQuery, {
            replacements,
            type: QueryTypes.UPDATE
        });
    }
};

const createRuApiLogs = async (data) => {
    const { dsa_mobile_number, internal_api, payload, response, headers, api_type } = data;
    let query = ` insert into ru_api_logs (header, dsa_mobile_number, internal_api, payload, response, status_code, method, api_type, updated_at, created_at) values(?,?,?,?,?,?,?,?,?,?) `;
    let bindParams = [headers, dsa_mobile_number, internal_api, payload, response, 201, "POST", api_type, new Date(), new Date()];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
};

const getLoginFormDashboardByPhoneNumbers = async (phone, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter) => {
    let bindParams = [];
    bindParams.push(phone);
    let query = ` SELECT
    CONCAT(REPEAT('-', 0),
    dsa_name,
    ' (',
    dsa_mobile_number,
    ')') AS dsa,
    dsa_mobile_number,
    dsa_id,
    partner_code,
    CAST(SUM(CASE WHEN loan_status like '%rejected%' THEN 1 ELSE 0 END) AS UNSIGNED ) AS total_rejected,
    CAST(SUM(CASE WHEN loan_status like '%disbursed%' THEN 1 ELSE 0 END) AS UNSIGNED ) AS total_disbursed,
    CAST(SUM(CASE WHEN loan_status like '%approved%' THEN 1 ELSE 0 END) AS UNSIGNED ) AS total_approved,
    CAST(SUM(CASE WHEN loan_status like '%login%' THEN 1 ELSE 0 END) AS UNSIGNED ) AS total_in_progress,
    CAST(SUM(CASE WHEN loan_status like '%disbursed%' THEN disbursed_loan_amount ELSE 0 END) AS UNSIGNED ) AS total_disbursed_amount,
    CAST(SUM(CASE WHEN loan_status like '%approved%' THEN loan_amount ELSE 0 END) AS UNSIGNED ) AS total_approved_amount
    FROM
    dsa_application_view_payout_claims t1 WHERE is_deleted = 0 and upload_file_name is null and status = 0 `;

    if (startDateFilter) {
        query += ` and DATE(t1.disbursed_date) between DATE("${startDateFilter}") and DATE("${endDateFilter}") and `;
    };

    if (startDateLoginFilter) {
        query += ` and DATE(t1.created_at) between DATE("${startDateLoginFilter}") and DATE("${endDateLoginFilter}") and `;
    };

    query += ` dsa_mobile_number in (
    WITH RECURSIVE DSAHierarchy AS (
    SELECT dsa_mobile_number, partner_code
    FROM ru_direct_selling_agents
    WHERE dsa_mobile_number = ?
    UNION ALL
    SELECT t.dsa_mobile_number, t.partner_code
    FROM ru_direct_selling_agents t
    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
    )
    SELECT dsa_mobile_number
    FROM DSAHierarchy
    ) GROUP BY dsa_mobile_number ORDER BY total_disbursed DESC `

    let treeCount = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return treeCount;
};

const getYearlyLogiFormReport = async (dsa_mobile_number) => {
    let query = ` SELECT
    MONTH(created_at) AS month,
    CAST(SUM(CASE WHEN loan_status like '%rejected%' THEN 1 ELSE 0 END) AS UNSIGNED ) AS total_rejected,
    CAST(SUM(CASE WHEN loan_status like '%disbursed%' THEN 1 ELSE 0 END) AS UNSIGNED ) AS total_disbursed,
    CAST(SUM(CASE WHEN loan_status like '%approved%' THEN 1 ELSE 0 END) AS UNSIGNED ) AS total_approved,
    CAST(SUM(CASE WHEN loan_status like '%login%' THEN 1 ELSE 0 END) AS UNSIGNED ) AS total_in_progress,
    CAST(SUM(CASE WHEN loan_status like '%disbursed%' THEN disbursed_loan_amount ELSE 0 END) AS UNSIGNED ) AS total_disbursed_amount,
    CAST(SUM(CASE WHEN loan_status like '%approved%' THEN loan_amount ELSE 0 END) AS UNSIGNED ) AS total_approved_amount
    FROM
    dsa_application_view_payout_claims t1 WHERE is_deleted = 0 and upload_file_name is null and status = 0 
    and dsa_mobile_number IN (
    WITH RECURSIVE DSAHierarchy AS (
    SELECT dsa_mobile_number, partner_code
    FROM ru_direct_selling_agents
    WHERE dsa_mobile_number = '${dsa_mobile_number}'
    UNION ALL
    SELECT t.dsa_mobile_number, t.partner_code
    FROM ru_direct_selling_agents t
    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
    )
    SELECT dsa_mobile_number
    FROM DSAHierarchy
    )
    and MONTH(created_at) is not null
    GROUP BY
    MONTH(created_at)
    ORDER BY
    total_disbursed DESC `;
    let bindParams = [dsa_mobile_number];
    let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return data;
};

const getCombinedLoanApplications = async (where, offset, limit, childPhones) => {
    let bindParams = [];
    let joinQuery = ` ${where}`;

    let query = `with combined as (${generateLoanUnionQuery()}) select 
    pl.application_id,
    pl.product_id,
    pl.applied_loan_amount,
    pl.approved_loan_amount,
    pl.loan_tenure,
    pl.disbursed_loan_amount,
    pl.disbursed_date,
    pl.sub_stage,
    pl.stage,
    pl.status,
    pl.created_at,
    pl.customer_id,
    pl.product_name,
    pl.journey_type,
    pl.loan_type_name,
    pl.dsa_mobile_number,
    pl.full_name AS full_name,
    pl.dsa_id AS dsa_id,
    pl.materialized_path,
    pl.city,
    pl.state,
    pl.utm_source, 
    pl.utm_medium, 
    pl.utm_campaign, 
    pl.utm_content, 
    pl.utm_channel, 
    pl.utm_term, 
    pl.utm_id, 
    pl.utm_adgroup, 
    pl.utm_main_source,
    pl.utm_device,
    pl.page_source,
    pl.source_from,
    pl.adgroupid,
    pl.campaignid,
    pl.ad,
    pl.mt,
    pl.adpos,
    pl.gad,
    pl.gclid

    from combined pl ${joinQuery}`;

    let queryCount = `with combined as (${generateLoanUnionQuery()}) select count(distinct application_id) as totalCount 
    from combined pl ${joinQuery}`;

    query += ` group by application_id order by pl.created_at desc, application_id limit ${offset},${limit} `;
    let totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    let lntApplications = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return { records: lntApplications, totalRecords: totalCount[0].totalCount };
};

const reassignCustomerPartner = async (dsaId, partnerPhone) => {
    let query = ` select c.customer_mobile_number, sp.full_name as sales_person_name, sp.dsa_mobile_number as sales_person_mobile from ru_customers c left join ru_direct_selling_agents sp on sp.dsa_mobile_number = c.sp_mobile_number where c.id = ? `;
    let bindParams = [dsaId];
    let prevData = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    let status;

    if (prevData[0]?.customer_mobile_number == partnerPhone) {
        status = "69";
        return { status };
    };

    query = ' update ru_customers set sp_mobile_number = ? where id = ? ';
    bindParams = [partnerPhone, dsaId];

    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });

    query = ` select full_name as sales_person_name, dsa_mobile_number as sales_person_mobile from ru_direct_selling_agents where dsa_mobile_number = ? `;
    bindParams = [partnerPhone];
    let newData = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    const { customer_mobile_number, ...rest } = prevData[0];
    return { prevData: rest, newData: newData[0] };
};

const updateLntApplicationById = async (data) => {
    const { application_status, app_ref, failure_reason, id } = data;
    let query = ` update ru_lt_personal_loan_applications set application_status = ? where application_id = ? `;
    let bindParams = [application_status || null, id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });

    query = ` update ru_lt_personal_loan_applications_meta set app_ref = ?, failure_reason = ? where application_id = ? `;
    bindParams = [app_ref || null, failure_reason || null, id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
};

const changeDsaEmployeeStatus = async (data) => {
    const { dsa_id, employee, value } = data;
    const isEmployee = employee !== undefined && employee !== null
        ? (employee ? 1 : 0)
        : (Number(value) ? 1 : 0);

    const existing = await _db2.query(
        `SELECT dsa_id, is_employee FROM ru_direct_selling_agents WHERE dsa_id = ? LIMIT 1`,
        { replacements: [dsa_id], type: QueryTypes.SELECT }
    );
    if (!existing?.[0]) {
        return { dsa_id, employee: Boolean(isEmployee), updated: false };
    }

    await _db2.query(
        `UPDATE ru_direct_selling_agents SET is_employee = ? WHERE dsa_id = ?`,
        { replacements: [isEmployee, dsa_id], type: QueryTypes.UPDATE }
    );

    return {
        dsa_id,
        employee: Boolean(isEmployee),
        updated: true
    };
};

const getUtmJourneyUrl = async ({ product_id, application_id }) => {
    let query = ` select * from ru_loans_products where id = ${product_id} `;
    let bindParams = [product_id];
    let data = await _db3.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let url = data[0]?.utm_journey_url ? `${data[0]?.utm_journey_url}${application_id}` : null;
    return url
};

const getApplicationUpdateLogs = async (loan_type, table, application_id) => {
    if (loan_type != "credit_card") {
        query = `
        SELECT 
            a.application_id, 
            a.stage, 
            a.sub_stage, 
            a.status_description, 
            a.status, 
            a.disbursed_loan_amount, 
            m.disbursed_date,
            rm.sp_name AS rm_name
        FROM 
            ${table} a
        LEFT JOIN 
            ${table.replace(/s(?=[^s]*$)/, '_metas')} m 
        ON 
            a.application_id = m.application_id
        LEFT JOIN 
            ru_branch_sales_people rm
        ON 
            rm.id = m.sales_person_id
        WHERE 
            a.application_id = ?;
    `;
    } else {
        query = ` select application_id, stage, sub_stage, status_description, status from ${table} where application_id = ? `;
    };
    let data = await _db2.query(query, { replacements: [application_id], type: QueryTypes.SELECT });
    return data[0] || null;
};

const updateLoanApplication = async (data) => {
    const { loan_type, table, product_id, stage, sub_stage, status_description, status, disbursed_loan_amount, disbursed_date, application_id, sub_status } = data;

    let query = ` update ${table} set product_id = ?, stage = ?, sub_stage = ?, status_description = ?, status = ?, sub_status = ?
        ${loan_type != "credit_card" ? `, disbursed_loan_amount = ? ` : ""}
        where application_id = ? `;

    let bindParams = [product_id, stage || null, sub_stage || null, status_description || null, status, sub_status];
    loan_type != "credit_card" && bindParams.push(disbursed_loan_amount || null);
    bindParams.push(application_id);

    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });


    //update metas

    if (loan_type != "credit_card" && status == "disbursed") {
        query = ` select * from ${table.replace(/s(?=[^s]*$)/, '_metas')} where application_id = ? `;
        let application = await _db2.query(query, { replacements: [application_id], type: QueryTypes.SELECT });
        let meta_application_id = application[0]?.application_id || null;

        if (meta_application_id) {
            query = ` update ${table.replace(/s(?=[^s]*$)/, '_metas')} set disbursed_date = ? where  application_id = ? `;
            await _db2.query(query, { replacements: [disbursed_date || null, application_id] });
        } else {
            query = `insert into ${table.replace(/s(?=[^s]*$)/, '_metas')} (application_id, disbursed_date) VALUES (?, ?)`;
            await _db2.query(query, { replacements: [application_id, disbursed_date || null] });
        };
    };

    return;
};

const updateDsaHierarchyString = async (dsa_mobile_number, data, business_head) => {
    let addtional = business_head?.dsa_mobile_number ? `, business_head_code = '${business_head?.dsa_mobile_number}' ` : "";
    const query = ` update ru_direct_selling_agents set hierarchy_crm = ? ${addtional} where dsa_mobile_number = ? `;
    let results = await _db2.query(query, { replacements: [data, dsa_mobile_number], type: QueryTypes.UPDATE });
    return results;
};

const getCompanies = async (search) => {
    const query = ` SELECT id, company_name FROM ru_customer_companies ${search} `;
    const result = await _db2.query(query, { type: QueryTypes.SELECT });
    return result;
};

const getRMList = async (loan_type, applicationId, search, pageSize, offset) => {
    const _loanInfo = getLoanTableInfo(loan_type);
    const productQuery = `
        SELECT product_id 
        FROM ${_loanInfo?.table_name}
        WHERE application_id = ?
    `;
    const [productResult] = await _db2.query(productQuery, {
        replacements: [applicationId],
        type: QueryTypes.SELECT
    });

    if (!productResult || !productResult.product_id) {
        return [];
    }

    const productId = productResult.product_id;

    let query = `
        SELECT 
            id,
            city,
            branch_name,
            sp_id,
            sp_name,
            sp_email,
            sp_mobile
        FROM ru_branch_sales_people
        WHERE product_id = ?
    `;

    if (search) {
        query += ` AND sp_name LIKE '${search}%'`;
    }


    query += ` ORDER BY id ASC`;
    query += ` LIMIT ${pageSize} OFFSET ${offset}`;

    const [data] = await _db2.query(query, {
        replacements: [productId],
        type: QueryTypes.SELECT,
    });
    console.log(data)
    return data;
};

const getLoanDetails = async (loan_type, applicationId) => {
    const _loanInfo = getLoanTableInfo(loan_type);
    if (!_loanInfo) return null;

    const query = `
        SELECT * 
        FROM ${_loanInfo.table_name} 
        WHERE application_id = ?
    `;

    // Execute the query
    const [data] = await _db2.query(query, {
        replacements: [applicationId],
        type: QueryTypes.SELECT,
    });

    console.log("Fetched Data:", data);
    return data;
};

const checkIfMobileNumberIsVerified = async (customerId) => {
    const query = `SELECT is_mobile_number_verified FROM ru_customers WHERE customer_id = ?`;
    const [data] = await _db2.query(query, {
        replacements: [customerId],
        type: QueryTypes.SELECT,
    });
    return data;
}

const checkDsaMobileNumberVerified = async (dsaId) => {
    // Check if DSA has is_mobile_number_verified field, if not, assume it's verified (1)
    const query = `SELECT is_mobile_number_verified FROM ru_direct_selling_agents WHERE dsa_id = ?`;
    try {
        const results = await _db2.query(query, { replacements: [dsaId], type: QueryTypes.SELECT });
        return results[0] ? results[0].is_mobile_number_verified : 1; // Default to verified if field doesn't exist
    } catch (error) {
        // If field doesn't exist, assume mobile is verified
        return 1;
    }
};

const editLoanDetails = async (applicationId, applied_loan_amount, approved_loan_amount, disbursed_loan_amount, loan_tenure, loan_type, address_id, income_id) => {
    const _loanInfo = getLoanTableInfo(loan_type);
    if (!_loanInfo) return null;

    const fields = [
        "applied_loan_amount = ?",
        "approved_loan_amount = ?",
        "disbursed_loan_amount = ?",
        "loan_tenure = ?",
    ];

    const replacements = [applied_loan_amount, approved_loan_amount, disbursed_loan_amount, loan_tenure];

    // Add optional fields if provided
    if (address_id) {
        fields.push("address_id = ?");
        replacements.push(address_id);
    }
    if (income_id) {
        fields.push("income_id = ?");
        replacements.push(income_id);
    }

    replacements.push(applicationId);

    const query = `
        UPDATE ${_loanInfo.table_name}
        SET ${fields.join(", ")}
        WHERE application_id = ?
    `;

    const [data] = await _db2.query(query, {
        replacements,
        type: QueryTypes.UPDATE,
    });

    return data;
};

const createMergeLogs = (data, dsa) => {
    const keys = Object?.keys(data);

    const getDsa = (id, both = false) => {
        if (both) {
            const dsa0 = dsa?.[0] || {};
            const dsa1 = dsa?.[1] || {};
            return `${dsa0["first_name"] || ""} ${dsa0["last_name"] || ""}(${dsa0["dsa_mobile_number"] || ""}) and ${dsa1["first_name"] || ""} ${dsa1["last_name"] || ""}(${dsa1["dsa_mobile_number"] || ""})`;
        } else {
            let obj = dsa?.find((obj) => obj?.dsa_id == id || obj?.dsa_mobile_number == id);
            if (!obj) {
                return id || "";
            }
            return `${obj["first_name"] || ""} ${obj["last_name"] || ""}(${obj["dsa_mobile_number"] || ""})`;
        };
    };

    let str = `DSA ${getDsa(data["secondary"]?.[0])} merged into ${getDsa(data["primary"]?.[0])}`;
    let and = false;
    for (let i = 0; i < keys?.length; i++) {
        const key = keys[i];
        if (!["secondary", "primary", "secondary_mobile", "primary_mobile", "proceed"]?.includes(key) && Array.isArray(data[key]) && data[key].length > 0) {
            if (!and) {
                str += " with";
            }
            str += `${and ? " and" : ""}  ${key} of ${data[key]?.length > 1 ? `both` : `${getDsa(data[key][0])}`}`;
            and = true;
        };
    };

    return str;
};


const mergeDsa2 = async (data) => {
    let query = ` select *, CONCAT(first_name, ' ', COALESCE(middle_name, ''), ' ', last_name) as full_name from ru_direct_selling_agents where dsa_id in (?) `;
    let dsa = await _db2.query(query, { replacements: [[...data["primary"], ...data["secondary"]]], type: QueryTypes.SELECT });

    let primary_dsa = dsa?.find((obj) => obj?.dsa_id == data["primary"][0]);
    data["primary_mobile"] = primary_dsa["dsa_mobile_number"];
    let secondary_dsa = dsa?.find((obj) => obj?.dsa_id == data["secondary"][0]);
    data["secondary_mobile"] = secondary_dsa["dsa_mobile_number"];

    const getMobileFromId = (id) => {
        let arr = [];

        for (let j = 0; j < id.length; j++) {
            arr.push(dsa?.find((obj) => obj?.dsa_id == id[j])["dsa_mobile_number"]);
        };

        return arr;
    };

    let toBeRemoved = (id, type = "id") => {
        if (type == "id") {
            return [[data?.primary[0], data?.secondary[0]]?.filter((obj) => obj != id)[0]] || null;
        };
        return [[data?.primary_mobile, data?.secondary_mobile]?.filter((obj) => obj != id)[0]] || null;
    };

    let updateObj = mergeDsaTables;
    let updateFields = [];

    for (let i = 0; i < Object?.keys(updateObj)?.length; i++) {
        let key = Object?.keys(updateObj)[i];
        let keys = key?.split("#");

        let tables = updateObj[key];

        let set_fields = keys[2] ? " dsa_id = ?, dsa_mobile_number = ?  " : ` ${keys[1]} = ? `;
        let replacements = keys[2] ? [data["primary"][0], data["primary_mobile"], data[keys[0]], getMobileFromId(data[keys[0]])] : [keys[1] == "dsa_id" ? data["primary"][0] : data["primary_mobile"], keys[1] == "dsa_id" ? data[keys[0]] : getMobileFromId(data[keys[0]])];

        let where_field = keys[2] ? ` (dsa_id in (?) or dsa_mobile_number in (?)) ` : ` ${keys[1]} in (?) `;
        let remove = null;

        if (data[keys[0]]?.length < 2) {
            if (keys[2]) {
                remove = [toBeRemoved(data[keys[0]][0]),
                toBeRemoved(
                    data[keys[0]][0] == data["primary"][0] ? data["primary_mobile"] : data["secondary_mobile"],
                    "mobile"
                )]
            } else {
                remove = [keys[1] == "dsa_id" ? toBeRemoved(data[keys[0]][0]) :
                    toBeRemoved(
                        data[keys[0]][0] == data["primary"][0] ? data["primary_mobile"] : data["secondary_mobile"],
                        "mobile"
                    )];
            }
        };

        console.log({
            key,
            keys,
            tables,
            set_fields,
            replacements,
            where_field,
            remove
        });

        updateFields.push({ tables, set_fields, replacements, where_field, remove });
    };
    let logs = createMergeLogs(data, dsa);
    return { logs, updateFields, primary_dsa, secondary_dsa };
};

const modifyPermissions = async (type, reference_id, tag) => {
    if (type == "dsa") {
        let query = ` update ru_direct_selling_agents set access_control = ? where dsa_id = ? `;
        await _db2.query(query, { replacements: [tag, reference_id], type: QueryTypes.UPDATE });
    };
};

const getPermissions = async (type, dsa_id) => {
    let data = [];
    if (type == "dsa") {
        let query = ` select access_control from ru_direct_selling_agents where dsa_id = ? `;
        data = await _db2.query(query, { replacements: [dsa_id], type: QueryTypes.SELECT });
    };
    const access_control = data[0]?.access_control;
    const permissions = access_control.split(",");
    return permissions;
};

const toggleNotificationDsa = async (dsa_id, setClause) => {
    let result = [];
    if (setClause?.length) {
        let query = ` update ru_direct_selling_agents set ${setClause} where dsa_id = ? `;
        data = await _db2.query(query, { replacements: [dsa_id], type: QueryTypes.UPDATE });
        result = setClause;
    } else {
        let query = ` select email_communication, whatsapp_communication, sms_communication, notification_communication from ru_direct_selling_agents where dsa_id = ? `;
        result = await _db2.query(query, { replacements: [dsa_id], type: QueryTypes.SELECT });
    };
    return result;
};

const validateAndInsertLeadForInstantClaim = async (application_id, dsa_id, netsuite_vendor_id, loan_type, phone, platform) => {
    const _loanInfo = getLoanTableInfo(loan_type);

    //for wrong loan type
    if (!_loanInfo) {
        return { isValid: false, errorMsg: "Loan Type not Found!" }
    }

    let query = `select pl.dsa_id , pl.claim_status , pl.status , pl.disbursed_loan_amount , pl.product_id , pl.external_id , plm.disbursed_date , c.first_name , c.last_name , c.full_name , c.address_city as city , c.company_name  from ${_loanInfo.table_name} pl left join ${_loanInfo.meta_table} plm on plm.application_id = pl.application_id left join ru_customers c on pl.customer_id = c.customer_id  where pl.application_id = ? ORDER BY plm.created_at DESC LIMIT 1`
    let bindParams = [application_id];
    let result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT })

    //if application not found in that loan_type
    if (!result || !result[0]) {
        return { isValid: false, errorMsg: "Application not Found!" }
    }

    //if application is not of the same dsa
    if (result[0].dsa_id !== dsa_id) {
        return { isValid: false, errorMsg: "You are not permitted to claim this application!" }
    }

    //if application is already claimed
    if (result[0].claim_status) {
        return { isValid: false, errorMsg: "This application is already Claimed!" }
    }

    //non disbursed case can not be claimed
    if (result[0].status !== "disbursed") {
        return { isValid: false, errorMsg: "non disbursed applications can not be claimed!" }
    }

    //disbursement date and disbursed amount check
    if (!result[0].disbursed_loan_amount || !result[0].disbursed_date) {
        return { isValid: false, errorMsg: "Disbursed Amount and Disbursment Date are Mandatory for instant Claim!" }
    }

    const disbursement_amount = result[0].disbursed_loan_amount
    const disbursement_date = result[0].disbursed_date
    const disbursement_date_iso = toIsoDateIST(disbursement_date)

    //const claim_month = claculateClaimMonth() // previous logic to calculate claimMonth from current date
    //extract claim month from disb_date
    const claim_month = deriveClaimMonthFromDisbDate(disbursement_date_iso)

    const request_date_iso = new Date().toISOString().split('T')[0];
    const customer_first_name = result[0].first_name;
    const customer_last_name = result[0].last_name;
    const customer_full_name = result[0].full_name;
    const customer_company_name = result[0].company_name;
    const customer_city = result[0].city;

    if (!result[0].external_id) {
        return { isValid: false, errorMsg: "External Id is mandatory for instant Claims!" }
    }

    //to be stored as loan n.o /apac n.o
    const external_id = result[0].external_id;

    query = `select lp.is_claim_enabled , lp.ns_bank_product_id from ru_loans_products lp where id = ?`
    bindParams = [result[0].product_id]
    let product = await _db3.query(query, { replacements: bindParams, type: QueryTypes.SELECT })

    //if product not found 
    if (!product || !product[0]) {
        return { isValid: false, errorMsg: "Product not found!" }
    }

    //if product claim is not enabled
    if (!product[0].is_claim_enabled) {
        return { isValid: false, errorMsg: "Instant claim is not available for this product" }
    }

    //product must be mapped with a bank
    if (!product[0].ns_bank_product_id) {
        return { isValid: false, errorMsg: "This product is not Mapped with any bank, Please contact your BH for assistance." }
    }

    //dsa payout must be there
    query = `select rdp.rate, bpc.bank_id , bpc.product_id , np.product_name  , nb.bank_name from ru_bank_product_combinations bpc join ru_netsuite_products np on np.netsuite_product_id = bpc.product_id and np.status = 1 join ru_netsuite_banks nb on nb.netsuite_bank_id = bpc.bank_id and nb.status = 1 LEFT JOIN LATERAL (
      SELECT rate 
      FROM ru_dsa_payouts r 
      WHERE UUID_TO_BIN(r.bank_product_combinations_id) = bpc.bank_product_combinations_id 
        AND r.dsa_id = ?
      LIMIT 1
    ) rdp ON true where bpc.id = ? and bpc.status = 1`
    bindParams = [dsa_id, product[0].ns_bank_product_id]
    let bank_product_combination = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT })

    //product must be mapped with a bank
    if (!bank_product_combination || !bank_product_combination[0]) {
        return { isValid: false, errorMsg: "This product is not Mapped with any bank, Please contact your BH for assistance." }
    }

    const bank_id = bank_product_combination[0].bank_id;
    const product_id = bank_product_combination[0].product_id;
    const bank_name = bank_product_combination[0].bank_name;
    const product_name = bank_product_combination[0].product_name;
    const rate = bank_product_combination[0].rate

    /*  //find dsa payout
     query = `select lp.percentage as payout_value from payouts p left join lead_payout lp on lp.payout_id = p.id  where p.bank_id = ? and p.product_id = ? and lp.phone = ?`
     bindParams = [bank_id, product_id, phone]
     const payout = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT }) */

    //if no payout then
    if (!rate) {
        return { isValid: false, errorMsg: "Your Payout is not set, Please contact your BH for assistance." }
    }

    const payout_value = rate;
    const vendor_payout_amount = (payout_value / 100) * disbursement_amount;

    //new fresh lead obj
    const data = {
        fresh_lead_id: uuid(),
        dsa_id: dsa_id,
        fresh_lead_status_id: 0,
        dsa_mobile_number: phone,
        loan_reference_id: external_id,
        loan_apac_ref_los_number: external_id,
        loan_status: "disbursed",
        netsuite_bank_id: bank_id,
        netsuite_product_id: product_id,
        customer_first_name: customer_first_name,
        customer_last_name: customer_last_name,
        customer_full_name: customer_full_name,
        city: customer_city,
        customer_company_name: customer_company_name,
        product_name: product_name,
        bank_name: bank_name,
        business_categories: '11',
        form_type: "instant_claim",
        disbursement_amount: disbursement_amount,
        disbursement_date: disbursement_date,
        disbursement_date_iso: disbursement_date_iso,
        vendor_payout_type: "rate",
        vendor_payout_rate: payout_value,
        vendor_payout_ratio: null,
        request_date: formatSignupDate(new Date()),
        request_date_iso: request_date_iso,
        created_by: dsa_id,
        platform: platform,
        claim_pending_flag: 1,
        is_split_case: "no",
        claim_month: claim_month,
        netsuite_vendor_id: netsuite_vendor_id,
        multi_funded_flag: -1,
        payout_collide: false,
        payout_collide_value: null,
        vendor_payout_amount: vendor_payout_amount,
        app_ref_id: application_id,
        loan_type: loan_type
    }

    query = ` insert into ru_fresh_lead_claims(business_categories, fresh_lead_status_id, fresh_lead_id, dsa_id, dsa_mobile_number, product_name, bank_name, netsuite_bank_id, customer_full_name, customer_first_name, customer_last_name, claim_month, loan_reference_id, loan_apac_ref_los_number, customer_company_name, loan_status, disbursement_amount, disbursement_date, disbursement_date_iso, city, vendor_payout_type, vendor_payout_rate ,  vendor_payout_ratio,netsuite_vendor_id, netsuite_product_id, request_date, request_date_iso, platform, form_type, created_by, is_split_case , vendor_payout_amount , payout_collide , payout_collide_value , multi_funded_flag , claim_pending_flag , app_ref_id , loan_type) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    bindParams = [data.business_categories, data.fresh_lead_status_id, data.fresh_lead_id, data.dsa_id, data.dsa_mobile_number, data.product_name, data.bank_name, data.netsuite_bank_id, data.customer_full_name, data.customer_first_name, data.customer_last_name, data.claim_month, data.loan_reference_id, data.loan_apac_ref_los_number, data.customer_company_name, data.loan_status, data.disbursement_amount, data.disbursement_date, data.disbursement_date_iso, data.city, data.vendor_payout_type, data.vendor_payout_rate, data.vendor_payout_ratio, data.netsuite_vendor_id, data.netsuite_product_id, data.request_date, data.request_date_iso, data.platform, data.form_type, data.created_by, data.is_split_case, data.vendor_payout_amount, data.payout_collide, data.payout_collide_value, data.multi_funded_flag, data.claim_pending_flag, data.app_ref_id, data.loan_type];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT })

    // Search for bank file match (main first, then tentative)
    let bankFileMatchResult = { is_matched: false, is_tentative_matched: 0, tentative_bank_file_id: null, is_bank_file_matched: 0, bank_file_id: null };
    if (data.loan_reference_id && data.loan_apac_ref_los_number && data.netsuite_bank_id && data.netsuite_product_id) {
        bankFileMatchResult = await matchLeadBankFile(
            data.netsuite_bank_id,
            data.netsuite_product_id,
            data.loan_reference_id,
            data.loan_apac_ref_los_number,
            data.business_categories,
            0
        );
    }

    // Insert into ru_fresh_lead_claims_meta with bank file matching info / online lead info
    const insertMetaQuery = `INSERT INTO ru_fresh_lead_claims_meta (fresh_lead_id, confirmation_required, is_tentative_matched, tentative_bank_file_id, is_bank_file_matched, bank_file_id, is_online_lead, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    let is_online_lead = 1;
    await _db2.query(insertMetaQuery, {
        replacements: [
            data.fresh_lead_id,
            0,
            bankFileMatchResult.is_tentative_matched,
            bankFileMatchResult.tentative_bank_file_id,
            bankFileMatchResult.is_bank_file_matched,
            bankFileMatchResult.bank_file_id,
            is_online_lead,
            new Date(),
            new Date()
        ],
        type: sequelize.QueryTypes.INSERT,
    });

    if (bankFileMatchResult.is_matched) {
        await claimMatchedBankFileSource(bankFileMatchResult, data.fresh_lead_id);
    }

    return { isValid: true, new_lead: data }

}

const updateApplicationClaimStatus = async (application_id, loan_type, status) => {
    const _loanInfo = getLoanTableInfo(loan_type);
    if (!_loanInfo) return false;

    let query = `update ${_loanInfo.table_name} pl set claim_status = ? where pl.application_id = ?`
    await _db2.query(query, { replacements: [status, application_id], type: QueryTypes.UPDATE })
    return true;
}

//const getDsaPartnerDetailsById = async (dsa_id) => {
const getDsaBhDetailsById = async (dsa_id) => {
    //let query = `SELECT partner.email_address , partner.id , partner.full_name , dsa.full_name as dsa_full_name , dsa.hierarchy_crm  FROM ru_direct_selling_agents AS dsa JOIN ru_direct_selling_agents AS partner ON dsa.partner_code = partner.dsa_mobile_number WHERE dsa.dsa_id = ?`
    let query = `SELECT bh.email_address , bh.id , bh.full_name , dsa.full_name as dsa_full_name , dsa.hierarchy_crm  FROM ru_direct_selling_agents AS dsa JOIN ru_direct_selling_agents AS bh ON dsa.business_head_code = bh.dsa_mobile_number WHERE dsa.dsa_id = ?`
    let partner = await _db2.query(query, { replacements: [dsa_id], type: QueryTypes.SELECT })
    return partner[0] || null
}

const sendInstantClaimNotificationAndEmail = async (dsa_id, fresh_lead, isCLaimed = true) => {

    let partner = await getDsaBhDetailsById(dsa_id);
    if (!partner) {
        return { status: false, message: "BH not found!" };
    }

    const { email_address, id, full_name, dsa_full_name } = partner;
    if (!email_address) {
        return { status: false, message: "BH email address not found" };
    }

    const htmlTemplate = isCLaimed
        ? InstantClaimEmailTemplate(fresh_lead, partner)
        : unclaimedInstantClaimEmailTemplate(fresh_lead, partner);

    const subject = isCLaimed ? "New Instant Claim" : "Unclaimed Instant Claim";

    const emailNotification = new EmailSendEmailPayout(
        uuid().replace(/-/g, ''),
        email_address,
        subject,
        null,
        htmlTemplate,
        id,
        "SYSTEM",
        "EmailSendEmail"
    );

    const pushNotification = new SendPayoutNotificationCRM(
        uuid().replace(/-/g, ''),
        email_address, // corrected from partner.email
        `Hi ${full_name || ""}`,
        subject,
        null,
        "/lead-forms/instant-claim/",
        `${dsa_full_name} has ${isCLaimed ? "claimed" : "received"} a file with Loan Number ${fresh_lead.loan_reference_id}`,
        id,
        dsa_id
    );

    await connectKafkaProducer();
    await sendToKafkaEngine(emailNotification);
    await sendToKafkaEngine(pushNotification);

    return { status: true };
};


const sendInstantClaimErrorEmail = async (dsa_id, application_id, error_message) => {
    let query = `SELECT dsa_id as id , email_address , full_name   FROM ru_direct_selling_agents  WHERE dsa_id = ?`
    let partner = await _db2.query(query, { replacements: [dsa_id], type: QueryTypes.SELECT })
    if (!partner.length) {
        return { status: false, message: "DSA not found!" }
    }

    partner = partner[0];
    const email_address = partner.email_address || null
    if (!email_address) {
        return { status: false, message: "DSA email address not found" }
    }

    //email class
    const emailNotification = new EmailSendEmailPayout(
        uuid().replace(/-/g, ''),
        partner.email_address, //reciever email address
        "Instant Claim Processing Failed – Action Required", //email subject
        null, //text in email body
        InstantClaimErrorEmailTemplate({ application_id, error_message }, partner),  //html body for email
        partner.id,
        "SYSTEM", //created by
        "EmailSendEmail"
    );

    await connectKafkaProducer()
    await sendToKafkaEngine(emailNotification)

    return { status: true }
};

const updateDsaNsHierarchy = async (vendor_pan_number, dsa_id, update = true) => {
    try {
        const data = await callNsApi({
            "api": "customscript_ruloans_rest_send_vendor",
            "payload": {
                "internalid": "",
                "pan_number": vendor_pan_number
            }
        });

        if (!data || data.Code === 400) {
            return { isValid: false, message: "Failed to Sync Data from NS" };
        }

        if (data.class && update) {
            await updateDsaKycData({
                dsa_id,
                ns_hierarchy: data?.class,
                class_id: data?.class_internal_id,
                isKycExist: true
            });
        }

        return { isValid: true, data };
    } catch (error) {
        return { isValid: false, message: "Failed to Sync Data from NS" };
    }
};

const getNsVendorIdentifiersForDsa = async (dsa_id) => {
    if (!dsa_id) return { internalid: "", pan_number: "" };
    const rows = await _db2.query(
        `SELECT COALESCE(netsuite_vendor_id, '') AS internalid, COALESCE(permanent_account_number, '') AS pan_number
         FROM ru_dsa_kyc_data
         WHERE dsa_id = ?
         LIMIT 1`,
        { replacements: [dsa_id], type: QueryTypes.SELECT }
    );
    const row = rows?.[0] || {};
    return {
        internalid: String(row.internalid || "").trim(),
        pan_number: String(row.pan_number || "").trim()
    };
};

const triggerNsVendorUpdateForDsa = async ({ dsa_id, vendor_email = null, phone = null }) => {
    try {
        const { internalid, pan_number } = await getNsVendorIdentifiersForDsa(dsa_id);
        if (!internalid && !pan_number) return;

        const payload = {
            internalid: internalid || "",
            pan_number: internalid ? "" : pan_number,
            vendor_update: "True"
        };

        const emailValue = vendor_email != null ? String(vendor_email).trim() : "";
        const phoneValue = phone != null ? String(phone).trim() : "";
        if (emailValue) payload.vendor_email = emailValue;
        if (phoneValue) payload.phone = phoneValue;

        if (!payload.vendor_email && !payload.phone) return;

        await callNsApi({
            api: "customscript_ruloans_rest_send_vendor",
            payload
        });
    } catch (error) {
        // NetSuite update should never block the user flow.
        return;
    }
};

const dbNullIfEmpty = (v) => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
};

/** B2B: read vendor_code / branch_code from ru_dsa_kyc_data only (no NetSuite). Null in DB → null in response. */
const getDsaKycVendorBranchFromDbForDsaId = async (dsa_id) => {
    const id = String(dsa_id || '').trim();
    if (!id) {
        return { dsa_id: dsa_id, ok: false, code: 400, message: 'dsa_id is required', vendor_code: null, branch_code: null };
    }

    const kyc = await getDsaKycById(id);
    if (!kyc) {
        return { dsa_id: id, ok: false, code: 404, message: 'DSA KYC row not found', vendor_code: null, branch_code: null };
    }

    return {
        dsa_id: id,
        ok: true,
        code: 200,
        message: 'Success',
        vendor_code: dbNullIfEmpty(kyc.vendor_code),
        branch_code: dbNullIfEmpty(kyc.branch_code)
    };
};

/** B2B: single dsa_id — vendor_code / branch_code from ru_dsa_kyc_data (null if unset). */
const refreshDsaKycVendorBranchFromNsB2b = async ({ dsa_id }) => {
    try {
        return await getDsaKycVendorBranchFromDbForDsaId(dsa_id);
    } catch (e) {
        return {
            dsa_id: dsa_id != null ? String(dsa_id) : null,
            ok: false,
            code: 500,
            message: e?.message || 'Unexpected error',
            vendor_code: null,
            branch_code: null
        };
    }
};

const getAllCRMUsers = async () => {
    const countQuery = `
       SELECT count(*) as total_count
        FROM CRMTest.users
        WHERE isDeleted = false
        AND tokenUpdatedAt IS NOT NULL
        AND status = 1
        AND tokenUpdatedAt >= CURRENT_DATE - INTERVAL 1 MONTH;
      `;
    const countResult = await _db2.query(countQuery, { type: QueryTypes.SELECT });
    return { totalCount: countResult[0].total_count };
}

const getLeadFormCategory = async (fresh_lead_id) => {
    let query = `select 
                    case 
                    WHEN flc.form_type = 'customer_lead_form' AND 
                    (flc.loan_status IS NULL OR flc.loan_status != 'disbursed') THEN NULL
                    when flc.is_deleted = 1 then "deleted"
                    when flc.multi_funded_flag = 0 then "multi_funded_pending"
                    when flc.multi_funded_flag = 1 then "multi_funded_confirmed"
                    when flc.claim_pending_flag = 0 then "claim_pending"
                    when d.assigning_payout_percentage is null or d.assigning_payout_percentage = 0 then "payout_pending"
                    when flc.fresh_lead_status_id in (13) then "banker_confirmation_pending" 
                    when flc.fresh_lead_status_id in (0) then "pending" 

                    when flc.fresh_lead_status_id in (1,6) then "approved_erp"
                    when flc.fresh_lead_status_id in (2,5,9,10,11,12) then "wip_erp"
                    when flc.fresh_lead_status_id in (4) then "not_found_erp"
                    when flc.fresh_lead_status_id in (3,7,8) then "error_erp"
                    end as category
                 from ru_fresh_lead_claims flc left join ru_direct_selling_agents d on flc.dsa_mobile_number = d.dsa_mobile_number where fresh_lead_id = ?`
    let bindParams = [fresh_lead_id]
    let result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT })
    return result[0] || null
}

const getClaimsByDsaId = async (dsa_id) => {
    const query = `SELECT COUNT(*) as totalCount
                   FROM ru_fresh_lead_claims
                   WHERE dsa_id = ?`;

    const data = await _db2.query(query, {
        replacements: [dsa_id],
        type: QueryTypes.SELECT
    });

    return data[0];
};

const updateJourneyStep = async (step, dsa_id, status = 1) => {
    let query = `select * from ru_user_onboarding_steps where dsa_id = ? and step = ?`;
    let isExist = await _db2.query(query, { replacements: [dsa_id, step], type: QueryTypes.SELECT });
    isExist = isExist[0] || null;

    if (isExist) {
        query = `update ru_user_onboarding_steps set status = ?, status_changed_at = ? where dsa_id = ? and step = ?`;
        await _db2.query(query, { replacements: [status, new Date(), dsa_id, step], type: QueryTypes.UPDATE });
    } else {
        query = `insert into ru_user_onboarding_steps (dsa_id, step, status, status_changed_at) values (?,?,?,?)`;
        await _db2.query(query, { replacements: [dsa_id, step, status, new Date()], type: QueryTypes.INSERT });
    };
};

/** Email verification gate for DSA basic details (see migration is_email_address_verified). */
const getDsaEmailVerificationState = async (dsa_id) => {
    if (!dsa_id) return null;
    const query = `
        SELECT email_address, COALESCE(is_email_address_verified, 0) AS is_email_address_verified
        FROM ru_direct_selling_agents
        WHERE dsa_id = ?
        LIMIT 1
    `;
    const rows = await _db2.query(query, { replacements: [dsa_id], type: QueryTypes.SELECT });
    const row = rows?.[0];
    if (!row) return null;
    const em = row.email_address;
    return {
        email_address: em,
        is_email_address_verified: Number(row.is_email_address_verified) || 0,
        has_email: !!(em != null && String(em).trim() !== "")
    };
};

const setDsaEmailAddressVerified = async (dsa_id, email) => {
    await _db2.query(
        `UPDATE ru_direct_selling_agents
         SET is_email_address_verified = 1, updated_at = NOW()
         WHERE dsa_id = ?
           AND LOWER(TRIM(COALESCE(email_address, ''))) = LOWER(TRIM(?))`,
        { replacements: [dsa_id, email], type: QueryTypes.UPDATE }
    );
};

/** After OTP success: set profile email and mark verified (no prior email on row required). */
const setDsaEmailAddressAndVerified = async (dsa_id, email) => {
    await _db2.query(
        `UPDATE ru_direct_selling_agents
         SET email_address = ?, is_email_address_verified = 1, updated_at = NOW()
         WHERE dsa_id = ?`,
        { replacements: [email, dsa_id], type: QueryTypes.UPDATE }
    );
};

const DSA_EMAIL_OTP_EXPIRES_MINUTES = 10;
const DSA_EMAIL_OTP_COOLDOWN_SECONDS = 45;
const DSA_EMAIL_OTP_MAX_ATTEMPTS = 5;
const DSA_EMAIL_OTP_LOCK_MINUTES = 5;

const normalizeDsaEmailForOtp = (email) => String(email || "").trim().toLowerCase();

const getDsaEmailOtpSession = async (dsa_id, email) => {
    const emailNorm = normalizeDsaEmailForOtp(email);
    const rows = await _db2.query(
        `SELECT id, dsa_id, email_address, otp_hash, attempt_count, expires_at, cooldown_until, locked_until, is_consumed
         FROM ru_dsa_email_otp_sessions
         WHERE dsa_id = ? AND email_address = ?
         LIMIT 1`,
        { replacements: [dsa_id, emailNorm], type: QueryTypes.SELECT }
    );
    return rows?.[0] || null;
};

const upsertDsaEmailOtpSession = async (dsa_id, email, otp_hash) => {
    const emailNorm = normalizeDsaEmailForOtp(email);
    await _db2.query(
        `INSERT INTO ru_dsa_email_otp_sessions
            (dsa_id, email_address, otp_hash, attempt_count, expires_at, cooldown_until, locked_until, is_consumed)
         VALUES
            (?, ?, ?, 0, DATE_ADD(NOW(), INTERVAL ? MINUTE), DATE_ADD(NOW(), INTERVAL ? SECOND), NULL, 0)
         ON DUPLICATE KEY UPDATE
            otp_hash = VALUES(otp_hash),
            attempt_count = 0,
            expires_at = VALUES(expires_at),
            cooldown_until = VALUES(cooldown_until),
            locked_until = NULL,
            is_consumed = 0,
            updated_at = NOW()`,
        {
            replacements: [dsa_id, emailNorm, otp_hash, DSA_EMAIL_OTP_EXPIRES_MINUTES, DSA_EMAIL_OTP_COOLDOWN_SECONDS],
            type: QueryTypes.INSERT
        }
    );
};

const consumeDsaEmailOtpSession = async (dsa_id, email) => {
    const emailNorm = normalizeDsaEmailForOtp(email);
    await _db2.query(
        `UPDATE ru_dsa_email_otp_sessions SET is_consumed = 1, updated_at = NOW() WHERE dsa_id = ? AND email_address = ?`,
        { replacements: [dsa_id, emailNorm], type: QueryTypes.UPDATE }
    );
};

const isDsaEmailOtpSessionLocked = (session) =>
    !!(session?.locked_until && new Date(session.locked_until) > new Date());

const isDsaEmailOtpSessionOnCooldown = (session) =>
    !!(session?.cooldown_until && new Date(session.cooldown_until) > new Date());

const isDsaEmailOtpSessionExpiredOrConsumed = (session) => {
    if (!session || Number(session.is_consumed) === 1) {
        return true;
    }
    if (!session.expires_at || new Date(session.expires_at) <= new Date()) {
        return true;
    }
    return false;
};

const incrementDsaEmailOtpAttempt = async (session) => {
    const newCount = (Number(session.attempt_count) || 0) + 1;
    const lockSql =
        newCount >= DSA_EMAIL_OTP_MAX_ATTEMPTS
            ? `, locked_until = DATE_ADD(NOW(), INTERVAL ${DSA_EMAIL_OTP_LOCK_MINUTES} MINUTE)`
            : "";
    await _db2.query(
        `UPDATE ru_dsa_email_otp_sessions SET attempt_count = ?, updated_at = NOW()${lockSql} WHERE id = ?`,
        { replacements: [newCount, session.id], type: QueryTypes.UPDATE }
    );
    return newCount;
};

const getEmailConflictWithOtherDsaForOtp = async (email, dsa_id) => {
    const list = await getDsaByPrimaryId(email, "email_address");
    if (!Array.isArray(list) || !list.length) {
        return null;
    }
    const others = list.filter((row) => row.dsa_id !== dsa_id);
    return others.length ? "Email already registered with another DSA" : null;
};

const normDsaEmailForOtpCompare = (e) => String(e || "").trim().toLowerCase();

/** B2B external re-verify: email must already be verified and match profile. */
const assertDsaEmailReverificationEligible = (state, email) => {
    if (!state) {
        return { ok: false, statusCode: 404, message: "DSA not found" };
    }
    if (Number(state.is_email_address_verified) !== 1 || !state.has_email) {
        return {
            ok: false,
            statusCode: 400,
            message:
                "Email is not verified yet. Use POST /v2/dsa/send-dsa-email-verification-otp for first-time verification."
        };
    }
    const em = String(email || "").trim();
    if (!em) {
        return { ok: false, statusCode: 400, message: "Email is required" };
    }
    if (normDsaEmailForOtpCompare(em) !== normDsaEmailForOtpCompare(state.email_address)) {
        return {
            ok: false,
            statusCode: 400,
            message: "Re-verification must use the verified email currently on the DSA profile."
        };
    }
    return { ok: true };
};

/**
 * Same behavior as POST `/v2/dsa/send-dsa-email-verification-otp` (used by ERP email gate and the HTTP handler).
 * @returns {Promise<{ ok: boolean, statusCode: number, message: string }>}
 */
const sendDsaEmailAddressVerificationOtpForDsa = async (dsa_id, email) => {
    if (!dsa_id || !String(dsa_id).trim()) {
        return { ok: false, statusCode: 400, message: "DSA id is required" };
    }
    const em = email != null ? String(email).trim() : "";
    if (!em) {
        return { ok: false, statusCode: 400, message: "Email is required" };
    }
    try {
        const state = await getDsaEmailVerificationState(dsa_id);
        const norm = (e) => String(e || "").trim().toLowerCase();
        if (state?.is_email_address_verified === 1 && state?.has_email && norm(em) === norm(state.email_address)) {
            return { ok: true, statusCode: 200, message: "Email is already verified" };
        }
        const emailConflict = await getEmailConflictWithOtherDsaForOtp(em, dsa_id);
        if (emailConflict) {
            return { ok: false, statusCode: 400, message: emailConflict };
        }

        const existingSession = await getDsaEmailOtpSession(dsa_id, em);
        if (isDsaEmailOtpSessionLocked(existingSession)) {
            return { ok: false, statusCode: 429, message: "Too many failed attempts. Try again in a few minutes." };
        }
        if (isDsaEmailOtpSessionOnCooldown(existingSession)) {
            return { ok: false, statusCode: 429, message: "Please wait before requesting a new OTP." };
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
        await upsertDsaEmailOtpSession(dsa_id, em, hashedOtp);

        await sendEmailSmtp(
            {
                to: em,
                subject: "Novostack — Verify your email",
                body: dsaEmailVerificationOtpEmailTemplate(otp, "10 minutes")
            },
            true
        );

        return { ok: true, statusCode: 200, message: "Verification OTP sent to your email" };
    } catch (e) {
        return { ok: false, statusCode: 500, message: e && e.message ? e.message : "Failed to send verification OTP" };
    }
};

/**
 * Same behavior as POST `/v2/dsa/verify-dsa-email-verification-otp`.
 * @returns {Promise<{ ok: boolean, statusCode: number, message: string, data?: { dsa_id: string, email: string } }>}
 */
const verifyDsaEmailAddressVerificationOtpForDsa = async (dsa_id, email, otp) => {
    if (!dsa_id || !String(dsa_id).trim()) {
        return { ok: false, statusCode: 400, message: "DSA id is required" };
    }
    const em = email != null ? String(email).trim() : "";
    if (!em) {
        return { ok: false, statusCode: 400, message: "Email is required" };
    }
    const otpStr = otp != null ? String(otp).trim() : "";
    if (!otpStr) {
        return { ok: false, statusCode: 400, message: "OTP is required" };
    }
    try {
        const isDevStaticDsaEmailOtp = process.env.ENVIRONMENT == "dev" && otpStr === "666666";
        if (isDevStaticDsaEmailOtp) {
            const emailConflictVerify = await getEmailConflictWithOtherDsaForOtp(em, dsa_id);
            if (emailConflictVerify) {
                return { ok: false, statusCode: 400, message: emailConflictVerify };
            }
            await setDsaEmailAddressAndVerified(dsa_id, em);
            await triggerNsVendorUpdateForDsa({ dsa_id, vendor_email: em });
            await consumeDsaEmailOtpSession(dsa_id, em);
            return {
                ok: true,
                statusCode: 200,
                message: "Email address verified successfully",
                data: { dsa_id, email: em }
            };
        }

        const session = await getDsaEmailOtpSession(dsa_id, em);
        if (isDsaEmailOtpSessionLocked(session)) {
            return { ok: false, statusCode: 429, message: "Too many failed attempts. Try again in a few minutes." };
        }
        if (isDsaEmailOtpSessionExpiredOrConsumed(session) || !session?.otp_hash) {
            return { ok: false, statusCode: 400, message: "OTP expired or not found. Request a new code." };
        }

        if (Number(session.attempt_count) >= DSA_EMAIL_OTP_MAX_ATTEMPTS) {
            return { ok: false, statusCode: 429, message: "Maximum OTP attempts exceeded." };
        }

        const incomingHash = crypto.createHash("sha256").update(otpStr).digest("hex");
        if (incomingHash !== session.otp_hash) {
            const attempts = await incrementDsaEmailOtpAttempt(session);
            if (attempts >= DSA_EMAIL_OTP_MAX_ATTEMPTS) {
                return { ok: false, statusCode: 429, message: "Maximum OTP attempts exceeded." };
            }
            return { ok: false, statusCode: 400, message: "Invalid OTP" };
        }

        const emailConflictVerify = await getEmailConflictWithOtherDsaForOtp(em, dsa_id);
        if (emailConflictVerify) {
            return { ok: false, statusCode: 400, message: emailConflictVerify };
        }

        await setDsaEmailAddressAndVerified(dsa_id, em);
        await triggerNsVendorUpdateForDsa({ dsa_id, vendor_email: em });
        await consumeDsaEmailOtpSession(dsa_id, em);

        return {
            ok: true,
            statusCode: 200,
            message: "Email address verified successfully",
            data: { dsa_id, email: em }
        };
    } catch (e) {
        return { ok: false, statusCode: 500, message: e && e.message ? e.message : "Failed to verify email" };
    }
};

/**
 * B2B external — send OTP when email is already verified (re-confirmation).
 * POST `/v2/dsa/send-dsa-email-reverification-otp-external`
 */
const sendDsaEmailReverificationOtpForDsa = async (dsa_id, email) => {
    if (!dsa_id || !String(dsa_id).trim()) {
        return { ok: false, statusCode: 400, message: "DSA id is required" };
    }
    const em = email != null ? String(email).trim() : "";
    if (!em) {
        return { ok: false, statusCode: 400, message: "Email is required" };
    }
    try {
        const state = await getDsaEmailVerificationState(dsa_id);
        const eligible = assertDsaEmailReverificationEligible(state, em);
        if (!eligible.ok) {
            return eligible;
        }

        const existingSession = await getDsaEmailOtpSession(dsa_id, em);
        if (isDsaEmailOtpSessionLocked(existingSession)) {
            return { ok: false, statusCode: 429, message: "Too many failed attempts. Try again in a few minutes." };
        }
        if (isDsaEmailOtpSessionOnCooldown(existingSession)) {
            return { ok: false, statusCode: 429, message: "Please wait before requesting a new OTP." };
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
        await upsertDsaEmailOtpSession(dsa_id, em, hashedOtp);

        await sendEmailSmtp(
            {
                to: em,
                subject: "Novostack — Re-verify your email",
                body: dsaEmailVerificationOtpEmailTemplate(otp, "10 minutes")
            },
            true
        );

        return { ok: true, statusCode: 200, message: "Re-verification OTP sent to your email" };
    } catch (e) {
        return { ok: false, statusCode: 500, message: e && e.message ? e.message : "Failed to send re-verification OTP" };
    }
};

/**
 * B2B external — confirm OTP for an already-verified email.
 * POST `/v2/dsa/verify-dsa-email-reverification-otp-external`
 */
const verifyDsaEmailReverificationOtpForDsa = async (dsa_id, email, otp) => {
    if (!dsa_id || !String(dsa_id).trim()) {
        return { ok: false, statusCode: 400, message: "DSA id is required" };
    }
    const em = email != null ? String(email).trim() : "";
    if (!em) {
        return { ok: false, statusCode: 400, message: "Email is required" };
    }
    const otpStr = otp != null ? String(otp).trim() : "";
    if (!otpStr) {
        return { ok: false, statusCode: 400, message: "OTP is required" };
    }
    try {
        const state = await getDsaEmailVerificationState(dsa_id);
        const eligible = assertDsaEmailReverificationEligible(state, em);
        if (!eligible.ok) {
            return eligible;
        }

        const isDevStaticDsaEmailOtp = process.env.ENVIRONMENT == "dev" && otpStr === "666666";
        if (isDevStaticDsaEmailOtp) {
            await setDsaEmailAddressVerified(dsa_id, em);
            await triggerNsVendorUpdateForDsa({ dsa_id, vendor_email: em });
            await consumeDsaEmailOtpSession(dsa_id, em);
            return {
                ok: true,
                statusCode: 200,
                message: "Email re-verified successfully",
                data: { dsa_id, email: em, reverified: true }
            };
        }

        const session = await getDsaEmailOtpSession(dsa_id, em);
        if (isDsaEmailOtpSessionLocked(session)) {
            return { ok: false, statusCode: 429, message: "Too many failed attempts. Try again in a few minutes." };
        }
        if (isDsaEmailOtpSessionExpiredOrConsumed(session) || !session?.otp_hash) {
            return { ok: false, statusCode: 400, message: "OTP expired or not found. Request a new code." };
        }

        if (Number(session.attempt_count) >= DSA_EMAIL_OTP_MAX_ATTEMPTS) {
            return { ok: false, statusCode: 429, message: "Maximum OTP attempts exceeded." };
        }

        const incomingHash = crypto.createHash("sha256").update(otpStr).digest("hex");
        if (incomingHash !== session.otp_hash) {
            const attempts = await incrementDsaEmailOtpAttempt(session);
            if (attempts >= DSA_EMAIL_OTP_MAX_ATTEMPTS) {
                return { ok: false, statusCode: 429, message: "Maximum OTP attempts exceeded." };
            }
            return { ok: false, statusCode: 400, message: "Invalid OTP" };
        }

        await setDsaEmailAddressVerified(dsa_id, em);
        await triggerNsVendorUpdateForDsa({ dsa_id, vendor_email: em });
        await consumeDsaEmailOtpSession(dsa_id, em);

        return {
            ok: true,
            statusCode: 200,
            message: "Email re-verified successfully",
            data: { dsa_id, email: em, reverified: true }
        };
    } catch (e) {
        return { ok: false, statusCode: 500, message: e && e.message ? e.message : "Failed to re-verify email" };
    }
};

const upsertAllCompanySteps = async (dsa_id, type = "company") => {
    let where = type == "company" ? `dsa_type = "company"` : `dsa_type in ("biller", "individual")`;
    let query = `select * from ru_onboarding_steps where ${where} `;
    let steps = await _db2.query(query, { type: QueryTypes.SELECT });
    let stepsArray = steps?.map((obj) => obj.step);
    stepsArray = [...new Set(stepsArray)];
    console.log(stepsArray, "===")

    query = `delete from ru_user_onboarding_steps where dsa_id = ? and step in (?)`;
    await _db2.query(query, { replacements: [dsa_id, stepsArray], type: QueryTypes.DELETE });

    if (Array.isArray(stepsArray)) {
        const values = stepsArray.map(s => `(${_db2.escape(dsa_id)}, ${_db2.escape(s)}, ${_db2.escape(s == "lead_generation" ? 1 : 0)}, ${_db2.escape(new Date())})`).join(',');
        const query = `
            INSERT INTO ru_user_onboarding_steps (dsa_id, step, status, status_changed_at)
            VALUES ${values}
        `;

        await _db2.query(query, { type: QueryTypes.INSERT });
    }
};

const getDsaTaxDetails = async (dsa_id) => {
    let query = `SELECT c.company_name, c.gstin, c.hsn_hsc_number, c.gst_registration_type FROM ru_direct_selling_agents c WHERE c.dsa_id = ?`
    let bindParams = [dsa_id];
    let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return data[0] || null;
};

function formatCrmId(crmId) {
    const noHyphenUuidRegex = /^[a-fA-F0-9]{32}$/;
    let fomatted = crmId || null;

    if (fomatted) {
        if (noHyphenUuidRegex.test(fomatted)) {
            return fomatted.replace(
                /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
                '$1-$2-$3-$4-$5'
            );
        };
    };

    return fomatted;
};

const assignSalesPerson = async (dsaIdArray, crmId) => {
    const query = `
        UPDATE ru_direct_selling_agents
        SET salesperson_id = ?, salesperson_assigned_date = NOW()
        WHERE dsa_id IN (?)
    `;

    const bindParams = [formatCrmId(crmId), dsaIdArray];
    await _db2.query(query, {
        replacements: bindParams,
        type: QueryTypes.UPDATE
    });
};

const getSPbyId = async (dsaId) => {
    const query = `
      SELECT IFNULL(CAST(salesperson_id AS CHAR), '-') AS salesperson_id
      FROM RULoans.ru_direct_selling_agents
      WHERE dsa_id = ?
    `;
    const result = await _db2.query(query, {
        replacements: [dsaId],
        type: QueryTypes.SELECT,
    });
    return result?.[0]?.salesperson_id || '-';
};

const updateDsaTaxInformation = async (data) => {
    let { dsa_id, company_name, gstin, hsn_hsc_number, gst_registration_type } = data;
    let query = `UPDATE ru_direct_selling_agents SET company_name = ?, gstin = ?, hsn_hsc_number = ?, gst_registration_type = ? WHERE dsa_id = ?`
    let bindParams = [company_name, gstin, hsn_hsc_number, gst_registration_type, dsa_id]
    let result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return result || null
}

const updateGlobalPayoutPercentageNew = async (dsa_id, global_payout_percentage) => {

    query = `update ru_direct_selling_agents set global_payouts_percentage = ? where dsa_id = ?`
    bindParams = [global_payout_percentage, dsa_id]
    result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return result || null

}

const getDsaPayoutList = async (dsa_id, orderBy, whereFilterQuery, logicOperator = "and", offset = 0, limit = 10, externalWhereQuery = '', show_all = false, bank_product_combinations_id = null, isSameDayBillingEnabled = false) => {
    let query, queryCount;
    const bpcDetailLateralJoin = `
      LEFT JOIN LATERAL (
        SELECT d1.login_code, d1.remarks, d1.avg_achievment
        FROM ru_bank_product_combination_details d1
        WHERE d1.bank_product_combinations_id = bpc.bank_product_combinations_id
        ORDER BY d1.created_at DESC, d1.id DESC
        LIMIT 1
      ) d ON true`;
    if (!show_all) {
        const autonomousCols = isSameDayBillingEnabled ? `, rdp.autonomous_rate, rdp.autonomous_ratio, rdp.disb_date_from, rdp.disb_date_to` : '';
        query = `select rdp.bank_product_combinations_id , d.login_code , d.remarks, rdp.payout_lock, nb.bank_name , np.product_name as sub_product , np.main_product , rdp.rate as payout_percentage_lead, rdp.ratio, rdp.default_payout_type, rdp.default_autonomous_payout_type, CASE WHEN LOWER(np.category) IN ('secured','unsecured') THEN 1 ELSE 0 END as is_eligible_for_autonomous${autonomousCols} from ru_dsa_payouts rdp left join ru_bank_product_combinations bpc on (rdp.bank_product_combinations_id) = BIN_TO_UUID(bpc.bank_product_combinations_id) left join ru_netsuite_banks nb on bpc.bank_id = nb.netsuite_bank_id left join ru_netsuite_products np on bpc.product_id = np.netsuite_product_id ${bpcDetailLateralJoin} where rdp.dsa_id = ? `
        queryCount = `select count(Distinct rdp.id) as totalCount from ru_dsa_payouts rdp left join ru_bank_product_combinations bpc on (rdp.bank_product_combinations_id) = BIN_TO_UUID(bpc.bank_product_combinations_id) left join ru_netsuite_banks nb on bpc.bank_id = nb.netsuite_bank_id left join ru_netsuite_products np on bpc.product_id = np.netsuite_product_id ${bpcDetailLateralJoin} where rdp.dsa_id = ? `
    }
    else {
        query = `SELECT 
        BIN_TO_UUID(bpc.bank_product_combinations_id) AS bank_product_combinations_id,
        COALESCE(rdp.payout_lock, 0) AS payout_lock,
        nb.bank_name,
        np.product_name AS sub_product,
        np.main_product,
        CASE WHEN LOWER(np.category) IN ('secured','unsecured') THEN 1 ELSE 0 END as is_eligible_for_autonomous,
        d.login_code,
        d.remarks,
    ROUND(
    COALESCE(
        rdp.rate,
        (
            LEAST(
                COALESCE(rdsa.global_payouts_percentage, 50),
                COALESCE(bpc.max_payout_capping, COALESCE(rdsa.global_payouts_percentage, 50))
                ) * d.avg_achievment / 100
            )
        ),
        4
    ) AS payout_percentage_lead,
        rdp.ratio,
        rdp.default_payout_type,
        rdp.default_autonomous_payout_type
    FROM
        ru_bank_product_combinations bpc
    LEFT JOIN
        ru_dsa_payouts rdp
        ON rdp.bank_product_combinations_id = BIN_TO_UUID(bpc.bank_product_combinations_id)
        AND rdp.dsa_id = ?
    LEFT JOIN
        ru_direct_selling_agents rdsa
        ON rdsa.dsa_id = ?
    LEFT JOIN
        ru_netsuite_banks nb
        ON bpc.bank_id = nb.netsuite_bank_id
    LEFT JOIN
        ru_netsuite_products np
        ON bpc.product_id = np.netsuite_product_id
    ${bpcDetailLateralJoin}
    WHERE
        (rdp.rate is not null or rdp.ratio is not null or d.avg_achievment > 0) `
        queryCount = `SELECT
        COUNT(DISTINCT bpc.bank_product_combinations_id) as totalCount
    FROM
        ru_bank_product_combinations bpc
    LEFT JOIN
        ru_dsa_payouts rdp
        ON rdp.bank_product_combinations_id = BIN_TO_UUID(bpc.bank_product_combinations_id)
        AND rdp.dsa_id = ?
    LEFT JOIN
        ru_direct_selling_agents rdsa
        ON rdsa.dsa_id = ?
    LEFT JOIN
        ru_netsuite_banks nb
        ON bpc.bank_id = nb.netsuite_bank_id
    LEFT JOIN
        ru_netsuite_products np
        ON bpc.product_id = np.netsuite_product_id
    ${bpcDetailLateralJoin}
    WHERE
        (rdp.rate is not null or rdp.ratio is not null or d.avg_achievment > 0) `
    }

    let bindParams = show_all ? [dsa_id, dsa_id] : [dsa_id]
    if (whereFilterQuery && whereFilterQuery.length != 0) {
        for (let i = 0; i < whereFilterQuery.length; i++) {
            if (i == 0) {
                query += ` and `;
                queryCount += ` and `;
            }
            else {
                query += ` ${logicOperator} `;
                queryCount += ` ${logicOperator} `;
            }
            if (whereFilterQuery[i][2] !== null && whereFilterQuery[i][2] !== undefined && whereFilterQuery[i][2] !== '') {
                query += whereFilterQuery[i][0] + whereFilterQuery[i][1] + ' ? ';
                queryCount += whereFilterQuery[i][0] + whereFilterQuery[i][1] + ' ? ';
                bindParams.push(whereFilterQuery[i][2]);
            } else {
                query += whereFilterQuery[i][0] + whereFilterQuery[i][1] + ' ';
                queryCount += whereFilterQuery[i][0] + whereFilterQuery[i][1] + ' ';
            }
        }
    }
    if (externalWhereQuery) {
        query += externalWhereQuery;
        queryCount += externalWhereQuery;
    }
    if (bank_product_combinations_id) {
        query += ` and bpc.bank_product_combinations_id = UUID_TO_BIN(?) `;
        queryCount += ` and bpc.bank_product_combinations_id = UUID_TO_BIN(?) `;
        bindParams.push(bank_product_combinations_id);
    }
    if (show_all) {
        if (orderBy) {
            query += ` order by ${orderBy} `;
        }
        else {
            query += ` order by rdp.id desc `;
        };
    } else {
        query += ` ORDER BY nb.bank_name ASC, np.main_product ASC`;
    }

    if (limit) {
        query += ` limit ${offset} , ${limit} `;
    };

    let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    totalCount = totalCount[0]?.totalCount

    return { data: data || null, totalCount: totalCount };
}

const getPendingBankVerificationList = async (orderBy = " order by ba.id desc ", whereFilterQuery = [], logicOperator = "and", offset = 0, limit = 10) => {
    const bindParams = [];
    let filterClause = "";

    const whereFilters = Array.isArray(whereFilterQuery) ? whereFilterQuery : [];
    if (whereFilters.length > 0) {
        const filterConditions = [];
        const logic = String(logicOperator || "and").toUpperCase() === "OR" ? "OR" : "AND";

        for (let i = 0; i < whereFilters.length; i++) {
            const [field, operator, value] = whereFilters[i];

            if (Array.isArray(value) && value.length > 0) {
                const placeholders = value.map(() => "?").join(",");
                filterConditions.push(`${field} ${operator} (${placeholders})`);
                bindParams.push(...value);
            } else if (value !== null && value !== undefined && value !== "") {
                filterConditions.push(`${field} ${operator} ?`);
                bindParams.push(value);
            } else {
                filterConditions.push(`${field} ${operator}`);
            }
        }

        if (filterConditions.length > 0) {
            filterClause = ` AND (${filterConditions.join(` ${logic} `)})`;
        }
    }

    let query = `
        SELECT
            ba.id,
            ba.dsa_id,
            ba.company_id,
            COALESCE(rc.phone, d.dsa_mobile_number) as dsa_mobile_number,
            COALESCE(rc.name, d.full_name) as full_name,
            d.email_address,
            ba.account_holder_name,
            ba.account_number,
            ba.account_type,
            ba.bank_name,
            ba.ifsc,
            ba.user_type,
            ba.bank_account_id,
            ba.digio_pennydrop_id,
            ba.digio_pennydrop_verified_at,
            ba.digio_pennydrop_fuzzy_match_result,
            ba.digio_pennydrop_fuzzy_match_score,
            ba.tag as bank_type,
            ba.status,
            ba.tag,
            ba.remarks,
            ${SQL_BANK_ACCOUNT_CHEQUE_IMAGE("ba")} as cheque_image,
            ${SQL_BANK_ACCOUNT_PASSBOOK_IMAGE("ba")} as passbook_image,
            ba.created_at,
            ba.updated_at
        FROM ru_dsa_bank_accounts ba
        INNER JOIN ru_direct_selling_agents d ON d.dsa_id = ba.dsa_id
        LEFT JOIN ru_dsa_kyc_data kyc ON kyc.dsa_id = ba.dsa_id
        LEFT JOIN ru_companies rc ON rc.company_id = ba.company_id
        WHERE ba.status = 'pending_verification'
          AND ba.dsa_id IS NOT NULL
          AND ba.dsa_id != ''
          AND (d.is_deleted IS NULL OR d.is_deleted = 0)
          AND (
            CASE
              WHEN ba.company_id IS NOT NULL AND ba.company_id != ''
                THEN (rc.pan IS NOT NULL AND TRIM(rc.pan) != '')
              ELSE (kyc.permanent_account_number IS NOT NULL AND TRIM(kyc.permanent_account_number) != '')
            END
          )
        ${filterClause}
        ${orderBy || ""}
        LIMIT ?, ?
    `;

    const records = await _db2.query(query, {
        replacements: [...bindParams, Number(offset) || 0, Number(limit) || 10],
        type: QueryTypes.SELECT
    });

    const countQuery = `
        SELECT COUNT(1) as totalRecords
        FROM ru_dsa_bank_accounts ba
        INNER JOIN ru_direct_selling_agents d ON d.dsa_id = ba.dsa_id
        LEFT JOIN ru_dsa_kyc_data kyc ON kyc.dsa_id = ba.dsa_id
        LEFT JOIN ru_companies rc ON rc.company_id = ba.company_id
        WHERE ba.status = 'pending_verification'
          AND ba.dsa_id IS NOT NULL
          AND ba.dsa_id != ''
          AND (d.is_deleted IS NULL OR d.is_deleted = 0)
          AND (
            CASE
              WHEN ba.company_id IS NOT NULL AND ba.company_id != ''
                THEN (rc.pan IS NOT NULL AND TRIM(rc.pan) != '')
              ELSE (kyc.permanent_account_number IS NOT NULL AND TRIM(kyc.permanent_account_number) != '')
            END
          )
        ${filterClause}
    `;

    const totalResult = await _db2.query(countQuery, {
        replacements: bindParams,
        type: QueryTypes.SELECT
    });
    return { records, totalRecords: totalResult?.[0]?.totalRecords || 0 };
};

const updateDsaPayoutList = async (dsa_id, global_payout_percentage, hasAvgAchievementChanged = false, bank_product_combinations_id = null, avg_achievment = null) => {

    if (hasAvgAchievementChanged) {
        let query = ` UPDATE ru_dsa_payouts rdp left join ru_direct_selling_agents rdsa on rdp.dsa_id = rdsa.dsa_id SET rdp.rate = (:avg_achievment * rdsa.global_payouts_percentage / 100)  WHERE rdp.payout_lock = 0 AND rdp.bank_product_combinations_id = :bank_product_combinations_id`
        let result = await _db2.query(query, {
            replacements: {
                avg_achievment,
                bank_product_combinations_id
            },
            type: QueryTypes.UPDATE,
        });
        return result;
    }
    else {
        let query = ` UPDATE ru_dsa_payouts rdp  LEFT JOIN ru_bank_product_combinations bpc    ON (rdp.bank_product_combinations_id) = BIN_TO_UUID(bpc.bank_product_combinations_id)
        LEFT JOIN LATERAL (
          SELECT d1.avg_achievment
          FROM ru_bank_product_combination_details d1
          WHERE d1.bank_product_combinations_id = bpc.bank_product_combinations_id
          ORDER BY d1.created_at DESC, d1.id DESC
          LIMIT 1
        ) d ON true
        SET rdp.rate = (d.avg_achievment * :global_payout_percentage / 100), rdp.ratio = :global_payout_percentage  WHERE rdp.payout_lock = 0 AND rdp.dsa_id = :dsa_id`
        let result = await _db2.query(query, {
            replacements: {
                dsa_id,
                global_payout_percentage
            },
            type: QueryTypes.UPDATE,
        });

        return result
    }
};

const updateDsaAutonomousPayoutList = async (dsa_id, autonomous_secured_payout, autonomous_unsecured_payout, global_autonomous_disb_date_from, global_autonomous_disb_date_to) => {
    let query = ` UPDATE ru_dsa_payouts rdp
                    LEFT JOIN ru_bank_product_combinations bpc
                    ON rdp.bank_product_combinations_id = BIN_TO_UUID(bpc.bank_product_combinations_id)
                    LEFT JOIN ru_netsuite_products np
                    ON bpc.product_id = np.netsuite_product_id
                    LEFT JOIN LATERAL (
                      SELECT d1.avg_achievment
                      FROM ru_bank_product_combination_details d1
                      WHERE d1.bank_product_combinations_id = bpc.bank_product_combinations_id
                      ORDER BY d1.created_at DESC, d1.id DESC
                      LIMIT 1
                    ) d ON true

                    SET
                    rdp.autonomous_rate = (
                    d.avg_achievment *
                    (
                    CASE
                    WHEN LOWER(np.category) = 'secured'
                    THEN :autonomous_secured_payout
                    ELSE :autonomous_unsecured_payout
                    END
                    ) / 100
                    ),

                    rdp.autonomous_ratio = CASE
                    WHEN LOWER(np.category) = 'secured'
                    THEN :autonomous_secured_payout
                    ELSE :autonomous_unsecured_payout
                    END,
                    rdp.disb_date_from = :global_autonomous_disb_date_from,
                    rdp.disb_date_to = :global_autonomous_disb_date_to
                    WHERE rdp.dsa_id = :dsa_id and rdp.autonomous_ratio is not null`
    let result = await _db2.query(query, {
        replacements: {
            autonomous_secured_payout,
            autonomous_unsecured_payout,
            global_autonomous_disb_date_from,
            global_autonomous_disb_date_to,
            dsa_id,
        },
        type: QueryTypes.UPDATE,
    });
    return result;
}

const getDsaEligiblePayoutDetails = async (dsa_id, loan_type) => {
    const db_name = process.env.ENVIRONMENT === "dev" ? "`ruloans-service`" : "RUService";
    const sanitizedLoanType = loan_type?.trim().replace(/^"+|"+$/g, '');

    const personalLoanPart = `
        SELECT 
            CASE 
                WHEN np.product_name LIKE 'Digital%' AND a.claim_status = 0 
                THEN ROUND (a.disbursed_loan_amount * rdp.rate / 100 , 2)
                ELSE 0 
            END AS eligible_payout,
            CASE 
                WHEN np.product_name LIKE 'Digital%' AND a.claim_status = 1
                THEN ROUND (a.disbursed_loan_amount * rdp.rate / 100, 2)
                ELSE 0 
            END AS claimed_amount
        FROM ru_personal_loan_applications a
        JOIN ${db_name}.ru_loans_products p ON p.id = a.product_id AND p.is_claim_enabled = 1
        JOIN ru_bank_product_combinations bpc ON p.ns_bank_product_id = bpc.id AND bpc.status = 1
        JOIN ru_netsuite_products np ON np.netsuite_product_id = bpc.product_id AND np.status = 1
        JOIN ru_netsuite_banks nb ON nb.netsuite_bank_id = bpc.bank_id AND nb.status = 1
        LEFT JOIN ru_dsa_payouts rdp 
            ON rdp.dsa_id = a.dsa_id 
            AND (rdp.bank_product_combinations_id) = BIN_TO_UUID(bpc.bank_product_combinations_id)
        WHERE a.dsa_id = ? AND a.status = "disbursed"
    `;

    const blLoanPart = `
        SELECT 
            CASE 
                WHEN np.product_name LIKE 'Digital%' AND a.claim_status = 0  
                THEN ROUND(a.disbursed_loan_amount * rdp.rate / 100  , 2)
                ELSE 0 
            END AS eligible_payout,
            CASE 
                WHEN np.product_name LIKE 'Digital%' AND a.claim_status = 1
                THEN ROUND(a.disbursed_loan_amount * rdp.rate / 100, 2)
                ELSE 0 
            END AS claimed_amount
        FROM ru_bl_applications a
        JOIN ${db_name}.ru_loans_products p ON p.id = a.product_id AND p.is_claim_enabled = 1
        JOIN ru_bank_product_combinations bpc ON p.ns_bank_product_id = bpc.id AND bpc.status = 1
        JOIN ru_netsuite_products np ON np.netsuite_product_id = bpc.product_id AND np.status = 1
        JOIN ru_netsuite_banks nb ON nb.netsuite_bank_id = bpc.bank_id AND nb.status = 1
        LEFT JOIN ru_dsa_payouts rdp 
            ON rdp.dsa_id = a.dsa_id 
            AND (rdp.bank_product_combinations_id) = BIN_TO_UUID(bpc.bank_product_combinations_id)
        WHERE a.dsa_id = ? AND a.status = "disbursed"
    `;

    let loanQuery = "";
    let replacements = [];

    if (sanitizedLoanType === "personal_loan") {
        loanQuery = personalLoanPart;
        replacements = [dsa_id];
    } else if (sanitizedLoanType === "business_loan") {
        loanQuery = blLoanPart;
        replacements = [dsa_id];
    } else {
        loanQuery = `
            ${personalLoanPart}
            UNION ALL
            ${blLoanPart}
        `;
        replacements = [dsa_id, dsa_id];
    }

    const finalLoanQuery = `
        SELECT 
            ROUND(COALESCE(SUM(t.claimed_amount), 0), 2) AS total_disbursed,
            ROUND(COALESCE(SUM(t.eligible_payout), 0), 2) AS eligible_payout
        FROM (
            ${loanQuery}
        ) t
    `;

    const loanData = await _db2.query(finalLoanQuery, {
        replacements,
        type: QueryTypes.SELECT
    });

    const dsaQuery = `
        SELECT 
            is_direct_claim_enabled,
            CASE 
                WHEN assigning_payout_percentage IS NULL OR assigning_payout_percentage = 0 THEN false
                ELSE true
            END AS is_global_payout_capping_set
        FROM ru_direct_selling_agents 
        WHERE dsa_id = ?
        LIMIT 1
    `;

    const dsaData = await _db2.query(dsaQuery, {
        replacements: [dsa_id],
        type: QueryTypes.SELECT
    });

    return {
        ...loanData?.[0],
        ...dsaData?.[0]
    };
};


const instantClaimAllEligibleApplication = async (dsa_id, loan_type) => {
    const _loanInfo = getLoanTableInfo(loan_type);
    const sanitizedLoanType = loan_type?.trim().replace(/^"+|"+$/g, '');

    const db_name = process.env.ENVIRONMENT === "dev" ? "`ruloans-service`" : "RUService";

    let query = `SELECT 
                a.application_id
            FROM ${_loanInfo?.table_name} a
            JOIN ru_direct_selling_agents rdsa ON rdsa.dsa_id = a.dsa_id AND rdsa.assigning_payout_percentage IS NOT NULL AND rdsa.assigning_payout_percentage != 0 AND rdsa.is_direct_claim_enabled = 1
            JOIN ${db_name}.ru_loans_products p ON p.id = a.product_id AND p.is_claim_enabled = 1
            JOIN ru_bank_product_combinations bpc ON p.ns_bank_product_id = bpc.id AND bpc.status = 1
            JOIN ru_netsuite_products np ON np.netsuite_product_id = bpc.product_id AND np.status = 1 AND np.product_name LIKE 'Digital%' 
            JOIN ru_netsuite_banks nb ON nb.netsuite_bank_id = bpc.bank_id AND nb.status = 1
            JOIN ru_dsa_payouts rdp ON rdp.dsa_id = a.dsa_id AND (rdp.bank_product_combinations_id) = BIN_TO_UUID(bpc.bank_product_combinations_id) AND rdp.rate > 0
            WHERE 
                a.dsa_id = ? AND a.status = "disbursed" AND a.claim_status = 0`

    const data = await _db2.query(query, {
        replacements: [dsa_id],
        type: QueryTypes.SELECT
    });

    return data || null;
};

const updateDsaMasterPayout = async (bank_product_combinations_id, dsa_id, rate, ratio, payout_lock, default_payout_type, autonomousFields = {}, is_autonomous_enabled = null) => {
    let query = `INSERT INTO ru_dsa_payouts (dsa_id, bank_product_combinations_id, payout_lock`;
    let values = `VALUES (?, ?, ?`;
    let bindParams = [dsa_id, bank_product_combinations_id, payout_lock];

    let updateParts = [`payout_lock = ?`];
    let updateBindParams = [payout_lock];

    if (rate != null && rate != '') {
        query += `, rate`;
        values += `, ?`;
        bindParams.push(rate);
        updateParts.push(`rate = VALUES(rate)`);
    }

    if (ratio != null && ratio != '') {
        query += `, ratio`;
        values += `, ?`;
        bindParams.push(ratio);
        updateParts.push(`ratio = VALUES(ratio)`);
    }

    // Autonomous fields — only added when provided
    const { autonomous_rate, autonomous_ratio, disb_date_from, disb_date_to, default_autonomous_payout_type } = autonomousFields;

    if (is_autonomous_enabled === false) {
        query += `, autonomous_rate`;
        values += `, ?`;
        bindParams.push(null);
        updateParts.push(`autonomous_rate = VALUES(autonomous_rate)`);
    } else if (autonomous_rate != null && autonomous_rate !== '') {
        query += `, autonomous_rate`;
        values += `, ?`;
        bindParams.push(autonomous_rate);
        updateParts.push(`autonomous_rate = VALUES(autonomous_rate)`);
    }

    if (is_autonomous_enabled === false) {
        query += `, autonomous_ratio`;
        values += `, ?`;
        bindParams.push(null);
        updateParts.push(`autonomous_ratio = VALUES(autonomous_ratio)`);
    } else if (autonomous_ratio != null && autonomous_ratio !== '') {
        query += `, autonomous_ratio`;
        values += `, ?`;
        bindParams.push(autonomous_ratio);
        updateParts.push(`autonomous_ratio = VALUES(autonomous_ratio)`);
    }

    if (is_autonomous_enabled === false) {
        query += `, disb_date_from`;
        values += `, ?`;
        bindParams.push(null);
        updateParts.push(`disb_date_from = VALUES(disb_date_from)`);
    } else if (disb_date_from) {
        query += `, disb_date_from`;
        values += `, ?`;
        bindParams.push(disb_date_from);
        updateParts.push(`disb_date_from = VALUES(disb_date_from)`);
    }

    if (is_autonomous_enabled === false) {
        query += `, disb_date_to`;
        values += `, ?`;
        bindParams.push(null);
        updateParts.push(`disb_date_to = VALUES(disb_date_to)`);
    } else if (disb_date_to) {
        query += `, disb_date_to`;
        values += `, ?`;
        bindParams.push(disb_date_to);
        updateParts.push(`disb_date_to = VALUES(disb_date_to)`);
    }

    if (default_payout_type) {
        query += `, default_payout_type`;
        values += `, ?`;
        bindParams.push(default_payout_type);
        updateParts.push(`default_payout_type = VALUES(default_payout_type)`);
    }

    if (is_autonomous_enabled === false) {
        query += `, default_autonomous_payout_type`;
        values += `, ?`;
        bindParams.push(null);
        updateParts.push(`default_autonomous_payout_type = VALUES(default_autonomous_payout_type)`);
    } else if (default_autonomous_payout_type) {
        query += `, default_autonomous_payout_type`;
        values += `, ?`;
        bindParams.push(default_autonomous_payout_type);
        updateParts.push(`default_autonomous_payout_type = VALUES(default_autonomous_payout_type)`);
    }

    query += `) ${values})`;
    query += ` ON DUPLICATE KEY UPDATE ${updateParts.join(', ')}`;

    const finalBindParams = [...bindParams, ...updateBindParams];

    const data = await _db2.query(query, {
        replacements: finalBindParams,
        type: QueryTypes.INSERT
    });

    return data;
}

const getDsaBankProductPayoutDetils = async (dsa_id, bank_product_combinations_id) => {
    const query = `select rdp.* , nb.bank_name , np.product_name from ru_dsa_payouts rdp left join ru_bank_product_combinations bpc on rdp.bank_product_combinations_id = BIN_TO_UUID(bpc.bank_product_combinations_id) left join ru_netsuite_banks nb on bpc.bank_id = nb.netsuite_bank_id left join ru_netsuite_products np on bpc.product_id = np.netsuite_product_id where rdp.dsa_id = ? and rdp.bank_product_combinations_id = ?`
    const bindParams = [dsa_id, bank_product_combinations_id]
    const [result = {}] = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT })

    return result || null
}

const saveDsaPayoutDeal = async (dsa_id, deal, payout_capping) => {
    let query = `update ru_direct_selling_agents set `
    let hasSetClause = false
    let bindParams = []

    if (payout_capping) {
        query += `assigning_payout_percentage = ? , global_payouts_percentage = ? `
        bindParams.push(payout_capping, payout_capping)
        hasSetClause = true
    }
    if (deal !== undefined) {
        query += hasSetClause ? `, vendor_deal_description = ?` : `vendor_deal_description = ?`
        bindParams.push(deal)
    }
    query += ` where dsa_id = ?`
    if (!bindParams.length) {
        return null
    }
    bindParams.push(dsa_id)
    const [result = {}] = await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE })
    return result || null
}

const getCrmHierarchyFromMaterializedPath = async (materialized_path) => {
    const extractedArray = materialized_path ? materialized_path.slice(1).split('/') : [];
    if (!extractedArray.length) return null;

    const query = `select dsa_id , full_name , first_name , last_name from ru_direct_selling_agents where dsa_id IN (?)`
    const rows = await _db2.query(query, { replacements: [extractedArray], type: QueryTypes.SELECT })

    const rowByDsaId = new Map(rows.map((row) => [String(row.dsa_id), row]));

    let hierarchy_path_names = []
    for (let i = 0; i < extractedArray.length; i++) {
        const result = rowByDsaId.get(String(extractedArray[i]));

        let name = null;
        if (result?.full_name) {
            name = result.full_name;
        } else if (result?.first_name || result?.last_name) {
            const firstName = result?.first_name || '';
            const lastName = result?.last_name || '';
            name = `${firstName} ${lastName}`.trim();
        }

        if (name) {
            hierarchy_path_names.push(name);
        }
    }

    const hierarchyPath = hierarchy_path_names.length ? `/${hierarchy_path_names.join('/')}` : null
    return hierarchyPath
}

const insertDsaMultiplePayout = async (dsa_id, bank_ids, product_ids, is_select_all_banks, is_select_all_products, assigning_payout_percentage) => {

    //this API is for referals so we have to delete payouts of that particular dsa if any
    let deleteQuery = `delete from ru_dsa_payouts where dsa_id = ?`
    let deleteBindParams = [dsa_id]
    await _db2.query(deleteQuery, { replacements: deleteBindParams, type: QueryTypes.DELETE })


    let query = `INSERT INTO ru_dsa_payouts (dsa_id, bank_product_combinations_id, rate , ratio)
             SELECT :dsa_id,
                    BIN_TO_UUID(bpc.bank_product_combinations_id) as bank_product_combinations_id,
                    ROUND(bpc.latest_avg_achievment * (payout_multiplier / 100), 4) as rate,
                    payout_multiplier as ratio
             FROM (
                 SELECT bpc.*, d.avg_achievment as latest_avg_achievment,
                        CASE
                            WHEN bpc.max_payout_capping IS NOT NULL AND bpc.max_payout_capping > 0
                            THEN LEAST(:assigning_payout_percentage, bpc.max_payout_capping)
                            WHEN :assigning_payout_percentage IS NOT NULL AND :assigning_payout_percentage > 0
                            THEN :assigning_payout_percentage
                            ELSE 50
                        END as payout_multiplier
                 FROM ru_bank_product_combinations bpc
                 LEFT JOIN LATERAL (
                     SELECT d1.avg_achievment
                     FROM ru_bank_product_combination_details d1
                     WHERE d1.bank_product_combinations_id = bpc.bank_product_combinations_id
                     ORDER BY d1.created_at DESC, d1.id DESC
                     LIMIT 1
                 ) d ON true
                 WHERE 1=1 and d.avg_achievment > 0
             ) bpc WHERE 1=1 `;

    let replacements = {
        dsa_id: dsa_id,
        assigning_payout_percentage: assigning_payout_percentage
    };

    if (is_select_all_banks && is_select_all_products) {
    } else if (is_select_all_banks && !is_select_all_products) {
        if (product_ids && product_ids.length > 0) {
            const productPlaceholders = product_ids.map((_, index) => `:product_id_${index}`).join(',');
            query += ` AND bpc.product_id IN (${productPlaceholders})`;

            product_ids.forEach((product_id, index) => {
                replacements[`product_id_${index}`] = product_id;
            });
        }
    } else if (!is_select_all_banks && is_select_all_products) {
        if (bank_ids && bank_ids.length > 0) {
            const bankPlaceholders = bank_ids.map((_, index) => `:bank_id_${index}`).join(',');
            query += ` AND bpc.bank_id IN (${bankPlaceholders})`;

            bank_ids.forEach((bank_id, index) => {
                replacements[`bank_id_${index}`] = bank_id;
            });
        }
    } else {
        if (bank_ids && bank_ids.length > 0) {
            const bankPlaceholders = bank_ids.map((_, index) => `:bank_id_${index}`).join(',');
            query += ` AND bpc.bank_id IN (${bankPlaceholders})`;

            bank_ids.forEach((bank_id, index) => {
                replacements[`bank_id_${index}`] = bank_id;
            });
        }

        if (product_ids && product_ids.length > 0) {
            const productPlaceholders = product_ids.map((_, index) => `:product_id_${index}`).join(',');
            query += ` AND bpc.product_id IN (${productPlaceholders})`;

            product_ids.forEach((product_id, index) => {
                replacements[`product_id_${index}`] = product_id;
            });
        }
    }

    query += ` ON DUPLICATE KEY UPDATE rate = VALUES(rate)`;

    const [result = {}] = await _db2.query(query, {
        replacements: replacements,
        type: QueryTypes.INSERT
    });

    return result || null;
};

const getDsaPayoutBankAndProduct = async (dsa_id) => {
    const bindParams = [dsa_id]
    const select_all_banks_query = `select CASE 
                                        WHEN (SELECT COUNT(DISTINCT bank_id) FROM ru_bank_product_combinations WHERE avg_achievment > 0) <= 
                                        (SELECT COUNT(DISTINCT bpc.bank_id) FROM ru_dsa_payouts rdp 
                                        JOIN ru_bank_product_combinations bpc 
                                            ON rdp.bank_product_combinations_id = BIN_TO_UUID(bpc.bank_product_combinations_id) 
                                            AND bpc.avg_achievment > 0 
                                        WHERE rdp.dsa_id = ?)
                                        THEN true
                                        ELSE false
                                        END AS select_all_banks`

    let [result = {}] = await _db2.query(select_all_banks_query, { replacements: bindParams, type: QueryTypes.SELECT })
    const { select_all_banks = false } = result

    const select_all_products_query = `Select CASE 
                                        WHEN (SELECT COUNT(DISTINCT product_id) FROM ru_bank_product_combinations WHERE avg_achievment > 0) <= 
                                        (SELECT COUNT(DISTINCT bpc.product_id) FROM ru_dsa_payouts rdp 
                                        JOIN ru_bank_product_combinations bpc 
                                        ON rdp.bank_product_combinations_id = BIN_TO_UUID(bpc.bank_product_combinations_id) 
                                        AND bpc.avg_achievment > 0 
                                        WHERE rdp.dsa_id = ?)
                                        THEN true
                                        ELSE false
                                        END AS select_all_products`

    let [result2 = {}] = await _db2.query(select_all_products_query, { replacements: bindParams, type: QueryTypes.SELECT })
    const { select_all_products = false } = result2

    let bank_data = []
    let product_data = []

    if (!select_all_banks) {
        let query = `SELECT 
                    (
                        SELECT JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'bank_id', bank_id,
                                'bank_name', bank_name
                            )
                        )
                        FROM (
                            SELECT DISTINCT 
                                nb.netsuite_bank_id AS bank_id,
                                nb.bank_name AS bank_name
                            FROM ru_dsa_payouts rdp
                            JOIN ru_bank_product_combinations bpc 
                                ON rdp.bank_product_combinations_id = BIN_TO_UUID(bpc.bank_product_combinations_id)
                            JOIN ru_netsuite_banks nb 
                                ON bpc.bank_id = nb.netsuite_bank_id
                            WHERE rdp.dsa_id = ?
                        ) AS distinct_banks
                    ) AS bank_data`

        let [result = {}] = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT })
        bank_data = result?.bank_data || []
    }

    if (!select_all_products) {
        let query = `SELECT 
        (
            SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                    'product_id', product_id,
                    'product_name', product_name
                )
            )
            FROM (
                SELECT DISTINCT 
                    np.netsuite_product_id AS product_id,
                    np.product_name AS product_name
                FROM ru_dsa_payouts rdp
                JOIN ru_bank_product_combinations bpc 
                    ON rdp.bank_product_combinations_id = BIN_TO_UUID(bpc.bank_product_combinations_id)
                JOIN ru_netsuite_products np 
                    ON bpc.product_id = np.netsuite_product_id
                WHERE rdp.dsa_id = ?
            ) AS distinct_products
        ) AS product_data`

        let [result = {}] = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT })
        product_data = result?.product_data || []
    }


    return { bank_data, product_data, select_all_banks, select_all_products } || null
}

const getReferrerDetails = async (referrer_id) => {
    const query = `select rfp.full_name as referrer_name, rfp.dsa_mobile_number as referrer_mobile_number from ru_referrals rf  LEFT JOIN ru_direct_selling_agents rfp ON rfp.dsa_id = rf.referrer_id where rf.referred_id = ?`
    const bindParams = [referrer_id]
    const [result = {}] = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT })
    return result || null
}

const saveDsaSameDayBillingStatus = async (dsa_id, is_same_day_billing_enabled) => {
    const query = `update ru_direct_selling_agents set is_same_day_billing_enabled = ? where dsa_id = ?`
    const bindParams = [is_same_day_billing_enabled, dsa_id]
    const [result = {}] = await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE })
    return result || null
};


const getVendorDetailsByPan = async (pan) => {
    let query = ` select dsa_kyc.permanent_account_number as pan,dsa.dsa_mobile_number as dsa_mobile_number,dsa.dsa_id as dsa_id , dsa_kyc.ns_hierarchy as ns_hierarchy, dsa_kyc.netsuite_vendor_id, dsa.is_blacklisted , dsa.is_deleted , dsa.business_head_code, p.dsa_id as partner_id , dsa_kyc.class_id , dsa.materialized_path , dsa.hierarchy_crm , dsa_bank.account_number, dsa_bank.status as account_status from ru_dsa_kyc_data dsa_kyc left join ru_direct_selling_agents dsa on dsa.dsa_id = dsa_kyc.dsa_id left join ru_direct_selling_agents p on dsa.partner_code = p.dsa_mobile_number ${sqlPreferredBankAccountJoinByDsaId("dsa_bank", "dsa.dsa_id")} where dsa_kyc.permanent_account_number = ? `;
    const [result] = await _db2.query(query, { replacements: [pan], type: QueryTypes.SELECT });
    return result || null
};

function isNameOnCardMatching(NameOnTheCard, our_data) {
    const { first_name = '', middle_name = '', last_name = '' } = our_data || {};

    // Normalize everything to lowercase and trim spaces
    const cardName = (NameOnTheCard || '').toLowerCase().trim();
    const f = first_name.toLowerCase().trim();
    const m = middle_name.toLowerCase().trim();
    const l = last_name.toLowerCase().trim();

    // Generate possible name combinations
    const possibleNames = [
        `${f} ${l}`,
        `${f} ${m} ${l}`,
        `${f} ${m}`,
        `${m} ${l}`,
        `${l} ${f}`,
        f,
        l
    ].map(name => name.replace(/\s+/g, ' ').trim());

    // Check if card name matches any combination
    return possibleNames.includes(cardName);
};

// Helper function to parse name from AuthBridge NameOnTheCard
function parseNameFromAuthBridge(NameOnTheCard) {
    if (!NameOnTheCard) return { first_name: '', middle_name: '', last_name: '' };

    const nameParts = NameOnTheCard.trim().split(/\s+/).filter(Boolean);

    if (nameParts.length === 0) {
        return { first_name: '', middle_name: '', last_name: '' };
    } else if (nameParts.length === 1) {
        return { first_name: nameParts[0], middle_name: '', last_name: '' };
    } else if (nameParts.length === 2) {
        return { first_name: nameParts[0], middle_name: '', last_name: nameParts[1] };
    } else {
        // For 3+ parts, first is first_name, last is last_name, rest is middle_name
        const first_name = nameParts[0];
        const last_name = nameParts[nameParts.length - 1];
        const middle_name = nameParts.slice(1, -1).join(' ');
        return { first_name, middle_name, last_name };
    }
}

const verifyPanViaAuthBridge = async (doc_number, entity_type, entity_id) => {
    if (!entity_id || !entity_type) {
        return { status: false, code: 400, message: "entity_id and entity_type are required", type: "false_hit" };
    }

    // Get entity data from the database based on entity_type and entity_id
    let queryMap = {
        "dsa": `select dsa.dsa_id, dsa.first_name, dsa.middle_name, dsa.last_name, dsa.full_name, COALESCE(kyc.is_permanent_account_number_verified, 0) as is_permanent_account_number_verified, kyc.permanent_account_number from ru_direct_selling_agents dsa left join ru_dsa_kyc_data kyc on dsa.dsa_id = kyc.dsa_id where dsa.dsa_id = ?`,
        "company": `select c.company_id, c.name, c.short_name, c.business_type, c.registered_by, COALESCE(c.is_pan_verified, 0) as is_pan_verified, c.pan from ru_companies c where c.company_id = ?`,
    };
    let our_data = await _db2.query(queryMap[entity_type], { replacements: [entity_id], type: QueryTypes.SELECT });
    let record = our_data[0] || {};

    if (!record) {
        return { status: false, code: 400, message: `${entity_type} with id ${entity_id} not found`, type: "false_hit" };
    }

    // Verify that the doc_number matches the entity's PAN
    let entity_pan = entity_type === "dsa" ? record.permanent_account_number : record.pan;
    if (entity_pan !== doc_number) {
        return { status: false, code: 400, message: `PAN ${doc_number} does not match ${entity_type} ${entity_id}`, type: "false_hit" };
    }

    // Prepare request body with new format
    const requestBody = {
        "docType": AUTHBRIDGE_DOC_TYPE_PAN,
        "docNumber": doc_number,
        "entity_id": entity_id,
        "entity_type": entity_type
    };

    const options = {
        method: 'POST',
        body: requestBody,
        json: true,
        url: AUTHBRIDGE_API_URL,
        headers: {
            'Content-Type': 'application/json',
            'authorization': AUTHBRIDGE_API_KEY
        },
    };

    let response = await makeRequest(options);
    console.log(response?.body, "authbridgeResponse=====================")
    let { status, code, data, message } = response?.body || {};

    // Handle case where PAN is already verified (data is empty)
    if (status && (!data || Object.keys(data).length === 0)) {
        // PAN is already verified, return success
        return { status: true, code, message: message || "PAN already verified", type: "success_hit" };
    }

    if (status && data) {
        // Get NameOnTheCard from data (can be NameOnTheCard or Name)
        let NameOnTheCard = data.NameOnTheCard || data.Name || "";
        let { first_name, middle_name, last_name, name, short_name, business_type, registered_by, is_pan_verified, is_permanent_account_number_verified } = record;

        // For DSA, use is_permanent_account_number_verified
        if (entity_type === "dsa") {
            is_pan_verified = is_permanent_account_number_verified || 0;
        }

        // Parse name from AuthBridge
        const authBridgeName = parseNameFromAuthBridge(NameOnTheCard);

        // For company, check if it's sole proprietorship
        if (entity_type === "company" && business_type === "sole_prop" && registered_by) {
            // For sole proprietorship, use individual DSA name
            let dsaQuery = `select dsa.first_name, dsa.middle_name, dsa.last_name, COALESCE(kyc.is_permanent_account_number_verified, 0) as is_permanent_account_number_verified from ru_direct_selling_agents dsa left join ru_dsa_kyc_data kyc on dsa.dsa_id = kyc.dsa_id where dsa.dsa_id = ?`;
            let dsaData = await _db2.query(dsaQuery, { replacements: [registered_by], type: QueryTypes.SELECT });
            if (dsaData[0]) {
                first_name = dsaData[0].first_name;
                middle_name = dsaData[0].middle_name;
                last_name = dsaData[0].last_name;
                is_pan_verified = dsaData[0].is_permanent_account_number_verified || 0;
            }
        }

        let isMatched = false;

        // For company (non-sole_prop), compare company name directly
        if (entity_type === "company" && business_type !== "sole_prop") {
            const companyName = (name || "").toLowerCase().trim();
            const cardName = (NameOnTheCard || "").toLowerCase().trim();
            const shortName = (short_name || "").toLowerCase().trim();

            // Check if card name matches company name or short name
            isMatched = cardName === companyName || cardName === shortName ||
                companyName.includes(cardName) || cardName.includes(companyName);
        } else {
            // For DSA or sole_prop company, use name matching function
            isMatched = isNameOnCardMatching(NameOnTheCard, { first_name, middle_name, last_name });
        }

        // If name doesn't match and it's company type, update the name from AuthBridge
        if (!isMatched && entity_type === "company" && record.company_id) {
            // For sole proprietorship, update the individual DSA name instead of company name
            if (business_type === "sole_prop" && registered_by) {
                const full_name = [authBridgeName.first_name, authBridgeName.middle_name, authBridgeName.last_name].filter(Boolean).join(' ');

                // Update DSA name with AuthBridge name in ru_direct_selling_agents
                let updateDsaQuery = `update ru_direct_selling_agents set first_name = ?, middle_name = ?, last_name = ?, full_name = ? where dsa_id = ?`;
                await _db2.query(updateDsaQuery, {
                    replacements: [
                        authBridgeName.first_name || null,
                        authBridgeName.middle_name || null,
                        authBridgeName.last_name || null,
                        full_name,
                        registered_by
                    ],
                    type: QueryTypes.UPDATE
                });

                // Update is_permanent_account_number_verified in ru_dsa_kyc_data for the DSA
                try {
                    let updateKycQuery = `update ru_dsa_kyc_data set is_permanent_account_number_verified = 1 where dsa_id = ?`;
                    await _db2.query(updateKycQuery, { replacements: [registered_by], type: QueryTypes.UPDATE });
                } catch (err) {
                    // If column doesn't exist, silently continue
                    if (err.message && !err.message.includes('is_permanent_account_number_verified')) {
                        throw err;
                    }
                }

                // Also update company is_pan_verified
                try {
                    let updateCompanyVerifiedQuery = `update ru_companies set is_pan_verified = 1 where company_id = ?`;
                    await _db2.query(updateCompanyVerifiedQuery, { replacements: [record.company_id], type: QueryTypes.UPDATE });
                } catch (err) {
                    // If column doesn't exist, silently continue
                    if (err.message && !err.message.includes('is_pan_verified')) {
                        throw err;
                    }
                }

                return {
                    status: true,
                    code,
                    message: "DSA name updated from AuthBridge verification (sole proprietorship)",
                    type: "success_hit",
                    nameUpdated: true,
                    updatedName: authBridgeName
                };
            } else {
                // For other company types, update the company name
                const companyName = NameOnTheCard || "";

                // Update company name with AuthBridge name in ru_companies
                let updateCompanyQuery = `update ru_companies set name = ? where company_id = ?`;
                await _db2.query(updateCompanyQuery, {
                    replacements: [companyName, record.company_id],
                    type: QueryTypes.UPDATE
                });

                // Update is_pan_verified in ru_companies
                try {
                    let updateVerifiedQuery = `update ru_companies set is_pan_verified = 1 where company_id = ?`;
                    await _db2.query(updateVerifiedQuery, { replacements: [record.company_id], type: QueryTypes.UPDATE });
                } catch (err) {
                    // If column doesn't exist, silently continue
                    if (err.message && !err.message.includes('is_pan_verified')) {
                        throw err;
                    }
                }

                return {
                    status: true,
                    code,
                    message: "Company name updated from AuthBridge verification",
                    type: "success_hit",
                    nameUpdated: true,
                    updatedName: { name: companyName }
                };
            }
        }

        // If name doesn't match and it's DSA type, update the name from AuthBridge
        if (!isMatched && entity_type === "dsa" && record.dsa_id) {
            const full_name = [authBridgeName.first_name, authBridgeName.middle_name, authBridgeName.last_name].filter(Boolean).join(' ');

            // Update DSA name with AuthBridge name in ru_direct_selling_agents
            let updateDsaQuery = `update ru_direct_selling_agents set first_name = ?, middle_name = ?, last_name = ?, full_name = ? where dsa_id = ?`;
            await _db2.query(updateDsaQuery, {
                replacements: [
                    authBridgeName.first_name || null,
                    authBridgeName.middle_name || null,
                    authBridgeName.last_name || null,
                    full_name,
                    record.dsa_id
                ],
                type: QueryTypes.UPDATE
            });

            // Update is_permanent_account_number_verified in ru_dsa_kyc_data
            try {
                let updateKycQuery = `update ru_dsa_kyc_data set is_permanent_account_number_verified = 1 where dsa_id = ?`;
                await _db2.query(updateKycQuery, { replacements: [record.dsa_id], type: QueryTypes.UPDATE });
            } catch (err) {
                // If column doesn't exist, silently continue
                if (err.message && !err.message.includes('is_permanent_account_number_verified')) {
                    throw err;
                }
            }

            return {
                status: true,
                code,
                message: "Name updated from AuthBridge verification",
                type: "success_hit",
                nameUpdated: true,
                updatedName: authBridgeName
            };
        }

        // If name matches, mark as verified
        if (isMatched) {
            if (entity_type === "dsa" && record.dsa_id && !is_pan_verified) {
                // Update is_permanent_account_number_verified in ru_dsa_kyc_data for DSA
                try {
                    let updateKycQuery = `update ru_dsa_kyc_data set is_permanent_account_number_verified = 1 where dsa_id = ?`;
                    await _db2.query(updateKycQuery, { replacements: [record.dsa_id], type: QueryTypes.UPDATE });
                } catch (err) {
                    // If column doesn't exist, silently continue
                    if (err.message && !err.message.includes('is_permanent_account_number_verified')) {
                        throw err;
                    }
                }
            } else if (entity_type === "company" && record.company_id && !is_pan_verified) {
                // Update is_pan_verified in ru_companies for company
                try {
                    let updateCompanyQuery = `update ru_companies set is_pan_verified = 1 where company_id = ?`;
                    await _db2.query(updateCompanyQuery, { replacements: [record.company_id], type: QueryTypes.UPDATE });
                } catch (err) {
                    // If column doesn't exist, silently continue
                    if (err.message && !err.message.includes('is_pan_verified')) {
                        throw err;
                    }
                }

                // For sole proprietorship, also mark the DSA as verified
                if (business_type === "sole_prop" && registered_by) {
                    try {
                        let updateKycQuery = `update ru_dsa_kyc_data set is_permanent_account_number_verified = 1 where dsa_id = ?`;
                        await _db2.query(updateKycQuery, { replacements: [registered_by], type: QueryTypes.UPDATE });
                    } catch (err) {
                        // If column doesn't exist, silently continue
                        if (err.message && !err.message.includes('is_permanent_account_number_verified')) {
                            throw err;
                        }
                    }
                }
            }
        }

        if (isMatched) {
            return { status: true, code, message: "Success", type: "success_hit" };
        } else {
            return { status: false, code, message: "Name on the card does'nt match with provided details", type: "success_hit" };
        };
    } else {
        // If status is not 1 or request failed
        return { status: false, code: code || 400, message: message || data?.message || "PAN verification failed", type: "false_hit" };
    };
};

/** IT PAN AAAAP9999A: holder-type letter is 4th character (0-based index 3). P = individual; others skip AuthBridge for this flow. */
const _AUTHBRIDGE_NON_PERSON_PAN_LABELS = { C: 'Company', F: 'Firm', H: 'HUF', A: 'AOP', T: 'Trust', B: 'BOI', L: 'Local authority', J: 'Artificial Juridical Person', G: 'Government' };

function getAuthBridgeSkipPayloadIfNonPersonPan(doc_number) {
    if (!doc_number || doc_number.length < 4) return null;
    const panTypeChar = doc_number.charAt(3).toUpperCase();
    if (!panTypeChar || panTypeChar === 'P') return null;
    const panTypeLabel = _AUTHBRIDGE_NON_PERSON_PAN_LABELS[panTypeChar] || panTypeChar;
    return {
        status: 1,
        skipped: true,
        message: `Skipped AuthBridge - PAN is not Person type`,
        panType: panTypeChar,
        panTypeLabel,
        type: 'skipped'
    };
}

// V2: Verify PAN via AuthBridge using fresh_lead_id
const verifyPanViaAuthBridgeV2 = async (fresh_lead_id, force_retry = false) => {
    if (!fresh_lead_id) {
        return { status: false, code: 400, message: "fresh_lead_id is required", type: "false_hit" };
    }

    // Get lead claim data with company and DSA details
    let query = `
        SELECT 
            flc.fresh_lead_id,
            flc.dsa_mobile_number,
            flc.user_type,
            flc.dsa_id,
            rc.company_id,
            rc.pan as company_pan,
            rc.business_type,
            rc.registered_by,
            kyc.permanent_account_number as dsa_pan,
            dsa.dsa_id as dsa_entity_id,
            dsa.first_name as dsa_first_name,
            dsa.middle_name as dsa_middle_name,
            dsa.last_name as dsa_last_name,
            dsa.full_name as dsa_full_name
        FROM ru_fresh_lead_claims flc
        LEFT JOIN ru_companies rc ON flc.user_type = 'company' AND rc.company_id = flc.dsa_id
        LEFT JOIN ru_direct_selling_agents dsa ON flc.dsa_mobile_number = dsa.dsa_mobile_number
        LEFT JOIN ru_dsa_kyc_data kyc ON dsa.dsa_mobile_number = kyc.dsa_mobile_number
        WHERE flc.fresh_lead_id = ?
    `;

    let leadData = await _db2.query(query, { replacements: [fresh_lead_id], type: QueryTypes.SELECT });
    let record = leadData[0] || {};

    if (!record || !record.fresh_lead_id) {
        return { status: false, code: 400, message: `Lead with fresh_lead_id ${fresh_lead_id} not found`, type: "false_hit" };
    }

    // Determine entity type and get PAN
    let entity_type = record.user_type === 'company' ? 'company' : 'dsa';
    let entity_id = null;
    let doc_number = null;

    if (entity_type === 'company') {
        // Check if sole_prop - if yes, use DSA details instead of company
        if (record.business_type === 'sole_prop' && record.registered_by) {
            let dsaQuery = `
                SELECT 
                    dsa.dsa_id,
                    dsa.first_name,
                    dsa.middle_name,
                    dsa.last_name,
                    dsa.full_name,
                    dsa.dsa_mobile_number,
                    kyc.permanent_account_number
                FROM ru_direct_selling_agents dsa
                LEFT JOIN ru_dsa_kyc_data kyc ON dsa.dsa_id = kyc.dsa_id
                WHERE dsa.dsa_id = ?
            `;
            let dsaData = await _db2.query(dsaQuery, { replacements: [record.registered_by], type: QueryTypes.SELECT });

            if (dsaData[0] && dsaData[0].permanent_account_number) {
                // For sole_prop, use DSA details (same as DSA type)
                entity_type = 'dsa';
                entity_id = dsaData[0].dsa_id;
                doc_number = dsaData[0].permanent_account_number;
            } else {
                return { status: false, code: 400, message: "DSA details not found for sole proprietorship", type: "false_hit" };
            }
        } else {
            // Regular company (not sole_prop)
            entity_id = record.company_id || record.dsa_id;
            doc_number = record.company_pan;

            if (!doc_number) {
                return { status: false, code: 400, message: "Company PAN not found", type: "false_hit" };
            }
        }
    } else {
        // DSA type
        entity_id = record.dsa_entity_id;
        doc_number = record.dsa_pan;

        if (!doc_number) {
            return { status: false, code: 400, message: "DSA PAN not found", type: "false_hit" };
        }
    }

    if (!entity_id || !doc_number) {
        return { status: false, code: 400, message: "Entity ID or PAN not found", type: "false_hit" };
    }

    const skipNonPerson = getAuthBridgeSkipPayloadIfNonPersonPan(doc_number);
    if (skipNonPerson) return skipNonPerson;

    // Prepare request body for external API (same structure for all types)
    const requestBody = {
        "docType": AUTHBRIDGE_DOC_TYPE_PAN,
        "docNumber": doc_number,
        "entity_id": entity_id,
        "entity_type": entity_type,
        force_retry
    };

    const options = {
        method: 'POST',
        body: requestBody,
        json: true,
        url: AUTHBRIDGE_API_URL,
        headers: {
            'Content-Type': 'application/json',
            'authorization': AUTHBRIDGE_API_KEY
        },
    };

    try {
        let response = await makeRequest(options);
        console.log(response?.body, "authbridgeResponse V2=====================");

        // Return the response as-is (no name updates, just return the API response)
        return response?.body || {
            status: false,
            code: 500,
            message: "No response from AuthBridge API",
            type: "false_hit"
        };
    } catch (error) {
        console.error("AuthBridge API Error:", error);
        return {
            status: false,
            code: 500,
            message: error.message || "Error calling AuthBridge API",
            type: "false_hit",
            error: error.message
        };
    }
};

/** After AuthBridge success for a DSA: sync name from NameOnTheCard if mismatched, mark PAN verified, approve fuzzy banks. */
const applyAuthBridgeDsaNameAndVerify = async (dsa_id, authBridgeData = {}) => {
    if (!dsa_id) return { nameUpdated: false, updatedName: null };

    const NameOnTheCard = authBridgeData?.NameOnTheCard || authBridgeData?.Name || "";
    const rows = await _db2.query(
        `SELECT dsa.dsa_id, dsa.first_name, dsa.middle_name, dsa.last_name, dsa.full_name,
                COALESCE(kyc.is_permanent_account_number_verified, 0) AS is_permanent_account_number_verified
         FROM ru_direct_selling_agents dsa
         LEFT JOIN ru_dsa_kyc_data kyc ON dsa.dsa_id = kyc.dsa_id
         WHERE dsa.dsa_id = ?
         LIMIT 1`,
        { replacements: [dsa_id], type: QueryTypes.SELECT }
    );
    const record = rows[0];
    if (!record) return { nameUpdated: false, updatedName: null };

    let nameUpdated = false;
    let updatedName = null;

    if (NameOnTheCard) {
        const isMatched = isNameOnCardMatching(NameOnTheCard, {
            first_name: record.first_name,
            middle_name: record.middle_name,
            last_name: record.last_name
        });

        if (!isMatched) {
            const authBridgeName = parseNameFromAuthBridge(NameOnTheCard);
            const full_name = [authBridgeName.first_name, authBridgeName.middle_name, authBridgeName.last_name]
                .filter(Boolean)
                .join(' ');

            await _db2.query(
                `UPDATE ru_direct_selling_agents
                 SET first_name = ?, middle_name = ?, last_name = ?, full_name = ?
                 WHERE dsa_id = ?`,
                {
                    replacements: [
                        authBridgeName.first_name || null,
                        authBridgeName.middle_name || null,
                        authBridgeName.last_name || null,
                        full_name,
                        dsa_id
                    ],
                    type: QueryTypes.UPDATE
                }
            );
            nameUpdated = true;
            updatedName = authBridgeName;
        }
    }

    try {
        await _db2.query(
            `UPDATE ru_dsa_kyc_data SET is_permanent_account_number_verified = 1 WHERE dsa_id = ?`,
            { replacements: [dsa_id], type: QueryTypes.UPDATE }
        );
    } catch (err) {
        if (err.message && !err.message.includes('is_permanent_account_number_verified')) {
            throw err;
        }
    }

    try {
        await approveFuzzyMatchedBankAccounts(dsa_id);
    } catch (bankErr) {
        logger.error(
            'Failed to auto-approve fuzzy matched bank accounts for dsa_id %s: %s',
            dsa_id,
            bankErr?.message || bankErr
        );
    }

    return { nameUpdated, updatedName };
};

// Manual single-user helper: verify PAN via AuthBridge by dsa_id.
const verifyPanViaAuthBridgeByDsaIdV2 = async (dsa_id, force_retry = false) => {
    if (!dsa_id) {
        return { status: false, code: 400, message: "dsa_id is required", type: "false_hit" };
    }

    const kycRows = await _db2.query(
        `
        SELECT dsa_id, dsa_mobile_number, permanent_account_number
        FROM ru_dsa_kyc_data
        WHERE dsa_id = ?
        LIMIT 1
        `,
        { replacements: [dsa_id], type: QueryTypes.SELECT }
    );
    const kyc = kycRows[0];
    if (!kyc) {
        return { status: false, code: 404, message: "DSA KYC not found", type: "false_hit" };
    }

    const doc_number = String(kyc.permanent_account_number || '').trim().toUpperCase();
    if (!doc_number) {
        return { status: false, code: 400, message: "DSA PAN not found", type: "false_hit" };
    }

    // If this DSA profile is company-linked, skip this flow.
    const dsaRows = await _db2.query(
        `
        SELECT dsa_id, company_id, user_type, business_mode
        FROM ru_direct_selling_agents
        WHERE dsa_id = ?
        LIMIT 1
        `,
        { replacements: [dsa_id], type: QueryTypes.SELECT }
    );
    const dsaProfile = dsaRows[0] || {};
    if (dsaProfile?.company_id || dsaProfile?.user_type === 'company' || dsaProfile?.business_mode === 'company') {
        return {
            status: 1,
            skipped: true,
            code: 200,
            message: "Company PAN",
            type: "skipped",
            remark: "Company PAN"
        };
    }

    const nonPersonPan = getAuthBridgeSkipPayloadIfNonPersonPan(doc_number);
    if (nonPersonPan) {
        return {
            status: 1,
            skipped: true,
            code: 200,
            message: "Company PAN",
            type: "skipped",
            remark: "Company PAN",
            panType: nonPersonPan?.panType,
            panTypeLabel: nonPersonPan?.panTypeLabel
        };
    }

    const options = {
        method: 'POST',
        body: {
            docType: AUTHBRIDGE_DOC_TYPE_PAN,
            docNumber: doc_number,
            entity_id: dsa_id,
            entity_type: 'dsa',
            force_retry
        },
        json: true,
        url: AUTHBRIDGE_API_URL,
        headers: {
            'Content-Type': 'application/json',
            'authorization': AUTHBRIDGE_API_KEY
        },
    };

    try {
        const response = await makeRequest(options);
        const apiBody = response?.body || {
            status: false,
            code: 500,
            message: "No response from AuthBridge API",
            type: "false_hit"
        };

        if (apiBody && (apiBody.status === 1 || apiBody.status === true)) {
            const nameResult = await applyAuthBridgeDsaNameAndVerify(dsa_id, apiBody.data || {});
            return {
                ...apiBody,
                nameUpdated: nameResult.nameUpdated,
                updatedName: nameResult.updatedName,
                message: nameResult.nameUpdated
                    ? (apiBody.message || "Name updated from AuthBridge verification")
                    : (apiBody.message || "PAN verification completed")
            };
        }

        return apiBody;
    } catch (error) {
        return {
            status: false,
            code: 500,
            message: error.message || "Error calling AuthBridge API",
            type: "false_hit",
            error: error.message
        };
    }
};

// Helper to auto-approve fuzzy-matched bank accounts for a DSA/Company upon successful AuthBridge verification
const approveFuzzyMatchedBankAccounts = async (dsa_id, company_id = null) => {
    if (!dsa_id && !company_id) return;
    try {
        let whereClauses = [];
        let replacements = [];
        if (dsa_id) {
            whereClauses.push("dsa_id = ?");
            replacements.push(dsa_id);
        }
        if (company_id) {
            whereClauses.push("company_id = ?");
            replacements.push(company_id);
        }

        const query = `
            SELECT id, dsa_id, company_id, status, digio_pennydrop_fuzzy_match_result
            FROM ru_dsa_bank_accounts
            WHERE ${whereClauses.join(" OR ")}
        `;

        const bankAccounts = await _db2.query(query, {
            replacements,
            type: QueryTypes.SELECT
        });

        for (const ba of (bankAccounts || [])) {
            const val = ba.digio_pennydrop_fuzzy_match_result;
            const isFuzzyMatch =
                val === 1 ||
                val === true ||
                String(val || '').trim() === '1' ||
                String(val || '').trim().toLowerCase() === 'true';

            if (isFuzzyMatch && String(ba.status || '').toLowerCase() !== 'approved') {
                try {
                    const requestUrl = `${process.env.MS_URL}/api/v3/dsa/bank-account/update-status`;
                    const msOptions = {
                        method: 'POST',
                        url: requestUrl,
                        data: { id: ba.id, status: 'approved' },
                        headers: {
                            'api-key': process.env.AUTH_KEY_RULOANS_BANK_CLAIM,
                            'app-version-code': 32,
                            'device-type': 4,
                            'Content-Type': 'application/json',
                            'platform': 'crm',
                        },
                        validateStatus: () => true,
                    };

                    await axios(msOptions);
                } catch (msErr) {
                    logger.error('MS update-status call failed for bank account id %s: %s', ba.id, msErr?.message || msErr);
                }

                await _db2.query(
                    `UPDATE ru_dsa_bank_accounts SET status = 'approved', updated_at = NOW() WHERE id = ?`,
                    { replacements: [ba.id], type: QueryTypes.UPDATE }
                );
                logger.info('Auto-approved fuzzy matched bank account id %s for dsa_id %s', ba.id, ba.dsa_id);
            }
        }
    } catch (err) {
        logger.error('Error auto-approving fuzzy matched bank accounts: %s', err?.message || err);
    }
};

// Bulk helper: verify AuthBridge by PAN (DSA/KYC scoped), keeping V2 API call contract intact.
const verifyPanViaAuthBridgeByPanV2 = async (pan, force_retry = false) => {
    const normalizedPan = String(pan || '').trim().toUpperCase();
    if (!normalizedPan) {
        return { status: false, code: 400, message: "PAN is required", type: "false_hit" };
    }

    // 1) PAN must exist in DSA KYC.
    const kycRowsByPan = await _db2.query(
        `
        SELECT dsa_id, dsa_mobile_number, permanent_account_number
        FROM ru_dsa_kyc_data
        WHERE UPPER(TRIM(permanent_account_number)) = ?
        LIMIT 1
        `,
        { replacements: [normalizedPan], type: QueryTypes.SELECT }
    );
    const kycByPan = kycRowsByPan[0];
    if (!kycByPan) {
        return {
            status: 1,
            skipped: true,
            code: 200,
            message: "Not found in system",
            type: "skipped",
            remark: "Not found in system"
        };
    }

    // 2) Company PAN check (mirror V2 intent: non-person/company PAN should not be verified here).
    const nonPersonPanByPan = getAuthBridgeSkipPayloadIfNonPersonPan(normalizedPan);
    if (nonPersonPanByPan) {
        return {
            status: 1,
            skipped: true,
            code: 200,
            message: "Company PAN",
            type: "skipped",
            remark: "Company PAN",
            panType: nonPersonPanByPan?.panType,
            panTypeLabel: nonPersonPanByPan?.panTypeLabel
        };
    }

    const requestBody = {
        docType: AUTHBRIDGE_DOC_TYPE_PAN,
        docNumber: normalizedPan,
        entity_id: kycByPan.dsa_id,
        entity_type: 'dsa',
        force_retry
    };

    const optionsByPan = {
        method: 'POST',
        body: requestBody,
        json: true,
        url: AUTHBRIDGE_API_URL,
        headers: {
            'Content-Type': 'application/json',
            'authorization': AUTHBRIDGE_API_KEY
        },
    };

    try {
        const response = await makeRequest(optionsByPan);
        const apiBody = response?.body || {
            status: false,
            code: 500,
            message: "No response from AuthBridge API",
            type: "false_hit"
        };

        // Keep bulk flow aligned with lead verification persistence:
        // on successful verification, sync name if needed + mark PAN verified.
        if (apiBody && (apiBody.status === 1 || apiBody.status === true)) {
            const nameResult = await applyAuthBridgeDsaNameAndVerify(kycByPan.dsa_id, apiBody.data || {});
            return {
                ...apiBody,
                nameUpdated: nameResult.nameUpdated,
                updatedName: nameResult.updatedName,
                message: nameResult.nameUpdated
                    ? (apiBody.message || "Name updated from AuthBridge verification")
                    : (apiBody.message || "PAN verification completed")
            };
        }

        return apiBody;
    } catch (error) {
        return {
            status: false,
            code: 500,
            message: error.message || "Error calling AuthBridge API",
            type: "false_hit",
            error: error.message
        };
    }
};

const changeCompanyOwner = async (company_id, new_dsa_id) => {
    try {
        // Get current company details and previous owner
        const companyQuery = `
            SELECT c.*, dsa.full_name as previous_owner_name, dsa.dsa_id as previous_dsa_id
            FROM ru_companies c
            LEFT JOIN ru_direct_selling_agents dsa ON c.registered_by = dsa.dsa_id
            WHERE c.company_id = ?
        `;

        const companyResult = await _db2.query(companyQuery, {
            replacements: [company_id],
            type: QueryTypes.SELECT
        });

        if (companyResult.length === 0) {
            return {
                success: false,
                message: 'Company not found',
                statusCode: 404
            };
        }

        const company = companyResult[0];
        const previous_dsa_id = company.registered_by;

        // Check if new owner exists
        const newOwnerQuery = `
            SELECT dsa_id, full_name, email_address
            FROM ru_direct_selling_agents
            WHERE dsa_id = ? AND is_deleted = 0
        `;

        const newOwnerResult = await _db2.query(newOwnerQuery, {
            replacements: [new_dsa_id],
            type: QueryTypes.SELECT
        });

        if (newOwnerResult.length === 0) {
            return {
                success: false,
                message: 'New owner not found',
                statusCode: 404
            };
        }

        const newOwner = newOwnerResult[0];

        const transaction = await _db2.transaction();

        try {
            // Update company owner
            const updateCompanyQuery = `
                UPDATE ru_companies 
                SET registered_by = ?, 
                    updated_at = NOW()
                WHERE company_id = ?
            `;

            await _db2.query(updateCompanyQuery, {
                replacements: [new_dsa_id, company_id],
                type: QueryTypes.UPDATE,
                transaction
            });

            // Get company onboarding steps
            const companyStepsQuery = `
                SELECT step
                FROM ru_onboarding_steps
                WHERE dsa_type = 'company'
            `;

            const companyStepsResult = await _db2.query(companyStepsQuery, {
                type: QueryTypes.SELECT,
                transaction
            });

            // Update company onboarding steps status to 0 for previous owner
            if (companyStepsResult.length > 0) {
                const companySteps = companyStepsResult.map(step => step.step);

                // Get previous DSA's step statuses BEFORE updating them to 0
                const getPreviousStepsQuery = `
                    SELECT step, status 
                    FROM ru_user_onboarding_steps 
                    WHERE dsa_id = ? AND step IN (?)
                `;

                const previousStepsResult = await _db2.query(getPreviousStepsQuery, {
                    replacements: [previous_dsa_id, companySteps],
                    type: QueryTypes.SELECT,
                    transaction
                });

                // Create a map of step to status from previous DSA
                const previousStepStatusMap = {};
                previousStepsResult.forEach(step => {
                    previousStepStatusMap[step.step] = step.status;
                });

                // Delete previous DSA's company steps
                const deletePreviousOwnerStepsQuery = `
                    DELETE FROM ru_user_onboarding_steps
                    WHERE dsa_id = ? AND step IN (?)
                `;

                await _db2.query(deletePreviousOwnerStepsQuery, {
                    replacements: [previous_dsa_id, companySteps],
                    type: QueryTypes.DELETE,
                    transaction
                });

                // Add company onboarding steps to new owner (DELETE + INSERT to avoid duplicates)
                // First delete existing steps for new_dsa_id to avoid duplicates
                const deleteNewOwnerStepsQuery = `
                    DELETE FROM ru_user_onboarding_steps 
                    WHERE dsa_id = ? AND step IN (?)
                `;

                await _db2.query(deleteNewOwnerStepsQuery, {
                    replacements: [new_dsa_id, companySteps],
                    type: QueryTypes.DELETE,
                    transaction
                });

                // Then insert the steps with previous DSA's status (company_agreement always 0)
                const insertStepsQuery = `
                    INSERT INTO ru_user_onboarding_steps (dsa_id, step, status, created_at, updated_at)
                    VALUES ?
                `;

                const stepsValues = companySteps.map(step => [
                    new_dsa_id,
                    step,
                    step === 'company_agreement' ? 0 : (previousStepStatusMap[step] || 0), // Use previous status or default 0
                    new Date(),
                    new Date()
                ]);

                await _db2.query(insertStepsQuery, {
                    replacements: [stepsValues],
                    type: QueryTypes.INSERT,
                    transaction
                });
            }

            await transaction.commit();

            return {
                success: true,
                message: 'Company owner changed successfully',
                data: {
                    company_id: company_id,
                    previous_owner: {
                        dsa_id: previous_dsa_id,
                        name: company.previous_owner_name
                    },
                    new_owner: {
                        dsa_id: new_dsa_id,
                        name: newOwner.full_name,
                        email: newOwner.email_address
                    },
                    company_onboarding_steps_transferred: companyStepsResult.length > 0 ? companyStepsResult.map(step => step.step) : []
                }
            };

        } catch (error) {
            await transaction.rollback();
            throw error;
        }

    } catch (error) {
        console.error('Change Company Owner Error:', error);
        return {
            success: false,
            message: error.message || 'Error occurred during company owner change',
            statusCode: 500
        };
    };
};

const updateDsaMobileNumber = async (dsa_id, new_mobile_number, old_mobile_number, user_id) => {
    try {
        // Start transaction - ALL operations must use this transaction for atomicity
        const transaction = await _db2.transaction();

        try {
            // 1. Update main DSA table - combine multiple updates efficiently
            // Check if materialized_path_phone and hierarchy_crm columns exist
            const schemaCheckQuery = `
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'ru_direct_selling_agents' 
                AND COLUMN_NAME IN ('materialized_path_phone', 'hierarchy_crm')
            `;
            const existingColumns = await _db2.query(schemaCheckQuery, { type: QueryTypes.SELECT, transaction });
            const columnNames = existingColumns.map(col => col.COLUMN_NAME);

            // Build combined UPDATE statement
            let updates = [];
            let replacements = [];

            // Update dsa_mobile_number for the specific DSA
            updates.push(`dsa_mobile_number = CASE WHEN dsa_id = ? THEN ? ELSE dsa_mobile_number END`);
            replacements.push(dsa_id, new_mobile_number);

            // Update partner_code references
            updates.push(`partner_code = CASE WHEN partner_code = ? THEN ? ELSE partner_code END`);
            replacements.push(old_mobile_number, new_mobile_number);

            // Update previous_partner_code references
            updates.push(`previous_partner_code = CASE WHEN previous_partner_code = ? THEN ? ELSE previous_partner_code END`);
            replacements.push(old_mobile_number, new_mobile_number);

            // Update business_head_code references
            updates.push(`business_head_code = CASE WHEN business_head_code = ? THEN ? ELSE business_head_code END`);
            replacements.push(old_mobile_number, new_mobile_number);

            // Update channel_manager_code references
            updates.push(`channel_manager_code = CASE WHEN channel_manager_code = ? THEN ? ELSE channel_manager_code END`);
            replacements.push(old_mobile_number, new_mobile_number);

            // Add conditional column updates
            if (columnNames.includes('materialized_path_phone')) {
                updates.push(`materialized_path_phone = REPLACE(materialized_path_phone, ?, ?)`);
                replacements.push(old_mobile_number, new_mobile_number);
            }
            if (columnNames.includes('hierarchy_crm')) {
                updates.push(`hierarchy_crm = REPLACE(hierarchy_crm, ?, ?)`);
                replacements.push(old_mobile_number, new_mobile_number);
            }

            // Build WHERE clause to target all rows that need updating
            let whereConditions = ['dsa_id = ?', 'partner_code = ?', 'previous_partner_code = ?', 'business_head_code = ?', 'channel_manager_code = ?'];
            let whereReplacements = [dsa_id, old_mobile_number, old_mobile_number, old_mobile_number, old_mobile_number];

            if (columnNames.includes('materialized_path_phone')) {
                whereConditions.push('materialized_path_phone LIKE ?');
                whereReplacements.push(`%${old_mobile_number}%`);
            }
            if (columnNames.includes('hierarchy_crm')) {
                whereConditions.push('hierarchy_crm LIKE ?');
                whereReplacements.push(`%${old_mobile_number}%`);
            }

            let query = `UPDATE ru_direct_selling_agents SET ${updates.join(', ')} WHERE ${whereConditions.join(' OR ')}`;
            replacements.push(...whereReplacements);

            const mainTableResult = await _db2.query(query, {
                replacements,
                type: QueryTypes.UPDATE,
                transaction
            });

            // 2. Update KYC table
            query = `UPDATE ru_dsa_kyc_data SET dsa_mobile_number = ? WHERE dsa_id = ?`;
            const kycResult = await _db2.query(query, {
                replacements: [new_mobile_number, dsa_id],
                type: QueryTypes.UPDATE,
                transaction
            });

            // 3. Update is_consent_given to 1 in ru_direct_selling_agents after successful mobile update
            query = `UPDATE ru_direct_selling_agents SET is_consent_given = 1 WHERE dsa_id = ?`;
            const consentResult = await _db2.query(query, {
                replacements: [dsa_id],
                type: QueryTypes.UPDATE,
                transaction
            });

            // 4. Update ru_user_onboarding_steps - set status = 1 for dsa_consent step
            let onboardingStepQuery = `SELECT * FROM ru_user_onboarding_steps WHERE dsa_id = ? AND step = ?`;
            const existingStep = await _db2.query(onboardingStepQuery, {
                replacements: [dsa_id, 'dsa_consent'],
                type: QueryTypes.SELECT,
                transaction
            });

            if (existingStep && existingStep.length > 0) {
                // Update existing record
                onboardingStepQuery = `UPDATE ru_user_onboarding_steps SET status = ?, status_changed_at = ? WHERE dsa_id = ? AND step = ?`;
                const onboardingResult = await _db2.query(onboardingStepQuery, {
                    replacements: [1, new Date(), dsa_id, 'dsa_consent'],
                    type: QueryTypes.UPDATE,
                    transaction
                });
            } else {
                // Insert new record
                onboardingStepQuery = `INSERT INTO ru_user_onboarding_steps (dsa_id, step, status, status_changed_at) VALUES (?, ?, ?, ?)`;
                const onboardingResult = await _db2.query(onboardingStepQuery, {
                    replacements: [dsa_id, 'dsa_consent', 1, new Date()],
                    type: QueryTypes.INSERT,
                    transaction
                });
            }

            const applicationTables = [
                'ru_credit_card_applications',
                'ru_direct_claims',
                'ru_dsa_bank_files',
                'ru_dsa_claims',
                'ru_dsa_queries',
                'ru_fresh_lead_claims',
                'ru_home_loan_applications',
                'ru_indifi_loan_applications',
                'ru_loan_applications',
                'ru_lt_personal_loan_applications',
                'ru_references',
                'ru_axis_cc_applications',
                'ru_loan_application_documents',
                'ru_pf_personal_loan_applications',
                'ru_pay_u_personal_loan_applications',
                'ru_bajaj_finance_personal_loan_applications',
                'ru_credit_vidya_personal_loan_applications',
                'ru_piramal_lap_applications',
                'ru_piramal_home_loan_applications',
                'ru_bl_applications',
                'ru_car_loan_applications',
                'ru_car_refinance_applications',
                'ru_cc_applications',
                'ru_education_loan_applications',
                'ru_gold_loan_applications',
                'ru_hl_applications',
                'ru_personal_loan_applications',
                'ru_bbps_payments',
                'ru_credit_saison_personal_loan_applications',
                'ru_fibe_personal_loan_applications',
                'ru_incred_personal_loan_applications',
                'ru_l_a_p_applications',
                'ru_business_loan_applications',
                'ru_faircent_personal_loan_applications',
                'ru_credit_scores',
                'ru_dsa_bank_accounts',
                'ru_dsa_remarks',
                'ru_customers',
                'ru_netsuite_vendor_slab_master',
                'ru_dsa_additional_information',
                'ru_dsa_addresses',
                'ru_dsa_expenses',
                'ru_dsa_leads',
                'ru_dsa_metas',
                'ru_dsa_verification_documents',
                'ru_invoice'
            ];

            const additionalTables = [
                'ru_user_onboarding_steps',
                'ru_onboarding_steps',
                'ru_companies',
                'ru_referrals',
                'ru_password_resets'
            ];

            // Combine all tables and check columns in one query
            const allTables = [...applicationTables, ...additionalTables];
            const tableList = allTables.map(t => `'${t}'`).join(',');
            const mobileColumns = ['dsa_mobile_number', 'mobile_number', 'phone_number', 'contact_number', 'phone', 'mobile'];
            const columnList = mobileColumns.map(c => `'${c}'`).join(',');

            // Get all valid table-column combinations in one query
            const columnCheckQuery = `
                SELECT TABLE_NAME, COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME IN (${tableList})
                AND COLUMN_NAME IN (${columnList})
            `;
            const validColumns = await _db2.query(columnCheckQuery, { type: QueryTypes.SELECT, transaction });

            // Group by table to execute updates efficiently
            const tableColumnMap = {};
            validColumns.forEach(row => {
                if (!tableColumnMap[row.TABLE_NAME]) {
                    tableColumnMap[row.TABLE_NAME] = [];
                }
                tableColumnMap[row.TABLE_NAME].push(row.COLUMN_NAME);
            });

            const updatedTables = [];
            const skippedTables = [];

            // Sort tables by priority: application tables first (usually smaller), then additional tables
            const sortedTables = Object.entries(tableColumnMap).sort(([tableA], [tableB]) => {
                const aIsApp = applicationTables.includes(tableA);
                const bIsApp = applicationTables.includes(tableB);
                if (aIsApp && !bIsApp) return -1;
                if (!aIsApp && bIsApp) return 1;
                return 0;
            });

            for (const [table, columns] of sortedTables) {
                try {
                    const primaryColumn = columns.includes('dsa_mobile_number') ? 'dsa_mobile_number' : columns[0];

                    if (primaryColumn === 'dsa_mobile_number' && applicationTables.includes(table)) {
                        // Update only dsa_mobile_number for application tables
                        query = `UPDATE ${table} SET dsa_mobile_number = ? WHERE dsa_mobile_number = ?`;
                        const result = await _db2.query(query, {
                            replacements: [new_mobile_number, old_mobile_number],
                            type: QueryTypes.UPDATE,
                            transaction
                        });
                        updatedTables.push(`${table}.${primaryColumn}`);
                    } else {

                        for (const column of columns) {
                            query = `UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`;
                            const result = await _db2.query(query, {
                                replacements: [new_mobile_number, old_mobile_number],
                                type: QueryTypes.UPDATE,
                                transaction
                            });
                            updatedTables.push(`${table}.${column}`);
                        }
                    }
                } catch (tableError) {

                    // Transaction will ensure atomicity - if any critical update fails, we'll rollback
                    skippedTables.push(`${table}: ${tableError.message}`);
                    // Only throw if it's a critical error (not just a missing column/table)
                    if (tableError.code !== 'ER_BAD_FIELD_ERROR' && tableError.code !== 'ER_NO_SUCH_TABLE') {
                        throw tableError;
                    }
                }
            }

            await transaction.commit();
            await triggerNsVendorUpdateForDsa({ dsa_id, phone: new_mobile_number });

            return {
                success: true,
                message: 'DSA mobile number updated successfully',
                old_mobile_number,
                new_mobile_number,
                dsa_id
            };

        } catch (error) {
            await transaction.rollback();
            throw error;
        }

    } catch (error) {
        throw error;
    }
};

/**
 * Get Vendor Metrics for Dashboard
 * Calculates various metrics for vendors under user's hierarchy.
 * Heavy part: onboarding metrics (ru_user_onboarding_steps join). Light part: base metrics (total, junk, payout, capping, bank, ns).
 * Use lightOnly to return fast base metrics first; then call with onboardingOnly to load onboarding and show in cards when ready.
 * @param {string} dsaId - DSA ID for hierarchy filtering
 * @param {string} materializedPath - Materialized path for hierarchy filtering
 * @param {boolean} skipHierarchy - If true, skip hierarchy filtering (for CEO)
 * @param {string} cardKey - Optional card key to refresh specific metric
 * @param {boolean} refresh - If true, refresh the specific metric identified by cardKey
 * @param {object} options - { lightOnly: true } return only base metrics (fast); { onboardingOnly: true } return only onboarding metrics (heavy)
 */
const getVendorMetrics = async (dsaId, materializedPath, skipHierarchy = false, cardKey = null, refresh = false, options = {}) => {
    try {
        let hierarchyCondition = '';
        let bindParams = [];

        // Build hierarchy condition
        // Create both WHERE and AND versions for different query contexts
        // Also create versions for different table aliases (c, c2, c3)
        let hierarchyConditionWhere = '';
        let hierarchyConditionAnd = '';
        let hierarchyConditionAndC2 = '';
        let hierarchyConditionAndC3 = '';

        if (!skipHierarchy) {
            const conditions = [];
            const conditionsC2 = [];
            const conditionsC3 = [];

            if (materializedPath) {
                const sanitizedPath = materializedPath.replace(/'/g, "\\'");
                conditions.push(`c.materialized_path LIKE '${sanitizedPath}%'`);
                conditionsC2.push(`c2.materialized_path LIKE '${sanitizedPath}%'`);
                conditionsC3.push(`c3.materialized_path LIKE '${sanitizedPath}%'`);
            }

            if (dsaId) {
                const sanitizedDsaId = dsaId.replace(/'/g, "\\'");
                conditions.push(`c.materialized_path LIKE '%${sanitizedDsaId}%'`);
                conditionsC2.push(`c2.materialized_path LIKE '%${sanitizedDsaId}%'`);
                conditionsC3.push(`c3.materialized_path LIKE '%${sanitizedDsaId}%'`);
            }

            if (conditions.length > 0) {
                const conditionStr = `(${conditions.join(' OR ')})`;
                const conditionStrC2 = `(${conditionsC2.join(' OR ')})`;
                const conditionStrC3 = `(${conditionsC3.join(' OR ')})`;
                hierarchyConditionWhere = `WHERE ${conditionStr}`;
                hierarchyConditionAnd = `AND ${conditionStr}`;
                hierarchyConditionAndC2 = `AND ${conditionStrC2}`;
                hierarchyConditionAndC3 = `AND ${conditionStrC3}`;
            } else {
                // If hierarchy should be applied but no dsaId/materializedPath provided, return empty results
                // This prevents showing all records when user has no hierarchy info
                hierarchyConditionWhere = `WHERE 1=0`;
                hierarchyConditionAnd = `AND 1=0`;
                hierarchyConditionAndC2 = `AND 1=0`;
                hierarchyConditionAndC3 = `AND 1=0`;
            }
        }
        // Exclude biller and Payee from vendor dashboard/metrics (direct selling agents only)
        const userTypeExclusionVendor = `(c.user_type IS NULL OR LOWER(TRIM(c.user_type)) NOT IN ('biller', 'payee'))`;
        if (hierarchyConditionWhere) {
            hierarchyConditionWhere = hierarchyConditionWhere + ' AND ' + userTypeExclusionVendor;
        } else {
            hierarchyConditionWhere = 'WHERE ' + userTypeExclusionVendor;
        }
        hierarchyCondition = hierarchyConditionWhere;

        // Debug logging to verify hierarchy conditions are being built
        if (!skipHierarchy) {
            console.log('[getVendorMetrics] Hierarchy check:', {
                skipHierarchy,
                dsaId,
                materializedPath,
                hasHierarchyCondition: !!hierarchyCondition,
                hierarchyCondition: hierarchyCondition.substring(0, 100)
            });
        }

        // MEMORY OPTIMIZATION: Use database aggregations instead of loading all records
        // For 20+ lakh records, this prevents loading 2-3 GB into memory

        // Use aggregated queries to calculate metrics directly in database (single scan for base + bank).
        // This avoids loading millions of records into memory and reduces vendor table scans from 4 to 2.
        const metricsQuery = `
            SELECT 
                COUNT(DISTINCT c.dsa_id) as totalVendors,
                
                -- Contact validation (phone: 10 digits, email: valid format, PAN: valid format)
                SUM(CASE 
                    WHEN (
                        c.dsa_mobile_number REGEXP '^[0-9]{10}$' = 0 
                        OR c.email_address REGEXP '^[^@]+@[^@]+\\.[^@]+$' = 0
                        OR (
                            k.permanent_account_number IS NULL 
                            OR k.permanent_account_number = ''
                            OR (
                                k.permanent_account_number NOT LIKE '%X%'
                                AND k.permanent_account_number REGEXP '^[A-Z]{5}[0-9]{4}[A-Z]$' = 0
                                AND k.permanent_account_number REGEXP '^[A-Z]{3}P[A-Z][0-9]{4}[A-Z]$' = 0
                                AND k.permanent_account_number REGEXP '^[A-Z]{3}[CFHATBLJGP][A-Z][0-9]{4}[A-Z]$' = 0
                            )
                        )
                    )
                    THEN 1 ELSE 0 
                END) as junkContactData,
                
                SUM(CASE WHEN (c.global_payouts_percentage IS NULL OR c.global_payouts_percentage = '') THEN 1 ELSE 0 END) as payoutNotSet,
                SUM(CASE WHEN (c.assigning_payout_percentage IS NULL OR c.assigning_payout_percentage = '') THEN 1 ELSE 0 END) as cappingNotSet,
                
                SUM(CASE 
                    WHEN (k.ns_hierarchy IS NULL OR k.ns_hierarchy = '' OR k.netsuite_vendor_id IS NULL OR k.netsuite_vendor_id = '')
                    THEN 1 ELSE 0 
                END) as nsDetailsMissing,

                -- Bank account missing: count vendors with no valid bank account (same scan, no extra query)
                SUM(CASE WHEN ba.dsa_id IS NULL THEN 1 ELSE 0 END) as bankAccountMissing,

                -- AuthBridge PAN verification not set (individual DSA: k.is_permanent_account_number_verified)
                SUM(CASE WHEN (k.is_permanent_account_number_verified IS NULL OR k.is_permanent_account_number_verified = 0) THEN 1 ELSE 0 END) as authbridgeNotSet

            FROM ru_direct_selling_agents c
            LEFT JOIN ru_dsa_kyc_data k ON c.dsa_id = k.dsa_id
            LEFT JOIN ru_dsa_bank_accounts ba ON c.dsa_id = ba.dsa_id AND ba.account_number IS NOT NULL AND ba.account_number != ''
            ${hierarchyCondition}
        `;

        // onboarding_complete = step6_count (100% complete); no separate query needed
        const onboardingStepsQuery = `
            SELECT
                AVG(COALESCE(o.completed_steps, 0) * 100.0 / 6) AS avg_completion_percentage,
                SUM(CASE WHEN COALESCE(o.completed_steps, 0) IN (0, 1) THEN 1 ELSE 0 END) AS step1_count,
                SUM(CASE WHEN o.completed_steps = 2 THEN 1 ELSE 0 END) AS step2_count,
                SUM(CASE WHEN o.completed_steps = 3 THEN 1 ELSE 0 END) AS step3_count,
                SUM(CASE WHEN o.completed_steps = 4 THEN 1 ELSE 0 END) AS step4_count,
                SUM(CASE WHEN o.completed_steps = 5 THEN 1 ELSE 0 END) AS step5_count,
                SUM(CASE WHEN o.completed_steps = 6 THEN 1 ELSE 0 END) AS step6_count
            FROM ru_direct_selling_agents c
            LEFT JOIN (
                SELECT
                    dsa_id,
                    COUNT(step) AS completed_steps
                FROM ru_user_onboarding_steps
                WHERE status = 1
                  AND step IN (
                      'lead_generation',
                      'dsa_consent',
                      'basic_details',
                      'address',
                      'kyc',
                      'dsa_agreement'
                  )
                GROUP BY dsa_id
            ) o ON o.dsa_id = c.dsa_id
            ${hierarchyConditionWhere}
        `;

        const { lightOnly = false, onboardingOnly = false } = options;


        if (lightOnly) {
            const metricsResult = await _db2.query(metricsQuery, { replacements: bindParams, type: QueryTypes.SELECT });
            const baseMetrics = metricsResult[0] || {};
            const totalVendors = parseInt(baseMetrics.totalVendors) || 0;
            return {
                totalVendors,
                onboardingComplete: null,
                onboardingCompletePercentage: null,
                onboardingSteps: null,
                averageOnboardingPercentage: null,
                junkContactData: parseInt(baseMetrics.junkContactData) || 0,
                missingOnboardingData: null,
                payoutNotSet: parseInt(baseMetrics.payoutNotSet) || 0,
                cappingNotSet: parseInt(baseMetrics.cappingNotSet) || 0,
                bankAccountMissing: parseInt(baseMetrics.bankAccountMissing) || 0,
                nsDetailsMissing: parseInt(baseMetrics.nsDetailsMissing) || 0,
                authbridgeNotSet: parseInt(baseMetrics.authbridgeNotSet) || 0,
                refresh: refresh || false,
                cardKey: cardKey || null,
                onboardingLoading: true
            };
        }


        if (onboardingOnly) {
            const [metricsResultOnboard, stepsResult] = await Promise.all([
                _db2.query(metricsQuery, { replacements: bindParams, type: QueryTypes.SELECT }),
                _db2.query(onboardingStepsQuery, { replacements: bindParams, type: QueryTypes.SELECT })
            ]);
            const baseMetricsOnboard = metricsResultOnboard[0] || {};
            const st = stepsResult[0] || {};
            const individualVendorCount = parseInt(baseMetricsOnboard.totalVendors) || 0;
            if (individualVendorCount === 0) {
                return {
                    totalVendors: 0,
                    onboardingComplete: 0,
                    onboardingCompletePercentage: 0,
                    onboardingSteps: { step1: 0, step2: 0, step3: 0, step4: 0, step5: 0, step6: 0 },
                    averageOnboardingPercentage: 0,
                    missingOnboardingData: 0,
                    authbridgeNotSet: 0,
                    onboardingOnly: true
                };
            }
            const onboardingComplete = parseInt(st.step6_count) || 0;
            const missingOnboardingData = individualVendorCount - onboardingComplete;
            const onboardingSteps = {
                step1: parseInt(st.step1_count) || 0,
                step2: parseInt(st.step2_count) || 0,
                step3: parseInt(st.step3_count) || 0,
                step4: parseInt(st.step4_count) || 0,
                step5: parseInt(st.step5_count) || 0,
                step6: parseInt(st.step6_count) || 0
            };
            const stepsSum = onboardingSteps.step1 + onboardingSteps.step2 + onboardingSteps.step3 + onboardingSteps.step4 + onboardingSteps.step5 + onboardingSteps.step6;
            if (stepsSum !== individualVendorCount) {
                onboardingSteps.step1 = onboardingSteps.step1 + (individualVendorCount - stepsSum);
            }
            const onboardingCompletePercentage = parseFloat(((onboardingComplete / individualVendorCount) * 100).toFixed(1));
            return {
                totalVendors: individualVendorCount,
                onboardingComplete,
                onboardingCompletePercentage,
                onboardingSteps,
                averageOnboardingPercentage: parseFloat(st.avg_completion_percentage) || 0,
                missingOnboardingData,
                authbridgeNotSet: parseInt(baseMetricsOnboard.authbridgeNotSet) || 0,
                onboardingOnly: true
            };
        }

        // Full: run base metrics + onboarding step counts (onboarding_complete = step6_count, no separate query)
        const [metricsResult, stepsResult] = await Promise.all([
            _db2.query(metricsQuery, { replacements: bindParams, type: QueryTypes.SELECT }),
            _db2.query(onboardingStepsQuery, { replacements: bindParams, type: QueryTypes.SELECT })
        ]);

        const baseMetrics = metricsResult[0] || {
            totalVendors: 0,
            junkContactData: 0,
            payoutNotSet: 0,
            cappingNotSet: 0,
            nsDetailsMissing: 0,
            bankAccountMissing: 0
        };

        const totalVendors = parseInt(baseMetrics.totalVendors) || 0;
        const bankAccountMissing = parseInt(baseMetrics.bankAccountMissing) || 0;

        if (totalVendors === 0) {
            return {
                totalVendors: 0,
                onboardingComplete: 0,
                onboardingCompletePercentage: 0,
                onboardingSteps: { step1: 0, step2: 0, step3: 0, step4: 0, step5: 0, step6: 0 },
                averageOnboardingPercentage: 0,
                junkContactData: 0,
                missingOnboardingData: 0,
                payoutNotSet: 0,
                cappingNotSet: 0,
                bankAccountMissing: 0,
                nsDetailsMissing: 0,
                authbridgeNotSet: 0
            };
        }

        const st = stepsResult[0] || {};
        const individualVendorCount = parseInt(baseMetrics.totalVendors) || 0;
        const onboardingComplete = parseInt(st.step6_count) || 0;
        const averageOnboardingPercentage = parseFloat(st.avg_completion_percentage) || 0;
        const missingOnboardingData = individualVendorCount - onboardingComplete;

        const onboardingSteps = {
            step1: parseInt(st.step1_count) || 0,
            step2: parseInt(st.step2_count) || 0,
            step3: parseInt(st.step3_count) || 0,
            step4: parseInt(st.step4_count) || 0,
            step5: parseInt(st.step5_count) || 0,
            step6: parseInt(st.step6_count) || 0
        };

        // If sum of steps != individual vendor count, add difference to step1
        const stepsSum = onboardingSteps.step1 + onboardingSteps.step2 + onboardingSteps.step3 +
            onboardingSteps.step4 + onboardingSteps.step5 + onboardingSteps.step6;
        if (stepsSum !== individualVendorCount) {
            const missingCount = individualVendorCount - stepsSum;
            onboardingSteps.step1 = onboardingSteps.step1 + missingCount;
            console.warn(`Onboarding steps count mismatch: steps sum (${stepsSum}) != individual vendors (${individualVendorCount}). Added ${missingCount} to step1.`);
        }

        const onboardingCompletePercentage = individualVendorCount > 0 ? parseFloat(((onboardingComplete / individualVendorCount) * 100).toFixed(1)) : 0;

        // Handle refresh logic - if refresh is true and cardKey is provided, invalidate cache for that specific metric
        if (refresh && cardKey) {
            // Generate cache key based on hierarchy and cardKey
            const cacheKeyPrefix = `vendor_metrics_${dsaId || 'all'}_${materializedPath || 'all'}_${cardKey}`;
            // If using Redis cache, invalidate it here
            // Example: await client.del(cacheKeyPrefix);
            console.log(`Refreshing metric for cardKey: ${cardKey}, cacheKey: ${cacheKeyPrefix}`);
        }

        // Final verification: Use the sum of steps as the source of truth for totalVendors
        // This ensures absolute consistency: sum of steps = totalVendors (always)
        const finalStepsSum = onboardingSteps.step1 + onboardingSteps.step2 + onboardingSteps.step3 +
            onboardingSteps.step4 + onboardingSteps.step5 + onboardingSteps.step6;
        const finalTotalVendors = finalStepsSum; // Use steps sum as source of truth

        // Use finalTotalVendors (steps sum) for totalVendors to ensure absolute consistency
        // This guarantees: sum of steps = totalVendors (always)
        return {
            totalVendors: finalTotalVendors,
            onboardingComplete: onboardingComplete,
            onboardingCompletePercentage: onboardingCompletePercentage,
            onboardingSteps: onboardingSteps,
            averageOnboardingPercentage: averageOnboardingPercentage,
            junkContactData: parseInt(baseMetrics.junkContactData) || 0,
            missingOnboardingData: missingOnboardingData,
            payoutNotSet: parseInt(baseMetrics.payoutNotSet) || 0,
            cappingNotSet: parseInt(baseMetrics.cappingNotSet) || 0,
            bankAccountMissing: bankAccountMissing,
            nsDetailsMissing: parseInt(baseMetrics.nsDetailsMissing) || 0,
            authbridgeNotSet: parseInt(baseMetrics.authbridgeNotSet) || 0,
            refresh: refresh || false,
            cardKey: cardKey || null
        };
    } catch (error) {
        console.error('Error in getVendorMetrics:', error);
        throw error;
    }
};

/**
 * Get Vendor Dashboard List
 * Returns paginated list of vendors with filtering, sorting, and hierarchy support
 * @param {string} dsaId - DSA ID for hierarchy filtering
 * @param {string} materializedPath - Materialized path for hierarchy filtering
 * @param {boolean} skipHierarchy - If true, skip hierarchy filtering (for CEO)
 * @param {object} filters - Filter object containing filterType, filterModel, pagination, sorting
 */
const getVendorDashboardList = async (dsaId, materializedPath, skipHierarchy = false, filters = {}) => {
    try {
        const {
            nodeId = null,
            filterType = 'all',
            pageNumber = 0,
            pageSize = 10,
            sortBy = 'vendor_name',
            sortDirection = 'asc',
            filterModel = { items: [], logicOperator: 'and' }
        } = filters;

        let hierarchyCondition = '';
        let bindParams = [];

        // Build hierarchy condition (same logic as getVendorMetrics) – who the user can see
        if (!skipHierarchy && (dsaId || materializedPath)) {
            const conditions = [];

            if (materializedPath) {
                const sanitizedPath = materializedPath.replace(/'/g, "\\'");
                conditions.push(`c.materialized_path LIKE '${sanitizedPath}%'`);
            }

            if (dsaId) {
                const sanitizedDsaId = dsaId.replace(/'/g, "\\'");
                conditions.push(`c.materialized_path LIKE '%${sanitizedDsaId}%'`);
            }

            if (conditions.length > 0) {
                hierarchyCondition = `WHERE (${conditions.join(' OR ')})`;
            }
        }

        // When nodeId is sent: show that DSA and its hierarchy (node + everyone under). Same pattern as getRuloansCustomers – materialized_path LIKE '%dsa_id%'.
        let subtreeCondition = '';
        if (nodeId && String(nodeId).trim() !== '') {
            const nId = String(nodeId).trim();
            const sanitizedNodeId = nId.replace(/'/g, "\\'");
            const escapeLike = (s) => String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/'/g, "\\'");
            const nodeIdForLike = escapeLike(nId);
            subtreeCondition = `(c.dsa_id = '${sanitizedNodeId}' OR c.materialized_path LIKE '%${nodeIdForLike}%')`;
        }

        // Build filterType conditions
        const filterTypeConditions = [];
        // Onboarding filter: use EXISTS / NOT EXISTS (dsa_agreement + status=1), same as vendor metrics.
        const dsaAgreementExists = `EXISTS (SELECT 1 FROM ru_user_onboarding_steps x WHERE x.dsa_id = c.dsa_id AND x.step = 'dsa_agreement' AND x.status = 1)`;
        const onboardingFilterJoinFragment = '';

        if (filterType === 'onboarding_complete') {
            filterTypeConditions.push(`(${dsaAgreementExists})`);
        } else if (filterType === 'missing_onboarding') {
            filterTypeConditions.push(`(NOT ${dsaAgreementExists})`);
        } else if (filterType === 'junk_contact') {
            // Vendors with invalid mobile, email, or PAN
            filterTypeConditions.push(`(
                c.dsa_mobile_number REGEXP '^[0-9]{10}$' = 0 
                OR c.email_address REGEXP '^[^@]+@[^@]+\\\\.[^@]+$' = 0
                OR (
                    k.permanent_account_number IS NULL 
                    OR k.permanent_account_number = ''
                    OR (
                        k.permanent_account_number NOT LIKE '%X%'
                        AND k.permanent_account_number REGEXP '^[A-Z]{5}[0-9]{4}[A-Z]$' = 0
                        AND k.permanent_account_number REGEXP '^[A-Z]{3}P[A-Z][0-9]{4}[A-Z]$' = 0
                        AND k.permanent_account_number REGEXP '^[A-Z]{3}[CFHATBLJGP][A-Z][0-9]{4}[A-Z]$' = 0
                    )
                )
            )`);
        } else if (filterType === 'payout_not_set') {
            filterTypeConditions.push(`(c.global_payouts_percentage IS NULL OR c.global_payouts_percentage = '')`);
        } else if (filterType === 'capping_not_set') {
            filterTypeConditions.push(`(c.assigning_payout_percentage IS NULL OR c.assigning_payout_percentage = '')`);
        } else if (filterType === 'bank_account_missing') {
            // Use ba.dsa_id IS NULL when ba join is present (see count/data query); otherwise NOT EXISTS
            filterTypeConditions.push(`(ba.dsa_id IS NULL)`);
        } else if (filterType === 'ns_issues') {
            filterTypeConditions.push(`(k.ns_hierarchy IS NULL OR k.ns_hierarchy = '' OR k.netsuite_vendor_id IS NULL OR k.netsuite_vendor_id = '')`);
        } else if (filterType === 'authbridge_not_set') {
            filterTypeConditions.push(`(k.is_permanent_account_number_verified IS NULL OR k.is_permanent_account_number_verified = 0)`);
        }
        // 'all' filterType doesn't add any conditions

        // onboarding_percentage: correlated subquery (DISTINCT for full list; COUNT(s.step) for onboarding list).
        const onboardingPercentageExpr = `ROUND(
            (
                SELECT COUNT(DISTINCT s.step)
                FROM ru_user_onboarding_steps s
                WHERE s.dsa_id = c.dsa_id
                  AND s.status = 1
                  AND s.step IN (
                      'lead_generation',
                      'dsa_consent',
                      'basic_details',
                      'address',
                      'kyc',
                      'dsa_agreement'
                  )
            ) * 100.0 / 6,
        2)`;
        const onboardingListPercentageExpr = `ROUND(
            (
                SELECT COUNT(s.step)
                FROM ru_user_onboarding_steps s
                WHERE s.dsa_id = c.dsa_id
                  AND s.status = 1
                  AND s.step IN (
                      'lead_generation',
                      'dsa_consent',
                      'basic_details',
                      'address',
                      'kyc',
                      'dsa_agreement'
                  )
            ) * 100.0 / 6,
        2)`;
        const bankJoinFragment = `
            LEFT JOIN (SELECT DISTINCT dsa_id FROM ru_dsa_bank_accounts WHERE account_number IS NOT NULL AND account_number != '') ba ON c.dsa_id = ba.dsa_id`;
        // Count query needs ba join when filterType is bank_account_missing or filterModel uses bank_account/data_quality_status (both reference ba)
        const bankJoinForCount = bankJoinFragment;
        const isOnboardingList = filterType === 'onboarding_complete' || filterType === 'missing_onboarding';

        // Process filterModel using CreateWhereQueryFilter (same pattern as getExpenses)
        // Separate standard filters from special singleSelect fields
        const standardFilterItems = [];
        const specialFilterItems = [];

        if (filterModel.items && Array.isArray(filterModel.items) && filterModel.items.length > 0) {
            filterModel.items.forEach((filter) => {
                const { field, operator } = filter;
                // Special handling for singleSelect fields (isAnyOf or "is" with Set/Missing/Added/Verified)
                const isSpecialField = field === 'payout_capping' || field === 'global_payout' || field === 'bank_account' || field === 'data_quality_status' || field === 'authbridge_pan_verification_status';
                const isSpecialOp = operator === 'isAnyOf' || (operator === 'is' && (field === 'data_quality_status' || ['Set', 'Missing', 'Added', 'Verified', 'Not Verified', 'Unverified'].includes(filter.value)));
                if (isSpecialField && isSpecialOp) {
                    specialFilterItems.push(filter);
                } else {
                    standardFilterItems.push(filter);
                }
            });
        }

        // Use CreateWhereQueryFilter for standard fields (same as getExpenses)
        const operatorHandlers = CustomOperatorHandlers();
        let whereFilterQuery = [];
        if (standardFilterItems.length > 0) {
            const standardFilterModel = {
                items: standardFilterItems,
                logicOperator: filterModel.logicOperator || 'and'
            };
            whereFilterQuery = CreateWhereQueryFilter(
                standardFilterModel,
                getVendorDashboardListApiFieldMapping,
                operatorHandlers,
                "vendor_dashboard"
            );
        }

        // Handle special singleSelect fields manually (complex SQL needed).
        // Use EXISTS for bank_account so filters work for onboarding lists (no ba join).
        const bankAccountExistsExpr = `EXISTS (SELECT 1 FROM ru_dsa_bank_accounts ba WHERE ba.dsa_id = c.dsa_id AND ba.account_number IS NOT NULL AND ba.account_number != '')`;
        const specialFilterConditions = [];
        specialFilterItems.forEach((filter) => {
            let { field, operator, value } = filter;
            const valueList = Array.isArray(value) ? value : (value != null && value !== '' ? [value] : []);
            if ((operator === 'isAnyOf' && Array.isArray(value)) || (operator === 'is' && valueList.length > 0)) {
                if (field === 'payout_capping') {
                    if (valueList.includes('Set')) {
                        specialFilterConditions.push(`(c.assigning_payout_percentage IS NOT NULL AND c.assigning_payout_percentage != '')`);
                    }
                    if (valueList.includes('Missing')) {
                        specialFilterConditions.push(`(c.assigning_payout_percentage IS NULL OR c.assigning_payout_percentage = '')`);
                    }
                } else if (field === 'global_payout') {
                    if (valueList.includes('Set')) {
                        specialFilterConditions.push(`(c.global_payouts_percentage IS NOT NULL AND c.global_payouts_percentage != '')`);
                    }
                    if (valueList.includes('Missing')) {
                        specialFilterConditions.push(`(c.global_payouts_percentage IS NULL OR c.global_payouts_percentage = '')`);
                    }
                } else if (field === 'bank_account') {
                    if (valueList.includes('Added')) {
                        specialFilterConditions.push(`(${bankAccountExistsExpr})`);
                    }
                    if (valueList.includes('Missing')) {
                        specialFilterConditions.push(`(NOT ${bankAccountExistsExpr})`);
                    }
                } else if (field === 'data_quality_status') {
                    if (valueList.includes('Issues')) {
                        specialFilterConditions.push(`(
                            c.dsa_mobile_number REGEXP '^[0-9]{10}$' = 0 
                            OR c.email_address REGEXP '^[^@]+@[^@]+\\\\.[^@]+$' = 0
                            OR (k.permanent_account_number IS NULL OR k.permanent_account_number = '' OR (
                                k.permanent_account_number NOT LIKE '%X%'
                                AND k.permanent_account_number REGEXP '^[A-Z]{5}[0-9]{4}[A-Z]$' = 0
                                AND k.permanent_account_number REGEXP '^[A-Z]{3}P[A-Z][0-9]{4}[A-Z]$' = 0
                                AND k.permanent_account_number REGEXP '^[A-Z]{3}[CFHATBLJGP][A-Z][0-9]{4}[A-Z]$' = 0
                            ))
                            OR (c.global_payouts_percentage IS NULL OR c.global_payouts_percentage = '')
                            OR (c.assigning_payout_percentage IS NULL OR c.assigning_payout_percentage = '')
                            OR (NOT ${bankAccountExistsExpr})
                            OR (k.ns_hierarchy IS NULL OR k.ns_hierarchy = '' OR k.netsuite_vendor_id IS NULL OR k.netsuite_vendor_id = '')
                        )`);
                    }
                    if (valueList.includes('OK')) {
                        specialFilterConditions.push(`(
                            c.dsa_mobile_number REGEXP '^[0-9]{10}$' = 1 
                            AND c.email_address REGEXP '^[^@]+@[^@]+\\\\.[^@]+$' = 1
                            AND (k.permanent_account_number IS NOT NULL AND k.permanent_account_number != '' AND (
                                k.permanent_account_number LIKE '%X%'
                                OR k.permanent_account_number REGEXP '^[A-Z]{5}[0-9]{4}[A-Z]$' = 1
                                OR k.permanent_account_number REGEXP '^[A-Z]{3}P[A-Z][0-9]{4}[A-Z]$' = 1
                                OR k.permanent_account_number REGEXP '^[A-Z]{3}[CFHATBLJGP][A-Z][0-9]{4}[A-Z]$' = 1
                            ))
                            AND (c.global_payouts_percentage IS NOT NULL AND c.global_payouts_percentage != '')
                            AND (c.assigning_payout_percentage IS NOT NULL AND c.assigning_payout_percentage != '')
                            AND (${bankAccountExistsExpr})
                            AND (k.ns_hierarchy IS NOT NULL AND k.ns_hierarchy != '' AND k.netsuite_vendor_id IS NOT NULL AND k.netsuite_vendor_id != '')
                        )`);
                    }
                } else if (field === 'authbridge_pan_verification_status') {
                    // FE sends values like "Verified" / "Not Verified". Column is numeric (1/0/null).
                    const normalized = valueList.map(v => (typeof v === 'string' ? v.trim().toLowerCase() : v));
                    if (normalized.includes('verified')) {
                        specialFilterConditions.push(`(k.is_permanent_account_number_verified = 1)`);
                    }
                    if (normalized.includes('not verified') || normalized.includes('unverified') || normalized.includes('missing')) {
                        specialFilterConditions.push(`(k.is_permanent_account_number_verified IS NULL OR k.is_permanent_account_number_verified = 0)`);
                    }
                }
            }
        });

        // Add special filter conditions to filterTypeConditions
        if (specialFilterConditions.length > 0) {
            const logicOp = (filterModel.logicOperator || 'and').toUpperCase();
            if (logicOp === 'OR') {
                filterTypeConditions.push(`(${specialFilterConditions.join(' OR ')})`);
            } else {
                filterTypeConditions.push(...specialFilterConditions);
            }
        }

        // Exclude biller and Payee from vendor dashboard (direct selling agents only)
        const userTypeExclusionVendorList = `(c.user_type IS NULL OR LOWER(TRIM(c.user_type)) NOT IN ('biller', 'payee'))`;

        // Combine all conditions
        const allConditions = [];
        allConditions.push(userTypeExclusionVendorList);
        if (hierarchyCondition) {
            // Remove WHERE from hierarchyCondition and add to allConditions
            const hierarchyCond = hierarchyCondition.replace(/^WHERE\s+/i, '');
            allConditions.push(`(${hierarchyCond})`);
        }
        if (subtreeCondition) {
            allConditions.push(subtreeCondition);
        }
        allConditions.push(...filterTypeConditions);

        // Build base WHERE clause from hierarchy and filterType
        let baseWhereClause = allConditions.length > 0 ? allConditions.join(' AND ') : '';
        let standardFilterClause = '';

        // Process whereFilterQuery (from CreateWhereQueryFilter) - same pattern as getExpenses
        const logicOperator = (filterModel.logicOperator || 'and').toUpperCase();
        if (whereFilterQuery && whereFilterQuery.length > 0) {
            const filterConditions = [];
            for (let i = 0; i < whereFilterQuery.length; i++) {
                let [field, operator, value] = whereFilterQuery[i];

                // Handle array values for isAnyOf (IN clause)
                if (Array.isArray(value) && value.length > 0) {
                    const placeholders = value.map(() => '?').join(',');
                    filterConditions.push(`${field} ${operator} (${placeholders})`);
                    bindParams.push(...value);
                } else if (value !== null && value !== undefined && value !== '') {
                    filterConditions.push(`${field} ${operator} ?`);
                    bindParams.push(value);
                } else {
                    filterConditions.push(`${field} ${operator}`);
                }
            }

            if (filterConditions.length > 0) {
                const filterClause = filterConditions.join(` ${logicOperator} `);
                standardFilterClause = filterClause;
                if (baseWhereClause) {
                    baseWhereClause += ` AND (${filterClause})`;
                } else {
                    baseWhereClause = filterClause;
                }
            }
        }

        const whereClause = baseWhereClause ? `WHERE ${baseWhereClause}` : '';
        // Clause from filterModel only (for onboarding queries: same filters as full list)
        const filterModelOnlyParts = [].concat(specialFilterConditions, standardFilterClause ? [standardFilterClause] : []).filter(Boolean);
        const filterModelOnlyClause = filterModelOnlyParts.length === 0 ? '' : filterModelOnlyParts.length === 1 ? filterModelOnlyParts[0] : `(${filterModelOnlyParts.join(` ${logicOperator} `)})`;

        // CRM hierarchy: same as getDsaUserDetails - stored hierarchy_crm only, no computation
        const crmHierarchySelect = 'c.hierarchy_crm';

        // Build sorting
        let orderBy = '';
        const validSortFields = {
            'vendor_name': 'c.full_name',
            'partner_name': 'p.full_name',
            'pan_number': 'k.permanent_account_number',
            'ns_vendor_id': 'k.netsuite_vendor_id',
            'mobile': 'c.dsa_mobile_number',
            'email': 'c.email_address',
            'crm_hierarchy': 'c.hierarchy_crm',
            'ns_hierarchy': 'k.ns_hierarchy',
            'payout_capping': 'c.assigning_payout_percentage',
            'global_payout': 'c.global_payouts_percentage',
            'bank_account': 'bank_account_status',
            'data_quality_status': 'data_quality_status',
            'authbridge_pan_verification_status': 'k.is_permanent_account_number_verified'
        };

        const sortField = validSortFields[sortBy] || 'c.full_name';
        const sortDir = sortDirection.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
        // Onboarding complete and incomplete: order by created_at (newest first)
        if (filterType === 'onboarding_complete' || filterType === 'missing_onboarding') {
            orderBy = `ORDER BY c.created_at DESC`;
        } else {
            orderBy = `ORDER BY ${sortField} ${sortDir}`;
        }

        // data_quality_status only for specific filters (junk_contact, payout_not_set, capping_not_set, bank_account_missing, ns_issues); not for 'all' or onboarding
        const dataQualityFilterTypes = ['junk_contact', 'payout_not_set', 'capping_not_set', 'bank_account_missing', 'ns_issues'];
        const useDataQualityCheck = dataQualityFilterTypes.includes(filterType);
        const dataQualityStatusSelect = useDataQualityCheck
            ? `CASE 
                WHEN (
                    c.dsa_mobile_number REGEXP '^[0-9]{10}$' = 0 
                    OR c.email_address REGEXP '^[^@]+@[^@]+\\\\.[^@]+$' = 0
                    OR (k.permanent_account_number IS NULL OR k.permanent_account_number = '' OR (
                        k.permanent_account_number NOT LIKE '%X%'
                        AND k.permanent_account_number REGEXP '^[A-Z]{5}[0-9]{4}[A-Z]$' = 0
                        AND k.permanent_account_number REGEXP '^[A-Z]{3}P[A-Z][0-9]{4}[A-Z]$' = 0
                        AND k.permanent_account_number REGEXP '^[A-Z]{3}[CFHATBLJGP][A-Z][0-9]{4}[A-Z]$' = 0
                    ))
                    OR (c.global_payouts_percentage IS NULL OR c.global_payouts_percentage = '')
                    OR (c.assigning_payout_percentage IS NULL OR c.assigning_payout_percentage = '')
                    OR ba.dsa_id IS NULL
                    OR (k.ns_hierarchy IS NULL OR k.ns_hierarchy = '' OR k.netsuite_vendor_id IS NULL OR k.netsuite_vendor_id = '')
                )
                THEN 'Issues'
                ELSE 'OK'
            END as data_quality_status`
            : `NULL as data_quality_status`;

        const bankAccountSelect = isOnboardingList
            ? `NULL as bank_account`
            : `CASE WHEN ba.dsa_id IS NOT NULL THEN 'Added' ELSE 'Missing' END as bank_account`;

        // Build main query with pagination
        const offset = pageNumber * pageSize;

        const hierarchyCondOnly = hierarchyCondition ? hierarchyCondition.replace(/^WHERE\s+/i, '').trim() : '';
        // When nodeId is present, scope = hierarchy AND subtree; otherwise scope = hierarchy only (so all queries see same scope)
        const scopeCond = subtreeCondition
            ? (hierarchyCondOnly ? `(${hierarchyCondOnly}) AND (${subtreeCondition})` : subtreeCondition)
            : hierarchyCondOnly;
        const hasFilterModel = filterModel?.items?.length > 0;
        const stepsForceIndex = process.env.ENVIRONMENT === 'dev' ? '' : ' FORCE INDEX (idx_steps_dsa_step_status)';

        // Optimized count: single table + FORCE INDEX on onboarding steps (no k, p, ba joins)
        const onboardingCountQueryBase = `
            SELECT COUNT(*) AS total
            FROM ru_direct_selling_agents c
            LEFT JOIN ru_user_onboarding_steps x${stepsForceIndex}
              ON x.dsa_id = c.dsa_id
             AND x.step = 'dsa_agreement'
             AND x.status = 1
        `;
        const missingOnboardingCountQuery = `${onboardingCountQueryBase}
            WHERE x.dsa_id IS NULL
            AND ${userTypeExclusionVendorList}
            ${scopeCond ? `AND (${scopeCond})` : ''}
        `;
        const onboardingCompleteCountQuery = `${onboardingCountQueryBase}
            WHERE x.dsa_id IS NOT NULL
            AND ${userTypeExclusionVendorList}
            ${scopeCond ? `AND (${scopeCond})` : ''}
        `;

        // Optimized count for 'all': no joins, hierarchy (and subtree when nodeId present)
        const allCountQuery = `
            SELECT COUNT(*) AS total
            FROM ru_direct_selling_agents c
            ${scopeCond ? `WHERE (${scopeCond}) AND ${userTypeExclusionVendorList}` : `WHERE ${userTypeExclusionVendorList}`}
        `;

        // Full count (joins only when needed for filterType or filterModel)
        const defaultCountQuery = `
            SELECT COUNT(DISTINCT c.dsa_id) as total
            FROM ru_direct_selling_agents c
            LEFT JOIN ru_dsa_kyc_data k ON c.dsa_id = k.dsa_id
            LEFT JOIN ru_direct_selling_agents p ON c.partner_code = p.dsa_mobile_number
            ${onboardingFilterJoinFragment}
            ${isOnboardingList ? '' : bankJoinForCount}
            ${whereClause}
        `;

        let countQuery;
        if (filterType === 'missing_onboarding') {
            countQuery = filterModelOnlyClause ? defaultCountQuery : missingOnboardingCountQuery;
        } else if (filterType === 'onboarding_complete') {
            countQuery = filterModelOnlyClause ? defaultCountQuery : onboardingCompleteCountQuery;
        } else if (filterType === 'all' && !hasFilterModel && !subtreeCondition) {
            countQuery = allCountQuery;
        } else {
            countQuery = defaultCountQuery;
        }

        const countResult = await _db2.query(countQuery, {
            replacements: bindParams,
            type: QueryTypes.SELECT
        });
        const totalCount = parseInt(countResult[0]?.total) || 0;

        // Onboarding complete: JOIN x FORCE INDEX; incomplete: LEFT JOIN x WHERE x.dsa_id IS NULL FORCE INDEX; both use FORCE INDEX in subquery
        const onboardingListSelect = `
            SELECT
                c.dsa_id,
                c.full_name AS vendor_name,
                p.full_name AS partner_name,
                k.permanent_account_number AS pan_number,
                k.netsuite_vendor_id AS ns_vendor_id,
                c.dsa_mobile_number AS mobile,
                c.email_address AS email,
                ${crmHierarchySelect} AS crm_hierarchy,
                k.ns_hierarchy,
                c.created_at,
                c.global_payouts_percentage,
                c.assigning_payout_percentage,
                ROUND(
                    (
                        SELECT COUNT(s.step)
                        FROM ru_user_onboarding_steps s${stepsForceIndex}
                        WHERE s.dsa_id = c.dsa_id
                          AND s.status = 1
                          AND s.step IN (
                              'lead_generation',
                              'dsa_consent',
                              'basic_details',
                              'address',
                              'kyc',
                              'dsa_agreement'
                          )
                    ) * 100.0 / 6,
                    2
                ) AS onboarding_percentage,
                CASE WHEN EXISTS (SELECT 1 FROM ru_dsa_bank_accounts ba WHERE ba.dsa_id = c.dsa_id AND ba.account_number IS NOT NULL AND ba.account_number != '') THEN 'Added' ELSE 'Missing' END AS bank_account,
                CASE WHEN (c.assigning_payout_percentage IS NOT NULL AND c.assigning_payout_percentage != '') THEN 'Set' ELSE 'Missing' END AS payout_capping,
                CASE WHEN (c.global_payouts_percentage IS NOT NULL AND c.global_payouts_percentage != '') THEN 'Set' ELSE 'Missing' END AS global_payout,
                k.is_permanent_account_number_verified AS authbridge_pan_verification_status
        `;
        const onboardingWhereAddition = filterModelOnlyClause ? ` AND (${filterModelOnlyClause})` : '';
        const onboardingCompleteDataQuery = `${onboardingListSelect}
            FROM ru_direct_selling_agents c
            JOIN ru_user_onboarding_steps x${stepsForceIndex}
              ON x.dsa_id = c.dsa_id
             AND x.step = 'dsa_agreement'
             AND x.status = 1
            LEFT JOIN ru_dsa_kyc_data k ON k.dsa_id = c.dsa_id
            LEFT JOIN ru_direct_selling_agents p ON p.dsa_mobile_number = c.partner_code
            ${scopeCond ? `WHERE (${scopeCond}) AND ${userTypeExclusionVendorList}${onboardingWhereAddition}` : filterModelOnlyClause ? `WHERE (${filterModelOnlyClause}) AND ${userTypeExclusionVendorList}` : `WHERE ${userTypeExclusionVendorList}`}
            ORDER BY c.created_at DESC
            LIMIT ${pageSize} OFFSET ${offset}
        `;
        const onboardingIncompleteDataQuery = `${onboardingListSelect}
            FROM ru_direct_selling_agents c
            LEFT JOIN ru_user_onboarding_steps x${stepsForceIndex}
              ON x.dsa_id = c.dsa_id
             AND x.step = 'dsa_agreement'
             AND x.status = 1
            LEFT JOIN ru_dsa_kyc_data k ON k.dsa_id = c.dsa_id
            LEFT JOIN ru_direct_selling_agents p ON p.dsa_mobile_number = c.partner_code
            WHERE x.dsa_id IS NULL
            AND ${userTypeExclusionVendorList}
            ${scopeCond ? `AND (${scopeCond})` : ''}${onboardingWhereAddition}
            ORDER BY c.created_at DESC
            LIMIT ${pageSize} OFFSET ${offset}
        `;
        const onboardingListDataQuery = filterType === 'onboarding_complete' ? onboardingCompleteDataQuery : onboardingIncompleteDataQuery;
        const fullDataQuery = `
            SELECT 
                c.dsa_id,
                c.full_name as vendor_name,
                p.full_name as partner_name,
                k.permanent_account_number as pan_number,
                k.netsuite_vendor_id as ns_vendor_id,
                c.dsa_mobile_number as mobile,
                c.email_address as email,
                c.hierarchy_crm as crm_hierarchy,
                k.ns_hierarchy,
                c.business_mode,
                c.global_payouts_percentage,
                c.assigning_payout_percentage,
                c.is_deleted,
                ${bankAccountSelect},
                CASE 
                    WHEN (c.assigning_payout_percentage IS NOT NULL AND c.assigning_payout_percentage != '')
                    THEN 'Set'
                    ELSE 'Missing'
                END as payout_capping,
                CASE 
                    WHEN (c.global_payouts_percentage IS NOT NULL AND c.global_payouts_percentage != '')
                    THEN 'Set'
                    ELSE 'Missing'
                END as global_payout,
                COALESCE(${onboardingPercentageExpr}, 0) as onboarding_percentage,
                ${dataQualityStatusSelect},
                k.is_permanent_account_number_verified AS authbridge_pan_verification_status
            FROM ru_direct_selling_agents c
            LEFT JOIN ru_dsa_kyc_data k ON c.dsa_id = k.dsa_id
            LEFT JOIN ru_direct_selling_agents p ON c.partner_code = p.dsa_mobile_number
            ${onboardingFilterJoinFragment}
            ${bankJoinFragment}
            ${whereClause}
            ${orderBy}
            LIMIT ${pageSize} OFFSET ${offset}
        `;
        const dataQuery = isOnboardingList ? onboardingListDataQuery : fullDataQuery;

        let vendors = await _db2.query(dataQuery, {
            replacements: bindParams,
            type: QueryTypes.SELECT
        });

        // Ensure bank_account, payout_capping, global_payout are always present for onboarding complete/incomplete (same as other filters)
        if (isOnboardingList && Array.isArray(vendors)) {
            vendors = vendors.map((row) => ({
                ...row,
                bank_account: row.bank_account ?? 'Missing',
                payout_capping: row.payout_capping ?? 'Missing',
                global_payout: row.global_payout ?? 'Missing'
            }));
        }

        return {
            data: vendors,
            totalCount: totalCount,
            pageNumber: pageNumber,
            pageSize: pageSize,
            totalPages: Math.ceil(totalCount / pageSize)
        };
    } catch (error) {
        console.error('Error in getVendorDashboardList:', error);
        throw error;
    }
};

const buildSqlClauseFromFilterModel = (filterModel, fieldMapping, key = 'default') => {
    const bindParams = [];
    if (!filterModel?.items?.length) {
        return { clause: '', bindParams };
    }
    const operatorHandlers = CustomOperatorHandlers();
    const whereFilterQuery = CreateWhereQueryFilter(
        { items: filterModel.items, logicOperator: filterModel.logicOperator || 'and' },
        fieldMapping,
        operatorHandlers,
        key
    );
    if (!whereFilterQuery?.length) {
        return { clause: '', bindParams };
    }
    const logicOperator = (filterModel.logicOperator || 'and').toUpperCase();
    const filterConditions = [];
    for (let i = 0; i < whereFilterQuery.length; i++) {
        const [field, operator, value] = whereFilterQuery[i];
        if (Array.isArray(value) && value.length > 0) {
            filterConditions.push(`${field} ${operator} (${value.map(() => '?').join(',')})`);
            bindParams.push(...value);
        } else if (value !== null && value !== undefined && value !== '') {
            filterConditions.push(`${field} ${operator} ?`);
            bindParams.push(value);
        } else {
            filterConditions.push(`${field} ${operator}`);
        }
    }
    const clause = filterConditions.length === 1
        ? filterConditions[0]
        : `(${filterConditions.join(` ${logicOperator} `)})`;
    return { clause, bindParams };
};

const buildVendorBranchScopeSql = (dsaId, materializedPath, skipHierarchy) => {
    const userTypeExclusion = `(c.user_type IS NULL OR LOWER(TRIM(c.user_type)) NOT IN ('biller', 'payee'))`;
    const branchCodeFilter = `(k.branch_code IS NOT NULL AND TRIM(k.branch_code) != '')`;

    if (skipHierarchy) {
        return { scopeCond: '', userTypeExclusion, branchCodeFilter };
    }

    const conditions = [];
    if (materializedPath) {
        const sanitizedPath = materializedPath.replace(/'/g, "\\'");
        conditions.push(`c.materialized_path LIKE '${sanitizedPath}%'`);
    }
    if (dsaId) {
        const sanitizedDsaId = String(dsaId).replace(/'/g, "\\'");
        conditions.push(`c.materialized_path LIKE '%${sanitizedDsaId}%'`);
    }

    const scopeCond = conditions.length > 0 ? `(${conditions.join(' OR ')})` : '1=0';
    return { scopeCond, userTypeExclusion, branchCodeFilter };
};

const getVendorBranchSummaryMetrics = async (dsaId, materializedPath, skipHierarchy = false) => {
    const { scopeCond, userTypeExclusion, branchCodeFilter } = buildVendorBranchScopeSql(dsaId, materializedPath, skipHierarchy);
    const whereParts = [branchCodeFilter, userTypeExclusion];
    if (scopeCond) whereParts.unshift(scopeCond);

    const query = `
        SELECT COUNT(DISTINCT k.branch_code) AS totalUniqueBranches
        FROM ru_direct_selling_agents c
        INNER JOIN ru_dsa_kyc_data k ON k.dsa_id = c.dsa_id
        WHERE ${whereParts.join(' AND ')}
    `;

    const rows = await _db2.query(query, { type: QueryTypes.SELECT });
    return { totalUniqueBranches: parseInt(rows[0]?.totalUniqueBranches, 10) || 0 };
};

const getVendorBranchList = async (dsaId, materializedPath, skipHierarchy = false, options = {}) => {
    const pageNumber = options.pageNumber != null ? parseInt(options.pageNumber, 10) : 0;
    const pageSize = options.pageSize != null ? parseInt(options.pageSize, 10) : 10;
    const sortBy = options.sortBy === 'total_dsa' ? 'total_dsa' : 'branch_code';
    const sortDirection = String(options.sortDirection || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const offset = pageNumber * pageSize;
    const filterModel = options.filterModel || { items: [], logicOperator: 'and' };

    const { scopeCond, userTypeExclusion, branchCodeFilter } = buildVendorBranchScopeSql(dsaId, materializedPath, skipHierarchy);
    const whereParts = [branchCodeFilter, userTypeExclusion];
    if (scopeCond) whereParts.unshift(scopeCond);
    const innerWhere = `WHERE ${whereParts.join(' AND ')}`;

    const { clause: filterClause, bindParams: filterBindParams } = buildSqlClauseFromFilterModel(
        filterModel,
        getVendorBranchListApiFieldMapping,
        'vendor_branch_list'
    );
    const outerWhere = filterClause ? `WHERE ${filterClause}` : '';

    const branchAggSubquery = `
        SELECT
            k.branch_code AS branch_code,
            k.branch_code AS branch_name,
            COUNT(DISTINCT c.dsa_id) AS total_dsa
        FROM ru_direct_selling_agents c
        INNER JOIN ru_dsa_kyc_data k ON k.dsa_id = c.dsa_id
        ${innerWhere}
        GROUP BY k.branch_code
    `;

    const countQuery = `
        SELECT COUNT(*) AS total FROM (
            ${branchAggSubquery}
        ) branch_agg
        ${outerWhere}
    `;
    const countResult = await _db2.query(countQuery, {
        replacements: filterBindParams,
        type: QueryTypes.SELECT
    });
    const totalCount = parseInt(countResult[0]?.total, 10) || 0;

    const dataQuery = `
        SELECT branch_agg.branch_code, branch_agg.branch_name, branch_agg.total_dsa
        FROM (
            ${branchAggSubquery}
        ) branch_agg
        ${outerWhere}
        ORDER BY branch_agg.${sortBy} ${sortDirection}
        LIMIT ${pageSize} OFFSET ${offset}
    `;
    const data = await _db2.query(dataQuery, {
        replacements: filterBindParams,
        type: QueryTypes.SELECT
    });

    return {
        data,
        totalCount,
        pageNumber,
        pageSize,
        totalPages: pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0
    };
};

const getVendorBranchDsaList = async (dsaId, materializedPath, skipHierarchy = false, options = {}) => {
    const branchCode = String(options.branchCode || '').trim();
    if (!branchCode) {
        throw new Error('branchCode is required');
    }

    const pageNumber = options.pageNumber != null ? parseInt(options.pageNumber, 10) : 0;
    const pageSize = options.pageSize != null ? parseInt(options.pageSize, 10) : 10;
    const sortFieldMap = {
        vendor_name: 'c.full_name',
        mobile: 'c.dsa_mobile_number',
        pan_number: 'k.permanent_account_number',
        vendor_code: 'k.vendor_code',
        partner_name: 'p.full_name',
        email: 'c.email_address',
        crm_hierarchy: 'c.hierarchy_crm',
        ns_hierarchy: 'k.ns_hierarchy',
        branch_code: 'k.branch_code'
    };
    const sortBy = sortFieldMap[options.sortBy] || sortFieldMap.vendor_name;
    const sortDirection = String(options.sortDirection || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const offset = pageNumber * pageSize;

    const filterModel = options.filterModel || { items: [], logicOperator: 'and' };

    const { scopeCond, userTypeExclusion, branchCodeFilter } = buildVendorBranchScopeSql(dsaId, materializedPath, skipHierarchy);
    const whereParts = [branchCodeFilter, userTypeExclusion, 'k.branch_code = ?'];
    if (scopeCond) whereParts.unshift(scopeCond);

    const { clause: filterClause, bindParams: filterBindParams } = buildSqlClauseFromFilterModel(
        filterModel,
        getVendorDashboardListApiFieldMapping,
        'vendor_branch_dsa_list'
    );
    if (filterClause) {
        whereParts.push(`(${filterClause})`);
    }
    const whereClause = `WHERE ${whereParts.join(' AND ')}`;
    const replacements = [branchCode, ...filterBindParams];

    const countQuery = `
        SELECT COUNT(DISTINCT c.dsa_id) AS total
        FROM ru_direct_selling_agents c
        INNER JOIN ru_dsa_kyc_data k ON k.dsa_id = c.dsa_id
        LEFT JOIN ru_direct_selling_agents p ON c.partner_code = p.dsa_mobile_number
        LEFT JOIN ru_dsa_kyc_data pk ON pk.dsa_id = p.dsa_id
        ${whereClause}
    `;
    const countResult = await _db2.query(countQuery, { replacements, type: QueryTypes.SELECT });
    const totalCount = parseInt(countResult[0]?.total, 10) || 0;

    const dataQuery = `
        SELECT
            c.dsa_id,
            c.dsa_id AS customer_id,
            c.full_name AS vendor_name,
            c.dsa_mobile_number AS mobile,
            c.hierarchy_crm AS crm_hierarchy,
            k.permanent_account_number AS pan_number,
            k.vendor_code,
            k.branch_code,
            p.full_name AS partner_name,
            pk.permanent_account_number AS partner_pan
        FROM ru_direct_selling_agents c
        INNER JOIN ru_dsa_kyc_data k ON k.dsa_id = c.dsa_id
        LEFT JOIN ru_direct_selling_agents p ON c.partner_code = p.dsa_mobile_number
        LEFT JOIN ru_dsa_kyc_data pk ON pk.dsa_id = p.dsa_id
        ${whereClause}
        ORDER BY ${sortBy} ${sortDirection}
        LIMIT ${pageSize} OFFSET ${offset}
    `;
    const data = await _db2.query(dataQuery, { replacements, type: QueryTypes.SELECT });

    return {
        data,
        totalCount,
        pageNumber,
        pageSize,
        totalPages: pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0
    };
};

/**
 * Header/tab counts for vendor dashboard — same scope as getVendorDashboardList (hierarchy + optional nodeId subtree).
 * Each count uses the same predicate as the corresponding filterType on the list API (categories can overlap).
 */
const getVendorDashboardListCounts = async (dsaId, materializedPath, skipHierarchy = false, options = {}) => {
    try {
        const { nodeId = null } = options;

        let hierarchyCondition = '';
        if (!skipHierarchy && (dsaId || materializedPath)) {
            const conditions = [];
            if (materializedPath) {
                const sanitizedPath = materializedPath.replace(/'/g, "\\'");
                conditions.push(`c.materialized_path LIKE '${sanitizedPath}%'`);
            }
            if (dsaId) {
                const sanitizedDsaId = dsaId.replace(/'/g, "\\'");
                conditions.push(`c.materialized_path LIKE '%${sanitizedDsaId}%'`);
            }
            if (conditions.length > 0) {
                hierarchyCondition = `WHERE (${conditions.join(' OR ')})`;
            }
        }

        let subtreeCondition = '';
        if (nodeId && String(nodeId).trim() !== '') {
            const nId = String(nodeId).trim();
            const sanitizedNodeId = nId.replace(/'/g, "\\'");
            const escapeLike = (s) => String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/'/g, "\\'");
            const nodeIdForLike = escapeLike(nId);
            subtreeCondition = `(c.dsa_id = '${sanitizedNodeId}' OR c.materialized_path LIKE '%${nodeIdForLike}%')`;
        }

        const userTypeExclusionVendorList = `(c.user_type IS NULL OR LOWER(TRIM(c.user_type)) NOT IN ('biller', 'payee'))`;
        const hierarchyCondOnly = hierarchyCondition ? hierarchyCondition.replace(/^WHERE\s+/i, '').trim() : '';
        const scopeCond = subtreeCondition
            ? (hierarchyCondOnly ? `(${hierarchyCondOnly}) AND (${subtreeCondition})` : subtreeCondition)
            : hierarchyCondOnly;

        const baseWhere = scopeCond
            ? `WHERE (${scopeCond}) AND ${userTypeExclusionVendorList}`
            : `WHERE ${userTypeExclusionVendorList}`;

        const onboardingDoneExists = `EXISTS (SELECT 1 FROM ru_user_onboarding_steps x WHERE x.dsa_id = c.dsa_id AND x.step = 'dsa_agreement' AND x.status = 1)`;
        const onboardingMissingExists = `NOT EXISTS (SELECT 1 FROM ru_user_onboarding_steps x WHERE x.dsa_id = c.dsa_id AND x.step = 'dsa_agreement' AND x.status = 1)`;
        const junkContactSql = `(
                c.dsa_mobile_number REGEXP '^[0-9]{10}$' = 0 
                OR c.email_address REGEXP '^[^@]+@[^@]+\\\\.[^@]+$' = 0
                OR (
                    k.permanent_account_number IS NULL 
                    OR k.permanent_account_number = ''
                    OR (
                        k.permanent_account_number NOT LIKE '%X%'
                        AND k.permanent_account_number REGEXP '^[A-Z]{5}[0-9]{4}[A-Z]$' = 0
                        AND k.permanent_account_number REGEXP '^[A-Z]{3}P[A-Z][0-9]{4}[A-Z]$' = 0
                        AND k.permanent_account_number REGEXP '^[A-Z]{3}[CFHATBLJGP][A-Z][0-9]{4}[A-Z]$' = 0
                    )
                )
            )`;

        // AuthBridge: company partners → ru_companies.is_pan_verified; otherwise → kyc.is_permanent_account_number_verified (same as lead authbridge_pan_verification_status).
        const authbridgeVerifiedExpr = `CASE
            WHEN LOWER(TRIM(COALESCE(c.user_type, ''))) = 'company' AND c.company_id IS NOT NULL
            THEN COALESCE(rc.is_pan_verified, 0)
            ELSE COALESCE(k.is_permanent_account_number_verified, 0)
        END`;

        const countsQuery = `
            SELECT 
                COUNT(*) AS all_count,
                SUM(CASE WHEN ${onboardingDoneExists} THEN 1 ELSE 0 END) AS onboarding_complete,
                SUM(CASE WHEN ${onboardingMissingExists} THEN 1 ELSE 0 END) AS missing_onboarding,
                SUM(CASE WHEN ${junkContactSql} THEN 1 ELSE 0 END) AS junk_contact,
                SUM(CASE WHEN (c.global_payouts_percentage IS NULL OR c.global_payouts_percentage = '') THEN 1 ELSE 0 END) AS payout_not_set,
                SUM(CASE WHEN (c.assigning_payout_percentage IS NULL OR c.assigning_payout_percentage = '') THEN 1 ELSE 0 END) AS capping_not_set,
                SUM(CASE WHEN ba.dsa_id IS NULL THEN 1 ELSE 0 END) AS bank_account_missing,
                SUM(CASE WHEN (k.ns_hierarchy IS NULL OR k.ns_hierarchy = '' OR k.netsuite_vendor_id IS NULL OR k.netsuite_vendor_id = '') THEN 1 ELSE 0 END) AS ns_issues,
                SUM(CASE WHEN (${authbridgeVerifiedExpr}) = 0 THEN 1 ELSE 0 END) AS authbridge_not_verified
            FROM ru_direct_selling_agents c
            LEFT JOIN ru_dsa_kyc_data k ON c.dsa_id = k.dsa_id
            LEFT JOIN ru_companies rc ON rc.company_id = c.company_id
            LEFT JOIN (
                SELECT DISTINCT dsa_id FROM ru_dsa_bank_accounts 
                WHERE account_number IS NOT NULL AND account_number != ''
            ) ba ON c.dsa_id = ba.dsa_id
            ${baseWhere}
        `;

        const row = (await _db2.query(countsQuery, { type: QueryTypes.SELECT }))[0] || {};

        return {
            all: parseInt(row.all_count, 10) || 0,
            onboarding_complete: parseInt(row.onboarding_complete, 10) || 0,
            missing_onboarding: parseInt(row.missing_onboarding, 10) || 0,
            junk_contact: parseInt(row.junk_contact, 10) || 0,
            payout_not_set: parseInt(row.payout_not_set, 10) || 0,
            capping_not_set: parseInt(row.capping_not_set, 10) || 0,
            bank_account_missing: parseInt(row.bank_account_missing, 10) || 0,
            ns_issues: parseInt(row.ns_issues, 10) || 0,
            authbridge_not_verified: parseInt(row.authbridge_not_verified, 10) || 0
        };
    } catch (error) {
        console.error('Error in getVendorDashboardListCounts:', error);
        throw error;
    }
};

/**
 * Get Vendor Dashboard details for a single DSA by dsa_id (B2B).
 * Returns the same fields as getVendorDashboardList for one DSA, only if the DSA is in the caller's hierarchy.
 * @param {string} dsaId - Requesting DSA ID (for hierarchy)
 * @param {string} materializedPath - Requesting DSA materialized path (for hierarchy)
 * @param {string} targetDsaId - DSA ID for which to fetch vendor dashboard details
 */
const getVendorDashboardByDsaId = async (dsaId, materializedPath, targetDsaId) => {
    try {
        if (!targetDsaId) {
            return { data: null };
        }

        let hierarchyCondition = '';
        if (dsaId || materializedPath) {
            const conditions = [];
            if (materializedPath) {
                const sanitizedPath = materializedPath.replace(/'/g, "\\'");
                conditions.push(`c.materialized_path LIKE '${sanitizedPath}%'`);
            }
            if (dsaId) {
                const sanitizedDsaId = dsaId.replace(/'/g, "\\'");
                conditions.push(`c.materialized_path LIKE '%${sanitizedDsaId}%'`);
            }
            if (conditions.length > 0) {
                hierarchyCondition = `AND (${conditions.join(' OR ')})`;
            }
        }

        const stepsForceIndex = process.env.ENVIRONMENT === 'dev' ? '' : ' FORCE INDEX (idx_steps_dsa_step_status)';
        const onboardingPercentageExpr = `ROUND(
            (
                SELECT COUNT(DISTINCT s.step)
                FROM ru_user_onboarding_steps s
                WHERE s.dsa_id = c.dsa_id
                  AND s.status = 1
                  AND s.step IN (
                      'lead_generation',
                      'dsa_consent',
                      'basic_details',
                      'address',
                      'kyc',
                      'dsa_agreement'
                  )
            ) * 100.0 / 6,
        2)`;
        const bankJoinFragment = `
            LEFT JOIN (SELECT DISTINCT dsa_id FROM ru_dsa_bank_accounts WHERE account_number IS NOT NULL AND account_number != '') ba ON c.dsa_id = ba.dsa_id`;
        const dataQualityStatusSelect = `CASE 
            WHEN (
                c.dsa_mobile_number REGEXP '^[0-9]{10}$' = 0 
                OR c.email_address REGEXP '^[^@]+@[^@]+\\\\.[^@]+$' = 0
                OR (k.permanent_account_number IS NULL OR k.permanent_account_number = '' OR (
                    k.permanent_account_number NOT LIKE '%X%'
                    AND k.permanent_account_number REGEXP '^[A-Z]{5}[0-9]{4}[A-Z]$' = 0
                    AND k.permanent_account_number REGEXP '^[A-Z]{3}P[A-Z][0-9]{4}[A-Z]$' = 0
                    AND k.permanent_account_number REGEXP '^[A-Z]{3}[CFHATBLJGP][A-Z][0-9]{4}[A-Z]$' = 0
                ))
                OR (c.global_payouts_percentage IS NULL OR c.global_payouts_percentage = '')
                OR (c.assigning_payout_percentage IS NULL OR c.assigning_payout_percentage = '')
                OR ba.dsa_id IS NULL
                OR (k.ns_hierarchy IS NULL OR k.ns_hierarchy = '' OR k.netsuite_vendor_id IS NULL OR k.netsuite_vendor_id = '')
            )
            THEN 'Issues'
            ELSE 'OK'
        END as data_quality_status`;
        const bankAccountSelect = `CASE WHEN ba.dsa_id IS NOT NULL THEN 'Added' ELSE 'Missing' END as bank_account`;

        const singleDsaQuery = `
            SELECT 
                c.dsa_id,
                c.full_name as vendor_name,
                p.full_name as partner_name,
                k.permanent_account_number as pan_number,
                k.netsuite_vendor_id as ns_vendor_id,
                c.dsa_mobile_number as mobile,
                c.email_address as email,
                c.hierarchy_crm as crm_hierarchy,
                k.ns_hierarchy,
                c.business_mode,
                c.global_payouts_percentage,
                c.assigning_payout_percentage,
                c.is_deleted,
                ${bankAccountSelect},
                CASE 
                    WHEN (c.assigning_payout_percentage IS NOT NULL AND c.assigning_payout_percentage != '')
                    THEN 'Set'
                    ELSE 'Missing'
                END as payout_capping,
                CASE 
                    WHEN (c.global_payouts_percentage IS NOT NULL AND c.global_payouts_percentage != '')
                    THEN 'Set'
                    ELSE 'Missing'
                END as global_payout,
                COALESCE(${onboardingPercentageExpr}, 0) as onboarding_percentage,
                ${dataQualityStatusSelect},
                k.is_permanent_account_number_verified AS authbridge_pan_verification_status
            FROM ru_direct_selling_agents c
            LEFT JOIN ru_dsa_kyc_data k ON c.dsa_id = k.dsa_id
            LEFT JOIN ru_direct_selling_agents p ON c.partner_code = p.dsa_mobile_number
            ${bankJoinFragment}
            WHERE c.dsa_id = ?
            AND (c.user_type IS NULL OR LOWER(TRIM(c.user_type)) NOT IN ('biller', 'payee'))
            ${hierarchyCondition}
        `;

        const rows = await _db2.query(singleDsaQuery, {
            replacements: [targetDsaId],
            type: QueryTypes.SELECT
        });

        const data = rows && rows[0] ? rows[0] : null;
        return { data };
    } catch (error) {
        console.error('Error in getVendorDashboardByDsaId:', error);
        throw error;
    }
};


const parseCustomerFullName = (fullName) => {
    if (fullName == null || typeof fullName !== 'string') return null;
    const trimmed = fullName.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    if (parts.length === 1) {
        return { first_name: parts[0], middle_name: null, last_name: null, full_name: trimmed };
    }
    if (parts.length === 2) {
        return { first_name: parts[0], middle_name: null, last_name: parts[1], full_name: trimmed };
    }
    // 3+ parts: first, last = last part, middle = everything in between (can be multiple words)
    const first_name = parts[0];
    const last_name = parts[parts.length - 1];
    const middleParts = parts.slice(1, -1);
    const middle_name = middleParts.length > 0 ? middleParts.join(' ').trim() : null;
    return { first_name, middle_name: middle_name || null, last_name, full_name: trimmed };
};

const upsertReconciliationMetaDates = async (fresh_lead_id, { expected_billing_month, cc_email_date }) => {
    const metaUpdates = [];
    if (expected_billing_month) {
        metaUpdates.push({ column: 'expected_billing_month', value: deriveBillingMonthFromIso(expected_billing_month) });
    }
    if (cc_email_date) {
        metaUpdates.push({
            column: 'cc_email_date',
            value: new Date(cc_email_date).toISOString().split('T')[0],
        });
    }
    if (!metaUpdates.length) return;

    const metaRows = await _db2.query(
        `SELECT id FROM ru_fresh_lead_claims_meta WHERE fresh_lead_id = ? LIMIT 1`,
        { replacements: [fresh_lead_id], type: QueryTypes.SELECT }
    );
    const now = new Date();

    if (metaRows?.length) {
        const setClauses = metaUpdates.map((item) => `${item.column} = ?`);
        const bindParams = [...metaUpdates.map((item) => item.value), now, fresh_lead_id];
        await _db2.query(
            `UPDATE ru_fresh_lead_claims_meta SET ${setClauses.join(', ')}, updated_at = ? WHERE fresh_lead_id = ?`,
            { replacements: bindParams, type: QueryTypes.UPDATE }
        );
        return;
    }

    const columns = ['fresh_lead_id', ...metaUpdates.map((item) => item.column), 'created_at', 'updated_at'];
    const placeholders = columns.map(() => '?').join(', ');
    const bindParams = [fresh_lead_id, ...metaUpdates.map((item) => item.value), now, now];
    await _db2.query(
        `INSERT INTO ru_fresh_lead_claims_meta (${columns.join(', ')}) VALUES (${placeholders})`,
        { replacements: bindParams, type: QueryTypes.INSERT }
    );
};

const updateLeadByReconciliation = async (payload) => {
    const { fresh_lead_id, expected_billing_month, cc_email_date, ...fields } = payload;

    const warnings = [];

    const hasDisbDate = 'disbursement_date' in fields && fields.disbursement_date;
    const hasLoanNumbers = ('loan_number' in fields && fields.loan_number) || ('application_no' in fields && fields.application_no);

    if (hasDisbDate || hasLoanNumbers) {
        const [currentLead] = await _db2.query(
            `SELECT netsuite_bank_id, netsuite_product_id, netsuite_vendor_id, loan_reference_id, loan_apac_ref_los_number,
                    customer_first_name, customer_last_name, city, dsa_id, business_categories,
                    disbursement_amount, disbursement_date_iso
             FROM ru_fresh_lead_claims WHERE fresh_lead_id = ? LIMIT 1`,
            { replacements: [fresh_lead_id], type: QueryTypes.SELECT }
        );

        if (currentLead) {
            // Disbursement date check disabled: this data comes from banker confirmation emails, not manual entry
            // if (hasDisbDate) {
            //     const dateCheck = validateDisbursementDate(fields.disbursement_date);
            //     if (!dateCheck.isValid) {
            //         return { success: false, message: dateCheck.message, warnings: [] };
            //     }
            // }

            if (hasLoanNumbers) {
                // Only validate the field(s) actually being updated in this request — not the
                // row's existing/previous values, which were already valid when first saved.
                const { getLeadFormField } = require('../v1/controllers/mongo-db');
                const regexPattern = await getLeadFormField(
                    String(currentLead.netsuite_bank_id || ''),
                    String(currentLead.netsuite_product_id || '')
                );
                const { error } = checkIfLoanAndApacNumberIsValid(regexPattern, fields.loan_number, fields.application_no);
                if (error) {
                    // Hard stop: an invalid loan/APAC number must block the whole update (and,
                    // for the automated flow, stop AI verification), not just skip that field.
                    return { success: false, message: error, warnings: [] };
                }
            }
        }
    }

    // Map reconciliation payload keys to DB column names.
    // loan_amount from reconciliation is always disbursement_amount in the DB.
    // loan_type is intentionally excluded — reconciliation never updates it.
    const fieldMapping = {
        'loan_number': 'loan_reference_id',
        'application_no': 'loan_apac_ref_los_number',
        'customer_company_name': 'customer_company_name',
        'disbursement_date': 'disbursement_date',
        'loan_amount': 'disbursement_amount',
        'netsuite_bank_id': 'netsuite_bank_id',
        'netsuite_product_id': 'netsuite_product_id',
        'bank_name': 'bank_name',
        'product_name': 'product_name',
        'city': 'city',
        'claim_confirmation': 'claim_confirmation',
        'fresh_lead_status_id': 'fresh_lead_status_id',
        'is_banker_file_processed': 'is_banker_file_processed'
    };

    const setClauses = [];
    const bindParams = [];

    for (const [fieldName, value] of Object.entries(fields)) {
        if (fieldName !== 'claim_confirmation' && fieldName !== 'fresh_lead_status_id' && value === '') continue;

        if (fieldName === 'customer_name') {
            const parsed = parseCustomerFullName(value);
            if (parsed) {
                setClauses.push('customer_full_name = ?');
                bindParams.push(parsed.full_name);
                setClauses.push('customer_first_name = ?');
                bindParams.push(parsed.first_name);
                setClauses.push('customer_middle_name = ?');
                bindParams.push(parsed.middle_name);
                setClauses.push('customer_last_name = ?');
                bindParams.push(parsed.last_name ?? '');
            }
            continue;
        }

        if (fieldName === 'disbursement_date') {
            setClauses.push('disbursement_date = ?');
            bindParams.push(formatDateIndianFormat(value));
            const disbursement_date_iso = toIsoDateIST(value);
            setClauses.push('disbursement_date_iso = ?');
            bindParams.push(disbursement_date_iso);
            const claim_month = deriveClaimMonthFromDisbDate(disbursement_date_iso);
            setClauses.push('claim_month = ?');
            bindParams.push(claim_month);
            continue;
        }

        const dbColumn = fieldMapping[fieldName];
        if (dbColumn) {
            setClauses.push(`${dbColumn} = ?`);
            bindParams.push(value ?? null);
        }
    }

    const hasMetaUpdates = Boolean(expected_billing_month) || Boolean(cc_email_date);

    if (setClauses.length === 0 && !hasMetaUpdates) {
        return { success: false, message: 'No valid fields to update', warnings };
    }

    if (setClauses.length > 0) {
        setClauses.push('updated_at = ?');
        bindParams.push(new Date());
        bindParams.push(fresh_lead_id);

        const query = `UPDATE ru_fresh_lead_claims SET ${setClauses.join(', ')} WHERE fresh_lead_id = ?`;
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    }

    if (hasMetaUpdates) {
        await upsertReconciliationMetaDates(fresh_lead_id, { expected_billing_month, cc_email_date });
    }

    const statusField = fields.fresh_lead_status_id;
    if (statusField !== undefined && statusField !== null && Number(statusField) === 0) {
        await syncMetaOnStatusZero(fresh_lead_id);
    }

    return { success: true, message: 'Fields updated successfully', warnings };
};

const autoProgressLeadFromReconciliation = async (fresh_lead_id, case_reconciliation) => {
    // Step 1: PDD guard — n8n always sends true/false or 1/0
    const pddRaw = case_reconciliation?.pdd_status;
    const pddOk = pddRaw === true || pddRaw === 1 || String(pddRaw) === 'true' || String(pddRaw) === '1';
    const pddDateOk = !!case_reconciliation?.pdd_clearing_date;
    if (!pddOk || !pddDateOk) {
        logger.info(`[AutoReconciliation] PDD conditions not met for lead ${fresh_lead_id}, skipping auto-progress`);
        return;
    }
    // Step 2: Fetch current lead data (findForEdit joins the meta table too).
    const prevDataResult = await claimRepository.findForEdit(fresh_lead_id);
    const prevData = prevDataResult?.records;
    if (!prevData) {
        logger.info(`[AutoReconciliation] Lead ${fresh_lead_id} not found, skipping auto-progress`);
        return;
    }

    // Step 3: Bank + Product name must match 100% (case-insensitive)
    const normalize = (s) => String(s || '').toLowerCase().trim();
    if (normalize(prevData.bank_name) !== normalize(case_reconciliation.bank_name) ||
        normalize(prevData.product_name) !== normalize(case_reconciliation.product_name)) {
        logger.info(`[AutoReconciliation] Bank/Product mismatch for lead ${fresh_lead_id}, skipping auto-progress`);
        return;
    }

    // Step 4: Discrepancy checks — loan/apac number missing or invalid, disbursement date invalid,
    // or PDD clearing date stale (before the 1st of last month). Any failure means the AI
    // reconciliation data can't be trusted, so nothing is written and the status is left untouched.
    const discrepancyCheck = await validateReconciliationDiscrepancies({
        loan_number: case_reconciliation.loan_number,
        application_no: case_reconciliation.application_number,
        disbursement_date: case_reconciliation.disbursal_date,
        pdd_clearing_date: case_reconciliation.pdd_clearing_date,
        netsuite_bank_id: prevData.bank_id,
        netsuite_product_id: prevData.netsuite_product_id,
    });
    if (!discrepancyCheck.isValid) {
        logger.info(`[AutoReconciliation] Discrepancy for lead ${fresh_lead_id}: ${discrepancyCheck.message}, skipping auto-progress`);
        return;
    }

    // Step 4b: Bank category override — CAT C/CAT D combinations always land as a custom-remark
    // claim (not a plain AI Verified) so a human sees why: CAT D = payment routed through another
    // payment (Payment Against Payment), CAT C = payment against a bill rather than disbursal.
    // Manual-review banks (SBI) take precedence: the CC team must verify documents, so the case
    // lands as a custom remark and is NOT marked banker-processed.
    const bankCategory = await getBankCategoryByBankProduct(prevData.bank_id, prevData.netsuite_product_id);

    let claimConfirmationValue = 'AI Verified';
    let auditRemarkValue = null;
    let bankerFileProcessed = true;
    if (isManualReviewBank(prevData.bank_id)) {
        claimConfirmationValue = 'Custom remark';
        auditRemarkValue = 'Pending for manual review';
        bankerFileProcessed = false;
    } else if (bankCategory === 'cat d') {
        claimConfirmationValue = 'Custom remark';
        auditRemarkValue = 'AI Verified: Payment Against Payment';
    } else if (bankCategory === 'cat c') {
        claimConfirmationValue = 'Custom remark';
        auditRemarkValue = 'AI Verified: Payment Against Bill';
    }

    // Step 5: Build payload using frontend payload keys — updateLeadByReconciliation handles DB mapping
    // Email template: "Application No." = loan_apac_ref_los_number, "Loan No." = loan_reference_id
    // case_reconciliation.application_number → payload.application_no → DB: loan_apac_ref_los_number
    // case_reconciliation.loan_number        → payload.loan_number    → DB: loan_reference_id
    const pddDate = case_reconciliation.pdd_clearing_date;
    const billingSourceDate = pddDate || case_reconciliation.disbursal_date;
    const billingMonth = billingSourceDate ? `${billingSourceDate.slice(0, 7)}-01` : null;

    const payload = { fresh_lead_id, claim_confirmation: claimConfirmationValue };
    if (case_reconciliation.application_number) payload.application_no = case_reconciliation.application_number;
    if (case_reconciliation.loan_number) payload.loan_number = case_reconciliation.loan_number;
    if (case_reconciliation.customer_name) payload.customer_name = case_reconciliation.customer_name;
    if (case_reconciliation.customer_company_name) payload.customer_company_name = case_reconciliation.customer_company_name;
    if (case_reconciliation.disbursal_date) payload.disbursement_date = case_reconciliation.disbursal_date;
    if (case_reconciliation.loan_amount) payload.loan_amount = case_reconciliation.loan_amount;
    if (case_reconciliation.city) payload.city = case_reconciliation.city;
    if (billingMonth) payload.expected_billing_month = billingMonth;
    if (case_reconciliation.cc_email_date) payload.cc_email_date = case_reconciliation.cc_email_date;

    const updateResult = await updateLeadByReconciliation(payload);
    if (!updateResult.success) {
        logger.warn(`[AutoReconciliation] Update blocked for lead ${fresh_lead_id}: ${updateResult.message}`);
        return;
    }
    if (updateResult.warnings?.length) {
        logger.warn(`[AutoReconciliation] Warnings for lead ${fresh_lead_id}: ${updateResult.warnings.join('; ')}`);
    }

    if (auditRemarkValue) {
        // Lazy require to avoid a circular dependency (lead-services.js requires this file)
        const { updateLeadFormRemark } = require('./lead-services');
        const remarkResult = await updateLeadFormRemark(fresh_lead_id, 'audit_remark', auditRemarkValue, 'ru_fresh_lead_claims_meta');
        if (!remarkResult?.success) {
            logger.warn(`[AutoReconciliation] Failed to set audit_remark for lead ${fresh_lead_id}: ${remarkResult?.message}`);
        }
    }

    // Step 6: Move to pending via centralized checks (loan/APAC, status, banker file, meta sync, audit log)
    // banker_file_processed is true for a plain AI Verified match, and also true for the CAT C/D
    // override (claim_confirmation = 'Custom remark') — CAT C/D still represents a completed
    // automated verification, just with a human-readable reason attached via audit_remark.
    // It is false for manual-review banks, which still need CC team document verification.
    const moveResult = await moveToPendingLeadForm([fresh_lead_id], SYSTEM_BOT_UUID, undefined, bankerFileProcessed);
    if (moveResult && typeof moveResult === 'object' && moveResult.status === false) {
        logger.warn(`[AutoReconciliation] Move to pending blocked for lead ${fresh_lead_id}: ${moveResult.errorMsg}`);
        return;
    }

    // Step 7: Audit log — compare prevData vs newData using the same findForEdit shape
    const newDataResult = await claimRepository.findForEdit(fresh_lead_id);
    const newData = newDataResult?.records;
    if (prevData && newData) {
        const trackFields = [
            'loan_number', 'apac_ref_los_number', 'full_name', 'company_name',
            'disbursement_date', 'disbursement_amount', 'city', 'expected_billing_month',
            'cc_email_date', 'claim_confirmation',
        ];
        const prevSnapshot = Object.fromEntries(trackFields.map(f => [f, prevData[f] ?? null]));
        const newSnapshot = Object.fromEntries(trackFields.map(f => [f, newData[f] ?? null]));
        const difference = jsonDifference(prevSnapshot, newSnapshot);
        await ApplicationLogServices.bulkCreate(difference, prevData.id, 'lead_claim_update', SYSTEM_BOT_UUID);
    }
    logger.info(`[AutoReconciliation] Lead ${fresh_lead_id} auto-progressed successfully`);
};

const updateDsaIdForVendorClaims = async (vendorPan, dsaId) => {
    try {
        // First, get DSA details including the required fields
        const dsaQuery = `SELECT d.dsa_id, d.dsa_mobile_number, p.dsa_id as partner_id, d.hierarchy_crm as current_heirarchy_crm, d.materialized_path as current_hierarchy_path, k.permanent_account_number FROM ru_direct_selling_agents d LEFT JOIN ru_direct_selling_agents p ON p.dsa_mobile_number = d.partner_code LEFT JOIN ru_dsa_kyc_data k ON d.dsa_id = k.dsa_id WHERE d.dsa_id = ? AND k.permanent_account_number = ?`;

        const [dsa] = await _db2.query(dsaQuery, {
            replacements: [dsaId, vendorPan],
            type: QueryTypes.SELECT
        });

        if (!dsa) {
            return {
                success: false,
                message: 'DSA not found with the provided ID and PAN'
            };
        };

        // Update all claims where vendor_pan matches and form_type is 'ns_excel_upload'
        const updateQuery = `UPDATE ru_fresh_lead_claims SET dsa_id = ?, dsa_mobile_number = ?, partner_id = ?, current_heirarchy_crm = ?, current_hierarchy_path = ?, updated_at = NOW() WHERE vendor_pan = ? AND form_type = 'ns_excel_upload' AND dsa_id = '0'`;
        const [result] = await _db2.query(updateQuery, {
            replacements: [
                dsaId,
                dsa.dsa_mobile_number || null,
                dsa.partner_id || null,
                dsa.current_heirarchy_crm || null,
                dsa.current_hierarchy_path || null,
                vendorPan
            ],
            type: QueryTypes.UPDATE
        });

        return {
            success: true,
            message: `Successfully updated DSA details for ${result.affectedRows} claims`,
            updatedCount: result.affectedRows
        };
    } catch (error) {
        logger.error('Error updating DSA details for vendor claims:', error);
        return {
            success: false,
            message: 'Failed to update DSA details for vendor claims',
            error: error.message
        };
    };
};

// --- Vendor hierarchy compact view (vendor_hierarchy_snapshot) ---
const logCompactSql = (label, sql, replacements = []) => {
    const repl = [...replacements];
    const filled = repl.length ? sql.replace(/\?/g, () => {
        const v = repl.shift();
        return typeof v === 'string' ? `'${String(v).replace(/'/g, "''")}'` : (v == null ? 'NULL' : String(v));
    }) : sql;
    console.log('[VendorHierarchyCompact]', label, filled);
};

const getDsaMobileByDsaId = async (dsaId) => {
    if (!dsaId) return null;
    const sql = 'SELECT dsa_mobile_number FROM ru_direct_selling_agents WHERE dsa_id = ? LIMIT 1';
    logCompactSql('getDsaMobileByDsaId', sql, [dsaId]);
    const [row] = await _db2.query(sql, { replacements: [dsaId], type: QueryTypes.SELECT });
    return row && row.dsa_mobile_number ? String(row.dsa_mobile_number).trim() : null;
};

const buildSnapshotHierarchyWhere = (skipHierarchy, dsaId, materializedPath) => {
    if (skipHierarchy) return { where: 'WHERE 1=1', replacements: [] };
    const conditions = [];
    if (materializedPath) conditions.push('h.materialized_path LIKE ?');
    if (dsaId) conditions.push('h.materialized_path LIKE ?');
    if (conditions.length === 0) return { where: 'WHERE 1=0', replacements: [] };
    const replacements = [];
    if (materializedPath) replacements.push(`${materializedPath.replace(/'/g, "\\'")}%`);
    if (dsaId) replacements.push(`%${String(dsaId).replace(/'/g, "\\'")}%`);
    return { where: `WHERE (${conditions.join(' OR ')})`, replacements };
};

const METRIC_COLUMNS = {
    any_issue: 'subtree_any_issue_count',
    junk_contact: 'subtree_junk_contact_count',
    bank_missing: 'subtree_bank_missing_count',
    global_payout_missing: 'subtree_global_payout_missing_count',
    ns_missing: 'subtree_ns_missing_count',
    onboarding_incomplete: 'subtree_onboarding_incomplete_count',
    total: 'subtree_total_count'
};

const snapshotRowToSummary = (r) => ({
    totalCount: Number(r.subtree_total_count) || 0,
    anyIssueCount: Number(r.subtree_any_issue_count) || 0,
    junkContactCount: Number(r.subtree_junk_contact_count) || 0,
    bankMissingCount: Number(r.subtree_bank_missing_count) || 0,
    globalPayoutMissingCount: Number(r.subtree_global_payout_missing_count) || 0,
    nsMissingCount: Number(r.subtree_ns_missing_count) || 0,
    onboardingIncompleteCount: Number(r.subtree_onboarding_incomplete_count) || 0
});

const snapshotRowToOwnIssues = (r) => ({
    ownJunkContact: !!r.own_junk_contact,
    ownBankMissing: !!r.own_bank_missing,
    ownGlobalPayoutMissing: !!r.own_global_payout_missing,
    ownNsMissing: !!r.own_ns_missing,
    ownOnboardingIncomplete: !!r.own_onboarding_incomplete
});

const getSelectedMetricCount = (row, metric) => {
    const col = METRIC_COLUMNS[metric] || 'subtree_total_count';
    return Number(row[col]) || 0;
};

/** Display name for compact APIs: prefer full_name, else dsa_id so UI never shows "Node <uuid>". */
const compactDisplayName = (fullName) => {
    const name = fullName != null && String(fullName).trim() !== '' ? String(fullName).trim() : null;
    return name || '-';
};

/** Build hierarchy WHERE for ru_direct_selling_agents (alias c). Same logic as snapshot. */
const buildDsaHierarchyWhere = (skipHierarchy, dsaId, materializedPath) => {
    if (skipHierarchy) return { where: 'WHERE 1=1', replacements: [] };
    const conditions = [];
    if (materializedPath) conditions.push('c.materialized_path LIKE ?');
    if (dsaId) conditions.push('c.materialized_path LIKE ?');
    if (conditions.length === 0) return { where: 'WHERE 1=0', replacements: [] };
    const replacements = [];
    if (materializedPath) replacements.push(`${materializedPath.replace(/'/g, "\\'")}%`);
    if (dsaId) replacements.push(`%${String(dsaId).replace(/'/g, "\\'")}%`);
    return { where: `WHERE (${conditions.join(' OR ')})`, replacements };
};

/** Fallback: fetch node from ru_direct_selling_agents when not in snapshot. Returns snapshot-shaped row with zero counts. */
const getCompactNodeFromDsaTable = async (dsaId, materializedPath, skipHierarchy, targetDsaId) => {
    if (!targetDsaId) return null;
    const { where: hierarchyWhere, replacements: hierarchyRepl } = buildDsaHierarchyWhere(skipHierarchy, dsaId, materializedPath);
    const replacements = [...hierarchyRepl, targetDsaId];
    const sql = `SELECT c.dsa_id, c.partner_code AS parent_dsa_id, c.materialized_path,
        COALESCE(c.full_name, CONCAT_WS(' ', c.first_name, c.middle_name, c.last_name), c.dsa_mobile_number) AS full_name,
        (LENGTH(COALESCE(c.materialized_path, '')) - LENGTH(REPLACE(COALESCE(c.materialized_path, ''), '/', ''))) AS level_depth,
        (SELECT COUNT(*) FROM ru_direct_selling_agents c2 WHERE c2.partner_code = c.dsa_mobile_number AND (c2.is_deleted IS NULL OR c2.is_deleted = 0)) AS direct_children_count
        FROM ru_direct_selling_agents c
        ${hierarchyWhere} AND c.dsa_id = ? AND (c.is_deleted IS NULL OR c.is_deleted = 0) LIMIT 1`;
    logCompactSql('getCompactNodeFromDsaTable(fallback)', sql, [...replacements]);
    const rows = await _db2.query(sql, { replacements, type: QueryTypes.SELECT });
    const r = rows[0];
    if (!r) return null;
    const zeroSummary = { totalCount: 0, anyIssueCount: 0, junkContactCount: 0, bankMissingCount: 0, globalPayoutMissingCount: 0, nsMissingCount: 0, onboardingIncompleteCount: 0 };
    const zeroOwn = { ownJunkContact: false, ownBankMissing: false, ownGlobalPayoutMissing: false, ownNsMissing: false, ownOnboardingIncomplete: false };
    return {
        dsaId: r.dsa_id,
        parentDsaId: r.parent_dsa_id || null,
        fullName: compactDisplayName(r.full_name),
        levelDepth: Math.max(0, Number(r.level_depth) || 0),
        materializedPath: r.materialized_path || null,
        directChildrenCount: Number(r.direct_children_count) || 0,
        summary: zeroSummary,
        ownIssues: zeroOwn,
        updatedAt: null
    };
};

/**
 * Get Compact View Root Summary – one row from vendor_hierarchy_snapshot for the selected/root node.
 * If not in snapshot (e.g. no issues), fallback to ru_direct_selling_agents with zero counts.
 * When CEO and no nodeId: return aggregate "all data" summary (sum of root-level subtree counts).
 */
const getCompactViewRootSummary = async (dsaId, materializedPath, skipHierarchy, nodeId, metric) => {
    const rawNodeId = nodeId || dsaId;
    const effectiveNodeId = (rawNodeId != null && String(rawNodeId).trim() !== '' && !['null', 'undefined'].includes(String(rawNodeId).toLowerCase()))
        ? rawNodeId
        : null;

    if (skipHierarchy && effectiveNodeId == null) {
        const { where: hierarchyWhere } = buildSnapshotHierarchyWhere(true, dsaId, materializedPath);
        const aggQuery = `SELECT
            COUNT(*) AS row_count,
            COALESCE(SUM(h.subtree_total_count), 0) AS subtree_total_count,
            COALESCE(SUM(h.subtree_any_issue_count), 0) AS subtree_any_issue_count,
            COALESCE(SUM(h.subtree_junk_contact_count), 0) AS subtree_junk_contact_count,
            COALESCE(SUM(h.subtree_bank_missing_count), 0) AS subtree_bank_missing_count,
            COALESCE(SUM(h.subtree_global_payout_missing_count), 0) AS subtree_global_payout_missing_count,
            COALESCE(SUM(h.subtree_ns_missing_count), 0) AS subtree_ns_missing_count,
            COALESCE(SUM(h.subtree_onboarding_incomplete_count), 0) AS subtree_onboarding_incomplete_count
            FROM vendor_hierarchy_snapshot h ${hierarchyWhere} AND (h.parent_dsa_id IS NULL OR h.parent_dsa_id = '')`;
        const totalRowsQuery = `SELECT COUNT(*) AS total_rows FROM vendor_hierarchy_snapshot h ${hierarchyWhere}`;
        logCompactSql('getCompactViewRootSummary(CEO all)', aggQuery, []);
        // Use transaction to force primary (write) connection; Sequelize 6 may ignore useMaster for raw SELECT
        const [agg, totalRowsResult] = await _db2.transaction(async (t) => {
            const rows = await _db2.query(aggQuery, { type: QueryTypes.SELECT, transaction: t });
            const totalRows = await _db2.query(totalRowsQuery, { type: QueryTypes.SELECT, transaction: t });
            return [rows, totalRows];
        });
        const agg_ = (agg && agg[0]) || {};
        const totalRow = (totalRowsResult && totalRowsResult[0]) || null;
        if (agg_ && (agg_.row_count != null || agg_.subtree_total_count != null)) {
            console.log('[CompactSummary CEO] aggregate from snapshot:', { row_count: agg_.row_count, subtree_total_count: agg_.subtree_total_count });
        }
        const selectedMetric = metric || 'total';
        const totalCount = Number(agg_.subtree_total_count) || 0;
        const selectedMetricCount = selectedMetric === 'total' ? totalCount : (Number(agg_[METRIC_COLUMNS[selectedMetric]]) || 0);
        const directChildrenCount = Number(totalRow && totalRow.total_rows) || Number(agg_.row_count) || 0;
        return {
            nodeId: null,
            parentNodeId: null,
            fullName: 'All',
            levelDepth: 0,
            materializedPath: null,
            directChildrenCount,
            summary: {
                totalCount,
                anyIssueCount: Number(agg_.subtree_any_issue_count) || 0,
                junkContactCount: Number(agg_.subtree_junk_contact_count) || 0,
                bankMissingCount: Number(agg_.subtree_bank_missing_count) || 0,
                globalPayoutMissingCount: Number(agg_.subtree_global_payout_missing_count) || 0,
                nsMissingCount: Number(agg_.subtree_ns_missing_count) || 0,
                onboardingIncompleteCount: Number(agg_.subtree_onboarding_incomplete_count) || 0
            },
            selectedMetric: selectedMetric,
            selectedMetricCount,
            ownIssues: { ownJunkContact: false, ownBankMissing: false, ownGlobalPayoutMissing: false, ownNsMissing: false, ownOnboardingIncomplete: false },
            updatedAt: null
        };
    }

    if (!effectiveNodeId) return null;
    const { where: hierarchyWhere, replacements: hierarchyRepl } = buildSnapshotHierarchyWhere(skipHierarchy, dsaId, materializedPath);
    const replacements = [...hierarchyRepl, effectiveNodeId];
    const query = `SELECT dsa_id, parent_dsa_id, materialized_path, full_name, level_depth, direct_children_count,
        own_junk_contact, own_bank_missing, own_global_payout_missing, own_ns_missing, own_onboarding_incomplete,
        subtree_total_count, subtree_any_issue_count, subtree_junk_contact_count, subtree_bank_missing_count,
        subtree_global_payout_missing_count, subtree_ns_missing_count, subtree_onboarding_incomplete_count, updated_at
        FROM vendor_hierarchy_snapshot h ${hierarchyWhere} AND h.dsa_id = ? LIMIT 1`;
    logCompactSql('getCompactViewRootSummary', query, [...replacements]);
    const rows = await _db2.query(query, { replacements, type: QueryTypes.SELECT, useMaster: true });
    let r = rows[0];
    if (!r) {
        const fallback = await getCompactNodeFromDsaTable(dsaId, materializedPath, skipHierarchy, effectiveNodeId);
        if (!fallback) return null;
        return {
            nodeId: fallback.dsaId,
            parentNodeId: fallback.parentDsaId,
            fullName: fallback.fullName,
            levelDepth: fallback.levelDepth,
            materializedPath: fallback.materializedPath,
            directChildrenCount: fallback.directChildrenCount,
            summary: fallback.summary,
            selectedMetric: metric || 'total',
            selectedMetricCount: 0,
            ownIssues: fallback.ownIssues,
            updatedAt: fallback.updatedAt
        };
    }
    const selectedMetric = metric || 'total';
    return {
        nodeId: r.dsa_id,
        parentNodeId: r.parent_dsa_id,
        fullName: compactDisplayName(r.full_name),
        levelDepth: Number(r.level_depth) || 0,
        materializedPath: r.materialized_path || null,
        directChildrenCount: Number(r.direct_children_count) || 0,
        summary: snapshotRowToSummary(r),
        selectedMetric: selectedMetric,
        selectedMetricCount: getSelectedMetricCount(r, selectedMetric),
        ownIssues: snapshotRowToOwnIssues(r),
        updatedAt: r.updated_at
    };
};

/**
 * Get Compact View Children – direct children of nodeId (parent_dsa_id = node's mobile), paginated, sorted, and optionally filtered by filterModel.
 * When CEO (skipHierarchy) and no nodeId/dsaId, returns all snapshot rows so CEO sees everyone in the listing (not just roots).
 */
const getCompactViewChildren = async (dsaId, materializedPath, skipHierarchy, nodeId, metric, page = 1, pageSize = 10, showOnlyAffected = true, sortBy = 'metric_count', sortOrder = 'desc', filterModel = null, logicOperator = 'and') => {
    const effectiveNodeId = nodeId || dsaId;
    let parentCondition;
    let parentRepl;
    if (skipHierarchy && effectiveNodeId == null) {
        parentCondition = '1=1';
        parentRepl = [];
    } else {
        if (!effectiveNodeId) return { nodeId: effectiveNodeId, selectedMetric: metric || 'total', page, pageSize, totalRecords: 0, rows: [] };
        const parentMobile = await getDsaMobileByDsaId(effectiveNodeId);
        if (!parentMobile) return { nodeId: effectiveNodeId, selectedMetric: metric || 'total', page, pageSize, totalRecords: 0, rows: [] };
        parentCondition = 'h.parent_dsa_id = ?';
        parentRepl = [parentMobile];
    }

    const { where: hierarchyWhere, replacements: hierarchyRepl } = buildSnapshotHierarchyWhere(skipHierarchy, dsaId, materializedPath);
    const metricCol = METRIC_COLUMNS[metric || 'any_issue'] || 'subtree_any_issue_count';
    const affectedCondition = (metric === 'any_issue' || !metric) ? ' AND h.subtree_any_issue_count > 0' : ` AND (h.${metricCol} > 0)`;
    const showAffectedWhere = showOnlyAffected ? affectedCondition : '';

    // Apply filterModel (same pattern as vendor dashboard list)
    let filterWhere = '';
    const filterRepl = [];
    const effectiveFilterModel = filterModel && filterModel.items && filterModel.items.length > 0 ? filterModel : { items: [], logicOperator: 'and' };
    if (effectiveFilterModel.items.length > 0) {
        const logicOp = (effectiveFilterModel.logicOperator || logicOperator || 'and').toUpperCase();
        const operatorHandlers = CustomOperatorHandlers();
        const whereFilterQuery = CreateWhereQueryFilter(effectiveFilterModel, getCompactSearchFieldMapping, operatorHandlers, 'compact_search');
        if (whereFilterQuery && whereFilterQuery.length > 0) {
            const filterConditions = [];
            whereFilterQuery.forEach((triple) => {
                const [dbField, operator, value] = triple;
                if (Array.isArray(value) && value.length > 0) {
                    const placeholders = value.map(() => '?').join(',');
                    filterConditions.push(`${dbField} ${operator} (${placeholders})`);
                    filterRepl.push(...value);
                } else if (value !== null && value !== undefined && value !== '') {
                    filterConditions.push(`${dbField} ${operator} ?`);
                    filterRepl.push(value);
                } else {
                    filterConditions.push(`${dbField} ${operator}`);
                }
            });
            const filterClause = filterConditions.length === 1 ? filterConditions[0] : `(${filterConditions.join(` ${logicOp} `)})`;
            filterWhere = ` AND ${filterClause}`;
        }
    }

    const orderCol = {
        metric_count: `h.${metricCol}`,
        full_name: 'h.full_name',
        level_depth: 'h.level_depth',
        updated_at: 'h.updated_at'
    }[sortBy] || `h.${metricCol}`;
    const order = (sortOrder || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const offset = (Math.max(1, page) - 1) * Math.max(1, pageSize);
    const limit = Math.max(1, Math.min(100, pageSize));

    const countQuery = `SELECT COUNT(*) AS total FROM vendor_hierarchy_snapshot h ${hierarchyWhere} AND ${parentCondition} ${showAffectedWhere}${filterWhere}`;
    const countRepl = [...hierarchyRepl, ...parentRepl, ...filterRepl];
    logCompactSql('getCompactViewChildren(count)', countQuery, [...countRepl]);
    const [countRow] = await _db2.query(countQuery, { replacements: countRepl, type: QueryTypes.SELECT, useMaster: true });
    const totalRecords = Number(countRow.total) || 0;

    const dataQuery = `SELECT h.dsa_id, h.parent_dsa_id, h.full_name, h.level_depth, h.direct_children_count,
        h.own_junk_contact, h.own_bank_missing, h.own_global_payout_missing, h.own_ns_missing, h.own_onboarding_incomplete,
        h.subtree_total_count, h.subtree_any_issue_count, h.subtree_junk_contact_count, h.subtree_bank_missing_count,
        h.subtree_global_payout_missing_count, h.subtree_ns_missing_count, h.subtree_onboarding_incomplete_count, h.updated_at
        FROM vendor_hierarchy_snapshot h ${hierarchyWhere} AND ${parentCondition} ${showAffectedWhere}${filterWhere}
        ORDER BY ${orderCol} ${order} LIMIT ? OFFSET ?`;
    const dataRepl = [...countRepl, limit, offset];
    logCompactSql('getCompactViewChildren(data)', dataQuery, [...dataRepl]);
    const rows = await _db2.query(dataQuery, { replacements: dataRepl, type: QueryTypes.SELECT, useMaster: true });

    const selectedMetric = metric || 'any_issue';
    const resultRows = rows.map(r => ({
        dsaId: r.dsa_id,
        parentDsaId: r.parent_dsa_id,
        fullName: compactDisplayName(r.full_name),
        levelDepth: Number(r.level_depth) || 0,
        directChildrenCount: Number(r.direct_children_count) || 0,
        summary: snapshotRowToSummary(r),
        selectedMetricCount: getSelectedMetricCount(r, selectedMetric),
        ownIssues: snapshotRowToOwnIssues(r),
        updatedAt: r.updated_at
    }));

    return {
        nodeId: effectiveNodeId,
        selectedMetric: selectedMetric,
        page: Math.max(1, page),
        pageSize: limit,
        totalRecords,
        rows: resultRows
    };
};

/**
 * Get Compact Node Details – single node by dsa_id.
 * If not in snapshot, fallback to ru_direct_selling_agents with zero counts.
 */
const getCompactNodeDetails = async (dsaId, materializedPath, skipHierarchy, targetDsaId) => {
    if (!targetDsaId) return null;
    const { where: hierarchyWhere, replacements: hierarchyRepl } = buildSnapshotHierarchyWhere(skipHierarchy, dsaId, materializedPath);
    const replacements = [...hierarchyRepl, targetDsaId];
    const query = `SELECT dsa_id, parent_dsa_id, materialized_path, full_name, level_depth, direct_children_count,
        own_junk_contact, own_bank_missing, own_global_payout_missing, own_ns_missing, own_onboarding_incomplete,
        subtree_total_count, subtree_any_issue_count, subtree_junk_contact_count, subtree_bank_missing_count,
        subtree_global_payout_missing_count, subtree_ns_missing_count, subtree_onboarding_incomplete_count, updated_at
        FROM vendor_hierarchy_snapshot h ${hierarchyWhere} AND h.dsa_id = ? LIMIT 1`;
    logCompactSql('getCompactNodeDetails', query, [...replacements]);
    const rows = await _db2.query(query, { replacements, type: QueryTypes.SELECT, useMaster: true });
    const r = rows[0];
    if (r) {
        return {
            dsaId: r.dsa_id,
            parentDsaId: r.parent_dsa_id,
            fullName: compactDisplayName(r.full_name),
            levelDepth: Number(r.level_depth) || 0,
            materializedPath: r.materialized_path || null,
            directChildrenCount: Number(r.direct_children_count) || 0,
            summary: snapshotRowToSummary(r),
            ownIssues: snapshotRowToOwnIssues(r),
            updatedAt: r.updated_at
        };
    }
    return getCompactNodeFromDsaTable(dsaId, materializedPath, skipHierarchy, targetDsaId);
};

/**
 * Get Compact Breadcrumb – path from root to node using materialized_path.
 */
const getCompactBreadcrumb = async (dsaId, materializedPath, skipHierarchy, targetDsaId) => {
    if (!targetDsaId) return [];
    const node = await getCompactNodeDetails(dsaId, materializedPath, skipHierarchy, targetDsaId);
    if (!node || !node.materializedPath) return node ? [{ dsaId: node.dsaId, fullName: node.fullName, levelDepth: node.levelDepth }] : [];
    const pathParts = String(node.materializedPath).split('/').filter(Boolean);
    if (pathParts.length === 0) return [{ dsaId: node.dsaId, fullName: node.fullName, levelDepth: node.levelDepth }];
    const placeholders = pathParts.map(() => '?').join(',');
    const { where: hierarchyWhere, replacements: hierarchyRepl } = buildSnapshotHierarchyWhere(skipHierarchy, dsaId, materializedPath);
    const replacements = [...hierarchyRepl, ...pathParts];
    const query = `SELECT dsa_id, full_name, level_depth FROM vendor_hierarchy_snapshot h ${hierarchyWhere} AND h.dsa_id IN (${placeholders}) ORDER BY h.level_depth ASC`;
    logCompactSql('getCompactBreadcrumb', query, [...replacements]);
    const rows = await _db2.query(query, { replacements, type: QueryTypes.SELECT, useMaster: true });
    const byId = new Map(rows.map(r => [r.dsa_id, { dsaId: r.dsa_id, fullName: compactDisplayName(r.full_name), levelDepth: Number(r.level_depth) || 0 }]));
    return pathParts.map(id => byId.get(id)).filter(Boolean);
};

const getLeadAdminByDsaId = async (dsaIds) => {
    if (!Array.isArray(dsaIds) || !dsaIds.length) return [];
    const placeholders = dsaIds.map(() => '?').join(',');
    const query = `SELECT up.dsa_id, u.email FROM users u JOIN users up ON u.parent = up.id AND up.dsa_id IN (${placeholders}) JOIN roles r ON u.role = r.id AND r.role = "LEAD_ADMIN"`;
    const result = await sequelize.query(query, { replacements: dsaIds, type: QueryTypes.SELECT }) || [];
    return result;
}

const getDsaPartnerAndBusinessHeadDetails = async (dsaIds) => {
    if (!Array.isArray(dsaIds) || !dsaIds.length) return [];
    const placeholders = dsaIds.map(() => '?').join(',');
    const query = `SELECT rdsa.dsa_id, partner.email_address AS partner_email, partner.dsa_id as partner_dsa_id , business_head.dsa_id AS business_head_dsa_id FROM ru_direct_selling_agents rdsa LEFT JOIN ru_direct_selling_agents partner ON rdsa.partner_code = partner.dsa_mobile_number LEFT JOIN ru_direct_selling_agents business_head ON rdsa.business_head_code = business_head.dsa_mobile_number WHERE rdsa.dsa_id IN (${placeholders})`;
    const result = await _db2.query(query, { replacements: dsaIds, type: QueryTypes.SELECT }) || [];
    return result;
};

const getUtmMainSourceFromUtmSource = async (utmSource) => {
    let pattern = 'gpt|chatgpt|perplexity|claude|gemini|copilot|openai|anthropic';
    try {
        const querySetting = "SELECT setting_value FROM ru_settings WHERE setting_key = 'llm_cource_classifictaion_regex' LIMIT 1";
        const result = await _db2.query(querySetting, { type: QueryTypes.SELECT });
        if (result?.[0]?.setting_value) {
            pattern = result[0].setting_value;
        }
    } catch (e) {
        // Fallback to default pattern
    }
    const llmRegex = new RegExp(pattern, 'i');
    if (utmSource && llmRegex.test(utmSource)) {
        return "LLM Leads";
    }
    return null;
};

const syncLlmUtmMainSource = async () => {
    let pattern = 'gpt|chatgpt|perplexity|claude|gemini|copilot|openai|anthropic';
    try {
        const querySetting = "SELECT setting_value FROM ru_settings WHERE setting_key = 'llm_cource_classifictaion_regex' LIMIT 1";
        const result = await _db2.query(querySetting, { type: QueryTypes.SELECT });
        if (result?.[0]?.setting_value) {
            pattern = result[0].setting_value;
        }
    } catch (e) {
        // Fallback to default pattern
    }

    const query1 = `
        UPDATE ru_direct_selling_agents 
        SET utm_main_source = 'LLM Leads' 
        WHERE utm_source REGEXP ?;
    `;
    const query2 = `
        UPDATE ru_dsa_leads 
        SET utm_main_source = 'LLM Leads' 
        WHERE utm_source REGEXP ?;
    `;

    const dsaResult = await _db2.query(query1, { replacements: [pattern], type: QueryTypes.UPDATE });
    const leadsResult = await _db2.query(query2, { replacements: [pattern], type: QueryTypes.UPDATE });
    return {
        success: true,
        pattern,
        dsaResult,
        leadsResult
    };
};

const updateDsaClassInfo = async (dsa_id, class_assignee_name, class_assignee_email) => {
    const oldRows = await _db2.query(
        `SELECT class_assignee_name, class_assignee_email FROM ru_direct_selling_agents WHERE dsa_id = ?`,
        { replacements: [dsa_id], type: QueryTypes.SELECT }
    );
    const previousData = oldRows && oldRows.length ? oldRows[0] : {};

    let query = `UPDATE ru_direct_selling_agents SET class_assignee_name = ?, class_assignee_email = ? WHERE dsa_id = ?`;
    let bindParams = [class_assignee_name || null, class_assignee_email || null, dsa_id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });

    const newRows = await _db2.query(
        `SELECT class_assignee_name, class_assignee_email FROM ru_direct_selling_agents WHERE dsa_id = ?`,
        { replacements: [dsa_id], type: QueryTypes.SELECT }
    );
    const newData = newRows && newRows.length ? newRows[0] : {};

    return { previousData, newData };
};

const saveMouAgreementData = async ({
    dsa_id,
    mou_filename,
    mou_signature_image_filename,
    company_id = null,
    company_mou_filename = null,
    consent_type = 'mou_agreement',
    description = 'MOU agreement signed and submitted',
    updated_by = null,
    ip = null
}) => {
    // 1. Table: ru_dsa_kyc_data (mou_filename, mou_signature_image_filename, mou_signed_date if not already set, latest_mou_signed_date)
    let [kycExist] = await _db2.query(
        `SELECT dsa_id, mou_signed_date, latest_mou_signed_date FROM ru_dsa_kyc_data WHERE dsa_id = ?`,
        { replacements: [dsa_id], type: QueryTypes.SELECT }
    );

    if (!kycExist) {
        const [dsaRow] = await _db2.query(
            `SELECT dsa_mobile_number FROM ru_direct_selling_agents WHERE dsa_id = ?`,
            { replacements: [dsa_id], type: QueryTypes.SELECT }
        );
        const mobileNum = dsaRow?.dsa_mobile_number || dsa_id;
        await _db2.query(
            `INSERT INTO ru_dsa_kyc_data (dsa_id, dsa_mobile_number) VALUES (?, ?)`,
            { replacements: [dsa_id, mobileNum], type: QueryTypes.INSERT }
        );
    }

    const oldMouSignedDate = kycExist?.latest_mou_signed_date || kycExist?.mou_signed_date || null;

    const updateKycQuery = `
        UPDATE ru_dsa_kyc_data 
        SET mou_filename = ?, 
            mou_signature_image_filename = ?, 
            mou_signed_date = COALESCE(mou_signed_date, NOW()),
            latest_mou_signed_date = NOW()
        WHERE dsa_id = ?
    `;
    await _db2.query(updateKycQuery, {
        replacements: [mou_filename, mou_signature_image_filename, dsa_id],
        type: QueryTypes.UPDATE
    });

    const [updatedKyc] = await _db2.query(
        `SELECT mou_signed_date, latest_mou_signed_date FROM ru_dsa_kyc_data WHERE dsa_id = ?`,
        { replacements: [dsa_id], type: QueryTypes.SELECT }
    );

    try {
        const formatLogDate = (d) => {
            if (!d || d === '-' || d === 'null' || d === 'undefined') return '-';
            const m = moment(d);
            return m.isValid() ? m.format('YYYY-MM-DD HH:mm:ss') : String(d);
        };
        const fromVal = formatLogDate(oldMouSignedDate);
        const toVal = formatLogDate(updatedKyc?.latest_mou_signed_date || new Date());
        const difference = [['latest_mou_signed_date', fromVal, toVal]];
        await ApplicationLogServices.bulkCreate(difference, dsa_id, 'dsa', updated_by || dsa_id, ip);
    } catch (logErr) {
        logger.error("Failed to write MOU signed date application log:", logErr);
    }


    // 2. Table: company_documents (if company_id or company_mou_filename provided)
    if (company_id && (company_mou_filename || mou_filename)) {
        const docPath = company_mou_filename || mou_filename;
        const [companyDocExist] = await _db2.query(
            `SELECT id FROM ru_company_documents WHERE company_id = ? AND doc_name = 'memorandum_of_understanding'`,
            { replacements: [company_id], type: QueryTypes.SELECT }
        );

        if (companyDocExist) {
            await _db2.query(
                `UPDATE ru_company_documents SET doc_type = 'legal_agreement', doc_path = ?, updated_at = NOW() WHERE company_id = ? AND doc_name = 'memorandum_of_understanding'`,
                { replacements: [docPath, company_id], type: QueryTypes.UPDATE }
            );
        } else {
            await _db2.query(
                `INSERT INTO ru_company_documents (company_id, doc_type, doc_name, doc_path, created_at, updated_at) VALUES (?, 'legal_agreement', 'memorandum_of_understanding', ?, NOW(), NOW())`,
                { replacements: [company_id, docPath], type: QueryTypes.INSERT }
            );
        }
    }

    // 3. Table: ru_user_onboarding_steps (via updateJourneyStep)
    await updateJourneyStep('dsa_agreement', dsa_id, 1);

    if (company_id) {
        await updateJourneyStep('company_agreement', dsa_id, 1);
    }

    // 4. Table: ru_dsa_consents
    const insertConsentQuery = `
        INSERT INTO ru_dsa_consents (dsa_id, consent_type, description, created_at, updated_at)
        VALUES (?, ?, ?, NOW(), NOW())
    `;
    await _db2.query(insertConsentQuery, {
        replacements: [dsa_id, consent_type, description],
        type: QueryTypes.INSERT
    });

    return true;
};

module.exports = {
    saveMouAgreementData,
    syncLlmUtmMainSource,

    getUtmMainSourceFromUtmSource,
    downloadInvoice,
    getSPbyId,
    getAllCRMUsers,
    checkIfMobileNumberIsVerified,
    checkDsaMobileNumberVerified,
    editLoanDetails,
    getLoanDetails,
    getRMList,
    checkIfMobileNumberIsValid,
    getCompanies,
    getCustomerDetails,
    getRuloansCustomers,
    getRuloansCustomersKyc,
    getDistinctSingleProperty,
    getDsaUserDetailsWithLoanAndCreditCardDetails,
    getCreditCardApplications,
    getLoanApplications,
    getAllCreditCardApplications,
    getAllLoanApplications,
    getCustomerUserDetails,
    getCustomerLoanApplications,
    getCutomerCreditCardApplications,
    getCustomerLoanDocuments,
    getCustomerLoanCapturedDetails,
    getCustomerCreditCardCapturedDetails,
    getCustomerLoanSuggestedBanks,
    getSuggestedBanksList,
    getLoanType,
    getCustomerState,
    getCustomerCity,
    getCustomers,
    getDsaByIdForTree,
    getCurrentChilds,
    updateDsaVerifyStatus,
    updateDsaAutoErpStatus,
    getDsaIsAutoErpById,
    getDsaUserCapturedDetails,
    addDsaVerificationDocument,
    getDsaVerificationDocument,
    reassignPartner,
    reassignPartnerVerification,
    updateDsaVerifyStatusWithAssignTo,
    getRuloansCustomersDownload,
    getDsaByPhone,
    checkDsaExistsByMobile,
    getAllVendor,
    getUserDsaProfileByPhone,
    getLntLoanApplications,
    getCustomerLntApplications,
    getCurrentChildsWhereIn,
    getRuloansCustomersDropDown,
    getLntApplicationById,
    getCreditCardApplicationById,
    getAllLntApplications,
    getDsaByPan,
    getDsaById,
    getDsaSameDayBillingEnabledById,
    getDsaAutonomousSettingsByDsaId,
    saveDsaAutonomousPaymentSettings,
    isProductEligibleAutonomous,
    getLntForDashboard,
    getCreditCardForDashboard,
    getLoanForDashboard,
    getCurrentChildsWithCount,
    getDsaByPhoneWithPercentage,
    getDsaTreeCount,
    getLntDashboard,
    getSingleDsaTreeCount,
    getLntDashboardByPhoneNumbers,
    getLntApplicationStage,
    getLntApplicationSubStage,
    getDsaTreeArray,
    getDsaChild,
    getDsaIdByPhone,
    updateChannelPartnerStatus,
    downloadDsaWithStep,
    downloadDsaWithStepWhereIn,
    getBajajCCDashboardByPhoneNumbers,
    getAllIndifiApplications,
    getIndifiApplicationDetailsById,
    getIndifiDashboardByPhoneNumbers,
    getCreditCardApplicationStatus,
    getIndifiApplicationStatus,
    getDsaTreeDownload,
    editSubAssignee,
    editUserType,
    getCibilInitiated,
    getCibilList,
    getLntReportLinkByDate,
    getCibilDetail,
    getCustomerCapturedDetails,
    getDsaApiTokens,
    getAllPayoutRequest,
    getPayoutRequest,
    getReportLinkByDate,
    getBusinessHeadRecursively,
    getDsaKycData,
    updateDsaKycData,
    updateDsaSignUpSteps,
    updateBhExternal,
    getNotificationUsers,
    getIncredDashboard,
    getFairCentDashboard,
    getIncredDashboardByPhoneNumbers,
    getBajajPLDashboardByPhoneNumbers,
    getFairCentDashboardByPhoneNumbers,
    getIncredReportLinkByDate,
    getFaircentReportLinkByDate,
    getPaysenseDashboardByPhoneNumbers,
    getFibeDashboardByPhoneNumbers,
    getAllFibeApplications,
    getAllPayUApplications,
    getCreditVidyaDashboardByPhoneNumbers,
    getCreditSasionDashboardByPhoneNumbers,
    getPiramalDashboardByPhoneNumbers,
    getAllBajajApplications,
    getAllIncredApplications,
    getAllCreditSaisonApplications,
    getAllPiramalApplications,
    getAllCreditVidyaApplications,
    getStageFilterList,
    saveOtp,
    getOtp,
    getBHVendors,
    verifyOtpById,
    getAllDsaLeads,
    getUniqueDsaDownload,
    getLeadClaimUpdateLogs,
    getLeadClaimUploadLogs,
    deleteLeadFormData,
    createCommunicationSettings,
    getCommunicationSettings,
    deleteCommunicationSettings,
    getOnChangeCommunication,
    addCommunicationApplicationLog,
    getTimeBasedCommunication,
    createRemainder,
    getAllRemainder,
    getAllUpcomingRemainder,
    getAllMissedRemainder,
    deleteRemainder,
    markAllPastRemainderAsRead,
    getDsaDataForEdit,
    createDsa,
    getDsaWithEmailAndPhone,
    updateLastStatus,
    markRemainderAsRead,
    getSignUpSteps,
    getDsaUploadLogs,
    getPersonalLoanMisForDsa,
    getDsaCityState,
    getUserByBusinessHead,
    updatePartnerHierarchyCount,
    getPartnerHierarchyCount,
    getDsaChildRecursively,
    getLeadCLaimById,
    updateLeadFormPayoutType,
    getAllPendingHlApplications,
    getAllPiramalLapApplications,
    getAllPendingLAPApplications,
    mergeDsa,
    getAllCCApplications,
    getAllCCProducts,
    getAllInvoices,
    getInvoiceById,
    getInvoiceByInvoiceNumber,
    updateInvoice,
    updateInvoiceNumber,
    acceptOrRejectInvoice,
    uploadReverseInvoice,
    getBasicDetails,
    getBankDetailsByPan,
    getDsaBHName,
    getRefreshPayoutStatusForDsa,
    getDsaKycById,
    getDsaKycByVendorId,
    editDsaNSVendorId,
    getAllDsaDopdown,
    getAllDsaDopdownNsHierarchyUniqueClass,
    getAllGlobalConfiguration,
    CreateEditGlobalConfiguration,
    DeleteGlobalConfiguration,
    getDsaByPrimaryId,
    getBankDetailsDsa,
    getDsaByAIId,
    deleteInvoice,
    getAllDsaForMis,
    getLntDashboardByPhoneNumbersV2,
    getIncredDashboardByPhoneNumbersV2,
    getFairCentDashboardByPhoneNumbersV2,
    getFibeDashboardByPhoneNumbersV2,
    getOtpDb2,
    verifyOtpByIdDb2,
    getBajajPLDashboardByPhoneNumbersV2,
    getCreditVidyaDashboardByPhoneNumbersV2,
    getPaysenseDashboardByPhoneNumbersV2,
    getIndifiDashboardByPhoneNumbersV2,
    getPiramalDashboardByPhoneNumbersV2,
    getLoanForDashboardV2,
    updateDirectClaimAccess,
    getApplicationsByProductAndLoanType,
    editSigningPayout,
    getAllPlDashboardByPhoneNumbers,
    getYearlyPlReport,
    getAllCCForDashBoard,
    getYearlyCCReport,
    getDsaChildVendorsRecursively,
    getPayoutClaimDashboardByPhoneNumbers,
    getYearlyPayoutClaimReport,
    getDirectDsaForMis,
    createRuApiLogs,
    getLoginFormDashboardByPhoneNumbers,
    getYearlyLogiFormReport,
    getCombinedLoanApplications,
    moveToPendingLeadForm,
    reassignCustomerPartner,
    updateInvoiceSignById,
    signInvoiceWebhook,
    updateLntApplicationById,
    getDsaParentRecursively,
    changeDsaEmployeeStatus,
    getUtmJourneyUrl,
    updateLoanApplication,
    updateMultiFundedStatus,
    getApplicationUpdateLogs,
    getDsaUsersLists,
    getDsaFullDetailsPhone,
    getCustomerFirebaseTokens,
    updateCustomerFields,
    saveOtpDb2,
    getDsaMobileByEmail,
    getCreatorEmailForFreshLeadById,
    updateDsaHierarchyString,
    updateClaimPendingStatus,
    updateDsaBankDetails,
    syncDsaBankDetailsFromNs,
    getDsaUsersListsBulkCalling,
    getCustomerBulkCalling,
    getCustomerApplicationLogs,
    checkIfBankDetailsExist,
    getDsaKycDataExternal,
    mergeDsa2,
    modifyPermissions,
    checkClaimAccess,
    getPermissions,
    getDsaUsersListCount,
    getCustomerFirebaseTokenCount,
    toggleNotificationDsa,
    validateAndInsertLeadForInstantClaim,
    updateApplicationClaimStatus,
    sendInstantClaimNotificationAndEmail,
    updateDsaNsHierarchy,
    refreshDsaKycVendorBranchFromNsB2b,
    processSplitCaseFiles,
    getLeadFormCategory,
    getClaimsByDsaId,
    upsertAllCompanySteps,
    getDsaPartner,
    updateJourneyStep,
    getDsaEmailVerificationState,
    setDsaEmailAddressVerified,
    setDsaEmailAddressAndVerified,
    sendDsaEmailAddressVerificationOtpForDsa,
    verifyDsaEmailAddressVerificationOtpForDsa,
    sendDsaEmailReverificationOtpForDsa,
    verifyDsaEmailReverificationOtpForDsa,
    updateGlobalPayoutPercentageNew,
    validateVendorPayoutNew,
    getSalesPersons,
    assignSalesPerson,
    getDsaTaxDetails,
    updateDsaTaxInformation,
    insertDsaPayout,
    getDsaPayoutList,
    getPendingBankVerificationList,
    updateDsaPayoutList,
    updateBillerUniversal,
    getDsaGlobalPayoutPercentageNew,
    getBankProductMappedPayout,
    getAllPincodes,
    editPincode,
    deletePincode,
    addPincode,
    setLeadPayoutRateOrRatio,
    getDsaPayoutAutonomousByBankProduct,
    updateDsaMasterPayout,
    getDsaEligiblePayoutDetails,
    instantClaimAllEligibleApplication,
    sendInstantClaimErrorEmail,
    getDsaBhDetailsById,
    getDsaBankProductPayoutDetils,
    saveDsaPayoutDeal,
    updateDsaClassInfo,
    getCrmHierarchyFromMaterializedPath,
    insertDsaMultiplePayout,
    getDsaPayoutBankAndProduct,
    getReferrerDetails,
    saveDsaSameDayBillingStatus,
    getVendorDetailsByPan,
    getLoggedInUserDsaAndBhDetails,
    verifyPanViaAuthBridge,
    verifyPanViaAuthBridgeV2,
    verifyPanViaAuthBridgeByDsaIdV2,
    verifyPanViaAuthBridgeByPanV2,
    getLoggedInDsaDetailsForDropdown,
    updateDsaMobileNumber,
    changeCompanyOwner,
    getVendorMetrics,
    getVendorDashboardList,
    getVendorBranchDsaList,
    getVendorBranchDsaList,
    getVendorDashboardListCounts,
    getVendorDashboardByDsaId,
    updateLeadByReconciliation,
    autoProgressLeadFromReconciliation,
    getBankCategoryByBankProduct,
    updateDsaIdForVendorClaims,
    getDsaByIdForAutoErpValidation,
    getCompactViewRootSummary,
    getCompactViewChildren,
    getCompactNodeDetails,
    getCompactBreadcrumb,
    getLeadAdminByDsaId,
    getDsaPartnerAndBusinessHeadDetails,
    updateDsaAutonomousPayoutList,
    withdrawDsaConsent,
    approveFuzzyMatchedBankAccounts,
    saveMouAgreementData,
};
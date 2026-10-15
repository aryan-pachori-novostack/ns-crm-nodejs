const { sequelize, _db2 } = require('../../models');
const { QueryTypes } = require('sequelize');
const { IST_NOW_SQL } = require('../helpers/sql-time');
const { upsertLeadFormField, getLeadFormField } = require('../v1/controllers/mongo-db');
const { v4: uuid } = require('uuid');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const getDistinctSingleProperty = async (columnName, where) => {

    let bindParams = [];
    let query = ' SELECT distinct ' + columnName + ' as ' + columnName + ' FROM bank_details ';
    if (where && where.length != 0) {
        query += ' where ';
        for (let i = 0; i < where.length; i++) {
            if (i == 0) query += where[i][0] + ' = ? ';
            else query += ' and ' + where[i][0] + ' = ? ';
            bindParams.push(where[i][1])
        }
    }
    query += ' order by ' + columnName + ' asc ';
    const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results;
    // We didn't need to destructure the result here - the results were returned directly
};

const getBankDetail = async (where, search = "", offset, limit) => {
    let bindParams = [];
    let query = ` SELECT *, COALESCE(ifsc_code, '') AS ifsc_code, COALESCE(branch_name, '') AS branch_name FROM bank_details ${where} `;
    let queryCount = ` SELECT count(*) as totalCount from bank_details ${where}`;
    query += ` order by id asc ${limit ? `limit ${offset},${limit}` : ""} `;
    const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    const totalCount = await sequelize.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    return { results, totalCount: totalCount[0].totalCount };
};

const addBankProductCombination = async (bank_id, product_ids) => {
    const query = `
    INSERT INTO ru_bank_product_combinations (bank_product_combinations_id, bank_id, product_id)
    VALUES (UUID_TO_BIN(?), ?, ?)
    ON DUPLICATE KEY UPDATE  bank_id = VALUES(bank_id),
    product_id = VALUES(product_id);
  `;
    for (let product_id of product_ids) {
        const id = uuid();
        await _db2.query(query, {
            replacements: [id, bank_id, product_id],
            type: sequelize.QueryTypes.INSERT
        });
    }
    // We didn't need to destructure the result here - the results were returned directly
};

const addBankProductCombinationRegex = async (bank_id, product_id, fields) => {
    await upsertLeadFormField(bank_id, product_id, fields);
};

const getBankProductCombinationRegex = async (bank_id, product_id) => {
    return await getLeadFormField(bank_id, product_id);
};

const toProductMatch = (product) => ({
    netsuite_product_id: product.netsuite_product_id,
    product_name: product.product_name,
    short_name: product.short_name || null,
    main_product: product.main_product || null,
});

const asSampleList = (value) => {
    if (value == null || value === "") return [];
    return Array.isArray(value) ? value.filter((item) => item != null && item !== "") : [value];
};

const getLoanAndApacSamplesForBankProduct = async (bank_id, product_id) => {
    const regexPattern = await getBankProductCombinationRegex(String(bank_id), String(product_id));
    const fields = regexPattern?.fields || {};

    return {
        mode: "samples",
        bank_id: String(bank_id),
        product_id: String(product_id),
        loan_number: {
            regex: asSampleList(fields.loan_reference_id),
            sample: asSampleList(fields.loan_reference_id_sample),
        },
        apac_ref_los_number: {
            regex: asSampleList(fields.apac_ref_los_number),
            sample: asSampleList(fields.apac_ref_los_number_sample),
        },
    };
};

const getMatchingProductsByLoanOrApac = async (bank_id, loan_number, apac_ref_los_number, product_id) => {
    const productId = (product_id || "").toString().trim();
    if (productId) {
        return getLoanAndApacSamplesForBankProduct(bank_id, productId);
    }

    const { checkIfLoanAndApacNumberIsValid } = require('./finance-services');
    const loan = (loan_number || "").toString().trim();
    const apac = (apac_ref_los_number || "").toString().trim();
    const { records } = await getBankProductCombinationByBankId(bank_id);

    const productsWithRegex = await Promise.all(
        (records || []).map(async (product) => {
            const product_id = product.netsuite_product_id;
            const regexPattern = await getBankProductCombinationRegex(String(bank_id), String(product_id));
            return { product, regexPattern };
        })
    );

    const loan_matches = [];
    const apac_matches = [];

    for (const { product, regexPattern } of productsWithRegex) {
        if (!regexPattern?.fields) continue;

        const hasLoanRegex = Boolean(regexPattern.fields.loan_reference_id);
        const hasApacRegex = Boolean(regexPattern.fields.apac_ref_los_number);
        const mapped = toProductMatch(product);

        if (loan && hasLoanRegex) {
            const { error } = checkIfLoanAndApacNumberIsValid(regexPattern, loan, null);
            if (!error) loan_matches.push(mapped);
        }

        if (apac && hasApacRegex) {
            const { error } = checkIfLoanAndApacNumberIsValid(regexPattern, null, apac);
            if (!error) apac_matches.push(mapped);
        }
    }

    const loanProvided = Boolean(loan);
    const apacProvided = Boolean(apac);
    const bothProvided = loanProvided && apacProvided;

    let products;
    if (bothProvided) {
        const apacIds = new Set(apac_matches.map((item) => String(item.netsuite_product_id)));
        products = loan_matches.filter((item) => apacIds.has(String(item.netsuite_product_id)));
    } else if (loanProvided) {
        products = loan_matches;
    } else {
        products = apac_matches;
    }

    const mismatch = bothProvided && products.length === 0;

    return {
        mode: "match",
        products,
        loan_matches,
        apac_matches,
        mismatch,
        loan_provided: loanProvided,
        apac_provided: apacProvided,
    };
};

const getBankProductCombinationByBankId = async (bank_id, checkIsStatusEnabled) => {
    let query = ` select np.* , bpc.max_payout_capping ,bpc.status as bank_product_status, d.ns_customer_slab_id as slab_internal_id from ru_bank_product_combinations bpc join ru_netsuite_banks nb on bpc.bank_id = nb.netsuite_bank_id join  ru_netsuite_products np on binary bpc.product_id = binary np.netsuite_product_id
    left join lateral (
        select d1.ns_customer_slab_id
        from ru_bank_product_combination_details d1
        where d1.bank_product_combinations_id = bpc.bank_product_combinations_id
        order by (coalesce(lower(trim(d1.ns_status)), '') = 'active') desc, d1.created_at desc, d1.id desc
        limit 1
    ) d on true
    where bpc.bank_id = ? `;

    if (checkIsStatusEnabled) {
        query += ` and nb.status = 1 and np.status = 1 and bpc.status = 1 `
    }

    let response = await _db2.query(query, { replacements: [bank_id], type: sequelize.QueryTypes.SELECT });

    const queryCount = ` select count(*) as count from ru_bank_product_combinations bpc join  ru_netsuite_products np on binary bpc.product_id = binary np.netsuite_product_id where bpc.bank_id = ? `;
    let totalRecords = await _db2.query(queryCount, { replacements: [bank_id], type: sequelize.QueryTypes.SELECT });

    return { records: response, totalRecords: totalRecords[0]?.count || 0 };
};

const updateMaxProductPayoutCap = async (data) => {
    const { product_id, bank_id, max_payout_capping } = data;
    let query = ` update ru_bank_product_combinations set max_payout_capping = ? where product_id = ? and bank_id = ? `;
    let bindParams = [max_payout_capping, product_id, bank_id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return;
};

const deleteAllBanks = async () => {
    let bindParams = [];

    let query = ' delete from bank_details ';
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.DELETE });

    query = `alter table bank_details auto_increment = 1`
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.DELETE });
    // We didn't need to destructure the result here - the results were returned directly
}

const getAllBanks = async (offset, limit, where) => {
    let bindParams = [];
    let query = ` SELECT id, bank_nbfc_name, product, state, city, company, updatedAt, createdAt FROM bank_details ${where} `;
    let queryCount = ` SELECT count(*) as totalCount from bank_details ${where} `;
    query += ` order by createdAt desc ${limit ? `limit ${offset},${limit}` : ""} `;
    const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    const totalCount = await sequelize.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    return { results, totalCount: totalCount[0].totalCount };
}

const getBankDetailById = async (id) => {
    let bindParams = [id];
    let query = ` SELECT * FROM bank_details where id = (?) `;
    const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0];
}

const createBank = async (data) => {
    const { id, bank_nbfc_name, product, market_and_sub_type, state, city, company, login_code, location, sales_manager, sales_manager_mobile, sales_manager_email, sales_manager_code, assistant_sales_manager, assistant_sales_manager_mobile, assistant_sales_manager_email, regional_sales_manager, regional_sales_manager_mobile, regional_sales_manager_email, zonal_sales_manager, zonal_sales_manager_mobile, zonal_sales_manager_email, national_sales_manager, national_sales_manager_mobile, national_sales_manager_email, login_process, company_category_list, product_and_policy, branch_address, remark } = data;
    let query = "";
    let bindParams = [bank_nbfc_name || null, product || null, market_and_sub_type || null, state || null, city || null, company || null, login_code || null, location || null, sales_manager || null, sales_manager_mobile || null, sales_manager_email || null, sales_manager_code || null, assistant_sales_manager || null, assistant_sales_manager_mobile || null, assistant_sales_manager_email || null, regional_sales_manager || null, regional_sales_manager_mobile || null, regional_sales_manager_email || null, zonal_sales_manager || null, zonal_sales_manager_mobile || null, zonal_sales_manager_email || null, national_sales_manager || null, national_sales_manager_mobile || null, national_sales_manager_email || null, login_process || null, company_category_list || null, product_and_policy || null, branch_address || null, remark || null, new Date(), new Date()];
    if (id) {
        query = ` update bank_details set bank_nbfc_name=?, product=?, market_and_sub_type=?, state=?, city=?, company=?, login_code=?, location=?, sales_manager=?, sales_manager_mobile=?, sales_manager_email=?, sales_manager_code=?, assistant_sales_manager=?, assistant_sales_manager_mobile=?, assistant_sales_manager_email=?, regional_sales_manager=?, regional_sales_manager_mobile=?, regional_sales_manager_email=?, zonal_sales_manager=?, zonal_sales_manager_mobile=?, zonal_sales_manager_email=?, national_sales_manager=?, national_sales_manager_mobile=?, national_sales_manager_email=?, login_process=?, company_category_list=?, product_and_policy=?, branch_address=?, remark=?, updatedAt=? where id = ${id} `
    } else {
        query = ` insert into bank_details (bank_nbfc_name, product, market_and_sub_type, state, city, company, login_code, location, sales_manager, sales_manager_mobile, sales_manager_email, sales_manager_code, assistant_sales_manager, assistant_sales_manager_mobile, assistant_sales_manager_email, regional_sales_manager, regional_sales_manager_mobile, regional_sales_manager_email, zonal_sales_manager, zonal_sales_manager_mobile, zonal_sales_manager_email, national_sales_manager, national_sales_manager_mobile, national_sales_manager_email, login_process, company_category_list, product_and_policy, branch_address, remark, createdAt, updatedAt) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) `;
    }
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    return;
}

const deleteBankById = async (id) => {
    let query = ` delete from  bank_details where id = ? `;
    let bindParams = [id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.DELETE });
    return;
}

const submitClaimBankFile = async (id, dsa_mobile) => {
    let query = `select rdb.id, rdb.customer_name as borrowerFullName, rdb.customer_first_name as borrowerFirstName, rdb.customer_last_name as borrowerLastName, rdb.disbursement_date as disbursementDate, rdb.disbursement_amount as disbursementAmount, rdb.city, rdb.bank_nbfc_name as bankName, rdb.product as productName, rdb.apac_loan_number as apacRefLosNumber, rdb.bank_payout_rate as bankPayoutRate from ru_dsa_bank_files rdb where id = (?)`;
    let bindParams = [id];
    let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    query = `select payout_percentage as dsaGlobalPayout from dsa_global_payouts_percentage where phone = ?`;
    // bindParams = ["9838089784"];
    bindParams = [dsa_mobile];
    let globalPayout = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    let date = new Date();
    let claimMonth = `${date.toLocaleDateString('en-us', { month: "long" })} ${date.getFullYear()}`;

    if (data[0]?.bankPayoutRate && data[0].disbursementDate) {
        data[0].bankPayoutRate = data[0]?.bankPayoutRate?.replace("%", "");
        let dateArr = data[0].disbursementDate.split("-");
        data[0].disbursementDate = `${dateArr[2]}-${dateArr[1]}-${dateArr[0]}`;
    };

    return ({
        ...data[0],
        dsaGlobalPayout: `${globalPayout[0]?.dsaGlobalPayout || 0}`,
        dsaMobileNumber: dsa_mobile,
        claimMonth,
        borrowerCompanyName: "",
    });
};

const updateClaimBankFile = async (id) => {
    let query = `update ru_dsa_bank_files set claimed = 1 where id = ?`;
    let bindParams = [id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
};

const getStateForBankFiles = async (id) => {
    let query = ` select distinct state, city from ru_dsa_bank_files `;
    let bindParams = [id];
    let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return data;
};

const getBankForBankFiles = async (id) => {
    let query = ` select distinct bank_nbfc_name from ru_dsa_bank_files `;
    let bindParams = [id];
    let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return data;
};

const getProductForBankFiles = async (id) => {
    let query = ` select distinct product from ru_dsa_bank_files `;
    let bindParams = [id];
    let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return data;
};

const getBankFiles = async (offset, limit, where, is_tentative = 0) => {
    const tableName = is_tentative === 1 ? 'ru_dsa_tentative_bank_files' : 'ru_dsa_bank_files';
    let query = ` select id, bank_file_id, net_payout, amount, claim_month, bank_payout_rate, subvention_percentage, remark1, internal_id, loan_number, apac_loan_number, cust_id, bank_nbfc_name, customer_name, customer_first_name, customer_last_name, disbursement_date, disbursement_amount, product, sub_product, case when claimed in ("No", 0) then 0 else 1 end as claimed, vendor_claim, city, subsidiary, state, processed, amount, GST, total, bill_no, bill_date, bank_remark from ${tableName} ${where || ""} `;
    let queryCount = `select count(*) as count from ${tableName} ${where || ""} `;
    query += ` order by created_at desc `;
    if (limit) {
        query += ` limit ${offset},${limit} `;
    }
    let bank_files = [];
    let totalCount = [{ count: 0 }];

    if (where?.length) {
        bank_files = await _db2.query(query, { type: QueryTypes.SELECT });
        totalCount = await _db2.query(queryCount, { type: QueryTypes.SELECT });
    }

    return { bank_files, totalCount: totalCount[0]?.count };
};

const getBankFileLogs = async (offset, limit, where) => {
    let query = ` select l.id, l.user_id, l.api, l.api_type, l.header, l.payload, l.response, l.error_message, l.has_error, l.created_at, u.name, u.email, u.phone, l.updated_at from external_api_logs l left join users u on bin_to_uuid(u.id) = l.user_id ${where || ""} `;
    let queryCount = `select count(*) as count from external_api_logs l left join users u on bin_to_uuid(u.id) = l.user_id ${where || ""} `;
    query += ` order by l.created_at desc `;
    if (limit) {
        query += ` limit ${offset},${limit} `;
    }
    let bank_file_logs = [];
    let totalCount = [{ count: 0 }];

    if (where?.length) {
        bank_file_logs = await sequelize.query(query, { type: QueryTypes.SELECT });
        totalCount = await sequelize.query(queryCount, { type: QueryTypes.SELECT });
    }

    return { bank_file_logs, totalCount: totalCount[0]?.count };
};

const getBankFileDetail = async (bank_file_id, is_tentative = 0) => {
    const tableName = is_tentative === 1 ? 'ru_dsa_tentative_bank_files' : 'ru_dsa_bank_files';
    let query = ` select * from ${tableName} where bank_file_id = ? `;
    let bindParams = [bank_file_id];
    let bank_file = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return bank_file[0];
};

const createOrEditBranchSalePeople = async (data) => {
    const { id, pincode, city, code, sp_id, sp_name, sp_email, sp_mobile, product_id, created_by, updated_by } = data;
    let query;
    let bindParams;
    if (id) {
        query = ` update ru_branch_sales_people set pincode=?, city=?, code=?, sp_id=?, sp_name=?, sp_email=?, sp_mobile=?, product_id=?, updated_by=?, updated_at=${IST_NOW_SQL} where id = ? `;
        bindParams = [pincode, city, code, sp_id, sp_name, sp_email, sp_mobile, product_id, updated_by, id];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    } else {
        query = ` insert into ru_branch_sales_people (pincode, city, code, sp_id, sp_name, sp_email, sp_mobile, product_id, created_by, updated_by, created_at, updated_at) values (?,?,?,?,?,?,?,?,?,?, ${IST_NOW_SQL}, ${IST_NOW_SQL}) `;
        bindParams = [pincode, city, code, sp_id, sp_name, sp_email, sp_mobile, product_id, created_by, updated_by];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }
    return;
};

const getAllBranchSalePeople = async (offset, limit, where) => {
    let query = `select * from ru_branch_sales_people ${where} `;
    let queryCount = `select count(id) as count from ru_branch_sales_people ${where} `;

    query += ` order by DATE(created_at) asc limit ${offset}, ${limit}`;

    let data = await _db2.query(query, { type: QueryTypes.SELECT });
    let totalCount = await _db2.query(queryCount, { type: QueryTypes.SELECT });

    return { records: data, totalCount: totalCount[0]?.count };
};

const deleteBranchSalePeopleById = async (id) => {
    let query = ` delete from ru_branch_sales_people where id = ? `;
    await _db2.query(query, { replacements: [id], type: QueryTypes.DELETE });
    return;
};

const createOrUpdateNetsuiteBank = async (data, prevData, userId) => {
    const { netsuite_bank_id, bank_name, id, status, registered_on_company_name, pan, grade, external_id, remarks } = data;
    let query;
    let bindParams;
    let result;

    if (!id) {
        query = ` insert into ru_netsuite_banks (netsuite_bank_id, bank_name, status, registered_on_company_name, pan, grade, external_id, remarks, created_at , updated_at) values (?,?,?,?,?,?,?,?,?,?) `;
        bindParams = [netsuite_bank_id, bank_name, status, registered_on_company_name, pan, grade, external_id, remarks, new Date(), new Date()];
        result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
        query = `insert into application_logs (application_id, application_type, field, createdAt, updatedAt , updated_by) values (?,?,?,?,?,UUID_TO_BIN(?)) `;
        bindParams = [netsuite_bank_id, "new_netsuite_bank", "netsuite_bank_id", new Date(), new Date(), userId];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
        return result;
    } else {
        query = `update ru_netsuite_banks set bank_name=?, netsuite_bank_id = ?, status = ?, registered_on_company_name = ? , pan = ? , grade = ? , external_id = ? , remarks=?, updated_at=? where id = ? `;
        bindParams = [bank_name, netsuite_bank_id, status, registered_on_company_name, pan, grade, external_id, remarks, new Date(), id];
        result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
        query = `update ru_bank_product_combinations set bank_id = ? where bank_id in (?)`;
        bindParams = [netsuite_bank_id, prevData?.netsuite_bank_id];
        result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
        return result;
    }
};

const getNetsuiteBankById = async (id) => {
    let query = `select id, netsuite_bank_id , bank_name , registered_on_company_name, external_id , pan , status , grade , remarks from ru_netsuite_banks where id = ?`
    let result = await _db2.query(query, { replacements: [id], type: QueryTypes.SELECT });
    return result[0] || null
}

const getAllBankProductDetails = async (slab_internal_id) => {
    // Shows one specific NetSuite sync period's details, identified by its own unique
    // slab_internal_id (ns_customer_slab_id) — not "the latest period for this bank+product".
    // Each row in the admin grid is a period, and this is that row's detail view.
    let query = `
        SELECT
            nb.bank_name,
            np.product_name,
            bpc.id,
            bpc.bank_id,
            bpc.product_id,
            bpc.max_payout_capping,
            d.login_code,
            d.payout_process,
            d.remarks,
            d.enrollment_date,
            d.agreement_expired_by,
            d.billing_mode,
            d.billing_date_from,
            d.billing_date_to,
            d.payout_type,
            d.avg_achievment,
            d.gst_on_payout,
            d.payment_term,
            d.minimum_pf,
            d.minimum_irr,
            d.minimum_insurance,
            d.ref_link,
            bpc.status,
            d.billing_email,
            d.penalty_and_clause,
            bpc.max_payout_capping,
            d.max_payout_amount,
            d.invoice_remark,
            d.product_and_policy,
            BIN_TO_UUID(bpc.bank_product_combinations_id) as bank_product_combinations_id,
            d.ns_customer_slab_id as slab_internal_id,
            d.ns_status,
            d.application_renewed,
            bpc.updated_at,
            d.minimum_tenure,
            d.payout_contact_no,
            d.final_billing_date,
            d.contact_number_billing,
            d.applicable_till,
            d.applicable_from,
            d.company_name,
            d.bank_category,
            d.product_category,
            bpc.b2b_login_enable,
            bpc.login_link,
            bpc.bank_logo,
            bpc.lender_partner_page,
            bpc.privacy_policy_url,
            bpc.official_website,
            bpc.gro_name,
            bpc.gro_contact_number,
            bpc.gro_email_id,
            bpc.gro_description,
            d.payout_slabs as payout_slabs
        FROM ru_bank_product_combination_details d
        LEFT JOIN ru_bank_product_combinations bpc ON bpc.bank_product_combinations_id = d.bank_product_combinations_id
        LEFT JOIN ru_netsuite_banks nb ON nb.netsuite_bank_id = bpc.bank_id
        LEFT JOIN ru_netsuite_products np ON np.netsuite_product_id = bpc.product_id
        WHERE d.ns_customer_slab_id = ?
    `;
    let bindParams = [slab_internal_id];
    let result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    if (result[0]) {
        result[0].payout_slabs = result[0].payout_slabs ? result[0].payout_slabs : [];
    }
    return result[0] || null;
}

// Every synced NetSuite period for one bank+product identity — the current period first
// (latest Active one, else latest overall; same rule as the grid's LATERAL join), then the
// rest newest first. Powers the detail page's history sidebar, which treats row 0 as current.
const getBankProductCombinationHistory = async (bank_product_combinations_id) => {
    let query = `
        SELECT
            d.ns_customer_slab_id as slab_internal_id,
            d.applicable_from,
            d.applicable_till,
            d.ns_status,
            d.avg_achievment,
            d.created_at
        FROM ru_bank_product_combination_details d
        WHERE d.bank_product_combinations_id = UUID_TO_BIN(?)
        ORDER BY (COALESCE(LOWER(TRIM(d.ns_status)), '') = 'active') DESC, d.created_at DESC, d.id DESC
    `;
    let bindParams = [bank_product_combinations_id];
    let result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return result;
}

// CRM-owned identity fields only - GRO/Lender details + offline-bank (B2B) config.
// Deliberately excludes every NetSuite-synced field (login_code, avg_achievment,
// enrollment_date, payout_*, minimum_*, applicable_*, billing_*, etc.) - those live
// on ru_bank_product_combination_details now and are owned by the webhook sync,
// never by manual CRM edit. See PLAN-0007 Task Log, 2026-09-01.
const updateBankProductGroDetails = async (data) => {
    const { bank_id, product_id, b2b_login_enable, login_link, bank_logo, lender_partner_page, privacy_policy_url, official_website, gro_name, gro_contact_number, gro_email_id, gro_description } = data;

    const query = ` UPDATE ru_bank_product_combinations SET b2b_login_enable = ?, login_link = ?, bank_logo = ?, lender_partner_page = ?, privacy_policy_url = ?, official_website = ?, gro_name = ?, gro_contact_number = ?, gro_email_id = ?, gro_description = ?, updated_at = ? WHERE bank_id = ? AND product_id = ? `;

    const bindParams = [b2b_login_enable || 0, login_link || null, bank_logo || null, lender_partner_page || null, privacy_policy_url || null, official_website || null, gro_name || null, gro_contact_number || null, gro_email_id || null, gro_description || null, new Date(), bank_id, product_id];

    const result = await _db2.query(query, {
        replacements: bindParams,
        type: QueryTypes.UPDATE
    });

    return result;
}

const updateBankProductStatus = async (data) => {
    const { bank_id, product_id, status } = data;

    const query = `UPDATE ru_bank_product_combinations SET status = ?, updated_at = ? WHERE bank_id = ? AND product_id = ?`;

    const bindParams = [status, new Date(), bank_id, product_id];

    const result = await _db2.query(query, {
        replacements: bindParams,
        type: QueryTypes.UPDATE
    });

    return result;
}

const getBankProductCombinationByNetsuiteIds = async (bank_id, product_id) => {
    const query = `SELECT id, BIN_TO_UUID(bank_product_combinations_id) as bank_product_combinations_id, autonomous_payout_capping, max_payout_capping FROM ru_bank_product_combinations WHERE bank_id = ? AND product_id = ? LIMIT 1`;
    const result = await _db2.query(query, {
        replacements: [bank_id, product_id],
        type: QueryTypes.SELECT
    });
    return result[0] || null;
};

const updateAutonomousPayoutCapping = async (data) => {
    const { bank_id, product_id, autonomous_payout_capping } = data;
    const query = `UPDATE ru_bank_product_combinations SET autonomous_payout_capping = ?, updated_at = ? WHERE bank_id = ? AND product_id = ?`;
    const bindParams = [autonomous_payout_capping, new Date(), bank_id, product_id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
};

const checkBankProductLock = async (bank_nbfc_id, product_id) => {
    let productIds = await getBankProductCombinationByBankId(bank_nbfc_id, true);

    if (!productIds || !productIds.totalRecords) {
        return false;
    };

    productIds = productIds.records.map(product => product.netsuite_product_id);
    return productIds.includes(product_id.toString());
};

// ── Bank Maste below file names are from npci portal ──────────────────────────────────────────────────────────────

const DEFAULT_BANK_FILES = [
    { file: 'All_Members_IMPS_banks-live-on-imps.xlsx.xlsx', category: 'Scheduled' },
    { file: 'All_Members_IMPS_banks-live-on-imps-co-operative-banks.xlsx.xlsx', category: 'Co-operative' },
    { file: 'All_Members_IMPS_banks-live-on-imps-foreign-banks.xlsx.xlsx', category: 'Foreign' },
    { file: 'All_Members_IMPS_banks-live-on-imps-rrb-s.xlsx.xlsx', category: 'RRB' },
    { file: 'All_Members_IMPS_small-finance-banks.xlsx.xlsx', category: 'Small Finance' },
];

const upsertBankToMaster = async (bankName, category, now) => {
    const cleanName = (bankName || '').replace(/\t/g, '').trim();
    if (!cleanName) return false;

    const query = `
        INSERT INTO ru_bank_master
            (bank_name, bank_category, is_active, created_at, updated_at)
        VALUES (?, ?, 1, ?, ?)
        ON DUPLICATE KEY UPDATE
            bank_category = VALUES(bank_category),
            is_active = 1,
            updated_at = VALUES(updated_at)
    `;

    await _db2.query(query, {
        replacements: [cleanName, category || null, now, now],
        type: QueryTypes.INSERT,
    });

    return true;
};

const importBankMaster = async (data = {}) => {
    const { file_name, bank_category, base64 } = data || {};
    const now = new Date();
    let importedCount = 0;
    let totalRows = 0;

    if (base64 || file_name) {
        let workbook;
        if (base64) {
            const buf = Buffer.from(base64, 'base64');
            workbook = xlsx.read(buf, { type: 'buffer' });
        } else {
            let filePath = file_name;
            if (!fs.existsSync(filePath)) {
                //this path will be removed in production
                let localPath = '/Users/NS-MAC-034/Downloads/banks_to_import';
                filePath = path.join(localPath, file_name);
            }
            if (!fs.existsSync(filePath)) {
                filePath = path.join(process.cwd(), file_name);
            }
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${file_name}`);
            }
            workbook = xlsx.readFile(filePath);
        }

        const sheetName = workbook.SheetNames[0];
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        totalRows = rows ? rows.length : 0;

        for (const row of rows || []) {
            const bankName = row['Bank Name'] || row['Bank Name\t'] || row['bank_name'] || row['BankName'] || '';
            const success = await upsertBankToMaster(bankName, bank_category, now);
            if (success) importedCount++;
        }
    } else {
        const dir = '/Users/NS-MAC-034/Downloads/banks_to_import';

        for (const item of DEFAULT_BANK_FILES) {
            const filePath = path.join(dir, item.file);
            if (!fs.existsSync(filePath)) continue;

            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
            totalRows += rows ? rows.length : 0;

            for (const row of rows || []) {
                const bankName = row['Bank Name'] || row['Bank Name\t'] || row['bank_name'] || row['BankName'] || '';
                const success = await upsertBankToMaster(bankName, item.category, now);
                if (success) importedCount++;
            }
        }
    }

    return { importedCount, totalRows };
};

const getBankMasterDropdown = async (search = null) => {
    let query = `
        SELECT id, bank_name, bank_category
        FROM ru_bank_master
        WHERE is_active = 1
    `;

    const replacements = [];

    if (search && search.trim()) {
        query += ` AND bank_name LIKE ? `;
        replacements.push(`%${search.trim()}%`);
    }

    query += ` ORDER BY bank_name ASC LIMIT 50 `;

    return await _db2.query(query, { replacements, type: QueryTypes.SELECT });
};

module.exports = {
    getDistinctSingleProperty,
    getBankDetail,
    updateMaxProductPayoutCap,
    deleteAllBanks,
    getAllBanks,
    getBankDetailById,
    createBank,
    deleteBankById,
    submitClaimBankFile,
    getBankFiles,
    getStateForBankFiles,
    updateClaimBankFile,
    getBankForBankFiles,
    getBankFileDetail,
    getProductForBankFiles,
    getBankFileLogs,
    createOrEditBranchSalePeople,
    getAllBranchSalePeople,
    deleteBranchSalePeopleById,
    addBankProductCombination,
    getBankProductCombinationByBankId,
    getMatchingProductsByLoanOrApac,
    addBankProductCombinationRegex,
    getBankProductCombinationRegex,
    createOrUpdateNetsuiteBank,
    getNetsuiteBankById,
    getAllBankProductDetails,
    getBankProductCombinationHistory,
    updateBankProductGroDetails,
    updateBankProductStatus,
    getBankProductCombinationByNetsuiteIds,
    updateAutonomousPayoutCapping,
    checkBankProductLock,
    // Bank Master
    importBankMaster,
    getBankMasterDropdown,
};


const { sequelize, _db2 } = require('../../models');
const { QueryTypes } = require('sequelize');
const { formatSignupDate, toIsoDateIST } = require('../helpers/commonhelper');
const { sqlPreferredBankAccountJoinByDsaId } = require('../helpers/apiFieldMappings');
const { logger } = require('../helpers/logger');
const { IST_NOW_SQL } = require('../helpers/sql-time');
const { v4: uuid } = require('uuid');
const client = require('../helpers/redis-client');
const useragent = require('useragent');
const { connectKafkaProducer, sendToKafkaEngine, SMSSendNotificationEngine } = require('./kafka-services');

/** Parses a raw user-agent string into a structured { browser, os, platform, raw } shape. */
const parseUserAgent = (userAgentString) => {
    if (!userAgentString) return null;
    const agent = useragent.parse(userAgentString);
    return {
        browser: agent?.toAgent() || null,
        os: agent?.os?.toString() || null,
        platform: agent?.platform || null,
        device: agent?.device?.toString() || null,
        raw: userAgentString
    };
};

const CUSTOMER_MOBILE_EXT_OTP_TYPE = 'customer_mobile_ext';
const CUSTOMER_MOBILE_OTP_EXPIRY_SECONDS = 300;
const CUSTOMER_MOBILE_REDIS_TTL = 300;

const customerMobileRedisStepKey = (customerId) => `cust_mob_ext:step:${customerId}`;
const customerMobileRedisNewKey = (customerId) => `cust_mob_ext:new:${customerId}`;

const isCustomerMobileOtpExpired = (updatedAt) => {
    const otpTime = new Date(updatedAt);
    return new Date(otpTime.getTime() + CUSTOMER_MOBILE_OTP_EXPIRY_SECONDS * 1000) <= new Date();
};

const isValidCustomerMobile = (mobile) => /^\d{10}$/.test(String(mobile || ''));

/** Logs mobile number change to application_logs. Failures are swallowed so OTP flow is not blocked. */
const logCustomerMobileNumberChange = async ({ customer_id, from_value, to_value, updated_by, ip }) => {
    if (String(from_value || '') === String(to_value || '')) return;
    try {
        const hasActor = updated_by && updated_by !== 'external';
        const updatedByExpr = hasActor ? "UNHEX(LPAD(REPLACE(?,'-',''),32,'0'))" : 'NULL';
        const clientIp = ip ? String(ip).replace(/^::ffff:/, '').slice(0, 45) : null;
        const query = `INSERT INTO application_logs
            (application_type, application_id, field, from_value, to_value, updated_by, is_external, ip)
            VALUES ('customer', ?, 'customer_mobile_number', ?, ?, ${updatedByExpr}, 1, ?)`;
        const replacements = hasActor
            ? [customer_id, from_value || null, to_value, updated_by, clientIp]
            : [customer_id, from_value || null, to_value, clientIp];
        await sequelize.query(query, { replacements, type: QueryTypes.INSERT });
    } catch (e) {
        logger.error('Failed to log customer mobile number change', e);
    }
};
const { updateOrCreateRMUser } = require('./user-services');
const { processSplitCaseFiles } = require('./dsa-services');
const { sendBankerDisbursalConfirmationEmail } = require('./banker-email-service');

const db = require('../../models');
const { checkIfLoanAndApacNumberIsValid, checkIfFreshLeadExist, checkIfDuplcateLeadExist, validateBusinessCategory, additionalLeadFormValidation, checkNsContestIdExists, onlineLeadCheck, deriveClaimMonthFromDisbDate, validateDisbursementDate, validateProductBusinessCategory, insertOrUpdateLeadMeta, isConfirmationMailAllowedForProductId, getMaxDisbursementAmountMessage } = require('./finance-services');

const getLoanCatalogRef = () => {
    const dbName = process.env.ENVIRONMENT === "dev" ? "ruloans-service" : "RUService";
    return _db2.getQueryInterface().quoteIdentifier(dbName);
};


exports.getCustomerDetailsLeadForm = async (data) => {
    const { customer_mobile_number, pan } = data;
    let query = ` select kyc.netsuite_vendor_id, c.is_mobile_number_verified as otp_verified, c.dsa_mobile_number, d.full_name as dsa_name, c.customer_id, c.customer_mobile_number, c.permanent_account_number, c.first_name, c.middle_name, c.last_name, c.father_full_name, c.mother_full_name, c.email_address, c.date_of_birth from ru_customers c left join ru_direct_selling_agents d on c.dsa_mobile_number = d.dsa_mobile_number left join ru_dsa_kyc_data kyc on kyc.dsa_id = d.dsa_id where (c.permanent_account_number=? or c.customer_mobile_number=?) `;
    let bindParams = [pan, customer_mobile_number];
    let user = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT, useMaster: true });

    user = user[0] || null;

    if (user) {
        query = ` select id, address_type_id as address_type, address_line_1 as house_number, address_line_2 as apartment_name, address_line_3 as area, pin_code as pincode, state, city from ru_customer_addresses where customer_id=? `;
        bindParams = [user?.customer_id];
        let address = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT, useMaster: true });
        user["address"] = address;

        // Include the mapped office address so the lead form's "existing company" list can show
        // the full saved address, not just the company name. Pick the latest mapping per company
        // (a company can have more than one address mapping) so we still return one row per company.
        query = ` select rc.*,
                a.address_type_id as office_address_type,
                a.address_line_1 as office_house_number,
                a.address_line_2 as office_apartment_name,
                a.address_line_3 as office_area,
                a.pin_code as office_pincode,
                a.city as city,
                a.state as state
            from ru_customer_companies rc
            left join (
                select m1.customer_company_id, m1.company_address_id
                from ru_customer_company_address_mappings m1
                join (
                    select customer_company_id, max(id) as max_id
                    from ru_customer_company_address_mappings
                    group by customer_company_id
                ) m2 on m2.customer_company_id = m1.customer_company_id and m2.max_id = m1.id
            ) rcm on rcm.customer_company_id = rc.id
            left join ru_customer_addresses a on a.id = rcm.company_address_id
            where rc.customer_id=? `;
        bindParams = [user?.customer_id];
        let company = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT, useMaster: true });
        user["company"] = company;

        query = ` select * from ru_fresh_lead_claims rc where rc.customer_id=? and request_date is null `;
        bindParams = [user?.customer_id];
        let fresh_lead = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT, useMaster: true });
        user["fresh_lead_id"] = fresh_lead[0]?.fresh_lead_id;
    };

    return user;
};

exports.createCustomerWithPan = async (data) => {
    const { customer_mobile_number, pan } = data;
    query = ` insert into ru_customers (customer_id, customer_mobile_number, permanent_account_number, customer_created_date, source_from) values(?,?,?,?,4) `;
    bindParams = [uuid(), customer_mobile_number, pan, formatSignupDate(new Date())];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    return;
};

exports.createCustomerUuid = async (data) => {
    const { customer_mobile_number, pan } = data;
    query = ` update ru_customers set customer_id = ? where (customer_mobile_number=? and permanent_account_number=?) `;
    bindParams = [uuid(), customer_mobile_number, pan];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return;
};

exports.createCustomerBasicDetails = async (data) => {
    const { dsa_id, otp_verified, is_consent, customer_id, fresh_lead_id, dsa_mobile_number, first_name, middle_name, last_name, father_name, mother_name, email, dob, customer_mobile_number, pan, created_by, platform } = data;
    let full_name = `${first_name}${middle_name ? ` ${middle_name}` : ""} ${last_name}`;

    let father = father_name?.length ? father_name.split(" ") : [];
    let father_first_name = father[0] || null;
    let father_middle_name = father[1] || null;
    let father_last_name = father[2] || null;

    let mother = mother_name?.length ? mother_name.split(" ") : [];
    let mother_first_name = mother[0] || null;
    let mother_middle_name = mother[1] || null;
    let mother_last_name = mother[2] || null;

    let query = ` update ru_customers set dsa_mobile_number=?, full_name=?, first_name=?, middle_name=?, last_name=?, father_full_name=?, mother_full_name=?, email_address=?, date_of_birth=?, is_mobile_number_verified=?, father_first_name=?, father_middle_name=?, father_last_name=?, mother_first_name=?, mother_middle_name=?, mother_last_name=? where customer_id=? `;
    let bindParams = [dsa_mobile_number, full_name, first_name, middle_name, last_name, father_name, mother_name, email, dob?.split("T")[0], otp_verified, father_first_name, father_middle_name, father_last_name, mother_first_name, mother_middle_name, mother_last_name, customer_id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });


    if (!fresh_lead_id) {
        let newFreshLeadId = uuid();
        query = ` insert into ru_fresh_lead_claims (fresh_lead_id, dsa_id ,customer_id, customer_mobile_number, customer_full_name, customer_first_name, customer_middle_name, customer_last_name, dsa_mobile_number , form_type , created_by , platform ) values(?,?,?,?,?,?,?,?,?,?,?,?) `;
        bindParams = [newFreshLeadId, dsa_id, customer_id, customer_mobile_number, full_name, first_name, middle_name, last_name, dsa_mobile_number, "customer_lead_form", created_by, platform];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

        // Insert into ru_fresh_lead_claims_meta
        query = `insert into ru_fresh_lead_claims_meta(fresh_lead_id, is_tentative_matched, tentative_bank_file_id, is_consent, created_at, updated_at) values(?,?,?,?,?,?)`;
        bindParams = [newFreshLeadId, 0, null, is_consent, new Date(), new Date()];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    } else {
        query = ` update ru_fresh_lead_claims set customer_id=?, dsa_id =?, customer_mobile_number=?, customer_full_name=?, customer_first_name=?, customer_middle_name=?, customer_last_name=?, dsa_mobile_number=? , form_type = ? where fresh_lead_id=? `;
        bindParams = [customer_id, dsa_id, customer_mobile_number, full_name, first_name, middle_name, last_name, dsa_mobile_number, "customer_lead_form", fresh_lead_id];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });

        // Update ru_fresh_lead_claims_meta
        query = `UPDATE ru_fresh_lead_claims_meta SET is_consent = ?, updated_at = ? WHERE fresh_lead_id = ?`;
        bindParams = [is_consent, new Date(), fresh_lead_id];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    };

    return;
};

exports.createCustomerAddressDetails = async (data) => {
    let { id, customer_id, fresh_lead_id, address_type, house_number, apartment_name, area, pincode, state, city } = data;

    let query;
    let bindParams;

    if (!id) {
        query = ` insert into ru_customer_addresses (customer_id, address_type_id, address_line_1, address_line_2, address_line_3, pin_code, city, state) values (?,?,?,?,?,?,?,?) `;
        bindParams = [customer_id, address_type, house_number, apartment_name, area, pincode, state, city];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

        query = ` select * from ru_customer_addresses where customer_id=? and address_type_id=? and address_line_1=? and address_line_2=? and address_line_3=? and pin_code=? and city=? and state=? `;
        let user = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT, useMaster: true });

        id = user[0]?.id;
    };

    query = ` update ru_fresh_lead_claims set customer_residential_address_id=? where fresh_lead_id=? `;
    bindParams = [id, fresh_lead_id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });

    return;
};

exports.createCustomerCompanyDetails = async (data) => {
    let { fresh_lead_id, id, customer_id, profession_type, company_name, monthly_income, office_address_type, office_house_number, office_apartment_name, office_area, office_pincode, state, city, customer_mobile_number } = data;

    let query;
    let bindParams;
    let address_id;

    if (!id) {
        // save address
        query = ` insert into ru_customer_addresses (customer_id, address_type_id, address_line_1, address_line_2, address_line_3, pin_code, city, state) values (?,?,?,?,?,?,?,?) `;
        bindParams = [customer_id, office_address_type, office_house_number, office_apartment_name, office_area, office_pincode, state, city];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

        query = ` select * from ru_customer_addresses where customer_id=? and address_type_id=? and address_line_1=? and address_line_2=? and address_line_3=? and pin_code=? and city=? and state=? `;
        let address = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT, useMaster: true });

        address_id = address[0]?.id;

        // save company
        query = ` insert into ru_customer_companies (customer_id, company_name) values (?,?) `;
        bindParams = [customer_id, company_name];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

        query = ` select * from ru_customer_companies where customer_id=? and company_name=? `;
        let company = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT, useMaster: true });

        let company_id = company[0]?.id;

        // save company address mapping
        query = ` insert into ru_customer_company_address_mappings (customer_company_id, company_address_id) values (?,?) `;
        bindParams = [company_id, address_id];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

        // save income details
        query = ` insert into ru_customer_income_details (income_id, customer_id, customer_mobile_number, customer_company_id, employee_type, monthly_income) values (?,?,?,?,?,?) `;
        bindParams = [uuid(), customer_id, customer_mobile_number, company_id, profession_type, monthly_income];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    } else {
        query = ` select rc.company_name, rcm.company_address_id from ru_customer_companies rc left join ru_customer_company_address_mappings rcm on rcm.customer_company_id = rc.id where rc.id = ? `;
        bindParams = [id];
        let address = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT, useMaster: true });
        address_id = address[0]?.company_address_id || null;
        company_name = address[0]?.company_name || null;
    }

    query = ` update ru_fresh_lead_claims set customer_company_address_id=?, customer_company_name=? where fresh_lead_id=? `;
    bindParams = [address_id, company_name, fresh_lead_id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });

    return;
};

exports.createCustomerLoanDetails = async (data) => {
    let { netsuite_vendor_id, loggedInUser, fresh_lead_id, dsa_mobile_number, product_name, product_id, bank_name, bank_id, claim_month, claim_year, loan_number, apac_ref_los_number, loan_amount, status, user_remarks, disbursement_amount, disbursement_date, reject_reason, business_categories, is_split_case, regexPattern, vendor_remark, ns_contest_id } = data;

    let { confirmation_required, cc_email, expected_billing_month, banker_name, banker_email, banker_mobile, asm_name, asm_email, asm_mobile, city } = data;

    let errorMsg = null;

    const is_confirmation_mail_allowed = await isConfirmationMailAllowedForProductId(product_id);
    if (confirmation_required && !is_confirmation_mail_allowed) {
        return { errorMsg: "Banker confirmation Mails are not allowed for this product" };
    }

    if (status === "disbursed") {
        if (!claim_month) {
            errorMsg = `Claim Month is Required in Disbursed Cases `
            return { errorMsg }
        }
        if (!confirmation_required && Boolean(!loan_number || !apac_ref_los_number)) {
            errorMsg = `Loan number and apac/ref/los number is required in Disbursed Cases when confirmation required is false`
            return { errorMsg }
        }
        if (is_split_case && !disbursement_date) {
            errorMsg = `Disbursement Date is Mandatory in split cases`
            return { errorMsg }
        }
    }

    const disbursement_date_iso = toIsoDateIST(disbursement_date);
    if (disbursement_date_iso) {
        const isDisursementDateValid = validateDisbursementDate(disbursement_date_iso)
        if (!isDisursementDateValid.isValid) {
            errorMsg = isDisursementDateValid.message;
            return { errorMsg }
        }
    }

    const maxDisbursementMsg = await getMaxDisbursementAmountMessage({
        netsuite_bank_id: bank_id,
        netsuite_product_id: product_id,
        disbursement_amount,
        disbursement_date_iso
    });
    if (maxDisbursementMsg) {
        return { errorMsg: maxDisbursementMsg }
    }
    //extacting claim month from disbursement date
    claim_month = deriveClaimMonthFromDisbDate(disbursement_date_iso);
    const request_date_iso = new Date().toISOString().split('T')[0];

    let banker_id = banker_mobile ? await updateOrCreateRMUser({ city, email: banker_email, phone: banker_mobile, name: banker_name, netsuite_bank_id: bank_id, product_id, logged_in_user_id: loggedInUser?.id }) : null;
    let asm_id = asm_mobile ? await updateOrCreateRMUser({ city, email: asm_email, phone: asm_mobile, name: asm_name, netsuite_bank_id: bank_id, product_id, logged_in_user_id: loggedInUser?.id }) : null;

    let existingDataQuery = `SELECT flc.dsa_id, rdsa.full_name as vendor_name, rdsa.email_address as vendor_email, rdsa.dsa_mobile_number as vendor_phone, flc.customer_first_name , flc.customer_last_name , flc.customer_company_name , flc.city , k.ns_hierarchy , k.permanent_account_number , rdsa.business_head_code , k.class_id , rdsa.materialized_path , rdsa.hierarchy_crm , p.dsa_id as partner_id , ba.account_number, ba.status as account_status FROM ru_fresh_lead_claims flc left join ru_direct_selling_agents rdsa on flc.dsa_id = rdsa.dsa_id left join ru_dsa_kyc_data k on flc.dsa_id = k.dsa_id ${sqlPreferredBankAccountJoinByDsaId("ba", "flc.dsa_id")} left join ru_direct_selling_agents p  on rdsa.partner_code = p.dsa_mobile_number WHERE flc.fresh_lead_id = ?`;
    let existingData = await _db2.query(existingDataQuery, {
        replacements: [fresh_lead_id],
        type: QueryTypes.SELECT,
    });

    if (!existingData || !existingData.length) {
        errorMsg = 'Missing Lead Previous Entries'
        return { errorMsg }
    }

    let { customer_first_name, customer_last_name, dsa_id, vendor_name, vendor_email, vendor_phone, permanent_account_number, ns_hierarchy, customer_company_name, business_head_code, class_id, hierarchy_crm, partner_id, materialized_path, account_number, account_status } = existingData[0]

    // Check if ns_contest_id exists in ru_events
    if (ns_contest_id) {
        const { isValid, message } = await checkNsContestIdExists(ns_contest_id, 'lead_form_contest', disbursement_date);
        if (!isValid) {
            errorMsg = message;
            return { errorMsg };
        }
    }

    let isDuplicate = null
    if (disbursement_amount && bank_id) {
        isDuplicate = await checkIfDuplcateLeadExist({
            first_name: customer_first_name,
            last_name: customer_last_name,
            disbursement_date_iso,
            disbursement_amount,
            netsuite_vendor_id,
            netsuite_product_id: product_id,
            netsuite_bank_id: bank_id,
            loan_reference_id: loan_number,
            loan_apac_ref_los_number: apac_ref_los_number,
            city,
            fresh_lead_id,
            dsa_id,
            business_categories
        });
    }

    if (loan_number && apac_ref_los_number) {

        const { error } = checkIfLoanAndApacNumberIsValid(regexPattern, loan_number, apac_ref_los_number);
        if (error) {
            return { errorMsg: error }
        }

        let isExist = await checkIfFreshLeadExist({
            loan_reference_id: loan_number,
            apac_ref_los_number,
            netsuite_bank_id: bank_id,
            netsuite_product_id: product_id,
        });

        if (isExist && !is_split_case) {
            errorMsg = `Some leads already exist in database with same apac/ref/los number`
            return { errorMsg }
        }
        else if (isExist) {
            /* if (!ns_hierarchy && permanent_account_number, dsa_id) {
                const nsResponse = await updateDsaNsHierarchy(permanent_account_number, dsa_id)
                if (nsResponse?.isValid) {
                    ns_hierarchy = nsResponse?.data?.class
                }
            } */

            isExist = await processSplitCaseFiles(isExist, disbursement_date_iso)

            //new business category logic
            const isBusinessCategoryValid = await validateBusinessCategory(isExist, {
                business_categories: business_categories,
                ns_hierarchy: ns_hierarchy,
                dsa_id: dsa_id,
                business_head_code: business_head_code
            })
            if (!isBusinessCategoryValid?.isValid) {
                errorMsg = isBusinessCategoryValid?.message;
                return { errorMsg }
            }
        }
    }
    const isAdditionalValidationSuccess = await additionalLeadFormValidation({ class_id, partner_id, account_number, account_status })
    if (!isAdditionalValidationSuccess?.isValid) {
        errorMsg = isAdditionalValidationSuccess?.message;
        return { errorMsg }
    }

    const productBusinessCategoryValidation = await validateProductBusinessCategory({
        netsuite_product_id: product_id,
        business_categories
    });
    if (!productBusinessCategoryValidation.isValid) {
        errorMsg = productBusinessCategoryValidation.message;
        return { errorMsg }
    }

    let query = ` update ru_fresh_lead_claims set netsuite_vendor_id=?, fresh_lead_status_id=?, product_name=?, bank_name=?, netsuite_bank_id=?, netsuite_product_id=?, claim_month=?, loan_reference_id=?, loan_apac_ref_los_number=?, loan_status=?, loan_amount=?, disbursement_amount=?, disbursement_date=?, disbursement_date_iso=?, reject_reason=?, request_date=?, request_date_iso=?, business_categories=?, is_split_case=?, multi_funded_flag=? , claim_pending_flag=? , current_hierarchy_crm =? , class_id=? , partner_id= ?, current_hierarchy_path=? , vendor_remark=?, ns_contest_id=? where fresh_lead_id=? `;

    // Check if this is an online lead using onlineLeadCheck
    let is_online_lead = false;
    if (loan_number && apac_ref_los_number) {
        ({ is_online_lead } = await onlineLeadCheck(product_name, dsa_id, loan_number, apac_ref_los_number, bank_id, product_id));
    }

    let bindParams = [netsuite_vendor_id, confirmation_required ? 13 : 0, product_name, bank_name, bank_id, product_id, claim_month, loan_number, apac_ref_los_number, status, loan_amount, disbursement_amount, disbursement_date ? formatSignupDate(disbursement_date) : null, disbursement_date_iso, reject_reason, formatSignupDate(new Date()), request_date_iso, business_categories, is_split_case ? "yes" : "no", isDuplicate ? 0 : -1, 0, hierarchy_crm || null, class_id || null, partner_id || null, materialized_path || null, vendor_remark || "", ns_contest_id || null, fresh_lead_id];

    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });

    await insertOrUpdateLeadMeta({
        fresh_lead_id,
        confirmation_required,
        cc_email,
        banker_email,
        user_email: loggedInUser?.userEmail,
        banker_id,
        asm_id,
        expected_billing_month,
        is_tentative_matched: 0,
        tentative_bank_file_id: null,
        is_bank_file_matched: 0,
        bank_file_id: null,
        is_online_lead: is_online_lead ? 1 : 0,
        isInsert: false
    });
    if (confirmation_required && is_confirmation_mail_allowed) {
        const emailData = { ...data, first_name: customer_first_name, last_name: customer_last_name, company_name: customer_company_name, city: existingData[0].city, disbursement_date_iso };
        await sendBankerDisbursalConfirmationEmail({ to: banker_email, cc: cc_email, data: emailData, leadId: fresh_lead_id, loggedInUser: loggedInUser?.id ? loggedInUser : { userName: vendor_name, userEmail: vendor_email, userPhone: vendor_phone } });
    }
    return true;
};

exports.updateLoanStatus = async (data) => {
    const { id, ...fields } = data;

    if (!id) {
        throw new Error("ID is required to update the loan status.");
    };

    // Start constructing the query
    let query = `UPDATE ru_fresh_lead_claims SET `;
    const setClauses = [];
    const bindParams = [];

    // Check for disbursement_date to derive claim_month
    if (fields.disbursement_date) {
        const disbursement_date_iso = toIsoDateIST(fields.disbursement_date);
        fields.claim_month = deriveClaimMonthFromDisbDate(disbursement_date_iso);
    }

    // Iterate over fields to dynamically build query and parameters
    Object.entries(fields).forEach(([key, value]) => {
        if (key === "disbursement_date" && value) {
            const disbursement_date_iso = toIsoDateIST(value);
            setClauses.push(`disbursement_date_iso=?`);
            // deriveClaimMonthFromDisbDate logic moved outside loop
            bindParams.push(disbursement_date_iso);
        }

        setClauses.push(`${key == "status" ? "loan_status" : key}=?`);
        bindParams.push(value);
    });

    // Add WHERE clause
    query += setClauses.join(", ") + ` WHERE id=?`;
    bindParams.push(id);

    // Execute the main query
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });

    // Select lead data using id
    let leadQuery = `SELECT fresh_lead_id, product_name, dsa_id, netsuite_bank_id, netsuite_product_id, loan_reference_id, loan_apac_ref_los_number FROM ru_fresh_lead_claims WHERE id = ?`;
    let leadResult = await _db2.query(leadQuery, { replacements: [id], type: QueryTypes.SELECT });

    if (leadResult.length > 0) {
        const leadData = leadResult[0];

        // Check if this is an online lead using onlineLeadCheck
        let is_online_lead = false;
        if (leadData.loan_reference_id && leadData.loan_apac_ref_los_number) {
            ({ is_online_lead } = await onlineLeadCheck(
                leadData.product_name,
                leadData.dsa_id,
                leadData.loan_reference_id,
                leadData.loan_apac_ref_los_number,
                leadData.netsuite_bank_id,
                leadData.netsuite_product_id
            ));
        }

        // Check if meta record exists for fresh_lead_id
        let checkMetaQuery = `SELECT fresh_lead_id FROM ru_fresh_lead_claims_meta WHERE fresh_lead_id = ?`;
        let metaResult = await _db2.query(checkMetaQuery, { replacements: [leadData.fresh_lead_id], type: QueryTypes.SELECT });

        const now = new Date();

        if (metaResult.length > 0) {
            // Update existing record
            let updateMetaQuery = `UPDATE ru_fresh_lead_claims_meta SET
                                   is_online_lead=?,
                                   updated_at=?
                                   WHERE fresh_lead_id=?`;

            let updateBindParams = [
                is_online_lead || 0,
                now,
                leadData.fresh_lead_id
            ];

            await _db2.query(updateMetaQuery, { replacements: updateBindParams, type: QueryTypes.UPDATE });
        } else {
            // Insert new record
            let insertMetaQuery = `INSERT INTO ru_fresh_lead_claims_meta
                                   (fresh_lead_id, is_tentative_matched, tentative_bank_file_id, is_bank_file_matched, bank_file_id, is_online_lead, created_at, updated_at)
                                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

            let insertBindParams = [
                leadData.fresh_lead_id,
                0,
                null,
                0,
                null,
                is_online_lead || 0,
                now,
                now
            ];

            await _db2.query(insertMetaQuery, { replacements: insertBindParams, type: QueryTypes.INSERT });
        }
    }
};

exports.updateLeadFormExternal = async (data) => {
    let { fresh_lead_id, loan_reference_id } = data;
    let query = ` update ru_fresh_lead_claims set loan_reference_id = ? where fresh_lead_id = ? `;
    let bindParams = [loan_reference_id, fresh_lead_id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return;
};

exports.getFreshLeadById = async (id, fresh_lead_id = false) => {
    let query = ` select rdsa.dsa_id , flc.business_categories, flc.loan_reference_id, flc.is_split_case, flc.loan_apac_ref_los_number, flc.netsuite_bank_id , flc.netsuite_product_id, flc.fresh_lead_id, flc.loan_status as status, flc.disbursement_amount, flc.disbursement_date, flc.reject_reason from ru_fresh_lead_claims flc left join ru_direct_selling_agents rdsa on rdsa.dsa_mobile_number = flc.dsa_mobile_number where ${!fresh_lead_id ? `flc.id = ?` : `flc.fresh_lead_id = ?`} `;
    let bindParams = [id];
    let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return data[0] || null;
};

exports.sendQueryReply = async (data) => {
    const { reply, id, reply_by, status } = data;
    let query = ` update ru_customer_queries set reply = ?, replied_by = ?, replied_at = ?, status = ? where id = ? `;
    let bindParams = [reply, reply_by, new Date(), status, id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return;
};



exports.getQueryByCustomerId = async (customer_id) => {
    let bindParams = [customer_id];
    let query = `
        SELECT
            c.*,
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
    return results[0] ? results[0] : results;
};

exports.getCustomerById = async (customer_id) => {
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
    return results?.length ? results[0] : null;
};

exports.checkIfDsaIsVerified = async (dsa_id, customer_id) => {
    const query = `
        SELECT 1
        FROM ru_customers
        WHERE customer_id = ? AND dsa_id = ?
        LIMIT 1
    `;
    const bindParams = [customer_id, dsa_id];
    const result = await _db2.query(query, {
        replacements: bindParams,
        type: QueryTypes.SELECT
    });

    return result.length > 0; // Returns true if a match is found, else false
};
exports.saveOtpDb2Customer = async (otp, mobile, type) => {
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

exports.getOtpDb2 = async (mobile, type) => {
    let query = ` select * from  ru_otp_logs where mobile_number = ? and otp_type = ? and is_otp_used = false order by id desc  `;
    let otps = await _db2.query(query, { replacements: [mobile, type], type: QueryTypes.SELECT });
    return otps[0];
};
exports.verifyOtpByIdDb2 = async (id, customer_id, mobile_number) => {
    const transaction = await _db2.transaction();
    try {
        await _db2.query(
            `UPDATE ru_otp_logs SET is_otp_used = true WHERE id = ?`,
            { replacements: [id], type: QueryTypes.UPDATE, transaction }
        );

        await _db2.query(
            `UPDATE ru_customers SET customer_mobile_number = ?, is_mobile_number_verified = 1 WHERE customer_id = ?`,
            { replacements: [mobile_number, customer_id], type: QueryTypes.UPDATE, transaction }
        );

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

exports.getCustomerMobileContext = async (customer_id) => {
    const rows = await _db2.query(
        `SELECT c.customer_id, c.customer_mobile_number, c.is_mobile_number_verified,
                c.permanent_account_number, d.dsa_id
         FROM ru_customers c
         LEFT JOIN ru_direct_selling_agents d ON d.dsa_mobile_number = c.dsa_mobile_number
         WHERE c.customer_id = ?`,
        { replacements: [customer_id], type: QueryTypes.SELECT }
    );
    return rows[0] || null;
};

/** True if mobile_number already belongs to a different customer. */
const isCustomerMobileNumberTaken = async (mobile_number, excludingCustomerId) => {
    const rows = await _db2.query(
        `SELECT customer_id FROM ru_customers WHERE customer_mobile_number = ? AND customer_id != ? LIMIT 1`,
        { replacements: [mobile_number, excludingCustomerId], type: QueryTypes.SELECT }
    );
    return rows.length > 0;
};

exports.getCustomerMobileLogs = async (customer_id, offset, limit) => {
    const query = `
        SELECT al.id, al.application_id AS customer_id, al.from_value, al.to_value,
               al.is_external, al.ip, al.createdAt AS created_at,
               COALESCE(u.name, d.full_name, c.full_name) AS updated_by_name,
               bin_to_uuid(al.updated_by) AS updated_by
        FROM CRMTest.application_logs al
        LEFT JOIN CRMTest.users u ON u.id = al.updated_by
        LEFT JOIN ru_direct_selling_agents d ON d.dsa_id = bin_to_uuid(al.updated_by) COLLATE utf8mb4_unicode_ci
        LEFT JOIN ru_customers c ON c.customer_id = bin_to_uuid(al.updated_by) COLLATE utf8mb4_unicode_ci
        WHERE al.application_type = 'customer' AND al.field = 'customer_mobile_number' AND al.application_id = ?
        ORDER BY al.createdAt DESC
        LIMIT ?, ?
    `;
    const countQuery = `
        SELECT COUNT(*) AS totalCount
        FROM CRMTest.application_logs al
        WHERE al.application_type = 'customer' AND al.field = 'customer_mobile_number' AND al.application_id = ?
    `;
    const [records, totalRecords] = await Promise.all([
        _db2.query(query, { replacements: [customer_id, offset, limit], type: QueryTypes.SELECT }),
        _db2.query(countQuery, { replacements: [customer_id], type: QueryTypes.SELECT })
    ]);
    return { records, totalRecords: totalRecords[0]?.totalCount || 0 };
};

exports.getCustomerMobileTrail = async (customer_id, offset, limit) => {
    const query = `
        SELECT t.*, d.full_name AS dsa_name
        FROM ru_customer_mobile_trail t
        LEFT JOIN ru_direct_selling_agents d ON d.dsa_id = t.dsa_id COLLATE utf8mb4_unicode_ci
        WHERE t.customer_id = ?
        ORDER BY t.created_at DESC
        LIMIT ?, ?
    `;
    const countQuery = `SELECT COUNT(*) AS totalCount FROM ru_customer_mobile_trail WHERE customer_id = ?`;
    const [records, totalRecords] = await Promise.all([
        _db2.query(query, { replacements: [customer_id, offset, limit], type: QueryTypes.SELECT }),
        _db2.query(countQuery, { replacements: [customer_id], type: QueryTypes.SELECT })
    ]);
    const mappedRecords = records.map((row) => ({ ...row, user_agent: parseUserAgent(row.user_agent) }));
    return { records: mappedRecords, totalRecords: totalRecords[0]?.totalCount || 0 };
};

/** Inserts a row into ru_customer_mobile_trail capturing the number being replaced. Failures are swallowed so the OTP flow is not blocked. */
const logCustomerMobileTrail = async ({ dsa_id, customer_id, customer_mobile_number, permanent_account_number, platform, device_type, user_agent, ip, updated_by }) => {
    try {
        const sanitizedUserAgent = user_agent ? String(user_agent).slice(0, 512) : null;
        const sanitizedIp = ip ? String(ip).replace(/^::ffff:/, '').slice(0, 45) : null;

        // First-ever trail row for this customer: backfill an origin entry for the number being
        // replaced, dated to account creation, so the trail isn't missing when that number started.
        const existing = await _db2.query(
            `SELECT COUNT(*) AS cnt FROM ru_customer_mobile_trail WHERE customer_id = ?`,
            { replacements: [customer_id], type: QueryTypes.SELECT }
        );
        if (Number(existing[0]?.cnt) === 0) {
            const customerRow = await _db2.query(
                `SELECT created_at FROM ru_customers WHERE customer_id = ?`,
                { replacements: [customer_id], type: QueryTypes.SELECT }
            );
            const originCreatedAt = customerRow[0]?.created_at;
            if (originCreatedAt) {
                await _db2.query(
                    `INSERT INTO ru_customer_mobile_trail
                        (dsa_id, customer_id, customer_mobile_number, permanent_account_number, platform, device_type, user_agent, ip, updated_by, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    {
                        replacements: [
                            dsa_id || null,
                            customer_id,
                            customer_mobile_number,
                            permanent_account_number || null,
                            platform || null,
                            device_type || null,
                            sanitizedUserAgent,
                            sanitizedIp,
                            updated_by || null,
                            originCreatedAt,
                            originCreatedAt
                        ],
                        type: QueryTypes.INSERT
                    }
                );
            }
        }

        const query = `INSERT INTO ru_customer_mobile_trail
            (dsa_id, customer_id, customer_mobile_number, permanent_account_number, platform, device_type, user_agent, ip, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const replacements = [
            dsa_id || null,
            customer_id,
            customer_mobile_number,
            permanent_account_number || null,
            platform || null,
            device_type || null,
            sanitizedUserAgent,
            sanitizedIp,
            updated_by || null
        ];
        await _db2.query(query, { replacements, type: QueryTypes.INSERT });
    } catch (e) {
        logger.error('Failed to log customer mobile trail', e);
    }
};

/** Records both the application_logs audit entry and the ru_customer_mobile_trail row for a mobile number change. */
exports.recordCustomerMobileNumberChange = async ({ customer, customer_id, from_value, to_value, updated_by, ip, user_agent, platform }) => {
    await logCustomerMobileNumberChange({ customer_id, from_value, to_value, updated_by, ip });
    await logCustomerMobileTrail({
        dsa_id: customer?.dsa_id,
        customer_id,
        customer_mobile_number: from_value,
        permanent_account_number: customer?.permanent_account_number,
        platform,
        device_type: null,
        user_agent,
        ip,
        updated_by
    });
};

exports.sendCustomerMobileExtOtp = async (mobile_number, initiatedBy = 'external') => {
    const OTP = process.env.ENVIRONMENT === 'dev'
        ? '6666'
        : Math.floor(1000 + Math.random() * 9000).toString();
    const message = `One-time password for updating your profile and application details is ${OTP}-Ruloans`;

    await connectKafkaProducer();
    const newSMS = new SMSSendNotificationEngine(
        uuid(),
        Number(mobile_number),
        message,
        initiatedBy,
        'Customer mobile verification',
        'SMSSendNotification'
    );
    await sendToKafkaEngine(newSMS);
    await exports.saveOtpDb2Customer(OTP, mobile_number, CUSTOMER_MOBILE_EXT_OTP_TYPE);
    return OTP;
};

const fetchActiveCustomerMobileOtp = async (mobile_number) => {
    const otpResult = await exports.getOtpDb2(mobile_number, CUSTOMER_MOBILE_EXT_OTP_TYPE);
    if (!otpResult) {
        return { error: 'OTP not found' };
    }
    if (isCustomerMobileOtpExpired(otpResult.updated_at)) {
        return { error: 'Otp Expired' };
    }
    return { otpResult };
};

exports.markCustomerMobileOtpUsed = async (id) => {
    await _db2.query(
        `UPDATE ru_otp_logs SET is_otp_used = true WHERE id = ?`,
        { replacements: [id], type: QueryTypes.UPDATE }
    );
};

exports.updateCustomerMobileVerified = async (customer_id, mobile_number) => {
    await _db2.query(
        `UPDATE ru_customers SET customer_mobile_number = ?, is_mobile_number_verified = 1 WHERE customer_id = ?`,
        { replacements: [mobile_number, customer_id], type: QueryTypes.UPDATE }
    );
};

exports.manageCustomerMobileOtp = async ({ customer_id, type, mobile_number, otp, initiatedBy, ip, user_agent, platform }) => {
    const customer = await exports.getCustomerMobileContext(customer_id);
    if (!customer) {
        return { ok: false, status: 404, message: 'Customer not found' };
    }

    const oldMobile = customer.customer_mobile_number;
    const isVerified = Number(customer.is_mobile_number_verified) === 1;
    const currentStep = await client.getAsync(customerMobileRedisStepKey(customer_id));
    const pendingNewMobile = await client.getAsync(customerMobileRedisNewKey(customer_id));

    const setRedisState = async (step, newMobile) => {
        await client.setAsync(customerMobileRedisStepKey(customer_id), step);
        await client.expireAsync(customerMobileRedisStepKey(customer_id), CUSTOMER_MOBILE_REDIS_TTL);
        if (newMobile) {
            await client.setAsync(customerMobileRedisNewKey(customer_id), newMobile);
            await client.expireAsync(customerMobileRedisNewKey(customer_id), CUSTOMER_MOBILE_REDIS_TTL);
        }
    };

    const clearRedisState = async () => {
        await client.delAsync(customerMobileRedisStepKey(customer_id));
        await client.delAsync(customerMobileRedisNewKey(customer_id));
    };

    if (type === 'send' || type === 'resend') {
        if (isVerified) {
            if (currentStep === 'new_mobile_verification' && pendingNewMobile) {
                await exports.sendCustomerMobileExtOtp(pendingNewMobile, initiatedBy);
                return {
                    ok: true,
                    message: type === 'resend' ? 'OTP resent to new mobile number' : 'OTP sent to new mobile number',
                    data: {
                        step: 'new_mobile_verification',
                        customer_id,
                        new_mobile: pendingNewMobile
                    }
                };
            }

            const requestedMobile = mobile_number || pendingNewMobile || oldMobile;
            if (!isValidCustomerMobile(requestedMobile)) {
                return { ok: false, status: 400, message: 'Valid mobile_number is required' };
            }

            // Same as current (or omitted): single-step re-verify existing number
            if (!mobile_number || String(requestedMobile) === String(oldMobile)) {
                if (!isValidCustomerMobile(oldMobile)) {
                    return { ok: false, status: 400, message: 'Current customer mobile number is invalid' };
                }
                await exports.sendCustomerMobileExtOtp(oldMobile, initiatedBy);
                await setRedisState('mobile_verification', oldMobile);
                return {
                    ok: true,
                    message: type === 'resend' ? 'OTP resent successfully' : 'OTP sent successfully',
                    data: {
                        step: 'mobile_verification',
                        customer_id,
                        mobile_number: oldMobile
                    }
                };
            }

            // Different number: 2-step change flow (OTP first on current, then on new)
            if (!isValidCustomerMobile(oldMobile)) {
                return { ok: false, status: 400, message: 'Current customer mobile number is invalid' };
            }

            if (await isCustomerMobileNumberTaken(requestedMobile, customer_id)) {
                return { ok: false, status: 409, message: 'This mobile number is already registered with another customer' };
            }

            await exports.sendCustomerMobileExtOtp(oldMobile, initiatedBy);
            await setRedisState('old_mobile_verification', requestedMobile);
            return {
                ok: true,
                message: type === 'resend' ? 'OTP resent to current mobile number' : 'OTP sent to current mobile number',
                data: {
                    step: 'old_mobile_verification',
                    customer_id,
                    current_mobile: oldMobile,
                    new_mobile: requestedMobile
                }
            };
        }

        const targetMobile = mobile_number || pendingNewMobile;
        if (!isValidCustomerMobile(targetMobile)) {
            return { ok: false, status: 400, message: 'Valid mobile_number is required' };
        }

        if (await isCustomerMobileNumberTaken(targetMobile, customer_id)) {
            return { ok: false, status: 409, message: 'This mobile number is already registered with another customer' };
        }

        await exports.sendCustomerMobileExtOtp(targetMobile, initiatedBy);
        await setRedisState('mobile_verification', targetMobile);
        return {
            ok: true,
            message: type === 'resend' ? 'OTP resent successfully' : 'OTP sent successfully',
            data: {
                step: 'mobile_verification',
                customer_id,
                mobile_number: targetMobile
            }
        };
    }

    if (type === 'verify') {
        if (!otp) {
            return { ok: false, status: 400, message: 'otp is required for verify' };
        }

        if (isVerified) {
            if (!currentStep) {
                return { ok: false, status: 400, message: 'Please send OTP before verifying' };
            }

            // Re-verify existing number (same as current)
            if (currentStep === 'mobile_verification') {
                const targetMobile = pendingNewMobile || mobile_number || oldMobile;
                if (!isValidCustomerMobile(targetMobile)) {
                    return { ok: false, status: 400, message: 'mobile_number is required for verify' };
                }

                const { otpResult, error } = await fetchActiveCustomerMobileOtp(targetMobile);
                if (error) {
                    return { ok: false, status: 401, message: error };
                }
                if (otpResult.otp != otp) {
                    return { ok: false, status: 401, message: 'Invalid OTP' };
                }

                if (await isCustomerMobileNumberTaken(targetMobile, customer_id)) {
                    return { ok: false, status: 409, message: 'This mobile number is already registered with another customer' };
                }
                await exports.markCustomerMobileOtpUsed(otpResult.id);
                await exports.updateCustomerMobileVerified(customer_id, targetMobile);
                await logCustomerMobileNumberChange({
                    customer_id,
                    from_value: oldMobile,
                    to_value: targetMobile,
                    updated_by: initiatedBy,
                    ip
                });
                await logCustomerMobileTrail({
                    dsa_id: customer.dsa_id,
                    customer_id,
                    customer_mobile_number: oldMobile,
                    permanent_account_number: customer.permanent_account_number,
                    platform,
                    device_type: null,
                    user_agent,
                    ip,
                    updated_by: initiatedBy
                });
                await clearRedisState();
                return {
                    ok: true,
                    message: 'Customer mobile verified successfully',
                    data: {
                        step: 'completed',
                        customer_id,
                        mobile_number: targetMobile,
                        is_mobile_number_verified: 1
                    }
                };
            }

            if (currentStep === 'old_mobile_verification') {
                const { otpResult, error } = await fetchActiveCustomerMobileOtp(oldMobile);
                if (error) {
                    return { ok: false, status: 401, message: error };
                }
                if (otpResult.otp != otp) {
                    return { ok: false, status: 401, message: 'Invalid OTP' };
                }

                const newMobile = pendingNewMobile || mobile_number;
                if (!isValidCustomerMobile(newMobile)) {
                    return { ok: false, status: 400, message: 'Pending new mobile number not found' };
                }

                await exports.markCustomerMobileOtpUsed(otpResult.id);
                await exports.sendCustomerMobileExtOtp(newMobile, initiatedBy);
                await setRedisState('new_mobile_verification', newMobile);
                return {
                    ok: true,
                    message: 'Current mobile verified. OTP sent to new mobile number',
                    data: {
                        step: 'new_mobile_verification',
                        customer_id,
                        new_mobile: newMobile
                    }
                };
            }

            const targetMobile = pendingNewMobile || mobile_number;
            if (!isValidCustomerMobile(targetMobile)) {
                return { ok: false, status: 400, message: 'Mobile number is required for verification' };
            }

            const { otpResult, error } = await fetchActiveCustomerMobileOtp(targetMobile);
            if (error) {
                return { ok: false, status: 401, message: error };
            }
            if (otpResult.otp != otp) {
                return { ok: false, status: 401, message: 'Invalid OTP' };
            }

            if (await isCustomerMobileNumberTaken(targetMobile, customer_id)) {
                return { ok: false, status: 409, message: 'This mobile number is already registered with another customer' };
            }
            await exports.markCustomerMobileOtpUsed(otpResult.id);
            await exports.updateCustomerMobileVerified(customer_id, targetMobile);
            await logCustomerMobileNumberChange({
                customer_id,
                from_value: oldMobile,
                to_value: targetMobile,
                updated_by: initiatedBy,
                ip
            });
            await logCustomerMobileTrail({
                dsa_id: customer.dsa_id,
                customer_id,
                customer_mobile_number: oldMobile,
                permanent_account_number: customer.permanent_account_number,
                platform,
                device_type: null,
                user_agent,
                ip,
                updated_by: initiatedBy
            });
            await clearRedisState();
            return {
                ok: true,
                message: 'Customer mobile number updated successfully',
                data: {
                    step: 'completed',
                    customer_id,
                    mobile_number: targetMobile,
                    is_mobile_number_verified: 1
                }
            };
        }

        const targetMobile = mobile_number || pendingNewMobile;
        if (!isValidCustomerMobile(targetMobile)) {
            return { ok: false, status: 400, message: 'mobile_number is required for verify' };
        }

        const { otpResult, error } = await fetchActiveCustomerMobileOtp(targetMobile);
        if (error) {
            return { ok: false, status: 401, message: error };
        }
        if (otpResult.otp != otp) {
            return { ok: false, status: 401, message: 'Invalid OTP' };
        }

        if (await isCustomerMobileNumberTaken(targetMobile, customer_id)) {
            return { ok: false, status: 409, message: 'This mobile number is already registered with another customer' };
        }
        await exports.verifyOtpByIdDb2(otpResult.id, customer_id, targetMobile);
        await logCustomerMobileNumberChange({
            customer_id,
            from_value: oldMobile,
            to_value: targetMobile,
            updated_by: initiatedBy,
            ip
        });
        await logCustomerMobileTrail({
            dsa_id: customer.dsa_id,
            customer_id,
            customer_mobile_number: oldMobile,
            permanent_account_number: customer.permanent_account_number,
            platform,
            device_type: null,
            user_agent,
            ip,
            updated_by: initiatedBy
        });
        await clearRedisState();
        return {
            ok: true,
            message: 'Customer mobile verified successfully',
            data: {
                step: 'completed',
                customer_id,
                mobile_number: targetMobile,
                is_mobile_number_verified: 1
            }
        };
    }

    return { ok: false, status: 400, message: 'Invalid type' };
};

exports.getCustomerByDsaExternal = async (dsa_id, offset, limit) => {
    let query = `
    SELECT DISTINCT
        sp.dsa_mobile_number AS sp_mobile_number,
        sp.full_name AS sp_name,
        dsa.full_name AS dsa_name,
        c.id,
        c.customer_id,
        c.dsa_id,
        c.salutation,
        c.first_name,
        c.middle_name,
        c.last_name,
        c.full_name,
        c.father_full_name AS father_name,
        c.mother_full_name AS mother_name,
        c.customer_mobile_number,
        c.is_mobile_number_verified,
        c.email_address,
        c.date_of_birth,
        c.age,
        c.gender,
        c.permanent_account_number,
        c.address_house_number,
        c.address_area,
        c.address_city,
        c.address_state,
        c.device_type,
        c.address_pincode,
        c.customer_created_date,
        c.created_at,
        c.updated_at
    FROM
        ru_customers c
    LEFT JOIN ru_direct_selling_agents dsa
        ON c.dsa_id = dsa.dsa_id
    LEFT JOIN ru_direct_selling_agents sp
        ON c.sp_mobile_number = sp.dsa_mobile_number
    WHERE
        c.dsa_id = ?
    ORDER BY
        c.id DESC
    LIMIT ?, ?
`;

    let queryCount = `
    SELECT COUNT(DISTINCT c.id) AS totalCount
    FROM ru_customers c
    LEFT JOIN ru_direct_selling_agents dsa
        ON c.dsa_id = dsa.dsa_id
    LEFT JOIN ru_direct_selling_agents sp
        ON c.sp_mobile_number = sp.dsa_mobile_number
    WHERE
        c.dsa_id = ?
`;

    const results = await _db2.query(query, { replacements: [dsa_id, offset, limit], type: QueryTypes.SELECT });
    const totalCount = await _db2.query(queryCount, { replacements: [dsa_id], type: QueryTypes.SELECT });

    return { results, totalCount: totalCount[0].totalCount };
};

exports.toggleNotificationCustomer = async (dsa_id, customer_id, setClause) => {
    let result = [];
    let table = customer_id ? `ru_customers` : `ru_direct_selling_agents`;
    let where = customer_id ? `customer_id` : `dsa_id`;
    let id = customer_id || dsa_id;

    if (setClause?.length) {
        let query = ` update ${table} set ${setClause} where ${where} = ? `;
        await _db2.query(query, { replacements: [id], type: QueryTypes.UPDATE });
        result = setClause;
    } else {
        let query = ` select email_communication, whatsapp_communication, sms_communication, notification_communication from ${table} where ${where} = ? `;
        result = await _db2.query(query, { replacements: [id], type: QueryTypes.SELECT });
    }

    return result;
};

exports.setBankerEmailStatus = async (emails, status) => {
    let query = ` update ru_branch_sales_people set is_active = ?, updated_at = ${IST_NOW_SQL} where sp_email in (?) `;
    const results = await _db2.query(query, { replacements: [status, emails], type: QueryTypes.UPDATE });
    return;
};

exports.getCustomerLeadsByCustomerId = async (customer_id) => {
    console.log("inside getCustomerLeadsByCustomerId", customer_id);
    const query = `SELECT * FROM ru_customers_leads WHERE customer_id = ? ORDER BY created_at DESC`;
    const rows = await _db2.query(query, { replacements: [customer_id], type: QueryTypes.SELECT });
    return rows || [];
};

exports.getLoanDetails = async (application_id) => {
    let bindParams = [application_id];
    const db_name = getLoanCatalogRef();
    

    let query = ` SELECT 
            la.id,
            la.application_id,
            la.customer_id,
            c.full_name as customer_name,
            c.customer_mobile_number,
            c.email_address as customer_email,
            la.dsa_id,
            dsa.full_name as dsa_name,
            dsa.dsa_mobile_number,
            la.salesperson_id as salesperson_id,
            sp_user.name as salesperson_name,
            la.product_id,
            p.product_name,
            la.loan_type_id,
            lt.name as loan_type_name,
            la.status,
            la.status as lead_status,
            la.sub_status,
            la.date_of_birth,
            la.pincode,
            la.city,
            la.state,
            la.income_type,
            la.is_consent_given,
            la.applied_loan_amount,
            la.approved_loan_amount,
            la.disbursed_loan_amount,
            la.loan_tenure,
            la.cibil_score,
            la.utm_source,
            la.utm_medium,
            la.utm_campaign,
            la.utm_content,
            la.utm_channel,
            la.utm_term,
            la.utm_id,
            la.campaignid,
            la.gad,
            la.gclid,
            la.fbclid,
            la.mt,
            la.ad,
            la.adpos,
            la.adgroupid,
            la.utm_adgroup,
            la.utm_main_source,
            la.utm_device,
            la.page_source,
            la.source_from,
            la.salesperson_id,
            la.salesperson_assigned_date,
            sp.name AS salesperson_name,
            (
                SELECT pv.value
                FROM   ru_call_logs rcl
                LEFT JOIN picklist_values pv ON rcl.call_status = pv.id
                WHERE  rcl.entity       = 'customer'
                  AND  rcl.entity_type  = 'leads'
                  AND  rcl.entity_type_id = la.id
                ORDER BY rcl.id DESC
                LIMIT 1
            ) AS latest_call_log_status,
            (
                SELECT rcl.remarks
                FROM   ru_call_logs rcl
                WHERE  rcl.entity       = 'customer'
                  AND  rcl.entity_type  = 'leads'
                  AND  rcl.entity_type_id = la.id
                ORDER BY rcl.id DESC
                LIMIT 1
            ) AS latest_call_log_remarks,
            (
                SELECT rcl.created_at
                FROM   ru_call_logs rcl
                WHERE  rcl.entity       = 'customer'
                  AND  rcl.entity_type  = 'leads'
                  AND  rcl.entity_type_id = la.id
                  ORDER BY rcl.id DESC
                  LIMIT 1
              ) AS latest_call_log_date,
              (
                  SELECT pv.value
                  FROM   ru_leads_logs rll
                  LEFT JOIN picklist_values pv ON rll.changed_to = pv.id
                  WHERE  rll.entity       = 'customer'
                    AND  rll.entity_type  = 'leads'
                    AND  rll.entity_type_id = la.id
                    AND  rll.event_type   = 'status'
                  ORDER BY rll.id DESC
                  LIMIT 1
              ) AS latest_lead_log_status,
              (
                  SELECT rll.changed_to
                  FROM   ru_leads_logs rll
                  WHERE  rll.entity       = 'customer'
                    AND  rll.entity_type  = 'leads'
                    AND  rll.entity_type_id = la.id
                    AND  rll.event_type   = 'remark'
                  ORDER BY rll.id DESC
                  LIMIT 1
              ) AS latest_lead_log_remarks,
              la.created_at,
              la.updated_at
          FROM loan_applications la
        INNER JOIN ru_customers c ON la.customer_id = c.customer_id
        INNER JOIN ru_direct_selling_agents dsa ON la.dsa_id = dsa.dsa_id
        LEFT JOIN CRMTest.users sp_user ON sp_user.id = UUID_TO_BIN(
            CASE
                WHEN la.salesperson_id REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                THEN la.salesperson_id
                ELSE NULL
            END
        )
        INNER JOIN ${db_name}.ru_loans_products p ON la.product_id = p.id
        INNER JOIN ${db_name}.ru_loans_types lt ON la.loan_type_id = lt.id
        LEFT  JOIN CRMTest.users sp ON bin_to_uuid(sp.id) = la.salesperson_id
        WHERE la.application_id = ? `;
    
    logger.info('getLoanDetails query', { query, bindParams });
    let result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return result[0] || null;
};

exports.getLoanApplicationsList = async (where, search, offset, limit, childPhones, is_export, salesLoggedInUserId = null) => {
    let bindParams = [];
    let countBindParams = [];
    let and = false;
    let query = '';
    let queryCount = '';

    try {
        const db_name = getLoanCatalogRef();

        if (where && where.length) {
            const resolved = await Promise.all(where.map(async (condition) => {
                const [col] = condition;
                if (typeof col !== 'string') return condition;
                if (!col.includes('dsa.materialized_path') || !col.toLowerCase().includes('like')) return condition;

                const pathMatch  = col.match(/materialized_path\s+like\s+['"]%([^'"]+)%['"]/i);
                const depthMatch = col.match(/materialized_path_depth\s*>=\s*(\d+)/i);
                const spMatch    = col.match(/la\.salesperson_id\s*=\s*['"]([^'"]+)['"]/i);
                if (!pathMatch) return condition;

                const mat_path  = pathMatch[1];
                const min_depth = depthMatch ? parseInt(depthMatch[1]) : 0;
                const sp_id     = spMatch ? spMatch[1] : null;

                const dsaRows = await _db2.query(
                    `SELECT dsa_id FROM ru_direct_selling_agents
                     WHERE materialized_path LIKE ? AND materialized_path_depth >= ?`,
                    { replacements: [`%${mat_path}%`, min_depth], type: QueryTypes.SELECT }
                );

                if (dsaRows.length) {
                    const list = dsaRows.map(r => `'${r.dsa_id}'`).join(',');
                    const newCol = sp_id
                        ? `(la.dsa_id IN (${list}) OR la.salesperson_id = "${sp_id}")`
                        : `la.dsa_id IN (${list})`;
                    return [newCol, '', null];
                }
                return sp_id ? [`la.salesperson_id = "${sp_id}"`, '', null] : ['1=0', '', null];
            }));
            where = resolved;
        }

        
        const normalizeFilterColumn = (column) => {
            if (column === 'salesperson_name' || column === 'sp.name' || column === 'sp_user.name') return 'sp_user.name';
            if (column === 'la.Salesperson_id') return 'la.salesperson_id';

            if (column.includes('SELECT pv.value') && column.includes('ru_call_logs'))  return 'pv_rcl.value';
            if (column.includes('SELECT pv.value') && column.includes('ru_leads_logs')) return 'pv_rll.value';
            if (column.includes('SELECT DATE(rcl.created_at)') && column.includes('ru_call_logs')) return 'DATE(rcl.created_at)';
            if (column === 'latest_call_log_date' || column === 'DATE(latest_call_log_date)') return 'DATE(rcl.created_at)';
            if (column === 'latest_call_log_status') return 'rcl.call_status';
            if (column === 'latest_call_log_remarks') return 'rcl.remarks';

            if (column.includes("SELECT rcl.call_status FROM ru_call_logs")) return 'rcl.call_status';
            if (column.includes("SELECT rcl.remarks FROM ru_call_logs")) return 'rcl.remarks';
            if (column.includes("SELECT rcl.created_at FROM ru_call_logs")) return 'rcl.created_at';
            if (column.includes("SELECT rll.changed_to") && column.includes("event_type = 'status'")) return 'rll.latest_lead_log_status';
            if (column.includes("SELECT rll.changed_to") && column.includes("event_type = 'remark'")) return 'rll_remark.latest_lead_log_remarks';
            
            const laColumns = [
                'id', 'application_id', 'customer_id', 'dsa_id', 'salesperson_id', 'product_id', 'loan_type_id',
                'status', 'sub_status', 'salesperson_assigned_date', 'date_of_birth', 'pincode', 'city', 'state',
                'income_type', 'is_consent_given', 'applied_loan_amount', 'approved_loan_amount', 'disbursed_loan_amount',
                'loan_tenure', 'cibil_score', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_channel',
                'utm_term', 'utm_id', 'campaignid', 'gad', 'gclid', 'fbclid', 'mt', 'ad', 'adpos', 'adgroupid', 'utm_adgroup',
                'utm_main_source', 'utm_device', 'page_source', 'source_from', 'created_at', 'updated_at'
            ];
            if (laColumns.includes(column.toLowerCase())) return `la.${column}`;

            return column;
        };

        const allFilters = [...(where || []), ...(search || [])];
        const needsSpUserJoin  = allFilters.some(f => f[0].includes('salesperson') || f[0].includes('sp_user') || f[0].includes('sp.name'));
        const needsRclJoin     = allFilters.some(f => f[0].includes('rcl.') || f[0].includes('SELECT rcl.') || f[0].includes('latest_call_log_') || (f[0].includes('SELECT pv.value') && f[0].includes('ru_call_logs')) || (f[0].includes('SELECT DATE(rcl.created_at)') && f[0].includes('ru_call_logs')));
        const needsPvRclJoin   = allFilters.some(f => f[0].includes('SELECT pv.value') && f[0].includes('ru_call_logs'));
        const needsRllStatusJoin = allFilters.some(f => (f[0].includes("SELECT rll.changed_to") && f[0].includes("event_type = 'status'")) || (f[0].includes('SELECT pv.value') && f[0].includes('ru_leads_logs')));
        const needsPvRllJoin   = allFilters.some(f => f[0].includes('SELECT pv.value') && f[0].includes('ru_leads_logs'));
        const needsRllRemarkJoin = allFilters.some(f => f[0].includes("SELECT rll.changed_to") && f[0].includes("event_type = 'remark'"));
        const needsFclJoin     = allFilters.some(f => f[0].includes('fcl.first_call_time'));
        const needsProductJoin = allFilters.some(f => f[0].includes('product_name') || f[0].includes('p.'));
        const needsLoanTypeJoin = allFilters.some(f => f[0].includes('loan_type_name') || f[0].includes('lt.'));
        const needsCustomerJoin = allFilters.some(f => f[0].includes('customer_name') || f[0].includes('c.') || f[0].includes('customer_mobile') || f[0].includes('customer_email'));
        const needsDsaJoin      = allFilters.some(f => f[0].includes('dsa_name') || f[0].includes('dsa.') || f[0].includes('dsa_mobile_number'));

        const customer_join = ` INNER JOIN ru_customers c ON la.customer_id = c.customer_id `;
        const dsa_join = ` INNER JOIN ru_direct_selling_agents dsa ON la.dsa_id = dsa.dsa_id `;

        const sp_user_join = `
            LEFT JOIN CRMTest.users sp_user ON sp_user.id = UUID_TO_BIN(
                CASE
                    WHEN la.salesperson_id REGEXP '^[0-9a-fA-F-]{36}$'
                    THEN la.salesperson_id
                    ELSE NULL
                END
            )`;

       const rcl_join = ` LEFT JOIN (
            SELECT *
            FROM (
                SELECT
                    rcl.entity_type_id,
                    rcl.call_status,
                    rcl.remarks,
                    rcl.created_at,
                    ROW_NUMBER() OVER (
                        PARTITION BY rcl.entity_type_id
                        ORDER BY rcl.created_at DESC
                    ) AS rn
                FROM ru_call_logs rcl
                WHERE rcl.entity = 'customer'
                  AND rcl.entity_type = 'leads'
            ) x
            WHERE x.rn = 1
        ) rcl ON la.id = rcl.entity_type_id `;

       const rll_status_join = ` LEFT JOIN (
            SELECT *
            FROM (
                SELECT
                    rll.entity_type_id,
                    rll.changed_to AS latest_lead_log_status,
                    ROW_NUMBER() OVER (
                        PARTITION BY rll.entity_type_id
                        ORDER BY rll.created_at DESC
                    ) AS rn
                FROM ru_leads_logs rll
                WHERE rll.entity = 'customer'
                  AND rll.entity_type = 'leads'
                  AND rll.event_type = 'status'
            ) y
            WHERE y.rn = 1
        ) rll ON la.id = rll.entity_type_id `;

        const fcl_join = ` LEFT JOIN (
            SELECT entity_type_id, created_by, MIN(created_at) as first_call_time
            FROM ru_call_logs
            WHERE entity = 'customer' AND entity_type = 'leads'
            GROUP BY entity_type_id, created_by
        ) fcl ON fcl.entity_type_id = la.id AND fcl.created_by = la.salesperson_id `;

        const product_join_inner = ` INNER JOIN ${db_name}.ru_loans_products p ON la.product_id = p.id `;
        const loan_type_join_inner = ` INNER JOIN ${db_name}.ru_loans_types lt ON la.loan_type_id = lt.id `;
        const pv_rcl_join = ` LEFT JOIN picklist_values pv_rcl ON rcl.call_status = pv_rcl.id `;
        const pv_rll_join = ` LEFT JOIN picklist_values pv_rll ON rll.latest_lead_log_status = pv_rll.id `;

        let baseFrom = ` FROM loan_applications la
            ${needsCustomerJoin ? customer_join : ''}
            ${needsDsaJoin ? dsa_join : ''}
            ${needsSpUserJoin ? sp_user_join : ''}
            ${needsRclJoin ? rcl_join : ''}
            ${needsPvRclJoin ? pv_rcl_join : ''}
            ${needsRllStatusJoin ? rll_status_join : ''}
            ${needsPvRllJoin ? pv_rll_join : ''}
            ${needsProductJoin ? product_join_inner : ''}
            ${needsLoanTypeJoin ? loan_type_join_inner : ''}
            ${needsFclJoin ? fcl_join : ''}`;

        let filterConditions = '';
        let filterAnd = false;

        if (childPhones) {
            const hierarchyCTE = `
            WITH RECURSIVE DSAHierarchy AS (
                SELECT dsa_id FROM ru_direct_selling_agents WHERE dsa_mobile_number = ?
                UNION ALL
                SELECT t.dsa_id FROM ru_direct_selling_agents t
                INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_id
            ) `;
            queryCount = hierarchyCTE;
            query = hierarchyCTE;
        
            if (salesLoggedInUserId) {
                filterConditions += ` WHERE (la.dsa_id IN (SELECT dsa_id FROM DSAHierarchy) OR la.salesperson_id = ?) `;
                bindParams.push(childPhones, salesLoggedInUserId);
                countBindParams.push(childPhones, salesLoggedInUserId);
            } else {
                filterConditions += ` WHERE la.dsa_id IN (SELECT dsa_id FROM DSAHierarchy) `;
                bindParams.push(childPhones);
                countBindParams.push(childPhones);
            }
            filterAnd = true;
        }

        if (where && where.length != 0) {
            for (let i = 0; i < where.length; i++) {
                filterConditions += filterAnd ? ' AND ' : ' WHERE ';
                filterAnd = true;
                
                const normalizedColumn = normalizeFilterColumn(where[i][0]);
                if (where[i][2] !== null && where[i][2] !== undefined) {
                    filterConditions += normalizedColumn + where[i][1] + ' ? ';
                    bindParams.push(where[i][2]);
                    countBindParams.push(where[i][2]);
                } else {
                    filterConditions += normalizedColumn + where[i][1] + ' ';
                }
            }
        }

        if (search && search.length != 0) {
            for (let i = 0; i < search.length; i++) {
                if (!filterAnd && i == 0) {
                    filterConditions += ' WHERE ';
                    filterAnd = true;
                } else if (i == 0 && filterAnd) {
                    filterConditions += ' AND ';
                }
                
                if (i == 0) filterConditions += ' ( ';
                if (i != 0) filterConditions += ' OR ';
                
                const normalizedSearchColumn = normalizeFilterColumn(search[i][0]);
                filterConditions += normalizedSearchColumn + ' ' + search[i][1] + ' ? ';
                
                if (i == search.length - 1) filterConditions += ' ) ';
                
                bindParams.push(search[i][2]);
                countBindParams.push(search[i][2]);
            }
        }

        queryCount += ` SELECT COUNT(la.id) as totalCount ${baseFrom} ${filterConditions} `;

        const columnList = `
            la.id, la.application_id, la.customer_id, c.full_name as customer_name,
            c.customer_mobile_number, c.email_address as customer_email, la.dsa_id,
            dsa.full_name as dsa_name, dsa.dsa_mobile_number, la.salesperson_id,
            sp_user.name as salesperson_name, la.product_id, p.product_name,
            lt.name as loan_type_name, la.status, la.status as lead_status, la.sub_status,
            la.salesperson_assigned_date, 
            rcl.call_status AS latest_call_log_status,
            rcl.remarks AS latest_call_log_remarks, 
            rcl.created_at AS latest_call_log_date,
            rll.latest_lead_log_status,
            la.date_of_birth, la.pincode, la.city, la.state, la.income_type, la.is_consent_given,
            la.applied_loan_amount, la.approved_loan_amount, la.disbursed_loan_amount,
            la.loan_tenure, la.cibil_score, la.utm_source, la.utm_medium, la.utm_campaign,
            la.utm_content, la.utm_channel, la.utm_term, la.utm_id, la.campaignid, la.gad,
            la.gclid, la.fbclid, la.mt, la.ad, la.adpos, la.adgroupid, la.utm_adgroup, la.utm_main_source,
            la.utm_device, la.page_source, la.source_from, la.created_at, la.updated_at`;

        const buildFullJoins = (idList) => {
            const logFilter = `AND entity_type_id IN (${idList})`;
            return `
            INNER JOIN ru_customers c ON la.customer_id = c.customer_id
            INNER JOIN ru_direct_selling_agents dsa ON la.dsa_id = dsa.dsa_id
            ${sp_user_join}
            LEFT JOIN ${db_name}.ru_loans_products p ON la.product_id = p.id
            LEFT JOIN ${db_name}.ru_loans_types lt ON la.loan_type_id = lt.id
            LEFT JOIN (
                SELECT r1.entity_type_id, r1.call_status, r1.remarks, r1.created_at
                FROM ru_call_logs r1
                INNER JOIN (
                    SELECT entity_type_id, MAX(id) AS max_id
                    FROM ru_call_logs
                    WHERE entity = 'customer' AND entity_type = 'leads'
                    ${logFilter}
                    GROUP BY entity_type_id
                ) r2 ON r1.id = r2.max_id
            ) rcl ON la.id = rcl.entity_type_id
            LEFT JOIN (
                SELECT r1.entity_type_id, r1.changed_to AS latest_lead_log_status
                FROM ru_leads_logs r1
                INNER JOIN (
                    SELECT entity_type_id, MAX(id) AS max_id
                    FROM ru_leads_logs
                    WHERE entity = 'customer' AND entity_type = 'leads' AND event_type = 'status'
                    ${logFilter}
                    GROUP BY entity_type_id
                ) r2 ON r1.id = r2.max_id
            ) rll ON la.id = rll.entity_type_id`;
        };

        const limitClause = (offset !== undefined && limit) ? `LIMIT ${offset}, ${limit}` : '';
        const idsQuery = `SELECT la.id ${baseFrom} ${filterConditions} ORDER BY la.id DESC ${limitClause}`;
        const pageRows = await _db2.query(idsQuery, { replacements: bindParams, type: QueryTypes.SELECT });

        if (!pageRows.length) {
            const countResult = await _db2.query(queryCount, { replacements: countBindParams, type: QueryTypes.SELECT });
            return { results: [], totalCount: countResult[0]?.totalCount || 0 };
        }

        const BATCH_SIZE  = 1000;
        const pageIdsList = pageRows.map(r => r.id);
        const idChunks    = [];
        for (let i = 0; i < pageIdsList.length; i += BATCH_SIZE) {
            idChunks.push(pageIdsList.slice(i, i + BATCH_SIZE));
        }

        const buildPageQuery = (ids) => ` SELECT ${columnList}
            FROM loan_applications la
            ${buildFullJoins(ids.join(','))}
            WHERE la.id IN (${ids.join(',')})
            ORDER BY la.id DESC`;

        logger.info('getLoanApplicationsList', { totalIds: pageIdsList.length, chunks: idChunks.length });

        const allRows = [];
        for (const chunk of idChunks) {
            const rows = await _db2.query(buildPageQuery(chunk), { type: QueryTypes.SELECT });
            allRows.push(...rows);
        }

        const countResults = await _db2.query(queryCount, { replacements: countBindParams, type: QueryTypes.SELECT });

        const results = allRows.sort((a, b) => b.id - a.id);
        return { results, totalCount: countResults[0]?.totalCount || 0 };
    } catch (error) {
        logger.error('Error in getLoanApplicationsList', { error, query, queryCount, bindParams });
        throw error;
    }
};

exports.getSalespersonIdSnippet = (alias = 'la') => {
    return `${alias}.salesperson_id`;
};

exports.getSalespersonJoinSnippet = (alias = 'la', userAlias = 'sp_user') => {
    return `LEFT JOIN CRMTest.users ${userAlias} ON bin_to_uuid(${userAlias}.id) = ${exports.getSalespersonIdSnippet(alias)}`;
};

exports.getWhereArrayFromReportFilters = (reportFilters) => {
    const where = [];
    if (!reportFilters) return where;

    const { start_date, end_date, metric, bucket, telecaller } = reportFilters;
    const { getLeadResponseTimeSqlSnippets } = require('./report-service');

    const inlineCallLogTarget = (bucket && metric === 'call') ? 'fcl.first_call_time' : null;

    const { baseTime, targetTime, adjM, adjD } = getLeadResponseTimeSqlSnippets(metric, 'la', null, inlineCallLogTarget);

    if (start_date) {
        where.push([baseTime, '>=', `${start_date.split('T')[0]} 00:00:00`]);
    }
    if (end_date) {
        where.push([baseTime, '<', `${end_date.split('T')[0]} 23:59:59`]);
    }
    if (telecaller && telecaller !== 'Unassigned') {
        where.push([`COALESCE(sp_user.name, sp_user.email)`, '=', telecaller]);
    } else if (telecaller === 'Unassigned') {
        where.push([`COALESCE(sp_user.name, sp_user.email)`, ' IS NULL', null]);
    }

    if (bucket) {

        if (bucket === 'hour_0_4') {
            where.push([`${adjD} = 0 AND ${adjM} BETWEEN 0 AND 240`, '', null]);
        } else if (bucket === 'hour_4_8') {
            where.push([`${adjD} = 0 AND ${adjM} BETWEEN 241 AND 480`, '', null]);
        } else if (bucket === 'same_day') {
            where.push([`${adjD} = 0 AND ${adjM} > 480`, '', null]);
        } else if (bucket === 'next_day') {
            where.push([`${adjD} = 1`, '', null]);
        } else if (bucket === '2_plus_day') {
            where.push([`${adjD} > 1`, '', null]);
        } else if (bucket === 'not_called' || bucket === 'unassigned_leads') {
            where.push([`${targetTime}`, ' IS NULL', null]);
        }
    }
    return where;
};


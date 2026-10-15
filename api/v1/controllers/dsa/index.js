//created dsa controller to serve the routes for RULOANS CUSTOMER DATA
const fs = require('fs');
const crypto = require('crypto');
const client = require("../../../helpers/redis-client");
const { Parser } = require('json2csv');
const { logger } = require("../../../helpers/logger");
const apiLogger = require("../../../helpers/api-logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
const numberToWords = require('number-to-words');
let DSAService = require(_pathconst.ServicesPath.DSAService);
const LeadClaimService = require("../../../v2/finance/leads/claims/FreshLeadClaimService");
let GraphServices = require(_pathconst.ServicesPath.GraphServices);
let LeadService = require(_pathconst.ServicesPath.LeadService);
let UserService = require(_pathconst.ServicesPath.UserService);
let ApplicationLogServices = require(_pathconst.ServicesPath.ApplicationLogServices);
const LeadLogService = require(_pathconst.ServicesPath.LeadLogService);
let DSAValidationV1 = require(_pathconst.ReqModelsPath.DSAValidationV1);
const { uploadToS3, uploadJsonToS3, readJsonFromS3, mergeLntChilds, getLastSpendDates, mergeIndifiChilds, getAllDSA, mergeBajaCreditCardChilds, sendSms, processArrayInChunks, asyncForEach, decodeBase64AndReadXLSXForLeadForm, removeFormattingFromExcelBase64Async, decodeBase64AndReadXLSXForLeadFormResult, sendSMSNew, stateCodes, generateNestedObjects, mergeArrays, getChildLevels, checkWhereInQueryString, sendEmailWithAttachment, makeRequest, readSamplesFromS3, jsonDifferenceForNestedObjects, callNsApi, CreateWhereQueryFilter, getRuloansCustomerApiFieldMapping, CustomOperatorHandlers, getHierarchySalesPerson, isBackendAccessRole, mapObjectKeys, formatGetLeadFormsFilterClause, partitionFilterModelItems, buildLoanApacRefFilterWhereClause, LOAN_APAC_REF_FILTER_FIELDS } = require("../../../helpers/commonhelper");
let randomstring = require("randomstring");
const { getDsaTreeArray, getBusinessHeadRecursively, downloadInvoice: downloadInvoiceService } = require("../../../services/dsa-services");
let CommonHelper = require(_pathconst.FilesPath.CommonHelper);
let ApiFieldMappings = require(_pathconst.FilesPath.ApiFieldMappings);
const { jsonDifference, checkMaskingAllowed, generateRandomString, sendEmail, getLoanTableInfo, toIsoDateIST } = require("../../../helpers/commonhelper");
let { getDsaUpdatedStepsQueue, uploadLeadFormDataQueue, updateCCApplicationsQueue, uploadInvoiceDataQueue, dashboardReportCreditSasionQueue, dashboardReportCreditVidyaQueue, dashboardReportQueue, dashboardReportBajajPLQueue, dashboardReportIncredQueue, dashboardReportFairCentQueue, indifiReportQueue, sendNotificationQueue, creditCardReportQueue, dashboardReportFibeQueue, dashboardReportPaysenseQueue } = require(_pathconst.FilesPath.Queue);
const moment = require('moment');
const { getCustomerCapturedDetails } = require("./profile");
const download = require('download-pdf');
const { generatePDF } = require("../../../helpers/GeneratePdf");
const { uploadAndEditDsaQueue, sendDsaExportEmailQueue, sendMisReportExportEmailQueue, dashboardReportPiramalLAPQueue, getLedgerDataOnEmail, mergeDsaQueue } = require('../../../../jobs');
const xlsx = require('xlsx');
const { v4: uuid } = require('uuid');
const axios = require("axios");
const useragent = require('useragent');
const { bulkCreate } = require('../../../services/application-log-services');
const { error, Console } = require('console');
const { _db2 } = require('../../../../models');
const { QueryTypes } = require('sequelize');
const { NSInvoiceStatusJson } = require('../../../helpers/constantdata/config');
const { getBankProductCombinationByBankId, checkBankProductLock } = require('../../../services/bank-services');
const { getLeadFormField, updateLeadCaseBusinessCategoryMongo, getLeadCaseBusinessCategories, getLeadCaseBusinessCategory } = require('../mongo-db');
const { getNotificationStats, storeUsersInMongoDB } = require('../../../services/mongo');
const { getCompanyDetailsByKey } = require('../../../services/company-services');
const CompanyServices = require('../../../services/company-services');
const { ReassignDsaCRM, createActivityLogKafka, handleDsaBusinessStarted } = require('../../../services/kafka-services');
const { isFinanceRootUser, validatePayoutDetails, compareDisbursementAmount, autoErpValidation } = require('../../../services/finance-services');
const FinanceServices = require('../../../services/finance-services');
const { getLeadResponseTimeSqlSnippets } = require('../../../services/report-service');
const { where } = require('sequelize');
const { result } = require('lodash');
const rbacMiddleware = require('../../../helpers/acl-middleware/rbac-middleware');
const { resolveMatchedBankFileForLead } = require('../../../v2/finance/leads/erp/erpHelpers');

const MongoDBControllerV1 = require(_pathconst.ControllersPath.MongoDBControllerV1);
const KafkaServices = require(_pathconst.ServicesPath.KafkaServices);
const EventServices = require(_pathconst.ServicesPath.EventServices);

function amountToWords(amount) {
    // Convert amount to words
    const words = numberToWords.toWords(amount);

    // Capitalize the first letter
    const capitalizedWords = words.charAt(0).toUpperCase() + words.slice(1);

    return capitalizedWords;
};

function getDataUpToNLevel(data, level) {
    if (level === 0) {
        return [];
    }

    return data.map(item => {
        const newItem = { ...item }; // Clone the current object
        if (newItem.childs && newItem.childs.length > 0) {
            newItem.childs = getDataUpToNLevel(newItem.childs, level - 1);
        }
        return newItem;
    });
};

function isDateDifferenceGreaterThanEqualToNSeconds(d1, d2, n) {
    // Add n seconds to d1
    const d1PlusNSeconds = new Date(d1.getTime() + n * 1000);

    // Check if d1 + n seconds is greater than or equal to d2
    console.log(d1, d2, d1PlusNSeconds)
    return d1PlusNSeconds <= d2;
};

const userTypeConditionMapping = {
    "individual": `(c.user_type in ("individual", "Channel Partner", "channel_partner") or c.user_type is null)`,
    "with_company": `c.user_type = "company"`,
    "individual/company": `(c.user_type in ("company", "individual", "Channel Partner", "channel_partner") or c.user_type is null)`,
    "payee": `c.user_type in ("payee", "Payee")`,
    "biller": `(c.user_type in ("biller") and c.is_universal != 1)`,
    "billers": `c.user_type in ("biller")`,
    "universal_biller": `(c.user_type in ("biller") and c.is_universal = 1 )`,
    "company": `rc.registered_by = c.dsa_id`,
    "customer": `c.user_type in ("customer")`,
    "all": `c.dsa_id is not null`,
    "channel-partners": `(c.user_type is null or c.user_type != "biller")`,
};

const getRuloansCustomers = async (req, res,) => {
    let plain_function = req?.plain_function || false;
    try {
        const { error } = DSAValidationV1.getRuloansCustomers.validate(req.body);
        if (!plain_function && error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        } else {
            let { customer_id_filter, hierarchy_crm_filter, call_status, ns_hierarchy_filter, is_employee_filter, referrer_name_filter, channel_manager_filter, company_id, company_name_filter, pageNumber, pageSize, partnerNameFilter, email_address_filter, joiningDateStartFilter, search, joiningDateEndFilter, assignDateStartFilter, assignDateEndFilter, signUpStepsFiltersStart, signUpStepsFiltersEnd, statusUpdateDateStartFilter, statusUpdateDateEndFilter, userFilter, creditCardSubmited, loanSubmited, lntLoanSubmitted, customer_full_name_filter, profession_filter, pan_number_filter, partner_full_name_filter, business_head_name_filter, customer_mobile_number_filter, home_address_city_filter, home_address_state_filter, status_filter, sub_status_filter, utm_source_filter, utm_medium_filter, utm_campaign_filter, utm_channel_filter, utm_term_filter, utm_main_source_filter, utm_device_filter, dsa_verification_status_filter, user_type_filter, user_type, signup_steps_filter, joining_signed_filter, payout_signed_filter, zip_code_filter, query, consent_otp_verified_filter, call_created_order, forChannelManager, previous_partner_name_filter, callPendingStartFilter, callPendingEndFilter, page_source_filter, old_new_dsa, old_new_dsa_filter, previous_partner_name_col, filterModel, logicOperator, sortBy, sortDirection, salesperson_name_filter, is_export, allow_duplicates, reportFilters } = req.body;
            let { sales_query, sales_query_where } = getHierarchySalesPerson(req?.loggedInUser);
            let role = req?.loggedInUser?.role;
            let banks;
            let childPhones = null;
            if (!(role == "HR" || role == "VERIFICATION_AGENCY")) {
                childPhones = role === "CEO" ? null : req?.loggedInUser?.userPhone;
            };

            if (isBackendAccessRole(role)) {
                if (!req.loggedInUser.parentEmail) return ResHelper.apiResponse(res, false, "This User Does Not Have Any Parent", 400, {}, "");
                phone = await UserService.findUserByPhoneOrEmail(req.loggedInUser.parentEmail, req.loggedInUser.parentEmail)
                lead_admin_id = phone.id;
                parent_user = phone;
                childPhones = phone?.userPhone;
                req.loggedInUser.materialized_path = phone?.dsa_id;
                if (!phone) ResHelper.apiResponse(res, false, "This User Does Not Have Any Parent", 400, {}, "");
            };

            let where = [];
            if (!pageNumber) {
                pageNumber = 0;
            };
            if (!pageSize) {
                pageSize = 100;
            };
            if (userFilter) {
                where.push(['c.partner_code', '=', userFilter]);
            };
            if (req.loggedInUser.role == "VERIFICATION_AGENCY") {
                where.push(['c.dsa_verification_status', '=', `pending`]);
            };
            if (req.loggedInUser.role == "VERIFICATION_AGENCY") {
                where.push(['c.assigned_to', '=', req.loggedInUser.id])
            };
            if (signUpStepsFiltersStart || signUpStepsFiltersEnd) {
                where.push([' c.signup_steps_completed ', ` between ${signUpStepsFiltersStart / 16.666666666} and ${signUpStepsFiltersEnd / 16.666666666} `, null]);
            };
            if (joiningDateStartFilter && joiningDateEndFilter) {
                where.push([' DATE(c.created_at) ', ` between DATE("${joiningDateStartFilter}") and DATE("${joiningDateEndFilter}")  `, null]);
            } else if (joiningDateStartFilter) {
                where.push([' DATE(c.created_at) ', ` >= DATE("${joiningDateStartFilter}")  `, null]);
            } else if (joiningDateEndFilter) {
                where.push([' DATE(c.created_at) ', ` <= DATE("${joiningDateEndFilter}")  `, null]);
            };
            if (assignDateStartFilter) {
                where.push([' DATE(c.partner_assigned_date) ', ` between DATE("${assignDateStartFilter}") and DATE("${assignDateEndFilter}")  `, null]);
            };
            if (callPendingStartFilter) {
                where.push([' ( DATE(c.call_remark_date) ', ` not between DATE("${callPendingStartFilter}") and DATE("${callPendingEndFilter}") or c.call_remark_date is null) `, null]);
            };
            if (statusUpdateDateStartFilter) {
                where.push([' DATE(c.dsa_status_updated_at) ', ` between DATE("${statusUpdateDateStartFilter}") and DATE("${statusUpdateDateEndFilter}")  `, null]);
            };
            if (signUpStepsFiltersStart || signUpStepsFiltersEnd) {
                where.push([' c.signup_steps_completed ', ` between ${signUpStepsFiltersStart / 16.666666666} and ${signUpStepsFiltersEnd / 16.666666666} `, null]);
            };
            if (partnerNameFilter) {
                if (partnerNameFilter == "Not Assigned") {
                    where.push(['p.full_name', ' is null ', null]);
                } else {
                    where.push(['p.full_name', ' = ', partnerNameFilter]);
                }
            };
            if (previous_partner_name_filter) {
                where.push(['pp.full_name', ' like', `%${previous_partner_name_filter}%`]);
            };
            if (hierarchy_crm_filter) {
                where.push(['c.hierarchy_crm', ' like', `%${hierarchy_crm_filter}%`]);
            };
            if (ns_hierarchy_filter) {
                where.push(['k.ns_hierarchy', ' like', `%${ns_hierarchy_filter}%`]);
            }
            if (company_name_filter) {
                where.push(['rc.name', ' like', `%${company_name_filter}%`]);
            };
            if (call_status) {
                where.push(['cl.call_status', ' =', `${call_status}`]);
            };
            if (channel_manager_filter) {
                where.push(['cm.full_name', ' like', `%${channel_manager_filter}%`]);
            };
            if (company_id) {
                where.push(['c.company_id', ' like', `%${company_id}%`]);
            };
            if (page_source_filter) {
                where.push(['c.page_source', ' like', `%${page_source_filter}%`]);
            };
            //Variable filters
            if (forChannelManager) {
                childPhones = null;
                where.push(['c.channel_manager_code', ' =', `${req?.loggedInUser?.userPhone}`]);
            };
            if (customer_full_name_filter) {
                where.push(['c.full_name', ' like', `%${customer_full_name_filter}%`]);
            };
            if (email_address_filter) {
                where.push(['c.email_address', ' like', `%${email_address_filter}%`]);
            };
            if (pan_number_filter) {
                where.push(['k.permanent_account_number', ' like', `%${pan_number_filter}%`]);
            };
            if (profession_filter) {
                where.push(['c.profession', ' like', `%${profession_filter}%`]);
            };
            if (partner_full_name_filter) {
                where.push(['p.full_name', ' like', `%${partner_full_name_filter}%`]);
            };
            if (business_head_name_filter) {
                where.push(['bh.full_name', ' like', `%${business_head_name_filter}%`]);
            };
            if (customer_mobile_number_filter) {
                where.push(['c.dsa_mobile_number', ' like', `%${customer_mobile_number_filter}%`]);
            };
            if (home_address_city_filter) {
                let escapedCity = home_address_city_filter.replace(/'/g, "''");
                where.push([`(c.home_address_city LIKE '%${escapedCity}%' OR c.dsa_id IN (SELECT dsa_id FROM ru_dsa_addresses WHERE city LIKE '%${escapedCity}%'))`, '']);
            };
            if (home_address_state_filter) {
                let escapedState = home_address_state_filter.replace(/'/g, "''");
                where.push([`(c.home_address_state LIKE '%${escapedState}%' OR c.dsa_id IN (SELECT dsa_id FROM ru_dsa_addresses WHERE state LIKE '%${escapedState}%'))`, '']);
            };
            if (salesperson_name_filter) {
                where.push(['sp.name', ' like', `%${salesperson_name_filter}%`]);
            }
            if (status_filter) {
                where.push([' case when pvs.value  is null then "Cold" else pvs.value end ', ' like', `%${status_filter}%`]);
            };
            if (sub_status_filter) {
                where.push(['pvss.value', ' like', `%${sub_status_filter}%`]);
            };
            if (referrer_name_filter) {
                where.push(['rfp.full_name', ' like', `%${referrer_name_filter}%`]);
            };
            if (utm_source_filter) {
                where.push(['c.utm_source', ' like', `%${utm_source_filter}%`]);
            };
            if (utm_medium_filter) {
                where.push(['c.utm_medium', ' like', `%${utm_medium_filter}%`]);
            };
            if (utm_campaign_filter) {
                where.push(['c.utm_campaign', ' like', `%${utm_campaign_filter}%`]);
            };
            if (utm_channel_filter) {
                where.push(['c.utm_channel', ' like', `%${utm_channel_filter}%`]);
            };
            if (utm_term_filter) {
                where.push(['c.utm_term', ' like', `%${utm_term_filter}%`]);
            };
            if (utm_main_source_filter) {
                where.push(['case when c.utm_main_source is null then c.utm_main_source else c.utm_main_source end', ' like', `%${utm_main_source_filter}%`]);
            }
            if (utm_device_filter) {
                where.push([' case when c.utm_device is null then c.utm_device else c.utm_device end', ' like', `%${utm_device_filter}%`]);
            };
            if (is_employee_filter) {
                where.push([' case when c.is_employee = 1 then "yes" else "no" end ', ' like', `%${is_employee_filter}%`]);
            };
            if (dsa_verification_status_filter) {
                where.push(['c.dsa_verification_status', ' like', `${dsa_verification_status_filter}%`]);
            };
            if (user_type_filter) {
                where.push(['c.user_type', ' like', `%${user_type_filter}%`]);
            };

            if (customer_id_filter) {
                where.push(['c.dsa_id', ' like', `%${customer_id_filter}%`]);
            };

            if (reportFilters) {
                const { start_date, end_date, metric, bucket, business_head, telecaller, bh_code } = reportFilters;

                const dateStr = start_date?.split('T')[0];
                const callLogDateClause = (bucket && metric === 'call' && dateStr)
                    ? ` AND DATE_SUB(createdAt, INTERVAL '5:30' HOUR_MINUTE) >= '${dateStr} 00:00:00'`
                    : '';

                const inlineCallLogTarget = (bucket && metric === 'call')
                    ? `(SELECT DATE_SUB(MIN(createdAt), INTERVAL '5:30' HOUR_MINUTE) FROM CRMTest.call_logs cl_sub WHERE cl_sub.user_type = 'dsa' AND cl_sub.user_id = c.dsa_id AND cl_sub.createdBy = binary c.salesperson_id${callLogDateClause})`
                    : null;

                const { baseTime, targetTime, adjM, adjD } = getLeadResponseTimeSqlSnippets(metric, 'c', 'cl', inlineCallLogTarget);

                if (start_date) {
                    where.push([baseTime, '>=', `${dateStr} 00:00:00`]);
                }
                if (end_date) {
                    where.push([baseTime, '<', `${end_date?.split('T')[0]} 23:59:59`]);
                }
                if (business_head) {
                    where.push([`TRIM(CONCAT_WS(' ', bh.first_name, NULLIF(bh.middle_name,''), bh.last_name))`, 'LIKE', `%${business_head}%`]);
                }
                if (telecaller && telecaller !== 'Unassigned') {
                    where.push([`COALESCE(sp.name, sp.email)`, '=', telecaller]);
                } else if (telecaller === 'Unassigned') {
                    where.push([`COALESCE(sp.name, sp.email)`, ' IS NULL', null]);
                }
                if (bh_code) {
                    where.push(['bh.dsa_mobile_number', '=', bh_code]);
                }

                // ✅ Sync population with Report INNER JOIN and constant filters
                where.push(['bh.partner_code', '=', '9987884000']);
                where.push(['c.business_head_code', ' IS NOT NULL', null]);

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
                    } else if (bucket === 'unassigned_leads' || bucket === 'not_called') {
                        where.push([`${targetTime}`, ' is null', null]);
                    }
                }
            }

            if (user_type) {
                where.push([userTypeConditionMapping[user_type], "", null]);
            } else if (!reportFilters) { // ✅ Bypass default biller filter when matching report population
                where.push(['(c.user_type is null or c.user_type != "biller")', '', null]);
            };

            if (signup_steps_filter) {
                where.push(['c.signup_steps_completed', ' like', `%${Math.round(+signup_steps_filter / 16.666666666)}%`]);
            };
            if (joining_signed_filter) {
                if (joining_signed_filter.toLowerCase() == "yes") {
                    where.push(['k.mou_signed_date', ' is not null', ``]);
                } else {
                    where.push(['k.mou_signed_date', ' is null', ``]);
                }
            };
            if (payout_signed_filter) {
                if (payout_signed_filter.toLowerCase() == "yes") {
                    where.push(['k.payout_agreement_signed_date', ' is not null', ``]);
                } else {
                    where.push(['k.payout_agreement_signed_date', ' is null', ``]);
                }
            };
            if (zip_code_filter) {
                let escapedZip = zip_code_filter.replace(/'/g, "''");
                where.push([`(c.home_address_pincode LIKE '%${escapedZip}%' OR c.dsa_id IN (SELECT dsa_id FROM ru_dsa_addresses WHERE pin_code LIKE '%${escapedZip}%'))`, '']);
            };

            childPhones = !sales_query ? childPhones : null
            if (childPhones && !reportFilters) { // ✅ Bypass default hierarchy filter to align perfectly with Report logic
                let sales_query = `c.salesperson_id = "${req.loggedInUser.id}"`;
                let depthQuery = req?.loggedInUser?.materialized_path ? `(c.materialized_path like "%${req?.loggedInUser?.materialized_path}%" and c.materialized_path_depth >= ${(req?.loggedInUser?.materialized_path_depth || 0)} or ${sales_query})` : `${sales_query}`;
                where.push([depthQuery, '', null]);
                childPhones = null;
            };

            if (sales_query) {
                where.push([sales_query_where, '', null]);
            };

            if (consent_otp_verified_filter) {
                if (consent_otp_verified_filter.toLowerCase() == "Yes") {
                    where.push(['c.consent_otp_verified_at', ' is null ', ""]);
                } else {
                    where.push(['c.consent_otp_verified_at', ' is not null ', ""]);
                }
            };
            if (old_new_dsa !== undefined && old_new_dsa !== null && old_new_dsa !== '') {
                where.push(['k.is_dsa_new', '=', old_new_dsa]);
            };

            if (old_new_dsa !== '' && old_new_dsa_filter) {
                const filter = old_new_dsa_filter.toLowerCase();
                if (filter === 'new') {
                    where.push(['k.is_dsa_new', '=', 1]);
                } else if (filter === 'old') {
                    where.push(['k.is_dsa_new', '=', 0]);
                }
            };
            if (previous_partner_name_col !== undefined && previous_partner_name_col !== '') {
                if (previous_partner_name_col === 1) {
                    where.push(['pp.full_name', ' is not null ', null]);
                } else if (previous_partner_name_col === 0) {
                    where.push(['pp.full_name', ' is null ', null]);
                }
            };

            //Variable filters

            let having = "";
            let checkHaving = () => {
                if (having?.length) {
                    having += " and "
                } else {
                    having += " having "
                }
            };
            if (creditCardSubmited) {
                checkHaving();
                having += `creditCardSubmited = ${creditCardSubmited}`
            };
            if (loanSubmited) {
                checkHaving();
                having += `loanSubmited = ${loanSubmited}`
            }
            if (lntLoanSubmitted) {
                checkHaving();
                having += `lntLoanSubmitted = ${lntLoanSubmitted}`
            }
            let searchList = [];
            if (search) {
                searchList.push(['c.dsa_mobile_number', 'like', `%${search}%`]);
                searchList.push(['c.full_name', 'like', `%${search}%`]);
                searchList.push(['c.home_address_pincode', 'like', `%${search}%`]);
                searchList.push(['k.permanent_account_number', 'like', `%${search}%`]);
            }
            let whereFilterQuery = []
            const operatorHandlers = CustomOperatorHandlers()
            if (filterModel) {
                whereFilterQuery = CreateWhereQueryFilter(filterModel, getRuloansCustomerApiFieldMapping, operatorHandlers)
            }


            let orderBy = '';
            if (sortBy) {
                const sortField = getRuloansCustomerApiFieldMapping(sortBy);
                orderBy = `${sortField} ${sortDirection || 'asc'}`;
            }
            let reqQuery = query ? " where " + query : "";

            banks = await DSAService.getRuloansCustomers({
                where,
                search: searchList,
                offset: pageNumber * pageSize,
                limit: pageSize,
                user_query: sales_query,
                having,
                filterQuery: reqQuery,
                call_created_order,
                call_status,
                is_export,
                orderBy,
                whereFilterQuery,
                logicOperator,
                allow_duplicates
            });

            if (is_export) {
                await ApplicationLogServices?.createExportLog(req);
                sendDsaExportEmailQueue.add({ ...banks?.emailQuery, loggedInUser: req?.loggedInUser });
                return ResHelper.apiResponse(res, true, "Success", 200, "email", "");
            };

            return !plain_function ? ResHelper.apiResponse(res, true, "Success", 200, banks, "") : banks
        };
    }
    catch (e) {
        console.log(e);
        logger.error(e);
        !plain_function && ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const sendWhatsappMessage = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.sendWhatsappMessage.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        } else {
            let { filter, headerParams, templateName, buttonParams, bodyParams } = req.body;

            await KafkaServices.connectKafkaProducer();


            const whatsappNotification = new KafkaServices.WhatsAppSendNotification(
                "whatsapp",
                filter,
                templateName,
                headerParams,
                bodyParams,
                buttonParams,
                req.loggedInUser.id
            );

            await KafkaServices.sendToKafka(whatsappNotification);
            return ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const sendEmailMessage = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.sendEmailMessage.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        } else {
            await KafkaServices.connectKafkaProducer();
            const { filter, subject, body } = req.body;
            const emailNotification = new KafkaServices.EmailSendEmail(
                "email",
                filter,
                subject,
                body,
                req.loggedInUser.id
            );
            console.log(emailNotification)
            await KafkaServices.sendToKafka(emailNotification);
            return ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getStaticSignUpSteps = async (req, res, next) => {
    try {
        let signUpSteps = [
            {
                key: 1,
                value: "Mobile Number Verified",
                percentage: "10%"
            },
            {
                key: 2,
                value: "Customer Basic Details Saved",
                percentage: "30%"
            },
            {
                key: 3,
                value: "Customer Address Saved",
                percentage: "50%"
            },
            {
                key: 4,
                value: "Customer KYC Completed",
                percentage: "75%"
            },
            {
                key: 5,
                value: "Joining Agreement Signed",
                percentage: "90%"
            },
            {
                key: 6,
                value: "Payout Agreement Signed ",
                percentage: "100%"
            }
        ]
        ResHelper.apiResponse(res, true, "Success", 200, signUpSteps, "");
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

const getRuloansCustomersKyc = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getRuloansCustomersKyc.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        } else {
            let { pageNumber, pageSize, customerId } = req.body;
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }
            let where = [];
            if (customerId) {
                where.push(['customer_id', customerId]);
            }
            let productGroups = await DSAService.getRuloansCustomersKyc(where, pageNumber * pageSize, pageSize);
            ResHelper.apiResponse(res, true, "Success", 200, productGroups, "");
        }

    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getDsaState = async (req, res, next) => {
    try {
        let query = `SELECT DISTINCT state FROM (SELECT home_address_state AS state FROM ru_direct_selling_agents WHERE home_address_state IS NOT NULL AND home_address_state <> '' UNION SELECT state FROM ru_dsa_addresses WHERE state IS NOT NULL AND state <> '') t WHERE state IS NOT NULL AND TRIM(state) <> '' ORDER BY state ASC`;
        let states = await _db2.query(query, { type: QueryTypes.SELECT });
        ResHelper.apiResponse(res, true, "Success", 200, states, "");
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getDsaCity = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getDsaCity.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { state } = req.body;
            let query = `SELECT DISTINCT city FROM (SELECT home_address_city AS city FROM ru_direct_selling_agents WHERE home_address_state = ? AND home_address_city IS NOT NULL AND home_address_city <> '' UNION SELECT city FROM ru_dsa_addresses WHERE state = ? AND city IS NOT NULL AND city <> '') t WHERE city IS NOT NULL AND TRIM(city) <> '' ORDER BY city ASC`;
            let cities = await _db2.query(query, { replacements: [state, state], type: QueryTypes.SELECT });
            ResHelper.apiResponse(res, true, "Success", 200, cities, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getPartnerList = async (req, res, next) => {
    try {
        let { search, pageNumber, pageSize } = req?.body;
        let role = req.loggedInUser.role;
        let childPhones = null;
        if (!(req.loggedInUser.role == "HR" || req.loggedInUser.role == "VERIFICATION_AGENCY" || req.loggedInUser.role == "CEO")) {
            childPhones = role === "CEO" ? null : req.loggedInUser.userPhone;
        };
        let where = search ? [["c.full_name", search, "like"]] : null;
        let partners = await DSAService.getDistinctSingleProperty(`(SELECT COALESCE(NULLIF(CONCAT(c.first_name, ' ', c.last_name), ' '), c.full_name))`, where, 'partners', childPhones, pageNumber * pageSize, pageSize, true)
        ResHelper.apiResponse(res, true, "Success", 200, partners, "");
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getZipCodeList = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getZipCodeList.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { state, city } = req.body;
            let where = [];
            if (state) {
                where.push(['c.home_address_state', state]);
            }
            if (city) {
                where.push(['c.home_address_city', city]);
            }
            let zipCodes = await DSAService.getDistinctSingleProperty('c.home_address_pincode', where, 'zipCode')
            ResHelper.apiResponse(res, true, "Success", 200, zipCodes, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

//Get Single User Details BY Id For Dsa Users
const getDsaUserDetails = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getDsaUserDetails.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        } else {
            let childPhones = null;
            let { customerId } = req.body;
            let user = await DSAService.getDsaById(customerId);
            if (!user) {
                ResHelper.apiResponse(res, false, "No Such DSA User Found ", 400, user, "");
                return;
            } else {
                childPhones = [user.customer_mobile_number];
                user = await DSAService.getDsaUserDetailsWithLoanAndCreditCardDetails(customerId, childPhones);
                ResHelper.apiResponse(res, true, "Success", 200, user, "");
            }
        }
    } catch (err) {
        console.log(err);
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getLoanApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getCreditCardApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, dsaId, search, stateFilter, cityFilter, type, loanAmountFilterStart, loanAmountFilterEnd, suggestedBanksFilter } = req.body;
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }

            let where = [['c.dsa_id', ' = ', dsaId], ['l.permanent_account_number', ' is not null ', null], ['l.permanent_account_number', ` <> "" `, null]];
            if (!loanAmountFilterStart && loanAmountFilterEnd) {
                loanAmountFilterStart = 0;
            }
            if (!loanAmountFilterEnd && loanAmountFilterStart) {
                loanAmountFilterEnd = 10000000;
            }
            if (loanAmountFilterStart && loanAmountFilterEnd) {
                where.push([' l.loan_amount ', ` between ${loanAmountFilterStart} and ${loanAmountFilterEnd}   `, null]);
            }
            if (cityFilter) {
                where.push(['d.address_city', '=', `${cityFilter}`]);
            }
            if (stateFilter) {
                where.push(['d.address_state', '=', `${stateFilter}`]);
            }
            if (type) {
                where.push(['lt.loan_name', ' = ', type]);
            }
            let searchList = [];
            if (search) {
                searchList.push(['d.full_name', 'like', `%${search}%`]);
                searchList.push(['d.customer_mobile_number', 'like', `%${search}%`]);
            }
            let user = await DSAService.getLoanApplications(dsaId, where, searchList, pageNumber * pageSize, pageSize, suggestedBanksFilter);
            ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getCreditCardApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getCreditCardApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, dsaId, search, stateFilter, cityFilter, loanAmountFilterStart, loanAmountFilterEnd } = req.body;
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }

            let where = [['c.dsa_id', '=', dsaId], [" cc.permanent_account_number", ' is not null ', null], ['cc.permanent_account_number', ` <> "" `, null]];
            if (stateFilter) {
                where.push(['d.address_state', '=', `${stateFilter}`]);
            }
            if (cityFilter) {
                where.push(['d.address_city', '=', `${cityFilter}`]);
            }
            let searchList = [];
            if (search) {
                searchList.push(['d.full_name', 'like', `%${search}%`]);
                searchList.push(['d.customer_mobile_number', 'like', `%${search}%`]);
            }
            let user = await DSAService.getCreditCardApplications(dsaId, where, searchList, pageNumber * pageSize, pageSize);
            ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}
const getLntLoanApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getLntLoanApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, dsaId, search, stateFilter, cityFilter, loanAmountFilterStart, loanAmountFilterEnd } = req.body;
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }

            let where = [['c.dsa_id', '=', dsaId], [" lt.permanent_account_number", ' is not null ', null], ['lt.permanent_account_number', ` <> "" `, null]];
            if (stateFilter) {
                where.push(['d.address_state', '=', `${stateFilter}`]);
            }
            if (cityFilter) {
                where.push(['d.address_city', '=', `${cityFilter}`]);
            }
            let searchList = [];
            if (search) {
                searchList.push(['d.full_name', 'like', `%${search}%`]);
                searchList.push(['d.customer_mobile_number', 'like', `%${search}%`]);
            }
            let user = await DSAService.getLntLoanApplications(dsaId, where, searchList, pageNumber * pageSize, pageSize);
            ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getCustomerUserDetails = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getCustomerUserDetails.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { customer_id, pan } = req.body;
            let where = ` where c.permanent_account_number = '${pan}' `;
            if (customer_id) {
                where = ` where c.customer_id = '${customer_id}' `;
            };
            let customer = await DSAService.getCustomerUserDetails(where);
            if (!customer) {
                ResHelper.apiResponse(res, false, "No such customer Found", 400, customer, "");
            } else {
                ResHelper.apiResponse(res, true, "Success", 200, customer, "");
            }
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getCustomerLoanApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getCustomerLoanApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, pan, search, loanAmountFilterStart, type, loanAmountFilterEnd } = req.body;
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }
            let where = [['l.permanent_account_number', ' = ', pan]];
            if (!loanAmountFilterStart) {
                loanAmountFilterStart = 0;
            }
            if (!loanAmountFilterEnd) {
                loanAmountFilterEnd = 10000000;
            }
            if (loanAmountFilterStart || loanAmountFilterEnd) {
                where.push([' l.loan_amount ', ` between ${loanAmountFilterStart} and ${loanAmountFilterEnd}   `, null]);
            }
            if (type) {
                where.push(['lt.loan_name', ' = ', type]);
            }
            let searchList = [];
            if (search) {
                searchList.push(['c.full_name', 'like', `%${search}%`]);
                searchList.push(['c.dsa_mobile_number', 'like', `%${search}%`]);
            }
            let loans = await DSAService.getCustomerLoanApplications(pan, where, searchList, pageNumber * pageSize, pageSize);
            ResHelper.apiResponse(res, true, "Success", 200, loans, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getCustomerCreditCardApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getCustomerLoanApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, pan, search } = req.body;
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }
            let where = [['cc.permanent_account_number', ' = ', pan]];
            let searchList = [];
            if (search) {
                searchList.push(['c.full_name', 'like', `%${search}%`]);
                searchList.push(['c.dsa_mobile_number', 'like', `%${search}%`]);
            }
            let creditCards = await DSAService.getCutomerCreditCardApplications(pan, where, searchList, pageNumber * pageSize, pageSize);
            ResHelper.apiResponse(res, true, "Success", 200, creditCards, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getCustomerLntApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getCustomerLntApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, pan, search } = req.body;
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }
            let where = [['lt.permanent_account_number', ' = ', pan]];
            let searchList = [];
            if (search) {
                searchList.push(['c.full_name', 'like', `%${search}%`]);
                searchList.push(['c.dsa_mobile_number', 'like', `%${search}%`]);
            }
            let creditCards = await DSAService.getCustomerLntApplications(pan, where, searchList, pageNumber * pageSize, pageSize);
            ResHelper.apiResponse(res, true, "Success", 200, creditCards, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getCustomerLoanDocuments = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getCustomerLoanDocuments.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { applicationId } = req.body;
            let loanDocuments = await DSAService.getCustomerLoanDocuments(applicationId);
            if (!loanDocuments) {
                ResHelper.apiResponse(res, false, "No Documents Records Found For this Appication", 400, loanDocuments, "");
            } else {
                ResHelper.apiResponse(res, true, "Success", 200, loanDocuments, "");
            }
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getCustomerLoanCapturedDetails = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getCustomerLoanDocuments.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { applicationId } = req.body;
            let customerCapturedDetails = await DSAService.getCustomerLoanCapturedDetails(applicationId);
            if (!customerCapturedDetails) {
                ResHelper.apiResponse(res, false, " No such Application Found ", 400, {}, "");
            } else {
                ResHelper.apiResponse(res, true, "Success", 200, customerCapturedDetails, "");
            }
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getCustomerCreditCardCapturedDetails = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getCustomerLoanDocuments.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { applicationId } = req.body;
            let customerCapturedDetails = await DSAService.getCustomerCreditCardCapturedDetails(applicationId);
            if (!customerCapturedDetails) {
                ResHelper.apiResponse(res, false, " No such Application Found ", 400, {}, "");
            } else {
                ResHelper.apiResponse(res, true, "Success", 200, customerCapturedDetails, "");
            }
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}


const getCustomerLoanSuggestedBanks = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getCustomerLoanDocuments.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { applicationId } = req.body;
            let customerCapturedDetails = await DSAService.getCustomerLoanSuggestedBanks(applicationId);
            ResHelper.apiResponse(res, true, "Success", 200, customerCapturedDetails, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getSuggestedBanksList = async (req, res, next) => {
    try {
        let suggestedBanksList = await DSAService.getSuggestedBanksList();
        ResHelper.apiResponse(res, true, "Success", 200, suggestedBanksList, "");
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getLoanType = async (req, res, next) => {
    try {
        const { for_product } = req?.body;
        let loanTypes = await DSAService.getLoanType(for_product);
        ResHelper.apiResponse(res, true, "Success", 200, loanTypes, "");
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllLoanApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllLoanApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let role = req.loggedInUser.role;
            let childPhones = null;
            let loggedInUser = null;
            if (!(req.loggedInUser.role == "HR" || req.loggedInUser.role == "VERIFICATION_AGENCY" || req.loggedInUser.role == "CEO")) {
                childPhones = req.loggedInUser.userPhone;
                loggedInUser = req?.loggedInUser?.id;
            };
            let { startDateFilter, endDateFilter, pageNumber, pageSize, search, stateFilter, cityFilter, type, partnerNameFilter, loanAmountFilterStart, loanAmountFilterEnd, suggestedBanksFilter, dsaMobileFilter, customerPanFilter, salaryFilter, tenureFilter, statusFilter, organizationFilter, customerMobileFilter, customerNameFilter, is_export, filterModel, logicOperator } = req.body;

            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }
            let where = [];
            // if (loanAmountFilterStart) {
            //     where.push([' l.loan_amount ', ` between ${loanAmountFilterStart} and ${loanAmountFilterEnd}   `, null]);
            // }
            if (loanAmountFilterStart) {
                where.push([' l.loan_amount ', ' like ', `%${loanAmountFilterStart}%`, null]);
            }
            if (startDateFilter || endDateFilter) {
                where.push([' DATE(l.created_at) ', ` between DATE("${startDateFilter}") and DATE("${endDateFilter}")  `, null]);
            }
            if (type) {
                where.push(['lt.loan_name', ' like ', `%${type}%`]);
            }
            if (partnerNameFilter) {
                where.push(['c.full_name', ' like ', `%${partnerNameFilter}%`]);
            }
            if (customerNameFilter) {
                where.push(['d.full_name', ' like ', `%${customerNameFilter}%`]);
            }
            if (stateFilter) {
                where.push(['d.address_state', ' like ', `%${stateFilter}%`]);
            }
            if (cityFilter) {
                where.push(['d.address_city', ' like ', `%${cityFilter}%`]);
            }
            //new filters
            if (dsaMobileFilter) {
                where.push(['d.dsa_mobile_number', ' like ', `%${dsaMobileFilter}%`, null]);
            }
            if (customerPanFilter) {
                where.push(['d.permanent_account_number', ' like ', `%${customerPanFilter}%`, null]);
            }
            if (salaryFilter) {
                where.push(['l.salary_per_annum ', ' like ', `%${salaryFilter}%`, null]);
            }
            if (tenureFilter) {
                where.push(['l.loan_tenure', ' like ', `%${tenureFilter}%`, null]);
            }
            if (statusFilter) {
                where.push(['lst.application_status_description', ' like ', `%${statusFilter}%`, null]);
            }
            if (organizationFilter) {
                where.push(['l.organisation_name', ' like ', `%${organizationFilter}%`, null]);
            }
            if (customerMobileFilter) {
                where.push(['d.customer_mobile_number', ' like ', `%${customerMobileFilter}%`, null]);
            }


            let searchList = [];
            if (search) {
                searchList.push(['d.full_name', 'like', `%${search}%`]);
                searchList.push(['d.customer_mobile_number', 'like', `%${search}%`]);
            }

            // MUI X DataGrid filterModel (optional) — keep legacy filters intact.
            if (filterModel?.items?.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getAllLoanApplicationsFieldMapping, operatorHandlers);

                if (whereFilterArray?.length > 0) {
                    const filters = whereFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    const whereFilterQuery = filters.join(logicOp);
                    if (whereFilterQuery) {
                        where.push([`(${whereFilterQuery})`, '', null]);
                    }
                }
            }

            let allow_masking = checkMaskingAllowed(role);

            let data = {};

            if (is_export) {
                const { query, queryCount, bindParams } = await DSAService.getAllLoanApplications(where, searchList, pageNumber * pageSize, pageSize, suggestedBanksFilter, childPhones, loggedInUser, allow_masking, true);
                sendMisReportExportEmailQueue.add({
                    query,
                    queryCount,
                    bindParams,
                    subject: "Personal Loan Applications",
                    filename: "personal_loan_applications",
                    loggedInUser: req?.loggedInUser
                });

            } else {
                data = await DSAService.getAllLoanApplications(where, searchList, pageNumber * pageSize, pageSize, suggestedBanksFilter, childPhones, loggedInUser, allow_masking, false);
            }

            let message = is_export ? "Report will be sent to your email after some time." : "Success";

            if (is_export) {
                await ApplicationLogServices?.createExportLog(req);
            };

            ResHelper.apiResponse(res, true, message, 200, data, "");
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const downloadAllLoanApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllCreditCardApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let role = req.loggedInUser.role;
            let childPhones = null;
            let loggedInUser = null;
            if (!(req.loggedInUser.role == "HR" || req.loggedInUser.role == "VERIFICATION_AGENCY" || req.loggedInUser.role == "CEO")) {
                childPhones = role === "CEO" ? '9987884000' : req.loggedInUser.userPhone;
                loggedInUser = req?.loggedInUser?.id;
            }
            let { startDateFilter, endDateFilter, pageNumber, pageSize, search, stateFilter, cityFilter, type, partnerNameFilter, loanAmountFilterStart, loanAmountFilterEnd, suggestedBanksFilter, dsaMobileFilter, customerPanFilter, salaryFilter, tenureFilter, statusFilter, organizationFilter, customerMobileFilter, customerNameFilter } = req.body;

            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 0;
            }
            let where = [];
            // if (loanAmountFilterStart) {
            //     where.push([' l.loan_amount ', ` between ${loanAmountFilterStart} and ${loanAmountFilterEnd}   `, null]);
            // }
            if (loanAmountFilterStart) {
                where.push([' l.loan_amount ', ' like ', `%${loanAmountFilterStart}%`, null]);
            }
            if (startDateFilter || endDateFilter) {
                where.push([' DATE(l.created_at) ', ` between DATE("${startDateFilter}") and DATE("${endDateFilter}")  `, null]);
            }
            if (type) {
                where.push(['lt.loan_name', ' like ', `%${type}%`]);
            }
            if (partnerNameFilter) {
                where.push(['c.full_name', ' like ', `%${partnerNameFilter}%`]);
            }
            if (customerNameFilter) {
                where.push(['d.full_name', ' like ', `%${customerNameFilter}%`]);
            }
            if (stateFilter) {
                where.push(['d.address_state', ' like ', `%${stateFilter}%`]);
            }
            if (cityFilter) {
                where.push(['d.address_city', ' like ', `%${cityFilter}%`]);
            }

            if (dsaMobileFilter) {
                where.push(['d.dsa_mobile_number', ' like ', `%${dsaMobileFilter}%`, null]);
            }
            if (customerPanFilter) {
                where.push(['d.permanent_account_number', ' like ', `%${customerPanFilter}%`, null]);
            }
            if (salaryFilter) {
                where.push(['l.salary_per_annum ', ' like ', `%${salaryFilter}%`, null]);
            }
            if (tenureFilter) {
                where.push(['l.loan_tenure', ' like ', `%${tenureFilter}%`, null]);
            }
            if (statusFilter) {
                where.push(['lst.application_status_description', ' like ', `%${statusFilter}%`, null]);
            }
            if (organizationFilter) {
                where.push(['l.organisation_name', ' like ', `%${organizationFilter}%`, null]);
            }
            if (customerMobileFilter) {
                where.push(['d.customer_mobile_number', ' like ', `%${customerMobileFilter}%`, null]);
            }


            let searchList = [];
            if (search) {
                searchList.push(['d.full_name', 'like', `%${search}%`]);
                searchList.push(['d.customer_mobile_number', 'like', `%${search}%`]);
            }
            let user = await DSAService.getAllLoanApplications(where, searchList, pageNumber * pageSize, pageSize, suggestedBanksFilter, childPhones, loggedInUser);
            ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {

        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getAllCreditCardApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllCreditCardApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { count_only, startDateFilter, statusFilter, userFilter, endDateFilter, pageNumber, pageSize, search, stateFilter, cityFilter, partnerNameFilter, loanAmountFilterStart, loanAmountFilterEnd, panFilter, customerMobileFilter, dsaMobileFilter, customerNameFilter } = req.body;
            let role = req.loggedInUser.role;
            let childPhones = null;
            let loggedInUser = null;
            let all_privilege = ["HR", "VERIFICATION_AGENCY", "CEO"];
            if (!all_privilege?.includes(role)) {
                if (role == 'CEO') {
                    loggedInUser = req?.loggedInUser?.id;
                    childPhones = req.loggedInUser.role === "CEO" ? '9987884000' : req.loggedInUser.userPhone;
                }
            };
            let where = [];
            if (userFilter) {
                where.push(['c.partner_code', '=', userFilter]);
            };
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }
            if (stateFilter) {
                where.push(['d.address_state', ' like ', `%${stateFilter}%`]);
            }
            if (statusFilter) {
                where.push(['rcsl.cc_application_status_description', ' = ', statusFilter]);
            }
            if (partnerNameFilter) {
                where.push(['c.full_name', ' = ', partnerNameFilter]);
            }
            if (cityFilter) {
                where.push(['d.address_city', ' like ', `%${cityFilter}%`]);
            }
            if (startDateFilter || endDateFilter) {
                where.push([' DATE(cc.application_date) ', ` between DATE("${startDateFilter}") and DATE("${endDateFilter}")  `, null]);
            }
            if (panFilter) {
                where.push(['cc.permanent_account_number', ' like', `%${panFilter}%`]);
            }
            if (customerMobileFilter) {
                where.push(['d.customer_mobile_number', ' like ', `%${customerMobileFilter}%`]);
            }
            if (customerNameFilter) {
                where.push(['d.full_name', ' like ', `%${customerNameFilter}%`]);
            }
            if (dsaMobileFilter) {
                where.push(['cc.dsa_mobile_number', ' like', `%${dsaMobileFilter}%`]);
            }
            let searchList = [];
            if (search) {
                searchList.push(['d.full_name', 'like', `%${search}%`]);
                searchList.push(['d.customer_mobile_number', 'like', `%${search}%`]);
            }
            let user = await DSAService.getAllCreditCardApplications(count_only, where, searchList, pageNumber * pageSize, pageSize, childPhones, loggedInUser);
            ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {

        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getCustomerState = async (req, res, next) => {
    try {
        let user = await DSAService.getCustomerState();
        ResHelper.apiResponse(res, true, "Success", 200, user, "");
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getCustomerCity = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getCustomerCity.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { state } = req.body;
            let where = [];
            where.push(['c.state ', ['is not null '], null]);
            if (state) {
                where.push(['c.state', ' = ', state]);
            }
            let user = await DSAService.getCustomerCity(where);
            ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getCustomers = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getCustomers.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { call_status, statusFilter, productFilter, salesHeadFilter, platform, sp_unallocated, tagsFilter, pageNumber, pageSize, search, cityFilter, stateFilter, zipCodeFilter, verifiedMobileFilter, startDateFilter, endDateFilter, startUpdatedDateFilter, endUpdatedDateFilter, userFilter, fullNameFilter, panFilter, customerMobileFilter, emailFilter, dsaMobileFilter, dsaNameFilter, spMobileNumberFilter, spNameFilter, deviceFilter, query, filterModel, logicOperator } = req.body;
            let role = req.loggedInUser.role;
            let includeJoins = false;
            let customers = { results: [], totalCount: 0 };
            let childPhones = null;

            if (!(role == "HR" || role == "VERIFICATION_AGENCY")) {
                childPhones = role === "CEO" ? null : req.loggedInUser.userPhone;
            }

            pageNumber = pageNumber || 0;
            pageSize = pageSize || 100;

            let where = [];

            const addCondition = (column, value) => {
                if (value === "-") {
                    where.push([`${column}`, ' IS NULL', null]);  // Check for NULL values
                } else {
                    where.push([`${column}`, ' LIKE ', `%${value}%`]);
                }
            };
            const addConditionWithEmptyString = (column, value) => {
                if (value === "-") {
                    where.push([`${column}`, ' = ', " "]);  // Check for empty string
                } else {
                    where.push([`${column}`, ' LIKE ', `%${value}%`]);
                }
            };

            if (userFilter) addCondition('c.dsa_mobile_number', userFilter);
            if (productFilter) addCondition('la.product_id', productFilter);
            if (call_status) addCondition('cl.call_status', call_status);
            if (platform) {
                where.push(['c.source_from', '=', platform]);
            } else if (platform === "-") {
                where.push(['c.source_from', 'IS NULL', null]);
            }
            if (stateFilter) addCondition('c.address_state', stateFilter);
            if (cityFilter) addCondition('c.address_city', cityFilter);
            if (zipCodeFilter) addCondition('c.address_pincode', zipCodeFilter);
            if (verifiedMobileFilter == 0 || verifiedMobileFilter == 1) where.push(['c.is_mobile_number_verified', '=', verifiedMobileFilter]);
            if (startDateFilter || endDateFilter) where.push([' DATE(c.created_at) ', ` between DATE("${startDateFilter}") and DATE("${endDateFilter}")  `, null]);
            if (startUpdatedDateFilter || endUpdatedDateFilter) where.push([' DATE(c.updated_at) ', ` between DATE("${startUpdatedDateFilter}") and DATE("${endUpdatedDateFilter}")  `, null]);
            if (fullNameFilter) addConditionWithEmptyString('c.full_name', fullNameFilter);
            if (panFilter) addCondition('c.permanent_account_number', panFilter);
            if (customerMobileFilter) addConditionWithEmptyString('c.customer_mobile_number', customerMobileFilter);
            if (emailFilter) addCondition('c.email_address', emailFilter);

            if (deviceFilter) {
                if (deviceFilter == "Web") {
                    where.push([' c.device_type ', ` like '0' `, null]);
                } else if (deviceFilter == "iOS") {
                    where.push([' c.device_type ', ` like '2' `, null]);
                } else if (deviceFilter == "Android") {
                    where.push([' c.device_type ', `IN (1, 3)`, null]);
                } else if (deviceFilter == "") {
                    where.push([' c.device_type ', ` like '' `, null]);
                } else if (deviceFilter == "-") {
                    where.push([' c.device_type ', ` IS NULL `, null]);
                }
            }


            if (dsaMobileFilter) addConditionWithEmptyString('c.dsa_mobile_number', dsaMobileFilter);
            if (tagsFilter) where.push([`CASE WHEN la.id IS NOT NULL THEN 'true' ELSE 'false' END`, `= 'true'`, null]);
            if (dsaNameFilter) { includeJoins = true; addCondition('dsa.full_name', dsaNameFilter); }
            if (spMobileNumberFilter) addCondition('c.sp_mobile_number', spMobileNumberFilter);
            if (statusFilter) addCondition('cq.status', statusFilter);
            if (spNameFilter) { includeJoins = true; addCondition('sp.full_name', spNameFilter); }
            if (sp_unallocated) where.push(['c.sp_mobile_number', ' IS NULL', ""]);
            if (salesHeadFilter) childPhones = salesHeadFilter;

            let searchList = [];
            if (search) {
                searchList.push(['c.full_name', 'LIKE', `%${search}%`]);
                searchList.push(['c.customer_mobile_number', 'LIKE', `%${search}%`]);
                searchList.push(['c.email_address', 'LIKE', `%${search}%`]);
                searchList.push(['c.permanent_account_number', 'LIKE', `%${search}%`]);
                searchList.push(['c.address_city', 'LIKE', `%${search}%`]);
                searchList.push(['c.address_state', 'LIKE', `%${search}%`]);
            }

            let filterQuery = query ? " WHERE " + query : "";

            // MUI X DataGrid filterModel — same pattern as getLeadForms / getNetsuiteBankList
            if (filterModel && filterModel.items.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getCustomersFieldMapping, operatorHandlers);

                if (whereFilterArray && whereFilterArray.length > 0) {
                    const filters = whereFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    const whereFilterQuery = filters.join(logicOp);
                    if (whereFilterQuery) {
                        where.push([`(${whereFilterQuery})`, '', null]);
                    }
                }
            }
            customers = await DSAService.getCustomers(where, searchList, pageNumber * pageSize, pageSize, childPhones, tagsFilter, includeJoins, call_status, statusFilter, filterQuery);
            ResHelper.apiResponse(res, true, "Success", 200, customers, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const editCustomers = async (req, res) => {
    try {
        const { error } = DSAValidationV1.editCustomers.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        }

        const { customerId } = req.body;
        const getCustomerDetails = await DSAService.getCustomerDetails(customerId);

        if (!getCustomerDetails) {
            ResHelper.apiResponse(res, false, "No Customer details found", 400, {}, "");
            return;
        }


        getCustomerDetails.customer_addresses = getCustomerDetails.customer_addresses;
        getCustomerDetails.customer_incomes = getCustomerDetails.customer_incomes;

        if (getCustomerDetails.customer_addresses !== null) {
            const uniqueAddresses = getCustomerDetails.customer_addresses.filter(
                (value, index, self) =>
                    index === self.findIndex((t) => t.address_id === value.address_id)
            );
            getCustomerDetails.customer_addresses = uniqueAddresses;
        }

        if (getCustomerDetails.customer_incomes !== null) {
            const uniqueIncomes = getCustomerDetails.customer_incomes.filter(
                (value, index, self) =>
                    index === self.findIndex((t) => t.income_id === value.income_id)
            );
            getCustomerDetails.customer_incomes = uniqueIncomes;
        }

        ResHelper.apiResponse(res, true, "Success", 200, { getCustomerDetails }, "");
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};



const updateCustomerFields = async (req, res) => {
    try {
        const { error } = DSAValidationV1.updateCustomerFields.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        }

        let { customerId, first_name, last_name, otp, mobile_number, ...updateFields } = req.body;

        if (!customerId || (Object.keys(updateFields).length === 0 && !first_name && !last_name)) {
            ResHelper.apiResponse(res, false, "Customer ID and at least one field to update are required", 400, {}, "");
            return;
        }
        const { total_work_exp, business_vintage, customer_mobile_number } = updateFields;
        if (total_work_exp) {
            if (Number(total_work_exp) < 0 || Number(total_work_exp) > 840) {
                ResHelper.apiResponse(res, false, "Total work experience should be between 1 to 840 months", 400, {}, "");
                return;
            }
        }
        if (business_vintage) {
            if (Number(business_vintage) < 0 || Number(business_vintage) > 3600) {
                ResHelper.apiResponse(res, false, "Business Vintage should be between 1 to 3600 months", 400, {}, "");
                return;
            }
        }
        if (customer_mobile_number) {
            if (customer_mobile_number.length != 10) {
                ResHelper.apiResponse(res, false, "Invalid Mobile Number", 401, {}, "");
                return;
            }
        }
        const checkIsMobileVerified = await DSAService.checkIfMobileNumberIsVerified(customerId);
        console.log("checkIsMobileVerified", checkIsMobileVerified)
        if (checkIsMobileVerified == 1) {
            const checkIsMobileNumberValid = await DSAService.checkIfMobileNumberIsValid(customerId);
            if (mobile_number !== checkIsMobileNumberValid.customer_mobile_number) {
                ResHelper.apiResponse(res, false, "Invalid Mobile Number", 401, {}, "");
                return;
            }

            const otpResult = await DSAService.getOtpDb2(mobile_number, 'customer_verify');
            if (!otpResult) {
                ResHelper.apiResponse(res, false, "OTP not found", 401, {}, "");
                return;
            }

            const dt1 = new Date();
            const dt2 = new Date(otpResult?.updated_at);
            const expired = isDateDifferenceGreaterThanEqualToNSeconds(dt2, dt1, 300);

            if (expired) {
                ResHelper.apiResponse(res, false, "OTP Expired", 401, {}, "");
                return;
            }

            if (otpResult.otp !== otp) {
                ResHelper.apiResponse(res, false, "Invalid OTP", 401, {}, "");
                return;
            }


        }

        const customerFields = [
            "full_name", "first_name", "last_name", "email_address", "permanent_account_number",
            "customer_mobile_number", "is_mobile_number_verified",
            "gender", "date_of_birth", "father_full_name", "mother_full_name"
        ];
        const addressFields = [
            "address_id", "address_type_id", "address_line_1", "address_line_2",
            "address_line_3", "pin_code", "city", "state",
            "country", "landmark"
        ];
        const incomeFields = [
            "income_id", "employee_type", "monthly_income", "employment_start_date",
            "employment_end_date", "profession", "salary_mode",
            "income_type", "business_vintage", "business_turnover",
            "total_work_exp", "nature_of_business", "customer_company_id"
        ];

        const customerUpdates = {};
        const addressUpdates = {};
        const incomeUpdates = {};


        if (first_name) {
            customerUpdates.first_name = first_name;
        }
        if (last_name) {
            customerUpdates.last_name = last_name;
        }
        if (first_name || last_name) {
            customerUpdates.full_name = `${first_name || ""} ${last_name || ""}`.trim();
        }


        Object.keys(updateFields).forEach(key => {
            if (customerFields.includes(key)) {
                customerUpdates[key] = updateFields[key];
            } else if (addressFields.includes(key)) {
                addressUpdates[key] = updateFields[key];
            } else if (incomeFields.includes(key)) {
                incomeUpdates[key] = updateFields[key];
            }
        });
        const { applicationId } = updateFields;
        KafkaServices.connectKafkaProducer();
        if (applicationId) {

            const old_data = await DSAService.getCustomerApplicationLogs(customerId);

            const result = await DSAService.updateCustomerFields(customerId, customerUpdates, addressUpdates, incomeUpdates);
            const new_data = await DSAService.getCustomerApplicationLogs(customerId);

            let diff = jsonDifferenceForNestedObjects(old_data, new_data);
            console.log("DIFFFF", diff)

            await bulkCreate(diff, applicationId, 'cc_application', req?.loggedInUser?.id);
            let fromDetails = {};
            let toDetails = {};


            diff.forEach(([key, oldValue, newValue]) => {
                fromDetails[key] = oldValue;
                toDetails[key] = newValue;
            });
            const customerUpdatedDetails = new KafkaServices.EventLogger(
                "cust_details_updated",
                JSON.stringify(fromDetails),
                JSON.stringify(toDetails),
                customerId,
                req?.loggedInUser?.id,
                new Date(),
            );

            KafkaServices.sendToKafkaLoggerService(customerUpdatedDetails);

            if (result.success) {
                ResHelper.apiResponse(res, true, "Customer details updated successfully", 200, {}, "");
            } else {
                ResHelper.apiResponse(res, false, result.message, 500, {}, "");
            }
        } else {
            const old_data = await DSAService.getCustomerApplicationLogs(customerId);
            const result = await DSAService.updateCustomerFields(customerId, customerUpdates, addressUpdates, incomeUpdates);
            const new_data = await DSAService.getCustomerApplicationLogs(customerId);
            let diff = jsonDifferenceForNestedObjects(old_data, new_data);
            let fromDetails = {};
            let toDetails = {};


            diff.forEach(([key, oldValue, newValue]) => {
                fromDetails[key] = oldValue;
                toDetails[key] = newValue;
            });
            const customerUpdatedDetails = new KafkaServices.EventLogger(
                "cust_details_updated",
                JSON.stringify(fromDetails),
                JSON.stringify(toDetails),
                customerId,
                req?.loggedInUser?.id,
                new Date(),
            );

            await KafkaServices.sendToKafkaLoggerService(customerUpdatedDetails);
            if (result.success) {
                ResHelper.apiResponse(res, true, "Customer details updated successfully", 200, {}, "");
            } else {
                ResHelper.apiResponse(res, false, result.message, 500, {}, "");
            }
        }


    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};


const getCompanyList = async (req, res) => {

    try {
        const { error } = DSAValidationV1.getCompanyList.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { search } = req.body;
            let where = "";
            if (search) {
                where = checkWhereInQueryString(where);
                where += ` company_name like "%${search}%"  `
            };
            let getCompany = await DSAService.getCompanies(where);
            if (!getCompany) {
                ResHelper.apiResponse(res, false, "No Company Found ", 400, {}, "");
            } else {
                ResHelper.apiResponse(res, true, "Company Found", 200, { company: getCompany }, "");
            }
        }
    }
    catch (err) {
        console.log(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getDsaTree = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getDsaTree.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { dsaId } = req.body;
            let getDsa = await DSAService.getDsaByIdForTree(dsaId);
            if (!getDsa) {
                ResHelper.apiResponse(res, false, "No Dsa Found ", 400, {}, "");
                return;
            } else {
                let getCurrentChilds = await DSAService.getCurrentChilds(getDsa.customer_mobile_number);
                getDsa.childs = await getLevelNodes(getCurrentChilds, 3);
                ResHelper.apiResponse(res, true, "Success", 200, { dsa: getDsa }, "");
            }
        }
    }
    catch (err) {
        logger.error(err)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getDsaTreeCount = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getDsaTreeCount.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { startDateFilter, endDateFilter } = req?.body;
            let dateFilter = "";
            if (startDateFilter) {
                for (i = 1; i < 6; i++) {
                    dateFilter += ` and DATE(t${i}.created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `
                }
            };

            let temp = await DSAService.getDsaTreeCount(req.loggedInUser.userPhone, dateFilter);
            let directChild = await DSAService.getSingleDsaTreeCount(req.loggedInUser.userPhone);
            let getDsa = [];
            let addedDirectly = false;
            for (let i = 0; i < temp.length;) {
                if (i == 1) {
                    if (addedDirectly == false) {
                        getDsa.push(directChild);
                        addedDirectly = true;
                    } else {
                        getDsa.push(temp[i]);
                        i++;
                    }
                } else {
                    getDsa.push(temp[i]);
                    i++;
                }
            }
            if (!getDsa || !getDsa.length) {
                ResHelper.apiResponse(res, false, "No Dsa Found ", 200, [], "");
            } else {
                ResHelper.apiResponse(res, true, "Success", 200, getDsa, "");
            }
        }
    }
    catch (err) {
        logger.error(err)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getLevelNodes = async (childs, level) => {
    if (level >= 6 || childs.length == 0) {
        return;
    }
    else {

        for (let i = 0; i < childs.length; i++) {
            childs[i].childs = await DSAService.getCurrentChilds(childs[i].customer_mobile_number);
            getLevelNodes(childs[i].childs, level++);
        }
        return childs;
    }
};

const getLevelNodesForCount = async (childs, level) => {
    if (level >= 4 || childs.length == 0) {
        return;
    }
    else {

        for (let i = 0; i < childs.length; i++) {
            childs[i].childs = await DSAService.getCurrentChilds(childs[i].customer_mobile_number);
            getLevelNodes(childs[i].childs, level++);
        }
        return childs;
    }
}

const getLevelNodesPhone = async (childs, level, ans) => {
    if (level >= 3 || childs.length == 0) {
        return;
    }
    else {

        for (let i = 0; i < childs.length; i++) {
            for (let i = 0; i < childs.length; i++) {
                childs[i].childs = await DSAService.getCurrentChilds(childs[i].customer_mobile_number);
                ans.dsa = ans.dsa.concat(childs[i].childs);
                getLevelNodes(childs[i].childs, level++, ans);
            }
        }
        return childs;
    }
}

const getUnverifiedDsa = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getUnverifiedDsa.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, search, verification } = req.body;
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }
            let where = [];
            where.push(['c.dsa_verification_status', '=', `${verification}`]);


            let searchList = [];
            if (search) {
                searchList.push(['c.dsa_mobile_number', 'like', `%${search}%`]);
                searchList.push(['c.full_name', 'like', `%${search}%`]);
                searchList.push(['c.home_address_pincode', 'like', `%${search}%`]);
                searchList.push(['k.permanent_account_number', 'like', `%${search}%`]);
            }

            let banks = await DSAService.getRuloansCustomers({ where, searchList, offset: pageNumber * pageSize, limit: pageSize });
            ResHelper.apiResponse(res, true, "Success", 200, banks, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const updateDsaVerifyStatus = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.updateDsaVerifyStatus.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { dsaId, status, userId } = req.body;
            if (userId) {
                await DSAService.updateDsaVerifyStatusWithAssignTo(dsaId, status, userId)
            } else {
                await DSAService.updateDsaVerifyStatus(dsaId, status);
            }
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const updateDsaAutoErpStatus = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.updateDsaAutoErpStatus.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { dsa_id, is_auto_erp } = req.body;

            const prevErpRow = await DSAService.getDsaIsAutoErpById(dsa_id);
            if (!prevErpRow) {
                return ResHelper.apiResponse(res, false, "DSA not found", 404, {}, "");
            }

            if (is_auto_erp === 1) {
                const dsaDetails = await DSAService.getDsaByIdForAutoErpValidation(dsa_id);
                if (!dsaDetails) {
                    return ResHelper.apiResponse(res, false, "DSA not found", 404, {}, "");
                }

                const autoErpResult = await autoErpValidation(dsaDetails);
                if (!autoErpResult?.isValid) {
                    return ResHelper.apiResponse(res, false, autoErpResult.message, 400, {}, "");
                }
            }

            await DSAService.updateDsaAutoErpStatus(dsa_id, is_auto_erp);

            const prev_details = {
                is_auto_erp: prevErpRow.is_auto_erp ? true : false,
            };
            const new_details = {
                is_auto_erp: is_auto_erp === 1,
            };
            const loggedIn_user_id = req?.loggedInUser?.id || req?.dsa?.dsa_id;
            const loggedIn_user_full_name = req?.loggedInUser?.userName || req?.dsa?.dsa_full_name;
            const platform = req?.loggedInUser?.id ? "crm_id" : "dsa_id";

            createActivityLogKafka({
                old_data: prev_details,
                new_data: new_details,
                log_type: "vendor_auto_erp_status",
                application_id: dsa_id,
                created_by: `${loggedIn_user_full_name} || ${platform} : ${loggedIn_user_id}`,
            });

            const statusText = is_auto_erp === 1 ? "enabled" : "disabled";
            ResHelper.apiResponse(res, true, `Auto ERP ${statusText} successfully`, 200, {}, "");
        }
    }
    catch (e) {
        console.log('e====', e)
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
}

const getDsaUserCapturedDetailsPdf = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getDsaUserCapturedDetailsPdf.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return
        } else {
            let { dsaId } = req.body;
            let dsa = await DSAService.getDsaUserCapturedDetails(dsaId);
            if (!dsa) {
                ResHelper.apiResponse(res, false, "No Such Dsa Found", 400, {}, "");
                return;
            } else {


                const pdfBuffer = await generatePDF("pdfTemplateForDsa", { dsa });

                await fs.promises.writeFile(appRoot + 'report.pdf', pdfBuffer);
                const base64String = await pdfBuffer.toString('base64');

                // Implement your S3 upload logic here
                // Example:
                const url = await uploadToS3("channel_partner_detail", base64String, dsaId, 'application/pdf', 'pdf');

                console.log('PDF successfully generated and uploaded to S3:', url);

                // let template = await ejs.renderFile(_pathconst.FilesPath.pdfTemplateForDsa, { dsa: dsa })
                // let options = {
                //     // "height": "11.25in",
                //     // "width": "8.5in",
                //     // "header": {
                //     //     "height": "20mm"
                //     // },
                //     // "footer": {
                //     //     "height": "20mm",
                //     // },
                // };
                // pdf.create(template, options).toFile(appRoot + "/report.pdf", function (err, data) {
                //     if (err) {
                //         ResHelper.apiResponse(res, false, "Uanbale to genrate Pdf", 400, {}, "");
                //         return;
                //     } else {

                //     }
                // });
                //let bs64 = await pdf2base64(appRoot + "/report.pdf");
                //let url = await uploadToS3("channel_partner_detail", bs64, dsaId, 'application/pdf', 'pdf');
                ResHelper.apiResponse(res, true, "Success", 201, url, "");
                return;
            }
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const uploadDsaVerificationDocument = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.uploadDsaVerificationDocument.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { dsaId, file } = req.body;
            let uniqueString = randomstring.generate();
            let url = await uploadToS3("verificationDocument", file, dsaId + uniqueString, 'application/octet-stream', 'pdf');
            await DSAService.addDsaVerificationDocument(dsaId, url);
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getDsaVerificationDocument = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getDsaVerificationDocument.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { dsaId } = req.body;
            let documents = await DSAService.getDsaVerificationDocument(dsaId);
            ResHelper.apiResponse(res, true, "Success", 201, documents, "");
        }

    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const downloadDsaList = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getRuloansCustomers.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { hierarchy_crm_filter, call_status, is_employee_filter, referrer_name_filter, pageNumber, pageSize, partnerNameFilter, search, joiningDateStartFilter, joiningDateEndFilter, assignDateStartFilter, assignDateEndFilter, signUpStepsFiltersStart, signUpStepsFiltersEnd, statusUpdateDateStartFilter, statusUpdateDateEndFilter, userFilter, creditCardSubmited, loanSubmited, lntLoanSubmitted, customer_full_name_filter, profession_filter, pan_number_filter, partner_full_name_filter, business_head_name_filter, customer_mobile_number_filter, home_address_city_filter, home_address_state_filter, status_filter, sub_status_filter, utm_source_filter, utm_medium_filter, utm_campaign_filter, utm_channel_filter, utm_term_filter, utm_main_source_filter, utm_device_filter, dsa_verification_status_filter, user_type_filter, user_type, signup_steps_filter, joining_signed_filter, payout_signed_filter, zip_code_filter, query, consent_otp_verified_filter, allow_duplicates, forChannelManager, previous_partner_name_filter, callPendingStartFilter, callPendingEndFilter, page_source_filter } = req.body;

            let role = req.loggedInUser.role;
            let childPhones = null;
            let allow_masking = checkMaskingAllowed(role);
            if (!(role == "HR" || role == "VERIFICATION_AGENCY")) {
                childPhones = role == "CEO" ? null : req?.loggedInUser?.userPhone;
            };
            let where = [];
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }
            if (userFilter) {
                where.push(['c.partner_code', '=', userFilter]);
            }
            if (req.loggedInUser.role == "VERIFICATION_AGENCY") {
                where.push(['', '=', `pending`]);
            }
            if (req.loggedInUser.role == "VERIFICATION_AGENCY") {
                where.push(['c.dsa_verification_status', '=', `pending`]);
            }
            if (req.loggedInUser.role == "VERIFICATION_AGENCY") {
                where.push(['c.assigned_to', '=', req.loggedInUser.id])
            }
            if (signUpStepsFiltersStart || signUpStepsFiltersEnd) {
                where.push([' c.signup_steps_completed ', ` between ${signUpStepsFiltersStart / 16.666666666} and ${signUpStepsFiltersEnd / 16.666666666} `, null]);
            }
            if (joiningDateStartFilter && joiningDateEndFilter) {
                where.push([' DATE(c.created_at) ', ` between DATE("${joiningDateStartFilter}") and DATE("${joiningDateEndFilter}")  `, null]);
            } else if (joiningDateStartFilter) {
                where.push([' DATE(c.created_at) ', ` >= DATE("${joiningDateStartFilter}")  `, null]);
            } else if (joiningDateEndFilter) {
                where.push([' DATE(c.created_at) ', ` <= DATE("${joiningDateEndFilter}")  `, null]);
            }
            if (assignDateStartFilter) {
                where.push([' DATE(c.partner_assigned_date) ', ` between DATE("${assignDateStartFilter}") and DATE("${assignDateEndFilter}")  `, null]);
            }
            if (callPendingStartFilter) {
                where.push([' (DATE(c.call_remark_date) ', ` not between DATE("${callPendingStartFilter}") and DATE("${callPendingEndFilter}") or c.call_remark_date is null ) `, null]);
            }
            if (statusUpdateDateStartFilter) {
                where.push([' DATE(c.dsa_status_updated_at) ', ` between DATE("${statusUpdateDateStartFilter}") and DATE("${statusUpdateDateEndFilter}")  `, null]);
            }
            if (signUpStepsFiltersStart || signUpStepsFiltersEnd) {
                where.push([' c.signup_steps_completed ', ` between ${signUpStepsFiltersStart / 16.666666666} and ${signUpStepsFiltersEnd / 16.666666666} `, null]);
            }
            if (partnerNameFilter) {
                if (partnerNameFilter == "Not Assigned") {
                    where.push(['p.full_name', ' is null ', null]);
                } else {
                    where.push(['p.full_name', ' = ', partnerNameFilter]);
                }
            }

            //Variable filters
            if (forChannelManager) {
                childPhones = null;
                where.push(['c.channel_manager_code', ' =', `${req?.loggedInUser?.userPhone}`]);
            }
            if (customer_full_name_filter) {
                where.push(['c.full_name', ' like', `%${customer_full_name_filter}%`]);
            }
            if (hierarchy_crm_filter) {
                where.push(['c.hierarchy_crm', ' like', `%${hierarchy_crm_filter}%`]);
            };
            if (pan_number_filter) {
                where.push(['k.permanent_account_number', ' like', `%${pan_number_filter}%`]);
            }
            if (profession_filter) {
                where.push(['c.profession', ' like', `%${profession_filter}%`]);
            }
            if (page_source_filter) {
                where.push(['c.page_source', ' like', `%${page_source_filter}%`]);
            }
            if (previous_partner_name_filter) {
                where.push(['pp.full_name', ' like', `%${previous_partner_name_filter}%`]);
            }
            if (partner_full_name_filter) {
                where.push(['p.full_name', ' like', `%${partner_full_name_filter}%`]);
            }
            if (business_head_name_filter) {
                where.push(['bh.full_name', ' like', `%${business_head_name_filter}%`]);
            }
            if (customer_mobile_number_filter) {
                where.push(['c.dsa_mobile_number', ' like', `%${customer_mobile_number_filter}%`]);
            }
            if (home_address_city_filter) {
                let escapedCity = home_address_city_filter.replace(/'/g, "''");
                where.push([`(c.home_address_city LIKE '%${escapedCity}%' OR c.dsa_id IN (SELECT dsa_id FROM ru_dsa_addresses WHERE city LIKE '%${escapedCity}%'))`, '']);
            }
            if (home_address_state_filter) {
                let escapedState = home_address_state_filter.replace(/'/g, "''");
                where.push([`(c.home_address_state LIKE '%${escapedState}%' OR c.dsa_id IN (SELECT dsa_id FROM ru_dsa_addresses WHERE state LIKE '%${escapedState}%'))`, '']);
            }
            if (status_filter) {
                where.push([' case when pvs.value  is null then "Cold" else pvs.value end ', ' like', `%${status_filter}%`]);
            }
            if (sub_status_filter) {
                where.push(['pvss.value', ' like', `%${sub_status_filter}%`]);
            }
            if (referrer_name_filter) {
                where.push(['rfp.full_name', ' like', `%${referrer_name_filter}%`]);
            }
            if (utm_source_filter) {
                where.push(['c.utm_source', ' like', `%${utm_source_filter}%`]);
            }
            if (utm_medium_filter) {
                where.push(['c.utm_medium', ' like', `%${utm_medium_filter}%`]);
            }
            if (utm_campaign_filter) {
                where.push(['c.utm_campaign', ' like', `%${utm_campaign_filter}%`]);
            }
            if (utm_channel_filter) {
                where.push(['c.utm_channel', ' like', `%${utm_channel_filter}%`]);
            }
            if (utm_term_filter) {
                where.push(['c.utm_term', ' like', `%${utm_term_filter}%`]);
            }
            if (utm_main_source_filter) {
                where.push(['case when c.utm_main_source is null then c.utm_main_source else c.utm_main_source end', ' like', `%${utm_main_source_filter}%`]);
            }
            if (dsa_verification_status_filter) {
                where.push(['c.dsa_verification_status', ' like', `${dsa_verification_status_filter}%`]);
            }
            if (user_type_filter) {
                where.push(['c.user_type', ' like', `%${user_type_filter}%`]);
            }
            if (user_type) {
                where.push(['c.user_type', ' like', `%${user_type}%`]);
            } else {
                where.push(['(c.user_type is null or c.user_type != "biller")', '', null]);
            };

            if (call_status) {
                where.push(['cl.call_status', ' =', `${call_status}`]);
            }
            if (signup_steps_filter) {
                where.push(['c.signup_steps_completed', ' like', `%${Math.round(+signup_steps_filter / 16.666666666)}%`]);
            }
            if (is_employee_filter) {
                where.push([' case when c.is_employee = 1 then "yes" else "no" end ', ' like', `%${is_employee_filter}%`]);
            };
            if (joining_signed_filter) {
                if (joining_signed_filter.toLowerCase() == "yes") {
                    where.push(['k.mou_signed_date', ' is not null', ``]);
                } else {
                    where.push(['k.mou_signed_date', ' is null', ``]);
                }
            }
            if (payout_signed_filter) {
                if (payout_signed_filter.toLowerCase() == "yes") {
                    where.push(['k.payout_agreement_signed_date', ' is not null', ``]);
                } else {
                    where.push(['k.payout_agreement_signed_date', ' is null', ``]);
                }
            }
            if (zip_code_filter) {
                where.push(['c.home_address_pincode', ' like', `%${zip_code_filter}%`]);
            };
            if (childPhones) {
                let depthQuery = `c.materialized_path like "%${req?.loggedInUser?.materialized_path}%" and c.materialized_path_depth >= ${req?.loggedInUser?.materialized_path_depth}`;
                where.push([depthQuery, '', null]);
                childPhones = null;
            };
            if (consent_otp_verified_filter) {
                if (consent_otp_verified_filter.toLowerCase() == "yes") {
                    where.push(['c.consent_otp_verified_at', ' is not null ', ""]);
                } else {
                    where.push(['c.consent_otp_verified_at', ' is null ', ""]);
                }
            }
            //Variable filters

            let having = "";
            let checkHaving = () => {
                if (having?.length) {
                    having += " and "
                } else {
                    having += " having "
                }
            };
            if (creditCardSubmited) {
                checkHaving();
                having += `creditCardSubmited = ${creditCardSubmited}`
            };
            if (loanSubmited) {
                checkHaving();
                having += `loanSubmited = ${loanSubmited}`
            }
            if (lntLoanSubmitted) {
                checkHaving();
                having += `lntLoanSubmitted = ${lntLoanSubmitted}`
            }
            let searchList = [];
            if (search) {
                searchList.push(['c.dsa_mobile_number', 'like', `%${search}%`]);
                searchList.push(['c.full_name', 'like', `%${search}%`]);
                searchList.push(['c.home_address_pincode', 'like', `%${search}%`]);
                searchList.push(['k.permanent_account_number', 'like', `%${search}%`]);
            }
            let reqQuery = query ? " where " + query : "";
            let dsa;
            let dsaCount;
            if (allow_duplicates) {
                dsa = await DSAService.getRuloansCustomersDownload(where, searchList, childPhones, allow_masking, reqQuery, req.loggedInUser, call_status);

            } else {
                dsa = await DSAService.getUniqueDsaDownload(where, searchList, childPhones, allow_masking, reqQuery, req.loggedInUser, call_status);
            }
            dsaCount = dsa?.totalCount;
            let emailQuery = dsa?.emailQuery;
            dsa = dsa.results;
            if (!dsa || dsa.length == 0) {
                ResHelper.apiResponse(res, false, "No Data Found", 400, {}, "");
                return;
            }

            await ApplicationLogServices?.createExportLog(req);

            if (dsaCount > 100000) {
                sendDsaExportEmailQueue.add(emailQuery);
                return ResHelper.apiResponse(res, true, "Success", 200, "email", "");
            }
            let fields = Object.keys(dsa[0]);
            const opts = { fields };
            const parser = new Parser(opts);
            const csv = parser.parse(dsa);
            await fs.promises.writeFile(appRoot + '/temp.csv', csv);
            let base64 = await fs.promises.readFile(appRoot + '/temp.csv', 'base64')
            let uniqueString = randomstring.generate();
            let uniqueString1 = randomstring.generate();
            let url = await uploadToS3(allow_duplicates ? "channel_partner_leads" : "channel_partners", base64, uniqueString1 + uniqueString, 'application/octet-stream', 'csv');
            ResHelper.apiResponse(res, true, "Success", 200, url, "");
        }
    }
    catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}
const downloadAllLoanApplicationsList = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.downloadAllLoanApplicationsList.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, search, stateFilter, cityFilter, type, loanAmountFilterStart, loanAmountFilterEnd, suggestedBanksFilter } = req.body;
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }
            let where = [];
            if (loanAmountFilterStart) {
                where.push([' l.loan_amount ', ` between ${loanAmountFilterStart} and ${loanAmountFilterEnd}   `, null]);
            }
            if (type) {
                where.push(['lt.loan_name', ' = ', type]);
            }
            if (stateFilter) {
                where.push(['d.address_state', '=', `${stateFilter}`]);
            }
            if (cityFilter) {
                where.push(['d.address_city', '=', `${cityFilter}`]);
            }
            if (type) {
                where.push(['lt.loan_name', ' = ', type]);
            }
            let searchList = [];
            if (search) {
                searchList.push(['d.full_name', 'like', `%${search}%`]);
                searchList.push(['d.customer_mobile_number', 'like', `%${search}%`]);
            }
            let allLoanApplications = await DSAService.getAllLoanApplications(where, searchList, pageNumber * pageSize, pageSize, suggestedBanksFilter);
            allLoanApplications = allLoanApplications.loanApplications;
            if (!allLoanApplications || allLoanApplications.length == 0) {
                ResHelper.apiResponse(res, false, "No Data Found", 400, {}, "");
                return;
            }
            let fields = Object.keys(allLoanApplications[0]);
            const opts = { fields };
            const parser = new Parser(opts);
            const csv = parser.parse(allLoanApplications);
            await fs.promises.writeFile(appRoot + '/temp.csv', csv);
            let base64 = await fs.promises.readFile(appRoot + '/temp.csv', 'base64')
            let uniqueString = randomstring.generate();
            let uniqueString1 = randomstring.generate();
            let url = await uploadToS3("loan_applications", base64, uniqueString1 + uniqueString, 'application/octet-stream');
            ResHelper.apiResponse(res, true, "Success", 200, url, "");
        }
    } catch (err) {

        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const downloadAllCreditCardApplicationsList = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.downloadAllCreditCardApplicationsList.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, search, stateFilter, cityFilter, loanAmountFilterStart, loanAmountFilterEnd } = req.body;
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }
            if (stateFilter) {
                where.push(['d.address_state', '=', `${stateFilter}`]);
            }
            if (cityFilter) {
                where.push(['d.address_city', '=', `${cityFilter}`]);
            }
            let where = [];
            let searchList = [];
            if (search) {
                searchList.push(['d.full_name', 'like', `%${search}%`]);
                searchList.push(['d.customer_mobile_number', 'like', `%${search}%`]);
            }
            let allCreditCardApplications = await DSAService.getAllCreditCardApplications(where, searchList, pageNumber * pageSize, pageSize);
            allCreditCardApplications = allCreditCardApplications.creditCardApplications;
            if (!allCreditCardApplications || allCreditCardApplications.length == 0) {
                ResHelper.apiResponse(res, false, "No Data Found", 400, {}, "");
                return;
            }
            let fields = Object.keys(allCreditCardApplications[0]);
            const opts = { fields };
            const parser = new Parser(opts);
            const csv = parser.parse(allCreditCardApplications);
            await fs.promises.writeFile(appRoot + '/temp.csv', csv);
            let base64 = await fs.promises.readFile(appRoot + '/temp.csv', 'base64')
            let uniqueString = randomstring.generate();
            let uniqueString1 = randomstring.generate();
            let url = await uploadToS3("credit_card_applications", base64, uniqueString1 + uniqueString, 'application/octet-stream');
            ResHelper.apiResponse(res, true, "Success", 200, url, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const reassignPartner = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.reassignPartner.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { dsaIdArray, partnerPhone, query } = req.body;
            const role = req.loggedInUser.role || null;
            const isReplay = req?.loggedInUser?.isApprovalReplay === true;
            if (!isReplay && !["CEO", "CTO", "COO", "CFO"].includes(role)) {
                return ResHelper.apiResponse(res, false, "You are not authorized to perform this action", 400, {}, "");
            }

            let message = "Success";
            // Action not allowed between 11 AM and 6 PM
            if (query || dsaIdArray?.length > 1) {
                const now = new Date();
                const hours = now.getHours();
                if (hours >= 17 && hours < 18) {
                    return ResHelper.apiResponse(res, false, "Action not allowed between 11 AM and 6 PM", 400, {}, "")
                };

                const formatted = `(${dsaIdArray.map(id => `'${id}'`).join(', ')})`;

                query = query ? `${query} and c.partner_code is not null and c.partner_code != '9930570707'` : `c.partner_code is not null and  c.partner_code != '9930570707' and c.dsa_id in ${formatted}`;
                query = `${query} `;
                let dsaUsers = await DSAService.getDsaUsersLists(query, 0, 1);

                query = null;
                if (dsaUsers?.length) {
                    return ResHelper.apiResponse(res, false, "Bulk assign failed: Previous partner must be empty or Ruloans HO!", 400, {}, "")
                };
            };

            if (query) {
                await KafkaServices.connectKafkaProducer();
                const dsaUsersCount = await DSAService.getDsaUsersListCount(query);
                let offset = 0;
                let limit = 100;
                for (let i = 0; i < dsaUsersCount[0].totalCount; i += limit) {
                    let dsaUsers = await DSAService.getDsaUsersLists(query, offset, limit);
                    let extractedDsaIds = dsaUsers?.map((obj) => obj?.dsa_id);
                    let moduleName = "dsa_channel_partners_bulk_assign_partner";
                    if (extractedDsaIds.length === 1) {
                        moduleName = "dsa_channel_partners_assign_partner";
                    }
                    const isAuthorised = rbacMiddleware.hasPermission(await rbacMiddleware.getPermissions(Buffer.from(req.loggedInUser.role_id.data)), moduleName, "update");

                    offset += limit;
                    let url = '';
                    if (process.env.ENVIRONMENT == "prod") {
                        url = `https://crm.ruloans.com/api/v1/dsa/reassignPartner`
                    } else if (process.env.ENVIRONMENT == "uat") {
                        url = `https://crm-uat.ruloans.com/api/v1/dsa/reassignPartner`
                    } else {
                        const protocol = req.protocol || 'http';
                        const host = req.get('host'); // better than req.headers.host
                        url = `${protocol}://${host}/v1/dsa/reassignPartner`;
                    }

                    const method = "POST"
                    const header = {
                        "Authorization": req?.headers?.authorization,
                        "Content-Type": "text/plain"
                    };

                    if (!isAuthorised && !req?.loggedInUser?.isSuperAdmin) return res.sendStatus(403);
                    const reassignDsaPartner = new ReassignDsaCRM(url, method, JSON.stringify({ dsaIdArray: extractedDsaIds, partnerPhone }), header, "ReassignDsaCRM");
                    console.log(`batch:${i}`, reassignDsaPartner);
                    await KafkaServices.sendToKafkaEngine(reassignDsaPartner);
                }
            } else {
                let prevCount = await DSAService.getPartnerHierarchyCount(partnerPhone);
                if (prevCount > 4) {
                    return ResHelper.apiResponse(res, true, "Partner hierarchy limit reached", 400, {}, "");
                }
                for (let i = 0; i < dsaIdArray?.length; i++) {
                    const { prevData, newData, status } = await DSAService.reassignPartner(dsaIdArray[i], partnerPhone, prevCount);
                    if (status == "69") {
                        message = "Same Channel Partner and DSA error";
                    } else {
                        var { partner_phone1, partner_phone, heirarchy_level, business_head_code, ...rest1 } = prevData;
                        var { partner_phone, ...rest2 } = newData;
                        log_data = { log_type: "dsa_basic_details", application_id: dsaIdArray[i], created_by: req?.loggedInUser?.id };
                        createActivityLogKafka({ ...log_data, old_data: rest1, new_data: rest2 });
                        try {
                            await KafkaServices.connectKafkaProducer();
                            const evt = new KafkaServices.VendorSnapshotEvent('PARTNER_CHANGED', dsaIdArray[i], { partner_code: partnerPhone }, req?.loggedInUser?.id);
                            await KafkaServices.sendToKafkaVendorSnapshot(evt);
                        } catch (kafkaErr) {
                            logger.error('VendorSnapshotEvent Kafka failed in reassignPartner', kafkaErr);
                        }
                    }
                }
            };
            let status = message == "Cyclic channel partner error" ? 400 : 201;
            ResHelper.apiResponse(res, true, message, status, {}, "");
        }
    } catch (err) {
        console.log(err);
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getLedger = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getLedger.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { dsa_mobile_number, has_ratio_of_payout_vs_actual, cc_emails } = req.body;
            let result = await DSAService.getDsaFullDetailsPhone(dsa_mobile_number);
            let bhName = await DSAService.getDsaBHName(dsa_mobile_number);
            let internalId = result.netsuite_vendor_id;
            if (!internalId) {
                return ResHelper.apiResponse(res, true, "Vendor Id Not Found For NetSuite", 400, {}, "");
            }
            const ccEmailArray = cc_emails ? cc_emails.split(',').map(email => email.trim()).filter(Boolean) : [];
            getLedgerDataOnEmail.add({ id: internalId, name: Boolean(result?.first_name || result?.last_name_) ? ` ${result?.first_name} ${result?.last_name}` : result?.full_name, user: req.loggedInUser, bhName: bhName, has_ratio_of_payout_vs_actual: has_ratio_of_payout_vs_actual, cc_emails: ccEmailArray });
            ResHelper.apiResponse(res, true, "Report Will Be Send On Mail Shortly", 200, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getBhObject = () => {
    business_head: business_head?.dsa_mobile_number || nul
};

const reassignPartnerExternal = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.reassignPartner.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { dsaId, partnerPhone } = req.body;

            const blockedDsaIds = ['30468787', '72609211'];
            if (blockedDsaIds.includes(String(dsaId).trim())) {
                return ResHelper.apiResponse(res, false, "Partner reassign is not allowed for this DSA", 400, {}, "");
            }

            const data = await DSAService.getDsaById(dsaId);
            if (data?.partner_code && data?.partner_code != "9930570707") {
                let business_head = await getBusinessHeadRecursively(partnerPhone);
                return ResHelper.apiResponse(res, false, "Partner already exist for this DSA", 400, { business_head: business_head?.dsa_mobile_number || null }, "");
            };

            let { dsa_mobile_number, materialized_path_depth } = await DSAService.getPartnerHierarchyCount(partnerPhone, true);
            partnerPhone = dsa_mobile_number;
            // if (prevCount > 4) {
            //     let business_head = await getBusinessHeadRecursively(partnerPhone);
            //     return ResHelper.apiResponse(res, false, "Partner hierarchy limit reached", 400, { business_head: business_head?.dsa_mobile_number || null }, "");
            // };
            const { prevData, newData, business_head } = await DSAService.reassignPartner(dsaId, partnerPhone, materialized_path_depth, true);
            const safePrevData = prevData || {};
            const safeNewData = newData || {};
            var { partner_phone1, partner_phone, heirarchy_level, business_head_code, ...rest1 } = safePrevData;
            var { partner_phone, ...rest2 } = safeNewData;

            try {
                log_data = { log_type: "dsa_basic_details", application_id: dsaId, created_by: "created by worker" };
                await createActivityLogKafka({ ...log_data, old_data: rest1, new_data: rest2 });
            } catch (kafkaErr) {
                logger.error("Kafka logging failed in reassignPartnerExternal", kafkaErr);
            }

            try {
                await KafkaServices.connectKafkaProducer();
                const evt = new KafkaServices.VendorSnapshotEvent('PARTNER_CHANGED', dsaId, { partner_code: partnerPhone }, null);
                await KafkaServices.sendToKafkaVendorSnapshot(evt);
            } catch (kafkaErr) {
                logger.error('VendorSnapshotEvent Kafka failed in reassignPartnerExternal', kafkaErr);
            }

            ResHelper.apiResponse(res, true, "Success", 201, { business_head }, "");
        }
    } catch (err) {
        console.log(err);
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const reassignPartnerCsv = async (dsaId, partnerPhone) => {
    try {
        let prevCount = await DSAService.getPartnerHierarchyCount(partnerPhone);
        if (prevCount > 4) {
            console.log("Partner hierarchy limit reached");
            return ("Partner hierarchy limit reached");
        };
        const { prevData, newData } = await DSAService.reassignPartner(dsaId, partnerPhone, prevCount, false);
        let difference = jsonDifference(prevData, newData);
        const userId = null;
        await ApplicationLogServices.bulkCreate(difference, dsaId, "dsa", userId);
        console.log("Success");
        return ("Success");
    } catch (err) {
        console.log(err);
    }
};

const getRuloansCustomersDropDown = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getRuloansCustomersDropDown.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, search } = req.body;
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }
            let dsa = await DSAService.getRuloansCustomersDropDown(search, pageNumber * pageSize, pageSize);
            ResHelper.apiResponse(res, true, "Success", 201, dsa, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getLntApplicationById = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getLntApplicationById.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { application_id } = req.body;
            let application = await DSAService.getLntApplicationById(application_id);
            ResHelper.apiResponse(res, true, "Success", 201, application, "");
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getCreditCardApplicationById = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getCreditCardApplicationById.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { application_id } = req.body;
            let application = await DSAService.getCreditCardApplicationById(application_id);
            ResHelper.apiResponse(res, true, "Success", 201, application, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getAllLntApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllLntApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateFilterLogin, endDateFilterLogin, pageNumber, pageSize, search, partnerNameFilter, stageFilter, subStageFilter, userFilter, idFilter, partnerCodeFilter, appRefFilter, loanAmountFilter, loanTenureFilter, employmentTypeFilter, annualIncomeFilter, statusFilter, failureFilter, customerMobileFilter, customerEmailFilter, customerPanFilter, customerNameFilter, disbursedAmountFilter, is_export, filterModel, logicOperator } = req.body;
            let role = req.loggedInUser.role;
            let allow_masking = checkMaskingAllowed(role) && is_export;
            let childPhones = null;
            let loggedInUser = null;
            let masterRoles = ["HR", "VERIFICATION_AGENCY", "TECH_HEAD"];
            if (!masterRoles?.includes(role)) {
                childPhones = role === "CEO" ? '9987884000' : req.loggedInUser.userPhone;
                loggedInUser = req?.loggedInUser?.id;
            }
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }

            let where = [];
            let searchList = [];

            if (userFilter) {
                where.push(['c.partner_code', '=', userFilter]);
            };

            if (stageFilter) {
                if (stageFilter?.includes("/")) {
                    let state = stageFilter.split("/");
                    if (state[1]?.length) {
                        where.push(['ltm.sub_stage', ' like ', `%${state[1]}%`]);
                    } else {
                        where.push(['ltm.stage', ' like ', `%${stageFilter[0]}%`]);
                    }
                } else {
                    where.push(['ltm.stage', ' like ', `%${stageFilter}%`]);
                }
            }
            if (subStageFilter) {
                where.push(['ltm.sub_stage', '=', subStageFilter])
            }
            if (startDateFilter || endDateFilter) {
                where.push([' DATE(ltm.disbursal_date_iso) ', ` between DATE("${startDateFilter}") and DATE("${endDateFilter}")  `, null]);
            }
            if (startDateFilterLogin || endDateFilterLogin) {
                where.push([' DATE(lt.application_date_iso) ', ` between DATE("${startDateFilterLogin}") and DATE("${endDateFilterLogin}")  `, null]);
            }
            if (partnerNameFilter) {
                where.push(['c.full_name', ' like ', `%${partnerNameFilter}%`])
            }


            if (partnerCodeFilter) {
                where.push(['lt.dsa_mobile_number', ' like ', `%${partnerCodeFilter}%`])
            }
            if (idFilter) {
                where.push(['lt.id', ' like ', `%${idFilter}%`])
            }
            if (appRefFilter) {
                where.push(['ltm.app_ref', ' like ', `%${appRefFilter}%`])
            }
            if (loanAmountFilter) {
                where.push(['lt.loan_amount', ' like ', `%${loanAmountFilter}%`])
            }
            if (loanTenureFilter) {
                where.push(['lt.loan_tenure', ' like ', `%${loanTenureFilter}%`])
            }
            if (employmentTypeFilter) {
                where.push(['lt.employment_type', ' like ', `%${employmentTypeFilter}%`])
            }
            if (annualIncomeFilter) {
                where.push(['lt.salary_per_annum', ' like ', `%${annualIncomeFilter}%`])
            }
            if (statusFilter) {
                const status = {
                    'Customer Basic Details Saved': 1,
                    'Consent Form Signed': 2,
                    'Application In Process': 3,
                    'Lead Generated': 4,
                    'Application In Process': 5,
                    'Application Rejected': 6,
                    'Loan Disbursed': 7,
                }
                if (status[statusFilter]) {
                    where.push([`lt.application_status`, ' like ', `%${status[statusFilter]}%`])
                }
            }
            if (failureFilter) {
                where.push(['ltm.failure_reason', ' like ', `%${failureFilter}%`])
            }
            if (customerMobileFilter) {
                where.push(['d.customer_mobile_number', ' like ', `%${customerMobileFilter}%`])
            }
            if (customerEmailFilter) {
                where.push(['d.email_address', ' like ', `%${customerEmailFilter}%`])
            }
            if (customerNameFilter) {
                where.push(['d.full_name', ' like ', `%${customerNameFilter}%`])
            }
            if (customerPanFilter) {
                where.push([' d.permanent_account_number', ' like ', `%${customerPanFilter}%`])
            }
            if (disbursedAmountFilter) {
                where.push(['ltm.bre_max_eligibility', ' like ', `${disbursedAmountFilter}%`])
            }
            if (search) {
                searchList.push(['d.full_name', 'like', `%${search}%`]);
                searchList.push(['d.customer_mobile_number', 'like', `%${search}%`]);
                searchList.push(['ltm.app_ref', 'like', `%${search}%`])
            }

            // MUI X DataGrid filterModel (optional) — keep legacy filters intact.
            // [getAllLntApplications isEmpty] — default CustomOperatorHandlers only (no custom EXISTS/NOT EXISTS for ltm.stage).
            if (filterModel?.items?.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getAllLntApplicationsFieldMapping, operatorHandlers);

                if (whereFilterArray?.length > 0) {
                    const filters = whereFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    const whereFilterQuery = filters.join(logicOp);
                    if (whereFilterQuery) {
                        where.push([`(${whereFilterQuery})`, '', null]);
                    }
                }
            }

            if (is_export) {
                const { query, queryCount, bindParams } = await DSAService.getAllLntApplications(where, searchList, pageNumber * pageSize, pageSize, childPhones, loggedInUser, allow_masking, true);
                sendMisReportExportEmailQueue.add({
                    query,
                    queryCount,
                    bindParams,
                    subject: "LNT Loan Applications",
                    filename: "lnt_loan_applications",
                    loggedInUser: req?.loggedInUser,
                });
                await ApplicationLogServices?.createExportLog(req);
                ResHelper.apiResponse(res, true, "Report will be sent to your email after some time.", 200, {}, "");
            } else {
                let user = await DSAService.getAllLntApplications(where, searchList, pageNumber * pageSize, pageSize, childPhones, loggedInUser, allow_masking);
                ResHelper.apiResponse(res, true, "Success", 200, user, "");
            };
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getAllIndifiApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllIndifiApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDisbursedDateFilter, endDisbursedDateFilter, applicationIdFilter, indifilApplicationIdFilter, count_only, pageNumber, pageSize, search, userFilter, statusFilter, startDateFilter, endDateFilter, customerNameFilter, mobileNumberFilter, assignToFilter, assignByFilter, businessNameFilter, businessTypeFilter, offeredAmountFilter, dsaNameFilter, dsaMobileFilter, panFilter, requestedAmountFilter, tenureFilter, averageRevenueFilter, businessNatureFilter, segmentFilter, stateFilter, cityFilter, customerEmailFilter, filterModel, logicOperator } = req.body;
            let all_privilege = ["HR", "VERIFICATION_AGENCY", "CEO"];
            let role = req?.loggedInUser?.role;
            let childPhones = null;
            let loggedInUser = null;

            if (!all_privilege?.includes(role)) {
                if (role == 'CEO') {
                    loggedInUser = req?.loggedInUser?.id;
                    childPhones = req.loggedInUser.role === "CEO" ? '9987884000' : req.loggedInUser.userPhone;
                }
            };


            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }

            let where = [];

            if (userFilter) {
                where.push(['c.partner_code', '=', userFilter]);
            };

            if (applicationIdFilter) {
                where.push(['rifl.application_id', ` like '%${applicationIdFilter}%' `, null]);
            }
            if (indifilApplicationIdFilter) {
                where.push(['riflm.indifi_application_id', ` like '%${indifilApplicationIdFilter}%' `, null]);
            }
            if (statusFilter) {
                where.push(['riflst.application_status_description', ` like '%${statusFilter}%' `, null]);
            }
            if (startDateFilter || endDateFilter) {
                where.push([' DATE(riflm.created_at) ', ` between DATE("${startDateFilter}") and DATE("${endDateFilter}")  `, null]);
            }
            if (startDisbursedDateFilter || endDisbursedDateFilter) {
                where.push([' DATE(riflm.disbursal_date_iso) ', ` between DATE("${startDisbursedDateFilter}") and DATE("${endDisbursedDateFilter}")  `, null]);
            }
            if (customerNameFilter) {
                where.push([' d.full_name ', ` like '%${customerNameFilter}%' `, null]);
            }
            if (customerNameFilter) {
                where.push([' d.full_name ', ` like '%${customerNameFilter}%' `, null]);
            }
            if (mobileNumberFilter) {
                where.push([' rifl.customer_mobile_number ', ` like '%${mobileNumberFilter}%' `, null]);
            }
            if (businessNameFilter) {
                where.push([' rifl.business_name ', ` like '%${businessNameFilter}%' `, null]);
            }
            if (businessTypeFilter) {
                where.push([' rifl.business_type ', ` like '%${businessTypeFilter}%' `, null]);
            }
            if (offeredAmountFilter) {
                where.push([' riflm.offered_loan_amount ', ` like '%${offeredAmountFilter}%' `, null]);
            }
            if (dsaNameFilter) {
                where.push([' c.full_name ', ` like '%${dsaNameFilter}%' `, null]);
            }
            if (dsaMobileFilter) {
                where.push([' rifl.dsa_mobile_number ', ` like '%${dsaMobileFilter}%' `, null]);
            }
            if (panFilter) {
                where.push([' rifl.permanent_account_number ', ` like '%${panFilter}%' `, null]);
            }
            if (requestedAmountFilter) {
                where.push([' riflm.requested_loan_amount ', ` like '%${requestedAmountFilter}%' `, null]);
            }
            if (tenureFilter) {
                where.push([' rifl.loan_tenure ', ` like '%${tenureFilter}%' `, null]);
            }
            if (tenureFilter) {
                where.push([' rifl.loan_tenure ', ` like '%${tenureFilter}%' `, null]);
            }
            if (tenureFilter) {
                where.push([' rifl.loan_tenure ', ` like '%${tenureFilter}%' `, null]);
            }
            if (averageRevenueFilter) {
                where.push([' rifl.average_monthly_revenue ', ` like '%${averageRevenueFilter}%' `, null]);
            }
            if (businessNatureFilter) {
                where.push([' rifl.business_nature ', ` like '%${businessNatureFilter}%' `, null]);
            }
            if (segmentFilter) {
                where.push([' rifl.segment_category_name ', ` like '%${segmentFilter}%' `, null]);
            }
            if (stateFilter) {
                where.push([' d.address_state ', ` like '%${stateFilter}%' `, null]);
            }
            if (cityFilter) {
                where.push([' d.address_city ', ` like '%${cityFilter}%' `, null]);
            }
            if (customerEmailFilter) {
                where.push([' d.email_address ', ` like '%${customerEmailFilter}%' `, null]);
            }
            let searchList = [];
            if (search) {
                searchList.push(['d.full_name', 'like', `%${search}%`]);
                searchList.push(['d.customer_mobile_number', 'like', `%${search}%`]);
            }

            // MUI X DataGrid filterModel (optional) — keep legacy filters intact.
            if (filterModel?.items?.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getAllIndifiApplicationsFieldMapping, operatorHandlers);

                if (whereFilterArray?.length > 0) {
                    const filters = whereFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    const whereFilterQuery = filters.join(logicOp);
                    if (whereFilterQuery) {
                        where.push([`(${whereFilterQuery})`, '', null]);
                    }
                }
            }
            let user = await DSAService.getAllIndifiApplications(count_only, where, searchList, pageNumber * pageSize, pageSize, childPhones, loggedInUser);
            ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getIndifiApplicationDetailsById = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getIndifiApplicationDetailsById.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { application_id } = req?.body;
            const data = await DSAService.getIndifiApplicationDetailsById(application_id);
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    } catch (err) {

        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getPayoutByPanNumber = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getPayoutByPanNumber.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, panNumber } = req.body;
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }
            let where = [];
            let dsa = await DSAService.getDsaByPan(panNumber);
            if (!dsa) {
                ResHelper.apiResponse(res, false, "No Such Dsa Found", 400, {}, "");
                return;
            } else {
                where.push([' lp.phone ', `  =  `, dsa.customer_mobile_number]);
                where.push(['lp.is_updated', ` = `, true])
                let payouts = await LeadService.getLeadPayouts(pageNumber * pageSize, pageSize, null, where);
                ResHelper.apiResponse(res, true, "Success", 200, payouts, "");
            }

        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

/** B2B (authorizeDsaCentralized): read vendor_code / branch_code from ru_dsa_kyc_data (null if unset). Single dsa_id only. */
const refreshDsaKycVendorBranchFromNsExternal = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.refreshDsaKycVendorBranchFromNs.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        const payload = await DSAService.refreshDsaKycVendorBranchFromNsB2b(req.body);
        return ResHelper.apiResponse(res, payload.ok, payload.message, payload.code, payload, "");
    } catch (err) {
        logger.error(err);
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

// const getLntForDashboard = async (req, res, next) => {
//     try {

//         const { error } = DSAValidationV1.getLntForDashboard.validate(req.body);
//         if (error) {
//             ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
//         } else {
//             let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter } = req.body;
//             let finalData = {
//                 DSANumber: req.loggedInUser.userPhone,
//                 disbursedDateStart: startDateFilter,
//                 disbursedDateEnd: endDateFilter,
//                 applicationDateStart: startDateLoginFilter,
//                 applicationDateEnd: endDateLoginFilter
//             }
//             let finalArray = await getLntReport(finalData);
//             ResHelper.apiResponse(res, true, "Success", 200, [finalArray.data], "");
//         }

//     } catch (err) {
//         logger.error(err);
//         ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
//     }
// }

const getLntForDashboard = async (req, res, next) => {
    try {

        const { error } = DSAValidationV1.getLntForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, date, type, level } = req.body;
            let finalArray = [];
            if (req.loggedInUser.userPhone == '9987884000' && date) {
                let parsedDate = new Date(date);
                let link = await DSAService.getLntReportLinkByDate(parsedDate);
                if (!link) {
                    ResHelper.apiResponse(res, true, "Success", 200, [], "");
                    return;
                }
                let data = await readJsonFromS3(link.link);
                if (data) finalArray = data[type];
                ResHelper.apiResponse(res, true, "Success", 200, { report: finalArray, date: link.date }, "");
                return;
            }
            let dsaTree = await getDsaTreeArray(req.loggedInUser.userPhone);
            let dsaSortedArray = getAllDSA(dsaTree);

            console.log("###1", req.loggedInUser.userPhone, new Date())
            if (!(dsaSortedArray && dsaSortedArray.uniquePhone.length)) {
                ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
                return;
            }
            console.log("###2", req.loggedInUser.userPhone, new Date());
            let applicationData = await DSAService.getLntDashboardByPhoneNumbers(dsaSortedArray.uniquePhone, false, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter);

            console.log("###3", req.loggedInUser.userPhone, new Date())

            const mergedArray = await processArrayInChunks(dsaSortedArray.users, applicationData, 1000)
            console.log("###4", req.loggedInUser.userPhone, new Date())

            finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == 6), mergedArray.filter(e => e.level == 7));
            console.log("###5", req.loggedInUser.userPhone, new Date())

            await asyncForEach([5, 4, 3, 2, 1], async (index, i, array) => {
                finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == index), finalArray, index);
            });
            console.log("###6", req.loggedInUser.userPhone, new Date())
            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getLntForDashboardV2 = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getLntForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, date, type, level } = req.body;
            // req.loggedInUser.userPhone = "9987884000";

            let finalArray = [];
            let allDsa = await DSAService.getAllDsaForMis(req?.loggedInUser?.userPhone, level);
            let applicationData = await DSAService.getLntDashboardByPhoneNumbersV2(req?.loggedInUser?.userPhone, false, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter);
            finalArray = generateNestedObjects(mergeArrays(allDsa, applicationData));
            finalArray = getChildLevels(finalArray, req?.loggedInUser?.userPhone)
            // finalArray = getChildLevels(finalArray, "7506439909");

            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getIncredForDashboard = async (req, res, next) => {
    try {

        const { error } = DSAValidationV1.getLntForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, date, type } = req.body;
            let finalArray = [];
            if (req.loggedInUser.userPhone == '9987884000' && date) {
                let parsedDate = new Date(date)//.toISOString().split('T')[0];
                let link = await DSAService.getIncredReportLinkByDate(parsedDate);
                if (!link) {
                    ResHelper.apiResponse(res, true, "Success", 200, [], "");
                    return;
                }
                let data = await readJsonFromS3(link.link);
                if (data) finalArray = data[type];
                ResHelper.apiResponse(res, true, "Success", 200, { report: finalArray, date: link.date }, "");
                return;
            }
            let dsaTree = await getDsaTreeArray(req.loggedInUser.userPhone);
            let dsaSortedArray = getAllDSA(dsaTree);

            console.log("###1", req.loggedInUser.userPhone, new Date())
            if (!(dsaSortedArray && dsaSortedArray.uniquePhone.length)) {
                ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
                return;
            }
            console.log("###2", req.loggedInUser.userPhone, new Date())
            let applicationData = await DSAService.getIncredDashboardByPhoneNumbers(dsaSortedArray.uniquePhone, false, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter);

            console.log("###3", req.loggedInUser.userPhone, new Date())

            const mergedArray = await processArrayInChunks(dsaSortedArray.users, applicationData, 1000)
            console.log("###4", req.loggedInUser.userPhone, new Date())
            // const mergedArray = await Promise.all(dsaSortedArray.users.map(async (item) => {
            //     const match = await applicationData.find(async (obj) => {
            //         return obj.dsa_mobile_number === item.phone;
            //     });
            //     return { ...item, ...match };
            // }));

            finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == 6), mergedArray.filter(e => e.level == 7));
            console.log("###5", req.loggedInUser.userPhone, new Date())

            await asyncForEach([5, 4, 3, 2, 1], async (index, i, array) => {
                finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == index), finalArray, index);
            });
            console.log("###6", req.loggedInUser.userPhone, new Date())
            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getIncredForDashboardV2 = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getLntForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, date, type, level } = req.body;
            // req.loggedInUser.userPhone = "9987884000";

            let finalArray = [];
            let allDsa = await DSAService.getAllDsaForMis(req?.loggedInUser?.userPhone, level);
            let applicationData = await DSAService.getIncredDashboardByPhoneNumbersV2(req?.loggedInUser?.userPhone, false, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter);
            finalArray = generateNestedObjects(mergeArrays(allDsa, applicationData));
            finalArray = getChildLevels(finalArray, req?.loggedInUser?.userPhone)
            // finalArray = getChildLevels(finalArray, "7506439909");
            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getFaircentForDashboard = async (req, res, next) => {
    try {

        const { error } = DSAValidationV1.getLntForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, date, type } = req.body;
            let finalArray = [];
            if (req.loggedInUser.userPhone == '9987884000' && date) {
                let parsedDate = new Date(date)//.toISOString().split('T')[0];
                let link = await DSAService.getFaircentReportLinkByDate(parsedDate);
                if (!link) {
                    ResHelper.apiResponse(res, true, "Success", 200, [], "");
                    return;
                }
                let data = await readJsonFromS3(link.link);
                if (data) finalArray = data[type];
                ResHelper.apiResponse(res, true, "Success", 200, { report: finalArray, date: link.date }, "");
                return;
            }
            let dsaTree = await getDsaTreeArray(req.loggedInUser.userPhone);
            let dsaSortedArray = getAllDSA(dsaTree);

            console.log("###1", req.loggedInUser.userPhone, new Date())
            if (!(dsaSortedArray && dsaSortedArray.uniquePhone.length)) {
                ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
                return;
            }
            console.log("###2", req.loggedInUser.userPhone, new Date())
            let applicationData = await DSAService.getFairCentDashboardByPhoneNumbers(dsaSortedArray.uniquePhone, false, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter);

            console.log("###3", req.loggedInUser.userPhone, new Date())

            const mergedArray = await processArrayInChunks(dsaSortedArray.users, applicationData, 1000)
            console.log("###4", req.loggedInUser.userPhone, new Date())
            // const mergedArray = await Promise.all(dsaSortedArray.users.map(async (item) => {
            //     const match = await applicationData.find(async (obj) => {
            //         return obj.dsa_mobile_number === item.phone;
            //     });
            //     return { ...item, ...match };
            // }));

            finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == 6), mergedArray.filter(e => e.level == 7));
            console.log("###5", req.loggedInUser.userPhone, new Date())

            await asyncForEach([5, 4, 3, 2, 1], async (index, i, array) => {
                finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == index), finalArray, index);
            });
            console.log("###6", req.loggedInUser.userPhone, new Date())
            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getFaircentForDashboardV2 = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getLntForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, date, type, level } = req.body;
            // req.loggedInUser.userPhone = "9987884000";

            let finalArray = [];
            let allDsa = await DSAService.getAllDsaForMis(req?.loggedInUser?.userPhone, level);
            let applicationData = await DSAService.getFairCentDashboardByPhoneNumbersV2(req?.loggedInUser?.userPhone, false, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter);
            finalArray = generateNestedObjects(mergeArrays(allDsa, applicationData));
            finalArray = getChildLevels(finalArray, req?.loggedInUser?.userPhone)
            // finalArray = getChildLevels(finalArray, "7506439909");
            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getBajajPLForDashboard = async (req, res, next) => {
    try {

        const { error } = DSAValidationV1.getLntForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, date, type } = req.body;
            let finalArray = [];
            if (req.loggedInUser.userPhone == '9987884000' && date) {
                let parsedDate = new Date(date)//.toISOString().split('T')[0];
                let link = await DSAService.getReportLinkByDate('bajajPL', parsedDate);
                if (!link) {
                    ResHelper.apiResponse(res, true, "Success", 200, [], "");
                    return;
                }
                let data = await readJsonFromS3(link.link);
                if (data) finalArray = data[type];
                ResHelper.apiResponse(res, true, "Success", 200, { report: finalArray, date: link.date }, "");
                return;
            }
            let dsaTree = await getDsaTreeArray(req.loggedInUser.userPhone);
            let dsaSortedArray = getAllDSA(dsaTree);

            console.log("###1", req.loggedInUser.userPhone, new Date())
            if (!(dsaSortedArray && dsaSortedArray.uniquePhone.length)) {
                ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
                return;
            }
            console.log("###2", req.loggedInUser.userPhone, new Date())
            let applicationData = await DSAService.getBajajPLDashboardByPhoneNumbers(dsaSortedArray.uniquePhone, false, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter);

            console.log("###3", req.loggedInUser.userPhone, new Date())

            const mergedArray = await processArrayInChunks(dsaSortedArray.users, applicationData, 1000)
            console.log("###4", req.loggedInUser.userPhone, new Date())
            // const mergedArray = await Promise.all(dsaSortedArray.users.map(async (item) => {
            //     const match = await applicationData.find(async (obj) => {
            //         return obj.dsa_mobile_number === item.phone;
            //     });
            //     return { ...item, ...match };
            // }));

            finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == 6), mergedArray.filter(e => e.level == 7));
            console.log("###5", req.loggedInUser.userPhone, new Date())

            await asyncForEach([5, 4, 3, 2, 1], async (index, i, array) => {
                finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == index), finalArray, index);
            });
            console.log("###6", req.loggedInUser.userPhone, new Date())
            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getBajajPLForDashboardV2 = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getLntForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, date, type, level } = req.body;
            // req.loggedInUser.userPhone = "9987884000";
            let finalArray = [];
            let allDsa = await DSAService.getAllDsaForMis(req?.loggedInUser?.userPhone, level);
            let applicationData = await DSAService.getBajajPLDashboardByPhoneNumbersV2(req?.loggedInUser?.userPhone, false, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter);
            finalArray = generateNestedObjects(mergeArrays(allDsa, applicationData));
            finalArray = getChildLevels(finalArray, req?.loggedInUser?.userPhone)
            // finalArray = getChildLevels(finalArray, "7506439909");
            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getCreditVidyaForDashboard = async (req, res, next) => {
    try {

        const { error } = DSAValidationV1.getLntForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, date, type } = req.body;
            let finalArray = [];
            if (req.loggedInUser.userPhone == '9987884000' && date) {
                let parsedDate = new Date(date)//.toISOString().split('T')[0];
                let link = await DSAService.getReportLinkByDate('creditVidya', parsedDate);
                if (!link) {
                    ResHelper.apiResponse(res, true, "Success", 200, [], "");
                    return;
                }
                let data = await readJsonFromS3(link.link);
                if (data) finalArray = data[type];
                ResHelper.apiResponse(res, true, "Success", 200, { report: finalArray, date: link.date }, "");
                return;
            }
            let dsaTree = await getDsaTreeArray(req.loggedInUser.userPhone);
            let dsaSortedArray = getAllDSA(dsaTree);

            console.log("###1", req.loggedInUser.userPhone, new Date())
            if (!(dsaSortedArray && dsaSortedArray.uniquePhone.length)) {
                ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
                return;
            }
            console.log("###2", req.loggedInUser.userPhone, new Date())
            let applicationData = await DSAService.getCreditVidyaDashboardByPhoneNumbers(dsaSortedArray.uniquePhone, false, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter);

            console.log("###3", req.loggedInUser.userPhone, new Date())

            const mergedArray = await processArrayInChunks(dsaSortedArray.users, applicationData, 1000)
            console.log("###4", req.loggedInUser.userPhone, new Date())
            // const mergedArray = await Promise.all(dsaSortedArray.users.map(async (item) => {
            //     const match = await applicationData.find(async (obj) => {
            //         return obj.dsa_mobile_number === item.phone;
            //     });
            //     return { ...item, ...match };
            // }));

            finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == 6), mergedArray.filter(e => e.level == 7));
            console.log("###5", req.loggedInUser.userPhone, new Date())

            await asyncForEach([5, 4, 3, 2, 1], async (index, i, array) => {
                finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == index), finalArray, index);
            });
            console.log("###6", req.loggedInUser.userPhone, new Date())
            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getCreditVidyaForDashboardV2 = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getLntForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, date, type, level } = req.body;
            // req.loggedInUser.userPhone = "9987884000";
            let finalArray = [];
            let allDsa = await DSAService.getAllDsaForMis(req?.loggedInUser?.userPhone, level);
            let applicationData = await DSAService.getCreditVidyaDashboardByPhoneNumbersV2(req?.loggedInUser?.userPhone, false, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter);
            finalArray = generateNestedObjects(mergeArrays(allDsa, applicationData));
            finalArray = getChildLevels(finalArray, req?.loggedInUser?.userPhone)
            // finalArray = getChildLevels(finalArray, "7506439909");
            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getCreditSasionForDashboard = async (req, res, next) => {
    try {

        const { error } = DSAValidationV1.getLntForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, date, type } = req.body;
            let finalArray = [];
            if (req.loggedInUser.userPhone == '9987884000' && date) {
                let parsedDate = new Date(date)//.toISOString().split('T')[0];
                let link = await DSAService.getReportLinkByDate('creditSasion', parsedDate);
                if (!link) {
                    ResHelper.apiResponse(res, true, "Success", 200, [], "");
                    return;
                }
                let data = await readJsonFromS3(link.link);
                if (data) finalArray = data[type];
                ResHelper.apiResponse(res, true, "Success", 200, { report: finalArray, date: link.date }, "");
                return;
            }
            let dsaTree = await getDsaTreeArray(req.loggedInUser.userPhone);
            let dsaSortedArray = getAllDSA(dsaTree);

            console.log("###1", req.loggedInUser.userPhone, new Date())
            if (!(dsaSortedArray && dsaSortedArray.uniquePhone.length)) {
                ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
                return;
            }
            console.log("###2", req.loggedInUser.userPhone, new Date())
            let applicationData = await DSAService.getCreditSasionDashboardByPhoneNumbers(dsaSortedArray.uniquePhone, false, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter);

            console.log("###3", req.loggedInUser.userPhone, new Date())

            const mergedArray = await processArrayInChunks(dsaSortedArray.users, applicationData, 1000)
            console.log("###4", req.loggedInUser.userPhone, new Date())
            // const mergedArray = await Promise.all(dsaSortedArray.users.map(async (item) => {
            //     const match = await applicationData.find(async (obj) => {
            //         return obj.dsa_mobile_number === item.phone;
            //     });
            //     return { ...item, ...match };
            // }));

            finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == 6), mergedArray.filter(e => e.level == 7));
            console.log("###5", req.loggedInUser.userPhone, new Date())

            await asyncForEach([5, 4, 3, 2, 1], async (index, i, array) => {
                finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == index), finalArray, index);
            });
            console.log("###6", req.loggedInUser.userPhone, new Date())
            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getPiramalForDashboard = async (req, res, next) => {
    try {

        const { error } = DSAValidationV1.getLntForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, date, type, application_type } = req.body;
            let finalArray = [];
            if (req.loggedInUser.userPhone == '9987884000' && date) {
                let parsedDate = new Date(date)//.toISOString().split('T')[0];
                let link = await DSAService.getReportLinkByDate(application_type || 'piramal', parsedDate);
                if (!link) {
                    ResHelper.apiResponse(res, true, "Success", 200, [], "");
                    return;
                }
                let data = await readJsonFromS3(link.link);
                if (data) finalArray = data[type];
                ResHelper.apiResponse(res, true, "Success", 200, { report: finalArray, date: link.date }, "");
                return;
            }
            let dsaTree = await getDsaTreeArray(req.loggedInUser.userPhone);
            let dsaSortedArray = getAllDSA(dsaTree);

            console.log("###1", req.loggedInUser.userPhone, new Date())
            if (!(dsaSortedArray && dsaSortedArray.uniquePhone.length)) {
                ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
                return;
            }
            console.log("###2", req.loggedInUser.userPhone, new Date())
            let applicationData = await DSAService.getPiramalDashboardByPhoneNumbers(dsaSortedArray.uniquePhone, false, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, false, application_type);

            console.log("###3", req.loggedInUser.userPhone, new Date())

            const mergedArray = await processArrayInChunks(dsaSortedArray.users, applicationData, 1000)
            console.log("###4", req.loggedInUser.userPhone, new Date())
            // const mergedArray = await Promise.all(dsaSortedArray.users.map(async (item) => {
            //     const match = await applicationData.find(async (obj) => {
            //         return obj.dsa_mobile_number === item.phone;
            //     });
            //     return { ...item, ...match };
            // }));

            finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == 6), mergedArray.filter(e => e.level == 7));
            console.log("###5", req.loggedInUser.userPhone, new Date())

            await asyncForEach([5, 4, 3, 2, 1], async (index, i, array) => {
                finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == index), finalArray, index);
            });
            console.log("###6", req.loggedInUser.userPhone, new Date())
            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getPiramalForDashboardV2 = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getLntForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, date, type, level, application_type } = req.body;
            // req.loggedInUser.userPhone = "9987884000";
            let finalArray = [];
            let allDsa = await DSAService.getAllDsaForMis(req?.loggedInUser?.userPhone, level);
            let applicationData = await DSAService.getPiramalDashboardByPhoneNumbersV2(req?.loggedInUser?.userPhone, false, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, false, application_type);
            finalArray = generateNestedObjects(mergeArrays(allDsa, applicationData));
            finalArray = getChildLevels(finalArray, req?.loggedInUser?.userPhone)
            // finalArray = getChildLevels(finalArray, "7506439909");
            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getIndifiForDashboard = async (req, res, next) => {
    try {

        const { error } = DSAValidationV1.getIndifiForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let finalArray = [];
            let isCeo = req.loggedInUser.role == "CEO";
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, date, type } = req.body;
            if (req.loggedInUser.userPhone == '9987884000' && date) {
                let parsedDate = new Date(date)//.toISOString().split('T')[0];
                let link = await DSAService.getReportLinkByDate("indifi", parsedDate);
                if (!link) {
                    ResHelper.apiResponse(res, true, "Success", 200, [], "");
                    return;
                }
                let data = await readJsonFromS3(link.link);
                if (data) finalArray = data[type];
                ResHelper.apiResponse(res, true, "Success", 200, { data: finalArray, date: link.date }, "");
                return;
            }
            let dsaTree = await getDsaTreeArray(req.loggedInUser.userPhone);
            let dsaSortedArray = getAllDSA(dsaTree);
            if (!(dsaSortedArray && dsaSortedArray.uniquePhone.length)) {
                ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
                return;
            }
            let applicationData = await DSAService.getIndifiDashboardByPhoneNumbers(dsaSortedArray.uniquePhone, false, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter);
            const mergedArray = dsaSortedArray.users.map((item) => {
                const match = applicationData.find((obj) => {
                    return obj.dsa_mobile_number === item.phone;
                });
                return { ...item, ...match };
            });


            finalArray = mergeIndifiChilds(mergedArray.filter(e => e.level == 6), mergedArray.filter(e => e.level == 7));
            finalArray = mergeIndifiChilds(mergedArray.filter(e => e.level == 5), finalArray);
            finalArray = mergeIndifiChilds(mergedArray.filter(e => e.level == 4), finalArray);
            finalArray = mergeIndifiChilds(mergedArray.filter(e => e.level == 3), finalArray);
            finalArray = mergeIndifiChilds(mergedArray.filter(e => e.level == 2), finalArray);
            finalArray = mergeIndifiChilds(mergedArray.filter(e => e.level == 1), finalArray);
            finalArray = finalArray?.sort((a, b) => (a.total_disbursed_amount > b.total_disbursed_amount ? -1 : 1))


            ResHelper.apiResponse(res, true, "Success", 200, { data: finalArray }, "");
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getIndifiForDashboardV2 = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getLntForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, date, type, level } = req.body;
            // req.loggedInUser.userPhone = "9987884000";
            let finalArray = [];
            let allDsa = await DSAService.getAllDsaForMis(req?.loggedInUser?.userPhone, level);
            let applicationData = await DSAService.getIndifiDashboardByPhoneNumbersV2(req?.loggedInUser?.userPhone, false, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter);
            finalArray = generateNestedObjects(mergeArrays(allDsa, applicationData));
            finalArray = getChildLevels(finalArray, req?.loggedInUser?.userPhone)
            // finalArray = getChildLevels(finalArray, "7506439909");
            ResHelper.apiResponse(res, true, "Success", 200, { data: finalArray }, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getCreditCardForDashboard = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getCreditCardForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let finalArray = [];
            let { startDateFilter, endDateFilter, date } = req.body;
            if (req.loggedInUser.userPhone == '9987884000' && date) {
                let parsedDate = new Date(date);
                let link = await DSAService.getReportLinkByDate("bajaj_credit_card", parsedDate);
                if (!link) {
                    ResHelper.apiResponse(res, true, "Success", 200, [], "");
                    return;
                }
                let data = await readJsonFromS3(link.link);
                ResHelper.apiResponse(res, true, "Success", 200, { data: data?.data, date: link.date }, "");
                return;
            }
            let dsaTree = await getDsaTreeArray(req.loggedInUser.userPhone);
            let dsaSortedArray = getAllDSA(dsaTree);
            if (!(dsaSortedArray.uniquePhone && dsaSortedArray.uniquePhone.length)) {
                ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
                return;
            }
            let applicationData = await DSAService.getBajajCCDashboardByPhoneNumbers(dsaSortedArray.uniquePhone, false, startDateFilter, endDateFilter);
            const mergedArray = dsaSortedArray.users.map((item) => {
                const match = applicationData.find((obj) => {
                    return obj.dsa_mobile_number === item.phone;
                });
                return { ...item, ...match };
            });


            finalArray = mergeBajaCreditCardChilds(mergedArray.filter(e => e.level == 6), mergedArray.filter(e => e.level == 7));
            finalArray = mergeBajaCreditCardChilds(mergedArray.filter(e => e.level == 5), finalArray);
            finalArray = mergeBajaCreditCardChilds(mergedArray.filter(e => e.level == 4), finalArray);
            finalArray = mergeBajaCreditCardChilds(mergedArray.filter(e => e.level == 3), finalArray);
            finalArray = mergeBajaCreditCardChilds(mergedArray.filter(e => e.level == 2), finalArray);
            finalArray = mergeBajaCreditCardChilds(mergedArray.filter(e => e.level == 1), finalArray);
            finalArray = finalArray?.sort((a, b) => (a.total_approved > b.total_approved ? -1 : 1))

            ResHelper.apiResponse(res, true, "Success", 200, { data: finalArray }, "");
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getLoanForDashboard = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getLoanForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let childPhones = null;
            let getDsa = await DSAService.getDsaByPhone(req.loggedInUser.role === "CEO" ? '9987884000' : req.loggedInUser.userPhone);
            if (!getDsa) {
                ResHelper.apiResponse(res, true, "Success", 200, { dsa: getDsa, child: [], lntCount: 0 }, "");
                return;
            } else {
                let childs = [];
                let getCurrentChilds = await DSAService.getCurrentChildsWhereIn(getDsa.customer_mobile_number);
                childPhones = [];
                let temp = [];
                for (let i = 0; i < getCurrentChilds.length; i++) {
                    temp.push(getCurrentChilds[i].customer_mobile_number)
                }
                childPhones = childPhones.concat(temp);
                for (let i = 0; i < childPhones.length; i++) {
                    let childData = await getLoanCountByPhone(childPhones[i]);
                    childs.push(childData)
                }
                childs.sort(function (a, b) {
                    if (a.totalCount > b.totalCount) return -1;
                    if (a.totalCount < b.totalCount) return 1;
                    return 0;
                });
                if (childPhones.length != 0) getCurrentChilds = await DSAService.getCurrentChildsWhereIn(childPhones);
                temp = [];
                for (let i = 0; i < getCurrentChilds.length; i++) {
                    temp.push(getCurrentChilds[i].customer_mobile_number)
                }
                childPhones = childPhones.concat(temp);
                if (childPhones.length != 0) getCurrentChilds = await DSAService.getCurrentChildsWhereIn(childPhones);
                temp = [];
                for (let i = 0; i < getCurrentChilds.length; i++) {
                    temp.push(getCurrentChilds[i].customer_mobile_number)
                }
                childPhones = childPhones.concat(temp);
                if (childPhones.length != 0) getCurrentChilds = await DSAService.getCurrentChildsWhereIn(childPhones);
                temp = [];
                for (let i = 0; i < getCurrentChilds.length; i++) {
                    temp.push(getCurrentChilds[i].customer_mobile_number)
                }
                childPhones = childPhones.concat(temp);
                if (childPhones.length != 0) getCurrentChilds = await DSAService.getCurrentChildsWhereIn(childPhones);
                temp = [];
                for (let i = 0; i < getCurrentChilds.length; i++) {
                    temp.push(getCurrentChilds[i].customer_mobile_number)
                }
                childPhones = childPhones.concat(temp);
                if (childPhones.length != 0) getCurrentChilds = await DSAService.getCurrentChildsWhereIn(childPhones);
                temp = [];
                for (let i = 0; i < getCurrentChilds.length; i++) {
                    temp.push(getCurrentChilds[i].customer_mobile_number)
                }
                childPhones = childPhones.concat(temp);
                let lntCount = await DSAService.getLoanForDashboard(childPhones);
                ResHelper.apiResponse(res, true, "Success", 200, { dsa: getDsa, childs, totalCount: lntCount }, "");
            }
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getLoanForDashboardV2 = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getLntForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            // req.loggedInUser.userPhone = "9987884000";
            let finalArray = [];
            let allDsa = await DSAService.getAllDsaForMis(req?.loggedInUser?.userPhone);
            let applicationData = await DSAService.getLoanForDashboardV2(req?.loggedInUser?.userPhone);
            finalArray = generateNestedObjects(mergeArrays(allDsa, applicationData));
            finalArray = getChildLevels(finalArray, req?.loggedInUser?.userPhone)
            // finalArray = getChildLevels(finalArray, "7506439909");
            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};


const getLoanCountByPhone = async (phone) => {
    let getDsa = await DSAService.getDsaByPhone(phone);
    if (!getDsa) return null;
    let childs = [];
    let getCurrentChilds = await DSAService.getCurrentChildsWhereIn(getDsa.customer_mobile_number);
    // let ans = {dsa:[]};
    // ans.dsa = ans.dsa.concat(getCurrentChilds);
    // await getLevelNodesPhone(getCurrentChilds,3,ans);
    if (getCurrentChilds.length == 0) return { dsa: getDsa, childs, totalCount: 0 };
    let childPhones = [];
    let temp = [];
    for (let i = 0; i < getCurrentChilds.length; i++) {
        temp.push(getCurrentChilds[i].customer_mobile_number)
    }
    childPhones = childPhones.concat(temp);
    if (childPhones.length != 0) getCurrentChilds = await DSAService.getCurrentChildsWhereIn(childPhones);
    temp = [];
    for (let i = 0; i < getCurrentChilds.length; i++) {
        temp.push(getCurrentChilds[i].customer_mobile_number)
    }
    childPhones = childPhones.concat(temp);
    if (childPhones.length == 0) return { dsa: getDsa, childs, totalCount: 0 };
    if (childPhones.length != 0) getCurrentChilds = await DSAService.getCurrentChildsWhereIn(childPhones);
    temp = [];
    for (let i = 0; i < getCurrentChilds.length; i++) {
        temp.push(getCurrentChilds[i].customer_mobile_number)
    }
    childPhones = childPhones.concat(temp);
    if (childPhones.length == 0) return { dsa: getDsa, childs, totalCount: 0 };
    if (childPhones.length != 0) getCurrentChilds = await DSAService.getCurrentChildsWhereIn(childPhones);
    temp = [];
    for (let i = 0; i < getCurrentChilds.length; i++) {
        temp.push(getCurrentChilds[i].customer_mobile_number)
    }
    childPhones = childPhones.concat(temp);
    if (childPhones.length == 0) return { dsa: getDsa, childs, totalCount: 0 };
    let lntCount = await DSAService.getLoanForDashboard(childPhones);
    return { dsa: getDsa, childs, totalCount: lntCount };
}

const getApplicationCountForDashboard = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getLoanForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let childPhones = null;
            let getDsa = await DSAService.getDsaByPhone(req.loggedInUser.role === "CEO" ? '9987884000' : req.loggedInUser.userPhone);
            if (!getDsa) {
                ResHelper.apiResponse(res, true, "Success", 200, { dsa: getDsa, child: [], lntCount: 0 }, "");
                return;
            } else {
                let childs = [];
                let getCurrentChilds = await DSAService.getCurrentChildsWhereIn(getDsa.customer_mobile_number);
                // let ans = {dsa:[]};
                // ans.dsa = ans.dsa.concat(getCurrentChilds);
                // await getLevelNodesPhone(getCurrentChilds,3,ans);
                childPhones = [];
                let temp = [];
                for (let i = 0; i < getCurrentChilds.length; i++) {
                    temp.push(getCurrentChilds[i].customer_mobile_number)
                }
                childPhones = childPhones.concat(temp);
                for (let i = 0; i < childPhones.length; i++) {
                    let childData = await getLoanCountByPhone(childPhones[i]);
                    childs.push(childData)
                }
                if (childPhones.length != 0) getCurrentChilds = await DSAService.getCurrentChildsWhereIn(childPhones);
                temp = [];
                for (let i = 0; i < getCurrentChilds.length; i++) {
                    temp.push(getCurrentChilds[i].customer_mobile_number)
                }
                if (childPhones.length != 0) getCurrentChilds = await DSAService.getCurrentChildsWhereIn(childPhones);
                temp = [];
                for (let i = 0; i < getCurrentChilds.length; i++) {
                    temp.push(getCurrentChilds[i].customer_mobile_number)
                }
                if (childPhones.length != 0) getCurrentChilds = await DSAService.getCurrentChildsWhereIn(childPhones);
                temp = [];
                for (let i = 0; i < getCurrentChilds.length; i++) {
                    temp.push(getCurrentChilds[i].customer_mobile_number)
                }
                if (childPhones.length != 0) getCurrentChilds = await DSAService.getCurrentChildsWhereIn(childPhones);
                temp = [];
                for (let i = 0; i < getCurrentChilds.length; i++) {
                    temp.push(getCurrentChilds[i].customer_mobile_number)
                }
                childPhones = childPhones.concat(temp);
                let lntCount = await DSAService.getLntForDashboard(childPhones);
                let loanCount = await DSAService.getLoanForDashboard(childPhones);
                let creditCardCount = await DSAService.getCreditCardForDashboard(childPhones);
                ResHelper.apiResponse(res, true, "Success", 200, { lntCount, loanCount, creditCardCount }, "");

            }
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getLntApplicationStage = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getLntApplicationStage.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let stage = await DSAService.getLntApplicationStage();
            ResHelper.apiResponse(res, true, "Success", 200, stage, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}
const getLntApplicationSubStage = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getLntApplicationSubStage.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let subStage = await DSAService.getLntApplicationSubStage();
            ResHelper.apiResponse(res, true, "Success", 200, subStage, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getDsaChild = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getDsaChild.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { partnerPhone } = req.body;
            let childDsa = await DSAService.getDsaChild(partnerPhone);
            ResHelper.apiResponse(res, true, "Success", 200, childDsa, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getDsaIdByPhone = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getDsaIdByPhone.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { phone } = req.body;
            let childDsa = await DSAService.getDsaIdByPhone(phone);
            ResHelper.apiResponse(res, true, "Success", 200, childDsa, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const updateChannelPartnerStatus = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.updateChannelPartnerStatus.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let dsa = await DSAService.getDsaById(req.body.dsa_id);
            if (!dsa) {
                return ResHelper.apiResponse(res, false, "Dsa Not Found", 400, {}, "");
            };
            let { status, dsa_id } = req.body;

            let communications = await DSAService.getOnChangeCommunication(req.body.status, req.body.dsa_id);
            let previous = await DSAService.getDsaDataForEdit(req?.body.dsa_id, true);
            const response = await DSAService.updateChannelPartnerStatus(req.body);

            if ([1081, 44]?.includes(status)) {
                await handleDsaBusinessStarted({
                    mode: "manual",
                    date: new Date().toISOString(),
                    dsa_id: dsa_id
                });
            };

            let newData = await DSAService.getDsaDataForEdit(req?.body.dsa_id, true);
            let difference = jsonDifference(previous, newData);
            const userId = req?.loggedInUser?.id || null;
            await ApplicationLogServices.bulkCreate(difference, req?.body.dsa_id, "dsa", userId);
            for (let i = 0; i < communications.length; i++) {
                let data = await sendSMSNew(communications[i].template_id, communications[i].template, dsa.customer_mobile_number)
                console.log(data)
                await DSAService.addCommunicationApplicationLog(dsa.customer_id, communications[i].template, communications[i].template_id, dsa.partner_code)
            };

            ResHelper.apiResponse(res, true, "Success", 200, response, "");
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const downloadDsaWithStep = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.downloadDsaWithStep.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter } = req.body;
            const dsa = await DSAService.downloadDsaWithStep(startDateFilter, endDateFilter);
            if (!dsa || dsa.length == 0) {
                ResHelper.apiResponse(res, false, "No Data Found", 400, {}, "");
                return;
            }
            let fields = Object.keys(dsa[0]);
            const opts = { fields };
            const parser = new Parser(opts);
            const csv = parser.parse(dsa);
            await fs.promises.writeFile(appRoot + '/tempDsaStep.csv', csv);
            let base64 = await fs.promises.readFile(appRoot + '/tempDsaStep.csv', 'base64')
            let uniqueString = randomstring.generate();
            let uniqueString1 = randomstring.generate();
            let url = await uploadToS3("dsaWithSteps", base64, uniqueString1 + uniqueString, 'application/octet-stream', 'csv');
            ResHelper.apiResponse(res, true, "Success", 200, url, "");
        }
    } catch (err) {

        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const uploadDsaWithStep = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.uploadDsaWithStep.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { base64 } = req.body;
            getDsaUpdatedStepsQueue.add({ base64: base64, sentTo: "tushar.garg@novostack.com" });
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {

        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getGraphData = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getGraphData.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { type, startDateFilter, endDateFilter } = req.body;
            let response = {};
            let masterRoles = ["CEO"];
            let childphones = !masterRoles?.includes(req?.loggedInUser?.role) ? req?.loggedInUser?.userPhone : null;
            if (type == "all") {
                response["partner_onboarding"] = await GraphServices.getOnboardingGraph(startDateFilter, endDateFilter, childphones);
                response["dsa_status"] = await GraphServices.getDsaStatusGraph("dsa_status", startDateFilter, endDateFilter, childphones);
                response["user_type"] = await GraphServices.getUserTypeGraph(startDateFilter, endDateFilter, childphones);
                response["dsa_source"] = await GraphServices.getDsaSourceGraph(startDateFilter, endDateFilter, childphones);
                response["payout_agreement"] = await GraphServices.getPayoutAgreementGraph(startDateFilter, endDateFilter, childphones);
                response["verification_status"] = await GraphServices.verificationStatusGraph(startDateFilter, endDateFilter, childphones);
                response["agreement_signed"] = await GraphServices.agreementSignedGraph(startDateFilter, endDateFilter, childphones);
            };

            if (type == "partner_onboarding") {
                response = await GraphServices.getOnboardingGraph(startDateFilter, endDateFilter, childphones);
            } else if (type == "user_type") {
                response = await GraphServices.getUserTypeGraph(startDateFilter, endDateFilter, childphones);
            } else if (type == "dsa_status") {
                response = await GraphServices.getDsaStatusGraph(type, startDateFilter, endDateFilter, childphones);
            } else if (type == "dsa_source") {
                response = await GraphServices.getDsaSourceGraph(startDateFilter, endDateFilter, childphones);
            } else if (type == "payout_agreement") {
                response = await GraphServices.getPayoutAgreementGraph(startDateFilter, endDateFilter, childphones);
            } else if (type == "verification_status") {
                response = await GraphServices.verificationStatusGraph(startDateFilter, endDateFilter, childphones);
            } else if (type == "agreement_signed") {
                response = await GraphServices.agreementSignedGraph(startDateFilter, endDateFilter, childphones);
            }
            ResHelper.apiResponse(res, true, "Success", 200, response, "");
        }
    } catch (err) {
        console.log(err, "===")
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const sendWelcomeSms = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.sendTextSms.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { number } = req.body;
            message = `Thank you for Downloading Our RUCONNECT Application.You can now enjoy an enhanced experience on our digital platform Regards,RUCONNECT by RULOANS`;
            await sendSMSNew('1207168197914312141', message, number);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {

        logger.error(err); send
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const sendAgreementSignedSms = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.sendTextSms.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { number } = req.body;
            message = `Dear Sir/Madam,
Greetings from Ruloans. 
We are glad to have you on board as our partner and look forward to a mutually beneficial association. If you have any queries or clarifications, you may contact us at 1800 266 7576 between 10 am to 6.30 pm Monday to Saturday.
We look forward to beginning our association.
Regards,
Team Ruloans`;
            await sendSMSNew('1207162952797278667', message, number);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {

        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getCreditCardApplicationStatus = async (req, res, next) => {
    try {
        let status = await DSAService.getCreditCardApplicationStatus();
        ResHelper.apiResponse(res, true, "Success", 200, status, "");
    } catch (err) {

        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getIndifiApplicationStatus = async (req, res, next) => {
    try {
        let status = await DSAService.getIndifiApplicationStatus();
        ResHelper.apiResponse(res, true, "Success", 200, status, "");
    } catch (err) {

        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getDsaTreeDownload = async (req, res, next) => {
    try {
        let dsaTree = await DSAService.getDsaTreeDownload();
        let arr = [];
        for (i = 0; i < dsaTree?.length; i++) {
            let obj = {};
            let keys = Object.keys(dsaTree[i]);
            for (j = 0; j < keys?.length; j++) {
                if (dsaTree[i][keys[j]]) {
                    let mobile = dsaTree[i][keys[j]].split("|");
                    obj[keys[j]] = mobile[0];
                    obj[keys[j] + `_mobile`] = mobile[1];
                }
            }
            arr.push(obj);
        }
        ResHelper.apiResponse(res, true, "Success", 200, arr, "");
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const editSubAssignee = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.editSubAssignee.validate(req.body);
        const { id, table_name } = req.body;
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { newData, previousData } = await DSAService.editSubAssignee({ ...req?.body, assigned_by: req.loggedInUser.id });
            let difference = jsonDifference(previousData, newData);
            if (difference?.length) {
                await ApplicationLogServices.bulkCreate(difference, id, table_name, req?.loggedInUser?.id);
            }
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {

        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const editUserType = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.editUserType.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { previousData, newData } = await DSAService.editUserType(req?.body);
            let mapping = {
                "user_type": ["user_type"],
                "business_mode": ["business_mode"]
            };
            let log_data = { log_type: "dsa_basic_details", application_id: req?.body?.dsa_id, created_by: req?.loggedInUser?.id };
            createActivityLogKafka({ ...log_data, old_data: mapObjectKeys(previousData, mapping), new_data: mapObjectKeys(newData, mapping) });
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {

        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getDsasByCompanyId = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getDsasByCompanyId.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { company_id, pageNumber = 0, pageSize = 10, search = '' } = req.body;
            const { results, totalCount } = await CompanyServices.getDsasByCompanyId(company_id, pageNumber, pageSize, search);
            const responseData = {
                records: results,
                totalCount
            };
            ResHelper.apiResponse(res, true, "Success", 200, responseData, "");
        }
    } catch (err) {
        console.log('err', err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const insertLastMonthsLntReport = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.insertLastMonthsLntReport.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { date } = req.body;
            const d1 = moment(date);
            const d2 = moment(new Date());
            if (!d2.isAfter(d1)) {
                ResHelper.apiResponse(res, false, "Invalid Date", 400, {}, "");
                return;
            } else {
                dashboardReportQueue.add({ date });
            }
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const insertLastMonthsIncredReport = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.insertLastMonthsLntReport.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { date } = req.body;
            const d1 = moment(date);
            const d2 = moment(new Date());
            if (!d2.isAfter(d1)) {
                ResHelper.apiResponse(res, false, "Invalid Date", 400, {}, "");
                return;
            } else {
                dashboardReportIncredQueue.add({ date });
            }
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const insertLastMonthsFaircentReport = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.insertLastMonthsLntReport.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { date } = req.body;
            const d1 = moment(date);
            const d2 = moment(new Date());
            if (!d2.isAfter(d1)) {
                ResHelper.apiResponse(res, false, "Invalid Date", 400, {}, "");
                return;
            } else {
                dashboardReportFairCentQueue.add({ date });
            }
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const sendSearchEngineOtp = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.sendSearchEngineOtp.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { mobile } = req.body;
            let email = req?.loggedInUser?.userEmail;
            let businessHeadMobile = null;
            let businessHeadEmail = null;
            const getBusinessHead = !Boolean(["CEO", "BUSINESS_HEAD", "REGIONAL_HEAD", "HUB_HEAD"]?.includes(req.loggedInUser.role));
            if (getBusinessHead) {
                const data = await DSAService.getBusinessHeadRecursively(mobile);
                if (data?.dsa_mobile_number) {
                    businessHeadMobile = data?.dsa_mobile_number;
                    businessHeadEmail = data?.email_address;
                } else {
                    return ResHelper.apiResponse(res, true, "Business Head Not Found", 400, {}, "");
                }
            };
            let otp = generateRandomString(6);
            await DSAService.saveOtp(otp, mobile, 'searchEngine');
            message = `One time OTP for your registration is ${otp} By giving this OTP you are agreeing to the Ruloans.com T%26C  -Ruloans Distribution Services`;
            await sendSMSNew('1207165909516228888', message, businessHeadMobile ? businessHeadMobile : mobile);
            sendEmail({
                to: businessHeadEmail ? businessHeadEmail : email,
                subject: 'Verify OTP',
                body: ` Your OTP to check the Bank File is ${otp}. `
            });
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const verifySearchEngineOtp = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.verifySearchEngineOtp.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { mobile, otp } = req.body;
            let otpResult = await DSAService.getOtp(mobile, 'searchEngine');
            if (!otpResult) {
                return ResHelper.apiResponse(res, false, "Invalid Otp", 400, {}, "");
            } else {
                let dt1 = new Date();
                let dt2 = new Date(otpResult.created_at)
                let expired = isDateDifferenceGreaterThanEqualToNSeconds(dt2, dt1, 60);
                if (expired) {
                    return ResHelper.apiResponse(res, false, "Otp Expired", 400, {}, "");
                }
                else if (otpResult.otp === otp) {
                    await DSAService.verifyOtpById(otpResult.id)
                    return ResHelper.apiResponse(res, true, "Success", 200, {}, "");
                } else {
                    return ResHelper.apiResponse(res, false, "Invalid Otp", 400, {}, "");
                }
            }

        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}
const insertLastMonthDashboardReport = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.insertLastMonthDashboardReport.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { date, type } = req.body;
            const d1 = moment(date);
            const d2 = moment(new Date());
            if (!d2.isAfter(d1)) {
                ResHelper.apiResponse(res, false, "Invalid Date", 400, {}, "");
                return;
            } else {
                if (type == "indifi") {
                    indifiReportQueue.add({ date });
                } else if (type == "bajaj_credit_card") {
                    creditCardReportQueue.add({ date });
                } else if (type == "fibe") {
                    dashboardReportFibeQueue.add({ date });
                } else if (type == "paysense") {
                    dashboardReportPaysenseQueue.add({ date });
                } else if (type == "bajajPL") {
                    dashboardReportBajajPLQueue.add({ date });
                } else if (type == 'creditVidya') {
                    dashboardReportCreditVidyaQueue.add({ date });
                } else if (type == 'creditSasion') {
                    dashboardReportCreditSasionQueue.add({ date })
                } else if (type == 'piramal_lap') {
                    dashboardReportPiramalLAPQueue.add({ date })
                }
                else {
                    return;
                }
            }
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getCibilInitiated = async (req, res, next) => {
    try {
        let childPhones = null;
        let where = "";
        let role = req.loggedInUser.role;
        let hasAllAccess = Boolean(role == "HR" || role == "VERIFICATION_AGENCY" || role == "CEO");
        if (!hasAllAccess) {
            childPhones = role === "CEO" ? '9987884000' : req.loggedInUser.userPhone;
        };

        if (childPhones) {
            where += ` and binary r.phone_number in (
                WITH RECURSIVE DSAHierarchy AS (
                    SELECT dsa_mobile_number, partner_code
                    FROM ru_direct_selling_agents
                    WHERE dsa_mobile_number = ${childPhones}
                    UNION ALL
                    SELECT t.dsa_mobile_number, t.partner_code
                    FROM ru_direct_selling_agents t
                    INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                ) 
                SELECT dsa_mobile_number
                FROM DSAHierarchy
              ) `;
        };

        let response = await DSAService.getCibilInitiated(where);
        ResHelper.apiResponse(res, true, "Success", 200, response, "");
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getCibilList = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getCibilList.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let all_privilege = ["HR", "VERIFICATION_AGENCY", "CEO"]
            let role = req?.loggedInUser?.role;
            //let allow_masking = Boolean(role != "CEO" && is_export);
            let childPhones = null;

            if (!all_privilege?.includes(role)) {
                let getDsa = await DSAService.getDsaByPhone(req.loggedInUser.role === "CEO" ? '9987884000' : req.loggedInUser.userPhone);
                if (getDsa) {
                    childPhones = await getDsa?.customer_mobile_number;
                }
                else {
                    ResHelper.apiResponse(res, true, "Success", 200, [], "");
                    return;
                }
            };

            const { business_head_name_filter, startDateFilter, endDateFilter, platform, count_only, pageSize, pageNumber, customer_name, email, permanent_account_number, mobile_number, credit_score, partner_name, dsa_mobile_number, filterModel, logicOperator } = req?.body;
            let where = ""

            if (childPhones) {
                where += ` and c.dsa_mobile_number in (
                        WITH RECURSIVE DSAHierarchy AS (
                            SELECT dsa_mobile_number, partner_code
                            FROM ru_direct_selling_agents
                            WHERE dsa_mobile_number = ${childPhones}
                            UNION ALL
                            SELECT t.dsa_mobile_number, t.partner_code
                            FROM ru_direct_selling_agents t
                            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                        ) 
                        SELECT dsa_mobile_number
                        FROM DSAHierarchy
                      ) `;
            };
            if (customer_name) {
                where += `  and c.full_name like '%${customer_name}%' `;
            }
            if (email) {
                where += ` and cs.email like '%${email}%' `;
            }
            if (permanent_account_number) {
                where += ` and cs.permanent_account_number like '%${permanent_account_number}%' `;
            }
            if (mobile_number) {
                where += ` and cs.mobile_number like '%${mobile_number}%' `;
            }
            if (credit_score) {
                where += ` and cs.credit_score like '%${credit_score}%' `;
            }
            if (partner_name) {
                where += ` and p.full_name like '%${partner_name}%' `;
            }
            if (dsa_mobile_number) {
                where += ` and c.dsa_mobile_number like '%${dsa_mobile_number}%' `;
            }
            if (platform == "b2c") {
                where += ` and c.dsa_mobile_number = '9999999999' `;
            }
            if (platform == "b2b") {
                where += ` and (c.dsa_mobile_number != '9999999999' or c.dsa_mobile_number is null) `;
            }
            if (startDateFilter) {
                where += ` and DATE(cs.last_checked_date_iso) between DATE('${startDateFilter}') and  DATE('${endDateFilter}') `;
            }
            if (business_head_name_filter) {
                where += ` and bh.full_name like '%${business_head_name_filter}%' `;
            }

            // MUI X DataGrid filterModel — keep legacy filters unchanged.
            if (filterModel && filterModel.items.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getCibilListFieldMapping, operatorHandlers);

                if (whereFilterArray && whereFilterArray.length > 0) {
                    const filters = whereFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    const whereFilterQuery = filters.join(logicOp);
                    if (whereFilterQuery) {
                        where += ` and (${whereFilterQuery}) `;
                    }
                }
            }
            const response = await DSAService.getCibilList(count_only, pageNumber * pageSize, pageSize, where);
            ResHelper.apiResponse(res, true, "Success", 200, response, "");
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getCibilDetail = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getCibilDetail.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { id } = req?.body;
            const response = await DSAService.getCibilDetail(id);
            let options = { directory: "./cibil/", filename: "cibil-report.pdf" };
            download(response[0]?.report_url, options, async function (err) {
                let base64 = await fs.promises.readFile(appRoot + '/cibil/cibil-report.pdf', 'base64');
                let url = await uploadToS3("cibil", base64, response[0]?.dsa_name, 'application/octet-stream', 'pdf');
                ResHelper.apiResponse(res, true, "Success", 200, url, "");
            });
        }
    } catch (err) {

        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getYearlyLntReport = async (req, res, next) => {
    try {
        let result = {};
        let dateUpdated = null;
        if (req.loggedInUser.userPhone == '9987884000' || true) {
            let monthDates = getLastSpendDates();
            console.log(monthDates)
            for (const month in monthDates) {
                let parsedDate = new Date(monthDates[month])//.toISOString().split('T')[0];
                let link = await DSAService.getLntReportLinkByDate(parsedDate);
                if (!link) {
                    result[month] = {};
                } else {
                    console.log("Here", link)
                    let data = await readJsonFromS3(link.link);
                    console.log(data)
                    delete data?.disbursed[0]?.childs;
                    delete data?.login[0]?.childs;
                    if (data) result[month] = data;
                    else result[month] = {};
                    result[month].date = link.date;
                }

            }
        }
        ResHelper.apiResponse(res, true, "Success", 201, result, "");
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getYearlyIncredReport = async (req, res, next) => {
    try {
        let result = {};
        let dateUpdated = null;
        if (req.loggedInUser.userPhone == '9987884000' || true) {
            let monthDates = getLastSpendDates();
            for (const month in monthDates) {
                let parsedDate = new Date(monthDates[month])//.toISOString().split('T')[0];
                let link = await DSAService.getIncredReportLinkByDate(parsedDate);
                if (!link) {
                    result[month] = {};
                } else {
                    let data = await readJsonFromS3(link.link);
                    delete data?.disbursed[0]?.childs;
                    delete data?.login[0]?.childs;
                    if (data) result[month] = data;
                    else result[month] = {};
                    result[month].date = link.date;
                }

            }
        }
        ResHelper.apiResponse(res, true, "Success", 201, result, "");
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getYearlyFaircentReport = async (req, res, next) => {
    try {
        let result = {};
        let dateUpdated = null;
        if (req.loggedInUser.userPhone == '9987884000' || true) {
            let monthDates = getLastSpendDates();
            for (const month in monthDates) {
                let parsedDate = new Date(monthDates[month])//.toISOString().split('T')[0];
                let link = await DSAService.getFaircentReportLinkByDate(parsedDate);
                if (!link) {
                    result[month] = {};
                } else {
                    let data = await readJsonFromS3(link.link);
                    delete data?.disbursed[0]?.childs;
                    delete data?.login[0]?.childs;
                    if (data) result[month] = data;
                    else result[month] = {};
                    result[month].date = link.date;
                }

            }
        }
        ResHelper.apiResponse(res, true, "Success", 201, result, "");
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getYearlyDashboardReport = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getYearlyDashboardReport.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let result = {};
            let monthDates = getLastSpendDates();
            for (const month in monthDates) {
                const { type } = req?.body;
                let parsedDate = new Date(monthDates[month])//.toISOString().split('T')[0];
                let link = await DSAService.getReportLinkByDate(type, parsedDate);
                if (!link) {
                    result[month] = {};
                } else {
                    console.log(link)
                    let data = await readJsonFromS3(link.link);
                    if (type == "indifi") {
                        delete data?.disbursed[0]?.childs;
                        delete data?.login[0]?.childs;
                    } else if (type == "bajaj_credit_card") {
                        delete data[0]?.childs;
                    }
                    else {
                        delete data?.disbursed[0]?.childs;
                        delete data?.login[0]?.childs;
                    }
                    if (data) result[month] = data;
                    else result[month] = {};
                    result[month].date = link.date;
                }

            }
            ResHelper.apiResponse(res, true, "Success", 201, result, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const sendPushNotification = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.sendPushNotification.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            req.body.userId = req.loggedInUser.id;
            let { image } = req.body;
            if (image) {
                req.body.image = await uploadToS3('crm_components_meta', image, `notification_image_${uuid()}`, 'image/jpeg', "jpg");
            };
            sendNotificationQueue.add(req.body);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const sendAppNotification = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.sendAppNotification.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        await KafkaServices.connectKafkaProducer();
        const { filter, channel, body, title, image, url } = req.body;


        const appNotification = new KafkaServices.AppNotificationCRM(
            "app",
            filter,
            channel,
            title,
            body,
            image,
            url,
            req.loggedInUser.id,
        );

        const response = await KafkaServices.sendToKafka(appNotification);
        return ResHelper.apiResponse(res, true, "Success", 200, {}, "");


    } catch (err) {
        logger.error(err);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const sendPushNotificationToKafka = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.sendPushNotificationToKafka.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const { filter, title, topic, body, image, link } = req.body;

        await KafkaServices.connectKafkaProducer();

        const sendPushNotification = new KafkaServices.SendPushNotificationCRM(
            "push",
            filter,
            title,
            topic,
            image,
            link,
            body,
            req.loggedInUser.id
        );

        await KafkaServices.sendToKafka(sendPushNotification);

        return ResHelper.apiResponse(res, true, "Success", 200, {}, "");
    } catch (err) {
        logger.error(err);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const sendSmsToKafka = async (req, res) => {
    try {
        const { error } = DSAValidationV1.sendSmsToKafka.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { filter, message, dynamicValues } = req.body;
            const userCount = await DSAService.getDsaUsersListCount(filter);
            let offset = 0;
            let limit = 100;
            for (let i = 0; i < userCount[0].totalCount; i += limit) {
                offset += limit;
                await KafkaServices.connectKafkaProducer();
                const newSMS = new KafkaServices.SMSSendNotification("sms", filter, message, dynamicValues, req.loggedInUser.id);
                await KafkaServices.sendToKafka(newSMS);
                return ResHelper.apiResponse(res, true, "Success", 200, {}, "");
            }
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getAllPayoutRequest = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllPayoutRequest.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, hierarchyWise } = req.body;
            let where;
            if (!pageNumber) {
                pageNumber = 0;
            };
            if (!pageSize) {
                pageSize = 100;
            };
            if (req.loggedInUser.role == 'CEO') {
                hierarchyWise = false
            };
            if (hierarchyWise) {
                where = ` 
                where binary rdc.dsa_mobile_number in (
                    WITH RECURSIVE DSAHierarchy AS (
                        SELECT dsa_mobile_number, partner_code
                        FROM ru_direct_selling_agents
                        WHERE dsa_mobile_number = ${req?.loggedInUser?.userPhone}
                        UNION ALL
                        SELECT t.dsa_mobile_number, t.partner_code
                        FROM ru_direct_selling_agents t
                        INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                    ) 
                    SELECT dsa_mobile_number
                    FROM DSAHierarchy
                  ) `;
            };
            let result = await DSAService.getAllPayoutRequest(pageNumber * pageSize, pageSize, where);
            ResHelper.apiResponse(res, true, "Success", 200, result, "");
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}
const getPayoutRequest = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getPayoutRequest.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, dsaMobile } = req.body;
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }
            let payout_request = await DSAService.getPayoutRequest(pageNumber * pageSize, pageSize, dsaMobile);
            ResHelper.apiResponse(res, true, "Success", 200, payout_request, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getDsaKycData = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getDsaKycData.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { dsa_id } = req.body;
            let result = await DSAService.getDsaKycData(dsa_id);
            ResHelper.apiResponse(res, true, "Success", 200, result, "");
        }
    } catch (err) {
        console.log(err);
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getDsaKycDataExternal = async (req, res, next) => {
    try {
        let { dsa_id } = req.dsa;
        let result = await DSAService.getDsaKycDataExternal(dsa_id);
        const { ...rest } = result;
        ResHelper.apiResponse(res, true, "Success", 200, rest, "");
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const uploadDsaKycData = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.uploadDsaKycData.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { company_gst_certificate_filename, dsa_id, display_picture_filename, address_proof_front_image_filename, address_proof_back_image_filename, pan_card_front_image_filename } = req.body;
            if (company_gst_certificate_filename) {
                let uniqueString1 = randomstring.generate();
                let uniqueString2 = randomstring.generate();
                company_gst_certificate_filename = await uploadToS3('dsaDocuments', company_gst_certificate_filename, uniqueString1 + uniqueString2, 'application/pdf', "pdf");
                req.body.company_gst_certificate_filename = company_gst_certificate_filename.split('https://ruloans-bucket.s3.ap-south-1.amazonaws.com/')[1];
            }
            if (display_picture_filename) {
                let uniqueString1 = randomstring.generate();
                let uniqueString2 = randomstring.generate();
                display_picture_filename = await uploadToS3('dsaDocuments', display_picture_filename, uniqueString1 + uniqueString2, 'image/jpeg', "jpg");
                req.body.display_picture_filename = display_picture_filename.split('https://ruloans-bucket.s3.ap-south-1.amazonaws.com/')[1];
            }
            if (address_proof_front_image_filename) {
                let uniqueString1 = randomstring.generate();
                let uniqueString2 = randomstring.generate();
                address_proof_front_image_filename = await uploadToS3('dsaDocuments', address_proof_front_image_filename, uniqueString1 + uniqueString2, 'image/jpeg', "jpg");
                req.body.address_proof_front_image_filename = address_proof_front_image_filename.split('https://ruloans-bucket.s3.ap-south-1.amazonaws.com/')[1];
                req.body.address_proof_type = 1;
            }
            if (address_proof_back_image_filename) {
                let uniqueString1 = randomstring.generate();
                let uniqueString2 = randomstring.generate();
                address_proof_back_image_filename = await uploadToS3('dsaDocuments', address_proof_back_image_filename, uniqueString1 + uniqueString2, 'image/jpeg', "jpg");
                req.body.address_proof_back_image_filename = address_proof_back_image_filename.split('https://ruloans-bucket.s3.ap-south-1.amazonaws.com/')[1];
                req.body.address_proof_type = 1;
            }
            if (pan_card_front_image_filename) {
                let uniqueString1 = randomstring.generate();
                let uniqueString2 = randomstring.generate();
                pan_card_front_image_filename = await uploadToS3('dsaDocuments', pan_card_front_image_filename, uniqueString1 + uniqueString2, 'image/jpeg', "jpg");
                req.body.pan_card_front_image_filename = pan_card_front_image_filename.split('https://ruloans-bucket.s3.ap-south-1.amazonaws.com/')[1];
            }
            let isKycExist = await DSAService.getDsaKycById(dsa_id);
            let difference = {};
            req.body.isKycExist = isKycExist;
            await DSAService.updateDsaKycData(req?.body);

            const userId = req?.loggedInUser?.id || null;

            if (isKycExist) {
                let previousData = isKycExist;
                let newData = req?.body;
                difference = jsonDifference(previousData, newData);
                await ApplicationLogServices.bulkCreate(difference, dsa_id, "dsa", userId);
            }

            let kycData = await DSAService.getDsaKycData(dsa_id);

            if (kycData) {
                if (kycData.display_picture_filename && kycData.address_proof_front_image_filename && kycData.pan_card_front_image_filename && kycData.address_proof_back_image_filename) {

                    // if mou found then get vendor id start
                    if (kycData?.mou_filename) {
                        let options = {
                            'method': 'POST',
                            'body': { dsaId: dsa_id },
                            json: true,
                            'url': `${process.env.MS_URL}/api/netsuite/get-vendor-id`,
                            headers: {
                                'api-key': process.env.AUTH_KEY_RULOANS_BANK_CLAIM,
                                'Content-Type': 'application/json'
                            },
                        };
                        let response = await makeRequest(options);
                        let { status } = response?.body;
                        await DSAService.updateDsaSignUpSteps(dsa_id, Boolean(status == "1") ? 5 : 4);
                        if (status != "1") {
                            return ResHelper.apiResponse(res, false, "Try again later!", 400, {}, "");
                        };
                    } {
                        await DSAService.updateDsaSignUpSteps(dsa_id, 4);
                    };
                    // if mou found then get vendor id

                };
            };
            return ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    } catch (err) {
        let message = err?.errors[0]?.message == "ru_customers_kyc_data_permanent_account_number_unique must be unique" ? "PAN Number Already Exist" : "Error occured during execution";
        logger.error(err);
        return ResHelper.apiResponse(res, false, message, 500, {}, "");
    }
};

const updateBhExternal = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.updateBhExternal.validate(req?.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { partner_mobile, dsa_mobile } = req?.body;
            let old_business_head = await DSAService?.getBusinessHeadRecursively(dsa_mobile);
            let previous_data = { "business_head": old_business_head?.full_name || null };
            let new_business_head = await DSAService?.getBusinessHeadRecursively(partner_mobile);
            let new_data = { "business_head": new_business_head?.full_name || null };

            await DSAService.updateBhExternal({ ...req?.body, business_head: new_business_head?.dsa_mobile_number || null });

            let difference = jsonDifference(previous_data, new_data);
            const dsa = await DSAService?.getDsaWithEmailAndPhone(dsa_mobile, dsa_mobile, dsa_mobile);
            const user = await LeadService?.getUserWithPanEmailMobile(dsa_mobile, dsa_mobile, dsa_mobile);
            await ApplicationLogServices.bulkCreate(difference, dsa?.dsa_id, "dsa", user?.id);

            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getFibeForDashboard = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getLntForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, date, type } = req.body;
            let finalArray = [];
            if (req.loggedInUser.userPhone == '9987884000' && date) {
                let parsedDate = new Date(date)//.toISOString().split('T')[0];
                let link = await DSAService.getReportLinkByDate("fibe", parsedDate);
                if (!link) {
                    ResHelper.apiResponse(res, true, "Success", 200, [], "");
                    return;
                }
                let data = await readJsonFromS3(link.link);
                if (data) finalArray = data[type];
                ResHelper.apiResponse(res, true, "Success", 200, { report: finalArray, date: link.date }, "");
                return;
            }
            let dsaTree = await getDsaTreeArray(req.loggedInUser.userPhone);
            let dsaSortedArray = getAllDSA(dsaTree);

            console.log("###1", req.loggedInUser.userPhone, new Date())
            if (!(dsaSortedArray && dsaSortedArray.uniquePhone.length)) {
                ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
                return;
            }
            console.log("###2", req.loggedInUser.userPhone, new Date())
            let applicationData = await DSAService.getFibeDashboardByPhoneNumbers(dsaSortedArray.uniquePhone, false, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter);

            console.log("###3", req.loggedInUser.userPhone, new Date())

            const mergedArray = await processArrayInChunks(dsaSortedArray.users, applicationData, 1000)
            console.log("###4", req.loggedInUser.userPhone, new Date())
            // const mergedArray = await Promise.all(dsaSortedArray.users.map(async (item) => {
            //     const match = await applicationData.find(async (obj) => {
            //         return obj.dsa_mobile_number === item.phone;
            //     });
            //     return { ...item, ...match };
            // }));

            finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == 6), mergedArray.filter(e => e.level == 7));
            console.log("###5", req.loggedInUser.userPhone, new Date())

            await asyncForEach([5, 4, 3, 2, 1], async (index, i, array) => {
                finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == index), finalArray, index);
            });
            console.log("###6", req.loggedInUser.userPhone, new Date())
            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getFibeForDashboardV2 = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getLntForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, date, type, level } = req.body;
            // req.loggedInUser.userPhone = "9987884000";

            let finalArray = [];
            let allDsa = await DSAService.getAllDsaForMis(req?.loggedInUser?.userPhone, level);
            let applicationData = await DSAService.getFibeDashboardByPhoneNumbersV2(req?.loggedInUser?.userPhone, false, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter);
            finalArray = generateNestedObjects(mergeArrays(allDsa, applicationData));
            finalArray = getChildLevels(finalArray, req?.loggedInUser?.userPhone)
            // finalArray = getChildLevels(finalArray, "7506439909");
            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getPaysenseForDashboard = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getLntForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, date, type } = req.body;
            let finalArray = [];
            if (req.loggedInUser.userPhone == '9987884000' && date) {
                let parsedDate = new Date(date)//.toISOString().split('T')[0];
                let link = await DSAService.getReportLinkByDate("paysense", parsedDate);
                if (!link) {
                    ResHelper.apiResponse(res, true, "Success", 200, [], "");
                    return;
                }
                let data = await readJsonFromS3(link.link);
                if (data) finalArray = data[type];
                ResHelper.apiResponse(res, true, "Success", 200, { report: finalArray, date: link.date }, "");
                return;
            }
            let dsaTree = await getDsaTreeArray(req.loggedInUser.userPhone);
            let dsaSortedArray = getAllDSA(dsaTree);

            console.log("###1", req.loggedInUser.userPhone, new Date())
            if (!(dsaSortedArray && dsaSortedArray.uniquePhone.length)) {
                ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
                return;
            }
            console.log("###2", req.loggedInUser.userPhone, new Date())
            let applicationData = await DSAService.getPaysenseDashboardByPhoneNumbers(dsaSortedArray.uniquePhone, false, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter);

            console.log("###3", req.loggedInUser.userPhone, new Date())

            const mergedArray = await processArrayInChunks(dsaSortedArray.users, applicationData, 1000)
            console.log("###4", req.loggedInUser.userPhone, new Date())
            // const mergedArray = await Promise.all(dsaSortedArray.users.map(async (item) => {
            //     const match = await applicationData.find(async (obj) => {
            //         return obj.dsa_mobile_number === item.phone;
            //     });
            //     return { ...item, ...match };
            // }));

            finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == 8), mergedArray.filter(e => e.level == 9));
            console.log("###5", req.loggedInUser.userPhone, new Date())

            await asyncForEach([7, 6, 5, 4, 3, 2, 1], async (index, i, array) => {
                finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == index), finalArray, index);
            });
            console.log("###6", req.loggedInUser.userPhone, new Date())
            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getPaysenseForDashboardV2 = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getLntForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, date, type, level } = req.body;
            // req.loggedInUser.userPhone = "9987884000";

            let finalArray = [];
            let allDsa = await DSAService.getAllDsaForMis(req?.loggedInUser?.userPhone, level);
            let applicationData = await DSAService.getPaysenseDashboardByPhoneNumbersV2(req?.loggedInUser?.userPhone, false, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter);
            finalArray = generateNestedObjects(mergeArrays(allDsa, applicationData));
            finalArray = getChildLevels(finalArray, req?.loggedInUser?.userPhone)
            // finalArray = getChildLevels(finalArray, "7506439909");
            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllFibeApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllFibeApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, search, businessHeadFilter, customerNameFilter, panFilter, mobileFilter, agentIdFilter, agentNameFilter, agentMobileFilter, disburseAmountFilter, sanctionLimitFilter, professionFilter, stage_filter, reasonFilter, dsaNameFilter, dsaMobileFilter, principleLimitFilter, pricipleTenureFilter, appIdFilter, is_export, startDateFilter, endDateFilter, startDateFilterLogin, endDateFilterLogin, salaryFilter, esRefIdFilter, status_filter, sub_stage_filter, filterModel, logicOperator } = req.body;
            let role = req.loggedInUser.role;
            let childPhones = null;

            if (!(req.loggedInUser.role == "HR" || req.loggedInUser.role == "VERIFICATION_AGENCY")) {
                childPhones = req.loggedInUser.role === "CEO" ? '9987884000' : req.loggedInUser.userPhone;
                loggedInUser = req?.loggedInUser?.id;
            };

            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }

            let where = [];

            if (businessHeadFilter) {
                where.push(['bh.full_name', ' like ', `%${businessHeadFilter}%`])
            }
            if (esRefIdFilter) {
                where.push(['rfpla.esRefId', ' like ', `%${esRefIdFilter}%`])
            }
            if (salaryFilter) {
                where.push(['rfpla.salary', ' like ', `%${salaryFilter}%`])
            }
            if (disburseAmountFilter) {
                where.push(['rfpla.disburse_amount', ' like ', `%${disburseAmountFilter}%`])
            }
            if (customerNameFilter) {
                where.push([`concat(rfpla.firstname, ' ', rfpla.lastname)`, ' like', `%${customerNameFilter}%`]);
            }
            if (panFilter) {
                where.push(['rfpla.pan', ' like ', `%${panFilter}%`])
            }
            if (mobileFilter) {
                where.push(['rfpla.mobilenumber', ' like ', `%${mobileFilter}%`])
            }
            if (agentIdFilter) {
                where.push(['rfpla.agentId', ' like ', `%${agentIdFilter}%`])
            }
            if (agentNameFilter) {
                where.push(['rfpla.agentName', ' like ', `%${agentNameFilter}%`])
            }
            if (agentMobileFilter) {
                where.push(['rfpla.agentMobileNo', ' like ', `%${agentMobileFilter}%`])
            }
            if (sanctionLimitFilter) {
                where.push(['rfpla.sanctionLimit', ' like ', `%${sanctionLimitFilter}%`])
            }
            if (professionFilter) {
                where.push(['rfpla.profession', ' like ', `%${professionFilter}%`])
            }
            if (status_filter) {
                where.push(['rfpla.status', ' like ', `%${status_filter}%`])
            }
            if (sub_stage_filter) {
                where.push(['rfpla.sub_stage', ' like ', `%${sub_stage_filter}%`])
            }
            if (stage_filter) {
                where.push(['rfpla.stage', ' like ', `%${stage_filter}%`])
            }
            if (reasonFilter) {
                where.push(['rfpla.reason', ' like ', `%${reasonFilter}%`])
            }
            if (dsaNameFilter) {
                where.push(['c.full_name', ' like ', `%${dsaNameFilter}%`])
            }
            if (dsaMobileFilter) {
                where.push(['rfpla.dsa_mobile_number', ' like ', `%${dsaMobileFilter}%`])
            }
            if (principleLimitFilter) {
                where.push(['rfpla.inPrincipleLimit', ' like ', `%${principleLimitFilter}%`])
            }
            if (pricipleTenureFilter) {
                where.push(['rfpla.inPrincipleTenure', ' like ', `%${pricipleTenureFilter}%`])
            }
            if (appIdFilter) {
                where.push(['rfpla.application_id', ' like ', `%${appIdFilter}%`])
            }
            if (startDateFilter) {
                where.push(['date(rfpla.disbursed_date)', ` between date("${startDateFilter}") and date ("${endDateFilter}") `, ``]);
            }
            if (startDateFilterLogin) {
                where.push(['date(rfpla.created_at)', ` between date("${startDateFilterLogin}") and date("${endDateFilterLogin}") `, ``]);
            }

            let searchList = [];
            if (search) {
                searchList.push(['rfpla.application_id', 'like', `%${search}%`]);
                searchList.push(['rfpla.mobilenumber', 'like', `%${search}%`]);
                searchList.push(['rfpla.pan', 'like', `%${search}%`])
            }

            // MUI X DataGrid filterModel (optional) — keep legacy filters intact.
            if (filterModel?.items?.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getAllFibeApplicationsFieldMapping, operatorHandlers);

                if (whereFilterArray?.length > 0) {
                    const filters = whereFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    const whereFilterQuery = filters.join(logicOp);
                    if (whereFilterQuery) {
                        where.push([`(${whereFilterQuery})`, '', null]);
                    }
                }
            }

            let allow_masking = checkMaskingAllowed(role);
            let user = await DSAService.getAllFibeApplications(where, searchList, pageNumber * pageSize, pageSize, childPhones, allow_masking);

            if (is_export) {
                await ApplicationLogServices?.createExportLog(req);
            };

            ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllPayUApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllPayUApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, search, application_id_filter, business_head_name_filter, customer_name_filter, pan_filter, phone_filter, approved_limit_filter, employment_type_filter, stage_filter, sub_stage_filter, status_filter, rejected_reason_filter, actions_required_filter, dsa_name_filter, dsa_mobile_number_filter, is_export, startDateFilter, endDateFilter, startDateFilterLogin, endDateFilterLogin, disburse_amount_filter, email_filter, monthly_income_filter, app_reference_id_filter, filterModel, logicOperator } = req.body;
            let role = req.loggedInUser.role;
            //let allow_masking = Boolean(role != "CEO" && is_export);
            let childPhones = null;
            let loggedInUser = null;
            if (!(req.loggedInUser.role == "HR" || req.loggedInUser.role == "VERIFICATION_AGENCY")) {
                childPhones = req.loggedInUser.role === "CEO" ? '9987884000' : req.loggedInUser.userPhone;
                loggedInUser = req?.loggedInUser?.id;
            };

            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }

            let where = [];
            if (sub_stage_filter || status_filter || actions_required_filter) {
                where.push(['rgs.vendor', ' =', 'payu']);
            }
            if (application_id_filter) {
                where.push(['rpula.application_id', ' like', `%${application_id_filter}%`]);
            }
            if (monthly_income_filter) {
                where.push(['rpula.monthly_income', ' like', `%${monthly_income_filter}%`]);
            }
            if (app_reference_id_filter) {
                where.push(['rpula.app_reference_id', ' like', `%${app_reference_id_filter}%`]);
            }
            if (email_filter) {
                where.push(['rpula.email', ' like', `%${email_filter}%`]);
            }
            if (disburse_amount_filter) {
                where.push(['rpula.approved_limit', ' like', `%${disburse_amount_filter}%`]);
            }
            if (business_head_name_filter) {
                where.push(['bh.full_name', ' like', `%${business_head_name_filter}%`]);
            }
            if (customer_name_filter) {
                where.push([`concat(rpula.first_name, ' ', rpula.last_name)`, ' like', `%${customer_name_filter}%`]);
            }
            if (pan_filter) {
                where.push(['rpula.pan', ' like', `%${pan_filter}%`]);
            }
            if (phone_filter) {
                where.push(['rpula.phone', ' like', `%${phone_filter}%`]);
            }
            if (approved_limit_filter) {
                where.push(['rpula.approved_limit', ' like', `%${approved_limit_filter}%`]);
            }
            if (employment_type_filter) {
                where.push(['rpula.employment_type', ' like', `%${employment_type_filter}%`]);
            }
            if (stage_filter) {
                where.push(['rpula.status', ' like', `%${stage_filter}%`]);
            }
            if (sub_stage_filter) {
                where.push(['rgs.sub_status', ' like', `%${sub_stage_filter}%`]);
            }
            if (status_filter) {
                where.push(['rgs.ru_status', ' like', `%${status_filter}%`]);
            }
            if (rejected_reason_filter) {
                where.push(['rpula.rejected_reason', ' like', `%${rejected_reason_filter}%`]);
            }
            if (actions_required_filter) {
                where.push(['rgs.actions_required', ' like', `%${actions_required_filter}%`]);
            }
            if (dsa_name_filter) {
                where.push(['c.full_name', ' like', `%${dsa_name_filter}%`]);
            }
            if (dsa_mobile_number_filter) {
                where.push(['rpula.dsa_mobile_number', ' like', `%${dsa_mobile_number_filter}%`]);
            }
            if (startDateFilter) {
                where.push(['date(rpula.disbursed_date)', ` between date("${startDateFilter}") and date ("${endDateFilter}") `, ``]);
            }
            if (startDateFilterLogin) {
                where.push(['date(rpula.created_at)', ` between date("${startDateFilterLogin}") and date("${endDateFilterLogin}") `, ``]);
            }

            let searchList = [];
            if (search) {
                searchList.push(['rpula.application_id', 'like', `%${search}%`]);
                searchList.push(['rpula.phone', 'like', `%${search}%`]);
                searchList.push(['rpula.pan', 'like', `%${search}%`])
            }

            // MUI X DataGrid filterModel (optional) — keep legacy filters intact.
            if (filterModel?.items?.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getAllPayUApplicationsFieldMapping, operatorHandlers);

                if (whereFilterArray?.length > 0) {
                    const filters = whereFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    const whereFilterQuery = filters.join(logicOp);
                    if (whereFilterQuery) {
                        where.push([`(${whereFilterQuery})`, '', null]);
                    }
                }
            }

            let allow_masking = checkMaskingAllowed(role);
            let user = await DSAService.getAllPayUApplications(where, searchList, pageNumber * pageSize, pageSize, childPhones, allow_masking);

            if (is_export) {
                await ApplicationLogServices?.createExportLog(req);
            };

            ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}


const getYearlyFibeReport = async (req, res, next) => {
    try {
        let result = {};
        let dateUpdated = null;
        if (req.loggedInUser.userPhone == '9987884000' || true) {
            let monthDates = getLastSpendDates();
            for (const month in monthDates) {
                let parsedDate = new Date(monthDates[month])//.toISOString().split('T')[0];
                let link = await DSAService.getReportLinkByDate("fibe", parsedDate);
                if (!link) {
                    result[month] = {};
                } else {
                    let data = await readJsonFromS3(link.link);
                    delete data?.disbursed[0]?.childs;
                    delete data?.login[0]?.childs;
                    if (data) result[month] = data;
                    else result[month] = {};
                    result[month].date = link.date;
                }

            }
        }
        ResHelper.apiResponse(res, true, "Success", 201, result, "");
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};


const getYearlyBajajPLReport = async (req, res, next) => {
    try {
        let result = {};
        let dateUpdated = null;
        if (req.loggedInUser.userPhone == '9987884000' || true) {
            let monthDates = getLastSpendDates();
            for (const month in monthDates) {
                let parsedDate = new Date(monthDates[month])//.toISOString().split('T')[0];
                let link = await DSAService.getReportLinkByDate("bajajPL", parsedDate);
                if (!link) {
                    result[month] = {};
                } else {
                    let data = await readJsonFromS3(link.link);
                    delete data?.disbursed[0]?.childs;
                    delete data?.login[0]?.childs;
                    if (data) result[month] = data;
                    else result[month] = {};
                    result[month].date = link.date;
                }

            }
        }
        ResHelper.apiResponse(res, true, "Success", 201, result, "");
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getYearlyCreditSasionReport = async (req, res, next) => {
    try {
        let result = {};
        let dateUpdated = null;
        if (req.loggedInUser.userPhone == '9987884000' || true) {
            let monthDates = getLastSpendDates();
            for (const month in monthDates) {
                let parsedDate = new Date(monthDates[month])//.toISOString().split('T')[0];
                let link = await DSAService.getReportLinkByDate("creditSasion", parsedDate);
                if (!link) {
                    result[month] = {};
                } else {
                    let data = await readJsonFromS3(link.link);
                    delete data?.disbursed[0]?.childs;
                    delete data?.login[0]?.childs;
                    if (data) result[month] = data;
                    else result[month] = {};
                    result[month].date = link.date;
                }

            }
        }
        ResHelper.apiResponse(res, true, "Success", 201, result, "");
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};
const getYearlyCreditVidyaReport = async (req, res, next) => {
    try {
        let result = {};
        let dateUpdated = null;
        if (req.loggedInUser.userPhone == '9987884000' || true) {
            let monthDates = getLastSpendDates();
            for (const month in monthDates) {
                let parsedDate = new Date(monthDates[month])//.toISOString().split('T')[0];
                let link = await DSAService.getReportLinkByDate("creditVidya", parsedDate);
                if (!link) {
                    result[month] = {};
                } else {
                    let data = await readJsonFromS3(link.link);
                    delete data?.disbursed[0]?.childs;
                    delete data?.login[0]?.childs;
                    if (data) result[month] = data;
                    else result[month] = {};
                    result[month].date = link.date;
                }

            }
        }
        ResHelper.apiResponse(res, true, "Success", 201, result, "");
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getYearlyPiramalReport = async (req, res, next) => {
    try {
        let result = {};
        let dateUpdated = null;
        if (req.loggedInUser.userPhone == '9987884000' || true) {
            let monthDates = getLastSpendDates();
            for (const month in monthDates) {
                const { application_type } = req?.body;
                let parsedDate = new Date(monthDates[month])//.toISOString().split('T')[0];
                let link = await DSAService.getReportLinkByDate(application_type || "piramal", parsedDate);
                if (!link) {
                    result[month] = {};
                } else {
                    let data = await readJsonFromS3(link.link);
                    delete data?.disbursed[0]?.childs;
                    delete data?.login[0]?.childs;
                    if (data) result[month] = data;
                    else result[month] = {};
                    result[month].date = link.date;
                }

            }
        }
        ResHelper.apiResponse(res, true, "Success", 201, result, "");
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getYearlyPaysenseReport = async (req, res, next) => {
    try {
        let result = {};
        let dateUpdated = null;
        if (req.loggedInUser.userPhone == '9987884000' || true) {
            let monthDates = getLastSpendDates();
            for (const month in monthDates) {
                let parsedDate = new Date(monthDates[month])//.toISOString().split('T')[0];
                let link = await DSAService.getReportLinkByDate("paysense", parsedDate);
                if (!link) {
                    result[month] = {};
                } else {
                    let data = await readJsonFromS3(link.link);
                    delete data?.disbursed[0]?.childs;
                    delete data?.login[0]?.childs;
                    if (data) result[month] = data;
                    else result[month] = {};
                    result[month].date = link.date;
                }

            }
        }
        ResHelper.apiResponse(res, true, "Success", 201, result, "");
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllBajajApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllBajajApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { count_only, rm_name_filter, rm_number_filter, pageNumber, pageSize, search, application_id_filter, business_head_name_filter, customer_name_filter, pan_filter, mobile_number_Filter, partner_unique_id_filter, requested_loan_amount_filter, employment_type_filter, stage_filter, sub_stage_filter, response_message_filter, dsa_name_filter, lan_filter, dsa_mobile_number_filter, requested_tenor_filter, disburse_amount_filter, is_export, startDateFilter, endDateFilter, startDateFilterLogin, endDateFilterLogin, status_filter, filterModel, logicOperator } = req.body;
            let all_privilege = ["HR", "VERIFICATION_AGENCY", "CEO"]
            let role = req?.loggedInUser?.role;
            //let allow_masking = Boolean(role != "CEO" && is_export);
            let childPhones = null;

            if (!all_privilege?.includes(role)) {
                loggedInUser = req?.loggedInUser?.id;
                childPhones = Boolean(role == "CEO") ? "9987884000" : req?.loggedInUser?.userPhone;
            };

            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }

            let where = [];
            if (application_id_filter) {
                where.push(['rbpla.application_id', ' like', `%${application_id_filter}%`]);
            }
            if (business_head_name_filter) {
                where.push(['bh.full_name', ' like', `%${business_head_name_filter}%`]);
            }
            if (customer_name_filter) {
                where.push([`concat(rbpla.first_name, ' ', rbpla.last_name)`, ' like', `%${customer_name_filter}%`]);
            }
            if (pan_filter) {
                where.push(['rbpla.pan', ' like', `%${pan_filter}%`]);
            }
            if (lan_filter) {
                where.push(['rbpla.lan', ' like', `%${lan_filter}%`]);
            }
            if (mobile_number_Filter) {
                where.push(['rbpla.mobile_number', ' like', `%${mobile_number_Filter}%`]);
            }
            if (partner_unique_id_filter) {
                where.push(['rbpla.partner_unique_id', ' like', `%${partner_unique_id_filter}%`]);
            }
            if (employment_type_filter) {
                where.push(['rbpla.employment_type', ' like', `%${employment_type_filter}%`]);
            }
            if (stage_filter) {
                where.push(['rbpla.stage', ' like', `%${stage_filter}%`]);
            }
            if (sub_stage_filter) {
                where.push(['rbpla.sub_stage', ' like', `%${sub_stage_filter}%`]);
            }
            if (requested_loan_amount_filter) {
                where.push(['rbpla.requested_loan_amount', ' like', `%${requested_loan_amount_filter}%`]);
            }
            if (requested_tenor_filter) {
                where.push(['rbpla.requested_tenor_in_months', ' like', `%${requested_tenor_filter}%`]);
            }
            if (response_message_filter) {
                where.push(['rbpla.response_message', ' like', `%${response_message_filter}%`]);
            }
            if (rm_name_filter) {
                where.push(['rbsp.sp_name', ' like', `%${rm_name_filter}%`]);
            }
            if (rm_number_filter) {
                where.push(['rbsp.sp_mobile', ' like', `%${rm_number_filter}%`]);
            }
            if (dsa_name_filter) {
                where.push(['c.full_name', ' like', `%${dsa_name_filter}%`]);
            }
            if (dsa_mobile_number_filter) {
                where.push(['rbpla.dsa_mobile_number', ' like', `%${dsa_mobile_number_filter}%`]);
            }
            if (disburse_amount_filter) {
                where.push(['rbpla.disburse_amount', ' like', `%${disburse_amount_filter}%`]);
            }
            if (startDateFilter) {
                where.push(['date(rbpla.disburse_date)', ` between date("${startDateFilter}") and date ("${endDateFilter}") `, ``]);
            }
            if (startDateFilterLogin) {
                where.push(['date(rbpla.created_at)', ` between date("${startDateFilterLogin}") and date("${endDateFilterLogin}") `, ``]);
            }
            if (status_filter) {
                let status = status_filter == 'Pending' ? 0 : status_filter == 'Approved/Completed' ? 1 : status_filter == 'Rejected' ? 2 : status_filter == 'Disbursed' ? 3 : "";
                where.push(['rbpla.custom_status', ' like', `%${status}%`]);
            }

            let searchList = [];
            if (search) {
                searchList.push(['rbpla.application_id', 'like', `%${search}%`]);
                searchList.push(['rbpla.mobile_number', 'like', `%${search}%`]);
                searchList.push(['rbpla.pan', 'like', `%${search}%`])
            };

            // MUI X DataGrid filterModel — keep legacy filters intact.
            if (filterModel && filterModel.items.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getAllBajajApplicationsFieldMapping, operatorHandlers);

                if (whereFilterArray && whereFilterArray.length > 0) {
                    const filters = whereFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    const whereFilterQuery = filters.join(logicOp);
                    if (whereFilterQuery) {
                        where.push([`(${whereFilterQuery})`, '', null]);
                    }
                }
            }

            let allow_masking = checkMaskingAllowed(role);
            let user = await DSAService.getAllBajajApplications(count_only, where, searchList, pageNumber * pageSize, pageSize, childPhones, allow_masking);

            if (is_export) {
                await ApplicationLogServices?.createExportLog(req);
            };

            ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const checkSendSMSNew = async (req, res, next) => {
    try {
        let data = await sendSMSNew('1207168197914312141', `Thank you for Downloading Our RUCONNECT Application\n\nYou can now enjoy an enhanced experience on our digital platform\n\nRegards,\nRUCONNECT by RULOANS`, '9517716629')
        ResHelper.apiResponse(res, true, "success", 200, { data }, "");
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const createCommunicationSettings = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.createCommunicationSettings.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {

            const { from, to, frequency, template, template_id } = req?.body;
            const response = await DSAService.createCommunicationSettings(from || null, to || null, frequency || null, template, template_id);
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getCommunicationSettings = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getCommunicationSettings.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const response = await DSAService.getCommunicationSettings();
            ResHelper.apiResponse(res, true, "Success", 200, response, "");
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const deleteCommunicationSettings = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.deleteCommunicationSettings.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { id } = req.body;
            const response = await DSAService.deleteCommunicationSettings(id);
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};


const getAllIncredApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllIncredApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, search, application_id_filter, business_head_name_filter, customer_name_filter, pan_filter, mobile_number_Filter, bank_account_holder_filter, bank_account_number_filter, bank_account_type_filter, ifsc_code_filter, requested_loan_amount_filter, employment_type_filter, stage_filter, sub_stage_filter, reason_filter, dsa_name_filter, dsa_mobile_number_filter, requested_tenor_filter, disburse_amount_filter, status_filter, is_export, startDateFilter, endDateFilter, startDateFilterLogin, endDateFilterLogin, email_filter, emp_monthly_salary_filter, incred_application_id_filter, filterModel, logicOperator } = req.body;
            let role = req.loggedInUser.role;
            //let allow_masking = Boolean(role != "CEO" && is_export);
            let childPhones = null;
            let loggedInUser = null;

            if (!(req.loggedInUser.role == "HR" || req.loggedInUser.role == "VERIFICATION_AGENCY")) {
                childPhones = req.loggedInUser.role === "CEO" ? '9987884000' : req.loggedInUser.userPhone;
                loggedInUser = Boolean(role == "CEO") ? null : req?.loggedInUser?.id;
            };

            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }

            let where = [];
            if (application_id_filter) {
                where.push(['ripla.application_id', ' like', `%${application_id_filter}%`]);
            }
            if (email_filter) {
                where.push(['ripla.email', ' like', `%${email_filter}%`]);
            }
            if (incred_application_id_filter) {
                where.push(['ripla.incred_application_id', ' like', `%${incred_application_id_filter}%`]);
            }
            if (emp_monthly_salary_filter) {
                where.push(['ripla.emp_monthly_salary', ' like', `%${emp_monthly_salary_filter}%`]);
            }
            if (business_head_name_filter) {
                where.push(['bh.full_name', ' like', `%${business_head_name_filter}%`]);
            }
            if (customer_name_filter) {
                where.push([`concat(ripla.fname, ' ', ripla.lname)`, ' like', `%${customer_name_filter}%`]);
            }
            if (pan_filter) {
                where.push(['ripla.pan', ' like', `%${pan_filter}%`]);
            }
            if (mobile_number_Filter) {
                where.push(['ripla.mobile', ' like', `%${mobile_number_Filter}%`]);
            }
            if (bank_account_holder_filter) {
                where.push(['ripla.bank_account_holder_name', ' like', `%${bank_account_holder_filter}%`]);
            }
            if (bank_account_number_filter) {
                where.push(['ripla.bank_account_number', ' like', `%${bank_account_number_filter}%`]);
            }
            if (bank_account_type_filter) {
                where.push(['ripla.bank_account_type', ' like', `%${bank_account_type_filter}%`]);
            }
            if (ifsc_code_filter) {
                where.push(['ripla.ifsc_code', ' like', `%${ifsc_code_filter}%`]);
            }
            if (requested_loan_amount_filter) {
                where.push(['ripla.loan_amount', ' like', `%${requested_loan_amount_filter}%`]);
            }
            if (employment_type_filter) {
                where.push(['ripla.employment_type', ' like', `%${employment_type_filter}%`]);
            }
            if (stage_filter) {
                where.push(['ripla.stage', ' like', `%${stage_filter}%`]);
            }
            if (sub_stage_filter) {
                where.push(['ripla.sub_stage', ' like', `%${sub_stage_filter}%`]);
            }
            if (reason_filter) {
                where.push(['ripla.reason', ' like', `%${reason_filter}%`]);
            }
            if (requested_tenor_filter) {
                where.push(['ripla.max_loan_tenure', ' like', `%${requested_tenor_filter}%`]);
            }
            if (dsa_name_filter) {
                where.push(['c.full_name', ' like', `%${dsa_name_filter}%`]);
            }
            if (dsa_mobile_number_filter) {
                where.push(['ripla.dsa_mobile_number', ' like', `%${dsa_mobile_number_filter}%`]);
            }
            if (disburse_amount_filter) {
                where.push(['ripla.disburse_amount', ' like', `%${disburse_amount_filter}%`]);
            }
            if (status_filter) {
                where.push(['ripla.status', ' like', `%${status_filter}%`]);
            }
            if (startDateFilter) {
                where.push(['date(ripla.disburse_date)', ` between date("${startDateFilter}") and date ("${endDateFilter}") `, ``]);
            }
            if (startDateFilterLogin) {
                where.push(['date(ripla.created_at)', ` between date("${startDateFilterLogin}") and date("${endDateFilterLogin}") `, ``]);
            }

            let searchList = [];
            if (search) {
                searchList.push(['ripla.application_id', 'like', `%${search}%`]);
                searchList.push(['ripla.mobile', 'like', `%${search}%`]);
                searchList.push(['ripla.pan', 'like', `%${search}%`])
            }

            // MUI X DataGrid filterModel (optional) — keep legacy filters intact.
            if (filterModel?.items?.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getAllIncredApplicationsFieldMapping, operatorHandlers);

                if (whereFilterArray?.length > 0) {
                    const filters = whereFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    const whereFilterQuery = filters.join(logicOp);
                    if (whereFilterQuery) {
                        where.push([`(${whereFilterQuery})`, '', null]);
                    }
                }
            }

            let allow_masking = checkMaskingAllowed(role);
            let user = await DSAService.getAllIncredApplications(where, searchList, pageNumber * pageSize, pageSize, childPhones, allow_masking);

            if (is_export) {
                await ApplicationLogServices?.createExportLog(req);
            };

            ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllCreditSaisonApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllCreditSaisonApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, search, application_id_filter, business_head_name_filter, customer_name_filter, pan_filter, phone_number_filter, employment_type_filter, stage_filter, sub_stage_filter, status_filter, reason_filter, dsa_name_filter, dsa_mobile_number_filter, disburse_amount_filter, is_export, startDateFilter, endDateFilter, startDateFilterLogin, endDateFilterLogin } = req.body;
            let role = req.loggedInUser.role;
            //let allow_masking = Boolean(role != "CEO" && is_export);
            let childPhones = null;

            if (!(req.loggedInUser.role == "HR" || req.loggedInUser.role == "VERIFICATION_AGENCY")) {
                childPhones = req.loggedInUser.role === "CEO" ? '9987884000' : req.loggedInUser.userPhone;
            };

            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }

            let where = [];
            if (application_id_filter) {
                where.push(['rcspla.application_id', ' like', `%${application_id_filter}%`]);
            }
            if (business_head_name_filter) {
                where.push(['bh.full_name', ' like', `%${business_head_name_filter}%`]);
            }
            if (customer_name_filter) {
                where.push([`concat(rcspla.first_name, ' ', rcspla.last_name)`, ' like', `%${customer_name_filter}%`]);
            }
            if (pan_filter) {
                where.push(['rcspla.pan', ' like', `%${pan_filter}%`]);
            }
            if (phone_number_filter) {
                where.push(['rcspla.phone_number', ' like', `%${phone_number_filter}%`]);
            }
            if (employment_type_filter) {
                where.push(['rcspla.employment_type', ' like', `%${employment_type_filter}%`]);
            }
            if (stage_filter) {
                where.push(['rcspla.stage', ' like', `%${stage_filter}%`]);
            }
            if (sub_stage_filter) {
                where.push(['rcspla.sub_stage', ' like', `%${sub_stage_filter}%`]);
            }
            if (status_filter) {
                where.push(['rcspla.application_status', ' like', `%${status_filter}%`]);
            }
            if (reason_filter) {
                where.push(['rcspla.reason', ' like', `%${reason_filter}%`]);
            }
            if (dsa_name_filter) {
                where.push(['c.full_name', ' like', `%${dsa_name_filter}%`]);
            }
            if (dsa_mobile_number_filter) {
                where.push(['rcspla.dsa_mobile_number', ' like', `%${dsa_mobile_number_filter}%`]);
            }
            if (disburse_amount_filter) {
                where.push(['rcspla.disburse_amount', ' like', `%${disburse_amount_filter}%`]);
            }
            if (startDateFilter) {
                where.push(['date(rcspla.disburse_date)', ` between date("${startDateFilter}") and date ("${endDateFilter}") `, ``]);
            }
            if (startDateFilterLogin) {
                where.push(['date(rcspla.created_at)', ` between date("${startDateFilterLogin}") and date("${endDateFilterLogin}") `, ``]);
            }

            let searchList = [];
            if (search) {
                searchList.push(['rcspla.application_id', 'like', `%${search}%`]);
                searchList.push(['rcspla.phone_number', 'like', `%${search}%`]);
                searchList.push(['rcspla.pan', 'like', `%${search}%`])
            };
            let allow_masking = checkMaskingAllowed(role);
            let user = await DSAService.getAllCreditSaisonApplications(where, searchList, pageNumber * pageSize, pageSize, childPhones, allow_masking);

            if (is_export) {
                await ApplicationLogServices?.createExportLog(req);
            };

            ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllPiramalApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllPiramalApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { sp_name_filter, sp_mobile_filter, lead_id_filter, count_only, pageNumber, pageSize, search, application_id_filter, business_head_name_filter, customer_name_filter, pan_filter, mobile_number_filter, occupation_type_filter, requested_amount_filter, requested_tenure_filter, stage_filter, sub_stage_filter, status_filter, reject_reason_filter, dsa_name_filter, dsa_mobile_number_filter, disburse_amount_filter, is_export, startDateFilter, endDateFilter, startDateFilterLogin, endDateFilterLogin, filterModel, logicOperator } = req.body;
            let all_privilege = ["HR", "VERIFICATION_AGENCY", "CEO"]
            let role = req?.loggedInUser?.role;
            //let allow_masking = Boolean(role != "CEO" && is_export);
            let childPhones = null;

            if (!all_privilege?.includes(role)) {
                loggedInUser = req?.loggedInUser?.id;
                childPhones = Boolean(role == "CEO") ? "9987884000" : req?.loggedInUser?.userPhone;
            };

            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }

            let where = [];
            if (application_id_filter) {
                where.push(['rphla.application_id', ' like', `%${application_id_filter}%`]);
            }
            if (business_head_name_filter) {
                where.push(['bh.full_name', ' like', `%${business_head_name_filter}%`]);
            }
            if (customer_name_filter) {
                where.push([`concat(rphla.first_name, ' ', rphla.last_name)`, ' like', `%${customer_name_filter}%`]);
            }
            if (pan_filter) {
                where.push(['rphla.pan', ' like', `%${pan_filter}%`]);
            }
            if (sp_mobile_filter) {
                where.push(['sp.sp_mobile', ' like', `%${sp_mobile_filter}%`]);
            }
            if (sp_name_filter) {
                where.push(['sp.sp_name', ' like', `%${sp_name_filter}%`]);
            }
            if (mobile_number_filter) {
                where.push(['rphla.mobile_number', ' like', `%${mobile_number_filter}%`]);
            }
            if (requested_amount_filter) {
                where.push(['rphla.requested_amount', ' like', `%${requested_amount_filter}%`]);
            }
            if (requested_tenure_filter) {
                where.push(['rphla.requested_tenure', ' like', `%${requested_tenure_filter}%`]);
            }
            if (occupation_type_filter) {
                where.push(['rphla.occupation_type', ' like', `%${occupation_type_filter}%`]);
            }
            if (stage_filter) {
                where.push(['rphla.lead_status', ' like', `%${stage_filter}%`]);
            }
            if (sub_stage_filter) {
                where.push(['rphla.risk_decision_type', ' like', `%${sub_stage_filter}%`]);
            }
            if (status_filter) {
                where.push(['rphla.status', ' like', `%${status_filter}%`]);
            }
            if (reject_reason_filter) {
                where.push(['rphla.reject_reason', ' like', `%${reject_reason_filter}%`]);
            }
            if (dsa_name_filter) {
                where.push(['c.full_name', ' like', `%${dsa_name_filter}%`]);
            }
            if (dsa_mobile_number_filter) {
                where.push(['rphla.dsa_mobile_number', ' like', `%${dsa_mobile_number_filter}%`]);
            }
            if (disburse_amount_filter) {
                where.push(['rphla.disburse_amount', ' like', `%${disburse_amount_filter}%`]);
            }
            if (lead_id_filter) {
                where.push(['rphla.lead_id', ' like', `%${lead_id_filter}%`]);
            }
            if (startDateFilter) {
                where.push(['date(rphla.disburse_date)', ` between date("${startDateFilter}") and date ("${endDateFilter}") `, ``]);
            }
            if (startDateFilterLogin) {
                where.push(['date(rphla.created_at)', ` between date("${startDateFilterLogin}") and date("${endDateFilterLogin}") `, ``]);
            }
            let searchList = [];
            if (search) {
                searchList.push(['rphla.application_id', 'like', `%${search}%`]);
                searchList.push(['rphla.mobile_number', 'like', `%${search}%`]);
                searchList.push(['rphla.pan', 'like', `%${search}%`])
            };

            // MUI X DataGrid filterModel (optional) — keep legacy filters intact.
            if (filterModel?.items?.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getAllPiramalApplicationsFieldMapping, operatorHandlers);

                if (whereFilterArray?.length > 0) {
                    const filters = whereFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    const whereFilterQuery = filters.join(logicOp);
                    if (whereFilterQuery) {
                        where.push([`(${whereFilterQuery})`, '', null]);
                    }
                }
            }
            let allow_masking = checkMaskingAllowed(role);
            let user = await DSAService.getAllPiramalApplications(count_only, where, searchList, pageNumber * pageSize, pageSize, childPhones, allow_masking);

            if (is_export) {
                await ApplicationLogServices?.createExportLog(req);
            };

            ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllCreditVidyaApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllCreditVidyaApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { count_only, pageNumber, pageSize, search, application_id_filter, business_head_name_filter, customer_name_filter, pan_filter, mobile_number_filter, employment_type_filter, loan_amount_filter, stage_filter, sub_stage_filter, reject_reason_filter, dsa_name_filter, dsa_mobile_number_filter, disburse_amount_filter, is_export, startDateFilter, endDateFilter, startDateFilterLogin, endDateFilterLogin, status_filter, filterModel, logicOperator } = req.body;
            let all_privilege = ["HR", "VERIFICATION_AGENCY", "CEO"]
            let role = req?.loggedInUser?.role;
            //let allow_masking = Boolean(role != "CEO" && is_export);
            let childPhones = null;

            if (!all_privilege?.includes(role)) {
                loggedInUser = req?.loggedInUser?.id;
                childPhones = Boolean(role == "CEO") ? "9987884000" : req?.loggedInUser?.userPhone;
            };

            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }

            let where = [];
            if (application_id_filter) {
                where.push(['rcvpla.application_id', ' like', `%${application_id_filter}%`]);
            }
            if (business_head_name_filter) {
                where.push(['bh.full_name', ' like', `%${business_head_name_filter}%`]);
            }
            if (customer_name_filter) {
                where.push([`concat(rcvpla.first_name, ' ', rcvpla.last_name)`, ' like', `%${customer_name_filter}%`]);
            }
            if (pan_filter) {
                where.push(['rcvpla.pan', ' like', `%${pan_filter}%`]);
            }
            if (mobile_number_filter) {
                where.push(['rcvpla.mobile_number', ' like', `%${mobile_number_filter}%`]);
            }
            if (employment_type_filter) {
                where.push(['rcvpla.employment_type', ' like', `%${employment_type_filter}%`]);
            }
            if (loan_amount_filter) {
                where.push(['rcvpla.loan_amount', ' like', `%${loan_amount_filter}%`]);
            }
            if (stage_filter) {
                where.push(['rcvpla.stage', ' like', `%${stage_filter}%`]);
            }
            if (sub_stage_filter) {
                where.push(['rcvpla.sub_stage', ' like', `%${sub_stage_filter}%`]);
            }
            if (reject_reason_filter) {
                where.push(['rcvpla.reject_reason', ' like', `%${reject_reason_filter}%`]);
            }
            if (dsa_name_filter) {
                where.push(['c.full_name', ' like', `%${dsa_name_filter}%`]);
            }
            if (dsa_mobile_number_filter) {
                where.push(['rcvpla.dsa_mobile_number', ' like', `%${dsa_mobile_number_filter}%`]);
            }
            if (disburse_amount_filter) {
                where.push(['rcvpla.disburse_amount', ' like', `%${disburse_amount_filter}%`]);
            }
            if (startDateFilter) {
                where.push(['date(rcvpla.disburse_date)', ` between date("${startDateFilter}") and date ("${endDateFilter}") `, ``]);
            }
            if (startDateFilterLogin) {
                where.push(['date(rcvpla.created_at)', ` between date("${startDateFilterLogin}") and date("${endDateFilterLogin}") `, ``]);
            }
            if (status_filter) {
                let status = status_filter == 'Pending' ? 0 : status_filter == 'Approved/Completed' ? 1 : status_filter == 'Rejected' ? 2 : status_filter == 'Disbursed' ? 3 : "";
                where.push(['rcvpla.custom_status', ' like', `%${status}%`]);
            }

            let searchList = [];
            if (search) {
                searchList.push(['rcvpla.application_id', 'like', `%${search}%`]);
                searchList.push(['rcvpla.mobile_number', 'like', `%${search}%`]);
                searchList.push(['rcvpla.pan', 'like', `%${search}%`])
            }

            // MUI X DataGrid filterModel — keep legacy filters intact.
            if (filterModel && filterModel.items.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getAllCreditVidyaApplicationsFieldMapping, operatorHandlers);

                if (whereFilterArray && whereFilterArray.length > 0) {
                    const filters = whereFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    const whereFilterQuery = filters.join(logicOp);
                    if (whereFilterQuery) {
                        where.push([`(${whereFilterQuery})`, '', null]);
                    }
                }
            }

            let allow_masking = checkMaskingAllowed(role);

            if (is_export) {
                const { query, queryCount, bindParams } = await DSAService.getAllCreditVidyaApplications(count_only, where, searchList, pageNumber * pageSize, pageSize, childPhones, allow_masking, is_export);
                sendMisReportExportEmailQueue.add({
                    query,
                    queryCount,
                    bindParams,
                    subject: "Prefer Loan Applications",
                    filename: "prefer_loan_applications",
                    loggedInUser: req?.loggedInUser,
                });
                await ApplicationLogServices?.createExportLog(req);
                ResHelper.apiResponse(res, true, "Report will be sent to your email after some time.", 200, {}, "");
            } else {
                let user = await DSAService.getAllCreditVidyaApplications(count_only, where, searchList, pageNumber * pageSize, pageSize, childPhones, allow_masking);
                ResHelper.apiResponse(res, true, "Success", 200, user, "");
            };
            // let user = await DSAService.getAllCreditVidyaApplications(count_only, where, searchList, pageNumber * pageSize, pageSize, childPhones, allow_masking);

            // if (is_export) {
            //     await ApplicationLogServices?.createExportLog(req);
            // };

            //ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getStageFilterList = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getStageFilterList.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { type } = req?.body;

            let where = "";
            let columns = "";
            if (type == "piramal") {
                columns = ` lead_status as status, stage, sub_stage `;
                where = ` ru_piramal_home_loan_applications  `;
            }
            if (type == "bajaj_finance") {
                columns = ` CASE WHEN custom_status = 0 THEN 'Pending' WHEN custom_status = 1 THEN 'Approved/Completed' WHEN custom_status = 2 THEN 'Rejected' WHEN custom_status = 3 THEN 'Disbursed' end as status, stage, sub_stage `;
                where = ` ru_bajaj_finance_personal_loan_applications  `;
            }
            if (type == "credit_saison") {
                columns = ` application_status as status, stage, sub_stage `;
                where = ` ru_credit_saison_personal_loan_applications  `;
            }
            if (type == "credit_vidya") {
                columns = ` CASE WHEN custom_status = 0 THEN 'Pending' WHEN custom_status = 1 THEN 'Approved/Completed' WHEN custom_status = 2 THEN 'Rejected' WHEN custom_status = 3 THEN 'Disbursed' end as status, stage, sub_stage `;
                where = ` ru_credit_vidya_personal_loan_applications  `;
            }
            if (type == "fibe") {
                columns = ` status, stage, sub_stage `;
                where = ` ru_fibe_personal_loan_applications  `;
            }
            if (type == "incred") {
                columns = ` status, stage, sub_stage `;
                where = ` ru_incred_personal_loan_applications `;
            }
            if (type == "paysense") {
                columns = ` status as stage, sub_status as sub_stage, ru_status as status `;
                where = ` ru_global_status_meta where binary vendor = 'payu' `;
            }
            if (type == "piramal_lap") {
                columns = ` stage as stage, sub_stage as sub_stage, lead_status as status `;
                where = ` ru_piramal_lap_applications `;
            }
            if (type == "credit_card") {
                columns = ` stage as stage, sub_stage as sub_stage, status as status `;
                where = ` ru_cc_applications `;
            }
            if (type == "pl") {
                columns = ` stage as stage, sub_stage as sub_stage, status as status `;
                where = ` ru_personal_loan_applications `;
            }
            let list = await DSAService.getStageFilterList(where, columns);
            ResHelper.apiResponse(res, true, "Success", 200, list, "");
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const uploadLeadFormData = async (req, res) => {
    try {
        const { error } = DSAValidationV1.uploadLeadFormData.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            logger.info(req?.body?.file_name)
            console.log(req.loggedInUser)
            let { base64, file_name } = req?.body;
            base64 = await removeFormattingFromExcelBase64Async(base64);
            let data = await decodeBase64AndReadXLSXForLeadForm(base64)
            if (data[0] == -1) {
                return ResHelper.apiResponse(res, false, "Invalid File", 400, {}, "");
            }
            let result = await decodeBase64AndReadXLSXForLeadFormResult(base64)
            if (result[0] == -1) {
                return ResHelper.apiResponse(res, false, "Invalid File", 400, {}, "");
            }

            const isExternal = Boolean(req.dsa && !req.loggedInUser);

            if (isExternal) {
                const dsa_id = req.dsa.dsa_id;
                const is_company = Boolean(req.body.is_company);

                const vendor_pan = is_company ? req.dsa.company_pan : req.dsa.permanent_account_number;
                if (!vendor_pan) {
                    return ResHelper.apiResponse(res, false, is_company ? "Company PAN not found" : "DSA PAN not found", 400, {}, "");
                }

                data = data.map(row => ({ ...row, vendor_pan }));

                const leader = {
                    id: dsa_id,
                    dsa_id,
                    role: null,
                    userPhone: req.dsa.dsa_mobile_number,
                    userEmail: req.dsa.email_address || null,
                    userName: req.dsa.full_name || null,
                };

                uploadLeadFormDataQueue.add({ data, leader, file_name, lead_admin_dsa_id: null, parent_user: null, isExternal: true });
                return ResHelper.apiResponse(res, true, "Upload in progress please refresh the page after 5 mins.", 200, {}, "");
            }

            // console.log(req.loggedInUser)
            // return ResHelper.apiResponse(res, true, "Success", 200, {}, "");
            let phone = req.loggedInUser.userPhone;
            let lead_admin_dsa_id = req.loggedInUser.dsa_id;
            let parent_user = null;
            if (isBackendAccessRole(req.loggedInUser.role)) {
                if (!req.loggedInUser.parentEmail) return ResHelper.apiResponse(res, false, "This User Does Not Have Any Parent", 400, {}, "");
                phone = await UserService.findUserByPhoneOrEmail(req.loggedInUser.parentEmail, req.loggedInUser.parentEmail)
                if (phone?.dsa_id) {
                    req.loggedInUser.dsa_id = phone.dsa_id;
                }
                parent_user = phone;
                phone = phone?.userPhone;
                if (!phone) ResHelper.apiResponse(res, false, "This User Does Not Have Any Parent", 400, {}, "");
            }

            // Check if file already exists
            const fileExists = await LeadLogService.checkFileAlreadyExists(req.loggedInUser.id, file_name, 'lead_claim_upload');
            if (fileExists) {
                return ResHelper.apiResponse(res, false, "Same file name already uploaded", 400, {}, "");
            }

            uploadLeadFormDataQueue.add({ data, leader: req?.loggedInUser, file_name, lead_admin_dsa_id, parent_user })
            ResHelper.apiResponse(res, true, "Upload in progress please refresh the page after 5 mins.", 200, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const uploadInvoiceData = async (req, res) => {
    try {
        const { error } = DSAValidationV1.uploadInvoiceData.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {

            let { base64, file_name } = req?.body;
            base64 = await removeFormattingFromExcelBase64Async(base64);
            let data = await decodeBase64AndReadXLSXForLeadForm(base64)
            if (data[0] == -1) {
                return ResHelper.apiResponse(res, false, "Invalid File", 400, {}, "");
            }
            let result = await decodeBase64AndReadXLSXForLeadFormResult(base64)
            if (result[0] == -1) {
                return ResHelper.apiResponse(res, false, "Invalid File", 400, {}, "");
            }
            uploadInvoiceDataQueue.add({ data, result, user: req?.loggedInUser, file_name })
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const updateClaimPendingStatusExternal = async (req, res) => {
    try {
        const { error } = DSAValidationV1.updateClaimPendingStatusExternal.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const dsa_mobile_number = req.dsa.dsa_mobile_number;
            const dsa_id = req.dsa.dsa_id;

            const { ids } = req?.body;
            const validIds = await DSAService.checkClaimAccess(ids, dsa_mobile_number)
            if (!validIds.length) {
                return ResHelper.apiResponse(res, false, "non disbursed case can not be claimed", 422, {}, "");
            }
            await DSAService.updateClaimPendingStatus(validIds, 1, dsa_id);
            if (validIds.length !== ids.length) {
                return ResHelper.apiResponse(res, false, "non disbursed case can not be claimed", 422, {}, "");
            }
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const deleteLeadFormData = async (req, res) => {
    try {
        const { error } = DSAValidationV1.deleteLeadFormData.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        let { id, status } = req?.body;
        if (id.length == 0) return ResHelper.apiResponse(res, true, "Success", 200, {}, "");

        const isExternal = Boolean(req.dsa && !req.loggedInUser);

        if (isExternal) {
            if (status == 0) {
                return ResHelper.apiResponse(res, false, "Access denied", 400, {}, "");
            }

            const dsa_mobile_number = req.dsa.dsa_mobile_number;
            const dsa_id = req.dsa.dsa_id;
            const validIds = await DSAService.checkClaimAccess(id, dsa_mobile_number);

            if (!validIds.length || validIds.length !== id.length) {
                return ResHelper.apiResponse(res, false, "Cases with ERP status can not be Deleted", 422, {}, "");
            }

            const deleted = await DSAService.deleteLeadFormData(validIds, dsa_id, status, true);
            if (!deleted) return ResHelper.apiResponse(res, false, "Failed to delete lead form", 400, {}, "");
            return ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }

        if (status == 0) {
            const isMaster = await isFinanceRootUser(req?.loggedInUser?.userPhone);
            if (!isMaster) {
                return ResHelper.apiResponse(res, false, "Access denied", 400, {}, "");
            }
        }

        const deleted = await DSAService.deleteLeadFormData(id, req.loggedInUser?.id, status);
        if (!deleted) return ResHelper.apiResponse(res, false, "Failed to delete lead form", 400, {}, "");
        return ResHelper.apiResponse(res, true, "Success", 200, {}, "");
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const updateClaimPendingStatus = async (req, res) => {
    try {
        const { error } = DSAValidationV1.updateClaimPendingStatus.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { id, value } = req.body;
            if (id.length === 0) return ResHelper.apiResponse(res, true, "Success", 200, {}, "");
            await DSAService.updateClaimPendingStatus(id, value, req.loggedInUser?.id);
            return ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {
        console.log(err);
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const updateMultiFundedStatus = async (req, res) => {
    try {
        const { error } = DSAValidationV1.updateMultiFundedStatus.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            //verify if the logged in user have the access of root privilages or not
            const isMaster = await isFinanceRootUser(req?.loggedInUser?.userPhone);
            if (!isMaster) {
                return ResHelper.apiResponse(res, false, "Access denied", 400, {}, "");
            }
            const { id, value, remark } = req.body;
            if (id.length === 0) return ResHelper.apiResponse(res, true, "Success", 200, {}, "");
            await DSAService.updateMultiFundedStatus(id, value, remark, req.loggedInUser?.id);
            return ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {
        console.log(err);
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const moveToPendingLeadForm = async (req, res) => {
    try {
        const { error } = DSAValidationV1.moveToPendingLeadForm.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { id, vendor_remark } = req.body;
            if (id.length === 0) return ResHelper.apiResponse(res, true, "Success", 200, {}, "");
            const data = await DSAService.moveToPendingLeadForm(id, req.loggedInUser?.id, vendor_remark, false);
            if (data && typeof data === 'object' && data.status === false) {
                return ResHelper.apiResponse(res, false, data.errorMsg, data.code || 400, {}, "");
            }
            return ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {
        console.log(err);
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const moveToPendingLeadFormBankerProcessed = async (req, res) => {
    try {
        const { error } = DSAValidationV1.moveToPendingLeadFormBankerProcessed.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { id, vendor_remark } = req.body;
            const bankerFileProcessed = true;
            const data = await DSAService.moveToPendingLeadForm([id], req.loggedInUser?.id, vendor_remark, bankerFileProcessed);
            if (data && typeof data === 'object' && data.status === false) {
                return ResHelper.apiResponse(res, false, data.errorMsg, data.code || 400, {}, "");
            }
            return ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {
        console.log(err);
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllDsaLeads = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllDsaLeads.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { dsa_id } = req?.body;
            const response = await DSAService.getAllDsaLeads(dsa_id);
            ResHelper.apiResponse(res, true, "Success", 200, response, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllRemainder = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllRemainder.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize } = req.body;
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }
            let data = await DSAService.getAllRemainder(pageNumber * pageSize, pageSize, req.loggedInUser.id);
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllUpcomingRemainder = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllUpcomingRemainder.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let data = await DSAService.getAllUpcomingRemainder(req.loggedInUser.id);
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const deleteRemainder = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.deleteRemainder.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { remainder_id } = req.body;
            await DSAService.deleteRemainder(remainder_id);
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const markAllPastRemainderAsRead = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.markAllPastRemainderAsRead.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            await DSAService.markAllPastRemainderAsRead(req.loggedInUser.id);
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const markRemainderAsRead = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.markRemainderAsRead.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { id } = req.body;
            await DSAService.markRemainderAsRead(id);
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};


const getAllMissedRemainder = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllMissedRemainder.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize } = req.body;
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }
            let data = await DSAService.getAllMissedRemainder(pageNumber * pageSize, pageSize, req.loggedInUser.id);
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const createRemainder = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.createRemainder.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { message, remainder_at, created_for } = req?.body;
            await DSAService.createRemainder(message, new Date(remainder_at), req.loggedInUser.id, created_for);
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getLeadClaimUpdateLogs = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getLeadClaimUpdateLogs.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, id, fields } = req.body;
            const response = await DSAService.getLeadClaimUpdateLogs(pageNumber * pageSize, pageSize, id, fields);
            ResHelper.apiResponse(res, true, "Success", 200, response, "");
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getLeadClaimUploadLogs = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getLeadClaimUploadLogs.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, email_filter, name_filter, phone_filter, type_filter, application_id_filter, startDateFilter, endDateFilter } = req.body;
            const isExternal = Boolean(req.dsa && !req.loggedInUser);
            const actor = isExternal ? { id: req.dsa.dsa_id } : req.loggedInUser;
            let where = [];

            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }

            const emailCol = isExternal ? 'd.email_address' : 'u.email';
            const nameCol = isExternal ? 'd.full_name' : 'u.name';
            const phoneCol = isExternal ? 'd.dsa_mobile_number' : 'u.phone';

            if (email_filter) {
                where.push(` ${emailCol} like '%${email_filter}%' `);
            }

            if (name_filter) {
                where.push(`${nameCol} like '%${name_filter}%' `);
            }

            if (phone_filter) {
                where.push(`${phoneCol} like '%${phone_filter}%' `);
            }

            if (type_filter) {
                where.push(`al.application_type like '%${type_filter}%' `);
            }

            if (application_id_filter) {
                where.push(`al.application_id like '%${application_id_filter}%' `);
            }

            if (startDateFilter) {
                where.push(`DATE(al.createdAt) between DATE("${startDateFilter}") and DATE("${endDateFilter}")`);
            }

            const whereQuery = where.join(" AND ");

            let childPhones = null;
            const loggedInRole = req?.loggedInUser?.role;

            // For LEAD_ADMIN, run hierarchy for parent when mapped; fallback to own phone.
            if (!isExternal && loggedInRole === "LEAD_ADMIN") {
                if (req?.loggedInUser?.parentEmail) {
                    const parentUser = await UserService.findUserByPhoneOrEmail(
                        req.loggedInUser.parentEmail,
                        req.loggedInUser.parentEmail
                    );
                    if (parentUser?.userPhone) {
                        childPhones = parentUser.userPhone;
                    }
                }
                if (!childPhones) {
                    childPhones = req?.loggedInUser?.userPhone;
                }
            }

            const response = await DSAService.getLeadClaimUploadLogs(childPhones, pageNumber * pageSize, pageSize, actor, whereQuery, isExternal);
            ResHelper.apiResponse(res, true, "Success", 200, response, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};
const getDsaUploadLogs = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getDsaUploadLogs.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let {
                pageNumber,
                pageSize,
                application_type,
                email_filter,
                application_id_filter,
                startDateFilter,
                endDateFilter,
            } = req.body;

            const where = [];
            if (email_filter) {
                where.push(`u.email like '%${email_filter}%' `);
            }
            if (application_id_filter) {
                where.push(`al.application_id like '%${application_id_filter}%' `);
            }
            if (startDateFilter && endDateFilter) {
                where.push(`DATE(al.createdAt) between DATE("${startDateFilter}") and DATE("${endDateFilter}")`);
            }
            const whereQuery = where.join(" AND ");

            let childPhones = null;
            let role = ["CEO"];
            if (!(role?.includes(req?.loggedInUser?.role) || isBackendAccessRole(req?.loggedInUser?.role))) {
                childPhones = await DSAService.getDsaChildRecursively(req?.loggedInUser?.userPhone);
                if (!childPhones?.length) {
                    childPhones = [req?.loggedInUser?.userPhone];
                }
            }
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }
            const response = await DSAService.getDsaUploadLogs(
                childPhones,
                pageNumber * pageSize,
                pageSize,
                application_type,
                whereQuery
            );
            ResHelper.apiResponse(res, true, "Success", 200, response, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getDsaDataForEdit = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getDsaDataForEdit.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { dsa_id } = req.body;
            const response = await DSAService.getDsaDataForEdit(dsa_id);
            ResHelper.apiResponse(res, true, "Success", 200, response, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const createOrEditDsa = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.createOrEditDsa.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            await KafkaServices.connectKafkaProducer();
            let { dsa_id, email_address, dsa_mobile_number, permanent_account_number, home_address_house_number, home_address_area, home_address_city, home_address_state, home_address_pincode, salutation, first_name, last_name, profession, gender, date_of_birth, partner_code } = req.body;

            let isBlacklisted = await UserService.checkIfBlacklistedUserExist(email_address, dsa_mobile_number);
            if (isBlacklisted) {
                return ResHelper.apiResponse(res, false, "DSA Blacklisted", 400, {}, "");
            };

            let data = await DSAService.getDsaWithEmailAndPhone(email_address, dsa_mobile_number, permanent_account_number);
            if (data?.length && !dsa_id) {
                return ResHelper.apiResponse(res, false, "DSA with same email, phone or pan already exist.", 400, {}, "");
            };

            if (dsa_id && data?.length) {
                if (data.length > 1 || data[0]?.dsa_id != dsa_id) {
                    return ResHelper.apiResponse(res, false, "DSA with same email, phone or pan already exist.", 400, {}, "");
                }
            }

            let prevCount = await DSAService.getPartnerHierarchyCount(partner_code);
            if (prevCount > 4) {
                return ResHelper.apiResponse(res, true, "Partner hierarchy limit reached", 400, {}, "");
            };

            let signup_steps_completed = 0;
            if (dsa_mobile_number) {
                signup_steps_completed = 1;
            };
            if (salutation && first_name && last_name && profession && gender && date_of_birth && partner_code) {
                signup_steps_completed = 2;
            };
            if (salutation && first_name && last_name && profession && gender && date_of_birth && partner_code && home_address_house_number && home_address_area && home_address_city && home_address_state && home_address_pincode) {
                signup_steps_completed = 3;
            };

            let existingSteps = dsa_id ? await DSAService.getSignUpSteps(dsa_id) : 0;

            signup_steps_completed = Boolean(existingSteps > signup_steps_completed) ? existingSteps : signup_steps_completed;

            req.body = { ...req?.body, last_modified_by: req?.loggedInUser?.userPhone, signup_steps_completed };

            let previous = {};
            let newData = {};
            if (dsa_id) {
                previous = await DSAService.getDsaDataForEdit(dsa_id, true);
                await DSAService.createDsa(req?.body);
            } else {
                dsa_id = uuid();
                await DSAService.createDsa(req?.body, dsa_id);
                const newDsaOnboard = new KafkaServices.EventLogger(
                    "dsa_onboarding",
                    "-",
                    "basic_details",
                    dsa_id,
                    req.loggedInUser.id,
                    new Date(),
                );
                await KafkaServices.sendToKafkaLoggerService(newDsaOnboard);
            }

            if (req?.body?.dsa_id && newData?.dsa_status != previous?.dsa_status) {
                await DSAService.updateLastStatus(dsa_id, previous?.dsa_status);
            }

            await DSAService.reassignPartner(dsa_id, partner_code, prevCount);

            newData = await DSAService.getDsaDataForEdit(dsa_id, true);

            const userId = req?.loggedInUser?.id || null;
            if (req?.body?.dsa_id) {
                let difference = jsonDifference(previous, newData);
                console.log(difference)

                let fromDetails = {};
                let toDetails = {};


                difference.forEach(([key, oldValue, newValue]) => {
                    fromDetails[key] = oldValue;
                    toDetails[key] = newValue;
                });

                await ApplicationLogServices.bulkCreate(difference, dsa_id, "dsa", userId);
                const dsaUpdatedDetails = new KafkaServices.EventLogger(
                    "dsa_details_updated",
                    JSON.stringify(fromDetails),
                    JSON.stringify(toDetails),
                    dsa_id,
                    userId,
                    new Date(),
                );

                await KafkaServices.sendToKafkaLoggerService(dsaUpdatedDetails);

            } else {
                await ApplicationLogServices.bulkCreate([['dsa_created', '', '']], dsa_id, "dsa", userId);
            };

            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {
        console.log(err);
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const uploadAndEditDsa = async (req, res) => {
    try {
        const { error } = DSAValidationV1.uploadLeadFormData.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { base64, file_name } = req?.body;
            const buf = Buffer.from(base64, 'base64');
            const sheet = await xlsx.read(buf, { type: 'buffer' });
            await xlsx.writeFile(sheet, "uploadBank.xlsx");
            const fileData = xlsx.readFile('uploadBank.xlsx');
            let sheetNames = fileData.SheetNames;
            const json = xlsx.utils.sheet_to_json(fileData.Sheets[sheetNames[0]]);

            if (json?.length >= 5000) {
                ResHelper.apiResponse(res, false, "Max upload size is 5000 only.", 400, {}, "");
                return;
            };
            uploadAndEditDsaQueue.add({
                json: json, userPhone: req?.loggedInUser?.userPhone || null,
                userId: req?.loggedInUser?.id || null, file_name,
                DSAService
            });
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getPersonalLoanMisForDsa = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getPersonalLoanMisForDsa.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let {
                pageNumber, pageSize, joiningDateFilterStart, joiningDateFilterEnd, bhCode, subProduct, loginDateFilterStart, loginDateFilterEnd, disbursedDateFilterStart, disbursedDateFilterEnd, utm_main_source, is_export, city, state, status, sub_status
            } = req?.body;
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 20;
            }
            let data = {};
            if (is_export) {
                const { query, queryCount, bindParams } = await DSAService.getPersonalLoanMisForDsa(pageNumber * pageSize, pageSize, joiningDateFilterStart, joiningDateFilterEnd, bhCode, subProduct, loginDateFilterStart, loginDateFilterEnd, disbursedDateFilterStart, disbursedDateFilterEnd, utm_main_source, city, state, status, sub_status, true);
                sendMisReportExportEmailQueue.add({
                    bindParams,
                    query,
                    queryCount,
                    loggedInUser: req?.loggedInUser,
                    offset: 50000
                });
            } else {
                data = await DSAService.getPersonalLoanMisForDsa(pageNumber * pageSize, pageSize, joiningDateFilterStart, joiningDateFilterEnd, bhCode, subProduct, loginDateFilterStart, loginDateFilterEnd, disbursedDateFilterStart, disbursedDateFilterEnd, utm_main_source, city, state, status, sub_status, false);
            }
            let message = is_export ? "Report will be sent to your email after some time." : "Success";
            ResHelper.apiResponse(res, true, message, 200, data, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getDsaCityState = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getDsaCityState.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { state } = req.body;
            let response = await DSAService.getDsaCityState(state);
            // if (response?.length) {
            //     let arr = [];
            //     for (i = 0; i < response?.length; i++) {
            //         arr.push({ label: response[i]?.value, name: response[i]?.value })
            //     }
            //     response = arr;
            // }
            ResHelper.apiResponse(res, true, "Success", 200, response, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const updateLeadFormPayoutType = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.updateLeadFormPayoutType.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { id, vendor_payout_type } = req.body;
            let fresh_lead_claim = await DSAService.getLeadCLaimById(id);
            if (!fresh_lead_claim) {
                return ResHelper.apiResponse(res, false, "Lead Claim Not Found", 400, response, "");
            }
            let response = await DSAService.updateLeadFormPayoutType(id, vendor_payout_type, req.loggedInUser.id);
            ResHelper.apiResponse(res, true, "Success", 201, response, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllPendingHlApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllPendingHlApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { dsa_mobile_number, count_only, pageNumber, pageSize, search, is_export, application_id_filter, dsa_name_filter, dsa_mobile_number_filter, customer_name_filter, business_head_name_filter, permanent_account_number_filter, customer_mobile_number_filter, profession_name_filter, loan_amount_filter, loan_tenure_filter, application_status_description_filter, filterModel, logicOperator } = req.body;
            let childPhones = null;
            let role = req?.loggedInUser?.role;

            if (!req?.loggedInUser) {
                if (!dsa_mobile_number) {
                    ResHelper.apiResponse(res, false, "DSA mobile number is mandatory", 400, {}, "");
                } else {
                    childPhones = dsa_mobile_number;
                };
            } else {
                let all_privilege = ["HR", "VERIFICATION_AGENCY", "CEO"]
                if (!all_privilege?.includes(role)) {
                    loggedInUser = req?.loggedInUser?.id;
                    childPhones = Boolean(role == "CEO") ? "9987884000" : req?.loggedInUser?.userPhone;
                };
            };

            if (!pageNumber) {
                pageNumber = 0;
            };
            if (!pageSize) {
                pageSize = 10;
            };

            let where = [];
            where.push(['pl.application_id', ' is null ', ``]);
            if (application_id_filter) {
                where.push(['rhla.application_id', ' like', `%${application_id_filter}%`]);
            }
            //    " rhla.application_id, d.full_name, rhla.dsa_mobile_number, c.full_name, rhla.permanent_account_number, rhla.customer_mobile_number, rdp.profession_name, rhla.loan_amount, rhla.loan_tenure, rhlps.application_status_description "
            if (dsa_name_filter) {
                where.push([`d.full_name`, ' like', `%${dsa_name_filter}%`]);
            }
            if (dsa_mobile_number_filter) {
                where.push([`rhla.dsa_mobile_number`, ' like', `%${dsa_mobile_number_filter}%`]);
            }
            if (customer_name_filter) {
                where.push([`c.full_name`, ' like', `%${customer_name_filter}%`]);
            }
            if (permanent_account_number_filter) {
                where.push([`rhla.permanent_account_number`, ' like', `%${permanent_account_number_filter}%`]);
            }
            if (customer_mobile_number_filter) {
                where.push([`rhla.customer_mobile_number`, ' like', `%${customer_mobile_number_filter}%`]);
            }
            if (profession_name_filter) {
                where.push([`rdp.profession_name`, ' like', `%${profession_name_filter}%`]);
            }
            if (loan_amount_filter) {
                where.push([`rhla.loan_amount`, ' like', `%${loan_amount_filter}%`]);
            }
            if (loan_tenure_filter) {
                where.push([`rhla.loan_tenure`, ' like', `%${loan_tenure_filter}%`]);
            }
            if (application_status_description_filter) {
                where.push([`rhlps.application_status_description`, ' like', `%${application_status_description_filter}%`]);
            }
            if (business_head_name_filter) {
                where.push([`bh.full_name`, ' like', `%${business_head_name_filter}%`]);
            }

            let searchList = [];
            if (search) {
                searchList.push(['rhla.application_id', 'like', `%${search}%`]);
                searchList.push(['rhla.customer_mobile_number', 'like', `%${search}%`]);
                searchList.push(['rhla.permanent_account_number', 'like', `%${search}%`])
            };

            // MUI X DataGrid filterModel (optional) — keep legacy filters intact.
            if (filterModel?.items?.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getAllPendingHlApplicationsFieldMapping, operatorHandlers);

                if (whereFilterArray?.length > 0) {
                    const filters = whereFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    const whereFilterQuery = filters.join(logicOp);
                    if (whereFilterQuery) {
                        where.push([`(${whereFilterQuery})`, '', null]);
                    }
                }
            }
            let allow_masking = checkMaskingAllowed(role);
            let user = await DSAService.getAllPendingHlApplications(count_only, where, searchList, pageNumber * pageSize, pageSize, childPhones, dsa_mobile_number);

            if (is_export) {
                await ApplicationLogServices?.createExportLog(req);
            };

            ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllPiramalLapApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllPiramalLapApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { sp_mobile_filter, sp_name_filter, lead_id_filter, count_only, pageNumber, pageSize, search, application_id_filter, business_head_name_filter, customer_name_filter, pan_filter, mobile_number_filter, occupation_type_filter, requested_amount_filter, approved_tenure_filter, stage_filter, sub_stage_filter, status_filter, reject_reason_filter, dsa_name_filter, dsa_mobile_number_filter, disburse_amount_filter, is_export, startDateFilter, endDateFilter, startDateFilterLogin, endDateFilterLogin, filterModel, logicOperator } = req.body;
            let all_privilege = ["HR", "VERIFICATION_AGENCY", "CEO"]
            let role = req?.loggedInUser?.role;
            //let allow_masking = Boolean(role != "CEO" && is_export);
            let childPhones = null;

            if (!all_privilege?.includes(role)) {
                loggedInUser = req?.loggedInUser?.id;
                childPhones = Boolean(role == "CEO") ? "9987884000" : req?.loggedInUser?.userPhone;
            };

            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }

            let where = [];
            if (application_id_filter) {
                where.push(['rlpa.application_id', ' like', `%${application_id_filter}%`]);
            }
            if (sp_mobile_filter) {
                where.push(['sp.sp_mobile', ' like', `%${sp_mobile_filter}%`]);
            }
            if (sp_name_filter) {
                where.push(['sp.sp_name', ' like', `%${sp_name_filter}%`]);
            }
            if (business_head_name_filter) {
                where.push(['bh.full_name', ' like', `%${business_head_name_filter}%`]);
            }
            if (customer_name_filter) {
                where.push([`concat(rlpa.first_name, ' ', rlpa.last_name)`, ' like', `%${customer_name_filter}%`]);
            }
            if (pan_filter) {
                where.push(['rlpa.pan', ' like', `%${pan_filter}%`]);
            }
            if (mobile_number_filter) {
                where.push(['rlpa.mobile_number', ' like', `%${mobile_number_filter}%`]);
            }
            if (requested_amount_filter) {
                where.push(['rlpa.requested_amount', ' like', `%${requested_amount_filter}%`]);
            }
            if (approved_tenure_filter) {
                where.push(['rlpa.approved_tenure', ' like', `%${approved_tenure_filter}%`]);
            }
            if (occupation_type_filter) {
                where.push(['rlpa.occupation_type', ' like', `%${occupation_type_filter}%`]);
            }
            if (stage_filter) {
                where.push(['rlpa.lead_status', ' like', `%${stage_filter}%`]);
            }
            if (sub_stage_filter) {
                where.push(['rlpa.risk_decision_type', ' like', `%${sub_stage_filter}%`]);
            }
            if (status_filter) {
                where.push(['rlpa.status', ' like', `%${status_filter}%`]);
            }
            if (reject_reason_filter) {
                where.push(['rlpa.reject_reason', ' like', `%${reject_reason_filter}%`]);
            }
            if (dsa_name_filter) {
                where.push(['d.full_name', ' like', `%${dsa_name_filter}%`]);
            }
            if (lead_id_filter) {
                where.push(['rlpa.lead_id', ' like', `%${lead_id_filter}%`]);
            }
            if (dsa_mobile_number_filter) {
                where.push(['rlpa.dsa_mobile_number', ' like', `%${dsa_mobile_number_filter}%`]);
            }
            if (disburse_amount_filter) {
                where.push(['rlpa.disburse_amount', ' like', `%${disburse_amount_filter}%`]);
            }
            if (startDateFilter) {
                where.push(['date(rlpa.disburse_date)', ` between date("${startDateFilter}") and date ("${endDateFilter}") `, ``]);
            }
            if (startDateFilterLogin) {
                where.push(['date(rlpa.created_at)', ` between date("${startDateFilterLogin}") and date("${endDateFilterLogin}") `, ``]);
            }

            let searchList = [];
            if (search) {
                searchList.push(['rlpa.application_id', 'like', `%${search}%`]);
                searchList.push(['rlpa.mobile_number', 'like', `%${search}%`]);
                searchList.push(['rlpa.pan', 'like', `%${search}%`])
            };

            // MUI X DataGrid filterModel (optional) — keep legacy filters intact.
            if (filterModel?.items?.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getAllPiramalLapApplicationsFieldMapping, operatorHandlers);

                if (whereFilterArray?.length > 0) {
                    const filters = whereFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    const whereFilterQuery = filters.join(logicOp);
                    if (whereFilterQuery) {
                        where.push([`(${whereFilterQuery})`, '', null]);
                    }
                }
            }
            let allow_masking = checkMaskingAllowed(role);
            let user = await DSAService.getAllPiramalLapApplications(count_only, where, searchList, pageNumber * pageSize, pageSize, childPhones, allow_masking);

            if (is_export) {
                await ApplicationLogServices?.createExportLog(req);
            };

            ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllPendingLAPApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllPendingHlApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { dsa_mobile_number, count_only, pageNumber, pageSize, search, is_export, application_id_filter, dsa_name_filter, dsa_mobile_number_filter, customer_name_filter, business_head_name_filter, permanent_account_number_filter, customer_mobile_number_filter, profession_name_filter, loan_amount_filter, loan_tenure_filter, application_status_description_filter, filterModel, logicOperator } = req.body;
            let all_privilege = ["HR", "VERIFICATION_AGENCY", "CEO"]
            let role = req?.loggedInUser?.role;
            let childPhones = null;

            if (!req?.loggedInUser) {
                if (!dsa_mobile_number) {
                    ResHelper.apiResponse(res, false, "DSA mobile number is mandatory", 400, {}, "");
                } else {
                    childPhones = dsa_mobile_number;
                };
            } else {
                if (!all_privilege?.includes(role)) {
                    loggedInUser = req?.loggedInUser?.id;
                    childPhones = Boolean(role == "CEO") ? "9987884000" : req?.loggedInUser?.userPhone;
                };
            };

            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }

            let where = [];
            where.push(['pl.application_id', ' is null ', ``]);
            if (application_id_filter) {
                where.push(['rhla.application_id', ' like', `%${application_id_filter}%`]);
            }
            //    " rhla.application_id, d.full_name, rhla.dsa_mobile_number, c.full_name, rhla.permanent_account_number, rhla.customer_mobile_number, rdp.profession_name, rhla.loan_amount, rhla.loan_tenure, rhlps.application_status_description "
            if (dsa_name_filter) {
                where.push([`d.full_name`, ' like', `%${dsa_name_filter}%`]);
            }
            if (dsa_mobile_number_filter) {
                where.push([`rhla.dsa_mobile_number`, ' like', `%${dsa_mobile_number_filter}%`]);
            }
            if (customer_name_filter) {
                where.push([`c.full_name`, ' like', `%${customer_name_filter}%`]);
            }
            if (permanent_account_number_filter) {
                where.push([`rhla.permanent_account_number`, ' like', `%${permanent_account_number_filter}%`]);
            }
            if (customer_mobile_number_filter) {
                where.push([`rhla.customer_mobile_number`, ' like', `%${customer_mobile_number_filter}%`]);
            }
            if (profession_name_filter) {
                where.push([`rdp.profession_name`, ' like', `%${profession_name_filter}%`]);
            }
            if (loan_amount_filter) {
                where.push([`rhla.loan_amount`, ' like', `%${loan_amount_filter}%`]);
            }
            if (loan_tenure_filter) {
                where.push([`rhla.loan_tenure`, ' like', `%${loan_tenure_filter}%`]);
            }
            if (application_status_description_filter) {
                where.push([`rhlps.application_status_description`, ' like', `%${application_status_description_filter}%`]);
            }
            if (business_head_name_filter) {
                where.push([`bh.full_name`, ' like', `%${business_head_name_filter}%`]);
            }

            let searchList = [];
            if (search) {
                searchList.push(['rhla.application_id', 'like', `%${search}%`]);
                searchList.push(['rhla.customer_mobile_number', 'like', `%${search}%`]);
                searchList.push(['rhla.permanent_account_number', 'like', `%${search}%`])
            };

            // MUI X DataGrid filterModel (optional) — keep legacy filters intact.
            if (filterModel?.items?.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getAllPendingLAPApplicationsFieldMapping, operatorHandlers);

                if (whereFilterArray?.length > 0) {
                    const filters = whereFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    const whereFilterQuery = filters.join(logicOp);
                    if (whereFilterQuery) {
                        where.push([`(${whereFilterQuery})`, '', null]);
                    }
                }
            }
            let allow_masking = checkMaskingAllowed(role);
            let user = await DSAService.getAllPendingLAPApplications(count_only, where, searchList, pageNumber * pageSize, pageSize, childPhones, dsa_mobile_number);

            if (is_export) {
                await ApplicationLogServices?.createExportLog(req);
            };

            ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getPiramalLAPForDashboard = async (req, res, next) => {
    try {

        const { error } = DSAValidationV1.getLntForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, date, type } = req.body;
            let finalArray = [];
            if (req.loggedInUser.userPhone == '9987884000' && date) {
                let parsedDate = new Date(date)//.toISOString().split('T')[0];
                let link = await DSAService.getReportLinkByDate('piramal', parsedDate);
                if (!link) {
                    ResHelper.apiResponse(res, true, "Success", 200, [], "");
                    return;
                }
                let data = await readJsonFromS3(link.link);
                if (data) finalArray = data[type];
                ResHelper.apiResponse(res, true, "Success", 200, { report: finalArray, date: link.date }, "");
                return;
            }
            let dsaTree = await getDsaTreeArray(req.loggedInUser.userPhone);
            let dsaSortedArray = getAllDSA(dsaTree);

            console.log("###1", req.loggedInUser.userPhone, new Date())
            if (!(dsaSortedArray && dsaSortedArray.uniquePhone.length)) {
                ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
                return;
            }
            console.log("###2", req.loggedInUser.userPhone, new Date())
            let applicationData = await DSAService.getPiramalLAPDashboardByPhoneNumbers(dsaSortedArray.uniquePhone, false, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter);

            console.log("###3", req.loggedInUser.userPhone, new Date())

            const mergedArray = await processArrayInChunks(dsaSortedArray.users, applicationData, 1000)
            console.log("###4", req.loggedInUser.userPhone, new Date())
            // const mergedArray = await Promise.all(dsaSortedArray.users.map(async (item) => {
            //     const match = await applicationData.find(async (obj) => {
            //         return obj.dsa_mobile_number === item.phone;
            //     });
            //     return { ...item, ...match };
            // }));

            finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == 6), mergedArray.filter(e => e.level == 7));
            console.log("###5", req.loggedInUser.userPhone, new Date())

            await asyncForEach([5, 4, 3, 2, 1], async (index, i, array) => {
                finalArray = await mergeLntChilds(mergedArray.filter(e => e.level == index), finalArray, index);
            });
            console.log("###6", req.loggedInUser.userPhone, new Date())
            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const mergeDsa = async (req, res, next) => {
    try {
        let { logs, updateFields, primary_dsa, secondary_dsa } = await DSAService.mergeDsa2(req?.body);
        let dsaIdArray = await DSAService?.getDsaChildRecursively(secondary_dsa?.dsa_mobile_number, "dsa_id");

        const prevCount = Number(primary_dsa?.materialized_path_depth) || 0;
        if (Boolean(prevCount > 4 && dsaIdArray?.length > 1)) {
            return ResHelper.apiResponse(res, true, "Partner hierarchy limit reached", 400, {}, "");
        };

        let secondaryKyc = await _db2.query(
            `SELECT permanent_account_number FROM ru_dsa_kyc_data WHERE dsa_id = ? LIMIT 1`,
            { replacements: [secondary_dsa.dsa_id], type: QueryTypes.SELECT }
        );
        let secondaryCompany = await _db2.query(
            `SELECT * FROM ru_companies WHERE registered_by = ? LIMIT 1`,
            { replacements: [secondary_dsa.dsa_id], type: QueryTypes.SELECT }
        );
        let dsa_pan = secondaryKyc[0]?.permanent_account_number || secondaryCompany[0]?.pan;

        const panIsNotP = dsa_pan && typeof dsa_pan === 'string' && dsa_pan.length >= 4 && dsa_pan.charAt(3).toUpperCase() !== 'P';
        let hasPrimaryCompany = false;

        if (panIsNotP) {
            let primaryCompany = await _db2.query(
                `SELECT * FROM ru_companies WHERE registered_by = ?`,
                { replacements: [primary_dsa.dsa_id], type: QueryTypes.SELECT }
            );

            if (!(primaryCompany && primaryCompany.length > 0)) {
                if (!req.body.proceed) {
                    return ResHelper.apiResponse(
                        res,
                        false,
                        "Warning: No company exists for primary. If you proceed, a company will be partially created for primary DSA using DSA name and PAN.",
                        200,
                        { warning: true, show_proceed: true },
                        ""
                    );
                }
            } else {
                hasPrimaryCompany = true;
                if (!req.body.proceed) {
                    return ResHelper.apiResponse(
                        res,
                        false,
                        "Warning: Company details will be updated because your secondary DSA is a company.",
                        200,
                        { warning: true, show_proceed: true },
                        ""
                    );
                }
            }
        };

        mergeDsaQueue.add({ updateRecords: updateFields, dsaIdArray, primary_dsa, secondary_dsa, logs, keep_secondary_email: req?.body?.keep_secondary_email, user_id: req?.loggedInUser?.id });
        let message = "Records will be updated within 5 mins.";
        if (req.body.proceed) {
            if (hasPrimaryCompany) {
                message = "Records will be updated within 5 mins. Company details will be updated.";
            } else {
                message = "Records will be updated within 5 mins. Company details are partially filled, you can complete them from onboarding journey.";
            }
        }
        ResHelper.apiResponse(res, true, message, 201, { logs }, "");

    } catch (err) {
        console.log(err);
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllCCApplications = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllCCApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { city_filter, pin_code_filter, customer_id, status_description_filter, external_id_filter, count_only, pageNumber, pageSize, search, is_export, application_id_filter, business_head_name_filter, dsa_name_filter, dsa_mobile_number_filter, customer_name_filter, permanent_account_number_filter, mobile_number_filter, stage_filter, sub_stage_filter, status_filter, product, startDateFilter, endDateFilter, filterModel, logicOperator } = req.body;
            let all_privilege = ["HR", "VERIFICATION_AGENCY", "CEO"]
            let role = req?.loggedInUser?.role;
            //let allow_masking = Boolean(role != "CEO" && is_export);
            let childPhones = null;
            let send_combined_count = false;

            if (!all_privilege?.includes(role)) {
                loggedInUser = req?.loggedInUser?.id;
                childPhones = Boolean(role == "CEO") ? "9987884000" : req?.loggedInUser?.userPhone;
            };

            if (req?.dsa?.dsa_mobile_number) {
                childPhones = req?.dsa?.dsa_mobile_number;
                send_combined_count = true;
            };

            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }

            let where = [];

            if (external_id_filter) {
                where.push(['cc.external_id', ' like', `%${external_id_filter}%`]);
            }
            if (customer_id) {
                where.push(['cc.customer_id', ' =', customer_id]);
            }
            if (status_description_filter) {
                where.push(['cc.status_description', ' like', `%${status_description_filter}%`]);
            }
            if (application_id_filter) {
                where.push(['cc.application_id', ' like', `%${application_id_filter}%`]);
            }
            if (business_head_name_filter) {
                where.push(['bh.full_name', ' like', `%${business_head_name_filter}%`]);
            }
            if (dsa_name_filter) {
                where.push(['d.full_name', ' like', `%${dsa_name_filter}%`]);
            }
            if (dsa_mobile_number_filter) {
                where.push(['d.dsa_mobile_number', ' like', `%${dsa_mobile_number_filter}%`]);
            }
            if (customer_name_filter) {
                where.push(['c.full_name', ' like', `%${customer_name_filter}%`]);
            }
            if (permanent_account_number_filter) {
                where.push(['c.permanent_account_number', ' like', `%${permanent_account_number_filter}%`]);
            }
            if (mobile_number_filter) {
                where.push(['c.customer_mobile_number', ' like', `%${mobile_number_filter}%`]);
            }
            if (stage_filter) {
                where.push(['cc.stage', ' like', `%${stage_filter}%`]);
            }
            if (sub_stage_filter) {
                where.push(['cc.sub_stage', ' like', `%${sub_stage_filter}%`]);
            }
            if (status_filter) {
                where.push(['cc.status', ' like', `%${status_filter}%`]);
            }
            if (product) {
                where.push(['cc.product_id', ' = ', product]);
            }
            if (startDateFilter) {
                where.push(['date(cc.created_at)', ` between date("${startDateFilter}") and date ("${endDateFilter}") `, ``]);
            }
            if (city_filter) {
                where.push(['ca.city', ' like', `%${city_filter}%`]);
            }
            if (pin_code_filter) {
                where.push(['ca.pin_code', ' like', `%${pin_code_filter}%`]);
            }

            let searchList = [];
            if (search) {
                searchList.push(['cc.application_id', 'like', `%${search}%`]);
                searchList.push(['c.customer_mobile_number', 'like', `%${search}%`]);
                searchList.push(['c.permanent_account_number', 'like', `%${search}%`])
            };

            // MUI X DataGrid filterModel — keep legacy filters intact.
            if (filterModel && filterModel.items.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getAllCCApplicationsFieldMapping, operatorHandlers);

                if (whereFilterArray && whereFilterArray.length > 0) {
                    const filters = whereFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    const whereFilterQuery = filters.join(logicOp);
                    if (whereFilterQuery) {
                        where.push([`(${whereFilterQuery})`, '', null]);
                    }
                }
            }
            let allow_masking = checkMaskingAllowed(role);
            let user = await DSAService.getAllCCApplications(count_only, where, searchList, pageNumber * pageSize, pageSize, childPhones, send_combined_count);

            if (is_export) {
                await ApplicationLogServices?.createExportLog(req);
            };

            ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllInvoices = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getAllInvoices.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { is_deleted, cgst_amount_filter, sgst_amount_filter, igst_amount_filter, gstin_filter, transaction_date_filter, invoice_number_filter, remarks, pageNumber, pageSize, is_export, startDateFilter, endDateFilter, vendor_pan_filter, vendor_name_filter, vendor_class_filter, base_payout_amount_filter, amount_inc_gst_filter, status_value_filter, has_reverse_invoice_value_filter } = req.body;
            let role = req?.loggedInUser?.role;

            let where = "";
            let checkWhere = () => {
                if (where.includes("where")) {
                    where += " and "
                } else {
                    where += "where "
                }
            };

            let roleArr = ["CEO"]

            if (!(roleArr?.includes(role) || isBackendAccessRole(role))) {
                checkWhere();
                where += ` d.business_head_code = ${req?.loggedInUser?.userPhone} `
            };

            if (remarks) {
                checkWhere();
                where += ` ri.remark is not null `;
            };
            if (gstin_filter) {
                checkWhere();
                where += ` d.gstin like '%${gstin_filter}%' `
            };
            if (is_deleted) {
                checkWhere();
                where += ` ri.is_deleted != true `;
            }
            if (startDateFilter) {
                checkWhere();
                where += ` date(ri.created_at) between date("${startDateFilter}") and date ("${endDateFilter}") `;
            };
            if (transaction_date_filter) {
                checkWhere();
                where += ` ri.transaction_date like '%${transaction_date_filter}%' `
            };
            if (invoice_number_filter) {
                checkWhere();
                where += ` ri.invoice_number like '%${invoice_number_filter}%' `
            };
            if (vendor_pan_filter) {
                checkWhere();
                where += ` ri.vendor_pan like '%${vendor_pan_filter}%' `
            };
            if (vendor_name_filter) {
                checkWhere();
                where += ` ri.vendor_name like '%${vendor_name_filter}%' `
            };
            if (vendor_class_filter) {
                checkWhere();
                where += ` ri.vendor_class like '%${vendor_class_filter}%' `
            };
            if (base_payout_amount_filter) {
                checkWhere();
                where += ` ri.base_payout_amount like '%${base_payout_amount_filter}%' `
            };
            if (sgst_amount_filter) {
                checkWhere();
                where += ` ri.sgst_amount like '%${sgst_amount_filter}%' `
            };
            if (cgst_amount_filter) {
                checkWhere();
                where += ` ri.cgst_amount like '%${cgst_amount_filter}%' `
            };
            if (igst_amount_filter) {
                checkWhere();
                where += ` ri.igst_amount like '%${igst_amount_filter}%' `
            };
            if (amount_inc_gst_filter) {
                checkWhere();
                where += ` (ri.base_payout_amount + ri.cgst_amount + ri.sgst_amount + ri.igst_amount) like '%${amount_inc_gst_filter}%' `
            };
            if (status_value_filter) {
                checkWhere();
                where += ` case when ri.status = 0 then "Pending" when ri.status = 1 then "Reverse Invoice Recieved" else "Completed" end like '%${status_value_filter}%' `
            };
            if (has_reverse_invoice_value_filter) {
                checkWhere();
                where += ` case when ri.has_reverse_invoice = 0 then "No" else "Yes" end  like '%${has_reverse_invoice_value_filter}%' `
            };

            let user = await DSAService.getAllInvoices(pageNumber * pageSize, pageSize, where);


            if (is_export) {
                await ApplicationLogServices?.createExportLog(req);
            };

            ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const deleteInvoice = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.deleteInvoice.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { invoice_id } = req.body;
            await DSAService.deleteInvoice(invoice_id);

            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllCCProducts = async (req, res) => {
    try {
        const { loan_type_id, loan_type_name } = req?.body;
        let where = "";
        let status = process.env.ENVIRONMENT == "prod" ? ` p.status in (1, 4, 0) ` : ` p.status is not null `;
        if (loan_type_id) {
            where = ` where p.loan_type_id = ${loan_type_id} and ${status} `
        };
        if (loan_type_name) {
            where = ` where t.alias = "${loan_type_name}" and ${status} `;
        };
        let user = await DSAService.getAllCCProducts(where);
        ResHelper.apiResponse(res, true, "Success", 200, user, "");
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const updateInvoice = async (req, res, next) => {
    try {

        const { error } = DSAValidationV1.updateInvoice.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {

            let { transaction_date, vendor_pan, vendor_class, vendor_name, base_payout_amount, invoice_number, supply_type, gst_registration_type, place_of_supply, cgst_percentage, sgst_percentage, igst_percentage, cgst_amount, sgst_amount, igst_amount, vendor_mobile_number, vendor_email_address, vendor_company_name, vendor_gstin, vendor_full_name, vendor_address_house_number, vendor_address_area, vendor_address_city, vendor_address_state, vendor_address_pincode, has_reverse_invoice, status, remark, invoice_id } = req.body;

            supply_type = vendor_address_state == 'Maharashtra' ? 'IntraState' : 'Interstate';
            gst_registration_type = 'Registered';
            place_of_supply = 'Maharashtra';
            cgst_percentage = 9;
            sgst_percentage = 9;
            igst_percentage = 18;
            cgst_amount = vendor_company_name ? (supply_type == 'IntraState' ? (9 / 100) * base_payout_amount : 0) : 0;
            sgst_amount = vendor_company_name ? (supply_type == 'IntraState' ? (9 / 100) * base_payout_amount : 0) : 0;
            igst_amount = vendor_company_name ? (supply_type == 'IntraState' ? 0 : (18 / 100) * base_payout_amount) : 0;

            let invoiceOld = await DSAService.getInvoiceById(invoice_id);
            if (invoiceOld.status == 2) {
                return ResHelper.apiResponse(res, false, "Cannot Edit The Invoice", 400, {}, "");
            }
            if (invoice_number != invoiceOld.invoice_number) {
                const startsWithPattern = /^RL\/22-23\//.test(invoice_number);

                if (startsWithPattern) {
                    return ResHelper.apiResponse(res, false, "Invalid Invoice Number", 400, {}, "");
                }
                let invoice = await DSAService.getInvoiceByInvoiceNumber(invoice_number);
                if (invoice) {
                    return ResHelper.apiResponse(res, false, "Invoice Number Already Used", 400, {}, "");
                }
            }
            await DSAService.updateInvoice(transaction_date, vendor_pan, vendor_class, vendor_name, base_payout_amount, invoice_number, supply_type, gst_registration_type, place_of_supply, cgst_percentage, sgst_percentage, igst_percentage, cgst_amount, sgst_amount, igst_amount, vendor_mobile_number, vendor_email_address, vendor_company_name, vendor_gstin, vendor_full_name, vendor_address_house_number, vendor_address_area, vendor_address_city, vendor_address_state, vendor_address_pincode, has_reverse_invoice, status, remark, invoice_id);
            let invoiceNew = await DSAService.getInvoiceById(invoice_id);
            let diffrence = CommonHelper.jsonDifference(invoiceOld, invoiceNew);
            await ApplicationLogServices.bulkCreate(diffrence, invoice_id, 'invoice_update', req.loggedInUser.id);
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const updateInvoiceNumber = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.updateInvoiceNumber.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const { invoice_number, invoice_id } = req.body;
        const updated = await DSAService.updateInvoiceNumber(invoice_number, invoice_id);
        if (!updated) {
            return ResHelper.apiResponse(res, false, "Invoice Not Found", 404, {}, "");
        }

        return ResHelper.apiResponse(res, true, "Success", 201, {}, "");
    } catch (err) {
        console.log(err);
        logger.error(err);
        if (err?.name === "SequelizeUniqueConstraintError" || err?.original?.code === "ER_DUP_ENTRY") {
            return ResHelper.apiResponse(res, false, "Invoice Number Already Used", 409, {}, "");
        }
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const acceptOrRejectInvoice = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.acceptOrRejectInvoice.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { status, remark, invoice_id } = req.body;
            for (i = 0; i < invoice_id?.length; i++) {
                let invoiceOld = await DSAService.getInvoiceById(invoice_id[i]);
                await DSAService.acceptOrRejectInvoice(status, remark || "", invoice_id[i]);
                let invoiceNew = await DSAService.getInvoiceById(invoice_id[i]);

                invoiceOld = { status: invoiceOld?.status };
                invoiceNew = { status: invoiceNew?.status };

                let diffrence = CommonHelper.jsonDifference(invoiceOld, invoiceNew);
                await ApplicationLogServices.bulkCreate(diffrence, invoice_id[i], 'invoice_update', req?.loggedInUser?.id);
            }
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const uploadReverseInvoice = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.uploadReverseInvoice.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { base64, invoice_id } = req.body;

            const url = await uploadToS3("reverse_invoice", base64, invoice_id + randomstring.generate(20), 'application/pdf', 'pdf');
            let invoiceOld = await DSAService.getInvoiceById(invoice_id);
            await DSAService.uploadReverseInvoice(url, invoice_id);
            let invoiceNew = await DSAService.getInvoiceById(invoice_id);
            let diffrence = CommonHelper.jsonDifference(invoiceOld, invoiceNew);
            await ApplicationLogServices.bulkCreate(diffrence, invoice_id, 'invoice_update', req?.loggedInUser?.id);
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const downloadInvoice = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.downloadInvoice.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const { invoice_id } = req.body;
        const invoice = await downloadInvoiceService(invoice_id);
        const url = invoice?.sign_url;

        return ResHelper.apiResponse(res, true, "Success", 201, { url }, "");
    } catch (err) {
        console.log(err);
        logger.error(err);
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const signInvoice = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.downloadInvoice.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const { invoice_id } = req.body;
        const userId = req?.loggedInUser?.id || req?.dsa?.dsa_id || "system";

        await KafkaServices.connectKafkaProducer();

        const invoiceTrigger = new KafkaServices.InvoiceSignTrigger(
            "invoice",
            [invoice_id],
            userId,
            "InvoiceSignTrigger"
        );
        await KafkaServices.sendToKafka(invoiceTrigger);

        const dsaUpdatedDetails = new KafkaServices.EventLogger(
            "invoice_sign_request",
            invoice_id,
            "Email sent to sign invoice",
            userId,
            new Date(),
        );
        await KafkaServices.sendToKafkaLoggerService(dsaUpdatedDetails);

        return ResHelper.apiResponse(res, true, "Success", 200, {}, "");
    } catch (err) {
        console.log(err);
        logger.error(err);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const E_SIGN_WEBHOOK_RETRY_EVENTS = new Set(['created', 'signed', 'completed']);

const shouldCallNsForEsignEvent = (currentAlias, event) => {
    if (event === 'completed' || event === 'declined') {
        return true;
    }
    const ranks = {
        e_sign_created: 1,
        e_sign_viewed: 2,
        e_sign_signed: 3,
        e_sign_completed: 4,
        e_sign_declined: 100,
    };
    const currentRank = ranks[currentAlias] || 0;
    const incomingRank = ranks[`e_sign_${event}`] || 0;
    return incomingRank >= currentRank;
};

const sendInvoiceSignOtpSms = async (req, res, next) => {
    try {
        const { email, otp } = req?.body;

        if (!email || !otp) {
            return ResHelper.apiResponse(res, false, "email and otp are required", 400, {}, "");
        }

        const dsa = await DSAService.getDsaMobileByEmail(email);

        if (!dsa || !dsa.dsa_mobile_number) {
            logger.error(`sendInvoiceSignOtpSms: no dsa found for email=${email}`);
            return ResHelper.apiResponse(res, false, "No DSA found for given email", 404, {}, "");
        }

        const message = `Your OTP is ${otp}. Enter it in the browser to review and sign your invoice. Do not share. -RULOANS`;

        await sendSMSNew('1277178427742538054', message, dsa.dsa_mobile_number);

        return ResHelper.apiResponse(res, true, "Success", 200, {}, "");
    } catch (e) {
        logger.error(e);
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const signInvoiceWebhook = async (req, res, next) => {
    try {
        const { objectId, file, certificate, completedAt, declinedAt, event } = req?.body;

        const invoiceParams = {
            sign_id: objectId,
            sign_url: file,
            sign_cert_url: certificate || '',
            status_alias: `e_sign_${event}`,
            sign_completed_at: completedAt || declinedAt
        };

        let invoice = await DSAService.signInvoiceWebhook(invoiceParams);

        if (!invoice && E_SIGN_WEBHOOK_RETRY_EVENTS.has(event)) {
            const maxAttempts = event === 'created' ? 10 : 5;
            const delayMs = event === 'created' ? 5000 : 2000;
            for (let i = 0; i < maxAttempts; i++) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
                invoice = await DSAService.signInvoiceWebhook(invoiceParams);
                if (invoice) break;
            }
        }

        if (!invoice) {
            logger.error(`signInvoiceWebhook: no record found for sign_id=${objectId} event=${event}`);
            return ResHelper.apiResponse(res, false, "Invoice not found for sign_id", 404, {}, "");
        }

        const statusBefore = invoice?.previous_status_alias || invoice?.status_alias || '-';

        //create log starts//
        if (invoice?.status_updated !== false) {
            let invoiceOld = { status_alias: statusBefore };
            let invoiceNew = { status_alias: invoice?.status_alias || `e_sign_${event}` };
            try {
                await KafkaServices.connectKafkaProducer();
                const dsaUpdatedDetails = new KafkaServices.EventLogger(
                    "invoice_sign_request",
                    invoiceOld,
                    invoiceNew,
                    invoice?.expense_id,
                    invoice?.crm_id || "OpenSign webhook",
                    new Date(),
                );
                await KafkaServices.sendToKafkaLoggerService(dsaUpdatedDetails);
            } catch (kafkaErr) {
                logger.error(kafkaErr);
            }
        }
        //create log ends//

        //ns webhook starts//
        let status = NSInvoiceStatusJson;
        if (status[event] && shouldCallNsForEsignEvent(statusBefore, event)) {
            if (event === "completed") {
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
            let payload = {
                "internal_id": invoice?.ns_internal_id || "12423",
                "approval_status": status[event],
                "rejection_reason": status[event] == "3" ? "Declined by DSA" : "",
                "invoice_link": file || invoice?.sign_url || ""
            }
            const data = await callNsApi({
                "api": "customscript_rest_update_vb_status",
                "payload": payload
            });
            const { Code } = data;
            return ResHelper.apiResponse(res, true, `NS Response`, Code, data, "");
        };
        //ns webhook ends//

        return ResHelper.apiResponse(res, true, "Success", 200, { status_alias: invoice?.status_alias }, "");
    } catch (err) {
        console.log(err);
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getRefreshPayoutStatusForDsa = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getRefreshPayoutStatusForDsa.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { phone } = req.body;

            const refresh = await DSAService.getRefreshPayoutStatusForDsa(phone);
            ResHelper.apiResponse(res, true, "Success", 201, { refresh }, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const editDsaNSVendorId = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.editDsaNSVendorId.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { dsa_id, vendor_id } = req.body;

            let dsa = await DSAService.getDsaById(dsa_id);
            if (!dsa) {
                return ResHelper.apiResponse(res, false, " Dsa Not Found ", 400, {}, "");
            }
            let dsaKyc = await DSAService.getDsaKycById(dsa_id);
            if (!dsaKyc) {
                return ResHelper.apiResponse(res, false, " Dsa Kyc Details Not Found ", 400, {}, "");
            }
            let vendorIdExists = await DSAService.getDsaKycByVendorId(vendor_id, dsa_id)
            if (vendorIdExists) {
                return ResHelper.apiResponse(res, false, " Vendor Id Exists For Other Dsa ", 400, {}, "");
            }
            console.log(dsaKyc)
            await DSAService.editDsaNSVendorId(dsa_id, vendor_id, dsa?.customer_mobile_number);
            let rest1 = { netsuite_vendor_id: dsaKyc.netsuite_vendor_id };
            let rest2 = { netsuite_vendor_id: vendor_id };
            let difference = jsonDifference(rest1, rest2);
            let fromDetails = {};
            let toDetails = {};
            difference.forEach(([key, oldValue, newValue]) => {
                fromDetails[key] = oldValue;
                toDetails[key] = newValue;
            });
            const userId = req?.loggedInUser?.id || null;
            await ApplicationLogServices.bulkCreate(difference, dsa_id, "dsa", userId);
            await KafkaServices.connectKafkaProducer();
            const dsaUpdatedDetails = new KafkaServices.EventLogger(
                "dsa_ns_vendor_id_updated",
                JSON.stringify(fromDetails),
                JSON.stringify(toDetails),
                dsa_id,
                userId,
                new Date(),
            );

            await KafkaServices.sendToKafkaLoggerService(dsaUpdatedDetails);
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllDsaDopdown = async (req, res, next) => {
    let where = ""; // Declare outside try block for error logging
    try {
        const { error } = DSAValidationV1.getAllDsaDopdown.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, search, search_by, user_type, business_code, universal, get_company = false } = req.body;
            let role = req?.loggedInUser?.role;
            let company_where = "";
            // Don't add is_deleted check when universal is true
            where = universal === true ? " where 1=1 " : " where is_deleted = 0 ";
            let checkWhere = () => {
                if (where.includes("where")) {
                    where += " and "
                } else {
                    where += "where "
                }
            };

            let roleArr = ["CEO", "CTO"];

            // if (role == "BACKEND") {
            //     let user = await DSAService.getDsaByPhone(req?.loggedInUser?.userPhone);
            //     if (user) {
            //         //req.loggedInUser.userPhone = user?.business_head_code
            //         req.loggedInUser.parent_dsa_id = user?.customer_id;
            //     }
            // };

            if (["BACKEND"]?.includes(role) || isBackendAccessRole(role)) {
                if (!req.loggedInUser.parentEmail) return ResHelper.apiResponse(res, false, "This User Does Not Have Any Parent", 400, {}, "");
                let phone = await UserService.findUserByPhoneOrEmail(req.loggedInUser.parentEmail, req.loggedInUser.parentEmail);
                //req.loggedInUser.userPhone = phone.userPhone;
                req.loggedInUser.parent_dsa_id = phone.dsa_id;
                if (phone?.role == "CEO") {
                    role = "CEO";
                };
            };



            if (!roleArr?.includes(role)) {
                const pathConditions = [];
                const addCondition = (condition) => {
                    if (!condition) return;
                    pathConditions.push(condition);
                };
                const sanitize = (value) => (value ? value.replace(/'/g, "\\'") : value);

                const materializedPaths = [
                    req?.dsa?.materialized_path,
                    req?.loggedInUser?.materialized_path
                ].filter(Boolean);

                materializedPaths.forEach((path) => {
                    const sanitizedPath = sanitize(path);
                    addCondition(`d.materialized_path LIKE '${sanitizedPath}%'`);
                });

                const idsForPathMatch = [
                    req?.dsa?.dsa_id,
                    req?.loggedInUser?.dsa_id,
                    req?.loggedInUser?.parent_dsa_id
                ].filter(Boolean);

                idsForPathMatch.forEach((id) => {
                    const sanitizedId = sanitize(id);
                    addCondition(`d.materialized_path LIKE '%${sanitizedId}%'`);
                });

                // Build conditions for hierarchy and universal
                const allConditions = [];

                if (pathConditions.length > 0) {
                    const combinedCondition = ` (${pathConditions.join(' OR ')}) `;
                    allConditions.push(combinedCondition.trim());
                }

                // Add universal condition only when universal is true in payload
                if (universal === true) {
                    const universalCondition = user_type === 'biller'
                        ? ` ((d.user_type = 'biller' AND d.is_universal = 1) OR d.is_employee = 1) `
                        : ` (d.user_type = 'biller' AND d.is_universal = 1) `;
                    allConditions.push(universalCondition.trim());
                }

                // Combine all conditions with OR (hierarchy OR universal billers)
                if (allConditions.length > 0) {
                    checkWhere();
                    const finalCondition = ` (${allConditions.join(' OR ')}) `;
                    where += finalCondition;

                    if (get_company) {
                        if (company_where.includes("where")) {
                            company_where += ` and ${finalCondition.trim()}`;
                        } else {
                            company_where = `where ${finalCondition.trim()}`;
                        }
                    }
                } else {
                    // Only add deny condition if no path conditions and universal is not true
                    checkWhere();
                    const denyCondition = ` (1 = 0) `;
                    where += denyCondition;
                    if (get_company) {
                        if (company_where.includes("where")) {
                            company_where += ` and ${denyCondition.trim()}`;
                        } else {
                            company_where = `where ${denyCondition.trim()}`;
                        }
                    }

                }
            }

            if (search) {
                checkWhere();
                const searchEsc = String(search).replace(/'/g, "\\'");
                if (search_by === 'ns_hierarchy') {
                    where += ` (kyc.ns_hierarchy like '${searchEsc}%' AND LOWER(TRIM(COALESCE(kyc.ns_hierarchy, ''))) <> 'admin') `;
                    if (get_company) {
                        if (company_where.includes("where")) {
                            company_where += ` and (rc.name like '${searchEsc}%' or rc.pan like '${searchEsc}%') `;
                        } else {
                            company_where += ` where (rc.name like '${searchEsc}%' or rc.pan like '${searchEsc}%') `;
                        }
                    }
                } else {
                    where += ` (d.full_name like '${searchEsc}%' or d.dsa_mobile_number like '${searchEsc}%' or kyc.permanent_account_number like '${searchEsc}%') `;
                    if (get_company) {
                        if (company_where.includes("where")) {
                            company_where += ` and (rc.name like '${searchEsc}%' or rc.pan like '${searchEsc}%') `;
                        } else {
                            company_where += ` where (rc.name like '${searchEsc}%' or rc.pan like '${searchEsc}%') `;
                        }
                    }
                }
            };

            if (user_type) {
                checkWhere();
                if (universal === true && user_type === 'biller') {
                    where += ` (d.user_type = 'biller' OR d.is_employee = 1) `;
                } else {
                    where += ` d.user_type = "${user_type}" `;
                }
            };
            if (business_code) {
                checkWhere();
                where += ` d.business_head_code = '${business_code}' `;
            }
            // Check if it's external endpoint (DSA login - has req.dsa)
            const isExternalEndpoint = req.dsa && req.dsa.dsa_id;

            if (universal && universal === true) {
                const user = await DSAService.getAllVendor(pageNumber * pageSize, pageSize, where, true);
                // Get logged-in user's DSA details and their business head details if dsa_id exists in CRMTest.users table
                // Only for CRM users (external DSA won't have req.loggedInUser)
                if (req?.loggedInUser?.id) {
                    let additionalDsaDetails = await DSAService.getLoggedInUserDsaAndBhDetails(req.loggedInUser.id);

                    // Add additional DSA details to the response if found
                    if (additionalDsaDetails && additionalDsaDetails.length > 0) {
                        user.lntApplications = user.lntApplications || [];
                        // Add logged-in user first, then BH
                        user.lntApplications.unshift(...additionalDsaDetails);
                    }
                }

                // For external endpoint, when user_type is "biller", include logged-in DSA if it's a biller
                if (isExternalEndpoint && user_type === "biller" && req.dsa?.dsa_id) {
                    const loggedInDsaDetails = await DSAService.getLoggedInDsaDetailsForDropdown(req.dsa.dsa_id);

                    if (loggedInDsaDetails && loggedInDsaDetails.user_type === "biller") {
                        // Check if logged-in DSA is already in the results
                        const isAlreadyIncluded = user.lntApplications?.some(
                            dsa => dsa.dsa_id === loggedInDsaDetails.dsa_id
                        );

                        if (!isAlreadyIncluded) {
                            user.lntApplications = user.lntApplications || [];
                            // Add logged-in DSA at the beginning
                            user.lntApplications.unshift(loggedInDsaDetails);
                        }
                    }
                }

                ResHelper.apiResponse(res, true, "Success", 200, user, "");

            } else {
                const nsHierarchySearch = Boolean(search && search_by === 'ns_hierarchy');
                let user = nsHierarchySearch
                    ? await DSAService.getAllDsaDopdownNsHierarchyUniqueClass(pageNumber * pageSize, pageSize, where)
                    : await DSAService.getAllDsaDopdown(pageNumber * pageSize, pageSize, where, get_company, company_where);
                ResHelper.apiResponse(res, true, "Success", 200, user, "");
            }


        }
    } catch (err) {
        console.error('Error in getAllDsaDopdown:', err);
        logger.error('Error in getAllDsaDopdown:', err);
        logger.error('Error stack:', err.stack);
        logger.error('Request body:', req.body);
        logger.error('Where clause:', where);
        logger.error('Is external DSA:', !!req.dsa);
        logger.error('Is CRM user:', !!req.loggedInUser);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, { error: err.message, stack: err.stack }, "");
    }
};

const getDsaPartner = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getDsaPartner.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { partner_code } = req.body;
            const dsa = await DSAService.getDsaPartner(partner_code);
            ResHelper.apiResponse(res, true, "Success", 200, dsa, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const updateCCApplications = async (req, res) => {
    try {
        const { error } = DSAValidationV1.updateCCApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { base64, product, file_name, product_type, product_id } = req?.body;
            base64 = await removeFormattingFromExcelBase64Async(base64);
            let data = await decodeBase64AndReadXLSXForLeadForm(base64)
            if (data[0] == -1) {
                return ResHelper.apiResponse(res, false, "Invalid File", 400, {}, "");
            }
            let result = await decodeBase64AndReadXLSXForLeadFormResult(base64)
            if (result[0] == -1) {
                return ResHelper.apiResponse(res, false, "Invalid File", 400, {}, "");
            };
            if (["shubham_hl", "shubham_lap"]?.includes(product)) {
                const stageMap = CommonHelper?.ccStatusMapping?.[product] || {};
                const validationErrors = [];
                for (let i = 0; i < data.length; i++) {
                    const row = data[i] || {};
                    const customerMobile = (row?.contact_no_1 || row?.column_no_1 || "").toString().trim();
                    const leadId = (row?.lead_id || "").toString().trim();
                    // const assignedTo = (row?.assigned_to || "").toString().trim();
                    const leadStage = (row?.lead_stage || "").toString().trim();
                    const hasMappedStatus = !!stageMap[leadStage];

                    if (!customerMobile || !leadId || !leadStage || !hasMappedStatus) {
                        validationErrors.push({
                            row: i + 2,
                            contact_no_1: customerMobile || null,
                            lead_id: leadId || null,
                            // assigned_to: assignedTo || null,
                            // lead_stage: leadStage || null,
                            // ruloans_lead_stage: ruloansLeadStage || null,
                            error: !customerMobile
                                ? "Invalid Mobile Number in column_no_1."
                                : !leadId
                                    ? "Invalid Lead ID."
                                    : !leadStage
                                        ? "Invalid Lead Stage."
                                        : "Invalid Lead Stage Mapping."
                        });
                    }
                }

                if (validationErrors.length) {
                    return ResHelper.apiResponse(
                        res,
                        false,
                        "Invalid file format/values. Please fix required fields.",
                        400,
                        { errors: validationErrors },
                        ""
                    );
                }
            }

            let s3PayloadUrl = null;
            try {
                s3PayloadUrl = await uploadJsonToS3({ data, result });
            } catch (s3Err) {
                console.warn("[updateCCApplications] Could not stage payload to S3, falling back to direct queue:", s3Err.message);
            }

            if (s3PayloadUrl) {
                updateCCApplicationsQueue.add({
                    s3PayloadUrl,
                    user: req?.loggedInUser,
                    product,
                    file_name,
                    product_type,
                    product_id
                });
            } else {
                updateCCApplicationsQueue.add({ data, result, user: req?.loggedInUser, product, file_name, product_type, product_id });
            }
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

// const updateCCApplications = async (req, res) => {
//     try {
//         const { error } = DSAValidationV1.updateCCApplications.validate(req.body);
//         if (error) {
//             ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
//         } else {
//             let { base64, product, file_name, product_type, product_id } = req?.body;
//             base64 = await removeFormattingFromExcelBase64Async(base64);
//             let data = await decodeBase64AndReadXLSXForLeadForm(base64)
//             if (data[0] == -1) {
//                 return ResHelper.apiResponse(res, false, "Invalid File", 400, {}, "");
//             }
//             let result = await decodeBase64AndReadXLSXForLeadFormResult(base64)
//             if (result[0] == -1) {
//                 return ResHelper.apiResponse(res, false, "Invalid File", 400, {}, "");
//             };

//             let error = [];
//             for (let i = 0; i < result?.length; i++) {
//                 let message = await reassignPartnerCsv(result[i]?.ru_dsa_id, result[i]?.assigne_mobile_no);

//                 if (message != "Success") {
//                     result[i]["message"] = message;
//                     error.push(result[i]);
//                 };

//                 console.log(result[i], i);
//             };
//             ResHelper.apiResponse(res, true, "Success", 200, {}, "");
//         }
//     } catch (err) {
//         logger.error(err);
//         ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
//     }
// };

const getAllGlobalConfiguration = async (req, res) => {
    try {
        req.body = req?.loggedInUser ? req.body : req.query;
        const { error } = DSAValidationV1.getAllGlobalConfiguration.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { key_filter, value_filter, pageNumber, pageSize, setting_key } = req.body;
            let where = "";
            let checkWhere = () => {
                if (where.includes("where")) {
                    where += " and "
                } else {
                    where += "where "
                }
            };
            if (key_filter) {
                checkWhere();
                where += ` setting_key like '%${key_filter}%' `;
            };
            if (value_filter) {
                checkWhere();
                where += ` setting_value like '%${value_filter}%' `;
            };
            let user = await DSAService.getAllGlobalConfiguration(pageNumber * pageSize, pageSize, where, setting_key);
            ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const CreateEditGlobalConfiguration = async (req, res) => {
    try {
        const { error } = DSAValidationV1.CreateEditGlobalConfiguration.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            await DSAService.CreateEditGlobalConfiguration(req?.body);
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const DeleteGlobalConfiguration = async (req, res) => {
    try {
        const { error } = DSAValidationV1.DeleteGlobalConfiguration.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            await DSAService.DeleteGlobalConfiguration(req?.body);
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const AddBankDetailDsa = async (req, res) => {
    try {
        const { error } = DSAValidationV1.AddBankDetailDsa.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const reqData = { ...req?.body };

            let request_url = `${process.env.MS_URL}/api/dsa/bank/add-account`;

            const onSuccess = async (obj) => {
                req.body = reqData;
                await ApplicationLogServices?.createExportLog(req, "add_bank_detail_dsa", obj, request_url);
            };

            let options = {
                'method': 'POST',
                data: reqData,
                'url': request_url,
                headers: {
                    "api-key": process.env.AUTH_KEY_RULOANS_BANK_CLAIM,
                    "app-version-code": 32,
                    "device-type": 4,
                    // "Authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI1IiwianRpIjoiM2E2MjUzOTE1NjRlYmFlYWJmM2I0NTkxYWZmMzNmY2JiMTBkNmQxMGI3Nzg5N2JkMzhlMmI5ZjU3YWQ2MTExYzAxYjQ2Y2M5NzY4NTdhNmYiLCJpYXQiOjE2OTc3MzQ0NjEuMzY2ODYsIm5iZiI6MTY5NzczNDQ2MS4zNjY4NjMsImV4cCI6MTcyOTM1Njg2MS4zNTQ3NzQsInN1YiI6IjE4NjgiLCJzY29wZXMiOltdfQ.nsyG2ezKvom4Bis50y8gECaskDn1IGEsEPArA4TWC6VFl_TBJz9FGCcfyiBL_Pyk1906ehIXSB_WjOOAtQpQMaLEbSd3Vr4CAQe6oOCq_thS0D_vtRRadOok13Xp9dg1wdL32MXCjsQgfT74CvZKjSQLsWPCIRylD_042rUUXYC2XEhXAPAMR681dGy3xXZv5lKeVUgGZRGseCKFtfGa3dCei_qM5kuXpWv1baqbyFmvIIQDGbnknE-3K3KpXGUx_ujdxeS_Lo0UX2Ot9R8jk7NdBUNDF5ISFV7QNibzl4b0vYjwhqVqXmnCgu98s-o8tMVW1gDy8VYVMSFo0MMAf2tdEM7kYUbzJbbfMgBCARsmspcp8YMEkCs8bcvcVTrC7O-rcVJC4ViFVi_aCbbvXEK8jk70zgaXWJkncI6QiVw33h8hAyQ23Zou0EmZYVT2au0C2ZMRhXUYg1VYo2yUHBxE1k5oDcH7cCTG2G4zywr6s3LJzwO7OWry2W1Mk_cUCdZlBJHqWj-8AFqG6wmzovLTjGiR0MLqQW1jrQZIVuyoHgE0H5rB2W4k3HNe3BEb7_G5yf1V9h-IKYMBpsJNvpmr8R6bhy_ilN_XzfhGXi6Cb_Y6iisawesW8gtDkijro8J9tRfOsKYq-fN48Z7pjl9sepVict6L5fgkXZ9pvSc",
                    'Content-Type': 'application/json'
                },
                validateStatus: () => true,
            };
            axios(options)
                .then((response) => {
                    const { status, message } = response?.data || {};
                    console.log(response?.data)
                    if (Boolean(status)) {
                        ResHelper.apiResponse(res, true, message, 200, response?.data, "");
                    } else {
                        ResHelper.apiResponse(res, false, message, 400, {}, "");
                    }
                    onSuccess(response?.data);
                })
                .catch((error) => {
                    throw new Error(error);
                });
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, err?.errors[0]["message"], 500, {}, "");
    }
};

const getBankDetailsDsa = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getBankDetailsDsa.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let data = await DSAService.getBankDetailsDsa(req?.body?.dsa_id);
            ResHelper.apiResponse(res, true, "Success", 201, data, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};


const getFreshLeadClaimForEdit = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getFreshLeadClaimForEdit.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let data = await LeadClaimService.getClaimForEdit(req?.body?.fresh_lead_id, LeadClaimService.FIND_FOR_EDIT_EXTRA.STATUS_AND_DSA_NAME);
            // Get mail from ru_fresh_lead_reconciliations instead of MongoDB
            const reconciliationData = await LeadService.getReconciliationMailTrailByLeadId(req?.body?.fresh_lead_id);
            const mailRecieved = reconciliationData?.mail_html ? [reconciliationData.mail_html] : [];
            data["records"] = {
                ...data["records"],
                mail: mailRecieved,
                banker_mail_recieved: data["records"]?.banker_email && mailRecieved?.length ? Boolean(mailRecieved[mailRecieved?.length - 1]?.from?.includes(data["records"]?.banker_email)) : false
            };
            ResHelper.apiResponse(res, true, "Success", 201, data, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const updateLeadByReconciliation = async (req, res) => {
    try {
        const { error } = DSAValidationV1.updateLeadByReconciliation.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const { fresh_lead_id } = req.body;

        // Get previous data + remarks up-front: used both as a fallback for the mandatory-field
        // checks below and reused later for remarks-diff logging (avoids a duplicate fetch).
        const prevDataResult = await LeadClaimService.getClaimForEdit(fresh_lead_id);
        const prevData = prevDataResult?.records;
        const claimRow = await LeadService.getLeadFormRemarksByFreshLeadId(fresh_lead_id);

        // Mirrors doSave()'s conditional-mandatory rules in ReconciliationViewer.js, plus the
        // loan/apac-required-for-verified rule. Hard-reject — nothing is written below.
        const saveCheck = FinanceServices.validateManualReconciliationSave({
            claim_confirmation: req.body.claim_confirmation,
            loan_number: req.body.loan_number,
            application_no: req.body.application_no,
            loan_amount: req.body.loan_amount,
            ns_audit_remark: req.body.ns_audit_remark,
            expected_billing_month: req.body.expected_billing_month,
        });
        if (!saveCheck.isValid) {
            return ResHelper.apiResponse(res, false, saveCheck.message, 400, {}, "");
        }

        // When claim_confirmation is updated: verified states mark banker file processed; all other values reset it
        const claimValue = req.body.claim_confirmation;
        if (claimValue !== undefined && claimValue !== null) {
            const normalized = CommonHelper.formatEventName(claimValue) || '';
            if (normalized === 'verified' || normalized === 'verified_with_exception') {
                req.body.fresh_lead_status_id = 0;
                req.body.is_banker_file_processed = 1;
            } else {
                req.body.is_banker_file_processed = 0;
            }
        }

        const result = await DSAService.updateLeadByReconciliation(req.body);

        if (result.success) {
            let { ns_audit_remark, ns_claim_confirmation_remark } = req.body;
            // Update remarks in ru_fresh_lead_claims_meta table if provided
            const remarksToUpdate = {
                'audit_remark': ns_audit_remark,
                'claim_confirmation_remark': ns_claim_confirmation_remark
            };

            for (const [remark_type, value] of Object.entries(remarksToUpdate)) {
                // Get old value from claimRow (mapping to ns_ prefixed fields)
                const nsRemarkType = `ns_${remark_type}`;
                const oldValue = claimRow ? claimRow[nsRemarkType] : null;

                const result = await LeadService.updateLeadFormRemark(fresh_lead_id, remark_type, value, 'ru_fresh_lead_claims_meta');
                if (!result.success) {
                    return ResHelper.apiResponse(res, false, result.message || "Update failed", 400, {}, "");
                }
                // Log the change if successful and we have required data
                if (claimRow?.application_id != null && req?.loggedInUser?.id) {
                    const fromVal = oldValue != null ? String(oldValue) : '';
                    const toVal = value != null ? String(value) : '';
                    const difference = [[remark_type, fromVal, toVal]];
                    await ApplicationLogServices?.bulkCreate(difference, claimRow.application_id, "lead_claim_update", req.loggedInUser.id);
                }
            }

            // Get new data and create logs
            const newDataResult = await LeadClaimService.getClaimForEdit(fresh_lead_id);
            const newData = newDataResult?.records;
            if (prevData && newData) {
                let difference = jsonDifference(prevData, newData);
                await ApplicationLogServices?.bulkCreate(difference, prevData?.id, "lead_claim_update", req?.loggedInUser?.id);
            }
            ResHelper.apiResponse(res, true, result.message, 200, {}, "");
        } else {
            ResHelper.apiResponse(res, false, result.message, 400, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const refreshApplicationStatus = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.refreshApplicationStatus.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { application_name, payload } = req?.body;
            const urlObj = {
                "bajaj": "pl/bajaj/get-status",
                "incred": "pl/incred/get-status",
                // "credit-saison": "pl/credit-saison/get-status",
                "piramal_hl": "hl/piramal/get-status",
                "piramal_lap": "lap/piramal/get-status",
                "faircent": "pl/faircent/get-loan-status",
                "lnt": "",
                "indifi": "",
                "paysense": "loan/payu/lead/status",
                "fibe": "loan/pl/fibe/lead/status",
                "piramal_hl_new": "loan/piramal/v2/hl/get-status",
                "piramal_lap_new": "loan/piramal/v2/lap/get-status"
            };

            let options;
            if (application_name == "indifi") {
                //external get request indifi
                options = {
                    "method": 'GET',
                    "url": process.env.ENVIRONMENT == "dev" ? `https://demo-api.indifi.com/applications/${payload?.application_id}/get_status` : `https://api.indifi.com/applications/${payload?.application_id}/get_status`,
                    "headers": {
                        "Authorization": "Bearer 95c22236b1e38480c123268e98a280068e6a9b73"
                    },
                    validateStatus: () => true,
                };

                axios(options)
                    .then((response) => {
                        const { success, data } = response?.data || {};
                        if (Boolean(success)) {
                            ResHelper.apiResponse(res, true, data?.message, 200, data, "");
                        } else {
                            ResHelper.apiResponse(res, false, data?.message, 400, {}, "");
                        }
                    })
                    .catch((error) => {
                        throw new Error(error);
                    });
            } else {
                //external post request
                let newPayload;
                const snake_case = ["fibe", "paysense"];
                if (!snake_case.includes(application_name)) {
                    newPayload = { applicationId: payload?.application_id }
                };

                let url = `${process.env.MS_URL}/api/${urlObj[application_name]}`;
                if (application_name?.includes("_new")) {
                    url = `${process.env.RU_SERVICE_URL}/api/${urlObj[application_name]}`;
                    newPayload = { application_id: payload?.application_id };
                };

                options = {
                    "method": 'POST',
                    data: newPayload,
                    "url": url,
                    "headers": {
                        'api-key': process.env.AUTH_KEY_RULOANS_BANK_CLAIM,
                        'app-version-code': '34',
                        'device-type': '3',
                        'Content-Type': 'application/json'
                    },
                    validateStatus: () => true,
                };
                console.log(options, "===");
                axios(options)
                    .then((response) => {
                        console?.log(response?.data)
                        const { status, message } = response?.data || {};
                        if (Boolean(status)) {
                            ResHelper.apiResponse(res, true, message, 200, response?.data, "");
                        } else {
                            ResHelper.apiResponse(res, false, message, 400, {}, "");
                        }
                    })
                    .catch((error) => {
                        throw new Error(error);
                    });
            };
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getSalesPersons = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getSalesPersons.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { pageNumber, pageSize, search } = req?.body;
            const role = req?.loggedInUser?.role;
            const userId = req?.loggedInUser?.id;
            const roleMapping = {
                "CRM_ADMIN": ["CEO", "BUSINESS_HEAD", "BUSINESS_MANAGER", "TELE_SUPERVISOR", "TELE_CALLER"],
                "SALES_ADMIN": ["BUSINESS_HEAD", "BUSINESS_MANAGER", "TELE_SUPERVISOR", "TELE_CALLER", "SALES_HEAD"],
                "SALES_HEAD": ["BUSINESS_HEAD", "BUSINESS_MANAGER", "TELE_SUPERVISOR", "TELE_CALLER"],
                "CEO": ["BUSINESS_HEAD", "BUSINESS_MANAGER", "TELE_SUPERVISOR", "TELE_CALLER"],
                "CFO": ["BUSINESS_HEAD", "BUSINESS_MANAGER", "TELE_SUPERVISOR", "TELE_CALLER"],
                "CTO": ["BUSINESS_HEAD", "BUSINESS_MANAGER", "TELE_SUPERVISOR", "TELE_CALLER"],
                "BUSINESS_HEAD": ["BUSINESS_MANAGER", "TELE_SUPERVISOR", "TELE_CALLER", "SALES_HEAD"],
                "BUSINESS_MANAGER": ["TELE_SUPERVISOR", "TELE_CALLER"],
                "TELE_SUPERVISOR": ["TELE_CALLER"],
            };

            // const allowedRoles = roleMapping[role] || roleMapping["TELE_CALLER"];
            const allowedRoles = ["TELE_SUPERVISOR", "TELE_CALLER"];

            let disableHierachy = ["CEO", "CFO", "CTO"]?.includes(req?.loggedInUser?.role) || isBackendAccessRole(req?.loggedInUser?.role);

            let data = await DSAService.getSalesPersons(userId, allowedRoles, pageNumber, pageSize, search, disableHierachy);
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}
const assignSalesPerson = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.assignSalesPerson.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        };

        const { dsaIdArray, crmId, query } = req?.body;
        await KafkaServices.connectKafkaProducer();

        const hasNonNullValues = dsaIdArray.filter(item => item !== null).length > 0;

        if (query && !hasNonNullValues) {
            const dsaUsersCount = await getRuloansCustomers({
                ...req,
                plain_function: true,
                body: { filterModel: query, pageNumber: 0, pageSize: 20000 }
            }, null);

            const dsaUsers = dsaUsersCount?.results || [];

            const extractedDsaIds = dsaUsers?.map((obj) => obj?.customer_id).filter(Boolean);

            // Fetch old SPs BEFORE assignment
            const oldSPsMap = {};
            for (const dsaId of extractedDsaIds) {
                oldSPsMap[dsaId] = await DSAService.getSPbyId(dsaId);
            }
            let moduleName = "dsa_channel_partners_bulk_assign_sp";
            if (extractedDsaIds.length === 1) {
                moduleName = "dsa_channel_partners_assign_sp";
            }
            const isAuthorised = rbacMiddleware.hasPermission(await rbacMiddleware.getPermissions(Buffer.from(req.loggedInUser.role_id.data)), moduleName, "update");

            if (!isAuthorised && !req?.loggedInUser?.isSuperAdmin) return res.sendStatus(403);


            await DSAService.assignSalesPerson(extractedDsaIds, crmId);

            // Log Kafka after assignment
            for (const dsaId of extractedDsaIds) {
                const DsaUpdatedDetails = new KafkaServices.EventLogger(
                    "dsa_sales_person_assigned",
                    oldSPsMap[dsaId],
                    crmId,
                    dsaId,
                    req?.loggedInUser?.id || null,
                    new Date()
                );
                await KafkaServices.sendToKafkaLoggerService(DsaUpdatedDetails);
            };

            return ResHelper.apiResponse(res, true, "Salesperson assigned to all filtered DSAs", 200, {}, "");
        } else {
            const oldSPsMap = {};
            for (const dsaId of dsaIdArray) {
                oldSPsMap[dsaId] = await DSAService.getSPbyId(dsaId);
            };

            let moduleName = "dsa_channel_partners_bulk_assign_sp";
            if (dsaIdArray.length === 1) {
                moduleName = "dsa_channel_partners_assign_sp";
            }
            const isAuthorised = rbacMiddleware.hasPermission(await rbacMiddleware.getPermissions(Buffer.from(req.loggedInUser.role_id.data)), moduleName, "update");

            if (!isAuthorised && !req.loggedInUser.isSuperAdmin) return res.sendStatus(403);

            const data = await DSAService.assignSalesPerson(dsaIdArray, crmId);

            // Log Kafka after assignment
            for (const dsaId of dsaIdArray) {
                const DsaUpdatedDetails = new KafkaServices.EventLogger(
                    "dsa_sales_person_assigned",
                    oldSPsMap[dsaId],
                    crmId,
                    dsaId,
                    req?.loggedInUser?.id || null,
                    new Date()
                );
                await KafkaServices.sendToKafkaLoggerService(DsaUpdatedDetails);
            };

            return ResHelper.apiResponse(res, true, "Salesperson assigned", 200, data, "");
        };
    } catch (err) {
        console.log(err);
        logger.error(err);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};


const getStatusRefresh = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getStatusRefresh.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { lender, loan_type, application_id } = req?.body;
            let url = `${process.env.RU_SERVICE_URL}/api/v2/products/get-status-refresh?lender=${lender}&loan_type=${loan_type}&application_id=${application_id}`;

            let options = {
                "method": 'GET',
                "url": url,
                "headers": {
                    "Authorization": process.env.GET_STATUS_REFRESH_TOKEN,
                },
                validateStatus: () => true,
            };
            axios(options)
                .then((response) => {
                    console?.log(options, response?.data);
                    const { status, message } = response?.data || {};
                    if (Boolean(status)) {
                        ResHelper.apiResponse(res, true, message, 200, response?.data, "");
                    } else {
                        ResHelper.apiResponse(res, false, message, 400, {}, "");
                    }
                })
                .catch((error) => {
                    throw new Error(error);
                });
        };
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const updateDirectClaimAccess = async (req, res) => {
    try {
        const { error } = DSAValidationV1.updateDirectClaimAccess.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { dsa_mobile_number, status } = req?.body;
            const previous = await DSAService.getDsaByPhone(dsa_mobile_number);
            let data = await DSAService.updateDirectClaimAccess(dsa_mobile_number, status);
            let difference = jsonDifference({ ...previous, is_direct_claim_enabled: previous?.is_direct_claim_enabled == 1 ? true : false }, { ...previous, is_direct_claim_enabled: status });
            const userId = req?.loggedInUser?.id || null;
            await ApplicationLogServices.bulkCreate(difference, previous?.customer_id, "dsa", userId);
            ResHelper.apiResponse(res, true, "Success", 201, data, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};


const getApplicationsByProductAndLoanType = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getApplicationsByProductAndLoanType.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { loan_apac_ref_los_number_filter, startDateFilterUpdate, endDateFilterUpdate, loan_reference_id_filter, application_ref_filter, utm_source_filter, utm_medium_filter, utm_campaign_filter, utm_content_filter, utm_channel_filter, utm_term_filter, utm_id_filter, ad_group_id_filter, campaign_id_filter, ad_filter, mt_filter, adpos_filter, gad_filter, gclid_filter, fbclid_filter, utm_main_source_filter, utm_device_filter, utm_adgroup_filter, city_filter, pin_code_filter, claim_status_filter, ifsc_code_filter, branch_name_filter, is_export, export_title, sub_status_filter, sp_name_filter, sp_email_filter, sp_mobile_filter, dsa_mobile_number, loan_type, product, count_only, pageNumber, pageSize, startDateFilter, endDateFilter, startDateFilterLogin, endDateFilterLogin, application_id_filter, external_id_filter, bh_name_filter, customer_full_name_filter, permanent_account_number_filter, customer_mobile_number_filter, customer_email_filter, partner_name_filter, partner_mobile_filter, loan_tenure_filter, disbursed_loan_amount_filter, applied_loan_amount_filter, status_filter, stage_filter, sub_stage_filter, status_description_filter, offered_loan_tenure_filter, hierarchy_crm_filter, source_from_filter, page_source_filter, filterModel, logicOperator } = req.body;

            let childPhones = null;
            let hierarchyUser = req?.loggedInUser;
            let effectiveSalesUserId = req?.loggedInUser?.id;
            if (!req?.loggedInUser?.role) {
                if (!dsa_mobile_number) {
                    return ResHelper.apiResponse(res, false, "DSA Mobile Number is mandatory.", 400, {}, "");
                };
            }
            else {
                let all_privilege = ["HR", "VERIFICATION_AGENCY", "CEO"];
                let role = req?.loggedInUser?.role;

                // Keep backend-access handling separate from all_privilege logic.
                if (isBackendAccessRole(role)) {
                    if (!req?.loggedInUser?.parentEmail) {
                        return ResHelper.apiResponse(res, false, "This User Does Not Have Any Parent", 400, {}, "");
                    }
                    const parentUser = await UserService.findUserByPhoneOrEmail(req.loggedInUser.parentEmail, req.loggedInUser.parentEmail);
                    if (!parentUser) {
                        return ResHelper.apiResponse(res, false, "This User Does Not Have Any Parent", 400, {}, "");
                    }
                    hierarchyUser = parentUser;
                    effectiveSalesUserId = parentUser?.id || effectiveSalesUserId;
                }

                if (!all_privilege?.includes(role)) {
                    childPhones = true;
                };
            };

            let sales_query = null;
            let sales_query_where = null;

            if (req?.loggedInUser?.role) {
                let data = getHierarchySalesPerson(hierarchyUser, "d");
                sales_query = data?.sales_query || null;
                sales_query_where = data?.sales_query_where || null;
            };

            if (!pageNumber) {
                pageNumber = 0;
            };
            if (!pageSize) {
                pageSize = 100;
            };

            let where = [];

            childPhones = !sales_query ? childPhones : null
            if (childPhones) {
                const hierarchyPath = hierarchyUser?.materialized_path || hierarchyUser?.dsa_id || null;
                let sales_query = `d.salesperson_id = "${effectiveSalesUserId}"`;
                let depthQuery = hierarchyPath ? `(d.materialized_path like "%${hierarchyPath}%" and d.materialized_path_depth >= ${(hierarchyUser?.materialized_path_depth || 0)} or ${sales_query})` : `${sales_query}`;
                where.push([depthQuery, '', null]);
                // let resolvedDsaId = req?.loggedInUser?.dsa_id || null;
                // if (!resolvedDsaId && req?.loggedInUser?.userPhone) {
                //     const dsaByPhone = await DSAService.getBHVendors(req.loggedInUser.userPhone);
                //     const fallbackHierarchyDsa = dsaByPhone?.find((item) => item?.dsa_mobile_number === req.loggedInUser.userPhone) || null;
                //     resolvedDsaId = fallbackHierarchyDsa?.dsa_id || null;
                // }
                // let hierarchyQuery = resolvedDsaId
                //     ? `(d.dsa_id = "${resolvedDsaId}" or d.materialized_path like "%${resolvedDsaId}%" or ${sales_query})`
                //     : `${sales_query}`;
                // where.push([hierarchyQuery, '', null]);
                childPhones = null;
            };

            if (sales_query) where.push([sales_query_where, '', null]);
            if (product) where.push(['pl.product_id', ` = '${product}' `, null]);

            // exact-match filters
            const exactFilters = [
                [sp_email_filter, 'rm.sp_email', sp_email_filter],
                [loan_apac_ref_los_number_filter, 'pl.loan_apac_ref_los_number', loan_apac_ref_los_number_filter],
                [loan_reference_id_filter, 'pl.loan_reference_id', loan_reference_id_filter],
                [sp_name_filter, 'rm.sp_name', sp_name_filter],
                [sp_mobile_filter, 'rm.sp_mobile', sp_mobile_filter],
                [claim_status_filter, 'pl.claim_status', claim_status_filter],
            ];
            for (const [cond, col, val] of exactFilters)
                if (cond) where.push([col, ` = '${val}' `, null]);

            // LIKE filters
            const likeFilters = [
                [ifsc_code_filter, 'bank.ifsc_code'],
                [branch_name_filter, 'bank.branch_name'],
                [application_id_filter, 'pl.application_id'],
                [external_id_filter, 'pl.external_id'],
                [application_ref_filter, 'pl.application_ref'],
                [customer_full_name_filter, 'c.full_name'],
                [status_description_filter, 'pl.status_description'],
                [bh_name_filter, 'bh.full_name'],
                [permanent_account_number_filter, 'c.permanent_account_number'],
                [customer_mobile_number_filter, 'c.customer_mobile_number'],
                [customer_email_filter, 'c.email_address'],
                [partner_name_filter, 'd.full_name'],
                [partner_mobile_filter, 'd.dsa_mobile_number'],
                [loan_tenure_filter, 'pl.loan_tenure'],
                [disbursed_loan_amount_filter, 'pl.disbursed_loan_amount'],
                [applied_loan_amount_filter, 'pl.applied_loan_amount'],
                [status_filter, 'pl.status'],
                [sub_status_filter, 'pl.sub_status'],
                [hierarchy_crm_filter, 'd.hierarchy_crm'],
                [stage_filter, 'pl.stage'],
                [sub_stage_filter, 'pl.sub_stage'],
                // utm
                [utm_source_filter, 'utm.utm_source'],
                [utm_medium_filter, 'utm.utm_medium'],
                [utm_campaign_filter, 'utm.utm_campaign'],
                [utm_content_filter, 'utm.utm_content'],
                [utm_channel_filter, 'utm.utm_channel'],
                [source_from_filter, 'utm.source_from'],
                [page_source_filter, 'utm.page_source'],
                [utm_term_filter, 'utm.utm_term'],
                [utm_id_filter, 'utm.utm_id'],
                [ad_group_id_filter, 'utm.adgroupid'],
                [campaign_id_filter, 'utm.campaignid'],
                [ad_filter, 'utm.ad'],
                [mt_filter, 'utm.mt'],
                [adpos_filter, 'utm.adpos'],
                [gad_filter, 'utm.gad'],
                [gclid_filter, 'utm.gclid'],
                [fbclid_filter, 'utm.fbclid'],
                [utm_main_source_filter, 'utm.utm_main_source'],
                [utm_device_filter, 'utm.utm_device'],
                [utm_adgroup_filter, 'utm.utm_adgroup'],
            ];
            for (const [cond, col] of likeFilters)
                if (cond) where.push([col, ` like '%${cond}%' `, null]);

            // LAS has no offered_loan_tenure on meta (always NULL in list SQL)
            if (offered_loan_tenure_filter && loan_type !== "loan_against_security") {
                where.push(['plm.offered_loan_tenure', ` like '%${offered_loan_tenure_filter}%' `, null]);
            }

            // LAS stores city/state on the application row (no ru_customer_addresses join)
            if (city_filter) {
                where.push([
                    loan_type === "loan_against_security" ? "pl.city" : "rca.city",
                    ` like '%${city_filter}%' `,
                    null,
                ]);
            }
            if (pin_code_filter) {
                where.push([
                    loan_type === "loan_against_security"
                        ? "CONCAT(IFNULL(pl.city,''), IFNULL(pl.state,''))"
                        : "rca.pin_code",
                    ` like '%${pin_code_filter}%' `,
                    null,
                ]);
            }

            // date-range filters
            if (startDateFilter || endDateFilter)
                where.push(['DATE(plm.disbursed_date)', ` between DATE("${startDateFilter}") and DATE("${endDateFilter}")`, null]);
            if (startDateFilterLogin)
                where.push(['DATE(pl.created_at)', ` between DATE("${startDateFilterLogin}") and DATE("${endDateFilterLogin}")`, null]);
            if (startDateFilterUpdate)
                where.push(['DATE(pl.updated_at)', ` between DATE("${startDateFilterUpdate}") and DATE("${endDateFilterUpdate}")`, null]);


            // MUI X DataGrid filterModel — same pattern as getLeadForms / getNetsuiteBankList
            if (filterModel && filterModel.items.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getApplicationsByProductAndLoanTypeFieldMapping, operatorHandlers);

                if (whereFilterArray && whereFilterArray.length > 0) {
                    const filters = whereFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    const whereFilterQuery = filters.join(logicOp);
                    if (whereFilterQuery) {
                        where.push([`(${whereFilterQuery})`, '', null]);
                    }
                }
            }

            // Which joins the count query needs — known here since we built the where array.
            const countJoins = {
                bh: !!bh_name_filter,
                c: !!(customer_full_name_filter || customer_mobile_number_filter || customer_email_filter || permanent_account_number_filter),
                plm: !!(
                    (offered_loan_tenure_filter && loan_type !== "loan_against_security")
                    || startDateFilter
                    || endDateFilter
                ),
                rm: !!(sp_email_filter || sp_name_filter || sp_mobile_filter),
                bank: !!(ifsc_code_filter || branch_name_filter),
                // LAS city/pin live on pl.*; other loan types need ru_customer_addresses
                rca: !!(city_filter || pin_code_filter) && loan_type !== "loan_against_security",
                utm: where.some(w => w[0]?.includes('utm.')),
            };
            let user = await DSAService.getApplicationsByProductAndLoanType(loan_type, count_only, where, pageNumber * pageSize, pageSize, sales_query, dsa_mobile_number, false, countJoins);
            ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {
        console.log(err);
        console.log("This is the error we got ", err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllApplicationsExternal = async (req, res) => {
    try {
        const payload = req.body || {};
        const loanValidationPayload = {
            ...payload,
            loan_type: payload?.loan_type || "all",
        };
        const ccValidationPayload = {
            pageNumber: payload?.pageNumber,
            pageSize: payload?.pageSize,
            count_only: payload?.count_only,
            search: payload?.search,
            is_export: payload?.is_export,
            application_id_filter: payload?.application_id_filter,
            business_head_name_filter: payload?.business_head_name_filter,
            dsa_name_filter: payload?.dsa_name_filter,
            dsa_mobile_number_filter: payload?.dsa_mobile_number_filter,
            customer_name_filter: payload?.customer_name_filter,
            permanent_account_number_filter: payload?.permanent_account_number_filter,
            mobile_number_filter: payload?.mobile_number_filter,
            stage_filter: payload?.stage_filter,
            sub_stage_filter: payload?.sub_stage_filter,
            status_filter: payload?.status_filter,
            product: payload?.product,
            startDateFilter: payload?.startDateFilter,
            endDateFilter: payload?.endDateFilter,
            external_id_filter: payload?.external_id_filter,
            status_description_filter: payload?.status_description_filter,
            customer_id: payload?.customer_id,
            city_filter: payload?.city_filter,
            pin_code_filter: payload?.pin_code_filter,
            filterModel: payload?.filterModel,
            logicOperator: payload?.logicOperator,
            product_description_filter: payload?.product_description_filter,
        };

        const { error: loanError } = DSAValidationV1.getApplicationsByProductAndLoanType.validate(loanValidationPayload);
        if (loanError) {
            return ResHelper.apiResponse(res, false, _.startCase(loanError.message), 400, {}, "");
        }
        const { error: ccError } = DSAValidationV1.getAllCCApplications.validate(ccValidationPayload);
        if (ccError) {
            return ResHelper.apiResponse(res, false, _.startCase(ccError.message), 400, {}, "");
        }

        let {
            loan_apac_ref_los_number_filter, startDateFilterUpdate, endDateFilterUpdate, loan_reference_id_filter,
            application_ref_filter, utm_source_filter, utm_medium_filter, utm_campaign_filter, utm_content_filter, utm_channel_filter,
            utm_term_filter, utm_id_filter, ad_group_id_filter, campaign_id_filter, ad_filter, mt_filter, adpos_filter,
            gad_filter, gclid_filter, utm_main_source_filter, utm_device_filter, utm_adgroup_filter, city_filter,
            pin_code_filter, claim_status_filter, ifsc_code_filter, branch_name_filter, sub_status_filter, sp_name_filter,
            sp_email_filter, sp_mobile_filter, dsa_mobile_number, loan_type, product, count_only, pageNumber, pageSize,
            startDateFilter, endDateFilter, startDateFilterLogin, endDateFilterLogin, application_id_filter,
            external_id_filter, bh_name_filter, customer_full_name_filter, permanent_account_number_filter,
            customer_mobile_number_filter, customer_email_filter, partner_name_filter, partner_mobile_filter,
            loan_tenure_filter, disbursed_loan_amount_filter, applied_loan_amount_filter, status_filter, stage_filter,
            sub_stage_filter, status_description_filter, offered_loan_tenure_filter, hierarchy_crm_filter, source_from_filter,
            page_source_filter, filterModel, logicOperator, customer_id, search, business_head_name_filter,
            dsa_name_filter, dsa_mobile_number_filter, customer_name_filter, mobile_number_filter,
            product_description_filter
        } = loanValidationPayload;

        loan_type = loan_type || "all";
        pageNumber = pageNumber || 0;
        pageSize = pageSize || 100;

        let loanWhere = [];
        let ccWhere = [];
        let ccSearchList = [];

        let hierarchyUser = req?.loggedInUser;
        let effectiveSalesUserId = req?.loggedInUser?.id;
        let childPhones = null;
        let sales_query = null;
        let sales_query_where = null;

        if (!req?.loggedInUser?.role) {
            if (!dsa_mobile_number) {
                return ResHelper.apiResponse(res, false, "DSA Mobile Number is mandatory.", 400, {}, "");
            }
        } else {
            let all_privilege = ["HR", "VERIFICATION_AGENCY", "CEO"];
            let role = req?.loggedInUser?.role;

            if (isBackendAccessRole(role)) {
                if (!req?.loggedInUser?.parentEmail) {
                    return ResHelper.apiResponse(res, false, "This User Does Not Have Any Parent", 400, {}, "");
                }
                const parentUser = await UserService.findUserByPhoneOrEmail(req.loggedInUser.parentEmail, req.loggedInUser.parentEmail);
                if (!parentUser) {
                    return ResHelper.apiResponse(res, false, "This User Does Not Have Any Parent", 400, {}, "");
                }
                hierarchyUser = parentUser;
                effectiveSalesUserId = parentUser?.id || effectiveSalesUserId;
            }

            if (!all_privilege?.includes(role)) {
                childPhones = true;
            }
        }

        if (req?.loggedInUser?.role) {
            let data = getHierarchySalesPerson(hierarchyUser, "d");
            sales_query = data?.sales_query || null;
            sales_query_where = data?.sales_query_where || null;
        }

        childPhones = !sales_query ? childPhones : null;
        if (childPhones) {
            const hierarchyPath = hierarchyUser?.materialized_path || hierarchyUser?.dsa_id || null;
            let salesQuery = `d.salesperson_id = "${effectiveSalesUserId}"`;
            let depthQuery = hierarchyPath
                ? `(d.materialized_path like "%${hierarchyPath}%" and d.materialized_path_depth >= ${(hierarchyUser?.materialized_path_depth || 0)} or ${salesQuery})`
                : `${salesQuery}`;
            loanWhere.push([depthQuery, '', null]);
            childPhones = null;
        }

        if (sales_query) loanWhere.push([sales_query_where, '', null]);
        if (product) loanWhere.push(['pl.product_id', ` = '${product}' `, null]);

        // product_description is enriched from ru_loans_products.product_name — resolve matching product IDs
        if (product_description_filter) {
            const matchedProducts = await DSAService.getAllCCProducts(
                ` WHERE (p.product_name LIKE '%${product_description_filter}%' OR p.product_description LIKE '%${product_description_filter}%') `
            );
            const matchedIds = (matchedProducts || []).map((p) => p.id).filter((id) => id != null);
            if (matchedIds.length) {
                loanWhere.push([`pl.product_id IN (${matchedIds.join(",")})`, "", null]);
                ccWhere.push([`cc.product_id IN (${matchedIds.join(",")})`, "", null]);
            } else {
                loanWhere.push(["1=0", "", null]);
                ccWhere.push(["1=0", "", null]);
            }
        }

        const exactFilters = [
            [sp_email_filter, 'rm.sp_email', sp_email_filter],
            [loan_apac_ref_los_number_filter, 'pl.loan_apac_ref_los_number', loan_apac_ref_los_number_filter],
            [loan_reference_id_filter, 'pl.loan_reference_id', loan_reference_id_filter],
            [sp_name_filter, 'rm.sp_name', sp_name_filter],
            [sp_mobile_filter, 'rm.sp_mobile', sp_mobile_filter],
            [claim_status_filter, 'pl.claim_status', claim_status_filter],
        ];
        for (const [cond, col, val] of exactFilters) if (cond) loanWhere.push([col, ` = '${val}' `, null]);

        const likeFilters = [
            [ifsc_code_filter, 'bank.ifsc_code'], [branch_name_filter, 'bank.branch_name'],
            [external_id_filter, 'pl.external_id'],
            [application_ref_filter, 'pl.application_ref'],
            [customer_full_name_filter, 'c.full_name'], [status_description_filter, 'pl.status_description'],
            [offered_loan_tenure_filter, 'plm.offered_loan_tenure'], [bh_name_filter, 'bh.full_name'],
            [permanent_account_number_filter, 'c.permanent_account_number'], [customer_mobile_number_filter, 'c.customer_mobile_number'],
            [customer_email_filter, 'c.email_address'], [partner_name_filter, 'd.full_name'],
            [partner_mobile_filter, 'd.dsa_mobile_number'], [loan_tenure_filter, 'pl.loan_tenure'],
            [disbursed_loan_amount_filter, 'pl.disbursed_loan_amount'], [applied_loan_amount_filter, 'pl.applied_loan_amount'],
            [status_filter, 'pl.status'], [sub_status_filter, 'pl.sub_status'], [hierarchy_crm_filter, 'd.hierarchy_crm'],
            [stage_filter, 'pl.stage'], [sub_stage_filter, 'pl.sub_stage'], [city_filter, 'rca.city'],
            [pin_code_filter, 'rca.pin_code'], [utm_source_filter, 'utm.utm_source'], [utm_medium_filter, 'utm.utm_medium'],
            [utm_campaign_filter, 'utm.utm_campaign'], [utm_content_filter, 'utm.utm_content'],
            [utm_channel_filter, 'utm.utm_channel'], [source_from_filter, 'utm.source_from'], [page_source_filter, 'utm.page_source'],
            [utm_term_filter, 'utm.utm_term'], [utm_id_filter, 'utm.utm_id'], [ad_group_id_filter, 'utm.adgroupid'],
            [campaign_id_filter, 'utm.campaignid'], [ad_filter, 'utm.ad'], [mt_filter, 'utm.mt'],
            [adpos_filter, 'utm.adpos'], [gad_filter, 'utm.gad'], [gclid_filter, 'utm.gclid'],
            [utm_main_source_filter, 'utm.utm_main_source'], [utm_device_filter, 'utm.utm_device'],
            [utm_adgroup_filter, 'utm.utm_adgroup'],
        ];
        for (const [cond, col] of likeFilters) if (cond) loanWhere.push([col, ` like '%${cond}%' `, null]);

        // application_id_filter (direct payload param) also matches application_ref, since the
        // same value can be known/entered as either identifier for a loan application.
        if (application_id_filter) {
            loanWhere.push([`(pl.application_id like '%${application_id_filter}%' OR pl.application_ref like '%${application_id_filter}%')`, '', null]);
        }

        if (startDateFilter || endDateFilter) {
            loanWhere.push(['DATE(plm.disbursed_date)', ` between DATE("${startDateFilter}") and DATE("${endDateFilter}")`, null]);
        }
        if (startDateFilterLogin) {
            loanWhere.push(['DATE(pl.created_at)', ` between DATE("${startDateFilterLogin}") and DATE("${endDateFilterLogin}")`, null]);
        }
        if (startDateFilterUpdate) {
            loanWhere.push(['DATE(pl.updated_at)', ` between DATE("${startDateFilterUpdate}") and DATE("${endDateFilterUpdate}")`, null]);
        }

        if (filterModel && filterModel.items.length > 0) {
            const operatorHandlers = CustomOperatorHandlers();
            const loanFilterArray = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getApplicationsByProductAndLoanTypeFieldMapping, operatorHandlers);
            if (loanFilterArray && loanFilterArray.length > 0) {
                const filters = loanFilterArray
                    .map((item) => {
                        const [field, op, val] = item;
                        // an application_id filterModel entry (e.g. MUI grid "contains") should
                        // also match application_ref, so OR both columns with the same op/val.
                        if (field === 'pl.application_id') {
                            const idClause = formatGetLeadFormsFilterClause('pl.application_id', op, val);
                            const refClause = formatGetLeadFormsFilterClause('pl.application_ref', op, val);
                            if (idClause && refClause) return `(${idClause} OR ${refClause})`;
                            return idClause || refClause;
                        }
                        return formatGetLeadFormsFilterClause(field, op, val);
                    })
                    .filter(Boolean);
                const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                const whereFilterQuery = filters.join(logicOp);
                if (whereFilterQuery) {
                    loanWhere.push([`(${whereFilterQuery})`, '', null]);
                }
            }
        }

        const countJoins = {
            bh: !!bh_name_filter,
            c: !!(
                customer_full_name_filter ||
                customer_mobile_number_filter ||
                customer_email_filter ||
                permanent_account_number_filter ||
                filterModel?.items?.some((item) =>
                    ["customer_email", "customer_full_name", "customer_mobile_number", "permanent_account_number"].includes(item?.field)
                )
            ),
            plm: !!(offered_loan_tenure_filter || startDateFilter || endDateFilter),
            rm: !!(sp_email_filter || sp_name_filter || sp_mobile_filter),
            bank: !!(ifsc_code_filter || branch_name_filter),
            rca: !!(city_filter || pin_code_filter),
            utm: loanWhere.some(w => w[0]?.includes('utm.')),
        };

        let ccChildPhones = null;
        let send_combined_count = true;
        let all_privilege_cc = ["HR", "VERIFICATION_AGENCY", "CEO"];
        let role_cc = req?.loggedInUser?.role;
        if (!all_privilege_cc?.includes(role_cc)) {
            ccChildPhones = Boolean(role_cc == "CEO") ? "9987884000" : req?.loggedInUser?.userPhone;
        }
        if (req?.dsa?.dsa_mobile_number) {
            ccChildPhones = req?.dsa?.dsa_mobile_number;
        }

        if (external_id_filter) ccWhere.push(['cc.external_id', ' like', `%${external_id_filter}%`]);
        if (customer_id) ccWhere.push(['cc.customer_id', ' =', customer_id]);
        if (status_description_filter) ccWhere.push(['cc.status_description', ' like', `%${status_description_filter}%`]);
        if (application_id_filter) ccWhere.push(['cc.application_id', ' like', `%${application_id_filter}%`]);
        if (business_head_name_filter || bh_name_filter) ccWhere.push(['bh.full_name', ' like', `%${business_head_name_filter || bh_name_filter}%`]);
        if (dsa_name_filter || partner_name_filter) ccWhere.push(['d.full_name', ' like', `%${dsa_name_filter || partner_name_filter}%`]);
        if (dsa_mobile_number_filter || partner_mobile_filter) ccWhere.push(['d.dsa_mobile_number', ' like', `%${dsa_mobile_number_filter || partner_mobile_filter}%`]);
        if (customer_name_filter || customer_full_name_filter) ccWhere.push(['c.full_name', ' like', `%${customer_name_filter || customer_full_name_filter}%`]);
        if (permanent_account_number_filter) ccWhere.push(['c.permanent_account_number', ' like', `%${permanent_account_number_filter}%`]);
        if (mobile_number_filter || customer_mobile_number_filter) ccWhere.push(['c.customer_mobile_number', ' like', `%${mobile_number_filter || customer_mobile_number_filter}%`]);
        if (stage_filter) ccWhere.push(['cc.stage', ' like', `%${stage_filter}%`]);
        if (sub_stage_filter) ccWhere.push(['cc.sub_stage', ' like', `%${sub_stage_filter}%`]);
        if (status_filter) ccWhere.push(['cc.status', ' like', `%${status_filter}%`]);
        if (product) ccWhere.push(['cc.product_id', ' = ', product]);
        if (startDateFilter) ccWhere.push(['date(cc.created_at)', ` between date("${startDateFilter}") and date ("${endDateFilter}") `, ``]);
        if (city_filter) ccWhere.push(['ca.city', ' like', `%${city_filter}%`]);
        if (pin_code_filter) ccWhere.push(['ca.pin_code', ' like', `%${pin_code_filter}%`]);

        if (search) {
            ccSearchList.push(['cc.application_id', 'like', `%${search}%`]);
            ccSearchList.push(['c.customer_mobile_number', 'like', `%${search}%`]);
            ccSearchList.push(['c.permanent_account_number', 'like', `%${search}%`]);
        }

        if (filterModel && filterModel.items.length > 0) {
            const operatorHandlers = CustomOperatorHandlers();
            const { matched: ccApacFilterItems, rest: ccOtherFilterItems } = partitionFilterModelItems(
                filterModel,
                LOAN_APAC_REF_FILTER_FIELDS
            );
            // CC tables have no loan_tenure / offered_loan_tenure — keep those filters on loans only.
            const ccSupportedFilterItems = ccOtherFilterItems.filter(
                (item) => !['loan_tenure', 'offered_loan_tenure'].includes(item?.field)
            );

            if (ccSupportedFilterItems.length > 0) {
                const ccFilterArray = CreateWhereQueryFilter(
                    { items: ccSupportedFilterItems },
                    ApiFieldMappings.getAllCCApplicationsFieldMapping,
                    operatorHandlers
                );
                if (ccFilterArray && ccFilterArray.length > 0) {
                    const filters = ccFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    const whereFilterQuery = filters.join(logicOp);
                    if (whereFilterQuery) {
                        ccWhere.push([`(${whereFilterQuery})`, '', null]);
                    }
                }
            }

            const ccApacWhereClause = buildLoanApacRefFilterWhereClause(
                ccApacFilterItems,
                logicOperator,
                ApiFieldMappings.getApplicationsByProductAndLoanTypeFieldMapping
            );
            if (ccApacWhereClause) {
                ccWhere.push([ccApacWhereClause, '', null]);
            }
        }

        const start = pageNumber * pageSize;
        const fetchLimit = start + pageSize;

        // loan_type controls which sources are queried:
        // - "all"          → all loan types + credit card
        // - "credit_card"  → credit card only
        // - e.g. "personal_loan" → that loan type only (no CC)
        const includeCreditCard = loan_type === "all" || loan_type === "credit_card";
        const includeLoans = loan_type !== "credit_card";
        const loanTypeForQuery = loan_type === "all" ? "all" : loan_type;

        const emptyResult = { lntApplications: [], totalCount: 0 };

        const [loanCount, ccCount] = await Promise.all([
            includeLoans
                ? DSAService.getApplicationsByProductAndLoanType(loanTypeForQuery, true, loanWhere, 0, 1, sales_query, dsa_mobile_number, false, countJoins)
                : Promise.resolve(emptyResult),
            includeCreditCard
                ? DSAService.getAllCCApplications(true, ccWhere, ccSearchList, 0, 1, ccChildPhones, send_combined_count)
                : Promise.resolve(emptyResult),
        ]);

        const totalCount = Number(loanCount?.totalCount || 0) + Number(ccCount?.totalCount || 0);
        if (count_only) {
            return ResHelper.apiResponse(res, true, "Success", 200, { lntApplications: [], totalCount }, "");
        }

        const [loanData, ccData] = await Promise.all([
            includeLoans
                ? DSAService.getApplicationsByProductAndLoanType(loanTypeForQuery, false, loanWhere, 0, fetchLimit, sales_query, dsa_mobile_number, false, countJoins)
                : Promise.resolve(emptyResult),
            includeCreditCard
                ? DSAService.getAllCCApplications(false, ccWhere, ccSearchList, 0, fetchLimit, ccChildPhones, send_combined_count)
                : Promise.resolve(emptyResult),
        ]);

        const loans = (loanData?.lntApplications || []).map((app) => ({
            ...app,
            application_type: "loan",
            loan_type: app?.loan_type || app?.retail_category || loanTypeForQuery,
        }));

        const creditCards = (ccData?.lntApplications || []).map((app) => ({
            ...app,
            application_type: "credit_card",
            loan_type: "credit_card",
            retail_category: "credit_card",
        }));

        const lntApplications = [...loans, ...creditCards]
            .sort((a, b) => new Date(b?.created_at || 0) - new Date(a?.created_at || 0))
            .slice(start, start + pageSize);

        return ResHelper.apiResponse(res, true, "Success", 200, { lntApplications, totalCount }, "");
    } catch (err) {
        logger.error(err);
        console.log("Error in All Applications ", err)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const editSigningPayout = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.editSigningPayout.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        let { dsa_id, assigning_payout_percentage } = req.body;
        const userId = req?.loggedInUser?.id || req?.dsa?.dsa_id || null;

        const dsa = await DSAService.getDsaById(dsa_id);
        if (!dsa) {
            return ResHelper.apiResponse(res, false, " Dsa Not Found ", 400, {}, "");
        }

        const global_payouts_percentage = dsa?.global_payouts_percentage || 50;
        const updateGlobalPayoutPercentage = global_payouts_percentage > assigning_payout_percentage;

        // ── Writes ────────────────────────────────────────────────────────────
        await DSAService.editSigningPayout(dsa_id, assigning_payout_percentage, updateGlobalPayoutPercentage);

        if (updateGlobalPayoutPercentage) {
            await DSAService.updateDsaPayoutList(dsa_id, assigning_payout_percentage);
        }

        // Cap autonomous payouts to new payout capping if they exceed it
        const autonomousSettings = await DSAService.getDsaAutonomousSettingsByDsaId(dsa_id);
        let autonomousDiff = [];
        // Update autonomous payout list only if same day billing is enabled
        if (autonomousSettings && dsa?.is_same_day_billing_enabled) {
            const securedExceeds = autonomousSettings.autonomous_secured_payout != null &&
                autonomousSettings.autonomous_secured_payout > assigning_payout_percentage;
            const unsecuredExceeds = autonomousSettings.autonomous_unsecured_payout != null &&
                autonomousSettings.autonomous_unsecured_payout > assigning_payout_percentage;

            if (securedExceeds || unsecuredExceeds) {
                const cappedSecured = securedExceeds ? assigning_payout_percentage : autonomousSettings.autonomous_secured_payout;
                const cappedUnsecured = unsecuredExceeds ? assigning_payout_percentage : autonomousSettings.autonomous_unsecured_payout;

                await DSAService.saveDsaAutonomousPaymentSettings({
                    dsa_id,
                    autonomous_secured_payout: cappedSecured,
                    autonomous_unsecured_payout: cappedUnsecured,
                    global_autonomous_disb_date_from: autonomousSettings.global_autonomous_disb_date_from,
                    global_autonomous_disb_date_to: autonomousSettings.global_autonomous_disb_date_to,
                });

                await DSAService.updateDsaAutonomousPayoutList(
                    dsa_id,
                    cappedSecured,
                    cappedUnsecured,
                    autonomousSettings.global_autonomous_disb_date_from,
                    autonomousSettings.global_autonomous_disb_date_to
                );

                autonomousDiff = jsonDifference(
                    { autonomous_secured_payout: autonomousSettings.autonomous_secured_payout, autonomous_unsecured_payout: autonomousSettings.autonomous_unsecured_payout },
                    { autonomous_secured_payout: cappedSecured, autonomous_unsecured_payout: cappedUnsecured }
                );
            }
        }

        // ── Single combined audit log ─────────────────────────────────────────
        const payoutDiff = jsonDifference(
            { assigning_payout_percentage: dsa?.assigning_payout_percentage, global_payouts_percentage },
            { assigning_payout_percentage, global_payouts_percentage: assigning_payout_percentage }
        );
        await ApplicationLogServices.bulkCreate([...payoutDiff, ...autonomousDiff], dsa_id, "dsa", userId);

        try {
            await KafkaServices.connectKafkaProducer();
            const changes = { assigning_payout_percentage };
            if (updateGlobalPayoutPercentage) changes.global_payouts_percentage = assigning_payout_percentage;
            const evt = new KafkaServices.VendorSnapshotEvent('GLOBAL_PAYOUT_UPDATED', dsa_id, changes, userId);
            await KafkaServices.sendToKafkaVendorSnapshot(evt);
        } catch (kafkaErr) {
            logger.error('VendorSnapshotEvent Kafka failed in editSigningPayout', kafkaErr);
        }

        return ResHelper.apiResponse(res, true, "Success", 201, {}, "");
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};


const getAllPlForDashboard = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getAllPlForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { productId, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, level, loan_type } = req.body;
            loan_type = loan_type || "pl";
            // req.loggedInUser.userPhone = "9987884000";

            let finalArray = [];
            let allDsa = await DSAService.getAllDsaForMis(req?.loggedInUser?.userPhone, level);
            let applicationData = await DSAService.getAllPlDashboardByPhoneNumbers(productId, req?.loggedInUser?.userPhone, false, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter, loan_type);
            finalArray = generateNestedObjects(mergeArrays(allDsa, applicationData));
            finalArray = getChildLevels(finalArray, req?.loggedInUser?.userPhone)
            // finalArray = getChildLevels(finalArray, "7506439909");
            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const toggleNotificationDsa = async (req, res) => {
    try {
        const { error } = await DSAValidationV1.toggleNotificationDsa.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { dsa_id, ...rest } = req?.body;
            const setClause = Object.entries(rest)
                .map(([key, value]) => `${key} = ${value}`)
                .join(', ');

            let data = await DSAService?.toggleNotificationDsa(dsa_id, setClause);
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllPayoutClaimForDashboard = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getAllPayoutClaimForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter } = req.body;
            // req.loggedInUser.userPhone = "9987884000";

            let finalArray = [];
            let allDsa = await DSAService.getAllDsaForMis(req?.loggedInUser?.userPhone);
            let applicationData = await DSAService.getPayoutClaimDashboardByPhoneNumbers(req?.loggedInUser?.userPhone, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter);
            finalArray = generateNestedObjects(mergeArrays(allDsa, applicationData));
            finalArray = getChildLevels(finalArray, req?.loggedInUser?.userPhone)
            // finalArray = getChildLevels(finalArray, "7506439909");
            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllCCForDashBoard = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getAllCCForDashBoard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { productId, startDateFilter, endDateFilter, level } = req.body;
            // req.loggedInUser.userPhone = "9987884000";

            let finalArray = [];
            let allDsa = await DSAService.getAllDsaForMis(req?.loggedInUser?.userPhone, level);
            let applicationData = await DSAService.getAllCCForDashBoard(productId, req?.loggedInUser?.userPhone, false, startDateFilter, endDateFilter);
            finalArray = generateNestedObjects(mergeArrays(allDsa, applicationData));
            finalArray = getChildLevels(finalArray, req?.loggedInUser?.userPhone)
            // finalArray = getChildLevels(finalArray, "7506439909");
            ResHelper.apiResponse(res, true, "Success", 200, { data: finalArray }, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getYearlyPlReport = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getYearlyPlReport.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { productId, loan_type } = req.body;
            const data = await DSAService.getYearlyPlReport(req?.loggedInUser?.userPhone, productId, loan_type);

            // format data for frontend
            const result = {};
            data.forEach(item => {
                const monthName = item.month !== null ? getMonthName(item.month) : "Unknown"; // Assuming getMonthName function returns month names
                const mainObj = [{
                    dsa: req?.loggedInUser?.userName,
                    phone: req?.loggedInUser?.userPhone,
                    total_rejected: item.total_rejected,
                    total_disbursed: item.total_disbursed,
                    total_approved: item.total_approved,
                    total_in_progress: item.total_in_progress,
                    total_disbursed_amount: item.total_disbursed_amount,
                    total_approved_amount: item.total_approved_amount
                }];
                result[monthName] = {
                    disbursed: mainObj,
                    login: mainObj
                }
            });
            function getMonthName(monthNumber) {
                const months = [
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"
                ];
                return months[monthNumber - 1];
            };

            ResHelper.apiResponse(res, true, "Success", 201, result, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getYearlyPayoutClaimReport = async (req, res) => {
    try {
        const data = await DSAService.getYearlyPayoutClaimReport(req?.loggedInUser?.userPhone);

        // format data for frontend
        const result = {};
        data.forEach(item => {
            const monthName = item.month !== null ? getMonthName(item.month) : "Unknown"; // Assuming getMonthName function returns month names
            const mainObj = [{
                dsa: req?.loggedInUser?.userName,
                phone: req?.loggedInUser?.userPhone,
                total_rejected: item.total_rejected,
                total_disbursed: item.total_disbursed,
                total_approved: item.total_approved,
                total_in_progress: item.total_in_progress,
                total_disbursed_amount: item.total_disbursed_amount,
                total_approved_amount: item.total_approved_amount,
                ...item
            }];
            result[monthName] = {
                disbursed: mainObj,
                login: mainObj
            }
        });
        function getMonthName(monthNumber) {
            const months = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ];
            return months[monthNumber - 1];
        };

        ResHelper.apiResponse(res, true, "Success", 201, result, "");
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getYearlyCCReport = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getYearlyPlReport.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { productId } = req.body;
            const data = await DSAService.getYearlyCCReport(req?.loggedInUser?.userPhone, productId);

            // format data for frontend
            const result = {};
            data.forEach(item => {
                const monthName = item.month !== null ? getMonthName(item.month) : "Unknown"; // Assuming getMonthName function returns month names
                const mainObj = [{
                    dsa: req?.loggedInUser?.userName,
                    phone: req?.loggedInUser?.userPhone,
                    total_rejected: item.total_rejected,
                    total_disbursed: item.total_disbursed,
                    total_approved: item.total_approved,
                    total_in_progress: item.total_in_progress,
                    total_disbursed_amount: item.total_disbursed_amount,
                    total_approved_amount: item.total_approved_amount
                }];
                result[monthName] = { data: mainObj }
            });
            function getMonthName(monthNumber) {
                const months = [
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"
                ];
                return months[monthNumber - 1];
            };

            ResHelper.apiResponse(res, true, "Success", 201, result, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const withdrawDsaConsent = async (req, res) => {
    try {
        const { error } = DSAValidationV1.withdrawDsaConsent.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { dsa_id, dsa_mobile_number, status, consent_type, reason } = req?.body;
            if (!consent_type) {
                consent_type = !status ? "WITHDRAWN" : "GRANTED";
            };

            let dsa;
            if (dsa_id) {
                dsa = await DSAService.getDsaById(dsa_id);
            } else if (dsa_mobile_number) {
                const dsaByPhone = await DSAService.getDsaByPhone(dsa_mobile_number);
                if (dsaByPhone) {
                    dsa_id = dsaByPhone.customer_id;
                    dsa = await DSAService.getDsaById(dsa_id);
                }
            }

            if (!dsa) {
                return ResHelper.apiResponse(res, false, "DSA Not Found", 400, {}, "");
            };

            try {
                await Promise.race([
                    KafkaServices.connectKafkaProducer(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Kafka connection timeout')), 5000)
                    )
                ]);
            } catch (kafkaError) {
                console.error('Kafka connection failed, proceeding without it:', kafkaError);
                logger.error('Kafka connection failed:', kafkaError);
            };


            await DSAService.withdrawDsaConsent({
                dsa_id,
                phone: dsa?.customer_mobile_number,
                consent_type,
                reason,
                userId: req?.loggedInUser?.id || null
            });


            const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
            const agent = useragent.parse(req.headers['user-agent']);
            const payload = req.body;
            const currentTime = new Date().toISOString();

            const logData = {
                url: fullUrl,
                deviceInfo: {
                    browser: agent?.toAgent(),
                    os: agent?.os?.toString(),
                    platform: agent?.platform
                },
                payload: payload,
                time: currentTime
            };


            const DsaUpdatedDetails = new KafkaServices.EventLogger(
                "dsa_consent_withdrawn",
                `{dsa_mobile_number :${dsa?.customer_mobile_number}",logData : ${JSON.stringify(logData)}}`,
                consent_type === 'WITHDRAWN' ? "Consent Withdrawn" : "Consent Granted",
                dsa_id,
                req?.loggedInUser?.id || null,
                new Date(),
            );
            await KafkaServices.sendToKafkaLoggerService(DsaUpdatedDetails);

            await DSAService.createRuApiLogs({
                dsa_mobile_number: req?.loggedInUser?.userMobile || dsa?.customer_mobile_number || null,
                internal_api: fullUrl,
                payload: JSON.stringify(payload),
                response: "Success",
                headers: JSON.stringify(req?.headers),
                api_type: "Withdraw Consent V1 Direct"
            });

            logger.error(logData);
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    } catch (err) {
        console.log(err);
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getLoginFormForDashboard = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getAllPayoutClaimForDashboard.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter } = req.body;
            // req.loggedInUser.userPhone = "9987884000";

            let finalArray = [];
            let allDsa = await DSAService.getAllDsaForMis(req?.loggedInUser?.userPhone);
            let applicationData = await DSAService.getLoginFormDashboardByPhoneNumbers(req?.loggedInUser?.userPhone, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter);
            finalArray = generateNestedObjects(mergeArrays(allDsa, applicationData));
            finalArray = getChildLevels(finalArray, req?.loggedInUser?.userPhone)
            // finalArray = getChildLevels(finalArray, "7506439909");
            ResHelper.apiResponse(res, true, "Success", 200, finalArray, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getYearlyLogiFormReport = async (req, res) => {
    try {
        const data = await DSAService.getYearlyLogiFormReport(req?.loggedInUser?.userPhone);

        // format data for frontend
        const result = {};
        data.forEach(item => {
            const monthName = item.month !== null ? getMonthName(item.month) : "Unknown"; // Assuming getMonthName function returns month names
            const mainObj = [{
                dsa: req?.loggedInUser?.userName,
                phone: req?.loggedInUser?.userPhone,
                total_rejected: item.total_rejected,
                total_disbursed: item.total_disbursed,
                total_approved: item.total_approved,
                total_in_progress: item.total_in_progress,
                total_disbursed_amount: item.total_disbursed_amount,
                total_approved_amount: item.total_approved_amount
            }];
            result[monthName] = {
                disbursed: mainObj,
                login: mainObj
            }
        });
        function getMonthName(monthNumber) {
            const months = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ];
            return months[monthNumber - 1];
        };

        ResHelper.apiResponse(res, true, "Success", 201, result, "");
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const fetchDigioDoduments = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.fetchDigioDoduments.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { dsa_mobile_number } = req?.body;
            //external request
            let options = {
                'method': 'POST',
                data: { dsaMobileNumber: dsa_mobile_number },
                'url': `https://msdev.ruloans.com/api/dsa/kyc/fetch-digio-documents`,
                headers: {
                    'api-key': process.env.AUTH_KEY_RULOANS_BANK_CLAIM,
                    'Content-Type': 'application/json'
                },
                validateStatus: () => true,
            };
            axios(options)
                .then((response) => {
                    console.log(options, response);
                    const { status, message } = response?.data || {};
                    if (Boolean(status)) {
                        console.log(response.data)
                        ResHelper.apiResponse(res, true, message, 200, response?.data, "");
                    } else {
                        ResHelper.apiResponse(res, false, message, 400, {}, "");
                    }
                })
                .catch((error) => {
                    throw new Error(error);
                });
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getCombinedLoanApplications = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getCombinedLoanApplications.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { is_export, pageNumber, pageSize, startDateFilter, endDateFilter, city_filter, sub_stage_filter, customer_id, application_id_filter, full_name_filter, dsa_mobile_number_filter, loan_type_filter, product_filter, applied_loan_amount_filter, approved_loan_amount_filter, loan_tenure_filter, stage_filter, status_filter, disbursed_loan_amount_filter, startDateDisbursedFilter, endDateDisbursedFilter, state_filter, utm_source, utm_medium, utm_campaign, utm_content, utm_channel, utm_term, utm_id, utm_adgroup, utm_main_source, utm_device, adgroupid, campaignid, ad_group_id, campaign_id, ad, mt, adpos, gad, gclid, fbclid, page_source, source_from } = req.body;
            let all_privilege = ["HR", "VERIFICATION_AGENCY", "CEO"];
            let role = req?.loggedInUser?.role;
            let childPhones = null;

            if (!all_privilege?.includes(role)) {
                childPhones = req.loggedInUser.dsa_id;
                if (!req?.loggedInUser?.dsa_id) {
                    return ResHelper.apiResponse(res, false, "You are not a DSA! Hierarchy Failed!", 400, {}, "");
                };
            };

            if (!pageNumber) {
                pageNumber = 0;
            };
            if (!pageSize) {
                pageSize = 100;
            };

            let where = "";

            if (customer_id) {
                where = checkWhereInQueryString(where);
                where += ` pl.customer_id = '${customer_id}' `;
            };
            if (application_id_filter) {
                where = checkWhereInQueryString(where);
                where += ` pl.application_id like '%${application_id_filter}%' `;
            };
            if (full_name_filter) {
                where = checkWhereInQueryString(where);
                where += ` pl.full_name like '%${full_name_filter}%' `;
            };
            if (dsa_mobile_number_filter) {
                where = checkWhereInQueryString(where);
                where += ` pl.dsa_mobile_number like '%${dsa_mobile_number_filter}%' `;
            };
            if (loan_type_filter) {
                where = checkWhereInQueryString(where);
                where += ` pl.table_name like '%${loan_type_filter}%' `;
            };
            if (product_filter) {
                where = checkWhereInQueryString(where);
                where += ` case when pl.product_id = 0 then null else pl.product_name end like '%${product_filter}%' `;
            };
            if (applied_loan_amount_filter) {
                where = checkWhereInQueryString(where);
                where += ` pl.applied_loan_amount like '%${applied_loan_amount_filter}%' `;
            };
            if (approved_loan_amount_filter) {
                where = checkWhereInQueryString(where);
                where += ` pl.approved_loan_amount like '%${approved_loan_amount_filter}%' `;
            };
            if (loan_tenure_filter) {
                where = checkWhereInQueryString(where);
                where += ` pl.loan_tenure like '%${loan_tenure_filter}%' `;
            };
            if (sub_stage_filter) {
                where = checkWhereInQueryString(where);
                where += ` pl.sub_stage like '%${sub_stage_filter}%' `;
            };
            if (stage_filter) {
                where = checkWhereInQueryString(where);
                where += ` pl.stage like '%${stage_filter}%' `;
            };
            if (status_filter) {
                where = checkWhereInQueryString(where);
                where += ` pl.status like '%${status_filter}%' `;
            };
            if (city_filter) {
                where = checkWhereInQueryString(where);
                where += ` pl.city like '%${city_filter}%' `;
            };
            if (state_filter) {
                where = checkWhereInQueryString(where);
                where += ` pl.state like '%${state_filter}%' `;
            };
            if (disbursed_loan_amount_filter) {
                where = checkWhereInQueryString(where);
                where += ` pl.disbursed_loan_amount like '%${disbursed_loan_amount_filter}%' `;
            };
            if (startDateFilter) {
                where = checkWhereInQueryString(where);
                where += ` DATE(pl.created_at)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") `;
            };
            if (startDateDisbursedFilter) {
                where = checkWhereInQueryString(where);
                where += ` DATE(pl.disbursed_date)  between DATE("${startDateDisbursedFilter}") and DATE("${endDateDisbursedFilter}") `;
            };
            if (childPhones) {
                where = checkWhereInQueryString(where);
                where += ` pl.materialized_path like "%${childPhones}%" `;
            };

            if (utm_source) {
                where = checkWhereInQueryString(where);
                where += ` pl.utm_source LIKE "%${utm_source}%" `;
            };

            if (utm_medium) {
                where = checkWhereInQueryString(where);
                where += ` pl.utm_medium LIKE "%${utm_medium}%" `;
            };

            if (utm_campaign) {
                where = checkWhereInQueryString(where);
                where += ` pl.utm_campaign LIKE "%${utm_campaign}%" `;
            };

            if (utm_content) {
                where = checkWhereInQueryString(where);
                where += ` pl.utm_content LIKE "%${utm_content}%" `;
            };

            if (utm_channel) {
                where = checkWhereInQueryString(where);
                where += ` pl.utm_channel LIKE "%${utm_channel}%" `;
            };

            if (utm_term) {
                where = checkWhereInQueryString(where);
                where += ` pl.utm_term LIKE "%${utm_term}%" `;
            };

            if (utm_id) {
                where = checkWhereInQueryString(where);
                where += ` pl.utm_id LIKE "%${utm_id}%" `;
            };

            if (utm_adgroup) {
                where = checkWhereInQueryString(where);
                where += ` pl.utm_adgroup LIKE "%${utm_adgroup}%" `;
            };

            if (utm_main_source) {
                where = checkWhereInQueryString(where);
                where += ` pl.utm_main_source LIKE "%${utm_main_source}%" `;
            };

            // if (utm_device) {
            //     where = checkWhereInQueryString(where);
            //     where += ` pl.utm_device LIKE "%${utm_device}%" `;
            // };

            const filterAdgroup = adgroupid || ad_group_id;
            if (filterAdgroup) {
                where = checkWhereInQueryString(where);
                where += ` pl.adgroupid LIKE "%${filterAdgroup}%" `;
            };

            const filterCampaign = campaignid || campaign_id;
            if (filterCampaign) {
                where = checkWhereInQueryString(where);
                where += ` pl.campaignid LIKE "%${filterCampaign}%" `;
            };

            if (ad) {
                where = checkWhereInQueryString(where);
                where += ` pl.ad LIKE "%${ad}%" `;
            };

            if (mt) {
                where = checkWhereInQueryString(where);
                where += ` pl.mt LIKE "%${mt}%" `;
            };

            if (adpos) {
                where = checkWhereInQueryString(where);
                where += ` pl.adpos LIKE "%${adpos}%" `;
            };

            if (gad) {
                where = checkWhereInQueryString(where);
                where += ` pl.gad LIKE "%${gad}%" `;
            };

            if (gclid) {
                where = checkWhereInQueryString(where);
                where += ` pl.gclid LIKE "%${gclid}%" `;
            };

            if (fbclid) {
                where = checkWhereInQueryString(where);
                where += ` pl.fbclid LIKE "%${fbclid}%" `;
            };

            if (page_source) {
                where = checkWhereInQueryString(where);
                where += ` pl.page_source LIKE "%${page_source}%" `;
            };

            if (source_from) {
                where = checkWhereInQueryString(where);
                where += ` pl.source_from LIKE "%${source_from}%" `;
            };

            let user = await DSAService.getCombinedLoanApplications(where, pageNumber * pageSize, pageSize, childPhones);

            if (is_export) {
                await ApplicationLogServices?.createExportLog(req);
            };
            ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    } catch (err) {
        console.log("This is Error ", err);
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const reassignCustomerPartner = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.reassignPartner.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { dsaIdArray, partnerPhone } = req.body;
            let message = "Success";
            for (let i = 0; i < dsaIdArray?.length; i++) {
                const { prevData, newData, status } = await DSAService.reassignCustomerPartner(dsaIdArray[i], partnerPhone);
                if (status == "69") {
                    message = "Same Customer and Sales-Person error";
                } else {
                    let { sales_person_mobile1, ...rest1 } = prevData;
                    let { sales_person_mobile, ...rest2 } = newData;
                    let difference = jsonDifference(rest1, rest2);
                    const userId = req?.loggedInUser?.id || null;
                    await ApplicationLogServices.bulkCreate(difference, dsaIdArray[i], "customer", userId);
                }
            }
            let status = message == "Same Customer and Sales-Person error" ? 400 : 201;
            ResHelper.apiResponse(res, true, message, status, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};


const updateLntApplicationById = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.updateLntApplicationById.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            await DSAService.updateLntApplicationById(req?.body);
        }
        ResHelper.apiResponse(res, true, "Success", 200, {}, "");
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const changeDsaEmployeeStatus = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.changeDsaEmployeeStatus.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        const { dsa_id } = req.body;
        const dsa = await DSAService.getDsaById(dsa_id);
        if (!dsa) {
            return ResHelper.apiResponse(res, false, "DSA Not Found", 404, {}, "");
        }
        const data = await DSAService.changeDsaEmployeeStatus(req.body);
        if (!data.updated) {
            return ResHelper.apiResponse(res, false, "DSA Not Found", 404, {}, "");
        }
        ResHelper.apiResponse(res, true, "Success", 200, data, "");
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const updateDsaEmployee = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.updateDsaEmployee.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        const { dsa_id } = req.body;
        const dsa = await DSAService.getDsaById(dsa_id);
        if (!dsa) {
            return ResHelper.apiResponse(res, false, "DSA Not Found", 404, {}, "");
        }
        const data = await DSAService.changeDsaEmployeeStatus(req.body);
        if (!data.updated) {
            return ResHelper.apiResponse(res, false, "DSA Not Found", 404, {}, "");
        }
        ResHelper.apiResponse(res, true, "Success", 200, data, "");
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getUtmJourneyUrl = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getUtmJourneyUrl.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let url = await DSAService.getUtmJourneyUrl(req?.body);
            if (!url) {
                return ResHelper.apiResponse(res, false, "UTM journey url not found!", 400, {}, "");
            };
            ResHelper.apiResponse(res, true, "Success", 200, url, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const updateLoanApplication = async (req, res) => {
    try {
        const { error } = DSAValidationV1.updateLoanApplication.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { status, disbursed_loan_amount, disbursed_date, loan_type, application_id } = req?.body;
            const _loanInfo = getLoanTableInfo(loan_type);
            if (!_loanInfo) return ResHelper.apiResponse(res, false, "Invalid loan type", 400, {}, "");

            if (status == "disbursed" && !Boolean(disbursed_loan_amount && disbursed_date)) {
                return ResHelper.apiResponse(res, false, "Disbursed date and amount are required!", 400, {}, "");
            };

            const old_data = await DSAService.getApplicationUpdateLogs(loan_type, _loanInfo.table_name, application_id);
            await DSAService.updateLoanApplication({ ...req?.body, table: _loanInfo.table_name });
            const new_data = await DSAService.getApplicationUpdateLogs(loan_type, _loanInfo.table_name, application_id);

            let diff = jsonDifference(old_data, new_data);
            await bulkCreate(diff, application_id, 'cc_application', req?.loggedInUser?.id);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const downloadLeadFormSample = async (req, res) => {
    try {
        const { error } = DSAValidationV1.downloadLeadFormSample.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { fileName } = req.body;
            const storagePath = `excel_data/${fileName}`;
            const { link, err } = await readSamplesFromS3(storagePath);
            if (!err) {
                return ResHelper.apiResponse(res, true, "Success", 200, link, "");
            }

            // S3 not found — fallback to sampleTemplates.json
            const templates = require('../../../helpers/constantdata/sampleTemplates.json');
            const template = templates[fileName + "_mis_upload"];
            if (!template) {
                return ResHelper.apiResponse(res, false, "Sample File not Found", 400, {}, "");
            }

            const workbook = xlsx.utils.book_new();
            const worksheet = xlsx.utils.json_to_sheet(template.data);
            xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
            const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            const base64 = buffer.toString('base64');
            const dataUri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;

            return ResHelper.apiResponse(res, true, "Success", 200, dataUri, "");
        }
    }
    catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getRMList = async (req, res) => {

    try {
        const { error } = DSAValidationV1.getRMList.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { applicationId, search, pageNumber, loan_type } = req.body;
            const pageSize = 10;
            const offset = (pageNumber - 1) * pageSize;
            let data = await DSAService.getRMList(loan_type, applicationId, search, pageSize, offset);
            console.log(data)

            if (data) {
                const normalizedData = data ? (Array.isArray(data) ? data : [data]) : [];
                ResHelper.apiResponse(res, true, "Data fetched successfully", 200, normalizedData, "");
            } else {
                ResHelper.apiResponse(res, false, "Data not found", 400, {}, "");
            }
        }

    } catch (err) {
        console.log(err);
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const assignRM = async (req, res) => {
    try {
        const { error } = DSAValidationV1.assignRM.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
            return;
        } else {
            let { loan_type, applicationId, salesPersonId } = req.body;
            const _loanInfo = getLoanTableInfo(loan_type);
            if (!_loanInfo) return ResHelper.apiResponse(res, false, "Invalid loan type", 400, {}, "");

            const old_data = await DSAService.getApplicationUpdateLogs(loan_type, _loanInfo.table_name, applicationId);

            const query = `
            UPDATE ${_loanInfo.meta_prefix}_metas
            SET sales_person_id = '${salesPersonId}'
            WHERE application_id = '${applicationId}';
        `;

            await _db2.query(query);
            const new_data = await DSAService.getApplicationUpdateLogs(loan_type, _loanInfo.table_name, applicationId);
            let diff = jsonDifference(old_data, new_data);
            await bulkCreate(diff, applicationId, 'cc_application', req?.loggedInUser?.id);
            ResHelper.apiResponse(res, true, "Salesperson assigned successfully.", 200, {}, "");
        }

    } catch (err) {
        console.error(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getDsaParentRecursively = async (req, res) => {
    try {
        const { error } = DSAValidationV1.fetchDigioDoduments.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { dsa_mobile_number } = req.body
            const data = await DSAService?.getDsaParentRecursively(dsa_mobile_number, "full_name");
            if (data?.toString()?.length) {
                let business_head = await DSAService?.getBusinessHeadRecursively(dsa_mobile_number);
                const result = data?.length ? `/${data.join('/')}` : null;

                await DSAService?.updateDsaHierarchyString(dsa_mobile_number, result, business_head)
            } else {
                return ResHelper.apiResponse(res, false, "No hierarchy found!", 400, {}, "");
            };
            return ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    }
    catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getLoanDetails = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getLoanDetails.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { loan_type, applicationId } = req.body;
            const data = await DSAService?.getLoanDetails(loan_type, applicationId);
            console.log(data)
            return ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    }
    catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const editLoanDetails = async (req, res) => {
    try {
        const { error } = DSAValidationV1.editLoanDetails.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { applicationId, applied_loan_amount, approved_loan_amount, disbursed_loan_amount, loan_tenure, loan_type, address_id, income_id } = req.body;
            const old_data = await DSAService.getLoanDetails(loan_type, applicationId);

            const data = await DSAService.editLoanDetails(applicationId, applied_loan_amount, approved_loan_amount, disbursed_loan_amount, loan_tenure, loan_type, address_id, income_id);
            const new_data = await DSAService.getLoanDetails(loan_type, applicationId);
            let diff = jsonDifferenceForNestedObjects(old_data, new_data);

            await bulkCreate(diff, applicationId, 'cc_application', req?.loggedInUser?.id);

            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    }
    catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const bulkCalling = async (req, res) => {

    try {
        const { error } = DSAValidationV1.bulkCalling.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { filter, channel } = req.body;
            if (channel == "channel_partners") {
                let users = await DSAService.getDsaUsersListsBulkCalling(filter);
                storeUsersInMongoDB(users);
                ResHelper.apiResponse(res, true, "Success", 200, users, "");
                return

            }
            else if (channel == "customers") {
                let users = await DSAService.getCustomerBulkCalling(filter);
                storeUsersInMongoDB(users);
                ResHelper.apiResponse(res, true, "Success", 200, users, "");
                return
            }
        }
    }
    catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}
const bulkCallingslashrtc = async (req, res) => {
    try {

        const { error } = DSAValidationV1.bulkCallingslashrtc.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }


        const { payload } = req.body;


        const leadData = payload.map(item => ({
            name: item.name,
            phoneNumber: item.phoneNumber,
            email: item.email,
            processId: item.processId,
            leadsetId: item.leadsetId,
            skillName: item.skillName,
            skillGroupName: item.skillGroupName,
        }));


        const body = {
            leadData
        };


        const options = {
            method: 'POST',
            url: 'https://ruloans.slashrtc.in/slashRtc/cloudAuth/auth/createBulkLead',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTE1LCJhY2Nlc3NsZXZlbCI6MiwiYWdlbnROYW1lIjoiUm9oYW4gQmhhZ2RlIiwiYWdlbnRVc2VyTmFtZSI6IlJvaGFuQiIsImVtYWlsIjoiIiwiY3JtX2lkIjoiIiwiaWF0IjoxNzM4MzI3NTQ0LCJleHAiOjE3NDA5MTk1NDR9.ZentpwAC2AEKrw-7ghKpEScJ6cmaliveSTw_nKxSJD8' // Replace this with your actual token
            },
            data: JSON.stringify(body),
            responseType: "text",
            validateStatus: () => true,
        };


        axios(options)
            .then((response) => {
                const { msg, statusCode } = JSON.parse(response?.data);
                if (statusCode === 200) {

                    return ResHelper.apiResponse(res, true, _.startCase(msg), statusCode, JSON.parse(response?.data), "");
                } else {


                    return ResHelper.apiResponse(res, false, "Failed to initiate bulk lead creation.", 500, {}, "");
                }
            })
            .catch((error) => {
                console.error(error, "=====");
                return ResHelper.apiResponse(res, false, "Error occurred while calling the API.", 500, {}, "");
            });
    } catch (err) {

        console.error(err);
        logger.error(err);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const notificationStats = async (req, res) => {
    try {
        const { error } = DSAValidationV1.notificationStats.validate(req?.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { category, type, startDate, endDate, getDetails, pageSize, pageNumber } = req?.body;
            if (getDetails == false) {
                const { totalCount, collectionCounts } = await getNotificationStats(category, type, startDate, endDate);
                const data = { totalNotifications: totalCount, breakdown: collectionCounts }
                return ResHelper.apiResponse(res, true, "Success", 200, data, "");
            } else {
                const { totalCount, records } = await getNotificationStats(category, type, startDate, endDate, getDetails, pageNumber, pageSize);
                const data = { totalRecords: totalCount, records }
                if (type == "app") {
                    const results = await ApplicationLogServices.getActivityLogsApp(records);
                    return ResHelper.apiResponse(res, true, "Success", 200, { records: results, totalRecords: totalCount }, "");
                }
                const results = await ApplicationLogServices.getActivityLogs(records);
                return ResHelper.apiResponse(res, true, "Success", 200, { records: results, totalRecords: totalCount }, "");
            }
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

const modifyPermissions = async (req, res) => {
    try {
        const { error } = await DSAValidationV1.modifyPermissions.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { type, reference_id, tag } = req.body;
            let tags = await DSAService?.modifyPermissions(type, reference_id, tag);
            ResHelper.apiResponse(res, true, "Success", 200, tags, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getPermissions = async (req, res) => {
    try {
        const { error } = await DSAValidationV1.modifyPermissions.validate(req.query);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { type, dsa_id } = req.query;
            let permissions = await DSAService?.getPermissions(type, dsa_id);
            ResHelper.apiResponse(res, true, "Success", 200, permissions, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const instantClaimApplication = async (req, res) => {
    try {
        const { error } = DSAValidationV1.instantClaimApplication.validate(req.body)
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        else {
            const { application_id, loan_type, platform } = req.body;

            const phone = req.dsa.dsa_mobile_number;
            const netsuite_vendor_id = req.dsa.netsuite_vendor_id;

            const { is_direct_claim_enabled, dsa_id } = req.dsa;

            if (!is_direct_claim_enabled) {
                return ResHelper.apiResponse(res, false, "You do not have permission to instant claims. Please contact your BH for assistance.", 403, {}, "");
            }

            const lead_data = await DSAService.validateAndInsertLeadForInstantClaim(application_id, dsa_id, netsuite_vendor_id, loan_type, phone, platform)

            if (!lead_data.isValid) {
                return ResHelper.apiResponse(res, false, lead_data.errorMsg, 403, {}, "");
            }

            const { new_lead: lead } = lead_data
            const { fresh_lead_id: id } = lead

            let finalObj = [{ id, source: 8 }]

            let options = {
                'method': 'POST',
                //direct billing true for direct claim
                data: { freshLeadIdArray: finalObj, isGetError: 1, directBilling: true },
                'url': `${process.env.MS_URL}/api/fresh-lead/erp-submit`,
                headers: {
                    // 'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI1IiwianRpIjoiM2E2MjUzOTE1NjRlYmFlYWJmM2I0NTkxYWZmMzNmY2JiMTBkNmQxMGI3Nzg5N2JkMzhlMmI5ZjU3YWQ2MTExYzAxYjQ2Y2M5NzY4NTdhNmYiLCJpYXQiOjE2OTc3MzQ0NjEuMzY2ODYsIm5iZiI6MTY5NzczNDQ2MS4zNjY4NjMsImV4cCI6MTcyOTM1Njg2MS4zNTQ3NzQsInN1YiI6IjE4NjgiLCJzY29wZXMiOltdfQ.nsyG2ezKvom4Bis50y8gECaskDn1IGEsEPArA4TWC6VFl_TBJz9FGCcfyiBL_Pyk1906ehIXSB_WjOOAtQpQMaLEbSd3Vr4CAQe6oOCq_thS0D_vtRRadOok13Xp9dg1wdL32MXCjsQgfT74CvZKjSQLsWPCIRylD_042rUUXYC2XEhXAPAMR681dGy3xXZv5lKeVUgGZRGseCKFtfGa3dCei_qM5kuXpWv1baqbyFmvIIQDGbnknE-3K3KpXGUx_ujdxeS_Lo0UX2Ot9R8jk7NdBUNDF5ISFV7QNibzl4b0vYjwhqVqXmnCgu98s-o8tMVW1gDy8VYVMSFo0MMAf2tdEM7kYUbzJbbfMgBCARsmspcp8YMEkCs8bcvcVTrC7O-rcVJC4ViFVi_aCbbvXEK8jk70zgaXWJkncI6QiVw33h8hAyQ23Zou0EmZYVT2au0C2ZMRhXUYg1VYo2yUHBxE1k5oDcH7cCTG2G4zywr6s3LJzwO7OWry2W1Mk_cUCdZlBJHqWj-8AFqG6wmzovLTjGiR0MLqQW1jrQZIVuyoHgE0H5rB2W4k3HNe3BEb7_G5yf1V9h-IKYMBpsJNvpmr8R6bhy_ilN_XzfhGXi6Cb_Y6iisawesW8gtDkijro8J9tRfOsKYq-fN48Z7pjl9sepVict6L5fgkXZ9pvSc',
                    'api-key': process.env.AUTH_KEY_RULOANS_BANK_CLAIM,
                    // 'app-version-code': '25',
                    'device-type': '1',
                    'Content-Type': 'application/json'
                },
                validateStatus: () => true,
            };

            const response = await axios(options);

            let { status, message, data } = response?.data || {};
            message = message?.length ? message : "Try again later."

            if (!Boolean(status)) {
                return ResHelper.apiResponse(res, false, message, 400, {}, "");
            }

            if (!data?.sentToErpArray.length) {
                await DSAService.deleteLeadFormData([id], dsa_id, 1)
                return ResHelper.apiResponse(res, false, message, 400, response?.data, "");
            }
            DSAService.sendInstantClaimNotificationAndEmail(dsa_id, lead, true)
            await DSAService.updateApplicationClaimStatus(application_id, loan_type, 1)
            return ResHelper.apiResponse(res, true, "Your claim has been successfully submitted.", 200, response?.data, "");
        }
    }
    catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
}
const getCrmUsers = async (req, res) => {
    try {
        const response = await DSAService.getAllCRMUsers()
        ResHelper.apiResponse(res, true, "Users Fetched Success", 200, response, "");
    }
    catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
}


const validateVendorPayout = async (req, res) => {
    try {
        const { error } = DSAValidationV1.validateVendorPayout.validate(req.body)
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        const { fresh_lead_ids } = req.body;
        let errorMsg = []
        const leads = await LeadService.getFreshLeadClaimsByIdsForErp(fresh_lead_ids);
        const leadById = new Map((leads || []).map((l) => [l?.fresh_lead_id, l]));
        for (let i = 0; i < fresh_lead_ids.length; i++) {
            let isPayoutMistach = false;
            const fresh_lead = leadById.get(fresh_lead_ids[i]);
            if (!fresh_lead) {
                errorMsg.push({
                    fresh_lead_id: fresh_lead_ids[i],
                    loan_reference_id: null,
                    error_type: "lead_not_found",
                    label: "Lead Not Found",
                    message: "Lead not found",
                });
                continue;
            }
            const { netsuite_product_id, netsuite_bank_id, vendor_payout_type, vendor_payout_rate, vendor_payout_ratio, user_type, registered_by, dsa_id } = fresh_lead
            const effectiveDsaId = user_type === "company" ? registered_by : dsa_id;
            const { vendor_payout_rate: rate, vendor_payout_ratio: ratio, payout_collide } = await DSAService.validateVendorPayoutNew(effectiveDsaId, netsuite_bank_id, netsuite_product_id, vendor_payout_type, vendor_payout_rate, vendor_payout_ratio, null, false, 0, null, null, toIsoDateIST(fresh_lead.disbursement_date))


            if (vendor_payout_type.toLowerCase() == "rate" && (vendor_payout_rate > rate)) {
                isPayoutMistach = true;
            }
            else if (vendor_payout_ratio > ratio) {
                isPayoutMistach = true;
            }

            if (isPayoutMistach) {
                const typeLower = vendor_payout_type?.toLowerCase();
                const expectedCap = typeLower === "rate" ? rate : ratio;
                const message =
                    expectedCap != null && expectedCap !== ""
                        ? `Lead Payout ${typeLower} greater than Expected ${expectedCap}`
                        : typeLower === "rate"
                            ? "Vendor Payout Rate is not set for this Product"
                            : "Vendor Payout Ratio is not set for this Product";
                errorMsg.push({
                    fresh_lead_id: fresh_lead?.fresh_lead_id,
                    loan_reference_id: fresh_lead?.loan_reference_id,
                    error_type: "payout_mismatch",
                    label: "Payout Mismatch",
                    message,
                });
            }
            const bankFile = await resolveMatchedBankFileForLead(fresh_lead);
            const disbursementResult = compareDisbursementAmount({
                leadAmount: fresh_lead?.disbursement_amount,
                bankAmount: bankFile?.disbursement_amount
            });
            if (!disbursementResult.isValid) {
                errorMsg.push({
                    fresh_lead_id: fresh_lead?.fresh_lead_id,
                    loan_reference_id: fresh_lead?.loan_reference_id,
                    error_type: "disbursement_amount_mismatch",
                    label: "Disbursement Amount Mismatch",
                    message: disbursementResult.message || "Disbursement amount validation failed",
                });
            }
        }

        if (!errorMsg.length) {
            return ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
        ResHelper.apiResponse(res, false, "Payout Mismatch", 200, errorMsg, "");
    }
    catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
}

const updateLeadCaseBusinessCategory = async (req, res) => {
    try {
        const { error } = DSAValidationV1.updateLeadCaseBusinessCategory.validate(req.body)
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        const { case_id, first_allowed, second_allowed } = req.body
        let old_data = await getLeadCaseBusinessCategory(case_id)
        let new_data = { first_allowed, second_allowed }
        await updateLeadCaseBusinessCategoryMongo(case_id, first_allowed, second_allowed)
        try {

            await Promise.race([
                KafkaServices.connectKafkaProducer(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Kafka connection timeout')), 5000)
                )
            ]);
        } catch (kafkaError) {
            console.error('Kafka connection failed, proceeding without it:', kafkaError);
            logger.error('Kafka connection failed:', kafkaError);

        }
        try {
            const business_category_update = new KafkaServices.EventLogger(
                "split_case_business_category_update",
                JSON.stringify(old_data),
                JSON.stringify(new_data),
                case_id,
                req?.loggedInUser?.id || null,
                new Date(),
            );
            await KafkaServices.sendToKafkaLoggerService(business_category_update);
        } catch (kafkaSendError) {
            console.error('Failed to send Kafka message:', kafkaSendError);
            logger.error('Kafka send failed:', kafkaSendError);
        }
        ResHelper.apiResponse(res, true, "", 200, {}, "");
    }
    catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
}

const getAllLeadCaseBusinessCategory = async (req, res) => {
    try {
        const data = await getLeadCaseBusinessCategories();
        ResHelper.apiResponse(res, true, "Success", 200, data, "");
    }
    catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
}


const getDsaTaxDetails = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getDsaTaxDetails.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        else {
            const { dsa_id } = req.body;
            let result = await DSAService.getDsaTaxDetails(dsa_id);
            ResHelper.apiResponse(res, true, "Success", 200, result, "");
        }
    }
    catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const updateDsaTaxInformation = async (req, res) => {
    try {
        const { error } = DSAValidationV1.updateDsaTaxInformation.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        else {
            let { dsa_id } = req?.body
            let prevData = await DSAService.getDsaTaxDetails(dsa_id)
            let result = await DSAService.updateDsaTaxInformation(req?.body);
            const diff = jsonDifference(prevData, req?.body)
            const userId = req?.loggedInUser?.id || null;
            await ApplicationLogServices.bulkCreate(diff, dsa_id, "dsa", userId);
            ResHelper.apiResponse(res, true, "Success", 200, result, "");
        }
    }
    catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const updateBillerUniversal = async (req, res) => {

    try {
        const { error } = DSAValidationV1.updateBillerUniversal.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.msg, 400, {}, "");
        }
        else {
            const { biller_universal, dsa_id } = req.body
            const response = await DSAService.updateBillerUniversal(biller_universal, dsa_id);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
}
const getAllPincodes = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getAllPincodes.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { pageNumber, pageSize, pincode_filter, office_name_filter, office_type_filter, city_filter, district_filter, state_filter, taluk_filter, circle_filter, region_filter, related_suboffice_filter, related_head_office_filter, country_filter } = req?.body;
            let where = [];
            if (pincode_filter) {
                where.push(['pincode', 'like', `%${pincode_filter}%`]);
            }
            if (office_name_filter) {
                where.push(['office_name', 'like', `%${office_name_filter}%`]);
            }
            if (office_type_filter) {
                where.push(['office_type', 'like', `%${office_type_filter}%`]);
            }
            if (city_filter) {
                where.push(['city', 'like', `%${city_filter}%`]);
            }
            if (district_filter) {
                where.push(['district', 'like', `%${district_filter}%`]);
            }
            if (state_filter) {
                where.push(['state', 'like', `%${state_filter}%`]);
            }
            if (taluk_filter) {
                where.push(['taluk', 'like', `%${taluk_filter}%`]);
            }
            if (circle_filter) {
                where.push(['circle', 'like', `%${circle_filter}%`]);
            }
            if (region_filter) {
                where.push(['region', 'like', `%${region_filter}%`]);
            }
            if (related_suboffice_filter) {
                where.push(['related_suboffice', 'like', `%${related_suboffice_filter}%`]);
            }
            if (related_head_office_filter) {
                where.push(['related_head_office', 'like', `%${related_head_office_filter}%`]);
            }
            if (country_filter) {
                where.push(['country', 'like', `%${country_filter}%`]);
            }
            const data = await DSAService.getAllPincodes(pageNumber, pageSize, where);


            ResHelper.apiResponse(res, true, "", 200, data, "");
        }
    }
    catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
}
const editOrDeletePincode = async (req, res) => {
    try {
        const { error } = DSAValidationV1.editOrDeletePincode.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const { action, data } = req.body;
        const pincodeId = data.id
        if (!pincodeId) {
            return ResHelper.apiResponse(res, false, "pincodeId is required", 400, {}, "");
        }

        if (action === 'edit') {
            if (!data) {
                return ResHelper.apiResponse(res, false, "Data is required for editing", 400, {}, "");
            }

            const result = await DSAService.editPincode(pincodeId, data);
            return ResHelper.apiResponse(res, true, "Pincode updated successfully", 200, result, "");

        } else if (action === 'delete') {
            const result = await DSAService.deletePincode(pincodeId);
            return ResHelper.apiResponse(res, true, "Pincode deleted successfully", 200, result, "");

        } else {
            return ResHelper.apiResponse(res, false, "Invalid action type", 400, {}, "");
        }

    } catch (err) {
        logger.error(err);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};
const addPincode = async (req, res) => {
    try {
        const { error } = DSAValidationV1.addPincode.validate(req.body.data);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const {
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
        } = req.body.data;

        const result = await DSAService.addPincode(
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
        );

        return ResHelper.apiResponse(res, true, "Pincode added successfully", 200, result, "");

    } catch (err) {
        logger.error(err);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getActivePartnersCount = async (req, res) => {
    try {
        const bankdata = await LeadService.getNetsuiteBankList(null, null, '', true)
        const formattedDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
        let where = ` WHERE DATE(e.start_date) <= DATE("${formattedDate}") AND DATE(e.end_date) >= DATE("${formattedDate}")`;
        where += ` and e.type = "contest" `;
        const eventData = await EventServices.getEvents(0, 0, where, true)
        const activePartners = bankdata?.totalRecords
        const activeContest = eventData?.totalRecords
        ResHelper.apiResponse(res, true, "Success", 200, { activePartners, activeContest }, "");

    } catch (error) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
}
const updateDsaMobileNumber = async (req, res) => {
    try {

        const { error } = DSAValidationV1.updateDsaMobileNumber.validate(req.body);
        if (error) {
            const errorResponse = ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return errorResponse;
        }

        // CRM: role check; B2B/External: DSA updating own mobile, skip role check
        if (!req.dsa) {
            const requesterRole = (req.loggedInUser?.role || "").toUpperCase();
            const allowedRoles = new Set(["CEO", "CFO", "CTO", "BUSINESS_HEAD"]);
            if (!(allowedRoles.has(requesterRole) || isBackendAccessRole(requesterRole))) {
                return ResHelper.apiResponse(res, false, "You are not allowed to perform this operation", 403, {}, "");
            }
        }

        const { dsa_id, mobile_number, otp } = req.body;
        const user_id = req.loggedInUser?.id || req.dsa?.dsa_id;

        // Get current DSA details to validate and get old mobile number
        const dsaDetails = await DSAService.getDsaById(dsa_id);
        if (!dsaDetails) {
            const errorResponse = ResHelper.apiResponse(res, false, "DSA not found", 404, {}, "");
            return errorResponse;
        }

        const old_mobile_number = dsaDetails.customer_mobile_number;

        // Check if DSA's current mobile number is verified from database
        let isCurrentMobileVerified = await DSAService.checkDsaMobileNumberVerified(dsa_id);

        // A number is considered "verified" only if:
        // 1. is_mobile_number_verified = 1
        // 2. It's exactly 10 digits
        // 3. It doesn't start with "222"
        if (isCurrentMobileVerified === 1 && old_mobile_number) {
            // Check if mobile number is exactly 10 digits
            if (!/^\d{10}$/.test(old_mobile_number)) {
                // Not a valid 10-digit number, treat as non-verified
                isCurrentMobileVerified = 0;
            }
            // Check if mobile number starts with "222", treat as non-verified
            else if (old_mobile_number.startsWith('222')) {
                isCurrentMobileVerified = 0;
            }
        }

        // If mobile_number is provided but no OTP, send OTP
        if (mobile_number && !otp) {
            // Validate new mobile number: must be 10 digits
            if (!/^\d{10}$/.test(mobile_number)) {
                const errorResponse = ResHelper.apiResponse(res, false, "Mobile number must be exactly 10 digits", 400, {}, "");
                return errorResponse;
            }

            // Check if new mobile number is different
            if (old_mobile_number === mobile_number) {
                const errorResponse = ResHelper.apiResponse(res, false, "New mobile number is same as current mobile number", 400, {}, "");
                return errorResponse;
            }

            // Check if new mobile number already exists
            const existingDsa = await DSAService.getDsaByPhone(mobile_number);
            if (existingDsa && existingDsa.customer_id !== dsa_id) {
                const errorResponse = ResHelper.apiResponse(res, false, "Mobile number already exists for another DSA", 409, {}, "");
                return errorResponse;
            }

            // Generate OTP
            const OTP = generateRandomString(6);
            const message = `One-time password for updating your profile and application details is ${OTP}-Ruloans`;
            const hashedOtp = crypto.createHash('sha256').update(OTP).digest('hex');

            if (isCurrentMobileVerified === 1) {
                // Current mobile is verified -> Step 1: Send OTP to OLD mobile number first
                const step = "old_mobile_verification";

                // Redis keys for old mobile
                const oldMobileKeyBase = `${old_mobile_number}:dsa_mobile_update:${step}`;
                const oldOtpKey = `otp:${oldMobileKeyBase}`;
                const oldOtpHashKey = `otp_hash:${oldMobileKeyBase}`;
                const oldAttemptsKey = `otp_attempts:${oldMobileKeyBase}`;
                const oldCooldownKey = `otp_cooldown:${oldMobileKeyBase}`;
                const oldLockKey = `otp_lock:${oldMobileKeyBase}`;
                const newMobileStorageKey = `new_mobile:${oldMobileKeyBase}`; // Store new mobile number for step 2

                // Check if locked for old mobile
                if (await client.getAsync(oldLockKey)) {
                    return ResHelper.apiResponse(res, false, "You are temporarily locked for 5 minutes due to repeated failures", 429, {}, "");
                }

                // Enforce cooldown for old mobile
                if (await client.getAsync(oldCooldownKey)) {
                    return ResHelper.apiResponse(res, false, "Please wait before requesting a new OTP", 429, {}, "");
                }

                // Store OTP for old mobile in Redis
                await client.setAsync(oldOtpKey, OTP);
                await client.expireAsync(oldOtpKey, 120); // 2 minutes
                await client.setAsync(oldOtpHashKey, hashedOtp);
                await client.expireAsync(oldOtpHashKey, 120); // 2 minutes
                await client.setAsync(oldAttemptsKey, 0);
                await client.expireAsync(oldAttemptsKey, 120); // 2 minutes

                // Store new mobile number for use in step 2
                await client.setAsync(newMobileStorageKey, mobile_number);
                await client.expireAsync(newMobileStorageKey, 300); // 5 minutes (enough for step 1 + step 2)

                // Set cooldown (45 seconds)
                await client.setAsync(oldCooldownKey, 1);
                await client.expireAsync(oldCooldownKey, 45);

                // Send SMS to old mobile number only
                await sendSMSNew('1207173692695536557', message, old_mobile_number);

                return ResHelper.apiResponse(res, true, "OTP sent to current mobile number", 200, {
                    dsa_id: dsa_id,
                    old_mobile: old_mobile_number,
                    new_mobile: mobile_number,
                    step: step
                }, "");
            } else {
                // Current mobile is not verified -> send OTP to NEW mobile number only
                const step = "new_mobile_verification";

                // Redis keys for new mobile
                const newMobileKeyBase = `${mobile_number}:dsa_mobile_update:${step}`;
                const newOtpKey = `otp:${newMobileKeyBase}`;
                const newOtpHashKey = `otp_hash:${newMobileKeyBase}`;
                const newAttemptsKey = `otp_attempts:${newMobileKeyBase}`;
                const newCooldownKey = `otp_cooldown:${newMobileKeyBase}`;
                const newLockKey = `otp_lock:${newMobileKeyBase}`;

                // Check if locked
                if (await client.getAsync(newLockKey)) {
                    return ResHelper.apiResponse(res, false, "You are temporarily locked for 5 minutes due to repeated failures", 429, {}, "");
                }

                // Enforce cooldown
                if (await client.getAsync(newCooldownKey)) {
                    return ResHelper.apiResponse(res, false, "Please wait before requesting a new OTP", 429, {}, "");
                }

                // Store OTP in Redis
                await client.setAsync(newOtpKey, OTP);
                await client.expireAsync(newOtpKey, 120); // 2 minutes
                await client.setAsync(newOtpHashKey, hashedOtp);
                await client.expireAsync(newOtpHashKey, 120); // 2 minutes
                await client.setAsync(newAttemptsKey, 0);
                await client.expireAsync(newAttemptsKey, 120); // 2 minutes

                // Set cooldown (45 seconds)
                await client.setAsync(newCooldownKey, 1);
                await client.expireAsync(newCooldownKey, 45);

                // Send SMS to new mobile
                await sendSMSNew('1207173692695536557', message, mobile_number);

                return ResHelper.apiResponse(res, true, "OTP sent to new mobile number", 200, {
                    dsa_id: dsa_id,
                    new_mobile: mobile_number,
                    step: step
                }, "");
            }
        }

        // If OTP is provided, verify and update
        if (otp && mobile_number) {
            // First, check if we're in step 1 (old_mobile_verification) for verified mobile
            let step;
            let targetMobileNumber;

            if (isCurrentMobileVerified === 1) {
                // Check if old mobile verification is in progress
                const oldMobileKeyBase = `${old_mobile_number}:dsa_mobile_update:old_mobile_verification`;
                const oldOtpHashKey = `otp_hash:${oldMobileKeyBase}`;
                const storedOldHash = await client.getAsync(oldOtpHashKey);

                if (storedOldHash) {
                    // Step 1: Verifying OLD mobile number
                    step = "old_mobile_verification";
                    targetMobileNumber = old_mobile_number;
                } else {
                    // Step 2: Verifying NEW mobile number
                    step = "new_mobile_verification";
                    targetMobileNumber = mobile_number;
                }
            } else {
                // Current mobile not verified -> directly verifying new mobile
                step = "new_mobile_verification";
                targetMobileNumber = mobile_number;
            }

            // Verify OTP
            const mobileKeyBase = `${targetMobileNumber}:dsa_mobile_update:${step}`;
            const otpHashKey = `otp_hash:${mobileKeyBase}`;
            const attemptsKey = `otp_attempts:${mobileKeyBase}`;
            const lockKey = `otp_lock:${mobileKeyBase}`;

            // Check lockout
            if (await client.getAsync(lockKey)) {
                return ResHelper.apiResponse(res, false, "You are locked due to repeated OTP failures", 429, {}, "");
            }

            // Get stored OTP hash
            const storedHash = await client.getAsync(otpHashKey);
            if (!storedHash) {
                return ResHelper.apiResponse(res, false, "OTP Expired", 400, {}, "");
            }

            // Check attempts
            let attempts = parseInt(await client.getAsync(attemptsKey) || 0);
            if (attempts >= 3) {
                await client.setAsync(lockKey, 1);
                await client.expireAsync(lockKey, 300); // lock for 5 minutes
                return ResHelper.apiResponse(res, false, "Maximum OTP attempts exceeded (locked for 5 mins)", 429, {}, "");
            }

            // Compare hashes
            let incomingHash = crypto.createHash('sha256').update(otp).digest('hex');

            if (incomingHash == storedHash) {
                // OTP verified
                if (step === "old_mobile_verification") {
                    // Step 1 complete: Old mobile verified -> now send OTP to new mobile (Step 2)
                    const newMobileStorageKey = `new_mobile:${mobileKeyBase}`;
                    const storedNewMobile = await client.getAsync(newMobileStorageKey);

                    // Use stored new mobile number or fallback to provided one
                    const newMobileNumber = storedNewMobile || mobile_number;

                    const newOTP = generateRandomString(6);
                    const newMessage = `One-time password for updating your profile and application details is ${newOTP}-Ruloans`;

                    // Store OTP for new mobile
                    const newMobileKeyBase = `${newMobileNumber}:dsa_mobile_update:new_mobile_verification`;
                    const newOtpKey = `otp:${newMobileKeyBase}`;
                    const newOtpHashKey = `otp_hash:${newMobileKeyBase}`;
                    const newAttemptsKey = `otp_attempts:${newMobileKeyBase}`;
                    const newCooldownKey = `otp_cooldown:${newMobileKeyBase}`;
                    const newLockKey = `otp_lock:${newMobileKeyBase}`;

                    // Check if locked for new mobile
                    if (await client.getAsync(newLockKey)) {
                        return ResHelper.apiResponse(res, false, "You are temporarily locked for 5 minutes due to repeated failures", 429, {}, "");
                    }

                    // Check cooldown for new mobile
                    if (await client.getAsync(newCooldownKey)) {
                        return ResHelper.apiResponse(res, false, "Please wait before requesting a new OTP", 429, {}, "");
                    }

                    const newHashedOtp = crypto.createHash('sha256').update(newOTP).digest('hex');
                    await client.setAsync(newOtpKey, newOTP);
                    await client.expireAsync(newOtpKey, 120);

                    await client.setAsync(newOtpHashKey, newHashedOtp);
                    await client.expireAsync(newOtpHashKey, 120);

                    await client.setAsync(newAttemptsKey, 0);
                    await client.expireAsync(newAttemptsKey, 120);

                    await client.setAsync(newCooldownKey, 1);
                    await client.expireAsync(newCooldownKey, 45);

                    // Send SMS to new mobile
                    console.log('========================================');
                    console.log('Step 2: Sending OTP to NEW mobile number');
                    console.log('newMobileNumber:', newMobileNumber);
                    console.log('newOTP:', newOTP);
                    console.log('newMessage:', newMessage);
                    console.log('========================================');
                    await sendSMSNew('1207173692695536557', newMessage, newMobileNumber);

                    // Cleanup old mobile OTP keys
                    await client.delAsync(`otp:${mobileKeyBase}`);
                    await client.delAsync(`otp_hash:${mobileKeyBase}`);
                    await client.delAsync(`otp_attempts:${mobileKeyBase}`);
                    await client.delAsync(newMobileStorageKey);

                    return ResHelper.apiResponse(res, true, "Current mobile verified. OTP sent to new mobile number", 200, {
                        dsa_id: dsa_id,
                        step: "new_mobile_verification",
                        new_mobile: newMobileNumber
                    }, "");
                } else {
                    // Step 2 complete: New mobile verified -> update mobile number
                    // Process update in background to avoid timeout (updates 30-50 tables)
                    // Return immediately while updates complete in background
                    (async () => {
                        try {
                            const updateResult = await DSAService.updateDsaMobileNumber(dsa_id, mobile_number, old_mobile_number, user_id);

                            // Send Kafka event for mobile number change
                            await KafkaServices.connectKafkaProducer();
                            const mobileNumberUpdateEvent = new KafkaServices.EventLogger(
                                "dsa_mobile_number_update",
                                old_mobile_number,
                                mobile_number,
                                dsa_id,
                                user_id,
                                new Date()
                            );
                            await KafkaServices.sendToKafkaLoggerService(mobileNumberUpdateEvent);

                            logger.info(`DSA mobile number update completed: ${dsa_id}, old: ${old_mobile_number}, new: ${mobile_number}`);
                        } catch (updateError) {
                            logger.error(`Error updating DSA mobile number: ${dsa_id}`, updateError);
                            // Transaction will rollback automatically on error
                        }
                    })();

                    // Cleanup Redis keys
                    await client.delAsync(`otp:${mobileKeyBase}`);
                    await client.delAsync(`otp_hash:${mobileKeyBase}`);
                    await client.delAsync(`otp_attempts:${mobileKeyBase}`);

                    // Return immediately - update is processing in background
                    return ResHelper.apiResponse(res, true, "DSA mobile number update initiated. Processing in background...", 202, {
                        dsa_id: dsa_id,
                        old_mobile: old_mobile_number,
                        new_mobile: mobile_number,
                        status: "processing"
                    }, "");
                }
            } else {
                // Invalid OTP - increment attempts
                attempts++;
                await client.setAsync(attemptsKey, attempts);
                await client.expireAsync(attemptsKey, 120);

                if (attempts >= 3) {
                    await client.setAsync(lockKey, 1);
                    await client.expireAsync(lockKey, 300); // lock for 5 minutes
                    return ResHelper.apiResponse(res, false, "Maximum OTP attempts exceeded (locked for 5 mins)", 429, {}, "");
                }

                return ResHelper.apiResponse(res, false, "Invalid OTP", 400, {}, "");
            }
        }

        // If neither mobile_number nor otp provided
        return ResHelper.apiResponse(res, false, "Please provide mobile_number", 400, {}, "");

    } catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");

    }
};
const getVendorMetrics = async (req, res, next) => {
    try {
        // Validate request body
        const { error } = DSAValidationV1.getVendorMetrics.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        let dsaId = null;
        let materializedPath = null;
        let skipHierarchy = false;

        // Extract cardKey, refresh, lightOnly, onboardingOnly from request body
        const { cardKey, refresh, lightOnly, onboardingOnly } = req.body || {};

        // Check if request is from B2B (external) or CRM
        if (req.dsa && req.dsa.dsa_id) {
            // B2B request - always use hierarchy
            dsaId = req.dsa.dsa_id;
            materializedPath = req.dsa.materialized_path;
        } else if (req.loggedInUser) {
            // CRM request
            const role = req.loggedInUser.role;

            // Skip hierarchy for CEO
            if (role === 'CEO') {
                skipHierarchy = true;
            } else {
                // Use hierarchy for other roles
                // Try to get dsa_id from loggedInUser
                dsaId = req.loggedInUser.dsa_id;
                materializedPath = req.loggedInUser.materialized_path;

                // If we have userPhone but no dsa_id, get dsa_id from phone
                if ((!dsaId || !materializedPath) && req.loggedInUser.userPhone) {
                    const dsaData = await DSAService.getDsaByPhone(req.loggedInUser.userPhone);
                    if (dsaData) {
                        if (!dsaId && dsaData.dsa_id) {
                            dsaId = dsaData.dsa_id;
                        }
                        if (!materializedPath && dsaData.materialized_path) {
                            materializedPath = dsaData.materialized_path;
                        }
                    }
                }
            }
        } else {
            return ResHelper.apiResponse(res, false, "Unauthorized: No user or DSA information found", 401, {}, "");
        }

        // Get vendor metrics. Pass lightOnly/onboardingOnly for progressive loading: light first, then onboarding.
        const metrics = await DSAService.getVendorMetrics(dsaId, materializedPath, skipHierarchy, cardKey, refresh, { lightOnly: !!lightOnly, onboardingOnly: !!onboardingOnly });

        return ResHelper.apiResponse(res, true, "Vendor metrics retrieved successfully", 200, metrics, "");
    } catch (err) {
        console.error('Error in getVendorMetrics:', err);
        logger.error(err);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getVendorDashboardList = async (req, res, next) => {
    try {
        // Validate request body
        const { error } = DSAValidationV1.getVendorDashboardList.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        let dsaId = null;
        let materializedPath = null;
        let skipHierarchy = false;

        // Extract filters from request body (nodeId = scope list to that node and under him when user views someone's hierarchy)
        const { nodeId, filterType, pageNumber, pageSize, sortBy, sortDirection, filterModel } = req.body || {};

        // Check if request is from B2B (external) or CRM
        if (req.dsa && req.dsa.dsa_id) {
            // B2B request - always use hierarchy
            dsaId = req.dsa.dsa_id;
            materializedPath = req.dsa.materialized_path;
        } else if (req.loggedInUser) {
            // CRM request
            const role = req.loggedInUser.role;

            // Skip hierarchy for CEO
            if (role === 'CEO') {
                skipHierarchy = true;
            } else {
                // Use hierarchy for other roles
                // Try to get dsa_id from loggedInUser
                dsaId = req.loggedInUser.dsa_id;
                materializedPath = req.loggedInUser.materialized_path;

                // If we have userPhone but no dsa_id, get dsa_id from phone
                if ((!dsaId || !materializedPath) && req.loggedInUser.userPhone) {
                    const dsaData = await DSAService.getDsaByPhone(req.loggedInUser.userPhone);
                    if (dsaData) {
                        if (!dsaId && dsaData.dsa_id) {
                            dsaId = dsaData.dsa_id;
                        }
                        if (!materializedPath && dsaData.materialized_path) {
                            materializedPath = dsaData.materialized_path;
                        }
                    }
                }
                // When nodeId is present (viewing someone's hierarchy), ensure hierarchy is applied: resolve DSA by user id if still missing
                if (nodeId && !skipHierarchy && (!dsaId || !materializedPath) && req.loggedInUser.id) {
                    const dsaDetails = await DSAService.getLoggedInUserDsaAndBhDetails(req.loggedInUser.id);
                    if (dsaDetails && dsaDetails.length > 0) {
                        if (!dsaId && dsaDetails[0].dsa_id) {
                            dsaId = dsaDetails[0].dsa_id;
                        }
                        if (!materializedPath && dsaDetails[0].materialized_path) {
                            materializedPath = dsaDetails[0].materialized_path;
                        }
                    }
                }
            }
        } else {
            return ResHelper.apiResponse(res, false, "Unauthorized: No user or DSA information found", 401, {}, "");
        }

        // Get vendor dashboard list with filters (nodeId: when set, show only that node and under him)
        const result = await DSAService.getVendorDashboardList(dsaId, materializedPath, skipHierarchy, {
            nodeId: nodeId || undefined,
            filterType: filterType || 'all',
            pageNumber: pageNumber || 0,
            pageSize: pageSize || 10,
            sortBy: sortBy || 'vendor_name',
            sortDirection: sortDirection || 'asc',
            filterModel: filterModel || { items: [], logicOperator: 'and' }
        });

        return ResHelper.apiResponse(res, true, "Vendor dashboard list retrieved successfully", 200, result, "");
    } catch (err) {
        console.error('Error in getVendorDashboardList:', err);
        logger.error(err);
        return ResHelper.apiResponse(res, false, err.message || "Error retrieving vendor dashboard list", 500, {}, "");
    }
};

const getVendorDashboardListCounts = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getVendorDashboardListCounts.validate(req.body || {});
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        let dsaId = null;
        let materializedPath = null;
        let skipHierarchy = false;
        const { nodeId } = req.body || {};

        if (req.dsa && req.dsa.dsa_id) {
            dsaId = req.dsa.dsa_id;
            materializedPath = req.dsa.materialized_path;
        } else if (req.loggedInUser) {
            const role = req.loggedInUser.role;
            if (role === 'CEO') {
                skipHierarchy = true;
            } else {
                dsaId = req.loggedInUser.dsa_id;
                materializedPath = req.loggedInUser.materialized_path;
                if ((!dsaId || !materializedPath) && req.loggedInUser.userPhone) {
                    const dsaData = await DSAService.getDsaByPhone(req.loggedInUser.userPhone);
                    if (dsaData) {
                        if (!dsaId && dsaData.dsa_id) dsaId = dsaData.dsa_id;
                        if (!materializedPath && dsaData.materialized_path) materializedPath = dsaData.materialized_path;
                    }
                }
                if (nodeId && !skipHierarchy && (!dsaId || !materializedPath) && req.loggedInUser.id) {
                    const dsaDetails = await DSAService.getLoggedInUserDsaAndBhDetails(req.loggedInUser.id);
                    if (dsaDetails && dsaDetails.length > 0) {
                        if (!dsaId && dsaDetails[0].dsa_id) dsaId = dsaDetails[0].dsa_id;
                        if (!materializedPath && dsaDetails[0].materialized_path) materializedPath = dsaDetails[0].materialized_path;
                    }
                }
            }
        } else {
            return ResHelper.apiResponse(res, false, "Unauthorized: No user or DSA information found", 401, {}, "");
        }

        const result = await DSAService.getVendorDashboardListCounts(dsaId, materializedPath, skipHierarchy, {
            nodeId: nodeId || undefined
        });
        return ResHelper.apiResponse(res, true, "Vendor dashboard counts retrieved successfully", 200, result, "");
    } catch (err) {
        console.error('Error in getVendorDashboardListCounts:', err);
        logger.error(err);
        return ResHelper.apiResponse(res, false, err.message || "Error retrieving vendor dashboard counts", 500, {}, "");
    }
};

/**
 * B2B: Get vendor dashboard details for a single DSA by dsa_id.
 * Returns the same fields as getVendorDashboardList for one DSA (only if in caller's hierarchy).
 */
const getVendorDashboardByDsaId = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.getVendorDashboardByDsaId.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const { dsa_id: targetDsaId } = req.body;

        if (!req.dsa || !req.dsa.dsa_id) {
            return ResHelper.apiResponse(res, false, "Unauthorized: B2B DSA context required", 401, {}, "");
        }

        const dsaId = req.dsa.dsa_id;
        const materializedPath = req.dsa.materialized_path || null;

        const result = await DSAService.getVendorDashboardByDsaId(dsaId, materializedPath, targetDsaId);

        if (!result.data) {
            return ResHelper.apiResponse(res, false, "DSA not found or access denied", 404, { data: null }, "");
        }

        return ResHelper.apiResponse(res, true, "Vendor dashboard details retrieved successfully", 200, result, "");
    } catch (err) {
        console.error('Error in getVendorDashboardByDsaId:', err);
        logger.error(err);
        return ResHelper.apiResponse(res, false, err.message || "Error retrieving vendor dashboard details", 500, {}, "");
    }
};

// --- Vendor hierarchy compact view (GET, query params). Resolve hierarchy context same as getVendorMetrics. ---
const getVendorHierarchyCompactContext = async (req) => {
    let dsaId = null;
    let materializedPath = null;
    let skipHierarchy = false;
    if (req.dsa && req.dsa.dsa_id) {
        dsaId = req.dsa.dsa_id;
        materializedPath = req.dsa.materialized_path;
    } else if (req.loggedInUser) {
        if (req.loggedInUser.role === 'CEO') skipHierarchy = true;
        else {
            dsaId = req.loggedInUser.dsa_id;
            materializedPath = req.loggedInUser.materialized_path;
            if ((!dsaId || !materializedPath) && req.loggedInUser.userPhone) {
                const dsaData = await DSAService.getDsaFullDetailsPhone(req.loggedInUser.userPhone);
                if (dsaData) {
                    if (!dsaId && dsaData.dsa_id) dsaId = dsaData.dsa_id;
                    if (!materializedPath && dsaData.materialized_path) materializedPath = dsaData.materialized_path;
                }
            }
        }
    }
    return { dsaId, materializedPath, skipHierarchy };
};

const getCompactViewChildren = async (req, res) => {
    try {
        const ctx = await getVendorHierarchyCompactContext(req);
        if (!ctx.dsaId && !ctx.skipHierarchy)
            return ResHelper.apiResponse(res, false, "Unauthorized: No user or DSA information found", 401, {}, "");
        const body = req.body || {};
        const { nodeId, metric, page, pageSize, showOnlyAffected, sortBy, sortOrder, filterModel, logicOperator } = body;
        const data = await DSAService.getCompactViewChildren(
            ctx.dsaId, ctx.materializedPath, ctx.skipHierarchy,
            nodeId || undefined, metric || undefined,
            page != null ? parseInt(page, 10) : 1, pageSize != null ? parseInt(pageSize, 10) : 10,
            showOnlyAffected !== false && showOnlyAffected !== 'false' && showOnlyAffected !== '0',
            sortBy || 'metric_count', sortOrder || 'desc',
            filterModel || null, logicOperator || 'and'
        );
        return ResHelper.apiResponse(res, true, "Compact view children retrieved successfully", 200, data, "");
    } catch (err) {
        console.error('Error in getCompactViewChildren:', err);
        logger.error(err);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getCompactNodeDetails = async (req, res) => {
    try {
        const ctx = await getVendorHierarchyCompactContext(req);
        if (!ctx.dsaId && !ctx.skipHierarchy)
            return ResHelper.apiResponse(res, false, "Unauthorized: No user or DSA information found", 401, {}, "");
        const targetDsaId = req.params.dsaId;
        if (!targetDsaId) return ResHelper.apiResponse(res, false, "dsaId is required", 400, {}, "");
        const data = await DSAService.getCompactNodeDetails(ctx.dsaId, ctx.materializedPath, ctx.skipHierarchy, targetDsaId);
        if (!data) return ResHelper.apiResponse(res, false, "Node not found or not in your hierarchy", 404, {}, "");
        return ResHelper.apiResponse(res, true, "Compact node details retrieved successfully", 200, data, "");
    } catch (err) {
        console.error('Error in getCompactNodeDetails:', err);
        logger.error(err);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getVendorBranchSummaryMetrics = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getVendorBranchSummaryMetrics.validate(req.body || {});
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        const ctx = await getVendorHierarchyCompactContext(req);
        if (!ctx.dsaId && !ctx.skipHierarchy) {
            return ResHelper.apiResponse(res, false, "Unauthorized: No user or DSA information found", 401, {}, "");
        }
        const result = await DSAService.getVendorBranchSummaryMetrics(ctx.dsaId, ctx.materializedPath, ctx.skipHierarchy);
        return ResHelper.apiResponse(res, true, "Branch summary metrics retrieved successfully", 200, result, "");
    } catch (err) {
        console.error('Error in getVendorBranchSummaryMetrics:', err);
        logger.error(err);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getVendorBranchList = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getVendorBranchList.validate(req.body || {});
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        const ctx = await getVendorHierarchyCompactContext(req);
        if (!ctx.dsaId && !ctx.skipHierarchy) {
            return ResHelper.apiResponse(res, false, "Unauthorized: No user or DSA information found", 401, {}, "");
        }
        const { pageNumber, pageSize, sortBy, sortDirection, filterModel, logicOperator } = req.body || {};
        const result = await DSAService.getVendorBranchList(ctx.dsaId, ctx.materializedPath, ctx.skipHierarchy, {
            pageNumber: pageNumber != null && pageNumber !== '' ? pageNumber : 0,
            pageSize: pageSize != null && pageSize !== '' ? pageSize : 10,
            sortBy,
            sortDirection,
            filterModel: filterModel || { items: [], logicOperator: logicOperator || 'and' }
        });
        return ResHelper.apiResponse(res, true, "Branch list retrieved successfully", 200, result, "");
    } catch (err) {
        console.error('Error in getVendorBranchList:', err);
        logger.error(err);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getVendorBranchDsaList = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getVendorBranchDsaList.validate(req.body || {});
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        const branchCode = req.body?.branchCode ?? req.body?.branch_code;
        if (branchCode == null || String(branchCode).trim() === '') {
            return ResHelper.apiResponse(res, false, "branchCode is required", 400, {}, "");
        }
        const ctx = await getVendorHierarchyCompactContext(req);
        if (!ctx.dsaId && !ctx.skipHierarchy) {
            return ResHelper.apiResponse(res, false, "Unauthorized: No user or DSA information found", 401, {}, "");
        }
        const { pageNumber, pageSize, sortBy, sortDirection, filterModel, logicOperator } = req.body || {};
        const result = await DSAService.getVendorBranchDsaList(ctx.dsaId, ctx.materializedPath, ctx.skipHierarchy, {
            branchCode: String(branchCode).trim(),
            pageNumber: pageNumber != null && pageNumber !== '' ? pageNumber : 0,
            pageSize: pageSize != null && pageSize !== '' ? pageSize : 10,
            sortBy,
            sortDirection,
            filterModel: filterModel || { items: [], logicOperator: logicOperator || 'and' }
        });
        return ResHelper.apiResponse(res, true, "Branch DSA list retrieved successfully", 200, result, "");
    } catch (err) {
        console.error('Error in getVendorBranchDsaList:', err);
        logger.error(err);
        return ResHelper.apiResponse(res, false, err.message || "Error occurred during execution", 500, {}, "");
    }
};

const updateDsaClassInfo = async (req, res, next) => {
    try {
        const { error } = DSAValidationV1.updateDsaClassInfo.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        }
        const { dsa_id, class_assignee_name, class_assignee_email } = req.body;
        const { previousData, newData } = await DSAService.updateDsaClassInfo(dsa_id, class_assignee_name, class_assignee_email);

        const difference = jsonDifference(previousData, newData);
        if (difference?.length) {
            const userId = req?.loggedInUser?.id || null;
            await ApplicationLogServices.bulkCreate(difference, dsa_id, "dsa", userId);
        }

        return ResHelper.apiResponse(res, true, "Class assignee info updated successfully", 200, {}, "");
    } catch (error) {
        next(error);
    }
};

module.exports = {
    updateDsaClassInfo,
    editOrDeletePincode,
    getAllPincodes,
    addPincode,
    updateBillerUniversal,
    getCrmUsers,
    bulkCallingslashrtc,
    bulkCalling,
    editLoanDetails,
    getLoanDetails,
    updateCustomerFields,
    assignRM,
    getRMList,
    getRuloansCustomers,
    getRuloansCustomersKyc,
    getStaticSignUpSteps,
    getZipCodeList,
    getPartnerList,
    getDsaCity,
    getDsaState,
    getDsaUserDetails,
    getLoanApplications,
    getCreditCardApplications,
    getCustomerUserDetails,
    getCustomerLoanApplications,
    getCustomerCreditCardApplications,
    getCustomerLoanDocuments,
    getCustomerLoanCapturedDetails,
    getCustomerCreditCardCapturedDetails,
    getCustomerLoanSuggestedBanks,
    getSuggestedBanksList,
    getLoanType,
    getCustomerState,
    getCustomerCity,
    getAllLoanApplications,
    getAllCreditCardApplications,
    getCustomers,
    getDsaTree,
    getDsaTreeCount,
    getUnverifiedDsa,
    updateDsaVerifyStatus,
    updateDsaAutoErpStatus,
    getDsaUserCapturedDetailsPdf,
    uploadDsaVerificationDocument,
    getDsaVerificationDocument,
    downloadDsaList,
    downloadAllLoanApplicationsList,
    downloadAllCreditCardApplicationsList,
    reassignPartner,
    getLntLoanApplications,
    getCustomerLntApplications,
    getRuloansCustomersDropDown,
    getLntApplicationById,
    getCreditCardApplicationById,
    getAllLntApplications,
    getAllPayUApplications,
    getAllFibeApplications,
    getPayoutByPanNumber,
    refreshDsaKycVendorBranchFromNsExternal,
    getCreditCardForDashboard,
    getLntForDashboard,
    getLoanForDashboard,
    getApplicationCountForDashboard,
    getLntApplicationStage,
    getLntApplicationSubStage,
    getDsaChild,
    getDsaIdByPhone,
    updateChannelPartnerStatus,
    downloadDsaWithStep,
    uploadDsaWithStep,
    getGraphData,
    getAllIndifiApplications,
    getIndifiApplicationDetailsById,
    sendWelcomeSms,
    getIndifiForDashboard,
    getCreditCardApplicationStatus,
    getIndifiApplicationStatus,
    getDsaTreeDownload,
    sendAgreementSignedSms,
    editSubAssignee,
    editUserType,
    getDsasByCompanyId,
    insertLastMonthsLntReport,
    getCibilInitiated,
    getCibilList,
    getCibilDetail,
    getCustomerCapturedDetails,
    getYearlyLntReport,
    getYearlyIncredReport,
    downloadAllLoanApplications,
    sendAppNotification,
    getAllPayoutRequest,
    getPayoutRequest,
    getYearlyDashboardReport,
    insertLastMonthDashboardReport,
    getDsaKycData,
    uploadDsaKycData,
    updateBhExternal,
    insertLastMonthsIncredReport,
    insertLastMonthsFaircentReport,
    getIncredForDashboard,
    getYearlyFaircentReport,
    getFaircentForDashboard,
    getFibeForDashboard,
    getPaysenseForDashboard,
    getYearlyFibeReport,
    getYearlyPaysenseReport,
    getAllPayUApplications,
    getAllFibeApplications,
    getBajajPLForDashboard,
    getYearlyBajajPLReport,
    getYearlyCreditSasionReport,
    getYearlyPiramalReport,
    getYearlyCreditVidyaReport,
    getCreditSasionForDashboard,
    getCreditVidyaForDashboard,
    getPiramalForDashboard,
    getAllBajajApplications,
    getAllIncredApplications,
    getAllCreditSaisonApplications,
    getAllPiramalApplications,
    getAllCreditVidyaApplications,
    getStageFilterList,
    sendSearchEngineOtp,
    verifySearchEngineOtp,
    uploadLeadFormData,
    getAllDsaLeads,
    reassignPartnerExternal,
    getLeadClaimUpdateLogs,
    getLeadClaimUploadLogs,
    deleteLeadFormData,
    updateClaimPendingStatus,
    updateMultiFundedStatus,
    moveToPendingLeadForm,
    moveToPendingLeadFormBankerProcessed,
    checkSendSMSNew,
    createCommunicationSettings,
    getCommunicationSettings,
    deleteCommunicationSettings,
    createRemainder,
    getAllRemainder,
    getAllUpcomingRemainder,
    getAllMissedRemainder,
    deleteRemainder,
    getDsaDataForEdit,
    markAllPastRemainderAsRead,
    markRemainderAsRead,
    createOrEditDsa,
    uploadAndEditDsa,
    getDsaUploadLogs,
    getPersonalLoanMisForDsa,
    getDsaCityState,
    updateLeadFormPayoutType,
    getAllPendingHlApplications,
    getAllPiramalLapApplications,
    getAllPendingLAPApplications,
    getPiramalLAPForDashboard,
    getLedger,
    uploadInvoiceData,
    mergeDsa,
    getAllCCApplications,
    getAllCCProducts,
    getAllInvoices,
    updateInvoice,
    updateInvoiceNumber,
    acceptOrRejectInvoice,
    uploadReverseInvoice,
    downloadInvoice,
    getRefreshPayoutStatusForDsa,
    editDsaNSVendorId,
    getAllDsaDopdown,
    updateCCApplications,
    getAllGlobalConfiguration,
    CreateEditGlobalConfiguration,
    DeleteGlobalConfiguration,
    AddBankDetailDsa,
    getBankDetailsDsa,
    deleteInvoice,
    getLntForDashboardV2,
    getIncredForDashboardV2,
    getFaircentForDashboardV2,
    getFibeForDashboardV2,
    getBajajPLForDashboardV2,
    getCreditVidyaForDashboardV2,
    getPaysenseForDashboardV2,
    getIndifiForDashboardV2,
    getPiramalForDashboardV2,
    getLoanForDashboardV2,
    refreshApplicationStatus,
    updateDirectClaimAccess,
    getApplicationsByProductAndLoanType,
    getAllApplicationsExternal,
    editSigningPayout,
    getAllPlForDashboard,
    getYearlyPlReport,
    getAllCCForDashBoard,
    getYearlyCCReport,
    getAllPayoutClaimForDashboard,
    getYearlyPayoutClaimReport,
    withdrawDsaConsent,
    getYearlyLogiFormReport,
    getLoginFormForDashboard,
    fetchDigioDoduments,
    getCombinedLoanApplications,
    reassignCustomerPartner,
    signInvoice,
    signInvoiceWebhook,
    sendInvoiceSignOtpSms,
    getFreshLeadClaimForEdit,
    updateLntApplicationById,
    changeDsaEmployeeStatus,
    updateDsaEmployee,
    getUtmJourneyUrl,
    updateLoanApplication,
    sendWhatsappMessage,
    sendEmailMessage,
    downloadLeadFormSample,
    sendPushNotificationToKafka,
    getStatusRefresh,
    sendSmsToKafka,
    sendPushNotification,
    editCustomers,
    getCompanyList,
    getDsaParentRecursively,
    updateClaimPendingStatusExternal,
    notificationStats,
    getDsaKycDataExternal,
    modifyPermissions,
    getPermissions,
    reassignPartnerCsv,
    instantClaimApplication,
    toggleNotificationDsa,
    validateVendorPayout,
    getDsaPartner,
    updateLeadCaseBusinessCategory,
    getSalesPersons,
    assignSalesPerson,
    updateDsaTaxInformation,
    getDsaTaxDetails,
    getAllLeadCaseBusinessCategory,
    getActivePartnersCount,
    updateDsaMobileNumber,
    getVendorMetrics,
    getVendorDashboardList,
    getVendorDashboardListCounts,
    getVendorDashboardByDsaId,
    getVendorBranchSummaryMetrics,
    getVendorBranchList,
    getVendorBranchDsaList,
    updateLeadByReconciliation,
    getCompactViewChildren,
    getCompactNodeDetails,
    // DSA email change (self-service + admin + public verify)
    ...require("../emailChange/index.js"),
};





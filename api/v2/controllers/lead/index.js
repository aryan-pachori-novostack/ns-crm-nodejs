//created dsa controller to serve the routes for RULOANS CUSTOMER DATA
const { logger } = require("../../../helpers/logger");
let fs = require('fs');
const { uploadToS3, arrayKeysToString, jsonDifference, jsonDifferenceForNestedObjects, generatePasswordFromNameAndMobile } = require("../../../helpers/commonhelper");
const { Parser } = require('json2csv');
let randomstring = require("randomstring");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let LeadService = require(_pathconst.ServicesPath.LeadService);
let UserService = require(_pathconst.ServicesPath.UserService);
let DSAService = require(_pathconst.ServicesPath.DSAService);
let LeadValidationV2 = require(_pathconst.ReqModelsPath.LeadValidationV2);
let ApplicationLogServices = require(_pathconst.ServicesPath.ApplicationLogServices);
const LeadLogService = require(_pathconst.ServicesPath.LeadLogService);
let CommonHelper = require(_pathconst.FilesPath.CommonHelper);
let { emailQueueLead, cplq, cplqn } = require(_pathconst.FilesPath.Queue);
const User = require("../../../../models/User");
const { generatePDF } = require("../../../helpers/GeneratePdf");



const getLeadForms = async (req, res, next) => {
    try {
        const { error } = LeadValidationV2.getLeadForms.validate(req?.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { claim_status, loan_status, form_type, is_split_case_filter, pageNumber, pageSize, status, fresh_lead_id, search, createdDateStartFilter, createdDateEndFilter, updatedDateStartFilter, updatedDateEndFilter, requestDateStartFilter, requestDateEndFilter, claim_month_filter, loan_reference_id_filter, loan_apac_ref_los_number_filter, customer_full_name_filter, disbursement_date_iso_filter, disbursement_amount_filter, bank_name_filter, product_name_filter, vendor_payout_rate_filter, vendor_payout_ratio_filter, vendor_payout_amount_filter, payout_collide_filter, dsa_name_filter, city_filter, customer_company_name_filter, fresh_lead_id_filter, vendor_payout_type_filter, upload_file_name_filter, created_by_filter, loan_type_filter, ns_contest_id_filter } = req?.body;
            let user = await UserService.findUserByPhone(req.dsa.dsa_mobile_number);
            let where = "";
            if (!status) {
                where += ` where (flc.dsa_mobile_number  = '${req.dsa.dsa_mobile_number}' or (flc.created_by = '${req.dsa.dsa_id}' ${user ? ` or flc.created_by = '${user.id}'` : ''}))`;


            } else {
                if (status == 1) {
                    where += ` where flc.fresh_lead_status_id not in (0, 2) `;
                } else if (status == 3) {
                    where += ` where flc.is_deleted = 1 `;
                } else {
                    where += ` where flc.fresh_lead_status_id = ${status} `;
                }
                if (status != 3) {
                    where += ` and flc.is_deleted = 0 `
                }



                where += ` where flc.dsa_mobile_number  = '${req.dsa.dsa_mobile_number}' or (flc.created_by = '${req.dsa.dsa_id}' ${user ? ` or flc.created_by = '${user.id}'` : ''})`;

            }

            // if (status == 1) {
            //     where += ` where flc.fresh_lead_status_id not in (0, 2) `;
            // } else if (status == 3) {
            //     where += ` where flc.is_deleted = 1 `;
            // } else {
            //     where += ` where flc.fresh_lead_status_id = ${status} `;
            // }
            // if (status != 3) {
            //     where += ` and flc.is_deleted = 0 `
            // }

            let custom_select_string = `, 
                    case 
                    when flc.fresh_lead_status_id in (1,6,2,5,9,10,11,12,4,3,7,8) then 1
                    else 0
                    end as erp_status`;


            if (search) {
                where += ` and (flc.leader_name like '%${search}%' or d.full_name like '%${search}%' or flc.upload_file_name like '%${search}%') `
            }
            if (createdDateStartFilter) {
                where += ` and DATE(flc.created_at) between DATE("${createdDateStartFilter}") and DATE("${createdDateEndFilter}")`
            }
            if (updatedDateStartFilter) {
                where += ` and DATE(flc.updated_at) between DATE("${updatedDateStartFilter}") and DATE("${updatedDateEndFilter}")`
            }
            if (requestDateStartFilter) {
                where += ` and DATE(flc.request_date) between DATE("${requestDateStartFilter}") and DATE("${requestDateEndFilter}")`
            }
            if (claim_month_filter) {
                where += ` and (flc.claim_month like '%${claim_month_filter}%') `
            }
            if (loan_reference_id_filter) {
                where += ` and (flc.loan_reference_id like '%${loan_reference_id_filter}%') `
            }

            // Loan APAC/LOS Number
            if (loan_apac_ref_los_number_filter) {
                where += ` and (flc.loan_apac_ref_los_number like '%${loan_apac_ref_los_number_filter}%') `;
            }

            // Customer Full Name
            if (customer_full_name_filter) {
                where += ` and (flc.customer_full_name like '%${customer_full_name_filter}%') `;
            }


            // Disbursement Date ISO
            if (disbursement_date_iso_filter) {
                where += ` and (flc.disbursement_date_iso like '%${disbursement_date_iso_filter}%') `;
            }

            // Disbursement Amount
            if (disbursement_amount_filter) {
                where += ` and (flc.disbursement_amount like '%${disbursement_amount_filter}%') `;
            }

            // Bank Name
            if (bank_name_filter) {
                where += ` and (flc.bank_name like '%${bank_name_filter}%') `;
            }

            // Product Name
            if (product_name_filter) {
                where += ` and (flc.product_name like '%${product_name_filter}%') `;
            }

            // Vendor Payout Rate
            if (vendor_payout_rate_filter) {
                where += ` and (flc.vendor_payout_rate like '%${vendor_payout_rate_filter}%') `;
            }

            // Vendor Payout Ratio
            if (vendor_payout_ratio_filter) {
                where += ` and (flc.vendor_payout_ratio like '%${vendor_payout_ratio_filter}%') `;
            }

            // Vendor Payout Amount
            if (vendor_payout_amount_filter) {
                where += ` and (flc.vendor_payout_amount like '%${vendor_payout_amount_filter}%') `;
            }

            // Payout Collide
            if (payout_collide_filter) {
                where += ` and (case when flc.payout_collide = 0 then "no" else "yes" end like '%${payout_collide_filter}%') `;
            }

            // DSA Name
            if (dsa_name_filter) {
                where += ` and (d.full_name like '%${dsa_name_filter}%') `;
            }

            // City
            if (city_filter) {
                where += ` and (flc.city like '%${city_filter}%') `;
            }

            // Customer Company Name
            if (customer_company_name_filter) {
                where += ` and (flc.customer_company_name like '%${customer_company_name_filter}%') `;
            }

            // Fresh Lead ID
            if (fresh_lead_id_filter) {
                where += ` and (flc.fresh_lead_id like '%${fresh_lead_id_filter}%') `;
            }

            // Upload File Name
            if (upload_file_name_filter) {
                where += ` and (case when flc.upload_file_name is null then "Self" else flc.upload_file_name end like '%${upload_file_name_filter}%') `;
            }

            if (vendor_payout_type_filter) {
                where += ` and (flc.vendor_payout_type like '%${vendor_payout_type_filter}%') `;
            }

            if (created_by_filter) {
                where += ` and (flc.created_by like '%${created_by_filter}%') `;
            }

            if (is_split_case_filter) {
                where += ` and (flc.is_split_case like '%${is_split_case_filter}%') `;
            }

            if (form_type && form_type.length) {
                where += ` and (flc.form_type  in (${arrayKeysToString(form_type)}) )`;
            }

            if (loan_status) {
                where += ` and (flc.loan_status = '${loan_status}')`;
            }

            if (claim_status === "0") {
                where += ` and (flc.claim_pending_flag = 0 and flc.multi_funded_flag in (-1, 2))`;
            }

            if (claim_status === "1") {
                where += ` and (flc.claim_pending_flag = 1)`;
            }

            if (loan_type_filter) {
                where += ` and (flc.loan_type = '${loan_type_filter}')`;
            }

            if (ns_contest_id_filter) {
                where += ` and (flc.ns_contest_id = ${ns_contest_id_filter})`
            }

            where += ` and (flc.is_deleted = 0) `

            let lead_forms = await LeadService.getLeadForms(null, null, pageSize * pageNumber, pageSize, where, fresh_lead_id, false, custom_select_string);
            ResHelper.apiResponse(res, true, "Success", 200, lead_forms, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};


const getPayoutsDigitalThroughApp = async (req, res, next) => {
    try {
        const { error } = LeadValidationV2.getPayoutsDigitalThroughApp.validate(req?.query);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { dsa_id } = req?.query;
            let payouts = await LeadService.getPayoutsDigitalThroughAppV2(dsa_id);
            ResHelper.apiResponse(res, true, "Success", 200, payouts, "");
        }
    }
    catch (error) {
        console.log(error)
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const editPayoutsDigitalThroughApp = async (req, res, next) => {
    try {
        const { error } = LeadValidationV2.editPayoutsDigitalThroughApp.validate(req?.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        else {
            let { dsa_id, reqObj } = req?.body;
            const prev_payouts = await LeadService.getPayoutsDigitalThroughAppV2(dsa_id)
            const dsa_details = await DSAService.getDsaById(dsa_id)
            const { is_direct_claim_enabled } = dsa_details
            const payouts = await LeadService.editPayoutsDigitalThroughAppV2(dsa_id, reqObj);
            const difference = jsonDifference({ is_direct_claim_enabled: Number(is_direct_claim_enabled) }, { is_direct_claim_enabled: 1 })

            //-------------------------generating_logs----------------------//
            const payoutDifference = jsonDifferenceForNestedObjects(prev_payouts, reqObj)
            const userId = req?.loggedInUser?.id || null;
            let main_diff = []
            if (payoutDifference.length) {
                payoutDifference.map((d) => {
                    const path = d[0];
                    const oldValue = d[1];
                    const newValue = d[2];
                    const match = path.match(/\[(\d+)\]/);
                    if (!match) return;
                    const index = parseInt(match[1]);
                    const changedObject = prev_payouts[index];
                    //const changedKey = path.substring(path.indexOf('.') + 1);
                    main_diff.push([`${changedObject.bank_name} - ${changedObject.product_name} - payout`, oldValue, newValue])
                });
                if (main_diff.length) {
                    await ApplicationLogServices.bulkCreate(main_diff, dsa_id, "dsa", userId);
                }
            }
            await ApplicationLogServices.bulkCreate(difference, dsa_id, "dsa", userId);
            //-------------------------generating_logs----------------------//
            ResHelper.apiResponse(res, true, "Success", 200, payouts, "");
        }
    }
    catch (e) {
        console.log(e)
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const downloadLeadPayout = async (req, res, next) => {
    try {
        const { error } = LeadValidationV2.downloadLeadPayout.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        else {
            const { dsa_id } = req.body
            let { customer_full_name, customer_mobile_number, vendor_deal_description, assigning_payout_percentage } = await DSAService.getDsaById(dsa_id)
            const referrer_data = await DSAService.getReferrerDetails(dsa_id)
            let referrer_name = referrer_data?.referrer_name
            let referrer_mobile_number = referrer_data?.referrer_mobile_number

            let data = await DSAService.getDsaPayoutList(dsa_id, null, [], "and", false, false, false)

            const payouts = data?.data;

            if (!payouts || payouts.length == 0) {
                return ResHelper.apiResponse(res, false, "No Data Found", 400, {}, "");
            }

            const payload = {
                data: payouts,
                dsa_name: customer_full_name,
                vendor_deal_description,
                assigning_payout_percentage,
                referrer_name,
                referrer_mobile_number
            }
            const password = generatePasswordFromNameAndMobile(customer_full_name, customer_mobile_number);

            const pdfBuffer = await generatePDF("pdfTemplateForPayout", payload, password);

            await fs.promises.writeFile(appRoot + 'report.pdf', pdfBuffer);
            const base64String = await pdfBuffer.toString('base64');

            const url = await uploadToS3("lead_payout", base64String, dsa_id, 'application/pdf', 'pdf');
            ResHelper.apiResponse(res, true, "Success", 200, url, "");
        }
    }
    catch (err) {
        console.log(err)
        logger.error(err)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

module.exports = {
    getLeadForms,
    getPayoutsDigitalThroughApp,
    editPayoutsDigitalThroughApp,
    downloadLeadPayout
};




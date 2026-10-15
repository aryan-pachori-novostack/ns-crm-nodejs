//created dsa controller to serve the routes for RULOANS CUSTOMER DATA
const { logger } = require("../../../helpers/logger");
let fs = require('fs');
const { uploadToS3, checkWhereInQueryString, callNsApi, uploadArrayToS3, checkMasterRole, isBackendAccessRole, CreateWhereQueryFilter, CustomOperatorHandlers, formatGetLeadFormsFilterClause, makeRequest, toIsoDateIST } = require("../../../helpers/commonhelper");
const { Parser } = require('json2csv');
let randomstring = require("randomstring");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let LeadService = require(_pathconst.ServicesPath.LeadService);
let UserService = require(_pathconst.ServicesPath.UserService);
let DSAService = require(_pathconst.ServicesPath.DSAService);
const LeadClaimService = require("../../../v2/finance/leads/claims/FreshLeadClaimService");
let CompanyServices = require(_pathconst.ServicesPath.CompanyServices);
let LeadValidationV1 = require(_pathconst.ReqModelsPath.LeadValidationV1);
const LeadLogService = require(_pathconst.ServicesPath.LeadLogService);
let CommonHelper = require(_pathconst.FilesPath.CommonHelper);
let { emailQueueLead, cplq, cplqn } = require(_pathconst.FilesPath.Queue);
const axios = require("axios");
const { sendMisReportExportEmailQueue } = require("../../../../jobs");
const { generatePDF } = require("../../../helpers/GeneratePdf");
const { isFinanceRootUser, isManualReviewBank, isBankFileMatchExcluded } = require("../../../services/finance-services");
const { SAME_DAY_BILLING_TIME } = require("../../../helpers/constantdata/config");
const { setupSSE } = require("../../../helpers/sse-progress-helper");
let ApplicationLogServices = require(_pathconst.ServicesPath.ApplicationLogServices);
let FinanceServices = require(_pathconst.ServicesPath.FinanceServices);
let ApiFieldMappings = require(_pathconst.FilesPath.ApiFieldMappings);
const KafkaServices = require("../../../services/kafka-services");

const create = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.create.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { mobile, prefix, user_fname, user_mname, user_lname, email, source, lead_source, status, assigned_to, pan, is_fresh_lead, profession, category, alt_mobile, channel_manager, potential, dob, lead_type, payout_percentage, has_done_loan_buisness, year_loan_buisness, has_coonector_code, has_reapplied, secondary_email, address_home, address_buisness } = req.body;
            if (dob) {
                dob = new Date(dob);
            }
            let { address, city, state, pincode } = address_home;
            let { address1, city1, state1, pincode1 } = address_buisness;
            let additional_information = { has_done_loan_buisness, year_loan_buisness, has_coonector_code, has_reapplied, secondary_email };
            let lead = await LeadService.getUserWithPanEmailMobile(mobile, email, pan);
            if (lead) {
                ResHelper.apiResponse(res, false, "Lead with same detials already exist ", 400, {}, "");
            } else {
                if (assigned_to) {
                    assigned_to = await UserService.getFirstUserByRole('MIS_EXECUTIVE');
                    if (!assigned_to) {
                        ResHelper.apiResponse(res, false, "Assigned To User not found", 400, {}, "");
                        return;
                    }
                    assigned_to = assigned_to.id;
                }
                let assigned = await UserService.getUserById(assigned_to);
                if (!assigned) {
                    ResHelper.apiResponse(res, false, "Assigned To User not found", 400, {}, "");
                } else {
                    let manager = await UserService.getUserById(channel_manager);
                    if (!manager) {
                        ResHelper.apiResponse(res, false, "Manager not  found", 400, {}, "");
                    } else {
                        lead = await LeadService.create({ mobile, prefix, user_fname, user_mname, user_lname, email, source, lead_source, status, assigned_to, pan, is_fresh_lead, profession, category, channel_manager, alt_mobile, potential, dob, lead_type, payout_percentage });
                        await LeadLogService.create({ lead_id: lead.id, from: null, to: null, updated_by: req.loggedInUser.id, type: '', operation_type: 'lead-create' });
                        address_home = await LeadService.createAddress({ lead_id: lead.id, ...address_home, type: "home" });
                        await LeadLogService.create({ lead_id: lead.id, from: null, to: null, updated_by: req.loggedInUser.id, type: '', operation_type: 'lead-home-address-create' });
                        address_buisness = await LeadService.createAddress({ lead_id: lead.id, ...address_buisness, type: "buisness" });
                        await LeadLogService.create({ lead_id: lead.id, from: null, to: null, updated_by: req.loggedInUser.id, type: '', operation_type: 'lead-business-address-create' });
                        additional_information = await LeadService.createInformation({ lead_id: lead.id, ...additional_information });
                        await LeadLogService.create({ lead_id: lead.id, from: null, to: null, updated_by: req.loggedInUser.id, type: '', operation_type: 'lead-additional-information-create' });
                        cplq.add({ id: lead.id, payout_percentage });
                        ResHelper.apiResponse(res, true, "Success", 200, { lead, address: { address_home, address_buisness }, additional_information }, "");
                    }
                }
            }
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const createV2 = async (req, res, next) => {
    const { step, isUpdated } = req.body;


    try {
        switch (step) {
            case 1:
                const error1 = LeadValidationV1.createPan.validate(req.body)?.error;
                if (error1) {
                    ResHelper.apiResponse(res, false, _.startCase(error1.message), 400, {}, "");
                    return;
                } {
                    const panDetails = await LeadService.createPan(req.body, req?.loggedInUser);
                    let { result, leadExist, step, existMessage } = panDetails;
                    existMessage = !isUpdated ? existMessage : "";

                    if (isUpdated) {
                        let diffrence = CommonHelper.jsonDifference({ step, leadId: result?.id, isUpdated, ...result }, { ...req?.body });
                        await LeadLogService.bulkCreate({ lead_id: result?.id, diffrence, diffrence, updated_by: req.loggedInUser.id, operation_type: 'lead-details-update' });
                    } else {
                        await LeadLogService.create({ lead_id: result?.id, from: null, to: null, updated_by: req.loggedInUser.id, type: '', operation_type: 'lead-create' });
                    }

                    ResHelper.apiResponse(res, true, "Success", 200, { result, leadExist, step, existMessage });
                    return;
                }

            case 2:
                const error2 = LeadValidationV1.createLead.validate(req.body)?.error;
                if (error2) {
                    ResHelper.apiResponse(res, false, _.startCase(error2.message), 400, {}, "");
                    return;
                } else {
                    const { assigned_to, channel_manager } = req?.body
                    if (!assigned_to) {
                        assigned_to = await UserService.getFirstUserByRole('MIS_EXECUTIVE');
                        if (!assigned_to) {

                            ResHelper.apiResponse(res, false, "Assigned To User not found", 400, {}, "");
                            return;
                        }
                        assigned_to = assigned_to.id;
                    }
                    let assigned = await UserService.getUserById(assigned_to);
                    if (!assigned) {
                        return ResHelper.apiResponse(res, false, "Assigned To User not found", 400, {}, "");
                    } else {
                        let manager = await UserService.getUserById(channel_manager);
                        if (!manager && channel_manager) {
                            ResHelper.apiResponse(res, false, "Manager not  found", 400, {}, "");
                            return;
                        } else {
                            const { leadId } = req?.body;
                            const leadDetails = await LeadService.createLead(req.body);
                            const { previousData, newData, step } = leadDetails;
                            if (isUpdated && previousData?.assigned_to !== null) {
                                let diffrence = CommonHelper.jsonDifference(previousData, newData);
                                await LeadLogService.bulkCreate({ lead_id: leadId, diffrence, diffrence, updated_by: req.loggedInUser.id, operation_type: 'lead-details-update', user_mobile: previousData?.mobile, user_fname: previousData?.user_fname });
                            } else {
                                await LeadLogService.create({ lead_id: leadId, from: null, to: null, updated_by: req.loggedInUser.id, type: '', operation_type: 'lead-details-create' });
                            }

                            ResHelper.apiResponse(res, true, "Success", 200, { newData, step });
                            return;
                        }
                    }
                }

            case 3:
                const error3 = LeadValidationV1.createAddress.validate(req.body)?.error;
                if (error3) {
                    ResHelper.apiResponse(res, false, _.startCase(error3.message), 400, {}, "");
                    return;
                } else {
                    const { address_home, address_buisness } = req.body;
                    const { leadId } = req.body;
                    const address_homeData = await LeadService.createAddressV2({ lead_id: leadId, step: req?.body?.step, ...address_home, type: "home" });

                    if (isUpdated && address_homeData?.previousData) {
                        let diffrence = CommonHelper.jsonDifference(address_homeData?.previousData, { ...address_home });
                        await LeadLogService.bulkCreate({ lead_id: leadId, diffrence, diffrence, updated_by: req.loggedInUser.id, operation_type: 'lead-home-address-update' });
                    } else {
                        await LeadLogService.create({ lead_id: leadId, from: null, to: null, updated_by: req.loggedInUser.id, type: '', operation_type: 'lead-home-address-create' });
                    }

                    const address_buisnessData = await LeadService.createAddressV2({ lead_id: leadId, step: req?.body?.step, ...address_buisness, type: "buisness" });
                    const { previousData, newData, step } = address_buisnessData;

                    if (isUpdated && previousData) {
                        let diffrence = CommonHelper.jsonDifference({ step, leadId, isUpdated, ...previousData }, { ...address_buisness });
                        await LeadLogService.bulkCreate({ lead_id: leadId, diffrence, diffrence, updated_by: req.loggedInUser.id, operation_type: 'lead-business-address-update' });
                    } else {
                        await LeadLogService.create({ lead_id: leadId, from: null, to: null, updated_by: req.loggedInUser.id, type: '', operation_type: 'lead-business-address-create' });
                    }

                    ResHelper.apiResponse(res, true, "Success", 200, { newData, step });
                    return;
                }

            case 4:
                const error4 = LeadValidationV1.createCustomInformation.validate(req.body)?.error;
                if (error4) {
                    ResHelper.apiResponse(res, false, _.startCase(error4.message), 400, {}, "");
                    return;
                } else {
                    const { leadId } = req?.body
                    let additional_information = await LeadService.createCustomInformation({ lead_id: leadId, ...req?.body });
                    const { previousData, newData, step } = additional_information;

                    if (isUpdated && previousData) {
                        let diffrence = CommonHelper.jsonDifference({ step, leadId, isUpdated, ...previousData }, { ...req?.body });
                        await LeadLogService.bulkCreate({ lead_id: leadId, diffrence, diffrence, updated_by: req.loggedInUser.id, operation_type: 'lead-additional-information-update' });
                    } else {
                        await LeadLogService.create({ lead_id: leadId, from: null, to: null, updated_by: req.loggedInUser.id, type: '', operation_type: 'lead-additional-information-create' });
                    }

                    ResHelper.apiResponse(res, true, "Success", 200, { newData, step });
                    return;
                }

            case 5:
                const error5 = LeadValidationV1.createPayoutInformation.validate(req.body)?.error;
                if (error5) {
                    return ResHelper.apiResponse(res, false, _.startCase(error5.message), 400, {}, "");
                } else {
                    const { leadId } = req?.body
                    let payout_information = await LeadService.createPayoutInformation(req.body);
                    const { previousData, newData, step } = payout_information;

                    if (isUpdated && previousData) {
                        let diffrence = CommonHelper.jsonDifference({ step, leadId, isUpdated, ...previousData }, { ...req?.body });
                        await LeadLogService.bulkCreate({ lead_id: leadId, diffrence, diffrence, updated_by: req.loggedInUser.id, operation_type: 'lead-additional-information-update' });
                    } else {
                        await LeadLogService.create({ lead_id: leadId, from: null, to: null, updated_by: req.loggedInUser.id, type: '', operation_type: 'lead-additional-information-create' });
                    }

                    return ResHelper.apiResponse(res, true, "Success", 200, { newData, step });
                }

            case 6:
                const error6 = LeadValidationV1.createCrmUser.validate(req.body)?.error;
                if (error6) {
                    ResHelper.apiResponse(res, false, _.startCase(error6.message), 400, {}, "");
                    return;
                } else {
                    const { leadId } = req?.body
                    let create_crm_user = await LeadService.createCrmUser(req.body);
                    const { previousData, newData, step } = create_crm_user;

                    if (isUpdated) {
                        let diffrence = CommonHelper.jsonDifference({ step, leadId, isUpdated, ...previousData }, { ...req?.body });
                        await LeadLogService.bulkCreate({ lead_id: leadId, diffrence, diffrence, updated_by: req.loggedInUser.id, operation_type: 'lead-additional-information-update' });
                    } else {
                        await LeadLogService.create({ lead_id: leadId, from: null, to: null, updated_by: req.loggedInUser.id, type: '', operation_type: 'lead-additional-information-create' });
                    }

                    ResHelper.apiResponse(res, true, "Success", 200, { newData, step });
                    return;
                }

            default:
                ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
                return;
        }
    }
    catch (e) {
        console.log(e)
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
        return;
    }
}

const createExternal = async (req, res, next) => {
    try {
        let staticUser = await LeadService.getUnauthUser();
        const { step } = req.body;
        switch (step) {
            case 1:
                const error1 = LeadValidationV1.createExternalPan.validate(req.body)?.error;
                if (error1) {
                    ResHelper.apiResponse(res, false, _.startCase(error1.message), 400, {}, "");
                    return;
                } else {
                    let panDetails = await LeadService.createExternalPan({ assigned_to: staticUser?.assign_to, channel_manager: staticUser?.channel_manager, ...req.body });
                    let { newData, existMessage, reapply_count } = panDetails;
                    await LeadLogService.create({ lead_id: newData?.id, from: null, to: null, updated_by: staticUser?.assign_to, type: '', operation_type: 'lead-create' });
                    ResHelper.apiResponse(res, true, existMessage || "Success", 200, { reapply_count });
                    return;
                }

            case 2:
                const error2 = LeadValidationV1.createExternalLead.validate(req.body)?.error;
                if (error2) {
                    ResHelper.apiResponse(res, false, _.startCase(error2.message), 400, {}, "");
                    return;
                } else {
                    let leadDetails = await LeadService.createExternalLead(req.body);
                    const { result } = leadDetails;
                    await LeadLogService.create({ lead_id: result?.lead_id, from: null, to: null, updated_by: staticUser?.assign_to, type: '', operation_type: 'lead-additional-information-create' });
                    ResHelper.apiResponse(res, true, "Success", 200, { result });
                    return;
                }

            default:
                ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
                return;
        }

    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
        return;
    }
}

const update = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.update.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let updatedAt = new Date();
            let { id, mobile, prefix, user_fname, user_mname, user_lname, email, source, lead_source, status, assigned_to, pan, is_fresh_lead, profession, category, alt_mobile, channel_manager, potential, dob, lead_type, payout_percentage, has_done_loan_buisness, year_loan_buisness, has_coonector_code, has_reapplied, secondary_email, address_home, address_buisness } = req.body;
            if (dob) {
                dob = new Date(dob);
            }
            let additional_information_data = { has_done_loan_buisness, year_loan_buisness, has_coonector_code, has_reapplied, secondary_email };
            let lead = await LeadService.getLeadById(id);
            if (!lead) {
                ResHelper.apiResponse(res, false, " Lead not found ", 400, {}, "");
            } else {
                lead = await LeadService.getOtherUserWithPanEmailMobile(mobile, email, pan, id);
                if (lead) {
                    ResHelper.apiResponse(res, false, "Lead with same detials already exist . Please provide unique pan , email or mobile number for this user", 400, {}, "");
                } else {
                    let assigned = await UserService.getUserById(assigned_to);
                    if (!assigned) {
                        ResHelper.apiResponse(res, false, "Assigned To User not found", 400, {}, "");
                    } else {
                        let manager = await UserService.getUserById(channel_manager);
                        if (!manager) {
                            ResHelper.apiResponse(res, false, "Manager not  found", 400, {}, "");
                        } else {
                            lead = await LeadService.getLeadById(id);
                            let leadTemp = lead;
                            let old_payout_percentage = lead.payout_percentage;
                            lead = await LeadService.update({ mobile, prefix, user_fname, user_mname, user_lname, email, source, updatedAt, lead_source, status, assigned_to, pan, is_fresh_lead, profession, category, channel_manager, alt_mobile, potential, dob, lead_type, payout_percentage }, id);
                            if (leadTemp.assigned_to != assigned_to) {
                                let assignedOld = await UserService.getUserById(leadTemp.assigned_to);
                                await LeadLogService.create({ lead_id: lead.id, from: assignedOld.userName, to: assigned.userName, updated_by: req.loggedInUser.id, type: '', operation_type: 'lead-assigned-to-changed' });
                            }
                            let address_home_get = await LeadService.getAddressForLead(id, 'home');
                            if (address_home_get && Object.keys(address_home_get).length != 0) {
                                let diffrence = CommonHelper.jsonDifference(address_home_get.home, { ...address_home, type: "home" });
                                address_home_get = await LeadService.updateAddress({ ...address_home, type: "home" }, id);
                                await LeadLogService.bulkCreate({ lead_id: lead.id, diffrence, diffrence, updated_by: req.loggedInUser.id, operation_type: 'lead-home-address-update' });
                            } else {
                                address_home_get = await LeadService.createAddress({ lead_id: lead.id, ...address_home, type: "home" });
                                await LeadLogService.create({ lead_id: lead.id, from: null, to: null, updated_by: req.loggedInUser.id, type: '', operation_type: 'lead-home-address-create' });
                            }
                            let address_buisness_get = await LeadService.getAddressForLead(id, 'buisness');
                            if (address_buisness_get && Object.keys(address_buisness_get).length != 0) {
                                let diffrence = CommonHelper.jsonDifference(address_buisness_get.buisness, { ...address_buisness, type: "buisness" });
                                address_buisness_get = await LeadService.updateAddress({ ...address_buisness, type: "buisness" }, id);
                                await LeadLogService.bulkCreate({ lead_id: lead.id, diffrence, diffrence, updated_by: req.loggedInUser.id, operation_type: 'lead-buisness-address-update' });
                            } else {
                                address_buisness_get = await LeadService.createAddress({ lead_id: lead.id, ...address_buisness, type: "buisness" });
                                await LeadLogService.create({ lead_id: lead.id, from: null, to: null, updated_by: req.loggedInUser.id, type: '', operation_type: 'lead-buisness-address-create' });
                            }
                            let additional_information = await LeadService.getLeadInformation(id);
                            if (additional_information) {
                                let diffrence = CommonHelper.jsonDifference(additional_information, { ...additional_information_data });
                                additional_information = await LeadService.updateInformation({ ...additional_information_data }, id);
                                await LeadLogService.bulkCreate({ lead_id: lead.id, diffrence, diffrence, updated_by: req.loggedInUser.id, operation_type: 'lead-additional-information-update' });
                            } else {
                                additional_information = await LeadService.createInformation({ lead_id: lead.id, ...additional_information });
                                await LeadLogService.create({ lead_id: lead.id, from: null, to: null, updated_by: req.loggedInUser.id, type: '', operation_type: 'lead-additional-information-create' });
                            }
                            if (payout_percentage != old_payout_percentage) {
                                await LeadService.deleteLeadPayout(lead.id);
                                cplq.add({ id: lead.id, payout_percentage, update: false });
                            }
                            ResHelper.apiResponse(res, true, "Success", 200, { lead, address: { address_home, address_buisness }, additional_information }, "");
                        }
                    }
                }
            }
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const updateAssignee = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.updateAssignee.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { leadIdArray, assignTo } = req?.body;
            for (let i = 0; i < leadIdArray?.length; i++) {
                let update_assignee = await LeadService?.updateAssignee({ leadId: leadIdArray[i], assignTo });
                const { previousData } = update_assignee;
                let diffrence = CommonHelper.jsonDifference({ ...previousData }, { assigned_to: req?.body?.assignTo });
                await LeadLogService.bulkCreate({ lead_id: leadIdArray[i], diffrence, diffrence, updated_by: req.loggedInUser.id, operation_type: 'updated-assigned-to' });
            }
            ResHelper.apiResponse(res, true, "Success", 200, "", "");
        }
    }
    catch (e) {
        console.log(e)
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const lead = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.lead.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { id } = req.body;
            let lead = await LeadService.getLeadById(id);
            ResHelper.apiResponse(res, true, 'success', 200, lead, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const leadV2 = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.lead.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { id } = req.body;
            let lead = await LeadService.getLeadByIdV2(id);
            ResHelper.apiResponse(res, true, 'success', 200, lead, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}


const leads = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.leads.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, startDateFilter, endDateFilter, user_fname, user_mname, user_lname, email, assigned_to, channel_manager, is_fresh_lead, mobile, pan, lead_type, lead_source, status, utm_campaign, utm_term, utm_content, utm_medium, assignDateStartFilter, assignDateEndFilter, assigned_to_name, state, city, profession, is_export } = req.body;
            let where = ``;

            let checkWhere = () => {
                if (where.includes("where") || is_export) {
                    where += " and "
                } else {
                    where += "where "
                }
            }

            if (Boolean(state || city) && !is_export) {
                where += ` left join lead_address la on la.lead_id = l.id where la.type = "home" `;
            }
            if (state) {
                checkWhere();
                where += `la.state like '%${state}%'`;
            }
            if (city) {
                checkWhere();
                where += ` la.city like '%${city}%' `;
            }
            if (profession) {
                checkWhere();
                where += ` lp.value like '%${profession}%' `;
            }
            if (req.loggedInUser.role != 'CEO') {
                checkWhere();
                where += ` l.assigned_to = uuid_to_bin("${req.loggedInUser.id}") `;
            }
            if (startDateFilter) {
                checkWhere();
                where += `DATE(l.createdAt) between DATE("${startDateFilter}") and DATE("${endDateFilter}")`
            }
            if (user_fname) {
                checkWhere();
                where += `l.user_fname like '%${user_fname}%'`
            }
            if (user_mname) {
                checkWhere();
                where += `l.user_mname like '%${user_mname}%'`
            }
            if (user_lname) {
                checkWhere();
                where += `l.user_lname like '%${user_lname}%'`
            }
            if (email) {
                checkWhere();
                where += `l.email like '%${email}%'`
            }
            if (assigned_to) {
                checkWhere();
                where += `l.assigned_to = uuid_to_bin('${assigned_to}')`
            }
            if (assigned_to_name) {
                checkWhere();
                where += `a.name like '%${assigned_to_name}%'`
            }
            if (assignDateStartFilter) {
                checkWhere();
                where += `DATE(l.assigned_to_date) between DATE("${assignDateStartFilter}") and DATE("${assignDateEndFilter}")`
            }
            if (channel_manager) {
                checkWhere();
                where += `l.channel_manager = uuid_to_bin('${channel_manager}')`
            }
            if (is_fresh_lead) {
                checkWhere();
                where += `l.is_fresh_lead = ${is_fresh_lead}`
            }
            if (mobile) {
                checkWhere();
                where += `l.mobile like '%${mobile}%'`
            }
            if (pan) {
                checkWhere();
                where += `l.pan like '%${pan}%'`
            }
            if (lead_type) {
                checkWhere();
                where += `lt.value like '%${lead_type}%'`
            }
            if (lead_source) {
                checkWhere();
                where += `lsr.value like '%${lead_source}%'`
            }
            if (status) {
                checkWhere();
                where += `case when ls.value is null then "Cold" else ls.value end like '%${status}%'`
            }
            if (utm_campaign) {
                checkWhere();
                where += `l.utm_campaign like '%${utm_campaign}%'`
            }
            if (utm_term) {
                checkWhere();
                where += `l.utm_term like '%${utm_term}%'`
            }
            if (utm_content) {
                checkWhere();
                where += `l.utm_content like '%${utm_content}%'`
            }
            if (utm_medium) {
                checkWhere();
                where += `l.utm_medium like '%${utm_medium}%'`
            }
            let leads = [];
            if (is_export) {
                leads = await LeadService.getLeadsExport(where, pageNumber * pageSize, pageSize, req.loggedInUser.id, req.loggedInUser.role);
            } else {
                leads = await LeadService.getLeads(where, pageNumber * pageSize, pageSize, req.loggedInUser.id, req.loggedInUser.role);
            }
            ResHelper.apiResponse(res, true, 'success', 200, leads, "");
        }
    }
    catch (e) {
        console.log(e)
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const deleteLead = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.deleteLead.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { id } = req.body;
            let lead = await LeadService.findLead(id, false);
            if (!lead || lead.length == 0) {
                ResHelper.apiResponse(res, false, error, "User does not exit", 400, {}, "");
            } else {
                await LeadService.deleteLead(id);
                ResHelper.apiResponse(res, true, "User deleted", 201, {}, "");
            }
        }
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const followLead = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.followLead.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { leadId, userId } = req.body;
            let lead = await LeadService.followLead(leadId, userId);
            ResHelper.apiResponse(res, true, " Followed ", 201, {}, "");
        }
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const unFollowLead = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.followLead.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { leadId, userId } = req.body;
            let lead = await LeadService.unFollowLead(leadId, userId);
            ResHelper.apiResponse(res, true, "Unfollowed", 201, {}, "");
        }
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getStaredLeadForUser = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.getStaredLeadForUser.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { userId } = req.body;
            let leads = await LeadService.getStaredLeadForUser(userId);
            ResHelper.apiResponse(res, true, "Success", 200, leads, "");
        }
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getLeadPayouts = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.getLeadPayouts.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { leadId, pageNumber, pageSize, search, phone, bank_name_filter, main_product_filter, sub_product_filter, payout_percentage_lead_filter } = req.body;
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }
            let searchList = [];
            let where = [];
            let payout_percentage;
            if (phone) {
                where.push([' lp.phone ', `  =  `, phone]);
                payout_percentage = await LeadService.getDsaPayoutPercentage(phone);
            } else {
                where.push([' lp.user_id ', `  = uuid_to_bin('${leadId}') `, null]);
                payout_percentage = await LeadService.getLeadPayoutPercentage(leadId);
            }
            if (bank_name_filter) {
                where.push([' p.bank_name ', ` like `, `%${bank_name_filter}%`]);
            }
            if (main_product_filter) {
                where.push([' p.main_product ', `  like  `, `%${main_product_filter}%`]);
            }
            if (sub_product_filter) {
                where.push([' p.sub_product ', `  like  `, `%${sub_product_filter}%`]);
            }
            if (payout_percentage_lead_filter) {
                where.push([' lp.percentage ', `  like  `, `%${payout_percentage_lead_filter}%`]);
            }
            if (search) {
                searchList.push([' p.bank_name ', 'like', `%${search}%`]);
            }
            let payouts = await LeadService.getLeadPayouts(pageNumber * pageSize, pageSize, searchList, where);
            ResHelper.apiResponse(res, true, "Success", 200, { payout_percentage, payouts }, "");
        }
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const downloadLeadPayout = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.downloadLeadPayout.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        else {
            const { dsa_mobile_number } = req.body
            let data = await LeadService.getDsaPayoutHook(dsa_mobile_number)
            let { customer_full_name } = await DSAService.getDsaByPhone(dsa_mobile_number)

            const payouts = data?.payouts;

            if (!payouts || payouts.length == 0) {
                return ResHelper.apiResponse(res, false, "No Data Found", 400, {}, "");
            }


            const payload = {
                data: payouts,
                customer_full_name: customer_full_name
            }
            const pdfBuffer = await generatePDF("pdfTemplateForPayout", payload);

            await fs.promises.writeFile(appRoot + 'report.pdf', pdfBuffer);
            const base64String = await pdfBuffer.toString('base64');

            const url = await uploadToS3("lead_payout", base64String, dsa_mobile_number, 'application/pdf', 'pdf');
            ResHelper.apiResponse(res, true, "Success", 200, url, "");
        }
    }
    catch (err) {
        console.log(err)
        logger.error(err)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}
const downloadLeadPayoutExternal = async (req, res, next) => {
    try {
        if (!req.dsa.dsa_mobile_number) {
            return ResHelper.apiResponse(res, false, "Dsa mobile Number not found", 404, {}, "");
        }

        if (!req.dsa.access_control) {
            return ResHelper.apiResponse(res, false, "Not permissied", 403, {}, "");
        }

        const permissions = req.dsa.access_control.split(",");

        if (!permissions.includes("find_payout")) {
            return ResHelper.apiResponse(res, false, "Not permissied", 403, {}, "");
        }

        const dsa_mobile_number = req.dsa.dsa_mobile_number
        let data = await LeadService.getDsaPayoutHook(dsa_mobile_number)
        let { customer_full_name } = await DSAService.getDsaByPhone(dsa_mobile_number)

        const payouts = data?.payouts;

        if (!payouts || payouts.length == 0) {
            return ResHelper.apiResponse(res, false, "No Data Found", 404, {}, "");
        }

        const payload = {
            data: payouts,
            customer_full_name: customer_full_name
        }

        const pdfBuffer = await generatePDF("pdfTemplateForPayout", payload);

        await fs.promises.writeFile(appRoot + 'report.pdf', pdfBuffer);
        const base64String = await pdfBuffer.toString('base64');

        const url = await uploadToS3("lead_payout", base64String, dsa_mobile_number, 'application/pdf', 'pdf');
        ResHelper.apiResponse(res, true, "Success", 200, url, "");
    }
    catch (err) {
        //console.log(err)
        logger.error(err)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const convertLeadDsaPayout = async (req, res, next) => {
    try {
        let { phone } = req.body;
        if (!phone) {
            ResHelper.apiResponse(res, false, "Please send the mandatory fields ", 400, {}, "");
        } else {
            let lead_payout = await LeadService.findLeadPayout(phone);
            if (lead_payout) {
                await LeadService.updateLeadConverted(phone, true);
            } else {
                let payout_percentage = process.env.DEFAULT_PAYOUT;
                await LeadService.deleteLeadPayoutPhone(phone);
                await LeadService.insertDsaPayoutPercentage(phone, payout_percentage)
                cplq.add({ id: null, phone, payout_percentage });
            }
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}


const getLeadPayoutDetails = async (req, res, next) => {
    try {
        let { phone, bank_id, product_id } = req.body;
        if (!phone || !bank_id || !product_id) {
            ResHelper.apiResponse(res, false, "Please send the mandatory fields ", 400, {}, "");
        } else {
            let payout_details = await LeadService.getLeadPayoutDetails(phone, bank_id, product_id);
            ResHelper.apiResponse(res, true, "Success", 201, payout_details, "");
        }
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const updateLeadDsaPayout = async (req, res, next) => {
    try {
        let { phone, payout_percentage } = req.body;
        if (!phone) {
            ResHelper.apiResponse(res, false, "Please send the mandatory fields ", 400, {}, "");
        } else {
            let lead_payout = await LeadService.findLeadPayout(phone);
            if (!lead_payout) {
                await LeadService.createLeadPayout(phone, payout_percentage);
                lead_payout = await LeadService.findLeadPayout(phone);
            };

            //delete all the payouts for this dsa
            if (!payout_percentage) {
                payout_percentage = process.env.DEFAULT_PAYOUT;
            }
            let locked_payout = await LeadService.getLockedPayout(phone);
            if (locked_payout?.length) {
                let payouts = [];
                for (i = 0; i < locked_payout?.length; i++) {
                    payouts?.push(locked_payout[i]?.payout_id)
                }
                locked_payout = payouts;
            };

            await LeadService.deleteLeadPayoutPhone(phone, locked_payout);
            let payout_percenatge_old = await LeadService.getDsaPayoutPercentageData(phone);
            if (!payout_percenatge_old) {
                await LeadService.insertDsaPayoutPercentage(phone, payout_percentage);
                cplq.add({ id: null, phone, payout_percentage, update: false, locked_payout });
            } else {
                await LeadService.updateDsaPayoutPercentage(phone, payout_percentage, true)
                cplq.add({ id: null, phone, payout_percentage, update: false, locked_payout });
            }
            //  cplq.add({id:null,phone,payout_percentage,update:true});
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    }
    catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getDsaPayoutHook = async (req, res, next) => {
    try {
        let { phone, pageNumber, pageSize } = req.body;
        if (!phone) {
            ResHelper.apiResponse(res, false, "Please send the mandatory fields ", 400, {}, "");
        } else {
            let payouts;
            if (pageNumber) {
                payouts = await LeadService.getDsaPayoutHook(phone, pageNumber * pageSize, pageSize);
            } else {
                payouts = await LeadService.getDsaPayoutHook(phone, pageNumber * pageSize, pageSize);
            }
            ResHelper.apiResponse(res, true, "Success", 201, payouts, "");
        }
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error in Parameters", 500, {}, "");
    }
}

const getDsaPayoutExternal = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.getDsaPayoutExternal.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        let {
            pageNumber,
            pageSize,
            bank_name_filter,
            main_product_filter,
            payout_percentage_filter,
            payout_ratio_filter,
            sub_product_filter,
            product_filter,
            login_code_filter,
        } = req.body;

        let phone = req.dsa.dsa_mobile_number;
        let where = "";

        // Add filter conditions
        if (bank_name_filter) {
            where += ` and (p.bank_name like '%${bank_name_filter}%')`;
        }

        if (main_product_filter) {
            where += ` and (p.main_product like '%${main_product_filter}%')`;
        }

        /* if (payout_percentage_filter) {
            where += ` and (lp.percentage = ${payout_percentage_filter})`;
        }

        if (payout_ratio_filter) {
            where += ` and (lp.ratio = ${payout_ratio_filter})`;
        } */

        if (sub_product_filter) {
            where += ` and (p.sub_product like '%${sub_product_filter}%')`;
        }

        if (product_filter) {
            where += ` and (p.product like '%${product_filter}%')`;
        }

        if (login_code_filter) {
            where += ` and (p.login_code like '%${login_code_filter}%')`;
        }

        let payouts = await LeadService.getDsaPayouts(phone, pageNumber * pageSize, pageSize, where);
        ResHelper.apiResponse(res, true, "Success", 201, payouts, "");
    }
    catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error in Parameters", 500, {}, "");
    }
}


const getDsaPayoutUpdatedHook = async (req, res, next) => {
    try {
        let { phone, pageNumber, pageSize } = req.body;
        if (!phone) {
            ResHelper.apiResponse(res, false, "Please send the mandatory fields ", 400, {}, "");
        } else {
            let payouts;
            if (pageNumber) {
                payouts = await LeadService.getDsaPayoutUpdatedHook(phone, pageNumber * pageSize, pageSize);
            } else {
                payouts = await LeadService.getDsaPayoutUpdatedHook(phone, pageNumber * pageSize, pageSize);
            }
            ResHelper.apiResponse(res, true, "Success", 201, payouts, "");
        }
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error in Parameters", 500, {}, "");
    }
}
const downloadLeadList = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.downloadLeadList.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize } = req.body;
            let leads = await LeadService.getLeads(null, pageNumber * pageSize, pageSize, req.loggedInUser.id);
            leads = leads.data;
            if (!leads || leads.length == 0) {
                ResHelper.apiResponse(res, false, "No Data Found", 400, {}, "");
                return;
            }
            let fields = Object.keys(leads[0]);
            const opts = { fields };
            const parser = new Parser(opts);
            const csv = parser.parse(leads);
            await fs.promises.writeFile(appRoot + '/temp.csv', csv);
            let base64 = await fs.promises.readFile(appRoot + '/temp.csv', 'base64')
            let uniqueString = randomstring.generate();
            let uniqueString1 = randomstring.generate();
            let url = await uploadToS3("leads", base64, uniqueString1 + uniqueString, 'application/octet-stream', 'csv');
            ResHelper.apiResponse(res, true, "Success", 200, url, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const updateLeadPayout = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.updateLeadPayout.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { id, payout_percentage, payoutLock } = req.body;
            let max = await LeadService.getMaxPayoutValidation(id);
            if (payout_percentage > max) {
                return ResHelper.apiResponse(res, false, `Payout percentage should be less than or equal to ${max}.`, 400, {}, "");
            };
            await LeadService.updateLeadPayout(id, payout_percentage, payoutLock);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getCallStatus = async (req, res, next) => {
    try {
        let status = await LeadService.getCallStatus();
        ResHelper.apiResponse(res, true, "Success", 200, status, "");
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getLeadReport = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.getLeadReport.validate(req?.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { pageNumber, pageSize, startDateFilter, endDateFilter, type } = req?.body;
            let lead_logs;
            if (type == "channel_partners") {
                lead_logs = await LeadService.getPartnerAssignReport(pageSize * pageNumber, pageSize, startDateFilter, endDateFilter);
            } else {
                lead_logs = await LeadService.getLeadAssignReport(pageSize * pageNumber, pageSize, startDateFilter, endDateFilter);
            }
            ResHelper.apiResponse(res, true, "Success", 200, lead_logs, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getWhereFromStatus = (data) => {
    let { status, only_disbursed } = data;
    let where = ` where flc.fresh_lead_status_id = ${status} `;
    if ((status == "0" || status == "13") && only_disbursed) {
        where += ` and flc.multi_funded_flag in (-1, 2)`;
    };

    if (status === "payout_pending") {
        where = ` where flc.fresh_lead_status_id in (0, 13) and (case when flc.user_type = 'company' then cdsa.assigning_payout_percentage is null or cdsa.assigning_payout_percentage = 0 else d.assigning_payout_percentage is null or d.assigning_payout_percentage = 0 end) and flc.claim_pending_flag = 1 and flc.multi_funded_flag in (-1, 2)`;
    };

    if (status === "multi_funded_pending") {
        where = ` where flc.fresh_lead_status_id in (0, 13) and flc.multi_funded_flag = 0 `;
    };

    if (status === "multi_funded_confirmed") {
        where = ` where flc.fresh_lead_status_id in (0, 13) and flc.multi_funded_flag = 1 `;
    };

    if (status === "claim_pending") {
        where = ` where flc.claim_pending_flag = 0 and flc.multi_funded_flag in (-1, 2)`;
    };

    if (status == "1") {
        where = ` where flc.fresh_lead_status_id not in (0,13) `;
    };

    if (status == "3") {
        where = ` where flc.is_deleted = 1 `;
    };

    if (status == "approved") {
        where = ` where flc.fresh_lead_status_id  in (1,6) `;
    };

    if (status == "banker_pending") {
        where = ` where flc.fresh_lead_status_id in (13) and (flc.ai_status is null) and flc.multi_funded_flag in (-1, 2) `;
    };

    if (status == "banker_confirmed") {
        where = ` where flc.fresh_lead_status_id in (13) and flc.ai_status = 'confirmed' and flc.multi_funded_flag in (-1, 2) `;
    };

    if (status == "banker_partial_match") {
        where = ` where flc.fresh_lead_status_id in (13) and flc.ai_status = 'partial_matched' and flc.multi_funded_flag in (-1, 2) `;
    };

    if (status == "banker_failed") {
        where = ` where flc.fresh_lead_status_id in (13) and flc.ai_status = 'failed' and flc.multi_funded_flag in (-1, 2) `;
    };

    if (status == "banker_on_hold") {
        where = ` where flc.fresh_lead_status_id in (13) and flc.ai_status = 'on_hold' and flc.multi_funded_flag in (-1, 2) `;
    };

    if (status == "banker_processed") {
        where = ` where flc.fresh_lead_status_id != 13 and flc.ai_status is not null `;
    };

    if (status == "banker_consolidated_ai_status") {
        where = ` where flc.fresh_lead_status_id in (13) and flc.ai_status is not null and flc.multi_funded_flag in (-1, 2) `;
    };

    if (status == "wip") {
        where = ` where flc.fresh_lead_status_id  in (2,5,9,10,11,12) `;
    };

    if (status == "not_found") {
        where = ` where flc.fresh_lead_status_id in (4,-1) `;
    };

    if (status == "error") {
        where = ` where flc.fresh_lead_status_id  in (3,7,8) `
    };

    if (status == "consolidated") {
        only_disbursed = true;
        status = 3
        where = ` where flc.is_deleted is not null `; //we have to show deleted claim as well in consolidated leads
    };

    if (status == "claimed_instant_claim") {
        only_disbursed = true;
        status = 3
        where = " where flc.form_type = 'instant_claim' and flc.claim_pending_flag = 1 and flc.is_deleted = 0 ";
    }

    if (status == "unclaimed_instant_claim") {
        only_disbursed = true;
        status = 3
        where = " where flc.form_type = 'instant_claim' and flc.claim_pending_flag = 0 and flc.is_deleted = 0 ";
    }

    if (status == "instant_claim") {
        only_disbursed = true;
        status = 3
        where = " where flc.form_type = 'instant_claim' and flc.is_deleted = 0 ";
    }

    if (!only_disbursed) {
        where = ` where flc.form_type = "customer_lead_form" `;
    };

    if (status != "3") {
        where += ` and flc.is_deleted = 0 `;
    };

    if (only_disbursed && status !== 3) {
        where += ` and (flc.upload_file_name is not null or flc.loan_status = "disbursed") `;
    };

    return where;
};

const getWhereFromFilters = (where, body) => {
    const { business_category_filter, ai_status_filter, near_by_search, user_remark_filter, pf_collected_filter, loan_type_filter, dsa_mobile_filter, bh_name_filter, dsa_pan_filter, customer_pan_filter, remark_filter, platform_filter, form_type_filter, netsuite_vendor_id_filter, loan_status_filter, reject_reason_filter, is_split_case_filter, search, createdDateStartFilter, createdDateEndFilter, updatedDateStartFilter, updatedDateEndFilter, requestDateStartFilter, claim_month_filter, loan_reference_id_filter, loan_apac_ref_los_number_filter, customer_full_name_filter, disbursement_date_iso_filter, disbursement_amount_filter, bank_name_filter, product_name_filter, vendor_payout_rate_filter, vendor_payout_ratio_filter, vendor_payout_amount_filter, payout_collide_filter, dsa_name_filter, city_filter, customer_company_name_filter, fresh_lead_id_filter, vendor_payout_type_filter, upload_file_name_filter, created_by_filter, netsuite_bank_id, netsuite_product_id, fresh_lead_id, current_hierarchy_crm_filter, partner_name_filter, class_id_filter, ns_contest_id_filter, current_hierarchy_path_filter, ns_contest_title_filter, is_tentative_matched_filter, bank_file_matched_filter, is_online_lead_filter, is_same_day_billing_enabled_filter } = body;
    if (search) {
        where += ` and (flc.customer_full_name like '%${search}%' or d.full_name like '%${search}%' or kyc.permanent_account_number like '%${search}%') `
    };
    /* if (pf_collected_filter) {
        where += ` and (flc.pf_collected like '%${pf_collected_filter}%') `
    };
    if (loan_type_filter) {
        where += ` and (flc.loan_type like '%${loan_type_filter}%') `
    }; */
    // NOTE: created_at date filters are handled in getLeadForms with sargable range predicates.
    if (updatedDateStartFilter) {
        where += ` and DATE(flc.updated_at) between DATE("${updatedDateStartFilter}") and DATE("${updatedDateEndFilter}")`
    };
    /* if (bh_name_filter) {
        where += ` and (bh.full_name like '%${bh_name_filter}%') `;
    }; */
    /* if (remark_filter) {
        where += ` and (r.remark_description like '%${remark_filter}%') `;
    }; */
    if (user_remark_filter) {
        where += ` and (flc.user_remark like '%${user_remark_filter}%') `;
    };
    /* if (customer_pan_filter) {
        where += ` and (c.permanent_account_number like '%${customer_pan_filter}%') `;
    }; */
    if (dsa_pan_filter) {
        where += ` and (kyc.permanent_account_number like '%${dsa_pan_filter}%') `;
    };
    /* if (requestDateStartFilter) {
        where += ` and (flc.request_date like '%${requestDateStartFilter}%') `;
    }; */
    if (claim_month_filter) {
        where += ` and (flc.claim_month like '%${claim_month_filter}%') `
    };
    if (platform_filter) {
        where += ` and (flc.platform like '%${platform_filter}%') `
    };
    /* if (netsuite_bank_id) {
        where += ` and (flc.netsuite_bank_id like '%${netsuite_bank_id}%') `
    };
    if (netsuite_product_id) {
        where += ` and (flc.netsuite_product_id like '%${netsuite_product_id}%') `
    }; */
    if (is_same_day_billing_enabled_filter !== undefined && is_same_day_billing_enabled_filter !== null && is_same_day_billing_enabled_filter !== '') {
        if (is_same_day_billing_enabled_filter === false || is_same_day_billing_enabled_filter === 'false' || is_same_day_billing_enabled_filter === 0 || is_same_day_billing_enabled_filter === '0') {
            where += ` and ((flc.user_type = 'company' and (cdsa.is_same_day_billing_enabled = 0 or cdsa.is_same_day_billing_enabled is null)) or (ifnull(flc.user_type, '') <> 'company' and (d.is_same_day_billing_enabled = 0 or d.is_same_day_billing_enabled is null)))`;
        } else if (is_same_day_billing_enabled_filter === true || is_same_day_billing_enabled_filter === 'true' || is_same_day_billing_enabled_filter === 1 || is_same_day_billing_enabled_filter === '1') {
            where += ` and ((flc.user_type = 'company' and cdsa.is_same_day_billing_enabled = 1) or (ifnull(flc.user_type, '') <> 'company' and d.is_same_day_billing_enabled = 1))`;
        }
    }
    if (form_type_filter) {
        where += ` and (flc.form_type like '%${form_type_filter}%') `
    };
    if (netsuite_vendor_id_filter) {
        where += ` and (flc.netsuite_vendor_claim_file_internal_id like '%${netsuite_vendor_id_filter}%') `
    };
    if (loan_reference_id_filter) {
        where += ` and (flc.loan_reference_id like '%${loan_reference_id_filter}%') `
    };
    /* if (loan_status_filter) {
        where += ` and (flc.loan_status like '%${loan_status_filter}%') `
    }; */
    if (reject_reason_filter) {
        where += ` and (flc.reject_reason like '%${reject_reason_filter}%') `
    };
    // Loan APAC/LOS Number
    if (loan_apac_ref_los_number_filter) {
        where += ` and (flc.loan_apac_ref_los_number like '%${loan_apac_ref_los_number_filter}%') `;
    };
    // Customer Full Name
    if (customer_full_name_filter) {
        where += ` and (flc.customer_full_name like '%${customer_full_name_filter}%') `;
    };
    // Disbursement Date ISO
    if (disbursement_date_iso_filter) {
        where += ` and (flc.disbursement_date_iso like '%${disbursement_date_iso_filter}%') `;
    };
    // Disbursement Amount
    if (disbursement_amount_filter) {
        where += ` and (flc.disbursement_amount like '%${disbursement_amount_filter}%') `;
    };
    // Bank Name
    if (bank_name_filter) {
        where += ` and (flc.bank_name like '%${bank_name_filter}%') `;
    };
    // Product Name
    if (product_name_filter) {
        where += ` and (flc.product_name like '%${product_name_filter}%') `;
    };
    // Vendor Payout Rate
    if (vendor_payout_rate_filter) {
        where += ` and (flc.vendor_payout_rate like '%${vendor_payout_rate_filter}%') `;
    };
    // Vendor Payout Ratio
    if (vendor_payout_ratio_filter) {
        where += ` and (flc.vendor_payout_ratio like '%${vendor_payout_ratio_filter}%') `;
    };
    // Vendor Payout Amount
    if (vendor_payout_amount_filter) {
        where += ` and (flc.vendor_payout_amount like '%${vendor_payout_amount_filter}%') `;
    };
    // Payout Collide
    /* if (payout_collide_filter) {
        where += ` and (case when flc.payout_collide = 0 then "no" else "yes" end like '%${payout_collide_filter}%') `;
    }; */
    // DSA Name
    if (dsa_name_filter) {
        where += ` and (d.full_name like '%${dsa_name_filter}%') `;
    };
    // DSA mobile
    if (dsa_mobile_filter) {
        where += ` and (d.dsa_mobile_number like '%${dsa_mobile_filter}%') `;
    };
    // City
    /* if (city_filter) {
        where += ` and (flc.city like '%${city_filter}%') `;
    };
    // Customer Company Name
    if (customer_company_name_filter) {
        where += ` and (flc.customer_company_name like '%${customer_company_name_filter}%') `;
    };
    // Fresh Lead ID
    if (fresh_lead_id_filter) {
        where += ` and (flc.fresh_lead_id like '%${fresh_lead_id_filter}%') `;
    }; */
    // Upload File Name
    if (upload_file_name_filter) {
        where += ` and (case when flc.upload_file_name is null then "Self" else flc.upload_file_name end like '%${upload_file_name_filter}%') `;
    };
    if (vendor_payout_type_filter) {
        where += ` and (flc.vendor_payout_type like '%${vendor_payout_type_filter}%') `;
    };
    /* if (created_by_filter) {
        where += ` and (flc.created_by like '%${created_by_filter}%') `;
    }; */
    if (is_split_case_filter) {
        where += ` and (flc.is_split_case like '%${is_split_case_filter}%') `;
    };
    if (near_by_search) {
        where += ` and (flc.nearby_matched != '1') `;
    };

    if (business_category_filter) {
        where += ` and (flc.business_categories = '${business_category_filter}') `;
    };
    if (ai_status_filter) {
        where += ` and (flc.ai_status = '${ai_status_filter}') `;
    };

    if (fresh_lead_id.length) {
        const quotedIds = fresh_lead_id.map(id => `'${id}'`).join(',');
        where += ` and (flc.fresh_lead_id in (${quotedIds}))`;
    }
    if (current_hierarchy_crm_filter) {
        where += ` and (flc.current_hierarchy_crm like '%${current_hierarchy_crm_filter}%')`
    }
    /* if (class_id_filter) {
        where += ` and (flc.class_id like '%${class_id_filter}%')`
    }
    if (partner_name_filter) {
        where += ` and (p.full_name like '%${partner_name_filter}%')`
    }
    if (ns_contest_id_filter) {
        where += ` and (flc.ns_contest_id = ${ns_contest_id_filter})`
    } */
    if (current_hierarchy_path_filter) {
        where += ` and (flc.dsa_id = '${current_hierarchy_path_filter}' and flc.is_deleted = 0)`
    }
    /* if (ns_contest_title_filter) {
        where += ` and (re.title like '%${ns_contest_title_filter}%')`
    } */
    // Filter for bank file match (main OR tentative); bank_file_matched_filter preferred, is_tentative_matched_filter kept as alias
    const bankFileMatchedFilterValue = bank_file_matched_filter !== undefined && bank_file_matched_filter !== null && bank_file_matched_filter !== ''
        ? bank_file_matched_filter
        : is_tentative_matched_filter;
    if (bankFileMatchedFilterValue !== undefined && bankFileMatchedFilterValue !== null && bankFileMatchedFilterValue !== '') {
        if (bankFileMatchedFilterValue === false || bankFileMatchedFilterValue === 'false' || bankFileMatchedFilterValue === 0 || bankFileMatchedFilterValue === '0') {
            where += ` and (COALESCE(flcm.is_tentative_matched, 0) = 0 AND COALESCE(flcm.is_bank_file_matched, 0) = 0)`
        } else if (bankFileMatchedFilterValue === true || bankFileMatchedFilterValue === 'true' || bankFileMatchedFilterValue === 1 || bankFileMatchedFilterValue === '1') {
            where += ` and (flcm.is_tentative_matched = 1 OR flcm.is_bank_file_matched = 1)`
        }
    }
    /* if (is_online_lead_filter !== undefined && is_online_lead_filter !== null && is_online_lead_filter !== '') {
        if (is_online_lead_filter === false || is_online_lead_filter === 'false' || is_online_lead_filter === 0 || is_online_lead_filter === '0') {
            // For 0/false,, search for offline leads
            where += ` and (flcm.is_online_lead = 0 OR flcm.is_online_lead IS NULL)`
        } else if (is_online_lead_filter === true || is_online_lead_filter === 'true' || is_online_lead_filter === 1 || is_online_lead_filter === '1') {
            // For 1/true, search for online leads
            where += ` and flcm.is_online_lead = 1`
        }
    } */
    return where;
};

const getLeadFormDetailsById = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.getLeadFormDetailsById.validate(req?.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const id = req?.body?.id;
            const { leadForm } = await LeadService.getLeadFormDetailsById(id);
            const statusId = leadForm?.fresh_lead_status_id != null ? Number(leadForm.fresh_lead_status_id) : null;
            const is_editable = statusId === 0 || statusId === 13;
            ResHelper.apiResponse(res, true, "Success", 200, { leadForm, is_editable }, "");
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getLeadFormRemarks = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.getLeadFormRemarks.validate(req?.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const id = req?.body?.id;
            const response = await LeadService.getLeadFormRemarksByFreshLeadId(id);
            const { application_id, ...remarksForApi } = response || {};
            ResHelper.apiResponse(res, true, "Success", 200, remarksForApi, "");
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const REMARK_TABLE_MAP = {
    vendor_remark: 'ru_fresh_lead_claims',
    user_remark: 'ru_fresh_lead_claims',
    reject_reason: 'ru_fresh_lead_claims',
    claim_confirmation: 'ru_fresh_lead_claims',
    audit_remark: 'ru_fresh_lead_claims_meta',
    claim_confirmation_remark: 'ru_fresh_lead_claims_meta',
};

const updateLeadFormRemark = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.updateLeadFormRemark.validate(req?.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { id, remark_type, value } = req?.body;
            const claimRow = await LeadService.getLeadFormRemarksByFreshLeadId(id);
            const oldValueKey = (remark_type === 'audit_remark' || remark_type === 'claim_confirmation_remark') ? `ns_${remark_type}` : remark_type;
            const oldValue = claimRow ? claimRow[oldValueKey] : null;

            if (remark_type === 'claim_confirmation' && value !== undefined && value !== null) {
                const prevDataResult = await LeadClaimService.getClaimForEdit(id);
                const prevData = prevDataResult?.records;
                const saveCheck = FinanceServices.validateManualReconciliationSave({
                    claim_confirmation: value,
                    loan_number: prevData?.loan_number,
                    application_no: prevData?.apac_ref_los_number,
                    loan_amount: prevData?.disbursement_amount,
                    ns_audit_remark: claimRow?.ns_audit_remark,
                    expected_billing_month: prevData?.expected_billing_month,
                });
                if (!saveCheck.isValid) {
                    return ResHelper.apiResponse(res, false, saveCheck.message, 400, {}, "");
                }
            }

            const result = await LeadService.updateLeadFormRemark(id, remark_type, value, REMARK_TABLE_MAP[remark_type]);
            if (!result.success) {
                return ResHelper.apiResponse(res, false, result.message || "Update failed", 400, {}, "");
            }

            if (remark_type === 'claim_confirmation' && value !== undefined && value !== null) {
                const normalized = CommonHelper.formatEventName(value) || '';
                if (normalized === 'verified' || normalized === 'verified_with_exception') {
                    await DSAService.moveToPendingLeadForm([id], req.loggedInUser?.id, undefined, true);
                }
            }

            if (claimRow?.application_id != null && req?.loggedInUser?.id) {
                const fromVal = oldValue != null ? String(oldValue) : '';
                const toVal = value != null ? String(value) : '';
                const difference = [[remark_type, fromVal, toVal]];
                await ApplicationLogServices.bulkCreate(difference, claimRow.application_id, "lead_claim_update", req.loggedInUser.id);
            }
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getLeadForms = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.getLeadForms.validate(req?.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { dsa_mobile_number, export_title, is_export, sort_field, sort_order, pageNumber, pageSize, status, current_hierarchy_path_filter, sortBy, sortDirection, count_only, data_only } = req?.body;
            sort_field = sort_field || sortBy;
            sort_order = sort_order || sortDirection;

            let where = getWhereFromFilters(!dsa_mobile_number ? getWhereFromStatus(req?.body) : ` where flc.fresh_lead_id is not null and flc.is_deleted = "0" `, req?.body);

            //let childPhonesQuery = ` flc.dsa_mobile_number IN (WITH RECURSIVE DSAHierarchy AS (SELECT dsa_mobile_number, partner_code FROM ru_direct_selling_agents WHERE dsa_mobile_number = "${req?.loggedInUser ? req?.loggedInUser?.userPhone : dsa_mobile_number}" UNION ALL SELECT t.dsa_mobile_number, t.partner_code FROM ru_direct_selling_agents t INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number) SELECT dsa_mobile_number FROM DSAHierarchy) `;
            let childPhonesQuery = ` flc.current_hierarchy_path like "%${req?.loggedInUser ? req?.loggedInUser?.dsa_id : req?.dsa?.dsa_id}%" `;

            /* if (req?.loggedInUser && isBackendAccessRole(req.loggedInUser.role)) {
                let dsa = await DSAService.getDsaFullDetailsPhone(req?.loggedInUser?.userPhone);
                //req.loggedInUser.userPhone = dsa?.partner_code;
                parentDsaId = dsa?.dsa_id;
                childPhonesQuery += ` or flc.current_hierarchy_path like "%${parentDsaId}%" `;
            }; */

            let custom_select_string = `, 
                    case 
                    WHEN flc.form_type = 'customer_lead_form' AND 
                    (flc.loan_status IS NULL OR flc.loan_status != 'disbursed') THEN NULL
                    when flc.is_deleted = 1 then "deleted"
                    when flc.multi_funded_flag = 0 then "multi_funded_pending"
                    when flc.multi_funded_flag = 1 then "multi_funded_confirmed"
                    when flc.fresh_lead_status_id in (13) then (
                        CASE 
                            WHEN flc.ai_status IS NULL THEN 'banker_pending'
                            ELSE 'banker_consolidated_ai_status'
                        END
                    )
                    when flc.fresh_lead_status_id in (0) then "pending" 

                    when flc.fresh_lead_status_id in (1,6) then "approved_erp"
                    when flc.fresh_lead_status_id in (2,5,9,10,11,12) then "wip_erp"
                    when flc.fresh_lead_status_id in (4) then "not_found_erp"
                    when flc.fresh_lead_status_id in (3,7,8) then "error_erp"
                    end as `;

            //external api logic starts;
            if (!req?.loggedInUser) {
                custom_select_string += ` fresh_lead_status_name `;
                req.body["only_disbursed"] = true;
                where += ` and ${childPhonesQuery} `;
            }
            //external api logic ends;
            else {
                custom_select_string += ` category `;
                if (status != "consolidated" && req.body["only_disbursed"]) {
                    custom_select_string = "";
                };
                if (!(req.loggedInUser.role == "CEO" || isBackendAccessRole(req.loggedInUser.role) || req.loggedInUser.role == "VENDOR")) {
                    where += req.loggedInUser.role == "BACKEND" ? ` and flc.created_by = '${req?.loggedInUser?.id}' ` : ` and (${childPhonesQuery} or flc.created_by = '${req?.loggedInUser?.id}') `;
                };
                if (req.loggedInUser.role == "VENDOR") {
                    where += ` and (${childPhonesQuery} or flc.created_by = '${req?.loggedInUser?.id}') `;
                };
                if (isBackendAccessRole(req.loggedInUser.role)) {
                    let parent = await UserService.findUserByPhoneOrEmail(req.loggedInUser.parentEmail, req.loggedInUser.parentEmail)
                    where += ` and ( (${childPhonesQuery} or flc.created_by = '${req?.loggedInUser?.id}' or flc.created_by = '${parent.id}'${parent?.dsa_id ? ` or flc.current_hierarchy_path like "%${parent?.dsa_id}%"` : ''}) )`;
                };
            };
            //roles and hierarchy logic ends;


            // Refactored for DataGrid Pro
            const { filterModel, logicOperator, createdDateStartFilter, createdDateEndFilter, updatedDateStartFilter, updatedDateEndFilter } = req.body;
            let whereFilterQuery = "";

            if (createdDateStartFilter && createdDateEndFilter) {
                where += ` and flc.created_at >= "${createdDateStartFilter} 00:00:00" and flc.created_at < DATE_ADD("${createdDateEndFilter}", INTERVAL 1 DAY) `;
            }
            if (updatedDateStartFilter) {
                where += ` and DATE(flc.updated_at) >= DATE("${updatedDateStartFilter}") `;
            }
            if (updatedDateEndFilter) {
                where += ` and DATE(flc.updated_at) <= DATE("${updatedDateEndFilter}") `;
            }

            if (filterModel && filterModel.items.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getLeadFormsFieldMapping, operatorHandlers, logicOperator);

                if (whereFilterArray && whereFilterArray.length > 0) {
                    const filters = whereFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    whereFilterQuery = filters.join(logicOp);
                }
            }

            // Append generated filter query to existing where clause
            if (whereFilterQuery) {
                where += ` and (${whereFilterQuery}) `;
            }

            if (is_export) {
                const { totalCount, leadForms, query, queryCount, bindParams } = await LeadService.getLeadForms(sort_field, sort_order, pageSize * pageNumber, pageSize, where, null, is_export, "", false);
                if (totalCount > 5000) {
                    sendMisReportExportEmailQueue.add({
                        query,
                        queryCount,
                        bindParams,
                        subject: export_title,
                        filename: export_title,
                        loggedInUser: req?.loggedInUser,
                        fileType: 'xlsx'
                    });
                    return ResHelper.apiResponse(res, true, { type: "email", message: "Report will be sent to your email after some time." }, 200, {}, "");
                }
                let file = await uploadArrayToS3(leadForms, export_title);
                await ApplicationLogServices?.createExportLog(req);
                ResHelper.apiResponse(res, true, { type: "url", file }, 200, {}, "");
            } else {
                let lead_forms = await LeadService.getLeadForms(sort_field, sort_order, pageSize * pageNumber, pageSize, where, null, is_export, custom_select_string, !!count_only, !!data_only);

                ResHelper.apiResponse(res, true, "Success", 200, lead_forms, "");
            };
        };
    }
    catch (e) {
        console.log(e);
        ResHelper.apiResponse(res, false, e.message, 500, {}, "");
    }
};

const verifyPanViaAuthBridgeV2 = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.verifyPanViaAuthBridgeV2.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { fresh_lead_id, force_retry = false } = req.body;
            const result = await DSAService.verifyPanViaAuthBridgeV2(fresh_lead_id, force_retry);

            // Return the AuthBridge response directly
            const statusCode = result.code || (result.status === 1 ? 200 : 400);
            ResHelper.apiResponse(res, result.status === 1, result.message || "PAN verification completed", statusCode, result.data || {}, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const pushDSAToNS = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.pushDSAToNS.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const { dsa_id, user_type } = req?.body;
        const finalUserType = user_type || "Channel Partner";

        // Proceed with NetSuite API call
        const options = {
            method: 'POST',
            data: { dsa_id, user_type: finalUserType },
            url: `${process.env.MS_URL}/api/dsa/fix-ns-vendor-id`,
            headers: {
                'api-key': process.env.AUTH_KEY_RULOANS_BANK_CLAIM,
                'Content-Type': 'application/json'
            },
            validateStatus: () => true,
        };

        axios(options)
            .then((response) => {
                const { status, message } = response?.data || {};
                if (Boolean(status)) {
                    ResHelper.apiResponse(res, true, message, 200, response?.data, "");
                } else {
                    ResHelper.apiResponse(res, false, message || "Failed to push DSA to NetSuite", 400, {}, "");
                }
            })
            .catch((error) => {
                logger.error(error);
                return ResHelper.apiResponse(res, false, "Error occurred during NetSuite API call", 500, {}, "");
            });
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getProductOrBankDropdown = async (req, res, next) => {
    try {
        req.body = req.loggedInUser ? req.body : req.query;
        const { error } = LeadValidationV1.getProductOrBankDropdown.validate(req?.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { type, bank_id, product_id, pageSize, pageNumber, search, active_only } = req?.body;

            // Helper function to safely split bank_id
            const parseIds = (id) => {
                if (!id) return null;
                return id.split(',').map(id => id.trim()).filter(id => id !== '');
            };

            const bankIdArray = parseIds(bank_id);
            const productIdArray = parseIds(product_id);
            let where = "";
            if (search) {
                let productSearch = ` (p.product_name like '%${search}%' or p.short_name like '%${search}%' or p.netsuite_product_id like '%${search}%') `;
                let bankSearch = ` (b.bank_name like '%${search}%' or b.netsuite_bank_id like '%${search}%')`;
                if (type == "product") {
                    where += ` ${productSearch} `;
                } else if (type == "bank") {
                    where += ` ${bankSearch} `;
                }
            }
            let data = await LeadService.getProductOrBankDropdown(type, bankIdArray, productIdArray, pageSize, pageNumber, where, active_only);
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getNetsuiteBankList = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.getNetsuiteBankList.validate(req?.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize } = req?.body;
            const where = buildNetsuiteBankListWhere(req?.body || {});
            let data = await LeadService.getNetsuiteBankList(pageNumber * pageSize, pageSize, where);
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

/**
 * Shared WHERE builder for Netsuite bank list + export.
 * Supports legacy filters and MUI filterModel (same contract for both APIs).
 */
const buildNetsuiteBankListWhere = (body = {}) => {
    const {
        status_filter,
        netsuite_bank_id_filter,
        bank_name_filter,
        startDateFilter,
        endDateFilter,
        bank_id,
        filterModel,
        logicOperator,
    } = body;

    let where = "";

    if (netsuite_bank_id_filter) {
        where = checkWhereInQueryString(where);
        where += ` netsuite_bank_id like '%${netsuite_bank_id_filter}%' `;
    }
    if (bank_name_filter) {
        where = checkWhereInQueryString(where);
        where += ` bank_name like '%${bank_name_filter}%' `;
    }
    if (startDateFilter) {
        where = checkWhereInQueryString(where);
        where += ` DATE(created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `;
    }
    if (bank_id) {
        where = checkWhereInQueryString(where);
        where += ` nb.netsuite_bank_id = '${bank_id}' `;
    }
    if (status_filter || status_filter === 0 || status_filter === "0") {
        where = checkWhereInQueryString(where);
        if (String(status_filter) === "0") {
            where += ` nb.status = 0 or nb.status is null`;
        } else {
            where += ` nb.status like '%${status_filter}%' `;
        }
    }

    let whereFilterQuery = "";
    if (filterModel && filterModel.items?.length > 0) {
        const operatorHandlers = CustomOperatorHandlers();
        const whereFilterArray = CreateWhereQueryFilter(
            filterModel,
            ApiFieldMappings.getNetsuiteBankListFieldMapping,
            operatorHandlers
        );

        if (whereFilterArray && whereFilterArray.length > 0) {
            const filters = whereFilterArray
                .map((item) => {
                    const [field, op, val] = item;
                    return formatGetLeadFormsFilterClause(field, op, val);
                })
                .filter(Boolean);
            const logicOp = logicOperator === "or" ? " OR " : " AND ";
            whereFilterQuery = filters.join(logicOp);
        }
    }

    if (whereFilterQuery) {
        where = checkWhereInQueryString(where);
        where += `(${whereFilterQuery})`;
    }

    return where;
};

/**
 * Export Netsuite Banks/NBFCs as CSV → S3.
 * Uses the same filters as getNetsuiteBankList so CSV matches the FE grid.
 * If no filters are sent, defaults to active banks only (vendor-sharing).
 */
const exportNetsuiteBankList = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.exportNetsuiteBankList.validate(req?.body || {});
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        let where = buildNetsuiteBankListWhere(req?.body || {});
        // Backward-compatible default when FE sends no filters
        if (!where) {
            where = " WHERE nb.status = 1 ";
        }

        const { records } = await LeadService.getNetsuiteBankList(null, null, where);

        if (!records || records.length === 0) {
            return ResHelper.apiResponse(res, false, "No Data Found", 400, {}, "");
        }

        const allProductIds = records.flatMap((row) =>
            String(row.product_ids || "")
                .split(",")
                .map((id) => id.trim())
                .filter(Boolean)
        );
        const productNameMap = await LeadService.getNetsuiteProductNamesByIds(allProductIds);

        const formatProducts = (productIds) => {
            const ids = String(productIds || "")
                .split(",")
                .map((id) => id.trim())
                .filter(Boolean);
            if (!ids.length) return "";
            // One product per line so Excel/Sheets is readable (enable Wrap Text if needed)
            return ids
                .map((id) => {
                    const name = productNameMap[id];
                    return name ? `${id} - ${name}` : id;
                })
                .join("\n");
        };

        const formatStatus = (status) => {
            if (status === 1 || status === "1") return "Active";
            if (status === 0 || status === "0" || status == null || status === "") return "Inactive";
            return String(status);
        };

        const exportRows = records.map((row) => ({
            bank_name: row.bank_name || "",
            netsuite_bank_id: row.netsuite_bank_id || "",
            status: formatStatus(row.status),
            grade: row.grade || "",
            pan: row.pan || "",
            registered_on_company_name: row.registered_on_company_name || "",
            external_id: row.external_id || "",
            product_count: row.product_count || 0,
            products: formatProducts(row.product_ids),
            remarks: row.remarks || "",
            created_at: row.created_at || "",
            updated_at: row.updated_at || "",
        }));

        // Title Case CSV headers for vendor-friendly export
        const fields = [
            { label: "Bank Name", value: "bank_name" },
            { label: "Netsuite Bank ID", value: "netsuite_bank_id" },
            { label: "Status", value: "status" },
            { label: "Grade", value: "grade" },
            { label: "PAN", value: "pan" },
            { label: "Registered On Company Name", value: "registered_on_company_name" },
            { label: "External ID", value: "external_id" },
            { label: "Product Count", value: "product_count" },
            { label: "Products", value: "products" },
            { label: "Remarks", value: "remarks" },
            { label: "Created At", value: "created_at" },
            { label: "Updated At", value: "updated_at" },
        ];
        const parser = new Parser({ fields });
        const csv = parser.parse(exportRows);

        await fs.promises.writeFile(appRoot + "/temp.csv", csv);
        const base64 = await fs.promises.readFile(appRoot + "/temp.csv", "base64");
        const uniqueString = randomstring.generate();
        const uniqueString1 = randomstring.generate();
        const url = await uploadToS3(
            "netsuite_banks",
            base64,
            uniqueString1 + uniqueString,
            "application/octet-stream",
            "csv"
        );

        await ApplicationLogServices?.createExportLog(req);

        return ResHelper.apiResponse(res, true, "Success", 200, url, "");
    } catch (error) {
        logger.error(error);
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getNetsuiteProductList = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.getNetsuiteProductList.validate(req?.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, netsuite_product_id_filter, product_name_filter, main_product_filter, short_name_filter, remarks_filter, category_filter, status_filter, startDateFilter, endDateFilter, edit_product_id, filterModel, logicOperator } = req?.body;

            // Legacy filters — unchanged behaviour
            let where = "";
            if (netsuite_product_id_filter) {
                where = checkWhereInQueryString(where);
                where += ` p.netsuite_product_id like '%${netsuite_product_id_filter}%' `;
            };
            if (product_name_filter) {
                where = checkWhereInQueryString(where);
                where += ` p.product_name like '%${product_name_filter}%' `;
            };
            if (main_product_filter) {
                where = checkWhereInQueryString(where);
                where += ` p.main_product like '%${main_product_filter}%' `;
            };
            if (short_name_filter) {
                where = checkWhereInQueryString(where);
                where += ` p.short_name like '%${short_name_filter}%' `;
            };
            if (remarks_filter) {
                where = checkWhereInQueryString(where);
                where += ` p.remarks like '%${remarks_filter}%' `;
            };
            if (category_filter) {
                where = checkWhereInQueryString(where);
                where += ` p.category like '%${category_filter}%' `;
            };
            if (status_filter) {
                where = checkWhereInQueryString(where);
                if (status_filter == "0") {
                    where += ` p.status = 0 or p.status is null`;
                } else {
                    where += ` p.status like '%${status_filter}%' `;
                }
            };
            if (startDateFilter) {
                where = checkWhereInQueryString(where);
                where += ` DATE(p.created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `;
            };

            // MUI X DataGrid filterModel — same pattern as getLeadForms / getNetsuiteBankList
            let whereFilterQuery = "";
            if (filterModel && filterModel.items.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getNetsuiteProductListFieldMapping, operatorHandlers);

                if (whereFilterArray && whereFilterArray.length > 0) {
                    const filters = whereFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    whereFilterQuery = filters.join(logicOp);
                }
            }

            if (whereFilterQuery) {
                where = checkWhereInQueryString(where);
                where += `(${whereFilterQuery})`;
            }

            let data = await LeadService.getNetsuiteProductList(pageNumber * pageSize, pageSize, where, edit_product_id);
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const createOrUpdateNetsuiteProduct = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.createOrUpdateNetsuiteProduct.validate(req?.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const userId = req.loggedInUser.id;
            const { netsuite_product_id, product_id } = req.body;
            const product = await LeadService.findProductNameById(netsuite_product_id)
            // product with same netsuite_product_id already exists
            if (product && product.id != product_id) {
                return ResHelper.apiResponse(res, false, "Product with same Netsuite Product Id already exists", 400, {}, "");
            };
            let prevData = null;
            if (product_id) {
                prevData = await LeadService?.getNetsuiteProductList(null, null, null, product_id)
                prevData = prevData?.records
            }
            let data = await LeadService.createOrUpdateNetsuiteProduct(req.body, prevData, userId);
            if (product_id) {
                const difference = CommonHelper.jsonDifference({ ...prevData }, { ...req.body });
                ApplicationLogServices.bulkCreate(difference, product_id, "netsuite_product_update", userId)
            }
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const setBankFileOnVcf = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.setBankFileOnVcf.validate(req?.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { startDateFilter, endDateFilter, vendor_claimfile_internalid, bank_id, fresh_lead_id } = req?.body;
            let bankfile_internalid = await LeadService.getInternalIdBankFile(bank_id);
            bankfile_internalid = bankfile_internalid?.internal_id;
            if (!bankfile_internalid) {
                return ResHelper.apiResponse(res, false, "Bank internal id not found.", 400, {}, "");
            };

            const data = await callNsApi({
                "api": "customscript_rest_set_bankfile_on_vcf",
                "payload": {
                    vendor_claimfile_internalid,
                    bankfile_internalid
                }
            });
            const { error, message, Code } = data;
            console.log(data);
            if (error) {
                return ResHelper.apiResponse(res, false, error?.message, 400, error, "");
            };
            await LeadService.updateFreshLeadStatus("nearby_matched = 1", fresh_lead_id);
            return ResHelper.apiResponse(res, true, message, 200, {}, "");
        }
    }
    catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};



const getAllBankProductCombination = async (req, res) => {
    try {
        const { error } = LeadValidationV1.getAllBankProductCombination.validate(req.body)
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "")
        }

        const { login_code_filter, avg_achievment_filter, autonomous_payout_capping_filter, id, netsuite_bank_id_filter, netsuite_product_id_filter, product_name_filter, bank_name_filter, main_product_filter, short_name_filter, remarks_filter, category_filter, status_filter, search, pageNumber, pageSize, filterModel, logicOperator, count_only } = req.body;
        let where = [];

        if (id) {
            where.push(`bpc.id = '${id}'`)
        }

        if (netsuite_bank_id_filter) {
            where.push(` (nb.netsuite_bank_id like '%${netsuite_bank_id_filter}%') `);
        }

        if (netsuite_product_id_filter) {
            where.push(` (np.netsuite_product_id like '%${netsuite_product_id_filter}%') `);
        }

        if (product_name_filter) {
            where.push(` (np.product_name like '%${product_name_filter}%') `);
        }

        if (bank_name_filter) {
            where.push(` (nb.bank_name like '%${bank_name_filter}%') `);
        }

        if (main_product_filter) {
            where.push(` (np.main_product like '%${main_product_filter}%') `);
        }

        if (short_name_filter) {
            where.push(` (np.short_name like '%${short_name_filter}%') `);
        }

        if (remarks_filter) {
            where.push(` (np.remarks like '%${remarks_filter}%') `);
        }

        if (category_filter) {
            where.push(` (np.category like '%${category_filter}%') `);
        }

        if (status_filter) {
            if (status_filter == "0") {
                where.push(` (np.status = 0 or nb.status = 0 or bpc.status = 0) `);
            } else if (status_filter == "1") {
                where.push(` (np.status is null or np.status <> 0) and (nb.status is null or nb.status <> 0) and (bpc.status is null or bpc.status <> 0) `);
            } else {
                where.push(` (np.status = '${status_filter}') `);
            }
        };

        if (login_code_filter) {
            where.push(` (d.login_code like '%${login_code_filter}%') `);
        }

        if (avg_achievment_filter) {
            where.push(` (d.avg_achievment like '%${avg_achievment_filter}%') `);
        }

        if (autonomous_payout_capping_filter) {
            where.push(` (bpc.autonomous_payout_capping like '%${autonomous_payout_capping_filter}%') `);
        }

        if (search && typeof search === 'string') {
            const tokens = search.trim().split(/\s+/).filter(Boolean).map(token => String(token).toLowerCase().replace(/'/g, "''"));
            if (tokens.length > 0) {
                const tokenConditions = tokens.map(token => `(LOWER(np.product_name) LIKE '%${token}%' OR LOWER(nb.bank_name) LIKE '%${token}%')`).join(' AND ');
                where.push(`(${tokenConditions})`);
            }
        }

        if (where.length > 0) {
            where = where.join(" and ");
        } else {
            where = null;
        }

        // MUI X DataGrid filterModel — same pattern as getLeadForms / getNetsuiteBankList
        let whereFilterQuery = "";
        if (filterModel && filterModel.items.length > 0) {
            const operatorHandlers = CustomOperatorHandlers();
            const whereFilterArray = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getAllBankProductCombinationFieldMapping, operatorHandlers);

            if (whereFilterArray && whereFilterArray.length > 0) {
                const filters = whereFilterArray
                    .map((item) => {
                        const [field, op, val] = item;
                        return formatGetLeadFormsFilterClause(field, op, val);
                    })
                    .filter(Boolean);
                const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                whereFilterQuery = filters.join(logicOp);
            }
        }

        if (whereFilterQuery) {
            where = where ? `${where} and (${whereFilterQuery})` : `(${whereFilterQuery})`;
        }

        //let isMaster = checkMasterRole(req?.loggedInUser?.role)

        const data = await LeadService.getAllBankProductCombination(where, pageNumber * pageSize, pageSize, true);
        if (!data) {
            return ResHelper.apiResponse(res, false, "No data found", 400, {}, "");
        }
        if (count_only) {
            return ResHelper.apiResponse(res, true, "Success", 200, { totalRecords: data.totalRecords }, "");
        }
        ResHelper.apiResponse(res, true, "Success", 200, data, "");
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
}

const editBusinessCategory = async (req, res) => {
    try {
        const { error } = LeadValidationV1.editBusinessCategory.validate(req.body)
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "")
        }
        //verify if the logged in user have the access of root privilages or not
        const user_id = req?.loggedInUser?.id
        const isMaster = await isFinanceRootUser(req?.loggedInUser?.userPhone);

        if (!isMaster) {
            return ResHelper.apiResponse(res, false, "Permission Denied", 403, {}, "");
        }

        const { fresh_lead_id, new_business_category } = req.body;

        let prevData = await LeadService?.getLeadFormByFreshLeadId(fresh_lead_id)

        //verify if lead already exists or not
        if (!prevData) {
            return ResHelper.apiResponse(res, false, "Previous Lead form not found", 400, {}, "");
        }

        let data = await LeadService?.editBusinessCategory(fresh_lead_id, new_business_category, prevData, user_id)
        ResHelper.apiResponse(res, true, "Success", 200, data, "");
    }
    catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
}


const updateLeadFormAutonomousStatus = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.updateLeadFormAutonomousStatus.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { fresh_lead_id, same_day_billing, to_be_billed, payout_type, rate, ratio } = req.body;
            const currentHour = new Date().getHours();
            if (same_day_billing && currentHour >= SAME_DAY_BILLING_TIME) {

                const time = new Date();
                time.setHours(SAME_DAY_BILLING_TIME, 0, 0);
                const formattedTime = time.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });

                return ResHelper.apiResponse(res, false, `Same day billing is not available post ${formattedTime}`, 400, {}, "");
            }

            let lead = await LeadService.getLeadFormByFreshLeadId(fresh_lead_id)
            if (!lead) {
                return ResHelper.apiResponse(res, false, "Lead not found", 404, {}, "");
            }

            // Check if is_tentative_matched is true in ru_fresh_lead_claims_meta
            /* const meta = await LeadService.getTentativeMatchedStatus(fresh_lead_id);
            if (!meta.is_tentative_matched) {
                return ResHelper.apiResponse(res, false, "Same day billing is not available for this Lead", 400, {}, "");
            } */

            if (!lead?.disbursement_date) {
                return ResHelper.apiResponse(res, false, "Disbursement date not found for the lead", 400, {}, "");
            }

            let { product } = await LeadService.getProductOrBankDropdown("product", null, null, null, null, `p.netsuite_product_id = ${lead?.netsuite_product_id}`)
            product = product[0]
            let category = product?.category

            if (typeof category === 'string' && category?.toLowerCase() !== 'unsecured') {
                // if secured loan , then check if the lead is tentative matched
                const tentativeMatchResult = await LeadService.getTentativeBankFileMatchData(fresh_lead_id)
                if (!tentativeMatchResult.is_tentative_matched && !tentativeMatchResult.is_banker_file_processed) {
                    return ResHelper.apiResponse(res, false, "Tentative bank file match required for Autonomous payment in secured loans", 400, {}, "");
                }
            }

            const disbursementDate = new Date(lead?.disbursement_date);
            const currentDate = new Date();
            disbursementDate.setHours(0, 0, 0, 0);
            currentDate.setHours(0, 0, 0, 0);

            if (disbursementDate >= currentDate) {
                return ResHelper.apiResponse(res, false, "Disbursement date must be prior to the current date", 400, {}, "");
            }


            const is_company = (lead?.user_type == "company")
            if (!lead?.dsa_id || is_company) {
                lead = await FinanceServices.updateFreshLeadDsaId(lead, is_company)
            }
            const { dsa_id } = lead
            let is_same_day_billing_enabled = await DSAService.getDsaSameDayBillingEnabledById(dsa_id)
            if (!is_same_day_billing_enabled) {
                return ResHelper.apiResponse(res, false, "Same day billing is not enabled for this DSA", 400, {}, "");
            }
            const payoutCaps = await DSAService.getDsaPayoutAutonomousByBankProduct(dsa_id, {
                bank_id: lead.netsuite_bank_id,
                product_id: lead.netsuite_product_id,
            }, toIsoDateIST(lead.disbursement_date))
            if (!payoutCaps) {
                return ResHelper.apiResponse(res, false, "DSA payout is not set for this product", 400, {}, "");
            }

            if (!payoutCaps.disb_date_from) {
                return ResHelper.apiResponse(res, false, "Autonomous payment settings are not configured for this product", 400, {}, "");
            }

            const disbDateFromConfig = new Date(payoutCaps.disb_date_from);
            disbDateFromConfig.setHours(0, 0, 0, 0);
            if (disbursementDate < disbDateFromConfig) {
                return ResHelper.apiResponse(res, false, `Payout not configured for this date`, 400, {}, "");
            }

            if (payoutCaps.disb_date_to) {
                const disbDateToConfig = new Date(payoutCaps.disb_date_to);
                disbDateToConfig.setHours(0, 0, 0, 0);
                if (disbursementDate > disbDateToConfig) {
                    return ResHelper.apiResponse(res, false, `Payout not configured for this date`, 400, {}, "");
                }
            }

            const pt = String(payout_type || '').toLowerCase()
            if (pt === 'rate') {
                if (payoutCaps.autonomous_rate == null || payoutCaps.autonomous_rate === '') {
                    return ResHelper.apiResponse(res, false, "Autonomous rate cap is not configured for this product", 400, {}, "");
                }
                if (Number(rate) > Number(payoutCaps.autonomous_rate)) {
                    return ResHelper.apiResponse(res, false, `Rate cannot exceed configured autonomous rate ${payoutCaps.autonomous_rate}`, 400, {}, "");
                }
                await DSAService.setLeadPayoutRateOrRatio(fresh_lead_id, "rate", rate, null, 0, payoutCaps.autonomous_rate, lead?.disbursement_amount, null, same_day_billing ? 1 : 0, to_be_billed ? 1 : 0, 'fresh_lead_id')
            } else {
                if (payoutCaps.autonomous_ratio == null || payoutCaps.autonomous_ratio === '') {
                    return ResHelper.apiResponse(res, false, "Autonomous ratio cap is not configured for this product", 400, {}, "");
                }
                if (payoutCaps.avg_achievment == null || payoutCaps.avg_achievment === '') {
                    return ResHelper.apiResponse(res, false, "Product average achievement is not set for this combination", 400, {}, "");
                }
                if (Number(ratio) > Number(payoutCaps.autonomous_ratio)) {
                    return ResHelper.apiResponse(res, false, `Ratio cannot exceed configured autonomous ratio ${payoutCaps.autonomous_ratio}`, 400, {}, "");
                }
                await DSAService.setLeadPayoutRateOrRatio(fresh_lead_id, "ratio", null, ratio, 0, payoutCaps.autonomous_ratio, lead?.disbursement_amount, payoutCaps.avg_achievment, same_day_billing ? 1 : 0, to_be_billed ? 1 : 0, 'fresh_lead_id')
            }
            const prevData = {
                vendor_payout_type: lead?.vendor_payout_type || "",
                same_day_billing: lead?.same_day_billing ? true : false,
                to_be_billed: lead?.to_be_billed ? true : false
            }
            const newData = {
                vendor_payout_type: pt,
                same_day_billing: same_day_billing ? true : false,
                to_be_billed: to_be_billed ? true : false
            }
            const difference = CommonHelper.jsonDifference({ ...prevData }, { ...newData });
            ApplicationLogServices.bulkCreate(difference, lead?.id, "lead_claim_update", req?.loggedInUser?.id)
            return ResHelper.apiResponse(res, true, `Autonomous payment status updated successfully`, 200, {}, "");
        }
    }
    catch (error) {
        logger.error(error);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
}

const updateTentativeBankFileMatch = async (req, res, next) => {
    try {
        const { error } = LeadValidationV1.updateTentativeBankFileMatch.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { fresh_lead_id, bank_file_id, is_tentative_file_matched, match_type = 'tentative' } = req.body;
            const userId = req?.loggedInUser?.id || null;

            // Manual-review banks (SBI) and CAT C / CAT D products can't be linked to a main or tentative bank file; unlinking stays allowed
            if (is_tentative_file_matched) {
                const lead = await LeadService.getLeadFormByFreshLeadId(fresh_lead_id);
                if (isManualReviewBank(lead?.netsuite_bank_id)) {
                    return ResHelper.apiResponse(res, false, "Bank file matching is not allowed for this bank", 400, {}, "");
                }
                if (await isBankFileMatchExcluded(lead?.netsuite_bank_id, lead?.netsuite_product_id)) {
                    return ResHelper.apiResponse(res, false, "Bank file matching is not allowed for CAT C / CAT D products", 400, {}, "");
                }
            }

            const prevData = await LeadService.getBankFileMatchData(fresh_lead_id);
            const result = await LeadService.updateTentativeBankFileMatch(
                fresh_lead_id,
                bank_file_id,
                is_tentative_file_matched,
                match_type
            );

            if (result.success) {
                const newData = match_type === 'main'
                    ? {
                        is_bank_file_matched: is_tentative_file_matched ? 1 : 0,
                        bank_file_id: is_tentative_file_matched ? bank_file_id : null
                    }
                    : {
                        is_tentative_matched: is_tentative_file_matched ? 1 : 0,
                        tentative_bank_file_id: is_tentative_file_matched ? bank_file_id : null
                    };

                const difference = CommonHelper.jsonDifference(prevData, newData);
                if (difference && difference.length > 0) {
                    await ApplicationLogServices.bulkCreate(difference, prevData?.id, "lead_claim_update", userId);
                }

                return ResHelper.apiResponse(res, true, result.message, 200, {}, "");
            } else {
                return ResHelper.apiResponse(res, false, result.message || "Failed to update bank file match", 400, {}, "");
            }
        }
    }
    catch (error) {
        logger.error(error);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
}

const saveReconciliation = async (req, res, next) => {
    try {
        const final_json = req.body?.data?.final_json || {};
        const mail_html = req.body?.mail_html;
        const mail_from = req.body?.mail_from;
        const case_reconciliation = final_json?.case_reconciliation;
        const overall_summary = final_json?.overall_summary || {};
        const meta_details = final_json?.meta_details;
        const status = overall_summary?.final_status
            ? overall_summary.final_status.toLowerCase().replace(/ /g, '_')
            : 'pending';

        const normalizedApplicationId =
            typeof meta_details?.application_id === 'string'
                ? meta_details.application_id.replace(/^RU-/i, '')
                : meta_details?.application_id;

        const cc_email_date = case_reconciliation?.cc_email_date;

        const payload = {
            fresh_lead_id: normalizedApplicationId,
            status,
            reconciliation_data: JSON.stringify(req.body?.data),
            mail_html,
            mail_from: JSON.stringify(mail_from),
            overall_summary: JSON.stringify(overall_summary),
            cc_email_date,
        };

        await LeadService.createReconciliation(payload);
        await DSAService.autoProgressLeadFromReconciliation(normalizedApplicationId, case_reconciliation);
        ResHelper.apiResponse(res, true, "Success", 200, {}, "");
    } catch (e) {
        console.log(e)
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getReconciliationMail = async (req, res) => {
    try {
        const { error } = LeadValidationV1.getReconciliationMail.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const { fresh_lead_id } = req.body;
        const reconciliationData = await LeadService.getReconciliationDataByLeadId(fresh_lead_id);

        if (!reconciliationData) {
            return ResHelper.apiResponse(res, false, "No reconciliation data found for this lead", 404, {}, "");
        }

        ResHelper.apiResponse(res, true, "Success", 200, reconciliationData, "");
    } catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getReconciliationMailTrail = async (req, res) => {
    try {
        const { error } = LeadValidationV1.getReconciliationMailTrail.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const { fresh_lead_id } = req.body;
        const mailTrailData = await LeadService.getReconciliationMailTrailByLeadId(fresh_lead_id);

        if (!mailTrailData) {
            return ResHelper.apiResponse(res, false, "No mail trail found for this lead", 404, {}, "");
        }

        ResHelper.apiResponse(res, true, "Success", 200, mailTrailData, "");
    } catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getMailTrailFromMailbox = async (req, res) => {
    try {
        const { error } = LeadValidationV1.getMailTrailFromMailbox.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const { fresh_lead_id } = req.body;
        const result = await LeadService.getMailTrailFromMailbox(fresh_lead_id);

        if (!result?.success) {
            return ResHelper.apiResponse(res, false, result?.message || "Unable to fetch mailbox trail", 404, result, "");
        }

        ResHelper.apiResponse(res, true, "Success", 200, result, "");
    } catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const saveMailTrailFromMailbox = async (req, res) => {
    try {
        const { error } = LeadValidationV1.saveMailTrailFromMailbox.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const { fresh_lead_id } = req.body;
        const result = await LeadService.saveMailTrailFromMailbox(fresh_lead_id);

        if (!result?.success) {
            return ResHelper.apiResponse(res, false, result?.message || "Unable to save mail trail", 400, {}, "");
        }

        ResHelper.apiResponse(res, true, result.message || "Mail trail saved successfully", 200, {
            updated_at: result.updated_at
        }, "");
    } catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const downloadLatestMailTrailEml = async (req, res) => {
    try {
        const { error } = LeadValidationV1.downloadLatestMailTrailEml.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const { fresh_lead_id } = req.body;
        const result = await LeadService.downloadLatestMailTrailEml(fresh_lead_id);

        if (!result?.success) {
            return ResHelper.apiResponse(res, false, result?.message || "Unable to download mail trail", 404, {}, "");
        }

        res.setHeader("Content-Type", "message/rfc822");
        res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
        return res.send(result.content);
    } catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getLeadMailThreadReplyOptions = async (req, res) => {
    try {
        const { error } = LeadValidationV1.getLeadMailThreadReplyOptions.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const { fresh_lead_id } = req.body;
        const result = await LeadService.getLeadMailThreadReplyOptions(fresh_lead_id);

        if (!result?.success) {
            return ResHelper.apiResponse(res, false, result?.message || "Unable to load reply options", 404, {}, "");
        }

        ResHelper.apiResponse(res, true, "Success", 200, result, "");
    } catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const replyMailThread = async (req, res) => {
    try {
        const { error } = LeadValidationV1.replyMailThread.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const { fresh_lead_id, to, cc, subject, html } = req.body;
        LeadService.replyMailThread({
            fresh_lead_id,
            to,
            cc,
            subject,
            html,
            loggedInUser: req.loggedInUser
        }).then((result) => {
            if (!result?.success) {
                logger.error(`replyMailThread background task failed for lead ${fresh_lead_id}: ${result?.message || "Failed to send reply"}`);
            }
        }).catch((e) => {
            logger.error(e);
        });

        ResHelper.apiResponse(res, true, "Mail will be sent shortly", 200, {}, "");
    } catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const setLeadOnHold = async (req, res) => {
    try {
        const { error } = LeadValidationV1.setLeadOnHold.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        const { fresh_lead_id, vendor_remark } = req.body;

        const prevData = await LeadClaimService.getClaimForEdit(fresh_lead_id);
        const oldAiStatus = prevData?.records?.ai_status ?? null;
        const fromValue = oldAiStatus ? oldAiStatus : '';

        await LeadService.setLeadOnHold(fresh_lead_id, vendor_remark);

        if (prevData?.records?.id) {
            const difference = [['ai_status', fromValue, 'on_hold']];
            await ApplicationLogServices.bulkCreate(difference, prevData.records.id, "lead_claim_update", req?.loggedInUser?.id);
        }

        ResHelper.apiResponse(res, true, "Success", 200, {}, "");
    } catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

// Reconciliation editable fields config (normalized field names + row field -> payload key mapping)
const RECONCILIATION_EDITABLE_FIELDS = {
    row_field_to_payload_key: {
        loan_no: 'loan_number',
        application_no: 'application_no',
        disbursal_date: 'disbursement_date',
        'city_&_state_of_disbursal': 'city',
        'loan_amount:_(against_which_ruloans_will_get_the_final_invoice)': 'disbursement_amount',
        loan_amount: 'disbursement_amount',
        total_loan_amount: 'loan_amount',
        loan_type: 'loan_type',
        customer_name: 'customer_name',
        customer_company_name: 'customer_company_name',
        bank_nbfc_name: 'bank_name',
        product: 'product_name',
    }
};

const getReconciliationEditableFields = async (req, res) => {
    try {
        ResHelper.apiResponse(res, true, "Success", 200, RECONCILIATION_EDITABLE_FIELDS, "");
    } catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getDsaLeadBuckets = async (req, res) => {
    try {
        const buckets = await LeadService.getDsaLeadBuckets();
        ResHelper.apiResponse(res, true, "Success", 200, buckets, "");
    } catch (e) {
        logger.error("getDsaLeadBuckets error:", e?.message, e?.stack || e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const activationDashboardMetrics = async (req, res) => {
    try {
        const { error } = LeadValidationV1.activationDashboardMetrics.validate(req.body || {});
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        }
        let dsaId = null;
        let materializedPath = null;
        let skipHierarchy = false;
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
            }
        }
        const { fromDate, toDate } = req.body || {};
        const data = await LeadService.getActivationDashboardMetrics({
            dsaId,
            materializedPath,
            skipHierarchy,
            fromDate,
            toDate
        });
        ResHelper.apiResponse(res, true, "Success", 200, data, "");
    } catch (e) {
        logger.error("activationDashboardMetrics error:", e?.message, e?.stack || e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const listDsaLeads = async (req, res) => {
    try {
        const { error } = LeadValidationV1.listDsaLeads.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        }
        let whereFilterQuery = [];
        const operatorHandlers = CustomOperatorHandlers();
        const { filterModel, logicOperator } = req.body;
        if (filterModel && filterModel.items && filterModel.items.length > 0) {
            whereFilterQuery = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getDsaLeadsFieldMapping, operatorHandlers, 'dsa_leads');
        }

        let dsaId = null;
        let materializedPath = null;
        let skipHierarchy = false;

        // Hierarchy: B2B uses req.dsa, CRM uses req.loggedInUser. For CEO skip hierarchy (no filter); payload/response unchanged.
        if (req.dsa && req.dsa.dsa_id) {
            dsaId = req.dsa.dsa_id;
            materializedPath = req.dsa.materialized_path;
        } else if (req.loggedInUser) {
            const role = req.loggedInUser.role;
            if (role === 'CEO') {
                skipHierarchy = true; // CEO: no hierarchy filter, same payload/result as before
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
            }
        }

        const result = await LeadService.listDsaLeads({
            ...req.body,
            whereFilterQuery,
            logicOperator: (logicOperator || 'and').toLowerCase(),
            dsaId,
            materializedPath,
            skipHierarchy
        });
        ResHelper.apiResponse(res, true, "Success", 200, result, "");
    } catch (e) {
        console.log(e);
        logger.error("listDsaLeads error:", e?.message, e?.stack || e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const assignLeadSalesPerson = async (req, res) => {
    try {
        const { error } = LeadValidationV1.assignLeadSalesPerson.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        }
        // type: 'dsa' (default) -> ru_dsa_leads; 'customer' -> loan_applications
        const { leadIdArray, crmId, type = 'dsa' } = req.body;
        const oldSPsMap = type !== 'customer' ? await LeadService.getSalesPersonByLeadIds(leadIdArray) : {};
        await LeadService.assignLeadSalesPerson(leadIdArray, crmId, type);
        if (type !== 'customer') {
            try {
                await KafkaServices.connectKafkaProducer();
                for (const leadId of leadIdArray) {
                    const LeadUpdatedDetails = new KafkaServices.EventLogger(
                        "lead_sales_person_assigned",
                        oldSPsMap[String(leadId)] ?? '-',
                        crmId,
                        String(leadId),
                        req?.loggedInUser?.id || null,
                        new Date()
                    );
                    await KafkaServices.sendToKafkaLoggerService(LeadUpdatedDetails);
                }
            } catch (kafkaErr) {
                logger.error("assignLeadSalesPerson Kafka (assignment succeeded): %s", kafkaErr?.message || kafkaErr);
            }
        }
        ResHelper.apiResponse(res, true, "Salesperson assigned to leads", 200, {}, "");
    } catch (e) {
        logger.error("assignLeadSalesPerson error:", e?.message, e?.stack || e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const updateDsaLeadStatus = async (req, res) => {
    try {
        const { error } = LeadValidationV1.updateDsaLeadStatus.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        }
        const { lead_id, status } = req.body;
        const { updated, message, previousStatus } = await LeadService.updateDsaLeadStatus(lead_id, status);
        if (!updated) {
            ResHelper.apiResponse(res, false, message || "Update failed", 400, null, "");
            return;
        }
        // Application log: lead status changed (from → to, by whom, when)
        try {
            const diff = [['status', String(previousStatus ?? ''), String(status)]];
            await ApplicationLogServices.bulkCreate(diff, String(lead_id), 'dsa_lead_status', req.loggedInUser?.id || null);
        } catch (logErr) {
            logger.error("updateDsaLeadStatus application log error:", logErr?.message, logErr?.stack || logErr);
        }
        ResHelper.apiResponse(res, true, "Success", 200, null, "");
    } catch (e) {
        logger.error("updateDsaLeadStatus error:", e?.message, e?.stack || e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const updateLeadRemarks = async (req, res) => {
    try {
        const { error } = LeadValidationV1.updateLeadRemarks.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        }
        const { lead_id, lead_remarks } = req.body;
        const { updated, message, previousRemarks } = await LeadService.updateLeadRemarks(lead_id, lead_remarks);
        if (!updated) {
            ResHelper.apiResponse(res, false, message || "Update failed", 400, null, "");
            return;
        }
        // Application log: lead remarks changed (from → to, by whom, when)
        try {
            const diff = [['lead_remarks', String(previousRemarks ?? ''), String(lead_remarks ?? '')]];
            await ApplicationLogServices.bulkCreate(diff, String(lead_id), 'dsa_lead_remarks', req.loggedInUser?.id || null);
        } catch (logErr) {
            logger.error("updateLeadRemarks application log error:", logErr?.message, logErr?.stack || logErr);
        }
        ResHelper.apiResponse(res, true, "Success", 200, null, "");
    } catch (e) {
        logger.error("updateLeadRemarks error:", e?.message, e?.stack || e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getDsaLeadById = async (req, res) => {
    try {
        const lead_id = req.query.lead_id;
        if (!lead_id) {
            ResHelper.apiResponse(res, false, "lead_id is required", 400, {}, "");
            return;
        }
        const lead = await LeadService.getDsaLeadById(lead_id);
        if (!lead) {
            ResHelper.apiResponse(res, false, "Lead not found", 404, {}, "");
            return;
        }
        ResHelper.apiResponse(res, true, "Success", 200, lead, "");
    } catch (e) {
        logger.error("getDsaLeadById error:", e?.message, e?.stack || e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const captureDsaLeadCallData = async (req, res) => {
    try {
        const { error } = LeadValidationV1.captureDsaLeadCallData.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        }
        const { lead_id, type, call_status, call_remarks, lead_status, lead_remarks, entity, entity_type, entity_id } = req.body;
        // External route (captureDsaLeadCallDataExternal): createdBy = dsa_id; internal: createdBy = loggedInUser.id
        const createdBy = req.loggedInUser?.id ?? req.dsa?.dsa_id;
        if (!createdBy) {
            ResHelper.apiResponse(res, false, "Unauthorized", 401, {}, "");
            return;
        }
        const { success, message } = await LeadService.captureDsaLeadCallData(lead_id, type, call_status, call_remarks, lead_status, lead_remarks, createdBy, { entity, entity_type, entity_id });
        if (!success) {
            ResHelper.apiResponse(res, false, message || "Failed to capture call data", 400, {}, "");
            return;
        }
        ResHelper.apiResponse(res, true, "Success", 200, {}, "");
    } catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getLeadEntriesByLeadId = async (req, res) => {
    try {
        const { error } = LeadValidationV1.getLeadEntriesByLeadId.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        }
        let whereFilterQuery = [];
        const operatorHandlers = CustomOperatorHandlers();
        const { lead_id, pageNumber = 0, pageSize = 10, filterModel, logicOperator } = req.body;
        if (filterModel && filterModel.items && filterModel.items.length > 0) {
            whereFilterQuery = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getDsaLeadsFieldMapping, operatorHandlers, 'dsa_leads');
        }
        const offset = pageNumber * pageSize;
        const result = await LeadService.getLeadEntriesByLeadId(lead_id, offset, pageSize, whereFilterQuery, (logicOperator || 'and').toLowerCase());
        ResHelper.apiResponse(res, true, "Success", 200, result, "");
    } catch (e) {
        logger.error("getLeadEntriesByLeadId error:", e?.message, e?.stack || e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getCallLogsByLeadId = async (req, res) => {
    try {
        const { error } = LeadValidationV1.getCallLogsByLeadId.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        }
        const { lead_id, entity, entity_type } = req.body;
        const result = await LeadService.getCallLogsByLeadId(lead_id, { entity, entity_type });
        ResHelper.apiResponse(res, true, "Success", 200, result, "");
    } catch (e) {
        logger.error("getCallLogsByLeadId error:", e?.message, e?.stack || e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getLeadLogsByLeadId = async (req, res) => {
    try {
        const { error } = LeadValidationV1.getLeadLogsByLeadId.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        }
        const { lead_id, pageNumber = 0, pageSize = 10, event, entity, entity_type } = req.body;
        const offset = pageNumber * pageSize;
        const result = await LeadService.getLeadLogsByLeadId(lead_id, offset, pageSize, event, { entity, entity_type });
        ResHelper.apiResponse(res, true, "Success", 200, result, "");
    } catch (e) {
        console.log(e);
        logger.error("getLeadLogsByLeadId error:", e?.message, e?.stack || e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

module.exports = {
    create,
    deleteLead,
    leads,
    lead,
    update,
    followLead,
    unFollowLead,
    getStaredLeadForUser,
    getLeadPayouts,
    convertLeadDsaPayout,
    getDsaPayoutHook,
    updateLeadDsaPayout,
    downloadLeadList,
    getDsaPayoutUpdatedHook,
    updateLeadPayout,
    getCallStatus,
    createV2,
    leadV2,
    updateAssignee,
    createExternal,
    getLeadReport,
    getLeadFormDetailsById,
    getLeadFormRemarks,
    updateLeadFormRemark,
    getLeadForms,
    verifyPanViaAuthBridgeV2,
    pushDSAToNS,
    getProductOrBankDropdown,
    getLeadPayoutDetails,
    getNetsuiteBankList,
    exportNetsuiteBankList,
    setBankFileOnVcf,
    getNetsuiteProductList,
    createOrUpdateNetsuiteProduct,
    downloadLeadPayout,
    downloadLeadPayoutExternal,
    getDsaPayoutExternal,
    getAllBankProductCombination,
    editBusinessCategory,
    updateLeadFormAutonomousStatus,
    updateTentativeBankFileMatch,
    saveReconciliation,
    getReconciliationMail,
    getReconciliationMailTrail,
    getMailTrailFromMailbox,
    saveMailTrailFromMailbox,
    downloadLatestMailTrailEml,
    getLeadMailThreadReplyOptions,
    replyMailThread,
    setLeadOnHold,
    getReconciliationEditableFields,
    getDsaLeadBuckets,
    activationDashboardMetrics,
    listDsaLeads,
    assignLeadSalesPerson,
    updateDsaLeadStatus,
    updateLeadRemarks,
    getDsaLeadById,
    getLeadEntriesByLeadId,
    getCallLogsByLeadId,
    getLeadLogsByLeadId,
    captureDsaLeadCallData
};




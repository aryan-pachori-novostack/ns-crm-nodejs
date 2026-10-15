const { sequelize, Lead, _db2 } = require('../../models');
const { QueryTypes, Op } = require('sequelize');
const { v4: uuid } = require('uuid');
const { createIfNotExist } = require('./picklist-values-services');
const { add, result } = require('lodash');
const { logger } = require('../helpers/logger');
const { validateVendorPayoutNew, getDsaGlobalPayoutPercentageNew, assignSalesPerson: assignDsaSalesPerson, getSPbyId: getDsaSPbyId } = require('./dsa-services');
//const { isValidpayoutSharingCase } = require('./finance-services');

const getUnauthUser = async () => {
    let query = 'select bin_to_uuid(id) as id from users where email in ("girish.nair@ruloans.com", "shruti.ingawale@ruloans.com")';
    const results = await sequelize.query(query, { type: QueryTypes.SELECT });
    return { assign_to: results[0]?.id, channel_manager: results[1]?.id }
}

const getUserWithPanEmailMobile = async (mobile, email, pan) => {
    let query = `select bin_to_uuid(id) as id,mobile,prefix,user_fname,user_mname,user_lname,email,source,lead_source,status,assigned_to,pan,is_fresh_lead,profession,category,alt_mobile,potential,dob,lead_type, payout_percentage from leads where email = ? or mobile = ? ${pan && `or pan = ?`} `;
    let bindParams = [email, mobile, pan];
    const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
    // We didn't need to destructure the result here - the results were returned directly
}


const getOtherUserWithPanEmailMobile = async (mobile, email, pan, id) => {

    let query = ' SELECT  * FROM  leads l where (pan = ? or email = ? or mobile = ?) and id != uuid_to_bin(?) ';
    let bindParams = [pan, email, mobile, id];
    const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
    // We didn't need to destructure the result here - the results were returned directly
}

const create = async (data) => {
    let id = uuid();
    let { mobile, prefix, user_fname, user_mname, user_lname, email, source, lead_source, status, assigned_to, channel_manager, pan, is_fresh_lead, profession, category, alt_mobile, potential, dob, lead_type, payout_percentage } = data;
    let query = `insert into leads(id,mobile,prefix,user_fname,user_mname,user_lname,email,source,lead_source,status,assigned_to,channel_manager,pan,is_fresh_lead,profession,category,alt_mobile,potential,dob,lead_type, payout_percentage) values(uuid_to_bin(?),?,?,?,?,?,?,?,?,?,uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,?,?,?,?,?) `;
    let bindParams = [id, mobile, prefix, user_fname, user_mname, user_lname, email, source, lead_source, status, assigned_to, channel_manager, pan, is_fresh_lead, profession, category, alt_mobile, potential, dob, lead_type, payout_percentage];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    query = `select bin_to_uuid(id) as id,mobile,prefix,user_fname,user_mname,user_lname,email,source,lead_source,status,assigned_to,pan,is_fresh_lead,profession,category,alt_mobile,potential,dob,lead_type, payout_percentage from leads where id = uuid_to_bin(?) `;
    bindParams = [id];
    const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
}

const createPan = async (data, loggedInUser) => {
    let id = uuid();
    let { isUpdated, mobile, pan, email, step, prefix, user_fname, user_mname, user_lname } = data;

    let query = `select bin_to_uuid(id) as id, bin_to_uuid(assigned_to) as assigned_to, email, mobile, pan, step, prefix, user_fname, user_mname, user_lname from leads where email=? or mobile=? or pan=? limit 1`
    let bindParams = [email, mobile, pan];
    const leadExist = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    if (leadExist?.length) {
        let existMessage = "The said vendor is registered in our system with same";
        if (leadExist[0]?.pan == pan) {
            existMessage += " pan,"
        }
        if (leadExist[0]?.email == email) {
            existMessage += " email,"
        }
        if (leadExist[0]?.mobile == mobile) {
            existMessage += " mobile"
        }
        existMessage += " for further details contact customer support Mobile: 18002667576, Email: support@ruloans.com ."

        const hasAccess = Boolean(loggedInUser?.role == "CEO" || loggedInUser?.id == leadExist[0]?.assigned_to);

        if (hasAccess) {
            if (isUpdated) {
                query = `update leads set user_fname = ?, user_mname = ?, user_lname = ? where bin_to_uuid(id) = ?`
                bindParams = [user_fname, user_mname, user_lname, leadExist[0].id];
                const updateLead = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
            }
            return { result: leadExist[0], leadExist: Boolean(leadExist), step: leadExist[0]?.step, existMessage };
        } else {
            return { result: leadExist[0], leadExist: Boolean(leadExist), step: 0, existMessage };
        }

    } else {
        let query = `insert into leads(id,mobile,email,pan, step, prefix, user_fname, user_mname, user_lname) values(uuid_to_bin(?),?,?,?,?,?,?,?,?)`;
        let bindParams = [id, mobile, email, pan, step, prefix, user_fname, user_mname, user_lname];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

        query = `select bin_to_uuid(id) as id, mobile, email, pan, step, prefix, user_fname, user_mname, user_lname from leads where id = uuid_to_bin(?) `;
        bindParams = [id];
        const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

        return { result: results[0], leadExist: false, step: step };
    }
}

const createLead = async (data) => {
    let { isUpdated, step, leadId, lead_source, status, sub_status, assigned_to, channel_manager, profession, category, alt_mobile, potential, dob, lead_type } = data;
    let id = leadId;

    let query = `select bin_to_uuid(id) as id, user_fname, lead_source, mobile, status, sub_status, bin_to_uuid(assigned_to) as assigned_to, bin_to_uuid(channel_manager) as channel_manager, profession, category, alt_mobile, potential, dob, lead_type from leads where id = uuid_to_bin(?) `;
    let bindParams = [id];
    const previousData = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    query = `update leads set ${!isUpdated ? "step=" + step + "," : ""} lead_source=?, status=?, ${Boolean(status != previousData[0]?.status) ? `status_updated_at = '${new Date().toISOString()}',` : ""} sub_status=?, assigned_to=uuid_to_bin(?), assigned_to_date=?, channel_manager=uuid_to_bin(?), profession=?, category=?, alt_mobile=?, potential=?, dob=?, lead_type=? where id = uuid_to_bin(?) `;
    bindParams = [lead_source, status, sub_status, assigned_to, new Date(), channel_manager || null, profession, category, alt_mobile, potential, dob, lead_type, id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

    query = `select bin_to_uuid(id) as id, user_fname, lead_source, mobile, status, sub_status, bin_to_uuid(assigned_to) as assigned_to, bin_to_uuid(channel_manager) as channel_manager, profession, category, alt_mobile, potential, dob, lead_type from leads where id = uuid_to_bin(?) `;
    bindParams = [id];
    const newData = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    return { previousData: previousData[0], newData: newData[0], step: step };
}

const createAddressV2 = async (data) => {
    let id = uuid();
    let { isUpdated, step, lead_id, address, city, state, pincode, type } = data;

    let query = `select address, pincode, city, state, type  from lead_address where lead_id = uuid_to_bin(?) and type=?`;
    let bindParams = [lead_id, type];
    const previousData = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    if (previousData[0]) {
        query = `update lead_address set address=?,city=?,state=?,pincode=? where lead_id = uuid_to_bin(?) and type=?`;
        bindParams = [address, city, state, pincode, lead_id, type];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    } else {
        query = `insert into lead_address(id,lead_id,address,city,state,pincode,type) values(uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,?) `;
        bindParams = [id, lead_id, address, city, state, pincode, type];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }

    query = `select bin_to_uuid(id) as id ,bin_to_uuid(lead_id) as lead_id,address,city,state,pincode,type from lead_address where lead_id = uuid_to_bin(?) `;
    bindParams = [lead_id];
    const newData = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    if (!isUpdated) {
        query = `update leads set step=? where id = uuid_to_bin(?) `;
        bindParams = [step, lead_id];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }

    return { previousData: previousData[0], newData: newData[0], step: step };
}

const createCustomInformation = async (data) => {
    // loan_type, have_office, is_office_rented, number_of_staff, heard_of_ruloans, where_you_heard, monthly_disbursement, purpose_of_joining, bank_leave_duration, previous_loan_type, previous_bank_verticle
    let id = uuid();
    let { isUpdated, step, has_reapplied, secondary_email, lead_id, has_done_loan_buisness, year_loan_buisness, has_coonector_code, loan_type, have_office, is_office_rented, number_of_staff, heard_of_ruloans, where_you_heard, monthly_disbursement, purpose_of_joining, bank_leave_duration, previous_loan_type, previous_bank_verticle, previous_bank_department } = data;

    let query = `select has_done_loan_buisness,year_loan_buisness,has_coonector_code,has_reapplied,secondary_email, loan_type, have_office, is_office_rented, number_of_staff, heard_of_ruloans, where_you_heard, monthly_disbursement, purpose_of_joining, bank_leave_duration, previous_loan_type, previous_bank_verticle, previous_bank_department from lead_additional_information where lead_id = uuid_to_bin(?) `;
    let bindParams = [lead_id];
    const previousData = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    if (previousData[0]) {
        query = `update lead_additional_information set has_reapplied=?, secondary_email=?, has_done_loan_buisness=?, year_loan_buisness=?, has_coonector_code=?, loan_type=?, have_office=?, is_office_rented=?, number_of_staff=?, heard_of_ruloans=?, where_you_heard=?, monthly_disbursement=?, purpose_of_joining=?, bank_leave_duration=?, previous_loan_type=?, previous_bank_verticle=?, previous_bank_department=? where lead_id=uuid_to_bin(?)`;
        bindParams = [has_reapplied, secondary_email, has_done_loan_buisness, year_loan_buisness, has_coonector_code, loan_type, have_office, is_office_rented, number_of_staff, heard_of_ruloans, where_you_heard, monthly_disbursement, purpose_of_joining, bank_leave_duration, previous_loan_type, previous_bank_verticle, previous_bank_department, lead_id];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    } else {
        query = `insert into lead_additional_information(id,lead_id,has_reapplied, secondary_email, has_done_loan_buisness,year_loan_buisness,has_coonector_code, loan_type, have_office, is_office_rented, number_of_staff, heard_of_ruloans, where_you_heard, monthly_disbursement, purpose_of_joining, bank_leave_duration, previous_loan_type, previous_bank_verticle, previous_bank_department) values(uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) `;
        bindParams = [id, lead_id, has_reapplied, secondary_email, has_done_loan_buisness, year_loan_buisness, has_coonector_code, loan_type, have_office, is_office_rented, number_of_staff, heard_of_ruloans, where_you_heard, monthly_disbursement, purpose_of_joining, bank_leave_duration, previous_loan_type, previous_bank_verticle, previous_bank_department];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }

    query = `select bin_to_uuid(id) as id,bin_to_uuid(lead_id) as lead_id,has_done_loan_buisness,year_loan_buisness,has_coonector_code,has_reapplied,secondary_email,  loan_type, have_office, is_office_rented, number_of_staff, heard_of_ruloans, where_you_heard, monthly_disbursement, purpose_of_joining, bank_leave_duration, previous_loan_type, previous_bank_verticle, previous_bank_department from lead_additional_information where lead_id = uuid_to_bin(?) `;
    bindParams = [lead_id];
    const newData = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    if (!isUpdated) {
        query = `update leads set step=? where id = uuid_to_bin(?) `;
        bindParams = [step, lead_id];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }

    return { previousData: previousData[0] || newData[0], newData: newData[0], step: step };
}

const createPayoutInformation = async (data) => {
    // current_payout_pl, current_payout_bl, current_payout_hl, current_payout_lap, current_payout_ncl, current_payout_ucl, current_payout_car_refinance, current_payout_od_cc, current_payout_gl, current_payout_project_loan, current_payout_el, current_payout_msme_loan, current_payout_working_loan
    let { isUpdated, step, leadId, current_payout_pl, current_payout_bl, current_payout_hl, current_payout_lap, current_payout_ncl, current_payout_ucl, current_payout_car_refinance, current_payout_od_cc, current_payout_gl, current_payout_project_loan, current_payout_el, current_payout_msme_loan, current_payout_working_loan, payout_percentage } = data;
    const lead_id = leadId;

    let query = `select la.current_payout_pl, la.current_payout_bl, la.current_payout_hl, la.current_payout_lap, la.current_payout_ncl, la.current_payout_ucl, la.current_payout_car_refinance, la.current_payout_od_cc, la.current_payout_gl, la.current_payout_project_loan, la.current_payout_el, la.current_payout_msme_loan, la.current_payout_working_loan, l.payout_percentage from lead_additional_information la left join leads l on l.id = la.lead_id where lead_id = uuid_to_bin(?) `;
    let bindParams = [lead_id];
    const previousData = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    query = `update leads set payout_percentage=? where id = uuid_to_bin(?) `;
    bindParams = [payout_percentage, leadId];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });

    query = `update lead_additional_information set current_payout_pl=?, current_payout_bl=?, current_payout_hl=?, current_payout_lap=?, current_payout_ncl=?, current_payout_ucl=?, current_payout_car_refinance=?, current_payout_od_cc=?, current_payout_gl=?, current_payout_project_loan=?, current_payout_el=?, current_payout_msme_loan=?, current_payout_working_loan=? where lead_id = uuid_to_bin(?) `;
    bindParams = [current_payout_pl, current_payout_bl, current_payout_hl, current_payout_lap, current_payout_ncl, current_payout_ucl, current_payout_car_refinance, current_payout_od_cc, current_payout_gl, current_payout_project_loan, current_payout_el, current_payout_msme_loan, current_payout_working_loan, lead_id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

    query = `select la.current_payout_pl, la.current_payout_bl, la.current_payout_hl, la.current_payout_lap, la.current_payout_ncl, la.current_payout_ucl, la.current_payout_car_refinance, la.current_payout_od_cc, la.current_payout_gl, la.current_payout_project_loan, la.current_payout_el, la.current_payout_msme_loan, la.current_payout_working_loan, l.payout_percentage from lead_additional_information la left join leads l on l.id = la.lead_id where lead_id = uuid_to_bin(?) `;
    bindParams = [lead_id];
    const newData = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    if (!isUpdated) {
        query = `update leads set step=? where id = uuid_to_bin(?) `;
        bindParams = [step, lead_id];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }

    return { previousData: previousData[0] || newData[0], newData: newData[0], step: step };
}

const createCrmUser = async (data) => {
    //is_crm_user
    let { isUpdated, leadId, is_crm_user, step } = data;
    const lead_id = leadId;

    let query = `select is_crm_user from lead_additional_information where lead_id = uuid_to_bin(?) `;
    let bindParams = [lead_id];
    const previousData = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    query = `update lead_additional_information set is_crm_user=? where lead_id = uuid_to_bin(?) `;
    bindParams = [is_crm_user, lead_id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

    query = `select bin_to_uuid(id) as id,bin_to_uuid(lead_id) as lead_id,  is_crm_user from lead_additional_information where lead_id = uuid_to_bin(?) `;
    bindParams = [lead_id];
    const newData = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    if (!isUpdated) {
        query = `update leads set step=? where id = uuid_to_bin(?) `;
        bindParams = [step, lead_id];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }

    return { previousData: previousData[0], newData: newData[0], step: step };
}

const createExternalPan = async (data) => {
    let id = uuid();
    let { assigned_to, channel_manager, email, pan, mobile, user_fname, user_mname, user_lname, profession, leadId, utm_campaign, utm_source, utm_medium, utm_content, utm_term } = data;

    const professionId = await createIfNotExist("Profession", profession);
    const sourceId = await createIfNotExist("Lead source", utm_source);

    query = `select bin_to_uuid(id) as id, reapply_count, email, pan, mobile, external_id from leads where email=? or mobile=? or pan=? or external_id=? limit 1`;
    bindParams = [email, mobile, pan, leadId];
    const leadExist = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    if (leadExist[0]) {
        let count = leadExist[0]?.reapply_count ? +leadExist[0]?.reapply_count + 1 : 1;
        let query = `update leads set reapply_count=? where external_id = ?`;
        let bindParams = [count, leadId];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

        let existMessage = "Lead already exist with same";
        if (leadExist[0]?.pan == pan) {
            existMessage += " pan,"
        }
        if (leadExist[0]?.email == email) {
            existMessage += " email,"
        }
        if (leadExist[0]?.mobile == mobile) {
            existMessage += " mobile"
        }
        if (leadExist[0]?.external_id == leadId) {
            existMessage += " Lead ID"
        }
        return { newData: leadExist[0], leadExist: true, reapply_count: count, existMessage: existMessage };

    } else {
        let query = `insert into leads(id, assigned_to, channel_manager, email, pan, mobile, user_fname, user_mname, user_lname, profession, lead_source, utm_campaign, utm_medium, utm_content, utm_term, external_id, step) values(uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,?,?,?,?,?,?,?,?,?,?) `;
        let bindParams = [id, channel_manager, assigned_to, email, pan, mobile, user_fname, user_mname, user_lname, professionId, sourceId, utm_campaign, utm_medium, utm_content, utm_term, leadId, 1];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

        query = `select bin_to_uuid(id) as id, reapply_count, email, pan, mobile, user_fname, user_mname, user_lname, profession, external_id from leads where id = uuid_to_bin(?) `;
        bindParams = [id];
        const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

        return { newData: results[0], leadExist: false, reapply_count: 0 };
    }
}

const createExternalLead = async (data) => {
    let { leadId, have_office, year_loan_buisness, file_process_with_whom, file_process_method, previous_bank_verticle, previous_bank_department } = data;
    let id = uuid();

    const verticleId = await createIfNotExist("Previous bank verticle", previous_bank_verticle);
    const departmentId = await createIfNotExist("Previous bank department", previous_bank_department);

    let query = `select id from leads where external_id = ?`;
    let bindParams = [leadId];
    const leadDetails = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    query = `select id from lead_additional_information where lead_id = ? `;
    bindParams = [leadDetails[0]?.id];
    const detailExist = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    if (detailExist[0]) {
        query = `update lead_additional_information set have_office=?, year_loan_buisness=?, file_process_with_whom=?, file_process_method=?, previous_bank_verticle=?, previous_bank_department=? where id = ?`;
        bindParams = [have_office || null, year_loan_buisness || null, file_process_with_whom || null, file_process_method || null, verticleId || null, departmentId || null, detailExist[0]?.id || null];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    } else {
        query = `insert into lead_additional_information(id, lead_id, have_office, year_loan_buisness, file_process_with_whom, file_process_method, previous_bank_verticle, previous_bank_department) values(uuid_to_bin(?),?,?,?,?,?,?,?) `;
        bindParams = [id, leadDetails[0]?.id, have_office || null, year_loan_buisness || null, file_process_with_whom || null, file_process_method || null, verticleId || null, departmentId || null];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

        query = `update leads set step=? where id=? `;
        bindParams = [2, leadDetails[0]?.id];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    }

    query = `select bin_to_uuid(id) as id, bin_to_uuid(lead_id) as lead_id, have_office, year_loan_buisness, file_process_with_whom, file_process_method, previous_bank_verticle, previous_bank_department from lead_additional_information where lead_id=?`;
    bindParams = [leadDetails[0]?.id];
    let results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    return { result: results[0] }
}


const updateAssignee = async (data) => {
    //is_crm_user
    let { leadId, assignTo } = data;

    let query = `select bin_to_uuid(assigned_to) as assigned_to from leads where id = uuid_to_bin(?) `;
    let bindParams = [leadId];
    const previousData = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    query = `update leads set assigned_to=uuid_to_bin(?), assigned_to_date=? where id = uuid_to_bin(?) `;
    bindParams = [assignTo, new Date(), leadId];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

    query = `select bin_to_uuid(id) as id, prefix, user_fname, user_mname, user_lname, lead_source, status, bin_to_uuid(assigned_to) as assigned_to, bin_to_uuid(channel_manager) as channel_manager, is_fresh_lead, profession, category, alt_mobile, potential, dob, lead_type, payout_percentage from leads where id = uuid_to_bin(?) `;
    bindParams = [leadId];
    const newData = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    return { previousData: previousData[0], newData: newData[0] };
}

const update = async (data, id) => {
    let { mobile, updatedAt, prefix, user_fname, user_mname, user_lname, email, source, lead_source, status, assigned_to, channel_manager, pan, is_fresh_lead, profession, category, alt_mobile, potential, dob, lead_type, payout_percentage } = data;
    let query = `update leads set mobile = ?,prefix = ?,user_fname =?,user_mname =?,user_lname =?,email =?,source =?,lead_source =?,status =?,assigned_to =uuid_to_bin(?),channel_manager =uuid_to_bin(?),pan =?,is_fresh_lead =?,profession =?,category =?,alt_mobile =?,potential =?,dob =?,lead_type =?, payout_percentage =?, updatedAt =? where id = uuid_to_bin(?) `;
    let bindParams = [mobile, prefix, user_fname, user_mname, user_lname, email, source, lead_source, status, assigned_to, channel_manager, pan, is_fresh_lead, profession, category, alt_mobile, potential, dob, lead_type, payout_percentage, updatedAt, id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    query = `select bin_to_uuid(id) as id,mobile,prefix,user_fname,user_mname,user_lname,email,source,lead_source,status,assigned_to,pan,is_fresh_lead,profession,category,alt_mobile,potential,dob,lead_type, payout_percentage from leads where id = uuid_to_bin(?) `;
    bindParams = [id];
    const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
}

const createAddress = async (data) => {
    let id = uuid();
    let { lead_id, address, city, state, pincode, type } = data;
    let query = `insert into lead_address(id,lead_id,address,city,state,pincode,type) values(uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,?) `;
    let bindParams = [id, lead_id, address, city, state, pincode, type];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    query = `select bin_to_uuid(id) as id ,bin_to_uuid(lead_id) as lead_id,address,city,state,pincode,type from lead_address where id = uuid_to_bin(?) `;
    bindParams[id];
    const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
}

const createInformation = async (data) => {
    let id = uuid();
    let { lead_id, has_done_loan_buisness, year_loan_buisness, has_coonector_code, has_reapplied, secondary_email } = data;
    let query = `insert into lead_additional_information(id,lead_id,has_done_loan_buisness,year_loan_buisness,has_coonector_code,has_reapplied,secondary_email) values(uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,?) `;
    let bindParams = [id, lead_id, has_done_loan_buisness, year_loan_buisness, has_coonector_code, has_reapplied, secondary_email];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    query = `select bin_to_uuid(id) as id,bin_to_uuid(lead_id) as lead_id,has_done_loan_buisness,year_loan_buisness,has_coonector_code,has_reapplied,secondary_email from lead_additional_information where id = uuid_to_bin(?) `;
    bindParams[id];
    const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
}

const updateInformation = async (data, id) => {
    let { has_done_loan_buisness, year_loan_buisness, has_coonector_code, has_reapplied, secondary_email } = data;
    let query = `update lead_additional_information set has_done_loan_buisness =? ,year_loan_buisness =?,has_coonector_code = ?,has_reapplied = ?,secondary_email =? where lead_id = uuid_to_bin(?) `;
    let bindParams = [has_done_loan_buisness, year_loan_buisness, has_coonector_code, has_reapplied, secondary_email, id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    query = `select bin_to_uuid(id) as id,bin_to_uuid(lead_id) as lead_id,has_done_loan_buisness,year_loan_buisness,has_coonector_code,has_reapplied,secondary_email from lead_additional_information where id = uuid_to_bin(?) `;
    bindParams = [id];
    const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
}

const findLead = async (id, is_deleted) => {
    let query = `select * from leads where id = uuid_to_bin(?) and is_deleted = ?`;
    let bindParams = [id, is_deleted];
    const leads = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return leads[0] ? leads[0] : null;
}

const deleteLead = async (id) => {
    let query = `update  set is_deleted = ? leads where id = uuid_to_bin(?) `;
    let bindParams = [true, id];
    const lead = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return lead;
}

const getIsLeadFollowed = async (leadId, userId) => {
    let query = `select * from star_leads where lead_id = uuid_to_bin(?) and user_id = uuid_to_bin(?) `;
    let bindParams = [leadId, userId];
    const leadFollowed = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return leadFollowed.length == 0 ? false : true;
}

const getIsLeadFollowedForAllLead = async (ids, userId) => {
    let query = `select bin_to_uuid(lead_id) as lead_id from star_leads where bin_to_uuid(lead_id) in (?) and user_id = uuid_to_bin(?) `;
    let bindParams = [ids, userId];
    const leadFollowed = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return leadFollowed;
}

const getLeadsExport = async (where, offset, limit) => {
    let query = ` select bin_to_uuid(l.id) as id,l.mobile,l.is_converted as is_converted ,l.prefix, lpr.value as prefix_name, l.user_fname,l.user_mname,l.user_lname,l.email, l.reapply_count, l.utm_campaign, l.utm_medium, l.utm_content, l.utm_term, a.name as assigned_to_name, m.name as channel_manager_name ,l.lead_source as source,lsr.value as lead_source, case when ls.value is null then "Cold" else ls.value end as status, l.status_updated_at, ls.id as status_id,bin_to_uuid(l.assigned_to) as assigned_to, l.assigned_to_date, bin_to_uuid(channel_manager) as channel_manager,l.pan,l.is_fresh_lead, lp.value as profession, lc.value as category,l.alt_mobile,lpt.value as potential,l.dob, l.createdAt as created_at,l.updatedAt as updated_at,l.payout_percentage, lt.value as lead_type, s.name as active_status, la.state, la.city from leads l left join users a on l.assigned_to = a.id left join users m on l.channel_manager =  m.id left join picklist_values ls on l.status = ls.id left join picklist_values lpr on l.prefix = lpr.id  left join picklist_values lsr on l.lead_source  = lsr.id left join picklist_values lp on l.profession = lp.id left join lead_potentials lpt on l.potential = lpt.id left join lead_categories lc on l.category = lc.id left join picklist_values lt on l.lead_type=lt.id left join users u on binary l.mobile = binary u.phone  left join status s on u.status = s.id  left join lead_address la on la.lead_id = l.id where la.type = "home"  ${where} `;
    query += ` order by l.createdAt desc `;
    let leads = await sequelize.query(query, { type: QueryTypes.SELECT });
    return { data: leads };
};

const getLeads = async (where, offset, limit, userId, role) => {
    let query = ` select bin_to_uuid(l.id) as id,l.mobile,l.is_converted as is_converted ,l.prefix, lpr.value as prefix_name, l.user_fname,l.user_mname,l.user_lname,l.email, l.reapply_count, l.utm_campaign, l.utm_medium, l.utm_content, l.utm_term, a.name as assigned_to_name, m.name as channel_manager_name ,l.lead_source as source,lsr.value as lead_source, case when ls.value is null then "Cold" else ls.value end as status, l.status_updated_at, ls.id as status_id,bin_to_uuid(l.assigned_to) as assigned_to, l.assigned_to_date, bin_to_uuid(channel_manager) as channel_manager,l.pan,l.is_fresh_lead, lp.value as profession, lc.value as category,l.alt_mobile,lpt.value as potential,l.dob,l.lead_type, l.createdAt as created_at,l.updatedAt as updated_at,l.payout_percentage, lt.value as lead_type_name, s.name as active_status from leads l left join users a on l.assigned_to = a.id left join users m on l.channel_manager =  m.id left join picklist_values ls on l.status = ls.id left join picklist_values lpr on l.prefix = lpr.id  left join picklist_values lsr on l.lead_source  = lsr.id left join picklist_values lp on l.profession = lp.id left join lead_potentials lpt on l.potential = lpt.id left join lead_categories lc on l.category = lc.id left join picklist_values lt on l.lead_type=lt.id left join users u on binary l.mobile = binary u.phone  left join status s on u.status = s.id ${where} `;
    let queryCount = ` select count(*) as totalCount from leads l left join users a on l.assigned_to = a.id left join users m on l.channel_manager =  m.id left join picklist_values ls on l.status = ls.id left join picklist_values lpr on l.prefix = lpr.id  left join picklist_values lsr on l.lead_source  = lsr.id left join lead_professions  lp on l.profession = lp.id left join lead_potentials lpt on l.potential = lpt.id left join lead_categories lc on l.category = lc.id left join picklist_values lt on l.lead_type=lt.id left join users u on binary l.mobile = binary u.phone  left join status s on u.status = s.id ${where} `;
    query += ` order by l.createdAt desc ${limit != undefined ? ("limit " + offset + "," + limit) : ""}`;
    let leads = await sequelize.query(query, { type: QueryTypes.SELECT });
    let totalCount = await sequelize.query(queryCount, { type: QueryTypes.SELECT });
    let leadIds = [];
    for (let i = 0; i < leads.length; i++) {
        leadIds.push(leads[i].id);
        leads[i].isFollowed = false;
        leads[i].leadAdditionalInformation = null;
    }
    if (leadIds.length == 0) return { data: leads, totalCount: totalCount[0].totalCount };
    let leadInformation = await getLeadInformationForAllLead(leadIds);
    let follows = await getIsLeadFollowedForAllLead(leadIds, userId);
    let leadAddress = await getAddressForLeadArr(leadIds, null);

    for (let i = 0; i < leads.length; i++) {
        for (let j = 0; j < leadAddress.length; j++) {
            let addressExist = Boolean(leads[i].id == leadAddress[j]?.lead_id);
            if (addressExist) {
                const { lead_id, ...rest } = leadAddress[j];
                leads[i].address = Object?.keys(rest)?.length ? rest : null;
            }
        }
        for (let j = 0; j < leadInformation.length; j++) {
            if (leads[i].id == leadInformation[j].lead_id) {
                leads[i].leadAdditionalInformation = leadInformation[j];
            }
        }
        for (let j = 0; j < follows.length; j++) {
            if (leads[i].id == follows[j].lead_id) {
                leads[i].isFollowed = true;
            }
        }
    }
    return { data: leads, totalCount: totalCount[0].totalCount };
}

const getLeadById = async (id) => {
    let query = `select bin_to_uuid(l.id) as id,ls.id as status_id,l.mobile,l.prefix,l.user_fname,l.user_mname,l.user_lname,l.email,a.name as assigned_to_name, m.name as channel_manager_name ,l.source,lsr.value as lead_source,ls.value as status,bin_to_uuid(assigned_to) as assigned_to,bin_to_uuid(channel_manager) as channel_manager,l.pan,l.is_fresh_lead,lp.value as profession,lc.value as category,l.alt_mobile,lpt.value as potential,l.dob,l.lead_type, l.createdAt as created_at,l.updatedAt as updated_at,l.payout_percentage from leads  l left join users a on l.assigned_to = a.id left join users m on l.channel_manager =  m.id left join lead_status ls on l.status = ls.id  left join lead_sources  lsr on l.lead_source  = lsr.id left join lead_professions  lp on l.profession = lp.id left join lead_potentials lpt on l.potential = lpt.id left join lead_categories lc on l.category = lc.id where l.id  = uuid_to_bin(?)  `;
    let bindParams = [id];
    let lead = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    lead = lead[0] ? lead[0] : null;
    if (lead) {
        lead.address = await getAddressForLead(id, null);
        lead.leadAdditionalInformation = await getLeadInformationV2(id);
    }
    return lead;
};

const getLeadByIdV2 = async (id) => {
    let query = ` select bin_to_uuid(l.id) as id, l.status, case when pvs.value is null then "Cold" else pvs.value end as status_name, l.status_updated_at, l.sub_status, l.mobile,l.prefix,l.user_fname,l.user_mname,l.user_lname,l.email,a.name as assigned_to_name, m.name as channel_manager_name ,l.lead_source,bin_to_uuid(l.assigned_to) as assigned_to, l.assigned_to_date, bin_to_uuid(channel_manager) as channel_manager,l.pan,l.is_fresh_lead,l.profession,l.category,l.alt_mobile,l.potential,l.dob,l.lead_type, l.createdAt as created_at,l.updatedAt as updated_at,l.payout_percentage, l.reapply_count, l.utm_campaign, l.utm_medium, l.utm_content, l.utm_term, lp.value as profession, l.profession as profession_id from leads l left join picklist_values pvs on pvs.id = l.status left join users a on l.assigned_to = a.id left join users m on l.channel_manager =  m.id left join picklist_values lp on lp.id = l.profession where l.id  = uuid_to_bin(?)  `;
    let bindParams = [id];
    let lead = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    lead = lead[0] ? lead[0] : null;
    if (lead) {
        lead.address = await getAddressForLead(id, null);
        lead.leadAdditionalInformation = await getLeadInformationV2(id);
    }
    return lead;
};

const getAddressForLead = async (id, type) => {
    let query = `select address, city, state, pincode, type from lead_address l where l.lead_id = uuid_to_bin(?)`;
    let bindParams = [id];
    if (type) {
        query += ' and type = ? ';
        bindParams.push(type);
    }
    let addressResult = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let address = {};
    for (let i = 0; i < addressResult.length; i++) {
        address[addressResult[i].type] = addressResult[i];
    }
    return address;
}

const getAddressForLeadArr = async (arrId, type) => {
    let query = `select bin_to_uuid(l.id) as id , bin_to_uuid(lead_id) as lead_id,address,city,state,pincode,type from lead_address l where bin_to_uuid(l.lead_id) in (?)`;
    let bindParams = [arrId];
    if (type) {
        query += ' and type = ? ';
        bindParams.push(type);
    }
    let addressResult = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let address = [];
    for (let i = 0; i < arrId.length; i++) {
        let resultObj = {};
        let obj = addressResult.filter((obj) => obj?.lead_id == arrId[i]);
        if (obj?.length) {
            resultObj[obj[0]?.type] = obj[0];
            resultObj[obj[1]?.type] = obj[1];
        }
        resultObj["lead_id"] = arrId[i];
        address.push(resultObj);
    }
    return address;
}


const getLeadInformation = async (id) => {
    let query = `select bin_to_uuid(id) as id,bin_to_uuid(lead_id) as lead_id,has_done_loan_buisness,year_loan_buisness,has_coonector_code,has_reapplied,secondary_email,monthly_disbursement,loan_type,bank_leave_duration,previous_loan_type,previous_bank_verticle,previous_bank_department from lead_additional_information where lead_id = uuid_to_bin(?)`;
    let bindParams = [id];
    let leadInformation = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return leadInformation[0] ? leadInformation[0] : null;
}

const getLeadInformationForAllLead = async (id) => {
    let query = `select bin_to_uuid(id) as id,bin_to_uuid(lead_id) as lead_id,has_done_loan_buisness,year_loan_buisness,has_coonector_code,has_reapplied,secondary_email,monthly_disbursement,loan_type,bank_leave_duration,previous_loan_type,previous_bank_verticle,previous_bank_department from lead_additional_information where bin_to_uuid(lead_id) in (?)`;
    let bindParams = [id];
    let leadInformation = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return leadInformation;
}

const getLeadInformationV2 = async (id) => {
    let query = `select bin_to_uuid(id) as id,bin_to_uuid(lead_id) as lead_id, current_payout_od_cc, has_done_loan_buisness,year_loan_buisness,has_coonector_code,has_reapplied,secondary_email,loan_type, have_office, is_office_rented, number_of_staff, heard_of_ruloans, where_you_heard, monthly_disbursement, purpose_of_joining, bank_leave_duration, previous_loan_type, previous_bank_verticle,previous_bank_department, current_payout_pl, current_payout_bl, current_payout_hl, current_payout_lap, current_payout_ncl, current_payout_ucl, current_payout_car_refinance, current_payout_gl, current_payout_project_loan, current_payout_el, current_payout_msme_loan, current_payout_working_loan, is_crm_user from lead_additional_information where lead_id = uuid_to_bin(?)`;
    let bindParams = [id];
    let leadInformation = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return leadInformation[0] ? leadInformation[0] : null;
}

const updateAddress = async (data, id) => {
    let { address, city, state, pincode, type } = data;
    let query = `update  lead_address set address = ?,city = ?,state = ?,pincode = ? where lead_id = uuid_to_bin(?) and type = ? `;
    let bindParams = [address, city, state, pincode, id, type];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    query = `select bin_to_uuid(id) as id ,bin_to_uuid(lead_id) as lead_id,address,city,state,pincode,type from lead_address where id = uuid_to_bin(?) `;
    bindParams = [id];
    const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
}

const followLead = async (leadId, userId) => {
    let selectQuery = `select * from star_leads where lead_id = uuid_to_bin(?) and user_id = uuid_to_bin(?) `;
    let bindParams = [leadId, userId];
    let followLeads = await sequelize.query(selectQuery, { replacements: bindParams, type: QueryTypes.SELECT });
    if (followLeads && followLeads.length != 0) {
        return;
    } else {
        let id = uuid();
        let bindParams = [id, leadId, userId]
        let followQuery = ` insert into star_leads (id,lead_id,user_id) values(uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?)) `;
        return await sequelize.query(followQuery, { replacements: bindParams, type: QueryTypes.INSERT });
    }
}


const unFollowLead = async (leadId, userId) => {
    let bindParams = [leadId, userId]
    let followQuery = ` delete from  star_leads where lead_id = uuid_to_bin(?) and user_id = uuid_to_bin(?) `;
    return await sequelize.query(followQuery, { replacements: bindParams, type: QueryTypes.DELETE });
}

const getStaredLeadForUser = async (userId) => {
    let selectQuery = `select bin_to_uuid(lead_id) as lead_id from star_leads where  user_id = uuid_to_bin(?) `;
    let bindParams = [userId];
    let leads = await sequelize.query(selectQuery, { replacements: bindParams, type: QueryTypes.SELECT });
    if (leads && leads.length != 0) {
        let leadIds = [];
        for (let i = 0; i < leads.length; i++) {
            leadIds.push(leads[i].lead_id);
        }
        selectQuery = ` select bin_to_uuid(l.id) as id,l.mobile,l.prefix,l.user_fname,l.user_mname,l.user_lname,l.email,a.name as assigned_to_name, m.name as channel_manager_name ,l.source,lsr.value as lead_source,ls.value as status,bin_to_uuid(assigned_to) as assigned_to,bin_to_uuid(channel_manager) as channel_manager,l.pan,l.is_fresh_lead,lp.value as profession,lc.value as category,l.alt_mobile,lpt.value as potential,l.dob,l.lead_type, l.createdAt as created_at,l.updatedAt as updated_at,l.payout_percentage from leads  l left join users a on l.assigned_to = a.id left join users m on l.channel_manager =  m.id left join lead_status ls on l.status = ls.id  left join lead_sources  lsr on l.lead_source  = lsr.id left join lead_professions  lp on l.profession = lp.id left join lead_potentials lpt on l.potential = lpt.id left join lead_categories lc on l.category = lc.id where  l.id in (uuid_to_bin(?)) `;
        bindParams = [leadIds];
        leads = await sequelize.query(selectQuery, { replacements: bindParams, type: QueryTypes.SELECT });
        return leads;
    } else {
        return [];
    }

}

const getLeadPayouts = async (offset, limit, search, where) => {


    let bindParams = [];
    let and = false;
    let query = '  select p.product, lp.ratio, lp.payout_lock, lp.id as id , lp.percentage as payout_percentage_lead , bin_to_uuid(lp.user_id) as lead_id,lp.payout_id,  p.bank_name,p.avg_achievment ,p.registered_on_company_name,p.main_product ,p.sub_product ,p.agreement_expired_by ,p.enrollment_date, p.billing_mode, p.login_code ,p.product_group,p.address,p.max_payout ,p.billing_date_from ,p.billing_date_to ,p.applicable_from ,p.applicable_to ,p.remarks ,p.type as payout_type from lead_payout lp left join payouts p on lp.payout_id= p.id left join leads l on lp.user_id = l.id   ';
    let queryCount = ' SELECT  count(*) as totalCount from lead_payout lp left join payouts p on lp.payout_id= p.id left join leads l on lp.user_id = l.id   ';
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
    query += `order by p.bank_name asc  limit ${offset},${limit} `;
    const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    const totalCount = await sequelize.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    return { results, totalCount: totalCount[0].totalCount };
    // We didn't need to destructure the result here - the results were returned directly
}

const getMaxPayoutValidation = async (payout_id) => {
    let query = '  select p.avg_achievment, gp.payout_percentage from lead_payout lp left join payouts p on lp.payout_id= p.id left join dsa_global_payouts_percentage gp on gp.phone = lp.phone where lp.id = ? ';
    let bindParams = [payout_id];
    const data = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let achievement = Number(data[0]?.avg_achievment) || 1;
    let percentage = Number(data[0]?.payout_percentage) || 50;
    let percentageOfAchievement = (achievement * percentage) / 100;
    return percentageOfAchievement;
};

const updateLeadConverted = async (mobile, is_converted) => {

    let query = '  update leads set is_converted = ? where mobile = ? ';
    let bindParams = [is_converted, mobile]
    const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return true;
    // We didn't need to destructure the result here - the results were returned directly
};

const findLeadPayout = async (phone) => {
    let query = ' select * from lead_payout where phone = ? ';
    let bindParams = [phone]
    const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
    // We didn't need to destructure the result here - the results were returned directly
};

const createLeadPayout = async (phone, payout_percentage) => {
    if (phone) {
        let bindParams = [];
        let query = `select id, avg_achievment from payouts `;
        let results = await sequelize.query(query, { type: QueryTypes.SELECT });
        for (let i = 0; i < results.length; i++) {
            if (i == 0) query = ` insert into lead_payout(payout_id,phone,percentage,is_updated) values (?,?,?,?) `;
            else {
                query += `, (?,?,?,?) `
            }
            bindParams = bindParams.concat([results[i].id, phone, results[i].avg_achievment * payout_percentage / 100, 0]);
        }
        if (results.length) {
            await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
        }
    };
};

const getDsaPayoutHook = async (phone, offset, limit) => {

    let query = ' select   p.bank_name,p.main_product ,lp.percentage as payout_percentage,p.sub_product ,p.product from lead_payout lp left join payouts p on lp.payout_id= p.id left join leads l on lp.user_id = l.id  where lp.phone = ? ';
    let totalQuery = ' select  count(*) as totalCount from lead_payout lp left join payouts p on lp.payout_id= p.id left join leads l on lp.user_id = l.id  where lp.phone = ? ';
    let totalCount;
    let bindParams = [phone];
    let results;

    if (limit || limit === 0 || offset || offset === 0) {
        query += ` limit ${offset},${limit}`;
        results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        totalCount = await sequelize.query(totalQuery, { replacements: bindParams, type: QueryTypes.SELECT });
        return { payouts: results, totalCount: totalCount[0].totalCount }
    } else {
        results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        return { payouts: results };
    }


    // We didn't need to destructure the result here - the results were returned directly
}

//this service is used for external API , should not send any sensitive data
const getDsaPayouts = async (phone, offset, limit, where) => {

    let query = `select p.bank_name, p.main_product, p.login_code, lp.percentage as payout_percentage, lp.ratio as payout_ratio , p.sub_product ,p.product from lead_payout lp left join payouts p on lp.payout_id= p.id left join leads l on lp.user_id = l.id  where lp.phone = ? ${where}`;
    let totalQuery = `select  count(*) as totalCount from lead_payout lp left join payouts p on lp.payout_id= p.id left join leads l on lp.user_id = l.id  where lp.phone = ? ${where}`;
    let totalCount;
    let bindParams = [phone];
    let results;

    if (limit || limit === 0 || offset || offset === 0) {
        query += ` limit ${offset},${limit}`;
        results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        totalCount = await sequelize.query(totalQuery, { replacements: bindParams, type: QueryTypes.SELECT });
        return { payouts: results, totalCount: totalCount[0].totalCount }
    } else {
        results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        return { payouts: results };
    }


    // We didn't need to destructure the result here - the results were returned directly
}

const deleteLeadPayout = async (id) => {
    let deleteQuery = query = ` delete from lead_payout where user_id =  uuid_to_bin(?) `;
    let bindParams = [id];
    await sequelize.query(deleteQuery, { replacements: bindParams, type: QueryTypes.DELETE });
}

const getLockedPayout = async (phone) => {
    let query = ` select payout_id from lead_payout where phone = ? and payout_lock = 1 `;
    let bindParams = [phone];
    let data = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return data;
}

const deleteLeadPayoutPhone = async (phone, locked_payout = []) => {
    let deleteQuery = ` delete from lead_payout where phone =  ? ${locked_payout?.length ? ` and payout_id not in (${locked_payout}) ` : ""} `;
    let bindParams = [phone];
    await sequelize.query(deleteQuery, { replacements: bindParams, type: QueryTypes.DELETE });
}

const updateDsaPayoutPercentage = async (phone, payout_percentage) => {
    let updateQuery = ` update dsa_global_payouts_percentage set payout_percentage = ? where phone = ? `;
    let bindParams = [payout_percentage, phone];
    await sequelize.query(updateQuery, { replacements: bindParams, type: QueryTypes.UPDATE });
}



const insertDsaPayoutPercentage = async (phone, payout_percentage) => {
    let id = uuid();
    let insertQuery = ` insert into  dsa_global_payouts_percentage (id,phone,payout_percentage) values(uuid_to_bin(?),?,?)  `;
    let bindParams = [id, phone, payout_percentage];
    await sequelize.query(insertQuery, { replacements: bindParams, type: QueryTypes.INSERT });
}

const getDsaPayoutPercentage = async (phone) => {
    let selectQuery = ` select payout_percentage from  dsa_global_payouts_percentage where phone = ? `;
    let bindParams = [phone];
    let payout_percenatge = await sequelize.query(selectQuery, { replacements: bindParams, type: QueryTypes.SELECT });
    return payout_percenatge[0] ? payout_percenatge[0].payout_percentage : null;
}
const getDsaPayoutPercentageData = async (phone) => {
    let selectQuery = ` select payout_percentage from  dsa_global_payouts_percentage where phone = ? `;
    let bindParams = [phone];
    let payout_percenatge = await sequelize.query(selectQuery, { replacements: bindParams, type: QueryTypes.SELECT });
    return payout_percenatge[0];
}

const getLeadPayoutPercentage = async (id) => {
    let selectQuery = ` select payout_percentage from  leads where id = uuid_to_bin(?) `;
    let bindParams = [id];
    let payout_percenatge = await sequelize.query(selectQuery, { replacements: bindParams, type: QueryTypes.SELECT });
    return payout_percenatge[0] ? payout_percenatge[0].payout_percentage : null;
}

const getDsaPayoutUpdatedHook = async (phone, offset, limit) => {

    let query = ' select   p.bank_name,p.main_product ,lp.percentage as payout_percentage,p.sub_product ,p.product from lead_payout lp left join payouts p on lp.payout_id= p.id left join leads l on lp.user_id = l.id  where lp.phone = ? and lp.is_updated = ?';
    let totalQuery = ' select  count(*) as totalCount from lead_payout lp left join payouts p on lp.payout_id= p.id left join leads l on lp.user_id = l.id  where lp.phone = ? and lp.is_updated =? ';
    let totalCount;
    let bindParams = [phone, true];
    let results;

    if (limit || limit === 0 || offset || offset === 0) {
        query += ` limit ${offset},${limit}`;
        results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        totalCount = await sequelize.query(totalQuery, { replacements: bindParams, type: QueryTypes.SELECT });
        return { payouts: results, totalCount: totalCount[0].totalCount }
    } else {
        results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        return { payouts: results };
    }


    // We didn't need to destructure the result here - the results were returned directly
}

const updateLeadPayout = async (id, payout_percenatge, payoutLock) => {
    let query = ' update lead_payout set percentage = ?, payout_lock=? where id = ? '
    let bindParams = [payout_percenatge, payoutLock, id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
}

const getCallStatus = async () => {
    let query = ' select * from call_status '
    let bindParams = [];
    return await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
}

const getCallStatusById = async (id) => {
    let query = ' select * from call_status where id = ? '
    let bindParams = [id];
    let status = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return status[0];
}

const getCallStatusByValue = async (value) => {
    let query = ' select * from call_status where value = ? '
    let bindParams = [id];
    let status = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return status[0];
}

const getLeadAssignReport = async (offset, limit, startDateFilter, endDateFilter) => {
    let query = ` select ll.id, bin_to_uuid(ll.lead_id) as leadId, CONCAT_WS(" ", l.user_fname, l.user_mname, l.user_lname) as name, ll.from_value, ll.to_value, DATE(ll.created_at) from lead_logs ll left join leads l  on l.id = ll.lead_id where ll.type_value = 'assigned_to' and ll.from_value is not null `;
    if (Boolean(startDateFilter)) { query += `and DATE(ll.created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}")` };
    query += ` order by ll.created_at desc  ${limit ? `limit ${offset},${limit}` : ""} `;
    let lead_logs = await sequelize.query(query, { type: QueryTypes.SELECT });

    query = ` select count(*) as count from lead_logs ll left join leads l  on l.id = ll.lead_id where ll.type_value = 'assigned_to' and ll.from_value is not null `;
    if (Boolean(startDateFilter)) { query += `and DATE(ll.created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}")` };
    let totalCount = await sequelize.query(query, { type: QueryTypes.SELECT });

    return { records: lead_logs, totalCount: totalCount[0]?.count };
}

const getPartnerAssignReport = async (offset, limit, startDateFilter, endDateFilter) => {
    let query = ` select al.id, al.application_id, d.full_name as name, al.from_value, al.to_value, DATE(al.createdAt) as created_at from application_logs al left join RULoans.ru_direct_selling_agents d on al.application_id = d.dsa_id where al.application_type = "dsa" and field = "partner" `;
    if (Boolean(startDateFilter)) { query += `and DATE(al.createdAt) between DATE("${startDateFilter}") and DATE("${endDateFilter}")` };
    query += ` order by al.createdAt desc  ${limit ? `limit ${offset},${limit}` : ""} `;
    let lead_logs = await sequelize.query(query, { type: QueryTypes.SELECT });

    query = ` select count(*) as count from application_logs al left join RULoans.ru_direct_selling_agents d on al.application_id = d.dsa_id where al.application_type = "dsa" and field = "partner" `;
    if (Boolean(startDateFilter)) { query += `and DATE(al.createdAt) between DATE("${startDateFilter}") and DATE("${endDateFilter}")` };
    let totalCount = await sequelize.query(query, { type: QueryTypes.SELECT });

    return { records: lead_logs, totalCount: totalCount[0]?.count };
}

const addDispostionToCallLogs = async (user_type, createdBy, user_id, call_status, remarks, call_id, disposition, caller_id, payload) => {
    let id = uuid();
    let insertQuery = ` insert into  call_logs (id,user_type,createdBy,user_id,call_status,remarks,call_id,disposition,caller_id) values(uuid_to_bin(?),?,?,?,?,?,?,?,?)  `;
    let bindParams = [id, user_type, createdBy, user_id, call_status, remarks, call_id, disposition, caller_id];
    let result = await sequelize.query(insertQuery, { replacements: bindParams, type: QueryTypes.INSERT });

    console.log(result)
    query = ` insert into external_api_logs(user_id,api,api_type,header,payload,response,has_error,error_message) values(?,?,?,?,?,?,?,?) `;
    bindParams = ['weebhook-incoming', '/despositionWebhook', 'post', '', JSON.stringify(payload), JSON.stringify({}), false, ''];
    await sequelize.query(query, { type: QueryTypes.INSERT, replacements: bindParams });
};

const getLeadForms = async (sort_field, sort_order, offset, limit, where, fresh_lead_id, is_export, custom_select_string = "", count_only = false, data_only = false) => {
    let query = `
                SELECT 
                    flc.customer_id,
                    flc.claim_pending_flag,
                    flc.nearby_matched,
                    case 
                        when flc.user_type = 'company' then rc.pan
                        else kyc.permanent_account_number
                    end AS dsa_pan,
                    flc.platform,
                    flc.form_type,
                    flc.user_type,
                    case    
                        when flc.user_type = 'company' then cdsa.assigning_payout_percentage
                        else d.assigning_payout_percentage  
                    end AS assigning_payout_percentage,
                    case 
                        when flc.user_type = 'company' then rc.company_id
                        else d.dsa_id
                    end AS dsa_id,
                    rc.registered_by AS registered_by_id,
                    flc.netsuite_vendor_claim_file_internal_id,
                    flc.netsuite_vendor_id,
                    flc.loan_status,
                    flc.user_remark,
                    flc.reject_reason,
                    flc.is_split_case,
                    flc.vendor_payout_type,
                    flc.business_categories,
                    flc.id,
                    CASE 
                        WHEN flc.upload_file_name IS NULL THEN "Self" 
                        ELSE flc.upload_file_name 
                    END AS upload_file_name,
                    flc.fresh_lead_id,
                    flc.fresh_lead_status_id,
                    flc.product_name,
                    flc.claim_month,
                    flc.loan_reference_id,
                    flc.loan_reference_id_type,
                    flc.loan_apac_ref_los_number,
                    flc.netsuite_bank_id,
                    flc.netsuite_product_id,
                    flc.bank_name,
                    flc.customer_full_name,
                    flc.customer_first_name,
                    flc.customer_middle_name,
                    flc.customer_last_name,
                    flc.dsa_mobile_number,
                    flc.disbursement_date,
                    flc.disbursement_date_iso,
                    flc.disbursement_amount,
                    flc.vendor_payout_rate,
                    flc.vendor_payout_ratio,
                    ROUND(flc.vendor_payout_amount, 2) AS vendor_payout_amount,
                    flc.max_upfront_payout_percentage,
                    flc.max_vendor_payout_percentage,
                    flc.created_at,
                    flc.updated_at,
                    case 
                        when flc.user_type = 'company' then rc.name
                        else d.full_name
                    end AS dsa_name,
                    flc.is_deleted,
                    flc.vendor_remark,
                    flc.claim_confirmation,
                    flc.current_hierarchy_crm,
                    flcm.is_tentative_matched,
                    flcm.tentative_bank_file_id,
                    flcm.is_bank_file_matched,
                    flcm.bank_file_id,
                    flcm.is_online_lead,
                    case 
                        when flc.user_type = 'company' then cdsa.is_same_day_billing_enabled
                        else d.is_same_day_billing_enabled
                    end AS is_same_day_billing_enabled,
                    case 
                        when flc.user_type = 'company' then cdsa.is_auto_erp
                        else d.is_auto_erp
                    end AS is_auto_erp,
                    case 
                        when flc.user_type = 'company' then rc.is_pan_verified
                        else kyc.is_permanent_account_number_verified
                    end AS authbridge_pan_verification_status,
                    flc.same_day_billing,
                    flc.to_be_billed,
                    flc.ai_status,
                    flc.reconciliation_data,
                    flc.is_banker_file_processed
                    ${custom_select_string}
                FROM ru_fresh_lead_claims flc
                LEFT JOIN ru_fresh_lead_claims_meta flcm 
                    ON flcm.fresh_lead_id = flc.fresh_lead_id
                LEFT JOIN ru_direct_selling_agents d 
                    ON d.dsa_id = flc.dsa_id
                LEFT JOIN ru_dsa_kyc_data kyc 
                    ON d.dsa_id = kyc.dsa_id
                LEFT JOIN ru_companies rc 
                    ON flc.user_type = 'company' and rc.company_id = flc.dsa_id
                LEFT JOIN ru_direct_selling_agents cdsa 
                    ON rc.registered_by = cdsa.dsa_id
                ${where ? (where.trim().startsWith('where') ? where : `WHERE 1=1 ${where}`) : 'WHERE 1=1'}
            `;

    if (is_export) {
        query = `SELECT 
                CASE
                    WHEN
                        MONTH(STR_TO_DATE(flc.claim_month, '%b %Y')) BETWEEN 4 AND 12
                    THEN
                        CONCAT('FY ',
                                YEAR(STR_TO_DATE(flc.claim_month, '%b %Y')) + 1,
                                ' : Q',
                                CASE
                                    WHEN MONTH(STR_TO_DATE(flc.claim_month, '%b %Y')) BETWEEN 4 AND 6 THEN '1'
                                    WHEN MONTH(STR_TO_DATE(flc.claim_month, '%b %Y')) BETWEEN 7 AND 9 THEN '2'
                                    WHEN MONTH(STR_TO_DATE(flc.claim_month, '%b %Y')) BETWEEN 10 AND 12 THEN '3'
                                END,
                                ' ',
                                YEAR(STR_TO_DATE(flc.claim_month, '%b %Y')) + 1,
                                ' : ',
                                flc.claim_month)
                    WHEN
                        MONTH(STR_TO_DATE(flc.claim_month, '%b %Y')) BETWEEN 1 AND 3
                    THEN
                        CONCAT('FY ',
                                YEAR(STR_TO_DATE(flc.claim_month, '%b %Y')),
                                ' : Q4 ',
                                YEAR(STR_TO_DATE(flc.claim_month, '%b %Y')),
                                ' : ',
                                flc.claim_month)
                    ELSE ''
                END AS 'Bank_Claim Month',
                COALESCE(flc.loan_apac_ref_los_number, '') AS "LOS/APAC_No",
                COALESCE(flc.loan_reference_id, '') AS "Loan/App_No",
                COALESCE(flc.customer_full_name, '') AS "Borrower_Name",
                COALESCE(flc.customer_first_name, '') AS "Borrower_First_Name",
                COALESCE(flc.customer_last_name, '') AS "Borrower_Last_Name",
                COALESCE(DATE_FORMAT(flc.disbursement_date_iso, '%d/%m/%Y'), '') AS "Disb_Date",
                COALESCE(flc.disbursement_amount, '') AS "Disbursement/Insurance_Amount",
                COALESCE(flc.leader_name, '') AS "Leader Name",
                COALESCE(flc.sub_leader_name, '') AS "Sub Leader name",
                COALESCE(CASE WHEN flc.user_type = 'company' THEN rc.pan ELSE kyc.permanent_account_number END, '') AS "Vendor_Pan",
                COALESCE(d.full_name, '') AS "Vendor_Name",
                COALESCE(flc.vendor_remark, '') AS "Vendor_Remark",
                COALESCE(flc.bank_name, '') AS "Bank/Nbfc_Name",
                COALESCE(flc.product_name, '') AS "Product_Name",
                COALESCE(flc.vendor_payout_rate, 0) AS "Rate",
                COALESCE(flc.is_split_case, '') AS "Is_Split_Case",
                COALESCE(flc.vendor_payout_ratio, 0) AS "Vendor Payout Ratio",
                COALESCE(flc.vendor_payout_type, '') AS "Vendor Payout Type",
                COALESCE(flc.business_categories, '') AS "Business categories",
                COALESCE(flc.upload_file_name, '') AS "Via File Name"

                FROM ru_fresh_lead_claims flc
                LEFT JOIN ru_fresh_lead_claims_meta flcm
                ON flcm.fresh_lead_id = flc.fresh_lead_id
                LEFT JOIN ru_direct_selling_agents d
                ON d.dsa_id = flc.dsa_id
                LEFT JOIN ru_dsa_kyc_data kyc
                ON d.dsa_id = kyc.dsa_id
                LEFT JOIN ru_dsa_claims_remark_list r
                ON r.remark_id = flc.netsuite_remark_id
                LEFT JOIN ru_companies rc 
                ON flc.user_type = 'company' and rc.company_id = flc.dsa_id
                LEFT JOIN ru_direct_selling_agents cdsa 
                ON rc.registered_by = cdsa.dsa_id
                ${where ? (where.trim().startsWith('where') ? where : `WHERE 1=1 ${where}`) : 'WHERE 1=1'}`

    };

    let queryCount = ` select count(flc.id) as totalCount from ru_fresh_lead_claims flc LEFT JOIN ru_fresh_lead_claims_meta flcm ON flcm.fresh_lead_id = flc.fresh_lead_id left join ru_direct_selling_agents d on d.dsa_id = flc.dsa_id left join ru_dsa_kyc_data kyc on d.dsa_id = kyc.dsa_id LEFT JOIN ru_companies rc ON flc.user_type = 'company' and rc.company_id = flc.dsa_id LEFT JOIN ru_direct_selling_agents cdsa ON rc.registered_by = cdsa.dsa_id ${where ? (where.trim().startsWith('where') ? where : `WHERE 1=1 ${where}`) : 'WHERE 1=1'} `;
    let bindParams = [];
    /*   if (fresh_lead_id?.length) {
          if (where) {
              query += ` and flc.id in (?) `
              queryCount += ` and flc.id in (?) `
          } else {
              query += ` where flc.id in (?) `
              queryCount += ` where flc.id in (?) `
          }
          bindParams.push(fresh_lead_id)
      } */
    query += sort_field ? ` order by flc.${sort_field} ${sort_order} ` : ` order by flc.updated_at desc `;

    if (limit && !is_export) {
        query += ` limit ${offset},${limit} `;
    };

    if (is_export) {
        let totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
        totalCount = totalCount[0]?.totalCount
        let leadForms = null
        if (totalCount < 5000) {
            leadForms = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        }
        return { totalCount, leadForms, query, queryCount, bindParams };
    };

    if (count_only) {
        let totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
        return { totalCount: totalCount[0]?.totalCount };
    }

    if (data_only) {
        let leadForms = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        return { leadForms };
    }

    let leadForms = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    /* let creatorsId = [];
    for (let i = 0; i < leadForms.length; i++) {
        if (leadForms[i].created_by) {
            creatorsId.push(leadForms[i].created_by);
        }
    };
    let creators = [];
    if (creatorsId.length) {
        creators = await sequelize.query(` select bin_to_uuid(id) as id,name from users where bin_to_uuid(id) in (?) `, { replacements: [creatorsId], type: QueryTypes.SELECT });
    };

    let creatorsDsa = [];
    if (creatorsId.length) {
        creatorsDsa = await _db2.query(` select * from ru_direct_selling_agents where dsa_id in (?) `, { replacements: [creatorsId], type: QueryTypes.SELECT });
    };
    for (let i = 0; i < leadForms.length; i++) {
        leadForms[i].created_by_name = '';
        for (let j = 0; j < creators.length; j++) {
            if (leadForms[i].created_by == creators[j].id) {
                leadForms[i].created_by_name = creators[j].name;
            }
        }

    };

    for (let i = 0; i < leadForms.length; i++) {
        if (!leadForms[i].created_by_name) leadForms[i].created_by_name = '';
        for (let j = 0; j < creatorsDsa.length; j++) {
            if (leadForms[i].created_by == creatorsDsa[j].dsa_id) {
                leadForms[i].created_by_name = creatorsDsa[j].full_name;
            }
        }
    }; */

    let totalCount = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    return { leadForms, totalCount: totalCount[0]?.totalCount };
};

const getLeadFormDetailsById = async (fresh_lead_id) => {
    const where = " WHERE flc.fresh_lead_id = ? ";
    const bindParams = [fresh_lead_id];
    let query = `
                SELECT DISTINCT 
                    flc.customer_id,
                    flc.claim_pending_flag,
                    flc.multi_funded_flag,
                    CASE WHEN flc.user_type = 'company' THEN cdsa.assigning_payout_percentage ELSE d.assigning_payout_percentage END AS assigning_payout_percentage,
                    flc.nearby_matched,
                    CASE WHEN flc.user_type = 'company' THEN rc.registered_by ELSE flc.dsa_id END AS dsa_id,
                    CASE WHEN flc.user_type = 'company' THEN rc.name ELSE d.full_name END AS dsa_name,
                    CASE WHEN flc.user_type = 'company' THEN rc.pan ELSE kyc.permanent_account_number END AS dsa_pan,
                    rc.company_id,
                    flc.platform,
                    flc.form_type,
                    flc.netsuite_vendor_claim_file_internal_id,
                    flc.netsuite_vendor_id,
                    flc.loan_status,
                    flc.is_split_case,
                    flc.vendor_payout_type,
                    flc.business_categories,
                    flc.id,
                    CASE 
                        WHEN flc.upload_file_name IS NULL THEN "Self" 
                        ELSE flc.upload_file_name 
                    END AS upload_file_name,
                    flc.fresh_lead_id,
                    flc.fresh_lead_status_id,
                    flc.product_name,
                    flc.claim_month,
                    flc.loan_reference_id,
                    flc.loan_reference_id_type,
                    flc.loan_apac_ref_los_number,
                    flc.netsuite_bank_id,
                    flc.netsuite_product_id,
                    flc.bank_name,
                    flc.customer_full_name,
                    flc.customer_first_name,
                    flc.customer_middle_name,
                    flc.customer_last_name,
                    flc.dsa_mobile_number,
                    flc.disbursement_date,
                    flc.disbursement_date_iso,
                    flc.disbursement_amount,
                    flc.vendor_payout_rate,
                    flc.vendor_payout_ratio,
                    ROUND(flc.vendor_payout_amount, 2) AS vendor_payout_amount,
                    flc.actual_paid_rate,
                    flc.vendor_bill_transaction_reference_number,
                    flc.diff_in_bill_conf_payout,
                    flc.confirmed_payout,
                    flc.claim_confirmation,
                    flc.max_upfront_payout_percentage,
                    flc.max_vendor_payout_percentage,
                    flc.netsuite_vendor_bill_amount,
                    flc.payout_collide,
                    ROUND(flc.payout_collide_value, 2) AS payout_collide_value,
                    flc.created_by,
                    flc.created_at,
                    flc.updated_at,
                    CASE WHEN flc.platform = 'web_application' THEN d_creator.full_name ELSE COALESCE(u_creator.name, d_creator.full_name) END AS created_by_name,
                    flcs.fresh_lead_status_description AS fresh_lead_status_name,
                    flc.is_deleted,
                    flc.current_hierarchy_crm,
                    flcm.is_tentative_matched,
                    flcm.tentative_bank_file_id,
                    flc.same_day_billing,
                    flc.to_be_billed,
                    flc.ai_status,
                    flc.reconciliation_data,
                    flc.is_banker_file_processed,
                    flc.user_type,
                    flcm.confirmation_required,
                    flcm.cc_email,
                    flcm.expected_billing_month,
                    flcm.cc_email_date,
                    flcm.banker_id,
                    flcm.asm_id,
                    flcm.total_paid_on_single_bank_file,
                    banker.sp_email AS banker_email,
                    banker.sp_mobile AS banker_mobile,
                    banker.sp_name AS banker_name,
                    asm.sp_email AS asm_email,
                    asm.sp_mobile AS asm_mobile,
                    asm.sp_name AS asm_name,
                    flc.city,
                    flc.ns_contest_id,
                    events.title AS ns_contest_title,
                    CASE
                        WHEN flc.form_type = 'customer_lead_form' AND (flc.loan_status IS NULL OR flc.loan_status != 'disbursed') THEN NULL
                        WHEN flc.is_deleted = 1 THEN 'deleted'
                        WHEN flc.multi_funded_flag = 0 THEN 'multi_funded_pending'
                        WHEN flc.multi_funded_flag = 1 THEN 'multi_funded_confirmed'
                        WHEN flc.claim_pending_flag = 0 THEN 'claim_pending'
                        WHEN (CASE WHEN flc.user_type = 'company' THEN cdsa.assigning_payout_percentage IS NULL OR cdsa.assigning_payout_percentage = 0 ELSE d.assigning_payout_percentage IS NULL OR d.assigning_payout_percentage = 0 END) THEN 'payout_pending'
                        WHEN flc.fresh_lead_status_id IN (13) THEN (
                            CASE
                                WHEN flc.ai_status IS NULL THEN 'banker_pending'
                                WHEN flc.ai_status = 'confirmed' THEN 'banker_confirmed'
                                WHEN flc.ai_status = 'partial_matched' THEN 'banker_partial_match'
                                WHEN flc.ai_status = 'failed' THEN 'banker_failed'
                                WHEN flc.ai_status = 'on_hold' THEN 'banker_on_hold'
                                ELSE 'banker_pending'
                            END
                        )
                        WHEN flc.fresh_lead_status_id IN (0) THEN 'pending'
                        WHEN flc.fresh_lead_status_id IN (1,6) THEN 'approved_erp'
                        WHEN flc.fresh_lead_status_id IN (2,5,9,10,11,12) THEN 'wip_erp'
                        WHEN flc.fresh_lead_status_id IN (4) THEN 'not_found_erp'
                        WHEN flc.fresh_lead_status_id IN (3,7,8) THEN 'error_erp'
                    END AS computed_status
                FROM ru_fresh_lead_claims flc
                LEFT JOIN ru_fresh_lead_claims_meta flcm 
                    ON flcm.fresh_lead_id = flc.fresh_lead_id
                LEFT JOIN ru_direct_selling_agents d ON d.dsa_id = flc.dsa_id
                LEFT JOIN ru_dsa_kyc_data kyc ON d.dsa_id = kyc.dsa_id
                LEFT JOIN ru_companies rc ON flc.user_type = 'company' AND rc.company_id = flc.dsa_id
                LEFT JOIN ru_direct_selling_agents cdsa ON rc.registered_by = cdsa.dsa_id
                LEFT JOIN ru_branch_sales_people banker ON banker.id = flcm.banker_id
                LEFT JOIN ru_branch_sales_people asm ON asm.id = flcm.asm_id
                LEFT JOIN ru_events events ON flc.ns_contest_id = events.ns_contest_id AND events.type = 'lead_form_contest'
                LEFT JOIN ru_fresh_lead_claim_status_list flcs 
                    ON flc.fresh_lead_status_id = flcs.fresh_lead_status_id
                LEFT JOIN CRMTest.users u_creator 
                    ON BIN_TO_UUID(u_creator.id) = flc.created_by
                LEFT JOIN ru_direct_selling_agents d_creator 
                    ON d_creator.dsa_id = flc.created_by
                ${where}
                order by flc.created_at desc
                limit 1
            `;
    const leadForms = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    const leadForm = leadForms && leadForms[0] ? leadForms[0] : null;
    return { leadForm };
};

const findBankNameById = async (id) => {
    let query = ' select id, netsuite_bank_id , bank_name , external_id , registered_on_company_name, pan , status , grade , remarks from ru_netsuite_banks where netsuite_bank_id = ? '
    let bindParams = [id];
    let lead_payout = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return lead_payout[0];
};

const findProductNameById = async (id) => {
    let query = ' select * from ru_netsuite_products where netsuite_product_id = ? '
    let bindParams = [id];
    let lead_payout = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return lead_payout[0];
};

const getProductOrBankDropdown = async (type, bank_id, product_id, pageSize, pageNumber, search, active_only) => {
    let query = "";
    let product = [];
    let bank = [];
    let productJoinQuery = product_id ? ` left join ru_bank_product_combinations c on c.bank_id = b.netsuite_bank_id left join ru_netsuite_products p on c.product_id = p.netsuite_product_id where c.product_id in (${product_id}) and p.status != 0 ` : "";
    let joinQuery = bank_id ? ` left join ru_bank_product_combinations c on c.product_id = p.netsuite_product_id left join ru_netsuite_banks b on c.bank_id = b.netsuite_bank_id where c.bank_id in (${bank_id}) and b.status != 0 ` : "";

    // Calculate pagination
    let limit = "";
    if (pageSize != null && pageNumber != null && pageSize > 0) {
        const offset = pageNumber * pageSize;
        limit = `limit ${offset}, ${pageSize} `;
    }

    if (type == "product" || type == "all") {
        // Handle WHERE clause properly
        let whereClause = "";
        if (bank_id) {
            whereClause = joinQuery + (search ? ` and ${search}` : "");
        } else {
            whereClause = search ? ` where ${search}` : "";
        }
        if (Number(active_only) === 1) {
            whereClause += whereClause ? ` and p.status = 1` : ` where p.status = 1`;
        }
        query = ` select DISTINCT p.* from ru_netsuite_products p ${whereClause} ${limit}`;
        let lead_payout = await _db2.query(query, { type: QueryTypes.SELECT });

        /* if (!lead_payout?.length) {
            query = ` select p.* from ru_netsuite_products p where p.status = 1 `;
            lead_payout = await _db2.query(query, { type: QueryTypes.SELECT });
        }; */

        product = lead_payout;
    };
    if (type == "bank" || type == "all") {
        let whereClause = "";
        if (product_id) {
            whereClause = productJoinQuery + (search ? ` and ${search}` : "");
            whereClause += ` and b.status != 0`;
        } else {
            whereClause = search ? ` where ${search} and b.status != 0` : "where b.status != 0";
        }
        query = `select DISTINCT b.* from ru_netsuite_banks b ${whereClause} ${limit}`;
        let lead_payout = await _db2.query(query, { type: QueryTypes.SELECT });
        bank = lead_payout;
    };

    return { bank, product };
};

const getAllFreshLeadId = async (where) => {
    let query = ` select fresh_lead_id from ru_fresh_lead_claims flc ${where} `;
    let bankProductPayout = await _db2.query(query, { type: QueryTypes.SELECT });
    let arr = [];
    for (i = 0; i < bankProductPayout?.length; i++) {
        arr.push(bankProductPayout[i]?.fresh_lead_id)
    };
    return arr;
};


const getPayoutsDigitalThroughAppV2 = async (dsa_id) => {

    let globalPayoutData = await getDsaGlobalPayoutPercentageNew(dsa_id)
    let dsa_global_payouts_percentage = globalPayoutData?.global_payouts_percentage || 50;

    let query = `SELECT BIN_TO_UUID(bpc.bank_product_combinations_id) as bank_product_combinations_id, b.bank_name , p.product_name , rdp.rate as value, ? * (CASE WHEN d.avg_achievment IS NULL OR d.avg_achievment = 0 THEN 1 ELSE d.avg_achievment END) / 100 AS max_assignable_percentage  from ru_bank_product_combinations bpc join ru_netsuite_products p on bpc.product_id = p.netsuite_product_id and p.status = 1 join ru_netsuite_banks b on b.netsuite_bank_id = bpc.bank_id and b.status = 1
      LEFT JOIN LATERAL (
      SELECT rate
      FROM ru_dsa_payouts r
      WHERE UUID_TO_BIN(r.bank_product_combinations_id) = bpc.bank_product_combinations_id
        AND r.dsa_id = ?
      LIMIT 1
    ) rdp ON true
      LEFT JOIN LATERAL (
      SELECT d1.avg_achievment
      FROM ru_bank_product_combination_details d1
      WHERE d1.bank_product_combinations_id = bpc.bank_product_combinations_id
      ORDER BY d1.created_at DESC, d1.id DESC
      LIMIT 1
    ) d ON true where p.product_name LIKE 'Digital%' and bpc.status = 1`
    let bindParams = [dsa_global_payouts_percentage, dsa_id];
    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results;
};

const getLeadPayoutDetails = async (phone, bank_id, product_id) => {
    let query = ' select lp.* from lead_payout lp  left join payouts p on lp.payout_id = p.id where lp.phone = ? and p.bank_id = ? and p.product_id = ? ';
    let bindParams = [phone, bank_id, product_id];
    let product_payout = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return product_payout;
};

const editPayoutsDigitalThroughAppV2 = async (dsa_id, reqObj) => {
    if (!reqObj || reqObj.length === 0) return;

    let query = ` INSERT INTO ru_dsa_payouts (rate, dsa_id, bank_product_combinations_id, payout_lock)  VALUES  `;
    let bindParams = [];

    const valuePlaceholders = reqObj.map(() => {
        return `(? , ? , ? , 1)`;
    }).join(", ");

    query += valuePlaceholders;
    query += ` ON DUPLICATE KEY UPDATE  rate = VALUES(rate), payout_lock = 1 `;

    for (let { value, bank_product_combinations_id } of reqObj) {
        bindParams.push(value, dsa_id, bank_product_combinations_id);
    }

    await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

    query = `update ru_direct_selling_agents set is_direct_claim_enabled = ? where dsa_id = ?`
    await _db2.query(query, { replacements: [1, dsa_id], type: QueryTypes.UPDATE });

    return
};


const getNetsuiteBankList = async (offset, limit, where, countOnly = false) => {

    let records = []

    if (!countOnly) {
        let query = `
        SELECT 
            nb.*, 
            GROUP_CONCAT(bpc.product_id) AS product_ids, 
            COUNT(bpc.product_id) AS product_count 
        FROM ru_netsuite_banks nb 
        LEFT JOIN ru_bank_product_combinations bpc ON bpc.bank_id = nb.netsuite_bank_id  
        ${where || ""} 
        GROUP BY nb.netsuite_bank_id 
        ORDER BY bank_name ASC
    `;

        if (limit) {
            query += ` LIMIT ${offset}, ${limit} `;
        }

        records = await _db2.query(query, { type: QueryTypes.SELECT });
    }

    let queryCount = `SELECT COUNT(*) as count FROM ru_netsuite_banks nb ${where || ""}`;
    let totalCount = await _db2.query(queryCount, { type: QueryTypes.SELECT });

    return { records, totalRecords: totalCount[0]?.count };
};

/** Bulk lookup for export: netsuite_product_id → product_name */
const getNetsuiteProductNamesByIds = async (productIds = []) => {
    const ids = [...new Set((productIds || []).map((id) => String(id).trim()).filter(Boolean))];
    if (!ids.length) return {};

    const rows = await _db2.query(
        `SELECT netsuite_product_id, product_name FROM ru_netsuite_products WHERE netsuite_product_id IN (?)`,
        { replacements: [ids], type: QueryTypes.SELECT }
    );

    return rows.reduce((acc, row) => {
        acc[String(row.netsuite_product_id)] = row.product_name || "";
        return acc;
    }, {});
};

const getNetsuiteProductList = async (offset, limit, where, edit_product_id) => {
    if (edit_product_id) {
        let query = ` select p.* , mp.product_name as parent_product_name , mp.netsuite_product_id as parent_product_id from ru_netsuite_products p left join ru_netsuite_products mp on p.parent_product_id = mp.netsuite_product_id where p.id = ${edit_product_id} `;
        let records = await _db2.query(query, { type: QueryTypes.SELECT });
        return { records: records[0], totalRecords: 1 };
    }
    let query = ` select p.* , mp.product_name as parent_product_name , mp.netsuite_product_id as parent_product_id from ru_netsuite_products p left join ru_netsuite_products mp on p.parent_product_id = mp.netsuite_product_id ${where || ""} `;
    let queryCount = ` select count(*) as count from ru_netsuite_products p ${where || ""} `;

    if (limit) {
        query += ` limit ${offset},${limit} `;
    };
    let records = await _db2.query(query, { type: QueryTypes.SELECT });
    let totalCount = await _db2.query(queryCount, { type: QueryTypes.SELECT });
    return { records, totalRecords: totalCount[0]?.count }
};

const createOrUpdateNetsuiteProduct = async (data, prevData, userId) => {
    const { product_id, netsuite_product_id, product_name, main_product, short_name, remarks, status, category, parent_product_id } = data;
    let query;
    let bindParams;
    if (!product_id) {
        query = ` insert into ru_netsuite_products (netsuite_product_id, product_name, main_product, short_name, remarks, category, status, created_at, parent_product_id) values (?,?,?,?,?,?,?,?,?) `;
        bindParams = [netsuite_product_id, product_name, main_product, short_name, remarks, category, status, new Date(), parent_product_id];
        let result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
        query = `insert into application_logs (application_id, application_type, field, createdAt, updatedAt , updated_by) values (?,?,?,?,?,UUID_TO_BIN(?)) `;
        bindParams = [netsuite_product_id, "new_netsuite_product", "netsuite_product_id", new Date(), new Date(), userId];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
        return result;
    } else {
        query = ` update ru_netsuite_products set netsuite_product_id=?, product_name=?, main_product=?, short_name=?, remarks=?, category=?, status=?, parent_product_id=? where id = ? `;
        bindParams = [netsuite_product_id, product_name, main_product, short_name, remarks, category, status, parent_product_id, product_id];
        let result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
        query = `update ru_bank_product_combinations set product_id = ? where product_id in (?)`;
        bindParams = [netsuite_product_id, prevData?.netsuite_product_id];
        result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
        return result;
    }
};

const getInternalIdBankFile = async (bank_id) => {
    let query = ` select * from ru_dsa_bank_files where id = "${bank_id}" `;
    let data = await _db2.query(query, { type: QueryTypes.SELECT });
    return data[0] || null;
};

const updateFreshLeadStatus = async (set_query, fresh_lead_id) => {
    let query = ` update ru_fresh_lead_claims set ${set_query} where fresh_lead_id = ? `;
    let bindParams = [fresh_lead_id];
    let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return;
};

/**
 * DB-only: fresh lead claim rows for ERP submit flow (joined company registered_by).
 * Business rules live in api/v2/finance/leads/erp/erpValidators.js.
 */
const getFreshLeadClaimsByIdsForErp = async (ids) => {
    const query = `SELECT
            flc.id,
            flc.fresh_lead_id,
            flc.loan_reference_id,
            flc.loan_apac_ref_los_number,
            flc.customer_full_name,
            flc.disbursement_amount,
            flc.disbursement_date,
            flc.bank_name,
            flc.product_name,
            flc.business_categories,
            flc.vendor_payout_type,
            flc.vendor_payout_ratio,
            flc.vendor_payout_rate,
            flc.netsuite_vendor_id,
            flc.same_day_billing,
            flc.to_be_billed,
            flc.dsa_id,
            flc.user_type,
            flc.netsuite_bank_id,
            flc.netsuite_product_id,
            flc.platform,
            flc.form_type,
            flc.dsa_mobile_number,
            flcm.is_tentative_matched,
            flcm.is_bank_file_matched,
            flcm.bank_file_id,
            flcm.tentative_bank_file_id,
            flcm.sibling_lead,
            rc.registered_by,
            dsa_erp.email_address AS dsa_email_address,
            COALESCE(dsa_erp.is_email_address_verified, 0) AS dsa_is_email_address_verified,
            dsa_erp.dsa_id AS dsa_id_for_email_otp,
            dsa_erp.full_name AS partner_full_name
        FROM ru_fresh_lead_claims flc
        LEFT JOIN ru_fresh_lead_claims_meta flcm ON flc.fresh_lead_id = flcm.fresh_lead_id
        LEFT JOIN ru_companies rc ON flc.user_type = 'company' AND rc.company_id = flc.dsa_id
        LEFT JOIN ru_direct_selling_agents dsa_erp ON dsa_erp.dsa_id = (
            CASE WHEN flc.user_type = 'company' THEN rc.registered_by ELSE flc.dsa_id END
        )
        WHERE flc.fresh_lead_id IN (?)`;
    const data = await _db2.query(query, { replacements: [ids], type: QueryTypes.SELECT });
    return data || [];
};

const getAllBankProductCombination = async (where, offset = 0, limit = 10, isMaster) => {
    // One row per bank+product combination. Each combo's NetSuite fields
    // (slab_internal_id/ns_status/avg_achievment) come from its latest *Active* synced period
    // (falling back to the latest period when none is Active), picked via the LATERAL join
    // below — not one row per sync period. Older/inactive periods show in the detail History.
    let query = `select bpc.id, BIN_TO_UUID(bpc.bank_product_combinations_id) as bank_product_combinations_id, nb.id as bank_id , np.id as product_id , bpc.max_payout_capping , bpc.autonomous_payout_capping , d.login_code , bpc.b2b_login_enable, bpc.login_link, bpc.bank_logo, bpc.gro_name, bpc.gro_contact_number, bpc.gro_email_id, nb.netsuite_bank_id ,nb.bank_name , np.netsuite_product_id , np.product_name , np.main_product , np.category , np.short_name , np.remarks ,
    CASE WHEN np.status = 0 OR nb.status = 0 OR bpc.status = 0 THEN 0 ELSE 1 END as status ,
    CASE WHEN LOWER(np.category) IN ('secured','unsecured') THEN 1 ELSE 0 END as is_eligible_for_autonomous,
    np.status as product_status , nb.status as bank_status , bpc.status as bank_product_status ,
    d.ns_customer_slab_id as slab_internal_id , d.ns_status
    ${isMaster ? ', d.avg_achievment as avg_achievment ' : ''}  from ru_bank_product_combinations bpc left join ru_netsuite_banks nb on bpc.bank_id = nb.netsuite_bank_id left join ru_netsuite_products np on bpc.product_id = np.netsuite_product_id left join lateral (
        select d1.ns_customer_slab_id, d1.ns_status, d1.avg_achievment, d1.login_code, d1.updated_at
        from ru_bank_product_combination_details d1
        where d1.bank_product_combinations_id = bpc.bank_product_combinations_id
        order by (coalesce(lower(trim(d1.ns_status)), '') = 'active') desc, d1.created_at desc, d1.id desc
        limit 1
    ) d on true`;
    if (where) {
        query += ` where ${where} `
    }
    // ONLY CHANGE: Added the ORDER BY clause right before the limit string
    query += ` order by bpc.updated_at desc, d.updated_at desc`
    query += ` limit ${offset} , ${limit}`

    let queryCount = `select count(*) as totalCount from ru_bank_product_combinations bpc left join ru_netsuite_banks nb on bpc.bank_id = nb.netsuite_bank_id left join ru_netsuite_products np on bpc.product_id = np.netsuite_product_id left join lateral (
        select d1.ns_customer_slab_id, d1.ns_status, d1.avg_achievment, d1.login_code, d1.updated_at
        from ru_bank_product_combination_details d1
        where d1.bank_product_combinations_id = bpc.bank_product_combinations_id
        order by (coalesce(lower(trim(d1.ns_status)), '') = 'active') desc, d1.created_at desc, d1.id desc
        limit 1
    ) d on true ${where ? ` where ${where}` : ""}`

    let result = await _db2.query(query, { replacements: [], type: QueryTypes.SELECT });
    let totalCount = await _db2.query(queryCount, { type: QueryTypes.SELECT });
    return { records: result, totalRecords: totalCount[0]?.totalCount }
}

const getLeadFormByFreshLeadId = async (fresh_lead_id) => {
    let query = `select * from ru_fresh_lead_claims where fresh_lead_id = ?`
    let bindParams = [fresh_lead_id]
    let result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return result[0] || null
}

const getTentativeMatchedStatus = async (fresh_lead_id) => {
    let query = `SELECT is_tentative_matched FROM ru_fresh_lead_claims_meta WHERE fresh_lead_id = ?`;
    let bindParams = [fresh_lead_id];
    let result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return result[0] || {};
}

const editBusinessCategory = async (fresh_lead_id, new_business_category, prevData, user_id) => {
    //business-category edit api
    let query = `update ru_fresh_lead_claims set business_categories = ? where fresh_lead_id = ?`
    let bindParams = [new_business_category, fresh_lead_id]
    let result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });

    //update logs
    query = ` insert into application_logs (application_type,application_id,field,from_value,to_value,updated_by) values ('lead_claim_update',?,?,?,?,uuid_to_bin(?)) `
    await sequelize.query(query, { replacements: [prevData?.id, 'business_categories', prevData?.business_categories, new_business_category, user_id], type: QueryTypes.INSERT });
    return result;
}

const getLeadFormMailConfirmationStatus = async (fresh_lead_id) => {
    const query = `select confirmation_reminder_count from ru_fresh_lead_claims where fresh_lead_id = ?`
    const bindParams = [fresh_lead_id]
    const [data = {}] = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return data?.confirmation_reminder_count
}

const updateLeadFormMailConfirmationStatus = async (fresh_lead_id, status) => {
    const query = `update ru_fresh_lead_claims set confirmation_reminder_count = ?  where fresh_lead_id = ?`
    const bindParams = [status, fresh_lead_id]
    const data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return data
}

const getLeadFormBankerAndAsmDetails = async (fresh_lead_id) => {
    const query = `select asm.sp_email as asm_email , sp.sp_email as banker_email from ru_fresh_lead_claims_meta flcm left join ru_branch_sales_people sp on flcm.banker_id = sp.id left join ru_branch_sales_people asm on flcm.asm_id = asm.id where fresh_lead_id = ?`
    const bindParams = [fresh_lead_id]
    const [data = {}] = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return data
}
const getBankFileMatchData = async (fresh_lead_id) => {
    const query = `SELECT flc.id, flcm.is_tentative_matched, flcm.tentative_bank_file_id, flcm.is_bank_file_matched, flcm.bank_file_id, flc.is_banker_file_processed FROM ru_fresh_lead_claims flc left join ru_fresh_lead_claims_meta flcm on flc.fresh_lead_id = flcm.fresh_lead_id where flc.fresh_lead_id = ?`;
    const bindParams = [fresh_lead_id]
    const [data = {}] = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return data;
};

const getTentativeBankFileMatchData = getBankFileMatchData;

const updateTentativeBankFileMatch = async (fresh_lead_id, bank_file_id, is_tentative_file_matched, match_type = 'tentative') => {
    const transaction = await _db2.transaction();

    try {
        if (match_type === 'main') {
            if (is_tentative_file_matched) {
                const queryMeta = `UPDATE ru_fresh_lead_claims_meta 
                            SET is_bank_file_matched = 1, bank_file_id = ? 
                            WHERE fresh_lead_id = ?`;
                await _db2.query(queryMeta, {
                    replacements: [bank_file_id, fresh_lead_id],
                    type: QueryTypes.UPDATE,
                    transaction
                });

                const queryBankFile = `UPDATE ru_dsa_bank_files 
                                 SET lead_claimed = 1, fresh_lead_id = ?
                                 WHERE bank_file_id = ?`;
                await _db2.query(queryBankFile, {
                    replacements: [fresh_lead_id, bank_file_id],
                    type: QueryTypes.UPDATE,
                    transaction
                });
            } else {
                const queryMeta = `UPDATE ru_fresh_lead_claims_meta 
                            SET is_bank_file_matched = 0, bank_file_id = NULL 
                            WHERE fresh_lead_id = ?`;
                await _db2.query(queryMeta, {
                    replacements: [fresh_lead_id],
                    type: QueryTypes.UPDATE,
                    transaction
                });

                const queryBankFile = `UPDATE ru_dsa_bank_files 
                                 SET lead_claimed = 0, fresh_lead_id = NULL
                                 WHERE bank_file_id = ?`;
                await _db2.query(queryBankFile, {
                    replacements: [bank_file_id],
                    type: QueryTypes.UPDATE,
                    transaction
                });
            }
        } else if (match_type === 'tentative') {
            if (is_tentative_file_matched) {
                const queryMeta = `UPDATE ru_fresh_lead_claims_meta 
                            SET is_tentative_matched = 1, tentative_bank_file_id = ? 
                            WHERE fresh_lead_id = ?`;
                await _db2.query(queryMeta, {
                    replacements: [bank_file_id, fresh_lead_id],
                    type: QueryTypes.UPDATE,
                    transaction
                });

                const queryBankFile = `UPDATE ru_dsa_tentative_bank_files 
                                 SET claimed = 1 , fresh_lead_id = ?
                                 WHERE bank_file_id = ?`;
                await _db2.query(queryBankFile, {
                    replacements: [fresh_lead_id, bank_file_id],
                    type: QueryTypes.UPDATE,
                    transaction
                });
            } else {
                const queryMeta = `UPDATE ru_fresh_lead_claims_meta 
                            SET is_tentative_matched = 0, tentative_bank_file_id = NULL 
                            WHERE fresh_lead_id = ?`;
                await _db2.query(queryMeta, {
                    replacements: [fresh_lead_id],
                    type: QueryTypes.UPDATE,
                    transaction
                });

                const queryBankFile = `UPDATE ru_dsa_tentative_bank_files 
                                 SET claimed = 0  , 
                                 fresh_lead_id = NULL
                                 WHERE bank_file_id = ?`;
                await _db2.query(queryBankFile, {
                    replacements: [bank_file_id],
                    type: QueryTypes.UPDATE,
                    transaction
                });
            }
        } else {
            throw new Error('Invalid match_type');
        }

        await transaction.commit();
        const message = match_type === 'main'
            ? 'Main bank file match updated successfully'
            : 'Tentative bank file match updated successfully';
        return { success: true, message };
    } catch (error) {
        await transaction.rollback();
        logger.error(error);
        throw error;
    }
};

const createReconciliation = async (data) => {
    let { fresh_lead_id, status, reconciliation_data, mail_html, mail_from, overall_summary, cc_email_date } = data;

    // Use transaction to ensure both operations succeed or fail together
    const transaction = await _db2.transaction();

    try {
        // Insert into ru_fresh_lead_reconciliations (mail_from is already JSON string from controller)
        let insertQuery = `insert into ru_fresh_lead_reconciliations(fresh_lead_id, status, reconciliation_data, mail_html, mail_from, created_at, updated_at) values(?,?,?,?,?,?,?) `;
        const now = new Date();
        let insertBindParams = [fresh_lead_id, status, reconciliation_data, mail_html, mail_from ?? null, now, now];
        await _db2.query(insertQuery, { replacements: insertBindParams, type: QueryTypes.INSERT, transaction });

        // Update ai_status in ru_fresh_lead_claims to keep it synced
        let updateQuery = `UPDATE ru_fresh_lead_claims SET ai_status = ? , updated_at = ? , reconciliation_data = ? WHERE fresh_lead_id = ?`;
        let updateBindParams = [status, new Date(), overall_summary, fresh_lead_id];
        await _db2.query(updateQuery, { replacements: updateBindParams, type: QueryTypes.UPDATE, transaction });

        const metaSetClauses = ["mail_status = 'EMAIL_RECEIVED'", 'updated_at = ?'];
        const metaBindParams = [now];
        if (cc_email_date) {
            metaSetClauses.push('cc_email_date = ?');
            metaBindParams.push(cc_email_date);
        }
        metaBindParams.push(fresh_lead_id);

        const metaUpdateQuery = `
            UPDATE ru_fresh_lead_claims_meta
            SET ${metaSetClauses.join(', ')}
            WHERE fresh_lead_id = ?
        `;
        await _db2.query(metaUpdateQuery, {
            replacements: metaBindParams,
            type: QueryTypes.UPDATE,
            transaction
        });

        // Commit transaction
        await transaction.commit();
    } catch (error) {
        // Rollback transaction on error
        await transaction.rollback();
        throw error;
    }
}

const setLeadOnHold = async (fresh_lead_id, vendor_remark) => {
    const query = `UPDATE ru_fresh_lead_claims SET ai_status = 'on_hold', vendor_remark = ? WHERE fresh_lead_id = ?`;
    const bindParams = [vendor_remark ?? '', fresh_lead_id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
};

const getReconciliationDataByLeadId = async (fresh_lead_id) => {
    const query = `SELECT flr.status, flr.reconciliation_data, flr.updated_at, flc.netsuite_bank_id, flc.netsuite_product_id, flc.claim_confirmation, flcm.audit_remark AS ns_audit_remark, flcm.claim_confirmation_remark AS ns_claim_confirmation_remark FROM ru_fresh_lead_reconciliations flr LEFT JOIN ru_fresh_lead_claims flc ON flr.fresh_lead_id = flc.fresh_lead_id LEFT JOIN ru_fresh_lead_claims_meta flcm ON flcm.fresh_lead_id = flc.fresh_lead_id WHERE flr.fresh_lead_id = ? ORDER BY flr.created_at DESC LIMIT 1`;
    const bindParams = [fresh_lead_id];
    const result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return result[0] || null;
};

const getReconciliationMailTrailByLeadId = async (fresh_lead_id) => {
    const query = `SELECT flr.mail_html, flr.mail_from, flr.updated_at FROM ru_fresh_lead_reconciliations flr WHERE flr.fresh_lead_id = ? ORDER BY flr.created_at DESC LIMIT 1`;
    const bindParams = [fresh_lead_id];
    const result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return result[0] || null;
};

const parseEmailList = (raw) => {
    if (!raw) return [];
    return String(raw)
        .split(/[,;]/)
        .map((e) => e.trim())
        .filter(Boolean);
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmailString = (raw) => {
    const seen = new Set();
    return parseEmailList(raw)
        .map((email) => email.toLowerCase())
        .filter((email) => {
            if (seen.has(email)) return false;
            seen.add(email);
            return true;
        })
        .join(',');
};

const getInvalidEmails = (raw) => {
    return parseEmailList(raw).filter((email) => !EMAIL_REGEX.test(email));
};

const extractEmailsFromAddressField = (raw) => {
    if (!raw) return [];
    return String(raw)
        .split(',')
        .map((part) => {
            const trimmed = part.trim();
            const angleMatch = trimmed.match(/<([^>]+)>/);
            if (angleMatch) return angleMatch[1].trim();
            return trimmed;
        })
        .filter((email) => EMAIL_REGEX.test(email));
};

const getCrmMailboxEmail = () => (process.env.INBOUND_EMAIL || '').trim().toLowerCase();

// Every address that counts as "the CRM banker mailbox" — the live mailbox plus the retired
// Gmail address (kept only as a recognised address). Needed so the CRM's own past sends (from
// either address) are recognised as outbound rather than banker replies, and never CC'd.
const getCrmMailboxes = () => {
    try {
        const { getCrmMailboxAddresses } = require('../helpers/inbound-mailbox');
        const list = getCrmMailboxAddresses();
        if (list && list.length) return list;
    } catch (e) {
        // fall through to the single-mailbox behaviour
    }
    const single = getCrmMailboxEmail();
    return single ? [single] : [];
};

const isDeliveryNotificationMessage = (message) =>
    /delivery status notification/i.test(String(message?.subject || ''));

const isMessageFromCrmMailbox = (message) => {
    const crmMailboxes = getCrmMailboxes();
    if (!crmMailboxes.length) return false;
    const fromEmails = extractEmailsFromAddressField(message?.from);
    return fromEmails.some((email) => crmMailboxes.includes(email.toLowerCase()));
};

const mergeUniqueEmails = (...lists) => {
    const seen = new Set();
    const merged = [];
    lists.flat().forEach((email) => {
        const normalized = String(email || '').trim().toLowerCase();
        if (!normalized || !EMAIL_REGEX.test(normalized) || seen.has(normalized)) return;
        seen.add(normalized);
        merged.push(normalized);
    });
    return merged;
};

const excludeEmails = (emails, removeList) => {
    const removeSet = new Set(removeList.map((e) => String(e).toLowerCase()));
    return emails.filter((email) => !removeSet.has(email.toLowerCase()));
};

const buildReplyDefaultsFromLastMessage = (lastMessage, meta) => {
    const fallbackTo = meta?.banker_email || '';
    const fallbackCc = meta?.cc_email || '';

    if (!lastMessage) {
        return {
            default_to: fallbackTo,
            default_cc: fallbackCc,
            reply_message_id: meta?.mail_thread_id || null,
            reply_references: meta?.mail_thread_id || null
        };
    }

    if (isMessageFromCrmMailbox(lastMessage)) {
        const toEmails = extractEmailsFromAddressField(lastMessage.to);
        const ccEmails = extractEmailsFromAddressField(lastMessage.cc);
        return {
            default_to: toEmails.join(',') || fallbackTo,
            default_cc: ccEmails.join(',') || fallbackCc,
            reply_message_id: lastMessage.message_id || meta?.mail_thread_id || null,
            reply_references: lastMessage.message_id || meta?.mail_thread_id || null
        };
    }

    const toEmails = extractEmailsFromAddressField(lastMessage.from);
    const ccPool = mergeUniqueEmails(
        extractEmailsFromAddressField(lastMessage.to),
        extractEmailsFromAddressField(lastMessage.cc)
    );
    const ccEmails = excludeEmails(ccPool, [...toEmails, ...getCrmMailboxes()].filter(Boolean));

    return {
        default_to: toEmails.join(',') || fallbackTo,
        default_cc: ccEmails.join(',') || fallbackCc,
        reply_message_id: lastMessage.message_id || meta?.mail_thread_id || null,
        reply_references: lastMessage.message_id || meta?.mail_thread_id || null
    };
};

const getLatestLeadMailboxMessage = async (meta, fresh_lead_id) => {
    if (!meta?.mail_thread_id) return null;
    const { fetchThreadByMailThreadId } = require('./gmail-imap-service');
    const messages = await fetchThreadByMailThreadId(meta.mail_thread_id, fresh_lead_id);
    if (!messages?.length) return null;

    const actionable = messages.filter((msg) => !isDeliveryNotificationMessage(msg));
    const pool = actionable.length ? actionable : messages;
    return pool[pool.length - 1] || null;
};

const getReplyThreadTarget = async (meta, fresh_lead_id) => {
    const { wrapMessageId, sanitizeMessageId } = require('./gmail-imap-service');
    const lastMessage = await getLatestLeadMailboxMessage(meta, fresh_lead_id);
    const defaults = buildReplyDefaultsFromLastMessage(lastMessage, meta);

    const inReplyToRaw = defaults.reply_message_id || meta?.mail_thread_id;
    const inReplyTo = inReplyToRaw ? wrapMessageId(sanitizeMessageId(inReplyToRaw) || inReplyToRaw) : null;

    const referenceIds = [];
    if (lastMessage?.references?.length) {
        lastMessage.references.forEach((ref) => {
            const wrapped = wrapMessageId(sanitizeMessageId(ref) || ref);
            if (wrapped) referenceIds.push(wrapped);
        });
    }
    if (inReplyTo && !referenceIds.includes(inReplyTo)) {
        referenceIds.push(inReplyTo);
    }

    return {
        lastMessage,
        inReplyTo,
        references: referenceIds.length ? referenceIds.join(' ') : inReplyTo,
        fallbackTo: defaults.default_to,
        fallbackCc: defaults.default_cc
    };
};

const getLeadMailThreadReplyOptions = async (fresh_lead_id) => {
    const meta = await getLeadMailThreadMeta(fresh_lead_id);
    if (!meta) {
        return { success: false, message: 'Lead not found', options: null };
    }

    const lastMessage = await getLatestLeadMailboxMessage(meta, fresh_lead_id);
    const defaults = buildReplyDefaultsFromLastMessage(lastMessage, meta);

    return {
        success: true,
        mail_thread_id: meta.mail_thread_id || null,
        mail_status: meta.mail_status || null,
        default_to: defaults.default_to,
        default_cc: defaults.default_cc,
        reply_message_id: defaults.reply_message_id,
        reply_references: defaults.reply_references
    };
};

const getLeadMailThreadMeta = async (fresh_lead_id) => {
    const query = `
        SELECT
            flcm.mail_thread_id,
            flcm.mail_status,
            flcm.cc_email,
            flc.customer_first_name,
            flc.customer_last_name,
            flc.fresh_lead_id,
            banker.sp_email AS banker_email,
            banker.sp_name AS banker_name,
            asm.sp_email AS asm_email
        FROM ru_fresh_lead_claims flc
        LEFT JOIN ru_fresh_lead_claims_meta flcm ON flcm.fresh_lead_id = flc.fresh_lead_id
        LEFT JOIN ru_branch_sales_people banker ON banker.id = flcm.banker_id
        LEFT JOIN ru_branch_sales_people asm ON asm.id = flcm.asm_id
        WHERE flc.fresh_lead_id = ?
        LIMIT 1
    `;
    const rows = await _db2.query(query, {
        replacements: [fresh_lead_id],
        type: QueryTypes.SELECT
    });
    return rows[0] || null;
};

const buildMailTrailMessageBlock = ({ subject, from, to, cc, date, body_html, body, body_text }) => {
    const bodyContent = body_html || body || body_text || '';
    if (!bodyContent && !subject && !from) return '';

    const headerLines = [
        subject ? `<div><strong>Subject:</strong> ${escapeHtml(subject)}</div>` : '',
        from ? `<div><strong>From:</strong> ${escapeHtml(from)}</div>` : '',
        to ? `<div><strong>To:</strong> ${escapeHtml(to)}</div>` : '',
        cc ? `<div><strong>CC:</strong> ${escapeHtml(cc)}</div>` : '',
        date ? `<div><strong>Date:</strong> ${escapeHtml(new Date(date).toLocaleString())}</div>` : ''
    ].filter(Boolean).join('');

    return `
        <div class="mail-trail-message" style="margin-bottom:16px;padding:12px;background:#f9f9f9;border-radius:4px;">
            ${headerLines ? `<div class="mail-trail-header" style="font-size:12px;color:#666;margin-bottom:8px;">${headerLines}</div>` : ''}
            <div class="mail-trail-body">${bodyContent}</div>
        </div>
    `;
};

const escapeHtml = (value) =>
    String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const buildCombinedMailTrailHtml = (messages = []) => {
    const actionable = messages.filter((msg) => !isDeliveryNotificationMessage(msg));
    const pool = actionable.length ? actionable : messages;
    return pool
        .map((message) =>
            buildMailTrailMessageBlock({
                subject: message.subject,
                from: message.from,
                to: message.to,
                cc: message.cc,
                date: message.date,
                body_html: message.body_html,
                body: message.body,
                body_text: message.body_text
            })
        )
        .filter(Boolean)
        .join('');
};

const buildMailTrailMetadata = (messages = []) => {
    const actionable = messages.filter((msg) => !isDeliveryNotificationMessage(msg));
    const pool = actionable.length ? actionable : messages;
    const latestMessage = pool[pool.length - 1] || messages[messages.length - 1] || {};

    return JSON.stringify({
        text: latestMessage.from || '',
        html: latestMessage.from || '',
        from: latestMessage.from || '',
        to: latestMessage.to || '',
        cc: latestMessage.cc || '',
        subject: latestMessage.subject || '',
        date: latestMessage.date || null,
        message_id: latestMessage.message_id || null,
        message_count: pool.length,
        trail_type: 'combined_html'
    });
};

const upsertReconciliationMailTrail = async (fresh_lead_id, mailHtml, mailFrom) => {
    if (!fresh_lead_id || !mailHtml) return { saved: false };

    const now = new Date();
    const latestRows = await _db2.query(
        `
            SELECT created_at
            FROM ru_fresh_lead_reconciliations
            WHERE fresh_lead_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        `,
        {
            replacements: [fresh_lead_id],
            type: QueryTypes.SELECT
        }
    );

    if (latestRows?.length) {
        await _db2.query(
            `
                UPDATE ru_fresh_lead_reconciliations
                SET mail_html = ?,
                    mail_from = ?,
                    updated_at = ?
                WHERE fresh_lead_id = ?
                ORDER BY created_at DESC
                LIMIT 1
            `,
            {
                replacements: [mailHtml, mailFrom, now, fresh_lead_id],
                type: QueryTypes.UPDATE
            }
        );
        return { saved: true, updated_at: now };
    }

    await _db2.query(
        `
            INSERT INTO ru_fresh_lead_reconciliations
                (fresh_lead_id, mail_html, mail_from, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `,
        {
            replacements: [fresh_lead_id, mailHtml, mailFrom, now, now],
            type: QueryTypes.INSERT
        }
    );
    return { saved: true, updated_at: now };
};

const saveFullMailboxTrailToReconciliation = async (fresh_lead_id, messages = []) => {
    if (!fresh_lead_id || !messages?.length) return { saved: false };

    const mailHtml = buildCombinedMailTrailHtml(messages);
    if (!mailHtml) return { saved: false };

    const mailFrom = buildMailTrailMetadata(messages);
    return upsertReconciliationMailTrail(fresh_lead_id, mailHtml, mailFrom);
};

const buildCrmReplySignatureHtml = (loggedInUser) => {
    if (!loggedInUser) return '';
    const name = loggedInUser.userName || loggedInUser.name;
    const parts = [name, loggedInUser.userEmail].filter(Boolean);
    if (!parts.length) return '';
    return `<p style="margin-top:16px;color:#666;font-size:12px;">Sent from CRM by ${parts.join(' | ')}</p>`;
};

const appendCrmReplySignatureHtml = (html, loggedInUser) => {
    const signature = buildCrmReplySignatureHtml(loggedInUser);
    if (!signature) return html || '';
    return `${html || ''}${signature}`;
};

const buildCrmReplyFromLabel = (loggedInUser) => {
    const crmMailbox = getCrmMailboxEmail();
    const name = loggedInUser?.userName || loggedInUser?.name || '';
    const email = loggedInUser?.userEmail || crmMailbox || '';
    if (name && email) return `${name} <${email}>`;
    return email || name || crmMailbox || 'CRM';
};

const appendReplyToSavedMailTrail = async (fresh_lead_id, replyDetails = {}) => {
    const {
        subject,
        from,
        to,
        cc,
        html,
        loggedInUser
    } = replyDetails;

    const bodyWithSignature = appendCrmReplySignatureHtml(html, loggedInUser);
    const replyBlock = buildMailTrailMessageBlock({
        subject,
        from: from || buildCrmReplyFromLabel(loggedInUser),
        to,
        cc,
        date: new Date().toISOString(),
        body_html: bodyWithSignature
    });

    if (!replyBlock) return { saved: false };

    const latestRows = await _db2.query(
        `
            SELECT mail_html, mail_from
            FROM ru_fresh_lead_reconciliations
            WHERE fresh_lead_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        `,
        {
            replacements: [fresh_lead_id],
            type: QueryTypes.SELECT
        }
    );

    const existingHtml = latestRows?.[0]?.mail_html || '';
    const combinedHtml = `${existingHtml || ''}${replyBlock}`;

    let mailFrom;
    if (latestRows?.[0]?.mail_from) {
        try {
            const parsed = typeof latestRows[0].mail_from === 'string'
                ? JSON.parse(latestRows[0].mail_from)
                : latestRows[0].mail_from;
            mailFrom = JSON.stringify({
                ...parsed,
                from: from || buildCrmReplyFromLabel(loggedInUser),
                to: to || parsed?.to || '',
                cc: cc || parsed?.cc || '',
                subject: subject || parsed?.subject || '',
                date: new Date().toISOString(),
                message_count: Number(parsed?.message_count || 0) + 1,
                trail_type: 'combined_html',
                last_action: 'crm_reply'
            });
        } catch (error) {
            mailFrom = JSON.stringify({
                from: from || buildCrmReplyFromLabel(loggedInUser),
                to: to || '',
                cc: cc || '',
                subject: subject || '',
                date: new Date().toISOString(),
                message_count: 1,
                trail_type: 'combined_html',
                last_action: 'crm_reply'
            });
        }
    } else {
        mailFrom = JSON.stringify({
            from: from || buildCrmReplyFromLabel(loggedInUser),
            to: to || '',
            cc: cc || '',
            subject: subject || '',
            date: new Date().toISOString(),
            message_count: 1,
            trail_type: 'combined_html',
            last_action: 'crm_reply'
        });
    }

    return upsertReconciliationMailTrail(fresh_lead_id, combinedHtml, mailFrom);
};

const saveLatestMailboxMessageToReconciliation = async (fresh_lead_id, messages = []) =>
    saveFullMailboxTrailToReconciliation(fresh_lead_id, messages);

const getMailTrailFromMailbox = async (fresh_lead_id) => {
    const meta = await getLeadMailThreadMeta(fresh_lead_id);
    if (!meta?.mail_thread_id) {
        return { success: false, message: 'No mail thread id found for this lead', messages: [] };
    }

    const { fetchThreadByMailThreadId, wrapMessageId } = require('./gmail-imap-service');
    const messages = await fetchThreadByMailThreadId(meta.mail_thread_id, fresh_lead_id);

    let savedTrail = null;
    if (messages?.length) {
        savedTrail = await saveFullMailboxTrailToReconciliation(fresh_lead_id, messages);
    }

    return {
        success: true,
        mail_thread_id: wrapMessageId(meta.mail_thread_id),
        mail_status: meta.mail_status,
        messages,
        updated_at: savedTrail?.updated_at || null
    };
};

const saveMailTrailFromMailbox = async (fresh_lead_id) => {
    const meta = await getLeadMailThreadMeta(fresh_lead_id);
    if (!meta?.mail_thread_id) {
        return { success: false, message: 'No mail thread id found for this lead' };
    }

    const { fetchThreadByMailThreadId } = require('./gmail-imap-service');
    const messages = await fetchThreadByMailThreadId(meta.mail_thread_id, fresh_lead_id);
    if (!messages?.length) {
        return { success: false, message: 'No mailbox messages found for this lead' };
    }

    const saveResult = await saveFullMailboxTrailToReconciliation(fresh_lead_id, messages);
    if (!saveResult?.saved) {
        return { success: false, message: 'Unable to save mailbox mail trail' };
    }

    return {
        success: true,
        message: 'Mail trail saved successfully',
        updated_at: saveResult.updated_at
    };
};

const downloadLatestMailTrailEml = async (fresh_lead_id) => {
    const meta = await getLeadMailThreadMeta(fresh_lead_id);
    if (!meta?.mail_thread_id) {
        return { success: false, message: 'No mail thread id found for this lead' };
    }

    const { fetchThreadByMailThreadId } = require('./gmail-imap-service');
    const messages = await fetchThreadByMailThreadId(meta.mail_thread_id, fresh_lead_id, { includeRaw: true });
    if (!messages?.length) {
        return { success: false, message: 'No mailbox messages found for this lead' };
    }

    await saveFullMailboxTrailToReconciliation(fresh_lead_id, messages);

    const actionable = messages.filter((msg) => !isDeliveryNotificationMessage(msg));
    const pool = actionable.length ? actionable : messages;
    const latestMessage = pool[pool.length - 1];
    if (!latestMessage?.raw_eml) {
        return { success: false, message: 'Unable to download latest mailbox message' };
    }

    return {
        success: true,
        filename: `RU-${fresh_lead_id}-latest-mail.eml`,
        content: latestMessage.raw_eml
    };
};

const replyMailThread = async ({ fresh_lead_id, to, cc, subject, html, loggedInUser }) => {
    const { isFinanceRootUser } = require('./finance-services');
    const meta = await getLeadMailThreadMeta(fresh_lead_id);
    if (!meta?.mail_thread_id) {
        return { success: false, message: 'No mail thread id found for this lead' };
    }

    const { sendMailThreadReply } = require('./banker-email-service');
    const threadTarget = await getReplyThreadTarget(meta, fresh_lead_id);

    const isRootUser = await isFinanceRootUser(loggedInUser?.userPhone);
    const requestTo = normalizeEmailString(to);
    const requestCc = normalizeEmailString(cc);
    const hasRequestRecipients = Boolean(requestTo || requestCc);

    const recipient = normalizeEmailString(
        isRootUser && hasRequestRecipients
            ? requestTo || threadTarget.fallbackTo || meta.banker_email
            : threadTarget.fallbackTo || meta.banker_email
    );
    if (!recipient) {
        return { success: false, message: 'Banker email is required to send reply' };
    }

    const invalidRecipients = getInvalidEmails(recipient);
    if (invalidRecipients.length) {
        return { success: false, message: `Invalid To email: ${invalidRecipients[0]}` };
    }

    const ccResolvedFromInput = normalizeEmailString(
        isRootUser && hasRequestRecipients
            ? requestCc || threadTarget.fallbackCc || meta.cc_email
            : threadTarget.fallbackCc || meta.cc_email
    );
    const invalidCc = getInvalidEmails(ccResolvedFromInput);
    if (invalidCc.length) {
        return { success: false, message: `Invalid CC email: ${invalidCc[0]}` };
    }

    const defaultSubject = ` Required Disbursal Confirmation - (${meta.customer_first_name || ''} ${meta.customer_last_name || ''}) | RU-${fresh_lead_id} `;
    const replySubject =
        subject ||
        (threadTarget.lastMessage?.subject
            ? `Re:${String(threadTarget.lastMessage.subject).replace(/^(\s*re\s*:\s*)+/gi, '').trim()}`
            : `Re:${defaultSubject}`);

    appendReplyToSavedMailTrail(fresh_lead_id, {
        subject: replySubject,
        from: buildCrmReplyFromLabel(loggedInUser),
        to: recipient,
        cc: ccResolvedFromInput,
        html,
        loggedInUser
    }).catch((error) => {
        logger.error(`appendReplyToSavedMailTrail failed for lead ${fresh_lead_id}: ${error?.message || error}`);
    });

    sendMailThreadReply({
        to: recipient,
        cc: ccResolvedFromInput,
        subject: replySubject,
        html,
        inReplyTo: threadTarget.inReplyTo,
        references: threadTarget.references,
        leadId: fresh_lead_id,
        loggedInUser
    }).catch((error) => {
        logger.error(`replyMailThread background send failed for lead ${fresh_lead_id}: ${error?.message || error}`);
    });

    return { success: true, message: 'Mail will be sent shortly' };
};

/**
 * Get the four remark fields (and claim row id for logging) for a lead by fresh_lead_id.
 * Used by Remarks tab and by updateLeadFormRemark for application_logs.
 * Returns application_id (claim row id), vendor_remark, user_remark, netsuite_remark_description, reject_reason.
 */
const getLeadFormRemarksByFreshLeadId = async (fresh_lead_id) => {
    const query = `
        SELECT
            flc.id AS application_id,
            flc.vendor_remark,
            flc.user_remark,
            flc.reject_reason,
            flc.claim_confirmation,
            r.remark_description AS netsuite_remark_description,
            flcm.user_remark AS ns_user_remark,
            flcm.rejection_reason AS ns_rejection_reason,
            flcm.audit_remark AS ns_audit_remark,
            flcm.claim_confirmation_remark AS ns_claim_confirmation_remark
        FROM ru_fresh_lead_claims flc
        LEFT JOIN ru_dsa_claims_remark_list r ON r.remark_id = flc.netsuite_remark_id
        LEFT JOIN ru_fresh_lead_claims_meta flcm ON flcm.fresh_lead_id = flc.fresh_lead_id
        WHERE flc.fresh_lead_id = ?
        LIMIT 1
    `;
    const rows = await _db2.query(query, { replacements: [fresh_lead_id], type: QueryTypes.SELECT });
    const row = rows?.[0];
    if (!row) {
        return { application_id: null, vendor_remark: null, user_remark: null, netsuite_remark_description: null, reject_reason: null };
    }
    return {
        application_id: row.application_id ?? null,
        vendor_remark: row.vendor_remark ?? null,
        user_remark: row.user_remark ?? null,
        netsuite_remark_description: row.netsuite_remark_description ?? null,
        claim_confirmation: row.claim_confirmation ?? null,
        reject_reason: row.reject_reason ?? null,
        ns_user_remark: row.ns_user_remark ?? null,
        ns_rejection_reason: row.ns_rejection_reason ?? null,
        ns_audit_remark: row.ns_audit_remark ?? null,
        ns_claim_confirmation_remark: row.ns_claim_confirmation_remark ?? null
    };
};

const ALLOWED_REMARK_TYPES = ['vendor_remark', 'user_remark', 'reject_reason', 'audit_remark', 'claim_confirmation_remark', 'claim_confirmation'];

/**
 * Update a single remark field for a lead by fresh_lead_id.
 * @param {string} fresh_lead_id - UUID
 * @param {string} remark_type - One of 'vendor_remark', 'user_remark', 'reject_reason'
 * @param {string} value - New value (can be empty string)
 * @returns {{ success: boolean, message?: string }}
 */
const updateLeadFormRemark = async (fresh_lead_id, remark_type, value, table_name = 'ru_fresh_lead_claims') => {
    if (!ALLOWED_REMARK_TYPES.includes(remark_type)) {
        return { success: false, message: 'Invalid remark type' };
    }
    const safeValue = value == null ? '' : String(value);
    const query = `UPDATE ${table_name} SET ${remark_type} = ? WHERE fresh_lead_id = ?`;
    await _db2.query(query, {
        replacements: [safeValue, fresh_lead_id],
        type: QueryTypes.UPDATE
    });
    return { success: true };
};

// --- DSA Leads (ru_dsa_leads) ---

const DSA_LEAD_BUCKET_ORDER = ['ALL', 'D45', 'D90', 'D120', 'Old', 'new'];

// Activation dashboard: d45, d90, d120, d120Plus, all (sum of those 4 buckets). Only counts leads in these buckets.
const ACTIVATION_BUCKETS = ['d45', 'd90', 'd120', 'd120Plus'];
const BUCKET_SQL_CONDITIONS = {
    d45: "LOWER(TRIM(COALESCE(dl.bucket,''))) IN ('d45')",
    d90: "LOWER(TRIM(COALESCE(dl.bucket,''))) IN ('d90')",
    d120: "LOWER(TRIM(COALESCE(dl.bucket,''))) IN ('d120')",
    d120Plus: "LOWER(TRIM(COALESCE(dl.bucket,''))) = 'd120+'"
};

const getActivationDashboardMetrics = async (params) => {
    const {
        dsaId,
        materializedPath,
        skipHierarchy = false,
        fromDate,
        toDate
    } = params || {};
    const emptyMetric = () => ({ d45: 0, d90: 0, d120: 0, d120Plus: 0, all: 0 });
    const today = new Date().toISOString().slice(0, 10);
    const hasDateFilter = fromDate || toDate;
    const dateFrom = fromDate || today;
    const dateTo = toDate || today;

    const fromJoin = `ru_dsa_leads dl
        LEFT JOIN ru_direct_selling_agents c ON c.dsa_id = dl.dsa_id`;
    let whereBase = ' 1=1 ';
    const bindParamsBase = [];
    if (!skipHierarchy && (dsaId || materializedPath)) {
        const hierarchyParts = [];
        if (materializedPath) {
            hierarchyParts.push('c.materialized_path LIKE ?');
            bindParamsBase.push(`${String(materializedPath)}%`);
        }
        if (dsaId) {
            hierarchyParts.push('c.materialized_path LIKE ?');
            bindParamsBase.push(`%${String(dsaId)}%`);
        }
        if (hierarchyParts.length > 0) {
            whereBase += ` AND (${hierarchyParts.join(' OR ')})`;
        }
    } else if (!skipHierarchy && !dsaId && !materializedPath) {
        whereBase += ' AND 1=0';
    }

    // Dashboard represents movement in lead status and bucket only; no filter on lead created_at (dl.created_at).
    const leadIdMatch = "CAST(ll.entity_type_id AS CHAR) = CAST(dl.id AS CHAR) AND ll.entity = 'dsa' AND ll.entity_type = 'leads'";
    // Active = leads that *became* converted in the date range (log: changed_to='converted', ll.created_at in range), bucketed by current dl.bucket
    const convertedInRangeExists = `EXISTS (
        SELECT 1 FROM ru_leads_logs ll
        WHERE ${leadIdMatch} AND ll.event_type = 'status'
          AND LOWER(TRIM(COALESCE(ll.changed_to,''))) = 'converted'
          AND DATE(ll.created_at) >= DATE(?) AND DATE(ll.created_at) <= DATE(?)
    )`;
    // Inactive = current status not converted; when date filter set, scope to leads that had *any* log activity (movement) in range
    const statusInactive = "LOWER(TRIM(COALESCE(dl.status,''))) != 'converted' OR dl.status IS NULL OR TRIM(COALESCE(dl.status,'')) = ''";
    const anyLogActivityInRangeExists = `EXISTS (
        SELECT 1 FROM ru_leads_logs ll
        WHERE ${leadIdMatch}
          AND DATE(ll.created_at) >= DATE(?) AND DATE(ll.created_at) <= DATE(?)
    )`;

    const activeSelectClause = ACTIVATION_BUCKETS.map((b) =>
        `SUM(CASE WHEN ${BUCKET_SQL_CONDITIONS[b]} THEN 1 ELSE 0 END) AS active_${b}`
    ).join(', ');
    const inactiveSelectClause = ACTIVATION_BUCKETS.map((b) =>
        `SUM(CASE WHEN ${BUCKET_SQL_CONDITIONS[b]} THEN 1 ELSE 0 END) AS inactive_${b}`
    ).join(', ');

    const convertedExistsEver = `EXISTS (
        SELECT 1 FROM ru_leads_logs ll
        WHERE ${leadIdMatch} AND ll.event_type = 'status'
          AND LOWER(TRIM(COALESCE(ll.changed_to,''))) = 'converted'
    )`;
    const activeWhere = whereBase + (hasDateFilter
        ? ` AND ${convertedInRangeExists}`
        : ` AND ${convertedExistsEver}`);
    const inactiveWhere = whereBase + ` AND (${statusInactive})` + (hasDateFilter
        ? ` AND ${anyLogActivityInRangeExists}`
        : '');

    const activeParams = hasDateFilter ? [...bindParamsBase, dateFrom, dateTo] : bindParamsBase;
    const inactiveParams = hasDateFilter ? [...bindParamsBase, dateFrom, dateTo] : bindParamsBase;

    const [activeRes, inactiveRes] = await Promise.all([
        _db2.query(`SELECT ${activeSelectClause} FROM ${fromJoin} WHERE ${activeWhere}`, { replacements: activeParams, type: QueryTypes.SELECT }).then((r) => r && r[0] ? r[0] : {}),
        _db2.query(`SELECT ${inactiveSelectClause} FROM ${fromJoin} WHERE ${inactiveWhere}`, { replacements: inactiveParams, type: QueryTypes.SELECT }).then((r) => r && r[0] ? r[0] : {})
    ]);

    const toMetric = (r, type) => {
        const d45 = Number(r[`${type}_d45`]) || 0;
        const d90 = Number(r[`${type}_d90`]) || 0;
        const d120 = Number(r[`${type}_d120`]) || 0;
        const d120Plus = Number(r[`${type}_d120Plus`]) || 0;
        return { d45, d90, d120, d120Plus, all: d45 + d90 + d120 + d120Plus };
    };

    return {
        active: toMetric(activeRes, 'active'),
        inactive: toMetric(inactiveRes, 'inactive')
    };
};

const getDsaLeadBuckets = async () => {
    const query = `SELECT DISTINCT bucket FROM ru_dsa_leads`;
    const rows = await _db2.query(query, { type: QueryTypes.SELECT });
    const buckets = [];
    const seen = new Set();
    for (const r of rows || []) {
        const value = r.bucket == null ? 'ALL' : String(r.bucket);
        if (seen.has(value)) continue;
        seen.add(value);
        buckets.push({
            value,
            label: value === 'ALL' ? 'All' : value
        });
    }
    if (!seen.has('ALL')) {
        buckets.unshift({ value: 'ALL', label: 'All' });
    }
    const orderMap = Object.fromEntries(DSA_LEAD_BUCKET_ORDER.map((v, i) => [v, i]));
    return buckets.sort((a, b) => {
        const ia = orderMap[a.value] ?? 999;
        const ib = orderMap[b.value] ?? 999;
        if (ia !== ib) return ia - ib;
        return (a.label || a.value).localeCompare(b.label || b.value);
    });
};

const listDsaLeads = async (params) => {
    const {
        bucket,
        pageNumber = 0,
        pageSize = 20,
        sortBy = 'created_at',
        sortDirection = 'desc',
        status,
        status_id,
        created_from,
        created_to,
        logActivityFromDate,
        logActivityToDate,
        partner_name,
        partner_id,
        utm_source,
        utm_medium,
        utm_campaign,
        search,
        whereFilterQuery = [],
        logicOperator = 'and',
        dsaId,
        materializedPath,
        skipHierarchy = false
    } = params || {};
    const latestCallStatusSort = "(SELECT cl.call_status FROM ru_call_logs cl WHERE cl.entity_type_id = dl.id AND cl.entity = 'dsa' AND cl.entity_type = 'leads' AND cl.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) ORDER BY cl.created_at DESC, cl.id DESC LIMIT 1)";
    const latestCallRemarksSort = "(SELECT cl.remarks FROM ru_call_logs cl WHERE cl.entity_type_id = dl.id AND cl.entity = 'dsa' AND cl.entity_type = 'leads' AND cl.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) ORDER BY cl.created_at DESC, cl.id DESC LIMIT 1)";
    const partnerNameExpr = 'CONCAT(p.first_name, \' \', COALESCE(p.middle_name, \'\'), \' \', p.last_name)';
    const sortColMap = {
        id: 'dl.id',
        lead_id: 'dl.id',
        dsa_id: 'dl.dsa_id',
        bucket: 'dl.bucket',
        status: 'dl.status',
        lead_status: 'dl.status',
        created_at: 'dl.created_at',
        created_date: 'dl.created_at',
        updated_at: 'dl.updated_at',
        partner_name: partnerNameExpr,
        partner: partnerNameExpr,
        dsa_name: 'c.full_name',
        full_name: 'dl.full_name',
        phone: 'dl.phone',
        email: 'dl.email',
        lead_remarks: 'dl.lead_remarks',
        city: 'dl.city',
        state: 'dl.state',
        pincode: 'dl.pincode',
        salesperson_id: 'dl.salesperson_id',
        salesperson_name: 'sp.name',
        salesperson: 'sp.name',
        salesperson_assigned_date: 'dl.salesperson_assigned_date',
        call_status: latestCallStatusSort,
        latest_call_status: latestCallStatusSort,
        call_remarks: latestCallRemarksSort,
        latest_call_remarks: latestCallRemarksSort,
        utm_source: 'dl.utm_source',
        utm_medium: 'dl.utm_medium',
        utm_campaign: 'dl.utm_campaign',
        utm_channel: 'dl.utm_channel',
        utm_content: 'dl.utm_content',
        utm_term: 'dl.utm_term',
        utm_id: 'dl.utm_id',
        utm_adgroup: 'dl.utm_adgroup',
        utm_main_source: 'dl.utm_main_source',
        utm_device: 'dl.utm_device',
        page_source: 'dl.page_source',
        campaign_id: 'dl.campaign_id',
        ad_group_id: 'dl.ad_group_id'
    };
    const sortCol = sortColMap[sortBy] || 'dl.created_at';
    const sortDir = (sortDirection || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const offset = Math.max(0, parseInt(pageNumber, 10)) * Math.max(1, Math.min(100, parseInt(pageSize, 10)));
    const limit = Math.max(1, Math.min(100, parseInt(pageSize, 10)));
    let where = ' 1=1 ';
    const bindParams = [];

    // Hierarchy: filter by lead's DSA (c = dl.dsa_id) under caller's hierarchy (same as vendor list)
    if (!skipHierarchy && (dsaId || materializedPath)) {
        const hierarchyParts = [];
        if (materializedPath) {
            hierarchyParts.push('c.materialized_path LIKE ?');
            bindParams.push(`${String(materializedPath)}%`);
        }
        if (dsaId) {
            hierarchyParts.push('c.materialized_path LIKE ?');
            bindParams.push(`%${String(dsaId)}%`);
        }
        if (hierarchyParts.length > 0) {
            where += ` AND (${hierarchyParts.join(' OR ')})`;
        }
    }

    // bucket ALL => d45,d90,d120,d120+; All_others => old+new (include converted); specific bucket => exact match (case-insensitive)
    if (bucket && bucket !== 'ALL' && bucket !== '') {
        const bucketNorm = String(bucket).toLowerCase().trim();
        if (bucketNorm === 'all_others') {
            where += " AND LOWER(TRIM(COALESCE(dl.bucket,''))) IN ('old','new') ";
        } else if (bucketNorm === 'd120+' || bucketNorm === 'd120plus') {
            where += " AND LOWER(TRIM(COALESCE(dl.bucket,''))) = 'd120+' ";
        } else {
            where += " AND LOWER(TRIM(COALESCE(dl.bucket,''))) = ? ";
            bindParams.push(bucketNorm);
        }
    } else {
        // bucket ALL: same scope as activation dashboard (only d45, d90, d120, d120+)
        where += " AND LOWER(TRIM(COALESCE(dl.bucket,''))) IN ('d45','d90','d120','d120+') ";
    }
    // Status: active/converted => converted only (by bucket: specific or ALL=d45,d90,d120,d120+); inactive => non-converted; old/new/All_others => include converted; default => exclude converted
    const bucketNormForStatus = (bucket && bucket !== 'ALL' && bucket !== '') ? String(bucket).toLowerCase().trim() : '';
    const statusStr = status != null ? String(status).toLowerCase().trim() : '';
    if (statusStr === 'active' || statusStr === 'converted') {
        // Show converted leads only; bucket filter above (ALL = d45,d90,d120,d120+, or specific bucket) already applied
        where += " AND LOWER(TRIM(COALESCE(dl.status,''))) = 'converted' ";
    } else if (statusStr === 'inactive') {
        where += " AND (LOWER(TRIM(COALESCE(dl.status,''))) != 'converted' OR dl.status IS NULL OR TRIM(COALESCE(dl.status,'')) = '') ";
    } else if (status_id != null && status_id !== '') {
        where += ' AND dl.status = ? ';
        bindParams.push(status_id);
    } else if (status && status !== '') {
        where += ' AND dl.status = ? ';
        bindParams.push(status);
    } else if (bucketNormForStatus === 'old' || bucketNormForStatus === 'new' || bucketNormForStatus === 'all_others') {
        // Bucket old/new/All_others: show all leads including converted (no status filter)
    } else {
        // Default: do not show converted leads
        where += " AND (LOWER(TRIM(COALESCE(dl.status,''))) != 'converted' OR dl.status IS NULL OR TRIM(COALESCE(dl.status,'')) = '') ";
    }
    // Log-activity date filter (for activation dashboard card click: movement in range, not lead created_at)
    const hasLogActivityDate = logActivityFromDate || logActivityToDate;
    const logDateFrom = logActivityFromDate || logActivityToDate;
    const logDateTo = logActivityToDate || logActivityFromDate;
    if (hasLogActivityDate && logDateFrom && logDateTo) {
        const leadIdMatchList = "CAST(ll.entity_type_id AS CHAR) = CAST(dl.id AS CHAR) AND ll.entity = 'dsa' AND ll.entity_type = 'leads'";
        if (statusStr === 'active' || statusStr === 'converted') {
            where += ` AND EXISTS (
                SELECT 1 FROM ru_leads_logs ll
                WHERE ${leadIdMatchList} AND ll.event_type = 'status'
                  AND LOWER(TRIM(COALESCE(ll.changed_to,''))) = 'converted'
                  AND DATE(ll.created_at) >= DATE(?) AND DATE(ll.created_at) <= DATE(?)
            ) `;
        } else if (statusStr === 'inactive') {
            where += ` AND EXISTS (
                SELECT 1 FROM ru_leads_logs ll
                WHERE ${leadIdMatchList}
                  AND DATE(ll.created_at) >= DATE(?) AND DATE(ll.created_at) <= DATE(?)
            ) `;
        } else {
            // status not active/inactive: still filter by any log activity in range (e.g. bucket card with no status)
            where += ` AND EXISTS (
                SELECT 1 FROM ru_leads_logs ll
                WHERE ${leadIdMatchList}
                  AND DATE(ll.created_at) >= DATE(?) AND DATE(ll.created_at) <= DATE(?)
            ) `;
        }
        bindParams.push(logDateFrom, logDateTo);
    }
    if (created_from || created_to) {
        // Lead created_at filter (not used when opening from activation dashboard cards; use logActivityFromDate/logActivityToDate there)
        if (created_from && created_to) {
            where += ' AND DATE(dl.created_at) >= DATE(?) AND DATE(dl.created_at) <= DATE(?) ';
            bindParams.push(created_from, created_to);
        } else if (created_from) {
            where += ' AND DATE(dl.created_at) >= DATE(?) ';
            bindParams.push(created_from);
        } else {
            where += ' AND DATE(dl.created_at) <= DATE(?) ';
            bindParams.push(created_to);
        }
    }
    if (partner_id || partner_name) {
        where += ' AND (p.dsa_id = ? OR CONCAT(p.first_name, " ", COALESCE(p.middle_name, ""), " ", p.last_name) LIKE ?) ';
        bindParams.push(partner_id || '', partner_name ? `%${partner_name}%` : '%');
    }
    if (utm_source) {
        where += ' AND dl.utm_source = ? ';
        bindParams.push(utm_source);
    }
    if (utm_medium) {
        where += ' AND dl.utm_medium = ? ';
        bindParams.push(utm_medium);
    }
    if (utm_campaign) {
        where += ' AND dl.utm_campaign = ? ';
        bindParams.push(utm_campaign);
    }
    if (search && String(search).trim() !== '') {
        const searchTerm = `%${String(search).trim()}%`;
        const searchConditions = [
            'dl.full_name', 'dl.phone', 'dl.email', 'dl.lead_remarks', 'dl.city', 'dl.state', 'dl.pincode',
            'dl.partner_phone', 'dl.utm_source', 'dl.utm_medium', 'dl.utm_campaign', 'dl.bucket', 'dl.status',
            'CAST(dl.id AS CHAR)', 'CAST(dl.dsa_id AS CHAR)',
            'c.full_name', 'CONCAT(p.first_name, " ", COALESCE(p.middle_name, ""), " ", p.last_name)', 'sp.name'
        ].map((col) => `(${col} LIKE ?)`);
        where += ` AND (${searchConditions.join(' OR ')})`;
        bindParams.push(...searchConditions.map(() => searchTerm));
    }
    const logicOp = (logicOperator || 'and').toUpperCase();
    const isDateOnlyValue = (v) => v != null && typeof v === 'string' && (/^\d{4}-\d{2}-\d{2}/.test(v) || v.includes('T'));
    if (whereFilterQuery && whereFilterQuery.length > 0) {
        where += ' AND (';
        for (let i = 0; i < whereFilterQuery.length; i++) {
            if (i > 0) where += ` ${logicOp} `;
            const part = whereFilterQuery[i];
            const field = part[0];
            const operator = String(part[1]).trim();
            const value = part[2];
            // created_at "is" / "=" with a date value => filter by whole day (date only, not exact time)
            if ((field === 'dl.created_at') && (operator === '=' || operator === 'is') && isDateOnlyValue(value)) {
                where += '(DATE(dl.created_at) = DATE(?))';
                bindParams.push(value);
                continue;
            }
            if (Array.isArray(value) && value.length > 0 && String(operator).toLowerCase().includes('in')) {
                const placeholders = value.map(() => '?').join(',');
                where += `(${field} IN (${placeholders}))`;
                bindParams.push(...value);
            } else if (value !== null && value !== undefined && value !== '') {
                where += `(${field} ${operator} ?)`;
                bindParams.push(value);
            } else {
                where += `(${field} ${operator})`;
            }
        }
        where += ')';
    }
    const selectList = `dl.*,
        dl.id AS lead_id,
        sp.name AS salesperson_name,
        (SELECT cl.call_status FROM ru_call_logs cl WHERE cl.entity_type_id = dl.id AND cl.entity = 'dsa' AND cl.entity_type = 'leads' AND cl.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) ORDER BY cl.created_at DESC, cl.id DESC LIMIT 1) AS latest_call_status,
        (SELECT cl.remarks FROM ru_call_logs cl WHERE cl.entity_type_id = dl.id AND cl.entity = 'dsa' AND cl.entity_type = 'leads' AND cl.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) ORDER BY cl.created_at DESC, cl.id DESC LIMIT 1) AS latest_call_remarks,
        p.dsa_id AS partner_id, CONCAT(p.first_name, ' ', COALESCE(p.middle_name, ''), ' ', p.last_name) AS partner_name,
        c.full_name AS dsa_name, p.dsa_mobile_number AS partner_phone_dsa`;
    const fromJoin = `ru_dsa_leads dl
        LEFT JOIN ru_direct_selling_agents c ON c.dsa_id = dl.dsa_id
        LEFT JOIN ru_direct_selling_agents p ON c.partner_code = p.dsa_mobile_number
        LEFT JOIN CRMTest.users sp ON sp.id = UUID_TO_BIN(dl.salesperson_id)`;
    let query = `SELECT ${selectList} FROM ${fromJoin} WHERE ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ${offset}, ${limit}`;
    let queryCount = `SELECT COUNT(*) AS totalRecords FROM ${fromJoin} WHERE ${where}`;
    const records = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    const countResult = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    const totalRecords = countResult[0]?.totalRecords ?? 0;
    return { records: records || [], totalRecords };
};

const updateDsaLeadStatus = async (lead_id, status) => {
    const findQuery = `SELECT id, status FROM ru_dsa_leads WHERE id = ? LIMIT 1`;
    const found = await _db2.query(findQuery, { replacements: [lead_id], type: QueryTypes.SELECT });
    if (!found || !found.length) return { updated: false, message: 'Lead not found' };
    const pk = found[0].id;
    const previousStatus = found[0].status ?? null;
    const updateQuery = `UPDATE ru_dsa_leads SET status = ? WHERE id = ?`;
    await _db2.query(updateQuery, { replacements: [status, pk], type: QueryTypes.UPDATE });
    return { updated: true, previousStatus };
};

const formatCrmIdForLead = (crmId) => {
    const noHyphenUuidRegex = /^[a-fA-F0-9]{32}$/;
    let formatted = crmId || null;
    if (formatted && noHyphenUuidRegex.test(formatted)) {
        return formatted.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
    }
    return formatted;
};

const getSalesPersonByLeadIds = async (leadIdArray) => {
    if (!leadIdArray || leadIdArray.length === 0) return {};
    const query = `SELECT id, IFNULL(CAST(salesperson_id AS CHAR), '-') AS salesperson_id FROM ru_dsa_leads WHERE id IN (?)`;
    const rows = await _db2.query(query, {
        replacements: [leadIdArray],
        type: QueryTypes.SELECT
    });
    const map = {};
    (rows || []).forEach((r) => { map[String(r.id)] = r.salesperson_id || '-'; });
    return map;
};

/**
 * From the given DSA ids (dsa_id from lead table only), return those that have no salesperson assigned on ru_direct_selling_agents.
 * Same SP is then assigned to that DSA (see assign DSA SP logic).
 */
const getLeadDsasWithoutSalesperson = async (dsaIdArray) => {
    if (!dsaIdArray || dsaIdArray.length === 0) return [];
    const withoutSP = [];
    for (const dsaId of dsaIdArray) {
        const currentSP = await getDsaSPbyId(dsaId);
        if (currentSP == null || currentSP === '' || currentSP === '-') {
            withoutSP.push(dsaId);
        }
    }
    return withoutSP;
};

/**
 * Assign a salesperson to one or more leads/applications.
 * @param {Array}  leadIdArray  - numeric row IDs
 * @param {string} crmId        - CRM user UUID
 * @param {string} [type='dsa'] - 'dsa' | 'customer'
 *   'dsa'      → updates ru_dsa_leads.salesperson_id (existing flow)
 *   'customer' → updates loan_applications.salesperson_id
 */
const assignLeadSalesPerson = async (leadIdArray, crmId, type = 'dsa') => {
    if (!leadIdArray || leadIdArray.length === 0) return;
    const formattedCrmId = formatCrmIdForLead(crmId);

    try {
        if (type === 'customer') {
            const updateLoanQuery =
                `UPDATE loan_applications SET salesperson_id = ?, salesperson_assigned_date = NOW() WHERE id IN (?)`;
            await _db2.query(updateLoanQuery, { replacements: [crmId, leadIdArray], type: QueryTypes.UPDATE });
        } else {
            const updateDsaQuery =
                `UPDATE ru_dsa_leads SET salesperson_id = ?, salesperson_assigned_date = NOW() WHERE id IN (?)`;
            await _db2.query(updateDsaQuery, { replacements: [formattedCrmId, leadIdArray], type: QueryTypes.UPDATE });

            // If the DSA on the lead has no salesperson yet, cascade assignment to the DSA record too
            const dsaRows = await _db2.query(
                `SELECT DISTINCT dsa_id FROM ru_dsa_leads WHERE id IN (?)`,
                { replacements: [leadIdArray], type: QueryTypes.SELECT }
            );
            const dsaIds = (dsaRows || []).map((r) => r.dsa_id).filter(Boolean);
            const dsasWithoutSP = await getLeadDsasWithoutSalesperson(dsaIds);
            if (dsasWithoutSP.length > 0) {
                await assignDsaSalesPerson(dsasWithoutSP, crmId);
            }
        }
    } catch (e) {
        console.error('Error in assignLeadSalesPerson:', e);
        throw e;
    }
};

const emptyToDash = (v) => (v == null || v === '') ? '-' : v;

const snakeToTitle = (v) => {
    if (v == null || v === '') return '';
    const s = String(v).trim();
    return s.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const DSA_IMAGE_BASE_PATH = 'https://ruloans-bucket.s3.ap-south-1.amazonaws.com/';

const getDsaLeadById = async (lead_id) => {
    const bindParams = [lead_id];
    const query = `SELECT
        dl.id, dl.dsa_id, dl.utm_source, dl.utm_medium, dl.utm_campaign, dl.utm_channel,
        dl.ad_group_id, dl.campaign_id, dl.utm_term, dl.ad, dl.mt, dl.adpos, dl.gad, dl.gclid,
        dl.utm_id, dl.utm_main_source, dl.utm_device, dl.page_source, dl.utm_adgroup, dl.utm_content,
        dl.is_verified, dl.created_at, dl.updated_at, dl.bucket, dl.status,
        dl.partner_phone, dl.lead_remarks, dl.city, dl.state, dl.pincode,
        dl.call_verified, dl.email_verified, dl.full_name, dl.email, dl.phone,
        dl.salesperson_id, dl.salesperson_assigned_date, sp.name AS salesperson_name,
        p.dsa_id AS partner_id, CONCAT(p.first_name, ' ', COALESCE(p.middle_name, ''), ' ', p.last_name) AS partner_name,
        bh.full_name AS business_head_name,
        c.full_name AS dsa_name, c.dsa_mobile_number AS dsa_phone, c.email_address AS dsa_email,
        c.utm_source AS dsa_utm_source, c.utm_medium AS dsa_utm_medium, c.utm_campaign AS dsa_utm_campaign,
        k.permanent_account_number AS pan, c.user_type AS dsa_user_type,
        c.home_address_city AS dsa_city, c.home_address_state AS dsa_state, c.home_address_pincode AS dsa_pincode,
        CASE WHEN k.display_picture_filename IS NULL OR k.display_picture_filename = '' OR k.display_picture_filename = 'dsaDocuments/' THEN NULL ELSE CONCAT('${DSA_IMAGE_BASE_PATH}', k.display_picture_filename) END AS display_picture_filename
        FROM ru_dsa_leads dl
        LEFT JOIN ru_direct_selling_agents c ON c.dsa_id = dl.dsa_id
        LEFT JOIN ru_direct_selling_agents p ON c.partner_code = p.dsa_mobile_number
        LEFT JOIN ru_direct_selling_agents bh ON c.business_head_code = bh.dsa_mobile_number
        LEFT JOIN ru_dsa_kyc_data k ON c.dsa_id = k.dsa_id
        LEFT JOIN CRMTest.users sp ON sp.id = UUID_TO_BIN(dl.salesperson_id)
        WHERE dl.id = ? LIMIT 1`;
    const rows = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    const row = rows && rows[0] ? rows[0] : null;
    if (!row) return null;
    const createdDate = row.created_at ? (row.created_at instanceof Date ? row.created_at.toISOString().slice(0, 10) : String(row.created_at).slice(0, 10)) : '-';
    const updatedDate = row.updated_at ? (row.updated_at instanceof Date ? row.updated_at.toISOString().slice(0, 10) : String(row.updated_at).slice(0, 10)) : null;
    const lead = {
        lead_id: row.id,
        dsa_id: row.dsa_id,
        full_name: emptyToDash(row.full_name),
        phone: emptyToDash(row.phone),
        email: emptyToDash(row.email),
        bucket: row.bucket != null && row.bucket !== '' ? snakeToTitle(row.bucket) : '-',
        status: row.status != null && row.status !== '' ? snakeToTitle(row.status) : '-',
        created_at: createdDate,
        updated_at: updatedDate,
        utm_source: emptyToDash(row.utm_source),
        utm_medium: emptyToDash(row.utm_medium),
        utm_campaign: emptyToDash(row.utm_campaign),
        utm_channel: emptyToDash(row.utm_channel),
        ad_group_id: emptyToDash(row.ad_group_id),
        campaign_id: emptyToDash(row.campaign_id),
        utm_term: emptyToDash(row.utm_term),
        ad: emptyToDash(row.ad),
        mt: emptyToDash(row.mt),
        adpos: emptyToDash(row.adpos),
        gad: emptyToDash(row.gad),
        gclid: emptyToDash(row.gclid),
        utm_id: emptyToDash(row.utm_id),
        utm_main_source: emptyToDash(row.utm_main_source),
        utm_device: emptyToDash(row.utm_device),
        page_source: emptyToDash(row.page_source),
        utm_adgroup: emptyToDash(row.utm_adgroup),
        utm_content: emptyToDash(row.utm_content),
        is_verified: row.is_verified,
        partner_phone: emptyToDash(row.partner_phone),
        lead_remarks: row.lead_remarks,
        city: emptyToDash(row.city),
        state: emptyToDash(row.state),
        pincode: emptyToDash(row.pincode),
        call_verified: row.call_verified,
        email_verified: row.email_verified,
        dsa_name: emptyToDash(row.dsa_name),
        partner_name: emptyToDash(row.partner_name),
        partner_id: row.partner_id ?? '-',
        business_head_name: emptyToDash(row.business_head_name),
        salesperson_id: row.salesperson_id ?? null,
        salesperson_name: emptyToDash(row.salesperson_name),
        salesperson_assigned_date: row.salesperson_assigned_date ? (row.salesperson_assigned_date instanceof Date ? row.salesperson_assigned_date.toISOString().slice(0, 10) : String(row.salesperson_assigned_date).slice(0, 10)) : null
    };
    const dsa = {
        dsa_id: emptyToDash(row.dsa_id),
        phone: emptyToDash(row.dsa_phone),
        email: emptyToDash(row.dsa_email),
        pan: emptyToDash(row.pan),
        city: emptyToDash(row.dsa_city),
        state: emptyToDash(row.dsa_state),
        partner: emptyToDash(row.partner_name),
        user_type: emptyToDash(row.dsa_user_type),
        business_head_name: emptyToDash(row.business_head_name),
        display_picture_filename: row.display_picture_filename || '-',
        utm_source: emptyToDash(row.dsa_utm_source),
        utm_medium: emptyToDash(row.dsa_utm_medium),
        utm_campaign: emptyToDash(row.dsa_utm_campaign),
        utm_mainsource: emptyToDash(row.utm_main_source),
        device_type: emptyToDash(row.utm_device)
    };
    return { lead, dsa };
};

const getLeadEntriesByLeadId = async (lead_id, offset = 0, limit = 10, whereFilterQuery = [], logicOperator = 'and') => {
    const findDsaQuery = `SELECT dsa_id FROM ru_dsa_leads WHERE id = ? LIMIT 1`;
    const dsaRows = await _db2.query(findDsaQuery, { replacements: [lead_id], type: QueryTypes.SELECT });
    const dsa_id = dsaRows?.[0]?.dsa_id;
    if (!dsa_id) {
        return { records: [], totalRecords: 0 };
    }
    // Same join structure as listDsaLeads so getDsaLeadsFieldMapping works (dl, c, p, sp)
    const fromJoin = `ru_dsa_leads dl
        LEFT JOIN ru_direct_selling_agents c ON c.dsa_id = dl.dsa_id
        LEFT JOIN ru_direct_selling_agents p ON p.dsa_mobile_number = dl.partner_phone
        LEFT JOIN CRMTest.users sp ON sp.id = UUID_TO_BIN(dl.salesperson_id)`;
    let where = ' dl.dsa_id = ? ';
    const bindParams = [dsa_id];
    const logicOp = (logicOperator || 'and').toUpperCase();
    if (whereFilterQuery && whereFilterQuery.length > 0) {
        where += ' AND (';
        for (let i = 0; i < whereFilterQuery.length; i++) {
            if (i > 0) where += ` ${logicOp} `;
            const part = whereFilterQuery[i];
            const field = part[0];
            const operator = part[1];
            let value = part[2];
            const isInOp = String(operator).toLowerCase().includes('in');
            const inValues = isInOp && Array.isArray(value) ? (Array.isArray(value[0]) ? value[0] : value) : [];
            if (isInOp && inValues.length > 0) {
                const placeholders = inValues.map(() => '?').join(',');
                where += `(${field} ${operator} (${placeholders}))`;
                bindParams.push(...inValues);
            } else if (!isInOp && value !== null && value !== undefined && value !== '') {
                where += `(${field} ${operator} ?)`;
                bindParams.push(value);
            } else if (!isInOp) {
                where += `(${field} ${operator})`;
            }
        }
        where += ')';
    }
    const selectList = `dl.*,
        CONCAT(p.first_name, ' ', COALESCE(p.middle_name, ''), ' ', p.last_name) AS partner_name,
        sp.name AS salesperson_name`;
    const listQuery = `SELECT ${selectList} FROM ${fromJoin} WHERE ${where} ORDER BY dl.created_at DESC LIMIT ?, ?`;
    const countQuery = `SELECT COUNT(*) AS totalRecords FROM ${fromJoin} WHERE ${where}`;
    const listBind = [...bindParams, offset, limit];
    const [records, countResult] = await Promise.all([
        _db2.query(listQuery, { replacements: listBind, type: QueryTypes.SELECT }),
        _db2.query(countQuery, { replacements: bindParams, type: QueryTypes.SELECT })
    ]);
    const totalRecords = countResult?.[0]?.totalRecords ?? 0;
    const formatted = (records || []).map((r) => {
        const { partner_name, salesperson_name, ...leadRow } = r;
        return {
            ...leadRow,
            lead_id: r.id,
            partner_name: partner_name ?? null,
            salesperson_name: salesperson_name ?? null
        };
    });
    return { records: formatted, totalRecords };
};


const getCallLogsByLeadId = async (lead_id, opts = {}) => {
    const entity = (opts?.entity && opts.entity !== '') ? opts.entity : 'dsa';
    const entityType = (opts?.entity_type && opts.entity_type !== '') ? opts.entity_type : 'leads';

    const callLogsQuery = `
        SELECT id, created_at AS createdAt, call_status, remarks, created_by AS createdBy
        FROM   ru_call_logs
        WHERE  entity        = ?
          AND  entity_type   = ?
          AND  entity_type_id = ?
          AND  created_at   >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        ORDER BY created_at DESC`;
    const callLogs = await _db2.query(callLogsQuery, { replacements: [entity, entityType, lead_id], type: QueryTypes.SELECT });
    if (!callLogs || !callLogs.length) return { callLogs: [] };

    const statusIds = [...new Set(callLogs.map((c) => c.call_status).filter(Boolean))];
    const createdByIds = [...new Set(callLogs.map((c) => c.createdBy).filter(Boolean))];
    let statusMap = {};
    let userMap = {};
    if (statusIds.length) {
        const pvPlaceholders = statusIds.map(() => '?').join(',');
        const pvRows = await sequelize.query(
            `SELECT id, value FROM picklist_values WHERE id IN (${pvPlaceholders})`,
            { replacements: statusIds, type: QueryTypes.SELECT }
        );
        pvRows.forEach((r) => { statusMap[r.id] = r.value; });
    }
    if (createdByIds.length) {
        const uuidPlaceholders = createdByIds.map(() => '?').join(',');
        const userRows = await sequelize.query(
            `SELECT bin_to_uuid(id) AS id, name FROM users WHERE bin_to_uuid(id) IN (${uuidPlaceholders})`,
            { replacements: createdByIds, type: QueryTypes.SELECT }
        );
        userRows.forEach((r) => { userMap[r.id] = r.name; });
    }
    const fmtIST = (v) => {
        if (!v) return '-';
        const d = v instanceof Date ? v : new Date(v);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ').slice(0, 19);
    };
    return {
        callLogs: callLogs.map((c) => ({
            date: fmtIST(c.createdAt),
            call_status: c.call_status,
            call_status_value: statusMap[c.call_status] ?? '-',
            call_remarks: c.remarks ?? '-',
            by: userMap[c.createdBy] ?? '-'
        }))
    };
};


const getLeadLogsByLeadId = async (lead_id, offset = 0, limit = 10, event = null, opts = {}) => {
    const entity = (opts?.entity && opts.entity !== '') ? opts.entity : 'dsa';
    const entityType = (opts?.entity_type && opts.entity_type !== '') ? opts.entity_type : 'leads';
    // Keep leadIdParam as string for varchar columns; pass numeric for int columns.
    const leadIdParam = lead_id == null ? '' : String(lead_id);
    const baseWhere = " entity = ? AND entity_type = ? AND entity_type_id = ? ";
    let eventCondition = '';
    let listReplacements;
    let countReplacements;
    const eventTrimmed = event != null && String(event).trim() !== '' ? String(event).trim() : null;
    if (eventTrimmed) {
        eventCondition = ' AND event_type = ? ';
        listReplacements = [entity, entityType, leadIdParam, eventTrimmed, offset, limit];
        countReplacements = [entity, entityType, leadIdParam, eventTrimmed];
    } else {
        eventCondition = '';
        listReplacements = [entity, entityType, leadIdParam, offset, limit];
        countReplacements = [entity, entityType, leadIdParam];
    }
    const whereClause = baseWhere + eventCondition;
    const listQuery = `SELECT id, entity_id, entity_type_id AS lead_id, event_type, changed_from, changed_to, created_by, created_at, updated_at
        FROM ru_leads_logs WHERE ${whereClause} ORDER BY created_at DESC, id DESC LIMIT ?, ?`;
    const countQuery = `SELECT COUNT(*) AS totalRecords FROM ru_leads_logs WHERE ${whereClause}`;
    const [records, countResult] = await Promise.all([
        _db2.query(listQuery, { replacements: listReplacements, type: QueryTypes.SELECT }),
        _db2.query(countQuery, { replacements: countReplacements, type: QueryTypes.SELECT })
    ]);
    const totalRecords = countResult[0]?.totalRecords ?? 0;
    const createdByIds = [...new Set((records || []).map((r) => r.created_by).filter(Boolean))];
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const createdByUuids = createdByIds.filter((id) => typeof id === 'string' && uuidLike.test(id));
    let createdByMap = {};
    if (createdByUuids.length > 0) {
        const placeholders = createdByUuids.map(() => 'uuid_to_bin(?)').join(',');
        const usersQuery = `SELECT bin_to_uuid(id) AS id, name FROM users WHERE id IN (${placeholders})`;
        const userRows = await sequelize.query(usersQuery, { replacements: createdByUuids, type: QueryTypes.SELECT });
        userRows.forEach((r) => { createdByMap[r.id] = r.name; });
    }
    // created_by can also be dsa_id (e.g. from external/DSA flow); resolve names from ru_direct_selling_agents
    const unresolvedIds = createdByIds.filter((id) => createdByMap[id] == null && createdByMap[String(id)] == null);
    if (unresolvedIds.length > 0) {
        const dsaPlaceholders = unresolvedIds.map(() => '?').join(',');
        const dsaQuery = `SELECT dsa_id, full_name FROM ru_direct_selling_agents WHERE dsa_id IN (${dsaPlaceholders})`;
        const dsaRows = await _db2.query(dsaQuery, { replacements: unresolvedIds, type: QueryTypes.SELECT });
        (dsaRows || []).forEach((d) => {
            createdByMap[d.dsa_id] = d.full_name;
            createdByMap[String(d.dsa_id)] = d.full_name;
        });
    }
    const formatDateTimeIST = (v) => {
        if (!v) return '-';
        const d = v instanceof Date ? v : new Date(v);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ').slice(0, 19);
    };
    const formatted = (records || []).map((r) => ({
        ...r,
        // id: r.id,
        // lead_id: r.lead_id,
        // status_from: r.event_type === 'status' ? snakeToTitle(r.changed_from ?? '') : '',
        // status_to: r.event_type === 'status' ? snakeToTitle(r.changed_to ?? '') : '',
        // remark_from: r.event_type === 'remark' ? (r.changed_from ?? '') : '',
        // remark_to: r.event_type === 'remark' ? (r.changed_to ?? '') : '',
        // bucket_from: r.event_type === 'bucket' ? snakeToTitle(r.changed_from ?? '') : '',
        // bucket_to: r.event_type === 'bucket' ? snakeToTitle(r.changed_to ?? '') : '',
        created_by: createdByMap[r.created_by] ?? createdByMap[String(r.created_by)] ?? r.created_by ?? '-',
        // created_by_name: createdByMap[r.created_by] ?? createdByMap[String(r.created_by)] ?? r.created_by ?? '-',
        // created_at: formatDateTimeIST(r.created_at),
        // event_type: snakeToTitle(r.event_type ?? ''),
        // updated_at: formatDateTimeIST(r.updated_at)
    }));
    return { records: formatted, totalRecords };
};

const updateLeadRemarks = async (lead_id, lead_remarks) => {
    const findQuery = `SELECT id, lead_remarks FROM ru_dsa_leads WHERE id = ? LIMIT 1`;
    const found = await _db2.query(findQuery, { replacements: [lead_id], type: QueryTypes.SELECT });
    if (!found || !found.length) return { updated: false, message: 'Lead not found' };
    const pk = found[0].id;
    const previousRemarks = found[0].lead_remarks ?? null;
    const updateQuery = `UPDATE ru_dsa_leads SET lead_remarks = ? WHERE id = ?`;
    await _db2.query(updateQuery, { replacements: [lead_remarks ?? '', pk], type: QueryTypes.UPDATE });
    return { updated: true, previousRemarks };
};

const captureDsaLeadCallData = async (lead_id, type, call_status, call_remarks, lead_status, lead_remarks, createdBy, opts = {}) => {
    const resolvedEntity = (opts?.entity && opts.entity !== '') ? opts.entity : 'dsa';
    const resolvedEntityType = (opts?.entity_type && opts.entity_type !== '') ? opts.entity_type : 'leads';

    let statusFrom = '';
    let remarkFrom = '';
    let resolvedEntityId = (opts?.entity_id != null && opts.entity_id !== '') ? opts.entity_id : null;

    if (resolvedEntity === 'customer') {
        const appRows = await _db2.query(
            `SELECT id, status, customer_id FROM loan_applications WHERE id = ? LIMIT 1`,
            { replacements: [lead_id], type: QueryTypes.SELECT }
        );
        if (!appRows || !appRows.length) return { success: false, message: 'Application not found' };
        statusFrom = appRows[0].status ?? '';
        remarkFrom = '';
        if (!resolvedEntityId) resolvedEntityId = appRows[0].customer_id ?? null;
    } else {
        const result = await getDsaLeadById(lead_id);
        if (!result || !result.lead) return { success: false, message: 'Lead not found' };
        statusFrom = result.lead.status ?? '';
        remarkFrom = result.lead.lead_remarks ?? '';
        if (!resolvedEntityId) resolvedEntityId = result.lead.dsa_id ?? null;
    }

    const doCallLog = type === 'call' || type === 'both';
    const doLeadUpdate = type === 'lead' || type === 'both';

    if (doCallLog) {
        const latestCallQuery = `SELECT call_status, remarks FROM ru_call_logs WHERE entity_type_id = ? AND entity = ? AND entity_type = ? ORDER BY id DESC LIMIT 1`;
        const latestCall = await _db2.query(latestCallQuery, { replacements: [lead_id, resolvedEntity, resolvedEntityType], type: QueryTypes.SELECT, useMaster: true });
        const isDuplicateCall = latestCall?.[0] && String(latestCall[0].call_status) === String(call_status) && String(latestCall[0].remarks || '') === String(call_remarks || '');

        if (!isDuplicateCall) {
            const insertCallQuery = `INSERT INTO ru_call_logs (entity_type_id, created_by, entity_id, entity, entity_type, call_status, remarks, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
            await _db2.query(insertCallQuery, {
                replacements: [lead_id, createdBy, resolvedEntityId, resolvedEntity, resolvedEntityType, call_status, call_remarks || ''],
                type: QueryTypes.INSERT
            });
        }
        if (type === 'call') return { success: true };
    }

    if (doLeadUpdate) {
        const hasRemarks = lead_remarks != null && String(lead_remarks).trim() !== '';
        const remarkTo = hasRemarks ? String(lead_remarks).trim() : remarkFrom;
        const tableToUpdate = resolvedEntity === 'customer' ? 'loan_applications' : 'ru_dsa_leads';

        const updateSets = [];
        const updateParams = [];

        if (resolvedEntity === 'customer') {
            // For customer entity: update status in loan_applications
            if (lead_status && statusFrom !== lead_status) {
                updateSets.push('status = ?');
                updateParams.push(lead_status);
            }
        } else {
            if (lead_status && statusFrom !== lead_status) {
                updateSets.push('status = ?');
                updateParams.push(lead_status);
            }
            if (hasRemarks && remarkFrom !== remarkTo) {
                updateSets.push('lead_remarks = ?');
                updateParams.push(remarkTo);
            }
        }

        // if (updateSets.length > 0) {
        //     const updateSql = `UPDATE ${tableToUpdate} SET ${updateSets.join(', ')}, updated_at = NOW() WHERE id = ?`;
        //     updateParams.push(lead_id);
        //     await _db2.query(updateSql, { replacements: updateParams, type: QueryTypes.UPDATE });
        // }

        if (lead_status) {
            const latestStatusLog = await _db2.query(
                `SELECT changed_to FROM ru_leads_logs WHERE entity_type_id = ? AND entity = ? AND entity_type = ? AND event_type = 'status' ORDER BY id DESC LIMIT 1`,
                { replacements: [String(lead_id), resolvedEntity, resolvedEntityType], type: QueryTypes.SELECT, useMaster: true }
            );
            if (!latestStatusLog?.[0] || String(latestStatusLog[0].changed_to) !== String(lead_status)) {
                await _db2.query(
                    `INSERT INTO ru_leads_logs (entity_type_id, entity_id, entity, entity_type, event_type, changed_from, changed_to, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'status', ?, ?, ?, NOW(), NOW())`,
                    { replacements: [String(lead_id), resolvedEntityId || null, resolvedEntity, resolvedEntityType, statusFrom, lead_status, createdBy || null], type: QueryTypes.INSERT }
                );
            }
        }

        if (hasRemarks && remarkFrom !== remarkTo) {
            const latestRemarkLog = await _db2.query(
                `SELECT changed_to FROM ru_leads_logs WHERE entity_type_id = ? AND entity = ? AND entity_type = ? AND event_type = 'remark' ORDER BY id DESC LIMIT 1`,
                { replacements: [String(lead_id), resolvedEntity, resolvedEntityType], type: QueryTypes.SELECT, useMaster: true }
            );
            if (!latestRemarkLog?.[0] || String(latestRemarkLog[0].changed_to) !== String(remarkTo)) {
                await _db2.query(
                    `INSERT INTO ru_leads_logs (entity_type_id, entity_id, entity, entity_type, event_type, changed_from, changed_to, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'remark', ?, ?, ?, NOW(), NOW())`,
                    { replacements: [String(lead_id), resolvedEntityId || null, resolvedEntity, resolvedEntityType, remarkFrom, remarkTo, createdBy || null], type: QueryTypes.INSERT }
                );
            }
        }
    }
    return { success: true };
};

module.exports = {
    getUserWithPanEmailMobile,
    getOtherUserWithPanEmailMobile,
    create,
    createAddress,
    createInformation,
    deleteLead,
    findLead,
    getLeadById,
    getLeads,
    update,
    getAddressForLead,
    updateAddress,
    getLeadInformation,
    updateInformation,
    followLead,
    unFollowLead,
    getStaredLeadForUser,
    getLeadPayouts,
    updateLeadConverted,
    findLeadPayout,
    getDsaPayoutHook,
    deleteLeadPayout,
    deleteLeadPayoutPhone,
    updateDsaPayoutPercentage,
    getDsaPayoutPercentage,
    getLeadPayoutPercentage,
    insertDsaPayoutPercentage,
    getDsaPayoutUpdatedHook,
    updateLeadPayout,
    getCallStatus,
    getCallStatusById,
    createPan,
    createLead,
    createAddressV2,
    createCustomInformation,
    createPayoutInformation,
    createCrmUser,
    getLeadByIdV2,
    updateAssignee,
    createExternalPan,
    createExternalLead,
    getUnauthUser,
    getLeadAssignReport,
    getPartnerAssignReport,
    getCallStatusByValue,
    addDispostionToCallLogs,
    getLeadForms,
    getLeadFormDetailsById,
    getAllFreshLeadId,
    findBankNameById,
    findProductNameById,
    getLeadsExport,
    getProductOrBankDropdown,
    getLockedPayout,
    getMaxPayoutValidation,
    getDsaPayoutPercentageData,
    getLeadPayoutDetails,
    getNetsuiteBankList,
    getNetsuiteProductNamesByIds,
    getInternalIdBankFile,
    updateFreshLeadStatus,
    getNetsuiteProductList,
    getFreshLeadClaimsByIdsForErp,
    createOrUpdateNetsuiteProduct,
    createLeadPayout,
    getDsaPayouts,
    getAllBankProductCombination,
    editBusinessCategory,
    getLeadFormByFreshLeadId,
    getTentativeMatchedStatus,
    getPayoutsDigitalThroughAppV2,
    editPayoutsDigitalThroughAppV2,
    getLeadFormMailConfirmationStatus,
    updateLeadFormMailConfirmationStatus,
    getLeadFormBankerAndAsmDetails,
    updateTentativeBankFileMatch,
    getBankFileMatchData,
    getTentativeBankFileMatchData,
    createReconciliation,
    getReconciliationDataByLeadId,
    getReconciliationMailTrailByLeadId,
    getLeadMailThreadMeta,
    getLeadMailThreadReplyOptions,
    getMailTrailFromMailbox,
    saveMailTrailFromMailbox,
    downloadLatestMailTrailEml,
    replyMailThread,
    getActivationDashboardMetrics,
    getDsaLeadBuckets,
    listDsaLeads,
    updateDsaLeadStatus,
    getDsaLeadById,
    getLeadEntriesByLeadId,
    getCallLogsByLeadId,
    getLeadLogsByLeadId,
    captureDsaLeadCallData,
    updateLeadRemarks,
    getSalesPersonByLeadIds,
    assignLeadSalesPerson,
    getLeadFormRemarksByFreshLeadId,
    updateLeadFormRemark,
    setLeadOnHold
};

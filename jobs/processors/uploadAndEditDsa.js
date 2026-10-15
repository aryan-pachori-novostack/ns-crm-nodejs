const { QueryTypes } = require("sequelize");
const { jsonDifference, uploadArrayToS3 } = require("../../api/helpers/commonhelper");
const { logger } = require("../../api/helpers/logger");
const { getPicklistValueByValue } = require("../../api/services/picklist-values-services");
const { sequelize } = require("../db");
let DSAService = require("../../api/services/dsa-services");
let ApplicationLogServices = require(_pathconst.ServicesPath.ApplicationLogServices);
const { v4: uuid } = require('uuid');

const getUserWithPanEmailMobile = async (mobile, email) => {
    let query = ` select * from ru_direct_selling_agents where dsa_mobile_number = ? or email_address = ? `;
    let bindParams = [mobile, email];
    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
};

const createOrEditDsa = async (data, userPhone, loggedInUser, prevCount) => {
    try {

        let { dsa_id, dsa_mobile_number, home_address_house_number, home_address_area, home_address_city, home_address_state, home_address_pincode, salutation, first_name, last_name, profession, gender, date_of_birth, partner_code } = data;

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

        let existingSteps = dsa_id ? await DSAService?.getSignUpSteps(dsa_id) : signup_steps_completed;

        signup_steps_completed = Boolean(existingSteps > signup_steps_completed) ? existingSteps : signup_steps_completed;

        data = { ...data, last_modified_by: userPhone, signup_steps_completed };

        let previous = {};
        let newData = {};
        if (dsa_id) {
            previous = await DSAService.getDsaDataForEdit(dsa_id, true);
            await DSAService.createDsa(data);
        } else {
            dsa_id = uuid();
            await DSAService.createDsa(data, dsa_id);
        }

        if (data.dsa_id && newData?.dsa_status != previous?.dsa_status) {
            await DSAService.updateLastStatus(dsa_id, previous?.dsa_status);
        }

        await DSAService.reassignPartner(dsa_id, partner_code, prevCount);

        newData = await DSAService.getDsaDataForEdit(dsa_id, true);

        if (data?.dsa_id) {
            let difference = jsonDifference(previous, newData);
            const userId = loggedInUser?.id || null;
            await ApplicationLogServices.bulkCreate(difference, dsa_id, "dsa", userId);
        }

    } catch (err) {
        console.log(err)
    }
};

module.exports = async function (job) {
    try {
        const { json, userPhone, userId, file_name } = job?.data;

        //base to json
        let errData = [];
        let faliureCount = 0;

        for (let i = 0; i < json?.length; i++) {
            //destructuring properties
            let {
                email = null,
                mobile_number = null,
                pan_number = null,
                profession = null,
                dsa_id = null,
                status = null,
                sub_status = null,
                user_type = null,

                channel_manager_code = null,
                last_modified_by = null,
                first_name = null,
                middle_name = null,
                last_name = null,
                partner_code = null,
                gender = null,
                date_of_birth = null,
                salutation = null,
                company_name = null,
                gstin = null,
                description = null,
                potential = null,
                alternate_mobile = null,
                has_done_loan_buisness = null,
                year_loan_buisness = null,
                personal_loan_payout = null,
                personal_loan_business_amount = null,
                business_loan_payout = null,
                business_loan_business_amount = null,
                housing_loan_payout = null,
                housing_loan_business_amount = null,
                loan_against_property_payout = null,
                loan_against_property_business_amount = null,
                gold_loan_payout = null,
                gold_loan_business_amount = null,
                car_loan_payout = null,
                car_loan_business_amount = null,
                msme_loan_payout = null,
                msme_loan_business_amount = null,
                education_loan_payout = null,
                education_loan_business_amount = null,
                project_loan_payout = null,
                project_loan_business_amount = null,
                professional_loan_payout = null,
                professional_loan_business_amount = null,
                od_or_credit_card_payout = null,
                od_or_credit_card_business_amount = null,
                working_capital_loan_payout = null,
                working_capital_loan_business_amount = null,
                do_you_have_connector_code = null,
                bank_or_nbfc_name_for_connector = null,
                other_bank_for_connector = null,
                do_you_have_dsa_code = null,
                bank_or_nbfc_name_for_dsa = null,
                do_you_refer_or_do_end_to_end_files = null,
                other_bank_for_dsa = null,
                do_you_have_office = null,
                banker_ref = null,
                have_you_heard_of_ruloans_before = null,
                where_or_how = null,
                what_is_the_purpose_of_joining_ruloans = null,
                bank_leave_duration = null,
                type_of_loans_in_previous_bank = null,
                previous_bank_department = null,
                previous_bank_verticle = null,
                home_address_house_number = null,
                home_address_area = null,
                home_address_city = null,
                home_address_state = null,
                home_address_pincode = null,
                office_address_house_number = null,
                office_address_area = null,
                office_address_city = null,
                office_address_state = null,
                office_address_pincode = null,
                signup_steps_completed = null,
            } = json[i];

            let errorObj = { ...json[i], Success: "" };

            let lead_exists = await getUserWithPanEmailMobile(mobile_number, email, pan_number);

            if (lead_exists && !dsa_id) {
                errorObj['Success'] += ` | DSA with same email, pan or phone already exist `;
            };

            if (lead_exists) {
                dsa_id = lead_exists?.dsa_id;
            } else {
                dsa_id = null;
            };

            // dsa validation
            if (!json[i].mobile_number || !json[i].email) {
                errorObj['Success'] += ` | DSA email or phone not present `;
            };

            if (!json[i]?.first_name) {
                errorObj['Success'] += ` | First name empty `;
            };

            if (!json[i]?.last_name) {
                errorObj['Success'] += ` | Last name empty `;
            };

            if (json[i]?.partner_code) {
                let assign_to_email = await getUserWithPanEmailMobile(json[i]?.partner_code, null, null);
                if (!assign_to_email) {
                    errorObj['Success'] += ` | Assigned to User Not Found `;
                } else {
                    json[i].assigned_to = assign_to_email.id;
                }
            } else {
                errorObj['Success'] += ` | Assigned to User Not Found `;
            };

            let prevCount = await DSAService.getPartnerHierarchyCount(partner_code);
            if (prevCount > 4) {
                errorObj['Success'] += ` | Partner hierarchy limit reached `;
            };

            let dsa_status = await getPicklistValueByValue(status);
            status = dsa_status?.id || null;
            let dsa_sub_status = await getPicklistValueByValue(sub_status);
            sub_status = dsa_sub_status?.id || null;
            errData.push(errorObj);
            if (errorObj["Success"]?.length > 2) {
                faliureCount += 1;
            };

            const reqObj = { email_address: email, dsa_mobile_number: mobile_number, user_type, permanent_account_number: pan_number, profession, dsa_id, dsa_status: status, dsa_sub_status: sub_status, user_type: "Channnel Partner", channel_manager_code, last_modified_by, first_name, middle_name, last_name, partner_code, gender, date_of_birth, salutation, company_name, gstin, description, potential, alternate_mobile, has_done_loan_buisness, year_loan_buisness, personal_loan_payout, personal_loan_business_amount, business_loan_payout, business_loan_business_amount, housing_loan_payout, housing_loan_business_amount, loan_against_property_payout, loan_against_property_business_amount, gold_loan_payout, gold_loan_business_amount, car_loan_payout, car_loan_business_amount, msme_loan_payout, msme_loan_business_amount, education_loan_payout, education_loan_business_amount, project_loan_payout, project_loan_business_amount, professional_loan_payout, professional_loan_business_amount, od_or_credit_card_payout, od_or_credit_card_business_amount, working_capital_loan_payout, working_capital_loan_business_amount, do_you_have_connector_code, bank_or_nbfc_name_for_connector, other_bank_for_connector, do_you_have_dsa_code, bank_or_nbfc_name_for_dsa, do_you_refer_or_do_end_to_end_files, other_bank_for_dsa, do_you_have_office, banker_ref, have_you_heard_of_ruloans_before, where_or_how, what_is_the_purpose_of_joining_ruloans, bank_leave_duration, type_of_loans_in_previous_bank, previous_bank_department, previous_bank_verticle, home_address_house_number, home_address_area, home_address_city, home_address_state, home_address_pincode, office_address_house_number, office_address_area, office_address_city, office_address_state, office_address_pincode, signup_steps_completed };

            if (!errorObj["Success"]?.length || json[i]?.dsa_id) {
                await createOrEditDsa(reqObj, userPhone, userId, prevCount);
            };

        };

        let file = await uploadArrayToS3(errData, file_name);
        let query = ` insert into application_logs (application_type, application_id, field,from_value,to_value,updated_by) values ('dsa_upload',?,?,?,?,uuid_to_bin(?)) `
        await sequelize.query(query, { replacements: [file_name, file, json?.length - faliureCount, faliureCount, userId], type: QueryTypes.INSERT });
    } catch (e) {
        console.log(e)
        logger(e);
    }
};
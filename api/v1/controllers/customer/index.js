const axios = require("axios");
const { logger } = require("../../../helpers/logger");
const { v4: uuid } = require('uuid');
const { jsonDifference, sendEmail, isBackendAccessRole, getHierarchySalesPerson, uploadArrayToS3, CreateWhereQueryFilter, CustomOperatorHandlers, toIsoDateIST } = require("../../../helpers/commonhelper");
const { getLeadFormField } = require("../mongo-db");
const { checkBankProductLock } = require("../../../services/bank-services");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let CustomerServices = require(_pathconst.ServicesPath.CustomerServices);
let CustomerValidationV1 = require(_pathconst.ReqModelsPath.CustomerValidationV1);
let DSAService = require(_pathconst.ServicesPath.DSAService);
let FinanceServices = require(_pathconst.ServicesPath.FinanceServices);
let UserService = require(_pathconst.ServicesPath.UserService);
let ApplicationLogServices = require(_pathconst.ServicesPath.ApplicationLogServices);
let KafkaServices = require(_pathconst.ServicesPath.KafkaServices);
const { sendMisReportExportEmailQueue } = require("../../../../jobs");

function isDateDifferenceGreaterThanEqualToNSeconds(d1, d2, n) {
    // Add n seconds to d1
    const d1PlusNSeconds = new Date(d1.getTime() + n * 1000);

    // Check if d1 + n seconds is greater than or equal to d2
    return d1PlusNSeconds <= d2;
};

// Adding Mapping here to make the API readbility more clear 

const getLoanDetailsApiFieldMapping = (field) => {
    const fieldMap = {
        id: "la.id",
        application_id: "la.application_id",
        customer_id: "la.customer_id",
        customer_name: "c.full_name",
        customer_mobile_number: "c.customer_mobile_number",
        customer_email: "c.email_address",
        dsa_id: "la.dsa_id",
        dsa_name: "dsa.full_name",
        dsa_mobile_number: "dsa.dsa_mobile_number",
        product_id: "la.product_id",
        product_name: "p.product_name",
        loan_type_id: "la.loan_type_id",
        loan_type_name: "lt.name",
        status: "la.status",
        sub_status: "la.sub_status",
        date_of_birth: "la.date_of_birth",
        city: "la.city",
        state: "la.state",
        pincode: "la.pincode",
        income_type: "la.income_type",
        applied_loan_amount: "la.applied_loan_amount",
        approved_loan_amount: "la.approved_loan_amount",
        disbursed_loan_amount: "la.disbursed_loan_amount",
        loan_tenure: "la.loan_tenure",
        cibil_score: "la.cibil_score",
        page_source: "la.page_source",
        source_from: "la.source_from",
        utm_source: "la.utm_source",
        utm_medium: "la.utm_medium",
        utm_campaign: "la.utm_campaign",
        utm_content: "la.utm_content",
        utm_channel: "la.utm_channel",
        utm_term: "la.utm_term",
        utm_id: "la.utm_id",
        utm_device: "la.utm_device",
        utm_adgroup: "la.utm_adgroup",
        utm_main_source: "la.utm_main_source",
        campaignid: "la.campaignid",
        gad: "la.gad",
        gclid: "la.gclid",
        mt: "la.mt",
        ad: "la.ad",
        adpos: "la.adpos",
        adgroupid: "la.adgroupid",
        salesperson_name: "sp.name",
        created_at: "DATE(la.created_at)",
        updated_at: "DATE(la.updated_at)",
        leadStatusLogFilter: "(SELECT rll.changed_to FROM ru_leads_logs rll WHERE rll.entity = 'customer' AND rll.entity_type = 'leads' AND rll.entity_type_id = la.id AND rll.event_type = 'status' ORDER BY rll.id DESC LIMIT 1)",
        latest_lead_log_status: "(SELECT rll.changed_to FROM ru_leads_logs rll WHERE rll.entity = 'customer' AND rll.entity_type = 'leads' AND rll.entity_type_id = la.id AND rll.event_type = 'status' ORDER BY rll.id DESC LIMIT 1)",
        callStatusLogFilter: "(SELECT rcl.call_status FROM ru_call_logs rcl WHERE rcl.entity = 'customer' AND rcl.entity_type = 'leads' AND rcl.entity_type_id = la.id ORDER BY rcl.id DESC LIMIT 1)",
        latest_call_log_status: "(SELECT rcl.call_status FROM ru_call_logs rcl WHERE rcl.entity = 'customer' AND rcl.entity_type = 'leads' AND rcl.entity_type_id = la.id ORDER BY rcl.id DESC LIMIT 1)",
        latest_call_log_remarks: "(SELECT rcl.remarks FROM ru_call_logs rcl WHERE rcl.entity = 'customer' AND rcl.entity_type = 'leads' AND rcl.entity_type_id = la.id ORDER BY rcl.id DESC LIMIT 1)",
        latest_call_log_date: "(SELECT DATE(rcl.created_at) FROM ru_call_logs rcl WHERE rcl.entity = 'customer' AND rcl.entity_type = 'leads' AND rcl.entity_type_id = la.id ORDER BY rcl.id DESC LIMIT 1)",
    };
    return fieldMap[field] || field;
};

exports.getCustomerDetailsLeadForm = async (req, res, next) => {
    try {
        req.body = req.loggedInUser ? req.body : req.query;
        const { error } = CustomerValidationV1.createCustomerWithPan.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let user = await CustomerServices.getCustomerDetailsLeadForm(req.body);
            return ResHelper.apiResponse(res, true, "Success", 200, user, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

exports.createCustomerWithPan = async (req, res, next) => {
    try {
        const { error } = CustomerValidationV1.createCustomerWithPan.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let user = await CustomerServices.getCustomerDetailsLeadForm(req.body);
            if (user) {
                if (!user?.customer_id) {
                    await CustomerServices.createCustomerUuid(req.body);
                };
                return ResHelper.apiResponse(res, true, "Success", 200, {}, "");
            };
            await CustomerServices.createCustomerWithPan(req.body);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

exports.createCustomerBasicDetails = async (req, res, next) => {
    try {
        const { error } = CustomerValidationV1.createCustomerBasicDetails.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { otp, customer_mobile_number, otp_verified, dsa_mobile_number } = req?.body;
            let is_consent = 0;
            // customer_mobile_number = "8864881056"
            if (otp && process.env.ENVIRONMENT !== 'dev') {
                let otpResult = await DSAService.getOtpDb2(customer_mobile_number, 'consentForm');
                let dt1 = new Date();
                let dt2 = new Date(otpResult?.updated_at)
                let expired = isDateDifferenceGreaterThanEqualToNSeconds(dt2, dt1, 300);
                if (expired) {
                    return ResHelper.apiResponse(res, false, "Otp Expired", 200, {}, "");
                } else if (otpResult.otp != otp) {
                    return ResHelper.apiResponse(res, false, "Invalid OTP", 200, {}, "");
                } else {
                    otp_verified = 1;
                    is_consent = 1
                    await DSAService.verifyOtpByIdDb2(otpResult.id)
                }
            } else if (otp && process.env.ENVIRONMENT === 'dev') {
                otp_verified = 1;
                is_consent = 1;
            };

            let dsa = await DSAService?.getDsaFullDetailsPhone(dsa_mobile_number);
            if (dsa.is_blacklisted || dsa.is_deleted) {
                return ResHelper.apiResponse(res, false, " This DSA is Blacklisted / Deleted ", 400, {}, "");
            }
            req.body["dsa_id"] = dsa?.dsa_id

            // created_by / platform: the CRM user on the CRM route, the vendor's dsa_id on the external (DSA) route
            const isCrm = Boolean(req.loggedInUser?.id);
            await CustomerServices.createCustomerBasicDetails({ ...req.body, otp_verified, is_consent, created_by: isCrm ? req.loggedInUser.id : dsa?.dsa_id, platform: isCrm ? "crm" : "web_application" });
            KafkaServices.handleDsaBusinessStarted({
                mode: "offline",
                date: new Date().toISOString(),
                dsa_id: dsa?.dsa_id,
                api_path: "customer/createcustomerbasicdetails",
                form_type: "customer_lead_form"
            });
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, e, "");
    };
};

exports.createCustomerAddressDetails = async (req, res, next) => {
    try {
        let mainError = false;
        if (!req?.body?.id) {
            const { error } = CustomerValidationV1.createCustomerAddressDetails.validate(req.body);
            mainError = error
        };

        if (mainError) {
            ResHelper.apiResponse(res, false, _.startCase(mainError.message), 400, {}, "");
        } else {
            await CustomerServices.createCustomerAddressDetails(req.body);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        };
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

exports.createCustomerCompanyDetails = async (req, res, next) => {
    try {
        let mainError = false;
        if (!req?.body?.id) {
            const { error } = CustomerValidationV1.createCustomerCompanyDetails.validate(req.body);
            mainError = error
        };

        if (mainError) {
            ResHelper.apiResponse(res, false, _.startCase(mainError.message), 400, {}, "");
        } else {
            await CustomerServices.createCustomerCompanyDetails(req.body);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        };
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

exports.createCustomerLoanDetails = async (req, res, next) => {
    try {
        const { error } = CustomerValidationV1.createCustomerLoanDetails.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let message = "Success";
            let status = 200;
            let dataObj = {};
            let { product_id, bank_id, dsa_mobile_number } = req?.body;
            let bankProductLock = await checkBankProductLock(bank_id, product_id);
            if (!bankProductLock) {
                return ResHelper.apiResponse(res, false, ` Wrong product selected `, 400, {}, "");
            }
            let regexPattern = await getLeadFormField(`${bank_id}`, `${product_id}`);

            req.body["regexPattern"] = regexPattern;

            // req.body["status"] = "claim_pending";
            // let dsa = await DSAService?.getDsaFullDetailsPhone(dsa_mobile_number);
            // if (!dsa?.assigning_payout_percentage) {
            //     req.body["status"] = "claim_requested";
            //     message = "Entry created successfully but please ask your BH to update DSA's payout percentage.";
            //     status = 203;
            //     dataObj["dsa_id"] = dsa?.dsa_id;
            // };

            const response = await CustomerServices.createCustomerLoanDetails({ ...req?.body, loggedInUser: req?.loggedInUser });
            if (response?.errorMsg) {
                return ResHelper.apiResponse(res, false, response?.errorMsg, 400, {}, "");
            }
            ResHelper.apiResponse(res, true, message, status, dataObj, "");
        };
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

exports.updateLoanStatus = async (req, res, next) => {
    try {
        const { error } = CustomerValidationV1.updateLoanStatus.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let userId = req?.loggedInUser?.id || null;
            req.body = req?.body?.updated_by ? { ...req?.body, "fresh_lead_status_id": 0 } : req?.body;
            let { updated_by, ...rest } = req?.body;
            let { disbursement_date } = req?.body

            if (!req?.loggedInUser) {
                if (!updated_by) {
                    return ResHelper.apiResponse(res, false, "Updated By is required", 401, {}, "");
                };
                where = [[`u.phone = '${updated_by}' `, null]];
                let data = await UserService.getAllUsers(where, null, 0, 1);
                userId = data?.users[0]?.id || null;
            };

            let prevData = await CustomerServices.getFreshLeadById(req?.body?.id);
            let difference = jsonDifference(prevData, rest);
            //console.log(difference)
            const isCaseFromRejected = difference.some(diff => diff[0] == "status" && diff[1] == "rejected")
            //console.log(isCaseFromRejected)
            if (isCaseFromRejected) {
                let { loan_reference_id, dsa_id, business_head_code, business_categories, loan_apac_ref_los_number, netsuite_bank_id, netsuite_product_id, fresh_lead_id, is_split_case } = prevData
                let isExist = await FinanceServices.checkIfFreshLeadExist({
                    loan_reference_id,
                    apac_ref_los_number: loan_apac_ref_los_number,
                    netsuite_bank_id,
                    netsuite_product_id,
                    fresh_lead_id
                });

                if (isExist && is_split_case?.toLowerCase() !== "yes") {
                    let errorMsg = `Some leads already exist in database with same apac/ref/los number`
                    return ResHelper.apiResponse(res, false, errorMsg, 400, {}, "");
                }
                else if (isExist && disbursement_date) {
                    const disbursement_date_iso = toIsoDateIST(disbursement_date);
                    isExist = await DSAService.processSplitCaseFiles(isExist, disbursement_date_iso)
                    const isBusinessCategoryValid = await FinanceServices.validateBusinessCategory(isExist, {
                        business_categories,
                        dsa_id,
                        business_head_code
                    })
                    if (!isBusinessCategoryValid.isValid) {
                        errorMsg = isBusinessCategoryValid.message;
                        return ResHelper.apiResponse(res, false, errorMsg, 400, {}, "");
                    }
                    DSAService.insertDsaPayout(dsa_id, netsuite_bank_id, netsuite_product_id, disbursement_date_iso)
                }
            }
            if (disbursement_date) {
                const disbursement_date_iso = toIsoDateIST(disbursement_date);
                const isDisursementDateValid = FinanceServices.validateDisbursementDate(disbursement_date_iso)
                if (!isDisursementDateValid.isValid) {
                    return ResHelper.apiResponse(res, false, isDisursementDateValid.message, 400, {}, "");
                }
            }
            await CustomerServices.updateLoanStatus(rest);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
            await ApplicationLogServices.bulkCreate(difference, req?.body?.id, "lead_claim_update", userId);
        };
    }
    catch (e) {
        //console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

exports.updateLeadFormExternal = async (req, res, next) => {
    try {
        const { error } = CustomerValidationV1.updateLeadFormExternal.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { fresh_lead_id, loan_reference_id } = req?.body
            let prevData = await CustomerServices.getFreshLeadById(fresh_lead_id, true);
            await CustomerServices.updateLeadFormExternal(req?.body);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");

            let difference = jsonDifference(prevData, req?.body);
            await ApplicationLogServices.bulkCreate(difference, req?.body?.fresh_lead_id, "lead_claim_update_external", "");
        };
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

exports.sendConsentOtp = async (req, res) => {
    try {
        const { error } = CustomerValidationV1.sendConsentOtp.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { mobile_number } = req?.body;
            // mobile_number = "8864881056";
            let options = {
                'method': 'POST',
                data: { mobile_number, otp_type: "consentForm" },
                'url': process.env.ENVIRONMENT == "dev" ? `https://msdev.ruloans.com/api/send-verify-otp` : `https://ms.ruloans.com/api/send-verify-otp`,
                headers: {
                    'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5IiwianRpIjoiODk3YTEwMWZmNmNkZmEyYzI5MzA0NzdjOGFlMjI3ZDM4YjFjNmVlZmIzZmEyYmI2ODk3YTBiYzVjYzNiYzljMWM2ODNhNTI5Zjk5MjkwZGMiLCJpYXQiOjE3MTE1MTUwOTIuNjcxNDYyLCJuYmYiOjE3MTE1MTUwOTIuNjcxNDY2LCJleHAiOjE3NDMwNTEwOTIuNjQ2MjM1LCJzdWIiOiI2NzUiLCJzY29wZXMiOltdfQ.FGFgOZsK_LYCwP5S7aHIAW3gV1hHcu_rBg_lpfMhBuQ34-79zW1s5D83YwESohlC5HUPWrY8z7R_cBIc0vU7pvdl9sYFevWtEmdX6IKPRoFhk6Wcu8QL4IU1OAgeSDxKZAP1V2lJt9xuBGtVXaIyKqNEVid3SWWqXrcX75b5fqTXYjqxIPF8YxdCFZmxhMWb5UUjFZAPNxMym1tWUQYeADK9vCxuQ2d0V1p9oUGYfmH-Vbf6fXEd-hl9WLysS2xezkSD-S-MVVrZu6SEbJI_-4QdsnAWgKOkWfUF_dQ2nhdlSHRkItswHAMAJIoEmj5Ps7bCaVbSnz-pk1Lo8t9X0oOiLu_Zj5o14Nb3HjCtzMy1NrKggPtzpvQlTF6Rc9rJlLYfhEH-_GdkyNcwsmv_n4LzVgtDfYvJQU713v3xNHCu1_HwZQxRL9B7Ly74yOn18Wr_9uzo2uNyAxnpnu8xVSDwJ1AQBLfyw5zPuQz_3evoNxgbxq2m1WjXXTnoF1S1DxF2mjqtzzxyHoBp_5PNgYRuNsdEwybo0R2x489NZxC5PB9XXkEAhauM9cP5LcDRiYz87ZMQw3vxt6APTuyfYxk7y0ozAc3UObxgEh9RNz9Mn9kQ6G9_5w0mY_cfBxZlbdwdPOOPwJRbGRfMooJ7iungbakVHn8-y6arV6NsWTQ',
                    'api-key': process.env.AUTH_KEY_RULOANS_BANK_CLAIM,
                    'app-version-code': '321',
                    'device-type': '3',
                    'Content-Type': 'application/json',
                    'external-auth': process.env.GET_STATUS_REFRESH_TOKEN
                },
                validateStatus: () => true,
            };
            axios(options)
                .then((response) => {
                    const { status, message } = response?.data || {};
                    console.log(options, response?.data);
                    if (Boolean(status)) {
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
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, e, "");
    }
};

exports.sendOtp = async (req, res) => {

    try {
        const { error } = CustomerValidationV1.sendOtp.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {


            const { mobile_number } = req?.body;

            const OTP = process.env.ENVIRONMENT === 'dev' ? 6666 : Math.floor(1000 + Math.random() * 9000);

            const message = `One-time password for updating your profile and application details is ${OTP}-Ruloans`

            await KafkaServices.connectKafkaProducer();

            const newSMS = new KafkaServices.SMSSendNotificationEngine(uuid(), Number(mobile_number), message, req.loggedInUser.id, 'Customer otp verification', "SMSSendNotification");
            await KafkaServices.sendToKafkaEngine(newSMS);
            await DSAService.saveOtpDb2(OTP.toString(), mobile_number, 'customer_verify');
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, e, "");
    }
}
exports.sendOtpExternal = async (req, res) => {

    try {
        const { error } = CustomerValidationV1.sendOtp.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {

            const { mobile_number } = req?.body;
            const OTP = Math.floor(1000 + Math.random() * 9000);
            const message = `One-time password for updating your profile and application details is ${OTP}-Ruloans`
            await KafkaServices.connectKafkaProducer();

            const newSMS = new KafkaServices.SMSSendNotificationEngine(uuid(), Number(mobile_number), message, "b2b external", "customer verify external api", "SMSSendNotification");

            await KafkaServices.sendToKafkaEngine(newSMS);
            await DSAService.saveOtpDb2(OTP.toString(), mobile_number, 'customer_verify');
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, e, "");
    }
}
exports.sendOtpMobileVerification = async (req, res) => {
    try {
        const { error } = CustomerValidationV1.sendOtp.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {

            const { mobile_number } = req?.body;
            const OTP = process.env.ENVIRONMENT === 'dev' ? 6666 : Math.floor(1000 + Math.random() * 9000);
            const message = `One-time password for updating your profile and application details is ${OTP}-Ruloans`
            await KafkaServices.connectKafkaProducer();
            const newSMS = new KafkaServices.SMSSendNotificationEngine(uuid(), Number(mobile_number), message, req.loggedInUser.id, "Customer otp verification", "SMSSendNotification");
            await KafkaServices.sendToKafkaEngine(newSMS);
            await CustomerServices.saveOtpDb2Customer(OTP.toString(), mobile_number, 'mobile_verify');
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, e, "");
    }
};

exports.verifyCustomerOtp = async (req, res) => {

    try {
        const { error } = CustomerValidationV1.verifyCustomerOtp.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { customer_id, mobile_number, otp, type } = req?.body;
            if (type !== "dsa") {
                const checkIsMobileNumberValid = await DSAService.checkIfMobileNumberIsValid(customer_id);
                if (mobile_number != checkIsMobileNumberValid.customer_mobile_number) {
                    return ResHelper.apiResponse(res, false, "Invalid Mobile Number", 401, {}, "");
                }
            };

            let otpResult = await DSAService.getOtpDb2(mobile_number, 'customer_verify');
            let dt1 = new Date();
            let dt2 = new Date(otpResult?.updated_at);
            let expired = isDateDifferenceGreaterThanEqualToNSeconds(dt2, dt1, 300);

            if (expired) {
                return ResHelper.apiResponse(res, false, "Otp Expired", 401, {}, "");
            }

            else if (otpResult.otp != otp) {
                return ResHelper.apiResponse(res, false, "Invalid OTP", 401, {}, "");
            }

            else {
                if (type == "dsa") {
                    await DSAService?.updateJourneyStep("dsa_consent", customer_id, 1)
                };
                // await DSAService.verifyOtpByIdDb2(otpResult.id)
                ResHelper.apiResponse(res, true, "OTP verified successfully", 200, {}, "");
            };
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, e, "");
    }
};

exports.verifyCustomerMobile = async (req, res) => {
    try {
        const { error } = CustomerValidationV1.verifyCustomerOtp.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { customer_id, mobile_number, otp } = req?.body;
            let otpResult = await CustomerServices.getOtpDb2(mobile_number, 'mobile_verify');
            let dt1 = new Date();
            let dt2 = new Date(otpResult?.updated_at)
            let expired = isDateDifferenceGreaterThanEqualToNSeconds(dt2, dt1, 300);
            if (expired) {
                return ResHelper.apiResponse(res, false, "Otp Expired", 401, {}, "");
            } else if (otpResult.otp != otp) {
                return ResHelper.apiResponse(res, false, "Invalid OTP", 401, {}, "");
            } else {
                const customerContext = await CustomerServices.getCustomerMobileContext(customer_id);
                await CustomerServices.verifyOtpByIdDb2(otpResult.id, customer_id, mobile_number)

                const initiatedBy = req?.dsa?.dsa_id || req?.loggedInUser?.id || customer_id;
                const ip = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim()
                    || req.socket?.remoteAddress
                    || req.ip
                    || null;
                await CustomerServices.recordCustomerMobileNumberChange({
                    customer: customerContext,
                    customer_id,
                    from_value: customerContext?.customer_mobile_number,
                    to_value: mobile_number,
                    updated_by: initiatedBy,
                    ip,
                    user_agent: req.headers['user-agent'] || null,
                    platform: req?.dsa ? 'b2b' : (req?.loggedInUser?.id ? 'crm' : 'b2c')
                });

                ResHelper.apiResponse(res, true, "Mobile verified successfully", 200, {}, "");
            }
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, e, "");
    }

};

exports.manageCustomerMobileOtpExternal = async (req, res) => {
    try {
        const { error } = CustomerValidationV1.manageCustomerMobileOtpExternal.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const { customer_id, type, mobile_number, otp } = req.body;
        // Self-service (no DSA/CRM actor on the request) records the customer as their own actor.
        const initiatedBy = req?.dsa?.dsa_id || req?.loggedInUser?.id || customer_id;
        const ip = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim()
            || req.socket?.remoteAddress
            || req.ip
            || null;
        const user_agent = req.headers['user-agent'] || null;
        const platform = req?.dsa ? 'b2b' : (req?.loggedInUser?.id ? 'crm' : 'b2c');

        const result = await CustomerServices.manageCustomerMobileOtp({
            customer_id,
            type,
            mobile_number,
            otp,
            initiatedBy,
            ip,
            user_agent,
            platform
        });

        if (!result.ok) {
            return ResHelper.apiResponse(res, false, result.message, result.status || 400, {}, "");
        }

        return ResHelper.apiResponse(res, true, result.message, 200, result.data, "");
    } catch (e) {
        logger.error(e);
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

// DSA-portal endpoint: customer mobile-number change history, either the audit "logs"
// (application_logs) or the "trail" (ru_customer_mobile_trail) — shown as separate listings in FE.
exports.getCustomerMobileHistoryExternal = async (req, res) => {
    try {
        const { error } = CustomerValidationV1.getCustomerMobileHistoryExternal.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const { type, customer_id, pageNumber, pageSize } = req.body;
        const limit = pageSize || 20;
        const offset = (pageNumber || 0) * limit;

        const data = type === 'trail'
            ? await CustomerServices.getCustomerMobileTrail(customer_id, offset, limit)
            : await CustomerServices.getCustomerMobileLogs(customer_id, offset, limit);

        return ResHelper.apiResponse(res, true, "Success", 200, data, "");
    } catch (e) {
        logger.error(e);
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

exports.sendQueryReply = async (req, res, next) => {
    try {
        const { error } = CustomerValidationV1.sendQueryReply.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { reply, title, email } = req?.body;

            sendEmail({
                to: email,
                subject: title,
                body: reply
            });

            await CustomerServices.sendQueryReply({ ...req?.body, reply_by: req?.loggedInUser?.id });
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        };
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

exports.getQueryByCustomerId = async (req, res) => {
    try {
        const { error } = CustomerValidationV1.getQueryByCustomerId.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const data = await CustomerServices.getQueryByCustomerId(req?.body?.customer_id);
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        };
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

exports.getCustomerLeadsByCustomerId = async (req, res) => {
    try {
        const { error } = CustomerValidationV1.getCustomerLeadsByCustomerId.validate(req.params);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const data = await CustomerServices.getCustomerLeadsByCustomerId(req.params.customer_id);
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

exports.getCustomerByIdExternal = async (req, res) => {

    try {
        const { error } = CustomerValidationV1.getCustomerByIdExternal.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        }
        const { dsa_id } = req.dsa;
        const { customerId } = req.body;
        const isVerified = await CustomerServices.checkIfDsaIsVerified(dsa_id, customerId);
        if (!isVerified) {
            ResHelper.apiResponse(res, false, "Customer is not associated with the given DSA", 403, {}, "");
            return;
        }
        const getCustomerDetails = await CustomerServices.getCustomerById(customerId);

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

exports.getCustomerByDsaExternal = async (req, res) => {
    try {
        const { error } = CustomerValidationV1.getCustomerByDsaExternal.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        }
        const { dsa_id } = req.dsa;
        const { pageNumber, pageSize } = req.body;
        let customers = await CustomerServices.getCustomerByDsaExternal(dsa_id, pageNumber, pageSize);
        ResHelper.apiResponse(res, true, "Success", 200, customers, "");

    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

exports.toggleNotificationCustomer = async (req, res) => {
    try {
        const { error } = await CustomerValidationV1.toggleNotificationCustomer.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { customer_id, dsa_id, ...rest } = req?.body;
            const setClause = Object.entries(rest)
                .map(([key, value]) => `${key} = ${value}`)
                .join(', ');

            let id = customer_id || dsa_id;
            if (!id) {
                ResHelper.apiResponse(res, false, "Please provide either Customer or DSA ID", 400, {}, "");
            };

            let data = await CustomerServices?.toggleNotificationCustomer(dsa_id, customer_id, setClause);
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

exports.getLoanDetails = async (req, res) => {
    try {
        const { error } = CustomerValidationV1.getLoanDetails.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const {
                app_id_exact,
                application_id,
                pageNumber: pageNumberParam,
                pageSize: pageSizeParam,
                search,
                customer_id,
                dsa_id,
                status,
                sub_status,
                product_id,
                loan_type_id,
                city,
                state,
                pincode,
                income_type,
                date_of_birth,
                is_consent_given,
                applied_loan_amount,
                loan_tenure,
                startDateFilter,
                endDateFilter,
                startUpdatedDateFilter,
                endUpdatedDateFilter,
                applied_loan_amount_min,
                applied_loan_amount_max,
                approved_loan_amount_min,
                approved_loan_amount_max,
                disbursed_loan_amount_min,
                disbursed_loan_amount_max,
                cibil_score_min,
                cibil_score_max,
                loan_tenure_min,
                loan_tenure_max,
                utm_source,
                utm_medium,
                utm_campaign,
                utm_content,
                utm_channel,
                utm_term,
                utm_id,
                campaignid,
                gad,
                gclid,
                mt,
                ad,
                adpos,
                adgroupid,
                utm_adgroup,
                utm_main_source,
                utm_device,
                page_source,
                source_from,
                customerNameFilter,
                customerMobileFilter,
                emailFilter,
                dsaNameFilter,
                salespersonNameFilter,
                dsaMobileFilter,
                productNameFilter,
                loanTypeNameFilter,
                cityFilter,
                stateFilter,
                salespersonNameSearchFilter,
                callStatusLogFilter,
                leadStatusLogFilter,
                startDateCallLogFilter,
                endDateCallLogFilter,
                startDateSalespersonAssignedFilter,
                endDateSalespersonAssignedFilter,
                is_export,
                export_title,
                created_at,
                updated_at,
                filterModel,
                reportFilters
            } = req.body;

            const masterRoles = ["CEO", "HR", "VERIFICATION_AGENCY"];
            let { sales_query, sales_query_where } = getHierarchySalesPerson(req?.loggedInUser, "la");
            let role = req?.loggedInUser?.role;
            let childPhones = null;

            if (!masterRoles.includes(role)) {
                childPhones = role === "CEO" ? null : req?.loggedInUser?.userPhone;
            }

            if (isBackendAccessRole(role)) {
                if (!req.loggedInUser.parentEmail) return ResHelper.apiResponse(res, false, "This User Does Not Have Any Parent", 400, {}, "");
                let phone = await UserService.findUserByPhoneOrEmail(req.loggedInUser.parentEmail, req.loggedInUser.parentEmail);
                childPhones = phone?.userPhone;
                req.loggedInUser.materialized_path = phone?.dsa_id;
                if (!phone) return ResHelper.apiResponse(res, false, "This User Does Not Have Any Parent", 400, {}, "");
            }

            let pageNumber = pageNumberParam || 0;
            let pageSize = pageSizeParam || 100;

            let where = [];

            childPhones = !sales_query ? childPhones : null;
            if (childPhones) {
                let q_sales_query = `la.salesperson_id = "${req.loggedInUser.id}"`;
                let depthQuery = req?.loggedInUser?.materialized_path ? `(dsa.materialized_path like "%${req?.loggedInUser?.materialized_path}%" and dsa.materialized_path_depth >= ${(req?.loggedInUser?.materialized_path_depth || 0)} or ${q_sales_query})` : `${q_sales_query}`;
                where.push([depthQuery, '', null]);
                childPhones = null;
            }

            if (sales_query) {
                where.push([sales_query_where, '', null]);
            }
            
            if (reportFilters) {
                where.push(...CustomerServices.getWhereArrayFromReportFilters(reportFilters));
            }

            const addCondition = (column, value) => {
                if (value === "-") {
                    where.push([`${column}`, ' IS NULL', null]);
                } else {
                    where.push([`${column}`, ' LIKE ', `%${value}%`]);
                }
            };
            const addConditionWithEmptyString = (column, value) => {
                if (value === "-") {
                    where.push([`${column}`, ' = ', " "]);
                } else {
                    where.push([`${column}`, ' LIKE ', `%${value}%`]);
                }
            };

            if (customerNameFilter) addConditionWithEmptyString('c.full_name', customerNameFilter);
            if (customerMobileFilter) addConditionWithEmptyString('c.customer_mobile_number', customerMobileFilter);
            if (emailFilter) addCondition('c.email_address', emailFilter);
            if (dsaNameFilter) addCondition('dsa.full_name', dsaNameFilter);
            if (salespersonNameFilter) addCondition('sp_user.name', salespersonNameFilter);
            if (dsaMobileFilter) addConditionWithEmptyString('dsa.dsa_mobile_number', dsaMobileFilter);
            if (productNameFilter) addCondition('p.product_name', productNameFilter);
            if (loanTypeNameFilter) addCondition('lt.name', loanTypeNameFilter);
            if (cityFilter) addCondition('la.city', cityFilter);
            if (stateFilter) addCondition('la.state', stateFilter);
            if (salespersonNameSearchFilter) addCondition('sp.name', salespersonNameSearchFilter);

            if (callStatusLogFilter) {
                const subquery = `(
                    SELECT pv.value
                    FROM ru_call_logs rcl
                    LEFT JOIN picklist_values pv ON rcl.call_status = pv.id
                    WHERE rcl.entity = 'customer' AND rcl.entity_type = 'leads' AND rcl.entity_type_id = la.id
                    ORDER BY rcl.id DESC LIMIT 1
                )`;
                addCondition(subquery, callStatusLogFilter);
            }
            if (leadStatusLogFilter) {
                const subquery = `(
                    SELECT pv.value
                    FROM ru_leads_logs rll
                    LEFT JOIN picklist_values pv ON rll.changed_to = pv.id
                    WHERE rll.entity = 'customer' AND rll.entity_type = 'leads' AND rll.entity_type_id = la.id AND rll.event_type = 'status'
                    ORDER BY rll.id DESC LIMIT 1
                )`;
                addCondition(subquery, leadStatusLogFilter);
            }
            if (startDateCallLogFilter && endDateCallLogFilter) {
                const subquery = `(
                    SELECT DATE(rcl.created_at)
                    FROM ru_call_logs rcl
                    WHERE rcl.entity = 'customer' AND rcl.entity_type = 'leads' AND rcl.entity_type_id = la.id
                    ORDER BY rcl.id DESC LIMIT 1
                )`;
                where.push([subquery, '>=', startDateCallLogFilter]);
                where.push([subquery, '<=', endDateCallLogFilter]);
            } else if (startDateCallLogFilter) {
                const subquery = `(SELECT DATE(rcl.created_at) FROM ru_call_logs rcl WHERE rcl.entity = 'customer' AND rcl.entity_type = 'leads' AND rcl.entity_type_id = la.id ORDER BY rcl.id DESC LIMIT 1)`;
                where.push([subquery, '>=', startDateCallLogFilter]);
            } else if (endDateCallLogFilter) {
                const subquery = `(SELECT DATE(rcl.created_at) FROM ru_call_logs rcl WHERE rcl.entity = 'customer' AND rcl.entity_type = 'leads' AND rcl.entity_type_id = la.id ORDER BY rcl.id DESC LIMIT 1)`;
                where.push([subquery, '<=', endDateCallLogFilter]);
            }

            if (startDateSalespersonAssignedFilter && endDateSalespersonAssignedFilter) {
                where.push(['DATE(la.salesperson_assigned_date)', '>=', startDateSalespersonAssignedFilter]);
                where.push(['DATE(la.salesperson_assigned_date)', '<=', endDateSalespersonAssignedFilter]);
            } else if (startDateSalespersonAssignedFilter) {
                where.push(['DATE(la.salesperson_assigned_date)', '>=', startDateSalespersonAssignedFilter]);
            } else if (endDateSalespersonAssignedFilter) {
                where.push(['DATE(la.salesperson_assigned_date)', '<=', endDateSalespersonAssignedFilter]);
            }

            if (application_id) addCondition('la.application_id', application_id);
            if (app_id_exact) where.push(['la.id', '=', app_id_exact]);
            if (customer_id) addCondition('la.customer_id', customer_id);
            if (dsa_id) addCondition('la.dsa_id', dsa_id);
            if (status) addCondition('la.status', status);
            if (sub_status) addCondition('la.sub_status', sub_status);
            if (product_id) where.push(['la.product_id', '=', product_id]);
            if (loan_type_id) where.push(['la.loan_type_id', '=', loan_type_id]);
            if (city) addCondition('la.city', city);
            if (state) addCondition('la.state', state);
            if (pincode) addCondition('la.pincode', pincode);
            if (income_type) addCondition('la.income_type', income_type);
            if (date_of_birth) where.push([' DATE(la.date_of_birth) ', ` = DATE("${date_of_birth}") `, null]);
            if (is_consent_given !== undefined && is_consent_given !== null) where.push(['la.is_consent_given', '=', is_consent_given]);
            if (applied_loan_amount) addCondition('la.applied_loan_amount', applied_loan_amount);
            if (loan_tenure) addCondition('la.loan_tenure', loan_tenure);
            if (utm_source) addCondition('la.utm_source', utm_source);
            if (utm_medium) addCondition('la.utm_medium', utm_medium);
            if (utm_campaign) addCondition('la.utm_campaign', utm_campaign);
            if (utm_content) addCondition('la.utm_content', utm_content);
            if (utm_channel) addCondition('la.utm_channel', utm_channel);
            if (utm_term) addCondition('la.utm_term', utm_term);
            if (utm_id) addCondition('la.utm_id', utm_id);
            if (campaignid) addCondition('la.campaignid', campaignid);
            if (gad) addCondition('la.gad', gad);
            if (gclid) addCondition('la.gclid', gclid);
            if (mt) addCondition('la.mt', mt);
            if (ad) addCondition('la.ad', ad);
            if (adpos) addCondition('la.adpos', adpos);
            if (adgroupid) addCondition('la.adgroupid', adgroupid);
            if (utm_adgroup) addCondition('la.utm_adgroup', utm_adgroup);
            if (utm_main_source) addCondition('la.utm_main_source', utm_main_source);
            if (utm_device) addCondition('la.utm_device', utm_device);
            if (page_source) addCondition('la.page_source', page_source);
            if (source_from !== undefined && source_from !== null) where.push(['la.source_from', '=', source_from]);
            if (created_at) addCondition('la.created_at', created_at);
            if (updated_at) addCondition('la.updated_at', updated_at);

            if (filterModel?.items?.length) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterQuery = CreateWhereQueryFilter(filterModel, getLoanDetailsApiFieldMapping, operatorHandlers, "loan_details");
                if (whereFilterQuery?.length) {
                    const normalizedWhereFilterQuery = whereFilterQuery.map((item) => {
                        const [field, operator, value] = item;
                        const op = typeof operator === 'string' ? operator.trim().toLowerCase() : '';
                        if ((op === 'is null' || op === 'is not null') && value === '') {
                            return [field, operator, null];
                        }
                        return item;
                    });
                    where.push(...normalizedWhereFilterQuery);
                }
            }

            if (startDateFilter && endDateFilter) {
                where.push([' DATE(la.created_at) ', ` between DATE("${startDateFilter}") and DATE("${endDateFilter}")  `, null]);
            }
            if (startUpdatedDateFilter && endUpdatedDateFilter) {
                where.push([' DATE(la.updated_at) ', ` between DATE("${startUpdatedDateFilter}") and DATE("${endUpdatedDateFilter}")  `, null]);
            }

            if (applied_loan_amount_min !== undefined && applied_loan_amount_min !== null) {
                where.push(['la.applied_loan_amount', '>=', applied_loan_amount_min]);
            }
            if (applied_loan_amount_max !== undefined && applied_loan_amount_max !== null) {
                where.push(['la.applied_loan_amount', '<=', applied_loan_amount_max]);
            }
            if (approved_loan_amount_min !== undefined && approved_loan_amount_min !== null) {
                where.push(['la.approved_loan_amount', '>=', approved_loan_amount_min]);
            }
            if (approved_loan_amount_max !== undefined && approved_loan_amount_max !== null) {
                where.push(['la.approved_loan_amount', '<=', approved_loan_amount_max]);
            }
            if (disbursed_loan_amount_min !== undefined && disbursed_loan_amount_min !== null) {
                where.push(['la.disbursed_loan_amount', '>=', disbursed_loan_amount_min]);
            }
            if (disbursed_loan_amount_max !== undefined && disbursed_loan_amount_max !== null) {
                where.push(['la.disbursed_loan_amount', '<=', disbursed_loan_amount_max]);
            }
            if (cibil_score_min !== undefined && cibil_score_min !== null) {
                where.push(['la.cibil_score', '>=', cibil_score_min]);
            }
            if (cibil_score_max !== undefined && cibil_score_max !== null) {
                where.push(['la.cibil_score', '<=', cibil_score_max]);
            }
            if (loan_tenure_min !== undefined && loan_tenure_min !== null) {
                where.push(['la.loan_tenure', '>=', loan_tenure_min]);
            }
            if (loan_tenure_max !== undefined && loan_tenure_max !== null) {
                where.push(['la.loan_tenure', '<=', loan_tenure_max]);
            }

            let searchList = [];
            if (search) {
                // Search across all returned columns
                // Loan application fields
                searchList.push(['la.id', 'LIKE', `%${search}%`]);
                searchList.push(['la.application_id', 'LIKE', `%${search}%`]);
                searchList.push(['la.customer_id', 'LIKE', `%${search}%`]);
                searchList.push(['la.dsa_id', 'LIKE', `%${search}%`]);
                searchList.push(['la.product_id', 'LIKE', `%${search}%`]);
                searchList.push(['la.loan_type_id', 'LIKE', `%${search}%`]);
                searchList.push(['la.status', 'LIKE', `%${search}%`]);
                searchList.push(['la.sub_status', 'LIKE', `%${search}%`]);
                searchList.push(['la.date_of_birth', 'LIKE', `%${search}%`]);
                searchList.push(['la.pincode', 'LIKE', `%${search}%`]);
                searchList.push(['la.city', 'LIKE', `%${search}%`]);
                searchList.push(['la.state', 'LIKE', `%${search}%`]);
                searchList.push(['la.income_type', 'LIKE', `%${search}%`]);
                searchList.push(['la.is_consent_given', 'LIKE', `%${search}%`]);
                searchList.push(['la.applied_loan_amount', 'LIKE', `%${search}%`]);
                searchList.push(['la.approved_loan_amount', 'LIKE', `%${search}%`]);
                searchList.push(['la.disbursed_loan_amount', 'LIKE', `%${search}%`]);
                searchList.push(['la.loan_tenure', 'LIKE', `%${search}%`]);
                searchList.push(['la.cibil_score', 'LIKE', `%${search}%`]);
                searchList.push(['la.utm_source', 'LIKE', `%${search}%`]);
                searchList.push(['la.utm_medium', 'LIKE', `%${search}%`]);
                searchList.push(['la.utm_campaign', 'LIKE', `%${search}%`]);
                searchList.push(['la.utm_content', 'LIKE', `%${search}%`]);
                searchList.push(['la.utm_channel', 'LIKE', `%${search}%`]);
                searchList.push(['la.utm_term', 'LIKE', `%${search}%`]);
                searchList.push(['la.utm_id', 'LIKE', `%${search}%`]);
                searchList.push(['la.campaignid', 'LIKE', `%${search}%`]);
                searchList.push(['la.gad', 'LIKE', `%${search}%`]);
                searchList.push(['la.gclid', 'LIKE', `%${search}%`]);
                searchList.push(['la.mt', 'LIKE', `%${search}%`]);
                searchList.push(['la.ad', 'LIKE', `%${search}%`]);
                searchList.push(['la.adpos', 'LIKE', `%${search}%`]);
                searchList.push(['la.adgroupid', 'LIKE', `%${search}%`]);
                searchList.push(['la.utm_adgroup', 'LIKE', `%${search}%`]);
                searchList.push(['la.utm_main_source', 'LIKE', `%${search}%`]);
                searchList.push(['la.utm_device', 'LIKE', `%${search}%`]);
                searchList.push(['la.page_source', 'LIKE', `%${search}%`]);
                searchList.push(['la.source_from', 'LIKE', `%${search}%`]);
                searchList.push(['la.created_at', 'LIKE', `%${search}%`]);
                searchList.push(['la.updated_at', 'LIKE', `%${search}%`]);
                // Customer fields
                searchList.push(['c.full_name', 'LIKE', `%${search}%`]);
                searchList.push(['c.customer_mobile_number', 'LIKE', `%${search}%`]);
                searchList.push(['c.email_address', 'LIKE', `%${search}%`]);
                // DSA fields
                searchList.push(['dsa.full_name', 'LIKE', `%${search}%`]);
                searchList.push(['dsa.dsa_mobile_number', 'LIKE', `%${search}%`]);
                // Salesperson fields
                searchList.push(['sp_user.name', 'LIKE', `%${search}%`]);
                // Product and loan type fields
                searchList.push(['p.product_name', 'LIKE', `%${search}%`]);
                searchList.push(['lt.name', 'LIKE', `%${search}%`]);
                searchList.push(['sp.name', 'LIKE', `%${search}%`]);
            }

            // Convert is_export to boolean if it's a string
            const isExportBool = is_export === true || is_export === 'true' || is_export === 1;
            if (app_id_exact) {
                const fullDetail = await CustomerServices.getLoanDetails(app_id_exact);
                if (fullDetail) {
                    return ResHelper.apiResponse(res, true, "Success", 200, { results: [fullDetail], totalCount: 1 }, "");
                }
                return ResHelper.apiResponse(res, true, "Success", 200, { results: [], totalCount: 0 }, "");
            }
            const salesLoggedInUserId = req?.loggedInUser?.id || null;
            const DEFAULT_LOAN_EXPORT_TITLE = "Customer Leads Export";
            const exportTitle = export_title || DEFAULT_LOAN_EXPORT_TITLE;

            if (isExportBool) {
                // Same query as listing — no separate export path in the service
                const EXPORT_LIMIT = 50000;
                const { results, totalCount } = await CustomerServices.getLoanApplicationsList(where, searchList, 0, EXPORT_LIMIT, childPhones, false, salesLoggedInUserId);
                await ApplicationLogServices?.createExportLog(req);
                let file = await uploadArrayToS3(results, exportTitle);
                return ResHelper.apiResponse(res, true, { type: "url", file }, 200, {}, "");
            } else {
                const loanApplications = await CustomerServices.getLoanApplicationsList(where, searchList, pageNumber * pageSize, pageSize, childPhones, false, salesLoggedInUserId);
                ResHelper.apiResponse(res, true, "Success", 200, loanApplications, "");
            }
        }
    } catch (e) {
        logger.error(e);
        console.error('Error in getLoanDetails controller:', e);
        ResHelper.apiResponse(res, false, "Error occured during execution: " + (e.message || e), 500, {}, "");
    }
};
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let DSAService = require(_pathconst.ServicesPath.DSAService);
let KafkaServices = require(_pathconst.ServicesPath.KafkaServices);
let ApplicationLogServices = require(_pathconst.ServicesPath.ApplicationLogServices);
let CompanyServices = require(_pathconst.ServicesPath.CompanyServices);
let DSAValidationV2 = require(_pathconst.ReqModelsPath.DSAValidationV2);
let BankService = require(_pathconst.ServicesPath.BankService);
let uuid = require('node-uuid');
const { uploadToS3, formatDate, uploadToS3FormData, uploadArrayToS3, jsonDifference, CustomOperatorHandlers, CreateWhereQueryFilter, callNsApi, hexToUUID, isInCommaOrNewlineSeparatedList, toIsoDateIST } = require('../../../helpers/commonhelper');
const { logger } = require('../../../helpers/logger');
const { SetPayoutRequestEmailTemplate } = require('../../../../email-templates/setPayoutRequestEmail');
const { getDsaPayoutListFieldMapping, getPendingBankVerificationFieldMapping, SQL_BANK_ACCOUNT_CHEQUE_IMAGE, SQL_BANK_ACCOUNT_PASSBOOK_IMAGE } = require('../../../helpers/apiFieldMappings');
const { createActivityLogKafka } = require('../../../services/kafka-services');
const axios = require("axios");
const FormData = require("form-data");
const mime = require("mime-types");
const xlsx = require('xlsx');
const { setupSSE } = require('../../../helpers/sse-progress-helper');
let s3Url = process.env.S3_BASE_PATH;
let FinanceServices = require(_pathconst.ServicesPath.FinanceServices);
const { resolveMatchedBankFileForLead, formatSubventionPayoutLimitSuffix } = require('../../finance/leads/erp/erpHelpers');
let messageKeysMapping = { "PAN": "pan_number", "Aadhaar": "aadhar_number" };
const { getLedgerDataOnEmailNew } = require('../../../../jobs');
const { isFinanceRootUser } = require('../../../services/finance-services');
let CleverTapServices = require(_pathconst.ServicesPath.CleverTapServices);
const { decryptDsaKycSensitiveFields } = require('../../../helpers/dsaOtpEncryptionHelper');
const { hasRequestAutonomousForVendorPrivilege } = require('../../finance/leads/autonomous/autonomousHelper');

/**
 * Resolve DSA id for channel-partner APIs under `authorizeDsaCentralized`.
 * - B2B / MS: `req.dsa` with `dsa_id` or `id`.
 * - CRM (any env): allowed Referer uses `authorize` → only `req.loggedInUser`. Prefer resolving the partner
 *   DSA via `loggedInUser.userPhone` + `getDsaByPhone`, then `loggedInUser.dsa_id`, then `getLoggedInUserDsaAndBhDetails`.
 * - Optional `body.dsa_id` when CRM acts on behalf of a specific DSA.
 */
const resolveChannelPartnerDsaId = async (req) => {
    const fromDsaObject = req?.dsa?.dsa_id || req?.dsa?.id;
    if (fromDsaObject) {
        return fromDsaObject;
    }
    const bodyDsaId = req?.body?.dsa_id && String(req.body.dsa_id).trim();
    if (bodyDsaId) {
        return bodyDsaId;
    }
    if (req?.loggedInUser) {
        if (req.loggedInUser.userPhone) {
            const dsaData = await DSAService.getDsaByPhone(req.loggedInUser.userPhone);
            const fromPhone = dsaData?.dsa_id || dsaData?.customer_id;
            if (fromPhone) {
                return fromPhone;
            }
        }
        if (req.loggedInUser.dsa_id) {
            return req.loggedInUser.dsa_id;
        }
        if (req.loggedInUser.id) {
            const rows = await DSAService.getLoggedInUserDsaAndBhDetails(req.loggedInUser.id);
            if (Array.isArray(rows) && rows.length && rows[0]?.dsa_id) {
                return rows[0].dsa_id;
            }
        }
    }
    return null;
};

const RESOLVE_DSA_FOR_EMAIL_OTP_MSG =
    "Could not resolve DSA. Pass dsa_id in the body when acting for another partner, ensure the CRM user mobile matches a DSA record, or use a DSA-authenticated session.";

/** @returns {Promise<string|null>} `dsa_id`, or `null` after sending HTTP 400 on `res`. */
const resolveDsaIdForEmailOtpOrRespond = async (req, res) => {
    const dsa_id = await resolveChannelPartnerDsaId(req);
    if (!dsa_id) {
        ResHelper.apiResponseV2(res, false, RESOLVE_DSA_FOR_EMAIL_OTP_MSG, 400, {}, "");
        return null;
    }
    return dsa_id;
};

// will move them to common helper soon //
const validateFields = (fields, requiredFields) => {
    for (const field of requiredFields) {
        if (
            fields[field] === undefined ||
            fields[field] === null ||
            fields[field] === ''
        ) {
            return `${field} is required!`;
        }
    };
    return null;
};

const catchHandling = (e, res) => {
    let message = e?.original?.sqlMessage || `Error occured during execution`;
    console.log(e);
    logger.error(e);
    return ResHelper.apiResponseV2(res, false, message, 500, {}, "");
};

const removeS3 = (doc) => {
    if (!doc) return null;
    if (s3Url && doc.includes(s3Url)) {
        return doc.split(s3Url)[1];
    }
    return doc;
};

let getImageUrl = (column) => {
    let url = `case when ${column} in ("dsaDocuments/", "") then null when ${column} like "%${s3Url}%" then ${column} when ${column} is null then null when  ${column} = "" then null  else Concat("${s3Url}", ${column}) end as ${column?.split(".")[1]}`;
    return url;
};

const extractPanRowsFromExcelBuffer = (buffer) => {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: '' });

    if (!rows.length) {
        throw new Error('Excel is empty');
    }

    const headerRow = Array.isArray(rows[0]) ? rows[0] : [];
    const normalizedHeaders = headerRow.map((h) => String(h || '').trim());
    const nonEmptyHeaders = normalizedHeaders.filter(Boolean);

    if (nonEmptyHeaders.length !== 1 || nonEmptyHeaders[0] !== 'Pan Numbers') {
        throw new Error('Invalid Excel header. Expected exactly one column with header: Pan Numbers');
    }

    const panRows = [];
    const seenPans = new Set();

    for (let i = 1; i < rows.length; i++) {
        const pan = String(rows[i]?.[0] || '').trim().toUpperCase();
        if (!pan) continue;
        const isDuplicate = seenPans.has(pan);
        if (!isDuplicate) {
            seenPans.add(pan);
        }
        panRows.push({
            pan,
            isDuplicate
        });
    }

    if (!panRows.length) {
        throw new Error('No PAN values found under Pan Numbers column');
    }

    return {
        panRows
    };
};

// will move them to common helper soon //

exports.addDsaPhone = async (req, res) => {
    try {
        const { error } = await DSAValidationV2.addDsaPhone.validate(req.body);
        if (error) {
            return ResHelper.apiResponseV2(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { phone } = req?.body;
            let dsa_id = null;
            let log_data = { created_by: req?.loggedInUser?.id || dsa_id };
            let companyButIndividual = false;

            let dsa = await CompanyServices?.selectServiceDynamic(
                `ru_direct_selling_agents`,
                `p.dsa_mobile_number = "${phone}"`,
                null,
                null
            );

            dsa_id = dsa?.dsa_id;

            if (dsa?.company_id && dsa_id) {
                let dsaCompany = await CompanyServices?.selectServiceDynamic(
                    `ru_companies`,
                    `p.company_id = "${dsa?.company_id}"`,
                    null,
                    null
                );
                companyButIndividual = !Boolean(dsaCompany?.registered == dsa_id);
            };

            if (!dsa_id) {
                dsa_id = uuid();
                await CompanyServices?.upsertDataSingleTable(
                    { dsa_id, dsa_mobile_number: phone },
                    "ru_direct_selling_agents",
                    null,
                    { ...log_data, log_type: "dsa_basic_details", application_id: dsa_id }
                );
                await CompanyServices?.upsertDataSingleTable(
                    { dsa_id, dsa_mobile_number: phone },
                    "ru_dsa_kyc_data",
                    null,
                    { ...log_data, log_type: "dsa_basic_details", application_id: dsa_id }
                );
            };

            let data = await CompanyServices?.selectServiceDynamic(
                `ru_user_onboarding_steps`,
                `p.dsa_id = "${dsa_id}" ${companyButIndividual ? `and s.dsa_type in ("individual", "biller")` : ""} order by s.sort_order`,
                `left join ru_onboarding_steps s on s.step = p.step`,
                null,
                true
            );

            if (!data?.length) {
                await DSAService?.upsertAllCompanySteps(dsa_id, "individual");
            };

            return ResHelper.apiResponseV2(res, true, "Success", 200, { dsa_id, steps: data }, "");
        };
    }
    catch (e) {
        return catchHandling(e, res);
    };
};

exports.addDsaBasicDetails = async (req, res) => {
    try {
        const { error } = await DSAValidationV2.addDsaBasicDetails.validate(req.body);
        if (error) {
            return ResHelper.apiResponseV2(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            // role_in_comnpany #doubt
            let { type, company_pan, business_type, company_name, company_pan_image, profession, role_in_company, first_name, middle_name, last_name, email, gender, dob, partner_code, utm_main_source } = req.body;
            if (company_pan) {
                let requiredFields = ["role_in_company", "business_type", "company_name", "business_type"];
                let message = validateFields(req?.body, requiredFields);
                if (message) {
                    return ResHelper.apiResponseV2(res, false, message, 400, {}, "");
                };
            };

            if (!company_pan && !profession && type !== "biller") {
                return ResHelper.apiResponseV2(res, false, "Profession is required when its individual journey", 400, {}, "");
            };

            let dsa_id = req?.dsa?.dsa_id || req?.body?.dsa_id;

            // dsa_id = "f734ddf0-89ad-4e07-81a5-a5d1ab65646c";
            let company_id = null;
            let company_exists = true;
            let log_data = { log_type: "dsa_basic_details", application_id: dsa_id, created_by: req?.loggedInUser?.id || dsa_id }

            // Check if name is AuthBridge verified and prevent updates if verified
            let is_pan_verified = 0;
            if (dsa_id) {
                let existingDsa = await CompanyServices?.selectServiceDynamic(
                    `ru_direct_selling_agents`,
                    `p.dsa_id = "${dsa_id}"`,
                    `left join ru_dsa_kyc_data kyc on p.dsa_id = kyc.dsa_id`,
                    `NULLIF(p.first_name, '') AS first_name, NULLIF(p.middle_name, '') AS middle_name, NULLIF(p.last_name, '') AS last_name, COALESCE(kyc.is_permanent_account_number_verified, 0) as is_pan_verified`
                );

                is_pan_verified = existingDsa?.is_pan_verified || 0;

                if (existingDsa && existingDsa.is_pan_verified) {
                    // Name is verified, don't allow updates
                    let reqFn = first_name || null;
                    let reqMn = middle_name || null;
                    let reqLn = last_name || null;
                    let exFn = existingDsa.first_name || null;
                    let exMn = existingDsa.middle_name || null;
                    let exLn = existingDsa.last_name || null;

                    if (reqFn !== exFn || reqMn !== exMn || reqLn !== exLn) {
                        return ResHelper.apiResponseV2(res, false, "Name cannot be updated as it has been verified by AuthBridge", 400, {}, "");

                    }
                }
            };

            if (!is_pan_verified && !last_name) {
                return ResHelper.apiResponseV2(res, false, "Last Name is required", 400, {}, "");
            }

            let data = await DSAService.getDsaByPrimaryId(email, "email_address");

            if (data) {
                let emailExist = data?.filter((obj) => obj?.dsa_id !== dsa_id);
                if (emailExist?.length) {
                    return ResHelper.apiResponseV2(res, false, "Email already registered with another DSA", 400, {}, "");
                };
            };
            data = data?.filter((obj) => obj?.dsa_id == dsa_id)[0] || null;

            // assign partner starts — skip reassignment (and partner_assigned_date refresh) if unchanged
            const normalizePartnerMobile = (p) => String(p ?? '').trim();
            const incomingPartner = normalizePartnerMobile(partner_code);
            const existingPartner = normalizePartnerMobile(data?.partner_code);
            const partnerUnchanged = incomingPartner === existingPartner;


            if (!partnerUnchanged) {
                let prevCount = await DSAService.getPartnerHierarchyCount(partner_code);
                if (prevCount > 4) {
                    return ResHelper.apiResponseV2(res, false, "Partner hierarchy limit reached", 409, {}, "");
                };

                if (data?.partner_code && data?.partner_code != partner_code && data?.partner_code != "9930570707") {
                    return ResHelper.apiResponseV2(res, false, "Partner already exist for this DSA", 409, {}, "");
                };
                await DSAService.reassignPartner(dsa_id, partner_code, prevCount);
            }
            // assign partner ends

            if (company_pan && !company_pan_image) {
                return ResHelper.apiResponseV2(res, false, "PAN image is also required!", 409, {}, "");
            };

            if (company_pan) {
                let data = await CompanyServices?.getCompanyDetailsById(`where rc.pan="${company_pan}"`);
                company_id = data?.records?.company_id || null;
                if (company_id && !data?.pin_code) {
                    company_exists = false;
                    // await DSAService?.updateJourneyStep("company_details", dsa_id, 1);
                };
            };

            if (!company_id && company_pan) {
                company_exists = false;
                company_id = uuid();
                await CompanyServices?.upsertDataSingleTable({ company_id, pan: company_pan, registered_by: dsa_id }, "ru_companies", false, { ...log_data, log_type: "company_documents", application_id: company_id, created_by: req?.loggedInUser?.id || dsa_id });
                await DSAService?.upsertAllCompanySteps(dsa_id);
            };

            if (company_id) {
                // Check if company name is AuthBridge verified and prevent updates if verified
                let existingCompany = await CompanyServices?.selectServiceDynamic(
                    `ru_companies`,
                    `p.company_id = "${company_id}"`,
                    null,
                    `NULLIF(p.name, '') AS name, COALESCE(p.is_pan_verified, 0) as is_pan_verified, p.business_type, p.registered_by`
                );

                // For sole proprietorship, check DSA name verification instead of company name
                if (existingCompany && existingCompany.business_type === "sole_prop" && existingCompany.registered_by) {
                    let existingDsaForCompany = await CompanyServices?.selectServiceDynamic(
                        `ru_direct_selling_agents`,
                        `p.dsa_id = "${existingCompany.registered_by}"`,
                        `left join ru_dsa_kyc_data kyc on p.dsa_id = kyc.dsa_id`,
                        `p.first_name, p.middle_name, p.last_name, COALESCE(kyc.is_permanent_account_number_verified, 0) as is_pan_verified`
                    );
                    if (existingDsaForCompany && existingDsaForCompany.is_pan_verified) {
                        // DSA name is verified, don't allow updates
                        if ((first_name || "") !== (existingDsaForCompany.first_name || "") ||
                            (middle_name || "") !== (existingDsaForCompany.middle_name || "") ||
                            (last_name || "") !== (existingDsaForCompany.last_name || "")) {
                            return ResHelper.apiResponseV2(res, false, "Name cannot be updated as it has been verified by AuthBridge", 400, {}, "");
                        }
                    }
                } else if (existingCompany && existingCompany.is_pan_verified && company_name !== existingCompany.name) {
                    // For other company types, check company name verification
                    return ResHelper.apiResponseV2(res, false, "Company name cannot be updated as it has been verified by AuthBridge", 400, {}, "");
                }


                if (!company_pan_image?.includes("https://") && company_pan_image) company_pan_image = await uploadToS3('companyDocuments', company_pan_image, `company_pan_doc_${uuid()}`, 'image/jpeg', 'jpg');
                await CompanyServices?.upsertDataSingleTable(
                    { company_id, doc_unique_id: company_pan, doc_type: "legal_compliance", doc_name: "permanent_account_number", doc_path: removeS3(company_pan_image) },
                    "ru_company_documents",
                    { company_id, doc_name: "permanent_account_number" },
                    { ...log_data, log_type: "company_documents", application_id: company_id }
                );
                await CompanyServices?.upsertDataSingleTable({ business_type, name: company_name }, "ru_companies", { company_id }, { ...log_data, log_type: "company_details", application_id: company_id, created_by: req?.loggedInUser?.id || dsa_id });
            };

            let business_mode = company_id ? "company" : "individual";
            if (type) {
                business_mode = type;
            };
            const full_name = [first_name, middle_name, last_name].filter(Boolean).join(' ');
            let updateObj = { full_name, user_type: Boolean(business_mode == "individual") ? "channel_partner" : business_mode, company_id, business_mode, first_name, last_name, middle_name, gender, email_address: email, role_in_company, date_of_birth: formatDate(dob), profession };
            if (req?.loggedInUser?.role) {
                updateObj = { ...updateObj, utm_main_source: utm_main_source || null, utm_device: "crm" }
            };
            await CompanyServices?.upsertDataSingleTable(
                updateObj,
                "ru_direct_selling_agents",
                { dsa_id },
                log_data
            );

            await DSAService?.updateJourneyStep("basic_details", dsa_id, 1);
            let response = company_pan ? { company_exists, dsa_id } : { dsa_id };

            try {
                await KafkaServices.connectKafkaProducer();
                if (partner_code && !partnerUnchanged) {
                    const partnerEvt = new KafkaServices.VendorSnapshotEvent('PARTNER_CHANGED', dsa_id, { partner_code }, req?.loggedInUser?.id || dsa_id);
                    await KafkaServices.sendToKafkaVendorSnapshot(partnerEvt);
                }
                const contactEvt = new KafkaServices.VendorSnapshotEvent('CONTACT_UPDATED', dsa_id, { email_address: email }, req?.loggedInUser?.id || dsa_id);
                await KafkaServices.sendToKafkaVendorSnapshot(contactEvt);
            } catch (kafkaErr) {
                logger.error('VendorSnapshotEvent Kafka failed in addDsaBasicDetails', kafkaErr);
            }

            // authbridge verification was there //
            // if (company_pan && company_id) {
            //     let { message, type, status, nameUpdated, updatedName } = await DSAService?.verifyPanViaAuthBridge(company_pan, "company", company_id);
            //     if (type == "success_hit" && !status) {
            //         return ResHelper.apiResponseV2(res, false, message, 200, req?.body, "");
            //     };
            //     // If name was updated, return the updated name info
            //     if (nameUpdated && updatedName) {
            //         return ResHelper.apiResponseV2(res, true, message || "Name updated from AuthBridge verification", 200, { ...response, updatedName }, "");
            //     };
            // };
            return ResHelper.apiResponseV2(res, true, "Success", 200, response, "");
        };
    }
    catch (e) {
        return catchHandling(e, res);
    };
};

exports.sendDsaEmailAddressVerificationOtp = async (req, res) => {
    try {
        const { error } = await DSAValidationV2.sendDsaEmailAddressVerificationOtp.validate(req.body);
        if (error) {
            return ResHelper.apiResponseV2(res, false, error.message, 400, {}, "");
        }
        const dsa_id = await resolveDsaIdForEmailOtpOrRespond(req, res);
        if (!dsa_id) {
            return;
        }
        const { email } = req.body;
        const out = await DSAService.sendDsaEmailAddressVerificationOtpForDsa(dsa_id, email);
        return ResHelper.apiResponseV2(res, out.ok, out.message, out.statusCode, {}, "");
    } catch (e) {
        return catchHandling(e, res);
    }
};

exports.verifyDsaEmailAddressVerificationOtp = async (req, res) => {
    try {
        const { error } = await DSAValidationV2.verifyDsaEmailAddressVerificationOtp.validate(req.body);
        if (error) {
            return ResHelper.apiResponseV2(res, false, error.message, 400, {}, "");
        }
        const dsa_id = await resolveDsaIdForEmailOtpOrRespond(req, res);
        if (!dsa_id) {
            return;
        }
        const { email, otp } = req.body;
        const out = await DSAService.verifyDsaEmailAddressVerificationOtpForDsa(dsa_id, email, otp);
        return ResHelper.apiResponseV2(res, out.ok, out.message, out.statusCode, out.data || {}, "");
    } catch (e) {
        return catchHandling(e, res);
    }
};

/** B2B external — re-send OTP when email is already verified. */
exports.sendDsaEmailReverificationOtpExternal = async (req, res) => {
    try {
        const { error } = await DSAValidationV2.sendDsaEmailReverificationOtp.validate(req.body);
        if (error) {
            return ResHelper.apiResponseV2(res, false, error.message, 400, {}, "");
        }
        const dsa_id = await resolveDsaIdForEmailOtpOrRespond(req, res);
        if (!dsa_id) {
            return;
        }
        const { email } = req.body;
        const out = await DSAService.sendDsaEmailReverificationOtpForDsa(dsa_id, email);
        return ResHelper.apiResponseV2(res, out.ok, out.message, out.statusCode, {}, "");
    } catch (e) {
        return catchHandling(e, res);
    }
};

/** B2B external — confirm OTP for already-verified email. */
exports.verifyDsaEmailReverificationOtpExternal = async (req, res) => {
    try {
        const { error } = await DSAValidationV2.verifyDsaEmailReverificationOtp.validate(req.body);
        if (error) {
            return ResHelper.apiResponseV2(res, false, error.message, 400, {}, "");
        }
        const dsa_id = await resolveDsaIdForEmailOtpOrRespond(req, res);
        if (!dsa_id) {
            return;
        }
        const { email, otp } = req.body;
        const out = await DSAService.verifyDsaEmailReverificationOtpForDsa(dsa_id, email, otp);
        return ResHelper.apiResponseV2(res, out.ok, out.message, out.statusCode, out.data || {}, "");
    } catch (e) {
        return catchHandling(e, res);
    }
};

exports.addDsaKyc = async (req, res) => {
    try {
        const encryptedBody = { ...req.body };
        try {
            req.body = decryptDsaKycSensitiveFields(req.body);
        } catch (decryptError) {
            logger.warn("addDsaKyc decrypt failed", { message: decryptError?.message });
            return ResHelper.apiResponseV2(res, false, "Invalid PAN or Aadhaar", 400, {}, "");
        }

        const { error } = await DSAValidationV2.addDsaKyc.validate(req.body);
        if (error) {
            return ResHelper.apiResponseV2(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pan_number, pan, aadhar_number, aadhar_front, aadhar_back, selfie } = req.body;
            let dsa_id = req?.dsa?.dsa_id || req?.body?.dsa_id;

            let dsa_mobile_number = await CompanyServices?.selectServiceDynamic(
                `ru_direct_selling_agents`,
                `p.dsa_id = "${dsa_id}"`,
                `LEFT JOIN ru_dsa_kyc_data k ON p.dsa_id = k.dsa_id LEFT JOIN ru_user_onboarding_steps o ON p.dsa_id = o.dsa_id AND o.step = 'kyc'`,
                `p.dsa_mobile_number, p.business_mode, k.permanent_account_number, o.status as kyc_status, k.is_permanent_account_number_verified`
            );

            const currentPan = dsa_mobile_number.permanent_account_number;
            const isKycCompleted = Boolean(dsa_mobile_number.kyc_status === 1 && dsa_mobile_number.is_permanent_account_number_verified === 1);

            // Check if KYC is already completed and PAN is being changed
            if (isKycCompleted && currentPan && currentPan !== pan_number) {
                return ResHelper.apiResponseV2(res, false, "Cannot update PAN as KYC details already verified", 400, {}, "KYC_ALREADY_COMPLETED");
            };

            let error = dsa_mobile_number?.business_mode != "biller" ? validateFields(req?.body, ["pan_number", "aadhar_number", "pan", "aadhar_front", "aadhar_back"]) : null;
            let personal_pan_regex = /^[A-Z]{3}P[A-Z][0-9]{4}[A-Z]$/;
            if (dsa_mobile_number?.business_mode != "biller" && personal_pan_regex.test(pan_number) == false) {
                error = !error ? "Invalid Personal PAN format" : error;
            };
            if (error) {
                return ResHelper.apiResponseV2(res, false, error, 400, {}, "");
            };

            dsa_mobile_number = dsa_mobile_number?.dsa_mobile_number;

            let log_data = { log_type: "dsa_kyc_data", application_id: dsa_id, created_by: req?.loggedInUser?.id || dsa_id };

            let isExist = await DSAService?.getDsaByPan(pan_number, ` or k.address_proof_number = "${aadhar_number}" `);

            if (isExist && isExist?.customer_id != dsa_id) {
                const matchedFields = ['PAN', 'Aadhaar'].filter(field => {
                    const isExistValue = isExist[messageKeysMapping[field]];
                    const requestValue = req.body[messageKeysMapping[field]];

                    return (isExistValue != null && isExistValue) && isExistValue === requestValue;
                });

                if (matchedFields.length > 0) {
                    const message = `This ${matchedFields.join(' and ')} is already registered!`;
                    return ResHelper.apiResponseV2(res, false, message, 409, {}, "");
                };
            };


            if (!pan?.includes("https://") && pan) pan = await uploadToS3('dsaDocuments', pan, `dsa_pan_${uuid()}`, 'image/jpeg', 'jpg');
            if (!aadhar_front?.includes("https://") && aadhar_front) aadhar_front = await uploadToS3('dsaDocuments', aadhar_front, `dsa_aadhar_front_${uuid()}`, 'image/jpeg', 'jpg');
            if (!aadhar_back?.includes("https://") && aadhar_back) aadhar_back = await uploadToS3('dsaDocuments', aadhar_back, `dsa_aadhar_back_${uuid()}`, 'image/jpeg', 'jpg');
            if (!selfie?.includes("https://") && selfie) selfie = await uploadToS3('dsaDocuments', selfie, `dsa_selfie_${uuid()}`, 'image/jpeg', 'jpg');

            pan = pan ? pan.split(s3Url)[1] : null;
            aadhar_front = aadhar_front ? aadhar_front.split(s3Url)[1] : null;
            aadhar_back = aadhar_back ? aadhar_back.split(s3Url)[1] : null;
            selfie = selfie ? selfie.split(s3Url)[1] : null;

            let obj = { dsa_id, dsa_mobile_number, permanent_account_number: pan_number, display_picture_filename: selfie, address_proof_number: aadhar_number, address_proof_front_image_filename: aadhar_front, address_proof_back_image_filename: aadhar_back, pan_card_front_image_filename: pan };
            await CompanyServices?.upsertDataSingleTable(obj, "ru_dsa_kyc_data", { dsa_id, dsa_mobile_number: dsa_mobile_number || null }, log_data);

            // Update DSA ID for all claims with matching vendor PAN after KYC is updated
            if (pan_number) {
                try {
                    const result = await DSAService.updateDsaIdForVendorClaims(pan_number, dsa_id);
                    logger.info(`Updated DSA ID for vendor claims: ${JSON.stringify(result)}`);
                } catch (error) {
                    logger.error('Error updating DSA ID for vendor claims:', error);
                    // Don't fail the request, just log the error
                }
            }

            await DSAService?.updateJourneyStep("kyc", dsa_id, 1);

            // authbridge verification was there //
            // let { message, type, status, nameUpdated, updatedName } = await DSAService?.verifyPanViaAuthBridge(pan_number, "dsa", dsa_id);
            // if (type == "success_hit" && !status) {
            //     return ResHelper.apiResponseV2(res, false, message, 200, req?.body, "");
            // };
            // // If name was updated, return the updated name info
            // if (nameUpdated && updatedName) {
            //     return ResHelper.apiResponseV2(res, true, message || "Name updated from AuthBridge verification", 200, { ...req?.body, updatedName }, "");
            // };
            return ResHelper.apiResponseV2(res, true, "Success", 200, encryptedBody, "");
        }
    }
    catch (e) {
        console.log(e)
        return catchHandling(e, res);
    }
};

exports.addCompanyDetails = async (req, res) => {
    try {
        const { error } = await DSAValidationV2.addCompanyDetails.validate(req.body);
        if (error) {
            return ResHelper.apiResponseV2(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let dsa_id = req?.dsa?.dsa_id || req?.body?.dsa_id;
            let { short_name, phone, date_of_incorp, msme_no, msme_doc, company_id } = req?.body;
            let editByCompany = company_id && req?.loggedInUser;
            let masterRoles = editByCompany ? ["BUSINESS_HEAD", "CEO"]?.includes(req?.loggedInUser?.role) : false;

            if (editByCompany && !masterRoles) {
                return ResHelper.apiResponseV2(res, false, `Not authorized for this operation!`, 400, {}, "");
            };
            // board_resolution, share_holder #doubt

            let company;

            if (editByCompany) {
                company = await CompanyServices?.fetchCompanyWithOwnership(company_id, "company_id");
                if (company && !(masterRoles || company?.registered_by == req?.loggedInUser?.dsa_id)) {
                    return ResHelper.apiResponseV2(res, false, `Not authorized for this operation!`, 400, {}, "");
                };
            } else {
                company = await CompanyServices?.fetchCompanyWithOwnership(dsa_id, "registered_by");
            };

            company_id = company?.company_id;
            let business_type = company?.business_type;

            if (req?.loggedInUser && company_id) {
                company_id = company_id;
            };

            if (!company_id) {
                return ResHelper.apiResponseV2(res, false, `Not authorized for this operation!`, 400, {}, "");
            };
            let log_data = { log_type: "company_documents", application_id: company_id, created_by: req?.loggedInUser?.id || dsa_id };

            // partnership
            let { pal_doc, partnership_deed_doc } = req?.body;

            // pvt ltd #share_holder = array
            let { board_resolution, share_holder, gstin, gst_doc, coi } = req?.body;

            if ((msme_no && !msme_doc) || (!msme_no && msme_doc)) {
                return ResHelper.apiResponseV2(res, false, `MSME details not provided!`, 400, {}, "");
            };

            if ((gstin && !gst_doc) || (!gstin && gst_doc)) {
                return ResHelper.apiResponseV2(res, false, `GST details not provided!`, 400, {}, "");
            };

            if (business_type == "partnership") {
                let requiredFields = ["pal_doc", "partnership_deed_doc"];;
                let message = validateFields(req?.body, requiredFields);
                if (message) {
                    return ResHelper.apiResponseV2(res, false, message, 400, {}, "");
                };
            };

            if (["pvt_ltd", "public_ltd"]?.includes(business_type)) {
                if (!gstin && !coi) {
                    return ResHelper.apiResponseV2(res, false, `COI is mandatory when GSTIN not provided`, 400, {}, "");
                };

                if (gstin && !gst_doc) {
                    return ResHelper.apiResponseV2(res, false, `GST Doc is mandatory when GSTIN is provided`, 400, {}, "");
                };

                let requiredFields = ["board_resolution", "share_holder"];;
                let message = validateFields(req?.body, requiredFields);
                if (message && business_type == "pvt_ltd") {
                    return ResHelper.apiResponseV2(res, false, message, 400, {}, "");
                };
            };



            if (!gst_doc?.includes("https://") && gst_doc) gst_doc = await uploadToS3('companyDocuments', gst_doc, `gst_doc_${uuid()}`, 'image/jpeg', 'jpg');
            if (!msme_doc?.includes("https://") && msme_doc) msme_doc = await uploadToS3('companyDocuments', msme_doc, `msme_doc_${uuid()}`, 'image/jpeg', 'jpg');
            if (!pal_doc?.includes("https://") && pal_doc) pal_doc = await uploadToS3('companyDocuments', pal_doc, `pal_doc_${uuid()}`, 'image/jpeg', 'jpg');
            if (!partnership_deed_doc?.includes("https://") && partnership_deed_doc) partnership_deed_doc = await uploadToS3('companyDocuments', partnership_deed_doc, `partnership_deed_doc_${uuid()}`, 'image/jpeg', 'jpg');
            if (!board_resolution?.includes("https://") && board_resolution) board_resolution = await uploadToS3('companyDocuments', board_resolution, `board_resolution_doc_${uuid()}`, 'image/jpeg', 'jpg');
            if (!share_holder?.includes("https://") && share_holder) share_holder = await uploadToS3('companyDocuments', share_holder, `share_holder_doc_${uuid()}`, 'image/jpeg', 'jpg');
            if (!coi?.includes("https://") && coi) coi = await uploadToS3('companyDocuments', coi, `coi_doc_${uuid()}`, 'image/jpeg', 'jpg');

            let condition = Boolean(msme_no || gstin) ? `(p.doc_unique_id in ("${gstin || ""}","${msme_no || ""}") or c.phone="${phone || ""}" ) and p.company_id != "${company_id}" and p.doc_unique_id is not null and c.phone is not null` : null;
            let duplicate = await CompanyServices?.selectServiceDynamic("ru_company_documents", condition, `left join ru_companies c on p.company_id = c.company_id`);
            if (duplicate) {
                return ResHelper.apiResponseV2(res, false, "Duplicate entry with same GST No or MSME No or Phone already exist !", 409, {}, "");
            };

            gst_doc && await CompanyServices?.upsertDataSingleTable({ company_id, doc_type: "legal_agreement", doc_name: "gstin", doc_unique_id: gstin || null, doc_path: removeS3(gst_doc) }, "ru_company_documents", { company_id, doc_name: "gstin" }, log_data);
            msme_doc && await CompanyServices?.upsertDataSingleTable({ company_id, doc_type: "legal_agreement", doc_name: "msme_no", doc_unique_id: msme_no || null, doc_path: removeS3(msme_doc) }, "ru_company_documents", { company_id, doc_name: "msme_no" }, log_data);
            pal_doc && await CompanyServices?.upsertDataSingleTable({ company_id, doc_type: "legal_agreement", doc_name: "pal", doc_unique_id: uuid(), doc_path: removeS3(pal_doc) }, "ru_company_documents", { company_id, doc_name: "pal" }, log_data);
            partnership_deed_doc && await CompanyServices?.upsertDataSingleTable({ company_id, doc_type: "legal_agreement", doc_name: "partnership_deed", doc_unique_id: uuid(), doc_path: removeS3(partnership_deed_doc) }, "ru_company_documents", { company_id, doc_name: "partnership_deed" }, log_data);
            board_resolution && await CompanyServices?.upsertDataSingleTable({ company_id, doc_type: "legal_agreement", doc_name: "board_resolution", doc_unique_id: uuid(), doc_path: removeS3(board_resolution) }, "ru_company_documents", { company_id, doc_name: "board_resolution" }, log_data);
            coi && await CompanyServices?.upsertDataSingleTable({ company_id, doc_type: "legal_agreement", doc_name: "coi", doc_unique_id: uuid(), doc_path: removeS3(coi) }, "ru_company_documents", { company_id, doc_name: "coi" }, log_data);

            let obj = { company_id, short_name, phone: phone || null, msme_no: msme_no || null, gstin: gstin || null, date_of_incorp, registered_by: dsa_id, share_holders: removeS3(share_holder) }
            await CompanyServices?.upsertDataSingleTable(obj, "ru_companies", { company_id }, { ...log_data, log_type: "company_basic_details" });

            !editByCompany && await DSAService?.updateJourneyStep("company_details", dsa_id, 1);
            return ResHelper.apiResponseV2(res, true, "Success", 200, req?.body, "");
        }
    }
    catch (e) {
        return catchHandling(e, res);
    }
};

exports.addAddressDetails = async (req, res) => {
    try {
        const { error } = await DSAValidationV2.addAddressDetails.validate(req.body);
        if (error) {
            return ResHelper.apiResponseV2(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let dsa_id = req?.dsa?.dsa_id || req?.body[0]?.dsa_id;

            // dsa_id = "e40d7895-1e98-4f7f-b2a3-002dc3540dc4";

            let data;
            let billing_required = false;
            let billing_exist = false;
            let editByCompany = Boolean(req?.loggedInUser && req?.body[0]?.company_id);

            for (let i = 0; i < req?.body?.length; i++) {
                let { house_number, area, postal_code, city, state, type, country } = req?.body[i];
                if (type == "dsa") {
                    let log_data = { log_type: "dsa_address", application_id: dsa_id, created_by: req?.loggedInUser?.id || dsa_id };
                    await CompanyServices?.upsertDataSingleTable(
                        {
                            address_line_1: house_number,
                            address_line_2: area,
                            city,
                            state,
                            pin_code: postal_code,
                            country,
                            address_type_id: "dsa_address",
                            dsa_id
                        },
                        "ru_dsa_addresses",
                        { dsa_id },
                        log_data
                    );
                    dsa_id && await DSAService?.updateJourneyStep("address", dsa_id, 1);

                    // Update CleverTap profile with address details
                    try {
                        await CleverTapServices?.updateUserProfile(dsa_id.toString(), {
                            'City': city,
                            'State': state,
                            'Pin Code': postal_code,
                            'MSG-whatsapp': true
                        });
                    } catch (error) {
                        console.error('CleverTap profile update failed:', error);
                    }

                };


                if (type == "company") {
                    let company_id = req?.body[0]?.company_id || null;

                    if (editByCompany && req?.loggedInUser?.role !== "CEO") {
                        return ResHelper.apiResponseV2(res, false, `Not authorized for this operation!`, 400, {}, "");
                    };

                    data = !company_id ? await CompanyServices?.fetchCompanyWithOwnership(dsa_id, "registered_by") : company_id;
                    company_id = editByCompany ? company_id : data?.company_id;
                    if (!data) {
                        return ResHelper.apiResponseV2(res, false, `Not authorized for this operation!`, 400, {}, "");
                    };

                    if (data?.gstin) {
                        billing_required = true
                        billing_exist = req?.body?.some((obj) => obj.type == "billing");
                    };

                    let { house_number, area, postal_code, city, state } = req?.body[i];
                    let log_data = { log_type: "company_address", application_id: company_id, created_by: req?.loggedInUser?.id || dsa_id };

                    let obj = { company_id, address_type_id: "company_address", address_line_1: house_number, address_line_2: area, pin_code: postal_code, city, state, country, created_by: dsa_id };
                    await CompanyServices?.upsertDataSingleTable(obj, "ru_company_addresses", { company_id, address_type_id: "company_address" }, log_data);

                    dsa_id && await DSAService?.updateJourneyStep("company_address", dsa_id, Boolean(billing_required && !billing_exist) ? 0 : 1);
                };

                if (type == "billing") {
                    let company_id = req?.body[0]?.company_id || null;

                    if (editByCompany && req?.loggedInUser?.role !== "CEO") {
                        return ResHelper.apiResponseV2(res, false, `Not authorized for this operation!`, 400, {}, "");
                    };

                    data = !company_id ? await CompanyServices?.fetchCompanyWithOwnership(dsa_id, "registered_by") : company_id;
                    company_id = editByCompany ? company_id : data?.company_id;
                    if (!data) {
                        return ResHelper.apiResponseV2(res, false, `Not authorized for this operation!`, 400, {}, "");
                    };

                    let { house_number, area, postal_code, city, state } = req?.body[i];
                    let log_data = { log_type: "company_address", application_id: company_id, created_by: req?.loggedInUser?.id || dsa_id };

                    // company_type = "partnership" then mandatory

                    let obj2 = { company_id, address_type_id: "billing_address", address_line_1: house_number, address_line_2: area, pin_code: postal_code, city: city, state: state, country, created_by: dsa_id };
                    await CompanyServices?.upsertDataSingleTable(obj2, "ru_company_addresses", { company_id, address_type_id: "billing_address" }, log_data);

                    dsa_id && await DSAService?.updateJourneyStep("company_address", dsa_id, 1);
                };
            };

            if (Boolean(billing_required && !billing_exist)) {
                return ResHelper.apiResponseV2(res, true, "Billing address is required when there is GST Number!", 400, {}, "")
            };
            return ResHelper.apiResponseV2(res, true, "Success", 200, req?.body, "");
        };
    }
    catch (e) {
        return catchHandling(e, res);
    }
};

exports.switchBusinessMode = async (req, res) => {
    try {
        const { error } = await DSAValidationV2.switchBusinessMode.validate(req.body);
        if (error) {
            return ResHelper.apiResponseV2(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let dsa_id = req?.dsa?.dsa_id || req?.body?.dsa_id;
            let { business_mode, company_id } = req?.body;
            let dsa = await DSAService.getDsaById(dsa_id);

            let updateObj = { business_mode };

            if (["company"]?.includes(business_mode)) {
                if (!company_id) {
                    return ResHelper.apiResponseV2(res, false, "Company ID is required when switching to company mode", 400, req?.body, "");
                }
                updateObj = { ...updateObj, user_type: business_mode, company_id };
            }
            // else if (["individual"]?.includes(business_mode)) {
            //     updateObj = { ...updateObj, user_type: business_mode, company_id: null };
            // };

            // if (!dsa?.company_id) {
            //     return ResHelper.apiResponseV2(res, false, "No company found for this DSA!", 404, req?.body, "");
            // };

            let log_data = { log_type: "dsa_basic_details", application_id: dsa_id, created_by: req?.loggedInUser?.id || dsa_id };
            await CompanyServices?.upsertDataSingleTable(updateObj, "ru_direct_selling_agents", { dsa_id }, log_data);

            // Handle company onboarding steps when switching to company mode
            // if (["company"]?.includes(business_mode)) {
            //     await CompanyServices.handleCompanyOnboardingSteps(dsa_id);
            // }

            // await DSAService?.updateJourneyStep("busines", dsa_id, 1);
            return ResHelper.apiResponseV2(res, true, "Success", 200, req?.body, "");
        }
    }
    catch (e) {
        return catchHandling(e, res);
    }
};

exports.uploadDocumentsCentralized = async (req, res) => {
    try {
        const { error } = await DSAValidationV2.uploadDocumentsCentralized.validate(req.body);
        if (error) {
            return ResHelper.apiResponseV2(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { doc } = req?.files;
            if (!doc) {
                return ResHelper.apiResponseV2(res, false, "Document file is required", 400, {}, "");
            };

            const allowedExtensions = [".jpg", ".jpeg", ".png", ".pdf"];
            const fileExtension = require("path").extname(doc.name).toLowerCase();
            if (!allowedExtensions.includes(fileExtension)) {
                return ResHelper.apiResponseV2(res, false, "Only jpg, jpeg, png, and pdf files are allowed", 400, {}, "");
            };

            // Validate actual file content via magic bytes (prevents extension spoofing)
            const buf = doc.data;
            const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
            const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
            const isPdf = buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
            if (!isJpeg && !isPng && !isPdf) {
                return ResHelper.apiResponseV2(res, false, "Only jpg, jpeg, png, and pdf files are allowed", 400, {}, "");
            };

            const { folder, doc_name } = req?.body;
            doc_path = await uploadToS3FormData(folder, doc, `${doc_name}_${uuid()}`);
            return ResHelper.apiResponseV2(res, true, "Success", 200, { doc_path }, "");
        }
    }
    catch (e) {
        return catchHandling(e, res);
    }
};

exports.getDsaBasicDetails = async (req, res) => {
    try {
        let dsa_id = req?.dsa?.dsa_id || req?.query?.dsa_id;
        //  let dsa_id = "30468787";

        let dsaData = await CompanyServices?.selectServiceDynamic(
            `ru_direct_selling_agents`,
            `p.dsa_id = "${dsa_id}"`,
            `left join ru_companies c on p.company_id = c.company_id left join ru_direct_selling_agents partner on p.partner_code = partner.dsa_mobile_number
             LEFT JOIN CRMTest.users u ON uuid_to_bin(p.salesperson_id) = u.id  LEFT JOIN ru_dsa_kyc_data kyc ON kyc.dsa_id = p.dsa_id`,
            // LEFT JOIN CRMTest.users sup ON sup.id = u.parent 
            // -- dsa_user → the CRM user record for the DSA. // sup → the supervisor of that DSA.
            `p.utm_device, p.utm_main_source, p.profession, p.business_mode, c.company_id, c.pan as company_pan, p.partner_code, partner.first_name as partner_first_name, partner.last_name as partner_last_name, p.first_name, p.last_name, p.middle_name, p.gender, p.email_address, COALESCE(p.is_email_address_verified, 0) AS is_email_address_verified, p.role_in_company, p.date_of_birth, u.phone AS rm_contact_number, kyc.is_permanent_account_number_verified as is_dsa_pan_verified, c.is_pan_verified as is_company_pan_verified,
             u.name AS rm_name, p.salesperson_id`
        );

        if (dsaData) {
            // Step 2: Recursive SQL to find TELE_SUPERVISOR in parent chain
            const telesupQuery = `
                        WITH RECURSIVE parent_chain AS (
                SELECT u.id, u.parent, r.role, u.name, u.phone, 0 AS level,
                    CONCAT('[', BIN_TO_UUID(u.id), ']') AS path
                FROM CRMTest.users u
                LEFT JOIN CRMTest.roles r ON u.role = r.id
                WHERE u.id = uuid_to_bin(?)

                UNION ALL

                SELECT u2.id, u2.parent, r2.role, u2.name, u2.phone, pc.level + 1,
                    CONCAT(pc.path, ',[', BIN_TO_UUID(u2.id), ']') AS path
                FROM CRMTest.users u2
                LEFT JOIN CRMTest.roles r2 ON u2.role = r2.id
                INNER JOIN parent_chain pc ON u2.id = pc.parent
                WHERE pc.level < 50
                AND u2.parent IS NOT NULL
                AND pc.path NOT LIKE CONCAT('%[', BIN_TO_UUID(u2.id), ']%')
            )
            SELECT name, phone FROM parent_chain WHERE role = 'TELE_SUPERVISOR' ORDER BY level LIMIT 1 `;

            const startingParentUuid = dsaData?.salesperson_id || null;
            let telesup = [];
            if (startingParentUuid) {
                telesup = await CompanyServices.runRawQuery(telesupQuery, [startingParentUuid]);
            }
            dsaData.supervisor_name = telesup?.[0]?.name || null;
            dsaData.supervisor_contact_number = telesup?.[0]?.phone || null;

            let kyc_data = await CompanyServices?.selectServiceDynamic(
                `ru_dsa_kyc_data`,
                `p.dsa_id = "${dsa_id}"`,
                null,
                `permanent_account_number, address_proof_number,
                 ${getImageUrl(`p.display_picture_filename`)},
                 ${getImageUrl(`p.address_proof_front_image_filename`)},
                 ${getImageUrl(`p.address_proof_back_image_filename`)},
                 ${getImageUrl(`p.pan_card_front_image_filename`)}`
            );
            dsaData[`kyc_data`] = kyc_data || null;
        }
        dsaData[`company_pan_image`] = null;
        if (dsaData?.company_id) {
            let company_pan = await CompanyServices?.selectServiceDynamic(
                `ru_company_documents`,
                ` company_id = "${dsaData?.company_id}" and doc_name = "permanent_account_number" `
            );
            let company = await CompanyServices?.selectServiceDynamic(
                `ru_companies`,
                ` company_id = "${dsaData?.company_id}" `
            );
            dsaData[`company_pan_image`] = company_pan?.doc_path || null;
            dsaData[`business_type`] = company?.business_type || null;
            dsaData[`company_name`] = company?.name || null;
        };
        dsaData?.salesperson_id && delete dsaData.salesperson_id;
        return ResHelper.apiResponseV2(res, true, "Success", 200, dsaData, "");
    }
    catch (e) {
        return catchHandling(e, res);
    };
};

exports.getCompanyDetails = async (req, res) => {
    try {
        let dsa_id = req?.dsa?.dsa_id || req?.query?.dsa_id;
        let company_id = Boolean(req?.loggedInUser && req?.query?.company_id) ? req?.query?.company_id : null;
        // let company_id = "a56b164c-d6ca-49f9-9d3c-e56e2bb4c443";

        if (!company_id) {
            let dsaData = await CompanyServices?.selectServiceDynamic(
                `ru_direct_selling_agents`,
                `p.dsa_id = "${dsa_id}"`,
                `left join ru_companies c on p.company_id = c.company_id`,
                `p.company_id, c.ns_internal_id, c.pan as company_pan, p.first_name, p.last_name, p.middle_name, p.gender, p.email_address, p.role_in_company, p.date_of_birth`
            );
            company_id = dsaData?.company_id || null;
            if (!company_id) {
                return ResHelper.apiResponseV2(res, false, `Not details found!`, 400, {}, "");
            };
        };

        let companyData = await CompanyServices?.selectServiceDynamic(
            `ru_companies`,
            `p.company_id = "${company_id}"`,
            `left join ru_direct_selling_agents dsa on p.registered_by = dsa.dsa_id`,
            `CONCAT_WS(' ', dsa.first_name, dsa.middle_name, dsa.last_name) AS registrar_full_name, dsa.partner_code as registrar_partner_code, p.pan, p.company_id, p.name, p.short_name, p.phone, p.msme_no, p.gstin, p.date_of_incorp, p.business_type, p.registered_by, ${getImageUrl("p.share_holders")}, dsa.dsa_mobile_number as registered_by_mobile, p.ns_internal_id`
        );

        if (companyData?.company_id) {
            let documents = await CompanyServices?.selectServiceDynamic(
                `ru_company_documents`,
                `p.company_id = "${company_id}"`,
                null,
                `p.*,${getImageUrl(`p.doc_path`)}`,
                true
            );
            companyData[`documents`] = documents || null;
        };

        return ResHelper.apiResponseV2(res, true, "Success", 200, companyData, "");
    }
    catch (e) {
        return catchHandling(e, res);
    };
};

exports.getAddressDetails = async (req, res) => {
    try {
        let dsa_id = req?.dsa?.dsa_id || req?.query?.dsa_id;
        // dsa_id = "c95142bd-94ef-42c9-89b8-3fd3f14388c9";

        let dsaAddresses = await CompanyServices?.selectServiceDynamic(
            `ru_dsa_addresses`,
            `p.dsa_id = "${dsa_id}"`,
            null,
            `address_line_1, address_line_2, city, state, pin_code, country, address_type_id`,
            true
        );

        let data = { dsa_id, address: dsaAddresses }
        return ResHelper.apiResponseV2(res, true, "Success", 200, data, "");
    }
    catch (e) {
        return catchHandling(e, res);
    };
};

exports.getCompanyAddressDetails = async (req, res) => {
    try {
        let dsa_id = req?.dsa?.dsa_id || req?.query?.dsa_id;
        let company_id = Boolean(req?.loggedInUser && req?.query?.company_id) ? req?.query?.company_id : null;
        // company_id = "30efd6be-b1a8-48d4-9d8f-1b35659347ca";

        if (!company_id) {
            let dsaData = await CompanyServices?.selectServiceDynamic(
                `ru_direct_selling_agents`,
                `p.dsa_id = "${dsa_id}"`,
                `left join ru_companies c on p.dsa_id = c.registered_by`,
                `p.company_id, c.pan as company_pan, p.first_name, p.last_name, p.middle_name, p.gender, p.email_address, p.role_in_company, p.date_of_birth`
            );
            company_id = dsaData?.company_id || null;
            if (!company_id) {
                return ResHelper.apiResponseV2(res, false, `Not authorized for this operation!`, 400, {}, "");
            };
        };

        let companyAddresses = await CompanyServices?.selectServiceDynamic(
            `ru_company_addresses`,
            `p.company_id = "${company_id}"`,
            null,
            `address_line_1, address_line_2, city, state, pin_code, country, address_type_id`,
            true
        );

        let data = { company_id, address: companyAddresses };
        return ResHelper.apiResponseV2(res, true, "Success", 200, data, "");
    }
    catch (e) {
        return catchHandling(e, res);
    };
};

exports.getDsaSteps = async (req, res) => {
    try {
        const { error } = await DSAValidationV2.getDsaSteps.validate(req.query);
        if (error) {
            return ResHelper.apiResponseV2(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { dsa_id } = req?.query;
            let dsa = await CompanyServices?.selectServiceDynamic(
                `ru_direct_selling_agents`,
                `p.dsa_id = "${dsa_id}"`,
                `left join ru_companies c on p.dsa_id = c.registered_by`,
                `p.*, c.company_id as registered_company_id`
            );

            business_mode = dsa?.business_mode || "individual";

            if (Boolean(business_mode == "company" && dsa?.company_id != dsa?.registered_company_id)) {
                business_mode = "individual";
            };

            let where = null;

            if (business_mode == "company") {
                where = `and s.dsa_type in ("individual", "company")`;
            } else {
                where = `and s.dsa_type = "${business_mode}"`;
            };

            let data = await CompanyServices?.selectServiceDynamic(
                `ru_user_onboarding_steps`,
                `p.dsa_id = "${dsa_id}" ${where} order by s.sort_order`,
                `left join ru_onboarding_steps s on s.step = p.step`,
                null,
                true
            );

            return ResHelper.apiResponseV2(res, true, "Success", 200, { dsa_id, steps: data }, "");
        };
    }
    catch (e) {
        return catchHandling(e, res);
    };
};

exports.getOwnedCompanyByPan = async (req, res) => {
    try {
        const { error } = await DSAValidationV2.getOwnedCompanyByPan.validate(req.query);
        if (error) {
            return ResHelper.apiResponseV2(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pan } = req?.query;
            let ownedCompany = await CompanyServices?.selectServiceDynamic(
                `ru_companies`,
                `p.pan = "${pan}"`,
                `left join ru_direct_selling_agents kyc on kyc.dsa_id = p.registered_by left join ru_direct_selling_agents registrar on kyc.partner_code = registrar.dsa_mobile_number`,
                `p.company_id, p.name as company_name, kyc.first_name as creator_first_name, kyc.last_name as creator_last_name, kyc.middle_name as creator_middle_name, p.business_type, kyc.partner_code as registrar_partner_code, CONCAT_WS(' ', registrar.first_name, registrar.middle_name, registrar.last_name) AS registrar_partner_full_name, p.registered_by as registrar_dsa_id`
            );
            if (ownedCompany?.company_id) {
                let kyc = await CompanyServices?.selectServiceDynamic(
                    `ru_company_documents`,
                    `p.doc_name = "permanent_account_number" and company_id = "${ownedCompany?.company_id}"`,
                    null,
                    null
                );
                ownedCompany["company_pan_image"] = kyc?.doc_path;
            };
            return ResHelper.apiResponseV2(res, true, "Success", 200, ownedCompany, "");
        };
    }
    catch (e) {
        return catchHandling(e, res);
    };
};

exports.getDsaPayoutDetails = async (req, res) => {
    try {
        const { error } = await DSAValidationV2.getDsaAssigningPayoutPercentage.validate(req.query);
        if (error) {
            return ResHelper.apiResponseV2(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { dsa_id } = req?.query;
            let { assigning_payout_percentage, global_payouts_percentage, is_direct_claim_enabled, is_same_day_billing_enabled, is_auto_erp } = await DSAService.getDsaById(dsa_id)
            return ResHelper.apiResponseV2(res, true, "Success", 200, { assigning_payout_percentage, is_direct_claim_enabled, global_payouts_percentage, is_same_day_billing_enabled, is_auto_erp }, "");
        }
    }
    catch (e) {
        return catchHandling(e, res);
    };
};

exports.getDsaSameDayBilling = async (req) => {
    const { dsa_id } = req.query;
    const is_same_day_billing_enabled = await DSAService.getDsaSameDayBillingEnabledById(dsa_id);
    if (is_same_day_billing_enabled === null) {
        return {
            success: false,
            message: "DSA not found",
            statusCode: 404,
            data: {},
        };
    }
    return {
        success: true,
        message: "Success",
        statusCode: 200,
        data: { is_same_day_billing_enabled },
    };
};

exports.getDsaAutonomousSettings = async (req, res) => {
    try {
        const { error } = await DSAValidationV2.getDsaAutonomousSettings.validate(req.query);
        if (error) {
            return ResHelper.apiResponseV2(res, false, _.startCase(error.message), 400, {}, "");
        }
        const [isMaster, hasVendorAutonomousPrivilege] = await Promise.all([
            isFinanceRootUser(req?.loggedInUser?.userPhone),
            hasRequestAutonomousForVendorPrivilege(req?.loggedInUser),
        ]);
        if (!isMaster && !hasVendorAutonomousPrivilege) {
            return ResHelper.apiResponseV2(res, false, "Access denied", 403, {}, "");
        }
        const { dsa_id } = req?.query;
        const data = await DSAService.getDsaAutonomousSettingsByDsaId(dsa_id);
        return ResHelper.apiResponseV2(res, true, "Success", 200, data, "");
    }
    catch (e) {
        return catchHandling(e, res);
    };
};

exports.updateGlobalPayoutPercentage = async (req, res) => {
    try {
        const { error } = await DSAValidationV2.updateGlobalPayoutPercentage.validate(req.body);
        if (error) {
            return ResHelper.apiResponseV2(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { dsa_id, global_payout_percentage } = req?.body;
            let { assigning_payout_percentage, global_payouts_percentage } = await DSAService.getDsaById(dsa_id) || 50;
            if (global_payout_percentage > Number(assigning_payout_percentage)) {
                return ResHelper.apiResponseV2(res, false, `Global Payout Percentage Can not be greater than Payout Capping`, 400, {}, "");
            }
            let globalPayoutPercentage = await DSAService.updateGlobalPayoutPercentageNew(dsa_id, global_payout_percentage)
            let difference = jsonDifference({ global_payout_percentage: global_payouts_percentage }, { global_payout_percentage });
            const userId = req?.loggedInUser?.id || req?.dsa?.dsa_id || null;
            await ApplicationLogServices.bulkCreate(difference, dsa_id, "dsa", userId);
            await DSAService.updateDsaPayoutList(dsa_id, global_payout_percentage);
            try {
                await KafkaServices.connectKafkaProducer();
                const evt = new KafkaServices.VendorSnapshotEvent('GLOBAL_PAYOUT_UPDATED', dsa_id, { global_payout_percentage }, userId);
                await KafkaServices.sendToKafkaVendorSnapshot(evt);
            } catch (kafkaErr) {
                logger.error('VendorSnapshotEvent Kafka failed in updateGlobalPayoutPercentage', kafkaErr);
            }
            return ResHelper.apiResponseV2(res, true, "Success", 200, globalPayoutPercentage, "");
        }
    }
    catch (e) {
        return catchHandling(e, res);
    };
};

exports.getBankProductMappedPayout = async (req, res) => {
    try {
        const { error } = await DSAValidationV2.getBankProductMappedPayout.validate(req.query);
        if (error) {
            return ResHelper.apiResponseV2(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { dsa_id, bank_id, product_id, payout_type = null, for_autonomous = false, is_company } = req?.query;

            let payoutDsaId = dsa_id;
            if (is_company) {
                const company = await CompanyServices.getCompanyDetailsByKey(dsa_id, "company_id");
                if (!company?.registered_by_id) {
                    return ResHelper.apiResponseV2(res, false, "Company registered partner not found", 400, {}, "");
                }
                payoutDsaId = company.registered_by_id;
            }

            let data = await DSAService.getBankProductMappedPayout(payoutDsaId, product_id, bank_id, payout_type, for_autonomous);
            return ResHelper.apiResponseV2(res, true, "Success", 200, data, "");
        }
    }
    catch (e) {
        return catchHandling(e, res);
    };
}


exports.getDsaPayoutList = async (req, res) => {
    try {
        const { error } = await DSAValidationV2.getDsaPayoutList.validate(req.body);
        if (error) {
            return ResHelper.apiResponseV2(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { dsa_id, pageNumber, pageSize, filterModel, sortBy, sortDirection, logicOperator, bank_name_filter, main_product_filter, sub_product_filter, login_code_filter, search, show_all = false, bank_product_combinations_id } = req?.body;
            if (!pageNumber) {
                pageNumber = 0;
            };
            if (!pageSize) {
                pageSize = 10;
            };

            let whereFilterQuery = []
            const operatorHandlers = CustomOperatorHandlers()
            if (filterModel) {
                whereFilterQuery = CreateWhereQueryFilter(filterModel, getDsaPayoutListFieldMapping, operatorHandlers)
            }


            let orderBy = '';
            if (sortBy) {
                const sortField = getDsaPayoutListFieldMapping(sortBy);
                orderBy = `${sortField} ${sortDirection || 'asc'}`;
            };

            // Create external where query for filters
            let externalWhereQuery = '';

            if (bank_name_filter) {
                externalWhereQuery += ` and nb.bank_name LIKE '%${bank_name_filter}%' `;
            }

            if (main_product_filter) {
                externalWhereQuery += ` and np.main_product LIKE '%${main_product_filter}%' `;
            }

            if (sub_product_filter) {
                externalWhereQuery += ` and np.product_name LIKE '%${sub_product_filter}%' `;
            }

            if (login_code_filter) {
                externalWhereQuery += ` and d.login_code LIKE '%${login_code_filter}%' `;
            }

            if (search) {
                externalWhereQuery += ` and (nb.bank_name LIKE '%${search}%' or np.product_name LIKE '%${search}%' or np.main_product LIKE '%${search}%') `;
            }

            const isSameDayBillingEnabled = Boolean(await DSAService.getDsaSameDayBillingEnabledById(dsa_id));
            let data = await DSAService.getDsaPayoutList(dsa_id, orderBy, whereFilterQuery, logicOperator, pageNumber * pageSize,
                pageSize, externalWhereQuery, show_all, bank_product_combinations_id, isSameDayBillingEnabled);
            return ResHelper.apiResponseV2(res, true, "Success", 200, data, "");
        }
    }
    catch (e) {
        return catchHandling(e, res);
    };
};


const BANK_ACCOUNT_SELECT_COLUMNS = [
    "p.id",
    "p.dsa_id",
    "p.company_id",
    "p.account_number",
    "p.account_type",
    "p.bank_name",
    "p.ifsc",
    "p.account_holder_name",
    "p.dsa_mobile_number",
    "p.bank_account_id",
    "p.digio_pennydrop_id",
    "p.digio_pennydrop_verified_at",
    "p.digio_pennydrop_beneficiary_name_with_bank",
    "p.digio_pennydrop_fuzzy_match_result",
    "p.digio_pennydrop_fuzzy_match_score",
    "p.platform",
    "p.created_at",
    "p.updated_at",
    "p.account_added_at_date_iso",
    'case when p.user_type is null then "Channel Partner" else p.user_type end as user_type',
    "p.tag as bank_type",
    "p.status",
    "p.tag",
    "p.remarks",
    `${SQL_BANK_ACCOUNT_CHEQUE_IMAGE("p")} as cheque_image`,
    `${SQL_BANK_ACCOUNT_PASSBOOK_IMAGE("p")} as passbook_image`,
].join(", ");

let getBankDetails = async (dsa_id, company_id) => {
    let condition = company_id ? `p.company_id = "${company_id}"` : `p.dsa_id = "${dsa_id}"`;
    let data = await CompanyServices?.selectServiceDynamic(
        `ru_dsa_bank_accounts`,
        condition,
        null,
        BANK_ACCOUNT_SELECT_COLUMNS,
        true
    );
    return data;
};

const resolveChequeFileForMs = async (chequeImageUrl, req) => {
    const uploaded = req?.files?.cheque_image;
    if (uploaded?.data) {
        return {
            buffer: uploaded.data,
            filename: uploaded.name || "cheque_image.jpg",
            contentType: uploaded.mimetype || mime.lookup(uploaded.name) || "image/jpeg",
        };
    }
    if (!chequeImageUrl) {
        return null;
    }

    const fileResponse = await axios.get(chequeImageUrl, {
        responseType: "arraybuffer",
        validateStatus: () => true,
        timeout: 30000,
    });
    if (fileResponse.status !== 200 || !fileResponse.data?.byteLength) {
        return null;
    }

    const pathname = new URL(chequeImageUrl).pathname;
    const filename = pathname.split("/").pop() || "cheque_image.jpg";
    return {
        buffer: Buffer.from(fileResponse.data),
        filename,
        contentType: mime.lookup(filename) || "image/jpeg",
    };
};

const appendMsBankFormFields = (form, fields) => {
    Object.entries(fields).forEach(([key, value]) => {
        if (value != null && value !== "") {
            form.append(key, String(value));
        }
    });
};

exports.getBankDetailDsa = async (req, res) => {
    try {
        let dsa_id = req?.dsa?.dsa_id || req?.query?.dsa_id;
        let company_id = req?.query?.company_id || null;
        // let dsa_id = "47663353";
        let details = await getBankDetails(dsa_id, company_id);
        ResHelper.apiResponse(res, true, "Success", 200, details, "");

    } catch (err) {
        catchHandling(err, res);
    }
};

exports.AddBankDetailDsa = async (req, res) => {
    const logPrefix = "[add-bank-details]";
    try {
        logger.info(`${logPrefix} request received`, {
            dsa_id: req?.body?.dsa_id,
            user_type: req?.body?.user_type,
            logged_in_user: req?.loggedInUser?.userEmail || req?.loggedInUser?.id,
            has_cheque_image: Boolean(req?.body?.cheque_image),
        });

        const { error } = DSAValidationV2.AddBankDetailDsa.validate(req.body);
        if (error) {
            logger.warn(`${logPrefix} validation failed`, { message: error.message, details: error.details });
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const reqData = req?.body;
        let dsa_id = req?.dsa?.dsa_id || reqData?.dsa_id;
        let { accountNumber, bankName, accountType, ifsc, accountHolderName, user_type, cheque_image } = reqData;
        let log_data = { log_type: "dsa_bank_details", application_id: dsa_id, created_by: req?.loggedInUser?.id || dsa_id };

        // AddBankDetailDsa always creates a new bank account row (multiple accounts per
        // user_type are allowed), so there is no meaningful "previous" record to diff against.
        const old_data = {};
        const new_data = { account_number: accountNumber, bank_name: bankName, account_type: accountType, ifsc, account_holder_name: accountHolderName, user_type };
        let company_id = null;

        const dsaProfile = await CompanyServices?.selectServiceDynamic(
            `ru_direct_selling_agents`,
            `p.dsa_id = "${dsa_id}"`,
            null,
            `p.dsa_mobile_number`
        );
        const dsaMobileNumber = reqData?.dsaMobileNumber || dsaProfile?.dsa_mobile_number || "";

        if (user_type == "Company") {
            if (req?.loggedInUser && (req?.loggedInUser?.dsa_id == dsa_id)) {
                logger.warn(`${logPrefix} unauthorized company bank update`, { dsa_id, logged_in_dsa_id: req?.loggedInUser?.dsa_id });
                return ResHelper.apiResponseV2(res, false, "Not authorized for this operation!", 403, {}, "");
            }

            let company = await CompanyServices?.selectServiceDynamic(
                `ru_companies`,
                `p.registered_by = "${dsa_id}"`,
                null,
                null,
            );

            company_id = company?.company_id || null;
            log_data = { log_type: "company_bank_details", application_id: company?.company_id, created_by: req?.loggedInUser?.id || dsa_id };
        }

        const kycStatus = await CompanyServices?.selectServiceDynamic(
            `ru_dsa_kyc_data`,
            `p.dsa_id = "${dsa_id}"`,
            null,
            `COALESCE(p.is_permanent_account_number_verified, 0) as is_permanent_account_number_verified`
        );
        const isAuthbridgePanVerified = Number(kycStatus?.is_permanent_account_number_verified || 0) === 1;
        const chequeImage = cheque_image != null ? String(cheque_image).trim() : "";

        logger.info(`${logPrefix} pre-checks`, {
            dsa_id,
            user_type,
            is_authbridge_pan_verified: isAuthbridgePanVerified,
            has_cheque_image: Boolean(chequeImage),
        });

        const hasUploadedChequeFile = Boolean(req?.files?.cheque_image?.data);
        if (!isAuthbridgePanVerified && !chequeImage && !hasUploadedChequeFile) {
            logger.warn(`${logPrefix} blocked: cheque image required`, { dsa_id, user_type });
            return ResHelper.apiResponseV2(res, false, "Cheque image is required when PAN is not AuthBridge verified", 400, {}, "");
        }

        const request_url = `${process.env.MS_URL}/api/v3/dsa/bank-account/add`;
        const msHeaders = {
            "api-key": process.env.AUTH_KEY_RULOANS_BANK_CLAIM,
            "app-version-code": 32,
            "device-type": 4,
            platform: "crm",
        };
        const msFieldPayload = {
            dsa_id,
            dsa_mobile_number: dsaMobileNumber,
            dsaMobileNumber,
            account_number: accountNumber,
            bank_name: bankName,
            account_type: accountType,
            ifsc,
            account_holder_name: accountHolderName,
            user_type,
            accountNumber,
            bankName,
            accountType,
            accountHolderName,
            ...(company_id ? { company_id } : {}),
        };

        let response;
        const chequeFile = (chequeImage || hasUploadedChequeFile)
            ? await resolveChequeFileForMs(chequeImage, req)
            : null;

        if ((chequeImage || hasUploadedChequeFile) && !chequeFile) {
            logger.warn(`${logPrefix} failed to resolve cheque image`, { dsa_id, cheque_image: chequeImage });
            return ResHelper.apiResponseV2(res, false, "Invalid or unreachable cheque image", 400, {}, "");
        }

        if (chequeFile) {
            const form = new FormData();
            appendMsBankFormFields(form, msFieldPayload);
            form.append("cheque_image", chequeFile.buffer, {
                filename: chequeFile.filename,
                contentType: chequeFile.contentType,
            });

            logger.info(`${logPrefix} calling MS (multipart)`, {
                url: request_url,
                dsa_id,
                user_type,
                cheque_filename: chequeFile.filename,
            });

            response = await axios({
                method: "POST",
                url: request_url,
                data: form,
                headers: { ...msHeaders, ...form.getHeaders() },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                validateStatus: () => true,
            });
        } else {
            const msPayload = { ...new_data, ...msFieldPayload };

            logger.info(`${logPrefix} calling MS`, {
                url: request_url,
                dsa_id,
                user_type,
                payload_keys: Object.keys(msPayload),
            });

            response = await axios({
                method: "POST",
                url: request_url,
                data: msPayload,
                headers: { ...msHeaders, "Content-Type": "application/json" },
                validateStatus: () => true,
            });
        }

        logger.info(`${logPrefix} MS response`, {
            http_status: response?.status,
            ms_status: response?.data?.status,
            ms_message: response?.data?.message,
            ms_data: response?.data?.data,
            raw_body: typeof response?.data === "string" ? response.data : undefined,
        });

        const { status, message } = response?.data || {};
        if (Boolean(status)) {
            try {
                await createActivityLogKafka({ ...log_data, old_data, new_data });
            } catch (e) {
                // Kafka logging should never block the API response
                logger.error(`${logPrefix} kafka activity log failed`, { message: e?.message, stack: e?.stack, log_data });
            }
            return ResHelper.apiResponse(res, true, message, 200, response?.data, "");
        }

        logger.error(`${logPrefix} MS rejected request`, {
            dsa_id,
            http_status: response?.status,
            ms_response: response?.data,
        });
        return ResHelper.apiResponse(res, false, message || "Failed to add bank details", 400, response?.data || {}, "");
    } catch (err) {
        logger.error(`${logPrefix} unhandled error`, {
            message: err?.message,
            stack: err?.stack,
            response_status: err?.response?.status,
            response_data: err?.response?.data,
        });
        return catchHandling(err, res);
    }
};

exports.updateBankAccountType = async (req, res) => {
    try {
        const { error } = DSAValidationV2.updateBankAccountType.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const { id, bank_type } = req.body;

        let existingAccount = null;
        try {
            existingAccount = await CompanyServices?.selectServiceDynamic(
                `ru_dsa_bank_accounts`,
                `p.id = "${id}"`,
                null,
                `p.id, p.dsa_id, p.company_id, p.tag, p.account_number`
            );
        } catch (e) {
            // best-effort lookup for the Kafka log's old_data, should never block the type update
        }
        // A company-owned account row still carries the representative's own dsa_id, so check
        // company_id first — otherwise the log gets filed under the wrong entity and never shows
        // up on the company's own activity log (matches the log_type check just below).
        const isCompanyAccount = Boolean(existingAccount?.company_id);

        const request_url = `${process.env.MS_URL}/api/v3/dsa/bank-account/update-type`;

        const options = {
            method: "POST",
            url: request_url,
            data: { id, bank_type },
            headers: {
                "api-key": process.env.AUTH_KEY_RULOANS_BANK_CLAIM,
                "app-version-code": 32,
                "device-type": 4,
                "Content-Type": "application/json",
                platform: "crm",
            },
            validateStatus: () => true,
        };

        const response = await axios(options);
        const { status, message } = response?.data || {};
        if (Boolean(status)) {
            try {
                // createActivityLogKafka only logs fields whose old/new value actually differ
                // (jsonDifferenceForNestedObjects) — a bare, unchanged account_number key would be
                // silently dropped. Fold it into the same value that does change so it survives
                // the diff and identifies which account this was, when an entity has more than one.
                const acctSuffix = existingAccount?.account_number ? ` (A/C ${existingAccount.account_number})` : '';
                await createActivityLogKafka({
                    log_type: isCompanyAccount ? "company_bank_details_type" : "dsa_bank_details_type",
                    application_id: (isCompanyAccount ? existingAccount?.company_id : existingAccount?.dsa_id) || id,
                    created_by: req?.loggedInUser?.id,
                    old_data: { bank_type: `${existingAccount?.tag ?? ''}${acctSuffix}` },
                    new_data: { bank_type: `${bank_type}${acctSuffix}` }
                });
            } catch (e) {
                // Kafka logging should never block the API response
            }
            return ResHelper.apiResponseV2(res, true, message || "Success", 200, response?.data, "");
        }
        // Diagnostic: this branch is why company-owned accounts' type-change silently never
        // shows up in the activity log — the Kafka log only fires above, gated on this same
        // `status` being truthy. Logging what the downstream MS actually says so the real
        // rejection reason is visible instead of a generic "failed" toast on the FE.
        logger.error('[update-bank-account-type] downstream MS rejected the update', {
            id, bank_type, isCompanyAccount,
            company_id: existingAccount?.company_id, dsa_id: existingAccount?.dsa_id,
            ms_status_code: response?.status, ms_response_data: response?.data,
        });
        return ResHelper.apiResponseV2(res, false, message || "Failed to update bank type", 400, {}, "");
    } catch (e) {
        return catchHandling(e, res);
    }
};

exports.getPendingBankVerificationList = async (req, res) => {
    try {
        const { error } = DSAValidationV2.getPendingBankVerificationList.validate(req.body);
        if (error) {
            return ResHelper.apiResponseV2(res, false, _.startCase(error.message), 400, {}, "");
        }

        let { pageNumber = 0, pageSize = 10, filterModel, sortModel } = req.body;
        pageNumber = Number(pageNumber) || 0;
        pageSize = Number(pageSize) || 10;

        let whereFilterQuery = [];
        let logicOperator = "and";
        if (filterModel?.items?.length) {
            logicOperator = String(filterModel.logicOperator || "and").toLowerCase() === "or" ? "or" : "and";
            whereFilterQuery = CreateWhereQueryFilter(
                filterModel,
                getPendingBankVerificationFieldMapping,
                CustomOperatorHandlers()
            );
        }

        let orderBy = " ORDER BY ba.id DESC ";
        if (Array.isArray(sortModel) && sortModel.length > 0) {
            const { field, sort } = sortModel[0] || {};
            const mapped = getPendingBankVerificationFieldMapping(field);
            if (mapped && sort && ["asc", "desc"].includes(String(sort).toLowerCase())) {
                orderBy = ` ORDER BY ${mapped} ${String(sort).toUpperCase()} `;
            }
        }

        const data = await DSAService.getPendingBankVerificationList(
            orderBy,
            whereFilterQuery,
            logicOperator,
            pageNumber * pageSize,
            pageSize
        );
        return ResHelper.apiResponseV2(res, true, "Success", 200, data, "");
    } catch (e) {
        return catchHandling(e, res);
    }
};

exports.updateBankAccountStatus = async (req, res) => {
    try {
        const { error } = DSAValidationV2.updateBankAccountStatus.validate(req.body);
        if (error) {
            return ResHelper.apiResponseV2(res, false, _.startCase(error.message), 400, {}, "");
        }

        const { id, status } = req.body;

        let existingAccount = null;
        try {
            existingAccount = await CompanyServices?.selectServiceDynamic(
                `ru_dsa_bank_accounts`,
                `p.id = "${id}"`,
                null,
                `p.id, p.dsa_id, p.company_id, p.status, p.account_number`
            );
        } catch (e) {
            // best-effort lookup for the Kafka log's old_data, should never block the status update
        }
        // Same fix as updateBankAccountType: a company-owned account row still carries the
        // representative's own dsa_id, so company_id must be checked first for BOTH log_type
        // and application_id — otherwise the log gets filed under the wrong entity and never
        // shows up on the company's own activity log even though it's created successfully.
        const isCompanyAccount = Boolean(existingAccount?.company_id);

        const request_url = `${process.env.MS_URL}/api/v3/dsa/bank-account/update-status`;

        const options = {
            method: "POST",
            url: request_url,
            data: { id, status },
            headers: {
                "api-key": process.env.AUTH_KEY_RULOANS_BANK_CLAIM,
                "app-version-code": 32,
                "device-type": 4,
                "Content-Type": "application/json",
                platform: "crm",
            },
            validateStatus: () => true,
        };

        const response = await axios(options);
        const { status: ok, message } = response?.data || {};
        if (Boolean(ok)) {
            try {
                // account_number folded into the same value that changes (status), same reasoning
                // as updateBankAccountType — createActivityLogKafka drops any key whose old/new
                // value is identical, so a bare unchanged account_number key would never survive.
                const acctSuffix = existingAccount?.account_number ? ` (A/C ${existingAccount.account_number})` : '';
                await createActivityLogKafka({
                    log_type: isCompanyAccount ? "company_bank_details_status" : "dsa_bank_details_status",
                    application_id: (isCompanyAccount ? existingAccount?.company_id : existingAccount?.dsa_id) || id,
                    created_by: req?.loggedInUser?.id,
                    old_data: { status: `${existingAccount?.status ?? ''}${acctSuffix}` },
                    new_data: { status: `${status}${acctSuffix}` }
                });
            } catch (e) {
                // Kafka logging should never block the API response
            }
            return ResHelper.apiResponseV2(res, true, message || "Success", 200, response?.data, "");
        }
        return ResHelper.apiResponseV2(res, false, message || "Failed to update bank account status", 400, {}, "");
    } catch (e) {
        return catchHandling(e, res);
    }
};

exports.getDsaEligiblePayoutDetails = async (req, res) => {
    try {
        const { error } = await DSAValidationV2.getDsaEligiblePayoutDetails.validate(req.query);
        if (error) {
            return ResHelper.apiResponseV2(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let dsa_id = req?.dsa?.dsa_id
            let { loan_type } = req?.query
            let data = await DSAService.getDsaEligiblePayoutDetails(dsa_id, loan_type);
            return ResHelper.apiResponseV2(res, true, "Success", 200, data, "");
        }
    }
    catch (e) {
        return catchHandling(e, res);
    }
}

exports.instantClaimApplications = async (req, res) => {
    try {
        const { error } = await DSAValidationV2.instantClaimApplications.validate(req.body)
        if (error) {
            return ResHelper.apiResponseV2(res, false, _.startCase(error.message), 400, {}, "");
        }
        else {

            const { is_direct_claim_enabled } = req.dsa;
            if (!is_direct_claim_enabled) {
                return ResHelper.apiResponse(res, false, "You do not have permission to instant claims. Please contact your BH for assistance.", 403, {}, "");
            }

            let dsa_id = req?.dsa?.dsa_id
            const dsa_mobile_number = req.dsa.dsa_mobile_number;
            const netsuite_vendor_id = req.dsa.netsuite_vendor_id;
            let { loan_type, application_ids } = req.body;

            for (const application_id of application_ids) {
                await KafkaServices.sendToInstantClaimKafka({ loan_type, application_id, dsa_id, dsa_mobile_number, netsuite_vendor_id, platform: "web_application" });
            }
            return ResHelper.apiResponseV2(res, true, "Claims are being processed", 200, {}, "");
        }
    }
    catch (e) {
        return catchHandling(e, res);
    }
}

exports.instantClaimAllEligibleApplication = async (req, res) => {
    try {
        const { error } = await DSAValidationV2.instantClaimAllEligibleApplication.validate(req.body)
        if (error) {
            return ResHelper.apiResponseV2(res, false, _.startCase(error.message), 400, {}, "");
        }
        else {

            const { is_direct_claim_enabled, dsa_id, dsa_mobile_number, netsuite_vendor_id } = req.dsa;
            if (!is_direct_claim_enabled) {
                return ResHelper.apiResponse(res, false, "You do not have permission to instant claims. Please contact your BH for assistance.", 403, {}, "");
            }
            const { loan_type } = req.body
            const data = await DSAService.instantClaimAllEligibleApplication(dsa_id, loan_type)
            if (!data.length) {
                return ResHelper.apiResponseV2(res, true, "No Claims to Process", 400, {}, "");
            }
            for (let d of data) {
                let { application_id } = d
                await KafkaServices.sendToInstantClaimKafka({ loan_type, application_id, dsa_id, dsa_mobile_number, netsuite_vendor_id, platform: "web_application" });
            }
            return ResHelper.apiResponseV2(res, true, "All Claims are being processed", 200, {}, "");
        }
    }
    catch (e) {
        return catchHandling(e, res);
    }
}

exports.setLeadPayoutRateOrRatio = async (req, res) => {
    try {
        const { error } = DSAValidationV2.setLeadPayoutRateOrRatio.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        else {
            const { id, payout_type, vendor_payout_rate, vendor_payout_ratio, is_exception } = req.body
            const lead = await DSAService.getLeadCLaimById(id)
            let { dsa_id, netsuite_bank_id, netsuite_product_id, disbursement_amount, user_type, registered_by } = lead;
            const bankFile = await resolveMatchedBankFileForLead(lead);
            if (user_type == "company" && !registered_by) {
                return ResHelper.apiResponseV2(res, false, "Company dsa not found", 400, {}, "");
            } else if (user_type == "company" && registered_by) {
                dsa_id = registered_by
            }
            if (user_type !== "company" && !dsa_id) {
                FinanceServices.updateFreshLeadDsaId(lead)
            }
            let { payout_collide, avg_achievment, vendor_payout_rate: max_expected_rate, vendor_payout_ratio: max_expected_ratio } = await DSAService.validateVendorPayoutNew(dsa_id, netsuite_bank_id, netsuite_product_id, payout_type, vendor_payout_rate, vendor_payout_ratio, null, false, 0, bankFile?.subvention_percentage ?? null, bankFile?.disbursement_amount ?? null, toIsoDateIST(lead.disbursement_date))
            //let payout_collide_value = payout_type?.toLowerCase() == "rate" ? vendor_payout_rate : vendor_payout_ratio;
            let payout_collide_value = max_expected_rate
            if (payout_collide && !is_exception) {
                if (payout_type?.toLowerCase() == "ratio") {
                    return ResHelper.apiResponseV2(res, false, `Ratio limit exceeded${max_expected_ratio ? `, Max Ratio limit is ${max_expected_ratio}` : ""}${formatSubventionPayoutLimitSuffix(bankFile?.subvention_percentage)}`, 400, {}, "");
                }
                if (payout_type?.toLowerCase() == "rate") {
                    // avg_achievment is strictly null only when the bank/product combo is known
                    // but no ru_bank_product_combination_details row covers this lead's
                    // disbursement date (a gap between synced periods) - distinct from the combo
                    // having no payout data configured at all, where it defaults to 0 instead.
                    // Same distinction as erpValidators.js's LeadRateRatioCollideValidator.
                    if (avg_achievment === null) return ResHelper.apiResponseV2(res, false, `Customer slab master is not configured for this disbursement date`, 400, {}, "");
                    if (!avg_achievment) return ResHelper.apiResponseV2(res, false, `Payout Rate is not set for this Product`, 400, {}, "");
                    return ResHelper.apiResponseV2(res, false, `Rate limit exceeded${max_expected_rate ? `, Max Rate limit is ${max_expected_rate}` : ""}${formatSubventionPayoutLimitSuffix(bankFile?.subvention_percentage)}`, 400, {}, "");
                }
            }
            await DSAService.setLeadPayoutRateOrRatio(id, payout_type, vendor_payout_rate, vendor_payout_ratio, payout_collide, payout_collide_value, disbursement_amount, avg_achievment)
            if (!is_exception) {
                let bankProductDetails = await BankService.getBankProductCombinationByNetsuiteIds(netsuite_bank_id, netsuite_product_id)
                if (bankProductDetails?.bank_product_combinations_id) {
                    const dsaBankProductPayoutDetails = await DSAService.getDsaBankProductPayoutDetils(dsa_id, bankProductDetails.bank_product_combinations_id)
                    if (!dsaBankProductPayoutDetails?.payout_lock) {
                        await DSAService.updateDsaMasterPayout(bankProductDetails.bank_product_combinations_id, dsa_id, vendor_payout_rate, vendor_payout_ratio, 0, payout_type?.toLowerCase())
                    }
                }
            }

            const difference = jsonDifference(lead, req?.body)
            const userId = req?.loggedInUser?.id || null;
            await ApplicationLogServices.bulkCreate(difference, lead?.id, "lead_claim_update", userId);
            return ResHelper.apiResponseV2(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        return catchHandling(e, res);
    }
}

exports.sendSetPayoutReminderEmail = async (req, res) => {
    try {
        const { error } = DSAValidationV2.sendSetPayoutReminderEmail.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        let { loan_type, application_id } = req?.body
        let { dsa_mobile_number, is_direct_claim_enabled, dsa_id, full_name, assigning_payout_percentage } = req?.dsa
        let is_product_payout_set = true
        let is_payout_set = Boolean(Number(assigning_payout_percentage))
        let product_vendor = null

        if (application_id && loan_type) {
            let where = [[
                'pl.application_id',
                ` like '%${application_id}%' `,
                null
            ]]
            const data = await DSAService.getApplicationsByProductAndLoanType(loan_type, false, where, 0, 1, null, dsa_mobile_number, false)
            if (data.lntApplications && data.lntApplications.length) {
                is_product_payout_set = data.lntApplications[0]?.is_payout_set
                product_vendor = data.lntApplications[0]?.product_vendor
                product_vendor = product_vendor?.replace(/_/g, ' ')?.replace(/\b\w/g, l => l.toUpperCase())
            }
        }

        if (is_product_payout_set && is_payout_set && is_direct_claim_enabled) {
            return ResHelper.apiResponseV2(res, false, "Your Payout is already set", 400, {}, "");
        }

        let partner = await DSAService.getDsaBhDetailsById(dsa_id)

        if (!partner || !partner?.email_address) {
            return ResHelper.apiResponseV2(res, false, "Partner Email Address not found", 400, {}, "");
        }
        const emailNotification = new KafkaServices.EmailSendEmailPayout(
            uuid().replace(/-/g, ''),
            partner?.email_address, //reciever email address
            "Request to Configure Payout Settings", //email subject
            null, //text in email body
            SetPayoutRequestEmailTemplate({ is_payout_set, is_direct_claim_enabled, is_product_payout_set, full_name, dsa_id, product_vendor, crmUrl: process.env.CRM_URL }, partner),  //html body for email
            partner.id,
            "SYSTEM", //created by
            "EmailSendEmail"
        )


        await KafkaServices.connectKafkaProducer()
        await KafkaServices.sendToKafkaEngine(emailNotification)

        return ResHelper.apiResponseV2(res, true, "email sent successfully To your Partner", 200, {}, "");
    }
    catch (e) {
        return catchHandling(e, res);
    }
}

exports.getLedgerDetails = async (req, res) => {
    try {
        const { error } = DSAValidationV2.getLedgerDetails.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        const { i_vendor_id, Claim_month, Page_index } = req.body
        const payload = {
            i_vendor_id, Claim_month: Claim_month || "", Page_index
        }
        const data = await callNsApi({
            "api": "customscript_rul_send_vcf_data_paginatio",
            payload
        });

        if (!data || data.Code === 400) {
            return ResHelper.apiResponseV2(res, false, "No Data found", 400, {}, "");
        }

        return ResHelper.apiResponseV2(res, true, "Success", 200, data, "");
    }
    catch (e) {
        return catchHandling(e, res);
    }
}

exports.getLedger = async (req, res, next) => {
    try {
        const { error } = DSAValidationV2.getLedger.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { dsa_mobile_number, cc_emails, claim_month, is_company = false, company_id = null } = req.body;
            // we need to remove certain columns from the response if the call is external
            if (!req?.loggedInUser?.id) {
                dsa_mobile_number = req?.dsa?.dsa_mobile_number;
                // Convert claim_month from mm-yyyy format to Oct 2025 format
                if (claim_month) {
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const [month, year] = claim_month.split('-');
                    const monthIndex = parseInt(month) - 1; // Convert to 0-based index
                    if (monthIndex >= 0 && monthIndex < 12) {
                        claim_month = `${monthNames[monthIndex]} ${year}`;
                    }
                }
            }
            else if (!dsa_mobile_number) {
                return ResHelper.apiResponse(res, false, "DSA mobile number is mandatory", 400, {}, "");
            }
            let result = {};
            if (is_company) {
                result = await CompanyServices.getCompanyDetailsByKey(company_id, 'company_id');
            } else {
                result = await DSAService.getDsaFullDetailsPhone(dsa_mobile_number);
            }
            let internalId = result?.netsuite_vendor_id;
            if (!internalId) {
                return ResHelper.apiResponse(res, false, "Vendor Id Not Found For NetSuite", 400, {}, "");
            }
            const ccEmailArray = cc_emails ? cc_emails.split(',').map(email => email.trim()).filter(Boolean) : [];
            const user = {
                id: req.loggedInUser?.id || req.dsa?.dsa_id,
                userEmail: req.loggedInUser?.userEmail || req.dsa?.email_address,
                role: req.loggedInUser?.role || req.dsa?.role
            }
            const is_crm_request = Boolean(req?.loggedInUser?.id);
            getLedgerDataOnEmailNew.add({ netsuite_vendor_id: internalId, user, cc_emails: ccEmailArray, claim_month, is_crm_request, vendor_name: result?.full_name });
            ResHelper.apiResponse(res, true, "Report Will Be Send On Mail Shortly", 200, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

exports.saveDsaPayoutDeal = async (req, res) => {
    try {
        const { error } = DSAValidationV2.saveDsaPayoutDeal.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        else {

            const dsa_id = req?.loggedInUser?.id || req?.dsa?.dsa_id
            let loggedIn_user_full_name = req?.loggedInUser?.userName || req?.dsa?.dsa_full_name
            const platform = req?.loggedInUser?.id ? "crm_id" : "dsa_id"

            const { deal, payout_capping, referral_dsa_id, utm_main_source, bank_ids, product_ids, select_all_banks, select_all_products } = req.body

            if (payout_capping < 1) {
                return ResHelper.apiResponseV2(res, false, `Can't set payout capping less than 1%`, 400, {}, "");
            }

            const dsa = await DSAService.getDsaById(dsa_id);
            const prev_data = await DSAService.getDsaById(referral_dsa_id);

            //TODO :if utm_main_source is not crm then check if the referrer is dsa partner or not
            /* if(utm_main_source?.toLowerCase() !== "crm"){
                if(prev_data?.partner_code !== dsa?.customer_mobile_number){
                    return ResHelper.apiResponseV2(res, false, `Permission denied`, 400, {}, "");
                }
            } */

            const max_payout = Number(dsa?.assigning_payout_percentage) || 50

            if (payout_capping > max_payout) {
                return ResHelper.apiResponseV2(res, false, `Can't set payout capping greater than partner's payout : ${max_payout}%`, 400, {}, "");
            }

            await DSAService.saveDsaPayoutDeal(referral_dsa_id, deal, payout_capping)

            let prev_details = {
                deal: prev_data?.vendor_deal_description || '',
            }
            let new_details = {
                deal: deal || '',
            }

            if (payout_capping) {
                //if dsa payouts are already there then update 
                await DSAService.updateDsaPayoutList(referral_dsa_id, payout_capping)

                //save payout logs in DB
                /* let prev_capping = Number(prev_data?.assigning_payout_percentage) || null
                let prev_global_payout = Number(prev_data?.global_payouts_percentage) || null
                const difference = jsonDifference({ assigning_payout_percentage: prev_capping, global_payouts_percentage: prev_global_payout }, { assigning_payout_percentage: payout_capping, global_payouts_percentage: payout_capping })
                await ApplicationLogServices.bulkCreate(difference, referral_dsa_id, "dsa", dsa_id); */
                await DSAService.insertDsaMultiplePayout(referral_dsa_id, bank_ids, product_ids, select_all_banks, select_all_products, payout_capping)

                prev_details = {
                    ...prev_details,
                    payout_capping: prev_data?.assigning_payout_percentage || '',
                }
                new_details = {
                    ...new_details,
                    payout_capping: payout_capping,
                }
            }

            let difference = jsonDifference(prev_details, new_details);
            if (Array.isArray(difference) && difference.length) {
                createActivityLogKafka({
                    old_data: prev_details,
                    new_data: new_details,
                    log_type: 'vendor_deal_description',
                    application_id: referral_dsa_id,
                    created_by: `${loggedIn_user_full_name} || ${platform} : ${dsa_id}`
                });
            }

            return ResHelper.apiResponseV2(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        return catchHandling(e, res);
    }
}

exports.getDsaDealDescription = async (req, res) => {
    try {
        const { error } = DSAValidationV2.getDsaDealDescription.validate(req.query);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        const { dsa_id } = req.query
        const { dsa_id: loggedInDsaId } = req?.dsa || {}
        let max_payout = 50
        let bank_data = []
        let product_data = []
        let select_all_banks = false
        let select_all_products = false
        if (loggedInDsaId) {
            const { assigning_payout_percentage } = await DSAService.getDsaById(loggedInDsaId)
            max_payout = assigning_payout_percentage || 50
            const data = await DSAService.getDsaPayoutBankAndProduct(dsa_id)
            bank_data = data?.bank_data || []
            product_data = data?.product_data || []
            select_all_banks = data?.select_all_banks || false
            select_all_products = data?.select_all_products || false
        }
        const data = await DSAService.getDsaById(dsa_id)
        const { vendor_deal_description, assigning_payout_percentage } = data
        const result = {
            vendor_deal_description,
            assigning_payout_percentage,
            bank_data,
            product_data,
            select_all_banks,
            select_all_products,
            max_payout,
            min_payout: 1
        }
        return ResHelper.apiResponseV2(res, true, "Success", 200, result, "");
    }
    catch (e) {
        return catchHandling(e, res);
    }
}

exports.changeCompanyOwner = async (req, res) => {
    try {
        const { company_id, new_dsa_id } = req.body;

        // Validation
        const validationError = validateFields(req.body, ['company_id', 'new_dsa_id']);
        if (validationError) {
            return ResHelper.apiResponseV2(res, false, validationError, 400, {}, "");
        }

        const result = await DSAService.changeCompanyOwner(company_id, new_dsa_id);

        if (!result.success) {
            const statusCode = result.statusCode || 500;
            return ResHelper.apiResponseV2(res, false, result.message, statusCode, {}, "");
        }

        // Create activity log in Kafka
        createActivityLogKafka({
            old_data: {
                company_id: company_id,
                owner_id: result.data.previous_owner.dsa_id,
                owner_name: result.data.previous_owner.name
            },
            new_data: {
                company_id: company_id,
                owner_id: result.data.new_owner.dsa_id,
                owner_name: result.data.new_owner.name
            },
            log_type: 'company_owner_changed',
            application_id: company_id,
            created_by: `${req?.loggedInUser?.userName || req?.dsa?.dsa_full_name} || ${req?.loggedInUser?.id ? 'crm_id' : 'dsa_id'} : ${req?.loggedInUser?.id || req?.dsa?.dsa_id}`
        });

        return ResHelper.apiResponseV2(res, true, result.message, 200, result.data, "");

    } catch (error) {
        return catchHandling(error, res);
    }
};

exports.verifyPanViaAuthBridgeSingleUser = async (req, res) => {
    try {
        const dsa_id = req?.params?.dsa_id || req?.body?.dsa_id;
        const force_retry = Boolean(req?.body?.force_retry);
        if (!dsa_id) {
            return ResHelper.apiResponseV2(res, false, "dsa_id is required", 400, {}, "");
        }

        const result = await DSAService.verifyPanViaAuthBridgeByDsaIdV2(dsa_id, force_retry);
        const ok = Number(result?.status) === 1 || result?.status === true;
        const statusCode = result?.code || (ok ? 200 : 400);

        return ResHelper.apiResponseV2(
            res,
            ok,
            result?.message || "PAN verification completed",
            statusCode,
            result?.data || result || {},
            ""
        );
    } catch (e) {
        return catchHandling(e, res);
    }
};

exports.bulkAuthbridgeVerificationStream = async (req, res) => {
    const sse = setupSSE(res, { enableHeartbeat: false });
    const sendPanEvent = (payload) => sse.sendMessage('pan', payload);
    const batchId = uuid();
    let inputS3Url = null;
    const resultsRows = [];

    const appendAuthbridgeResultRow = (pan, status, remark, detailsPayload) => {
        let details = '';
        if (detailsPayload != null && typeof detailsPayload === 'object') {
            try {
                details = JSON.stringify(detailsPayload);
            } catch (_) {
                details = '';
            }
        }
        resultsRows.push({
            'Pan Numbers': pan,
            Status: status,
            Remark: remark || '',
            Details: details
        });
    };

    /**
     * Persists one row in application_logs (from_value = input S3, to_value = results S3).
     * Reads: POST /v1/application-log/getApplicationLogs — body e.g.
     * `{ "application_type": "bulk_authbridge", "field": "bulk_authbridge_verification" }`
     * or add `"application_id": "<batch_id>"` from SSE done for one run (same shared getLog as elsewhere).
     */
    const persistBulkAuthbridgeApplicationLog = async (outputS3Url) => {
        try {
            await ApplicationLogServices.bulkCreate(
                [['bulk_authbridge_verification', inputS3Url || '-', outputS3Url === '-' ? '-' : outputS3Url]],
                String(batchId),
                'bulk_authbridge',
                req?.loggedInUser?.id ?? null
            );
        } catch (logErr) {
            logger.error('bulkAuthbridge application_logs insert failed: %s', logErr?.message || logErr);
        }
    };

    try {
        const uploaded = req?.files ? Object.values(req.files)[0] : null;
        const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;
        const fileBuffer = file?.data;

        if (!fileBuffer) {
            sse.sendMessage('error', { message: 'Excel file is required in multipart upload' });
            sse.sendMessage('done', { event: 'DONE' });
            return sse.end();
        }

        const { panRows } = extractPanRowsFromExcelBuffer(fileBuffer);
        if (!panRows.length) {
            sse.sendMessage('error', { message: 'No PAN values found in first column' });
            sse.sendMessage('done', { event: 'DONE' });
            return sse.end();
        }

        try {
            inputS3Url = await uploadToS3FormData(
                'bulk-authbridge/input',
                file,
                `in_${req.loggedInUser?.id || 'anon'}_${batchId}`
            );
        } catch (uploadInErr) {
            logger.error('bulkAuthbridge input S3 upload failed: %s', uploadInErr?.message || uploadInErr);
        }

        for (const row of panRows) {
            const pan = row.pan;
            if (row.isDuplicate) {
                const remark = 'Duplicate PAN in uploaded file';
                sendPanEvent({
                    pan,
                    status: 'SKIPPED',
                    remark
                });
                appendAuthbridgeResultRow(pan, 'SKIPPED', remark, { duplicate: true });
                continue;
            }
            try {
                const result = await DSAService.verifyPanViaAuthBridgeByPanV2(pan, false);
                if (result?.skipped) {
                    const remark = result?.remark || result?.message || 'Skipped';
                    sendPanEvent({
                        pan,
                        status: 'SKIPPED',
                        remark
                    });
                    appendAuthbridgeResultRow(pan, 'SKIPPED', remark, { skipped: true });
                    continue;
                }

                const ok = Number(result?.status) === 1 || result?.status === true;
                const dataPayload = result?.data || {
                    code: result?.code,
                    type: result?.type
                };
                sendPanEvent({
                    pan,
                    status: ok ? 'SUCCESS' : 'FAILED',
                    remark: result?.message || 'AuthBridge response unavailable',
                    data: dataPayload
                });
                appendAuthbridgeResultRow(
                    pan,
                    ok ? 'SUCCESS' : 'FAILED',
                    result?.message || 'AuthBridge response unavailable',
                    dataPayload
                );
            } catch (panError) {
                const remark = panError?.message || 'Unexpected per-PAN error';
                sendPanEvent({
                    pan,
                    status: 'FAILED',
                    remark
                });
                appendAuthbridgeResultRow(pan, 'FAILED', remark, { error: true });
            }
        }

        let outputS3Url = '-';
        try {
            outputS3Url = await uploadArrayToS3(resultsRows, `bulk_authbridge_out_${batchId}`);
        } catch (uploadOutErr) {
            logger.error('bulkAuthbridge output S3 upload failed: %s', uploadOutErr?.message || uploadOutErr);
        }

        await persistBulkAuthbridgeApplicationLog(outputS3Url);

        sse.sendMessage('done', {
            event: 'DONE',
            batch_id: batchId,
            input_excel_s3_url: inputS3Url || null,
            output_excel_s3_url: outputS3Url !== '-' ? outputS3Url : null
        });
        return sse.end();
    } catch (e) {
        logger.error(e);
        sse.sendMessage('error', { message: e?.message || 'Bulk verification failed' });
        let outputS3Url = '-';
        if (resultsRows.length) {
            try {
                outputS3Url = await uploadArrayToS3(resultsRows, `bulk_authbridge_out_${batchId}_partial`);
            } catch (uploadOutErr) {
                logger.error('bulkAuthbridge partial output S3 upload failed: %s', uploadOutErr?.message || uploadOutErr);
            }
        }
        if (inputS3Url || resultsRows.length) {
            await persistBulkAuthbridgeApplicationLog(outputS3Url);
        }
        sse.sendMessage('done', {
            event: 'DONE',
            batch_id: batchId,
            input_excel_s3_url: inputS3Url || null,
            output_excel_s3_url: outputS3Url !== '-' ? outputS3Url : null
        });
        return sse.end();
    }
};

exports.syncLlmUtmSources = async (req, res) => {
    try {
        const result = await DSAService.syncLlmUtmMainSource();
        return ResHelper.apiResponseV2(res, true, "LLM UTM Main Source synced successfully", 200, result, "");
    } catch (e) {
        return catchHandling(e, res);
    }
};

exports.saveMouAgreement = async (req, res) => {
    try {
        const { error } = await DSAValidationV2.saveMouAgreement.validate(req.body);
        if (error) {
            return ResHelper.apiResponseV2(res, false, _.startCase(error.message), 400, {}, "");
        }

        const dsa_id = req?.dsa?.dsa_id || req?.body?.dsa_id || req?.loggedInUser?.dsa_id;
        if (!dsa_id) {
            return ResHelper.apiResponseV2(res, false, "DSA ID is required", 400, {}, "");
        }

        const {
            mou_filename,
            mou_signature_image_filename,
            company_id = null,
            company_mou_filename = null,
            consent_type = "mou_agreement",
            description = "MOU agreement signed and submitted",
            ip: bodyIp = null
        } = req.body;

        const cleanMouFilename = removeS3(mou_filename);
        const cleanMouSignatureImage = removeS3(mou_signature_image_filename);
        const cleanCompanyMouFilename = company_mou_filename ? removeS3(company_mou_filename) : null;

        const updated_by = req?.loggedInUser?.id || dsa_id;
        const ip = bodyIp || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || null;

        await DSAService.saveMouAgreementData({
            dsa_id,
            mou_filename: cleanMouFilename,
            mou_signature_image_filename: cleanMouSignatureImage,
            company_id,
            company_mou_filename: cleanCompanyMouFilename,
            consent_type,
            description,
            updated_by,
            ip
        });

        return ResHelper.apiResponseV2(res, true, "MOU agreement saved successfully", 200, { dsa_id }, "");
    } catch (e) {
        return catchHandling(e, res);
    }
};



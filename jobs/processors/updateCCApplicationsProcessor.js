const { logger } = require("../../api/helpers/logger");
const { uploadArrayToS3, readJsonFromS3, deleteFromS3, ccStatusMapping, jsonDifference, ccSubStageMapping, getTableNameFromLoanType } = require("../../api/helpers/commonhelper");
const { sequelize, _db2 } = require("../db");
const { QueryTypes } = require("sequelize");
const { bulkCreate } = require("../../api/services/application-log-services.js");
const { sendLenderNotificationEmail } = require("../../config/lenderEmailConfigs");
const { recordFailedApplications, deleteStaleQuarantineRecords } = require("../../api/services/mis-quarantine-service");
const { SYSTEM_BOT_USER_EMAIL } = require("../../api/helpers/constantdata/config");

// ==========================================
// 1. Utility Helpers
// ==========================================

function trimObject(arr) {
    let arrTemp = [];
    for (let i = 0; i < arr.length; i++) {
        let obj = arr[i];
        if (typeof obj !== "object" || obj === null) {
            return obj;
        }
        const trimmedObject = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const trimmedKey = key.trim();
                const value = obj[key];
                const trimmedValue = typeof value === "string" ? value.trim() : value;
                trimmedObject[trimmedKey] = trimmedValue;
            }
        }
        arrTemp.push(trimmedObject);
    }
    return arrTemp;
}

function toSnakeCase(str) {
    return str ? String(str).toLowerCase().replace(/\W+/g, "_") : "";
}

const getHdfcRemark = (data) => {
    const { dropoff_reason, vkyc_status, vkyc_expired, ipa_status, curable_flag, decline_description, capture_link, dap_final_flag, bkycc_status, bkycc_status_reason, idcom_status } = data;
    return JSON.stringify({ dropoff_reason, vkyc_status, vkyc_expired, ipa_status, curable_flag, decline_description, capture_link, dap_final_flag, bkycc_status, bkycc_status_reason, idcom_status });
};

function excelDateToJSDate(date) {
    if (!date) return null;
    if (`${date}`.includes("/") || `${date}`.includes("-")) {
        const d = new Date(date);
        return isNaN(d.getTime()) ? null : d;
    }
    if (isNaN(date)) {
        return null;
    }
    const jsDate = new Date(Math.round((date - 25569) * 86400 * 1000));
    return isNaN(jsDate.getTime()) ? null : jsDate;
}

function parseUnityMisDate(value) {
    if (value === undefined || value === null || value === "") return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    const text = String(value).trim();
    if (!text || /^null$/i.test(text)) return null;

    const dmy = text.match(/^(\d{1,2})([-/])(\d{1,2})\2(\d{2,4})$/);
    if (dmy) {
        let day = Number(dmy[1]);
        let month = Number(dmy[3]);
        let year = Number(dmy[4]);
        if (year < 100) year += 2000;
        if (month > 12 && day <= 12) {
            const swap = day;
            day = month;
            month = swap;
        }
        const parsed = new Date(year, month - 1, day);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const fallback = excelDateToJSDate(value);
    return fallback instanceof Date && !Number.isNaN(fallback.getTime()) ? fallback : null;
}

function parseShubhamSubLeadStage(value) {
    const rawText = (value || "").toString().trim();
    if (!rawText) {
        return { rawText: "", parsedDate: null, parsedAmount: null };
    }
    const normalizedText = rawText.replace(/\r/g, "");
    const lines = normalizedText.split("\n").map((line) => line.trim()).filter(Boolean);
    const dateRegex = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/;
    const amountRegex = /\b\d[\d,]*(?:\.\d+)?\b/g;

    const tryParseDate = (text) => {
        if (!text) return null;
        const dateMatch = text.match(dateRegex);
        if (!dateMatch) return null;
        const parsedDateCandidate = excelDateToJSDate(dateMatch[0]);
        return parsedDateCandidate instanceof Date && !isNaN(parsedDateCandidate.getTime()) ? parsedDateCandidate : null;
    };

    const tryParseAmount = (text) => {
        if (!text) return null;
        const amountMatches = text.match(amountRegex) || [];
        if (!amountMatches.length) return null;
        const parsedCandidates = amountMatches
            .map((match) => Number((match || "").replace(/,/g, "")))
            .filter((num) => Number.isFinite(num) && num > 0);

        if (!parsedCandidates.length) return null;
        const nonYearCandidates = parsedCandidates.filter((num) => {
            const rounded = Math.round(num);
            return !(num === rounded && rounded >= 1900 && rounded <= 2100);
        });
        const pool = nonYearCandidates.length ? nonYearCandidates : parsedCandidates;
        return pool.reduce((max, num) => (num > max ? num : max), pool[0]);
    };

    let parsedDate = null;
    let parsedAmount = null;

    for (const line of lines) {
        if (!parsedDate && /(approval|approved|disbursal|disbursed)\s*date/i.test(line)) {
            parsedDate = tryParseDate(line);
        }
        if (!parsedAmount && /(approval|approved|disbursal|disbursed)\s*amount/i.test(line)) {
            parsedAmount = tryParseAmount(line);
        }
    }

    if (!parsedDate) parsedDate = tryParseDate(normalizedText);
    if (!parsedAmount) {
        const amountSource = normalizedText.replace(dateRegex, " ");
        parsedAmount = tryParseAmount(amountSource);
    }

    return { rawText, parsedDate, parsedAmount };
}

// ==========================================
// 2. Lender-Specific Column & Status Mappers
// ==========================================

const lenderMappers = {
    scb_credit_card: (row) => {
        if (!row.utm_content) return { error: " Invalid UTM Content . " };
        const stage = row.aip_decision;
        return {
            application_id: row.utm_content,
            external_id: row.reference_code,
            stage,
            sub_stage: ccSubStageMapping["scb_credit_card"]?.[stage],
            status_description: row.current_status,
            status: ccStatusMapping["scb_credit_card"]?.[toSnakeCase(stage)],
        };
    },

    bajaj_credit_card: (row) => {
        if (!row.utm_medium || !row.utm_medium.startsWith("RuloanD")) {
            return { error: " Invalid Utm Medium . " };
        }
        return {
            application_id: row.utm_medium.substring("RuloanD".length),
            external_id: row["application_number"],
            stage: row.application_status,
            sub_stage: null,
            status_description: row.reject_reason,
            status: ccStatusMapping["bajaj_credit_card"]?.[toSnakeCase(row.application_status)],
        };
    },

    hdfc_credit_card: (row) => {
        if (row.lc1_code !== "XRUL") return { error: " Invalid LC1 Code . " };
        return {
            application_id: row.lc2_code,
            external_id: row.application_reference_number,
            stage: row.current_st,
            sub_stage: null,
            status_description: getHdfcRemark(row) || null,
            status: ccStatusMapping["hdfc_credit_card"]?.[toSnakeCase(row.current_st)],
        };
    },

    rupi_credit_card: (row) => {
        const rupi_sub_stage = {
            "App Installed": "App Installed",
            "Mobile OTP Verified": "Mobile OTP Verified",
            "FD Plan Selected": "FD Amount Selected",
            "PAN Verified": "PAN verification successful",
            "UID Verified": "Aadhaar verification successful & Personal Details submitted",
            "BAV Initiated": "Bank Account verification Initiated",
            "BAV Completed": "Bank Account verification Completed",
            "FD Payment Initialized": "FD Payment Initialized",
            "VKYC Initiated": "Video KYC Initiated in Bank Environment",
            "VKYC Failed": "VKYC failed & FD refund initiated",
            "Card Created": "Card successfully created",
        };
        if (!row["agent_code"]) return { error: " Invalid Agent Code . " };
        return {
            application_id: row["agent_code"],
            external_id: row["phone_number"],
            stage: row["user_status"],
            sub_stage: rupi_sub_stage[row["user_status"]],
            status_description: rupi_sub_stage[row["user_status"]],
            status: ccStatusMapping["rupi_credit_card"]?.[toSnakeCase(row["user_status"])],
        };
    },

    icici_cc: (row) => {
        if (!row["user_id"]) return { error: " Invalid User ID . " };
        const stage = row["final_status"];
        return {
            application_id: row["user_id"],
            external_id: row["app_formno"],
            stage,
            sub_stage: ccSubStageMapping["icici_cc"]?.[toSnakeCase(stage)],
            status_description: null,
            status: ccStatusMapping["icici_cc"]?.[toSnakeCase(stage)],
        };
    },

    abfl_pl: (row) => {
        if (!row["mobile_number"]) return { error: " Invalid Mobile Number . " };
        const stage = row["final_status"];
        return {
            application_id: row["mobile_number"],
            external_id: row["application_number"],
            stage,
            sub_stage: null,
            status_description: row["stage_message"],
            status: ccStatusMapping["abfl_pl"]?.[toSnakeCase(stage)],
            applied_loan_amount: row["offer_loan_amount"],
            disbursed_loan_amount: row["sanction_amount"],
            disbursed_date: row["agreement_assigned_at"] ? excelDateToJSDate(row["agreement_assigned_at"]) : null,
        };
    },

    zype_pl: (row) => {
        if (!row["mobile_number"]) return { error: " Invalid mobile number . " };
        const stage = row["approval_status"];
        return {
            application_id: row["mobile_number"],
            external_id: row["customer_id"],
            stage,
            sub_stage: null,
            status_description: row["drop_off_screen"],
            status: row["loan_transferred_date"] ? "disbursed" : ccStatusMapping["zype_pl"]?.[toSnakeCase(stage)],
            applied_loan_amount: row["pa_amount"],
            disbursed_loan_amount: row["loan_amount"],
            disbursed_date: row["loan_transferred_date"] ? excelDateToJSDate(new Date(row["loan_transferred_date"])) : null,
        };
    },

    mirae_pl: (row) => {
        if (!row["mob_no"]) return { error: " Invalid mobile number. " };
        const stage = row["decisioning"];
        return {
            application_id: row["mob_no"],
            external_id: row["application_id"],
            stage,
            sub_stage: row["system_staging"],
            status_description: row["remarks"],
            status: ccStatusMapping["mirae_pl"]?.[toSnakeCase(stage)],
            applied_loan_amount: row["application_loan_amount"],
            disbursed_loan_amount: null,
            disbursed_date: null,
        };
    },

    poonawala: (row) => {
        if (!row["utm_partner_referenceid"]) return { error: " Invalid utm reference id. " };
        const stage = row["loan_status"];
        return {
            application_id: row["utm_partner_referenceid"],
            external_id: row["external_id"],
            stage,
            status_description: row["loan_status"],
            status: ccStatusMapping["poonawala"]?.[toSnakeCase(stage)],
            disbursed_loan_amount: row["disbursal_date"] ? row["loan_amount"] : null,
            disbursed_date: row["disbursal_date"] ? excelDateToJSDate(row["disbursal_date"]) : null,
        };
    },

    sundaram_hl: (row) => {
        if (!row["ruloans_lead_id"]) return { error: " Invalid RUloans Lead ID. " };
        const stage = row["status"];
        return {
            application_id: row["ruloans_lead_id"],
            external_id: row["sundaram_app_id_lan"],
            stage,
            sub_stage: row["sub_status"],
            status_description: row["reject_reason_remarks"],
            status: ccStatusMapping["sundaram_hl"]?.[toSnakeCase(stage)],
            disbursed_loan_amount: row["disbursedamount"],
            disbursed_date: row["disb_date"] ? excelDateToJSDate(row["disb_date"]) : null,
        };
    },

    rupeek_gl: (row) => {
        if (!row["lead_id"]) return { error: " Invalid Lead ID. " };
        const stage = row["status"];
        return {
            application_id: row["lead_id"],
            external_id: row["sundaram_app_id_lan"],
            stage,
            sub_stage: row["sub_status"],
            status_description: row["reject_reason_remarks"],
            status: ccStatusMapping["rupeek_gl"]?.[toSnakeCase(stage)],
            disbursed_loan_amount: row["disbursedamount"],
            disbursed_date: row["disb_date"] ? excelDateToJSDate(row["disb_date"]) : null,
        };
    },

    motilal_lap: (row, product) => {
        if (!row["lead_id"]) return { error: " Invalid Lead ID. " };
        const product_type_check = { motilal_lap: "NON-HOME LOAN", motilal_hl: "HOME LOAN" };
        if (row["loan_product"] !== product_type_check[product]) return { skip: true };
        return {
            application_id: row["lead_id"],
            external_id: row["lead_id"],
            stage: row["status"],
            sub_stage: row["sub_status"],
            status_description: null,
            status: ccStatusMapping["motilal_lap"]?.[row["status"]],
            disbursed_loan_amount: row["total_disb_amt"],
            disbursed_date: row["disb_date"] ? excelDateToJSDate(row["disb_date"]) : null,
        };
    },

    incred_pl: (row) => {
        if (row["loan_scheme"] !== "PL_CROSS_SELL") return { skip: true };
        if (!row["applicationid"]) return { error: " Invalid Lead ID. " };
        return {
            application_id: row["applicationid"],
            external_id: row["applicationid"],
            stage: row["application_status"],
            sub_stage: null,
            status_description: null,
            status: ccStatusMapping["incred_pl"]?.[row["application_status"]],
            disbursed_loan_amount: row["disbursed_amount"],
            disbursed_date: row["disbursal_date"] ? excelDateToJSDate(row["disbursal_date"]) : null,
        };
    },

    hero_fincorp_pl: (row) => {
        if (!row["utm_content"]) return { error: "invalid application id" };
        const stage = row["stage"];
        return {
            application_id: row["utm_content"],
            external_id: row["appid"],
            stage,
            sub_stage: "",
            status_description: "",
            status: ccStatusMapping["hero_fincorp_pl"]?.[toSnakeCase(stage)] || null,
            disbursed_loan_amount: row["disbursed_amount"],
            disbursed_date: row["disbursement_date"] ? excelDateToJSDate(row["disbursement_date"]) : null,
        };
    },

    piramal_pl: (row) => {
        if (!row["lead_id"]) return { error: " Invalid Lead ID. " };
        return {
            application_id: row["lead_id"],
            external_id: row["lead_id"],
            stage: row["lead_status"],
            sub_stage: row["loan_status"],
            status_description: row["stage_as_per_cc"],
            status: ccStatusMapping["piramal_pl"]?.[`${row["lead_status"]}:${row["loan_status"]}`],
            disbursed_loan_amount: row["disbursement_amount"],
            disbursed_date: row["disbursal_date"] ? excelDateToJSDate(row["disbursal_date"]) : null,
        };
    },

    tata_pl: (row) => {
        if (!row["opportunity_id"]) return { error: " Invalid opportunity_id " };
        return {
            application_id: row["opportunity_id"],
            external_id: row["opportunity_id"],
            stage: null,
            sub_stage: null,
            status_description: null,
            status: ccStatusMapping["tata_pl"]?.[toSnakeCase(row["status"])],
            disbursed_loan_amount: row["loan_amount"],
            disbursed_date: row["disbursed_date"] ? excelDateToJSDate(row["disbursed_date"]) : null,
        };
    },

    piramal_hl: (row, product) => {
        if (!row["lead_id"]) return { error: " Invalid Lead ID. " };
        if (product === "piramal_lap" && !row["lead_id"]?.includes("RULAP")) {
            return { error: ` Invalid Lead ID For ${product} ` };
        }
        if (product === "piramal_hl" && !row["lead_id"]?.includes("HLSARUL")) {
            return { error: ` Invalid Lead ID For ${product} ` };
        }
        return {
            application_id: row["lead_id"],
            external_id: row["lead_id"],
            stage: row["loanstatus"],
            sub_stage: row["sfdc_stage"],
            status_description: row["remarks"],
            status: ccStatusMapping["piramal_hl"]?.[`${row["loanstatus"]}:${row["sdfc_stage"]}`],
            disbursed_loan_amount: row["disbursedamount"],
            disbursed_date: row["disb_date"] ? excelDateToJSDate(row["disb_date"]) : null,
        };
    },

    shubham_hl: (row, product) => {
        const customerMobileRaw = row?.["contact_no_1"] ?? row?.["column_no_1"];
        const customerMobile = typeof customerMobileRaw === "string" ? customerMobileRaw.trim() : customerMobileRaw;
        const leadId = typeof row?.["lead_id"] === "string" ? row["lead_id"].trim() : row?.["lead_id"];
        const leadStage = typeof row?.["lead_stage"] === "string" ? row["lead_stage"].trim() : row?.["lead_stage"];
        const ruloansSubLeadStage = row["ruloans_sub-lead_stage"] || row["ruloans_sub_lead_stage"] || null;

        if (!customerMobile) return { error: " Invalid Mobile Number. " };
        if (!leadId) return { error: " Invalid Lead ID. " };
        if (!leadStage) return { error: " Invalid Lead Stage. " };

        const mappedStatus = ccStatusMapping[product]?.[(leadStage || "").toString().trim()];
        if (!mappedStatus) return { error: " Invalid Lead Stage Mapping. " };

        const parsedSubStage = parseShubhamSubLeadStage(ruloansSubLeadStage);
        let approved_date_update = null;
        let approved_loan_amount_update = null;
        let disbursed_date = null;
        let disbursed_loan_amount = null;
        let status_description = null;

        if (mappedStatus === "approved") {
            approved_date_update = parsedSubStage.parsedDate;
            approved_loan_amount_update = parsedSubStage.parsedAmount;
        } else if (mappedStatus === "disbursed") {
            disbursed_date = parsedSubStage.parsedDate;
            disbursed_loan_amount = parsedSubStage.parsedAmount;
        } else {
            status_description = parsedSubStage.rawText || leadStage || null;
        }

        return {
            application_id: customerMobile,
            external_id: leadId,
            stage: mappedStatus,
            sub_stage: null,
            status: mappedStatus,
            status_description,
            approved_date_update,
            approved_loan_amount_update,
            disbursed_date,
            disbursed_loan_amount,
        };
    },

    piramal_bl: (row) => {
        if (!row?.["lead_id"]) return { error: " Invalid Lead ID. " };
        return {
            application_id: row["lead_id"],
            external_id: row["lead_id"],
            stage: row["lead_status"],
            sub_stage: row["stage"],
            status_description: row["remarks_-_detailed_status"],
            status: ccStatusMapping["piramal_bl"]?.[`${row["lead_status"]}:${row["stage"]}`],
            disbursed_loan_amount: row["disbursement_amount"],
            disbursed_date: row["disbursal_date"] ? excelDateToJSDate(row["disbursal_date"]) : null,
        };
    },

    loanwalle_pl: (row) => {
        if (!row?.["click_id"]) return { error: " Invalid Lead ID. " };
        return {
            application_id: row["click_id"],
            external_id: row["lead_no"],
            stage: row["lead_stage"],
            sub_stage: row["final_status"],
            status_description: row["rejection_remarks"],
            status: ccStatusMapping["loanwalle_pl"]?.[`${row["lead_stage"]}`],
            disbursed_loan_amount: row["amount_disbursed"],
            disbursed_date: row["disbursal_date"] ? excelDateToJSDate(row["disbursal_date"]) : null,
        };
    },

    unity_smb_pl: (row) => {
        const misValue = (val) => {
            if (val === undefined || val === null) return "";
            const text = String(val).trim();
            return !text || /^null$/i.test(text) ? "" : text;
        };
        const misField = (keys) => {
            for (const key of keys) {
                const text = misValue(row[key]);
                if (text) return text;
            }
            return "";
        };

        const leadId = misField(["utm_campaign", "utm_camp"]);
        const bankApplicationId = misField(["application_reference_no", "application_no"]);
        const loanStatus = misField(["loan_status"]);
        const bre1Decision = misField(["bre1_decision"]);

        if (!leadId) return { error: " Invalid UTM Campaign / Lead ID. " };
        if (!loanStatus) return { error: " Invalid Loan Status. " };

        let status = ccStatusMapping["unity_smb_pl"]?.[toSnakeCase(loanStatus)];
        const approvedDecision = ["approved", "enhancement"].includes(toSnakeCase(bre1Decision));
        if (approvedDecision && status !== "rejected" && status !== "disbursed") {
            status = "approved";
        }

        let approved_loan_amount_update = null;
        let disbursed_loan_amount = null;
        let disbursed_date = null;

        if (status === "approved") {
            const approvalAmount = Number(String(misField(["approval_loan_amount"])).replace(/,/g, ""));
            if (Number.isFinite(approvalAmount) && approvalAmount > 0) {
                approved_loan_amount_update = approvalAmount;
            }
        }

        if (status === "disbursed") {
            const disbursedAmountRaw = misField(["amount", "disbursed_amount", "amount_disbursed", "disbursement_amount"]);
            const disbursedDateRaw = misField(["disbursement_date", "disbursed_date", "disbursal_date"]);
            if (disbursedAmountRaw) {
                const parsedAmount = Number(String(disbursedAmountRaw).replace(/,/g, ""));
                if (Number.isFinite(parsedAmount) && parsedAmount > 0) {
                    disbursed_loan_amount = parsedAmount;
                }
            }
            if (disbursedDateRaw) {
                disbursed_date = parseUnityMisDate(disbursedDateRaw);
            }
        }

        return {
            application_id: leadId,
            external_id: bankApplicationId || null,
            stage: loanStatus,
            sub_stage: bre1Decision || null,
            status_description: misField(["reject_reason"]) || null,
            status,
            approved_loan_amount_update,
            disbursed_loan_amount,
            disbursed_date,
        };
    },
};

// Aliases
lenderMappers["sundaram_lap"] = lenderMappers["sundaram_hl"];
lenderMappers["motilal_hl"] = lenderMappers["motilal_lap"];
lenderMappers["piramal_lap"] = lenderMappers["piramal_hl"];
lenderMappers["shubham_lap"] = lenderMappers["shubham_hl"];

const whereMapping = {
    motilal_hl: "a.external_id",
    motilal_lap: "a.external_id",
    incred_pl: "a.external_id",
    abfl_pl: "d.customer_mobile_number",
    zype_pl: "d.customer_mobile_number",
    mirae_pl: "d.customer_mobile_number",
    piramal_hl: "a.external_id",
    piramal_bl: "a.external_id",
    piramal_pl: "a.external_id",
    piramal_lap: "a.external_id",
    tata_pl: "a.external_id",
    shubham_hl: "d.customer_mobile_number",
    shubham_lap: "d.customer_mobile_number",
    unity_smb_pl: "a.application_id",
};

// ==========================================
// 3. Main Processor Execution
// ==========================================

module.exports = async function (job) {
    try {
        let query;
        let { data, user, product, file_name, product_type, product_id, s3PayloadUrl } = job?.data || job;

        if (s3PayloadUrl && (!data || !data.length)) {
            try {
                const s3Content = await readJsonFromS3(s3PayloadUrl);
                data = s3Content?.data || [];
                // Delete temporary S3 payload after successfully reading into memory
                deleteFromS3(s3PayloadUrl).catch(() => {});
            } catch (s3FetchErr) {
                console.error(`[MIS Processor] Failed to load payload from S3:`, s3FetchErr.message || s3FetchErr);
                throw s3FetchErr;
            }
        }

        data = trimObject(data || []);
        let faliureCount = 0;
        let userDetailsError = [];
        const successfulAppIds = [];

        const mapper = lenderMappers[product];

        for (let i = 0; i < data.length; i++) {
            try {
                let mapped;
                if (mapper) {
                    mapped = mapper(data[i], product);
                } else {
                    mapped = {
                        application_id: data[i]?.application_id || data[i]?.lead_id || data[i]?.utm_content,
                        external_id: data[i]?.external_id || data[i]?.application_number,
                        stage: data[i]?.stage || data[i]?.status,
                        sub_stage: data[i]?.sub_stage || null,
                        status_description: data[i]?.status_description || data[i]?.remarks || null,
                        status: ccStatusMapping?.[product]?.[toSnakeCase(data[i]?.stage || data[i]?.status)] || data[i]?.status,
                        disbursed_loan_amount: data[i]?.disbursed_loan_amount || null,
                        disbursed_date: data[i]?.disbursed_date ? excelDateToJSDate(data[i]?.disbursed_date) : null,
                    };
                }

                if (mapped?.skip) {
                    continue;
                }

                if (mapped?.error) {
                    let tempR = data[i];
                    tempR.error = mapped.error;
                    faliureCount++;
                    userDetailsError.push(tempR);
                    continue;
                }

                let {
                    application_id,
                    external_id,
                    stage,
                    sub_stage,
                    status_description,
                    status,
                    applied_loan_amount,
                    approved_loan_amount_update,
                    disbursed_loan_amount,
                    approved_date_update,
                    disbursed_date,
                } = mapped;

                // Validate matching key
                const matchColumn = whereMapping[product] || "a.application_id";
                const isCustomerMobileMatch = matchColumn.includes("customer_mobile_number");

                const isCreditCard = product_type === "credit_card" || product_type === "cc";

                if (isCreditCard) {
                    query = `
                        SELECT 
                            dsa.dsa_mobile_number, a.created_at, d.address_city, d.address_state, 
                            d.address_pincode, a.application_id, a.external_id, a.stage, a.sub_stage, 
                            a.status_description, a.status 
                        FROM ${getTableNameFromLoanType(product_type, "table_name")} a 
                        LEFT JOIN ru_customers d ON a.customer_id = d.customer_id 
                        LEFT JOIN ru_direct_selling_agents dsa ON a.dsa_id = dsa.dsa_id 
                        WHERE ${matchColumn} = ?
                        ${isCustomerMobileMatch && product_id ? `AND a.product_id = '${product_id}'` : ""}
                    `;
                } else {
                    query = `
                        SELECT 
                            dsa.dsa_mobile_number, a.approved_loan_amount, a.created_at, meta.approved_date, 
                            meta.disbursed_date as disbursed_amt_date, d.address_city, d.address_state, 
                            d.address_pincode, a.disbursed_loan_amount, a.applied_loan_amount, 
                            a.application_id, a.external_id, a.stage, a.sub_stage, a.status_description, 
                            a.status 
                        FROM ${getTableNameFromLoanType(product_type, "table_name")} a 
                        LEFT JOIN ru_customers d ON a.customer_id = d.customer_id 
                        LEFT JOIN ru_direct_selling_agents dsa ON a.dsa_id = dsa.dsa_id 
                        LEFT JOIN ${getTableNameFromLoanType(product_type, "meta_table")} meta ON a.application_id = meta.application_id 
                        WHERE ${matchColumn} = ?
                        ${isCustomerMobileMatch && product_id ? `AND a.product_id = '${product_id}'` : ""}
                    `;
                }

                let application = await _db2.query(query, {
                    replacements: [application_id],
                    type: QueryTypes.SELECT,
                });

                application = application[0];
                if (!application) {
                    let tempR = data[i];
                    tempR.error = " Invalid Application . ";
                    faliureCount++;
                    userDetailsError.push(tempR);
                    continue;
                }

                let { dsa_mobile_number, approved_loan_amount, created_at, approved_date, disbursed_amt_date, address_city, address_state, address_pincode, ...rest } = application;
                application = rest;
                application_id = application?.application_id;

                // Update MySQL Application
                if (["personal_loan", "home_loan", "gold_loan"].includes(product_type)) {
                    let updateQuery = `UPDATE ${getTableNameFromLoanType(product_type, "table_name")} SET `;
                    const updates = [];
                    const values = [];

                    if (stage !== undefined && stage !== null) {
                        updates.push("stage = ?");
                        values.push(stage);
                    }
                    if (external_id !== undefined && external_id !== null) {
                        updates.push("external_id = ?");
                        values.push(external_id);
                    }
                    if (sub_stage !== undefined && sub_stage !== null) {
                        updates.push("sub_stage = ?");
                        values.push(sub_stage);
                    }
                    if (status !== undefined && status !== null) {
                        updates.push("status = ?");
                        values.push(status);
                    }
                    if (status_description !== undefined && status_description !== null) {
                        updates.push("status_description = ?");
                        values.push(status_description);
                    }
                    if (disbursed_loan_amount !== undefined && disbursed_loan_amount !== null) {
                        updates.push("disbursed_loan_amount = ?");
                        values.push(disbursed_loan_amount);
                    }
                    if (["shubham_hl", "shubham_lap", "unity_smb_pl"].includes(product) && approved_loan_amount_update !== undefined && approved_loan_amount_update !== null) {
                        updates.push("approved_loan_amount = ?");
                        values.push(approved_loan_amount_update);
                    }
                    if (applied_loan_amount !== undefined && applied_loan_amount !== null) {
                        updates.push("applied_loan_amount = ?");
                        values.push(applied_loan_amount);
                    }
                    updates.push("updated_at = ?");
                    values.push(new Date());

                    updateQuery += updates.join(", ") + " WHERE application_id = ?";
                    values.push(application_id);
                    await _db2.query(updateQuery, { replacements: values });

                    // Meta Table Update
                    query = `SELECT * FROM ${getTableNameFromLoanType(product_type, "meta_table")} WHERE application_id = ? `;
                    let meta = await _db2.query(query, { replacements: [application_id], type: QueryTypes.SELECT });
                    meta = meta[0];

                    if (meta) {
                        query = `UPDATE ${getTableNameFromLoanType(product_type, "meta_table")} SET disbursed_date = ? WHERE application_id = ? `;
                        await _db2.query(query, { replacements: [disbursed_date || null, application_id], type: QueryTypes.UPDATE });

                        if (["shubham_hl", "shubham_lap", "unity_smb_pl"].includes(product) && approved_date_update !== undefined && approved_date_update !== null) {
                            query = `UPDATE ${getTableNameFromLoanType(product_type, "meta_table")} SET approved_date = ? WHERE application_id = ? `;
                            await _db2.query(query, { replacements: [approved_date_update, application_id], type: QueryTypes.UPDATE });
                        }
                    } else {
                        query = `INSERT INTO ${getTableNameFromLoanType(product_type, "meta_table")} (application_id, disbursed_date) VALUES (?, ?) `;
                        await _db2.query(query, { replacements: [application_id, disbursed_date || null], type: QueryTypes.INSERT });

                        if (["shubham_hl", "shubham_lap", "unity_smb_pl"].includes(product) && approved_date_update !== undefined && approved_date_update !== null) {
                            query = `UPDATE ${getTableNameFromLoanType(product_type, "meta_table")} SET approved_date = ? WHERE application_id = ? `;
                            await _db2.query(query, { replacements: [approved_date_update, application_id], type: QueryTypes.UPDATE });
                        }
                    }
                } else {
                    query = `UPDATE ${getTableNameFromLoanType(product_type, "table_name")} SET stage = ?, external_id = ?, sub_stage = ?, status = ?, status_description = ?, updated_at = ? WHERE application_id = ? `;
                    await _db2.query(query, {
                        replacements: [stage || null, external_id || null, sub_stage || null, status || null, status_description || null, new Date(), application_id],
                    });
                }

                // Fetch new application state & write diff log
                if (product_type === "pl") {
                    query = `SELECT disbursed_loan_amount, applied_loan_amount, application_id, external_id, stage, sub_stage, status_description, status FROM ${getTableNameFromLoanType(product_type, "table_name")} WHERE application_id = ? `;
                } else {
                    query = `SELECT application_id, external_id, stage, sub_stage, status_description, status FROM ${getTableNameFromLoanType(product_type, "table_name")} WHERE application_id = ? `;
                }
                let applicationNew = await _db2.query(query, { replacements: [application_id], type: QueryTypes.SELECT });
                applicationNew = applicationNew[0];

                let diff = jsonDifference(application, applicationNew);
                await bulkCreate(diff, application_id, "cc_application", user?.id);
                successfulAppIds.push(application_id);
            } catch (err1) {
                data[i].error = "Error Into The Data Provided. Please Provide all the Mandatory Fields and all fields in desired format";
                faliureCount++;
                userDetailsError.push(data[i]);
            }

            if (typeof job?.progress === "function" && i % 25 === 0) {
                try {
                    await job.progress(Math.round((i / data.length) * 98));
                } catch (_) {}
            }
        }

        // 1. Error file S3 upload & Bot-only lender notification email
        let file = null;
        if (faliureCount > 0 && userDetailsError.length > 0) {
            try {
                file = await uploadArrayToS3(userDetailsError, `cc_mis_update_${product}`);
            } catch (s3Err) {
                console.error(`[MIS Processor] S3 upload error:`, s3Err.message || s3Err);
            }

            if (user?.email === SYSTEM_BOT_USER_EMAIL) {
                await sendLenderNotificationEmail(product, file_name, data.length - faliureCount, faliureCount, file);
            }
        }

        // 2. Record application logs entry in MySQL
        query = `INSERT INTO application_logs (application_type, application_id, field, from_value, to_value, updated_by, createdAt, updatedAt) VALUES ('cc_mis_update_${product}', ?, ?, ?, ?, uuid_to_bin(?), NOW(), NOW()) `;
        let insertedLogId = null;
        try {
            const [logId] = await sequelize.query(query, {
                replacements: [file_name, file || "COMPLETED_100_PERCENT", data.length - faliureCount, faliureCount, user?.id || null],
                type: QueryTypes.INSERT,
            });
            insertedLogId = logId;
        } catch (logErr) {
            console.error(`[MIS Processor] application_logs insert error:`, logErr.message || logErr);
        }

        // 3. Stage failed records in MongoDB Quarantine tied directly to this unique log run
        if (userDetailsError.length > 0) {
            try {
                await recordFailedApplications(product, file_name, userDetailsError, insertedLogId);
            } catch (mongoErr) {
                console.error(`[MIS Processor] MongoDB quarantine staging error:`, mongoErr.message || mongoErr);
            }
        }

        // 4. Purge stale quarantine records older than retention period from env
        deleteStaleQuarantineRecords().catch((err) => {
            console.error("Error running deleteStaleQuarantineRecords:", err.message || err);
        });

        if (typeof job?.progress === "function") {
            try {
                await job.progress(100);
            } catch (_) {}
        }
        console.log(`[MIS Processor] Finished processing ${file_name} for ${product}. Total: ${data.length}, Success: ${data.length - faliureCount}, Failed: ${faliureCount}`);
    } catch (e) {
        console.error("[MIS Processor] Unhandled error in processor:", e.message || e);
        logger.error ? logger.error(e) : console.error(e);
    }
};

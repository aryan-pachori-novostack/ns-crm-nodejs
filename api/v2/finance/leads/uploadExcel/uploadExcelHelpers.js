const { jsonDifference } = require("../../../../helpers/commonhelper");
const { createActivityLogKafka } = require("../../../../services/kafka-services");
const { bulkCreate } = require("../../../../services/application-log-services");

/**
 * Excel column key -> `ru_fresh_lead_claims` column name. Used only for activity-log
 * diffing of persisted fields (see `createLeadUpdateLogs`), not for reading the row.
 */
const excelLeadColumnMapping = {
    //"bank_claim_month": "claim_month",
    "los_apac_no": "loan_apac_ref_los_number",
    "loan_app_no": "loan_reference_id",
    "borrower_name": "customer_full_name",
    "borrower_first_name": "customer_first_name",
    "borrower_last_name": "customer_last_name",
    "disb_date": "disbursement_date",
    "disbursement_insurance_amount": "disbursement_amount",
    "city": "city",
    "leader_name": "leader_name",
    "sub_leader_name": "sub_leader_name",
    "bh_name": "bh_sub_leader",
    "vendor_pan": "permanent_account_number",
    "vendor_name": "full_name",
    "vendor_remark": "vendor_remark",
    "bank_nbfc_name": "bank_name",
    "bank_nbfc_id": "netsuite_bank_id",
    "product_name": "product_name",
    "product_id": "netsuite_product_id",
    "rate": "vendor_payout_rate",
    "is_split_case": "is_split_case",
    "borrower_company_name": "customer_company_name",
    "vendor_payout_ratio": "vendor_payout_ratio",
    "vendor_payout_type": "vendor_payout_type",
    "business_categories": "business_categories",
    "via_file_name": "upload_file_name",
    "sm_mail_id": "banker_email",
    "sm_mobile": "banker_mobile",
    "sm_name": "banker_name",
    "asm_mail_id": "asm_email",
    "asm_mobile": "asm_mobile",
    "asm_name": "asm_name",
    "cc_ids": "cc_email",
    "confirmation_required": "confirmation_required"
};

const YES_VARIANTS = ['yes', 'y'];
const NO_VARIANTS = ['no', 'n'];
// Write paths now emit lowercase "yes"/"no", but Excel cells and legacy rows still
// arrive as "Yes"/"YES"/" yes ", so normalise before comparing.
const isSplitCaseYes = (value) => String(value ?? "").trim().toLowerCase() === "yes";

/** Trim every key and string value of each row. */
function trimObject(arr) {
    let arrTemp = [];
    for (let i = 0; i < arr.length; i++) {
        let obj = arr[i];
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }

        const trimmedObject = {};

        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const trimmedKey = key.trim();
                const value = obj[key];
                const trimmedValue = typeof value == 'string' ? value.trim() : value;

                trimmedObject[trimmedKey] = trimmedValue;
            }
        }

        arrTemp.push(trimmedObject);
    }

    return arrTemp;
}

/** DD/MM/YYYY */
function isValidDateFormat(inputString) {
    const dateFormatRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
    return dateFormatRegex.test(inputString);
}

function parseDateFromString(dateString) {
    const [day, month, year] = dateString.split('/');
    // Months are zero-based in the JS Date object, so we subtract 1
    return new Date(year, month - 1, day);
}

const mapExcelObjectKeys = (obj, mapping) => {
    const newObj = {};
    for (const key in obj) {
        const newKey = mapping[key] || key;
        newObj[newKey] = obj[key];
    }
    return newObj;
};

const createLeadUpdateLogs = async (previous_lead, newData, logType, refId, leaderId, id) => {
    let mapped_new_data = mapExcelObjectKeys(newData, excelLeadColumnMapping);
    await createActivityLogKafka({
        old_data: previous_lead,
        new_data: mapped_new_data,
        log_type: logType,
        application_id: refId,
        created_by: leaderId
    });
    const difference = jsonDifference(previous_lead, mapped_new_data);
    await bulkCreate(difference, id, logType, leaderId);
};

/**
 * Records a failed row the same way the original inline blocks did: stamp the message
 * onto the row, bump the failure count, and push the row into the report array.
 * Mirrors `createErpPipelineOnCustomError` in the ERP flow.
 */
const createRowErrorCollector = (report) => async (error, ctx) => {
    const message = error?.message || "Validation failed";
    ctx.row.error = message;
    report.failureCount++;
    report.userDetailsError.push(ctx.row);
};

/**
 * Collector for the SHARING half of a payout-sharing pair.
 *
 * Two things it must get right, both of which are silent if wrong:
 *
 * 1. **Report the PRIMARY's row, not the sharer's.** The sharer's `ctx.row` is a detached
 *    shadow (see `claimPairBuilder`); pushing it would put a duplicate line in the output
 *    file while the real row never appears. Redirecting to `ctx.pair.other` means exactly
 *    one row is stamped and pushed, and `failureCount` stays row-scoped — so
 *    `dataNew.length - failureCount` keeps meaning "rows that succeeded".
 * 2. **Say which half failed.** Without the prefix, "This Lead does not exists" against a
 *    row whose vendor PAN is plainly valid is baffling — it is the *sharing* PAN that did
 *    not resolve.
 */
const createSharerErrorCollector = (report) => {
    const collect = createRowErrorCollector(report);
    return async (error, ctx) => collect(
        { ...error, message: `Sharing DSA: ${error?.message || "Validation failed"}` },
        ctx.pair?.other || ctx
    );
};

module.exports = {
    excelLeadColumnMapping,
    YES_VARIANTS,
    NO_VARIANTS,
    isSplitCaseYes,
    trimObject,
    isValidDateFormat,
    parseDateFromString,
    mapExcelObjectKeys,
    createLeadUpdateLogs,
    createRowErrorCollector,
    createSharerErrorCollector
};

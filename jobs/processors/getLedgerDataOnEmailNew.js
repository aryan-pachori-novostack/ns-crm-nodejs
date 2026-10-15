const { callNsApi, uploadArrayToS3, sendEmailWithAttachment } = require("../../api/helpers/commonhelper");
const axios = require('axios');
const { getModuleColumnsByRole } = require("../../api/services/roles-service");
const {sequelize} = require('../../models');
const { QueryTypes } = require("sequelize");

const NUMERIC_LEDGER_FIELDS = [
    "Confirmed Payout",
    "Claim Payout",
    "Feb 2023 Closing Balance",
    "Claimed",
    "Locked (Processed)",
    "Claimed Shared with Class",
    "Claimed Shared with Vendor",
    "Total Paid on Single Bank File",
    "Ratio of Payout vs Actual"
];

const NUMERIC_PAYMENT_FIELDS = [
    "Net Amount"
];

const toNumberIfPossible = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "string") {
        const cleaned = value.replace(/,/g, "").replace(/\s+/g, "").trim();
        if (!cleaned) return 0;
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : value;
    }
    if (value == null) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
};

const normalizeNumericFields = (row, fields) => {
    if (!row || typeof row !== "object") return row;
    for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(row, field)) {
            const normalized = toNumberIfPossible(row[field]);
            row[field] = normalized;
        }
    }
    return row;
};

const isNumericLikeString = (value) => {
    if (typeof value !== "string") return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    // Accept strings like "123", "1,234", "1,234.56", "- 1,234.56", "123.45"
    // while rejecting strings containing letters/symbolic text.
    const compact = trimmed.replace(/\s+/g, "");
    return /^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(compact);
};

// Auto-normalize any numeric-looking string values in a row.
// This complements known-field normalization so newly introduced numeric columns
// do not regress back to string values in generated Excel files.
const autoNormalizeRow = (row) => {
    if (!row || typeof row !== "object") return row;
    const keys = Object.keys(row);
    for (const key of keys) {
        const value = row[key];
        if (typeof value === "string" && isNumericLikeString(value)) {
            row[key] = toNumberIfPossible(value);
        }
    }
    return row;
};

// Helper function to remove specified columns from an array of ledger items
const removeColumnsFromArray = async (items, userRole, isCrmRequest) => {
    if (!items || items.length === 0) {
        return items;
    };

    const DEFAULT_COLUMNS_TO_REMOVE = [
        'Ratio of Payout vs Actual',
        'Bank Sub product',
        'Claim Uploaded By',
        'Amount Category For claim file',
        'Feb 2023 Closing Balance',
        'Claimed',
        'Locked (Processed)',
        'Claimed Shared with Class',
        'Claimed Shared with Vendor',
        'Claim Confirmation',
        'Audit Remark',
        'Class Assignee',
        'Class Model',
        'Class Deal',
        'Vendor Type',
        'Low/High',
        'Bank File Dup.Count',
        'Total Paid on Single Bank File'
    ];

    let columnsToProcess = new Set();
    let isVisibleMode = false;

    if (!isCrmRequest) {
        // Non-CRM user (e.g. external DSA): always mask the default columns
        columnsToProcess = new Set(DEFAULT_COLUMNS_TO_REMOVE);
    } else if (userRole) {
        // CRM user: fetch granular rule from centralized roles service
        const rule = await getModuleColumnsByRole(userRole, 'finance_claim_ledger');
        if (rule && rule.resource_list) {
            const list = rule.resource_list.split(',').map(c => c.trim()).filter(Boolean);
            columnsToProcess = new Set(list);
            isVisibleMode = rule.visible === 1;
        }
    }


    // Nothing to process (CRM user with no specific rules)
    if (columnsToProcess.size === 0 && !isVisibleMode) {
        return items;
    }

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (isVisibleMode) {
            // "Show Only" mode: Remove any column NOT in the processing list
            const allColumns = Object.keys(item);
            for (const col of allColumns) {
                if (!columnsToProcess.has(col)) {
                    delete item[col];
                }
            }
        } else {
            // "Hidden" mode: Remove specified columns
            for (const col of columnsToProcess) {
                delete item[col];
            }
        }
    }

    return items;
};


const getLedgerDetails = async (data) => {
    const { i_vendor_id, Claim_month, Page_index } = data
    const payload = { i_vendor_id, Claim_month: Claim_month || "", Page_index }
    const result = await callNsApi({
        "api": "customscript_rul_send_vcf_data_paginatio",
        payload
    });

    return result || null
}

// Helper function to check if claim month is current or previous month
const isCurrentOrPreviousMonth = (claimMonthString) => {
    if (!claimMonthString) return false;

    try {
        // Parse the claim month string format: "FY 2024 : Q1 2024 : May 2023"
        const parts = claimMonthString.split(':');
        if (parts.length < 3) return false;

        const monthYearPart = parts[2].trim(); // "May 2023"
        const monthYearMatch = monthYearPart.match(/(\w+)\s+(\d{4})/);

        if (!monthYearMatch) return false;

        const [, monthName, year] = monthYearMatch;
        const monthNames = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];

        const monthIndex = monthNames.findIndex(name =>
            name.toLowerCase() === monthName.toLowerCase()
        );

        if (monthIndex === -1) return false;

        const claimDate = new Date(parseInt(year), monthIndex);
        const currentDate = new Date();
        const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth());
        const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);

        // Check if claim month matches current month or previous month
        return (claimDate.getTime() === currentMonth.getTime() ||
            claimDate.getTime() === previousMonth.getTime());

    } catch (error) {
        console.error('Error parsing claim month:', error);
        return false;
    }
}


async function getPaymentData(id, page_index, user) {
    try {
        let data = JSON.stringify({
            "iVendorId": id,
            "pageIndex": page_index
        });

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: `${process.env.MS_URL}/api/fresh-lead/send-vendor-payment`,
            headers: {
                'api-key': 'b0.khJGugUKsy9-jt#ruloans',
                'Content-Type': 'application/json'
            },
            data: data
        };

        const response = await axios.request(config);
        //   console.log(JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        console.log(error.message)
        console.error('Error:', error.response ? error.response.data : error.message);
        // ... (existing error handling code)
        return -1;
    }
}



module.exports = async function (job) {
    try {
        if (!job || !job.data) {
            throw new Error('Invalid job data');
        }

        let { netsuite_vendor_id, user, cc_emails, claim_month, vendor_name, is_crm_request } = job.data

        if (!user || !user.id || !user.userEmail) {
            throw new Error('Invalid user data');
        }

        let payment = [];

        // Fetch the first page
        const firstPage = await getPaymentData(netsuite_vendor_id, 1, user);
        let total_paid_amount = 0

        if (firstPage && firstPage.data && Array.isArray(firstPage.data) && firstPage.data.length > 0) {
            for (const item of firstPage.data) {
                normalizeNumericFields(item, NUMERIC_PAYMENT_FIELDS);
                autoNormalizeRow(item);
                payment.push(item);
                total_paid_amount += (typeof item["Net Amount"] === "number" ? item["Net Amount"] : 0);
            }

            const totalPages = firstPage.pagecount;

            if (totalPages > 1) {
                const promises = [];

                for (let i = 2; i <= totalPages; i++) {
                    promises.push(getPaymentData(netsuite_vendor_id, i, user));
                }

                const responses = await Promise.all(promises);

                for (const res of responses) {
                    if (res && res.data && Array.isArray(res.data)) {
                        for (const item of res.data) {
                            normalizeNumericFields(item, NUMERIC_PAYMENT_FIELDS);
                            autoNormalizeRow(item);
                            payment.push(item);
                            total_paid_amount += (typeof item["Net Amount"] === "number" ? item["Net Amount"] : 0);
                        }
                    }
                }
            }
        }


        let result = [];
        let total_payable_amount = 0
        let max_payout_on_not_found_claims = 0

        let data = await getLedgerDetails({
            i_vendor_id: netsuite_vendor_id,
            Claim_month: claim_month || "",
            Page_index: 1
        });

        // Clean and convert Feb 23 closing value to proper float
        let feb_23_closing = 0;
        if (data && data.data && Array.isArray(data.data) && data.data.length > 0) {
            let feb_23_closing_raw = data.data[0]["Feb 2023 Closing Balance"];
            feb_23_closing = toNumberIfPossible(feb_23_closing_raw);
        }

        // Handle invalid response - only process if valid data exists
        if (data && data.code !== 400 && data.data && Array.isArray(data.data) && data.data.length > 0) {
            for (const item of data.data) {
                normalizeNumericFields(item, NUMERIC_LEDGER_FIELDS);
                autoNormalizeRow(item);
                result.push(item);
                const val = typeof item["Confirmed Payout"] === "number" ? item["Confirmed Payout"] : 0;
                total_payable_amount += val;
                if (item["Status"] == "Pending Bank Validation" && isCurrentOrPreviousMonth(item["Claim month"])) {
                    const claim_payout = typeof item["Claim Payout"] === "number" ? item["Claim Payout"] : 0;
                    max_payout_on_not_found_claims += claim_payout
                }
            }
            const totalPages = data.pagecount;

            // If more pages, fetch the rest in parallel
            if (totalPages > 1) {
                const promises = [];

                for (let page = 2; page <= totalPages; page++) {
                    promises.push(
                        getLedgerDetails({
                            i_vendor_id: netsuite_vendor_id,
                            Claim_month: claim_month || "",
                            Page_index: page
                        })
                    );
                }
                //TODO: handle if promise.all fails
                const responses = await Promise.all(promises);

                for (const res of responses) {
                    if (res && res.data && Array.isArray(res.data)) {
                        for (const item of res.data) {
                            normalizeNumericFields(item, NUMERIC_LEDGER_FIELDS);
                            autoNormalizeRow(item);
                            if (item["Status"] == "Pending Bank Validation" && isCurrentOrPreviousMonth(item["Claim month"])) {
                                const claim_payout = typeof item["Claim Payout"] === "number" ? item["Claim Payout"] : 0;
                                max_payout_on_not_found_claims += claim_payout
                            }
                            result.push(item);
                            const val = typeof item["Confirmed Payout"] === "number" ? item["Confirmed Payout"] : 0;
                            total_payable_amount += val;
                        }
                    }
                }
            }
        }

        const balance_1 = total_payable_amount + feb_23_closing - total_paid_amount
        const balance_2 = balance_1 + max_payout_on_not_found_claims

        const summaryData = [
            { 'Summary': 'Total Payout Since Mar 23', 'Value': total_payable_amount },
            { 'Summary': 'Feb 23 Closing', 'Value': feb_23_closing },
            { 'Summary': 'Payment Since Apr 23', 'Value': total_paid_amount },
            { 'Summary': 'Balance 1', 'Value': balance_1 },
            { 'Summary': 'Max payout on not found cases', 'Value': max_payout_on_not_found_claims },
            { 'Summary': 'Balance 2', 'Value': balance_2 }
        ];
        summaryData.forEach((row) => {
            row.Value = toNumberIfPossible(row.Value);
        });

        // Apply masking 
        await removeColumnsFromArray(result, user?.role, is_crm_request);

        let url = await uploadArrayToS3(result, 'leader_download', "xls")
        let urlPayment = await uploadArrayToS3(payment, 'leader_payment_download', "xls")
        let urlSummary = await uploadArrayToS3(summaryData, 'leader_summary_download', "xls")

        const vendor = vendor_name ? vendor_name.replace(/\s+/g, '-') : netsuite_vendor_id;

        let attachments = [
            {
                filename: `LEDGER_REPORT_${vendor}.xls`,
                path: url
            },
            {
                filename: `PAYMENT_LEDGER_REPORT_${vendor}.xls`,
                path: urlPayment
            }
        ]
        if (!claim_month) {
            attachments.push({
                filename: `SUMMARY_REPORT_${vendor}.xls`,
                path: urlSummary
            })
        }
        let sendArray = [user.userEmail, ...(cc_emails || [])]
        const vendorDisplayName = vendor_name ? `Vendor Name: ${vendor_name}` : `Netsuite Vendor Id: ${netsuite_vendor_id}`;
        sendEmailWithAttachment(attachments, {
            to: sendArray.join(","),
            subject: `Attention: Ledger of (${vendorDisplayName})`,
            body: `Here is the Ledger Data Download for ${vendorDisplayName}`,
        });

        //--------------logs of process start-------------//
        let query = ` insert into application_logs (application_type,application_id,field,from_value,to_value,updated_by) values ('get_ledger_api_new',?,?,?,?,uuid_to_bin(?)) `;
        let bindParams = [netsuite_vendor_id, 'process', 'processing ended', '', user.id]
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
        //-------------------------------------------------//

    } catch (e) {
        console.log(e)
    }
}

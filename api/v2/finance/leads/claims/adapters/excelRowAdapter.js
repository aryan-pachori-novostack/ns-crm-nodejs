const { format } = require('date-fns');
let uuid = require('node-uuid');

const { buildClaimContext } = require("../claimContext");
const { EXCEL_SHARING_KEYS, readSharingColumn } = require("../payoutSharing");
const { findBankNameById, findProductNameById } = require("../../../../../services/lead-services");

const DEFAULT_BUSINESS_CATEGORY = 11;
const YES_VARIANTS = ['yes', 'y'];
const NO_VARIANTS = ['no', 'n'];

/** DD/MM/YYYY */
const isValidDateFormat = (inputString) =>
    /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(inputString);

const parseDateFromString = (dateString) => {
    const [day, month, year] = dateString.split('/');
    // Months are zero-based in the JS Date object, so we subtract 1
    return new Date(year, month - 1, day);
};

/**
 * Parse the Excel disbursement date — either `DD/MM/YYYY` or an Excel serial number.
 *
 * ⚠ **Never throws.** Returning a marker instead of raising is the whole point: in the
 * pre-migration pipeline this parsing sat 22nd in the validator chain, so a row with a
 * bad date *and* a missing borrower name reported the *name* error. If the adapter threw,
 * that row's message in the user-facing S3 report would silently change. The parse result
 * is carried on `input` and raised by `DisbursementDateValidator` at its original
 * position. The gate fixture has a row pinning exactly this.
 */
const parseDisbursementDate = (rawDate) => {
    if (!rawDate) return { display: '', iso: '', isFuture: false };

    try {
        let date;
        if (isValidDateFormat(rawDate)) {
            date = new Date(parseDateFromString(rawDate));
        } else {
            // Excel serial date -> JS date (Excel's base is 1899-12-30)
            date = new Date(Date.UTC(1899, 11, 30));
            date.setDate(date.getDate() + rawDate);
        }

        // Formatted as "29-Sep-2023 00:00:00", matching what is stored today.
        const display = format(date, 'dd-MMM-yyyy HH:mm:ss', { locale: require('date-fns/locale/en-US') });
        const inputDate = new Date(display);
        const iso = `${inputDate.getFullYear()}-${String(inputDate.getMonth() + 1).padStart(2, '0')}-${String(inputDate.getDate()).padStart(2, '0')}`;

        return { display, iso, isFuture: inputDate > new Date() };
    } catch (err) {
        return { display: '', iso: '', isFuture: false, parseError: err.message };
    }
};

/** Trimmed string or null — the shape every optional contact field uses. */
const trimmedOrNull = (value) => (value ?? '').toString().trim() || null;

/**
 * Excel row -> `LeadClaimContext`.
 *
 * Absorbs what `RowFieldExtractionValidator` used to do (lifting every column the
 * pipeline reads) plus the date and yes/no parsing, so that all shape-handling for this
 * channel lives in one place and the validators downstream are channel-agnostic.
 *
 * `derived` is populated alongside `input` and holds the same values under the legacy
 * names. That is a deliberate, temporary bridge: validators still read `derived`, and
 * PLAN-0006/T08 migrates them to `input` and drops the duplication. Both are written from
 * one source here, so they cannot drift in the meantime.
 */
const buildExcelClaimContext = async (row, rowIndex, jobMeta) => {
    const { leader, file_name, lead_admin_dsa_id, parent_user, isExternal, isFinanceRoot } = jobMeta;

    const [bank, product] = await Promise.all([
        row?.bank_nbfc_id ? findBankNameById(row.bank_nbfc_id) : null,
        row?.product_id ? findProductNameById(row.product_id) : null
    ]);

    const confirmationRaw = (row.confirmation_required ?? '').toString().trim().toLowerCase();
    const disbursement = parseDisbursementDate(row.disb_date);

    let ns_contest_id = row.participating_contest ? Number(row.participating_contest) : null;
    if (ns_contest_id === 0) ns_contest_id = null;   // 0 means "no contest"

    const input = {
        fresh_lead_id: uuid(),
        loan_reference_id: row.loan_app_no ? row.loan_app_no.toString() : '',
        loan_apac_ref_los_number: row.los_apac_no,
        customer_full_name: row.borrower_name,
        customer_first_name: row.borrower_first_name,
        customer_last_name: row.borrower_last_name,
        customer_company_name: row.borrower_company_name,
        disbursement_amount: row.disbursement_insurance_amount,
        disbursement_date: disbursement.display,
        disbursement_date_iso: disbursement.iso,
        disbursement_date_is_future: disbursement.isFuture,
        // Whether a date was SUPPLIED, independent of whether it parsed. The
        // mandatory-date checks test presence, not validity: a row carrying an
        // unparseable date has still supplied one, and must fall through to the later
        // mandatory-field checks rather than being rejected as "date missing".
        disbursement_date_provided: Boolean(row.disb_date),
        city: row.city,
        netsuite_bank_id: row.bank_nbfc_id,
        netsuite_product_id: row.product_id,
        bank_name: bank?.bank_name || row.bank_nbfc_name,
        product_name: product?.product_name || row.product_name,
        payout_type: row.vendor_payout_type,
        payout_rate: row.rate,
        payout_ratio: row.vendor_payout_ratio,
        business_categories: row.business_categories ? Number(row.business_categories) : DEFAULT_BUSINESS_CATEGORY,
        is_split_case: row.is_split_case,
        leader_name: row.leader_name,
        sub_leader_name: row.sub_leader_name,
        bh_sub_leader: row.bh_name,
        vendor_remark: row.vendor_remark,
        ns_contest_id,
        vendor_pan: row.vendor_pan,
        // Header "Employee/TL PAN" -> `employee_tl_pan` (see decodeBase64AndReadXLSXForLeadForm).
        team_lead: row.employee_tl_pan,

        // Payout-sharing split case: the second DSA. Column names are centralised in
        // `payoutSharing.EXCEL_SHARING_KEYS` because they are the one thing here that
        // cannot be inferred from the codebase — a wrong header silently yields an
        // ordinary category-17 claim, which is why `PairCategoryComboValidator` rejects a
        // category-17 row that arrives without them.
        sharing_vendor_pan: trimmedOrNull(readSharingColumn(row, EXCEL_SHARING_KEYS.vendorPan)),
        sharing_payout_value: readSharingColumn(row, EXCEL_SHARING_KEYS.payoutValue),
        sharing_business_categories: readSharingColumn(row, EXCEL_SHARING_KEYS.businessCategories),

        banker_name: trimmedOrNull(row.sm_name),
        banker_email: trimmedOrNull(row.sm_mail_id),
        banker_mobile: trimmedOrNull(row.sm_mobile),
        asm_name: trimmedOrNull(row.asm_name),
        asm_email: trimmedOrNull(row.asm_mail_id),
        asm_mobile: trimmedOrNull(row.asm_mobile),
        cc_email: (row.cc_ids ?? row["cc_id's"] ?? '').toString().trim() || null,
        // Bulk upload strips only the constant — the behaviour on this path today. The
        // template promises the banker's and uploader's addresses are removed too; that
        // is a real bug, tracked separately, deliberately NOT fixed here because it would
        // change the gate's byte-for-byte output.
        cc_email_remove: ["cc@ruloans.com"],
        confirmation_required: YES_VARIANTS.includes(confirmationRaw),
        confirmation_required_raw: confirmationRaw,
        confirmation_required_is_valid: !confirmationRaw || YES_VARIANTS.includes(confirmationRaw) || NO_VARIANTS.includes(confirmationRaw)
    };

    const source = {
        channel: "upload_excel",
        mode: "create",
        isExternal: Boolean(isExternal),
        platform: isExternal ? "web_application" : "crm",
        formType: "upload_excel",
        apiPath: "dsa/uploadleadformdata",
        actor: leader,
        parentActor: parent_user,
        leadAdminDsaId: lead_admin_dsa_id,
        targetFreshLeadId: null,
        fileName: file_name,
        rowIndex,
        isFinanceRoot: Boolean(isFinanceRoot)
    };

    const ctx = buildClaimContext({ source, input, raw: { row } });

    // `derived` is built centrally by buildClaimContext. `ctx.row`/`ctx.job` remain
    // aliased here because they are Excel-only report/job bookkeeping.
    ctx.row = row;
    // Report bookkeeping, not claim data: a row that survives the pipeline shows a blank
    // error in the output file. Set here rather than mid-pipeline so no shared validator
    // has to know this channel writes a report at all. A failure overwrites it anyway.
    row.error = ' ';
    // Seeded on EVERY row, not just sharing ones: `uploadArrayToS3` derives the report
    // header from `Object.keys(array[0])` — row 0 alone — so a column that only appears on
    // some rows is invisible whenever the first row is not one of them.
    row.payout_sharing_lead_ids = ' ';
    ctx.job = jobMeta;
    ctx.rowIndex = rowIndex;
    return ctx;
};

module.exports = { buildExcelClaimContext, parseDisbursementDate };

const { v4: uuidv4 } = require('uuid');
const { toIsoDateIST, formatDateIndianFormat } = require("../../../../../helpers/commonhelper");
const { buildClaimContext } = require("../claimContext");

const DEFAULT_BUSINESS_CATEGORY = 11;

/** Trimmed string or null — same normalisation the Excel adapter applies. */
const trimmedOrNull = (value) => (value ?? '').toString().trim() || null;

/**
 * Manual lead-form HTTP body -> `LeadClaimContext`.
 *
 * The counterpart to `excelRowAdapter`. Between them they are the whole answer to "at the
 * crux both flows are the same": two very different payload shapes reduced to one
 * canonical `input`, after which a single validator chain and a single write path serve
 * both. Every key-renaming and type-coercion decision for this channel lives here.
 *
 * Field-name differences this collapses (manual -> canonical):
 *   bank_id            -> netsuite_bank_id
 *   loan_number        -> loan_reference_id
 *   apac_ref_los_number-> loan_apac_ref_los_number
 *   first_name/last_name -> customer_first_name/customer_last_name (+ derived full name)
 *   company_name       -> customer_company_name
 *
 * Identity also differs and that is intentional, not an inconsistency: the Excel row
 * identifies its vendor by **PAN**, the lead form by **mobile number** (or `company_id`
 * when `is_company`). `vendor_lookup` carries the strategy so a single shared
 * `VendorResolutionValidator` can serve both without branching on channel.
 *
 * ⚠ Like the Excel adapter, this **never throws**. Joi has already rejected malformed
 * payloads at the HTTP boundary, but keeping the same contract means the shared
 * validators stay the only place that produces user-facing errors, in one known order.
 */
const buildLeadFormClaimContext = (req, { isFinanceRoot = false } = {}) => {
    const body = req?.body || {};
    const isExternal = Boolean(req?.dsa && !req?.loggedInUser);
    const isCompany = Boolean(body.is_company);

    // The external route has NO actor: `authorizeDsaCentralized` sets `req.dsa` and never
    // `req.loggedInUser`. The actor is synthesised by `ExternalActorValidator` in
    // `leadFormPipeline` — AFTER the vendor is resolved — because main derived it from the
    // resolved vendor, not from the token. Synthesising it here from `req.dsa` was wrong on
    // both counts: `dsa_details` exposes `dsa_full_name`, not `full_name` (so `userName` came
    // out undefined), and setting the actor here made the validator short-circuit.
    const loggedInUser = req?.loggedInUser || null;

    const firstName = body.first_name;
    const lastName = body.last_name;

    const input = {
        fresh_lead_id: body.fresh_lead_id || uuidv4(),

        loan_reference_id: body.loan_number,
        loan_apac_ref_los_number: body.apac_ref_los_number,

        customer_first_name: firstName,
        customer_last_name: lastName,
        // The manual flow has no single "full name" field; it has always been derived.
        customer_full_name: `${firstName || ''} ${lastName || ''}`.trim(),
        customer_company_name: body.company_name,

        disbursement_amount: body.disbursement_amount,
        // Mirrors the manual service exactly: ISO via toIsoDateIST, display via
        // formatDateIndianFormat, and null display when no date was supplied.
        disbursement_date: body.disbursement_date ? formatDateIndianFormat(body.disbursement_date) : null,
        disbursement_date_iso: toIsoDateIST(body.disbursement_date),
        disbursement_date_provided: Boolean(body.disbursement_date),
        disbursement_date_is_future: false,

        city: body.city,
        netsuite_bank_id: body.bank_id,
        netsuite_product_id: body.netsuite_product_id,
        bank_name: body.bank_name,
        product_name: body.product_name,

        payout_type: body.payout_type,
        payout_rate: body.payout_rate,
        payout_ratio: body.payout_ratio,

        business_categories: body.business_categories ? Number(body.business_categories) : DEFAULT_BUSINESS_CATEGORY,
        // Joi gives a boolean here; the column stores yes/no text. Emit lowercase to
        // match what `toLowerOrNull` persists and what every reader compares against.
        is_split_case: body.is_split_case ? "yes" : "no",
        ns_contest_id: body.ns_contest_id || null,
        vendor_remark: body.vendor_remark,
        team_lead: trimmedOrNull(body.team_lead),

        banker_name: trimmedOrNull(body.banker_name),
        banker_email: trimmedOrNull(body.banker_email),
        banker_mobile: trimmedOrNull(body.banker_mobile),
        asm_name: trimmedOrNull(body.asm_name),
        asm_email: trimmedOrNull(body.asm_email),
        asm_mobile: trimmedOrNull(body.asm_mobile),
        cc_email: trimmedOrNull(body.cc_email),
        // Restores what AddFreshLeadClaim/editFreshLeadClaim did: strip the constant, the
        // banker's address and the uploader's own. Routing this flow through the shared
        // mapper without declaring it silently dropped the last two (RV1-F1).
        cc_email_remove: ["cc@ruloans.com", trimmedOrNull(body.banker_email), loggedInUser?.userEmail],
        expected_billing_month: body.expected_billing_month || null,

        confirmation_required: Boolean(body.confirmation_required),
        // Joi already constrained this to a boolean, so it cannot be an invalid string
        // the way the Excel yes/no column can.
        confirmation_required_is_valid: true,

        // Edit-only columns with no Excel equivalent. They must survive a round trip, or
        // a manual edit through a shared write path would silently null them.
        send_email: body.send_email,
        pf_collected: body.pf_collected,
        loan_type: body.loan_type,

        // Payout-sharing split case: the second DSA. Create-only — edit never rebuilds a
        // pair (sharing fields are also Joi-stripped when `fresh_lead_id` is present).
        // On create, the CRM form shows these three only when business category 17 is
        // selected and clears them when it is not — see `add.js`. The backend does not
        // trust that: `PairCategoryComboValidator` rejects sharing fields on any other
        // category, and rejects category 17 without them.
        ...(body.fresh_lead_id ? {} : {
            sharing_vendor_pan: trimmedOrNull(body.sharing_vendor_pan),
            sharing_payout_value: body.sharing_payout_value,
            sharing_business_categories: body.sharing_business_categories
        }),

        // How to resolve the vendor for this channel.
        vendor_lookup: isCompany
            ? { by: "company_id", value: body.company_id }
            : { by: "mobile", value: body.dsa_mobile_number },

        // `leader_name`, `sub_leader_name`, `bh_sub_leader` and `upload_file_name` are
        // deliberately ABSENT, not null.
        //
        // They previously sat here as explicit `null`s with a comment claiming that avoided
        // clobbering an Excel-created claim. It did the opposite: `claimRowMapper` included
        // them unconditionally, so `UPDATE … SET leader_name = NULL, upload_file_name = NULL`
        // ran on every manual edit and destroyed the upload provenance of Excel-created
        // claims — the dominant channel. `main`'s edit never touched those columns.
        //
        // Leaving them undefined lets the mapper tell "this channel does not own the column"
        // from "this channel wants it cleared", which is the whole point of the key-driven
        // UPDATE. Same fix as `pf_collected`/`loan_type`.
    };

    const source = {
        channel: "lead_form",
        mode: body.fresh_lead_id ? "update" : "create",
        isExternal,
        platform: body.platform || "crm",
        formType: "lead_form",
        apiPath: "dsa/addfreshleadclaim",
        actor: loggedInUser,
        parentActor: null,
        leadAdminDsaId: loggedInUser?.dsa_id || null,
        targetFreshLeadId: body.fresh_lead_id || null,
        fileName: null,
        rowIndex: null,
        isFinanceRoot: Boolean(isFinanceRoot)
    };

    const ctx = buildClaimContext({ source, input, raw: { body, req } });

    // `derived` is seeded centrally by buildClaimContext. `ctx.job` is still needed
    // because claimRowMapper reads leader/parent_user/file_name from it — that is the
    // last Excel-shaped read left in the shared write path.
    ctx.job = {
        leader: loggedInUser,
        parent_user: null,
        file_name: null,
        isExternal
    };
    return ctx;
};

module.exports = { buildLeadFormClaimContext };

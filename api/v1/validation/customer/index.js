let Joi = require("joi");

exports.createCustomerWithPan = Joi.object({
    customer_mobile_number: Joi.string().required(),
    pan: Joi.string().required(),
});

exports.createCustomerBasicDetails = Joi.object({
    first_name: Joi.string().required(),
    middle_name: Joi.string().allow(null, ""),
    last_name: Joi.string().required(),
    father_name: Joi.string().allow(null, ""),
    mother_name: Joi.string().allow(null, ""),
    email: Joi.string().required(),
    dob: Joi.string().required(),
    customer_mobile_number: Joi.string().required(),
    pan: Joi.string().required(),
    dsa_mobile_number: Joi.string().required(),
    fresh_lead_id: Joi.string().allow(null, ""),
    customer_id: Joi.string().required(),
    otp: Joi.string().allow(null, ""),
    otp_verified: Joi.number().required(),
    is_company: Joi.boolean().optional(),
    company_id: Joi.string().when('is_company', {
        is: true,
        then: Joi.string().required(),
        otherwise: Joi.string().optional().allow(null, "")
    })
});

exports.createCustomerAddressDetails = Joi.object({
    id: Joi.number().allow(null, ""),
    customer_id: Joi.string().required(),
    address_type: Joi.string().allow(null, ""),
    house_number: Joi.string().allow(null, ""),
    apartment_name: Joi.string().allow(null, ""),
    area: Joi.string().allow(null, ""),
    pincode: Joi.string().required(),
    state: Joi.string().required(),
    city: Joi.string().required(),
    fresh_lead_id: Joi.string().allow(null, ""),
});

exports.createCustomerCompanyDetails = Joi.object({
    id: Joi.number().allow(null, ""),
    customer_id: Joi.string().required(),
    profession_type: Joi.number().required(),
    company_name: Joi.string().required(),
    monthly_income: Joi.number().required(),
    office_address_type: Joi.string().allow(null, ""),
    office_house_number: Joi.string().allow(null, ""),
    office_apartment_name: Joi.string().allow(null, ""),
    office_area: Joi.string().allow(null, ""),
    office_pincode: Joi.string().required(),
    state: Joi.string().required(),
    city: Joi.string().required(),
    customer_mobile_number: Joi.string().required(),
    fresh_lead_id: Joi.string().allow(null, ""),
});

exports.createCustomerLoanDetails = Joi.object({
    fresh_lead_id: Joi.string().required(),
    dsa_mobile_number: Joi.string().allow(null, ""),
    product_name: Joi.string().allow(null, ""),
    product_id: Joi.string().required(),
    netsuite_product_id: Joi.string().optional().allow(null, ""),
    bank_name: Joi.string().required(),
    bank_id: Joi.string().required(),
    claim_month: Joi.string().optional().allow(null, ""),
    claim_year: Joi.string().allow(null, ""),
    loan_number: Joi.string().required().allow(null, ""),
    apac_ref_los_number: Joi.string().required().allow(null, ""),
    loan_amount: Joi.string().required(),
    status: Joi.string().required(),
    user_remarks: Joi.string().allow(null, ""),
    disbursement_amount: Joi.string().allow(null, ""),
    disbursement_date: Joi.string().allow(null, ""),
    reject_reason: Joi.string().allow(null, ""),
    netsuite_vendor_id: Joi.string().required(),
    is_split_case: Joi.boolean().allow(null, ""),
    business_categories: Joi.string().required(),
    confirmation_required: Joi.boolean().required(),
    send_email: Joi.boolean().optional().allow(null, ""),
    city: Joi.string().required().allow(null, ""),
    banker_name: Joi.string().allow(null, ""),
    banker_email: Joi.string().email().allow(null, ""),
    banker_mobile: Joi.string().allow(null, ""),
    asm_name: Joi.string().allow(null, ""),
    asm_email: Joi.string().email().allow(null, ""),
    asm_mobile: Joi.string().allow(null, ""),
    cc_email: Joi.string().allow(null, ""),
    platform: Joi.string().allow(null, ""),
    vendor_remark: Joi.string().allow(null, ""),
    ns_contest_id: Joi.number().allow("", null),
    created_at: Joi.string().allow(null, ""),
    updated_at: Joi.string().allow(null, ""),
});

exports.sendConsentOtp = Joi.object({
    mobile_number: Joi.string().required(),
});

exports.updateLoanStatus = Joi.object({
    id: Joi.number().required(),
    status: Joi.string().required(),
    disbursement_amount: Joi.string().allow(null, ""),
    disbursement_date: Joi.string().allow(null, ""),
    reject_reason: Joi.string().allow(null, ""),
    loan_reference_id: Joi.string().allow(null, ""),
    fresh_lead_status_id: Joi.number().allow(null, ""),
    updated_by: Joi.string().allow(null, ""),
});

exports.updateLeadFormExternal = Joi.object({
    fresh_lead_id: Joi.string().required(),
    loan_reference_id: Joi.string().required(),
});

exports.sendQueryReply = Joi.object({
    id: Joi.string().required(),
    reply: Joi.string().required(),
    title: Joi.string().required(),
    email: Joi.string().required(),
    status: Joi.string().allow(null, ""),
});

exports.getQueryByCustomerId = Joi.object({
    customer_id: Joi.string().required(),
});

exports.getCustomerLeadsByCustomerId = Joi.object({
    customer_id: Joi.string().required(),
});
exports.sendOtp = Joi.object({
    mobile_number: Joi.string().required(),
});

exports.verifyCustomerOtp = Joi.object({
    mobile_number: Joi.string().required(),
    otp: Joi.string().required(),
    customer_id: Joi.string().required(),
    type: Joi.string().allow(null, ""),
});

exports.manageCustomerMobileOtpExternal = Joi.object({
    customer_id: Joi.string().required(),
    type: Joi.string().valid('send', 'resend', 'verify').required(),
    mobile_number: Joi.string().pattern(/^\d{10}$/).optional().allow(null, ''),
    otp: Joi.string().optional().allow(null, ''),
});

exports.getCustomerByIdExternal = Joi.object({
    customerId: Joi.string().required()
});

exports.getCustomerMobileHistoryExternal = Joi.object({
    type: Joi.string().valid('logs', 'trail').required(),
    customer_id: Joi.string().required(),
    pageNumber: Joi.number().allow(null, ''),
    pageSize: Joi.number().allow(null, ''),
});

exports.getCustomerByDsaExternal = Joi.object({
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
});

exports.toggleNotificationCustomer = Joi.object({
    dsa_id: Joi.string().allow(null, ""),
    customer_id: Joi.string().allow(null, ""),
    email_communication: Joi.number().valid(0, 1).allow(null, ""),
    whatsapp_communication: Joi.number().valid(0, 1).allow(null, ""),
    sms_communication: Joi.number().valid(0, 1).allow(null, ""),
    notification_communication: Joi.number().valid(0, 1).allow(null, ""),
});

exports.getLoanDetails = Joi.object({
    app_id_exact: Joi.string().allow(null, ""),
    application_id: Joi.string().allow(null, ""),
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    search: Joi.string().allow(null, ""),
    customer_id: Joi.string().allow(null, ""),
    dsa_id: Joi.string().allow(null, ""),
    status: Joi.string().allow(null, ""),
    sub_status: Joi.string().allow(null, ""),
    product_id: Joi.number().allow(null, ""),
    loan_type_id: Joi.number().allow(null, ""),
    city: Joi.string().allow(null, ""),
    state: Joi.string().allow(null, ""),
    pincode: Joi.string().allow(null, ""),
    income_type: Joi.string().allow(null, ""),
    date_of_birth: Joi.string().allow(null, ""),
    is_consent_given: Joi.number().valid(0, 1).allow(null, ""),
    applied_loan_amount: Joi.string().allow(null, ""),
    loan_tenure: Joi.string().allow(null, ""),
    startDateFilter: Joi.string().allow(null, ""),
    endDateFilter: Joi.string().allow(null, ""),
    startUpdatedDateFilter: Joi.string().allow(null, ""),
    endUpdatedDateFilter: Joi.string().allow(null, ""),
    applied_loan_amount_min: Joi.number().allow(null, ""),
    applied_loan_amount_max: Joi.number().allow(null, ""),
    approved_loan_amount_min: Joi.number().allow(null, ""),
    approved_loan_amount_max: Joi.number().allow(null, ""),
    disbursed_loan_amount_min: Joi.number().allow(null, ""),
    disbursed_loan_amount_max: Joi.number().allow(null, ""),
    cibil_score_min: Joi.number().allow(null, ""),
    cibil_score_max: Joi.number().allow(null, ""),
    loan_tenure_min: Joi.number().allow(null, ""),
    loan_tenure_max: Joi.number().allow(null, ""),
    utm_source: Joi.string().allow(null, ""),
    utm_medium: Joi.string().allow(null, ""),
    utm_campaign: Joi.string().allow(null, ""),
    utm_content: Joi.string().allow(null, ""),
    utm_channel: Joi.string().allow(null, ""),
    utm_term: Joi.string().allow(null, ""),
    utm_id: Joi.string().allow(null, ""),
    campaignid: Joi.string().allow(null, ""),
    gad: Joi.string().allow(null, ""),
    gclid: Joi.string().allow(null, ""),
    fbclid: Joi.string().allow(null, ""),
    mt: Joi.string().allow(null, ""),
    ad: Joi.string().allow(null, ""),
    adpos: Joi.string().allow(null, ""),
    adgroupid: Joi.string().allow(null, ""),
    utm_adgroup: Joi.string().allow(null, ""),
    utm_main_source: Joi.string().allow(null, ""),
    utm_device: Joi.string().allow(null, ""),
    page_source: Joi.string().allow(null, ""),
    source_from: Joi.number().allow(null, ""),
    customerNameFilter: Joi.string().allow(null, ""),
    customerMobileFilter: Joi.string().allow(null, ""),
    emailFilter: Joi.string().allow(null, ""),
    dsaNameFilter: Joi.string().allow(null, ""),
    salespersonNameFilter: Joi.string().allow(null, ""),
    dsaMobileFilter: Joi.string().allow(null, ""),
    productNameFilter: Joi.string().allow(null, ""),
    loanTypeNameFilter: Joi.string().allow(null, ""),
    cityFilter: Joi.string().allow(null, ""),
    stateFilter: Joi.string().allow(null, ""),
    salespersonNameSearchFilter: Joi.string().allow(null, ""),
    callStatusLogFilter: Joi.string().allow(null, ""),
    leadStatusLogFilter: Joi.string().allow(null, ""),
    startDateCallLogFilter: Joi.string().allow(null, ""),
    endDateCallLogFilter: Joi.string().allow(null, ""),
    startDateSalespersonAssignedFilter: Joi.string().allow(null, ""),
    endDateSalespersonAssignedFilter: Joi.string().allow(null, ""),
    created_at: Joi.string().allow(null, ""),
    updated_at: Joi.string().allow(null, ""),
    reportFilters: Joi.object().allow(null, ""),
    // filterModel: Joi.object({
    //     items: Joi.array().items(
    //         Joi.object({
    //             field: Joi.string().required(),
    //             operator: Joi.string().required(),
    //             fromInput: Joi.string().allow(null, ""),
    //             id: Joi.number(),
    //             value: Joi.alternatives().try(
    //                 Joi.string().allow('', null),
    //                 Joi.number().allow(null),
    //                 Joi.boolean().allow(null),
    //                 Joi.object({
    //                     startDate: Joi.string().isoDate().allow(null, ''),
    //                     endDate: Joi.string().isoDate().allow(null, '')
    //                 }).allow(null),
    //                 Joi.array().items(Joi.string()).allow(null)
    //             ).default(null)
    //         })
    //     ).default([]),
    // }).optional().allow(null),
    filterModel: Joi.object().allow(null, '').optional(),
    logicOperator: Joi.string().valid("and", "or").allow(null, ""),
    is_export: Joi.boolean().optional().allow(null, ""),
    export_title: Joi.string().optional().allow(null, ""),
    filterModel: Joi.object().unknown(true).allow(null, "").optional(),
});
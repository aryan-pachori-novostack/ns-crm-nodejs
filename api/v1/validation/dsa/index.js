let Joi = require("joi");
const { filtersJoiObject } = require("../../../helpers/commonhelper");

const getRuloansCustomers = filtersJoiObject.append({
    previous_partner_name_col: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.string().valid("").allow(null)),
    user_type: Joi.string().allow(null, ''),
    old_new_dsa: Joi.number().valid(0, 1).optional(),
    old_new_dsa_filter: Joi.string().valid("New", "Old").insensitive().allow(null, ''),
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
    partnerNameFilter: Joi.string().allow(null, ''),
    salesperson_name_filter: Joi.string().allow(null, ''),
    joiningDateStartFilter: Joi.string().allow(null, ''),
    joiningDateEndFilter: Joi.string().allow(null, ''),
    statusUpdateDateStartFilter: Joi.string().allow(null, ''),
    statusUpdateDateEndFilter: Joi.string().allow(null, ''),
    signUpStepsFiltersStart: Joi.number().allow(null),
    signUpStepsFiltersEnd: Joi.number().allow(null),
    assignDateStartFilter: Joi.string().allow(null, ''),
    assignDateEndFilter: Joi.string().allow(null, ''),
    creditCardSubmited: Joi.number().allow(null, ''),
    loanSubmited: Joi.number().allow(null, ''),
    lntLoanSubmitted: Joi.number().allow(null, ''),
    userFilter: Joi.string().pattern(/^[0-9]+$/).allow(null, ""),
    search: Joi.string().allow(null, ''),
    customer_full_name_filter: Joi.string().allow(null, ''),
    pan_number_filter: Joi.string().allow(null, ''),
    profession_filter: Joi.string().allow(null, ''),
    partner_full_name_filter: Joi.string().allow(null, ''),
    business_head_name_filter: Joi.string().allow(null, ''),
    customer_mobile_number_filter: Joi.string().allow(null, ''),
    home_address_city_filter: Joi.string().allow(null, ''),
    home_address_state_filter: Joi.string().allow(null, ''),
    status_filter: Joi.string().allow(null, ''),
    sub_status_filter: Joi.string().allow(null, ''),
    utm_source_filter: Joi.string().allow(null, ''),
    utm_medium_filter: Joi.string().allow(null, ''),
    utm_campaign_filter: Joi.string().allow(null, ''),
    utm_channel_filter: Joi.string().allow(null, ''),
    utm_term_filter: Joi.string().allow(null, ''),
    utm_device_filter: Joi.string().allow(null, ''),
    utm_main_source_filter: Joi.string().allow(null, ''),
    dsa_verification_status_filter: Joi.string().allow(null, ''),
    user_type_filter: Joi.string().allow(null, ''),
    user_type: Joi.string().allow(null, ''),
    signup_steps_filter: Joi.string().allow(null, ''),
    joining_signed_filter: Joi.string().allow(null, ''),
    payout_signed_filter: Joi.string().allow(null, ''),
    zip_code_filter: Joi.string().allow(null, ''),
    query: Joi.string().allow(null, ''),
    consent_otp_verified_filter: Joi.string().allow(null, ''),
    allow_duplicates: Joi.boolean().allow(null, ''),
    call_created_order: Joi.string().allow(null, ''),
    email_address_filter: Joi.string().allow(null, ''),
    forChannelManager: Joi.boolean().allow(null, ''),
    previous_partner_name_filter: Joi.string().allow(null, ''),
    callPendingStartFilter: Joi.string().allow(null, ''),
    callPendingEndFilter: Joi.string().allow(null, ''),
    page_source_filter: Joi.string().allow(null, ''),
    company_name_filter: Joi.string().allow(null, ''),
    company_id: Joi.string().allow(null, ''),
    channel_manager_filter: Joi.string().allow(null, ''),
    referrer_name_filter: Joi.string().allow(null, ''),
    is_employee_filter: Joi.string().allow(null, ''),
    call_status: Joi.number().allow(null, ''),
    hierarchy_crm_filter: Joi.string().allow(null, ''),
    ns_hierarchy_filter: Joi.string().allow(null, ''),
    customer_id_filter: Joi.string().allow(null, ''),
    is_export: Joi.boolean().allow(null, ''),
    allow_duplicates: Joi.boolean().allow(null, ''),
    items: Joi.array().allow(null, ''),
    reportFilters: Joi.object().allow(null, ''),

});

const getRuloansCustomersKyc = Joi.object({
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
    customerId: Joi.string()
});

const updateBillerUniversal = Joi.object({
    biller_universal: Joi.boolean().required(),
    dsa_id: Joi.string().required(),
});

const getDsaCity = Joi.object({
    state: Joi.string().required()
});
const getAllPincodes = Joi.object({
    pincode_filter: Joi.string().allow(null, ""),
    office_name_filter: Joi.string().allow(null, ""),
    office_type_filter: Joi.string().allow(null, ""),
    city_filter: Joi.string().allow(null, ""),
    district_filter: Joi.string().allow(null, ""),
    state_filter: Joi.string().allow(null, ""),
    taluk_filter: Joi.string().allow(null, ""),
    circle_filter: Joi.string().allow(null, ""),
    region_filter: Joi.string().allow(null, ""),
    related_suboffice_filter: Joi.string().allow(null, ""),
    related_head_office_filter: Joi.string().allow(null, ""),
    country_filter: Joi.string().allow(null, ""),
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
});
const editOrDeletePincode = Joi.object({
    action: Joi.string().required(),
    data: Joi.object().optional(null, ""),
});
const addPincode = Joi.object({
    pincode: Joi.string()
        .pattern(/^[0-9]{6}$/)
        .required()
        .messages({
            'string.empty': 'Pincode is required',
            'string.pattern.base': 'Pincode must be exactly 6 digits',
        }),
    office_name: Joi.string().required(),
    office_type: Joi.string().required(),
    country: Joi.string().required(),
    city: Joi.string().required(),
    region: Joi.string().required(),
    circle: Joi.string().required(),
    taluk: Joi.string().required(),
    district: Joi.string().required(),
    state: Joi.string().required(),
    related_suboffice: Joi.string().allow('', null),
    related_head_office: Joi.string().allow('', null)
});

const getZipCodeList = Joi.object({
    state: Joi.string().allow(null, ''),
    city: Joi.string().allow(null, '')
});
const getDsaUserDetails = Joi.object({
    customerId: Joi.string().required()
});

const getCreditCardApplications = Joi.object({
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
    dsaId: Joi.string(),
    search: Joi.string().allow(null, ''),
    type: Joi.string().allow(null, ''),
    stateFilter: Joi.string().allow(null, ''),
    cityFilter: Joi.string().allow(null, ''),
    loanAmountFilterStart: Joi.number().allow(null),
    loanAmountFilterEnd: Joi.number().allow(null),
    suggestedBanksFilter: Joi.string().allow(null, '')
});

const getLntLoanApplications = Joi.object({
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
    dsaId: Joi.string(),
    search: Joi.string().allow(null, ''),
    type: Joi.string().allow(null, ''),
    stateFilter: Joi.string().allow(null, ''),
    cityFilter: Joi.string().allow(null, ''),
    loanAmountFilterStart: Joi.number().allow(null),
    loanAmountFilterEnd: Joi.number().allow(null),
    suggestedBanksFilter: Joi.string().allow(null, '')
});
const getCustomerUserDetails = Joi.object({
    customer_id: Joi.string().allow(null, ""),
    pan: Joi.string().required()
});
const getCustomerLoanApplications = Joi.object({
    pan: Joi.string().required(),
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
    search: Joi.string().allow(null, ''),
    type: Joi.string().allow(null, ''),
    loanAmountFilterStart: Joi.number().allow(null),
    loanAmountFilterEnd: Joi.number().allow(null),
    is_export: Joi.boolean().allow(null, ""),
});
const getCustomerLntApplications = Joi.object({
    pan: Joi.string().required(),
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
    search: Joi.string().allow(null, ''),
    type: Joi.string().allow(null, ''),
    loanAmountFilterStart: Joi.number().allow(null),
    loanAmountFilterEnd: Joi.number().allow(null)
});
const getCustomerLoanDocuments = Joi.object({
    applicationId: Joi.string().required()
});
const getAllCreditCardApplications = Joi.object({
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
    search: Joi.string().allow(null, ''),
    type: Joi.string().allow(null, ''),
    stateFilter: Joi.string().allow(null, ''),
    statusFilter: Joi.string().allow(null, ''),
    userFilter: Joi.string().allow(null, ''),
    cityFilter: Joi.string().allow(null, ''),
    loanAmountFilterStart: Joi.string().allow(null, ""),
    loanAmountFilterEnd: Joi.number().allow(null),
    suggestedBanksFilter: Joi.string().allow(null, ''),
    partnerNameFilter: Joi.string().allow(null, ''),
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    dsaMobileFilter: Joi.string().allow(null, ''),
    customerPanFilter: Joi.string().allow(null, ''),
    customerNameFilter: Joi.string().allow(null, ''),
    salaryFilter: Joi.string().allow(null, ''),
    tenureFilter: Joi.string().allow(null, ''),
    statusFilter: Joi.string().allow(null, ''),
    organizationFilter: Joi.string().allow(null, ''),
    customerMobileFilter: Joi.string().allow(null, ''),
    panFilter: Joi.string().allow(null, ''),
    dsaMobileFilter: Joi.string().allow(null, ''),
    is_export: Joi.boolean().allow(null, ''),
    count_only: Joi.boolean().allow(null, ''),
});

const getAllLoanApplications = filtersJoiObject.append({
    search: Joi.string().allow(null, ''),
    type: Joi.string().allow(null, ''),
    stateFilter: Joi.string().allow(null, ''),
    statusFilter: Joi.string().allow(null, ''),
    cityFilter: Joi.string().allow(null, ''),
    loanAmountFilterStart: Joi.string().allow(null, ''),
    loanAmountFilterEnd: Joi.number().allow(null),
    suggestedBanksFilter: Joi.string().allow(null, ''),
    partnerNameFilter: Joi.string().allow(null, ''),
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    dsaMobileFilter: Joi.string().allow(null, ''),
    customerPanFilter: Joi.string().allow(null, ''),
    customerNameFilter: Joi.string().allow(null, ''),
    salaryFilter: Joi.string().allow(null, ''),
    tenureFilter: Joi.string().allow(null, ''),
    organizationFilter: Joi.string().allow(null, ''),
    customerMobileFilter: Joi.string().allow(null, ''),
    is_export: Joi.boolean().allow(null, ''),
});

const getCustomerCity = Joi.object({
    state: Joi.string().required()
});

const getCustomers = filtersJoiObject.append({
    userFilter: Joi.string().pattern(/^[0-9]+$/).allow(null, ""),
    search: Joi.string().allow(null, ''),
    cityFilter: Joi.string().allow(null, ''),
    stateFilter: Joi.string().allow(null, ''),
    zipCodeFilter: Joi.string().allow(null, ''),
    verifiedMobileFilter: Joi.number(),
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    endUpdatedDateFilter: Joi.string().allow(null, ''),
    startUpdatedDateFilter: Joi.string().allow(null, ''),
    fullNameFilter: Joi.string().allow(null, ''),
    panFilter: Joi.string().allow(null, ''),
    customerMobileFilter: Joi.string().allow(null, ''),
    emailFilter: Joi.string().allow(null, ''),
    dsaMobileFilter: Joi.string().allow(null, ''),
    tagsFilter: Joi.string().allow(null, ''),
    dsaNameFilter: Joi.string().allow(null, ''),
    spMobileNumberFilter: Joi.string().allow(null, ''),
    spNameFilter: Joi.string().allow(null, ''),
    sp_unallocated: Joi.number().allow(null, ''),
    platform: Joi.string().allow(null, ''),
    salesHeadFilter: Joi.string().allow(null, ''),
    productFilter: Joi.number().allow(null, ''),
    statusFilter: Joi.string().allow(null, ''),
    call_status: Joi.number().allow(null, ''),
    deviceFilter: Joi.string().allow(null, ''),
    query: Joi.string().allow(null, ''),
});

const editCustomers = Joi.object({
    customerId: Joi.string().required(),
});


const getDsaTree = Joi.object({
    dsaId: Joi.string().required()
});

const getUnverifiedDsa = Joi.object({
    pageNumber: Joi.number(),
    search: Joi.string().allow(null, ''),
    verification: Joi.string().allow('unverified', 'verification', 'pending', 'verified', 'verify_by_hr', 'reject', 'verified_by_hr'),
    pageSize: Joi.number()
})

const updateDsaVerifyStatus = Joi.object({
    dsaId: Joi.string().required(),
    userId: Joi.string().required().allow(null, ''),
    status: Joi.string().required().allow('unverified', 'verification', 'pending', 'verified', 'verify_by_hr', 'reject', 'verified_by_hr')
})

const updateDsaAutoErpStatus = Joi.object({
    dsa_id: Joi.string().required(),
    is_auto_erp: Joi.number().required().valid(0, 1)
})

const getDsaUserCapturedDetailsPdf = Joi.object({
    dsaId: Joi.string().required()
})

const uploadDsaVerificationDocument = Joi.object({
    dsaId: Joi.string().required(),
    file: Joi.string().required()
})

const getDsaVerificationDocument = Joi.object({
    dsaId: Joi.string().required()
})

const downloadDsaList = Joi.object({
    pageNumber: Joi.number(),
    search: Joi.string().allow(null, ''),
    cityFilter: Joi.string().allow(null, ''),
    stateFilter: Joi.string().allow(null, ''),
    pinCodeFilter: Joi.string().allow(null, ''),
    agreementFilter: Joi.number().allow(null),
    partnerNameFilter: Joi.string().allow(null, ''),
    joiningDateStartFilter: Joi.string().allow(null, ''),
    joiningDateEndFilter: Joi.string().allow(null, ''),
    signUpStepsFiltersStart: Joi.number().allow(null),
    signUpStepsFiltersEnd: Joi.number().allow(null),
    verificationFilter: Joi.string().allow(null, '', 'unverified', 'verification', 'pending', 'verify_by_hr', 'verified', 'reject', 'verified_by_hr'),
    pageSize: Joi.number()
});
const downloadAllLoanApplicationsList = Joi.object({
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
    search: Joi.string().allow(null, ''),
    type: Joi.string().allow(null, ''),
    stateFilter: Joi.string().allow(null, ''),
    cityFilter: Joi.string().allow(null, ''),
    loanAmountFilterStart: Joi.number().allow(null),
    loanAmountFilterEnd: Joi.number().allow(null),
    suggestedBanksFilter: Joi.string().allow(null, '')
});

const downloadAllCreditCardApplicationsList = Joi.object({
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
    search: Joi.string().allow(null, ''),
    type: Joi.string().allow(null, ''),
    stateFilter: Joi.string().allow(null, ''),
    cityFilter: Joi.string().allow(null, ''),
    loanAmountFilterStart: Joi.number().allow(null),
    loanAmountFilterEnd: Joi.number().allow(null),
    suggestedBanksFilter: Joi.string().allow(null, '')
});

const reassignPartner = Joi.object({
    dsaId: Joi.string().allow(null, ""),
    partnerPhone: Joi.string().length(10).pattern(/^[0-9]+$/).allow(null, ''),
    dsaIdArray: Joi.array().allow(null, ""),
    query: Joi.string().allow(null, ""),
}).unknown(true);
const assignSalesPerson = Joi.object({
    crmId: Joi.string().required(),
    dsaIdArray: Joi.array().allow(null, "").optional(),
    query: Joi.object({
        items: Joi.array().items(
            Joi.object({
                field: Joi.string().required(),
                operator: Joi.string().valid(
                    'contains',
                    'doesNotContain',
                    'doesNotEqual',
                    'equals',
                    'startsWith',
                    'endsWith',
                    'isEmpty',
                    'isNotEmpty',
                    'isAnyOf',
                    'is',
                    'not',
                    'after',
                    'onOrAfter',
                    'before',
                    'onOrBefore',
                    'isEmpty',
                    'isNotEmpty'
                ).required(),
                fromInput: Joi.string().allow(null, ""),
                id: Joi.number(),
                value: Joi.alternatives().try(
                    Joi.string().allow('', null),
                    Joi.number().allow(null),
                    Joi.boolean().allow(null),
                    Joi.object({
                        startDate: Joi.string().isoDate().allow(null, ''),
                        endDate: Joi.string().isoDate().allow(null, '')
                    }).allow(null),
                    Joi.array().items(Joi.string()).allow(null)
                ).default(null)
            })
        ).default([]),
    }).default({ items: [] }),
});


const updateBhExternal = Joi.object({
    dsa_mobile: Joi.string().length(10).pattern(/^[0-9]+$/).allow(null, ''),
    partner_mobile: Joi.string().length(10).pattern(/^[0-9]+$/).allow(null, ''),
});

const getRuloansCustomersDropDown = Joi.object({
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
    search: Joi.string().allow(null, '')
});

const getLntApplicationById = Joi.object({
    application_id: Joi.string().required().pattern(/^[0-9]+$/)
})
const getCreditCardApplicationById = Joi.object({
    application_id: Joi.string().required().pattern(/^[0-9]+$/)
})
const getAllLntApplications = filtersJoiObject.append({
    search: Joi.string().allow(null, ''),
    partnerNameFilter: Joi.string().allow(null, ''),
    userFilter: Joi.string().pattern(/^[0-9]+$/).allow(null, ""),
    subStageFilter: Joi.string().allow(null, ''),
    stageFilter: Joi.string().allow(null, ''),
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    startDateFilterLogin: Joi.string().allow(null, ''),
    endDateFilterLogin: Joi.string().allow(null, ''),

    partnerCodeFilter: Joi.string().allow(null, ''),
    idFilter: Joi.string().allow(null, ''),
    appRefFilter: Joi.string().allow(null, ''),
    loanAmountFilter: Joi.string().allow(null, ''),
    employmentTypeFilter: Joi.string().allow(null, ''),
    annualIncomeFilter: Joi.string().allow(null, ''),
    loanTenureFilter: Joi.string().allow(null, ''),
    statusFilter: Joi.string().allow(null, ''),
    failureFilter: Joi.string().allow(null, ''),
    customerMobileFilter: Joi.string().allow(null, ''),
    customerEmailFilter: Joi.string().allow(null, ''),
    customerPanFilter: Joi.string().allow(null, ''),
    customerNameFilter: Joi.string().allow(null, ''),
    disbursedAmountFilter: Joi.string().allow(null, ''),
    is_export: Joi.boolean().allow(null, "")
})

const getAllFibeApplications = filtersJoiObject.append({
    search: Joi.string().allow(null, ''),
    appIdFilter: Joi.string().allow(null, ''),
    businessHeadFilter: Joi.string().allow(null, ''),
    customerNameFilter: Joi.string().allow(null, ''),
    panFilter: Joi.string().allow(null, ''),
    mobileFilter: Joi.string().allow(null, ''),
    agentIdFilter: Joi.string().allow(null, ''),
    agentNameFilter: Joi.string().allow(null, ''),
    agentMobileFilter: Joi.string().allow(null, ''),
    sanctionLimitFilter: Joi.string().allow(null, ''),
    professionFilter: Joi.string().allow(null, ''),
    stage_filter: Joi.string().allow(null, ''),
    reasonFilter: Joi.string().allow(null, ''),
    dsaNameFilter: Joi.string().allow(null, ''),
    dsaMobileFilter: Joi.string().allow(null, ''),
    principleLimitFilter: Joi.string().allow(null, ''),
    pricipleTenureFilter: Joi.string().allow(null, ''),
    is_export: Joi.boolean().allow(null, ""),
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    startDateFilterLogin: Joi.string().allow(null, ''),
    endDateFilterLogin: Joi.string().allow(null, ''),
    disburseAmountFilter: Joi.string().allow(null, ''),
    salaryFilter: Joi.string().allow(null, ''),
    esRefIdFilter: Joi.string().allow(null, ''),
    sub_stage_filter: Joi.string().allow(null, ''),
    stage_filter: Joi.string().allow(null, ''),
    status_filter: Joi.string().allow(null, ''),
    mobile_number_Filter: Joi.string().allow(null, ''),
});

const getAllBajajApplications = filtersJoiObject.append({
    search: Joi.string().allow(null, ''),
    application_id_filter: Joi.string().allow(null, ''),
    business_head_name_filter: Joi.string().allow(null, ''),
    customer_name_filter: Joi.string().allow(null, ''),
    pan_filter: Joi.string().allow(null, ''),
    mobile_number_Filter: Joi.string().allow(null, ''),
    partner_unique_id_filter: Joi.string().allow(null, ''),
    requested_loan_amount_filter: Joi.string().allow(null, ''),
    employment_type_filter: Joi.string().allow(null, ''),
    stage_filter: Joi.string().allow(null, ''),
    lan_filter: Joi.string().allow(null, ''),
    sub_stage_filter: Joi.string().allow(null, ''),
    response_message_filter: Joi.string().allow(null, ''),
    dsa_name_filter: Joi.string().allow(null, ''),
    dsa_mobile_number_filter: Joi.string().allow(null, ''),
    requested_tenor_filter: Joi.string().allow(null, ''),
    disburse_amount_filter: Joi.string().allow(null, ''),
    is_export: Joi.boolean().allow(null, ''),
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    startDateFilterLogin: Joi.string().allow(null, ''),
    endDateFilterLogin: Joi.string().allow(null, ''),
    status_filter: Joi.string().allow(null, ''),
    rm_name_filter: Joi.string().allow(null, ''),
    rm_number_filter: Joi.string().allow(null, ''),
    count_only: Joi.boolean().allow(null, ''),
});

const getAllPayUApplications = filtersJoiObject.append({
    search: Joi.string().allow(null, ''),
    application_id_filter: Joi.string().allow(null, ''),
    business_head_name_filter: Joi.string().allow(null, ''),
    customer_name_filter: Joi.string().allow(null, ''),
    pan_filter: Joi.string().allow(null, ''),
    phone_filter: Joi.string().allow(null, ''),
    approved_limit_filter: Joi.string().allow(null, ''),
    employment_type_filter: Joi.string().allow(null, ''),
    stage_filter: Joi.string().allow(null, ''),
    sub_stage_filter: Joi.string().allow(null, ''),
    status_filter: Joi.string().allow(null, ''),
    rejected_reason_filter: Joi.string().allow(null, ''),
    actions_required_filter: Joi.string().allow(null, ''),
    dsa_name_filter: Joi.string().allow(null, ''),
    dsa_mobile_number_filter: Joi.string().allow(null, ''),
    is_export: Joi.boolean().allow(null, ''),
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    startDateFilterLogin: Joi.string().allow(null, ''),
    endDateFilterLogin: Joi.string().allow(null, ''),
    email_filter: Joi.string().allow(null, ''),
    disburse_amount_filter: Joi.string().allow(null, ''),
    monthly_income_filter: Joi.string().allow(null, ''),
    app_reference_id_filter: Joi.string().allow(null, ''),
});

const getAllIndifiApplications = filtersJoiObject.append({
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    userFilter: Joi.string().pattern(/^[0-9]+$/).allow(null, ""),
    search: Joi.string().allow(null, ''),
    statusFilter: Joi.string().allow(null, ''),
    customerNameFilter: Joi.string().allow(null, ''),
    mobileNumberFilter: Joi.string().allow(null, ''),
    assignToFilter: Joi.string().allow(null, ''),
    assignByFilter: Joi.string().allow(null, ''),
    businessNameFilter: Joi.string().allow(null, ''),
    businessTypeFilter: Joi.string().allow(null, ''),
    offeredAmountFilter: Joi.string().allow(null, ''),
    dsaNameFilter: Joi.string().allow(null, ''),
    dsaMobileFilter: Joi.string().allow(null, ''),
    panFilter: Joi.string().allow(null, ''),
    requestedAmountFilter: Joi.string().allow(null, ''),
    tenureFilter: Joi.string().allow(null, ''),
    averageRevenueFilter: Joi.string().allow(null, ''),
    businessNatureFilter: Joi.string().allow(null, ''),
    segmentFilter: Joi.string().allow(null, ''),
    stateFilter: Joi.string().allow(null, ''),
    cityFilter: Joi.string().allow(null, ''),
    customerEmailFilter: Joi.string().allow(null, ''),
    count_only: Joi.boolean().allow(null, ''),
    applicationIdFilter: Joi.string().allow(null, ''),
    indifilApplicationIdFilter: Joi.string().allow(null, ''),
    startDisbursedDateFilter: Joi.string().allow(null, ''),
    endDisbursedDateFilter: Joi.string().allow(null, ''),
    is_export: Joi.boolean().allow(null, ""),
});

const getIndifiApplicationDetailsById = Joi.object({
    application_id: Joi.string().required(),
})

const getPayoutByPanNumber = Joi.object({
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
    panNumber: Joi.string().required()
})

/** B2B: single dsa_id to read vendor_code / branch_code from DB. */
const refreshDsaKycVendorBranchFromNs = Joi.object({
    dsa_id: Joi.string().trim().min(1).required()
});

const getLntForDashboard = Joi.object({
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    startDateLoginFilter: Joi.string().allow(null, ''),
    endDateLoginFilter: Joi.string().allow(null, ''),
    date: Joi.string().allow(null, ''),
    type: Joi.string().allow(null, '', 'disbursed', 'login'),
    application_type: Joi.string().allow(null, ''),
    getLntForDashboard: Joi.number().allow(null, ''),
    is_export: Joi.boolean().allow(null, ""),
});


const getAllPlForDashboard = Joi.object({
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    startDateLoginFilter: Joi.string().allow(null, ''),
    endDateLoginFilter: Joi.string().allow(null, ''),
    date: Joi.string().allow(null, ''),
    type: Joi.string().allow(null, '', 'disbursed', 'login'),
    application_type: Joi.string().allow(null, ''),
    getLntForDashboard: Joi.number().allow(null, ''),
    productId: Joi.number().required(),
    loan_type: Joi.string().allow(null, ''),
    is_export: Joi.boolean().allow(null, ""),
});

const getAllPayoutClaimForDashboard = Joi.object({
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    startDateLoginFilter: Joi.string().allow(null, ''),
    endDateLoginFilter: Joi.string().allow(null, ''),
    date: Joi.string().allow(null, ''),
    type: Joi.string().allow(null, '', 'disbursed', 'login'),
    is_export: Joi.boolean().allow(null, ""),
});


const getYearlyPlReport = Joi.object({
    productId: Joi.number().required(),
    loan_type: Joi.string().allow(null, ''),
});

const getIndifiForDashboard = Joi.object({
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    startDateLoginFilter: Joi.string().allow(null, ''),
    endDateLoginFilter: Joi.string().allow(null, ''),
    date: Joi.string().allow(null, ''),
    type: Joi.string().allow(null, '', 'disbursed', 'login'),
    is_export: Joi.boolean().allow(null, ""),
});

const updateChannelPartnerStatus = Joi.object({
    dsa_id: Joi.string().required(),
    status: Joi.number().required(),
    sub_status: Joi.number().allow(null, ""),
});

const getCreditCardForDashboard = Joi.object({
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    date: Joi.string().allow(null, ''),
});

const getAllCCForDashBoard = Joi.object({
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    date: Joi.string().allow(null, ''),
    productId: Joi.number().required(),
    is_export: Joi.boolean().allow(null, ""),
});

const uploadLeadFormData = Joi.object({
    base64: Joi.string().required(),
    file_name: Joi.string(),
    is_company: Joi.number().integer().valid(0, 1).optional()
});

const uploadInvoiceData = Joi.object({
    base64: Joi.string().required(),
    file_name: Joi.string()
});

const updateCCApplications = Joi.object({
    base64: Joi.string().required(),
    product: Joi.string().required(),
    file_name: Joi.string().required(),
    product_type: Joi.string().required(),
    product_id: Joi.number().required(),
});

const deleteLeadFormData = Joi.object({
    id: Joi.array().required(),
    isSelectAll: Joi.boolean().required(),
    status: Joi.number().valid(0, 1).required(),
    value: Joi.number().optional().allow(null, ""),
    remark: Joi.object().allow(null, ""),
});

const updateClaimPendingStatus = Joi.object({
    id: Joi.array().required(),
    value: Joi.number().required(),
});

const updateMultiFundedStatus = Joi.object({
    id: Joi.array().required(),
    value: Joi.number().required(),
    remark: Joi.object().allow(null, ""),
});

const moveToPendingLeadForm = Joi.object({
    id: Joi.array().required(),
});

const moveToPendingLeadFormBankerProcessed = Joi.object({
    id: Joi.string().required(),
    vendor_remark: Joi.string().allow('', null),
    claim_confirmation: Joi.string().allow('', null),
});

const getLoanForDashboard = Joi.object({
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, '')
});

const getApplicationCountForDashboard = Joi.object({
});

const getDsaTreeCount = Joi.object({
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    is_export: Joi.boolean().allow(null, ""),
});

const getLntApplicationStage = Joi.object({
});

const getLntApplicationSubStage = Joi.object({
});

const downloadDsaWithStep = Joi.object({
    startDateFilter: Joi.string().allow(null, ""),
    endDateFilter: Joi.string().allow(null, "")
});

const getDsaChild = Joi.object({
    partnerPhone: Joi.string().length(10).pattern(/^[0-9]+$/)
});

const getDsaIdByPhone = Joi.object({
    phone: Joi.string().length(10).pattern(/^[0-9]+$/)
});

const uploadDsaWithStep = Joi.object({
    base64: Joi.string().required()
})

const getGraphData = Joi.object({
    type: Joi.string().required(),
    startDateFilter: Joi.string().allow(null, ""),
    endDateFilter: Joi.string().allow(null, "")
})

const sendTextSms = Joi.object({
    number: Joi.string().length(10).pattern(/^[0-9]+$/)
})

const editSubAssignee = Joi.object({
    id: Joi.number().required(),
    sub_assignee: Joi.string().required(),
    table_name: Joi.string().required()
})

const editUserType = Joi.object({
    dsa_id: Joi.string().required(),
    user_type: Joi.string().required()
})

const getDsasByCompanyId = Joi.object({
    company_id: Joi.string().required(),
    pageNumber: Joi.number().default(0),
    pageSize: Joi.number().default(10),
    search: Joi.string().allow('', null)
})

const insertLastMonthsLntReport = Joi.object({
    date: Joi.string().required()
});

const insertLastMonthDashboardReport = Joi.object({
    date: Joi.string().required(),
    type: Joi.string().required()
});

const getCibilList = filtersJoiObject.append({
    customer_name: Joi.string().allow(null, ""),
    email: Joi.string().allow(null, ""),
    permanent_account_number: Joi.string().allow(null, ""),
    mobile_number: Joi.number().allow(null, ""),
    credit_score: Joi.number().allow(null, ""),
    count_only: Joi.boolean().allow(null, ""),
    partner_name: Joi.string().allow(null, ""),
    dsa_mobile_number: Joi.string().allow(null, ""),
    platform: Joi.string().allow(null, ""),
    startDateFilter: Joi.string().allow(null, ""),
    endDateFilter: Joi.string().allow(null, ""),
    business_head_name_filter: Joi.string().allow(null, ""),
    is_export: Joi.boolean().allow(null, ""),
});

const getCibilDetail = Joi.object({
    id: Joi.number().required(),
});

const sendPushNotification = Joi.object({
    body: Joi.string().required(),
    title: Joi.string().required(),
    dsa_mobile: Joi.string().allow(null, ''),
    stateFilter: Joi.string().allow(null, ''),
    cityFilter: Joi.string().allow(null, ''),
    partnerNameFilter: Joi.string().allow(null, ''),
    signUpStepsFiltersStart: Joi.number().allow(null, ''),
    signUpStepsFiltersEnd: Joi.number().allow(null, ''),
    verificationFilter: Joi.string().allow(null, ''),
    statusFilter: Joi.string().allow(null, ''),
    userFilter: Joi.string().allow(null, ''),
    image: Joi.string().allow(null, ''),
    url: Joi.string().allow(null, ''),
});

const sendAppNotification = Joi.object({
    filter: Joi.string().required().allow(""),
    channel: Joi.string().required(),
    body: Joi.string().required(),
    title: Joi.string().required(),
    image: Joi.string().allow(null, ''),
    url: Joi.string().allow(null, ''),
});

const getAllPayoutRequest = Joi.object({
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    hierarchyWise: Joi.boolean().allow(null, ""),
});

const getPersonalLoanMisForDsa = Joi.object({
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    joiningDateFilterStart: Joi.string().allow(null, ""),
    joiningDateFilterEnd: Joi.string().allow(null, ""),
    bhCode: Joi.string().allow(null, ""),
    utm_main_source: Joi.string().allow(null, ""),
    subProduct: Joi.string().allow(null, ""),
    loginDateFilterStart: Joi.string().allow(null, ""),
    loginDateFilterEnd: Joi.string().allow(null, ""),
    disbursedDateFilterStart: Joi.string().allow(null, ""),
    disbursedDateFilterEnd: Joi.string().allow(null, ""),
    is_export: Joi.boolean().allow(null, ""),
    city: Joi.string().allow(null, ""),
    state: Joi.string().allow(null, ""),
    status: Joi.string().allow(null, ""),
    sub_status: Joi.string().allow(null, ""),
});


const getPayoutRequest = Joi.object({
    dsaMobile: Joi.number().allow(null, ""),
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, "")
});

const getYearlyDashboardReport = Joi.object({
    type: Joi.string().allow("bajaj_credit_card", "indifi"),
});


const getDsaKycData = Joi.object({
    dsa_id: Joi.string().required(),
});

const uploadDsaKycData = Joi.object({
    dsa_id: Joi.string().required(),
    display_picture_filename: Joi.string().allow(null, ''),
    address_proof_front_image_filename: Joi.string().allow(null, ''),
    address_proof_back_image_filename: Joi.string().allow(null, ''),
    pan_card_front_image_filename: Joi.string().allow(null, ''),
    address_proof_number: Joi.string().allow(null, ''),
    permanent_account_number: Joi.string().allow(null, ''),
    company_gst_certificate_filename: Joi.string().allow(null, ''),
});

const getAllIncredApplications = filtersJoiObject.append({
    search: Joi.string().allow(null, ''),
    application_id_filter: Joi.string().allow(null, ''),
    business_head_name_filter: Joi.string().allow(null, ''),
    customer_name_filter: Joi.string().allow(null, ''),
    pan_filter: Joi.string().allow(null, ''),
    mobile_number_Filter: Joi.string().allow(null, ''),
    bank_account_holder_filter: Joi.string().allow(null, ''),
    bank_account_number_filter: Joi.string().allow(null, ''),
    bank_account_type_filter: Joi.string().allow(null, ''),
    ifsc_code_filter: Joi.string().allow(null, ''),
    requested_loan_amount_filter: Joi.string().allow(null, ''),
    employment_type_filter: Joi.string().allow(null, ''),
    stage_filter: Joi.string().allow(null, ''),
    sub_stage_filter: Joi.string().allow(null, ''),
    reason_filter: Joi.string().allow(null, ''),
    dsa_name_filter: Joi.string().allow(null, ''),
    dsa_mobile_number_filter: Joi.string().allow(null, ''),
    requested_tenor_filter: Joi.string().allow(null, ''),
    disburse_amount_filter: Joi.string().allow(null, ''),
    status_filter: Joi.string().allow(null, ''),
    is_export: Joi.boolean().allow(null, ''),
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    startDateFilterLogin: Joi.string().allow(null, ''),
    endDateFilterLogin: Joi.string().allow(null, ''),
    email_filter: Joi.string().allow(null, ''),
    emp_monthly_salary_filter: Joi.string().allow(null, ''),
    incred_application_id_filter: Joi.string().allow(null, ''),
});

const getAllCreditSaisonApplications = Joi.object({
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
    search: Joi.string().allow(null, ''),
    application_id_filter: Joi.string().allow(null, ''),
    business_head_name_filter: Joi.string().allow(null, ''),
    customer_name_filter: Joi.string().allow(null, ''),
    pan_filter: Joi.string().allow(null, ''),
    phone_number_filter: Joi.string().allow(null, ''),
    employment_type_filter: Joi.string().allow(null, ''),
    stage_filter: Joi.string().allow(null, ''),
    sub_stage_filter: Joi.string().allow(null, ''),
    status_filter: Joi.string().allow(null, ''),
    reason_filter: Joi.string().allow(null, ''),
    dsa_name_filter: Joi.string().allow(null, ''),
    dsa_mobile_number_filter: Joi.string().allow(null, ''),
    disburse_amount_filter: Joi.string().allow(null, ''),
    is_export: Joi.boolean().allow(null, ''),
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    startDateFilterLogin: Joi.string().allow(null, ''),
    endDateFilterLogin: Joi.string().allow(null, '')
});

const getAllCreditVidyaApplications = filtersJoiObject.append({
    search: Joi.string().allow(null, ''),
    application_id_filter: Joi.string().allow(null, ''),
    business_head_name_filter: Joi.string().allow(null, ''),
    customer_name_filter: Joi.string().allow(null, ''),
    pan_filter: Joi.string().allow(null, ''),
    mobile_number_filter: Joi.string().allow(null, ''),
    employment_type_filter: Joi.string().allow(null, ''),
    loan_amount_filter: Joi.string().allow(null, ''),
    stage_filter: Joi.string().allow(null, ''),
    sub_stage_filter: Joi.string().allow(null, ''),
    reject_reason_filter: Joi.string().allow(null, ''),
    dsa_name_filter: Joi.string().allow(null, ''),
    dsa_mobile_number_filter: Joi.string().allow(null, ''),
    disburse_amount_filter: Joi.string().allow(null, ''),
    status_filter: Joi.string().allow(null, ''),
    is_export: Joi.boolean().allow(null, ''),
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    startDateFilterLogin: Joi.string().allow(null, ''),
    endDateFilterLogin: Joi.string().allow(null, ''),
    count_only: Joi.boolean().allow(null, ''),
    mobile_number_filter: Joi.string().allow(null, ''),
    mobile_number_Filter: Joi.string().allow(null, ''),
});

const getStageFilterList = Joi.object({
    type: Joi.string().required(),
});

const sendSearchEngineOtp = Joi.object({
    mobile: Joi.string().pattern(/^[0-9]+$/).length(10).required(),
});

const verifySearchEngineOtp = Joi.object({
    mobile: Joi.string().pattern(/^[0-9]+$/).length(10).required(),
    otp: Joi.string().pattern(/^[0-9]+$/).length(6).required()
});

const getAllDsaLeads = Joi.object({
    dsa_id: Joi.string().required(),
});

const getLeadClaimUpdateLogs = Joi.object({
    id: Joi.string().required(),
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
    fields: Joi.array().items(Joi.string()).optional().allow(null)
});

const createCommunicationSettings = Joi.object({
    frequency: Joi.number().integer().allow(null, ''),
    from: Joi.string().allow(null, ''),
    to: Joi.string().allow(null, ''),
    template_id: Joi.string().required(),
    template: Joi.string().required()
});

const getLeadClaimUploadLogs = Joi.object({
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
    email_filter: Joi.string().allow(null, ''),
    name_filter: Joi.string().allow(null, ''),
    phone_filter: Joi.string().allow(null, ''),
    type_filter: Joi.string().allow(null, ''),
    application_id_filter: Joi.string().allow(null, ''),
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
});

const getDsaUploadLogs = Joi.object({
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
    application_type: Joi.string().required(),
    email_filter: Joi.string().allow(null, ''),
    application_id_filter: Joi.string().allow(null, ''),
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
});

const getCommunicationSettings = Joi.object({
});

const deleteCommunicationSettings = Joi.object({
    id: Joi.number().required(),
});

const createRemainder = Joi.object({
    created_for: Joi.string().allow(null, ""),
    message: Joi.string().required(),
    remainder_at: Joi.string().required(),
});

const getAllRemainder = Joi.object({
    pageNumber: Joi.number(),
    pageSize: Joi.number()
})

const getAllUpcomingRemainder = Joi.object({
    pageNumber: Joi.number(),
    pageSize: Joi.number()
})

const getAllMissedRemainder = Joi.object({
    pageNumber: Joi.number(),
    pageSize: Joi.number()
})

const deleteRemainder = Joi.object({
    remainder_id: Joi.number().required()
})

const getDsaDataForEdit = Joi.object({
    dsa_id: Joi.string().required()
})

const getDsaCityState = Joi.object({
    state: Joi.string().allow(null, "")
});

const createOrEditDsa = Joi.object({
    dsa_id: Joi.string().allow(null, ""),
    first_name: Joi.string().required(),
    middle_name: Joi.string().allow(null, ""),
    last_name: Joi.string().required(),
    email_address: Joi.string().email({ minDomainSegments: 2, tlds: { allow: ['com', 'net', 'in'] } }).required(),
    dsa_mobile_number: Joi.string().pattern(/^[0-9]{10}$/).required(),
    partner_code: Joi.string().required(),
    utm_main_source: Joi.string().allow(null, ""),
    consent_verified: Joi.string().allow(null, ""),
    gender: Joi.string().allow(null, ""),
    permanent_account_number: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/).allow(null, ""),
    last_status: Joi.string().allow(null, ""),
    bh_name: Joi.string().allow(null, ""),
    user_type: Joi.string().allow(null, ""),
    profession: Joi.string().allow(null, ""),
    potential: Joi.string().allow(null, ""),
    last_modified_by: Joi.string().allow(null, ""),
    dsa_status_updated_at: Joi.string().allow(null, ""),
    partner_assigned_date: Joi.string().allow(null, ""),
    date_of_birth: Joi.string().allow(null, ""),
    updated_at: Joi.string().allow(null, ""),
    utm_campaign: Joi.string().allow(null, ""),
    utm_channel: Joi.string().allow(null, ""),
    utm_medium: Joi.string().allow(null, ""),
    utm_source: Joi.string().allow(null, ""),
    utm_term: Joi.string().allow(null, ""),
    home_address_house_number: Joi.string().allow(null, ""),
    home_address_area: Joi.string().allow(null, ""),
    home_address_city: Joi.string().allow(null, ""),
    home_address_state: Joi.string().allow(null, ""),
    home_address_pincode: Joi.string().allow(null, ""),
    office_address_house_number: Joi.string().allow(null, ""),
    office_address_area: Joi.string().allow(null, ""),
    office_address_city: Joi.string().allow(null, ""),
    office_address_state: Joi.string().allow(null, ""),
    office_address_pincode: Joi.string().allow(null, ""),
    description: Joi.string().allow(null, ""),
    calling_note: Joi.string().allow(null, ""),
    alternate_mobile: Joi.string().allow(null, ""),
    year_loan_buisness: Joi.string().allow(null, ""),
    personal_loan_payout: Joi.string().allow(null, ""),
    personal_loan_business_amount: Joi.string().allow(null, ""),
    business_loan_payout: Joi.string().allow(null, ""),
    business_loan_business_amount: Joi.string().allow(null, ""),
    housing_loan_payout: Joi.string().allow(null, ""),
    housing_loan_business_amount: Joi.string().allow(null, ""),
    loan_against_property_payout: Joi.string().allow(null, ""),
    loan_against_property_business_amount: Joi.string().allow(null, ""),
    gold_loan_payout: Joi.string().allow(null, ""),
    gold_loan_business_amount: Joi.string().allow(null, ""),
    car_loan_payout: Joi.string().allow(null, ""),
    car_loan_business_amount: Joi.string().allow(null, ""),
    msme_loan_payout: Joi.string().allow(null, ""),
    msme_loan_business_amount: Joi.string().allow(null, ""),
    education_loan_payout: Joi.string().allow(null, ""),
    education_loan_business_amount: Joi.string().allow(null, ""),
    project_loan_payout: Joi.string().allow(null, ""),
    project_loan_business_amount: Joi.string().allow(null, ""),
    professional_loan_payout: Joi.string().allow(null, ""),
    professional_loan_business_amount: Joi.string().allow(null, ""),
    od_or_credit_card_payout: Joi.string().allow(null, ""),
    od_or_credit_card_business_amount: Joi.string().allow(null, ""),
    working_capital_loan_payout: Joi.string().allow(null, ""),
    working_capital_loan_business_amount: Joi.string().allow(null, ""),
    bank_or_nbfc_name_for_connector: Joi.string().allow(null, ""),
    other_bank_for_connector: Joi.string().allow(null, ""),
    do_you_have_dsa_code: Joi.string().allow(null, ""),
    bank_or_nbfc_name_for_dsa: Joi.string().allow(null, ""),
    do_you_refer_or_do_end_to_end_files: Joi.string().allow(null, ""),
    other_bank_for_dsa: Joi.string().allow(null, ""),
    banker_ref: Joi.string().allow(null, ""),
    where_or_how: Joi.string().allow(null, ""),
    what_is_the_purpose_of_joining_ruloans: Joi.string().allow(null, ""),
    bank_leave_duration: Joi.string().allow(null, ""),
    type_of_loans_in_previous_bank: Joi.string().allow(null, ""),
    previous_bank_department: Joi.string().allow(null, ""),
    previous_bank_verticle: Joi.string().allow(null, ""),
    home_address_house_number: Joi.string().allow(null, ""),
    home_address_area: Joi.string().allow(null, ""),
    home_address_city: Joi.string().allow(null, ""),
    home_address_state: Joi.string().allow(null, ""),
    home_address_pincode: Joi.string().allow(null, ""),
    office_address_house_number: Joi.string().allow(null, ""),
    office_address_area: Joi.string().allow(null, ""),
    office_address_city: Joi.string().allow(null, ""),
    office_address_state: Joi.string().allow(null, ""),
    office_address_pincode: Joi.string().allow(null, ""),
    salutation: Joi.string().required(),
    description: Joi.string().allow(null, ""),
    company_name: Joi.string().allow(null, ""),
    gstin: Joi.string().allow(null, ""),
    channel_manager_code: Joi.string().allow(null, ""),
    partner_name: Joi.string().allow(null, ""),
    channel_manager_name: Joi.string().allow(null, ""),

    dsa_status: Joi.number().required(),
    dsa_sub_status: Joi.number().allow(null, ""),
    has_done_loan_buisness: Joi.number().allow(null, ""),
    do_you_have_connector_code: Joi.number().allow(null, ""),
    do_you_have_office: Joi.number().allow(null, ""),
    have_you_heard_of_ruloans_before: Joi.number().allow(null, ""),
    hsn_hsc_number: Joi.string().allow(null, ""),
    gst_registration_type: Joi.string().allow(null, ""),
})

const markAllPastRemainderAsRead = Joi.object({
})

const markRemainderAsRead = Joi.object({
    id: Joi.number().integer().required()
})

const updateLeadFormPayoutType = Joi.object({
    id: Joi.number().required(),
    vendor_payout_type: Joi.string().required(),
})

const getAllPendingHlApplications = filtersJoiObject.append({
    search: Joi.string().allow(null, ''),
    is_export: Joi.boolean().allow(null, ''),
    application_id_filter: Joi.string().allow(null, ''),
    dsa_name_filter: Joi.string().allow(null, ''),
    dsa_mobile_number_filter: Joi.string().allow(null, ''),
    customer_name_filter: Joi.string().allow(null, ''),
    permanent_account_number_filter: Joi.string().allow(null, ''),
    customer_mobile_number_filter: Joi.string().allow(null, ''),
    profession_name_filter: Joi.string().allow(null, ''),
    loan_amount_filter: Joi.string().allow(null, ''),
    loan_tenure_filter: Joi.string().allow(null, ''),
    application_status_description_filter: Joi.string().allow(null, ''),
    business_head_name_filter: Joi.string().allow(null, ''),
    dsa_mobile_number: Joi.string().allow(null, ''),
    count_only: Joi.boolean().allow(null, ''),
});

const getAllPiramalApplications = filtersJoiObject.append({
    search: Joi.string().allow(null, ''),
    application_id_filter: Joi.string().allow(null, ''),
    business_head_name_filter: Joi.string().allow(null, ''),
    customer_name_filter: Joi.string().allow(null, ''),
    pan_filter: Joi.string().allow(null, ''),
    mobile_number_filter: Joi.string().allow(null, ''),
    occupation_type_filter: Joi.string().allow(null, ''),
    requested_amount_filter: Joi.string().allow(null, ''),
    requested_tenure_filter: Joi.string().allow(null, ''),
    stage_filter: Joi.string().allow(null, ''),
    sub_stage_filter: Joi.string().allow(null, ''),
    status_filter: Joi.string().allow(null, ''),
    reject_reason_filter: Joi.string().allow(null, ''),
    dsa_name_filter: Joi.string().allow(null, ''),
    dsa_mobile_number_filter: Joi.string().allow(null, ''),
    disburse_amount_filter: Joi.string().allow(null, ''),
    is_export: Joi.boolean().allow(null, ''),
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    startDateFilterLogin: Joi.string().allow(null, ''),
    endDateFilterLogin: Joi.string().allow(null, ''),
    lead_id_filter: Joi.string().allow(null, ''),
    count_only: Joi.boolean().allow(null, ''),
    sp_mobile_filter: Joi.string().allow(null, ''),
    sp_name_filter: Joi.string().allow(null, ''),
});

const getAllPiramalLapApplications = filtersJoiObject.append({
    search: Joi.string().allow(null, ''),
    application_id_filter: Joi.string().allow(null, ''),
    business_head_name_filter: Joi.string().allow(null, ''),
    customer_name_filter: Joi.string().allow(null, ''),
    pan_filter: Joi.string().allow(null, ''),
    mobile_number_filter: Joi.string().allow(null, ''),
    occupation_type_filter: Joi.string().allow(null, ''),
    requested_amount_filter: Joi.string().allow(null, ''),
    approved_tenure_filter: Joi.string().allow(null, ''),
    stage_filter: Joi.string().allow(null, ''),
    sub_stage_filter: Joi.string().allow(null, ''),
    status_filter: Joi.string().allow(null, ''),
    reject_reason_filter: Joi.string().allow(null, ''),
    dsa_name_filter: Joi.string().allow(null, ''),
    dsa_mobile_number_filter: Joi.string().allow(null, ''),
    disburse_amount_filter: Joi.string().allow(null, ''),
    is_export: Joi.boolean().allow(null, ''),
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    startDateFilterLogin: Joi.string().allow(null, ''),
    endDateFilterLogin: Joi.string().allow(null, ''),
    count_only: Joi.boolean().allow(null, ''),
    lead_id_filter: Joi.string().allow(null, ''),
    sp_mobile_filter: Joi.string().allow(null, ''),
    sp_name_filter: Joi.string().allow(null, ''),
});

const getAllCCApplications = filtersJoiObject.append({
    search: Joi.string().allow(null, ''),
    count_only: Joi.boolean().allow(null, ''),
    application_id_filter: Joi.string().allow(null, ''),
    business_head_name_filter: Joi.string().allow(null, ''),
    dsa_name_filter: Joi.string().allow(null, ''),
    dsa_mobile_number_filter: Joi.string().allow(null, ''),
    customer_name_filter: Joi.string().allow(null, ''),
    permanent_account_number_filter: Joi.string().allow(null, ''),
    mobile_number_filter: Joi.string().allow(null, ''),
    stage_filter: Joi.string().allow(null, ''),
    sub_stage_filter: Joi.string().allow(null, ''),
    status_filter: Joi.string().allow(null, ''),
    product: Joi.number().allow(null, ''),
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    is_export: Joi.boolean().allow(null, ''),
    external_id_filter: Joi.string().allow(null, ''),
    status_description_filter: Joi.string().allow(null, ''),
    customer_id: Joi.string().allow(null, ''),
    city_filter: Joi.string().allow(null, ''),
    pin_code_filter: Joi.string().allow(null, ''),
    product_description_filter: Joi.string().allow(null, ''),
});

const getLedger = Joi.object({
    dsa_mobile_number: Joi.number().required(),
    has_ratio_of_payout_vs_actual: Joi.boolean().required(),
    cc_emails: Joi.string().pattern(/^([\w-.]+@([\w-]+\.)+[\w-]{2,4},?)*$/).allow(null, '').optional()
});

const mergeDsa = Joi.object({
    mergeId: Joi.string().required(),
    mergeToId: Joi.string().required()
});


const deleteInvoice = Joi.object({
    invoice_id: Joi.string().required()
});

const getAllInvoices = Joi.object({
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
    is_deleted: Joi.boolean(),
    createdAt_filter: Joi.string().allow(null, ''),
    vendor_pan_filter: Joi.string().allow(null, ''),
    vendor_name_filter: Joi.string().allow(null, ''),
    vendor_class_filter: Joi.string().allow(null, ''),
    base_payout_amount_filter: Joi.string().allow(null, ''),
    amount_inc_gst_filter: Joi.string().allow(null, ''),
    status_value_filter: Joi.string().allow(null, ''),
    has_reverse_invoice_value_filter: Joi.string().allow(null, ''),
    is_export: Joi.boolean().allow(null, ''),
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    remarks: Joi.boolean().allow(null, ''),
    transaction_date_filter: Joi.string().allow(null, ''),
    invoice_number_filter: Joi.string().allow(null, ''),
    gstin_filter: Joi.string().allow(null, ''),
    cgst_amount_filter: Joi.string().allow(null, ''),
    sgst_amount_filter: Joi.string().allow(null, ''),
    igst_amount_filter: Joi.string().allow(null, ''),
});

const updateInvoice = Joi.object({
    transaction_date: Joi.string(),
    vendor_pan: Joi.string(),
    vendor_class: Joi.string(),
    vendor_name: Joi.string(),
    base_payout_amount: Joi.number(),
    invoice_number: Joi.string(),
    supply_type: Joi.string().allow(null, ''),
    gst_registration_type: Joi.string().allow(null, ''),
    place_of_supply: Joi.string().allow(null, ''),
    cgst_percentage: Joi.number(),
    sgst_percentage: Joi.number(),
    igst_percentage: Joi.number(),
    cgst_amount: Joi.number(),
    sgst_amount: Joi.number(),
    igst_amount: Joi.number(),
    vendor_mobile_number: Joi.string().allow(null, ''),
    vendor_email_address: Joi.string().allow(null, '').email(),
    vendor_company_name: Joi.string().allow(null, ''),
    vendor_gstin: Joi.string().allow(null, ''),
    vendor_full_name: Joi.string().allow(null, ''),
    vendor_address_house_number: Joi.string().allow(null, ''),
    vendor_address_area: Joi.string().allow(null, ''),
    vendor_address_city: Joi.string().allow(null, ''),
    vendor_address_state: Joi.string().allow(null, ''),
    vendor_address_pincode: Joi.string().allow(null, ''),
    has_reverse_invoice: Joi.boolean(),
    status: Joi.number().integer().required(),
    remark: Joi.string().allow(null, ''),
    invoice_id: Joi.string().required(),
});

const updateInvoiceNumber = Joi.object({
    invoice_id: Joi.string().required(),
    invoice_number: Joi.string().required()
});

const acceptOrRejectInvoice = Joi.object({
    status: Joi.number().required(),
    remark: Joi.string().allow(null, ""),
    invoice_id: Joi.array().required(),
});

const uploadReverseInvoice = Joi.object({
    base64: Joi.string().required(),
    invoice_id: Joi.string().required(),
});

const downloadInvoice = Joi.object({
    invoice_id: Joi.string().required(),
    reciever_email: Joi.allow(null, ""),
    signer_role: Joi.string().allow(null, ""),
    signer_name: Joi.string().allow(null, ""),
    signer_phone: Joi.string().allow(null, ""),
});

const sendWhatsappMessage = Joi.object({
    filter: Joi.string().required().allow(""),
    templateName: Joi.string().required(),
    headerParams: Joi.array().items(
        Joi.object({
            type: Joi.string().required().allow(""),
            value: Joi.string().required().allow(""),
        })
    ).optional(),
    bodyParams: Joi.array().items(
        Joi.object({
            type: Joi.string().optional(),
            value: Joi.string().optional(),
        })
    ).optional(),
    buttonParams: Joi.array().items(
        Joi.object({
            type: Joi.string().valid("static", "dynamic").required(),
            value: Joi.string().required(),
        })
    ),
});

const sendEmailMessage = Joi.object({
    filter: Joi.string().required().allow(""),
    subject: Joi.string().required(),
    body: Joi.string().required(),
});


const sendPushNotificationToKafka = Joi.object({
    filter: Joi.string().required().allow(""),
    title: Joi.string().required(),
    topic: Joi.string().required(),
    body: Joi.string().required(),
    image: Joi.string().allow(null).optional(),
    link: Joi.string().allow(null).optional()
})

const sendSmsToKafka = Joi.object({
    filter: Joi.string().required().allow(""),
    message: Joi.string().required(),
    dynamicValues: Joi.array().required()
})

const getRefreshPayoutStatusForDsa = Joi.object({
    phone: Joi.string().required(),
});

const editDsaNSVendorId = Joi.object({
    dsa_id: Joi.string().required(),
    vendor_id: Joi.string().required()
});

const getAllDsaDopdown = Joi.object({
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    search: Joi.string().allow(null, ""),
    search_by: Joi.string().valid('ns_hierarchy').allow(null, "").optional(),
    user_type: Joi.string().allow(null, ""),
    business_code: Joi.string().allow(null, "").optional(),
    universal: Joi.boolean().allow(null, "").optional(),
    get_company: Joi.boolean().allow(null, "").optional(),
});

const getDsaPartner = Joi.object({
    partner_code: Joi.string().required()
});

const getAllGlobalConfiguration = Joi.object({
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
    key_filter: Joi.string().allow(null, ''),
    value_filter: Joi.string().allow(null, ''),
    setting_key: Joi.string().allow(null, ''),
    platform: Joi.string().allow(null, "")
});

const getSalesPersons = Joi.object({
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
    search: Joi.string().allow(null, ''),
});

const CreateEditGlobalConfiguration = Joi.object({
    key: Joi.string().required(),
    value: Joi.string().required(),
    id: Joi.number().allow(null, ""),
});

const DeleteGlobalConfiguration = Joi.object({
    id: Joi.number().required(),
});

const getBankDetailsDsa = Joi.object({
    dsa_id: Joi.string().required(),
});

const AddBankDetailDsa = Joi.object({
    dsaMobileNumber: Joi.string().required(),
    accountNumber: Joi.string().required(),
    bankName: Joi.string().required(),
    accountType: Joi.string().required(),
    ifsc: Joi.string().required(),
    accountHolderName: Joi.string().required(),
});

/**
 * Transport shape for `POST dsa/AddFreshLeadClaim` and `dsa/add_external_claim`.
 *
 * PLAN-0006/T16 — this schema validates **shape only**: which keys are allowed, their
 * primitive types, and rejecting unknown keys. Business rules that used to live here now
 * live in the shared claim validators, so the manual and bulk-upload channels enforce
 * them identically:
 *   - `company_id` required when `is_company` (was a Joi `.when()`) -> VendorLookupRequiredValidator
 *
 * Field-level `.required()` is deliberately KEPT here rather than moved. Presence is a
 * transport concern, Joi reports it with the field's own name, and moving it would make
 * the manual API answer with bulk-upload phrasing ("Borrower_First_Name Is Mandatory
 * Field . ") for a form that has no such field. Duplicating the check would be worse.
 *
 * Keys marked `.strip()` are dead — nothing reads them. They are stripped rather than
 * deleted because this is a strict `Joi.object()`: removing a key outright would start
 * 400-ing clients that still send it. Delete them one release after this ships (T21).
 */
const AddFreshLeadClaim = Joi.object({
    'dsa_mobile_number': Joi.string().pattern(/^[0-9]{10}$/).required(),
    'product_name': Joi.string().required(),
    'bank_name': Joi.string().required(),
    'bank_id': Joi.string().required(),
    'first_name': Joi.string().required(),
    'last_name': Joi.string().required(),
    'loan_number': Joi.string().optional().allow(null, ""),
    'apac_ref_los_number': Joi.string().optional().allow(null, ""),
    'company_name': Joi.string().allow(null, ""),
    'disbursement_amount': Joi.number().required(),
    // required + allow(null,"") means "the key must be present, the value may be empty".
    // Preserved as-is: the mandatory-date rules live in the validator chain.
    'disbursement_date': Joi.string().required().allow(null, ""),
    'city': Joi.string().allow(null, ""),
    'payout_type': Joi.string().allow("", null),
    'payout_ratio': Joi.number().allow("", null),
    'payout_rate': Joi.number().allow("", null),
    'netsuite_product_id': Joi.string().required(),
    'confirmation_required': Joi.boolean().allow(null, ""),
    'send_email': Joi.boolean().optional().allow(null, ""),
    'cc_email': Joi.string().allow(null, ""),
    'fresh_lead_id': Joi.string().allow(null, ""),
    'is_split_case': Joi.boolean().allow(null, ""),
    // Was Joi.string() here but a Number in the bulk-upload path. Accepts both now; the
    // adapter coerces to the canonical Number.
    'business_categories': Joi.alternatives().try(Joi.string(), Joi.number()).required(),
    // Payout-sharing split case: the second DSA. Transport shape only — whether they are
    // required, and which categories are legal, is the shared validators' business
    // (`claimPairValidators`), so the rule is identical for the Excel channel.
    // Dual-lead is create-only: on edit (`fresh_lead_id` present) strip these keys so a
    // stale client cannot rebuild a pair. Create path keeps the same shape as before.
    // Optional Employee/TL PAN. Format is checked by `TeamLeadPanValidator` so the message
    // is the same on the lead form and the Excel upload.
    'team_lead': Joi.string().allow(null, ""),
    'sharing_vendor_pan': Joi.when('fresh_lead_id', {
        is: Joi.string().trim().min(1).required(),
        then: Joi.any().strip(),
        otherwise: Joi.string().allow(null, "")
    }),
    'sharing_payout_value': Joi.when('fresh_lead_id', {
        is: Joi.string().trim().min(1).required(),
        then: Joi.any().strip(),
        otherwise: Joi.alternatives().try(Joi.string(), Joi.number()).allow(null, "")
    }),
    'sharing_business_categories': Joi.when('fresh_lead_id', {
        is: Joi.string().trim().min(1).required(),
        then: Joi.any().strip(),
        otherwise: Joi.alternatives().try(Joi.string(), Joi.number()).allow(null, "")
    }),
    'expected_billing_month': Joi.string().allow(null, ""),
    'banker_name': Joi.string().allow(null, ""),
    'banker_email': Joi.string().allow(null, ""),
    // banker_mobile was string and asm_mobile was number for the same kind of value.
    // Both accept either now — widened, so no client that works today can break.
    'banker_mobile': Joi.alternatives().try(Joi.string(), Joi.number()).allow(null, ""),
    'asm_name': Joi.string().allow(null, ""),
    'asm_email': Joi.string().allow(null, ""),
    'asm_mobile': Joi.alternatives().try(Joi.string(), Joi.number()).allow(null, ""),
    'pf_collected': Joi.string().allow(null, ""),
    'loan_type': Joi.string().allow(null, ""),
    'platform': Joi.string().allow(null, ""),
    'vendor_remark': Joi.string().allow(null, ""),
    'ns_contest_id': Joi.number().allow("", null),
    'is_company': Joi.boolean().optional(),
    // The `.when('is_company')` conditional moved to VendorLookupRequiredValidator so the
    // rule is enforced once, in the same place for every channel.
    'company_id': Joi.string().optional().allow(null, ""),

    // ── Dead keys, accepted and discarded (see the note above). Delete in T21. ──
    'full_name': Joi.any().strip(),
    'dsa_name': Joi.any().strip(),
    'netsuite_vendor_id': Joi.any().strip(),
    'claim_month': Joi.any().strip(),
    'ai_status': Joi.any().strip(),
    'claim_confirmation': Joi.any().strip(),
    'cc_email_date': Joi.any().strip(),
});

const getFreshLeadClaimForEdit = Joi.object({
    'fresh_lead_id': Joi.string().required(),
});

const refreshApplicationStatus = Joi.object({
    application_name: Joi.string().required(),
    payload: Joi.object().required(),
});

const getStatusRefresh = Joi.object({
    application_id: Joi.string().required(),
    lender: Joi.string().required(),
    loan_type: Joi.string().required(),
});

const fetchDigioDoduments = Joi.object({
    dsa_mobile_number: Joi.string().required(),
});

const updateDirectClaimAccess = Joi.object({
    dsa_mobile_number: Joi.string().required(),
    status: Joi.boolean().required(),
});

const getApplicationsByProductAndLoanType = filtersJoiObject.append({
    count_only: Joi.boolean().allow(null, ''),
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    application_id_filter: Joi.string().allow(null, ''),
    external_id_filter: Joi.string().allow(null, ''),
    bh_name_filter: Joi.string().allow(null, ''),
    customer_full_name_filter: Joi.string().allow(null, ''),
    permanent_account_number_filter: Joi.string().allow(null, ''),
    customer_mobile_number_filter: Joi.string().allow(null, ''),
    customer_email_filter: Joi.string().allow(null, ''),
    partner_name_filter: Joi.string().allow(null, ''),
    partner_mobile_filter: Joi.string().allow(null, ''),
    loan_tenure_filter: Joi.string().allow(null, ''),
    disbursed_loan_amount_filter: Joi.string().allow(null, ''),
    applied_loan_amount_filter: Joi.string().allow(null, ''),
    status_filter: Joi.string().allow(null, ''),
    sub_status_filter: Joi.string().allow(null, ''),
    stage_filter: Joi.string().allow(null, ''),
    sub_stage_filter: Joi.string().allow(null, ''),
    endDateFilterLogin: Joi.string().allow(null, ''),
    endDateFilterUpdate: Joi.string().allow(null, ''),
    startDateFilterLogin: Joi.string().allow(null, ''),
    startDateFilterUpdate: Joi.string().allow(null, ''),
    product: Joi.number().allow(null, ""),
    is_export: Joi.boolean().allow(null, ""),
    loan_type: Joi.string().required(),
    dsa_mobile_number: Joi.string().allow(null, ''),
    export_title: Joi.string().allow(null, ""),
    sp_name_filter: Joi.string().allow(null, ""),
    sp_email_filter: Joi.string().allow(null, ""),
    sp_mobile_filter: Joi.string().allow(null, ""),
    status_description_filter: Joi.string().allow(null, ""),
    offered_loan_tenure_filter: Joi.string().allow(null, ""),
    ifsc_code_filter: Joi.string().allow(null, ""),
    branch_name_filter: Joi.string().allow(null, ""),
    hierarchy_crm_filter: Joi.string().allow(null, ""),
    city_filter: Joi.string().allow(null, ""),
    pin_code_filter: Joi.string().allow(null, ""),
    claim_status_filter: Joi.string().valid("0", "1", "", null),
    external_lead_id_filter: Joi.string().allow(null, ''),
    loan_apac_ref_los_number_filter: Joi.string().allow(null, ""),
    loan_reference_id_filter: Joi.string().allow(null, ""),
    application_ref_filter: Joi.string().allow(null, ""),
    utm_source_filter: Joi.string().allow(null, ""),
    utm_medium_filter: Joi.string().allow(null, ""),
    utm_campaign_filter: Joi.string().allow(null, ""),
    utm_content_filter: Joi.string().allow(null, ""),
    utm_channel_filter: Joi.string().allow(null, ""),
    utm_term_filter: Joi.string().allow(null, ""),
    utm_id_filter: Joi.string().allow(null, ""),
    ad_group_id_filter: Joi.string().allow(null, ""),
    campaign_id_filter: Joi.string().allow(null, ""),
    ad_filter: Joi.string().allow(null, ""),
    mt_filter: Joi.string().allow(null, ""),
    adpos_filter: Joi.string().allow(null, ""),
    gad_filter: Joi.string().allow(null, ""),
    gclid_filter: Joi.string().allow(null, ""),
    fbclid_filter: Joi.string().allow(null, ""),
    utm_main_source_filter: Joi.string().allow(null, ""),
    utm_device_filter: Joi.string().allow(null, ""),
    utm_adgroup_filter: Joi.string().allow(null, ""),
    source_from_filter: Joi.string().allow(null, ""),
    page_source_filter: Joi.string().allow(null, ""),
    product_description_filter: Joi.string().allow(null, ""),
});

const getUtmJourneyUrl = Joi.object({
    product_id: Joi.number(),
    application_id: Joi.string().required(),
});

const editSigningPayout = Joi.object({
    dsa_id: Joi.string().required(),
    assigning_payout_percentage: Joi.number().required(),
});


const getMisMongoDB = Joi.object({
    lender: Joi.string().allow(null, ''),
    loan_type: Joi.string().allow(null, ''),

    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    startDateLoginFilter: Joi.string().allow(null, ''),
    endDateLoginFilter: Joi.string().allow(null, ''),
    date: Joi.string().allow(null, ''),
    type: Joi.string().allow(null, ''),
    pageNumber: Joi.number().allow(null, ''),
    pageSize: Joi.number().allow(null, ''),
    dsa_mobile_number: Joi.number().allow(null, ''),

    joiningDateFilterStart: Joi.string().allow(null, ''),
    joiningDateFilterEnd: Joi.string().allow(null, ''),
    bhCode: Joi.string().allow(null, ''),
    utm_main_source: Joi.string().allow(null, ''),
    is_export: Joi.boolean().allow(null, ''),
    city: Joi.string().allow(null, ''),
    state: Joi.string().allow(null, ''),
    status: Joi.number().allow(null, ''),
    sub_status: Joi.number().allow(null, ''),
    is_combined_mis: Joi.boolean().allow(null, ''),
});

const saveLeadClaimDraftMongo = Joi.object({
    module: Joi.string().trim().required(),
    draft_id: Joi.string().allow(null, ''),
    data: Joi.object().required(),
    label: Joi.string().allow(null, '')
});

const getLeadClaimDraftsMongo = Joi.object({
    module: Joi.string().trim().required(),
    /** Inclusive lower bound on `updated_at` (ISO 8601). */
    startDate: Joi.date().iso().required(),
    /** Inclusive upper bound on `updated_at` (ISO 8601); must be >= startDate. */
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
    pageNumber: Joi.number().integer().min(0).default(0),
    pageSize: Joi.number().integer().min(1).max(100).default(20),
});

const deleteLeadClaimDraftMongo = Joi.object({
    module: Joi.string().trim().required(),
    draft_id: Joi.string().trim().required(),
});

const getYearlyMisMongoDB = Joi.object({
    lender: Joi.string().required(),
    loan_type: Joi.string().required(),
});

const updateLntApplicationById = Joi.object({
    id: Joi.number().required(),
    application_status: Joi.string().required(),
    app_ref: Joi.string().allow(null, ""),
    failure_reason: Joi.string().allow(null, ""),
});

const withdrawDsaConsent = Joi.object({
    dsa_id: Joi.string().allow(null, ""),

    dsa_mobile_number: Joi.string().pattern(/^[0-9]{10}$/).allow(null, ""),

    status: Joi.boolean().allow(null, ""),

    consent_type: Joi.string()
        .valid("GRANTED", "WITHDRAWN")
        .allow(null, ""),

    reason: Joi.string().trim().when("consent_type", {
        is: "WITHDRAWN",
        then: Joi.required().messages({
            "any.required": "reason is required when consent_type is WITHDRAWN",
            "string.empty": "reason is required when consent_type is WITHDRAWN"
        }),
        otherwise: Joi.optional().allow(null, "")
    })
})
    .or("status", "consent_type")
    .or("dsa_id", "dsa_mobile_number");

const changeDsaEmployeeStatus = Joi.object({
    dsa_id: Joi.string().required(),
    employee: Joi.boolean(),
    value: Joi.number().valid(0, 1).allow(null, "")
}).or('employee', 'value');

const updateDsaEmployee = Joi.object({
    dsa_id: Joi.string().required(),
    employee: Joi.boolean().required()
});

const getMonthlyComparision = Joi.object({
    month1: Joi.string().required(),
    month2: Joi.string().required(),
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    loan_type: Joi.string().allow(null, ""),
    lender: Joi.string().allow(null, ""),
    dsa_mobile_number: Joi.string().allow(null, ""),
});

const getBusinessDetailsForDsa = Joi.object({
    month: Joi.string().required(),
    dsa_mobile_number: Joi.string().required(),
});

const getCombinedLoanApplications = Joi.object({
    pageNumber: Joi.number(),
    pageSize: Joi.number(),

    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),

    sub_stage_filter: Joi.string().allow(null, ''),
    customer_id: Joi.string().allow(null, ''),
    application_id_filter: Joi.string().allow(null, ''),
    full_name_filter: Joi.string().allow(null, ''),
    dsa_mobile_number_filter: Joi.string().allow(null, ''),
    loan_type_filter: Joi.string().allow(null, ''),
    city_filter: Joi.string().allow(null, ''),
    product_filter: Joi.string().allow(null, ''),
    applied_loan_amount_filter: Joi.string().allow(null, ''),
    approved_loan_amount_filter: Joi.string().allow(null, ''),
    loan_tenure_filter: Joi.string().allow(null, ''),
    stage_filter: Joi.string().allow(null, ''),
    status_filter: Joi.string().allow(null, ''),
    disbursed_loan_amount_filter: Joi.string().allow(null, ''),
    startDateDisbursedFilter: Joi.string().allow(null, ''),
    endDateDisbursedFilter: Joi.string().allow(null, ''),
    is_export: Joi.boolean().allow(null, ''),
    state_filter: Joi.string().allow(null, ''),

    utm_source: Joi.string().allow(null, ''),
    utm_medium: Joi.string().allow(null, ''),
    utm_campaign: Joi.string().allow(null, ''),
    utm_content: Joi.string().allow(null, ''),
    utm_channel: Joi.string().allow(null, ''),
    utm_term: Joi.string().allow(null, ''),
    utm_id: Joi.string().allow(null, ''),
    utm_adgroup: Joi.string().allow(null, ''),
    utm_main_source: Joi.string().allow(null, ''),
    utm_device: Joi.string().allow(null, ''),
    ad_group_id: Joi.string().allow(null, ''),
    campaign_id: Joi.string().allow(null, ''),
    adgroupid: Joi.string().allow(null, ''),
    campaignid: Joi.string().allow(null, ''),
    ad: Joi.string().allow(null, ''),
    mt: Joi.string().allow(null, ''),
    adpos: Joi.string().allow(null, ''),
    gad: Joi.string().allow(null, ''),
    gclid: Joi.string().allow(null, ''),
    fbclid: Joi.string().allow(null, ''),
    page_source: Joi.string().allow(null, ''),
    source_from: Joi.string().allow(null, ''),
});

const updateLoanApplication = Joi.object({
    application_id: Joi.string().required(),
    product_id: Joi.number().required(),
    loan_type: Joi.string().required(),
    status: Joi.string().required(),
    sub_status: Joi.string().required(),
    stage: Joi.string().allow(null, ""),
    sub_stage: Joi.string().allow(null, ""),
    status_description: Joi.string().allow(null, ""),
    disbursed_loan_amount: Joi.number().allow(null, ""),
    disbursed_date: Joi.string().allow(null, ""),
});

const downloadLeadFormSample = Joi.object({
    fileName: Joi.string().required().messages({ 'any.only': "Sample File not Found" })
});
const getRMList = Joi.object({
    applicationId: Joi.string().required(),
    pageNumber: Joi.number(),
    search: Joi.string().allow(null, ''),
    loan_type: Joi.string().required()
});

const assignRM = Joi.object({
    loan_type: Joi.string().required(),
    applicationId: Joi.string().required(),
    salesPersonId: Joi.number().required()
});
const updateCustomerFields = Joi.object({
    otp: Joi.string().optional().allow(null, ""),
    mobile_number: Joi.string().required(),
    income_id: Joi.string().optional().allow(null, ""),
    address_id: Joi.number().optional().allow(null, ""),
    customerId: Joi.string().required().allow(null, ""),
    full_name: Joi.string().optional().allow(null, ""),
    first_name: Joi.string().optional().allow(null, ""),
    last_name: Joi.string().optional().allow(null, ""),
    email_address: Joi.string().email().optional().allow(null, ""),
    customer_mobile_number: Joi.string().optional().allow(null, ""),
    is_mobile_number_verified: Joi.number().valid(0, 1).optional().allow(null, ""),
    gender: Joi.string().valid("Male", "Female", "Other").optional().allow(null, ""),
    date_of_birth: Joi.string().optional().allow(null, ""),
    father_full_name: Joi.string().optional().allow(null, ""),
    mother_full_name: Joi.string().optional().allow(null, ""),
    address_type_id: Joi.string().optional().allow(null, ""),
    address_line_1: Joi.string().optional().allow(null, ""),
    address_line_2: Joi.string().optional().allow(null, ""),
    address_line_3: Joi.string().optional().allow(null, ""),
    pin_code: Joi.string().optional().allow(null, ""),
    city: Joi.string().optional().allow(null, ""),
    state: Joi.string().optional().allow(null, ""),
    country: Joi.string().optional().allow(null, ""),
    landmark: Joi.string().optional().allow(null, ""),
    employee_type: Joi.string().optional().allow(null, ""),
    monthly_income: Joi.number().optional().allow(null, ""),
    employment_start_date: Joi.string().optional().allow(null, ""),
    employment_end_date: Joi.string().optional().allow(null, ""),
    profession: Joi.number().optional().allow(null, 0),
    salary_mode: Joi.number().optional().allow(null, 0),
    income_type: Joi.number().optional().allow(null, 0),
    business_vintage: Joi.number().optional().allow(null, ""),
    business_turnover: Joi.number().optional().allow(null, ""),
    total_work_exp: Joi.number().optional().allow(null, ""),
    nature_of_business: Joi.string().optional().allow(null, ""),
    permanent_account_number: Joi.string().optional().allow(null, ""),
    customer_company_id: Joi.number().optional().allow(null),
    applicationId: Joi.string().optional()
});

const getCompanyList = Joi.object({
    search: Joi.string().required().allow("")
})

const getLoanDetails = Joi.object({
    loan_type: Joi.string().required(),
    applicationId: Joi.string().required()
})
const editLoanDetails = Joi.object({
    applicationId: Joi.string().required().allow(null, ""),
    applied_loan_amount: Joi.number().required().allow(null, 0),
    approved_loan_amount: Joi.number().required().allow(null, 0),
    disbursed_loan_amount: Joi.number().required().allow(null, 0),
    loan_tenure: Joi.number().required().allow(null, 0),
    status: Joi.string().required().allow(null, ""),
    status_description: Joi.string().allow(null, ""),
    sub_stage: Joi.string().required().allow(null, ""),
    sub_status: Joi.string().required().allow(null, ""),
    address_id: Joi.number().optional().allow(null, 0),
    income_id: Joi.string().optional().allow(null, 0),
    loan_type: Joi.string().required(),

});

const updateClaimPendingStatusExternal = Joi.object({
    ids: Joi.array().required(),
});

const bulkCalling = Joi.object({
    channel: Joi.string().required(),
    filter: Joi.string().required().allow(""),
});
const bulkCallingslashrtc = Joi.object({
    payload: Joi.array().items(
        Joi.object({
            phoneNumber: Joi.string().pattern(/^[0-9]{10}$/).required().description("The phone number of the recipient"),
            processId: Joi.string().required().description("The process ID for the call"),
            leadsetId: Joi.string().required().description("The leadset ID for the call"),
            email: Joi.string().required().description("The email of the recipient"),
            name: Joi.string().required().description("The name of the recipient"),
            skillName: Joi.string().required().description("The skill name of the recipient"),
            skillGroupName: Joi.string().required().description("The skill group name of the recipient"),
        })
    ).required().description("Array of objects with phone numbers, process IDs, and leadset IDs")
});

const notificationStats = Joi.object({
    category: Joi.string().valid("delivered", "incoming").allow(null, ""),
    type: Joi.string().valid("email", "whatsapp", "push", "sms", "app", "calling").allow(null, ""),
    startDate: Joi.date().allow(null, ""),
    endDate: Joi.date().allow(null, ""),
    pageSize: Joi.number().optional(),
    pageNumber: Joi.number().optional(),
    getDetails: Joi.boolean().required(),

});

const modifyPermissions = Joi.object({
    type: Joi.string().required(),
    reference_id: Joi.string().required(),
    tag: Joi.string().allow(null, "")
});

const getPermissions = Joi.object({
    type: Joi.string().required(),
    dsa_id: Joi.string().required()
});

const toggleNotificationDsa = Joi.object({
    dsa_id: Joi.string().required(),
    email_communication: Joi.number().valid(0, 1).allow(null, ""),
    whatsapp_communication: Joi.number().valid(0, 1).allow(null, ""),
    sms_communication: Joi.number().valid(0, 1).allow(null, ""),
    notification_communication: Joi.number().valid(0, 1).allow(null, ""),
});

const instantClaimApplication = Joi.object({
    platform: Joi.string().required(),
    application_id: Joi.string().required(),
    loan_type: Joi.string().required()
})

const validateVendorPayout = Joi.object({
    fresh_lead_ids: Joi.array().required()
})

const updateLeadCaseBusinessCategory = Joi.object({
    case_id: Joi.number().required(),
    first_allowed: Joi.array().items(Joi.number()).required().allow("*"),
    second_allowed: Joi.object().pattern(
        Joi.string(),
        Joi.array().items(Joi.number()).required().allow("*")
    ).required()
})

const getDsaTaxDetails = Joi.object({
    dsa_id: Joi.string().required()
})

const updateDsaTaxInformation = Joi.object({
    dsa_id: Joi.string().required(),
    company_name: Joi.string().allow(null, ""),
    gstin: Joi.string().allow(null, ""),
    hsn_hsc_number: Joi.string().allow(null, ""),
    gst_registration_type: Joi.string().allow(null, '')
});

const updateDsaMobileNumber = Joi.object({
    dsa_id: Joi.string().required(),
    mobile_number: Joi.string().pattern(/^[0-9]{10}$/).description("10-digit mobile number"),
    otp: Joi.string().optional().description("OTP for verification (required if mobile_number is being changed)")
});

const getVendorMetrics = Joi.object({
    cardKey: Joi.string().allow(null, '').optional(),
    refresh: Joi.boolean().allow(null, '').optional(),
    lightOnly: Joi.boolean().optional().description('If true, return only base metrics (fast). Show these in cards first, then call with onboardingOnly for heavy data.'),
    onboardingOnly: Joi.boolean().optional().description('If true, return only onboarding metrics (heavy). Call after lightOnly to update onboarding cards.')
});

const getVendorDashboardListCounts = Joi.object({
    nodeId: Joi.string().allow(null, '').optional().description('When set (hierarchy view), counts are restricted to this node and everyone under him — same scoping as getVendorDashboardList. Omit for full-dashboard / card header counts.')
});

const getVendorDashboardList = Joi.object({
    filterType: Joi.string().valid('all', 'onboarding_complete', 'junk_contact', 'missing_onboarding', 'payout_not_set', 'capping_not_set', 'bank_account_missing', 'ns_issues', 'authbridge_not_set').allow(null, '').optional(),
    nodeId: Joi.string().allow(null, '').optional().description('When set, list is restricted to this node and everyone under him (e.g. user clicked a card to view/fix that person\'s hierarchy).'),
    pageNumber: Joi.number().integer().min(0).allow(null, '').optional(),
    pageSize: Joi.number().integer().min(1).max(1000).allow(null, '').optional(),
    sortBy: Joi.string().valid('vendor_name', 'partner_name', 'pan_number', 'ns_vendor_id', 'mobile', 'email', 'crm_hierarchy', 'ns_hierarchy', 'onboarding_percentage', 'payout_capping', 'global_payout', 'bank_account', 'data_quality_status', 'authbridge_pan_verification_status').allow(null, '').optional(),
    sortDirection: Joi.string().valid('asc', 'desc').allow(null, '').optional(),
    filterModel: Joi.object().allow(null, '').optional(),
    is_export: Joi.boolean().allow(null, ""),
});

const getVendorDashboardByDsaId = Joi.object({
    dsa_id: Joi.string().required()
});

const getVendorBranchSummaryMetrics = Joi.object({});

const getVendorBranchList = Joi.object({
    pageNumber: Joi.number().integer().min(0).allow(null, '').optional(),
    pageSize: Joi.number().integer().min(1).max(1000).allow(null, '').optional(),
    sortBy: Joi.string().valid('branch_code', 'total_dsa').allow(null, '').optional(),
    sortDirection: Joi.string().valid('asc', 'desc').allow(null, '').optional(),
    filterModel: Joi.object().allow(null, '').optional(),
    logicOperator: Joi.string().valid('and', 'or').allow(null, '').optional()
});

const getVendorBranchDsaList = Joi.object({
    branchCode: Joi.string().allow(null, '').optional(),
    branch_code: Joi.string().allow(null, '').optional(),
    pageNumber: Joi.number().integer().min(0).allow(null, '').optional(),
    pageSize: Joi.number().integer().min(1).max(1000).allow(null, '').optional(),
    sortBy: Joi.string().valid('vendor_name', 'mobile', 'pan_number', 'vendor_code', 'partner_name', 'email', 'crm_hierarchy', 'ns_hierarchy', 'branch_code').allow(null, '').optional(),
    sortDirection: Joi.string().valid('asc', 'desc').allow(null, '').optional(),
    filterModel: Joi.object().allow(null, '').optional(),
    logicOperator: Joi.string().valid('and', 'or').allow(null, '').optional()
}).or('branchCode', 'branch_code');

const updateLeadByReconciliation = Joi.object({
    fresh_lead_id: Joi.string().required(),
    customer_name: Joi.string().allow('', null),
    loan_number: Joi.string().allow('', null),
    application_no: Joi.string().allow('', null),
    customer_company_name: Joi.string().allow('', null),
    disbursement_date: Joi.string().isoDate().allow('', null),
    loan_amount: Joi.alternatives().try(Joi.string().allow('', null), Joi.number().allow(null)),
    bank_name: Joi.string().allow('', null),
    product_name: Joi.string().allow('', null),
    city: Joi.string().allow('', null),
    loan_type: Joi.string().allow('', null),
    netsuite_bank_id: Joi.alternatives().try(Joi.string().allow('', null), Joi.number().allow(null)),
    netsuite_product_id: Joi.alternatives().try(Joi.string().allow('', null), Joi.number().allow(null)),
    claim_confirmation: Joi.string().allow('', null),
    ns_audit_remark: Joi.string().allow('', null),
    ns_claim_confirmation_remark: Joi.string().allow('', null),
    expected_billing_month: Joi.string().isoDate().allow('', null),
    cc_email_date: Joi.string().isoDate().allow('', null),
});

const updateDsaClassInfo = Joi.object({
    dsa_id: Joi.string().required(),
    class_assignee_name: Joi.string().allow('', null),
    class_assignee_email: Joi.string().allow('', null),
});

module.exports = {
    updateDsaClassInfo,
    getAllPincodes,
    addPincode,
    notificationStats,
    bulkCallingslashrtc,
    bulkCalling,
    editLoanDetails,
    getLoanDetails,
    getCompanyList,
    updateCustomerFields,
    editCustomers,
    assignRM,
    getRMList,
    AddBankDetailDsa,
    getRuloansCustomers,
    getRuloansCustomersKyc,
    getDsaCity,
    getZipCodeList,
    getDsaUserDetails,
    getCreditCardApplications,
    getCustomerUserDetails,
    getCustomerLoanApplications,
    getCustomerLoanDocuments,
    getAllCreditCardApplications,
    getAllLoanApplications,
    getCustomerCity,
    getCustomers,
    getDsaTree,
    getUnverifiedDsa,
    updateDsaVerifyStatus,
    updateDsaAutoErpStatus,
    getDsaUserCapturedDetailsPdf,
    uploadDsaVerificationDocument,
    getDsaVerificationDocument,
    downloadDsaList,
    downloadAllLoanApplicationsList,
    downloadAllCreditCardApplicationsList,
    reassignPartner,
    getLntLoanApplications,
    getCustomerLntApplications,
    getRuloansCustomersDropDown,
    getLntApplicationById,
    getCreditCardApplicationById,
    getAllLntApplications,
    getPayoutByPanNumber,
    refreshDsaKycVendorBranchFromNs,
    getLntForDashboard,
    getCreditCardForDashboard,
    getLoanForDashboard,
    getApplicationCountForDashboard,
    getDsaTreeCount,
    getLntApplicationStage,
    getLntApplicationSubStage,
    getDsaChild,
    getDsaIdByPhone,
    updateChannelPartnerStatus,
    downloadDsaWithStep,
    uploadDsaWithStep,
    getGraphData,
    getAllIndifiApplications,
    getIndifiApplicationDetailsById,
    sendTextSms,
    getIndifiForDashboard,
    editSubAssignee,
    editUserType,
    getDsasByCompanyId,
    insertLastMonthsLntReport,
    getCibilList,
    getCibilDetail,
    sendAppNotification,
    getAllPayoutRequest,
    getPayoutRequest,
    getYearlyDashboardReport,
    insertLastMonthDashboardReport,
    getDsaKycData,
    uploadDsaKycData,
    updateBhExternal,
    getAllFibeApplications,
    getAllPayUApplications,
    getAllIncredApplications,
    getAllCreditSaisonApplications,
    getAllPiramalApplications,
    getAllBajajApplications,
    getAllCreditVidyaApplications,
    getStageFilterList,
    uploadLeadFormData,
    sendSearchEngineOtp,
    verifySearchEngineOtp,
    getAllDsaLeads,
    getLeadClaimUpdateLogs,
    getLeadClaimUploadLogs,
    deleteLeadFormData,
    updateClaimPendingStatus,
    updateMultiFundedStatus,
    moveToPendingLeadForm,
    moveToPendingLeadFormBankerProcessed,
    createCommunicationSettings,
    getCommunicationSettings,
    deleteCommunicationSettings,
    createRemainder,
    getAllRemainder,
    getAllUpcomingRemainder,
    getAllMissedRemainder,
    deleteRemainder,
    markAllPastRemainderAsRead,
    getDsaDataForEdit,
    markRemainderAsRead,
    createOrEditDsa,
    getPersonalLoanMisForDsa,
    getDsaCityState,
    updateLeadFormPayoutType,
    getAllPendingHlApplications,
    getAllPiramalLapApplications,
    getLedger,
    uploadInvoiceData,
    mergeDsa,
    getAllCCApplications,
    getAllInvoices,
    getDsaUploadLogs,
    updateInvoice,
    updateInvoiceNumber,
    acceptOrRejectInvoice,
    uploadReverseInvoice,
    downloadInvoice,
    getRefreshPayoutStatusForDsa,
    editDsaNSVendorId,
    getAllDsaDopdown,
    updateCCApplications,
    getAllGlobalConfiguration,
    CreateEditGlobalConfiguration,
    DeleteGlobalConfiguration,
    getBankDetailsDsa,
    deleteInvoice,
    AddFreshLeadClaim,
    refreshApplicationStatus,
    updateDirectClaimAccess,
    getApplicationsByProductAndLoanType,
    editSigningPayout,
    getAllPlForDashboard,
    getYearlyPlReport,
    getAllCCForDashBoard,
    getAllPayoutClaimForDashboard,
    getMisMongoDB,
    saveLeadClaimDraftMongo,
    getLeadClaimDraftsMongo,
    deleteLeadClaimDraftMongo,
    getYearlyMisMongoDB,
    withdrawDsaConsent,
    fetchDigioDoduments,
    getCombinedLoanApplications,
    getFreshLeadClaimForEdit,
    updateLntApplicationById,
    changeDsaEmployeeStatus,
    updateDsaEmployee,
    getUtmJourneyUrl,
    updateLoanApplication,
    sendWhatsappMessage,
    sendEmailMessage,
    getMonthlyComparision,
    getBusinessDetailsForDsa,
    downloadLeadFormSample,
    sendPushNotificationToKafka,
    getStatusRefresh,
    sendSmsToKafka,
    sendPushNotification,
    updateClaimPendingStatusExternal,
    modifyPermissions,
    getPermissions,
    toggleNotificationDsa,
    instantClaimApplication,
    validateVendorPayout,
    updateLeadCaseBusinessCategory,
    getDsaPartner,
    getSalesPersons,
    assignSalesPerson,
    updateDsaTaxInformation,
    updateBillerUniversal,
    editOrDeletePincode,
    getDsaTaxDetails,
    updateLeadCaseBusinessCategory,
    updateDsaMobileNumber,
    getVendorMetrics,
    getVendorDashboardListCounts,
    getVendorDashboardList,
    getVendorDashboardByDsaId,
    getVendorBranchSummaryMetrics,
    getVendorBranchList,
    getVendorBranchDsaList,
    updateLeadByReconciliation

};

let Joi = require("joi");
const { filtersJoiObject } = require("../../../helpers/commonhelper");

const getBankDetail = Joi.object({
    bankName: Joi.string().allow(""),
    product: Joi.string().allow(""),
    marketType: Joi.string().allow(""),
    state: Joi.string().allow(""),
    city: Joi.string().allow(""),
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
    search: Joi.string().allow(""),
    createdOn: Joi.string().allow(null, ""),
    updatedOn: Joi.string().allow(null, ""),
    is_export: Joi.boolean().allow(null, ""),
});

const getAllBanks = filtersJoiObject.append({
    bankNbfcFilter: Joi.string().allow(null, ""),
    productFilter: Joi.string().allow(null, ""),
    stateFilter: Joi.string().allow(null, ""),
    cityFilter: Joi.string().allow(null, ""),
    companyFilter: Joi.string().allow(null, ""),
    startDateFilter: Joi.string().allow(null, ""),
    endDateFilter: Joi.string().allow(null, ""),
    is_export: Joi.boolean().allow(null, ""),
});

const getBankDetailById = Joi.object({
    id: Joi.number().required()
});

const createBank = Joi.object({
    id: Joi.number().allow(null, ""),
    bank_nbfc_name: Joi.string().allow(null, ""),
    product: Joi.string().allow(null, ""),
    market_and_sub_type: Joi.string().allow(null, ""),
    state: Joi.string().allow(null, ""),
    city: Joi.string().allow(null, ""),
    company: Joi.string().allow(null, ""),
    login_code: Joi.string().allow(null, ""),
    location: Joi.string().allow(null, ""),
    sales_manager: Joi.string().allow(null, ""),
    sales_manager_mobile: Joi.string().allow(null, ""),
    sales_manager_email: Joi.string().allow(null, ""),
    sales_manager_code: Joi.string().allow(null, ""),
    assistant_sales_manager: Joi.string().allow(null, ""),
    assistant_sales_manager_mobile: Joi.string().allow(null, ""),
    assistant_sales_manager_email: Joi.string().allow(null, ""),
    regional_sales_manager: Joi.string().allow(null, ""),
    regional_sales_manager_mobile: Joi.string().allow(null, ""),
    regional_sales_manager_email: Joi.string().allow(null, ""),
    zonal_sales_manager: Joi.string().allow(null, ""),
    zonal_sales_manager_mobile: Joi.string().allow(null, ""),
    zonal_sales_manager_email: Joi.string().allow(null, ""),
    national_sales_manager: Joi.string().allow(null, ""),
    national_sales_manager_mobile: Joi.string().allow(null, ""),
    national_sales_manager_email: Joi.string().allow(null, ""),
    login_process: Joi.string().allow(null, ""),
    company_category_list: Joi.string().allow(null, ""),
    product_and_policy: Joi.string().allow(null, ""),
    branch_address: Joi.string().allow(null, ""),
    remark: Joi.string().allow(null, "")
});

const getProduct = Joi.object({
    bankName: Joi.string().required().allow("")
});

const getMarketType = Joi.object({
    bankName: Joi.string().required().allow(""),
    product: Joi.string().required().allow("")
});

const getState = Joi.object({
    bankName: Joi.string().required().allow(""),
    product: Joi.string().required().allow(""),
    marketType: Joi.string().required().allow("")
});

const getAllCityForState = Joi.object({
    state: Joi.string().required().allow("")
});

const getCity = Joi.object({
    bankName: Joi.string().required().allow(""),
    product: Joi.string().required().allow(""),
    marketType: Joi.string().required().allow(""),
    state: Joi.string().required().allow("")
});

const uploadBank = Joi.object({
    file: Joi.string().required()
});

const uploadBankFile = Joi.object({
    base64: Joi.string().required(),
    file_name: Joi.string().required()
});

const deleteAllBanks = Joi.object({
});

const submitClaimBankFile = Joi.object({
    id: Joi.number().required(),
    is_tentative: Joi.number().allow(null, "").default(0)
});

const getBankFiles = Joi.object({
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    apacLoanFilter: Joi.string().allow(null, ""),
    customerFirstNameFilter: Joi.string().allow(null, ""),
    customerLastNameFilter: Joi.string().allow(null, ""),
    bankNbfcFilter: Joi.string().required(),
    disbursementDateFilter: Joi.string().allow(null, ""),
    disbursementAmountFilter: Joi.string().allow(null, ""),
    cityFilter: Joi.string().allow(null, ""),
    stateFilter: Joi.string().required(),
    custometFullNameFilter: Joi.string().allow(null, ""),
    productFilter: Joi.string().allow(null, ""),
    loanFilter: Joi.string().allow(null, ""),
    is_tentative: Joi.number().allow(null, "").default(0)
});

const getBankFilesNearBySearch = Joi.object({
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    customerFirstNameFilter: Joi.string().allow(null, ""),
    customerLastNameFilter: Joi.string().allow(null, ""),
    bankNbfcFilter: Joi.string().allow(null, ""),
    disbursementAmountFilter: Joi.string().allow(null, ""),
    cityFilter: Joi.string().allow(null, ""),
    stateFilter: Joi.string().allow(null, ""),
    custometFullNameFilter: Joi.string().allow(null, ""),
    nameFilter: Joi.string().allow(null, ""),
    productFilter: Joi.string().allow(null, ""),
    not_claimed: Joi.boolean().allow(null, ""),
    automation: Joi.boolean().allow(null, "")
});

const getTentativeBankFilesNearBySearch = Joi.object({
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    customerFirstNameFilter: Joi.string().allow(null, ""),
    customerLastNameFilter: Joi.string().allow(null, ""),
    netsuiteBankIdFilter: Joi.string().allow(null, ""),
    disbursementAmountFilter: Joi.string().allow(null, ""),
    cityFilter: Joi.string().allow(null, ""),
    stateFilter: Joi.string().allow(null, ""),
    custometFullNameFilter: Joi.string().allow(null, ""),
    nameFilter: Joi.string().allow(null, ""),
    netsuiteProductIdFilter: Joi.string().allow(null, ""),
    loanNumberFilter: Joi.string().allow(null, ""),
    apacNumberFilter: Joi.string().allow(null, ""),
    not_claimed: Joi.boolean().allow(null, ""),
    automation: Joi.boolean().allow(null, ""),
    search_main: Joi.boolean().allow(null, "")
});

const getBankFileDetail = Joi.object({
    bank_file_id: Joi.string().required(),
    is_tentative: Joi.number().allow(null, "").default(0)
});

const getBankFileLogs = Joi.object({
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    api_type_filter: Joi.string().allow(null, ""),
    name_filter: Joi.string().allow(null, ""),
    phone_filter: Joi.string().allow(null, ""),
    email_filter: Joi.string().allow(null, ""),
    api_filter: Joi.string().allow(null, ""),
    payload_filter: Joi.string().allow(null, ""),
    has_error_filter: Joi.string().allow(null, ""),
    reponse_filter: Joi.string().allow(null, ""),
});

const getAllBranchSalePeople = Joi.object({
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    pincode_filter: Joi.string().allow(null, ""),
    city_filter: Joi.string().allow(null, ""),
    code_filter: Joi.string().allow(null, ""),
    sp_id_filter: Joi.string().allow(null, ""),
    sp_name_filter: Joi.string().allow(null, ""),
    sp_email_filter: Joi.string().allow(null, ""),
    sp_mobile_filter: Joi.string().allow(null, ""),
    product_id_filter: Joi.string().allow(null, ""),
    created_by_filter: Joi.string().allow(null, ""),
    updated_by_filter: Joi.string().allow(null, ""),
});

const deleteBranchSalePeopleById = Joi.object({
    id: Joi.number().required(),
});

const addBankProductCombination = Joi.object({
    bank_id: Joi.string().required(),
    product_ids: Joi.array().items(Joi.string()).required(),
});

const addBankProductCombinationRegex = Joi.object({
    bank_id: Joi.string().required(),
    product_id: Joi.string().required(),
    regex: Joi.array().items({
        form_type: Joi.string().required().allow(""),
        key: Joi.string().required().allow(""),
        validation: Joi.string().required().allow(""),
        sample: Joi.string().required().allow("")
    })
});

const getBankProductCombinationByBankId = Joi.object({
    bank_id: Joi.string().required(),
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
});

const getMatchingProductsByLoanOrApac = Joi.object({
    bank_id: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
    product_id: Joi.alternatives().try(Joi.string(), Joi.number()).allow(null, ""),
    loan_number: Joi.string().allow(null, ""),
    apac_ref_los_number: Joi.string().allow(null, ""),
}).custom((value, helpers) => {
    const productId = (value.product_id ?? "").toString().trim();
    if (productId) return value;

    const loan = (value.loan_number ?? "").toString().trim();
    const apac = (value.apac_ref_los_number ?? "").toString().trim();
    if (!loan && !apac) {
        return helpers.message("Either loan_number or apac_ref_los_number is required");
    }
    return value;
});

const createOrEditBranchSalePeople = Joi.object({
    pincode: Joi.number().required(),
    city: Joi.string().required(),
    code: Joi.string().required(),
    sp_id: Joi.string().required(),
    sp_name: Joi.string().required(),
    sp_email: Joi.string().required(),
    sp_mobile: Joi.number().required(),
    product_id: Joi.number().required(),
    id: Joi.number().allow(null, ""),
});

const createOrUpdateNetsuiteBank = Joi.object({
    netsuite_bank_id: Joi.string().required(),
    bank_name: Joi.string().required(),
    id: Joi.number().allow(null, ""),
    status: Joi.number().required(),
    registered_on_company_name: Joi.string().required().allow(null, ""),
    pan: Joi.string().required().allow(null, ""),
    grade: Joi.string().required().allow(null, ""),
    external_id: Joi.string().required().allow(null, ""),
    remarks: Joi.string().required().allow(null, "")
});

const deleteNetsuiteBank = Joi.object({
    bank_id: Joi.number().required(),
});

const getNetsuiteBankById = Joi.object({
    bank_id: Joi.number().required(),
})

const getAllBankProductDetails = Joi.object({
    slab_internal_id: Joi.string().required()
})

const getBankProductCombinationHistory = Joi.object({
    bank_product_combinations_id: Joi.string().required()
})


// CRM-owned identity fields only - GRO/Lender details + offline-bank (B2B) config.
// .unknown(true) so NetSuite-synced fields the frontend may still send (avg_achievment,
// login_code, etc.) don't fail validation - the service layer simply never writes them.
const updateBankProductGroDetails = Joi.object({
    bank_id: Joi.number().required(),
    product_id: Joi.number().required(),
    b2b_login_enable: Joi.number().valid(0, 1).allow(null, 0),
    login_link: Joi.string().uri().allow(null, '').when('b2b_login_enable', {
        is: 1,
        then: Joi.string().uri().required().messages({
            'any.required': 'Login Link is required when B2B Login is enabled',
            'string.empty': 'Login Link is required when B2B Login is enabled',
            'string.uri': 'Login Link must be a valid URL (e.g. http:// or https://)'
        })
    }),
    bank_logo: Joi.string().uri().allow(null, '').when('b2b_login_enable', {
        is: 1,
        then: Joi.string().uri().required().messages({
            'any.required': 'Bank Logo is required when B2B Login is enabled',
            'string.empty': 'Bank Logo is required when B2B Login is enabled',
            'string.uri': 'Bank Logo must be a valid URL (e.g. http:// or https://)'
        })
    }),
    lender_partner_page: Joi.string().uri().allow(null, ''),
    privacy_policy_url: Joi.string().uri().allow(null, ''),
    official_website: Joi.string().uri().allow(null, ''),
    gro_name: Joi.string().allow(null, ''),
    gro_contact_number: Joi.string().allow(null, ''),
    gro_email_id: Joi.string().allow(null, ''),
    gro_description: Joi.string().allow(null, ''),
}).unknown(true)

const updateBankProductStatus = Joi.object({
    bank_id: Joi.number().required(),
    product_id: Joi.number().required(),
    status: Joi.number().valid(0, 1).required()
})

const updateAutonomousPayoutCapping = Joi.object({
    bank_id: Joi.number().required(),
    product_id: Joi.number().required(),
    autonomous_payout_capping: Joi.number().min(0).max(100).allow(null, ""),
})

const updateMaxPayoutCapping = Joi.object({
    bank_id: Joi.number().required(),
    product_id: Joi.number().required(),
    max_payout_capping: Joi.number().min(0).max(100).allow(null, ""),
})

const confirmationMailAllowed = Joi.object({
    product_id: Joi.number().required()
})

// ── Bank Master ──────────────────────────────────────────────────────────────
const importBankMaster = Joi.object({
    file_name: Joi.string().allow(null, ''),
    bank_category: Joi.string().allow(null, ''),
    base64: Joi.string().allow(null, ''),
});

const getBankMasterDropdown = Joi.object({
    search: Joi.string().allow(null, ''),
});

module.exports = {
    getBankDetail,
    getProduct,
    getMarketType,
    getState,
    getAllCityForState,
    getCity,
    uploadBank,
    uploadBankFile,
    deleteAllBanks,
    getAllBanks,
    getBankDetailById,
    createBank,
    submitClaimBankFile,
    getBankFiles,
    getBankFileDetail,
    getBankFileLogs,
    getAllBranchSalePeople,
    deleteBranchSalePeopleById,
    createOrEditBranchSalePeople,
    getBankFilesNearBySearch,
    getTentativeBankFilesNearBySearch,
    addBankProductCombination,
    getBankProductCombinationByBankId,
    getMatchingProductsByLoanOrApac,
    addBankProductCombinationRegex,
    createOrUpdateNetsuiteBank,
    deleteNetsuiteBank,
    getNetsuiteBankById,
    getAllBankProductDetails,
    getBankProductCombinationHistory,
    updateBankProductGroDetails,
    updateBankProductStatus,
    updateAutonomousPayoutCapping,
    updateMaxPayoutCapping,
    confirmationMailAllowed,
    // Bank Master
    importBankMaster,
    getBankMasterDropdown,
}
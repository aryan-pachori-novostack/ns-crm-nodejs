let Joi = require("joi");

const getAllProduct = Joi.object({
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    loan_type_filter: Joi.allow(null, ""),
    product_id_filter: Joi.string().allow(null, ""),
    product_name_filter: Joi.string().allow(null, ""),
    product_vendor_filter: Joi.string().allow(null, ""),
    loan_type_name_filter: Joi.string().allow(null, ""),
    promo_code_filter: Joi.string().allow(null, ""),
    joining_fee_filter: Joi.string().allow(null, ""),
    annual_fee_filter: Joi.string().allow(null, ""),
    status_name_filter: Joi.string().allow(null, ""),
    product_vendor_alias_filter: Joi.string().allow(null, ""),
    partner_link: Joi.string().uri().allow(null, ""),
    privacy_policy_link: Joi.string().uri().allow(null, ""),
    website_link: Joi.string().uri().allow(null, ""),
    is_recommended_filter: Joi.any().optional()
});

const createProduct = Joi.object({
    id: Joi.number().allow(null, ""),
    product_id: Joi.string().allow(null, ""),
    product_description: Joi.string().allow(null, ""),
    product_vendor: Joi.string().required(),
    product_name: Joi.string().required(),
    joining_fee: Joi.number().allow(null, ""),
    annual_fee: Joi.number().allow(null, ""),
    promo_code: Joi.string().allow(null, ""),
    loan_type_id: Joi.number().required(),
    status: Joi.number().required(),
    product_image: Joi.string().allow(null, ""),
    sort_order: Joi.number().allow(null, ""),
    journey_type: Joi.string().allow(null, ""),
    utm_journey_url: Joi.string().allow(null, ""),
    communication_type: Joi.string().allow(null, ""),
    b2c_enabled: Joi.number().allow(null, ""),
    b2b_enabled: Joi.number().allow(null, ""),
    pincode_product_alias: Joi.allow(null, ""),
    b2b_web_journey_url: Joi.string().allow(null, ""),
    b2c_web_journey_url: Joi.string().allow(null, ""),
    is_claim_enabled: Joi.number().allow(null, ""),
    ns_bank_product_id: Joi.number().allow(null, ""),
    loan_type_id: Joi.number().allow(null, ""),
    loan_type_name: Joi.string().allow(null, ""),
    product_vendor_alias: Joi.string().allow(null, ""),
    partner_link: Joi.string().uri().allow(null, ""),
    privacy_policy_link: Joi.string().uri().allow(null, ""),
    website_link: Joi.string().uri().allow(null, ""),
    gro_name: Joi.string().allow(null, ""),
    gro_email: Joi.alternatives().try(
        Joi.string()
            .trim()
            .lowercase()
            .email({ tlds: { allow: false } })
            .max(254)
            .messages({
                'string.email': 'gro_email must be a valid email address',
            }),
        Joi.valid(null, '')
    ),
    gro_mobile: Joi.alternatives().try(
        Joi.string()
          .trim()
          .pattern(/^\d{1,20}$/)          
          .messages({
            'string.pattern.base': 'gro_mobile must contain only digits and be less than or equal to 20 digits',
          }),
        Joi.valid(null, '')                 
      )
,      
    gro_description_html: Joi.string().allow(null, ""),
    enable_reference_details: Joi.number().allow(null, ""),
    is_recommended: Joi.any().optional(),
    deeplink_generation: Joi.string().allow(null, ""),
});

const getAllLoanTypes = Joi.object({
    loan_type_id: Joi.number().allow(null, ""),
});

const getCriteria = Joi.object({
    product_id: Joi.string().required(),
    page_number: Joi.number().allow(null, ""),
    page_size: Joi.number().allow(null, ""),
});

const createCriteria = Joi.object({
    product_id: Joi.string().required(),
    criteria: Joi.array().required(),
});

const editCriteria = Joi.object({
    id: Joi.number().required(),
    criteria_name: Joi.string().required(),
    criteria_value: Joi.number().allow(null, ""),
    criteria_min_value: Joi.number().allow(null, ""),
    criteria_max_value: Joi.number().allow(null, ""),
    is_visible: Joi.number().allow(null, ""),
});

const deleteCriteria = Joi.object({
    id: Joi.number().required(),
});

const getContent = Joi.object({
    product_id: Joi.string().required(),
    page_number: Joi.number().allow(null, ""),
    page_size: Joi.number().allow(null, ""),
});

const createContent = Joi.object({
    product_id: Joi.string().required(),
    id: Joi.number().allow(null, ""),
    content: Joi.array().items(Joi.object({
        type: Joi.string().required(),
        description: Joi.string().required(),
    })),
});

const deleteContent = Joi.object({
    id: Joi.number().required(),
});

const getServiceablePincodes = Joi.object({
    page_number: Joi.number().allow(null, ""),
    page_size: Joi.number().allow(null, ""),
    search: Joi.string().allow(null, "")
});

const editServiceablePincodes = Joi.object({
    id: Joi.number().required(),
    value: Joi.boolean().required(),
    type: Joi.string().required(),
});

const addServiceablePincodes = Joi.object({
    pin_code: Joi.number().required(),
    axis: Joi.boolean().allow(null, ""),
    indusind: Joi.boolean().allow(null, ""),
});

const deleteServiceablePincode = Joi.object({
    id: Joi.number().required(),
});

const createDocumentsForProduct = Joi.object({
    document_ids: Joi.array().required(),
    product_id: Joi.number().required(),
});

const deleteDocumentsForProduct = Joi.object({
    id: Joi.number().required(),
});

const deleteDocumentsMetaForProduct = Joi.object({
    id: Joi.number().required(),
});

const deleteProductMetaForRequirement = Joi.object({
    id: Joi.number().required(),
});

const deleteRequirementsForProduct = Joi.object({
    id: Joi.number().required(),
});

const createProductForRequirement = Joi.object({
    requirement_ids: Joi.array().required(),
    product_id: Joi.number().required(),
});

const getDocumentsForProduct = Joi.object({
    product_id: Joi.string().required(),
    page_number: Joi.number().allow(null, ""),
    page_size: Joi.number().allow(null, ""),
});

const getProductRequirement = Joi.object({
    product_id: Joi.string().required(),
    page_number: Joi.number().allow(null, ""),
    page_size: Joi.number().allow(null, ""),
});

const getProductByLoanTypeId = Joi.object({
    loan_type_id: Joi.number().required(),
    platform: Joi.string().valid("b2b", "b2c", "", null),
});

const getLoanTypesPaginated = Joi.object({
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    name_filter: Joi.string().allow(null, ""),
    alias_filter: Joi.string().allow(null, ""),
    status_filter: Joi.string().allow(null, ""),
    b2c_enabled_filter: Joi.string().allow(null, ""),
    b2b_enabled_filter: Joi.string().allow(null, ""),
    sort_order_filter: Joi.string().allow(null, ""),
    startDateFilter: Joi.string().allow(null, ""),
    endDateFilter: Joi.string().allow(null, ""),
    category_filter: Joi.string().allow(null, ""),
});

const deleteLoanTypeById = Joi.object({
    id: Joi.number().required(),
});

const createLoanType = Joi.object({
    id: Joi.number().allow(null, ""),
    name: Joi.string().required(),
    icon: Joi.string().allow(null, ""),
    status: Joi.number().required(),
    b2c_enabled: Joi.number().required(),
    b2b_enabled: Joi.number().required(),
    alias: Joi.string().required(),
    sort_order: Joi.number().required(),
    category: Joi.string().allow(null, ""),
    b2c_web_journey_url: Joi.string().allow(null, ""),
    b2b_web_journey_url: Joi.string().allow(null, ""),
    deeplink_generation: Joi.string().allow(null, ""),
});

const updatePincodeCsv = Joi.object({
    type: Joi.string().required(),
    base64: Joi.string().required(),
    file_name: Joi.string().required(),
});

const addNewLender = Joi.object({
    lender_name: Joi.string().required()
});

const getProductForRm = Joi.object({
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    product_name_filter: Joi.string().optional().allow(null, ""),
});

const getProductAuditLogs = Joi.object({
    pageNumber: Joi.number().optional().default(0),
    pageSize: Joi.number().optional().default(10),
    product_id_filter: Joi.string().allow(null, ""),
    user_name_filter: Joi.string().allow(null, ""),
    event_type_filter: Joi.string().allow(null, ""),
    startDate: Joi.string().allow(null, ""),
    endDate: Joi.string().allow(null, "")
});

module.exports = {
    getProductForRm,
    getAllProduct,
    createProduct,
    getCriteria,
    createCriteria,
    getContent,
    createContent,
    deleteContent,
    getServiceablePincodes,
    editServiceablePincodes,
    addServiceablePincodes,
    deleteServiceablePincode,
    deleteCriteria,
    editCriteria,
    getDocumentsForProduct,
    getProductRequirement,
    createDocumentsForProduct,
    deleteDocumentsForProduct,
    createProductForRequirement,
    deleteDocumentsMetaForProduct,
    deleteProductMetaForRequirement,
    deleteRequirementsForProduct,
    getProductByLoanTypeId,
    getAllLoanTypes,
    deleteLoanTypeById,
    getLoanTypesPaginated,
    createLoanType,
    addNewLender,
    updatePincodeCsv,
    getProductAuditLogs
};
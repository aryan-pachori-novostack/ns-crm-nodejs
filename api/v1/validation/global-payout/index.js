let Joi = require("joi");
const { filtersJoiObject } = require("../../../helpers/commonhelper");

const globalPayouts = Joi.object({
    bank_name: Joi.string().required(),
    short_name: Joi.string().allow(null, ""),
    avg_achievement: Joi.number().required(),
    registered_on_company_name: Joi.string().allow(null, ""),
    main_product: Joi.string().allow(null, ""),
    sub_product: Joi.string().allow(null, ""),
    product_group: Joi.string().allow(null, ""),
    product: Joi.string().allow(null, ""),
    agreement_expired_by: Joi.string().allow(null, ""),
    enrollment_date: Joi.string().allow(null, ""),
    billing_mode: Joi.string().allow(null, ""),
    login_code: Joi.string().allow(null, ""),
    address: Joi.string().allow(null, ""),
    max_payout: Joi.string().allow(null, ""),
    billing_date_from: Joi.string().allow(null, ""),
    billing_date_to: Joi.string().allow(null, ""),
    applicable_from: Joi.string().allow(null, ""),
    applicable_to: Joi.string().allow(null, ""),
    remarks: Joi.string().allow(null, ""),
    type: Joi.string().allow(null, ""),
    payout_slabs: Joi.array().items(Joi.object({
        rate: Joi.number().required(),
        disb_amount_from: Joi.number().required(),
        disb_amount_to: Joi.number().required()
    })),
    type_of_payout: Joi.string().allow(null, ""),
    company_category: Joi.string().allow(null, ""),
    billing_cycle: Joi.string().allow(null, ""),
    payment_term: Joi.string().allow(null, ""),
    minimum_pf: Joi.number().allow(null, ""),
    minimum_irr: Joi.number().allow(null, ""),
    minimum_insurance: Joi.number().allow(null, ""),
    link: Joi.string().allow(null, ""),
});

const updatePayouts = Joi.object({
    id: Joi.number().required(),
    status: Joi.string().allow(null),
    bank_name: Joi.string().required(),
    bank_id:Joi.string().required().allow(null, ""), 
    product_id:Joi.string().required().allow(null, ""),
    short_name: Joi.string().allow(null, ""),
    avg_achievement: Joi.number().required(),
    product: Joi.string().allow("", null),
    registered_on_company_name: Joi.string().allow(null, ""),
    main_product: Joi.string().allow(null, ""),
    sub_product: Joi.string().allow(null, ""),
    product_group: Joi.string().allow(null, ""),
    agreement_expired_by: Joi.string().allow(null, ""),
    enrollment_date: Joi.string().allow(null, ""),
    billing_mode: Joi.string().allow(null, ""),
    login_code: Joi.string().allow(null, ""),
    address: Joi.string().allow(null, ""),
    max_payout: Joi.string().allow(null, ""),
    billing_date_from: Joi.string().allow(null, ""),
    billing_date_to: Joi.string().allow(null, ""),
    applicable_from: Joi.string().allow(null, ""),
    applicable_to: Joi.string().allow(null, ""),
    remarks: Joi.string().allow(null, ""),
    type: Joi.string().allow(null, ""),
    payout_slabs: Joi.array().items(Joi.object({
        id: Joi.number(),
        rate: Joi.number().required(),
        disb_amount_from: Joi.number().required(),
        disb_amount_to: Joi.number().required()
    })),
    type_of_payout: Joi.string().allow(null, ""),
    company_category: Joi.string().allow(null, ""),
    billing_cycle: Joi.string().allow(null, ""),
    payment_term: Joi.string().allow(null, ""),
    minimum_pf: Joi.number().allow(null, ""),
    minimum_irr: Joi.number().allow(null, ""),
    minimum_insurance: Joi.number().allow(null, ""),
    link: Joi.string().allow(null, ""),
})

const getPayouts = filtersJoiObject.append({
    search: Joi.string().allow(null, ""),
    startDateFilter: Joi.string().allow(null, ''),
    endDateFilter: Joi.string().allow(null, ''),
    bank_name: Joi.string().allow(null, ''),
    product: Joi.string().allow(null, ''),
    main_product: Joi.string().allow(null, ''),
    sub_product: Joi.string().allow(null, ''),
    product_group: Joi.string().allow(null, ''),
    type: Joi.string().allow(null, ''),
    avg_achievement: Joi.alternatives().try(Joi.string(), Joi.number()).allow(null, ''),
    enrollment_date: Joi.string().allow(null, ''),
    bank_id_filter: Joi.string().allow(null, ''),
    product_id_filter: Joi.string().allow(null, ''),
    login_code_filter: Joi.string().allow(null, ''),
    is_export: Joi.boolean().allow(null, ""),
})

const getById = Joi.object({
    id: Joi.string().required()
})

const uploadPayout = Joi.object({
    file: Joi.string().required()
});

const findGlobalPayoutByBankName = Joi.object({
    bank_name: Joi.string().required(),
    product_name: Joi.string().required(),
    dsa_mobile_number: Joi.string().required().pattern(/^[0-9]+$/)
});
module.exports = {
    globalPayouts,
    updatePayouts,
    getPayouts,
    getById,
    uploadPayout,
    findGlobalPayoutByBankName
}
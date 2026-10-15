let Joi = require("joi");

exports.getBusinessReport = Joi.object({
    report_type: Joi.string().valid("city_wise", "lender_wise").required(),
    state: Joi.string().allow(null, ""),
    loan_type_filter: Joi.string().allow(null, ""),
    city_filter: Joi.string().allow(null, ""),
    status_filter: Joi.string().allow(null, ""),
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    start_date: Joi.string().allow(null, ""),
    end_date: Joi.string().allow(null, ""),
    date_type: Joi.string().allow(null, ""),
    frequency: Joi.string().allow(null, ""),
});

exports.getSalesReport = Joi.object({
    type: Joi.string().valid("count", "detail", "details_by_user").required(),
    state: Joi.string().allow(null, ""),
    city: Joi.string().allow(null, ""),
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    start_date: Joi.string().allow(null, ""),
    end_date: Joi.string().allow(null, ""),
    frequency: Joi.string().allow(null, ""),
    call_status: Joi.string().allow(null, ""),
    created_by: Joi.string().allow(null, ""),
});

exports.dsaLeadResponseTimeReport = Joi.object({
    business_head: Joi.string().allow(null, ""),
    start_date: Joi.string().allow(null, ""),
    end_date: Joi.string().allow(null, ""),
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    type: Joi.string().valid("summary", "detailed").default("summary"),
    metric: Joi.string().valid("call", "assignment").default("call"),
    export: Joi.string().allow(null, ""), // It comes as string 'true' or 'false'
    moduleName: Joi.string().allow(null, ""),
});

exports.customerLeadAssignToCallReport = Joi.object({
    telecaller: Joi.string().allow(null, ""),
    start_date: Joi.string().allow(null, ""),
    end_date: Joi.string().allow(null, ""),
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    metric: Joi.string().valid("call", "assignment").default("call"),
    export: Joi.string().allow(null, ""),
});
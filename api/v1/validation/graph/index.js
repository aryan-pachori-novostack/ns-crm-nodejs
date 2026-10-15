let Joi = require("joi");

exports.getLeadFormGraph = Joi.object({
});

exports.getLeadFormGraphMIS = Joi.object({
    type: Joi.string().required(),
    pageNumber: Joi.number().required(),
    pageSize: Joi.number().required(),
    startDateFilter: Joi.string().allow(null, ""),
    endDateFilter: Joi.string().allow(null, ""),
    dsa_mobile_number: Joi.string().allow(null, ""),
});

exports.getLeadFormGraph = Joi.object({
    startDateFilter: Joi.string().allow(null, ""),
    endDateFilter: Joi.string().allow(null, ""),
    dsa_mobile_number: Joi.string().allow(null, ""),
});

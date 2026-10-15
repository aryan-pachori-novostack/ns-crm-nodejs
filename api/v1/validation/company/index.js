let Joi = require("joi");
const { filtersJoiObject } = require("../../../helpers/commonhelper");

exports.getAllCompany = filtersJoiObject.append({
    name_filter: Joi.string().allow(null, ""),
    short_name_filter: Joi.string().allow(null, ""),
    pan_filter: Joi.string().allow(null, ""),
    mobile_filter: Joi.string().allow(null, ""),
    business_type_filter: Joi.string().allow(null, ""),
    date_of_incorp_filter: Joi.string().allow(null, ""),
    startDateFilter: Joi.string().allow(null, ""),
    endDateFilter: Joi.string().allow(null, ""),
});

exports.getAllCompanyDocuments = Joi.object({
    company_id: Joi.string().required(),
});


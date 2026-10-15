let Joi = require("joi");

const updateDetailsFromNS = Joi.object({
    dsaMobileNumber: Joi.string().optional().allow(null, ""),
    dsaId: Joi.string().required(),
    is_company: Joi.boolean().optional().allow(null, ""),
});

module.exports = {
    updateDetailsFromNS
}
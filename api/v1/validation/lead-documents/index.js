let Joi = require("joi");

const create = Joi.object({
    title: Joi.string().allow(null, ""),
    file: Joi.string().required(),
    type: Joi.number().required(),
    assigned_to: Joi.string().required(),
    lead_id: Joi.string().required()
});

const getLeadDocuments = Joi.object({
    id: Joi.string().required()
})



module.exports = {
    create,
    getLeadDocuments
}
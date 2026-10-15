let Joi = require("joi");

const emailCreate = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().optional(),
    subject: Joi.string().required(),
    body: Joi.string().required(),
    module_id: Joi.number().required().optional()
});

const emailUpdate = Joi.object({
    id: Joi.number().required(),
    name: Joi.string().required(),
    description: Joi.string().optional(),
    subject: Joi.string().required(),
    body: Joi.string().required(),
    module_id: Joi.number().optional()
})


const getTemplateFields  = Joi.object({
   module: Joi.boolean().allow(null),
   module_id: Joi.number().allow(null)
})

const deleteEmail = Joi.object({
    id: Joi.number().required()
})

const getById = Joi.object({
    id: Joi.number().required()
})

const getAllEmail = Joi.object({
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
})

const getWhatsappTemplateByName = Joi.object({
    template_name: Joi.string().required()
})

module.exports = {
    emailCreate,
    emailUpdate,
    deleteEmail,
    getAllEmail,
    getById,
    getTemplateFields,
    getWhatsappTemplateByName
}
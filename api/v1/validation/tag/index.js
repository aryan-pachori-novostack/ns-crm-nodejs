let Joi = require("joi");

const add = Joi.object({
    tags: Joi.array().items(Joi.string()).required(),
    leadId: Joi.string().required()
});

const deleteTag = Joi.object({
    tagIds: Joi.array().items(Joi.string()).required(),
    leadId: Joi.string().required()
});

const get = Joi.object({
    tagId: Joi.string().allow(null, ''),
    search: Joi.string().allow(null, '')
});

const getLeadTag = Joi.object({
    leadId: Joi.string().required()
});

const modifyTag = Joi.object({
    type: Joi.string().required(),
    reference_id: Joi.string().required(),
    tag: Joi.string().required()
});

module.exports = {
    add,
    get,
    deleteTag,
    getLeadTag,
    modifyTag
}
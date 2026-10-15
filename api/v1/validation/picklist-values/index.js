let Joi = require("joi");


const createPicklistValues = Joi.object({
    id: Joi.number().allow(null, ""),
    value: Joi.string().required(),
    key_id: Joi.number().required(),
    parent_id: Joi.number().allow(null),
    alias: Joi.string().allow(null),
});

const getPicklistValues = Joi.object({
    key_id: Joi.number().required(),
});

const getPicklistFromValues = Joi.object({
    module: Joi.string().required(),
    picklistKey: Joi.string().required(),
});

const deleteValue = Joi.object({
    id: Joi.number().required(),
});

const getChildValues = Joi.object({
    key: Joi.string().required(),
    parent_id: Joi.number().required(),
    module: Joi.string().required(),
});

const getPicklistValuesExternal = Joi.object({
    key: Joi.string().required(),
    module: Joi.string().allow(null, ""),
});

module.exports = {
    createPicklistValues,
    getPicklistValues,
    getPicklistFromValues,
    deleteValue,
    getChildValues,
    getPicklistValuesExternal
}
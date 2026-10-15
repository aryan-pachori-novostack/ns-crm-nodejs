let Joi = require("joi");


const createPicklistKeys = Joi.object({
  id: Joi.number().allow(null, ""),
  value: Joi.string().required(),
  module_id: Joi.number().required(),
  parent_id: Joi.number().allow("", null)
});

const getPicklistKeys = Joi.object({
  module_id: Joi.number().required(),
});

const deleteKey = Joi.object({
  id: Joi.number().required(),
});

module.exports = {
  createPicklistKeys,
  getPicklistKeys,
  deleteKey
}
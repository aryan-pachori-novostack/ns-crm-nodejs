let Joi = require("joi");

const create = Joi.object({
    type: Joi.string().required(), 
    name: Joi.string().required(),  
    filters: Joi.string().required(), 
    is_default: Joi.number().required(),
    id: Joi.number().allow(null,""),
});

const getAllFilters = Joi.object({
    type: Joi.string().required(), 
});

const deleteFilterById = Joi.object({
    id: Joi.number().required(), 
});

module.exports = { 
    create,
    getAllFilters,
    deleteFilterById
}
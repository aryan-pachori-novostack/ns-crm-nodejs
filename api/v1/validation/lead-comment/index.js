let Joi = require("joi");


const create = Joi.object({
    lead_id:Joi.string().required(),
    comment:Joi.string().required(),
    status_id:Joi.number().allow(null),
    attachment_url:Joi.string().allow(null,""),
    parent_id:Joi.string().allow(null,"")
});
const update = Joi.object({
    id:Joi.string().required(),
    lead_id:Joi.string().required(),
    status_id:Joi.number().allow(null),
    comment:Joi.string().required(),
    attachment_url:Joi.string().allow(null,""),
    parent_id:Joi.string().allow(null,"")
});

const deleteComment = Joi.object({
    id:Joi.string().required()
});

const getAllComments =  Joi.object({
    parent_id:Joi.string().allow(null,""),
    lead_id: Joi.string().required()
});

module.exports = {
    create,
    update,
    deleteComment,
    getAllComments
}
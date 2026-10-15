let Joi = require("joi");


const createComment = Joi.object({
    dsa_id: Joi.string().required(),
    mobile: Joi.number().required(),
    comment: Joi.string().required(),
});

const getComment = Joi.object({
    dsa_id: Joi.string().required(),
});

module.exports = {
    createComment,
    getComment,
}
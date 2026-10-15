let Joi = require("joi");

const getStatusById= Joi.object({
  id:Joi.number().required()
});


module.exports = { 
    getStatusById
}
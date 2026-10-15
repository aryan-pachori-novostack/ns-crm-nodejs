let Joi = require("joi");


const moduleAddValidation =  Joi.object({
    value: Joi.string().required()
});
  

module.exports={
    moduleAddValidation
}
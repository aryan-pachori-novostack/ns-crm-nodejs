let Joi = require("joi");

const getProductGroup = Joi.object({
  bankName: Joi.string()
    .required().allow("")
});

const getMainProduct = Joi.object({
    bankName: Joi.string()
    .required().allow(""),
    productGroup: Joi.string()
    .required().allow(""),
});

const getProduct  = Joi.object({
    bankName: Joi.string()
    .required().allow(""),
    productGroup: Joi.string()
    .required().allow(""),
    mainProduct: Joi.string()
    .required().allow(""),
  });

const  getPayout = Joi.object({
    bankName: Joi.string().allow(""),
    productGroup: Joi.string().allow(""),
    mainProduct: Joi.string().allow(""),
    product: Joi.string().allow(""),
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
  });


module.exports = { 
  getProductGroup,
  getMainProduct,
  getProduct,
  getPayout
}
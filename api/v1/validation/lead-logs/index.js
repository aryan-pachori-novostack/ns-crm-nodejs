let Joi = require("joi");


const getLeadLog =  Joi.object({
    lead_id: Joi.string().required(),
    pageNumber:Joi.number().allow(null),
    pageSize:Joi.number().allow(null)
  });

module.exports={
    getLeadLog
}
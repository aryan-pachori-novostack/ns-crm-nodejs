let Joi = require("joi");

const getLeadStatus = Joi.object({
  status: Joi.number().allow(null)
});



module.exports = { 
    getLeadStatus
}
const Joi = require("joi");

const createTemplate = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().required(),
    subject: Joi.string().required(),
    body: Joi.string().required(),
    type: Joi.string().valid('push_notification' , 'app_notification'), 
    link: Joi.string().allow(null, "").optional(),
    attachments: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('image', 'document').required(),
        file: Joi.object().required()
      }).required()
    ).optional()
  });
  
  const updateTemplate = Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
    description: Joi.string().required(),
    subject: Joi.string().required(),
    body: Joi.string().required(),
    link: Joi.string().allow(null, "").optional(), 
    type: Joi.string().valid('push_notification' , 'app_notification'), 
    attachments: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('image', 'document').required(),
        url: Joi.string().uri().required()
      }).required()
    ).optional()  
  });
  
  const deleteTemplate = Joi.object({
    id: Joi.string().required()  
  });
  
  const getTemplateById = Joi.object({
    id: Joi.string().required(),   
  });
  
  const getTemplatesByType = Joi.object({
    type: Joi.string().valid('sms', 'email', 'push_notification' , 'app_notification').required(), 
    offset: Joi.number().integer().min(0).optional(), 
    limit: Joi.number().integer().min(1).max(100).optional() 
  });
  
  module.exports = {
    createTemplate,
    
    updateTemplate,
    deleteTemplate,
    getTemplateById,
    getTemplatesByType
  };
  
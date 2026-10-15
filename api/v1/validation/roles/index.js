let Joi = require("joi");

const deleteRoleSchema = Joi.object({
  roleId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Role ID must be a valid UUID.',
      'any.required': 'Role ID is required.'
    })
});

const addRoleSchema = Joi.object({
  roleName: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'Role name must be at least 2 characters long.',
      'string.max': 'Role name must not exceed 100 characters.',
      'any.required': 'Role name is required.'
    })
});

const getRoleModulesSchema = Joi.object({
  roleId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Role ID must be a valid UUID.',
      'any.required': 'Role ID is required.'
    })
});

const updateRoleModulesSchema = Joi.object({
  roleId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Role ID must be a valid UUID.',
      'any.required': 'Role ID is required.'
    }),
  modules: Joi.array()
    .items(
      Joi.object({
        role_id: Joi.string().uuid().optional(),
        role: Joi.string().optional(),
        module_id: Joi.number()
          .integer()
          .positive()
          .required()
          .messages({
            'number.base': 'Module ID must be a number.',
            'number.integer': 'Module ID must be an integer.',
            'number.positive': 'Module ID must be positive.',
            'any.required': 'Module ID is required.'
          }),
        module_name: Joi.string().optional(),
        create: Joi.number()
          .integer()
          .min(0)
          .max(1)
          .required()
          .messages({
            'number.base': 'Create permission must be 0 or 1.',
            'number.min': 'Create permission must be 0 or 1.',
            'number.max': 'Create permission must be 0 or 1.',
            'any.required': 'Create permission is required.'
          }),
        read: Joi.number()
          .integer()
          .min(0)
          .max(1)
          .required()
          .messages({
            'number.base': 'Read permission must be 0 or 1.',
            'number.min': 'Read permission must be 0 or 1.',
            'number.max': 'Read permission must be 0 or 1.',
            'any.required': 'Read permission is required.'
          }),
        update: Joi.number()
          .integer()
          .min(0)
          .max(1)
          .required()
          .messages({
            'number.base': 'Update permission must be 0 or 1.',
            'number.min': 'Update permission must be 0 or 1.',
            'number.max': 'Update permission must be 0 or 1.',
            'any.required': 'Update permission is required.'
          }),
        delete: Joi.number()
          .integer()
          .min(0)
          .max(1)
          .required()
          .messages({
            'number.base': 'Delete permission must be 0 or 1.',
            'number.min': 'Delete permission must be 0 or 1.',
            'number.max': 'Delete permission must be 0 or 1.',
            'any.required': 'Delete permission is required.'
          })
      })
    )
    .min(1)
    .required()
    .messages({
      'array.base': 'Modules must be an array.',
      'array.min': 'At least one module is required.',
      'any.required': 'Modules array is required.'
    })
});

module.exports = {
  deleteRoleSchema,
  addRoleSchema,
  getRoleModulesSchema,
  updateRoleModulesSchema
};

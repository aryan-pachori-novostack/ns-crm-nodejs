let Joi = require("joi");

const getLog = Joi.object({
    application_id: Joi.string().allow(null, ''),
    application_type: Joi.string().allow(null, ''),
    field: Joi.string().allow(null, '')
});

const getActivityLogs = Joi.object({
    pageNumber:Joi.number().optional(),
    pageSize:Joi.number().optional(),
    custId : Joi.string().optional(),
    scope : Joi.string().optional(),
    eventTypes: Joi.array().items(Joi.string()).optional(),

});

const filterItemSchema = Joi.object({
    dsa_id: Joi.string().optional().allow(null, ''),
    field: Joi.string().required(),
    operator: Joi.string().required(),
    id: Joi.alternatives().try(Joi.string(), Joi.number()).allow(null, ''),
    fromInput: Joi.string().allow(null, ''),
    value: Joi.alternatives().try(
        Joi.string().allow('', null),
        Joi.number().allow(null),
        Joi.boolean().allow(null),
        Joi.array().items(Joi.alternatives().try(Joi.string(), Joi.number())).allow(null)
    ).default(null),
});

const getVendorAutonomousApprovalAuditLogs = Joi.object({
    filterModel: Joi.object({
        items: Joi.array().items(filterItemSchema).default([]),
        logicOperator: Joi.string().valid('and', 'or').default('and'),
    }).default({ items: [], logicOperator: 'and' }),
    dsa_id: Joi.string().optional().allow(null, ''),
    pageNumber: Joi.number().integer().min(0).default(0),
    pageSize: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
    getLog,
    getActivityLogs,
    getVendorAutonomousApprovalAuditLogs,
}

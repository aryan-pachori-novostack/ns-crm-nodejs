let Joi = require("joi");
const { sortBy } = require("lodash");

const createCallLogs = Joi.object({
    user_type: Joi.string().required().allow('lead', 'dsa'),
    user_id: Joi.string().required(),
    call_status: Joi.number().required(),
    remarks: Joi.string().required(),
    id: Joi.number().allow(null, ""),
});

const getAllCallLogs = Joi.object({
    call_status: Joi.number().allow(""),
    user_type: Joi.string().required().allow('lead', 'dsa'),
    user_id: Joi.string().required(),
    created_time_end: Joi.string().allow(""),
    created_time_start: Joi.string().allow(""),
    remark: Joi.string().allow(""),
    tags: Joi.string().allow(""),
});

const getCallReport = Joi.object({
    type: Joi.string().allow(null, ""),
    teleCallerId: Joi.array().required(),
    startDateFilter: Joi.string().allow(null, ""),
    endDateFilter: Joi.string().allow(null, ""),
    startDateAssignFilter: Joi.string().allow(null, ""),
    endDateAssignFilter: Joi.string().allow(null, ""),
    is_export: Joi.boolean().allow(null, ""),
});

const getPendingCallCount = Joi.object({
    teleCallerId: Joi.array().required(),
    startDateFilter: Joi.string().allow(null, ""),
    endDateFilter: Joi.string().allow(null, ""),
    status: Joi.array().allow(null, ""),
    type: Joi.string().allow(null, ""),
});

const clickToCallSlashRtc = Joi.object({
    customerNumber: Joi.string().required(),
    user_type: Joi.string().required(),
});

const getCallLogs = Joi.object({
    pageNumber: Joi.number().required(),
    pageSize: Joi.number().required(),
    filterModel: Joi.object().allow(null, ""),
    sortBy: Joi.string().allow(null, ""),
    sortDirection: Joi.string().allow(null, ""),
    logicOperator: Joi.string().allow(null, ""),
    is_export: Joi.boolean().allow(null, ""),
});

module.exports = {
    createCallLogs,
    getAllCallLogs,
    getCallReport,
    getPendingCallCount,
    clickToCallSlashRtc,
    getCallLogs
};
let Joi = require("joi");

const getB2cLeads = Joi.object({
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    full_name_filter: Joi.string().allow(null, ""),
    mobile_number_filter: Joi.string().allow(null, ""),
    email_filter: Joi.string().allow(null, ""),
    loan_type_filter: Joi.string().allow(null, ""),
    utm_source_filter: Joi.string().allow(null, ""),
    utm_medium_filter: Joi.string().allow(null, ""),
    utm_campaign_filter: Joi.string().allow(null, ""),
    startDateFilter: Joi.string().allow(null, ""),
    endDateFilter: Joi.string().allow(null, ""),
});

const getB2cLeadsById = Joi.object({
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    user_id: Joi.string().required(),
});

const getAllHyperlinkContent = Joi.object({
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    location_filter: Joi.string().allow(null, ""),
    loan_type_filter: Joi.string().allow(null, ""),
    content_type_filter: Joi.string().allow(null, ""),
    title_filter: Joi.string().allow(null, ""),
    meta_title_filter: Joi.string().allow(null, ""),
    description_filter: Joi.string().allow(null, ""),
    note_filter: Joi.string().allow(null, ""),
    status_filter: Joi.string().allow(null, "")
});

const insertHyperlinkContent = Joi.object({
    id: Joi.number().allow(null, ""),
    title: Joi.string().allow(null, ""),
    meta_title: Joi.string().allow(null, ""),
    content_type: Joi.string().allow(null, ""),
    description: Joi.string().allow(null, ""),
    note: Joi.string().allow(null, ""),
    location: Joi.string().allow(null, ""),
    loan_type: Joi.string().allow(null, ""),
    icon: Joi.string().allow(null, ""),
    status: Joi.string().allow(null, ""),
});

const deleteHyperlinkContent = Joi.object({
    id: Joi.number().required()
});

const getHyperlinkContentExtended = Joi.object({
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    content_id: Joi.number().required(null, ""),
});

const insertHyperlinkContentExtended = Joi.object({
    id: Joi.number().allow(null, ""),
    content_id: Joi.number().required(),
    data: Joi.array().required()
});

const deleteHyperlinkContentExtended = Joi.object({
    id: Joi.number().required()
});

const getHyperlinkDataExternal = Joi.object({
    loan_type: Joi.string().required(),
    location: Joi.string().required(),
});

const getHyperlinkLocationExternal = Joi.object({
    loan_type: Joi.string().required(),
});

const getB2cUserQueries = Joi.object({
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    filterModel: Joi.object({
        items: Joi.array().items(Joi.object({
            field: Joi.string().required(),
            operator: Joi.string().required(),
            value: Joi.any().allow(null, ""),
        })).default([]),
    }).default({ items: [] }),
    sortBy: Joi.string().allow(null, ""),
    sortDirection: Joi.string().valid('asc', 'desc').allow(null, ""),
    is_export: Joi.boolean().allow(null, ""),
});

const copyHyperLinkContent = Joi.object({
    content_type: Joi.string().allow(null, ""),
    location: Joi.string().allow(null, ""),
    loan_type: Joi.string().allow(null, ""),
    content_id: Joi.number().allow(null, ""),
});

module.exports = {
    getB2cLeads,
    getAllHyperlinkContent,
    insertHyperlinkContent,
    deleteHyperlinkContent,
    insertHyperlinkContentExtended,
    getHyperlinkContentExtended,
    deleteHyperlinkContentExtended,
    getHyperlinkDataExternal,
    getHyperlinkLocationExternal,
    getB2cLeadsById,
    getB2cUserQueries,
    copyHyperLinkContent
};
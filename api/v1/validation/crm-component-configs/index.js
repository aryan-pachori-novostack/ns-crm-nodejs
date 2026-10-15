let Joi = require("joi");

const createCrmComponentConfigs = Joi.object({
    platform: Joi.string().required(),
    module: Joi.string().required(),
    placement: Joi.string().required(),
    component_type: Joi.string().required(),
    title: Joi.string().required(),
    sub_title: Joi.string().required().allow(null, ""),
    description: Joi.string().required().allow(null, ""),
    section: Joi.string().required()
});

const editCrmComponentConfigs = Joi.object({
    id: Joi.number().required(),
    platform: Joi.string().required(),
    module: Joi.string().required(),
    placement: Joi.string().required(),
    component_type: Joi.string().required(),
    title: Joi.string().required(),
    sub_title: Joi.string().required().allow(null, ""),
    description: Joi.string().required().allow(null, ""),
    section: Joi.string().required()
});

const createCrmComponentMeta = Joi.object({
    id: Joi.number().allow(null, ""),
    config_id: Joi.number().required(),
    media_title: Joi.string().required(),
    media_source: Joi.string().required(),
    media_type: Joi.string().required().allow('image', 'video'),
    hyperlink: Joi.string().allow('', null),
    hypertext: Joi.string().allow('', null),
    description: Joi.string().allow('', null),
    sort_order: Joi.number().allow('', null),
    expiration_date: Joi.string().allow('', null),
    category: Joi.string().allow('', null),
    sub_category: Joi.string().allow('', null),
    tags: Joi.array().allow('', null),
    status: Joi.number().allow('', null),
});

const getAllCrmComponentConfigs = Joi.object({
    pageNumber: Joi.number().required(),
    pageSize: Joi.number().required(),
    config_id_filter: Joi.string().allow('', null),
    title_filter: Joi.string().allow('', null),
    sub_title_filter: Joi.string().allow('', null),
    platform_filter: Joi.string().allow('', null),
    module_filter: Joi.string().allow('', null),
    placement_filter: Joi.string().allow('', null),
    component_type_filter: Joi.string().allow('', null),
    description_filter: Joi.string().allow('', null),
    section_filter: Joi.string().allow('', null),
});

const deleteCrmComponentConfigs = Joi.object({
    id: Joi.number().required(),
});

const getCrmComponentMetaForConfig = Joi.object({
    id: Joi.number().required(),
});

const getMetaExternal = Joi.object({
    module: Joi.string().required(),
    platform: Joi.string().required(),
    component_type: Joi.string().allow(null, ""),
    category: Joi.string().allow(null, ""),
    sub_category: Joi.string().allow(null, ""),
    tag: Joi.string().allow(null, ""),
    is_hero_slider: Joi.boolean().allow(null, ""),
});

const getAllGlobalTagsByType = Joi.object({
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    content_type: Joi.string().required(),
    search: Joi.string().allow(null, ""),
});

module.exports = {
    createCrmComponentConfigs,
    getAllCrmComponentConfigs,
    deleteCrmComponentConfigs,
    editCrmComponentConfigs,
    createCrmComponentMeta,
    getCrmComponentMetaForConfig,
    getMetaExternal,
    getAllGlobalTagsByType
};
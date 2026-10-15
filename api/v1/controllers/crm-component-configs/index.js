const { logger } = require("../../../helpers/logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let CrmComponentConfigServices = require(_pathconst.ServicesPath.CrmComponentConfigServices);
let StatusService = require(_pathconst.ServicesPath.StatusService);
let CrmComponentConfigValidationV1 = require(_pathconst.ReqModelsPath.CrmComponentConfigValidationV1);
const { uploadToS3, checkWhereInQueryString } = require("../../../helpers/commonhelper");
let randomstring = require("randomstring");

const getAllCrmComponentConfigs = async (req, res, next) => {
    try {
        const { error } = CrmComponentConfigValidationV1.getAllCrmComponentConfigs.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { pageNumber, pageSize, config_id_filter, title_filter, sub_title_filter, platform_filter, module_filter, placement_filter, component_type_filter, description_filter, section_filter } = req?.body;
            let where = "";
            if (config_id_filter) {
                where = checkWhereInQueryString(where);
                where += ` id like '%${config_id_filter}%' `;
            };
            if (title_filter) {
                where = checkWhereInQueryString(where);
                where += ` title like '%${title_filter}%' `;
            };
            if (sub_title_filter) {
                where = checkWhereInQueryString(where);
                where += ` sub_title like '%${sub_title_filter}%' `;
            };
            if (platform_filter) {
                where = checkWhereInQueryString(where);
                where += ` platform like '%${platform_filter}%' `;
            };
            if (module_filter) {
                where = checkWhereInQueryString(where);
                where += ` module like '%${module_filter}%' `;
            };
            if (placement_filter) {
                where = checkWhereInQueryString(where);
                where += ` placement like '%${placement_filter}%' `;
            };
            if (component_type_filter) {
                where = checkWhereInQueryString(where);
                where += ` component_type like '%${component_type_filter}%' `;
            };
            if (description_filter) {
                where = checkWhereInQueryString(where);
                where += ` description like '%${description_filter}%' `;
            };
            if (section_filter) {
                where = checkWhereInQueryString(where);
                where += ` section like '%${section_filter}%' `;
            };
            let crmComponentConfigs = await CrmComponentConfigServices.getAllCrmComponentConfigs(where, pageNumber * pageSize, pageSize);
            ResHelper.apiResponse(res, true, "Success", 200, crmComponentConfigs, "");
        }
    }
    catch (e) {
        console.log(e)
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const createCrmComponentConfigs = async (req, res, next) => {
    try {
        const { error } = CrmComponentConfigValidationV1.createCrmComponentConfigs.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            await CrmComponentConfigServices.createCrmComponentConfigs(req.body);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const editCrmComponentConfigs = async (req, res, next) => {
    try {
        const { error } = CrmComponentConfigValidationV1.editCrmComponentConfigs.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            await CrmComponentConfigServices.editCrmComponentConfigs(req.body);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const deleteCrmComponentConfigs = async (req, res, next) => {
    try {
        const { error } = CrmComponentConfigValidationV1.deleteCrmComponentConfigs.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { id } = req.body;
            let crmComponentConfigs = await CrmComponentConfigServices.deleteCrmComponentConfigs(id);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const createCrmComponentMeta = async (req, res, next) => {
    try {
        const { error } = CrmComponentConfigValidationV1.createCrmComponentMeta.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { tags, config_id, media_source, media_type } = req.body;
            let crmComponentConfig = await CrmComponentConfigServices.getCrmComponentConfigs(config_id);
            if (!crmComponentConfig) {
                ResHelper.apiResponse(res, false, "Component Configuration not found ", 400, {}, "");
                return;
            };
            // let status = await StatusService.getStatusByValue('ACTIVE');
            // req.body.status = status.id;
            if (media_type == 'image' && !media_source?.includes("https://")) {
                let uniqueString1 = randomstring.generate();
                req.body.media_source = await uploadToS3('crm_components_meta', media_source, `crm_components_meta_${uniqueString1}`, 'image/jpeg', "jpg");
            };
            let id = await CrmComponentConfigServices.createCrmComponentMeta({ ...req?.body, created_by: req.loggedInUser.id, updated_by: req.loggedInUser.id });
            await CrmComponentConfigServices.createGlobalTags(tags, id);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getCrmComponentMetaForConfig = async (req, res, next) => {
    try {
        const { error } = CrmComponentConfigValidationV1.getCrmComponentMetaForConfig.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { id } = req.body;
            let crmComponentConfig = await CrmComponentConfigServices.getCrmComponentConfigs(id);
            if (!crmComponentConfig) {
                ResHelper.apiResponse(res, false, "Component Configuration not found ", 400, {}, "");
                return;
            }
            let crmConfigMeta = await CrmComponentConfigServices.getCrmComponentMetaForConfig(id);
            ResHelper.apiResponse(res, true, "Success", 200, crmConfigMeta, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getMetaExternal = async (req, res, next) => {
    try {
        const { error } = CrmComponentConfigValidationV1.getMetaExternal.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let crmConfigMeta = await CrmComponentConfigServices.getMetaExternal(req?.body);
            ResHelper.apiResponse(res, true, "Success", 200, crmConfigMeta, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllGlobalTagsByType = async (req, res, next) => {
    try {
        const { error } = CrmComponentConfigValidationV1.getAllGlobalTagsByType.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, content_type, search } = req.body;
            let where = "";
            if (content_type) {
                where = checkWhereInQueryString(where);
                where += ` content_type = '${content_type}' `;
            };
            if (search) {
                where = checkWhereInQueryString(where);
                where += ` tag like '%${search}%' `;
            };
            let data = await CrmComponentConfigServices.getAllGlobalTagsByType(pageNumber * pageSize, pageSize, where);
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

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



const Lead = require("../../../../models/Lead");
const { logger } = require("../../../helpers/logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let TagValidationV1 = require(_pathconst.ReqModelsPath.TagValidationV1);
let TagService = require(_pathconst.ServicesPath.TagService);
let LeadService = require(_pathconst.ServicesPath.LeadService);

const create = async (req, res, next) => {
    try {
        const { error } = await TagValidationV1.add.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { tags, leadId } = req.body;
            let lead = await LeadService.getLeadById(leadId);
            if (!lead) {
                ResHelper.apiResponse(res, false, "Invalid Lead Id", 400, {}, "");
            } else {
                for (let i = 0; i < tags.length; i++) {
                    await TagService.addTagToLead(tags[i], leadId, req.loggedInUser.id);
                }
                ResHelper.apiResponse(res, true, "Tags Added", 201, {}, "");
            }
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const get = async (req, res, next) => {
    try {
        const { error } = await TagValidationV1.get.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { tagId, search } = req.body;
            let where = [];
            if (tagId) {
                where.push(['id', ` = uuid_to_bin('${tagId}')`]);
            }
            if (search) {
                where.push([' tag ', ` like '%${search}%' `, null]);
            }
            let tags = await TagService.get(where);
            ResHelper.apiResponse(res, true, "Success", 200, tags, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const deleteTag = async (req, res, next) => {
    try {
        const { error } = await TagValidationV1.deleteTag.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { leadId, tagIds } = req.body;
            for (let i = 0; i < tagIds.length; i++) {
                await TagService.deleteTag(tagIds[i], leadId);
            }
            ResHelper.apiResponse(res, true, "Success", 201, null, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getLeadTag = async (req, res, next) => {
    try {
        const { error } = await TagValidationV1.getLeadTag.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { leadId } = req.body;
            let tags = await TagService.getLeadTag(leadId);
            ResHelper.apiResponse(res, true, "Success", 200, tags, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const modifyTag = async (req, res) => {
    try {
        const { error } = await TagValidationV1.modifyTag.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { type, reference_id, tag } = req.body;
            let tags = await TagService.modifyTag(type, reference_id, tag);
            ResHelper.apiResponse(res, true, "Success", 200, tags, "");
        }
    }
    catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

module.exports = {
    create,
    get,
    deleteTag,
    getLeadTag,
    modifyTag
};



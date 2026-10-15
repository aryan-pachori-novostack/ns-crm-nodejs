//created dsa controller to serve the routes for RULOANS CUSTOMER DATA
const { logger } = require("../../../helpers/logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let ListFilterService = require(_pathconst.ServicesPath.ListFiltersServices);
let ListFiltersValidationV1 = require(_pathconst.ReqModelsPath.ListFiltersValidationV1);

const create = async (req, res) => {
    try {
        const { error } = ListFiltersValidationV1.create.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let filters = await ListFilterService.create(req?.body, req?.loggedInUser?.id);
            ResHelper.apiResponse(res, true, "Success", 200, filters, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getAllFilters = async (req, res) => {
    try {
        const { error } = ListFiltersValidationV1.getAllFilters.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let filters = await ListFilterService.getAllFilters(req?.body, req?.loggedInUser?.id);
            ResHelper.apiResponse(res, true, "Success", 200, filters, "");
        }
    }
    catch (e) {
        console.log(e)
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const deleteFilterById = async (req, res) => {
    try {
        const { error } = ListFiltersValidationV1.deleteFilterById.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            await ListFilterService.deleteFilterById(req.body);
            ResHelper.apiResponse(res, true, "Success", 200, true, "");
        }
    }
    catch (e) {
        console.log(e)
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

module.exports = {
    create,
    getAllFilters,
    deleteFilterById
};
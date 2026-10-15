//created dsa controller to serve the routes for RULOANS CUSTOMER DATA
const { logger } = require("../../../helpers/logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let ModulesServices = require(_pathconst.ServicesPath.ModulesServices);
let ModuleValidation = require(_pathconst.ReqModelsPath.ModulesValidationV1);

const createModules = async (req, res, next) => {
    try {
        const { error } = ModuleValidation.moduleAddValidation.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { value } = req.body;
            let modules = await ModulesServices.create(value);
            ResHelper.apiResponse(res, true, "Success", 200, modules, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getModules = async (req, res, next) => {
    try {
        let modules = await ModulesServices.get();
        ResHelper.apiResponse(res, true, "Success", 200, modules, "");
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getFullModules = async (req, res, next) => {
    try {
        const { error } = ModuleValidation.moduleAddValidation.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { value } = req?.body
            let modules = await ModulesServices.getFullModules(value);
            ResHelper.apiResponse(res, true, "Success", 200, modules, "");
        }
    }
    catch (e) {
        console.log(e)
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }

}

module.exports = {
    createModules,
    getModules,
    getFullModules
};
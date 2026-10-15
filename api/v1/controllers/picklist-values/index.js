//created dsa controller to serve the routes for RULOANS CUSTOMER DATA
const { logger } = require("../../../helpers/logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let PicklistValuesServices = require(_pathconst.ServicesPath.PicklistValuesServices);
let PicklistValuesValidationV1 = require(_pathconst.ReqModelsPath.PicklistValuesValidationV1);

const createPicklistValues = async (req, res) => {
    try {
        const { error } = PicklistValuesValidationV1.createPicklistValues.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let picklistValues = await PicklistValuesServices.create(req?.body);
            ResHelper.apiResponse(res, true, "Success", 200, picklistValues, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getPicklistValues = async (req, res) => {
    try {
        const { error } = PicklistValuesValidationV1.getPicklistValues.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { key_id } = req?.body;
            let picklistValues = await PicklistValuesServices.get(key_id);
            ResHelper.apiResponse(res, true, "Success", 200, picklistValues, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getPicklistFromValues = async (req, res) => {
    try {
        const { error } = PicklistValuesValidationV1.getPicklistFromValues.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const {module, picklistKey } = req?.body;
            let picklistValues = await PicklistValuesServices.getFromValue(key_id);
            ResHelper.apiResponse(res, true, "Success", 200, picklistValues, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const deleteValue = async (req, res, next) => {
    try {
        const { error } = PicklistValuesValidationV1.deleteValue.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const {id} = req?.body;
            let picklistValues = await PicklistValuesServices.deleteValue(id);
            ResHelper.apiResponse(res, true, "Success", 200, picklistValues, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getChildValues = async (req, res) => {
    try {
        const { error } = PicklistValuesValidationV1.getChildValues.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const {id} = req?.body;
            let picklistValues = await PicklistValuesServices.getChildValues(req.body);
            ResHelper.apiResponse(res, true, "Success", 200, picklistValues, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getPicklistValuesExternal = async (req, res) => {
    try {
        const { error } = PicklistValuesValidationV1.getPicklistValuesExternal.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let picklistValues = await PicklistValuesServices.getPicklistValuesExternal(req.body);
            ResHelper.apiResponse(res, true, "Success", 200, picklistValues, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

module.exports = {
    createPicklistValues,
    getPicklistValues,
    getPicklistFromValues,
    deleteValue,
    getChildValues,
    getPicklistValuesExternal
};
//created dsa controller to serve the routes for RULOANS CUSTOMER DATA
const { logger } = require("../../../helpers/logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let PicklistValuesServices = require(_pathconst.ServicesPath.PicklistValuesServices);
let PicklistValuesValidationV1 = require(_pathconst.ReqModelsPath.PicklistValuesValidationV1);

exports.getPicklistValuesExternal = async (req, res) => {
    try {
        const { error } = PicklistValuesValidationV1.getPicklistValuesExternal.validate(req.query);
        if (error) {
            ResHelper.apiResponseV2(res, false, error.message, 400, {}, "");
        } else {
            let picklistValues = await PicklistValuesServices.getPicklistValuesExternal(req.query);
            ResHelper.apiResponseV2(res, true, "Success", 200, picklistValues, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponseV2(res, false, "Error occured during execution", 500, {}, "");
    }
};


exports.getPicklistValuesByKeyId = async (req, res) => {
    try {
        const { error, value } = PicklistValuesValidationV1.getPicklistValues.validate(req.query, { convert: true });
        if (error) {
            ResHelper.apiResponseV2(res, false, error.message, 400, {}, "");
        } else {
            let picklistValues = await PicklistValuesServices.get(value.key_id);
            ResHelper.apiResponseV2(res, true, "Success", 200, picklistValues, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponseV2(res, false, "Error occured during execution", 500, {}, "");
    }
};
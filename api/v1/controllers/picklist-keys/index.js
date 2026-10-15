//created dsa controller to serve the routes for RULOANS CUSTOMER DATA
const { logger } = require("../../../helpers/logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let PicklistKeysServices = require(_pathconst.ServicesPath.PicklistKeysServices);
let PicklistKeysValidationV1 = require(_pathconst.ReqModelsPath.PicklistKeysValidationV1);

const createPicklistKeys = async (req, res, next) => {
    try {
        const { error } = PicklistKeysValidationV1.createPicklistKeys.validate(req.body);
        let message = "Can't edit the key having values associated with it.";
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const {id} = req?.body;
            if(id){
                let exist = await PicklistKeysServices.checkValueExist(id);
                if(!exist){
                    return ResHelper.apiResponse(res, false, message, 200, {}, "");
                }
            }
            let picklistKeys = await PicklistKeysServices.create(req?.body);
            ResHelper.apiResponse(res, true, "Success", 200, picklistKeys, "");
        }
    }
    catch (e) {
        console.log(e)
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getPicklistKeys = async (req, res, next) => {
    try {
        const { error } = PicklistKeysValidationV1.getPicklistKeys.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { module_id } = req?.body;
            let picklistKeys = await PicklistKeysServices.get(module_id);
            ResHelper.apiResponse(res, true, "Success", 200, picklistKeys, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const deleteKey = async (req, res) => {
    try {
        const { error } = PicklistKeysValidationV1.deleteKey.validate(req.body);
        let message = "Can't delete the key having values associated with it."
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const {id} = req?.body;
            if(id){
                let exist = await PicklistKeysServices.checkValueExist(id);
                if(exist){
                    return ResHelper.apiResponse(res, false, message, 200, {}, "");
                }
            }
            let picklistKeys = await PicklistKeysServices.deleteKey(id);
            ResHelper.apiResponse(res, true, "Success", 200, picklistKeys, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

module.exports = {
    createPicklistKeys,
    getPicklistKeys,
    deleteKey
};
//created dsa controller to serve the routes for RULOANS CUSTOMER DATA
const { logger } = require("../../../helpers/logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let DSAService = require(_pathconst.ServicesPath.DSAService);








/**
 * @controller help to get ru_customer captured details
 */
const getCustomerCapturedDetails = async (req, res) => {
    try {
        if(!req.body.pan){
            return ResHelper.apiResponse(res, false, "failed", 400, {}, "");
        }
        let details = await DSAService.getCustomerCapturedDetails({ pan: req.body.pan });
        details = (details && (details[0] || {}) ) || {};
        ResHelper.apiResponse(res, true, "Success", 200, details, "");
    }catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};


module.exports = {
    getCustomerCapturedDetails
}
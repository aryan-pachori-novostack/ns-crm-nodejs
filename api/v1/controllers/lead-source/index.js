//created dsa controller to serve the routes for RULOANS CUSTOMER DATA
const {logger} = require("../../../helpers/logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let LeadSourceService = require(_pathconst.ServicesPath.LeadSourceService);
let LeadStatusValidationV1 = require(_pathconst.ReqModelsPath.LeadStatusValidationV1);


const get = async (req, res, next) => {
    try {
        let leadSources = await LeadSourceService.get();
        ResHelper.apiResponse(res, true, "Success", 200, leadSources, "");
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}




module.exports = {
   get
};



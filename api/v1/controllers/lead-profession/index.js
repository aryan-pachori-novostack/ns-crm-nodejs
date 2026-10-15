//created dsa controller to serve the routes for RULOANS CUSTOMER DATA
const {logger} = require("../../../helpers/logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let LeadProfessionService = require(_pathconst.ServicesPath.LeadProfessionService);


const get = async (req, res, next) => {
    try {
            let leadProfessions = await LeadProfessionService.get();
            ResHelper.apiResponse(res, true, "Success", 200, leadProfessions, "");
        
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}




module.exports = {
   get
};



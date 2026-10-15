//created dsa controller to serve the routes for RULOANS CUSTOMER DATA
const {logger} = require("../../../helpers/logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let LeadCategoryService = require(_pathconst.ServicesPath.LeadCategoryService);


const get = async (req, res, next) => {
    try {
            let leadCategories = await LeadCategoryService.get();
            ResHelper.apiResponse(res, true, "Success", 200, leadCategories, "");
        
    }
    catch (e) {
         logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}




module.exports = {
   get
};



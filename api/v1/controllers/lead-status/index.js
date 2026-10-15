//created dsa controller to serve the routes for RULOANS CUSTOMER DATA
const {logger} = require("../../../helpers/logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let LeadStatusService = require(_pathconst.ServicesPath.LeadStatusService);
let LeadStatusValidationV1 = require(_pathconst.ReqModelsPath.LeadStatusValidationV1);

const get = async (req, res, next) => {
    try {
        const { error } = LeadStatusValidationV1.getLeadStatus.validate(req.body);
        if(error){
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        }else{
            let {status} = req.body;
            let where = [];
            if(status){
              where.push(['ls.parent_id','=',status]);
            }else{
                where.push(['ls.parent_id',' is null ',null])
            }
            let leadStatus = await LeadStatusService.get(where);
            ResHelper.apiResponse(res, true, "Success", 200, leadStatus, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}




module.exports = {
   get
};



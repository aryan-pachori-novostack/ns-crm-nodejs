const {logger} = require("../../../helpers/logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let LeadLogService = require(_pathconst.ServicesPath.LeadLogService);
let LeadLogValidationV1 = require(_pathconst.ReqModelsPath.LeadLogValidationV1);

const create = async (data) => {
    try {
       await LeadLogService.create(data);
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const get = async (req,res,next) => {
    try {
        const { error } = LeadLogValidationV1.getLeadLog.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber,pageSize,lead_id} = req.body;
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }
            let where = [];
            if (lead_id) {
                where.push(['ll.lead_id', `= uuid_to_bin('${lead_id}')`, null]);
            }
            let leadLogs = await LeadLogService.get(where, pageNumber * pageSize, pageSize);
            ResHelper.apiResponse(res, true, "Success", 200, leadLogs, "");
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



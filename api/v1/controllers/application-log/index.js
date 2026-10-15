const { logger } = require("../../../helpers/logger");
const { getActivityLogsMongo } = require("../../../services/mongo");
let ResHelper = require(_pathconst.FilesPath.ResHelper);

let ApplicationLogServices = require(_pathconst.ServicesPath.ApplicationLogServices);
const ApprovalAuditServices = require("../../../services/approval-audit-services");
let ApplicationLogValidationV1 = require(_pathconst.ReqModelsPath.ApplicationLogValidationV1);

const getLog = async (req, res, next) => {
    try {
        const { error } = ApplicationLogValidationV1.getLog.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let call_logs = await ApplicationLogServices.getLog(req.body);
            ResHelper.apiResponse(res, true, "Success", 200, call_logs, "");
        }
    }
    catch (e) {
        console.log(e)
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}
const getActivityLogs = async (req, res, next) => {
    try {
        const { error } = ApplicationLogValidationV1.getActivityLogs.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { pageNumber, pageSize, scope, custId, eventTypes } = req.body;
            let mongoResp = await getActivityLogsMongo(pageNumber, pageSize, scope, custId, eventTypes);
            const results = Array.isArray(mongoResp?.results) ? mongoResp.results : [];
            const totalRecords = Number(mongoResp?.totalRecords || 0);
            const records = await ApplicationLogServices.getActivityLogs(results);
            ResHelper.apiResponse(res, true, "Success", 200, { totalRecords, records }, "");
    }
}
    catch (e) {
        console.log(e)
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getVendorAutonomousApprovalAuditLogs = async (req, res, next) => {
    try {
        const { error, value } = ApplicationLogValidationV1.getVendorAutonomousApprovalAuditLogs.validate(req.body, { abortEarly: true });
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { filterModel, pageNumber, pageSize, dsa_id } = value;
            const data = await ApprovalAuditServices.getVendorAutonomousApprovalAuditLogs({
                filterModel,
                pageNumber,
                pageSize,
                dsa_id,
            });
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

module.exports = { getLog, getActivityLogs, getVendorAutonomousApprovalAuditLogs };
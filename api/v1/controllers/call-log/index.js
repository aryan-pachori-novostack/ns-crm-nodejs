const { getHierarchySalesPerson, CustomOperatorHandlers, CreateWhereQueryFilter, getRuloansCustomerApiFieldMapping } = require("../../../helpers/commonhelper");
const { logger } = require("../../../helpers/logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let CallLogServices = require(_pathconst.ServicesPath.CallLogServices);
let LeadLogService = require(_pathconst.ServicesPath.LeadLogService);
let CallLogValidationV1 = require(_pathconst.ReqModelsPath.CallLogValidationV1);
const axios = require("axios");
const DSAService = require(_pathconst.ServicesPath.DSAService);

const createCallLogs = async (req, res, next) => {
    try {
        const { error } = CallLogValidationV1.createCallLogs.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { user_type, user_id, call_status, remarks, id } = req.body;
            await CallLogServices.createCallLogs(user_type, user_id, call_status, remarks, req.loggedInUser.id, id);
            if (user_type == 'lead') {
                await LeadLogService.create({ lead_id: user_id, from: remarks, to: call_status, updated_by: req.loggedInUser.id, type: '', operation_type: 'call-log-create' });
            }
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllCallLogs = async (req, res, next) => {
    try {
        const { error } = CallLogValidationV1.getAllCallLogs.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let call_logs = await CallLogServices.getAllCallLogs(req.body);
            ResHelper.apiResponse(res, true, "Success", 200, call_logs, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getCallReport = async (req, res, next) => {
    try {
        const { error } = CallLogValidationV1.getCallReport.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        } else {
            let call_logs;
            const { type } = req?.body;
            if (type == "customer") {
                call_logs = await CallLogServices.getCallReportB2C(req.body);
            } else {
                call_logs = await CallLogServices.getCallReport(req.body);
            };
            ResHelper.apiResponse(res, true, "Success", 200, call_logs, "");
        };
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getCallReportWithComments = async (req, res, next) => {
    try {
        const { error } = CallLogValidationV1.getCallReport.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        } else {
            const { type } = req?.body;
            let call_logs;
            if (type == "customer") {
                call_logs = await CallLogServices.getCallReportWithCommentsB2C(req.body);
            } else {
                call_logs = await CallLogServices.getCallReportWithComments(req.body);
            }
            ResHelper.apiResponse(res, true, "Success", 200, call_logs, "");
        };
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getPendingCallCount = async (req, res, next) => {
    try {
        const { error } = CallLogValidationV1.getPendingCallCount.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        } else {
            const { type } = req?.body;
            let call_logs;
            if (type == "customer") {
                call_logs = await CallLogServices.getPendingCallCountB2C(req.body);
            } else {
                call_logs = await CallLogServices.getPendingCallCount(req.body);
            }
            ResHelper.apiResponse(res, true, "Success", 200, call_logs, "");
        };
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getDsaStatusChangedByUser = async (req, res, next) => {
    try {
        const { error } = CallLogValidationV1.getPendingCallCount.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        } else {
            let call_logs = await CallLogServices.getDsaStatusChangedByUser(req.body);
            ResHelper.apiResponse(res, true, "Success", 200, call_logs, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const clickToCallSlashRtc = async (req, res) => {
    try {
        const { error } = CallLogValidationV1.clickToCallSlashRtc.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        } else {
            const { user_type, customerNumber } = req?.body;
            const body = {
                agenTptId: req?.loggedInUser?.id,
                customerNumber: customerNumber,
                tokenId: user_type == "customer" ? process.env.SLASH_RTC_TOKEN_ID_B2C : process.env.SLASH_RTC_TOKEN_ID_B2B
            };
            let options = {
                'method': 'POST',
                'url': process.env.SLASH_RTC_CLICK_TO_CALL_URL,
                'headers': {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify(body),
                responseType: "text",
                validateStatus: () => true,
            };
            axios(options)
                .then((response) => {
                    const { OUTPUT, STATUS_CODE } = JSON.parse(response?.data);
                    ResHelper.apiResponse(res, true, _.startCase(OUTPUT), STATUS_CODE, JSON.parse(response?.data), "");
                })
                .catch((error) => {
                    console.log(error, "=====");
                });
        };
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const slashRTCDispositionApi = async (req, res) => {
    try {
        console.log("webhook triggered", req?.body);

        const { employeeId, leadSetId, leadSetName, processId, processName, referenceId, modeOfCalling, callStartDatetime, callEndDatetime, disposeComment, firstDispose, disconnectedBy, recordUrl, agentTalkTimesec, callTransferFlag, numberOfHold, disposeTime, customerPhoneAnswered, customerHangupCause, agentHangupCause, customerPstnHangupCause, agentPstnHangupCause, customerHangupCauseQ850, agentHangupCauseQ850, customerPstnHangupCauseQ850, agentPstnHangupCauseQ850, userName, userFullName } = req?.body;
        // customers creation
        const { phone, customerName, campaignId, campaignName } = req?.body;

        if (!phone) {
            return ResHelper.apiResponse(res, false, "Phone is required", 400, {}, "");
        };

        let user_id = null;

        if (["B2C", "B2B"]?.includes(campaignName)) {
            if (campaignName == "B2C") {
                let customer = await DSAService?.getCustomerUserDetails(` where c.customer_mobile_number = ${phone} `);
                user_id = customer?.customer_id;
            } else {
                let customer = await DSAService?.getDsaByPhone(phone);
                user_id = customer?.customer_id;
            }
            if (!user_id) {
                user_id = await CallLogServices.createCustomerSlashRtc(req.body);
            };
        };

        if (!user_id) {
            return ResHelper.apiResponse(res, false, "No user found in crm with this phone number", 400, {}, "");
        };

        await CallLogServices.createCallLogSlashRtc({ ...req.body, user_id });
        ResHelper.apiResponse(res, true, "Success", 200, {}, "");
    }
    catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getCallLogs = async (req, res,) => {
    let plain_function = req?.plain_function || false;
    try {
        const { error } = CallLogValidationV1.getCallLogs.validate(req.body);
        if (!plain_function && error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        } else {
            let { pageNumber, pageSize, filterModel, sortBy, sortDirection, logicOperator } = req.body;
            let whereFilterQuery = [['c.user_type', ' = ', 'dsa']];

            const operatorHandlers = CustomOperatorHandlers()
            if (filterModel) {
                whereFilterQuery = [...whereFilterQuery, ...CreateWhereQueryFilter(filterModel, getRuloansCustomerApiFieldMapping, operatorHandlers, "dsa_call_log")];
            };

            let data = await CallLogServices.getCallLogs({
                whereFilterQuery,
                offset: (pageNumber * pageSize) || 0,
                limit: pageSize || 10,
                sortBy,
                sortDirection,
                logicOperator,
                loggedInUser: req?.loggedInUser
            });

            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        };
    }
    catch (e) {
        console.log(e);
        logger.error(e);
    }
};

module.exports = {
    createCallLogs,
    getAllCallLogs,
    getCallReport,
    getCallReportWithComments,
    getPendingCallCount,
    getDsaStatusChangedByUser,
    clickToCallSlashRtc,
    slashRTCDispositionApi,
    getCallLogs
};



const { logger } = require("../../../helpers/logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let GraphServices = require(_pathconst.ServicesPath.GraphServices);
let DSAService = require(_pathconst.ServicesPath.DSAService);
let UserService = require(_pathconst.ServicesPath.UserService);
let GraphValidationV1 = require(_pathconst.ReqModelsPath.GraphValidationV1);
const { isBackendAccessRole } = require("../../../helpers/commonhelper");


exports.getLeadFormGraph = async (req, res, next) => {
    try {
        const { error } = GraphValidationV1.getLeadFormGraph.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { startDateFilter, endDateFilter, dsa_mobile_number } = req?.body;
            let where = ` where (flc.upload_file_name is not null or flc.loan_status = "disbursed") `;
            let childPhones = null;

            // for external api
            if (!req?.loggedInUser) {
                if (!dsa_mobile_number) {
                    return ResHelper.apiResponse(res, false, "DSA mobile number is mandatory", 400, {}, "");
                } else {
                    where += ` and flc.dsa_mobile_number in (
                    WITH RECURSIVE DSAHierarchy AS (
                        SELECT dsa_mobile_number, partner_code
                        FROM ru_direct_selling_agents
                        WHERE dsa_mobile_number = "${dsa_mobile_number}"
                        UNION ALL
                        SELECT t.dsa_mobile_number, t.partner_code
                        FROM ru_direct_selling_agents t
                        INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                    ) 
                    SELECT dsa_mobile_number
                    FROM DSAHierarchy
                  ) `;
                };
            }

            // for internal api
            else {
                if (!(req.loggedInUser.role == "CEO" || isBackendAccessRole(req.loggedInUser.role) || req.loggedInUser.role == "VENDOR")) {
                    childPhones = await DSAService.getDsaChildRecursively(req?.loggedInUser?.userPhone);
                    childPhones = [...childPhones, req?.loggedInUser?.userPhone];
                };
                if (childPhones?.length) {
                    where += req.loggedInUser.role == "BACKEND" ? ` and flc.created_by = '${req?.loggedInUser?.id}' ` : ` and (flc.dsa_mobile_number in (${childPhones}) or flc.created_by = '${req?.loggedInUser?.id}') `;
                };
                if (req.loggedInUser.role == "VENDOR") {
                    where += ` and (flc.dsa_mobile_number in (${childPhones}) or flc.created_by = '${req?.loggedInUser?.id}') `;
                };
                if (isBackendAccessRole(req.loggedInUser.role)) {
                    let parent = await UserService.findUserByPhoneOrEmail(req.loggedInUser.parentEmail, req.loggedInUser.parentEmail)
                    childPhones = await DSAService.getDsaChildRecursively(parent?.userPhone);
                    childPhones = [...childPhones, parent?.userPhone];
                    where += ` and (flc.dsa_mobile_number in (${childPhones}) or flc.created_by = '${req?.loggedInUser?.id}' or flc.created_by  = '${parent.id}') `;
                };
            };

            if (startDateFilter) {
                where += ` and DATE(flc.created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `;
            };

            let overall = await GraphServices.getLeadFormGraph(where, "");
            let lead_form = await GraphServices.getLeadFormGraph(where, ` and (flc.form_type != "customer_lead_form" or flc.form_type is null) `);
            let login_form = await GraphServices.getLeadFormGraph(where, ` and flc.form_type = "customer_lead_form" `);
            ResHelper.apiResponse(res, true, "Success", 200, { overall, lead_form, login_form }, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

exports.getLeadFormGraphMIS = async (req, res, next) => {
    try {
        const { error } = GraphValidationV1.getLeadFormGraphMIS.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { dsa_mobile_number, startDateFilter, endDateFilter, type, pageNumber, pageSize } = req?.body;
            let where = ` where (flc.upload_file_name is not null or flc.loan_status = "disbursed") `;

            // for external api
            if (!req?.loggedInUser) {
                if (!dsa_mobile_number) {
                    return ResHelper.apiResponse(res, false, "DSA mobile number is mandatory", 400, {}, "");
                } else {
                    where += ` and flc.dsa_mobile_number in (
                    WITH RECURSIVE DSAHierarchy AS (
                        SELECT dsa_mobile_number, partner_code
                        FROM ru_direct_selling_agents
                        WHERE dsa_mobile_number = "${dsa_mobile_number}"
                        UNION ALL
                        SELECT t.dsa_mobile_number, t.partner_code
                        FROM ru_direct_selling_agents t
                        INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                    ) 
                    SELECT dsa_mobile_number
                    FROM DSAHierarchy
                  ) `;
                };
            }

            // for internal api
            else {
                let childPhones = null;
                if (!(req.loggedInUser.role == "CEO" || isBackendAccessRole(req.loggedInUser.role) || req.loggedInUser.role == "VENDOR")) {
                    childPhones = await DSAService.getDsaChildRecursively(req?.loggedInUser?.userPhone);
                    childPhones = [...childPhones, req?.loggedInUser?.userPhone];
                };
                if (childPhones?.length) {
                    where += req.loggedInUser.role == "BACKEND" ? ` and flc.created_by = '${req?.loggedInUser?.id}' ` : ` and (flc.dsa_mobile_number in (${childPhones}) or flc.created_by = '${req?.loggedInUser?.id}') `;
                };
                if (req.loggedInUser.role == "VENDOR") {
                    where += ` and (flc.dsa_mobile_number in (${childPhones}) or flc.created_by = '${req?.loggedInUser?.id}') `;
                };
                if (isBackendAccessRole(req.loggedInUser.role)) {
                    let parent = await UserService.findUserByPhoneOrEmail(req.loggedInUser.parentEmail, req.loggedInUser.parentEmail)
                    childPhones = await DSAService.getDsaChildRecursively(parent?.userPhone);
                    childPhones = [...childPhones, parent?.userPhone];
                    where += ` and (flc.dsa_mobile_number in (${childPhones}) or flc.created_by = '${req?.loggedInUser?.id}' or flc.created_by  = '${parent.id}') `;
                };
            };

            if (startDateFilter) {
                where += ` and DATE(flc.created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `;
            };

            if (type == "overall") {
                data = await GraphServices.getLeadFormGraphMIS(pageNumber * pageSize, pageSize, where, "");
            } else if (type == "lead_form") {
                data = await GraphServices.getLeadFormGraphMIS(pageNumber * pageSize, pageSize, where, ` and (flc.form_type != "customer_lead_form" or flc.form_type is null) `);
            } else {
                data = await GraphServices.getLeadFormGraphMIS(pageNumber * pageSize, pageSize, where, ` and flc.form_type = "customer_lead_form" `);
            };
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        };
    }
    catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};
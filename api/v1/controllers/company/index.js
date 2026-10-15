const { checkWhereInQueryString, isBackendAccessRole, getHierarchySalesPerson, CreateWhereQueryFilter, CustomOperatorHandlers, formatGetLeadFormsFilterClause } = require("../../../helpers/commonhelper");
const { getAllCompanyFieldMapping } = require("../../../helpers/apiFieldMappings");
const { logger } = require("../../../helpers/logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let CompanyServices = require(_pathconst.ServicesPath.CompanyServices);
let CompanyValidationV1 = require(_pathconst.ReqModelsPath.CompanyValidationV1);
let UserService = require(_pathconst.ServicesPath.UserService);

exports.getAllCompany = async (req, res) => {
    try {
        const { error } = CompanyValidationV1.getAllCompany.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { pageNumber, pageSize, name_filter, short_name_filter, pan_filter, mobile_filter, business_type_filter, date_of_incorp_filter, startDateFilter, endDateFilter, filterModel, logicOperator, sortBy, sortDirection } = req?.body;

            // Legacy filters — unchanged behaviour
            let where = "";
            if (name_filter) {
                where = checkWhereInQueryString(where);
                where += ` rc.name like '%${name_filter}%' `;
            }
            if (short_name_filter) {
                where = checkWhereInQueryString(where);
                where += ` rc.short_name like '%${short_name_filter}%' `;
            }
            if (pan_filter) {
                where = checkWhereInQueryString(where);
                where += ` rc.pan like '%${pan_filter}%' `;
            }
            if (mobile_filter) {
                where = checkWhereInQueryString(where);
                where += ` rc.phone like '%${mobile_filter}%' `;
            }
            if (business_type_filter) {
                where = checkWhereInQueryString(where);
                where += ` rc.business_type like '%${business_type_filter}%' `;
            }
            if (date_of_incorp_filter) {
                where = checkWhereInQueryString(where);
                where += ` rc.date_of_incorp like '%${date_of_incorp_filter}%' `;
            }
            if (startDateFilter) {
                where = checkWhereInQueryString(where);
                where += `  DATE(rc.created_at)  between DATE("${startDateFilter}") and DATE("${endDateFilter}") `;
            }

            // MUI X DataGrid filterModel — same pattern as getAllBanks
            let whereFilterQuery = "";
            if (filterModel && filterModel.items.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, getAllCompanyFieldMapping, operatorHandlers);

                if (whereFilterArray && whereFilterArray.length > 0) {
                    const filters = whereFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    whereFilterQuery = filters.join(logicOp);
                }
            }

            if (whereFilterQuery) {
                where = checkWhereInQueryString(where);
                where += `(${whereFilterQuery})`;
            }

            let orderBy = '';
            if (sortBy) {
                const sortField = getAllCompanyFieldMapping(sortBy);
                orderBy = `${sortField} ${sortDirection || 'asc'}`;
            }

            // Hierarchy and role-based permissions logic
            let { sales_query, sales_query_where } = getHierarchySalesPerson(req?.loggedInUser, "dsa");
            let role = req?.loggedInUser?.role;
            let childPhones = null;
            if (!(role == "HR" || role == "VERIFICATION_AGENCY")) {
                childPhones = role === "CEO" ? null : req?.loggedInUser?.userPhone;
            }

            if (isBackendAccessRole(role)) {
                if (!req.loggedInUser.parentEmail) return ResHelper.apiResponse(res, false, "This User Does Not Have Any Parent", 400, {}, "");
                let phone = await UserService.findUserByPhoneOrEmail(req.loggedInUser.parentEmail, req.loggedInUser.parentEmail);
                if (!phone) return ResHelper.apiResponse(res, false, "This User Does Not Have Any Parent", 400, {}, "");
                childPhones = phone?.userPhone;
                req.loggedInUser.materialized_path = phone?.dsa_id;
            }

            childPhones = !sales_query ? childPhones : null;
            if (childPhones) {
                let sales_query_str = `dsa.salesperson_id = "${req.loggedInUser.id}"`;
                let depthQuery = req?.loggedInUser?.materialized_path ? `(dsa.materialized_path like "%${req?.loggedInUser?.materialized_path}%" and dsa.materialized_path_depth >= ${(req?.loggedInUser?.materialized_path_depth || 0)} or ${sales_query_str})` : `${sales_query_str}`;
                where = checkWhereInQueryString(where);
                where += ` ${depthQuery} `;
            }

            if (sales_query) {
                where = checkWhereInQueryString(where);
                where += ` ${sales_query_where} `;
            }

            let user_query = sales_query || "";

            let data = await CompanyServices.getAllCompany(pageNumber * pageSize, pageSize, where, user_query, orderBy);
            return ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

exports.getCompanyDetailsById = async (req, res) => {
    try {
        const { error } = CompanyValidationV1.getAllCompanyDocuments.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { company_id } = req?.body;
            let where = "";
            if (company_id) {
                where = checkWhereInQueryString(where);
                where += ` rc.company_id = '${company_id}' `;
            }
            let data = await CompanyServices.getCompanyDetailsById(where);
            return ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

exports.getAllCompanyDocuments = async (req, res) => {
    try {
        const { error } = CompanyValidationV1.getAllCompanyDocuments.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { company_id } = req?.body;
            let data = await CompanyServices.getAllCompanyDocuments(company_id);
            return ResHelper.apiResponse(res, true, "Success", 200, data, "");
        };
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};


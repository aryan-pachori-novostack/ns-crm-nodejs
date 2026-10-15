const { logger } = require("../../../helpers/logger");
var ResHelper = require(_pathconst.FilesPath.ResHelper);
var ReportServices = require(_pathconst.ServicesPath.ReportServices);
var ReportValidationV1 = require(_pathconst.ReqModelsPath.ReportValidationV1);
const { uploadToS3 } = require('../../../../api/helpers/commonhelper');
const randomstring = require('randomstring');
let AWS = require('aws-sdk');

exports.getBusinessReport = async (req, res, next) => {
    try {
        const { error } = ReportValidationV1.getBusinessReport.validate(req.query);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { pageSize, pageNumber, loan_type_filter, status_filter, city_filter, start_date, end_date, date_type, frequency, state } = req?.query;
            pageSize = parseInt(pageSize) || 10;
            pageNumber = parseInt(pageNumber) || 0;

            if (!start_date) {
                return ResHelper.apiResponse(res, false, "Please select a valid date!", 400, {}, "");
            };

            if (start_date) {
                let start = new Date(start_date);
                let end = end_date ? new Date(end_date) : new Date();
                const monthsDiff =
                    (end.getFullYear() - start.getFullYear()) * 12 +
                    (end.getMonth() - start.getMonth());

                if (monthsDiff > 6 || (monthsDiff === 6 && end.getDate() > start.getDate())) {
                    if (!loan_type_filter?.length) {
                        return ResHelper.apiResponse(res, false, "Date range must be 6 months or less without loan type filter", 400, {}, "");
                    }
                };
            };

            let params = {
                ...req?.query,
                offset: pageNumber * pageSize,
                limit: pageSize,
                loan_type_filter: loan_type_filter ? loan_type_filter?.split(",") : null,
                city_filter: city_filter ? city_filter?.split(",") : null,
                state: state == "null" ? null : state || null,
                status_filter: status_filter ? status_filter?.split(",") : null,
                dsa_id: !["CEO"]?.includes(req?.loggedInUser?.role) ? req?.loggedInUser?.dsa_id : null,
                start_date: start_date || null,
                end_date: end_date || null,
                date_type: date_type == "disbursed" ? "pm.disbursed_date" : "pl.created_at",
            };

            if (!["CEO"]?.includes(req?.loggedInUser?.role) && !req?.loggedInUser?.dsa_id) {
                return ResHelper.apiResponse(res, false, "You are not a DSA! Hierarchy Failed!", 400, {}, "");
            };

            let data = await ReportServices.getBusinessReport(params);
            if (data?.status) {
                return ResHelper.apiResponse(res, true, "Success", 200, data, "");
            };
            return ResHelper.apiResponse(res, false, data?.message, 400, data, "");
        };
    }
    catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

exports.getSalesReport = async (req, res, next) => {
    try {
        const { error } = ReportValidationV1.getSalesReport.validate(req.query);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let where = [];
            let where_dsa = [];
            let where_query = [];
            let loggedInUser = req?.loggedInUser;
            let { pageSize, pageNumber, type, city, state, start_date, end_date, call_status, created_by } = req?.query;
            pageNumber = pageNumber || 0;
            pageSize = pageSize || 10;

            if (!start_date) {
                return ResHelper.apiResponse(res, false, "Please select a valid date!", 400, {}, "");
            };

            if (!["CEO", "CTO"]?.includes(loggedInUser?.role)) {
                where.push(`cl.createdBy in (WITH RECURSIVE user_tree AS (SELECT u.id,
                                    u.name,
                                    u.parent,
                                    u.phone,
                                    CAST(bin_to_uuid(u.id) AS CHAR(200)) AS path
                             FROM CRMTest.users u
                             WHERE u.status = 1
                               AND u.isDeleted = 0
                               AND (u.sales_admin = "${loggedInUser?.id}" or u.id = uuid_to_bin("${loggedInUser?.id}"))

                             UNION ALL

                             SELECT c.id,
                                    c.name,
                                    c.parent,
                                    c.phone,
                                    CONCAT(ut.path, ',', bin_to_uuid(c.id))
                             FROM CRMTest.users c
                             INNER JOIN user_tree ut ON c.parent = ut.id
                             WHERE c.status = 1 and FIND_IN_SET(bin_to_uuid(c.id), ut.path) = 0) select bin_to_uuid(id) from user_tree)`)
            };

            if (created_by) {
                where.push(`cl.createdBy =  "${created_by}"`);
            };

            if (city) {
                where_dsa.push(
                    `city IN (${city ? city.split(",").map(c => `'${c.trim()}'`).join(",") : null})`
                );
            };

            if (state) {
                where_dsa.push(
                    `state IN (${state ? state.split(",").map(c => `'${c.trim()}'`).join(",") : null})`
                );
            };

            if (start_date && end_date) {
                const s = new Date(start_date), e = new Date(end_date);
                const diffMonths = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
                if (isNaN(s) || isNaN(e) || diffMonths > 6 || e < s) {
                    return ResHelper.apiResponse(res, false, "Date range must be 6 months or less", 400, {}, "")
                };
                where.push(`(DATE(cl.createdAt) >= '${start_date}' and DATE(cl.createdAt) <= '${end_date}')`);
            };

            if (start_date && end_date) {
                const s = new Date(start_date), e = new Date(end_date);
                const diffMonths = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
                if (isNaN(s) || isNaN(e) || diffMonths > 6 || e < s) {
                    return ResHelper.apiResponse(res, false, "Date range must be 6 months or less", 400, {}, "")
                };
                where_query.push(`(DATE(createdAt) >= '${start_date}' and DATE(createdAt) <= '${end_date}')`);
            };

            where = where.join(" and ");
            where_dsa = where_dsa.join(" and ");
            where_query = where_query.join(" and ");


            let data = await ReportServices.getSalesReport({
                offset: pageNumber * pageSize,
                limit: pageSize,
                where,
                where_dsa,
                type,
                call_status,
                where_query
            });
            return ResHelper.apiResponse(res, true, "Success", 200, data, "");
        };
    }
    catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

exports.dsaLeadResponseTimeReport = async (req, res, next) => {
    try {
        const { error } = ReportValidationV1.dsaLeadResponseTimeReport.validate(req.query);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { pageSize, pageNumber, business_head, start_date, end_date, type, metric, export: isExport } = req?.query;
            pageSize = parseInt(pageSize) || 10;
            pageNumber = parseInt(pageNumber) || 0;

            let params = {
                business_head,
                start_date: start_date || null,
                end_date: end_date || null,
                limit: pageSize,
                offset: pageNumber * pageSize,
                type: type || 'summary',
                metric: metric || 'call',
                bh_code: !["CEO", "CTO", "CFO"]?.includes(req?.loggedInUser?.role) ? req?.loggedInUser?.userPhone : null
            };

            // Export mode: fetch all rows, convert to CSV, upload to S3, return link
            if (isExport === 'true' || isExport === true) {
                const exportData = await ReportServices.dsaLeadResponseTimeReport(params, true);
                if (!exportData?.status) {
                    return ResHelper.apiResponse(res, false, exportData?.message || 'Export failed', 400, {}, "");
                }

                const rows = exportData.records || [];
                if (!rows.length) {
                    return ResHelper.apiResponse(res, false, 'No data to export', 400, {}, "");
                }

                // Build CSV string
                const headers = Object.keys(rows[0]);
                const csvLines = [
                    headers.join(','),
                    ...rows.map(row =>
                        headers.map(h => {
                            const val = row[h] !== null && row[h] !== undefined ? String(row[h]) : '';
                            return `"${val.replace(/"/g, '""')}"`;
                        }).join(',')
                    )
                ];
                const csvString = csvLines.join('\n');

                // Upload to S3
                const { ACCESS_KEY_ID, SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET } = process.env;
                AWS.config.update({ accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY, region: AWS_REGION });
                const s3 = new AWS.S3();
                const fileName = `reports/${metric == "call" ? "lead_assignment_to_call" : "lead_sp_assignment"}_${randomstring.generate(10)}.csv`;
                const s3Params = {
                    Bucket: S3_BUCKET,
                    Key: fileName,
                    Body: csvString,
                    ContentType: 'text/csv',
                    ACL: 'public-read'
                };
                const { Location } = await s3.upload(s3Params).promise();
                return ResHelper.apiResponse(res, true, 'Export ready', 200, { url: Location }, "");
            }

            let data = await ReportServices.dsaLeadResponseTimeReport(params);
            if (data?.status) {
                return ResHelper.apiResponse(res, true, "Success", 200, data, "");
            };
            return ResHelper.apiResponse(res, false, data?.message, 400, data, "");
        };
    }
    catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

exports.customerLeadAssignToCallReport = async (req, res, next) => {
    try {
        const { error } = ReportValidationV1.customerLeadAssignToCallReport.validate(req.query);
        if (error) {
            return ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        }

        let { pageSize, pageNumber, telecaller, start_date, end_date, metric, export: isExport } = req?.query;
        pageSize = parseInt(pageSize) || 10;
        pageNumber = parseInt(pageNumber) || 0;

        let params = {
            telecaller: telecaller || null,
            start_date: start_date || null,
            end_date: end_date || null,
            limit: pageSize,
            offset: pageNumber * pageSize,
            metric: metric || 'call',
        };

        if (isExport === 'true' || isExport === true) {
            const exportData = await ReportServices.customerLeadAssignToCallReport(params, true);
            if (!exportData?.status) {
                return ResHelper.apiResponse(res, false, exportData?.message || 'Export failed', 400, {}, "");
            }
            const rows = exportData.records || [];
            if (!rows.length) {
                return ResHelper.apiResponse(res, false, 'No data to export', 400, {}, "");
            }
            const headers = Object.keys(rows[0]);
            const csvLines = [
                headers.join(','),
                ...rows.map(row =>
                    headers.map(h => {
                        const val = row[h] !== null && row[h] !== undefined ? String(row[h]) : '';
                        return `"${val.replace(/"/g, '""')}"`;
                    }).join(',')
                )
            ];
            const csvString = csvLines.join('\n');
            const { ACCESS_KEY_ID, SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET } = process.env;
            AWS.config.update({ accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY, region: AWS_REGION });
            const s3 = new AWS.S3();
            const fileName = `reports/customer_lead_assign_to_call_${randomstring.generate(10)}.csv`;
            const s3Params = { Bucket: S3_BUCKET, Key: fileName, Body: csvString, ContentType: 'text/csv', ACL: 'public-read' };
            const { Location } = await s3.upload(s3Params).promise();
            return ResHelper.apiResponse(res, true, 'Export ready', 200, { url: Location }, "");
        }

        let data = await ReportServices.customerLeadAssignToCallReport(params);
        if (data?.status) {
            return ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
        return ResHelper.apiResponse(res, false, data?.message, 400, data, "");
    }
    catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};
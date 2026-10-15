const { sequelize } = require("../../../../jobs/db");
const { QueryTypes } = require("sequelize");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
const { logger } = require("../../../helpers/logger");
const lenderEmailConfigs = require("../../../../config/lenderEmailConfigs");
const connectToMongoDB = require("../../../services/mongo-new");
const { QUARANTINE_COLLECTION } = require("../../../services/mis-quarantine-service");

/**
 * Helper to validate date range constraint (max 31 days).
 */
function validateDateRange(startDateStr, endDateStr) {
    if (!startDateStr && !endDateStr) {
        // Default to past 30 days
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 30);
        return {
            valid: true,
            startDate: start.toISOString().split("T")[0] + " 00:00:00",
            endDate: end.toISOString().split("T")[0] + " 23:59:59",
        };
    }

    const start = new Date(startDateStr);
    const end = new Date(endDateStr || startDateStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { valid: false, error: "Invalid start_date or end_date format. Expected YYYY-MM-DD." };
    }

    if (start > end) {
        return { valid: false, error: "start_date cannot be after end_date." };
    }

    const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 31) {
        return {
            valid: false,
            error: "Date filter range exceeds maximum allowed limit of 31 days (1 month).",
        };
    }

    return {
        valid: true,
        startDate: startDateStr.split("T")[0] + " 00:00:00",
        endDate: (endDateStr || startDateStr).split("T")[0] + " 23:59:59",
    };
}

/**
 * MIS Upload Dashboard Controller (with 1-month date filter constraint).
 */
const getMisUploadDashboard = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
        const offset = (page - 1) * limit;
        const search = req.query.search ? req.query.search.trim() : "";
        const productFilter = req.query.product ? req.query.product.trim() : "";
        const statusFilter = req.query.status ? req.query.status.trim() : "";

        // Validate date range (maximum 1 month / 31 days)
        const dateCheck = validateDateRange(req.query.start_date, req.query.end_date);
        if (!dateCheck.valid) {
            return ResHelper.apiResponse(res, false, dateCheck.error, 400, {}, "");
        }
        const { startDate, endDate } = dateCheck;

        // 1. Calculate KPI Metrics for the selected date window
        const kpiQuery = `
            SELECT 
                COUNT(*) as total_files,
                COALESCE(SUM(CAST(from_value AS UNSIGNED)), 0) as total_success,
                COALESCE(SUM(CAST(to_value AS UNSIGNED)), 0) as total_failed,
                COUNT(CASE WHEN CAST(to_value AS UNSIGNED) > 0 THEN 1 END) as pending_action_required
            FROM application_logs
            WHERE application_type LIKE 'cc_mis_update%'
              AND createdAt >= ? AND createdAt <= ?
        `;
        const [kpiStats] = await sequelize.query(kpiQuery, {
            replacements: [startDate, endDate],
            type: QueryTypes.SELECT,
        });

        const totalProcessed = Number(kpiStats?.total_success || 0) + Number(kpiStats?.total_failed || 0);
        const overallSuccessRate = totalProcessed > 0
            ? Number(((Number(kpiStats.total_success) / totalProcessed) * 100).toFixed(1))
            : 100;

        const kpis = {
            total_files_uploaded: Number(kpiStats?.total_files || 0),
            total_records_processed: totalProcessed,
            overall_success_rate: overallSuccessRate,
            pending_action_required: Number(kpiStats?.pending_action_required || 0),
            date_range: {
                start_date: startDate.split(" ")[0],
                end_date: endDate.split(" ")[0],
            },
        };

        // 2. Fetch Paginated Logs for the selected date window
        const whereConditions = [
            "al.application_type LIKE 'cc_mis_update%'",
            "al.createdAt >= ?",
            "al.createdAt <= ?",
        ];
        const bindParams = [startDate, endDate];

        if (search) {
            whereConditions.push("(al.application_id LIKE ? OR al.application_type LIKE ? OR u.name LIKE ?)");
            const searchPattern = `%${search}%`;
            bindParams.push(searchPattern, searchPattern, searchPattern);
        }

        if (productFilter) {
            whereConditions.push("al.application_type = ?");
            bindParams.push(`cc_mis_update_${productFilter}`);
        }

        if (statusFilter === "COMPLETED") {
            whereConditions.push("CAST(al.to_value AS UNSIGNED) = 0");
        } else if (statusFilter === "ACTION_REQUIRED") {
            whereConditions.push("CAST(al.to_value AS UNSIGNED) > 0");
        }

        const whereClause = whereConditions.join(" AND ");

        const countQuery = `
            SELECT COUNT(*) as total
            FROM application_logs al
            LEFT JOIN users u ON al.updated_by = u.id
            WHERE ${whereClause}
        `;
        const [{ total }] = await sequelize.query(countQuery, {
            replacements: bindParams,
            type: QueryTypes.SELECT,
        });

        const listQuery = `
            SELECT 
                al.id,
                al.application_id as file_name,
                al.application_type,
                al.field as error_file_url,
                CAST(al.from_value AS UNSIGNED) as success_count,
                CAST(al.to_value AS UNSIGNED) as failure_count,
                al.createdAt as created_at,
                al.updatedAt as updated_at,
                u.name as uploaded_by_name,
                u.email as uploaded_by_email
            FROM application_logs al
            LEFT JOIN users u ON al.updated_by = u.id
            WHERE ${whereClause}
            ORDER BY al.id DESC
            LIMIT ? OFFSET ?
        `;

        const logsRaw = await sequelize.query(listQuery, {
            replacements: [...bindParams, limit, offset],
            type: QueryTypes.SELECT,
        });

        const logs = logsRaw.map((item) => {
            const productKey = item.application_type.replace(/^cc_mis_update_/, "");
            const lenderConfig = lenderEmailConfigs[productKey] || {};
            const totalRows = Number(item.success_count || 0) + Number(item.failure_count || 0);
            const successRate = totalRows > 0 ? Number(((item.success_count / totalRows) * 100).toFixed(1)) : 100;
            const hasFailures = Number(item.failure_count) > 0;
            const status = hasFailures ? "ACTION_REQUIRED" : "COMPLETED";

            return {
                id: item.id,
                file_name: item.file_name,
                product: productKey,
                lender_name: lenderConfig.lender_name || productKey,
                success_count: item.success_count,
                failure_count: item.failure_count,
                total_count: totalRows,
                reconciled_success_percentage: successRate,
                status,
                error_file_url: hasFailures ? item.error_file_url : null,
                uploaded_by: item.uploaded_by_name || "System Automated",
                uploaded_by_email: item.uploaded_by_email || "",
                created_at: item.created_at,
                updated_at: item.updated_at,
            };
        });

        return ResHelper.apiResponse(
            res,
            true,
            "MIS upload dashboard fetched successfully",
            200,
            {
                kpis,
                logs,
                pagination: {
                    total_records: Number(total || 0),
                    page,
                    limit,
                    total_pages: Math.ceil((Number(total) || 0) / limit),
                },
            },
            ""
        );
    } catch (error) {
        logger.error("Error in getMisUploadDashboard:", error);
        return ResHelper.apiResponse(res, false, "Failed to retrieve MIS upload dashboard", 500, {}, "");
    }
};

/**
 * Row-level Quarantine Logs Controller (MongoDB quarantine records).
 */
const getRowLevelLogs = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
        const offset = (page - 1) * limit;

        const { log_id, file_name, product, status, error_code, search, start_date, end_date } = req.query;

        if (!global.db) {
            await connectToMongoDB();
        }
        const collection = global.db.collection(QUARANTINE_COLLECTION);

        const filter = {};

        if (log_id) {
            filter.log_id = Number(log_id);
        } else if (file_name) {
            filter.file_name = file_name.trim();
        }

        if (product) {
            filter.product = product.trim();
        }

        if (status) {
            filter.status = status.trim().toUpperCase();
        }

        if (error_code) {
            filter.error_code = error_code.trim();
        }

        if (search) {
            const searchRegex = new RegExp(search.trim(), "i");
            filter.$or = [
                { application_id: searchRegex },
                { external_id: searchRegex },
                { error_message: searchRegex },
            ];
        }

        if (start_date || end_date) {
            const dateCheck = validateDateRange(start_date, end_date);
            if (!dateCheck.valid) {
                return ResHelper.apiResponse(res, false, dateCheck.error, 400, {}, "");
            }
            filter.uploaded_at = {
                $gte: new Date(dateCheck.startDate),
                $lte: new Date(dateCheck.endDate),
            };
        }

        const total = await collection.countDocuments(filter);
        const rawDocs = await collection
            .find(filter)
            .sort({ uploaded_at: -1 })
            .skip(offset)
            .limit(limit)
            .toArray();

        const records = rawDocs.map((doc) => ({
            id: doc._id.toString(),
            product: doc.product,
            file_name: doc.file_name,
            application_id: doc.application_id,
            external_id: doc.external_id,
            error_code: doc.error_code || "ERR_GENERAL",
            error_message: doc.error_message,
            status: doc.status || "OPEN",
            uploaded_at: doc.uploaded_at,
            resolved_at: doc.resolved_at || null,
            resolved_in_file: doc.resolved_in_file || null,
            raw_row: doc.raw_row || null,
        }));

        return ResHelper.apiResponse(
            res,
            true,
            "Row-level logs fetched successfully",
            200,
            {
                records,
                pagination: {
                    total_records: total,
                    page,
                    limit,
                    total_pages: Math.ceil(total / limit),
                },
            },
            ""
        );
    } catch (error) {
        logger.error("Error in getRowLevelLogs:", error);
        return ResHelper.apiResponse(res, false, "Failed to retrieve row-level logs", 500, {}, "");
    }
};

module.exports = {
    getMisUploadDashboard,
    getRowLevelLogs,
};


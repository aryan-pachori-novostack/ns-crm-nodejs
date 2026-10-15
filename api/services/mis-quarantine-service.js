const connectToMongoDB = require('./mongo-new');
const { logger } = require('../helpers/logger');

const QUARANTINE_COLLECTION = 'mis_quarantine_records';

/**
 * Returns retention duration in days from environment variable (default 90 days).
 */
function getRetentionDays() {
    const days = parseInt(process.env.MIS_QUARANTINE_RETENTION_DAYS || process.env.MIS_STALE_RECORD_DAYS || '90', 10);
    return isNaN(days) || days <= 0 ? 90 : days;
}

let indexesInitialized = false;

/**
 * Ensures required indexes on the mis_quarantine_records collection with env-configured TTL.
 */
async function ensureQuarantineIndexes(database) {
    if (indexesInitialized) return;
    try {
        const collection = database.collection(QUARANTINE_COLLECTION);
        const ttlSeconds = getRetentionDays() * 24 * 60 * 60;
        
        await collection.createIndexes([
            {
                key: { log_id: 1 },
                name: 'idx_log_id',
            },
            {
                key: { product: 1, application_id: 1, status: 1 },
                name: 'idx_product_appid_status',
            },
            {
                key: { file_name: 1 },
                name: 'idx_file_name',
            },
            {
                key: { status: 1 },
                name: 'idx_status',
            },
            {
                key: { uploaded_at: 1 },
                name: 'idx_ttl_uploaded_at',
                expireAfterSeconds: ttlSeconds,
            },
        ]);
        indexesInitialized = true;
        logger.info(`MongoDB ${QUARANTINE_COLLECTION} indexes initialized with ${ttlSeconds}s (${getRetentionDays()} days) TTL`);
    } catch (err) {
        logger.error(`Error ensuring ${QUARANTINE_COLLECTION} indexes:`, err);
    }
}

/**
 * Inserts or stages failed MIS application records into MongoDB quarantine.
 *
 * @param {string} product - Lender / Product code (e.g. "loanwalle", "piramal")
 * @param {string} fileName - Uploaded file name
 * @param {Array<Object>} failedRecords - Array of failed rows with error details
 * @param {number|string} [logId] - Unique application_logs ID for this specific run
 */
async function recordFailedApplications(product, fileName, failedRecords, logId = null) {
    if (!failedRecords || failedRecords.length === 0) return 0;

    try {
        if (!global.db) {
            await connectToMongoDB();
        }
        await ensureQuarantineIndexes(global.db);

        const collection = global.db.collection(QUARANTINE_COLLECTION);
        const docs = failedRecords.map((item) => ({
            log_id: logId ? Number(logId) : null,
            product,
            file_name: fileName,
            application_id: String(item.application_id || item.lead_id || item.utm_content || ""),
            external_id: String(item.external_id || item.application_number || ""),
            error_code: item.error_code || "ERR_GENERAL",
            error_message: item.error || item.error_message || "Unknown error",
            raw_row: item,
            status: "OPEN",
            uploaded_at: new Date(),
        }));

        const result = await collection.insertMany(docs, { ordered: false });
        logger.info(`Staged ${result.insertedCount} failed records into MongoDB quarantine for ${product} (${fileName}, log_id: ${logId})`);
        return result.insertedCount;
    } catch (err) {
        logger.error(`Error recording failed applications to MongoDB quarantine:`, err);
        return 0;
    }
}

/**
 * Explicitly purges stale quarantine records from MongoDB older than the configured retention period.
 * 
 * @param {number} [customDays] - Optional retention days override
 * @returns {Promise<{ deletedCount: number, cutoffDate: Date, retentionDays: number }>}
 */
async function deleteStaleQuarantineRecords(customDays) {
    try {
        const retentionDays = customDays !== undefined ? parseInt(customDays, 10) : getRetentionDays();
        if (isNaN(retentionDays) || retentionDays <= 0) {
            logger.warn('Invalid retention days for stale quarantine deletion, skipping.');
            return { deletedCount: 0 };
        }

        if (!global.db) {
            await connectToMongoDB();
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const collection = global.db.collection(QUARANTINE_COLLECTION);
        const result = await collection.deleteMany({
            uploaded_at: { $lt: cutoffDate },
        });

        if (result.deletedCount > 0) {
            logger.info(`Purged ${result.deletedCount} stale MongoDB quarantine records older than ${retentionDays} days (before ${cutoffDate.toISOString()})`);
        }
        return {
            deletedCount: result.deletedCount,
            cutoffDate,
            retentionDays,
        };
    } catch (err) {
        logger.error('Error deleting stale quarantine records from MongoDB:', err);
        return { deletedCount: 0, error: err.message };
    }
}

module.exports = {
    recordFailedApplications,
    deleteStaleQuarantineRecords,
    ensureQuarantineIndexes,
    getRetentionDays,
    QUARANTINE_COLLECTION,
};

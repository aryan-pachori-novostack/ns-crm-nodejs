const { logger } = require("../../../../helpers/logger");

/**
 * Which review queue a successfully-written row lands in. Excel-specific: it is reported
 * back in the S3 output file for the uploader, not persisted on the claim, so it stays
 * with the entry point rather than moving into the shared claims module.
 */
const assignBucket = (ctx) => {
    const d = ctx.derived;
    try {
        // confirmation_required routes to the banker queue; duplicates to multi-funded review.
        ctx.row.bucket = (d.isDuplicate ? "multi_funded_pending" : (d.confirmation_required ? "banker_pending" : "pending")) || null;
    } catch (err) {
        logger.error(`Lead Form Error on Bucket: ${ctx.row.loan_app_no}: ${err.message}`);
    }
};

module.exports = { assignBucket };

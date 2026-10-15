const AppError = require("../../AppError");

/**
 * Custom domain error for lead-claim validation failures, shared by every entry point
 * that writes `ru_fresh_lead_claims` (bulk Excel upload, manual lead form, and the
 * flows still to be migrated).
 *
 * `type: "custom"` is what the pipeline subclasses key off to decide whether a failure
 * is a rejected claim (record it, carry on) or a genuine crash (rethrow).
 */
class LeadClaimError extends AppError {
    constructor(message, statusCode = 400, data = {}) {
        super({
            name: "leadClaimError",
            type: "custom",
            message,
            statusCode,
            data
        });
    }
}

module.exports = LeadClaimError;

const AppError = require("../AppError");

/**
 * Custom Domain Error for DSA Payout Validation Failures
 */
class PayoutError extends AppError {
    constructor(message, statusCode = 400, data = {}) {
        super({
            name: "payoutError",
            type: "custom",
            message,
            statusCode,
            data
        });
    }
}

module.exports = PayoutError;


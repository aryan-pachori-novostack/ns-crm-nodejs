const AppError = require("../../AppError");

/**
 * Custom domain error for ERP lead validation / submit failures (SSE and HTTP callers).
 */
class ErpError extends AppError {
    constructor(message, statusCode = 400, data = {}) {
        super({
            name: "erpError",
            type: "custom",
            message,
            statusCode,
            data
        });
    }
}

module.exports = ErpError;

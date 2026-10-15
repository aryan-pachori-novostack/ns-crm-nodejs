const AppError = require("../../AppError");

/**
 * Custom domain error for autonomous lead validation / submit failures (SSE and HTTP callers).
 */
class AutonomousError extends AppError {
    constructor(message, statusCode = 400, data = {}) {
        super({
            name: "autonomousError",
            type: "custom",
            message,
            statusCode,
            data
        });
    }
}

module.exports = AutonomousError;

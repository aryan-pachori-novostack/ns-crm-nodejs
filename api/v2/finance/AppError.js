class AppError extends Error {
    constructor({
        name = "customError",
        type = "custom",
        message = "Error occurred during execution",
        statusCode = 400,
        data = {}
    } = {}) {
        super(message);
        this.name = name;
        this.type = type;
        this.statusCode = statusCode;
        this.data = data;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;


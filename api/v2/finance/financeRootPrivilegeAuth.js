const AppError = require("./AppError");
const ValidationPipeline = require("./ValidationPipeline");
const { isFinanceRootUser } = require("../../services/finance-services");

const { BaseValidator } = ValidationPipeline;

/**
 * Finance / CRM privilege errors (`type: "custom"` for `safe()` and specialized pipelines).
 */
class FinanceAuthError extends AppError {
    constructor(message, statusCode = 403, data = {}) {
        super({
            name: "financeAuthError",
            type: "custom",
            message,
            statusCode,
            data
        });
    }
}

/**
 * Resolves finance root flag and sets `context.isMaster`.
 * Call once per request on a shared context (e.g. `{ req }`) — not per-lead, unless each lead context reuses the same object.
 */
class FinanceRootContextValidator extends BaseValidator {
    async validate(context) {
        const { req } = context;
        const isMaster = await isFinanceRootUser(req?.loggedInUser?.userPhone);
        context.isMaster = isMaster;
    }
}

/**
 * Requires finance root; sets `context.isMaster = true` on success, otherwise throws `FinanceAuthError`.
 */
class FinanceRootRequiredValidator extends BaseValidator {
    async validate(context) {
        const { req } = context;
        const isMaster = await isFinanceRootUser(req?.loggedInUser?.userPhone);
        if (!isMaster) {
            throw new FinanceAuthError("Access denied", 403);
        }
        context.isMaster = true;
    }
}

module.exports = {
    FinanceAuthError,
    FinanceRootContextValidator,
    FinanceRootRequiredValidator
};

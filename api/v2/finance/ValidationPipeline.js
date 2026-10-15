/**
 * ValidationPipeline - Fluent validator orchestrator using Chain of Responsibility pattern
 *
 * @class ValidationPipeline
 */
class ValidationPipeline {
    constructor() {
        this.validators = [];
    }

    use(validator) {
        this.validators.push(validator);
        return this;
    }

    async run(context) {
        for (const validator of this.validators) {
            await validator.validate(context);
        }
    }

    /**
     * Same chain as `run()`, but collects `autonomousError` failures instead of stopping.
     * Unexpected errors are rethrown. Existing `run()` callers are unchanged.
     */
    async runCollect(context) {
        if (!Array.isArray(context.failures)) {
            context.failures = [];
        }

        for (const validator of this.validators) {
            try {
                await validator.validate(context);
            } catch (err) {
                if (err?.name === "autonomousError" && err?.type === "custom") {
                    context.failures.push({
                        check: validator.constructor.name,
                        message: err.message,
                        ...(err.data || {})
                    });
                    continue;
                }
                throw err;
            }
        }
    }
}

/**
 * Base validator — subclasses implement `validate(context)`.
 */
class BaseValidator {
    async validate(context) {
        throw new Error("validate() must be implemented by subclass");
    }
}

ValidationPipeline.BaseValidator = BaseValidator;

module.exports = ValidationPipeline;


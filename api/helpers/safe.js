const { setupSSE } = require("./sse-progress-helper");
const { logger } = require("./logger");
const ResHelper = require(_pathconst.FilesPath.ResHelper);

/**
 * Wraps an async controller that returns `{ success, message, statusCode, data }`.
 *
 * @param {object} [options]
 * @param {'v1'|'v2'} [options.envelope='v2'] — `v1` uses `ResHelper.apiResponse`
 *   (capitalised `Data` / `Token` / `meta.Status`) for legacy v1 CRM routes; `v2`
 *   uses `apiResponseV2` (default).
 */
const safe = (handler, options = {}) => {
    const {
        defaultMessage = "Error occurred during execution",
        statusCode = 500,
        isSSE = false,
        sseOptions = {},
        envelope = "v2"
    } = options;

    const apiResponse = envelope === "v1" ? ResHelper.apiResponse : ResHelper.apiResponseV2;

    return async (req, res, next) => {
        // SSE path — controller receives sseHelper, never res
        if (isSSE) {
            const sseHelper = setupSSE(res, sseOptions);
            try {
                await handler(req, sseHelper);
                // sseHelper.sendComplete() is expected to be called inside handler.
                // If handler returns without ending, that's a bug — close defensively.
                if (!res.writableEnded) {
                    logger.warn("SSE handler returned without calling sendComplete/sendError");
                    res.end();
                }
            } catch (e) {
                logger.error(e);
                // res is streaming — only the SSE error channel is available
                if (!res.writableEnded) {
                    try { sseHelper.sendError(defaultMessage, e); } catch (_) { }
                }
            }
            return;
        }

        // Standard JSON path — controller must return a plain object
        try {
            const response = await handler(req);
            // Guard: controller should never touch res, but just in case
            if (res.headersSent) {
                logger.warn("Controller sent response directly — this is discouraged");
                return;
            }
            const {
                success = false,
                message = "",
                statusCode: responseStatusCode = 200,
                data = {}
            } = response;
            return apiResponse(res, success, message, responseStatusCode, data, "");
        } catch (e) {
            if (e?.type === "custom") {
                return apiResponse(res, false, e.message || defaultMessage, e.statusCode, e?.data || {}, "");
            }
            const message = e?.original?.sqlMessage || defaultMessage;
            logger.error(e);
            return apiResponse(res, false, message, statusCode, {}, "");
        }
    };
};

module.exports = safe;
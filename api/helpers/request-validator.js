let ResHelper = require(_pathconst.FilesPath.ResHelper);

const reqValidator = (schema, source = "body") => {
    return (req, res, next) => {
        try {
            if (!schema || typeof schema.validate !== "function") {
                return next();
            }

            const payload = req?.[source] ?? {};
            const { error, value } = schema.validate(payload);

            if (error) {
                return ResHelper.apiResponse(res, false, error.message, 400, {}, "");
            }

            req[source] = value;
            req._requestValidated = req._requestValidated || {};
            req._requestValidated[source] = true;
            return next();
        } catch (e) {
            const message = e?.original?.sqlMessage || "Error occured during execution";
            return ResHelper.apiResponseV2(res, false, message, 500, {}, "");
        }
    };
};

module.exports = reqValidator;

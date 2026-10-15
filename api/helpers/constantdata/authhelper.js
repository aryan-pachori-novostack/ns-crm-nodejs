let jwt = require('jwt-simple')
let moment = require('moment');
const { logger } = require('../logger');
const fs = require("fs");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let UserService = require(_pathconst.ServicesPath.UserService);
const jsonwebtoken = require('jsonwebtoken');
const passportJWT = require("passport-jwt");
const client = require("../redis-client");
const DSAService = require(_pathconst.ServicesPath.DSAService);
const publicKey = fs.readFileSync("oauth-public.key", "utf8");
const ExtractJWT = passportJWT.ExtractJwt;
const JWTStrategy = passportJWT.Strategy;
const crypto = require("crypto");
let CustomerServices = require(_pathconst.ServicesPath.CustomerServices);
const { de } = require('date-fns/locale');
const axios = require('axios');
const { response } = require('express');

/** 
 * @api {function} createJWToken createJWToken
 *  @apiName createJWToken
 *  @apiGroup AuthHelper
 *  @apiParam {object}  user A object of user information  .
 *  @apiDescription Create unique token with 1 minutes expire time .
 */

const compareDateString = (dt1, dt2) => {
    dt1 = new Date(dt1);
    dt2 = new Date(dt2);
    console.log(dt1, dt2)
    dt1 = dt1.toUTCString() + dt1.getMilliseconds();
    dt2 = dt2.toUTCString() + dt2.getMilliseconds();

    return dt1 == dt2;
}

async function getRedisSessionTokenDate(key) {
    return client.getAsync(key);
}

/** Track last API activity in Redis (ops/audit). Does not affect auth or logout. */
async function touchSessionActivity(email, skip = false) {
    if (!email || skip) return;
    try {
        await client.setAsync(`${email}:last_activity`, Date.now().toString(), "EX", 86400);
    } catch (err) {
        logger.warn('touchSessionActivity: ' + (err && err.message));
    }
}


exports.createJWToken = async function (user) {
    delete user.password;
    delete user.dummyPassword;
    let payload = {
        user: user,
        iat: moment().unix(),
        exp: Math.floor(Date.now() / 1000) + (10 * 60 * 144)//Token for a 10 minutes
    }
    return jwt.encode(payload, process.env.TOKEN_SECRET)
}

/**
 * @api {function} authorize authorize
 *  @apiName authorize
 *  @apiGroup AuthHelper
 *  @apiParam {object}  req A object of Request Call from Client  .
 *  @apiParam {object}  res A object of Response Call to Client .
 *  @apiParam {callback}  next A Callback to pass request to next midleware .
 *  @apiDescription A midleware to authorize the REST call .
 */

exports.authorize = async function (req, res, next) {
    let prohibited = [`/getRuloansCustomers`, `/getApplicationsByProductAndLoanType`, `/getAllApplications`, `/assignSalesPerson`, `/get-loan-details`];
    const sessionActivityExemptPaths = [
        `/loginCEO`,
        `/auth/check-device`,
        `/v1/user/loginCEO`,
        `/v1/auth/check-device`
    ];
    const skipActivityTouch = sessionActivityExemptPaths.includes(req?.path);

    let resModel = {
        Status: false,
        Message: "",
        Data: {}
    };
    if (!req.header('Authorization')) {
        resModel.Message = 'Please make sure your request has an Authorization header';
        return res.status(401).send(resModel);
    }
    let token = req.header('Authorization');
    let payload = null
    try {
        payload = jwt.decode(token, process.env.TOKEN_SECRET)
    } catch (err) {
        resModel.Message = " Invalid Status ";
        return res.status(401).send(resModel);
    }
    if (payload.exp <= moment().unix()) {
        resModel.Message = 'Token has expired';
        return res.status(401).send(resModel);
    }
    try {
        let user = await UserService.findUser(payload.user.userEmail);
        let tokenUpdateDate;
        if (payload.isApprovalReplay === true || payload.isApprovalReplay === 'true') {
            tokenUpdateDate = payload.user.tokenUpdateDate;
        } else {
            try {
                tokenUpdateDate = await getRedisSessionTokenDate(user.userEmail);
                // Redis session is for single-login invalidation only — not a shorter TTL than JWT.
                if (tokenUpdateDate == null) {
                    tokenUpdateDate = payload.user.tokenUpdateDate;
                }
            } catch (redisErr) {
                logger.error('authorize: Redis session check failed, failing open: ' + (redisErr && redisErr.message));
                tokenUpdateDate = payload.user.tokenUpdateDate;
            }
        }

        if (!user || (user.status != 1)) {
            resModel.Message = 'Invalid Token!';
            return res.status(401).send(resModel);

        } else if (!compareDateString(tokenUpdateDate, payload.user.tokenUpdateDate)) {
            resModel.Message = 'Invalid Token!!';
            return res.status(401).send(resModel);
        };

        req.userId = payload.userId;
        let roleMappingHack = {
            "CFO": "CEO",
            "CTO": "CEO",
            "SALES_ADMIN": "BUSINESS_HEAD"
        };

        if (user?.role == "CTO" || !prohibited?.includes(req?.path)) {
            payload.user.role = roleMappingHack[payload?.user?.role] || payload?.user?.role;
        };

        req.loggedInUser = payload.user;
        req.loggedInUser.isSuperAdmin = user.is_superadmin && req?.loggedInUser?.role == "CEO";
        req.loggedInUser.dsa_id = user.dsa_id || req.loggedInUser.dsa_id;
        req.loggedInUser.materialized_path = user.materialized_path || req.loggedInUser.materialized_path;
        req.loggedInUser.materialized_path_depth = user.materialized_path_depth ?? req.loggedInUser.materialized_path_depth;
        if (payload?.isApprovalReplay === true) {
            req.loggedInUser.isApprovalReplay = true;
        }

        touchSessionActivity(user.userEmail, skipActivityTouch);

        next();
    } catch (err) {
        logger.error(err.message);
        logger.error(err);
        resModel.Message = " Invalid Status ";
        return res.status(400).send(resModel);
    }
}

exports.authorizeWithoutRedis = async function (req, res, next) {
    let resModel = {
        Status: false,
        Message: "",
        Data: {}
    };
    if (!req.header('Authorization')) {
        resModel.Message = 'Please make sure your request has an Authorization header';
        return res.status(401).send(resModel);
    }
    let token = req.header('Authorization');
    let payload = null
    try {
        payload = jwt.decode(token, process.env.TOKEN_SECRET)
    } catch (err) {
        resModel.Message = " Invalid Status ";
        return res.status(401).send(resModel);
    }
    if (payload.exp <= moment().unix()) {
        resModel.Message = 'Token has expired';
        return res.status(401).send(resModel);
    }
    try {
        let user = await UserService.findUser(payload.user.userEmail);
        if (!user || user.status != 1) {
            resModel.Message = 'Invalid Token!';
            return res.status(401).send(resModel);

        }
        req.userId = payload.userId;
        req.loggedInUser = payload.user;
        next()
    } catch (err) {
        resModel.Message = " Invalid Status ";
        return res.status(400).send(resModel);
    }
}

exports.getRequestingUser = function (token) {
    let decoded = jwt.decode(token, Config.TOKEN_SECRET);
    return decoded.user;
}

exports.isSuperAdmin = (req, res, next) => {
    if (req.loggedInUser.type === 1) {
        next();
    }
    else {
        ResHelper.apiResponse(res, false, "Permission denied", 401, {}, "");
    }
}

exports.externalAuth = (req, res, next) => {
    let resModel = {
        Status: false,
        Message: "",
        Data: {}
    };
    if (!req.header('Authorization')) {
        resModel.Message = 'Please make sure your request has an Authorization header';
        return res.status(401).send(resModel);
    } else {
        if (req.header('Authorization') === process.env.AUTH_KEY_EXTERNAL) {
            next();
        } else {
            resModel.Message = 'Invalid Token ';
            return res.status(401).send(resModel);
        }
    }
};

exports.externalB2CAuth = (req, res, next) => {
    let resModel = {
        Status: false,
        Message: "",
        Data: {}
    };
    if (!req.header('Authorization')) {
        resModel.Message = 'Please make sure your request has an Authorization header';
        return res.status(401).send(resModel);
    } else {
        if (req.header('Authorization') === process.env.AUTH_KEY_B2C_EXTERNAL) {
            next();
        } else {
            resModel.Message = 'Invalid Token ';
            return res.status(401).send(resModel);
        }
    }
};

exports.externalPassportAuth = async (req, res, next) => {
    let resModel = {
        Status: false,
        Message: "",
        Data: {}
    };
    if (!req.header('Authorization')) {
        resModel.Message = 'Please make sure your request has an Authorization header';
        return res.status(401).send(resModel);
    }
    let token = req.header('Authorization');
    let payload = null;
    const jwtOptions = {
        jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
        secretOrKey: publicKey,
    };
    try {
        payload = jwt.decode(token, publicKey, jwtOptions);
    } catch (err) {
        resModel.Message = " Invalid Status ";
        return res.status(401).send(resModel);
    }
    if (payload.exp <= moment().unix()) {
        resModel.Message = 'Token has expired';
        return res.status(401).send(resModel);
    }

    try {
        let user = await DSAService.getDsaByPrimaryId(payload.sub);
        if (!user || user?.isDeleted) {
            resModel.Message = 'Invalid Token!';
            return res.status(401).send(resModel);

        }
        req.loggedInUser = user;
        next()
    } catch (err) {
        resModel.Message = " Invalid Status ";
        return res.status(400).send(resModel);
    }
};

exports.authorizeDsa = async function (req, res, next) {
    let resModel = {
        Status: false,
        Message: "",
        Data: {}
    };
    if (!req.header('Authorization')) {
        resModel.Message = 'Please make sure your request has an Authorization header';
        return res.status(401).send(resModel);
    }
    let token = req.header('Authorization');
    let payload = null;
    const jwtOptions = {
        jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
        secretOrKey: publicKey,
    };
    try {
        payload = jwt.decode(token, publicKey, jwtOptions);
    } catch (err) {
        console.log(err)
        console.warn("Not a valid JWT token")
        let options = {
            'method': 'POST',
            'url': `${process.env.MS_URL}/api/v3/dsa/get-details`,
            'headers': {
                'api-key': process.env.AUTH_KEY_RULOANS_BANK_CLAIM,
                'device-id': 'xxx',
                'Authorization': `Bearer ${req.header('Authorization')}`
            }
        };

        axios({
            ...options,
            responseType: "text",
            validateStatus: () => true,
        })
            .then(async (axiosResponse) => {
                console.log(axiosResponse?.data);

                let response = (JSON.parse(axiosResponse.data));
                if (response?.status != 1) {
                    return res.status(401).send(response);
                };

                if (response?.status) {
                    try {
                        let user = await DSAService.getDsaByPrimaryId(response?.data?.dsa_details?.id, "id");
                        if (!user || user?.isDeleted) {
                            resModel.Message = 'Invalid Token!';
                            return res.status(401).send(resModel);
                        }
                        req.dsa = user;
                        next();
                    } catch (error) {
                        resModel.Message = 'Invalid Status';
                        return res.status(400).send(resModel);
                    }
                };
            })
            .catch((error) => {
                res.message = 'Invalid Status!';
                return res.status(401).send(res);
            });
        return;
    }
    if (payload.exp <= moment().unix()) {
        resModel.Message = 'Token has expired';
        return res.status(401).send(resModel);
    };

    try {
        let key = "id";
        let id = payload?.sub;
        let user = await DSAService.getDsaByPrimaryId(id, key);
        if (!user || user?.isDeleted) {
            resModel.Message = 'Invalid Token!';
            return res.status(401).send(resModel);

        }
        req.dsa = user;
        next()
    } catch (err) {
        resModel.Message = " Invalid Status ";
        return res.status(400).send(resModel);
    }
};

exports.authorizeCustomer = async function (req, res, next) {
    console.log("inside authorizeCustomer middleware");
    let resModel = {
        Status: false,
        Message: "",
        Data: {}
    };
    if (!req.header('Authorization')) {
        resModel.Message = 'Please make sure your request has an Authorization header';
        return res.status(401).send(resModel);
    }
    let token = req.header('Authorization');
    let payload = null;
    const jwtOptions = {
        jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
        secretOrKey: publicKey,
    };
    try {
        payload = jwt.decode(token, publicKey, jwtOptions);
    } catch (err) {
        console.log(err)
        resModel.Message = " Invalid Status ";
        return res.status(401).send(resModel);
    }
    if (payload.exp <= moment().unix()) {
        resModel.Message = 'Token has expired';
        return res.status(401).send(resModel);
    };

    try {
        let id = payload?.user?.customer_id;
        let user = await CustomerServices.getCustomerById(id);
        if (!user || user?.isDeleted) {
            resModel.Message = 'Invalid Token!';
            return res.status(401).send(resModel);

        }
        req.user = user;
        next();
    } catch (err) {
        console.log(err)
        resModel.Message = " Invalid Status ";
        return res.status(400).send(resModel);
    }
};

exports.encryptionSlashRtcSSOLogin = (text) => {
    const ENC_CIPHERING = process.env.SLASH_RTC_ENC_CIPHERING;
    const ENC_ENCRYPTION_KEY = process.env.SLASH_RTC_ENC_ENCRYPTION_KEY;
    const ENC_ENCRYPTION_IV = process.env.SLASH_RTC_ENC_ENCRYPTION_IV;

    const cipher = crypto.createCipheriv(ENC_CIPHERING, ENC_ENCRYPTION_KEY, ENC_ENCRYPTION_IV);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
};

const customer_auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization');
        const response = await axios.request({
            method: 'GET',
            url: `${process.env.B2C_URL}/v1/user/get-customer-dtls`,
            headers: {
                'b2c': 'b2c',
                'authorization': token,
            }
        });

        const { meta, data } = response?.data;

        if (!meta) {
            return res.status(401).send("Invalid Status!");
        };

        const { status, code } = meta;
        if (status && code === 200) {
            req.customer = data;
            return next();
        }

        return res.status(code || 401).send(meta);
    } catch (err) {
        console.error('Error validating customer token:', err);

        const status = err?.response?.status || 500;
        const message = err?.response?.data?.message || err.message || 'Internal Server Error';

        return res.status(status).send({ error: message });
    }
};


const selectDynamicData = async (tableName, columns, whereKeys, whereValues) => {
    const { QueryTypes } = require('sequelize');
    const { _db2 } = require('../../../models');
    const actualTableName = tableName === 'settings' ? 'ru_settings' : tableName;
    const selectCols = columns.join(', ');
    const whereClause = whereKeys.map(key => `${key} = ?`).join(' AND ');
    const queryStr = `SELECT ${selectCols} FROM ${actualTableName} WHERE ${whereClause}`;
    return await _db2.query(queryStr, {
        replacements: whereValues,
        type: QueryTypes.SELECT
    });
};

exports.validateAppVersionFromHeaders = async function (req, platform = 'b2c') {
    const deviceTypeHeader = req.headers['device-type'];
    if (deviceTypeHeader === undefined || deviceTypeHeader === null || String(deviceTypeHeader).trim() === '') {
        return { valid: true, skipped: true };
    }

    const deviceType = String(deviceTypeHeader).trim();
    const appVersionName = req.headers['app-version-name'];
    const appVersionCode = req.headers['app-version-code'];
    const normalizedPlatform = platform === 'b2c' ? 'b2c' : 'b2b';

    let nameKey;
    let codeKey;
    if (deviceType === "1" && normalizedPlatform === "b2b") {
        nameKey = "android_app_version_name";
        codeKey = "android_app_version_code";
    } else if (deviceType === "1") {
        nameKey = normalizedPlatform + "_android_app_version_name";
        codeKey = normalizedPlatform + "_android_app_version_code";
    } else if (deviceType === "2") {
        nameKey = normalizedPlatform + "_ios_app_version_name";
        codeKey = normalizedPlatform + "_ios_app_version_code";
    } else {
        return { valid: true, skipped: true };
    };

    if (process.env.ENVIRONMENT === 'uat') {
        nameKey = `${nameKey}_uat`;
        codeKey = `${codeKey}_uat`;
    };

    const hasVersionName = appVersionName !== undefined && appVersionName !== null && String(appVersionName).trim() !== '';
    const hasVersionCode = appVersionCode !== undefined && appVersionCode !== null && String(appVersionCode).trim() !== '';
    if (!hasVersionName && !hasVersionCode) {
        return { valid: true, skipped: true };
    }

    const dataName = await selectDynamicData('settings', ['setting_value'], ['setting_key'], [nameKey]);
    console.log("dataName", dataName);
    const dataCode = await selectDynamicData('settings', ['setting_value'], ['setting_key'], [codeKey]);
    console.log("dataCode", dataCode);
    const expectedName = dataName[0]?.setting_value;
    const expectedCode = dataCode[0]?.setting_value;

    if (!expectedName && !expectedCode) {
        return { valid: true, skipped: true };
    }

    const compareVersionNames = (clientName, minName) => {
        const parse = (v) => String(v).split('.').map(n => parseInt(n, 10) || 0);
        const a = parse(clientName);
        const b = parse(minName);
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const valA = a[i] || 0;
            const valB = b[i] || 0;
            if (valA < valB) return -1;
            if (valA > valB) return 1;
        }
        return 0;
    };

    if (hasVersionName && expectedName && compareVersionNames(appVersionName, expectedName) < 0) {
        return { valid: false, skipped: false };
    }

    if (hasVersionCode && expectedCode) {
        const clientCode = parseInt(appVersionCode, 10);
        const minExpectedCode = parseInt(expectedCode, 10);
        if (!isNaN(clientCode) && !isNaN(minExpectedCode) && clientCode < minExpectedCode) {
            return { valid: false, skipped: false };
        }
    }

    return { valid: true, skipped: false };
};


exports.authorizeDsaCentralized = async (req, res, next) => {
    let resModel = {
        status: false,
        message: "",
        data: {}
    };
    try {
        const appVersionHeader = req.header('app-version-code');
        const isOverallReport = req.originalUrl && req.originalUrl.includes('get-overall-report');
        if (appVersionHeader && isOverallReport) {
            const versionResult = await exports.validateAppVersionFromHeaders(req, 'b2b');
            if (versionResult && !versionResult.valid) {
                resModel.message = 'A newer version is available. Please update your app.';
                return res.status(400).send(resModel);
            }
        }

        const info = {
            referer: req.get('Referer') || req.get('Referrer'),
            token: req.header('Authorization')
        };

        if (!info?.token) {
            resModel.message = 'Please make sure your request has an Authorization header';
            return res.status(401).send(resModel);
        };

        decodedToken = jsonwebtoken.decode(info?.token);

        //static_auth
        if (info?.token == process?.env?.AUTH_KEY_EXTERNAL) {
            console.log('[Auth] Bypassing token validation for special token');
            return next();
        };

        // crm_logc
        const masterHosts = ["crm.ruloans.com", "crm-dev.ruloans.com", "crm-uat.ruloans.com", "ruloans-crm-reactjs-uat.vercel.app", "localhost:3000", "127.0.0.1:3000"];
        const isAllowedHost = masterHosts.some(host => info?.referer?.includes(host));
        if (isAllowedHost) {
            let crmPayload = null;
            try {
                crmPayload = jwt.decode(info.token, process.env.TOKEN_SECRET);
            } catch (err) {
                crmPayload = null;
            }
            if (crmPayload?.user?.userEmail && crmPayload?.exp > moment().unix()) {
                return this.authorize(req, res, next);
            }
        }

        //customer_logic
        if (decodedToken?.user) {
            return customer_auth(req, res, next);
        };

        // sub_logic default_logic
        var options = {
            'method': 'POST',
            'url': `${process.env.MS_URL}/api/v3/dsa/get-details`,
            'headers': {
                'api-key': process.env.AUTH_KEY_RULOANS_BANK_CLAIM,
                'device-id': 'xxx',
                'Authorization': `Bearer ${req.header('Authorization')}`
            }
        };

        axios({
            ...options,
            responseType: "text",
            validateStatus: () => true,
        })
            .then((axiosResponse) => {
                console.log(axiosResponse?.data);

                let response = (JSON.parse(axiosResponse.data));
                if (response?.status != 1) {
                    return res.status(401).send(response);
                };

                if (response?.status) {
                    req["dsa"] = response?.data?.dsa_details
                    next();
                };
            })
            .catch((error) => {
                resModel.message = 'Invalid Status!';
                return res.status(401).send(resModel);
            });

    } catch (err) {
        console.log(err);
        resModel.message = " Invalid Status ";
        return res.status(400).send(resModel);
    };
};
exports.authorizeDsaCentralizedOrByass = async (req, res, next) => {
    let resModel = {
        status: false,
        message: "",
        data: {}
    };
    try {
        const appVersionHeader = req.header('app-version-code');
        const isOverallReport = req.originalUrl && req.originalUrl.includes('get-overall-report');
        if (appVersionHeader && isOverallReport) {
            const versionResult = await exports.validateAppVersionFromHeaders(req, 'b2b');
            if (versionResult && !versionResult.valid) {
                resModel.message = 'A newer version is available. Please update your app.';
                return res.status(400).send(resModel);
            }
        }

        if (!req.header('Authorization') || req.header('Authorization') == 'undefined' || req.header('authorization') == 'undefined') {
            next();
        } else {
            const info = {
                referer: req.get('Referer') || req.get('Referrer'),
                token: req.header('Authorization')
            };

            if (!info?.token) {
                resModel.message = 'Please make sure your request has an Authorization header';
                return res.status(401).send(resModel);
            };

            decodedToken = jsonwebtoken.decode(info?.token);

            //static_auth
            if (info?.token == process?.env?.AUTH_KEY_EXTERNAL) {
                console.log('[Auth] Bypassing token validation for special token');
                return next();
            };

            // crm_logc
            const masterHosts = ["crm.ruloans.com", "crm-dev.ruloans.com", "crm-uat.ruloans.com", "ruloans-crm-reactjs-uat.vercel.app"];
            const isAllowedHost = masterHosts.some(host => info?.referer?.includes(host));
            if (isAllowedHost) {
                this.authorize(req, res, next);
                return;
            };

            //customer_logic
            if (decodedToken?.user) {
                return customer_auth(req, res, next);
            };

            // sub_logic default_logic
            var options = {
                'method': 'POST',
                'url': `${process.env.MS_URL}/api/v3/dsa/get-details`,
                'headers': {
                    'api-key': process.env.AUTH_KEY_RULOANS_BANK_CLAIM,
                    'device-id': 'xxx',
                    'Authorization': `Bearer ${req.header('Authorization')}`
                }
            };

            axios({
                ...options,
                responseType: "text",
                validateStatus: () => true,
            })
                .then((axiosResponse) => {
                    console.log(axiosResponse?.data);

                    let response = (JSON.parse(axiosResponse.data));
                    if (response?.status != 1) {
                        return res.status(401).send(response);
                    };

                    if (response?.status) {
                        req["dsa"] = response?.data?.dsa_details
                        next();
                    };
                })
                .catch((error) => {
                    resModel.message = 'Invalid Status!';
                    return res.status(401).send(resModel);
                });
        }

    } catch (err) {
        console.log(err);
        resModel.message = " Invalid Status ";
        return res.status(400).send(resModel);
    };
};
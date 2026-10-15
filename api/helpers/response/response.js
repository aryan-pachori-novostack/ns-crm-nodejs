const { logger } = require('../logger');

// Helper to generate request ID
const generateRequestId = () => {
  return `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Helper to log API response in structured format
const logAPIResponse = (req, res, instance, status, message, code, data, duration) => {
  if (!req || !res) return;

  const requestId = req.requestId || req.headers['x-request-id'] || generateRequestId();
  const responseSize = data ? JSON.stringify(data).length : 0;
  const responseSizeFormatted = responseSize > 1024 ? `${(responseSize / 1024).toFixed(2)}KB` : `${responseSize}B`;
  const durationFormatted = duration ? `${duration}ms` : '0ms';
  
  const statusText = code >= 200 && code < 300 ? 'OK' : code >= 400 && code < 500 ? 'BAD_REQUEST' : 'ERROR';
  const url = req.originalUrl || req.url;
  const fullUrl = req.protocol && req.get('host') 
    ? `${req.protocol}://${req.get('host')}${url}` 
    : url;

  // Format log message to match the example format
  const emoji = code >= 500 ? '❌' : code >= 400 ? '⚠️' : '✅';
  const logMessage = `${emoji} ${instance || 'API-Response'} API Response`;

  // For error responses, use an object (not the human-readable emoji string) as the
  // `message` value. api/helpers/logger.js's wrapper spreads this whole object (`...meta`)
  // over its own fields last, so whatever `message` holds here is what ends up in the
  // final log line — and the ELK ingest pipeline routes an object-valued `message` into
  // `message_json`, which the live ElastAlert Google Chat rule reads for "Response Data".
  // Success responses keep the plain emoji string.
  const messageValue = code >= 400
    ? { error_message: message, status_code: code, url: fullUrl, method: req.method || 'GET' }
    : logMessage;

  // Merge all data into one object for Winston JSON format
  const logData = {
    message: messageValue,
    service: process.env.SERVICE_NAME || "ruloans-crm-nodejs",
    version: process.env.SERVICE_VERSION || "1.0.0",
    environment: process.env.ENVIRONMENT || "development",
    requestId: requestId,
    instance: instance || "API-Response",
    method: req.method || "GET",
    url: fullUrl,
    status: status, // Use the exact status parameter passed to function (boolean)
    responseMessage: message, // Use the exact message parameter passed to function
    code: code || res.statusCode || 200,
    statusText: statusText,
    duration: durationFormatted,
    responseSize: responseSizeFormatted,
    headers: res.getHeaders ? res.getHeaders() : {},
    data: data || {}
  };

  // Log based on status code - Winston will merge the object.
  // Pass logMessage/logData as (logMessage, meta) — matching api/helpers/logger.js's
  // wrapper signature — so its trailing `...meta` spread applies the real
  // responseMessage/code/url/status instead of the wrapper's own placeholders.
  if (code >= 500) {
    logger.error(logMessage, logData);
  } else if (code >= 400) {
    logger.warn(logMessage, logData);
  } else {
    logger.info(logMessage, logData);
  }
};

// Surface a failed response on req so api/helpers/request-logger.js's
// res.on('finish') handler can populate error_message/error_code/error_type.
const attachReqError = (req, message, code) => {
  if (!req || !(code >= 400)) return;
  req.error = message instanceof Error
    ? message
    : Object.assign(new Error(typeof message === 'string' ? message : JSON.stringify(message)), { code });
};

exports.apiResponse = (res, status, message, code, data, token, req = null, instance = null, startTime = null) => {
  const resModel = {
    meta: {
      Status: status ? status : false,
      Message: message ? message : "",
      code: code ? code : 200
    },
    Data: data ? data : {},
    Token: token ? token : ""
  };

  if (res) {
    // Auto-detect req from res if not provided (Express stores req in res.req)
    const requestObj = req || res.req;

    // NOT setting res.statusCode = code here (reverted 2026-08-10, see PLAN/changelog).
    // #4647/#4648 restored it to fix 5xx ElastAlert detection, but that also makes every
    // logical error (400s) a real HTTP error for the first time since a7f995a05
    // (2026-01-27) — which unmasked a frontend bug (catchErrorFunc only reads a flat
    // data.Message, never data.meta.Message) that now shows customers a generic
    // "Request failed with status code 400" instead of the real message. Client response
    // stays HTTP 200 until that frontend fix ships; re-enabling this is tracked as a
    // follow-up. req.error below still gets set so internal logging keeps the real code.
    attachReqError(requestObj, message, code);

    res.json(resModel);

    if (requestObj) {
      const duration = startTime ? Date.now() - startTime : null;
      logAPIResponse(requestObj, res, instance || 'API-Response', status, message, code, data, duration);
    }
  }

  return JSON.stringify(resModel.meta);
};

exports.apiResponseV2 = (res, status, message, code, data, token, req = null, instance = null, startTime = null) => {
  const resModel = {
    meta: {
      status: status ? status : false,
      message: message ? message : "",
      code: code ? code : 200
    },
    data: data ? data : {},
    token: token ? token : ""
  };

  if (res) {
    // Auto-detect req from res if not provided (Express stores req in res.req)
    const requestObj = req || res.req;

    // NOT setting res.statusCode = code here — see apiResponse above.
    attachReqError(requestObj, message, code);

    res.json(resModel);

    if (requestObj) {
      const duration = startTime ? Date.now() - startTime : null;
      logAPIResponse(requestObj, res, instance || 'API-Response-V2', status, message, code, data, duration);
    }
  }

  return JSON.stringify(resModel.meta);
};


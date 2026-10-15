// logger.js
const { createLogger, transports, format } = require('winston');
const { v4: uuidv4 } = require('uuid');

const todayDate = new Date().toISOString().slice(0, 10);

/* -------------------- CONFIG -------------------- */

const ALLOWED_CALLERS = [
  'response.js',
  'api-logger.js'
];

const pendingLogs = new Map();
let currentRequestId = '';

/* -------------------- HELPERS -------------------- */

const isAllowedCaller = () => {
  try {
    const stack = new Error().stack || '';
    return ALLOWED_CALLERS.some(f => stack.includes(f));
  } catch {
    return false;
  }
};

const isInCatchBlock = () => {
  try {
    const stack = new Error().stack || '';
    return stack.includes('catch') || stack.includes('Promise');
  } catch {
    return false;
  }
};

const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
};

/* -------------------- BASE LOGGER -------------------- */

const baseLogger = createLogger({
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new transports.File({
      filename: `logs/info/info-log-${todayDate}.log`,
      level: 'info'
    }),
    new transports.File({
      filename: `logs/error/error-log-${todayDate}.log`,
      level: 'error'
    }),
    new transports.File({
      filename: `logs/warn/warn-log-${todayDate}.log`,
      level: 'warn'
    })
  ]
});

/* -------------------- MAIN LOGGER -------------------- */

const createWrappedLogger = () => {
  const wrappedLogger = {};

  ['info', 'warn', 'error', 'debug'].forEach(level => {
    wrappedLogger[level] = (logMessage, meta = {}) => {
      const requestId = meta.requestId || currentRequestId || `req-${uuidv4().slice(0, 8)}`;
      currentRequestId = requestId;

      const req = meta.req || {};
      const res = meta.res || {};

      const duration = meta.duration || 0;
      const responseSize = meta.responseSize || 0;

      const logData = {
        message: logMessage,
        service: process.env.SERVICE_NAME || 'ruloans-crm-nodejs',
        version: process.env.SERVICE_VERSION || '1.0.0',
        environment: process.env.ENVIRONMENT || 'development',
        requestId,
        instance: meta.instance || 'API-Response',
        method: req.method || meta.method || 'GET',
        url: meta.url || req.originalUrl || req.url || '',
        status: meta.status ?? true,
        responseMessage: meta.message || logMessage,
        code: meta.code || res.statusCode || 200,
        statusText: meta.statusText || '',
        duration: `${duration} ms`,
        responseSize: formatBytes(responseSize),
        headers: res.getHeaders ? res.getHeaders() : {},
        data: meta.data || {},
        ...meta
      };

      const isDirectError =
        logMessage instanceof Error ||
        meta.error ||
        meta.stack;

      const is500 = logData.code === 500;

      /* -------------------- 1️⃣ catch error store -------------------- */
      if (level === 'error' && isDirectError && isInCatchBlock()) {
        pendingLogs.set(requestId, {
          message: logMessage.message || logMessage,
          stack: logMessage.stack || meta.stack,
          time: new Date().toISOString()
        });

        setTimeout(() => pendingLogs.delete(requestId), 60000);
        return;
      }

      /* -------------------- 2️⃣ combine with final 500 -------------------- */
      if (level === 'error' && is500 && pendingLogs.has(requestId)) {
        const pending = pendingLogs.get(requestId);
        logData.data = {
          ...logData.data,
          originalError: pending
        };
        pendingLogs.delete(requestId);
      }

      /* -------------------- 3️⃣ allowed direct logging -------------------- */
      if (
        process.env.ALLOW_DIRECT_LOGGING === 'true' ||
        isAllowedCaller()
      ) {
        return baseLogger[level](logData);
      }

      /* -------------------- 4️⃣ default -------------------- */
      return baseLogger[level](logData);
    };
  });

  return wrappedLogger;
};

module.exports.logger = createWrappedLogger();

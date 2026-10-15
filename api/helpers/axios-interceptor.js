'use strict';

const axios = require('axios');
const { logger } = require('./logger');

const SENSITIVE_HEADERS = [
  'authorization', 'x-api-key', 'x-auth-token',
  'cookie', 'set-cookie', 'x-forwarded-for', 'x-real-ip'
];

const SENSITIVE_FIELDS = [
  'password', 'token', 'secret', 'key',
  'apiKey', 'authToken', 'accessToken', 'refreshToken',
  'privateKey', 'clientSecret'
];

function maskSensitiveData(obj, depth = 0) {
  if (depth > 5) return '[MAX_DEPTH_REACHED]';
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    if (obj.includes('Bearer ') || obj.includes('App ')) {
      return obj.substring(0, 8) + '...' + obj.substring(obj.length - 4);
    }
    if (obj.length >= 20 && /^[a-zA-Z0-9+/=_-]{20,}$/.test(obj) && !/\s/.test(obj)) {
      return obj.substring(0, 4) + '...' + obj.substring(obj.length - 4);
    }

    let maskedString = obj;
    maskedString = maskedString.replace(/\b(?:otp|code|pin|verification\s+code)\s*(?:is|:)\s*(\d{4,8})\b/gi, (match, otp) => {
      return match.replace(otp, '[MASKED]');
    });
    maskedString = maskedString.replace(/\b(\d{4,8})\b/g, (match) => {
      const context = maskedString.toLowerCase();
      if (context.includes('otp') || context.includes('code') || context.includes('pin') ||
        context.includes('verification') || context.includes('authenticate')) {
        return '[MASKED]';
      }
      return match;
    });
    return maskedString;
  }

  if (typeof obj === 'object') {
    if (Array.isArray(obj)) return obj.map(item => maskSensitiveData(item, depth + 1));

    const masked = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      const isSensitive = SENSITIVE_FIELDS.some(field => {
        const lowerField = field.toLowerCase();
        if (lowerKey === lowerField) return true;
        if (lowerField === 'password' && lowerKey.includes('password')) return true;
        if (lowerField === 'token' && (lowerKey.includes('token') || lowerKey.includes('auth'))) return true;
        if (lowerField === 'secret' && lowerKey.includes('secret')) return true;
        if (lowerField === 'key' && (lowerKey.includes('key') || lowerKey.includes('api_key'))) return true;
        if (lowerField === 'otp' && lowerKey.includes('otp')) return true;
        if (lowerField === 'code' && (lowerKey.includes('verification_code') || lowerKey.includes('auth_code') || lowerKey.includes('access_code'))) return true;
        if (lowerKey === 'statuscode' || lowerKey === 'status_code') return false;
        if (lowerKey === 'responsecode' || lowerKey === 'response_code') return false;
        if (lowerKey === 'errorcode' || lowerKey === 'error_code') return false;
        if (lowerKey === 'httpcode' || lowerKey === 'http_code') return false;
        return false;
      });

      masked[key] = isSensitive
        ? (typeof value === 'string' && value.length > 4
          ? value.substring(0, 2) + '...' + value.substring(value.length - 2)
          : '[MASKED]')
        : maskSensitiveData(value, depth + 1);
    }
    return masked;
  }

  return obj;
}

function maskHeaders(headers) {
  if (!headers) return headers;

  const masked = {};
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_HEADERS.includes(lowerKey)) {
      if (typeof value === 'string' && value.length > 8) {
        if (lowerKey === 'authorization' && value.startsWith('Bearer ')) {
          masked[key] = 'Bearer [MASKED]';
        } else if (lowerKey === 'authorization' && value.startsWith('App ')) {
          masked[key] = 'App [MASKED]';
        } else if (lowerKey === 'authorization' && value.startsWith('Basic ')) {
          masked[key] = 'Basic [MASKED]';
        } else {
          masked[key] = value.substring(0, 4) + '...' + value.substring(value.length - 4);
        }
      } else {
        masked[key] = '[MASKED]';
      }
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

function formatSize(data) {
  if (!data) return '0B';
  try {
    const size = typeof data === 'string' ? data.length : JSON.stringify(data).length;
    if (size < 1024) return `${size}B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
    return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  } catch {
    return 'unknown';
  }
}

function getByteSize(data) {
  if (!data) return 0;
  try {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return Buffer.byteLength(str, 'utf8');
  } catch {
    return -1;
  }
}

const BODY_LOG_MAX_CHARS = 5000;
function truncateBody(data) {
  if (data === null || data === undefined) return undefined;
  try {
    const masked = maskSensitiveData(data);
    const str = typeof masked === 'string' ? masked : JSON.stringify(masked);
    if (str.length <= BODY_LOG_MAX_CHARS) return masked;
    return {
      truncated: true,
      originalSizeChars: str.length,
      preview: str.substring(0, BODY_LOG_MAX_CHARS) + '…'
    };
  } catch {
    return { error: 'could not serialize body' };
  }
}

function generateRequestId() {
  return `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function toInstanceKey(name) {
  return name.toLowerCase().replace(/[\s-]+/g, '_');
}

function normalizeUrl(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url, 'http://placeholder');
    let path = parsed.pathname;
    path = path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':uuid');
    path = path.replace(/\/\d+(?=\/|$)/g, '/:id');
    path = path.replace(/\/[0-9a-f]{16,}(?=\/|$)/gi, '/:hex_id');
    return url.replace(parsed.pathname, path);
  } catch {
    return url;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL AXIOS LOGGING
// ─────────────────────────────────────────────────────────────────────────────
function setupAxiosLogging() {

  // ── Request interceptor ──────────────────────────────────────────────────
  axios.interceptors.request.use(
    (config) => {
      const requestId = generateRequestId();
      config.metadata = { requestId, startTime: Date.now() };

      // Legacy log — kept intentionally
      logger.info('🌐 External API Request', {
        request_id: requestId,
        method: config.method?.toUpperCase(),
        url: config.url,
        base_url: config.baseURL,
        timeout: config.timeout,
        headers: maskHeaders(config.headers),
        params: maskSensitiveData(config.params),
        data: maskSensitiveData(config.data),
        request_size: formatSize(config.data),
      });

      // Structured log — all camelCase
      logger.info('external_api_request', {
        type: 'external_api_request',
        request_id: requestId,
        instance: 'global',
        method: config.method?.toUpperCase(),
        url: config.url,
        url_pattern: normalizeUrl(config.baseURL ? config.baseURL + config.url : config.url),
        base_url: config.baseURL,
        timeout: config.timeout,
        headers: maskHeaders(config.headers),
        query_params: maskSensitiveData(config.params),
        request_body: truncateBody(config.data),
        request_size_bytes: getByteSize(config.data),

        // logger.js wrapper compatibility (api/helpers/logger.js)
        // Avoid default boolean `status: true` on request logs
        status: 0,
        code: 0,
        data: truncateBody(config.data) ?? {},
      });

      return config;
    },
    (error) => {
      // Legacy log — kept intentionally
      logger.error('❌ External API Request Error', {
        error:  error.message,
        config: error.config ? {
          method: error.config.method,
          url: error.config.url,
          headers: maskHeaders(error.config.headers),
        } : 'No config',
      });

      // Structured log
      logger.error('external_api_request_error', {
        type: 'external_api_request_error',
        instance: 'global',
        error_message: error.message,
        config: error.config ? {
          method:  error.config.method,
          url:     error.config.url,
          headers: maskHeaders(error.config.headers),
        } : null,
      });

      return Promise.reject(error);
    }
  );

  // ── Response interceptor ─────────────────────────────────────────────────
  axios.interceptors.response.use(
    (response) => {
      const { requestId, startTime } = response.config.metadata || {};
      const responseTimeMs = Date.now() - (startTime || Date.now());
      const responseSizeBytes = getByteSize(response.data);
      const maskedResponseHeaders = maskHeaders(response.headers);
      const responseBody = truncateBody(response.data);

      // Legacy log — kept intentionally
      logger.info('✅ External API Response', {
        request_id: requestId,
        method: response.config.method?.toUpperCase(),
        url: response.config.url,
        status: response.status,
        status_text: response.statusText,
        duration: `${responseTimeMs}ms`,
        response_size: formatSize(response.data),
        headers: maskHeaders(response.headers),
        data: maskSensitiveData(response.data),
      });

      // Structured log — all camelCase
      // responseTimeMs → Fluentd record_transformer: record["responseTimeMs"]
      // statusCode     → Fluentd record_transformer: record["statusCode"]
      // duration       → Fluentd OTP filter: record["duration"].to_s.gsub("ms","").to_i
      //                  Must stay as "274ms" string format — do not change to numeric
      logger.info('external_api_response', {
        type: 'external_api_response',
        request_id: requestId,
        instance: 'global',
        method: response.config.method?.toUpperCase(),
        url: response.config.url,
        url_pattern: normalizeUrl(response.config.baseURL ? response.config.baseURL + response.config.url : response.config.url),
        status_code: response.status,
        status_text: response.statusText,
        response_time_ms: responseTimeMs,
        response_size_bytes: responseSizeBytes,
        response_headers: maskedResponseHeaders,
        response_body: responseBody,
        response_status: response.status,
        code: response.status,
        duration: responseTimeMs,
        responseSize: Math.max(0, responseSizeBytes),
        data: responseBody,
        headers: maskedResponseHeaders,
      });

      return response;
    },
    (error) => {
      const { requestId, startTime } = error.config?.metadata || {};
      const responseTimeMs = Date.now() - (startTime || Date.now());
      const statusCode = error.response?.status || 0;
      const responseBody = error.response?.data ? truncateBody(error.response.data) : undefined;
      const responseHeaders = error.response?.headers ? maskHeaders(error.response.headers) : undefined;

      // Legacy log — kept intentionally
      logger.error('❌ External API Response Error', {
        request_id: requestId,
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
        status: error.response?.status,
        status_text: error.response?.statusText,
        duration: `${responseTimeMs}ms`,
        error: error.message,
        response_data: error.response?.data ? maskSensitiveData(error.response.data) : {},
        response_headers: error.response?.headers ? maskHeaders(error.response.headers) : {},
        request_data: error.config?.data ? maskSensitiveData(error.config.data) : {},
        request_headers: error.config?.headers ? maskHeaders(error.config.headers) : {},
      });

      // Structured log
      logger.error('external_api_error', {
        type: 'external_api_error',
        request_id: requestId,
        instance: 'global',
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
        url_pattern: normalizeUrl(error.config?.baseURL ? error.config.baseURL + error.config.url : error.config?.url),
        status_code: statusCode,
        status_text: error.response?.statusText,
        response_time_ms: responseTimeMs,
        response_body: responseBody,
        response_headers: responseHeaders,

        // logger.js wrapper compatibility (api/helpers/logger.js)
        status: statusCode,
        code: statusCode,
        duration: responseTimeMs,
        responseSize: Math.max(0, error.response?.data ? getByteSize(error.response.data) : 0),
        error_message: error.message,
        request_body: error.config?.data ? truncateBody(error.config.data) : undefined,
        request_headers: error.config?.headers ? maskHeaders(error.config.headers) : undefined,
      });

      return Promise.reject(error);
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NAMED INSTANCE LOGGING
// ─────────────────────────────────────────────────────────────────────────────
function setupInstanceLogging(axiosInstance, instanceName = 'default') {
  const instanceKey = toInstanceKey(instanceName);

  // ── Request interceptor ──────────────────────────────────────────────────
  axiosInstance.interceptors.request.use(
    (config) => {
      const requestId = generateRequestId();
      config.metadata = { requestId, startTime: Date.now(), instance: instanceName };

      try {
        // Legacy log — kept intentionally
        logger.info(`🌐 ${instanceName} API Request`, {
          request_id: requestId,
          instance: instanceName,
          method: config.method?.toUpperCase(),
          url: config.url,
          base_url: config.baseURL,
          timeout: config.timeout,
          headers: maskHeaders(config.headers),
          params: maskSensitiveData(config.params),
          data: maskSensitiveData(config.data),
          request_size: formatSize(config.data),
        });

        // Structured log — all camelCase
        logger.info(`${instanceKey}_external_api_request`, {
          type: 'external_api_request',
          request_id: requestId,
          instance: instanceName,
          method: config.method?.toUpperCase(),
          url: config.url,
          url_pattern: normalizeUrl(config.baseURL ? config.baseURL + config.url : config.url),
          base_url: config.baseURL,
          timeout: config.timeout,
          headers: maskHeaders(config.headers),
          query_params: maskSensitiveData(config.params),
          request_body: truncateBody(config.data),
          request_size_bytes: getByteSize(config.data),

          // logger.js wrapper compatibility (api/helpers/logger.js)
          status: 0,
          code: 0,
          data: truncateBody(config.data) ?? {},
        });
      } catch (err) {
        console.error(`[axios-interceptor] ${instanceName} request log error:`, err.message);
      }

      return config;
    },
    (error) => {
      try {
        // Legacy log — kept intentionally
        logger.error(`❌ ${instanceName} API Request Error`, {
          instance: instanceName,
          error:    error.message,
          config: error.config ? {
            method: error.config.method,
            url: error.config.url,
            headers: maskHeaders(error.config.headers),
          } : 'No config',
        });

        // Structured log
        logger.error(`${instanceKey}_external_api_request_error`, {
          type: 'external_api_request_error',
          instance: instanceName,
          error_message: error.message,
          config: error.config ? {
            method:  error.config.method,
            url:     error.config.url,
            headers: maskHeaders(error.config.headers),
          } : null,
        });
      } catch (err) {
        console.error(`[axios-interceptor] ${instanceName} request-error log error:`, err.message);
      }

      return Promise.reject(error);
    }
  );

  // ── Response interceptor ─────────────────────────────────────────────────
  axiosInstance.interceptors.response.use(
    (response) => {
      const { requestId, startTime, instance } = response.config.metadata || {};
      const responseTimeMs = Date.now() - (startTime || Date.now());
      const responseSizeBytes = getByteSize(response.data);
      const maskedResponseHeaders = maskHeaders(response.headers);
      const responseBody = truncateBody(response.data);

      try {
        // Legacy log — kept intentionally
        logger.info(`✅ ${instance} API Response`, {
          request_id: requestId,
          instance,
          method: response.config.method?.toUpperCase(),
          url: response.config.url,
          status: response.status,
          status_text: response.statusText,
          duration: `${responseTimeMs}ms`,
          response_size: formatSize(response.data),
          headers: maskHeaders(response.headers),
          data: maskSensitiveData(response.data),
        });

        // Structured log — all camelCase
        logger.info(`${instanceKey}_external_api_response`, {
          type:              'external_api_response',
          request_id: requestId,
          instance,
          method:            response.config.method?.toUpperCase(),
          url:               response.config.url,
          url_pattern:        normalizeUrl(response.config.baseURL ? response.config.baseURL + response.config.url : response.config.url),
          status_code:        response.status,
          status_text:        response.statusText,
          response_time_ms: responseTimeMs,
          response_size_bytes: responseSizeBytes,
          response_headers: maskedResponseHeaders,
          response_body: responseBody,

          response_status: response.status,
          code: response.status,
          duration: responseTimeMs,
          responseSize: Math.max(0, responseSizeBytes),
          data: responseBody,
          headers: maskedResponseHeaders,
        });
      } catch (err) {
        console.error(`[axios-interceptor] ${instanceName} response log error:`, err.message);
      }

      return response;
    },
    (error) => {
      const { requestId, startTime, instance } = error.config?.metadata || {};
      const responseTimeMs = Date.now() - (startTime || Date.now());
      const statusCode = error.response?.status || 0;
      const responseBody = error.response?.data ? truncateBody(error.response.data) : undefined;
      const responseHeaders = error.response?.headers ? maskHeaders(error.response.headers) : undefined;

      try {
        // Legacy log — kept intentionally
        logger.error(`❌ ${instance} API Response Error`, {
          request_id: requestId,
          instance,
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url,
          status: error.response?.status,
          status_text: error.response?.statusText,
          duration: `${responseTimeMs}ms`,
          error: error.message,
          response_data: error.response?.data ? maskSensitiveData(error.response.data) : {},
          response_headers: error.response?.headers ? maskHeaders(error.response.headers) : {},
          request_data: error.config?.data ? maskSensitiveData(error.config.data) : {},
          request_headers: error.config?.headers ? maskHeaders(error.config.headers) : {},
        });

        // Structured log
        logger.error(`${instanceKey}_external_api_error`, {
          type: 'external_api_error',
          request_id: requestId,
          instance,
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url,
          url_pattern: normalizeUrl(error.config?.baseURL ? error.config.baseURL + error.config.url : error.config?.url),
          status_code: statusCode,
          status_text: error.response?.statusText,
          response_time_ms: responseTimeMs,
          error_message: error.message,
          response_body: responseBody,
          response_headers: responseHeaders,
          request_body: error.config?.data ? truncateBody(error.config.data) : undefined,
          request_headers: error.config?.headers ? maskHeaders(error.config.headers) : undefined,

          // logger.js wrapper compatibility (api/helpers/logger.js)
          status: statusCode,
          code: statusCode,
          duration: responseTimeMs,
          responseSize: Math.max(0, error.response?.data ? getByteSize(error.response.data) : 0),
        });
      } catch (err) {
        console.error(`[axios-interceptor] ${instanceName} response-error log error:`, err.message);
      }

      return Promise.reject(error);
    }
  );
}

module.exports = {
  setupAxiosLogging,
  setupInstanceLogging,
  maskSensitiveData,
  maskHeaders,
  formatSize,
  getByteSize,
  truncateBody,
  normalizeUrl,
  generateRequestId,
  SENSITIVE_HEADERS,
  SENSITIVE_FIELDS
};

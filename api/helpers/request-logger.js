'use strict';

const crypto = require('crypto');
const { logger } = require('./logger');

// Fields to strip from query params / body before logging (add your own)
const SENSITIVE_KEYS = new Set([
  'password', 'token', 'secret', 'authorization',
  'api_key', 'apikey', 'access_token', 'refresh_token',
  'credit_card', 'ssn',
]);

/**
 * Recursively redact sensitive keys from an object.
 */
function sanitize(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 3) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : sanitize(v, depth + 1),
    ])
  );
}

/**
 * Safely parse an integer header value (e.g. content-length).
 */
function parseIntHeader(value) {
  const n = parseInt(value, 10);
  return isNaN(n) ? 0 : n;
}

/**
 * Express middleware for structured API request/response logging.
 * Designed for shipping to ELK Stack via a JSON logger (e.g. winston + winston-elasticsearch).
 *
 * Usage:
 *   const { apiLogger } = require('./apiLogger');
 *   app.use(apiLogger(logger));          // pass your winston/pino logger instance
 */
function apiLogger() {
  return function (req, res, next) {
    const start = Date.now();

    // ── Request ID ──────────────────────────────────────────────────────────
    // Honour an upstream-propagated ID (e.g. from an API gateway or load balancer)
    // so the same request can be correlated across multiple services.
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    // ── Capture real client IP ───────────────────────────────────────────────
    // X-Forwarded-For may contain a comma-separated chain; first entry is the client.
    const clientIp =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      req.ip;

    // ── Shared base fields (common to both start and finish log entries) ─────
    const baseFields = {
      request_id:  requestId,
      environment: process.env.NODE_ENV     || 'unknown',
      service:     process.env.SERVICE_NAME || 'api',
      version:     process.env.APP_VERSION  || 'unknown',
      host:        process.env.HOSTNAME     || require('os').hostname(),
      method:      req.method,
      path:        req.route?.path || req.path,
      url:         req.originalUrl,
      ip_address:  clientIp,
      user_agent:  req.headers['user-agent'],
    };
    // ── REQUEST START log ────────────────────────────────────────────────────
    // Logged immediately when the request is received, before any processing.
    // Useful for detecting requests that never finish (hung connections, crashes).
    logger.info('api_request_start', {
      ...baseFields,
      type:         'api_request_start',
      timestamp:    new Date().toISOString(),
      query_params: sanitize(req.query),
      http_version: req.httpVersion,
      request_size_bytes: parseIntHeader(req.headers['content-length']),
      referer:      req.headers['referer'] || req.headers['referrer'],
      // Identity may not be populated yet if auth middleware runs after this,
      // but include it if available (e.g. API key auth done in a prior middleware).
      user_id:      req.loggedInUser?.id || req.dsa?.dsa_id,
      session_id:   req.session?.id,
    });

    res.on('finish', () => {

      const responseTimeMs = Date.now() - start;
      const statusCode = res.statusCode;
      const isError = statusCode >= 400;
      const logEntry = {
        // ── Event identity ─────────────────────────────────────────────────
        ...baseFields,
        type:      'api_request_finish',
        timestamp: new Date().toISOString(),        // explicit ISO-8601 for ELK

        // ── HTTP request (fields not in baseFields) ────────────────────────
        // Use the route pattern (e.g. /users/:id) — never the resolved URL.
        // This keeps ELK cardinality manageable and aggregations meaningful.
        query_params:   sanitize(req.query),        // sensitive keys redacted
        http_version:   req.httpVersion,
        request_size_bytes: parseIntHeader(req.headers['content-length']),

        // ── HTTP response ──────────────────────────────────────────────────
        status_code:    statusCode,
        response_time_ms:    responseTimeMs,
        response_size_bytes: parseIntHeader(res.getHeader('content-length')),

        // ── Latency buckets (pre-computed for fast Kibana range filters) ───
        // Adjust thresholds to match your SLOs.
        latency_bucket: responseTimeMs < 100  ? 'fast'
                      : responseTimeMs < 500  ? 'normal'
                      : responseTimeMs < 2000 ? 'slow'
                      : 'critical',

        // ── Client / browser ───────────────────────────────────────────────
        referer: req.headers['referer'] || req.headers['referrer'],

        // ── Auth / identity ────────────────────────────────────────────────
        // Populated by your auth middleware (e.g. passport, JWT decode).
        // Leave as undefined if unauthenticated — ELK will simply omit the field.
        user_id:    req.loggedInUser?.id || req.dsa?.dsa_id,
        role:       req.loggedInUser?.role || "DSA",
        session_id: req.session?.id,

        // ── Downstream / DB instrumentation ───────────────────────────────
        // Populate req.dbMetrics in your DB layer for powerful query analysis.
        // Example: req.dbMetrics = { query_count: 3, time_ms: 42, cache_hit: true }
        db_query_count: req.dbMetrics?.queryCount,
        db_time_ms:     req.dbMetrics?.timeMs,
        cache_hit:      req.dbMetrics?.cacheHit,

        // ── Upstream service calls ─────────────────────────────────────────
        // Populate req.upstreamMetrics when you call other internal services.
        // Example: req.upstreamMetrics = { service: 'payments-api', latency_ms: 120 }
        upstream_service:    req.upstreamMetrics?.service,
        upstream_latency_ms: req.upstreamMetrics?.latencyMs,

        // ── Error context (only on 4xx / 5xx) ─────────────────────────────
        // Attach the error in your error handler: req.error = err
        ...(isError && req.error && {
          error_message: req.error.message,
          error_code:    req.error.code,
          error_type:    req.error.constructor?.name,
          // Only include stack traces in non-production environments
          ...(process.env.NODE_ENV !== 'production' && {
            stack_trace: req.error.stack,
          }),
        }),
      };
      // For error responses, pass an object (not the plain 'api_request_finish' string)
      // as the log message. The ELK ingest pipeline routes an object-valued `message`
      // into `message_json` — that's the field the live ElastAlert Google Chat rule
      // reads for "Response Data", so this is what makes real error content show up
      // there instead of "N/A". Non-error responses keep the plain string.
      const logMessage = (isError && req.error)
        ? { error_message: req.error.message, status_code: statusCode, url: baseFields.url, method: baseFields.method }
        : 'api_request_finish';

      if (statusCode >= 500)      logger.error(logMessage, logEntry);
      else if (statusCode >= 400) logger.warn(logMessage, logEntry);
      else                        logger.info(logMessage, logEntry);
    });

    next();
  };
}

module.exports = { apiLogger, sanitize };
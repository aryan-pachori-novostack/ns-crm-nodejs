const { logger } = require('./logger');

/**
 * Enhanced API Logger for ELK Integration
 * Provides structured logging for API requests, responses, and performance metrics
 */
class APILogger {
  constructor() {
    this.startTime = null;
  }

  /**
   * Log API request with structured data for ELK
   * @param {Object} req - Express request object
   * @param {string} methodName - Name of the controller method
   * @param {Object} additionalData - Additional data to log
   */
  logRequest(req, methodName, additionalData = {}) {
    this.startTime = Date.now();
    return this.generateRequestId();
  }

  /**
   * Sanitize headers to remove sensitive information
   * @param {Object} headers - Request/Response headers
   * @returns {Object} Sanitized headers
   */
  sanitizeHeaders(headers) {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    const sanitized = { ...headers };
    
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  /**
   * Sanitize request body to remove sensitive information
   * @param {Object} body - Request body
   * @returns {Object} Sanitized body
   */
  sanitizeBody(body) {
    if (!body || typeof body !== 'object') return body;
    
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'ssn', 'pan', 'aadhar'];
    const sanitized = { ...body };
    
    const sanitizeObject = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        } else if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '[REDACTED]';
        }
      }
    };
    
    sanitizeObject(sanitized);
    return sanitized;
  }

  /**
   * Generate unique request ID
   * @returns {string} Unique request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log complete API call in standardized format
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {string} methodName - Name of the controller method
   * @param {Object} responseData - Response data
   * @param {string} requestId - Request ID from logRequest
   * @param {Object} additionalData - Additional data to log
   */
  logAPICall(req, res, methodName, responseData, requestId, additionalData = {}) {
    const endTime = Date.now();
    const duration = this.startTime ? endTime - this.startTime : 0;
    
    // If no start time was set, set it now
    if (!this.startTime) {
      this.startTime = endTime;
    }
    
    const logData = {
      "timestamp": new Date().toISOString(),
      "severity_text": res.statusCode >= 400 ? "ERROR" : "INFO",
      "message": `${methodName} API call`,
      "service": {
        "name": process.env.SERVICE_NAME || "novostack-crm",
        "version": "1.0.0",
        "environment": process.env.ENVIRONMENT || "development"
      },
      "context": {
        "request_id": requestId,
        "trace_id": req.headers['x-trace-id'] || `trace_${Date.now()}`,
        "span_id": `span_${Math.random().toString(36).substr(2, 9)}`
      },
      "api_call": {
        "instance": methodName,
        "method": req.method,
        "url": `${req.protocol}://${req.get('host')}${req.originalUrl || req.url}`,
        "request": {
          "headers": this.sanitizeHeaders(req.headers),
          "body": this.sanitizeBody(req.body),
          "query": req.query,
          "params": req.params,
          "ip": req.ip || req.connection?.remoteAddress,
          "userAgent": req.get('User-Agent')
        },
        "response": {
          "status": res.statusCode,
          "status_text": res.statusMessage || (res.statusCode >= 200 && res.statusCode < 300 ? "OK" : "ERROR"),
          "duration_ms": duration,
          "size_bytes": responseData ? JSON.stringify(responseData).length : 0,
          "body": responseData || {},
          "headers": this.sanitizeHeaders(res.getHeaders())
        },
        "user": {
          "id": req?.loggedInUser?.id || req?.dsa?.dsa_id || null,
          "role": req?.loggedInUser?.role || null,
          "phone": req?.loggedInUser?.userPhone || req?.dsa?.dsa_mobile_number || null,
          "email": req?.loggedInUser?.email || null
        },
        "additional_data": additionalData
      }
    };

    // Log based on status code
    if (res.statusCode >= 500) {
      logger.error('API Call', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('API Call', logData);
    } else {
      logger.info('API Call', logData);
    }

    return logData;
  }
}

// Create singleton instance
const apiLogger = new APILogger();

module.exports = apiLogger;

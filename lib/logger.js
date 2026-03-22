'use strict';
const pino = require('pino');

/**
 * Centralised logger.
 *
 * Log level is controlled by the LOG_LEVEL environment variable.
 * Valid values: trace | debug | info | warn | error | fatal  (default: info)
 *
 * Set LOG_LEVEL=debug to enable verbose output for SMTP and DB diagnostics.
 */
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'wassersport' },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Prevent passwords / tokens from appearing in structured log fields
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'body.password',
      'password',
    ],
    censor: '[REDACTED]',
  },
});

module.exports = logger;

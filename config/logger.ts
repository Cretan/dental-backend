/**
 * Strapi Logger Configuration
 *
 * Uses @strapi/logger (wraps Winston) for structured logging.
 *
 * Environment variables:
 *   LOG_LEVEL  - winston log level (default: 'info' in production, 'debug' in dev)
 *   LOG_FORMAT - 'json' for structured output, 'pretty' for human-readable (default: based on NODE_ENV)
 */
'use strict';

const {
  winston,
  formats: { prettyPrint, levelFilter },
} = require('@strapi/logger');

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');
const logFormat = process.env.LOG_FORMAT || (isProduction ? 'json' : 'pretty');

function buildFormat() {
  if (logFormat === 'json') {
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );
  }

  // Pretty format for development
  return winston.format.combine(
    levelFilter('http'),
    prettyPrint({ timestamps: 'YYYY-MM-DD hh:mm:ss.SSS' })
  );
}

export default {
  transports: [
    new winston.transports.Console({
      level: logLevel,
      format: buildFormat(),
    }),
  ],
};

/**
 * Structured logger using winston.
 *
 * Log levels: error, warn, info, debug
 * - Production (Azure): logs as JSON for easy parsing by monitoring tools.
 * - Local development: logs with colour, timestamps, and human-readable format.
 *
 * Usage:
 *   const logger = require('../utils/logger');
 *   logger.info('Bot started', { mode: 'polling' });
 *   logger.error('API call failed', { endpoint, error: err.message });
 */
const { createLogger, format, transports } = require('winston');

const isProduction = !!process.env.WEBSITE_HOSTNAME;

const logger = createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  defaultMeta: { service: 'bird-sighting-bot' },
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true })
  ),
  transports: [
    new transports.Console({
      format: isProduction
        ? format.combine(format.json())                       // JSON in Azure
        : format.combine(format.colorize(), format.printf(({ timestamp, level, message, service, ...meta }) => {
            const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
            return `${timestamp} [${level}] ${message}${extra}`;
          }))
    })
  ]
});

module.exports = logger;

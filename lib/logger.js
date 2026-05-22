/**
 * Application Logger
 * Provides structured logging with different levels
 */

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
};

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

class Logger {
  constructor(context = 'App') {
    this.context = context;
  }

  _log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      context: this.context,
      message,
      ...meta,
    };

    // In production, only log errors and warnings
    if (isProduction && (level === LOG_LEVELS.DEBUG || level === LOG_LEVELS.INFO)) {
      return;
    }

    // Format output
    const prefix = `[${timestamp}] [${level}] [${this.context}]`;
    
    switch (level) {
      case LOG_LEVELS.ERROR:
        console.error(prefix, message, meta);
        break;
      case LOG_LEVELS.WARN:
        console.warn(prefix, message, meta);
        break;
      case LOG_LEVELS.INFO:
        console.info(prefix, message, meta);
        break;
      case LOG_LEVELS.DEBUG:
        if (isDevelopment) {
          console.log(prefix, message, meta);
        }
        break;
      default:
        console.log(prefix, message, meta);
    }
  }

  error(message, meta) {
    this._log(LOG_LEVELS.ERROR, message, meta);
  }

  warn(message, meta) {
    this._log(LOG_LEVELS.WARN, message, meta);
  }

  info(message, meta) {
    this._log(LOG_LEVELS.INFO, message, meta);
  }

  debug(message, meta) {
    this._log(LOG_LEVELS.DEBUG, message, meta);
  }
}

// Create default logger instance
export const logger = new Logger('App');

// Export Logger class for creating context-specific loggers
export default Logger;

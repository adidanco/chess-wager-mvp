/**
 * Logger utility for consistent logging across the application
 */

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  minLevel: LogLevel;
  includeTimestamp: boolean;
  enableRemoteLogging: boolean;
}

// Default configuration
const defaultConfig: LoggerConfig = {
  minLevel: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  includeTimestamp: true,
  enableRemoteLogging: process.env.NODE_ENV === 'production'
};

// Current configuration
let config: LoggerConfig = { ...defaultConfig };

/**
 * Configure the logger
 * @param newConfig - New configuration options
 */
export const configureLogger = (newConfig: Partial<LoggerConfig>): void => {
  config = { ...config, ...newConfig };
};

// Log level priorities - higher number = higher priority
const LOG_PRIORITIES: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3
};

/**
 * Format log message with timestamp if enabled
 */
const formatLogMessage = (level: LogLevel, message: string, context?: object): string => {
  const parts: string[] = [];
  
  if (config.includeTimestamp) {
    parts.push(`[${new Date().toISOString()}]`);
  }
  
  parts.push(`[${level.toUpperCase()}]`);
  parts.push(message);
  
  if (context) {
    try {
      parts.push(JSON.stringify(context));
    } catch (e) {
      parts.push('[Context serialization error]');
    }
  }
  
  return parts.join(' ');
};

/**
 * Send log to remote logging service (if enabled)
 */
const sendToRemoteLogger = async (level: LogLevel, message: string, context?: object): Promise<void> => {
  if (!config.enableRemoteLogging) return;
  
  // This is a placeholder for integrating with a remote logging service
  // such as Firebase Analytics, Sentry, LogRocket, etc.
  try {
    // Example integration (commented out as it's just a placeholder)
    /*
    await fetch('https://api.logging-service.com/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message, context, timestamp: new Date().toISOString() })
    });
    */
  } catch (e) {
    // Don't let remote logging errors affect the application
    console.error('Remote logging error:', e);
  }
};

/**
 * Log a message if its level meets the minimum configured level
 */
const logMessage = (level: LogLevel, message: string, context?: object): void => {
  if (LOG_PRIORITIES[level] < LOG_PRIORITIES[config.minLevel]) {
    return;
  }
  
  const formattedMessage = formatLogMessage(level, message, context);
  
  switch (level) {
    case LogLevel.DEBUG:
      console.debug(formattedMessage);
      break;
    case LogLevel.INFO:
      console.info(formattedMessage);
      break;
    case LogLevel.WARN:
      console.warn(formattedMessage);
      break;
    case LogLevel.ERROR:
      console.error(formattedMessage);
      break;
  }
  
  // Send to remote logger if appropriate
  sendToRemoteLogger(level, message, context);
};

/**
 * Logger object with methods for different log levels
 */
export const logger = {
  debug: (message: string, context?: object) => logMessage(LogLevel.DEBUG, message, context),
  info: (message: string, context?: object) => logMessage(LogLevel.INFO, message, context),
  warn: (message: string, context?: object) => logMessage(LogLevel.WARN, message, context),
  error: (message: string, context?: object) => logMessage(LogLevel.ERROR, message, context),
  
  /**
   * Log application startup information
   */
  logStartup: () => {
    logger.info(`Application starting in ${process.env.NODE_ENV || 'development'} mode`);
  },
  
  /**
   * Log API requests (can be used with middleware)
   */
  logApiRequest: (method: string, url: string, status: number, duration: number) => {
    logger.info(`API ${method} ${url} ${status} - ${duration}ms`);
  },
  
  /**
   * Log user actions for analytics
   */
  logUserAction: (userId: string, action: string, details?: object) => {
    logger.info(`User ${userId} - ${action}`, details);
  },
  
  /**
   * Log payment events
   */
  logPayment: (userId: string, amount: number, status: string, details?: object) => {
    logger.info(`Payment ${status} - User: ${userId}, Amount: ₹${amount}`, details);
  }
};

// Export a method to create specialized loggers for specific components
export const createLogger = (component: string) => ({
  debug: (message: string, context?: object) => logger.debug(`[${component}] ${message}`, context),
  info: (message: string, context?: object) => logger.info(`[${component}] ${message}`, context),
  warn: (message: string, context?: object) => logger.warn(`[${component}] ${message}`, context),
  error: (message: string, context?: object) => logger.error(`[${component}] ${message}`, context)
}); 
// Define log level enum for type safety
enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

// Type for logger data
type LogData = Record<string, any> | null | undefined;

// Helper to format log messages
const formatLog = (level: LogLevel, component: string, message: string, data: LogData = null): void => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] [${component}] ${message}`;
  
  // Log to console with appropriate styling
  switch (level) {
    case LogLevel.DEBUG:
      console.debug(logMessage, data || '');
      break;
    case LogLevel.INFO:
      console.info(logMessage, data || '');
      break;
    case LogLevel.WARN:
      console.warn(logMessage, data || '');
      break;
    case LogLevel.ERROR:
      console.error(logMessage, data || '');
      break;
  }

  // For errors, also log to a more detailed format
  if (level === LogLevel.ERROR) {
    console.error({
      timestamp,
      level,
      component,
      message,
      data,
      stack: new Error().stack
    });
  }
};

// Logger interface for cleaner type definitions
interface Logger {
  debug: (component: string, message: string, data?: LogData) => void;
  info: (component: string, message: string, data?: LogData) => void;
  warn: (component: string, message: string, data?: LogData) => void;
  error: (component: string, message: string, data?: LogData) => void;
}

// Export the logger object with typed methods
export const logger: Logger = {
  debug: (component, message, data) => formatLog(LogLevel.DEBUG, component, message, data),
  info: (component, message, data) => formatLog(LogLevel.INFO, component, message, data),
  warn: (component, message, data) => formatLog(LogLevel.WARN, component, message, data),
  error: (component, message, data) => formatLog(LogLevel.ERROR, component, message, data)
}; 
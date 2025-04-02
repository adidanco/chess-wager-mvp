// Log levels for better organization
const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
}

// Helper to format log messages
const formatLog = (level, component, message, data = null) => {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] [${level}] [${component}] ${message}`
  
  // Log to console with appropriate styling
  switch (level) {
    case LOG_LEVELS.DEBUG:
      console.debug(logMessage, data || '')
      break
    case LOG_LEVELS.INFO:
      console.info(logMessage, data || '')
      break
    case LOG_LEVELS.WARN:
      console.warn(logMessage, data || '')
      break
    case LOG_LEVELS.ERROR:
      console.error(logMessage, data || '')
      break
  }

  // For errors, also log to a more detailed format
  if (level === LOG_LEVELS.ERROR) {
    console.error({
      timestamp,
      level,
      component,
      message,
      data,
      stack: new Error().stack
    })
  }
}

export const logger = {
  debug: (component, message, data) => formatLog(LOG_LEVELS.DEBUG, component, message, data),
  info: (component, message, data) => formatLog(LOG_LEVELS.INFO, component, message, data),
  warn: (component, message, data) => formatLog(LOG_LEVELS.WARN, component, message, data),
  error: (component, message, data) => formatLog(LOG_LEVELS.ERROR, component, message, data)
} 
import { logger } from './logger'

export const handleError = async (error, operation, maxRetries = 3) => {
  logger.error('ErrorHandler', 'Operation failed', { 
    error, 
    operation: operation.name,
    retries: maxRetries 
  })

  // Handle specific Firebase errors
  if (error.code === 'unavailable' || error.code === 'network-request-failed') {
    if (maxRetries > 0) {
      logger.info('ErrorHandler', 'Retrying operation', { 
        operation: operation.name,
        remainingRetries: maxRetries - 1 
      })
      await new Promise(resolve => setTimeout(resolve, 1000))
      return operation()
    }
  }

  // Handle authentication errors
  if (error.code?.startsWith('auth/')) {
    throw new Error('Authentication error. Please log in again.')
  }

  // Handle game state errors
  if (error.message?.includes('Game is not in progress')) {
    throw new Error('Game has ended or been cancelled.')
  }

  // Handle balance errors
  if (error.message?.includes('Insufficient balance')) {
    throw new Error('Insufficient balance for this operation.')
  }

  // Default error handling
  throw new Error(error.message || 'An unexpected error occurred.')
} 
import { toast } from 'react-hot-toast';
import { logger, createLogger } from './logger';

// Create a specialized logger for error handling
const errorLogger = createLogger('ErrorHandler');

/**
 * Error categories for better error handling
 */
export enum ErrorCategory {
  AUTHENTICATION = 'Authentication',
  PAYMENT = 'Payment',
  NETWORKING = 'Networking',
  DATABASE = 'Database',
  VALIDATION = 'Validation',
  TRANSACTION = 'Transaction',
  GENERAL = 'General'
}

/**
 * Interface for structured error handling
 */
export interface ErrorOptions {
  showToast?: boolean;
  logError?: boolean;
  category?: ErrorCategory;
  context?: Record<string, any>;
  retryCallback?: () => Promise<any>;
}

/**
 * Default error handling options
 */
const defaultOptions: ErrorOptions = {
  showToast: true,
  logError: true,
  category: ErrorCategory.GENERAL,
  context: {}
};

/**
 * Main error handler function
 * @param error The error object
 * @param message Custom error message to display
 * @param options Additional error handling options
 */
export const handleError = (
  error: unknown,
  message?: string,
  options?: ErrorOptions
): void => {
  const opts = { ...defaultOptions, ...options };
  const errorMessage = message || getErrorMessage(error);
  
  // Extract error information
  const errorObject = {
    message: errorMessage,
    originalError: error,
    category: opts.category,
    ...opts.context
  };
  
  // Log error to console/logging service
  if (opts.logError) {
    errorLogger.error(`${opts.category}: ${errorMessage}`, errorObject);
  }
  
  // Show toast notification
  if (opts.showToast) {
    toast.error(errorMessage);
  }
};

/**
 * Special handler for payment-related errors
 * @param error The payment error
 * @param context Additional context
 */
export const handlePaymentError = (error: unknown, context?: Record<string, any>): void => {
  handleError(error, 'Payment processing failed. Please try again.', {
    category: ErrorCategory.PAYMENT,
    context
  });
  
  // Log payment error for analytics
  if (context?.userId && context?.amount) {
    logger.logPayment(
      context.userId,
      context.amount,
      'failed',
      { error: getErrorMessage(error), ...context }
    );
  }
};

/**
 * Special handler for transaction-related errors
 * @param error The transaction error
 * @param context Additional context
 */
export const handleTransactionError = (error: unknown, context?: Record<string, any>): void => {
  handleError(error, 'Transaction failed. Your account has not been charged.', {
    category: ErrorCategory.TRANSACTION,
    context
  });
  
  // Log transaction error for analytics
  if (context?.userId && context?.amount) {
    logger.logPayment(
      context.userId,
      context.amount,
      'failed',
      { error: getErrorMessage(error), transactionType: context.type, ...context }
    );
  }
};

/**
 * Special handler for authentication errors
 * @param error The auth error
 * @param context Additional context
 */
export const handleAuthError = (error: unknown, context?: Record<string, any>): void => {
  handleError(error, 'Authentication failed. Please try again.', {
    category: ErrorCategory.AUTHENTICATION,
    context
  });
  
  // Log user action for analytics
  if (context?.userId && context?.action) {
    logger.logUserAction(
      context.userId,
      `auth_failed_${context.action}`,
      { error: getErrorMessage(error), ...context }
    );
  }
};

/**
 * Special handler for network errors that provides retry capability
 * @param error The network error
 * @param retryCallback Function to retry the failed operation
 */
export const handleNetworkError = (error: unknown, retryCallback?: () => Promise<any>): void => {
  handleError(error, 'Network error. Please check your connection.', {
    category: ErrorCategory.NETWORKING,
    retryCallback
  });
};

/**
 * Extract a user-friendly error message from different error types
 * @param error The error object
 */
export const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  
  return 'An unexpected error occurred';
};

/**
 * Creates an async function wrapper that handles errors automatically
 * @param fn The async function to wrap
 * @param options Error handling options
 */
export const withErrorHandling = <T>(
  fn: (...args: any[]) => Promise<T>, 
  options?: ErrorOptions
) => {
  return async (...args: any[]): Promise<T | undefined> => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, undefined, options);
      return undefined;
    }
  };
}; 
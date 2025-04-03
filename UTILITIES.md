# Chess Wager Utilities

This document outlines the utilities created to improve code quality, error handling, validation, and logging in the Chess Wager application.

## Error Handling

The error handling system provides consistent error management across the application.

### `errorHandler.ts`

The error handling utility provides a structured way to handle errors with the following features:
- Categorized errors (Authentication, Payment, Networking, etc.)
- Consistent toast notifications
- Structured logging
- Context preservation
- Specialized handlers for different error types

```typescript
// Example usage
import { handleError, ErrorCategory } from '../utils/errorHandler';

try {
  // Code that might fail
} catch (error) {
  handleError(error, 'Custom error message', {
    category: ErrorCategory.PAYMENT,
    context: { orderId: '123', amount: 500 }
  });
}
```

Specialized handlers are also available:
```typescript
// For payment errors
handlePaymentError(error, { orderId: '123', amount: 500 });

// For transaction errors
handleTransactionError(error, { transactionId: '456', type: 'withdrawal' });

// For authentication errors
handleAuthError(error, { userId: 'user123', action: 'login' });

// For network errors with retry capability
handleNetworkError(error, retryFunction);
```

## Validation

The validation system ensures data integrity before processing payments or transactions.

### `validator.ts`

The validation utility provides rules-based validation for different types of data:
- Payment amounts
- UPI IDs
- Generic validation rules

```typescript
// Validate a payment amount
const validation = validatePaymentAmount(amount);
if (!validation.isValid) {
  setError(validation.message);
  return;
}

// Validate withdrawal data
const isValid = validateWithdrawalData(
  { amount, upiId },
  currentBalance
);
if (!isValid) {
  return; // Validation failed
}
```

## Logging

The logging system provides consistent logging across the application.

### `logger.ts`

The logger utility provides:
- Multiple log levels (DEBUG, INFO, WARN, ERROR)
- Configurable minimum log level
- Timestamp inclusion
- Remote logging capability for production
- Component-specific loggers

```typescript
// Basic usage
import { logger, createLogger } from '../utils/logger';

// Global logger
logger.info('User logged in', { userId: 'user123' });
logger.error('Payment failed', { orderId: '123', amount: 500 });

// Component-specific logger (recommended approach)
const paymentLogger = createLogger('PaymentService');
paymentLogger.info('Processing payment', { orderId: '123' });
```

Special utility methods:
```typescript
// Log application startup
logger.logStartup();

// Log API requests
logger.logApiRequest('GET', '/api/users', 200, 150);

// Log user actions
logger.logUserAction('user123', 'game_started', { gameId: 'game456' });

// Log payment events
logger.logPayment('user123', 1000, 'successful', { paymentId: 'pay789' });
```

### Logger Migration Scripts

To help migrate from the old logging format to the new component-specific loggers, we've created these utilities:

#### `update-loggers.sh`

A shell script to automatically update all logger calls across the project:

```bash
# Run the script to update all files with logger calls
./update-loggers.sh
```

This script:
1. Finds all files with logger calls
2. Creates a Node.js script to process each file
3. Updates import statements to include `createLogger`
4. Adds component-specific logger instances
5. Updates all logger calls to use the component-specific logger
6. Prompts for confirmation before making changes

#### `src/utils/updateSingleFileLogger.ts`

A TypeScript utility for manually updating a single file:

```typescript
import { updateLoggerCalls } from '../utils/updateSingleFileLogger';

// Example: manually update a file content
const fileContent = '...';
const updatedContent = updateLoggerCalls(fileContent, 'ComponentName');
```

This utility can be used in a browser environment or in tests.

## Testing Utilities

Testing utilities to help with development and testing.

### `testUtils.ts`

The test utility provides:
- Network delay simulation
- Error simulation
- Mock transaction generation
- Safe execution in development mode

```typescript
// Simulate network delay
await delay(1000); // Wait 1 second

// Simulate network errors
await simulateNetworkError(0.2); // 20% chance of error

// Generate mock transactions
const mockTransactions = generateMockTransactionHistory(10);

// Execute code only in development mode
executeInDevMode(() => {
  console.log('This only runs in development');
});
```

## Integration in Components

These utilities are integrated in components such as:

- `DepositForm.tsx` - Uses validation for payment amounts
- `WithdrawalForm.tsx` - Uses validation for UPI IDs and withdrawal amounts
- `transactionService.ts` - Uses error handling for API requests

## Best Practices

When using these utilities:

1. Always use the appropriate error handler for the context
2. Validate user input before making API calls
3. Add meaningful context to error handlers
4. Create component-specific loggers for better log organization
5. Use withErrorHandling for repetitive try/catch blocks

## Future Improvements

Planned improvements to these utilities:

1. Add more specialized validators for different data types
2. Integrate with a remote logging service
3. Create a performance monitoring utility
4. Add automatic retry logic for transient errors
5. Implement more comprehensive testing utilities 
/**
 * Test utilities for simulating different transaction scenarios
 * IMPORTANT: This file should only be used for testing and development
 */

import { Transaction, TransactionStatus, TransactionType } from 'chessTypes';

/**
 * Simulates a network delay
 * @param ms Delay in milliseconds
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Simulates a network error
 * @param probability Probability of error (0-1)
 */
export const simulateNetworkError = async (probability = 0.2): Promise<void> => {
  if (Math.random() < probability) {
    throw new Error('Network error: Failed to connect to server');
  }
};

/**
 * Simulates a payment gateway error
 * @param probability Probability of error (0-1)
 */
export const simulatePaymentGatewayError = async (probability = 0.2): Promise<void> => {
  if (Math.random() < probability) {
    const errors = [
      'Payment gateway timeout',
      'Payment declined by bank',
      'Insufficient funds',
      'Payment gateway unavailable',
      'Invalid payment details'
    ];
    const errorMessage = errors[Math.floor(Math.random() * errors.length)];
    throw new Error(`Payment error: ${errorMessage}`);
  }
};

/**
 * Generates a mock transaction for testing
 * @param type Transaction type
 * @param status Transaction status
 * @param userId User ID
 */
export const generateMockTransaction = (
  type: TransactionType = 'deposit',
  status: TransactionStatus = 'completed',
  userId: string = 'test-user-id'
): Transaction => {
  return {
    id: `mock-transaction-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    userId,
    type,
    amount: Math.floor(Math.random() * 500) + 100, // Random amount between 100-600
    status,
    timestamp: new Date(),
    notes: `Mock ${type} transaction for testing`,
    relatedGameId: type.includes('wager') ? `mock-game-${Math.random().toString(36).substring(2, 9)}` : undefined
  };
};

/**
 * Generates a batch of mock transactions for testing
 * @param count Number of transactions to generate
 * @param userId User ID
 */
export const generateMockTransactionHistory = (count: number, userId: string): Transaction[] => {
  const transactions: Transaction[] = [];
  const types: TransactionType[] = [
    'deposit', 
    'withdrawal_request', 
    'wager_debit', 
    'wager_payout', 
    'wager_refund'
  ];
  const statuses: TransactionStatus[] = ['completed', 'pending', 'failed'];
  
  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    // Create transaction with timestamp going backward in time
    const timestamp = new Date();
    timestamp.setDate(timestamp.getDate() - i); // Each transaction is one day older
    
    const transaction = generateMockTransaction(type, status, userId);
    transaction.timestamp = timestamp;
    
    transactions.push(transaction);
  }
  
  return transactions;
};

/**
 * Simulates a successful payment flow
 * @param amount Payment amount
 */
export const simulateSuccessfulPayment = async (amount: number): Promise<{
  success: boolean;
  orderId: string;
  paymentId: string;
}> => {
  await delay(1500); // Simulate network delay
  return {
    success: true,
    orderId: `order_${Date.now()}${Math.random().toString(36).substring(2, 9)}`,
    paymentId: `pay_${Date.now()}${Math.random().toString(36).substring(2, 9)}`
  };
};

/**
 * Execute in development mode only (to prevent accidental execution in production)
 * @param callback Function to execute
 */
export const executeInDevMode = (callback: () => void): void => {
  if (process.env.NODE_ENV === 'development') {
    callback();
  } else {
    console.warn('Test utilities are only available in development mode');
  }
}; 
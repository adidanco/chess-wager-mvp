/**
 * Validation utility for transaction and payment data
 */

import { toast } from 'react-hot-toast';

/**
 * Types of validation available
 */
export enum ValidationType {
  REQUIRED = 'required',
  NUMBER = 'number',
  POSITIVE = 'positive',
  MIN_VALUE = 'minValue',
  MAX_VALUE = 'maxValue',
  STRING = 'string',
  EMAIL = 'email',
  UPI = 'upi',
  PHONE = 'phone'
}

/**
 * Validation rule interface
 */
export interface ValidationRule {
  type: ValidationType;
  message: string;
  param?: any; // For validation types that require parameters (min, max, etc.)
}

/**
 * Validates a field against a set of rules
 * @param value The value to validate
 * @param rules Array of validation rules to check
 * @param fieldName Name of the field (for error messages)
 * @returns Object containing validation result and error message
 */
export const validateField = (
  value: any, 
  rules: ValidationRule[],
  fieldName: string
): { isValid: boolean, message: string } => {
  for (const rule of rules) {
    switch (rule.type) {
      case ValidationType.REQUIRED:
        if (value === undefined || value === null || value === '') {
          return { isValid: false, message: rule.message || `${fieldName} is required` };
        }
        break;
        
      case ValidationType.NUMBER:
        if (isNaN(Number(value))) {
          return { isValid: false, message: rule.message || `${fieldName} must be a number` };
        }
        break;
        
      case ValidationType.POSITIVE:
        if (Number(value) <= 0) {
          return { isValid: false, message: rule.message || `${fieldName} must be positive` };
        }
        break;
        
      case ValidationType.MIN_VALUE:
        if (Number(value) < rule.param) {
          return { isValid: false, message: rule.message || `${fieldName} must be at least ${rule.param}` };
        }
        break;
        
      case ValidationType.MAX_VALUE:
        if (Number(value) > rule.param) {
          return { isValid: false, message: rule.message || `${fieldName} must not exceed ${rule.param}` };
        }
        break;
        
      case ValidationType.STRING:
        if (typeof value !== 'string') {
          return { isValid: false, message: rule.message || `${fieldName} must be text` };
        }
        break;
        
      case ValidationType.EMAIL:
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return { isValid: false, message: rule.message || `${fieldName} must be a valid email` };
        }
        break;
        
      case ValidationType.UPI:
        const upiRegex = /^[\w.-]+@[\w.-]+$/;
        if (!upiRegex.test(value)) {
          return { isValid: false, message: rule.message || `${fieldName} must be a valid UPI ID` };
        }
        break;
        
      case ValidationType.PHONE:
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(value)) {
          return { isValid: false, message: rule.message || `${fieldName} must be a valid 10-digit phone number` };
        }
        break;
    }
  }
  
  return { isValid: true, message: '' };
};

/**
 * Validates a payment amount
 * @param amount Payment amount to validate
 * @param minAmount Minimum allowed amount
 * @param maxAmount Maximum allowed amount
 * @returns Validation result
 */
export const validatePaymentAmount = (
  amount: number, 
  minAmount: number = 100,
  maxAmount: number = 50000
): { isValid: boolean, message: string } => {
  const validationRules: ValidationRule[] = [
    { type: ValidationType.REQUIRED, message: 'Amount is required' },
    { type: ValidationType.NUMBER, message: 'Amount must be a number' },
    { type: ValidationType.POSITIVE, message: 'Amount must be greater than zero' },
    { type: ValidationType.MIN_VALUE, message: `Minimum amount is ₹${minAmount}`, param: minAmount },
    { type: ValidationType.MAX_VALUE, message: `Maximum amount is ₹${maxAmount}`, param: maxAmount }
  ];
  
  return validateField(amount, validationRules, 'Amount');
};

/**
 * Validates a UPI ID
 * @param upiId UPI ID to validate
 * @returns Validation result
 */
export const validateUpiId = (upiId: string): { isValid: boolean, message: string } => {
  const validationRules: ValidationRule[] = [
    { type: ValidationType.REQUIRED, message: 'UPI ID is required' },
    { type: ValidationType.UPI, message: 'Please enter a valid UPI ID (e.g., name@bank)' }
  ];
  
  return validateField(upiId, validationRules, 'UPI ID');
};

/**
 * Validates payment data before submitting
 * @param data Payment data to validate
 * @returns True if valid, false if invalid
 */
export const validatePaymentData = (data: {
  amount: number;
  [key: string]: any;
}): boolean => {
  const amountValidation = validatePaymentAmount(data.amount);
  
  if (!amountValidation.isValid) {
    toast.error(amountValidation.message);
    return false;
  }
  
  return true;
};

/**
 * Validates withdrawal data before submitting
 * @param data Withdrawal data to validate
 * @param currentBalance User's current balance
 * @returns True if valid, false if invalid
 */
export const validateWithdrawalData = (
  data: { amount: number; upiId: string },
  currentBalance: number
): boolean => {
  const amountValidation = validatePaymentAmount(data.amount);
  if (!amountValidation.isValid) {
    toast.error(amountValidation.message);
    return false;
  }
  
  if (data.amount > currentBalance) {
    const message = `Insufficient balance. Your current balance is ₹${currentBalance}`;
    toast.error(message);
    return false;
  }
  
  const upiValidation = validateUpiId(data.upiId);
  if (!upiValidation.isValid) {
    toast.error(upiValidation.message);
    return false;
  }
  
  return true;
}; 
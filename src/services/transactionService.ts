import { httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import { Transaction, TransactionType, TransactionStatus } from 'chessTypes';
import { toast } from "react-hot-toast";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  serverTimestamp, 
  addDoc,
  doc,
  updateDoc,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db, functions } from '../firebase';
import { 
  handleError, 
  handlePaymentError, 
  handleTransactionError, 
  ErrorCategory 
} from '../utils/errorHandler';
import { v4 as uuidv4 } from 'uuid';

// Firebase instances
const auth = getAuth();

/**
 * Create a Razorpay order for deposit
 */
export const createOrder = async (amount: number): Promise<any> => {
  try {
    const idempotencyKey = uuidv4();
    const createRazorpayOrder = httpsCallable(functions, 'createRazorpayOrder');
    const result = await createRazorpayOrder({ 
      amount,
      idempotencyKey
    });
    return result.data;
  } catch (error: any) {
    handlePaymentError(error, { amount, operation: 'createOrder' });
    throw error; // Re-throw to allow component-level handling
  }
};

/**
 * Verify Razorpay payment and update user balance
 */
export const verifyPayment = async (paymentData: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<any> => {
  try {
    const idempotencyKey = uuidv4();
    const verifyRazorpayPayment = httpsCallable(functions, 'verifyRazorpayPayment');
    const result = await verifyRazorpayPayment({
      ...paymentData,
      idempotencyKey
    });
    return result.data;
  } catch (error: any) {
    handlePaymentError(error, { 
      paymentId: paymentData.razorpay_payment_id,
      orderId: paymentData.razorpay_order_id,
      operation: 'verifyPayment' 
    });
    throw error; // Re-throw to allow component-level handling
  }
};

/**
 * Process a deposit transaction
 */
export const confirmDeposit = async (amount: number, upiTransactionId?: string): Promise<{ success: boolean, transactionId?: string }> => {
  try {
    if (!auth.currentUser) {
      throw new Error('User must be logged in to make a deposit');
    }

    // In a production environment, you might want to call a cloud function for this
    // For the MVP, we'll directly create the transaction in Firestore
    const userId = auth.currentUser.uid;
    const idempotencyKey = uuidv4();
    
    // Create a deposit transaction
    const transactionRef = collection(db, 'transactions');
    const newTransaction = await addDoc(transactionRef, {
      userId,
      type: 'deposit' as TransactionType,
      amount,
      status: 'completed' as TransactionStatus,
      timestamp: serverTimestamp(),
      upiTransactionId,
      idempotencyKey,
      notes: `Deposit of ₹${amount} via UPI${upiTransactionId ? ` (ID: ${upiTransactionId})` : ''}`
    });

    // Update user's balance in a secure way
    // In production, this should be done with a cloud function
    const depositFunction = httpsCallable(functions, 'processDeposit');
    await depositFunction({ 
      amount, 
      transactionId: newTransaction.id,
      idempotencyKey
    });

    return { 
      success: true,
      transactionId: newTransaction.id
    };
  } catch (error: any) {
    console.error('Error confirming deposit:', error);
    throw error;
  }
};

/**
 * Request a withdrawal 
 */
export const requestWithdrawal = async (amount: number, upiId: string): Promise<any> => {
  try {
    const idempotencyKey = uuidv4();
    const requestWithdrawalFn = httpsCallable(functions, 'requestWithdrawal');
    const result = await requestWithdrawalFn({ 
      amount, 
      upiId,
      idempotencyKey 
    });
    return result.data;
  } catch (error: any) {
    handleTransactionError(error, {
      amount,
      upiId,
      operation: 'requestWithdrawal'
    });
    throw error;
  }
};

/**
 * Debit wagers from both players
 */
export const debitWagersForGame = async (
  gameId: string, 
  player1Id: string, 
  player2Id: string, 
  wagerAmount: number
): Promise<{ success: boolean }> => {
  try {
    const idempotencyKey = uuidv4();
    const debitWagersFn = httpsCallable(functions, 'debitWagersForGame');
    const result = await debitWagersFn({ 
      gameId, 
      player1Id, 
      player2Id, 
      wagerAmount,
      idempotencyKey
    });
    return result.data as { success: boolean };
  } catch (error: any) {
    console.error('Error debiting wagers:', error);
    throw error;
  }
};

/**
 * Process game payout
 */
export const processGamePayout = async (
  gameId: string,
  winnerId: string | null,
  loserId: string | null,
  isDraw: boolean,
  wagerAmount: number
): Promise<{ success: boolean }> => {
  try {
    const idempotencyKey = uuidv4();
    const processPayoutFn = httpsCallable(functions, 'processGamePayout');
    const result = await processPayoutFn({
      gameId,
      winnerId,
      loserId,
      isDraw,
      wagerAmount,
      idempotencyKey
    });
    return result.data as { success: boolean };
  } catch (error: any) {
    console.error('Error processing payout:', error);
    throw error;
  }
};

/**
 * Fetch user transactions
 */
export const getTransactionHistory = async (userId: string): Promise<Transaction[]> => {
  try {
    const transactionsRef = collection(db, 'transactions');
    const q = query(
      transactionsRef,
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const transactions: Transaction[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data() as Omit<Transaction, 'id'>;
      transactions.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : data.timestamp
      });
    });
    
    return transactions;
  } catch (error: any) {
    handleError(error, "Failed to load transaction history", {
      category: ErrorCategory.DATABASE,
      context: { userId, operation: 'getTransactionHistory' }
    });
    throw error;
  }
};

/**
 * Fetch all transactions (admin only)
 */
export const getAllTransactions = async (limitCount: number = 100): Promise<Transaction[]> => {
  try {
    const transactionsRef = collection(db, 'transactions');
    const q = query(
      transactionsRef,
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const transactions: Transaction[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data() as Omit<Transaction, 'id'>;
      transactions.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : data.timestamp
      });
    });
    
    return transactions;
  } catch (error) {
    console.error('Error fetching all transactions:', error);
    throw error;
  }
};

/**
 * Fetch pending withdrawal requests (admin only)
 */
export const getPendingWithdrawals = async (): Promise<Transaction[]> => {
  try {
    const transactionsRef = collection(db, 'transactions');
    const q = query(
      transactionsRef,
      where('type', '==', 'withdrawal_request'),
      where('status', '==', 'pending'),
      orderBy('timestamp', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const withdrawals: Transaction[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data() as Omit<Transaction, 'id'>;
      withdrawals.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : data.timestamp
      });
    });
    
    return withdrawals;
  } catch (error) {
    console.error('Error fetching pending withdrawals:', error);
    throw error;
  }
};

/**
 * Process a withdrawal (admin only)
 */
export const processWithdrawal = async (
  transactionId: string, 
  status: 'completed' | 'cancelled',
  adminNotes: string
): Promise<boolean> => {
  try {
    // This should be secured by Firebase security rules to only allow admins
    const processWithdrawalFunction = httpsCallable(functions, 'processWithdrawal');
    const result = await processWithdrawalFunction({ 
      transactionId,
      status,
      adminNotes
    });
    
    return (result.data as { success: boolean }).success;
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    throw error;
  }
}; 
import { getFunctions, httpsCallable } from 'firebase/functions';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  addDoc, 
  updateDoc,
  doc,
  serverTimestamp,
  limit,
  Timestamp
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Transaction, TransactionType, TransactionStatus } from 'chessTypes';

// Firebase instances
const db = getFirestore();
const functions = getFunctions();
const auth = getAuth();

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
    
    // Create a deposit transaction
    const transactionRef = collection(db, 'transactions');
    const newTransaction = await addDoc(transactionRef, {
      userId,
      type: 'deposit' as TransactionType,
      amount,
      status: 'completed' as TransactionStatus,
      timestamp: serverTimestamp(),
      upiTransactionId,
      notes: `Deposit of ₹${amount} via UPI${upiTransactionId ? ` (ID: ${upiTransactionId})` : ''}`
    });

    // Update user's balance in a secure way
    // In production, this should be done with a cloud function
    const depositFunction = httpsCallable(functions, 'processDeposit');
    await depositFunction({ 
      amount, 
      transactionId: newTransaction.id 
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
export const requestWithdrawal = async (amount: number, upiId: string): Promise<{ success: boolean, transactionId?: string }> => {
  try {
    if (!auth.currentUser) {
      throw new Error('User must be logged in to request a withdrawal');
    }
    
    const userId = auth.currentUser.uid;
    const userEmail = auth.currentUser.email;
    const displayName = auth.currentUser.displayName;
    
    // Create a withdrawal request transaction
    const transactionRef = collection(db, 'transactions');
    const newTransaction = await addDoc(transactionRef, {
      userId,
      type: 'withdrawal_request' as TransactionType,
      amount,
      status: 'pending' as TransactionStatus,
      timestamp: serverTimestamp(),
      withdrawalDetails: {
        upiId,
        username: displayName || userId,
        email: userEmail
      },
      notes: `Withdrawal request of ₹${amount} to UPI ID: ${upiId}`
    });

    // Update user's pending withdrawal amount
    // In production, this should be done with a cloud function to ensure consistency
    const withdrawalFunction = httpsCallable(functions, 'requestWithdrawal');
    await withdrawalFunction({ 
      amount, 
      transactionId: newTransaction.id,
      upiId
    });

    return { 
      success: true,
      transactionId: newTransaction.id
    };
  } catch (error: any) {
    console.error('Error requesting withdrawal:', error);
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
    const debitWagersFn = httpsCallable(functions, 'debitWagersForGame');
    const result = await debitWagersFn({ 
      gameId, 
      player1Id, 
      player2Id, 
      wagerAmount 
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
    const processPayoutFn = httpsCallable(functions, 'processGamePayout');
    const result = await processPayoutFn({
      gameId,
      winnerId,
      loserId,
      isDraw,
      wagerAmount
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
export const getUserTransactions = async (userId: string): Promise<Transaction[]> => {
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
  } catch (error) {
    console.error('Error fetching transactions:', error);
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
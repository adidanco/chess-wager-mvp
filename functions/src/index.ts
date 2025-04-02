/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// @ts-nocheck - Disable TypeScript checking for this file as Firebase Functions types are not properly matched
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();
const region = "asia-south1"; // Mumbai region for India-based operations

// Define interfaces for the function data
interface DepositData {
  amount: number;
  transactionId: string;
}

interface GameWagerData {
  gameId: string;
  player1Id: string;
  player2Id: string;
  wagerAmount: number;
}

interface GamePayoutData {
  gameId: string;
  winnerId: string | null;
  loserId: string | null;
  isDraw: boolean;
  wagerAmount: number;
}

interface WithdrawalRequestData {
  amount: number;
  upiId: string;
}

interface WithdrawalProcessData {
  transactionId: string;
  status: 'completed' | 'cancelled';
  adminNotes: string;
}

/**
 * Function to confirm a deposit after a user has made a UPI payment
 * In a real production app, this would be triggered by a webhook from payment gateway
 * For now, it's triggered manually by the user after they make a payment
 */
export const confirmDeposit = functions.https.onCall((data, context) => {
  // Check authentication
  if (!context?.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User is not authenticated"
    );
  }

  const userId = context.auth.uid;
  const { amount, transactionId } = data as DepositData;
  
  if (typeof amount !== 'number' || amount <= 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid amount provided"
    );
  }

  const userRef = db.collection("users").doc(userId);
  const transactionsRef = db.collection("transactions");

  return db.runTransaction(async (transaction) => {
    // 1. Increment user's real money balance
    transaction.update(userRef, {
      realMoneyBalance: admin.firestore.FieldValue.increment(amount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 2. Log the transaction
    transaction.set(transactionsRef.doc(), {
      userId: userId,
      type: 'deposit',
      amount: amount,
      status: 'completed',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      upiTransactionId: transactionId || null,
      notes: "User confirmed deposit (simulated auto-approval)."
    });

    functions.logger.info(`Deposit confirmed for user ${userId}, amount ${amount}`);
    return { success: true };
  }).catch(error => {
    functions.logger.error(`Failed to confirm deposit for user ${userId}`, error);
    throw new functions.https.HttpsError(
      "internal",
      "Failed to process deposit"
    );
  });
});

/**
 * Function to debit wagers from both players when a game starts
 */
export const debitWagersForGame = functions.https.onCall((data, context) => {
  // Check authentication
  if (!context?.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User is not authenticated"
    );
  }

  const userId = context.auth.uid;
  const { gameId, player1Id, player2Id, wagerAmount } = data as GameWagerData;

  if (userId !== player1Id && userId !== player2Id) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "User cannot initiate wager debit for this game"
    );
  }
  
  if (typeof wagerAmount !== 'number' || wagerAmount <= 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid wager amount"
    );
  }

  const player1Ref = db.collection("users").doc(player1Id);
  const player2Ref = db.collection("users").doc(player2Id);
  const gameRef = db.collection("games").doc(gameId);
  const transactionsRef = db.collection("transactions");

  return db.runTransaction(async (t) => {
    const p1Doc = await t.get(player1Ref);
    const p2Doc = await t.get(player2Ref);

    if (!p1Doc.exists || !p2Doc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "One or both players not found"
      );
    }

    const p1Data = p1Doc.data();
    const p2Data = p2Doc.data();
    
    if (!p1Data || !p2Data) {
      throw new functions.https.HttpsError(
        "not-found",
        "Player data is missing"
      );
    }

    const p1Balance = p1Data.realMoneyBalance || 0;
    const p2Balance = p2Data.realMoneyBalance || 0;

    if (p1Balance < wagerAmount) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Player 1 has insufficient balance for the wager"
      );
    }
    
    if (p2Balance < wagerAmount) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Player 2 has insufficient balance for the wager"
      );
    }

    // Debit Player 1
    t.update(player1Ref, { 
      realMoneyBalance: admin.firestore.FieldValue.increment(-wagerAmount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    t.set(transactionsRef.doc(), { 
      userId: player1Id,
      type: 'wager_debit',
      amount: wagerAmount,
      status: 'completed',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      relatedGameId: gameId,
      notes: `Wager debited for game ${gameId}`
    });

    // Debit Player 2
    t.update(player2Ref, { 
      realMoneyBalance: admin.firestore.FieldValue.increment(-wagerAmount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    t.set(transactionsRef.doc(), {
      userId: player2Id,
      type: 'wager_debit',
      amount: wagerAmount,
      status: 'completed',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      relatedGameId: gameId,
      notes: `Wager debited for game ${gameId}`
    });

    // Update Game state to track that wagers have been debited
    t.update(gameRef, { 
      wagersDebited: true,
      wagerDebitTimestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    functions.logger.info(`Wagers debited for game ${gameId}, amount ${wagerAmount}`);
    return { success: true };
  }).catch((error: any) => {
    functions.logger.error(`Failed to debit wagers for game ${gameId}`, error);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Failed to debit wagers"
    );
  });
});

/**
 * Function to process game payouts when a game ends
 */
export const processGamePayout = functions.https.onCall((data, context) => {
  // Check authentication
  if (!context?.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User is not authenticated"
    );
  }

  const userId = context.auth.uid;
  const { gameId, winnerId, loserId, isDraw, wagerAmount } = data as GamePayoutData;
  
  if (typeof wagerAmount !== 'number' || wagerAmount <= 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid wager amount for payout"
    );
  }

  const winnerRef = winnerId ? db.collection("users").doc(winnerId) : null;
  const loserRef = loserId ? db.collection("users").doc(loserId) : null;
  const gameRef = db.collection("games").doc(gameId);
  const transactionsRef = db.collection("transactions");

  // First verify the game exists and has wagersDebited set to true
  return gameRef.get().then(gameDoc => {
    if (!gameDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Game not found"
      );
    }
    
    const gameData = gameDoc.data();
    if (!gameData?.wagersDebited) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Cannot process payout for game without debited wagers"
      );
    }
    
    if (gameData?.payoutProcessed) {
      throw new functions.https.HttpsError(
        "already-exists",
        "Payout has already been processed for this game"
      );
    }

    return db.runTransaction(async (t) => {
      // Handle draw (return wagers to both players)
      if (isDraw && winnerRef && loserRef) {
        // Return wager to player 1
        t.update(winnerRef, {
          realMoneyBalance: admin.firestore.FieldValue.increment(wagerAmount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        t.set(transactionsRef.doc(), {
          userId: winnerId,
          type: 'wager_refund',
          amount: wagerAmount, 
          status: 'completed',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          relatedGameId: gameId,
          notes: `Wager refunded due to draw in game ${gameId}`
        });
        
        // Return wager to player 2
        t.update(loserRef, {
          realMoneyBalance: admin.firestore.FieldValue.increment(wagerAmount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        t.set(transactionsRef.doc(), {
          userId: loserId,
          type: 'wager_refund',
          amount: wagerAmount,
          status: 'completed',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          relatedGameId: gameId,
          notes: `Wager refunded due to draw in game ${gameId}`
        });
      } 
      // Winner takes all (one player wins)
      else if (winnerRef) {
        // Calculate total pool and platform fee
        const totalPool = wagerAmount * 2;
        const platformFee = Math.floor(totalPool * 0.05); // 5% platform fee
        const winnerPayout = totalPool - platformFee;
        
        // Credit winner with winnings after fee
        t.update(winnerRef, {
          realMoneyBalance: admin.firestore.FieldValue.increment(winnerPayout),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        t.set(transactionsRef.doc(), {
          userId: winnerId,
          type: 'wager_payout',
          amount: winnerPayout,
          status: 'completed',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          relatedGameId: gameId,
          platformFee: platformFee,
          notes: `Winnings from game ${gameId} (after 5% platform fee)`
        });
      }
      
      // Mark the game as having processed the payout
      t.update(gameRef, {
        payoutProcessed: true,
        payoutTimestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      functions.logger.info(`Game payout processed for game ${gameId}`);
      return { success: true };
    });
  }).catch((error: any) => {
    functions.logger.error(`Failed to process payout for game ${gameId}`, error);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Failed to process game payout"
    );
  });
});

/**
 * Function to request a withdrawal
 */
export const requestWithdrawal = functions.https.onCall((data, context) => {
  // Check authentication
  if (!context?.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User is not authenticated"
    );
  }

  const userId = context.auth.uid;
  const { amount, upiId } = data as WithdrawalRequestData;
  
  if (typeof amount !== 'number' || amount <= 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid withdrawal amount"
    );
  }
  
  if (!upiId || typeof upiId !== 'string') {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Valid UPI ID is required for withdrawal"
    );
  }

  const userRef = db.collection("users").doc(userId);
  const transactionsRef = db.collection("transactions");

  return db.runTransaction(async (t) => {
    const userDoc = await t.get(userRef);
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "User not found"
      );
    }
    
    const userData = userDoc.data();
    if (!userData) {
      throw new functions.https.HttpsError(
        "not-found",
        "User data is missing"
      );
    }
    
    const currentBalance = userData.realMoneyBalance || 0;
    
    // Check if user has an existing pending withdrawal
    if (userData.pendingWithdrawalAmount && userData.pendingWithdrawalAmount > 0) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "You already have a pending withdrawal request"
      );
    }
    
    // Verify sufficient balance
    if (currentBalance < amount) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Insufficient balance for withdrawal"
      );
    }
    
    // 1. Create transaction record for withdrawal request
    const transactionRef = transactionsRef.doc();
    t.set(transactionRef, {
      userId: userId,
      type: 'withdrawal_request',
      amount: amount,
      status: 'pending',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      withdrawalDetails: {
        upiId: upiId,
        requestedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      notes: `Withdrawal request of ₹${amount} to UPI ID: ${upiId}`
    });
    
    // 2. Update user document with pending withdrawal amount and deduct from balance
    t.update(userRef, {
      realMoneyBalance: admin.firestore.FieldValue.increment(-amount),
      pendingWithdrawalAmount: amount,
      withdrawalUpiId: upiId, // Save for future convenience
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    functions.logger.info(`Withdrawal request created for user ${userId}, amount ${amount}`);
    return { 
      success: true,
      message: "Withdrawal request submitted for processing. This may take up to 24 hours."
    };
  }).catch((error: any) => {
    functions.logger.error(`Failed to process withdrawal request for user ${userId}`, error);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Failed to request withdrawal"
    );
  });
});

/**
 * Function to process a withdrawal (admin only)
 */
export const processWithdrawal = functions.https.onCall((data, context) => {
  // Check authentication
  if (!context?.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Admin must be authenticated"
    );
  }

  const adminId = context.auth.uid;
  const { transactionId, status, adminNotes } = data as WithdrawalProcessData;
  
  if (!transactionId || typeof transactionId !== 'string') {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Valid transaction ID is required"
    );
  }
  
  if (status !== 'completed' && status !== 'cancelled') {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Status must be either 'completed' or 'cancelled'"
    );
  }

  // Verify admin status
  return db.collection("users").doc(adminId).get().then(adminDoc => {
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Admin user not found"
      );
    }
    
    const adminData = adminDoc.data();
    if (!adminData?.role || !['admin', 'super_admin'].includes(adminData.role)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only admin users can process withdrawals"
      );
    }

    const transactionRef = db.collection("transactions").doc(transactionId);
    
    return db.runTransaction(async (t) => {
      const transactionDoc = await t.get(transactionRef);
      if (!transactionDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "Transaction not found"
        );
      }
      
      const transactionData = transactionDoc.data();
      if (!transactionData) {
        throw new functions.https.HttpsError(
          "not-found",
          "Transaction data is missing"
        );
      }
      
      if (transactionData.type !== 'withdrawal_request') {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Transaction is not a withdrawal request"
        );
      }
      
      if (transactionData.status !== 'pending') {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Transaction is not pending"
        );
      }
      
      const userId = transactionData.userId;
      const amount = transactionData.amount;
      const userRef = db.collection("users").doc(userId);
      
      // Complete or cancel the withdrawal
      if (status === 'completed') {
        // 1. Update transaction status to completed
        t.update(transactionRef, {
          status: 'completed',
          processedBy: adminId,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          notes: `${transactionData.notes || ""} | Processed by admin: ${adminNotes}`
        });
        
        // 2. Update user to clear pending withdrawal
        t.update(userRef, {
          pendingWithdrawalAmount: 0,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else if (status === 'cancelled') {
        // 1. Update transaction status to cancelled
        t.update(transactionRef, {
          status: 'cancelled',
          processedBy: adminId,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          notes: `${transactionData.notes || ""} | Cancelled by admin: ${adminNotes}`
        });
        
        // 2. Return funds to user and clear pending withdrawal
        t.update(userRef, {
          realMoneyBalance: admin.firestore.FieldValue.increment(amount),
          pendingWithdrawalAmount: 0,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // 3. Create refund transaction
        t.set(db.collection("transactions").doc(), {
          userId: userId,
          type: 'withdrawal_cancelled',
          amount: amount,
          status: 'completed',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          relatedTransactionId: transactionId,
          notes: `Withdrawal request cancelled: ${adminNotes}`
        });
      }

      functions.logger.info(`Withdrawal ${status} for transaction ${transactionId}`);
      return { 
        success: true,
        message: `Withdrawal request has been ${status}.`
      };
    });
  }).catch((error: any) => {
    functions.logger.error(`Failed to process withdrawal ${transactionId}`, error);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Failed to process withdrawal"
    );
  });
});

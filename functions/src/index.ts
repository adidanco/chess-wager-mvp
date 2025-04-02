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
import Razorpay from 'razorpay';

admin.initializeApp();
const db = admin.firestore();
const region = "asia-south1"; // Mumbai region for India-based operations

// Initialize Razorpay with environment config
const getRazorpayInstance = () => {
  const keyId = functions.config().razorpay.key_id;
  const keySecret = functions.config().razorpay.key_secret;
  
  if (!keyId || !keySecret) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Razorpay API keys are not configured"
    );
  }
  
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
};

// Define interfaces for the function data
interface DepositData {
  amount: number;
  transactionId: string;
}

interface RazorpayOrderData {
  amount: number;
  currency: string;
}

interface GameWagerData {
  gameId: string;
  player1Id: string;
  player2Id: string;
  wagerAmount: number;
  idempotencyKey: string;
}

interface GamePayoutData {
  gameId: string;
  winnerId: string | null;
  loserId: string | null;
  isDraw: boolean;
  wagerAmount: number;
  idempotencyKey: string;
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
 * Function to create a Razorpay order for user deposit
 */
export const createRazorpayOrder = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context?.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User is not authenticated"
    );
  }

  const userId = context.auth.uid;
  const { amount, currency = "INR" } = data as RazorpayOrderData;
  
  if (typeof amount !== 'number' || amount < 100) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Amount must be at least ₹100"
    );
  }
  
  try {
    // Get Razorpay instance
    const razorpay = getRazorpayInstance();
    
    // Generate a receipt ID
    const receiptId = `dep_${userId}_${Date.now()}`;
    
    // Create order in Razorpay
    const orderOptions = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency,
      receipt: receiptId,
      notes: {
        userId: userId,
        purpose: "deposit"
      }
    };
    
    const order = await razorpay.orders.create(orderOptions);
    
    // Save order reference in Firestore
    await db.collection("transactions").doc().set({
      userId: userId,
      type: 'deposit_initiated',
      amount: amount,
      status: 'pending',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      paymentGateway: 'razorpay',
      razorpayOrderId: order.id,
      razorpayReceipt: receiptId,
      notes: `Deposit initiated via Razorpay for ₹${amount}`
    });
    
    functions.logger.info(`Razorpay order created for user ${userId}, amount ${amount}, orderId ${order.id}`);
    
    // Return order details to client
    return {
      success: true,
      orderId: order.id,
      amount: amount,
      currency: currency,
      receipt: receiptId
    };
  } catch (error) {
    functions.logger.error(`Failed to create Razorpay order for user ${userId}`, error);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Failed to create payment order"
    );
  }
});

/**
 * Function to verify Razorpay payment and update user balance
 */
export const verifyRazorpayPayment = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context?.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User is not authenticated"
    );
  }

  const userId = context.auth.uid;
  const { 
    razorpayPaymentId, 
    razorpayOrderId, 
    razorpaySignature 
  } = data;
  
  if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required Razorpay verification parameters"
    );
  }
  
  try {
    // Get Razorpay instance for verification
    const razorpay = getRazorpayInstance();
    
    // Find the transaction record
    const transactionsSnapshot = await db
      .collection("transactions")
      .where("razorpayOrderId", "==", razorpayOrderId)
      .where("userId", "==", userId)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    
    if (transactionsSnapshot.empty) {
      throw new functions.https.HttpsError(
        "not-found",
        "No pending transaction found with this order ID"
      );
    }
    
    const transactionDoc = transactionsSnapshot.docs[0];
    const transaction = transactionDoc.data();
    const amount = transaction.amount;
    
    // Verify the payment signature
    const generatedSignature = razorpay.utils.validateWebhookSignature(
      razorpayOrderId + "|" + razorpayPaymentId, 
      razorpaySignature, 
      functions.config().razorpay.key_secret
    );
    
    if (!generatedSignature) {
      // Mark transaction as failed due to invalid signature
      await transactionDoc.ref.update({
        status: 'failed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        notes: transaction.notes + " | Payment verification failed: Invalid signature"
      });
      
      throw new functions.https.HttpsError(
        "permission-denied",
        "Payment signature verification failed"
      );
    }
    
    // Signature is valid, update user balance and transaction status
    const userRef = db.collection("users").doc(userId);
    
    await db.runTransaction(async (t) => {
      // 1. Update transaction status to completed
      t.update(transactionDoc.ref, {
        status: 'completed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        razorpayPaymentId: razorpayPaymentId,
        notes: transaction.notes + " | Payment verified and completed"
      });
      
      // 2. Increment user's real money balance
      t.update(userRef, {
        realMoneyBalance: admin.firestore.FieldValue.increment(amount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    functions.logger.info(`Razorpay payment verified for user ${userId}, amount ${amount}, paymentId ${razorpayPaymentId}`);
    
    return {
      success: true,
      message: `Successfully added ₹${amount} to your balance`,
      amount: amount
    };
  } catch (error) {
    functions.logger.error(`Failed to verify Razorpay payment for user ${userId}`, error);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Failed to verify payment"
    );
  }
});

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
 * Function to debit wagers from both players at the start of a game
 */
export const debitWagersForGame = functions.https.onCall((data, context) => {
  // Check authentication
  if (!context?.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be logged in to process wagers"
    );
  }

  const { gameId, player1Id, player2Id, wagerAmount, idempotencyKey } = data as GameWagerData & { idempotencyKey: string };
  
  if (!gameId || !player1Id || !player2Id || typeof wagerAmount !== 'number' || wagerAmount <= 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid game wager data provided"
    );
  }

  // Validate that requesting user is one of the players
  const requestingUserId = context.auth.uid;
  if (requestingUserId !== player1Id && requestingUserId !== player2Id) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only participating players can initiate wagers"
    );
  }

  const player1Ref = db.collection("users").doc(player1Id);
  const player2Ref = db.collection("users").doc(player2Id);
  const transactionsRef = db.collection("transactions");
  
  // First check if this operation has already been processed (idempotency check)
  return transactionsRef
    .where("idempotencyKey", "==", idempotencyKey)
    .where("type", "==", "wager_debit")
    .where("relatedGameId", "==", gameId)
    .get()
    .then(snapshot => {
      // If we find matching transactions, this operation was already processed
      if (!snapshot.empty) {
        functions.logger.info(`Idempotent operation detected: ${idempotencyKey} for game ${gameId} already processed`);
        return { success: true, idempotent: true };
      }
      
      // If no matching transactions found, proceed with the transaction
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

        // Generate transaction ID for player 1 with idempotency key
        const transaction1Ref = transactionsRef.doc();
        
        // Debit Player 1
        t.update(player1Ref, { 
          realMoneyBalance: admin.firestore.FieldValue.increment(-wagerAmount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        t.set(transaction1Ref, { 
          userId: player1Id,
          type: 'wager_debit',
          amount: wagerAmount,
          status: 'completed',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          relatedGameId: gameId,
          idempotencyKey, // Store the idempotency key
          notes: `Wager debited for game ${gameId}`
        });

        // Generate transaction ID for player 2
        const transaction2Ref = transactionsRef.doc();
        
        // Debit Player 2
        t.update(player2Ref, { 
          realMoneyBalance: admin.firestore.FieldValue.increment(-wagerAmount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        t.set(transaction2Ref, {
          userId: player2Id,
          type: 'wager_debit',
          amount: wagerAmount,
          status: 'completed',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          relatedGameId: gameId,
          idempotencyKey, // Store the idempotency key
          notes: `Wager debited for game ${gameId}`
        });

        functions.logger.info(`Debited wager of ${wagerAmount} from players ${player1Id} and ${player2Id} for game ${gameId}`);
        
        return { success: true, idempotent: false };
      });
    })
    .catch(error => {
      functions.logger.error(`Error debiting wagers: ${error.message}`, { gameId, player1Id, player2Id });
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
      "User must be logged in to process payouts"
    );
  }

  const userId = context.auth.uid;
  const { gameId, winnerId, loserId, isDraw, wagerAmount, idempotencyKey } = data as GamePayoutData & { idempotencyKey: string };
  
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

  // First check if this operation has already been processed using idempotency key
  return transactionsRef
    .where("idempotencyKey", "==", idempotencyKey)
    .where("type", "in", ["wager_payout", "wager_refund"])
    .where("relatedGameId", "==", gameId)
    .get()
    .then(snapshot => {
      // If we find matching transactions, this operation was already processed
      if (!snapshot.empty) {
        functions.logger.info(`Idempotent operation detected: ${idempotencyKey} for game ${gameId} already processed`);
        return { success: true, idempotent: true };
      }

      // Verify the game exists and has wagersDebited set to true
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
              idempotencyKey,
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
              idempotencyKey,
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
              idempotencyKey,
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
          return { success: true, idempotent: false };
        });
      });
    })
    .catch((error: any) => {
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

/**
 * Function to handle Razorpay webhook events
 * This endpoint will receive notifications about payment status changes
 */
export const handleRazorpayWebhook = functions.https.onRequest(async (req, res) => {
  try {
    // Verify that the request is from Razorpay by validating the signature
    const razorpaySignature = req.headers['x-razorpay-signature'];
    
    if (!razorpaySignature) {
      functions.logger.error("Webhook call missing Razorpay signature");
      return res.status(400).send({ error: "Missing signature header" });
    }
    
    // Get the webhook secret from environment config
    const webhookSecret = functions.config().razorpay.webhook_secret;
    
    if (!webhookSecret) {
      functions.logger.error("Razorpay webhook secret not configured");
      return res.status(500).send({ error: "Webhook verification not configured" });
    }
    
    // Get Razorpay instance
    const razorpay = getRazorpayInstance();
    
    // Verify webhook signature
    try {
      razorpay.utils.validateWebhookSignature(
        JSON.stringify(req.body),
        razorpaySignature,
        webhookSecret
      );
    } catch (error) {
      functions.logger.error("Invalid webhook signature", error);
      return res.status(400).send({ error: "Invalid signature" });
    }
    
    // Process the webhook event based on its type
    const event = req.body;
    const eventType = event.event;
    
    functions.logger.info(`Received Razorpay webhook: ${eventType}`, { payload: event });
    
    // Handle different event types
    switch (eventType) {
      case 'payment.authorized':
        await handlePaymentAuthorized(event.payload.payment.entity);
        break;
        
      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment.entity);
        break;
        
      // Add more event handlers as needed for different webhook events
      
      default:
        functions.logger.info(`Unhandled Razorpay webhook event type: ${eventType}`);
    }
    
    // Return success response to Razorpay
    return res.status(200).send({ status: "success" });
  } catch (error) {
    functions.logger.error("Error processing Razorpay webhook", error);
    return res.status(500).send({ error: "Internal server error" });
  }
});

/**
 * Helper function to handle successful payment authorization
 */
async function handlePaymentAuthorized(payment: any) {
  try {
    const orderId = payment.order_id;
    const paymentId = payment.id;
    const amount = payment.amount / 100; // Convert from paise to rupees
    
    // Find the transaction by order ID
    const transactionsSnapshot = await db
      .collection("transactions")
      .where("razorpayOrderId", "==", orderId)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    
    if (transactionsSnapshot.empty) {
      functions.logger.error(`No pending transaction found for order ${orderId}`);
      return;
    }
    
    const transactionDoc = transactionsSnapshot.docs[0];
    const transaction = transactionDoc.data();
    const userId = transaction.userId;
    
    // Update transaction status and user balance
    const userRef = db.collection("users").doc(userId);
    
    await db.runTransaction(async (t) => {
      // Check if this transaction was already processed (idempotency)
      const currentTxn = await t.get(transactionDoc.ref);
      if (currentTxn.data()?.status === "completed") {
        functions.logger.info(`Transaction ${transactionDoc.id} already processed`);
        return;
      }
      
      // 1. Update transaction status to completed
      t.update(transactionDoc.ref, {
        status: 'completed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        razorpayPaymentId: paymentId,
        webhookProcessed: true,
        notes: transaction.notes + " | Payment authorized via webhook"
      });
      
      // 2. Increment user's real money balance
      t.update(userRef, {
        realMoneyBalance: admin.firestore.FieldValue.increment(amount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    functions.logger.info(`Payment authorized for user ${userId}, amount ${amount}, order ${orderId}`);
  } catch (error) {
    functions.logger.error("Error handling payment.authorized webhook", error);
  }
}

/**
 * Helper function to handle failed payments
 */
async function handlePaymentFailed(payment: any) {
  try {
    const orderId = payment.order_id;
    const paymentId = payment.id;
    const errorDetails = payment.error_description || "Payment failed";
    
    // Find the transaction by order ID
    const transactionsSnapshot = await db
      .collection("transactions")
      .where("razorpayOrderId", "==", orderId)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    
    if (transactionsSnapshot.empty) {
      functions.logger.error(`No pending transaction found for order ${orderId}`);
      return;
    }
    
    const transactionDoc = transactionsSnapshot.docs[0];
    
    // Update transaction status to failed
    await transactionDoc.ref.update({
      status: 'failed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      razorpayPaymentId: paymentId,
      webhookProcessed: true,
      failureReason: errorDetails,
      notes: transactionDoc.data().notes + ` | Payment failed: ${errorDetails}`
    });
    
    functions.logger.info(`Payment failed for order ${orderId}: ${errorDetails}`);
  } catch (error) {
    functions.logger.error("Error handling payment.failed webhook", error);
  }
}

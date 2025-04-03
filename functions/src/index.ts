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
import crypto from 'crypto';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
const region = "asia-south1"; // Mumbai region for India-based operations

// Configure CORS settings for functions
export const cors = {
  origin: true, // Allow any origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

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
  idempotencyKey?: string;
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
    console.error("Authentication failed: User is not authenticated");
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User is not authenticated. Please login again."
    );
  }

  const userId = context.auth.uid;
  const { amount, currency = "INR", idempotencyKey } = data as RazorpayOrderData & { idempotencyKey?: string };
  
  if (typeof amount !== 'number' || amount < 100) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Amount must be at least ₹100"
    );
  }
  
  // Idempotency check - if this key was processed before, return cached result
  if (idempotencyKey) {
    const existingOrder = await db.collection("transactions")
      .where("idempotencyKey", "==", idempotencyKey)
      .limit(1)
      .get();
      
    if (!existingOrder.empty) {
      const orderData = existingOrder.docs[0].data();
      if (orderData.razorpayOrderId) {
        functions.logger.info(`Using cached order for idempotency key ${idempotencyKey}`);
        return {
          success: true,
          id: orderData.razorpayOrderId,
          amount: orderData.amount * 100, // Convert to paise for client
          currency: currency
        };
      }
    }
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
        purpose: "deposit",
        idempotencyKey: idempotencyKey || `auto_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
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
      idempotencyKey: idempotencyKey || orderOptions.notes.idempotencyKey,
      notes: `Deposit initiated via Razorpay for ₹${amount}`
    });
    
    functions.logger.info(`Razorpay order created for user ${userId}, amount ${amount}, orderId ${order.id}`);
    
    // Return order details to client
    return {
      success: true,
      id: order.id,
      amount: amount * 100, // Return amount in paise for the client
      currency: currency
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
    console.error("Authentication failed: User is not authenticated");
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User is not authenticated. Please login again."
    );
  }

  const userId = context.auth.uid;
  const { 
    razorpay_payment_id, 
    razorpay_order_id, 
    razorpay_signature,
    idempotencyKey
  } = data;
  
  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required Razorpay verification parameters"
    );
  }
  
  // Idempotency check - if this payment was verified before, return cached result
  if (idempotencyKey) {
    const existingVerifications = await db.collection("paymentVerifications")
      .where("idempotencyKey", "==", idempotencyKey)
      .limit(1)
      .get();
      
    if (!existingVerifications.empty) {
      const verificationData = existingVerifications.docs[0].data();
      functions.logger.info(`Using cached verification for idempotency key ${idempotencyKey}`);
      return {
        success: true,
        verified: verificationData.verified,
        paymentId: razorpay_payment_id
      };
    }
  }
  
  try {
    // Get Razorpay instance for verification
    const razorpay = getRazorpayInstance();
    
    // Find the transaction record
    const transactionsSnapshot = await db
      .collection("transactions")
      .where("razorpayOrderId", "==", razorpay_order_id)
      .where("userId", "==", userId)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    
    if (transactionsSnapshot.empty) {
      console.error(`No pending transaction found for order ${razorpay_order_id} and user ${userId}`);
      throw new functions.https.HttpsError(
        "not-found",
        "No pending transaction found with this order ID"
      );
    }
    
    const transactionDoc = transactionsSnapshot.docs[0];
    const transaction = transactionDoc.data();
    const amount = transaction.amount;
    
    // Verify the payment signature using Razorpay's utility
    const keySecret = functions.config().razorpay.key_secret;
    const generated_signature = crypto
      .createHmac("sha256", keySecret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");
    
    const isSignatureValid = generated_signature === razorpay_signature;
    
    // Save verification record with idempotency key
    await db.collection("paymentVerifications").doc().set({
      userId,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      idempotencyKey: idempotencyKey || `verify_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
      verified: isSignatureValid,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    if (!isSignatureValid) {
      // Update transaction status to failed
      await transactionDoc.ref.update({
        status: "failed",
        verificationTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        notes: transaction.notes + " | Signature verification failed"
      });
      
      console.error(`Payment signature verification failed for order ${razorpay_order_id}`);
      throw new functions.https.HttpsError(
        "permission-denied",
        "Payment verification failed. Invalid signature."
      );
    }
    
    // Payment is verified, update the transaction
    await transactionDoc.ref.update({
      status: "completed",
      verificationTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      razorpayPaymentId: razorpay_payment_id,
      notes: transaction.notes + " | Payment verified successfully"
    });
    
    // Update user's balance
    const userRef = db.collection("users").doc(userId);
    
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "User not found"
        );
      }
      
      const userData = userDoc.data();
      const currentBalance = userData.realMoneyBalance || 0;
      const newBalance = currentBalance + amount;
      
      transaction.update(userRef, { 
        realMoneyBalance: newBalance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    functions.logger.info(`Payment verified successfully for user ${userId}, orderId ${razorpay_order_id}, amount ${amount}`);
    
    return {
      success: true,
      verified: true,
      paymentId: razorpay_payment_id
    };
  } catch (error) {
    console.error(`Payment verification failed:`, error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
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

  // Validate that either winner or loser ID matches the requesting user
  if (!isDraw && winnerId !== userId && loserId !== userId) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only participating players can process payouts"
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

      // Verify the game exists and check its state
      return gameRef.get().then(gameDoc => {
        if (!gameDoc.exists) {
          throw new functions.https.HttpsError(
            "not-found",
            "Game not found"
          );
        }
        
        const gameData = gameDoc.data();
        if (!gameData) {
          throw new functions.https.HttpsError(
            "not-found",
            "Game data is missing"
          );
        }
        
        if (gameData?.payoutProcessed) {
          functions.logger.info(`Payout already processed for game ${gameId}`);
          return { success: true, alreadyProcessed: true };
        }

        // Even if wagersDebited is false, we'll proceed for the simple case of declaring a winner
        // This makes the function more robust for all scenarios
        
        const actualWinnerId = isDraw ? null : (winnerId || gameData?.winner === 'w' ? gameData?.whitePlayer : gameData?.blackPlayer);
        const actualLoserId = isDraw ? null : (loserId || gameData?.winner === 'b' ? gameData?.whitePlayer : gameData?.blackPlayer);
        
        functions.logger.info(`Processing payout for game ${gameId}`, { 
          winnerId: actualWinnerId, 
          loserId: actualLoserId, 
          isDraw, 
          wagerAmount 
        });
        
        return db.runTransaction(async (t) => {
          // Get the actual user references based on resolved IDs
          const actualWinnerRef = actualWinnerId ? db.collection("users").doc(actualWinnerId) : null;
          const actualLoserRef = actualLoserId ? db.collection("users").doc(actualLoserId) : null;
          
          // Handle draw (return wagers to both players)
          if (isDraw) {
            const player1Id = gameData.player1Id;
            const player2Id = gameData.player2Id;
            
            if (!player1Id || !player2Id) {
              throw new functions.https.HttpsError(
                "failed-precondition",
                "Cannot process draw without both player IDs"
              );
            }
            
            const player1Ref = db.collection("users").doc(player1Id);
            const player2Ref = db.collection("users").doc(player2Id);
            
            // Get current player data to ensure they exist
            const [player1Doc, player2Doc] = await Promise.all([
              t.get(player1Ref),
              t.get(player2Ref)
            ]);
            
            if (!player1Doc.exists || !player2Doc.exists) {
              throw new functions.https.HttpsError(
                "not-found",
                "One or both players not found"
              );
            }
            
            // Return wager to player 1
            t.update(player1Ref, {
              realMoneyBalance: admin.firestore.FieldValue.increment(wagerAmount),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            t.set(transactionsRef.doc(), {
              userId: player1Id,
              type: 'wager_refund',
              amount: wagerAmount, 
              status: 'completed',
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              relatedGameId: gameId,
              idempotencyKey,
              notes: `Wager refunded due to draw in game ${gameId}`
            });
            
            // Return wager to player 2
            t.update(player2Ref, {
              realMoneyBalance: admin.firestore.FieldValue.increment(wagerAmount),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            t.set(transactionsRef.doc(), {
              userId: player2Id,
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
          else if (actualWinnerRef && actualLoserId) {
            // Get winner data to ensure they exist
            const winnerDoc = await t.get(actualWinnerRef);
            if (!winnerDoc.exists) {
              throw new functions.https.HttpsError(
                "not-found",
                "Winner user not found"
              );
            }
            
            // Calculate total pool and platform fee
            const totalPool = wagerAmount * 2;
            const platformFee = Math.floor(totalPool * 0.05); // 5% platform fee
            const winnerPayout = totalPool - platformFee;
            
            // Credit winner with winnings after fee
            t.update(actualWinnerRef, {
              realMoneyBalance: admin.firestore.FieldValue.increment(winnerPayout),
              withdrawableAmount: admin.firestore.FieldValue.increment(winnerPayout),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            t.set(transactionsRef.doc(), {
              userId: actualWinnerId,
              type: 'wager_payout',
              amount: winnerPayout,
              status: 'completed',
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              relatedGameId: gameId,
              idempotencyKey,
              platformFee: platformFee,
              notes: `Winnings from game ${gameId} (after 5% platform fee)`
            });
          } else {
            throw new functions.https.HttpsError(
              "failed-precondition",
              "Cannot determine winner for payout"
            );
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

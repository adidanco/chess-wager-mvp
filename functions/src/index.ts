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

// Define interfaces for Scambodia functions
interface ScambodiaPayoutData {
  gameId: string;
}

interface ScambodiaGameData {
  gameId: string;
}

interface ScambodiaTransitionData {
  gameId: string;
  currentRoundNumber: number;
}

interface MobileLoginData {
  mobileNumber: string;
  otpVerified: boolean;
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
 * Function to process Rangvaar game payouts when a game ends
 */
export const processRangvaarPayout = functions.https.onCall(async (data, context) => {
  // Basic Authentication Check (can be enhanced)
  if (!context?.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to trigger payout processing."
    );
  }

  const { gameId } = data;
  if (!gameId || typeof gameId !== 'string') {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Valid gameId is required."
    );
  }

  functions.logger.info(`Attempting to process Rangvaar payout for game: ${gameId}`);

  const gameRef = db.collection("rangvaarGames").doc(gameId);
  const transactionsRef = db.collection("transactions");

  try {
    await db.runTransaction(async (t) => {
      // 1. Get the game document
      const gameDoc = await t.get(gameRef);
      if (!gameDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Rangvaar game ${gameId} not found.`);
      }
      const gameData = gameDoc.data();

      // 2. Perform Validation Checks
      if (!gameData) {
        throw new functions.https.HttpsError("internal", `Game data missing for ${gameId}.`);
      }
      if (gameData.gameType !== 'Rangvaar') {
        throw new functions.https.HttpsError("failed-precondition", `Game ${gameId} is not a Rangvaar game.`);
      }
      if (gameData.status !== 'Finished') {
        throw new functions.https.HttpsError("failed-precondition", `Game ${gameId} is not finished. Current status: ${gameData.status}`);
      }
      if (gameData.payoutProcessed) {
        functions.logger.warn(`Payout already processed for game ${gameId}. Exiting.`);
        // Not throwing an error, just exiting gracefully if already processed.
        return; 
      }
      if (gameData.winnerTeamId !== 1 && gameData.winnerTeamId !== 2) {
          throw new functions.https.HttpsError("failed-precondition", `Invalid or missing winnerTeamId for game ${gameId}.`);
      }
      if (typeof gameData.wagerPerPlayer !== 'number' || gameData.wagerPerPlayer <= 0) {
          throw new functions.https.HttpsError("failed-precondition", `Invalid wagerPerPlayer for game ${gameId}.`);
      }
      if (!gameData.teams || !gameData.teams['1'] || !gameData.teams['2'] || !gameData.players || gameData.players.length !== 4) {
          throw new functions.https.HttpsError("internal", `Invalid teams or players structure in game ${gameId}.`);
      }

      // 3. Determine Winners and Calculate Payout
      const winningTeamId = gameData.winnerTeamId;
      const wagerPerPlayer = gameData.wagerPerPlayer;
      const totalWagerPool = wagerPerPlayer * 4;
      const platformFee = 0; // Keeping fee 0 for MVP as per client logic
      const winningsPerPlayer = (totalWagerPool - platformFee) / 2; // Split amongst 2 winning players

      const winningPlayerIds = gameData.teams[winningTeamId].playerIds;
      if (!winningPlayerIds || winningPlayerIds.length !== 2) {
          throw new functions.https.HttpsError("internal", `Could not determine winning player IDs for team ${winningTeamId} in game ${gameId}.`);
      }
      
      functions.logger.info(`Processing payout for game ${gameId}. Winning Team: ${winningTeamId}, Winnings per player: ${winningsPerPlayer}`);

      // 4. Update Winner Balances and Log Transactions
      const winnerRefs = winningPlayerIds.map((id: string) => db.collection("users").doc(id));
      // Fetch winner docs to ensure they exist (optional check, increment handles non-existence gracefully but good practice)
      const winnerDocs = await Promise.all(winnerRefs.map(ref => t.get(ref))); 
      for (let i = 0; i < winnerDocs.length; i++) {
          if (!winnerDocs[i].exists) {
              throw new functions.https.HttpsError("not-found", `Winning player ${winningPlayerIds[i]} not found.`);
          }
          // Increment balance
          t.update(winnerRefs[i], {
              realMoneyBalance: admin.firestore.FieldValue.increment(winningsPerPlayer),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          // Log transaction
          t.set(transactionsRef.doc(), {
              userId: winningPlayerIds[i],
              type: 'rangvaar_payout',
              amount: winningsPerPlayer,
              status: 'completed',
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              relatedGameId: gameId,
              platformFee: platformFee,
              notes: `Winnings from Rangvaar game ${gameId} (Team ${winningTeamId})`
          });
      }
      
      // 5. Update Game Document - Mark as Processed
      t.update(gameRef, {
          payoutProcessed: true,
          payoutTimestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      
      functions.logger.info(`Successfully processed payout for Rangvaar game ${gameId}.`);
    });

    return { success: true, message: `Rangvaar payout for game ${gameId} processed successfully.` };

  } catch (error: any) {
    functions.logger.error(`Error processing Rangvaar payout for game ${gameId}:`, error);
    // Ensure HttpsError is thrown back to the client
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      "internal",
      error.message || `Failed to process Rangvaar payout for game ${gameId}.`
    );
  }
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
 * Process payout for a completed Scambodia game
 */
export const processScambodiaPayout = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { gameId } = data as ScambodiaPayoutData;
  if (!gameId) {
    throw new functions.https.HttpsError('invalid-argument', 'Game ID is required');
  }

  try {
    const gameRef = db.collection('scambodiaGames').doc(gameId);
    
    // Perform transaction to ensure atomic update
    return await db.runTransaction(async (transaction) => {
      const gameDoc = await transaction.get(gameRef);
      
      if (!gameDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Game not found');
      }
      
      const gameData = gameDoc.data();
      if (!gameData) {
        throw new functions.https.HttpsError('internal', 'Game data is empty');
      }
      
      // Check if game is finished
      if (gameData.status !== 'Finished') {
        throw new functions.https.HttpsError('failed-precondition', 'Game must be in Finished state');
      }
      
      // Check if payout already processed
      if (gameData.payoutProcessed) {
        throw new functions.https.HttpsError('already-exists', 'Payout already processed');
      }
      
      const winnerId = gameData.gameWinnerId;
      if (!winnerId) {
        throw new functions.https.HttpsError('failed-precondition', 'Game has no winner');
      }
      
      // Calculate total pot
      const wagerPerPlayer = gameData.wagerPerPlayer || 0;
      const playerCount = gameData.players?.length || 0;
      const totalPot = wagerPerPlayer * playerCount;
      
      // Get winner user doc
      const winnerRef = db.collection('users').doc(winnerId);
      const winnerDoc = await transaction.get(winnerRef);
      
      if (!winnerDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Winner user account not found');
      }
      
      // Update winner's balance
      transaction.update(winnerRef, {
        balance: admin.firestore.FieldValue.increment(totalPot),
        'stats.wins': admin.firestore.FieldValue.increment(1),
        'stats.earnings': admin.firestore.FieldValue.increment(totalPot),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Mark game as paid out
      transaction.update(gameRef, {
        payoutProcessed: true,
        payoutTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        payoutAmount: totalPot,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Record transaction in game history
      const transactionRef = db.collection('transactions').doc();
      transaction.set(transactionRef, {
        type: 'payout',
        gameId,
        gameType: 'Scambodia',
        userId: winnerId,
        amount: totalPot,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        description: `Scambodia game payout for winner. Game ID: ${gameId}`
      });
      
      functions.logger.info('Scambodia payout processed', {
        gameId,
        winnerId,
        amount: totalPot
      });
      
      return { success: true, amount: totalPot };
    });
  } catch (error) {
    functions.logger.error('Error processing Scambodia payout', { error, gameId });
    throw new functions.https.HttpsError('internal', 'Failed to process payout');
  }
});

/**
 * Transition to the next round in a Scambodia game or mark as finished if all rounds complete
 */
export const transitionScambodiaRound = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { gameId, currentRoundNumber } = data as ScambodiaTransitionData;
  if (!gameId || currentRoundNumber === undefined) {
    throw new functions.https.HttpsError('invalid-argument', 'Game ID and current round number are required');
  }

  try {
    const gameRef = db.collection('scambodiaGames').doc(gameId);
    
    // Perform transaction to ensure atomic update
    return await db.runTransaction(async (transaction) => {
      const gameDoc = await transaction.get(gameRef);
      
      if (!gameDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Game not found');
      }
      
      const gameData = gameDoc.data();
      if (!gameData) {
        throw new functions.https.HttpsError('internal', 'Game data is empty');
      }
      
      // Check if game is in playing state
      if (gameData.status !== 'Playing') {
        throw new functions.https.HttpsError('failed-precondition', 'Game must be in Playing state');
      }
      
      // Verify current round
      if (gameData.currentRoundNumber !== currentRoundNumber) {
        throw new functions.https.HttpsError('failed-precondition', 'Current round mismatch');
      }
      
      const currentRound = gameData.rounds[currentRoundNumber];
      if (!currentRound || currentRound.phase !== 'Scoring') {
        throw new functions.https.HttpsError('failed-precondition', 'Round must be in Scoring phase');
      }
      
      // Check if this is the final round
      const isLastRound = currentRoundNumber >= gameData.totalRounds;
      
      if (isLastRound) {
        // Game is complete, determine overall winner
        let lowestScore = Number.MAX_SAFE_INTEGER;
        let gameWinnerId = null;
        let tiebreaker = 0;
        
        // Calculate final scores and find winner
        Object.entries(gameData.cumulativeScores).forEach(([playerId, score]) => {
          const playerScambodiaCalls = gameData.scambodiaCalls?.[playerId] || 0;
          
          if (score < lowestScore) {
            lowestScore = score;
            gameWinnerId = playerId;
            tiebreaker = playerScambodiaCalls;
          } else if (score === lowestScore) {
            // Tie-breaker: more successful Scambodia calls wins
            const currentTiebreaker = playerScambodiaCalls;
            if (currentTiebreaker > tiebreaker) {
              gameWinnerId = playerId;
              tiebreaker = currentTiebreaker;
            }
          }
        });
        
        // Mark game as finished
        transaction.update(gameRef, {
          status: 'Finished',
          gameWinnerId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        functions.logger.info('Scambodia game finished', {
          gameId,
          winnerId: gameWinnerId,
          totalRounds: gameData.totalRounds
        });
      } else {
        // Initialize next round
        const nextRoundNumber = currentRoundNumber + 1;
        
        // Create initial state for next round
        // This is simplified - in a real implementation you'd have dealer logic, etc.
        const newRound = {
          roundNumber: nextRoundNumber,
          phase: 'Setup',
          currentTurnPlayerId: gameData.players[0].userId, // First player starts
          playerCards: {}, // Will be populated with initial cards
          visibleToPlayer: {}, // Will track which cards players can see
          discardPile: [],
          drawPile: [],
          actions: [],
          scores: {},
          cardPowersUsed: []
        };
        
        // Mark round as complete and set up next round
        transaction.update(gameRef, {
          [`rounds.${currentRoundNumber}.phase`]: 'Complete',
          [`rounds.${nextRoundNumber}`]: newRound,
          currentRoundNumber: nextRoundNumber,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        functions.logger.info('Scambodia transitioning to next round', {
          gameId,
          fromRound: currentRoundNumber,
          toRound: nextRoundNumber
        });
      }
      
      return { success: true, isLastRound };
    });
  } catch (error) {
    functions.logger.error('Error transitioning Scambodia round', { error, gameId });
    throw new functions.https.HttpsError('internal', 'Failed to transition round');
  }
});

/**
 * Find a user by mobile number (for OTP login)
 * Note: In a production app, this would use a secure SMS verification service
 */
export const findUserByMobileNumber = functions.https.onCall(async (data, context) => {
  const { mobileNumber, otpVerified } = data as MobileLoginData;
  
  if (!mobileNumber) {
    throw new functions.https.HttpsError('invalid-argument', 'Mobile number is required');
  }
  
  if (!otpVerified) {
    throw new functions.https.HttpsError('failed-precondition', 'OTP must be verified');
  }
  
  try {
    // In a real implementation, we would query users by verified mobile number
    // For this MVP version, let's just get any user for demo purposes
    const usersSnapshot = await db.collection('users').limit(1).get();
    
    if (usersSnapshot.empty) {
      throw new functions.https.HttpsError('not-found', 'No user accounts found');
    }
    
    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    
    functions.logger.info('User found by mobile number (demo)', {
      mobileNumber,
      userId: userDoc.id
    });
    
    // Return user info needed for authentication
    return {
      userId: userDoc.id,
      userEmail: userData.email || `demo-${userDoc.id.substring(0, 6)}@example.com`
    };
  } catch (error) {
    functions.logger.error('Error finding user by mobile', { error, mobileNumber });
    throw new functions.https.HttpsError('internal', 'Failed to find user');
  }
});

/**
 * Cloud function to start a Scambodia game
 * This handles operations that require admin privileges:
 * - Checking player balances
 * - Deducting wagers from players
 * - Creating transaction records
 * - Initializing the first round
 */
export const startScambodiaGame = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context?.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to start a game"
    );
  }

  const { gameId } = data as ScambodiaGameData;
  
  if (!gameId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Game ID is required"
    );
  }

  try {
    const gameDocRef = db.collection("scambodiaGames").doc(gameId);
    
    // Use a transaction to ensure data consistency
    return await db.runTransaction(async (transaction) => {
      // Step 1: Read all necessary data
      const gameDoc = await transaction.get(gameDocRef);
      
      if (!gameDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Game not found");
      }
      
      const gameState = gameDoc.data();
      
      if (gameState.status !== "Waiting") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Game has already started or been cancelled"
        );
      }
      
      if (gameState.players.length < 2) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Game needs at least 2 players to start"
        );
      }

      // Get user documents for all players
      const playerDocs = await Promise.all(
        gameState.players.map(async (player) => {
          const userDocRef = db.collection("users").doc(player.userId);
          const userDoc = await transaction.get(userDocRef);
          
          if (!userDoc.exists) {
            throw new functions.https.HttpsError(
              "not-found",
              `Player ${player.username} account not found`
            );
          }
          
          return {
            ref: userDocRef,
            player,
            data: userDoc.data()
          };
        })
      );
      
      // Step 2: Validate player balances
      const wagerAmount = gameState.wagerPerPlayer;
      
      playerDocs.forEach(({ player, data }) => {
        const balance = data.balance || 0;
        
        if (balance < wagerAmount) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `Player ${player.username} has insufficient balance to play`
          );
        }
      });
      
      // Step 3: Initialize game state
      // Create and shuffle deck
      const deck = createShuffledDeck();
      
      // Set up player cards and visibility
      const playerCards = {};
      const visibleToPlayer = {};
      
      gameState.players.forEach(player => {
        playerCards[player.userId] = [];
        visibleToPlayer[player.userId] = [2, 3]; // Bottom two cards initially visible
      });
      
      // Deal 4 cards to each player
      for (let i = 0; i < 4; i++) {
        for (const player of gameState.players) {
          if (deck.length > 0) {
            const card = deck.pop();
            playerCards[player.userId].push(card);
          }
        }
      }
      
      // Setup discard and draw piles
      const firstDiscard = deck.pop();
      const discardPile = [firstDiscard];
      const drawPile = deck;
      
      // Create round state
      const firstRound = {
        roundNumber: 1,
        phase: "Setup",
        currentTurnPlayerId: gameState.players[0].userId,
        playerCards,
        visibleToPlayer,
        discardPile,
        drawPile,
        drawnCard: null,
        drawnCardUserId: null,
        actions: [],
        scores: {},
        cardPowersUsed: []
      };
      
      // Step 4: Perform all writes
      
      // Update player balances and create transaction records
      playerDocs.forEach(({ ref, player }) => {
        // Deduct wager from player balance
        transaction.update(ref, {
          balance: admin.firestore.FieldValue.increment(-wagerAmount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Create transaction record
        const transactionRef = db.collection("transactions").doc();
        transaction.set(transactionRef, {
          userId: player.userId,
          gameId,
          gameType: "Scambodia",
          type: "wager",
          amount: -wagerAmount,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          description: `Scambodia game wager. Game ID: ${gameId}`
        });
      });
      
      // Update game state
      transaction.update(gameDocRef, {
        status: "Playing",
        currentRoundNumber: 1,
        rounds: { 1: firstRound },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      functions.logger.info(`Scambodia game started: ${gameId}`, {
        playerCount: gameState.players.length,
        wagerAmount
      });
      
      return { success: true, message: "Game started successfully" };
    });
  } catch (error) {
    functions.logger.error(`Error starting Scambodia game: ${gameId}`, error);
    throw new functions.https.HttpsError(
      "internal",
      `Failed to start game: ${error.message}`
    );
  }
});

// Helper function to create and shuffle a deck of cards
function createShuffledDeck() {
  const suits = ["Hearts", "Diamonds", "Clubs", "Spades"];
  const ranks = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const deck = [];

  // Create deck
  for (const suit of suits) {
    for (const rank of ranks) {
      // Calculate value based on card rules
      let value = 0;
      
      if (rank === "1") {
        value = 1;
      } else if (rank === "J") {
        value = 11;
      } else if (rank === "Q") {
        value = 12;
      } else if (rank === "K") {
        // Kings of Hearts and Diamonds are worth 0, others are 13
        value = (suit === "Hearts" || suit === "Diamonds") ? 0 : 13;
      } else {
        // Number cards 2-10
        value = parseInt(rank);
      }

      deck.push({
        suit,
        rank,
        id: `${suit[0]}${rank}`, // e.g., "H7", "SA"
        value
      });
    }
  }

  // Shuffle the deck (Fisher-Yates algorithm)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  return deck;
}

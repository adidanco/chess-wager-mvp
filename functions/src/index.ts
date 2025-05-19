/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// @ts-nocheck - Disable TypeScript checking for this file as Firebase Functions types are not properly matched
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger"; // Use new logger
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// Define the region (V2 uses runtime options or global config, not functions.region())
// Let's rely on the default or project config for now (likely us-central1)

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
export const confirmDeposit = onCall<{ amount: number; transactionId?: string }, Promise<{ success: boolean }>>(
  { region: 'us-central1' }, 
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "User is not authenticated");
    const userId = request.auth.uid;
    const { amount, transactionId } = request.data;
    
    if (typeof amount !== 'number' || amount <= 0) throw new HttpsError("invalid-argument", "Invalid amount");
    
    const userRef = db.collection("users").doc(userId);
    const transactionsRef = db.collection("transactions");

    try {
      await db.runTransaction(async (transaction) => {
        transaction.update(userRef, {
          realMoneyBalance: admin.firestore.FieldValue.increment(amount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        transaction.set(transactionsRef.doc(), {
          userId,
          type: 'deposit',
          amount,
          status: 'completed',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          upiTransactionId: transactionId || null,
          notes: "User confirmed deposit (simulated auto-approval)."
        });
      });

      logger.info(`Deposit confirmed for user ${userId}, amount ${amount}`);
      return { success: true };
    } catch (error: any) {
      logger.error(`Failed to confirm deposit for user ${userId}`, error);
      throw new HttpsError("internal", "Failed to process deposit");
    }
  }
);

/**
 * Function to debit wagers from both players when a game starts
 */
export const debitWagersForGame = onCall<{ gameId: string; player1Id: string; player2Id: string; wagerAmount: number }, Promise<{ success: boolean }>>(
  { region: 'us-central1' }, 
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "User is not authenticated");
    const userId = request.auth.uid;
    const { gameId, player1Id, player2Id, wagerAmount } = request.data;

    if (userId !== player1Id && userId !== player2Id) throw new HttpsError("permission-denied", "User cannot initiate debit");
    if (typeof wagerAmount !== 'number' || wagerAmount <= 0) throw new HttpsError("invalid-argument", "Invalid wager");
    
    const player1Ref = db.collection("users").doc(player1Id);
    const player2Ref = db.collection("users").doc(player2Id);
    const transactionsRef = db.collection("transactions");
    
    try {
      await db.runTransaction(async (t) => {
        const p1Doc = await t.get(player1Ref);
        const p2Doc = await t.get(player2Ref);

        if (!p1Doc.exists || !p2Doc.exists) throw new HttpsError("not-found", "One or both players not found");
        
        const p1Data = p1Doc.data();
        const p2Data = p2Doc.data();

        if (!p1Data || !p2Data) throw new HttpsError("not-found", "Player data is missing");

        const p1Balance = p1Data.realMoneyBalance || 0;
        const p2Balance = p2Data.realMoneyBalance || 0;

        if (p1Balance < wagerAmount) throw new HttpsError("failed-precondition", "Player 1 has insufficient balance");
        if (p2Balance < wagerAmount) throw new HttpsError("failed-precondition", "Player 2 has insufficient balance");

        // Debit Player 1
        t.update(player1Ref, { balance: admin.firestore.FieldValue.increment(-wagerAmount), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        t.set(transactionsRef.doc(), { userId: player1Id, type: 'wager_debit', amount: wagerAmount, status: 'completed', timestamp: admin.firestore.FieldValue.serverTimestamp(), relatedGameId: gameId });
        
        // Debit Player 2
        t.update(player2Ref, { balance: admin.firestore.FieldValue.increment(-wagerAmount), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        t.set(transactionsRef.doc(), { userId: player2Id, type: 'wager_debit', amount: wagerAmount, status: 'completed', timestamp: admin.firestore.FieldValue.serverTimestamp(), relatedGameId: gameId });
        
        // Mark game wagers as debited if needed: t.update(gameRef, { wagersDebited: true });
      }); // End transaction
      
      logger.info(`Wagers debited for game: ${gameId}`);
      return { success: true };
      
    } catch (error: any) { 
       logger.error(`Wager debit failed: ${gameId}`, error);
       if (error instanceof HttpsError) throw error; // Re-throw HttpsError directly
       throw new HttpsError("internal", "Wager debit failed");
    }
  }
);

/**
 * Function to process game payouts when a game ends
 */
export const processGamePayout = onCall<any, Promise<any>>(
  { region: 'us-central1' }, 
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "User is not authenticated");
    const userId = request.auth.uid;
    const { gameId, winnerId, loserId, isDraw, wagerAmount } = request.data as GamePayoutData;
    
    if (typeof wagerAmount !== 'number' || wagerAmount <= 0) {
      throw new HttpsError("invalid-argument", "Invalid wager amount for payout");
    }

    const winnerRef = winnerId ? db.collection("users").doc(winnerId) : null;
    const loserRef = loserId ? db.collection("users").doc(loserId) : null;
    const gameRef = db.collection("games").doc(gameId);
    const transactionsRef = db.collection("transactions");

    // First verify the game exists and has wagersDebited set to true
    return gameRef.get().then(gameDoc => {
      if (!gameDoc.exists) {
        throw new HttpsError("not-found", "Game not found");
      }
      
      const gameData = gameDoc.data();
      if (!gameData?.wagersDebited) {
        throw new HttpsError("failed-precondition", "Cannot process payout for game without debited wagers");
      }
      
      if (gameData?.payoutProcessed) {
        throw new HttpsError("already-exists", "Payout has already been processed for this game");
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

        logger.info(`Game payout processed for game ${gameId}`);
        return { success: true };
      });
    }).catch((error: any) => {
      logger.error(`Failed to process payout for game ${gameId}`, error);
      throw new HttpsError("internal", error.message || "Failed to process game payout");
    });
  }
);

/**
 * Function to process Rangvaar game payouts when a game ends
 */
export const processRangvaarPayout = onCall<{ gameId: string }, Promise<any>>(
  { region: 'us-central1' }, 
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated to trigger payout processing.");
    const { gameId } = request.data;
    if (!gameId || typeof gameId !== 'string') {
      throw new HttpsError("invalid-argument", "Valid gameId is required.");
    }

    logger.info(`Attempting to process Rangvaar payout for game: ${gameId}`);

    const gameRef = db.collection("rangvaarGames").doc(gameId);
    const transactionsRef = db.collection("transactions");

    try {
      await db.runTransaction(async (t) => {
        // 1. Get the game document
        const gameDoc = await t.get(gameRef);
        if (!gameDoc.exists) {
          throw new HttpsError("not-found", `Rangvaar game ${gameId} not found.`);
        }
        const gameData = gameDoc.data();

        // 2. Perform Validation Checks
        if (!gameData) {
          throw new HttpsError("internal", `Game data missing for ${gameId}.`);
        }
        if (gameData.gameType !== 'Rangvaar') {
          throw new HttpsError("failed-precondition", `Game ${gameId} is not a Rangvaar game.`);
        }
        if (gameData.status !== 'Finished') {
          throw new HttpsError("failed-precondition", `Game ${gameId} is not finished. Current status: ${gameData.status}`);
        }
        if (gameData.payoutProcessed) {
          logger.warn(`Payout already processed for game ${gameId}. Exiting.`);
          // Not throwing an error, just exiting gracefully if already processed.
          return; 
        }
        if (gameData.winnerTeamId !== 1 && gameData.winnerTeamId !== 2) {
          throw new HttpsError("failed-precondition", `Invalid or missing winnerTeamId for game ${gameId}.`);
        }
        if (typeof gameData.wagerPerPlayer !== 'number' || gameData.wagerPerPlayer <= 0) {
          throw new HttpsError("failed-precondition", `Invalid wagerPerPlayer for game ${gameId}.`);
        }
        if (!gameData.teams || !gameData.teams['1'] || !gameData.teams['2'] || !gameData.players || gameData.players.length !== 4) {
          throw new HttpsError("internal", `Invalid teams or players structure in game ${gameId}.`);
        }

        // 3. Determine Winners and Calculate Payout
        const winningTeamId = gameData.winnerTeamId;
        const wagerPerPlayer = gameData.wagerPerPlayer;
        const totalWagerPool = wagerPerPlayer * 4;
        const platformFee = 0; // Keeping fee 0 for MVP as per client logic
        const winningsPerPlayer = (totalWagerPool - platformFee) / 2; // Split amongst 2 winning players

        const winningPlayerIds = gameData.teams[winningTeamId].playerIds;
        if (!winningPlayerIds || winningPlayerIds.length !== 2) {
          throw new HttpsError("internal", `Could not determine winning player IDs for team ${winningTeamId} in game ${gameId}.`);
        }
        
        logger.info(`Processing payout for game ${gameId}. Winning Team: ${winningTeamId}, Winnings per player: ${winningsPerPlayer}`);

        // 4. Update Winner Balances and Log Transactions
        const winnerRefs = winningPlayerIds.map((id: string) => db.collection("users").doc(id));
        // Fetch winner docs to ensure they exist (optional check, increment handles non-existence gracefully but good practice)
        const winnerDocs = await Promise.all(winnerRefs.map(ref => t.get(ref))); 
        for (let i = 0; i < winnerDocs.length; i++) {
          if (!winnerDocs[i].exists) {
            throw new HttpsError("not-found", `Winning player ${winningPlayerIds[i]} not found.`);
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
        
        logger.info(`Successfully processed payout for Rangvaar game ${gameId}.`);
      });

      return { success: true, message: `Rangvaar payout for game ${gameId} processed successfully.` };

    } catch (error: any) {
      logger.error(`Error processing Rangvaar payout for game ${gameId}:`, error);
      // Ensure HttpsError is thrown back to the client
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", error.message || `Failed to process Rangvaar payout for game ${gameId}.`);
    }
  }
);

/**
 * Function to request a withdrawal
 */
export const requestWithdrawal = onCall<{ amount: number; upiId: string }, Promise<{ success: boolean; message: string }>>(
  { region: 'us-central1' }, 
  async (request) => {
     if (!request.auth) throw new HttpsError("unauthenticated", "User is not authenticated");
     const userId = request.auth.uid;
     const { amount, upiId } = request.data;
     
     if (typeof amount !== 'number' || amount <= 0) throw new HttpsError("invalid-argument", "Invalid amount");
     if (!upiId || typeof upiId !== 'string') throw new HttpsError("invalid-argument", "UPI ID required");
     
      const userRef = db.collection("users").doc(userId);
      const transactionsRef = db.collection("transactions");
      
     try {
        await db.runTransaction(async (t) => {
            const userDoc = await t.get(userRef);
            if (!userDoc.exists) throw new HttpsError("not-found", "User not found");
            
            const userData = userDoc.data();
            if (!userData) throw new HttpsError("not-found", "User data is missing");

            const currentBalance = userData.realMoneyBalance || 0;
            if (userData.pendingWithdrawalAmount && userData.pendingWithdrawalAmount > 0) {
                throw new HttpsError("failed-precondition", "You already have a pending withdrawal request");
            }
            if (currentBalance < amount) {
                throw new HttpsError("failed-precondition", "Insufficient balance for withdrawal");
            }

            // Create transaction record
            const transactionRef = transactionsRef.doc();
            t.set(transactionRef, {
              userId: userId,
              type: 'withdrawal_request',
              amount: amount,
              status: 'pending',
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              withdrawalDetails: { upiId: upiId, requestedAt: admin.firestore.FieldValue.serverTimestamp() },
              notes: `Withdrawal request of ₹${amount} to UPI ID: ${upiId}`
            });

            // Update user document
            t.update(userRef, {
              realMoneyBalance: admin.firestore.FieldValue.increment(-amount),
              pendingWithdrawalAmount: amount,
              withdrawalUpiId: upiId,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
             logger.info(`Withdrawal request created for user ${userId}, amount ${amount}`);
        }); // End transaction

        return { 
          success: true,
          message: "Withdrawal request submitted for processing. This may take up to 24 hours."
        }; // Return success message outside transaction

     } catch (error: any) {
        logger.error(`Withdrawal request failed: ${userId}`, error);
         if (error instanceof HttpsError) throw error; // Re-throw HttpsError
        throw new HttpsError("internal", "Withdrawal request failed");
     }
  }
);

/**
 * Function to process a withdrawal (admin only)
 */
export const processWithdrawal = onCall<{ transactionId: string; status: 'completed' | 'cancelled'; adminNotes?: string }, Promise<{ success: boolean }>>(
  { region: 'us-central1' }, 
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Admin must be authenticated");
    const adminId = request.auth.uid;
    const { transactionId, status, adminNotes } = request.data as WithdrawalProcessData;
    
    if (!transactionId || typeof transactionId !== 'string') throw new HttpsError("invalid-argument", "Valid transaction ID is required");
    
    if (status !== 'completed' && status !== 'cancelled') throw new HttpsError("invalid-argument", "Status must be either 'completed' or 'cancelled'");

    // Verify admin status
    return db.collection("users").doc(adminId).get().then(adminDoc => {
      if (!adminDoc.exists) {
        throw new HttpsError("not-found", "Admin user not found");
      }
      
      const adminData = adminDoc.data();
      if (!adminData?.role || !['admin', 'super_admin'].includes(adminData.role)) {
        throw new HttpsError("permission-denied", "Only admin users can process withdrawals");
      }

      const transactionRef = db.collection("transactions").doc(transactionId);
      
      return db.runTransaction(async (t) => {
        const transactionDoc = await t.get(transactionRef);
        if (!transactionDoc.exists) {
          throw new HttpsError("not-found", "Transaction not found");
        }
        
        const transactionData = transactionDoc.data();
        if (!transactionData) {
          throw new HttpsError("not-found", "Transaction data is missing");
        }
        
        if (transactionData.type !== 'withdrawal_request') {
          throw new HttpsError("failed-precondition", "Transaction is not a withdrawal request");
        }
        
        if (transactionData.status !== 'pending') {
          throw new HttpsError("failed-precondition", "Transaction is not pending");
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
            userId,
            type: 'withdrawal_cancelled',
            amount,
            status: 'completed',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            relatedTransactionId: transactionId,
            notes: `Withdrawal request cancelled: ${adminNotes}`
          });
        }

        logger.info(`Withdrawal ${status} for transaction ${transactionId}`);
        return { 
          success: true,
          message: `Withdrawal request has been ${status}.`
        };
      });
    }).catch((error: any) => {
      logger.error(`Failed to process withdrawal ${transactionId}`, error);
      throw new HttpsError("internal", error.message || "Failed to process withdrawal");
    });
  }
);

/**
 * Process payout for a completed Scambodia game
 */
export const processScambodiaPayout = onCall<{ gameId: string }, Promise<any>>(
  { region: 'us-central1', invoker: ['public'] }, 
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated");
    const { gameId } = request.data as ScambodiaPayoutData;
    if (!gameId) throw new HttpsError("invalid-argument", "Game ID is required");

    try {
      const gameRef = db.collection('scambodiaGames').doc(gameId);
      
      // Perform transaction to ensure atomic update
      return await db.runTransaction(async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        
        if (!gameDoc.exists) {
          throw new HttpsError('not-found', 'Game not found');
        }
        
        const gameData = gameDoc.data();
        if (!gameData) {
          throw new HttpsError('internal', 'Game data is empty');
        }
        
        // Check if game is finished
        if (gameData.status !== 'Finished') {
          throw new HttpsError('failed-precondition', 'Game must be in Finished state');
        }
        
        // Check if payout already processed
        if (gameData.payoutProcessed) {
          throw new HttpsError('already-exists', 'Payout already processed');
        }
        
        const winnerId = gameData.gameWinnerId;
        if (!winnerId) {
          throw new HttpsError('failed-precondition', 'Game has no winner');
        }
        
        // Calculate total pot
        const wagerPerPlayer = gameData.wagerPerPlayer || 0;
        const playerCount = gameData.players?.length || 0;
        const totalPot = wagerPerPlayer * playerCount;
        
        // Get winner user doc
        const winnerRef = db.collection('users').doc(winnerId);
        const winnerDoc = await transaction.get(winnerRef);
        
        if (!winnerDoc.exists) {
          throw new HttpsError('not-found', 'Winner user account not found');
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
        
        logger.info('Scambodia payout processed', {
          gameId,
          winnerId,
          amount: totalPot
        });
        
        return { success: true, amount: totalPot };
      });
    } catch (error) {
      logger.error('Error processing Scambodia payout', { error, gameId });
      throw new HttpsError('internal', 'Failed to process payout');
    }
  }
);

/**
 * Transition to the next round in a Scambodia game or mark as finished if all rounds complete
 */
export const transitionScambodiaRound = onCall<{ gameId: string; currentRoundNumber: number }, Promise<any>>(
  { region: 'us-central1' }, 
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated");
    const { gameId, currentRoundNumber } = request.data as ScambodiaTransitionData;
    if (!gameId || currentRoundNumber === undefined) {
      throw new HttpsError("invalid-argument", "Game ID and current round number are required");
    }

    try {
      const gameRef = db.collection('scambodiaGames').doc(gameId);
      
      // Perform transaction to ensure atomic update
      return await db.runTransaction(async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        
        if (!gameDoc.exists) {
          throw new HttpsError('not-found', 'Game not found');
        }
        
        const gameData = gameDoc.data();
        if (!gameData) {
          throw new HttpsError('internal', 'Game data is empty');
        }
        
        // Check if game is in playing state
        if (gameData.status !== 'Playing') {
          throw new HttpsError('failed-precondition', 'Game must be in Playing state');
        }
        
        // Verify current round
        if (gameData.currentRoundNumber !== currentRoundNumber) {
          throw new HttpsError('failed-precondition', 'Current round mismatch');
        }
        
        const currentRound = gameData.rounds[currentRoundNumber];
        if (!currentRound || currentRound.phase !== 'Scoring') {
          throw new HttpsError('failed-precondition', 'Round must be in Scoring phase');
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
          
          logger.info('Scambodia game finished', {
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
          
          logger.info('Scambodia transitioning to next round', {
            gameId,
            fromRound: currentRoundNumber,
            toRound: nextRoundNumber
          });
        }
        
        return { success: true, isLastRound };
      });
    } catch (error) {
      logger.error('Error transitioning Scambodia round', { error, gameId });
      throw new HttpsError('internal', 'Failed to transition round');
    }
  }
);

/**
 * Find a user by mobile number (for OTP login)
 * Note: In a production app, this would use a secure SMS verification service
 */
export const findUserByMobileNumber = onCall<{ mobileNumber: string; otpVerified: boolean }, Promise<any>>(
  { region: 'us-central1' }, 
  async (request) => {
    const { mobileNumber, otpVerified } = request.data as MobileLoginData;
    
    if (!mobileNumber) {
      throw new HttpsError('invalid-argument', 'Mobile number is required');
    }
    
    if (!otpVerified) {
      throw new HttpsError('failed-precondition', 'OTP must be verified');
    }
    
    try {
      // In a real implementation, we would query users by verified mobile number
      // For this MVP version, let's just get any user for demo purposes
      const usersSnapshot = await db.collection('users').limit(1).get();
      
      if (usersSnapshot.empty) {
        throw new HttpsError('not-found', 'No user accounts found');
      }
      
      const userDoc = usersSnapshot.docs[0];
      const userData = userDoc.data();
      
      logger.info('User found by mobile number (demo)', {
        mobileNumber,
        userId: userDoc.id
      });
      
      // Return user info needed for authentication
      return {
        userId: userDoc.id,
        userEmail: userData.email || `demo-${userDoc.id.substring(0, 6)}@example.com`
      };
    } catch (error) {
      logger.error('Error finding user by mobile', { error, mobileNumber });
      throw new HttpsError('internal', 'Failed to find user');
    }
  }
);

/**
 * Cloud function to start a Scambodia game
 * This handles operations that require admin privileges:
 * - Checking player balances
 * - Deducting wagers from players
 * - Creating transaction records
 * - Initializing the first round
 */
export const startScambodiaGame = onCall<{ gameId: string }, Promise<any>>(
  { region: 'us-central1' }, 
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated to start a game");
    const { gameId } = request.data as ScambodiaGameData;
    
    if (!gameId) {
      throw new HttpsError("invalid-argument", "Game ID is required");
    }

    try {
      const gameDocRef = db.collection("scambodiaGames").doc(gameId);
      
      // Use a transaction to ensure data consistency
      return await db.runTransaction(async (transaction) => {
        // Step 1: Read all necessary data
        const gameDoc = await transaction.get(gameDocRef);
        
        if (!gameDoc.exists) {
          throw new HttpsError("not-found", "Game not found");
        }
        
        const gameState = gameDoc.data();
        
        if (gameState.status !== "Waiting") {
          throw new HttpsError("failed-precondition", "Game has already started or been cancelled");
        }
        
        if (gameState.players.length < 2) {
          throw new HttpsError("failed-precondition", "Game needs at least 2 players to start");
        }

        // Get user documents for all players
        const playerDocs = await Promise.all(
          gameState.players.map(async (player) => {
            const userDocRef = db.collection("users").doc(player.userId);
            const userDoc = await transaction.get(userDocRef);
            
            if (!userDoc.exists) {
              throw new HttpsError("not-found", `Player ${player.username} account not found`);
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
            throw new HttpsError("failed-precondition", `Player ${player.username} has insufficient balance to play`);
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
        
        logger.info(`Scambodia game started: ${gameId}`, {
          playerCount: gameState.players.length,
          wagerAmount
        });
        
        return { success: true, message: "Game started successfully" };
      });
    } catch (error) {
      logger.error(`Error starting Scambodia game: ${gameId}`, error);
      throw new HttpsError("internal", `Failed to start game: ${error.message}`);
    }
  }
);

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

// Helper function to determine power type based on card rank
const determinePowerType = (card: any): any => {
  if (!card) return null;
  switch (card.rank) {
    case '7': case '8': return 'Peek_Own';
    case '9': case '10': return 'Peek_Opponent';
    case 'J': case 'Q': return 'Blind_Swap';
    case 'K': return 'Seen_Swap';
    default: return null;
  }
};

// Ensure getNextPlayerId is defined
const getNextPlayerId = (players: any[], currentPlayerId: string): string => {
  const currentPlayerIndex = players.findIndex(p => p.userId === currentPlayerId);
  if (currentPlayerIndex === -1) {
     logger.warn("getNextPlayerId: currentPlayerId not found in players array", { currentPlayerId, players });
     // Fallback to the first player if current not found (shouldn't happen in valid state)
     return players[0]?.userId || ''
  }
  const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
  return players[nextPlayerIndex]?.userId || '';
};

// Helper function to calculate scores for a round
interface CalculatedScoresResult {
  scores: { [playerId: string]: number };
  winnerId: string | null;
}

const calculateScambodiaScores = (playerCards: { [playerId: string]: (Card | null)[] }): CalculatedScoresResult => {
  const scores: { [playerId: string]: number } = {};
  let lowestScore = Infinity;
  let winnerId: string | null = null;

  for (const [playerId, cards] of Object.entries(playerCards)) {
    let playerScore = 0;
    cards.forEach(card => {
      if (card !== null) {
        // Simplified: Always add the card's value.
        // The deck creation function already sets Red Kings to value 0.
        playerScore += card.value; 
      }
    });
    scores[playerId] = playerScore;

    // Determine winner (lowest score)
    if (playerScore < lowestScore) {
      lowestScore = playerScore;
      winnerId = playerId;
    } else if (playerScore === lowestScore) {
      winnerId = null; // Handle ties - no single winner if scores are equal
      // TODO: Refine tie-breaking logic if needed (e.g., based on Scambodia calls)
    }
  }

  return { scores, winnerId };
};

// Helper function for creating action objects with timestamp
const createAction = (type: string, userId: string, details: any = {}) => ({
  type,
  playerId: userId,
  ...details,
  timestamp: admin.firestore.Timestamp.now()
});

// --- exchangeCard (V2 Syntax) ---
export const exchangeCard = onCall<{ gameId: string; cardPosition: number }, Promise<{ success: boolean }>>(
  { region: 'us-central1' }, 
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated");
    const userId = request.auth.uid;
    const { gameId, cardPosition } = request.data;
    
    if (!gameId || typeof cardPosition !== 'number' || cardPosition < 0 || cardPosition >= 4) {
      throw new HttpsError("invalid-argument", "Valid gameId and cardPosition are required.");
    }

    const gameDocRef = db.collection("scambodiaGames").doc(gameId);
    logger.info('exchangeCard V2', 'Attempting', { gameId, userId, cardPosition });
    const now = admin.firestore.Timestamp.now();

    try {
      await db.runTransaction(async (transaction) => {
        const gameDoc = await transaction.get(gameDocRef);
        if (!gameDoc.exists) throw new HttpsError("not-found", "Game not found.");
        const gameState = gameDoc.data();
        if (!gameState) throw new HttpsError("internal", "Game data missing");
        const currentRound = gameState.currentRoundNumber;
        const roundState = gameState.rounds[currentRound];
        if (!roundState) throw new HttpsError("not-found", `Round ${currentRound} not found.`);

        // Validation
        if (roundState.currentTurnPlayerId !== userId) throw new HttpsError("failed-precondition", "Not your turn.");
        if (!roundState.drawnCard || roundState.drawnCardUserId !== userId) throw new HttpsError("failed-precondition", "Must draw card first.");
        const playerCards = roundState.playerCards?.[userId];
        if (!playerCards) throw new HttpsError("internal", "Player cards not found.");
        const replacedCard = playerCards[cardPosition];
        if (!replacedCard) throw new HttpsError("invalid-argument", "No card at that position.");
        
        let drawnCard = { ...roundState.drawnCard }; // Clone

        const updatedPlayerCards = [...playerCards];
        updatedPlayerCards[cardPosition] = drawnCard;
        const updatedDiscardPile = [...roundState.discardPile, replacedCard];

        // Update game state
        transaction.update(gameDocRef, {
          [`rounds.${currentRound}.playerCards.${userId}`]: updatedPlayerCards,
          [`rounds.${currentRound}.discardPile`]: updatedDiscardPile,
          [`rounds.${currentRound}.drawnCard`]: null,
          [`rounds.${currentRound}.drawnCardUserId`]: null,
          [`rounds.${currentRound}.drawnCardSource`]: null,
          [`rounds.${currentRound}.pendingPowerDecision`]: null, // Clear pending power
          [`rounds.${currentRound}.actions`]: admin.firestore.FieldValue.arrayUnion(
            createAction('Exchange', userId, { cardId: drawnCard.id, cardPosition })
          ),
          [`rounds.${currentRound}.currentTurnPlayerId`]: getNextPlayerId(gameState.players, userId),
          updatedAt: now
        });
      });
      logger.info('exchangeCard V2', 'Success', { gameId, userId, cardPosition });
      return { success: true };
    } catch (error: any) {
      logger.error('exchangeCard V2', 'Failed', { error: error.message, gameId, userId, cardPosition });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Failed to exchange card.");
    }
  }
);

// --- discardDrawnCard (V2 Syntax) ---
export const discardDrawnCard = onCall<{ gameId: string }, Promise<{ success: boolean, discardedCardId?: string }>>(
  { region: 'us-central1' }, 
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated");
    const userId = request.auth.uid;
    const { gameId } = request.data;
    
    if (!gameId) throw new HttpsError("invalid-argument", "Valid gameId is required.");

    const gameDocRef = db.collection("scambodiaGames").doc(gameId);
    logger.info('discardDrawnCard V2', 'Attempting', { gameId, userId });
    let discardedCardId: string | undefined = undefined;
    const now = admin.firestore.Timestamp.now();

    try {
      await db.runTransaction(async (transaction) => {
        const gameDoc = await transaction.get(gameDocRef);
        if (!gameDoc.exists) throw new HttpsError("not-found", "Game not found.");
        const gameState = gameDoc.data();
        if (!gameState) throw new HttpsError("internal", "Game data missing");
        const currentRound = gameState.currentRoundNumber;
        const roundState = gameState.rounds[currentRound];
        if (!roundState) throw new HttpsError("not-found", `Round ${currentRound} not found.`);

        // Validation
        if (roundState.currentTurnPlayerId !== userId) throw new HttpsError("failed-precondition", "Not your turn.");
        if (!roundState.drawnCard || roundState.drawnCardUserId !== userId) throw new HttpsError("failed-precondition", "Must draw card first.");
        
        const cardToDiscard = roundState.drawnCard;
        discardedCardId = cardToDiscard.id;
        const updatedDiscardPile = [...roundState.discardPile, cardToDiscard];

        // Update game state
        transaction.update(gameDocRef, {
          [`rounds.${currentRound}.discardPile`]: updatedDiscardPile,
          [`rounds.${currentRound}.drawnCard`]: null,
          [`rounds.${currentRound}.drawnCardUserId`]: null,
          [`rounds.${currentRound}.drawnCardSource`]: null,
          [`rounds.${currentRound}.pendingPowerDecision`]: null, // Clear pending power
          [`rounds.${currentRound}.actions`]: admin.firestore.FieldValue.arrayUnion(
             createAction('Discard', userId, { cardId: discardedCardId })
          ),
          [`rounds.${currentRound}.currentTurnPlayerId`]: getNextPlayerId(gameState.players, userId),
          updatedAt: now
        });
      });
      logger.info('discardDrawnCard V2', 'Success', { gameId, userId, discardedCardId });
      return { success: true, discardedCardId };
    } catch (error: any) {
      logger.error('discardDrawnCard V2', 'Failed', { error: error.message, gameId, userId });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Failed to discard drawn card.");
    }
  }
);

// --- attemptMatch (V2 Syntax) ---
export const attemptMatch = onCall<{ gameId: string; cardPosition: number }, Promise<{ success: boolean, matchSuccess: boolean }>>(
  { region: 'us-central1' }, 
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated");
    const userId = request.auth.uid;
    const { gameId, cardPosition } = request.data;
    
    if (!gameId || typeof cardPosition !== 'number' || cardPosition < 0 || cardPosition >= 4) {
      throw new HttpsError("invalid-argument", "Valid gameId and cardPosition are required.");
    }

    const gameDocRef = db.collection("scambodiaGames").doc(gameId);
    logger.info('attemptMatch V2', 'Attempting', { gameId, userId, cardPosition });
    let matchSuccessResult = false;
    const now = admin.firestore.Timestamp.now();

    try {
      await db.runTransaction(async (transaction) => {
        const gameDoc = await transaction.get(gameDocRef);
        if (!gameDoc.exists) throw new HttpsError("not-found", "Game not found.");
        const gameState = gameDoc.data();
        if (!gameState) throw new HttpsError("internal", "Game data missing");
        const currentRound = gameState.currentRoundNumber;
        const roundState = gameState.rounds[currentRound];
        if (!roundState) throw new HttpsError("not-found", `Round ${currentRound} not found.`);

        // Validation
        if (roundState.currentTurnPlayerId !== userId) throw new HttpsError("failed-precondition", "Not your turn.");
        if (roundState.drawnCard !== null) throw new HttpsError("failed-precondition", "Cannot attempt match after drawing.");
        if (roundState.discardPile.length === 0) throw new HttpsError("failed-precondition", "Discard pile is empty.");

        const topDiscardCard = roundState.discardPile[roundState.discardPile.length - 1];
        const playerCards = roundState.playerCards?.[userId];
        if (!playerCards) throw new HttpsError("internal", "Player cards not found.");
        const playerCardToMatch = playerCards[cardPosition];
        if (!playerCardToMatch) throw new HttpsError("invalid-argument", "No card at that position.");

        matchSuccessResult = topDiscardCard.rank === playerCardToMatch.rank;
        const actionBase = { cardPosition, discardCardId: topDiscardCard.id, playerCardId: playerCardToMatch.id, success: matchSuccessResult };
        
        if (matchSuccessResult) {
          const updatedPlayerCards = [...playerCards];
          updatedPlayerCards[cardPosition] = null;
          const updatedDiscardPile = roundState.discardPile.slice(0, -1);
          const updateData: Record<string, any> = {
            [`rounds.${currentRound}.playerCards.${userId}`]: updatedPlayerCards,
            [`rounds.${currentRound}.discardPile`]: updatedDiscardPile,
            [`rounds.${currentRound}.actions`]: admin.firestore.FieldValue.arrayUnion(createAction('MatchSuccess', userId, actionBase)),
             [`rounds.${currentRound}.drawnCard`]: null,
             [`rounds.${currentRound}.drawnCardUserId`]: null,
             [`rounds.${currentRound}.drawnCardSource`]: null,
             [`rounds.${currentRound}.pendingPowerDecision`]: null,
             [`rounds.${currentRound}.currentTurnPlayerId`]: getNextPlayerId(gameState.players, userId),
             updatedAt: now
          };
          transaction.update(gameDocRef, updateData);
        } else {
          transaction.update(gameDocRef, {
            [`rounds.${currentRound}.actions`]: admin.firestore.FieldValue.arrayUnion(createAction('MatchFail', userId, actionBase)),
            [`rounds.${currentRound}.drawnCard`]: null,
            [`rounds.${currentRound}.drawnCardUserId`]: null,
            [`rounds.${currentRound}.drawnCardSource`]: null,
            [`rounds.${currentRound}.pendingPowerDecision`]: null,
            [`rounds.${currentRound}.currentTurnPlayerId`]: getNextPlayerId(gameState.players, userId),
            updatedAt: now
          });
        }
      });
      logger.info('attemptMatch V2', 'Success', { gameId, userId, cardPosition, matchSuccess: matchSuccessResult });
      return { success: true, matchSuccess: matchSuccessResult };
    } catch (error: any) {
      logger.error('attemptMatch V2', 'Failed', { error: error.message, gameId, userId, cardPosition });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Failed to attempt match.");
    }
  }
);

// --- Skip Power Action (V2 Syntax) ---
export const skipPower = onCall<{ gameId: string }, Promise<{ success: boolean; discardedCardId?: string }>>(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated");
    const userId = request.auth.uid;
    const { gameId } = request.data;
    if (!gameId) throw new HttpsError("invalid-argument", "Valid gameId is required.");

    const gameDocRef = db.collection("scambodiaGames").doc(gameId);
    logger.info('skipPower V2', 'Attempting', { gameId, userId });
    let discardedCardId: string | undefined = undefined;
    const now = admin.firestore.Timestamp.now();

    try {
      await db.runTransaction(async (transaction) => {
        const gameDoc = await transaction.get(gameDocRef);
        if (!gameDoc.exists) throw new HttpsError("not-found", "Game not found.");
        const gameState = gameDoc.data();
        if (!gameState) throw new HttpsError("internal", "Game data missing");
        const currentRound = gameState.currentRoundNumber;
        const roundState = gameState.rounds[currentRound];
        if (!roundState) throw new HttpsError("not-found", `Round ${currentRound} not found.`);

        // Validation
        if (roundState.currentTurnPlayerId !== userId) throw new HttpsError("failed-precondition", "Not your turn.");
        // Ensure there is a pending power decision, which implies a power card was drawn
        if (!roundState.pendingPowerDecision || !roundState.drawnCard || roundState.drawnCardUserId !== userId) {
          throw new HttpsError("failed-precondition", "No pending power decision to skip.");
        }

        const cardToDiscard = roundState.drawnCard; // This is the power card being skipped
        discardedCardId = cardToDiscard.id;
        const updatedDiscardPile = [...roundState.discardPile, cardToDiscard];

        // Update game state: Discard the card, clear flags, advance turn
        transaction.update(gameDocRef, {
          [`rounds.${currentRound}.discardPile`]: updatedDiscardPile,
          [`rounds.${currentRound}.drawnCard`]: null,
          [`rounds.${currentRound}.drawnCardUserId`]: null,
          [`rounds.${currentRound}.drawnCardSource`]: null,
          [`rounds.${currentRound}.pendingPowerDecision`]: null, // Clear the pending decision
          [`rounds.${currentRound}.activePowerResolution`]: null, // Ensure no active power resolution is lingering
          [`rounds.${currentRound}.actions`]: admin.firestore.FieldValue.arrayUnion(
             createAction('SkipPower', userId, { cardId: discardedCardId })
          ),
          [`rounds.${currentRound}.currentTurnPlayerId`]: getNextPlayerId(gameState.players, userId),
          updatedAt: now
        });
      });
      logger.info('skipPower V2', 'Success', { gameId, userId, discardedCardId });
      return { success: true, discardedCardId };
    } catch (error: any) {
      logger.error('skipPower V2', 'Failed', { error: error.message, gameId, userId });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Failed to skip power.");
    }
  }
);

// --- triggerScoreCalculation (V2 Syntax) ---
export const triggerScoreCalculation = onCall<{ gameId: string; roundNumber: number }, Promise<{ success: boolean; scores: any; winnerId: string | null }>>(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      logger.error('triggerScoreCalculation', 'Authentication check failed: request.auth is missing.');
      throw new HttpsError("unauthenticated", "User must be authenticated.");
    }
    const { gameId, roundNumber } = request.data;
    if (!gameId || typeof roundNumber !== 'number') {
      throw new HttpsError("invalid-argument", "gameId and roundNumber are required.");
    }

    const gameDocRef = admin.firestore().doc(`scambodiaGames/${gameId}`);
    logger.info('triggerScoreCalculation', 'Attempting to calculate scores', { gameId, roundNumber, userId: request.auth.uid });

    try {
      return await admin.firestore().runTransaction(async (transaction) => {
        const gameDoc = await transaction.get(gameDocRef);
        if (!gameDoc.exists) throw new HttpsError("not-found", `Game ${gameId} not found.`);
        const gameState = gameDoc.data();
        if (!gameState) throw new HttpsError("internal", `Game data missing for ${gameId}.`);
        const roundState = gameState.rounds[roundNumber];
        if (!roundState) throw new HttpsError("not-found", `Round ${roundNumber} not found.`);
        if (roundState.scores && Object.keys(roundState.scores).length > 0) {
           logger.warn('triggerScoreCalculation', 'Scores already calculated', { gameId, roundNumber });
           return { success: true, scores: roundState.scores, winnerId: roundState.roundWinnerId };
        }
        if (roundState.phase !== 'Scoring') throw new HttpsError("failed-precondition", `Round not in Scoring phase.`);

        // Get initial calculated scores
        const { scores: calculatedScores, winnerId: calculatedWinnerId } = calculateScambodiaScores(roundState.playerCards);
        logger.info('triggerScoreCalculation', 'Raw scores calculated', { gameId, roundNumber, calculatedScores, calculatedWinnerId });

        // Create a copy of the scores for potential penalty application
        let finalScores = { ...calculatedScores };
        let scambodiaCorrect: boolean | undefined = undefined;
        const scambodiaCallsUpdate: { [key: string]: any } = {};
        
        // Check if someone declared Scambodia and apply penalty if needed
        if (roundState.playerDeclaredScambodia) {
          const declarerId = roundState.playerDeclaredScambodia;
          const declarerScore = calculatedScores[declarerId];
          
          // Check if declarer is uniquely lowest
          let isUniquelyLowest = true;
          
          // Find minimum score
          let lowestScore = Infinity;
          Object.values(calculatedScores).forEach(score => {
            if (score < lowestScore) lowestScore = score;
          });
          
          // Check if declarer is uniquely lowest (must have the lowest score and no ties)
          Object.entries(calculatedScores).forEach(([playerId, score]) => {
            // If any other player has equal or lower score, declarer isn't uniquely lowest
            if (playerId !== declarerId && score <= declarerScore) {
              isUniquelyLowest = false;
            }
          });
          
          scambodiaCorrect = isUniquelyLowest;
          
          if (scambodiaCorrect) {
            // If correct, increment successful calls counter
            const currentCalls = gameState.scambodiaCalls?.[declarerId] || 0;
            scambodiaCallsUpdate[`scambodiaCalls.${declarerId}`] = currentCalls + 1;
            logger.info('triggerScoreCalculation', 'Scambodia declaration correct', { 
              gameId, roundNumber, declarerId, score: declarerScore 
            });
          } else {
            // If incorrect, apply penalty - double the declarer's score
            finalScores[declarerId] = declarerScore * 2;
            logger.info('triggerScoreCalculation', 'Scambodia penalty applied', { 
              gameId, roundNumber, declarerId, originalScore: declarerScore, penalizedScore: finalScores[declarerId] 
            });
          }
        }

        // Update round with calculated scores and other relevant data
        const updateData: { [key: string]: any } = {
          [`rounds.${roundNumber}.scores`]: finalScores, // Use finalScores which may include penalties
          [`rounds.${roundNumber}.roundWinnerId`]: calculatedWinnerId,
          [`rounds.${roundNumber}.phase`]: 'Complete',
          updatedAt: admin.firestore.Timestamp.now(),
          ...scambodiaCallsUpdate
        };
        
        // Add scambodiaCorrect flag if applicable
        if (scambodiaCorrect !== undefined) {
          updateData[`rounds.${roundNumber}.scambodiaCorrect`] = scambodiaCorrect;
        }
        
        // Update cumulative scores for the game
        Object.entries(finalScores).forEach(([playerId, score]) => {
          const currentCumulativeScore = gameState.cumulativeScores?.[playerId] || 0;
          updateData[`cumulativeScores.${playerId}`] = currentCumulativeScore + score;
        });

        transaction.update(gameDocRef, updateData);
        return { success: true, scores: finalScores, winnerId: calculatedWinnerId };
      });
    } catch (error: any) {
      logger.error('triggerScoreCalculation', 'Failed', { error: error.message, gameId, roundNumber });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Failed to calculate scores.");
    }
  }
);

// --- Resolve Power Target Action (V2 Syntax) ---
export const resolvePowerTarget = onCall<{ gameId: string; targetData: any }, Promise<{ success: boolean; message: string }>>(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated");
    const userId = request.auth.uid;
    const { gameId, targetData } = request.data;
    if (!gameId || typeof targetData !== 'object') throw new HttpsError("invalid-argument", "Valid gameId and targetData are required");

    const gameDocRef = admin.firestore().doc(`scambodiaGames/${gameId}`);
    const now = admin.firestore.Timestamp.now();

    try {
      return await admin.firestore().runTransaction(async (transaction) => {
        const gameDoc = await transaction.get(gameDocRef);
        if (!gameDoc.exists) throw new HttpsError("not-found", `Game ${gameId} not found.`);
        const gameState = gameDoc.data();
        if (!gameState) throw new HttpsError("internal", `Game data missing for ${gameId}.`);

        const roundNum = gameState.currentRoundNumber;
        const roundState = gameState.rounds[roundNum];
        if (!roundState) throw new HttpsError("not-found", `Round ${roundNum} not found.`);

        // Validation
        if (roundState.currentTurnPlayerId !== userId) throw new HttpsError("failed-precondition", "Not your turn.");
        if (!roundState.activePowerResolution || roundState.activePowerResolution.step !== 'SelectingTarget') {
          throw new HttpsError("failed-precondition", "Not currently selecting target for power resolution.");
        }

        const powerType = roundState.activePowerResolution.type;
        const powerCard = roundState.activePowerResolution.card;

        // --- Apply Power Effect --- 
        let updatePayload: { [key: string]: any } = {};
        let finalStepRequired = true; // By default, we move to discarding card & ending turn
        let message = '';
        
        switch (powerType) {
          case 'Peek_Own': {
            const cardIndex = targetData.cardIndex;
            if (typeof cardIndex !== 'number' || cardIndex < 0 || cardIndex >= 4) throw new Error('Invalid cardIndex');
            // DO NOT modify visibleToPlayer permanently for peeks; frontend handles temporary view
            message = 'Card peeked temporarily.';
            logger.info('resolvePowerTarget', 'Peek_Own processed (client handles temporary view)', { gameId, userId, cardIndex });
            break;
          }
          case 'Peek_Opponent': {
            const targetPlayerId = targetData.targetPlayerId;
            const cardIndex = targetData.cardIndex;
            if (!targetPlayerId || typeof cardIndex !== 'number' || cardIndex < 0 || cardIndex >= 4) throw new Error('Invalid target data');
            // DO NOT modify visibleToPlayer permanently for peeks; frontend handles temporary view
            message = 'Opponent card peeked temporarily.';
            logger.info('resolvePowerTarget', 'Peek_Opponent processed (client handles temporary view)', { gameId, userId, targetPlayerId, cardIndex });
            break;
          }
          case 'Blind_Swap': {
            const sourceCardIndex = targetData.cardIndex;
            const targetPlayerId = targetData.targetPlayerId;
            const targetCardIndex = targetData.targetCardIndex;
            if (!targetPlayerId || typeof sourceCardIndex !== 'number' || sourceCardIndex < 0 || sourceCardIndex >= 4 || typeof targetCardIndex !== 'number' || targetCardIndex < 0 || targetCardIndex >= 4) throw new Error('Invalid target data for swap');
            if (targetPlayerId === userId) throw new Error('Cannot swap with self');
            
            const sourceCards = roundState.playerCards?.[userId];
            const targetCards = roundState.playerCards?.[targetPlayerId];
            if (!sourceCards || !targetCards) throw new Error('Missing card data for swap');
            
            const sourceCard = sourceCards[sourceCardIndex];
            const targetCard = targetCards[targetCardIndex];
            if (sourceCard === null || targetCard === null) throw new Error('Cannot swap empty slot');
            
            const newSourceCards = [...sourceCards];
            const newTargetCards = [...targetCards];
            newSourceCards[sourceCardIndex] = targetCard;
            newTargetCards[targetCardIndex] = sourceCard;
            
            updatePayload[`rounds.${roundNum}.playerCards.${userId}`] = newSourceCards;
            updatePayload[`rounds.${roundNum}.playerCards.${targetPlayerId}`] = newTargetCards;
            message = 'Cards swapped blindly.';
            break;
          }
          case 'Seen_Swap': {
            const targetPlayerId = targetData.targetPlayerId;
            
            // If skipSwap flag is true, we've peeked and decided not to swap
            if (targetData.skipSwap === true) {
              message = 'Peeked at opponent card and chose not to swap.';
              logger.info('resolvePowerTarget', 'Seen_Swap peek only (no swap)', { gameId, userId, targetPlayerId });
              break;
            }
            
            // If confirmSwap flag is present, we're completing the swap after peeking
            if (targetData.confirmSwap === true) {
              const sourceCardIndex = targetData.cardIndex;
              const targetCardIndex = targetData.targetCardIndex;
              
              if (!targetPlayerId || typeof sourceCardIndex !== 'number' || sourceCardIndex < 0 || sourceCardIndex >= 4 || typeof targetCardIndex !== 'number' || targetCardIndex < 0 || targetCardIndex >= 4) throw new Error('Invalid target data for swap');
              if (targetPlayerId === userId) throw new Error('Cannot swap with self');
              
              const sourceCards = roundState.playerCards?.[userId];
              const targetCards = roundState.playerCards?.[targetPlayerId];
              if (!sourceCards || !targetCards) throw new Error('Missing card data for swap');
              
              const sourceCard = sourceCards[sourceCardIndex];
              const targetCard = targetCards[targetCardIndex];
              if (sourceCard === null || targetCard === null) throw new Error('Cannot swap empty slot');
              
              const newSourceCards = [...sourceCards];
              const newTargetCards = [...targetCards];
              newSourceCards[sourceCardIndex] = targetCard;
              newTargetCards[targetCardIndex] = sourceCard;
              
              updatePayload[`rounds.${roundNum}.playerCards.${userId}`] = newSourceCards;
              updatePayload[`rounds.${roundNum}.playerCards.${targetPlayerId}`] = newTargetCards;
              message = 'Cards swapped after peeking.';
              
              // For Seen_Swap, DON'T update persistent visibility in the database
              // This is intentional - only the initiating player gets to peek temporarily
              // After the swap, cards should remain face-down
            } else {
              // First phase of Seen_Swap - just peek at the opponent's card
              // Set the active power resolution to "Peeked" state so frontend knows we're in middle step
              // DON'T end the turn yet - we need to give the player a chance to decide whether to swap
                            
              updatePayload[`rounds.${roundNum}.activePowerResolution`] = {
                ...roundState.activePowerResolution,
                step: 'EffectApplied',
                targetData: targetData,
                awaitingSwapDecision: true // Special flag for Seen_Swap to indicate we're in the "decide whether to swap" phase
              };
              
              message = 'Peeked at opponent card. Decide whether to swap.';
              finalStepRequired = false; // Don't discard card and end turn yet!
              logger.info('resolvePowerTarget', 'Seen_Swap first phase - peek only', { gameId, userId, targetPlayerId });
              break;
            }
            break;
          }
          default: throw new Error("Unhandled power type in resolvePowerTarget");
        }

        // --- Mark Effect Applied --- 
        if (!updatePayload[`rounds.${roundNum}.activePowerResolution`]) {
          updatePayload[`rounds.${roundNum}.activePowerResolution`] = {
            ...roundState.activePowerResolution,
            step: 'EffectApplied',
            targetData: targetData
          };
        }
        
        updatePayload[`rounds.${roundNum}.actions`] = admin.firestore.FieldValue.arrayUnion(
          createAction('ResolvePowerTarget', userId, { cardId: powerCard.id, powerType: powerType, targetData: targetData })
        );
        updatePayload.updatedAt = now;

        // Update necessary fields (player cards for swaps, actions, power state)
        transaction.update(gameDocRef, updatePayload);

        // --- Final Step: Discard Card & End Turn (unless it's the first step of Seen_Swap) --- 
        if (finalStepRequired) {
          const finalUpdatePayload: { [key: string]: any } = {
            [`rounds.${roundNum}.discardPile`]: admin.firestore.FieldValue.arrayUnion(powerCard),
            [`rounds.${roundNum}.activePowerResolution`]: null,
            [`rounds.${roundNum}.drawnCard`]: null,
            [`rounds.${roundNum}.drawnCardUserId`]: null,
            [`rounds.${roundNum}.drawnCardSource`]: null,
            [`rounds.${roundNum}.pendingPowerDecision`]: null,
            [`rounds.${roundNum}.currentTurnPlayerId`]: getNextPlayerId(gameState.players, userId),
            updatedAt: now
          };

          transaction.update(gameDocRef, finalUpdatePayload);
        }

        return { success: true, message };
      });
    } catch (error: any) {
      logger.error('resolvePowerTarget', 'Failed', { error: error.message, gameId, userId, targetData });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Failed to resolve power target.");
    }
  }
);

// --- Complete Initial Peek (V2 Syntax) ---
export const completeInitialPeek = onCall<{ gameId: string; playerId: string; roundNumber: number }, Promise<{ success: boolean }>>(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated");
    const userId = request.auth.uid;
    const { gameId, playerId, roundNumber } = request.data;
    
    // Ensure the authenticated user is the one completing their own peek
    if (userId !== playerId) throw new HttpsError("permission-denied", "You can only complete your own peek");
    
    if (!gameId || !playerId || typeof roundNumber !== 'number') {
      throw new HttpsError("invalid-argument", "gameId, playerId, and roundNumber are required");
    }

    const gameDocRef = admin.firestore().doc(`scambodiaGames/${gameId}`);
    logger.info('completeInitialPeek', 'Attempting', { gameId, playerId, roundNumber });
    const now = admin.firestore.Timestamp.now();

    try {
      return await admin.firestore().runTransaction(async (transaction) => {
        const gameDoc = await transaction.get(gameDocRef);
        if (!gameDoc.exists) throw new HttpsError("not-found", `Game ${gameId} not found`);
        const gameState = gameDoc.data();
        if (!gameState) throw new HttpsError("internal", `Game data missing for ${gameId}`);
        
        if (gameState.currentRoundNumber !== roundNumber) {
          throw new HttpsError("failed-precondition", `Current round ${gameState.currentRoundNumber} doesn't match requested round ${roundNumber}`);
        }
        
        const roundState = gameState.rounds[roundNumber];
        if (!roundState) throw new HttpsError("not-found", `Round ${roundNumber} not found`);
        
        // Ensure the round is in Setup phase
        if (roundState.phase !== 'Setup') {
          throw new HttpsError("failed-precondition", `Round is not in Setup phase: ${roundState.phase}`);
        }
        
        // Check if player has already completed peek
        const playersCompletedPeek = roundState.playersCompletedPeek || [];
        if (playersCompletedPeek.includes(playerId)) {
          logger.info('completeInitialPeek', 'Player already completed peek', { gameId, playerId, roundNumber });
          return { success: true };
        }
        
        // Add player to completed list
        const updatedCompletedPeek = [...playersCompletedPeek, playerId];
        
        // Check if all players have completed peek
        const allPlayersIds = gameState.players.map(p => p.userId);
        const allPlayersCompleted = allPlayersIds.every(id => updatedCompletedPeek.includes(id));
        
        const updateData: { [key: string]: any } = {
          [`rounds.${roundNumber}.playersCompletedPeek`]: updatedCompletedPeek,
          updatedAt: now
        };
        
        // If all players have peeked, transition to Playing phase
        if (allPlayersCompleted) {
          logger.info('completeInitialPeek', 'All players completed peek, transitioning to Playing', { gameId, roundNumber });
          updateData[`rounds.${roundNumber}.phase`] = 'Playing';
          updateData[`rounds.${roundNumber}.actions`] = admin.firestore.FieldValue.arrayUnion(
            createAction('InitialPeekComplete', playerId, { roundNumber })
          );
        } else {
          logger.info('completeInitialPeek', 'Player completed peek, waiting for others', { 
            gameId, playerId, roundNumber, 
            completed: updatedCompletedPeek.length, 
            total: allPlayersIds.length 
          });
        }
        
        transaction.update(gameDocRef, updateData);
        return { success: true };
      });
    } catch (error: any) {
      logger.error('completeInitialPeek', 'Failed', { error: error.message, gameId, playerId, roundNumber });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Failed to complete initial peek");
    }
  }
);

// DEBUG FUNCTIONS: Force game and round outcomes for testing purposes
export const forceScambodiaGameEndDebug = onCall<{ gameId: string; winningPlayerId: string }, Promise<{ success: boolean }>>( 
  { region: 'us-central1' }, 
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated');
    const { gameId, winningPlayerId } = request.data;
    const gameRef = db.collection('scambodiaGames').doc(gameId);
    const now = admin.firestore.Timestamp.now();
    try {
      await db.runTransaction(async (t) => {
        const snap = await t.get(gameRef);
        if (!snap.exists) throw new HttpsError('not-found', `Game ${gameId} not found.`);
        // Mark the game as finished and set the winner
        t.update(gameRef, {
          status: 'Finished',
          gameWinnerId: winningPlayerId,
          updatedAt: now
        });
      });
      logger.warn('forceScambodiaGameEndDebug', `Game ${gameId} forced to end. Winner: ${winningPlayerId}`);
      return { success: true };
    } catch (error: any) {
      logger.error('forceScambodiaGameEndDebug', 'Error forcing game end', { error, gameId, winningPlayerId });
      throw new HttpsError('internal', 'Failed to force game end');
    }
  }
);

export const forceScambodiaRoundEndDebug = onCall<{ gameId: string; winningPlayerId: string; roundNumber: number }, Promise<{ success: boolean }>>( 
  { region: 'us-central1' }, 
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated');
    const { gameId, winningPlayerId, roundNumber } = request.data;
    const gameRef = db.collection('scambodiaGames').doc(gameId);
    const now = admin.firestore.Timestamp.now();
    try {
      await db.runTransaction(async (t) => {
        const snap = await t.get(gameRef);
        if (!snap.exists) throw new HttpsError('not-found', `Game ${gameId} not found.`);
        const data = snap.data();
        if (!data?.rounds || !data.rounds[roundNumber]) {
          throw new HttpsError('not-found', `Round ${roundNumber} not found in game ${gameId}`);
        }
        // Force the round into scoring and set round winner
        t.update(gameRef, {
          [`rounds.${roundNumber}.phase`]: 'Scoring',
          [`rounds.${roundNumber}.roundWinnerId`]: winningPlayerId,
          updatedAt: now
        });
      });
      logger.warn('forceScambodiaRoundEndDebug', `Round ${roundNumber} of game ${gameId} forced to scoring. Winner: ${winningPlayerId}`);
      return { success: true };
    } catch (error: any) {
      logger.error('forceScambodiaRoundEndDebug', 'Error forcing round end', { error, gameId, winningPlayerId, roundNumber });
      throw new HttpsError('internal', 'Failed to force round end');
    }
  }
);

export const forceScambodiaRoundScoreDebug = onCall<{ gameId: string; winningPlayerId: string; roundNumber: number }, Promise<{ success: boolean }>>( 
  { region: 'us-central1' }, 
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated');
    const { gameId, winningPlayerId, roundNumber } = request.data;
    const gameRef = db.collection('scambodiaGames').doc(gameId);
    const now = admin.firestore.Timestamp.now();
    try {
      await db.runTransaction(async (t) => {
        const snap = await t.get(gameRef);
        if (!snap.exists) throw new HttpsError('not-found', `Game ${gameId} not found.`);
        const data = snap.data();
        if (!data?.rounds || !data.rounds[roundNumber]) {
          throw new HttpsError('not-found', `Round ${roundNumber} not found in game ${gameId}`);
        }
        // Force the round into scoring and set round winner (actual scoring Cloud Function will follow)
        t.update(gameRef, {
          [`rounds.${roundNumber}.phase`]: 'Scoring',
          [`rounds.${roundNumber}.roundWinnerId`]: winningPlayerId,
          updatedAt: now
        });
      });
      logger.warn('forceScambodiaRoundScoreDebug', `Round ${roundNumber} of game ${gameId} forced to scoring (score debug). Winner: ${winningPlayerId}`);
      return { success: true };
    } catch (error: any) {
      logger.error('forceScambodiaRoundScoreDebug', 'Error forcing round score', { error, gameId, winningPlayerId, roundNumber });
      throw new HttpsError('internal', 'Failed to force round score');
    }
  }
);
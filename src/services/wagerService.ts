import { doc, updateDoc, getDoc, serverTimestamp, increment, runTransaction } from 'firebase/firestore';
import { db, functions } from '../firebase';
import { processGamePayout } from './transactionService';
import { logger } from '../utils/logger';
import { GameStatus } from '../utils/constants';
import { httpsCallable } from 'firebase/functions';
import { v4 as uuidv4 } from 'uuid';

/**
 * Update the game document to use real money wager
 * @param gameId ID of the game
 * @param useRealMoney Whether to use real money for this game
 */
export const setGameWagerType = async (
  gameId: string,
  useRealMoney: boolean
): Promise<void> => {
  try {
    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      useRealMoney,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    logger.error('wagerService', 'Failed to set game wager type', { gameId, error });
    throw error;
  }
};

// Function to debit wagers from both players
const debitWagersForGame = async (
  gameId: string,
  player1Id: string,
  player2Id: string,
  wagerAmount: number
): Promise<{ success: boolean }> => {
  try {
    // Generate a unique idempotency key to prevent duplicate transactions
    const idempotencyKey = `wager_${gameId}_${Date.now()}_${uuidv4().substring(0, 8)}`;
    
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
 * Process wager debits when a game starts
 * @param gameId ID of the game
 * @param player1Id ID of the first player (creator)
 * @param player2Id ID of the second player (joiner)
 * @param wagerAmount Amount to wager
 * @param useRealMoney Whether to use real money for this game
 */
export const processGameStart = async (
  gameId: string,
  player1Id: string,
  player2Id: string,
  wagerAmount: number,
  useRealMoney: boolean
): Promise<boolean> => {
  try {
    if (useRealMoney) {
      // Handle real money transaction through Firebase Functions
      const result = await debitWagersForGame(gameId, player1Id, player2Id, wagerAmount);
      return result.success;
    } else {
      // Handle in-game currency through Firestore transactions
      
      // Generate a unique idempotency key for tracking this transaction
      const idempotencyKey = `wager_${gameId}_${Date.now()}_${uuidv4().substring(0, 8)}`;
      
      await runTransaction(db, async (transaction) => {
        // Get player documents
        const player1Ref = doc(db, 'users', player1Id);
        const player2Ref = doc(db, 'users', player2Id);
        
        const player1Doc = await transaction.get(player1Ref);
        const player2Doc = await transaction.get(player2Ref);
        
        if (!player1Doc.exists() || !player2Doc.exists()) {
          throw new Error('One or both players do not exist');
        }
        
        const player1Balance = player1Doc.data().balance || 0;
        const player2Balance = player2Doc.data().balance || 0;
        
        // Check balances
        if (player1Balance < wagerAmount) {
          throw new Error('Player 1 has insufficient balance');
        }
        
        if (player2Balance < wagerAmount) {
          throw new Error('Player 2 has insufficient balance');
        }
        
        // Debit both players
        transaction.update(player1Ref, {
          balance: increment(-wagerAmount),
          updatedAt: serverTimestamp(),
        });
        
        transaction.update(player2Ref, {
          balance: increment(-wagerAmount),
          updatedAt: serverTimestamp(),
        });
        
        // Create transaction records (for tracking and idempotency)
        const transactionsColRef = doc(db, 'transactions', `${gameId}_p1_${Date.now()}`);
        transaction.set(transactionsColRef, {
          userId: player1Id,
          type: 'wager_debit',
          amount: wagerAmount,
          status: 'completed',
          timestamp: serverTimestamp(),
          relatedGameId: gameId,
          idempotencyKey,
          notes: `Wager debited for game ${gameId}`
        });
        
        const transactionsColRef2 = doc(db, 'transactions', `${gameId}_p2_${Date.now()}`);
        transaction.set(transactionsColRef2, {
          userId: player2Id,
          type: 'wager_debit',
          amount: wagerAmount,
          status: 'completed',
          timestamp: serverTimestamp(),
          relatedGameId: gameId,
          idempotencyKey,
          notes: `Wager debited for game ${gameId}`
        });
      });
      
      return true;
    }
  } catch (error: any) {
    console.error('Error processing game start:', error);
    throw error;
  }
};

/**
 * Process game end and handle payouts
 * @param gameId ID of the game
 * @param winnerId ID of the winner (null if draw)
 * @param loserId ID of the loser (null if draw)
 * @param isDraw Whether the game is a draw
 * @param wagerAmount Amount wagered per player
 * @param useRealMoney Whether to use real money for this game
 */
export const processGameEnd = async (
  gameId: string,
  winnerId: string | null,
  loserId: string | null,
  isDraw: boolean,
  wagerAmount: number,
  useRealMoney: boolean
): Promise<boolean> => {
  try {
    logger.info('wagerService', 'Processing game end', { 
      gameId, 
      winnerId, 
      loserId, 
      isDraw, 
      wagerAmount,
      useRealMoney
    });

    // Generate a unique idempotency key for this payout operation
    const idempotencyKey = `payout_${gameId}_${Date.now()}_${uuidv4().substring(0, 8)}`;
    
    if (useRealMoney) {
      // Handle real money payout through Cloud Functions
      const payoutFn = httpsCallable(functions, 'processGamePayout');
      const result = await payoutFn({ 
        gameId, 
        winnerId, 
        loserId, 
        isDraw, 
        wagerAmount,
        idempotencyKey
      });
      
      const payoutResult = result.data as { success: boolean };
      logger.info('wagerService', 'Real money payout processed', { 
        gameId, 
        result: payoutResult 
      });
      
      return payoutResult.success;
    } else {
      // Handle in-game currency through Firestore transactions
      await runTransaction(db, async (transaction) => {
        // Get game document first to check if payout already processed
        const gameRef = doc(db, 'games', gameId);
        const gameDoc = await transaction.get(gameRef);
        
        if (!gameDoc.exists()) {
          throw new Error('Game not found');
        }
        
        const gameData = gameDoc.data();
        
        if (gameData?.payoutProcessed) {
          logger.warn('wagerService', 'Payout already processed', { gameId });
          return; // Exit early if already processed
        }
        
        if (isDraw) {
          // In case of a draw, return wagered amount to both players
          if (winnerId) {
            const winnerRef = doc(db, 'users', winnerId);
            transaction.update(winnerRef, {
              balance: increment(wagerAmount),
              updatedAt: serverTimestamp()
            });
            
            const transactionRef1 = doc(db, 'transactions', `${gameId}_draw_p1_${Date.now()}`);
            transaction.set(transactionRef1, {
              userId: winnerId,
              type: 'wager_refund',
              amount: wagerAmount, 
              status: 'completed',
              timestamp: serverTimestamp(),
              relatedGameId: gameId,
              idempotencyKey,
              notes: `Refund for draw in game ${gameId}`
            });
          }
          
          if (loserId) {
            const loserRef = doc(db, 'users', loserId);
            transaction.update(loserRef, {
              balance: increment(wagerAmount),
              updatedAt: serverTimestamp()
            });
            
            const transactionRef2 = doc(db, 'transactions', `${gameId}_draw_p2_${Date.now()}`);
            transaction.set(transactionRef2, {
              userId: loserId,
              type: 'wager_refund',
              amount: wagerAmount,
              status: 'completed',
              timestamp: serverTimestamp(),
              relatedGameId: gameId,
              idempotencyKey,
              notes: `Refund for draw in game ${gameId}`
            });
          }
        } else if (winnerId) {
          // Calculate total pot and platform fee
          const totalPot = wagerAmount * 2;
          const platformFee = Math.floor(totalPot * 0.05); // 5% platform fee
          const winnerPayout = totalPot - platformFee;
          
          // Update winner's balance
          const winnerRef = doc(db, 'users', winnerId);
          transaction.update(winnerRef, {
            balance: increment(winnerPayout),
            updatedAt: serverTimestamp()
          });
          
          // Record the payout transaction
          const transactionRef = doc(db, 'transactions', `${gameId}_payout_${Date.now()}`);
          transaction.set(transactionRef, {
            userId: winnerId,
            type: 'wager_payout',
            amount: winnerPayout,
            status: 'completed',
            timestamp: serverTimestamp(),
            relatedGameId: gameId,
            platformFee,
            idempotencyKey,
            notes: `Winnings from game ${gameId} (after 5% platform fee)`
          });
        }
        
        // Mark the game as having processed payout
        transaction.update(gameRef, {
          payoutProcessed: true,
          payoutTimestamp: serverTimestamp()
        });
      });
      
      logger.info('wagerService', 'In-game currency payout processed', { 
        gameId, 
        isDraw, 
        winnerId 
      });
      
      return true;
    }
  } catch (error: any) {
    logger.error('wagerService', 'Failed to process game end payout', { 
      error: error.message, 
      gameId 
    });
    return false;
  }
}; 
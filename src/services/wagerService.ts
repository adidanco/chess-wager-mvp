import { doc, updateDoc, getDoc, serverTimestamp, increment, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { debitWagersForGame, processGamePayout } from './transactionService';
import { logger } from '../utils/logger';
import { GameStatus } from '../utils/constants';

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
        
        // Update game
        const gameRef = doc(db, 'games', gameId);
        transaction.update(gameRef, {
          wagersDebited: true,
          wagerDebitTimestamp: serverTimestamp(),
        });
      });
      
      return true;
    }
  } catch (error) {
    logger.error('wagerService', 'Failed to process game start wager', { 
      gameId, 
      player1Id, 
      player2Id, 
      wagerAmount,
      useRealMoney,
      error 
    });
    return false;
  }
};

/**
 * Process payouts when a game ends
 * @param gameId ID of the game
 * @param winnerId ID of the winner (null for draw)
 * @param loserId ID of the loser (null for draw)
 * @param isDraw Whether the game ended in a draw
 * @param wagerAmount Amount that was wagered
 * @param useRealMoney Whether real money was used for this game
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
    // Get game document to check if wagers were debited
    const gameRef = doc(db, 'games', gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      logger.error('wagerService', 'Game not found', { gameId });
      return false;
    }
    
    const gameData = gameDoc.data();
    
    if (!gameData.wagersDebited) {
      logger.error('wagerService', 'Wagers were not debited for this game', { gameId });
      return false;
    }
    
    // Check if payout was already processed
    if (gameData.payoutProcessed) {
      logger.info('wagerService', 'Payout already processed for this game', { gameId });
      return true;
    }
    
    if (useRealMoney) {
      // Handle real money transaction through Firebase Functions
      const result = await processGamePayout(gameId, winnerId, loserId, isDraw, wagerAmount);
      return result.success;
    } else {
      // Handle in-game currency through Firestore transactions
      await runTransaction(db, async (transaction) => {
        if (isDraw) {
          // Refund both players
          if (winnerId && loserId) {
            const winner = doc(db, 'users', winnerId);
            const loser = doc(db, 'users', loserId);
            
            transaction.update(winner, {
              balance: increment(wagerAmount),
              updatedAt: serverTimestamp(),
            });
            
            transaction.update(loser, {
              balance: increment(wagerAmount),
              updatedAt: serverTimestamp(),
            });
          }
        } else if (winnerId) {
          // Winner takes all (minus platform fee)
          const winner = doc(db, 'users', winnerId);
          const poolAmount = wagerAmount * 2;
          const platformFee = poolAmount * 0.2; // 20% platform fee
          const payoutAmount = poolAmount - platformFee;
          
          transaction.update(winner, {
            balance: increment(payoutAmount),
            updatedAt: serverTimestamp(),
          });
        }
        
        // Mark payout as processed
        transaction.update(gameRef, {
          payoutProcessed: true,
          payoutTimestamp: serverTimestamp(),
        });
      });
      
      return true;
    }
  } catch (error) {
    logger.error('wagerService', 'Failed to process game end payout', { 
      gameId, 
      winnerId, 
      loserId,
      isDraw,
      wagerAmount,
      useRealMoney,
      error
    });
    return false;
  }
}; 
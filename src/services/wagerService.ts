import { doc, updateDoc, getDoc, serverTimestamp, increment, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { debitWagersForGame, processGamePayout } from './transactionService';
import { logger } from '../utils/logger';
import { GameStatus } from '../utils/constants';

/**
 * Process wager debits when a game starts
 * @param gameId ID of the game
 * @param player1Id ID of the first player (creator)
 * @param player2Id ID of the second player (joiner)
 * @param wagerAmount Amount to wager
 */
export const processGameStart = async (
  gameId: string,
  player1Id: string,
  player2Id: string,
  wagerAmount: number
): Promise<boolean> => {
  try {
    // Handle real money transaction through Firebase Functions
    const result = await debitWagersForGame(gameId, player1Id, player2Id, wagerAmount);
    return result.success;
  } catch (error) {
    logger.error('wagerService', 'Failed to process game start', { 
      gameId, 
      player1Id, 
      player2Id,
      wagerAmount,
      error
    });
    return false;
  }
};

/**
 * Process game end and payout
 * @param gameId The game ID
 * @param winnerId The winner's user ID (null for draw)
 * @param loserId The loser's user ID (null for draw)
 * @param isDraw Whether the game ended in a draw
 * @param wagerAmount The amount wagered per player
 */
export const processGameEnd = async (
  gameId: string,
  winnerId: string | null,
  loserId: string | null,
  isDraw: boolean,
  wagerAmount: number
): Promise<boolean> => {
  try {
    logger.info('wagerService', 'Processing game end', { 
      gameId, 
      winnerId, 
      loserId,
      isDraw,
      wagerAmount
    });
    
    const gameRef = doc(db, "games", gameId);
    
    // Handle transaction through Firebase Functions
    // The cloud function will:
    // 1. For a win: Add wager amount * 2 - platform fee to the winner's balance
    //    and ALSO add the PROFIT PORTION to the winner's withdrawableBalance
    //    (only the profit, not their original wager)
    // 2. For a draw: Refund both players their original wagers
    const result = await processGamePayout(gameId, winnerId, loserId, isDraw, wagerAmount);
    return result.success;
  } catch (error) {
    logger.error('wagerService', 'Failed to process game end payout', { 
      gameId, 
      winnerId, 
      loserId,
      isDraw,
      wagerAmount,
      error
    });
    return false;
  }
}; 
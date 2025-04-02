/**
 * Rating Service
 * 
 * This service handles updating player ratings after completed games.
 * It interfaces with Firestore to fetch and update player rating data.
 */

import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { logger } from "../utils/logger";
import { 
  GlickoRating, 
  GameResult, 
  updateRating, 
  createGameResult 
} from "../utils/ratingSystem";
import { UserProfile } from "chessTypes";

/**
 * Convert a user's stats data to a GlickoRating object
 */
export function userStatsToGlickoRating(user: UserProfile): GlickoRating {
  return {
    rating: user.stats?.eloRating || 1500,
    rd: user.stats?.ratingDeviation || 350,
    vol: user.stats?.volatility || 0.06,
    lastPlayedTimestamp: user.stats?.lastPlayedTimestamp || Date.now()
  };
}

/**
 * Update player ratings after a game is completed
 * @param gameId The ID of the completed game
 * @param playerOneId ID of the first player (white)
 * @param playerTwoId ID of the second player (black)
 * @param result 'win' | 'loss' | 'draw' from the perspective of player one
 * @returns True if the update was successful
 */
export async function updateRatingsAfterGame(
  gameId: string,
  playerOneId: string, 
  playerTwoId: string, 
  result: 'win' | 'loss' | 'draw'
): Promise<boolean> {
  try {
    logger.info('RatingService', 'Updating ratings after game', {
      gameId,
      playerOneId,
      playerTwoId,
      result
    });

    // Get both player profiles
    const playerOneDoc = await getDoc(doc(db, "users", playerOneId));
    const playerTwoDoc = await getDoc(doc(db, "users", playerTwoId));

    if (!playerOneDoc.exists() || !playerTwoDoc.exists()) {
      logger.error('RatingService', 'Player document not found', {
        playerOneExists: playerOneDoc.exists(),
        playerTwoExists: playerTwoDoc.exists()
      });
      return false;
    }

    const playerOne = playerOneDoc.data() as UserProfile;
    const playerTwo = playerTwoDoc.data() as UserProfile;

    // Convert to Glicko rating objects
    const playerOneRating = userStatsToGlickoRating(playerOne);
    const playerTwoRating = userStatsToGlickoRating(playerTwo);

    // Create game results (from each player's perspective)
    const playerOneResult = createGameResult(
      playerTwoRating.rating,
      playerTwoRating.rd,
      result,
      Date.now()
    );

    const playerTwoResult = createGameResult(
      playerOneRating.rating,
      playerOneRating.rd,
      result === 'win' ? 'loss' : (result === 'loss' ? 'win' : 'draw'),
      Date.now()
    );

    // Calculate new ratings
    const newPlayerOneRating = updateRating(playerOneRating, [playerOneResult]);
    const newPlayerTwoRating = updateRating(playerTwoRating, [playerTwoResult]);

    // Update stats records
    const now = Date.now().toString();
    const playerOneWins = result === 'win' ? (playerOne.stats?.wins || 0) + 1 : (playerOne.stats?.wins || 0);
    const playerOneLosses = result === 'loss' ? (playerOne.stats?.losses || 0) + 1 : (playerOne.stats?.losses || 0);
    const playerOneDraws = result === 'draw' ? (playerOne.stats?.draws || 0) + 1 : (playerOne.stats?.draws || 0);
    const playerTwoWins = result === 'loss' ? (playerTwo.stats?.wins || 0) + 1 : (playerTwo.stats?.wins || 0);
    const playerTwoLosses = result === 'win' ? (playerTwo.stats?.losses || 0) + 1 : (playerTwo.stats?.losses || 0);
    const playerTwoDraws = result === 'draw' ? (playerTwo.stats?.draws || 0) + 1 : (playerTwo.stats?.draws || 0);

    // Update player one
    await updateDoc(doc(db, "users", playerOneId), {
      "stats.eloRating": newPlayerOneRating.rating,
      "stats.ratingDeviation": newPlayerOneRating.rd,
      "stats.volatility": newPlayerOneRating.vol,
      "stats.lastPlayedTimestamp": newPlayerOneRating.lastPlayedTimestamp,
      "stats.wins": playerOneWins,
      "stats.losses": playerOneLosses,
      "stats.draws": playerOneDraws,
      "eloRating": newPlayerOneRating.rating,
      [`stats.eloHistory.${now}`]: newPlayerOneRating.rating,
      "updatedAt": serverTimestamp()
    });

    // Update player two
    await updateDoc(doc(db, "users", playerTwoId), {
      "stats.eloRating": newPlayerTwoRating.rating,
      "stats.ratingDeviation": newPlayerTwoRating.rd,
      "stats.volatility": newPlayerTwoRating.vol,
      "stats.lastPlayedTimestamp": newPlayerTwoRating.lastPlayedTimestamp,
      "stats.wins": playerTwoWins,
      "stats.losses": playerTwoLosses,
      "stats.draws": playerTwoDraws,
      "eloRating": newPlayerTwoRating.rating,
      [`stats.eloHistory.${now}`]: newPlayerTwoRating.rating,
      "updatedAt": serverTimestamp()
    });

    logger.info('RatingService', 'Ratings updated successfully', {
      gameId,
      playerOne: {
        oldRating: playerOneRating.rating,
        newRating: newPlayerOneRating.rating,
        ratingChange: newPlayerOneRating.rating - playerOneRating.rating
      },
      playerTwo: {
        oldRating: playerTwoRating.rating,
        newRating: newPlayerTwoRating.rating,
        ratingChange: newPlayerTwoRating.rating - playerTwoRating.rating
      }
    });

    return true;
  } catch (error) {
    const err = error as Error;
    logger.error('RatingService', 'Failed to update ratings', { error: err });
    return false;
  }
}

/**
 * Calculate the expected outcome of a game
 * @param playerOneId ID of first player
 * @param playerTwoId ID of second player
 * @returns Object with win probabilities or null if data is not available
 */
export async function calculateMatchupProbabilities(
  playerOneId: string,
  playerTwoId: string
): Promise<{ playerOneWinProb: number, drawProb: number, playerTwoWinProb: number } | null> {
  try {
    // Get both player profiles
    const playerOneDoc = await getDoc(doc(db, "users", playerOneId));
    const playerTwoDoc = await getDoc(doc(db, "users", playerTwoId));

    if (!playerOneDoc.exists() || !playerTwoDoc.exists()) {
      return null;
    }

    const playerOne = playerOneDoc.data() as UserProfile;
    const playerTwo = playerTwoDoc.data() as UserProfile;

    // Convert to Glicko rating objects
    const playerOneRating = userStatsToGlickoRating(playerOne);
    const playerTwoRating = userStatsToGlickoRating(playerTwo);

    // Calculate expected score for player one (probability of winning)
    const expectedScoreOne = 1 / (1 + Math.pow(10, (playerTwoRating.rating - playerOneRating.rating) / 400));
    
    // Draw probability is higher when ratings are closer
    // This is a simple model; more sophisticated models exist
    const ratingDiff = Math.abs(playerOneRating.rating - playerTwoRating.rating);
    const drawProbability = Math.max(0, 0.30 - (ratingDiff / 2000)); // More draws when ratings are close
    
    // Adjust win probabilities proportionally to allow for draws
    const adjustedPlayerOneWinProb = expectedScoreOne * (1 - drawProbability);
    const adjustedPlayerTwoWinProb = (1 - expectedScoreOne) * (1 - drawProbability);

    return {
      playerOneWinProb: adjustedPlayerOneWinProb,
      drawProb: drawProbability,
      playerTwoWinProb: adjustedPlayerTwoWinProb
    };
  } catch (error) {
    logger.error('RatingService', 'Failed to calculate matchup probabilities', { error });
    return null;
  }
} 
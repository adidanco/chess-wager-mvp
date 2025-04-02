/**
 * Matchmaking Service
 * 
 * This service helps find appropriate opponents based on rating similarity.
 * It calculates a compatibility score between players and suggests good matches.
 */

import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";
import { logger } from "../utils/logger";
import { calculateWinProbability } from "../utils/ratingSystem";
import { userStatsToGlickoRating } from "./ratingService";
import { UserProfile } from "chessTypes";

/**
 * Match compatibility result
 */
export interface MatchCompatibility {
  userId: string;
  username: string;
  rating: number;
  ratingDeviation: number;
  winProbability: number; // Probability of the requestor winning
  loseProbability: number; // Probability of the requestor losing
  drawProbability: number; // Probability of a draw
  totalGames: number;
  compatibilityScore: number; // 0-100 score of how well matched these players are
}

/**
 * Find potential opponents close to the player's rating
 * @param userId The user ID of the player looking for opponents
 * @param ratingRange How far to search from the player's rating (default ±300)
 * @param maxResults Maximum number of results to return
 * @returns Array of potential opponents with compatibility information
 */
export async function findPotentialOpponents(
  userId: string,
  ratingRange: number = 300,
  maxResults: number = 10
): Promise<MatchCompatibility[]> {
  try {
    // First, get the user's rating
    const userDoc = await getDocs(query(
      collection(db, "users"),
      where("__name__", "==", userId)
    ));
    
    if (userDoc.empty) {
      logger.error('MatchmakingService', 'User not found', { userId });
      return [];
    }
    
    const user = userDoc.docs[0].data() as UserProfile;
    const userRating = user.stats?.eloRating || 1500;
    const userGlickoRating = userStatsToGlickoRating(user);
    
    // Find players within the rating range
    const minRating = userRating - ratingRange;
    const maxRating = userRating + ratingRange;
    
    const potentialOpponents = await getDocs(query(
      collection(db, "users"),
      where("stats.eloRating", ">=", minRating),
      where("stats.eloRating", "<=", maxRating),
      where("__name__", "!=", userId),
      orderBy("stats.eloRating"),
      limit(maxResults * 2) // Get more than we need because we'll filter further
    ));
    
    if (potentialOpponents.empty) {
      logger.info('MatchmakingService', 'No potential opponents found in rating range', {
        userId,
        userRating,
        minRating,
        maxRating
      });
      return [];
    }
    
    // Calculate compatibility for each potential opponent
    const matches: MatchCompatibility[] = [];
    
    for (const doc of potentialOpponents.docs) {
      const opponent = doc.data() as UserProfile;
      const opponentGlickoRating = userStatsToGlickoRating(opponent);
      
      // Calculate win probability using Glicko-2
      const winProbability = calculateWinProbability(userGlickoRating, opponentGlickoRating);
      
      // Draw probability is higher when ratings are closer
      const ratingDiff = Math.abs(userRating - (opponent.stats?.eloRating || 1500));
      const drawProbability = Math.max(0, 0.30 - (ratingDiff / 2000));
      
      // Adjusted probabilities accounting for draws
      const adjustedWinProb = winProbability * (1 - drawProbability);
      const adjustedLoseProb = (1 - winProbability) * (1 - drawProbability);
      
      // Calculate compatibility score - higher for more even matchups
      // Perfect match is when win probability is 0.5 (50/50 chance)
      const evenness = 1 - Math.abs(0.5 - winProbability);
      
      // Activity factor - prefer more active players
      const totalGames = (opponent.stats?.wins || 0) + 
                         (opponent.stats?.losses || 0) + 
                         (opponent.stats?.draws || 0);
      const activityFactor = Math.min(1, totalGames / 20); // Normalize with max at 20 games
      
      // Final compatibility score (0-100)
      const compatibilityScore = Math.round((evenness * 0.7 + activityFactor * 0.3) * 100);
      
      matches.push({
        userId: doc.id,
        username: opponent.username || 'Unknown',
        rating: opponent.stats?.eloRating || 1500,
        ratingDeviation: opponent.stats?.ratingDeviation || 350,
        winProbability: adjustedWinProb,
        loseProbability: adjustedLoseProb,
        drawProbability,
        totalGames,
        compatibilityScore
      });
    }
    
    // Sort by compatibility score (highest first)
    matches.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
    
    // Return up to maxResults
    return matches.slice(0, maxResults);
    
  } catch (error) {
    logger.error('MatchmakingService', 'Error finding potential opponents', { error, userId });
    return [];
  }
}

/**
 * Find the best available games that match the player's rating
 * @param userId The user ID of the player looking for games
 * @param ratingRange How far to search from the player's rating
 * @param maxResults Maximum number of results to return
 * @returns Array of game IDs sorted by compatibility
 */
export async function findCompatibleGames(
  userId: string,
  ratingRange: number = 300,
  maxResults: number = 5
): Promise<string[]> {
  try {
    // First, get the user's rating
    const userDoc = await getDocs(query(
      collection(db, "users"),
      where("__name__", "==", userId)
    ));
    
    if (userDoc.empty) {
      logger.error('MatchmakingService', 'User not found', { userId });
      return [];
    }
    
    const user = userDoc.docs[0].data() as UserProfile;
    const userRating = user.stats?.eloRating || 1500;
    
    // Find available games created by players within the rating range
    const games = await getDocs(query(
      collection(db, "games"),
      where("status", "==", "waiting"),
      where("player1Id", "!=", userId)
    ));
    
    if (games.empty) {
      logger.info('MatchmakingService', 'No available games found', { userId });
      return [];
    }
    
    // Get creator ratings and calculate compatibility
    const gamePromises = games.docs.map(async (gameDoc) => {
      const game = gameDoc.data();
      const creatorId = game.player1Id;
      
      if (!creatorId) return null;
      
      const creatorDoc = await getDocs(query(
        collection(db, "users"),
        where("__name__", "==", creatorId)
      ));
      
      if (creatorDoc.empty) return null;
      
      const creator = creatorDoc.docs[0].data() as UserProfile;
      const creatorRating = creator.stats?.eloRating || 1500;
      
      // Calculate rating difference and compatibility score
      const ratingDiff = Math.abs(userRating - creatorRating);
      
      // Skip if outside rating range
      if (ratingDiff > ratingRange) return null;
      
      // Higher score for closer ratings
      const compatibilityScore = 100 - (ratingDiff / ratingRange) * 100;
      
      return {
        gameId: gameDoc.id,
        compatibilityScore,
        creatorRating
      };
    });
    
    const gameResults = await Promise.all(gamePromises);
    
    // Filter out null results, sort by compatibility score
    const compatibleGames = gameResults
      .filter(result => result !== null)
      .sort((a, b) => b!.compatibilityScore - a!.compatibilityScore)
      .slice(0, maxResults)
      .map(game => game!.gameId);
    
    return compatibleGames;
    
  } catch (error) {
    logger.error('MatchmakingService', 'Error finding compatible games', { error, userId });
    return [];
  }
} 
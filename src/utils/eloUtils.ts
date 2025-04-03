/**
 * ELO Rating System Utilities
 * 
 * This file contains functions for calculating ELO ratings based on game outcomes.
 * The ELO rating system is a method for calculating the relative skill levels of players.
 */

import { logger, createLogger } from './logger'
// Create a component-specific logger
const eloUtilsLogger = createLogger('eloUtils');
;

// Default constants for ELO calculations
const DEFAULT_K_FACTOR = 32; // Standard K-factor for regular players
const DEFAULT_INITIAL_RATING = 1200; // Starting rating for new players
const MAX_RATING_CHANGE = 100; // Limit on maximum rating change per game

/**
 * Calculate the expected score (win probability) for a player
 * @param playerRating The player's current rating
 * @param opponentRating The opponent's current rating
 * @returns A value between 0 and 1 representing win probability
 */
export const calculateExpectedScore = (playerRating: number, opponentRating: number): number => {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
};

/**
 * Calculate the new ELO rating after a game
 * @param currentRating The player's current rating
 * @param opponentRating The opponent's rating
 * @param actualScore The actual outcome (1 for win, 0.5 for draw, 0 for loss)
 * @param kFactor The K-factor to use (default 32)
 * @returns The player's new rating as an integer
 */
export const calculateNewRating = (
  currentRating: number,
  opponentRating: number,
  actualScore: number,
  kFactor: number = DEFAULT_K_FACTOR
): number => {
  // Ensure current rating has a valid value
  if (currentRating === undefined || currentRating === null) {
    currentRating = DEFAULT_INITIAL_RATING;
  }

  const expectedScore = calculateExpectedScore(currentRating, opponentRating);
  let ratingChange = kFactor * (actualScore - expectedScore);
  
  // Limit the maximum rating change
  ratingChange = Math.max(Math.min(ratingChange, MAX_RATING_CHANGE), -MAX_RATING_CHANGE);
  
  // Round to nearest integer and ensure rating is never negative
  const newRating = Math.max(0, Math.round(currentRating + ratingChange));
  
  eloUtilsLogger.info('Rating calculation', {
    currentRating,
    opponentRating,
    expectedScore,
    actualScore,
    ratingChange,
    newRating
  });
  
  return newRating;
};

/**
 * Get the appropriate K-factor based on a player's rating and game count
 * 
 * The K-factor determines how much the rating can change after each game:
 * - Higher K-factor: Ratings change more rapidly
 * - Lower K-factor: Ratings are more stable
 * 
 * This implements a variable K-factor system where:
 * - New players have higher K to establish their true rating quickly
 * - High-rated players have lower K for more stability
 * 
 * @param rating Player's current rating
 * @param gameCount Total number of games played
 * @returns The appropriate K-factor to use
 */
export const getKFactor = (rating: number, gameCount: number): number => {
  // New players (less than 20 games) get higher K-factor to find their true rating quickly
  if (gameCount < 20) {
    return 40;
  }
  
  // High-rated players get lower K-factor for more stability
  if (rating > 2000) {
    return 16;
  }
  
  // Standard K-factor for everyone else
  return DEFAULT_K_FACTOR;
};

/**
 * Get a rating classification based on ELO score
 * @param rating The player's ELO rating
 * @returns A string classification of the player's skill level
 */
export const getRatingClassification = (rating: number): string => {
  if (rating < 1200) return "Beginner";
  if (rating < 1400) return "Casual Player";
  if (rating < 1600) return "Intermediate";
  if (rating < 1800) return "Advanced";
  if (rating < 2000) return "Expert";
  if (rating < 2200) return "Master";
  return "Grandmaster";
};

/**
 * Get initial ELO rating for a new player
 * @returns The default initial rating
 */
export const getInitialRating = (): number => {
  return DEFAULT_INITIAL_RATING;
}; 
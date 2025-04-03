/**
 * Glicko-2 Rating System Implementation
 * 
 * This is a production-level implementation of the Glicko-2 rating system,
 * which is used by Lichess and many other chess platforms. Glicko-2 improves upon
 * traditional Elo by tracking rating volatility and confidence intervals.
 * 
 * Reference: http://www.glicko.net/glicko/glicko2.pdf
 */

import { logger, createLogger } from './logger'
// Create a component-specific logger
const ratingSystemLogger = createLogger('ratingSystem');
;

/**
 * Player rating data
 */
export interface GlickoRating {
  rating: number;       // The player's rating (like Elo)
  rd: number;           // Rating deviation - uncertainty in the rating (lower is more certain)
  vol: number;          // Volatility - how consistent the player's performance is
  lastPlayedTimestamp?: number; // Last time the player played a rated game (for rating decay)
}

/**
 * Rating period result
 */
export interface GameResult {
  opponentRating: number;   // Opponent's rating
  opponentRD: number;       // Opponent's rating deviation
  score: number;            // Outcome: 1 for win, 0.5 for draw, 0 for loss
  timestamp: number;        // When the game was played
}

/**
 * System constants
 */
const SYSTEM_CONSTANTS = {
  // Starting values for new players
  DEFAULT_RATING: 1500,
  DEFAULT_RD: 350,
  DEFAULT_VOLATILITY: 0.06,
  
  // System parameters
  TAU: 0.5,                 // System constant controlling volatility changes (0.3-1.2)
  EPSILON: 0.000001,        // Convergence criterion for iterative calculations
  SCALE_FACTOR: 173.7178,   // Scale factor between Glicko and Glicko-2 scale (sqrt(ln(10))/pi)
  
  // Rating period - this would be defined by your application
  RATING_PERIOD_DAYS: 7,    // How often ratings are calculated in days

  // Constraints
  MIN_RD: 30,               // Minimum rating deviation allowed
  MAX_RD: 350,              // Maximum rating deviation allowed
  MAX_VOLATILITY: 0.1,      // Maximum volatility allowed
  
  // Rating decay
  INACTIVE_DAYS: 30,        // Number of days before a player is considered inactive
  INACTIVITY_RD_INCREASE: 5 // Points of RD increase per rating period of inactivity
};

/**
 * Rating classifications by skill level
 */
export const RATING_CLASSIFICATIONS = {
  NOVICE: { min: 0, max: 1200, label: 'Novice' },
  BEGINNER: { min: 1200, max: 1400, label: 'Beginner' },
  INTERMEDIATE: { min: 1400, max: 1600, label: 'Intermediate' },
  ADVANCED: { min: 1600, max: 1800, label: 'Advanced' },
  EXPERT: { min: 1800, max: 2000, label: 'Expert' },
  CANDIDATE_MASTER: { min: 2000, max: 2200, label: 'Candidate Master' },
  MASTER: { min: 2200, max: 2400, label: 'Master' },
  GRANDMASTER: { min: 2400, max: Infinity, label: 'Grandmaster' }
};

/**
 * Create a new default rating for a player who has never played before
 */
export function createNewPlayerRating(): GlickoRating {
  return {
    rating: SYSTEM_CONSTANTS.DEFAULT_RATING,
    rd: SYSTEM_CONSTANTS.DEFAULT_RD,
    vol: SYSTEM_CONSTANTS.DEFAULT_VOLATILITY,
    lastPlayedTimestamp: Date.now()
  };
}

/**
 * Convert from Glicko scale to Glicko-2 scale (internal use only)
 */
function convertRatingToGlicko2Scale(rating: GlickoRating): GlickoRating {
  return {
    rating: (rating.rating - 1500) / SYSTEM_CONSTANTS.SCALE_FACTOR,
    rd: rating.rd / SYSTEM_CONSTANTS.SCALE_FACTOR,
    vol: rating.vol,
    lastPlayedTimestamp: rating.lastPlayedTimestamp
  };
}

/**
 * Convert from Glicko-2 scale back to Glicko scale (internal use only)
 */
function convertRatingToGlickoScale(rating: GlickoRating): GlickoRating {
  return {
    rating: rating.rating * SYSTEM_CONSTANTS.SCALE_FACTOR + 1500,
    rd: rating.rd * SYSTEM_CONSTANTS.SCALE_FACTOR,
    vol: rating.vol,
    lastPlayedTimestamp: rating.lastPlayedTimestamp
  };
}

/**
 * Calculate g(RD) function for Glicko-2 (internal use only)
 */
function g(rd: number): number {
  return 1 / Math.sqrt(1 + (3 * Math.pow(rd, 2)) / Math.pow(Math.PI, 2));
}

/**
 * Calculate E(rating, opponent) function - expected score (internal use only)
 */
function E(rating: number, opponentRating: number, opponentRD: number): number {
  return 1 / (1 + Math.exp(-g(opponentRD) * (rating - opponentRating)));
}

/**
 * Calculate the variance of the change in rating (internal use only)
 */
function calculateVariance(playerRating: number, results: Array<{ opponentRating: number, opponentRD: number }>): number {
  let variance = 0;
  
  for (const result of results) {
    const expectation = E(playerRating, result.opponentRating, result.opponentRD);
    const gRD = g(result.opponentRD);
    variance += Math.pow(gRD, 2) * expectation * (1 - expectation);
  }
  
  return 1 / variance;
}

/**
 * Calculate delta, the quantity to update the rating by (internal use only)
 */
function calculateDelta(
  variance: number, 
  playerRating: number,
  results: Array<{ opponentRating: number, opponentRD: number, score: number }>
): number {
  let sum = 0;
  
  for (const result of results) {
    const expectation = E(playerRating, result.opponentRating, result.opponentRD);
    sum += g(result.opponentRD) * (result.score - expectation);
  }
  
  return variance * sum;
}

/**
 * Calculate new volatility using iterative algorithm from Glicko-2 (internal use only)
 */
function calculateNewVolatility(
  rating: GlickoRating,
  variance: number,
  delta: number
): number {
  const tau = SYSTEM_CONSTANTS.TAU;
  const vol = rating.vol;
  const rd = rating.rd;
  
  // Compute the quantity a
  const a = Math.log(Math.pow(vol, 2));
  const deltaSq = Math.pow(delta, 2);
  const rdSq = Math.pow(rd, 2);
  const epsilon = SYSTEM_CONSTANTS.EPSILON;
  
  // Set initial values for iteration
  let A = a;
  let B = 0;
  
  if (deltaSq > rdSq + variance) {
    B = Math.log(deltaSq - rdSq - variance);
  } else {
    let k = 1;
    while (function(x: number) {
      return Math.exp(x) * (deltaSq - rdSq - variance - Math.exp(x));
    }(a - k * Math.abs(tau)) > 0) {
      k += 1;
    }
    B = a - k * Math.abs(tau);
  }
  
  // Iterate until convergence
  let fA = function(x: number) {
    return (Math.exp(x) * (deltaSq - rdSq - variance - Math.exp(x))) / 
           (2 * Math.pow(Math.exp(x) + rdSq + variance, 2)) - 
           (x - a) / Math.pow(tau, 2);
  };
  
  let fB = function(x: number) {
    return (Math.exp(x) * (deltaSq - rdSq - variance - Math.exp(x))) / 
           (2 * Math.pow(Math.exp(x) + rdSq + variance, 2)) - 
           (x - a) / Math.pow(tau, 2);
  };
  
  while (Math.abs(B - A) > epsilon) {
    let C = A + (A - B) * fA(A) / (fB(B) - fA(A));
    if (isNaN(C) || !isFinite(C)) {
      C = (A + B) / 2;
    }
    
    const fC = function(x: number) {
      return (Math.exp(x) * (deltaSq - rdSq - variance - Math.exp(x))) / 
             (2 * Math.pow(Math.exp(x) + rdSq + variance, 2)) - 
             (x - a) / Math.pow(tau, 2);
    };
    
    if (fC(C) * fA(A) < 0) {
      B = C;
    } else {
      A = C;
    }
    
    if (Math.abs(B - A) <= epsilon) {
      break;
    }
  }
  
  const newVol = Math.exp((A + B) / 4);
  
  // Ensure the volatility doesn't exceed maximum
  return Math.min(newVol, SYSTEM_CONSTANTS.MAX_VOLATILITY);
}

/**
 * Calculate new RD value (internal use only)
 */
function calculateNewRD(rd: number, vol: number, variance: number): number {
  const newRD = Math.sqrt(Math.pow(rd, 2) + Math.pow(vol, 2));
  const denominatorTerm = 1 / variance;
  
  // Apply the RD update formula
  const updatedRD = 1 / Math.sqrt((1 / Math.pow(newRD, 2)) + denominatorTerm);
  
  // Constrain RD within acceptable bounds
  return Math.max(
    Math.min(updatedRD, SYSTEM_CONSTANTS.MAX_RD),
    SYSTEM_CONSTANTS.MIN_RD
  );
}

/**
 * Update the player's RD due to inactivity
 * @param rating The player's current rating
 * @param currentTimestamp Current time in milliseconds
 * @returns Updated rating with increased RD if player is inactive
 */
export function updateRatingForInactivity(rating: GlickoRating, currentTimestamp: number): GlickoRating {
  // Skip if no last played timestamp or the timestamp is in the future
  if (!rating.lastPlayedTimestamp || rating.lastPlayedTimestamp > currentTimestamp) {
    return rating;
  }
  
  // Calculate how many days have passed since last game
  const daysSinceLastGame = (currentTimestamp - rating.lastPlayedTimestamp) / (1000 * 60 * 60 * 24);
  
  // If player is inactive, increase RD
  if (daysSinceLastGame >= SYSTEM_CONSTANTS.INACTIVE_DAYS) {
    // Calculate how many rating periods have passed
    const ratingPeriodsPassed = Math.floor(daysSinceLastGame / SYSTEM_CONSTANTS.RATING_PERIOD_DAYS);
    
    // Increase RD accordingly, capped at MAX_RD
    const newRD = Math.min(
      rating.rd + (ratingPeriodsPassed * SYSTEM_CONSTANTS.INACTIVITY_RD_INCREASE),
      SYSTEM_CONSTANTS.MAX_RD
    );
    
    ratingSystemLogger.info('Increased RD due to inactivity', {
      previousRD: rating.rd,
      newRD,
      daysSinceLastGame,
      ratingPeriodsPassed
    });
    
    return {
      ...rating,
      rd: newRD
    };
  }
  
  return rating;
}

/**
 * Update player's rating based on a set of game results
 * @param currentRating The player's current Glicko rating data
 * @param results Array of game results against opponents
 * @returns Updated rating data
 */
export function updateRating(currentRating: GlickoRating, results: GameResult[]): GlickoRating {
  // If no games were played, just return the current rating
  if (!results.length) {
    return currentRating;
  }
  
  const now = Date.now();
  
  // First, check for inactivity and possibly increase RD
  let rating = updateRatingForInactivity(currentRating, now);
  
  // Convert to Glicko-2 scale for calculations
  const glicko2Rating = convertRatingToGlicko2Scale(rating);
  
  // Convert opponent ratings to Glicko-2 scale
  const glicko2Results = results.map(result => ({
    opponentRating: (result.opponentRating - 1500) / SYSTEM_CONSTANTS.SCALE_FACTOR,
    opponentRD: result.opponentRD / SYSTEM_CONSTANTS.SCALE_FACTOR,
    score: result.score,
    timestamp: result.timestamp
  }));
  
  // Calculate variance of the player
  const variance = calculateVariance(
    glicko2Rating.rating, 
    glicko2Results.map(r => ({ opponentRating: r.opponentRating, opponentRD: r.opponentRD }))
  );
  
  // Calculate delta (the change quantity)
  const delta = calculateDelta(variance, glicko2Rating.rating, glicko2Results);
  
  // Calculate new volatility
  const newVol = calculateNewVolatility(glicko2Rating, variance, delta);
  
  // Calculate new RD
  const newRD = calculateNewRD(glicko2Rating.rd, newVol, variance);
  
  // Calculate new rating
  const newRating = glicko2Rating.rating + (Math.pow(newRD, 2) * delta);
  
  // Convert back to Glicko scale
  const updatedRating = convertRatingToGlickoScale({
    rating: newRating,
    rd: newRD,
    vol: newVol,
    lastPlayedTimestamp: now
  });
  
  ratingSystemLogger.info('Rating updated', {
    oldRating: rating.rating,
    newRating: updatedRating.rating,
    ratingChange: updatedRating.rating - rating.rating,
    oldRD: rating.rd,
    newRD: updatedRating.rd,
    games: results.length
  });
  
  return updatedRating;
}

/**
 * Calculate the probability of player A winning against player B
 * @param playerARating Player A's Glicko rating
 * @param playerBRating Player B's Glicko rating
 * @returns Probability from 0 to 1 that player A will win
 */
export function calculateWinProbability(playerARating: GlickoRating, playerBRating: GlickoRating): number {
  // Convert both ratings to Glicko-2 scale
  const playerA = convertRatingToGlicko2Scale(playerARating);
  const playerB = convertRatingToGlicko2Scale(playerBRating);
  
  // Expected score formula
  const expectedScore = E(playerA.rating, playerB.rating, playerB.rd);
  
  return expectedScore;
}

/**
 * Get a descriptive classification of a player's rating
 * @param rating The player's Glicko rating
 * @returns A string label for the rating level
 */
export function getRatingClassification(rating: number): string {
  for (const [key, classification] of Object.entries(RATING_CLASSIFICATIONS)) {
    if (rating >= classification.min && rating < classification.max) {
      return classification.label;
    }
  }
  return RATING_CLASSIFICATIONS.NOVICE.label;
}

/**
 * Check if a player's rating is provisional (high uncertainty)
 * @param rating The player's Glicko rating data
 * @returns True if the rating is provisional
 */
export function isProvisionalRating(rating: GlickoRating): boolean {
  return rating.rd > 110; // Customary threshold in Glicko system
}

/**
 * Convert a Glicko rating to a display string
 * @param rating The player's Glicko rating data
 * @returns Formatted string (e.g. "1500±75" or "1500?")
 */
export function formatRating(rating: GlickoRating): string {
  if (isProvisionalRating(rating)) {
    return `${Math.round(rating.rating)}?`;
  }
  return `${Math.round(rating.rating)}±${Math.round(rating.rd)}`;
}

/**
 * Calculate a player's rating range within one standard deviation
 * @param rating The player's Glicko rating data
 * @returns Rating range as an object with min and max values
 */
export function getRatingRange(rating: GlickoRating): { min: number, max: number } {
  return {
    min: Math.max(0, Math.round(rating.rating - rating.rd)),
    max: Math.round(rating.rating + rating.rd)
  };
}

/**
 * Convert a result string to a numerical score for rating calculations
 * @param result String representing game result ('win', 'loss', 'draw')
 * @returns Numerical score (1 for win, 0.5 for draw, 0 for loss)
 */
export function resultToScore(result: 'win' | 'loss' | 'draw'): number {
  switch (result) {
    case 'win': return 1;
    case 'draw': return 0.5;
    case 'loss': return 0;
    default: return 0;
  }
}

/**
 * Helper function to create a GameResult object
 */
export function createGameResult(
  opponentRating: number,
  opponentRD: number,
  result: 'win' | 'loss' | 'draw',
  timestamp: number = Date.now()
): GameResult {
  return {
    opponentRating,
    opponentRD,
    score: resultToScore(result),
    timestamp
  };
} 
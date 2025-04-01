// Game constants
export const TIMER_OPTIONS = {
  FIVE_MIN: 300000, // 5 minutes in milliseconds
  TEN_MIN: 600000,  // 10 minutes
  FIFTEEN_MIN: 900000, // 15 minutes
};

// Default timer
export const DEFAULT_TIMER = TIMER_OPTIONS.FIVE_MIN;

// Clock update frequency (ms)
export const CLOCK_UPDATE_FREQUENCY = 250; // 4 times per second

// Wager constants
export const MIN_WAGER = 1;
export const MAX_WAGER = 1000;

// Currency symbol
export const CURRENCY_SYMBOL = "₹";

// Game status
export const GAME_STATUS = {
  WAITING: "waiting",
  IN_PROGRESS: "in_progress",
  FINISHED: "finished",
  CANCELLED: "cancelled",
};

// Player colors
export const PLAYER_COLORS = {
  WHITE: "w",
  BLACK: "b",
};

// Result types
export const RESULT_TYPES = {
  CHECKMATE: "checkmate",
  DRAW: "draw",
  TIMEOUT: "timeout",
  RESIGNATION: "resignation",
  AGREEMENT: "agreement", // Draw by agreement
}; 
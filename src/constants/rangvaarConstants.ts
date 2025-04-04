import { Suit, Rank, PlayerPosition } from '../types/rangvaar';

// Card Ranks (ordered low to high for potential sorting/comparison needs)
export const RANKS: Rank[] = [
  '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'
];

// Card Suits
export const SUITS: Suit[] = [
  'Hearts', 'Diamonds', 'Clubs', 'Spades'
];

// Player Positions in order
export const PLAYER_POSITIONS: PlayerPosition[] = [
  'North', 'East', 'South', 'West'
];

// Game Constants
export const MIN_BID = 7;
export const MAX_BID = 13;
export const TOTAL_TRICKS_PER_ROUND = 13;
export const INITIAL_DEAL_CARD_COUNT = 5;
export const FINAL_DEAL_CARD_COUNT = 8; // 13 total - 5 initial
export const MAX_PLAYERS = 4; 
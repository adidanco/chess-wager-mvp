import { Timestamp } from 'firebase/firestore';

// Basic Card Elements
export type Suit = 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades';
export type Rank = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string; // Unique ID for React keys, e.g., "H7", "C10"
  value: number; // Numerical value for scoring (0-13)
}

// Player Information
export interface PlayerInfo {
  userId: string;
  username: string;
  photoURL?: string | null;
  position: number; // 0, 1, 2, 3 for clockwise order
}

// Special Card Power Types
export type CardPowerType = 
  | 'Peek_Own' // 7, 8: Peek at one of your own face-down cards
  | 'Peek_Opponent' // 9, 10: Peek at one face-down card of an opponent
  | 'Blind_Swap' // J, Q: Swap one of your cards with an opponent's without looking
  | 'Seen_Swap'; // K: Peek at one of opponent's cards, then optionally swap

export interface CardPowerAction {
  type: CardPowerType;
  playerId: string; // Player who used the power
  targetPlayerId?: string; // For powers targeting other players
  cardIndex?: number; // Index of the card being revealed/swapped, etc.
  targetCardIndex?: number; // Index of the target card (for swaps)
  timestamp: Timestamp;
}

// Card Positions in a 2x2 Grid
export type CardPosition = 0 | 1 | 2 | 3; // Top-left, top-right, bottom-left, bottom-right

// Round State
export type RoundPhase = 
  | 'Setup' // Dealing initial cards and initial peek
  | 'Playing' // Regular gameplay (draw, discard, match, special powers)
  | 'FinalTurn' // After Scambodia is declared, other players get one more turn
  | 'Scoring' // Calculating final scores
  | 'Complete'; // Round complete, ready for next round

// Player Action Types
export type PlayerActionType =
  | 'DrawDeck'
  | 'DrawDiscard'
  | 'Exchange'
  | 'Discard'
  | 'Match'
  | 'DeclareScambodia'
  | 'UsePower'
  | 'EndTurn';

export interface PlayerAction {
  type: PlayerActionType;
  playerId: string;
  cardId?: string;
  cardPosition?: CardPosition;
  success?: boolean;
  timestamp: Timestamp;
}

// Add export to the union type of all actions
export type Action = PlayerAction | CardPowerAction;

// Round specific state
export interface RoundState {
  roundNumber: number;
  phase: RoundPhase;
  currentTurnPlayerId?: string;
  playerCards: { [playerId: string]: (Card | null)[] }; // 2x2 grid, null means discarded
  // Allow numbers (own card index) or strings ("opponentId:index") for opponent peek
  visibleToPlayer: { [playerId: string]: (CardPosition | string)[] }; 
  discardPile: Card[];
  drawPile: Card[];
  drawnCard: Card | null; // Card currently drawn by a player 
  drawnCardUserId: string | null; // ID of player who drew the card
  playerDeclaredScambodia?: string; // Player who declared "Scambodia"
  actions: Action[]; // Use the union type Action
  scores: { [playerId: string]: number }; // Final scores for this round
  roundWinnerId?: string; // Player with lowest score (or who discarded all cards)
  cardPowersUsed: CardPowerAction[]; // Record of all special powers used
  initialPeekCompleted?: boolean; // Add the new flag here (optional)
  scambodiaCorrect?: boolean; // Add flag for correct Scambodia call
}

// Overall Game State
export type GameStatus =
  | 'Waiting' // Waiting for players to join
  | 'Playing' // Game in progress
  | 'Finished' // All rounds completed
  | 'Cancelled'; // Game cancelled

export interface ScambodiaGameState {
  gameId: string;
  gameType: 'Scambodia';
  status: GameStatus;
  players: PlayerInfo[];
  currentRoundNumber: number;
  totalRounds: 1 | 3 | 5; // Number of rounds to play
  wagerPerPlayer: number;
  rounds: { [roundNumber: number]: RoundState }; // State for each round
  cumulativeScores: { [playerId: string]: number }; // Running scores across rounds
  createdAt: Timestamp;
  updatedAt: Timestamp;
  gameWinnerId?: string; // Player with lowest cumulative score
  payoutProcessed?: boolean; // Flag to prevent double payouts
  payoutTimestamp?: Timestamp; // When payout was processed
  scambodiaCalls: { [playerId: string]: number }; // Count of successful Scambodia calls per player (for tiebreakers)
}

// Function return types
export interface UseScambodiaGameReturn {
  gameState: ScambodiaGameState | null;
  loading: boolean;
  error: string | null;
  drawnCard: Card | null; // The currently drawn card (if any)
  // Player actions
  drawCard: (source: 'deck' | 'discard') => Promise<Card | null>;
  exchangeCard: (cardPosition: CardPosition) => Promise<void>;
  discardDrawnCard: () => Promise<Card | null>;
  attemptMatch: (cardPosition: CardPosition) => Promise<boolean | null>;
  declareScambodia: () => Promise<void>;
  usePower: (powerType: CardPowerType, params: any) => Promise<void>;
  // Game flow
  endTurn: () => Promise<void>;
  // Debug functions (for development)
  logGameState: () => void;
} 
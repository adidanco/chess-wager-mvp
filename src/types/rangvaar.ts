import { Timestamp } from 'firebase/firestore';

// Basic Card Elements
export type Suit = 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string; // Unique ID for React keys, e.g., "H7", "DA"
}

// Player and Team Structure
export type PlayerPosition = 'North' | 'East' | 'South' | 'West';
export type TeamId = 1 | 2; // Team 1 (e.g., North/South), Team 2 (e.g., East/West)

export interface PlayerInfo {
  userId: string;
  username: string;
  photoURL?: string | null; // Allow null for Firestore compatibility
  position: PlayerPosition;
  teamId: TeamId;
}

// Bidding
export interface BidInfo {
  playerId: string;
  bidAmount: number; // Should be between 7 and 13
}

// Trick Play
export interface TrickCard {
  playerId: string;
  card: Card;
}

export interface Trick {
  cards: TrickCard[];
  leadSuit: Suit;
  winningPlayerId?: string; // ID of the player who won the trick
  trickNumber: number; // 1-13 within a round
}

// Round State Machine
export type RoundPhase =
  | 'DealingInitial' // Dealing first 5 cards
  | 'Bidding'
  | 'TrumpSelection'
  | 'DealingRest' // Dealing remaining 8 cards
  | 'TrickPlaying'
  | 'RoundScoring'
  | 'RoundEnded';

export interface RoundState {
  roundNumber: number; // 1 to totalRounds
  phase: RoundPhase;
  dealerPosition: PlayerPosition;
  currentTurnPlayerId?: string; // Whose turn is it to bid or play?
  hands: { [playerId: string]: Card[] }; // PlayerId mapped to their hand
  bids: BidInfo[]; // Record of bids made this round
  highestBid?: BidInfo; // Winning bid information
  trumpSuit?: Suit; // Determined after bidding
  currentTrickNumber: number; // Which trick are we on (1-13)
  currentTrickCards: TrickCard[]; // Cards played in the trick currently in progress
  completedTricks: Trick[]; // Tricks already completed this round
  teamTricksWonThisRound: { [teamId in TeamId]: number };
  // Score specifically for this round, considering penalties
  roundScores: { [teamId in TeamId]: number };
  penaltyApplied?: boolean; // Flag if penalty was applied to the bidding team's score
}

// Overall Game State
export type GameStatus =
  | 'Waiting' // Waiting for players to join
  | 'Starting' // All players joined, initializing first round
  | 'Playing' // Game in progress (covering all round phases)
  | 'Finished' // All rounds completed
  | 'Cancelled'; // Game cancelled for some reason

export interface RangvaarGameState {
  gameId: string;
  gameType: 'Rangvaar'; // To differentiate from Chess, etc.
  status: GameStatus;
  players: PlayerInfo[]; // Array of 4 players when full
  teams: {
    [teamId in TeamId]: {
      playerIds: string[];
      cumulativeScore: number; // Score accumulated across all rounds
    };
  };
  wagerPerPlayer: number;
  totalRounds: 3 | 5;
  currentRoundNumber: number; // Which round is currently active
  currentRoundState?: RoundState; // State specific to the active round
  createdAt: Timestamp;
  updatedAt: Timestamp;
  winnerTeamId?: TeamId;
  payoutProcessed?: boolean; // Flag to prevent double payouts
  payoutTimestamp?: Timestamp; // When the payout was processed
  // Could add fields for game host, specific events/logs later
} 
import { addDoc, collection, doc, getDoc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import { 
  ScambodiaGameState, 
  Card, 
  PlayerInfo, 
  RoundState, 
  Suit, 
  Rank, 
  CardPosition,
  CardPowerType,
  PlayerAction,
  CardPowerAction,
  GameStatus
} from '../types/scambodia';

// Constants
export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;
export const CARDS_PER_PLAYER = 4;
export const INITIAL_PEEK_COUNT = 2; // Bottom two cards

/**
 * Creates a new deck of 52 cards for Scambodia.
 * Kings of red suits (Hearts, Diamonds) have value 0.
 * All other cards have value equal to their rank (Jack=11, Queen=12, Black King=13)
 */
export const createDeck = (): Card[] => {
  const suits: Suit[] = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
  const ranks: Rank[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck: Card[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      // Calculate value based on card rules
      let value = 0;
      
      if (rank === '1') {
        value = 1; // Aces/1s are 1 in this implementation
      } else if (rank === 'J') {
        value = 11;
      } else if (rank === 'Q') {
        value = 12;
      } else if (rank === 'K') {
        // Kings of Hearts and Diamonds are worth 0, others are 13
        value = (suit === 'Hearts' || suit === 'Diamonds') ? 0 : 13;
      } else {
        // Number cards 2-10
        value = parseInt(rank);
      }

      deck.push({
        suit,
        rank,
        id: `${suit[0]}${rank}`, // e.g., "H7", "SA"
        value
      });
    }
  }

  return deck;
};

/**
 * Shuffles a deck of cards using the Fisher-Yates algorithm
 */
export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Creates a new Scambodia game in Firestore.
 * @param userId The ID of the user creating the game.
 * @param wagerAmount The amount each player wagers to join.
 * @param totalRounds The number of rounds to play (1, 3, or 5).
 * @returns The ID of the newly created game.
 */
export const createScambodiaGame = async (
  userId: string,
  wagerAmount: number,
  totalRounds: 1 | 3 | 5
): Promise<string> => {
  logger.info('createScambodiaGame', 'Creating new game', { userId, wagerAmount, totalRounds });

  try {
    // Get user profile to set as first player
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      throw new Error("User profile not found.");
    }

    const userProfile = userDoc.data();
    const firstPlayer: PlayerInfo = {
      userId,
      username: userProfile.username || 'Anonymous',
      photoURL: userProfile.photoURL || null,
      position: 0, // Host is first position
    };

    // Create initial game state
    const initialGameState: Omit<ScambodiaGameState, 'gameId'> = {
      gameType: 'Scambodia',
      status: 'Waiting',
      players: [firstPlayer],
      wagerPerPlayer: wagerAmount,
      totalRounds,
      currentRoundNumber: 0, // Will be 1 when game starts
      rounds: {},
      cumulativeScores: { [userId]: 0 },
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
      scambodiaCalls: { [userId]: 0 }
    };

    // Add to Firestore
    const gameRef = await addDoc(collection(db, 'scambodiaGames'), initialGameState);
    logger.info('createScambodiaGame', 'Game created successfully', { gameId: gameRef.id });
    
    return gameRef.id;
  } catch (error) {
    logger.error('createScambodiaGame', 'Failed to create game', { error });
    throw error;
  }
};

/**
 * Allows a player to join an existing Scambodia game.
 * @param gameId The ID of the game to join.
 * @param userId The ID of the user joining.
 */
export const joinScambodiaGame = async (gameId: string, userId: string): Promise<void> => {
  logger.info('joinScambodiaGame', 'Attempting to join game', { gameId, userId });
  
  const gameDocRef = doc(db, 'scambodiaGames', gameId);
  const userDocRef = doc(db, 'users', userId);

  try {
    await runTransaction(db, async (transaction) => {
      // Read game and user data
      const gameDoc = await transaction.get(gameDocRef);
      const userDoc = await transaction.get(userDocRef);

      if (!gameDoc.exists()) {
        throw new Error('Game not found.');
      }
      if (!userDoc.exists()) {
        throw new Error('User profile not found.');
      }

      const gameState = gameDoc.data() as ScambodiaGameState;
      const userProfile = userDoc.data();

      // Check if game can be joined
      if (gameState.status !== 'Waiting') {
        throw new Error('Game is no longer accepting players.');
      }
      if (gameState.players.length >= MAX_PLAYERS) {
        throw new Error('Game is already full.');
      }
      if (gameState.players.some(p => p.userId === userId)) {
        throw new Error('You are already in this game.');
      }

      // Add player to game
      const position = gameState.players.length;
      const newPlayer: PlayerInfo = {
        userId,
        username: userProfile.username || 'Anonymous',
        photoURL: userProfile.photoURL || null,
        position
      };

      // Update game state
      const updatedPlayers = [...gameState.players, newPlayer];
      const updatedScores = { ...gameState.cumulativeScores, [userId]: 0 };
      const updatedScambodiaCalls = { ...gameState.scambodiaCalls, [userId]: 0 };

      transaction.update(gameDocRef, {
        players: updatedPlayers,
        cumulativeScores: updatedScores,
        scambodiaCalls: updatedScambodiaCalls,
        updatedAt: serverTimestamp()
      });

      logger.info('joinScambodiaGame', 'Player joined successfully', { gameId, userId, position });
    });
  } catch (error) {
    logger.error('joinScambodiaGame', 'Failed to join game', { gameId, userId, error });
    throw error;
  }
};

/**
 * Starts a Scambodia game when all players have joined.
 * Initializes the first round with dealt cards.
 * @param gameId The ID of the game to start.
 */
export const startScambodiaGame = async (gameId: string): Promise<void> => {
  logger.info('startScambodiaGame', 'Attempting to start game', { gameId });
  
  const gameDocRef = doc(db, 'scambodiaGames', gameId);

  try {
    await runTransaction(db, async (transaction) => {
      const gameDoc = await transaction.get(gameDocRef);
      if (!gameDoc.exists()) {
        throw new Error('Game not found.');
      }

      const gameState = gameDoc.data() as ScambodiaGameState;
      
      // Check if game can start
      if (gameState.status !== 'Waiting') {
        throw new Error('Game has already started or been cancelled.');
      }
      if (gameState.players.length < MIN_PLAYERS) {
        throw new Error(`Need at least ${MIN_PLAYERS} players to start.`);
      }

      // Initialize first round
      const firstRound = initializeRound(gameState.players, 1);

      // Update game state
      transaction.update(gameDocRef, {
        status: 'Playing',
        currentRoundNumber: 1,
        rounds: { 1: firstRound },
        updatedAt: serverTimestamp()
      });

      logger.info('startScambodiaGame', 'Game started successfully', { 
        gameId, 
        playerCount: gameState.players.length
      });
    });
  } catch (error) {
    logger.error('startScambodiaGame', 'Failed to start game', { gameId, error });
    throw error;
  }
};

/**
 * Initializes a new round with dealt cards and initial state.
 * @param players The list of players in the game.
 * @param roundNumber The round number to initialize.
 */
const initializeRound = (players: PlayerInfo[], roundNumber: number): RoundState => {
  // Create and shuffle deck
  const deck = shuffleDeck(createDeck());
  
  // Prepare player cards
  const playerCards: { [playerId: string]: Card[] } = {};
  const visibleToPlayer: { [playerId: string]: CardPosition[] } = {};
  
  players.forEach(player => {
    playerCards[player.userId] = [];
    visibleToPlayer[player.userId] = [2, 3]; // Bottom two cards are initially visible
  });
  
  // Deal cards - 4 to each player
  for (let i = 0; i < CARDS_PER_PLAYER; i++) {
    for (const player of players) {
      if (deck.length > 0) {
        const card = deck.pop()!;
        playerCards[player.userId].push(card);
      }
    }
  }
  
  // Setup discard pile
  const firstDiscard = deck.pop()!;
  const discardPile = [firstDiscard];
  
  // Setup round state
  const roundState: RoundState = {
    roundNumber,
    phase: 'Setup',
    currentTurnPlayerId: players[0].userId, // First player starts
    playerCards: playerCards as { [playerId: string]: (Card | null)[] },
    visibleToPlayer,
    discardPile,
    drawPile: deck,
    actions: [],
    scores: {},
    cardPowersUsed: []
  };
  
  return roundState;
};

/**
 * Processes a player drawing a card from either the deck or discard pile.
 * @param gameId The ID of the game.
 * @param userId The ID of the player drawing.
 * @param source The source to draw from ('deck' or 'discard').
 */
export const drawCard = async (
  gameId: string,
  userId: string,
  source: 'deck' | 'discard'
): Promise<void> => {
  // Implementation will go here
};

/**
 * Allows a player to exchange their drawn card with one of their face-down cards.
 * @param gameId The ID of the game.
 * @param userId The ID of the player.
 * @param cardPosition The position of the card to exchange (0-3).
 */
export const exchangeCard = async (
  gameId: string,
  userId: string,
  cardPosition: CardPosition
): Promise<void> => {
  // Implementation will go here
};

/**
 * Allows a player to discard a drawn card without exchanging.
 * @param gameId The ID of the game.
 * @param userId The ID of the player.
 */
export const discardDrawnCard = async (
  gameId: string,
  userId: string
): Promise<void> => {
  // Implementation will go here
};

/**
 * Allows a player to attempt to match and discard one of their face-down cards.
 * @param gameId The ID of the game.
 * @param userId The ID of the player.
 * @param cardPosition The position of the card to match (0-3).
 */
export const attemptMatch = async (
  gameId: string,
  userId: string,
  cardPosition: CardPosition
): Promise<void> => {
  // Implementation will go here
};

/**
 * Allows a player to declare "Scambodia" and trigger the final round.
 * @param gameId The ID of the game.
 * @param userId The ID of the player declaring.
 */
export const declareScambodia = async (
  gameId: string,
  userId: string
): Promise<void> => {
  // Implementation will go here
};

/**
 * Allows a player to use a special card power.
 * @param gameId The ID of the game.
 * @param userId The ID of the player.
 * @param powerType The type of power to use.
 * @param params Additional parameters for the power.
 */
export const usePower = async (
  gameId: string,
  userId: string,
  powerType: CardPowerType,
  params: any
): Promise<void> => {
  // Implementation will go here
};

/**
 * Calculates final scores for a round and updates the game state.
 * @param gameId The ID of the game.
 */
export const scoreRound = async (gameId: string): Promise<void> => {
  // Implementation will go here
};

/**
 * Initializes the next round after the current one is completed.
 * @param gameId The ID of the game.
 */
export const initializeNextRound = async (gameId: string): Promise<void> => {
  // Implementation will go here
};

/**
 * Ends the game and determines the winner.
 * @param gameId The ID of the game.
 */
export const endGame = async (gameId: string): Promise<void> => {
  // Implementation will go here
};

/**
 * FOR DEBUGGING: Gets the current game state including cards.
 * @param gameId The ID of the game.
 */
export const getGameStateWithCards = async (gameId: string): Promise<ScambodiaGameState> => {
  const gameDoc = await getDoc(doc(db, 'scambodiaGames', gameId));
  if (!gameDoc.exists()) {
    throw new Error('Game not found.');
  }
  return gameDoc.data() as ScambodiaGameState;
}; 
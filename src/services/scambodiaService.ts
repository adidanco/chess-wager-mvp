import { addDoc, collection, doc, getDoc, runTransaction, serverTimestamp, updateDoc, arrayUnion, getDocs, writeBatch, query, where, orderBy } from 'firebase/firestore';
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
  GameStatus,
  Action
} from '../types/scambodia';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { Timestamp } from 'firebase/firestore';
import { auth } from '../firebase';

// Constants
export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;
export const CARDS_PER_PLAYER = 4;
export const INITIAL_PEEK_COUNT = 2; // Bottom two cards

// Define ActionType locally for use in drawCard (or import if globally defined)
type ActionType = Action['type']; 

// Define callable functions (add the new debug functions)
const createGameFn = httpsCallable(functions, 'createScambodiaGame');
const joinGameFn = httpsCallable(functions, 'joinScambodiaGame');
const startGameFn = httpsCallable(functions, 'startScambodiaGame');
const processScambodiaPayoutFn = httpsCallable(functions, 'processScambodiaPayout'); 
const transitionScambodiaRoundFn = httpsCallable(functions, 'transitionScambodiaRound');
// DEBUG FUNCTIONS
const forceGameEndDebugFn = httpsCallable(functions, 'forceScambodiaGameEndDebug');
const forceRoundEndDebugFn = httpsCallable(functions, 'forceScambodiaRoundEndDebug');
const triggerScoreCalculationFn = httpsCallable(functions, 'triggerScoreCalculation');
const forceScambodiaRoundScoreDebugFn = httpsCallable(functions, 'forceScambodiaRoundScoreDebug');

// Define callable functions
const initiatePowerFn = httpsCallable(functions, 'initiatePower');
const resolvePowerTargetFn = httpsCallable(functions, 'resolvePowerTarget');
const skipPowerFn = httpsCallable(functions, 'skipPower');

/**
 * Helper: returns the next player's userId in turn order.
 */
const getNextPlayerId = (players: PlayerInfo[], currentPlayerId: string): string => {
  const idx = players.findIndex(p => p.userId === currentPlayerId);
  if (idx === -1) return players[0].userId;
  return players[(idx + 1) % players.length].userId;
};

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
      let value = 0;
      let isRedKing = false;
      
      if (rank === '1') {
        value = 1;
      } else if (rank === 'J') {
        value = 11;
      } else if (rank === 'Q') {
        value = 12;
      } else if (rank === 'K') {
        // Red Kings start with value 13, but can become 0 later
        isRedKing = (suit === 'Hearts' || suit === 'Diamonds');
        value = 13; // All Kings start at 13
      } else {
        value = parseInt(rank);
      }

      const card: Card = {
        suit,
        rank,
        id: `${suit[0]}${rank}`,
        value,
        // Initialize flag for Red Kings, false otherwise
        redKingZeroValueActive: isRedKing ? false : undefined 
      };
      // Remove undefined property if not a red king
      if (card.redKingZeroValueActive === undefined) {
        delete card.redKingZeroValueActive;
      }
      
      deck.push(card);
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
    // MVP SIMPLIFIED VERSION - No wagering or balance checks
    await runTransaction(db, async (transaction) => {
      // Get the game state
      const gameDoc = await transaction.get(gameDocRef);
      if (!gameDoc.exists()) {
        throw new Error('Game not found.');
      }

      const gameState = gameDoc.data() as ScambodiaGameState;
      
      // Basic validation
      if (gameState.status !== 'Waiting') {
        throw new Error('Game has already started or been cancelled.');
      }
      if (gameState.players.length < 2) { // Reduced from MIN_PLAYERS to 2 for easier testing
        throw new Error(`Need at least 2 players to start.`);
      }
      
      // Initialize first round
      const firstRound = initializeRound(gameState.players, 1);

      // Update game state only - no wagering
      transaction.update(gameDocRef, {
        status: 'Playing',
        currentRoundNumber: 1,
        rounds: { 1: firstRound },
        updatedAt: serverTimestamp()
      });

      logger.info('startScambodiaGame', 'Game started successfully (MVP mode - no wagering)', { 
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
  const deck = shuffleDeck(createDeck());
  
  const playerCards: { [playerId: string]: Card[] } = {};
  // Initialize visibleToPlayer as empty for all players
  const visibleToPlayer: { [playerId: string]: (CardPosition | string)[] } = {}; 
  
  players.forEach(player => {
    playerCards[player.userId] = [];
    visibleToPlayer[player.userId] = []; // Start with no cards visible
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
    // Change initial phase to 'Setup' to allow for peek phase
    phase: 'Setup',
    currentTurnPlayerId: players[0].userId, // Keep first player ready
    playerCards: playerCards as { [playerId: string]: (Card | null)[] },
    visibleToPlayer, // Pass the now empty visibility map - no cards visible initially
    discardPile,
    drawPile: deck,
    drawnCard: null,
    drawnCardUserId: null,
    actions: [],
    scores: {},
    cardPowersUsed: [],
    // Initialize playersCompletedPeek as an empty array
    playersCompletedPeek: [] 
  };
  
  return roundState;
};

/**
 * Allows a player to draw a card from the deck or discard pile
 * @param gameId The ID of the game
 * @param userId The ID of the user drawing card
 * @param source Whether to draw from 'deck' or 'discard'
 * @returns The drawn card
 */
export const drawCard = async (
  gameId: string,
  userId: string,
  source: 'deck' | 'discard'
): Promise<Card | null> => {
  logger.info('drawCard', 'Player drawing card', { gameId, userId, source });
  
  const gameDocRef = doc(db, 'scambodiaGames', gameId);
  
  try {
    let drawnCardToReturn: Card | null = null;
    let drawnCardId: string = '';
    
    await runTransaction(db, async (transaction) => {
      const gameDoc = await transaction.get(gameDocRef);
      if (!gameDoc.exists()) throw new Error('Game not found.');
      
      const gameState = gameDoc.data() as ScambodiaGameState;
      const currentRound = gameState.currentRoundNumber;
      const roundState = gameState.rounds[currentRound];
      
      // Validation checks
      if (gameState.status !== 'Playing') throw new Error('Game is not in playing state.');
      if (roundState.currentTurnPlayerId !== userId) throw new Error('Not your turn to draw a card.');
      if (roundState.phase !== 'Playing' && roundState.phase !== 'FinalTurn') throw new Error('Cannot draw card in current phase.'); // Allow draw in FinalTurn?
      if (roundState.drawnCard && roundState.drawnCardUserId === userId) throw new Error('You already have a drawn card.');
      
      let updatedDrawPile = roundState.drawPile;
      let updatedDiscardPile = roundState.discardPile;
      let actionType: Action['type'];
      let cardToDraw: Card | null = null;
      
      if (source === 'deck') {
         if (updatedDrawPile.length === 0) throw new Error('Draw pile is empty.');
         cardToDraw = updatedDrawPile[0];
         updatedDrawPile = updatedDrawPile.slice(1);
         actionType = 'DrawDeck';
      } else { 
         if (updatedDiscardPile.length === 0) throw new Error('Discard pile is empty.');
         cardToDraw = updatedDiscardPile[updatedDiscardPile.length - 1];
         updatedDiscardPile = updatedDiscardPile.slice(0, -1);
         actionType = 'DrawDiscard';
      }

      if (!cardToDraw) { 
        throw new Error('Critical error: Card drawn is unexpectedly null.');
      }
      
      drawnCardToReturn = cardToDraw;
      // Store the ID separately to avoid type issues
      drawnCardId = cardToDraw.id;
      
      const action = {
        type: actionType,
        playerId: userId,
        cardId: drawnCardId,
        timestamp: Timestamp.now()
      };

      // Check if drawn from deck and is a power card
      const isPowerCardFromDeck = (
        source === 'deck' && 
        cardToDraw && 
        ['7', '8', '9', '10', 'J', 'Q', 'K'].includes(cardToDraw.rank)
      );

      // Prepare base update data
      const updateData: Record<string, any> = {
        [`rounds.${currentRound}.drawPile`]: updatedDrawPile,
        [`rounds.${currentRound}.discardPile`]: updatedDiscardPile,
        [`rounds.${currentRound}.drawnCard`]: cardToDraw,
        [`rounds.${currentRound}.drawnCardUserId`]: userId,
        [`rounds.${currentRound}.drawnCardSource`]: source,
        [`rounds.${currentRound}.actions`]: arrayUnion(action),
        [`rounds.${currentRound}.pendingPowerDecision`]: null,
        [`rounds.${currentRound}.activePowerResolution`]: null,
        updatedAt: serverTimestamp()
      };

      // If it's a power card from the deck, set pendingPowerDecision
      if (isPowerCardFromDeck) {
        logger.info('drawCard', 'Power card drawn from deck, setting pending decision', { gameId, userId, cardId: cardToDraw.id });
        updateData[`rounds.${currentRound}.pendingPowerDecision`] = { card: cardToDraw };
        // DO NOT advance turn yet, player must choose to redeem or ignore
      } else {
         // If not a power card from deck, turn potentially ends depending on action taken later
         // No turn advancement happens *here* in drawCard anymore.
         // Turn advancement is handled by the action chosen *after* drawing.
      }

      transaction.update(gameDocRef, updateData);
    });
    
    // Use the separately stored ID for logging
    logger.info('drawCard', 'Card drawn successfully', { gameId, userId, source, cardId: drawnCardId });
    return drawnCardToReturn;
  } catch (error) {
    logger.error('drawCard', 'Failed to draw card', { error, gameId, userId, source });
    throw error;
  }
};

/**
 * Exchanges the drawn card with one of the player's face-down cards
 * @param gameId The ID of the game
 * @param userId The ID of the user making the exchange
 * @param cardPosition The position of the card to exchange (0-3)
 */
export const exchangeCard = async (
  gameId: string,
  userId: string,
  cardPosition: CardPosition
): Promise<void> => {
  logger.info('exchangeCard', 'Player exchanging card', { gameId, userId, cardPosition });
  
  const gameDocRef = doc(db, 'scambodiaGames', gameId);
  
  try {
    await runTransaction(db, async (transaction) => {
      // Read the current game state
      const gameDoc = await transaction.get(gameDocRef);
      if (!gameDoc.exists()) {
        throw new Error('Game not found.');
      }
      
      const gameState = gameDoc.data() as ScambodiaGameState;
      const currentRound = gameState.currentRoundNumber;
      const roundState = gameState.rounds[currentRound];
      
      // Validation checks
      if (gameState.status !== 'Playing') {
        throw new Error('Game is not in playing state.');
      }
      
      if (roundState.currentTurnPlayerId !== userId) {
        throw new Error('Not your turn to exchange a card.');
      }
      
      // Verify player has a drawn card
      if (!roundState.drawnCard || roundState.drawnCardUserId !== userId) {
        throw new Error('You must draw a card before exchanging.');
      }
      
      // Get the drawn card
      const drawnCard = { ...roundState.drawnCard }; // Clone to modify
      const drawnCardSource = roundState.drawnCardSource;
      
      // Check for Red King Power Activation
      const isRedKing = drawnCard.rank === 'K' && (drawnCard.suit === 'Hearts' || drawnCard.suit === 'Diamonds');
      if (isRedKing && drawnCardSource === 'deck') {
          // Activate the zero value power flag if drawn from deck and exchanged
          drawnCard.redKingZeroValueActive = true;
          logger.info('exchangeCard', 'Red King zero value power activated', { gameId, userId, cardId: drawnCard.id });
      }

      // Get player's cards
      const playerCards = roundState.playerCards[userId];
      if (!playerCards) {
        throw new Error('Player cards not found.');
      }
      
      // The card that will be replaced
      const replacedCard = playerCards[cardPosition];
      
      if (!replacedCard) {
        throw new Error('No card at that position to exchange.');
      }
      
      // Update player cards, putting the drawn card in place and adding the replaced card to discard
      const updatedPlayerCards = [...playerCards];
      updatedPlayerCards[cardPosition] = drawnCard;
      
      // Add the replaced card to the discard pile
      const updatedDiscardPile = [...roundState.discardPile, replacedCard];
      
      // Clear pending power decision if it exists
      const pendingPower = roundState.pendingPowerDecision;

      // Update game state
      const updateData: Record<string, any> = {
        [`rounds.${currentRound}.playerCards.${userId}`]: updatedPlayerCards,
        [`rounds.${currentRound}.discardPile`]: updatedDiscardPile,
        [`rounds.${currentRound}.drawnCard`]: null,
        [`rounds.${currentRound}.drawnCardUserId`]: null,
        [`rounds.${currentRound}.drawnCardSource`]: null,
        [`rounds.${currentRound}.actions`]: arrayUnion({
          type: 'Exchange',
          playerId: userId,
          cardId: drawnCard.id,
          cardPosition,
          timestamp: Timestamp.now()
        }),
        [`rounds.${currentRound}.currentTurnPlayerId`]: getNextPlayerId(gameState.players, userId),
        updatedAt: serverTimestamp()
      };
      // If a power decision was pending, clear it as it was ignored
      if (pendingPower) {
        updateData[`rounds.${currentRound}.pendingPowerDecision`] = null;
      }
      transaction.update(gameDocRef, updateData);
    });
    
    logger.info('exchangeCard', 'Card exchanged successfully', { 
      gameId, 
      userId, 
      cardPosition 
    });
  } catch (error) {
    logger.error('exchangeCard', 'Failed to exchange card', { error, gameId, userId, cardPosition });
    throw error;
  }
};

/**
 * Ignores a pending power decision by discarding the drawn card and advancing turn.
 * This is only valid when a power card was drawn from the deck and the player chooses not to redeem it.
 */
export const ignorePendingPower = async (
  gameId: string,
  userId: string
): Promise<void> => {
  logger.info('ignorePendingPower', 'Player ignoring pending power', { gameId, userId });

  const gameDocRef = doc(db, 'scambodiaGames', gameId);

  try {
    await runTransaction(db, async (transaction) => {
      const gameDoc = await transaction.get(gameDocRef);
      if (!gameDoc.exists()) throw new Error('Game not found.');

      const gameState = gameDoc.data() as ScambodiaGameState;
      const currentRound = gameState.currentRoundNumber;
      const roundState = gameState.rounds[currentRound];

      // Validation
      if (gameState.status !== 'Playing') throw new Error('Game is not in playing state.');
      if (roundState.currentTurnPlayerId !== userId) throw new Error('Not your turn.');
      if (!roundState.pendingPowerDecision) throw new Error('No pending power to ignore.');
      if (!roundState.drawnCard || roundState.drawnCardUserId !== userId) throw new Error('No drawn card to discard.');

      const discardedCard = roundState.drawnCard;
      const updatedDiscardPile = [...roundState.discardPile, discardedCard];

      const nextPlayerId = getNextPlayerId(gameState.players, userId);

      const updateData: Record<string, any> = {
        [`rounds.${currentRound}.discardPile`]: updatedDiscardPile,
        [`rounds.${currentRound}.pendingPowerDecision`]: null,
        [`rounds.${currentRound}.drawnCard`]: null,
        [`rounds.${currentRound}.drawnCardUserId`]: null,
        [`rounds.${currentRound}.drawnCardSource`]: null,
        [`rounds.${currentRound}.actions`]: arrayUnion({
          type: 'IgnorePower',
          playerId: userId,
          cardId: discardedCard.id,
          timestamp: Timestamp.now(),
        }),
        [`rounds.${currentRound}.currentTurnPlayerId`]: nextPlayerId,
        updatedAt: serverTimestamp(),
      };

      transaction.update(gameDocRef, updateData);
    });

    logger.info('ignorePendingPower', 'Pending power ignored successfully', { gameId, userId });
  } catch (error) {
    logger.error('ignorePendingPower', 'Failed to ignore power', { error, gameId, userId });
    throw error;
  }
};

/**
 * Discards the drawn card without exchanging
 * @param gameId The ID of the game
 * @param userId The ID of the user discarding
 */
export const discardDrawnCard = async (
  gameId: string,
  userId: string
): Promise<Card | null> => {
  logger.info('discardDrawnCard', 'Player discarding drawn card', { gameId, userId });
  
  const gameDocRef = doc(db, 'scambodiaGames', gameId);
  
  try {
    let discardedCard: Card | null = null;
    
    await runTransaction(db, async (transaction) => {
      // Read the current game state
      const gameDoc = await transaction.get(gameDocRef);
      if (!gameDoc.exists()) {
        throw new Error('Game not found.');
      }
      
      const gameState = gameDoc.data() as ScambodiaGameState;
      const currentRound = gameState.currentRoundNumber;
      const roundState = gameState.rounds[currentRound];
      
      // Validation checks
      if (gameState.status !== 'Playing') {
        throw new Error('Game is not in playing state.');
      }
      
      if (roundState.currentTurnPlayerId !== userId) {
        throw new Error('Not your turn to discard a card.');
      }
      
      // Verify player has a drawn card
      if (!roundState.drawnCard || roundState.drawnCardUserId !== userId) {
        throw new Error('You must draw a card before discarding.');
      }
      
      // Get the drawn card
      discardedCard = roundState.drawnCard;
      
      // Add card to discard pile
      const updatedDiscardPile = [...roundState.discardPile, discardedCard];
      
      // Clear pending power decision if it exists
      const pendingPower = roundState.pendingPowerDecision;
      
      // Prepare the data to update in Firestore
      const updateData: Record<string, any> = {
        [`rounds.${currentRound}.discardPile`]: updatedDiscardPile,
        [`rounds.${currentRound}.drawnCard`]: null,
        [`rounds.${currentRound}.drawnCardUserId`]: null,
        [`rounds.${currentRound}.drawnCardSource`]: null,
        [`rounds.${currentRound}.actions`]: arrayUnion({
          type: 'Discard',
          playerId: userId,
          cardId: discardedCard.id,
          timestamp: Timestamp.now()
        }),
        updatedAt: serverTimestamp()
      };

      // Always advance the turn after discarding (unless power flow was chosen earlier)
      updateData[`rounds.${currentRound}.currentTurnPlayerId`] = getNextPlayerId(gameState.players, userId);

      // If a power decision was pending, clear it as it was ignored
      if (pendingPower) {
        updateData[`rounds.${currentRound}.pendingPowerDecision`] = null;
      }
      
      // Update game state
      transaction.update(gameDocRef, updateData);
    });
    
    logger.info('discardDrawnCard', 'Card discarded successfully', { 
      gameId, 
      userId, 
      cardId: discardedCard ? (discardedCard as Card).id : undefined
    });
    
    return discardedCard;
  } catch (error) {
    logger.error('discardDrawnCard', 'Failed to discard card', { error, gameId, userId });
    throw error;
  }
};

/**
 * Attempts to match a player's card with the top card of the discard pile.
 * This action can only be taken at the start of the turn, BEFORE drawing.
 * @param gameId The ID of the game
 * @param userId The ID of the user attempting match
 * @param cardPosition The position of the player's card to match (0-3)
 */
export const attemptMatch = async (
  gameId: string,
  userId: string,
  cardPosition: CardPosition
): Promise<boolean> => {
  logger.info('attemptMatch', 'Player attempting discard pile match', { gameId, userId, cardPosition });
  
  const gameDocRef = doc(db, 'scambodiaGames', gameId);
  
  try {
    let matchSuccess = false;
    
    await runTransaction(db, async (transaction) => {
      const gameDoc = await transaction.get(gameDocRef);
      if (!gameDoc.exists()) throw new Error('Game not found.');
      
      const gameState = gameDoc.data() as ScambodiaGameState;
      const currentRound = gameState.currentRoundNumber;
      const roundState = gameState.rounds[currentRound];
      
      // Validation checks
      if (gameState.status !== 'Playing') throw new Error('Game is not in playing state.');
      if (roundState.currentTurnPlayerId !== userId) throw new Error('Not your turn to attempt a match.');
      if (roundState.drawnCard !== null) throw new Error('Cannot attempt match after drawing a card.'); // Crucial check
      if (roundState.discardPile.length === 0) throw new Error('Discard pile is empty, cannot attempt match.');

      const topDiscardCard = roundState.discardPile[roundState.discardPile.length - 1];
      
      // Get player's cards
      const playerCards = roundState.playerCards[userId];
      if (!playerCards) throw new Error('Player cards not found.');
      
      // Get the card to match from player's hand
      const playerCardToMatch = playerCards[cardPosition];
      if (!playerCardToMatch) throw new Error('No card at that position to match.');
      
      // Check if the cards match (same rank)
      matchSuccess = topDiscardCard.rank === playerCardToMatch.rank;
      
      const actionBase = {
        playerId: userId,
        cardPosition,
        discardCardId: topDiscardCard.id, 
        playerCardId: playerCardToMatch.id,
        success: matchSuccess,
        timestamp: Timestamp.now()
      };
      
      if (matchSuccess) {
        const updatedPlayerCards = [...playerCards];
        updatedPlayerCards[cardPosition] = null; // Mark player's card as discarded
        
        // Keep existing discard pile and add the matched player card as the new top
        const updatedDiscardPile = [...roundState.discardPile, playerCardToMatch];

        const updateData: Record<string, any> = {
          [`rounds.${currentRound}.playerCards.${userId}`]: updatedPlayerCards,
          [`rounds.${currentRound}.discardPile`]: updatedDiscardPile,
          [`rounds.${currentRound}.actions`]: arrayUnion({ ...actionBase, type: 'MatchSuccess' }),
          updatedAt: serverTimestamp()
        };

        // Check win condition (all cards null)
        const hasWon = updatedPlayerCards.every(card => card === null);
        if (hasWon) {
          logger.info('attemptMatch', 'Player discarded all cards via match - triggering Scoring', { gameId, userId });
          updateData[`rounds.${currentRound}.phase`] = 'Scoring';
        } else {
          // Advance turn if match succeeded but didn't win
          updateData[`rounds.${currentRound}.currentTurnPlayerId`] = getNextPlayerId(gameState.players, userId);
        }
        transaction.update(gameDocRef, updateData);

      } else {
        // Match failed - swap player's selected card with top of discard pile and end turn
        const updatedPlayerCards = [...playerCards];
        updatedPlayerCards[cardPosition] = topDiscardCard; // Player now gets the discard card

        // Replace the top of discard pile with the player's card
        const updatedDiscardPile = [...roundState.discardPile];
        updatedDiscardPile[updatedDiscardPile.length - 1] = playerCardToMatch;

        transaction.update(gameDocRef, {
          [`rounds.${currentRound}.playerCards.${userId}`]: updatedPlayerCards,
          [`rounds.${currentRound}.discardPile`]: updatedDiscardPile,
          [`rounds.${currentRound}.actions`]: arrayUnion({ ...actionBase, type: 'MatchFailSwap' }),
          [`rounds.${currentRound}.currentTurnPlayerId`]: getNextPlayerId(gameState.players, userId),
          updatedAt: serverTimestamp()
        });
      }
    });
    
    logger.info('attemptMatch', 'Match attempt completed', { gameId, userId, cardPosition, matchSuccess });
    return matchSuccess;
  } catch (error) {
    logger.error('attemptMatch', 'Failed to attempt match', { error, gameId, userId, cardPosition });
    throw error;
  }
};

/**
 * Declares "Scambodia" - claiming to have the lowest total score
 * @param gameId The ID of the game
 * @param userId The ID of the user declaring
 */
export const declareScambodia = async (
  gameId: string,
  userId: string
): Promise<void> => {
  logger.info('declareScambodia', 'Player declaring Scambodia', { gameId, userId });
  const gameDocRef = doc(db, 'scambodiaGames', gameId);
  
  try {
    await runTransaction(db, async (transaction) => {
      const gameDoc = await transaction.get(gameDocRef);
      if (!gameDoc.exists()) throw new Error('Game not found.');
      
      const gameState = gameDoc.data() as ScambodiaGameState;
      const currentRound = gameState.currentRoundNumber;
      const roundState = gameState.rounds[currentRound];
      
      // Validation checks
      if (gameState.status !== 'Playing') throw new Error('Game is not in playing state.');
      if (roundState.currentTurnPlayerId !== userId) throw new Error('Not your turn to declare Scambodia.');
      if (roundState.playerDeclaredScambodia) throw new Error('Scambodia has already been declared this round.');
      
      // Create the action object
      const action = {
        type: 'DeclareScambodia' as const,
        playerId: userId,
        timestamp: Timestamp.now()
      };

      // Update game state
      transaction.update(gameDocRef, {
        [`rounds.${currentRound}.playerDeclaredScambodia`]: userId,
        [`rounds.${currentRound}.phase`]: 'FinalTurn',
        // Use arrayUnion for the action
        [`rounds.${currentRound}.actions`]: arrayUnion(action),
        [`rounds.${currentRound}.currentTurnPlayerId`]: getNextPlayerId(gameState.players, userId),
        updatedAt: serverTimestamp()
      });
    });
    
    logger.info('declareScambodia', 'Scambodia declared successfully', { gameId, userId });
  } catch (error) {
    logger.error('declareScambodia', 'Failed to declare Scambodia', { error, gameId, userId });
    throw error;
  }
};

/**
 * Uses a special card power
 * @param gameId The ID of the game
 * @param userId The ID of the user using power
 * @param powerType The type of power to use
 * @param params Additional parameters for the power
 */
export const usePower = async (
  gameId: string,
  userId: string,
  powerType: CardPowerType,
  params: any
): Promise<void> => {
  logger.info('usePower', 'Player using card power', { gameId, userId, powerType, params });
  
  const gameDocRef = doc(db, 'scambodiaGames', gameId);
  
  try {
    await runTransaction(db, async (transaction) => {
      // Read the current game state
      const gameDoc = await transaction.get(gameDocRef);
      if (!gameDoc.exists()) {
        throw new Error('Game not found.');
      }
      
      const gameState = gameDoc.data() as ScambodiaGameState;
      const currentRound = gameState.currentRoundNumber;
      const roundState = gameState.rounds[currentRound];
      
      // Validation checks
      if (gameState.status !== 'Playing') {
        throw new Error('Game is not in playing state.');
      }
      
      if (roundState.currentTurnPlayerId !== userId) {
        throw new Error('Not your turn to use a power.');
      }
      
      // Record power usage
      const powerAction: CardPowerAction = {
        type: powerType,
        playerId: userId,
        ...params, // Include any additional parameters
        timestamp: Timestamp.now()
      };
      
      // Handle specific power logic
      switch (powerType) {
        case 'Peek_Own': {
          // Params: { cardIndex: CardPosition }
          const cardIndex = params.cardIndex;
          if (cardIndex === undefined || cardIndex < 0 || cardIndex >= CARDS_PER_PLAYER) {
            throw new Error('Invalid card index provided for Peek_Own.');
          }
          // Add the card index to the player's visible set
          const updatedVisible = { ...roundState.visibleToPlayer };
          if (!updatedVisible[userId]) updatedVisible[userId] = [];
          if (!updatedVisible[userId].includes(cardIndex)) {
            updatedVisible[userId] = [...updatedVisible[userId], cardIndex];
          }
          // Update Firestore only with visibility changes and log
          transaction.update(gameDocRef, {
            [`rounds.${currentRound}.visibleToPlayer`]: updatedVisible,
            [`rounds.${currentRound}.cardPowersUsed`]: arrayUnion(powerAction),
            updatedAt: serverTimestamp()
          });
          break;
        }
        case 'Peek_Opponent': {
          // Params: { targetPlayerId: string, cardIndex: CardPosition }
          const targetPlayerId = params.targetPlayerId;
          const cardIndex = params.cardIndex;
          if (!targetPlayerId || cardIndex === undefined || cardIndex < 0 || cardIndex >= CARDS_PER_PLAYER) {
            throw new Error('Invalid parameters provided for Peek_Opponent.');
          }
          if (targetPlayerId === userId) {
            throw new Error('Cannot use Peek_Opponent on yourself.');
          }
          if (!gameState.players.some(p => p.userId === targetPlayerId)) {
            throw new Error('Target player not found in this game.');
          }

          // Add the opponent's card info to the *current player's* visibility
          const updatedVisible = { ...roundState.visibleToPlayer };
          if (!updatedVisible[userId]) updatedVisible[userId] = [];
          // Use a string format `targetId:index` to store opponent visibility
          const visibilityKey = `${targetPlayerId}:${cardIndex}`;
          if (!updatedVisible[userId].some(item => item === visibilityKey)) {
             // Need to handle the type mismatch - storing string in CardPosition[]
             // For simplicity, we cast to any, but a better type approach might be needed.
             updatedVisible[userId] = [...updatedVisible[userId], visibilityKey as any];
          }

          // Update Firestore only with visibility changes and log
          transaction.update(gameDocRef, {
            [`rounds.${currentRound}.visibleToPlayer`]: updatedVisible,
            [`rounds.${currentRound}.cardPowersUsed`]: arrayUnion(powerAction),
            updatedAt: serverTimestamp()
          });
          break;
        }
        case 'Blind_Swap': {
           // Params: { cardIndex: CardPosition, targetPlayerId: string, targetCardIndex: CardPosition }
           const sourceCardIndex = params.cardIndex; // User's own card index
           const targetPlayerId = params.targetPlayerId;
           const targetCardIndex = params.targetCardIndex; // Opponent's card index

           if (targetPlayerId === undefined || sourceCardIndex === undefined || targetCardIndex === undefined ||
               sourceCardIndex < 0 || sourceCardIndex >= CARDS_PER_PLAYER ||
               targetCardIndex < 0 || targetCardIndex >= CARDS_PER_PLAYER) {
             throw new Error('Invalid parameters provided for Blind_Swap.');
           }
           if (targetPlayerId === userId) {
             throw new Error('Cannot swap with yourself.');
           }
           const targetPlayerExists = gameState.players.some(p => p.userId === targetPlayerId);
           if (!targetPlayerExists) {
             throw new Error('Target player not found.');
           }

           const sourceCards = roundState.playerCards[userId];
           const targetCards = roundState.playerCards[targetPlayerId];

           if (!sourceCards || !targetCards) throw new Error('Player card data missing.');
           // Make copies to avoid direct mutation before transaction
           const updatedSourceCards = [...sourceCards];
           const updatedTargetCards = [...targetCards];

           const sourceCard = updatedSourceCards[sourceCardIndex];
           const targetCard = updatedTargetCards[targetCardIndex];

           if (sourceCard === null || targetCard === null) {
             throw new Error('Cannot swap with an empty card slot.'); // Prevent swapping discarded cards
           }

           // Perform the swap
           updatedSourceCards[sourceCardIndex] = targetCard;
           updatedTargetCards[targetCardIndex] = sourceCard;

           // Update both players' card arrays and log the action
           transaction.update(gameDocRef, {
             [`rounds.${currentRound}.playerCards.${userId}`]: updatedSourceCards,
             [`rounds.${currentRound}.playerCards.${targetPlayerId}`]: updatedTargetCards,
             [`rounds.${currentRound}.cardPowersUsed`]: arrayUnion(powerAction),
             updatedAt: serverTimestamp()
           });
           // Visibility does not change in a blind swap
           break;
        }
        case 'Seen_Swap': {
          // Params: { cardIndex: CardPosition, targetPlayerId: string, targetCardIndex: CardPosition }
          // Note: Server validates action, not whether cards were actually 'seen' via Peek.
          const sourceCardIndex = params.cardIndex;
          const targetPlayerId = params.targetPlayerId;
          const targetCardIndex = params.targetCardIndex;

          if (targetPlayerId === undefined || sourceCardIndex === undefined || targetCardIndex === undefined ||
              sourceCardIndex < 0 || sourceCardIndex >= CARDS_PER_PLAYER ||
              targetCardIndex < 0 || targetCardIndex >= CARDS_PER_PLAYER) {
            throw new Error('Invalid parameters provided for Seen_Swap.');
          }
          if (targetPlayerId === userId) {
            throw new Error('Cannot swap with yourself.');
          }
          const targetPlayerExists = gameState.players.some(p => p.userId === targetPlayerId);
           if (!targetPlayerExists) {
             throw new Error('Target player not found.');
           }

          const sourceCards = roundState.playerCards[userId];
          const targetCards = roundState.playerCards[targetPlayerId];

          if (!sourceCards || !targetCards) throw new Error('Player card data missing.');
          // Make copies
          const updatedSourceCards = [...sourceCards];
          const updatedTargetCards = [...targetCards];

          const sourceCard = updatedSourceCards[sourceCardIndex];
          const targetCard = updatedTargetCards[targetCardIndex];

          if (sourceCard === null || targetCard === null) {
             throw new Error('Cannot swap with an empty card slot.');
          }

          // Perform the swap
          updatedSourceCards[sourceCardIndex] = targetCard;
          updatedTargetCards[targetCardIndex] = sourceCard;

          // Update visibility: After swap, both players know the card they *received*
          const updatedVisible = { ...roundState.visibleToPlayer };
          // Player performing swap knows the card they received (at sourceCardIndex)
          if (!updatedVisible[userId]) updatedVisible[userId] = [];
          if (!updatedVisible[userId].includes(sourceCardIndex)) {
            updatedVisible[userId] = [...updatedVisible[userId], sourceCardIndex];
          }
          // Target player knows the card they received (at targetCardIndex)
          if (!updatedVisible[targetPlayerId]) updatedVisible[targetPlayerId] = [];
           if (!updatedVisible[targetPlayerId].includes(targetCardIndex)) {
            updatedVisible[targetPlayerId] = [...updatedVisible[targetPlayerId], targetCardIndex];
          }

          // Update card arrays, visibility, and log
          transaction.update(gameDocRef, {
            [`rounds.${currentRound}.playerCards.${userId}`]: updatedSourceCards,
            [`rounds.${currentRound}.playerCards.${targetPlayerId}`]: updatedTargetCards,
            [`rounds.${currentRound}.visibleToPlayer`]: updatedVisible,
            [`rounds.${currentRound}.cardPowersUsed`]: arrayUnion(powerAction),
            updatedAt: serverTimestamp()
          });
          break;
        }
        default:
          // This ensures exhaustive check if CardPowerType changes
          const exhaustiveCheck: never = powerType;
          throw new Error(`Unsupported power type: ${exhaustiveCheck}`);
      }
      // Turn does NOT end automatically after using power - requires explicit endTurn call from client
    });
    
    logger.info('usePower', 'Card power used successfully', { 
      gameId, 
      userId, 
      powerType
    });
  } catch (error) {
    logger.error('usePower', 'Failed to use card power', { error, gameId, userId, powerType });
    throw error;
  }
};

/**
 * Calculates final scores for a round and updates the game state.
 * @param gameId The ID of the game.
 */
export const scoreRound = async (gameId: string): Promise<void> => {
  logger.info('scoreRound', 'Calculating scores for round', { gameId });
  const gameDocRef = doc(db, 'scambodiaGames', gameId);

  try {
    await runTransaction(db, async (transaction) => {
      const gameDoc = await transaction.get(gameDocRef);
      if (!gameDoc.exists()) {
        throw new Error('Game not found.');
      }

      const gameState = gameDoc.data() as ScambodiaGameState;
      const currentRound = gameState.currentRoundNumber;
      const roundState = gameState.rounds[currentRound];

      // Make sure round is ready for scoring
      if (gameState.status !== 'Playing') {
        throw new Error('Game is not in playing state.');
      }

      if (roundState.phase !== 'FinalTurn' && roundState.phase !== 'Scoring') {
        throw new Error('Round is not ready for scoring.');
      }

      // Calculate scores for each player
      const roundScores: { [playerId: string]: number } = {};
      const playerCards = roundState.playerCards;

      for (const [playerId, cards] of Object.entries(playerCards)) {
        let playerScore = 0;
        
        // Sum up values of remaining cards (null cards don't count)
        cards.forEach(card => {
          if (card !== null) {
            playerScore += card.value;
          }
        });

        roundScores[playerId] = playerScore;
      }

      // Determine round winner (lowest score)
      let lowestScore = Infinity;
      let roundWinnerId = null;

      for (const [playerId, score] of Object.entries(roundScores)) {
        if (score < lowestScore) {
          lowestScore = score;
          roundWinnerId = playerId;
        }
      }

      // Update cumulative scores
      const cumulativeScores = { ...gameState.cumulativeScores };
      for (const [playerId, score] of Object.entries(roundScores)) {
        if (!cumulativeScores[playerId]) {
          cumulativeScores[playerId] = 0;
        }
        cumulativeScores[playerId] += score;
      }

      // Check if a player successfully called Scambodia
      if (roundState.playerDeclaredScambodia) {
        const declaredPlayerId = roundState.playerDeclaredScambodia;
        const declaredPlayerScore = roundScores[declaredPlayerId];

        // Check if this player had the lowest score
        const wasCorrect = declaredPlayerId === roundWinnerId;
        
        // Update Scambodia calls counter
        const scambodiaCalls = { ...gameState.scambodiaCalls };
        if (wasCorrect) {
          scambodiaCalls[declaredPlayerId] = (scambodiaCalls[declaredPlayerId] || 0) + 1;
        }

        transaction.update(gameDocRef, {
          scambodiaCalls,
          [`rounds.${currentRound}.scambodiaCorrect`]: wasCorrect
        });
      }

      // Update round state with scores
      transaction.update(gameDocRef, {
        [`rounds.${currentRound}.scores`]: roundScores,
        [`rounds.${currentRound}.roundWinnerId`]: roundWinnerId,
        updatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    logger.error('scoreRound', 'Failed to score round', { error, gameId });
    throw error;
  }
};

/**
 * Marks a player as having completed the initial peek phase.
 * Transitions the game to the 'Playing' phase if all players have completed their peek.
 * @param gameId The ID of the game.
 * @param userId The ID of the player completing the peek.
 * @param roundNumber The current round number.
 */
export const completeInitialPeek = async (
  gameId: string,
  userId: string,
  roundNumber: number
): Promise<void> => {
  logger.info('completeInitialPeek', 'Player completing initial peek', { gameId, userId, roundNumber });
  const gameDocRef = doc(db, 'scambodiaGames', gameId);

  try {
    await runTransaction(db, async (transaction) => {
      const gameDoc = await transaction.get(gameDocRef);
      if (!gameDoc.exists()) {
        throw new Error('Game not found.');
      }
      const gameState = gameDoc.data() as ScambodiaGameState;

      // Validate round number
      if (!gameState.rounds || !gameState.rounds[roundNumber]) {
        throw new Error(`Round ${roundNumber} not found in game state.`);
      }
      const roundState = gameState.rounds[roundNumber];

      // Check if player has already completed peek or if phase is wrong
      if (roundState.phase !== 'Setup') {
        logger.warn('completeInitialPeek', 'Attempted to complete peek outside of Setup phase', { gameId, userId, currentPhase: roundState.phase });
        return; // Not an error, just ignore if phase isn't Setup
      }
      if (roundState.playersCompletedPeek.includes(userId)) {
         logger.warn('completeInitialPeek', 'Player already completed peek', { gameId, userId });
         return; // Ignore if player already marked as complete
      }

      // Add player to the completed list
      const updateData: Record<string, any> = {
        [`rounds.${roundNumber}.playersCompletedPeek`]: arrayUnion(userId),
        updatedAt: serverTimestamp()
      };

      // Check if all players have now completed
      // Need to account for the player being added in this transaction
      const totalPlayers = gameState.players.length;
      const playersCompletedAfterUpdate = roundState.playersCompletedPeek.length + 1;

      if (playersCompletedAfterUpdate >= totalPlayers) {
        logger.info('completeInitialPeek', 'All players completed peek, transitioning to Playing phase', { gameId, roundNumber, totalPlayers });
        updateData[`rounds.${roundNumber}.phase`] = 'Playing';
        // Ensure the first player is set as the current turn player
        updateData[`rounds.${roundNumber}.currentTurnPlayerId`] = gameState.players[0].userId;
      } else {
         logger.info('completeInitialPeek', 'Player completed peek, waiting for others', { gameId, roundNumber, completed: playersCompletedAfterUpdate, total: totalPlayers });
      }

      // Perform the update
      transaction.update(gameDocRef, updateData);
    });

    logger.info('completeInitialPeek', 'Initial peek completion processed successfully', { gameId, userId, roundNumber });
  } catch (error) {
    logger.error('completeInitialPeek', 'Failed to complete initial peek', { error, gameId, userId, roundNumber });
    throw error; // Re-throw to be handled by the caller
  }
};

export const endTurn = async (
  gameId: string,
  userId: string
): Promise<void> => {
  logger.info('endTurn', 'Player ending turn', { gameId, userId });
  const gameDocRef = doc(db, 'scambodiaGames', gameId);

  try {
    await runTransaction(db, async (transaction) => {
      const gameDoc = await transaction.get(gameDocRef);
      if (!gameDoc.exists()) throw new Error('Game not found.');
      const gameState = gameDoc.data() as ScambodiaGameState;
      const currentRound = gameState.currentRoundNumber;
      const roundState = gameState.rounds[currentRound];

      // Validation
      if (gameState.status !== 'Playing' && roundState.phase !== 'FinalTurn') {
         // Allow ending turn during 'Playing' OR 'FinalTurn' phases
        throw new Error('Game is not in a state where turn can be ended.'); 
      }
      if (roundState.currentTurnPlayerId !== userId) {
        throw new Error('Not your turn to end.');
      }
      
      const nextPlayerId = getNextPlayerId(gameState.players, userId);
      const action: PlayerAction = {
        type: 'EndTurn',
        playerId: userId,
        timestamp: Timestamp.now()
      };
      
      const updateData: Record<string, any> = {
        [`rounds.${currentRound}.actions`]: arrayUnion(action),
        updatedAt: serverTimestamp()
      };

      // Check if we are in the FinalTurn phase
      if (roundState.phase === 'FinalTurn') {
        // Check if the next player is the one who declared Scambodia
        if (nextPlayerId === roundState.playerDeclaredScambodia) {
          // Final turn loop is complete, move to Scoring phase
          logger.info('endTurn', 'FinalTurn loop complete, moving to Scoring', { gameId, roundNumber: currentRound });
          updateData[`rounds.${currentRound}.phase`] = 'Scoring';
          // Do NOT update currentTurnPlayerId, phase change handles flow
        } else {
          // Final turn loop continues, advance to next player
          updateData[`rounds.${currentRound}.currentTurnPlayerId`] = nextPlayerId;
        }
      } else {
        // Normal turn end during 'Playing' phase
        updateData[`rounds.${currentRound}.currentTurnPlayerId`] = nextPlayerId;
      }

      transaction.update(gameDocRef, updateData);
    });
    logger.info('endTurn', 'Turn ended successfully', { gameId, userId });
  } catch (error) {
    logger.error('endTurn', 'Failed to end turn', { error, gameId, userId });
    throw error;
  }
};

/**
 * Triggers the cloud function to calculate scores for a completed round.
 * @param gameId The ID of the game.
 * @param roundNumber The round number that just finished.
 */
export const triggerScoreCalculation = async (gameId: string, roundNumber: number): Promise<void> => {
  logger.info('triggerScoreCalculation (Client)', 'Requesting score calculation', { gameId, roundNumber });
  try {
    const result = await triggerScoreCalculationFn({ gameId, roundNumber });
    logger.info('triggerScoreCalculation (Client)', 'Score calculation triggered successfully', { gameId, roundNumber, result });
  } catch (error) {
    logger.error('triggerScoreCalculation (Client)', 'Error triggering score calculation', { error, gameId, roundNumber });
    throw error; // Re-throw for UI handling
  }
};

/**
 * Triggers the cloud function to transition the round or end the game.
 * @param gameId The ID of the game.
 * @param currentRoundNumber The round number that just completed.
 */
export const transitionScambodiaRound = async (data: { gameId: string, currentRoundNumber: number }): Promise<void> => {
  logger.info('transitionScambodiaRound (Client)', 'Requesting round transition', { data });
  try {
    await transitionScambodiaRoundFn(data);
    logger.info('transitionScambodiaRound (Client)', 'Round transition triggered successfully', { data });
  } catch (error) {
    logger.error('transitionScambodiaRound (Client)', 'Error triggering round transition', { error, data });
    throw error; 
  }
};

/**
 * [DEBUG ONLY] Forces the game to end with a specific winner.
 * @param gameId The ID of the game.
 * @param winningPlayerId The ID of the player to declare as winner.
 */
export const forceGameEndDebug = async (gameId: string, winningPlayerId: string): Promise<void> => {
  // Add component name as first arg
  logger.warn('forceGameEndDebug', '[DEBUG] Calling forceScambodiaGameEndDebug', { gameId, winningPlayerId });
  try {
    await forceGameEndDebugFn({ gameId, winningPlayerId });
    // Add component name as first arg
    logger.warn('forceGameEndDebug', '[DEBUG] forceScambodiaGameEndDebug called successfully.', { gameId });
  } catch (error) {
    // Add component name as first arg
    logger.error('forceGameEndDebug', '[DEBUG] Error calling forceScambodiaGameEndDebug', { error: error, gameId: gameId });
    throw error; // Re-throw to be caught by action handler
  }
};

/**
 * [DEBUG ONLY] Forces the current round to end, declaring a winner and moving to scoring.
 * @param gameId The ID of the game.
 * @param winningPlayerId The ID of the player to declare as round winner.
 * @param roundNumber The current round number.
 */
export const forceRoundEndDebug = async (
  gameId: string,
  winningPlayerId: string,
  roundNumber: number
): Promise<void> => {
  // Add component name as first arg
  logger.warn('forceRoundEndDebug', '[DEBUG] Calling forceScambodiaRoundEndDebug', { gameId, winningPlayerId, roundNumber });
  try {
    await forceRoundEndDebugFn({ gameId, winningPlayerId, roundNumber });
    // Add component name as first arg
    logger.warn('forceRoundEndDebug', '[DEBUG] forceScambodiaRoundEndDebug called successfully.', { gameId, roundNumber });
  } catch (error) {
    // Add component name as first arg
    logger.error('forceRoundEndDebug', '[DEBUG] Error calling forceScambodiaRoundEndDebug', { error: error, gameId: gameId, roundNumber: roundNumber });
    throw error; // Re-throw to be caught by action handler
  }
};

/**
 * [DEBUG ONLY] Forces the round to the scoring phase with dummy scores and a winner.
 */
export const forceScoreRoundDebug = async (
  gameId: string,
  winningPlayerId: string,
  roundNumber: number
): Promise<void> => {
  logger.warn('forceScoreRoundDebug (Client)', 'Requesting force round score', { gameId, winningPlayerId, roundNumber });
  try {
    await forceScambodiaRoundScoreDebugFn({ gameId, winningPlayerId, roundNumber });
    logger.warn('forceScoreRoundDebug (Client)', 'Force round score triggered successfully', { gameId, roundNumber });
  } catch (error) {
    logger.error('forceScoreRoundDebug (Client)', 'Error triggering force round score', { error, gameId, roundNumber });
    throw error;
  }
};

/**
 * Initiates the power card redemption flow.
 */
export const initiatePower = async (gameId: string, powerType: CardPowerType): Promise<void> => {
  const context = { gameId, powerType }; // For logging
  logger.info('initiatePower (Client)', 'Requesting power initiation', context);
  try {
    const user = auth.currentUser;
    logger.debug('initiatePower (Client)', 'User check 1', { uid: user?.uid, ...context });
    if (!user) {
      throw new Error('User must be authenticated to initiate power.');
    }
    logger.debug('initiatePower (Client)', 'Forcing token refresh...', { uid: user.uid, ...context });
    await user.getIdToken(true); // Force refresh the token
    logger.debug('initiatePower (Client)', 'Token refreshed. User check 2', { uid: auth.currentUser?.uid, ...context });
    if (!auth.currentUser) { // Double check after await
       throw new Error('User became unauthenticated during token refresh.');
    }
    logger.debug('initiatePower (Client)', 'Calling initiatePowerFn...', { uid: auth.currentUser.uid, ...context });
    await initiatePowerFn({ gameId, powerType });
    logger.info('initiatePower (Client)', 'Power initiated successfully', context);
  } catch (error) {
    logger.error('initiatePower (Client)', 'Error initiating power', { error, ...context });
    throw error;
  }
};

/**
 * Sends the selected target(s) to resolve the power effect.
 */
export const resolvePowerTarget = async (gameId: string, targetData: any): Promise<void> => {
  const context = { gameId, targetData };
  logger.info('resolvePowerTarget (Client)', 'Sending power targets', context);
  try {
    const user = auth.currentUser;
    logger.debug('resolvePowerTarget (Client)', 'User check 1', { uid: user?.uid, ...context });
    if (!user) {
      throw new Error('User must be authenticated to resolve power target.');
    }
    logger.debug('resolvePowerTarget (Client)', 'Forcing token refresh...', { uid: user.uid, ...context });
    await user.getIdToken(true); // Force refresh the token
    logger.debug('resolvePowerTarget (Client)', 'Token refreshed. User check 2', { uid: auth.currentUser?.uid, ...context });
     if (!auth.currentUser) { // Double check after await
       throw new Error('User became unauthenticated during token refresh.');
    }
    logger.debug('resolvePowerTarget (Client)', 'Calling resolvePowerTargetFn...', { uid: auth.currentUser.uid, ...context });
    await resolvePowerTargetFn({ gameId, targetData });
    logger.info('resolvePowerTarget (Client)', 'Power target resolution triggered successfully', { gameId });
  } catch (error) {
    logger.error('resolvePowerTarget (Client)', 'Error resolving power target', { error, ...context });
    throw error;
  }
};

/**
 * Skips the currently pending power card.
 */
export const skipPower = async (gameId: string): Promise<void> => {
  const context = { gameId };
  logger.info('skipPower (Client)', 'Requesting to skip power', context);
  try {
    const user = auth.currentUser;
    logger.debug('skipPower (Client)', 'User check 1', { uid: user?.uid, ...context });
    if (!user) {
      throw new Error('User must be authenticated to skip power.');
    }
    logger.debug('skipPower (Client)', 'Forcing token refresh...', { uid: user.uid, ...context });
    await user.getIdToken(true); // Force refresh the token
    logger.debug('skipPower (Client)', 'Token refreshed. User check 2', { uid: auth.currentUser?.uid, ...context });
     if (!auth.currentUser) { // Double check after await
       throw new Error('User became unauthenticated during token refresh.');
    }
     logger.debug('skipPower (Client)', 'Calling skipPowerFn...', { uid: auth.currentUser.uid, ...context });
    await skipPowerFn({ gameId });
    logger.info('skipPower (Client)', 'Skip power triggered successfully', context);
  } catch (error) {
    logger.error('skipPower (Client)', 'Error skipping power', { error, ...context });
    throw error;
  }
};
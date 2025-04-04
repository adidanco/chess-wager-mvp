import { db } from '../firebase';
import {
  collection, addDoc, serverTimestamp, doc, getDoc, Timestamp, runTransaction, writeBatch, increment
} from 'firebase/firestore';
import { RangvaarGameState, PlayerInfo, TeamId, GameStatus, RoundState, Card, BidInfo, PlayerPosition, RoundPhase, Suit, TrickCard, Trick } from '../types/rangvaar'; // Added TrickCard, Trick
import { UserProfile } from 'chessTypes'; // Import from the declared module
import { logger } from '../utils/logger';
import { PLAYER_POSITIONS, MAX_PLAYERS, INITIAL_DEAL_CARD_COUNT, MIN_BID, MAX_BID, FINAL_DEAL_CARD_COUNT, TOTAL_TRICKS_PER_ROUND } from '../constants/rangvaarConstants';
import { createDeck, shuffleDeck, determineWinnerOfTrick, calculateRoundScore, getCardRankValue } from '../lib/rangvaar/utils'; // Added determineWinner, calculateScore, getRankValue

/**
 * Creates a new Rangvaar game document in Firestore.
 * @param creatorUserId - The ID of the user creating the game.
 * @param wagerPerPlayer - The amount each player wagers.
 * @param totalRounds - The number of rounds for the game (3 or 5).
 * @returns The ID of the newly created game document.
 * @throws Throws an error if the creator's profile cannot be fetched or Firestore operation fails.
 */
export const createRangvaarGame = async (
  creatorUserId: string,
  wagerPerPlayer: number,
  totalRounds: 3 | 5
): Promise<string> => {
  logger.info('createRangvaarGame', 'Fetching creator profile', { creatorUserId });

  // Fetch creator's profile to get username and photoURL
  const userDocRef = doc(db, 'users', creatorUserId);
  const userDocSnap = await getDoc(userDocRef);

  if (!userDocSnap.exists()) {
    logger.error('createRangvaarGame', 'Creator user profile not found', { creatorUserId });
    throw new Error('Could not find your user profile to create the game.');
  }

  const userProfile = userDocSnap.data() as UserProfile;

  // Assign the creator to the first position and team
  const creatorPosition = PLAYER_POSITIONS[0]; // North
  const creatorTeamId: TeamId = 1;

  const creatorPlayerInfo: PlayerInfo = {
    userId: creatorUserId,
    username: userProfile.username || 'Player 1', // Fallback username
    photoURL: userProfile.photoURL || null, // Use null instead of undefined
    position: creatorPosition,
    teamId: creatorTeamId,
  };

  // Define the initial game state
  const initialGameState: Omit<RangvaarGameState, 'gameId' | 'createdAt' | 'updatedAt' | 'currentRoundState' | 'winnerTeamId'> & { createdAt: any, updatedAt: any } = { // Adjust type for serverTimestamp
    gameType: 'Rangvaar',
    status: 'Waiting',
    players: [creatorPlayerInfo], // Start with only the creator
    teams: {
      1: { playerIds: [creatorUserId], cumulativeScore: 0 },
      2: { playerIds: [], cumulativeScore: 0 },
    },
    wagerPerPlayer,
    totalRounds,
    currentRoundNumber: 0, // Game hasn't started yet
    createdAt: serverTimestamp(), 
    updatedAt: serverTimestamp(),
  };

  logger.info('createRangvaarGame', 'Attempting to add game document to Firestore', { initialGameState });

  try {
    const gameCollectionRef = collection(db, 'rangvaarGames');
    const docRef = await addDoc(gameCollectionRef, initialGameState);
    logger.info('createRangvaarGame', 'Successfully created game document', { gameId: docRef.id });
    return docRef.id; // Return the auto-generated game ID
  } catch (error) {
    logger.error('createRangvaarGame', 'Failed to add game document to Firestore', { error });
    throw new Error('Failed to create the game in the database. Please try again.');
  }
};

/**
 * Allows a user to join an existing Rangvaar game that is waiting for players.
 * Uses a transaction to ensure atomic updates.
 * @param gameId - The ID of the game to join.
 * @param userId - The ID of the user joining.
 * @throws Throws an error if the game cannot be joined (not found, full, not waiting, user already in).
 */
export const joinRangvaarGame = async (gameId: string, userId: string): Promise<void> => {
  logger.info('joinRangvaarGame', 'Attempting transaction to join game', { userId, gameId });
  const gameDocRef = doc(db, 'rangvaarGames', gameId);
  const userDocRef = doc(db, 'users', userId);

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Read game state and user profile within the transaction
      const gameDoc = await transaction.get(gameDocRef);
      const userDoc = await transaction.get(userDocRef);

      if (!gameDoc.exists()) {
        throw new Error('Game not found.');
      }
      if (!userDoc.exists()) {
        throw new Error('User profile not found.');
      }

      const gameState = gameDoc.data() as RangvaarGameState;
      const userProfile = userDoc.data() as UserProfile;

      // 2. Validate conditions for joining
      if (gameState.status !== 'Waiting') {
        throw new Error('Game is not waiting for players.');
      }
      if (gameState.players.length >= MAX_PLAYERS) {
        throw new Error('Game is already full.');
      }
      if (gameState.players.some(p => p.userId === userId)) {
        throw new Error('You are already in this game.');
      }
      
      // MVP Simplification: Check balance (non-transactional read is ok here for check)
      // In a full implementation, wager deduction would happen transactionally later.
      // const currentBalance = userProfile.balance || 0;
      // if (currentBalance < gameState.wagerPerPlayer) {
      //   throw new Error(`Insufficient balance (₹${currentBalance}) to join game requiring ₹${gameState.wagerPerPlayer}.`);
      // }

      // 3. Determine next position and team
      const currentPlayers = gameState.players;
      const nextPlayerIndex = currentPlayers.length;
      const nextPosition = PLAYER_POSITIONS[nextPlayerIndex];
      // Assign teams: 0, 2 are Team 1 (North, South); 1, 3 are Team 2 (East, West)
      const nextTeamId: TeamId = (nextPlayerIndex % 2 === 0) ? 1 : 2;
      
      const newPlayerInfo: PlayerInfo = {
        userId: userId,
        username: userProfile.username || `Player ${nextPlayerIndex + 1}`,
        photoURL: userProfile.photoURL || null, // Use null instead of undefined
        position: nextPosition,
        teamId: nextTeamId,
      };

      // 4. Prepare updates for the transaction
      const updatedPlayers = [...currentPlayers, newPlayerInfo];
      const updatedTeams = { ...gameState.teams };
      updatedTeams[nextTeamId].playerIds.push(userId);

      let updatedStatus: GameStatus = gameState.status;
      if (updatedPlayers.length === MAX_PLAYERS && gameState.status === 'Waiting') {
        updatedStatus = 'Starting'; // Game is now full, ready to start initializing
        logger.info('joinRangvaarGame', 'Game full, setting status to Starting', { gameId });
      }

      transaction.update(gameDocRef, {
        players: updatedPlayers,
        teams: updatedTeams,
        status: updatedStatus,
        updatedAt: serverTimestamp(),
      });
    });

    logger.info('joinRangvaarGame', 'Transaction successful, user joined game', { userId, gameId });
  } catch (error) {
    logger.error('joinRangvaarGame', 'Transaction failed', { userId, gameId, error });
    // Rethrow specific error messages from transaction or a generic one
    if (error instanceof Error) {
      throw error; // Rethrow errors like "Game not found", "Game full", etc.
    }
    throw new Error('Failed to join the game due to a database issue.');
  }
};

/**
 * Initializes the first round of a Rangvaar game.
 * Deals initial cards and sets the game state to start bidding.
 * Assumes the game is in 'Starting' status with MAX_PLAYERS.
 * @param gameId The ID of the game to start.
 * @throws Throws an error if the game state is invalid or update fails.
 */
export const startGameAndInitializeRound = async (gameId: string): Promise<void> => {
  logger.info('startGameAndInitializeRound', 'Attempting transaction to start game', { gameId });
  const gameDocRef = doc(db, 'rangvaarGames', gameId);

  try {
    await runTransaction(db, async (transaction) => {
      const gameDoc = await transaction.get(gameDocRef);
      if (!gameDoc.exists()) {
        throw new Error('Game not found.');
      }

      const gameState = gameDoc.data() as RangvaarGameState;

      // Validate conditions for starting
      if (gameState.status !== 'Starting') {
        // Avoid starting a game multiple times or if not ready
        logger.warn('startGameAndInitializeRound', 'Game not in Starting status', { gameId, status: gameState.status });
        // Depending on requirements, either throw error or just return
        // throw new Error(`Game is not in Starting status (current: ${gameState.status}).`); 
        return; // Silently exit if already started/not ready
      }
      if (gameState.players.length !== MAX_PLAYERS) {
        throw new Error('Game is not full yet.');
      }

      // --- Initialize Round 1 --- 
      const roundNumber = 1;
      const deck = shuffleDeck(createDeck());
      const hands: { [playerId: string]: Card[] } = {};
      gameState.players.forEach(player => {
        hands[player.userId] = [];
      });

      // Deal initial 5 cards
      for (let i = 0; i < INITIAL_DEAL_CARD_COUNT; i++) {
        for (const player of gameState.players) {
          const card = deck.pop(); // Take card from end of shuffled deck
          if (card) {
            hands[player.userId].push(card);
          } else {
            throw new Error('Deck ran out of cards unexpectedly during initial deal.');
          }
        }
      }
      
      // Determine dealer and first bidder (dealer is first player added, first bidder is next)
      const dealerInfo = gameState.players[0]; // Creator is always first for now
      const dealerPositionIndex = PLAYER_POSITIONS.indexOf(dealerInfo.position);
      const firstBidderIndex = (dealerPositionIndex + 1) % MAX_PLAYERS;
      const firstBidder = gameState.players.find(p => p.position === PLAYER_POSITIONS[firstBidderIndex]);

      if (!firstBidder) {
         throw new Error('Could not determine the first bidder.');
      }

      // Omit optional fields instead of setting to undefined
      const initialRoundState: Omit<RoundState, 'highestBid' | 'trumpSuit'> = {
        roundNumber: roundNumber,
        phase: 'Bidding',
        dealerPosition: dealerInfo.position,
        currentTurnPlayerId: firstBidder.userId,
        hands: hands, 
        bids: [],
        currentTrickNumber: 0,
        currentTrickCards: [],
        completedTricks: [],
        teamTricksWonThisRound: { 1: 0, 2: 0 },
        roundScores: { 1: 0, 2: 0 },
        penaltyApplied: false,
      };

      // Update Firestore document within the transaction
      transaction.update(gameDocRef, {
        status: 'Playing',
        currentRoundNumber: roundNumber,
        currentRoundState: initialRoundState,
        updatedAt: serverTimestamp(),
      });
      
       logger.info('startGameAndInitializeRound', 'Game started, Round 1 initialized', { gameId, firstBidderId: firstBidder.userId });
    });
  } catch (error) {
    logger.error('startGameAndInitializeRound', 'Transaction failed', { gameId, error });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to start the game due to a database issue.');
  }
};

/**
 * Gets the next player's ID in rotational order.
 */
const getNextPlayerId = (currentPlayerId: string, players: PlayerInfo[]): string => {
  const currentIndex = players.findIndex(p => p.userId === currentPlayerId);
  if (currentIndex === -1) throw new Error("Current player not found in player list.");
  
  // Determine turn order based on position relative to dealer/start
  // Simple clockwise rotation for now
  const sortedPlayers = [...players].sort((a, b) => PLAYER_POSITIONS.indexOf(a.position) - PLAYER_POSITIONS.indexOf(b.position));
  const sortedIndex = sortedPlayers.findIndex(p => p.userId === currentPlayerId);
  const nextSortedIndex = (sortedIndex + 1) % MAX_PLAYERS;
  return sortedPlayers[nextSortedIndex].userId;
};

/**
 * Handles a player submitting a bid or passing during the Bidding phase.
 * Uses a transaction for atomic updates.
 * @param gameId The ID of the game.
 * @param userId The ID of the player making the action.
 * @param bidAmount The amount the player bids (7-13), or null/undefined/0 to indicate passing.
 * @throws Throws an error if the action is invalid or the update fails.
 */
export const handlePlayerBid = async (gameId: string, userId: string, bidAmount: number | null | undefined): Promise<void> => {
  logger.info('handlePlayerBid', 'Attempting transaction for player bid/pass', { gameId, userId, bidAmount });
  const gameDocRef = doc(db, 'rangvaarGames', gameId);

  try {
    await runTransaction(db, async (transaction) => {
      const gameDoc = await transaction.get(gameDocRef);
      if (!gameDoc.exists()) {
        throw new Error('Game not found.');
      }
      const gameState = gameDoc.data() as RangvaarGameState;

      // --- Validations --- //
      if (gameState.status !== 'Playing') {
        throw new Error(`Game is not in Playing status (current: ${gameState.status}).`);
      }
      if (!gameState.currentRoundState) {
         throw new Error('Current round state is missing.');
      }
      const roundState = gameState.currentRoundState;
      if (roundState.phase !== 'Bidding') {
        throw new Error(`Action not allowed in current phase (${roundState.phase}).`);
      }
      if (roundState.currentTurnPlayerId !== userId) {
        throw new Error('It is not your turn to bid.');
      }

      let currentHighestBid = roundState.highestBid?.bidAmount || (MIN_BID - 1); // Effective 0 or min-1 before first bid
      const bidsSoFar = roundState.bids;
      const updatedBids = [...bidsSoFar];
      let newHighestBidInfo = roundState.highestBid;
      let isPassing = bidAmount === null || bidAmount === undefined || bidAmount <= 0;

      // --- Handle Bid / Pass --- //
      if (isPassing) {
        // Player passes. Add a conceptual 'pass' bid or just note it.
        // For simplicity, we track passes by seeing who *didn't* increase the bid.
        logger.info('handlePlayerBid', 'Player passed', { gameId, userId });
         // Add a dummy bid object to signify a pass occurred for logic checks
        updatedBids.push({ playerId: userId, bidAmount: 0 }); 
      } else {
        // Player made a bid
        const actualBid = bidAmount as number;
        logger.info('handlePlayerBid', 'Player bid', { gameId, userId, actualBid });

        // Validate bid amount
        if (bidsSoFar.length === 0 && actualBid < MIN_BID) {
          throw new Error(`First bid must be at least ${MIN_BID}.`);
        }
        if (actualBid <= currentHighestBid) {
          throw new Error(`Your bid (${actualBid}) must be higher than the current highest bid (${currentHighestBid}).`);
        }
        if (actualBid > MAX_BID) {
          throw new Error(`Bid cannot exceed ${MAX_BID}.`);
        }

        const bidInfo: BidInfo = { playerId: userId, bidAmount: actualBid };
        updatedBids.push(bidInfo);
        newHighestBidInfo = bidInfo; // Update highest bid
        currentHighestBid = actualBid;
      }

      // --- Determine Next State --- //
      let nextPlayerId = getNextPlayerId(userId, gameState.players);
      let nextPhase: RoundPhase = roundState.phase;
      
      // Check auction end conditions
      // Condition 1: All players have had a turn (placed bid or passed) AND 
      //              the turn returns to the current highest bidder.
      // Condition 2: (Alternative) After a valid bid, 3 consecutive players pass.

      // Simplified check: If 4 bids/passes recorded, check if turn comes back to highest bidder
      // More robust: track consecutive passes after the highest bid. Let's use a simpler approach for MVP.
      
      // Simple MVP check: If everyone has bid/passed once (MAX_PLAYERS entries in updatedBids since start) 
      // AND the next turn would be the highest bidder again, the auction ends.
      // Note: This simplified logic assumes no re-bidding after passing initially.
      const bidsSinceHighest = updatedBids.slice(updatedBids.findIndex(b => b.playerId === newHighestBidInfo?.playerId) + 1);
      const consecutivePasses = bidsSinceHighest.filter(b => b.bidAmount === 0).length;
      
      let auctionEnded = false;
      if (newHighestBidInfo) { // Check only if there is a highest bid
          // Condition 1: Turn comes back to the highest bidder
          if (nextPlayerId === newHighestBidInfo.playerId && updatedBids.length >= MAX_PLAYERS) {
              auctionEnded = true;
          }
          // Condition 2: 3 consecutive passes after the last highest bid
          if (bidsSinceHighest.length >= (MAX_PLAYERS - 1) && consecutivePasses === (MAX_PLAYERS - 1)) {
              auctionEnded = true;
          } 
          // Edge case: first player bids 7, everyone else passes immediately.
          if (bidsSoFar.length === 0 && !isPassing && consecutivePasses === (MAX_PLAYERS - 1)) { 
              // This check is tricky with the simple pass representation
              // Let's rely on the first two conditions mainly for MVP.
          }
      }

      if (auctionEnded && newHighestBidInfo) {
          logger.info('handlePlayerBid', 'Auction ended', { gameId, highestBidder: newHighestBidInfo.playerId, bid: newHighestBidInfo.bidAmount });
          nextPhase = 'TrumpSelection';
          nextPlayerId = newHighestBidInfo.playerId; // Highest bidder selects trump
      } else {
           logger.info('handlePlayerBid', 'Auction continues', { gameId, nextPlayerId });
          // Auction continues, next player's turn
          // nextPlayerId already calculated
      }

      // --- Prepare and Execute Transaction Update --- //
      const updatedRoundState: RoundState = {
        ...roundState,
        bids: updatedBids,
        highestBid: newHighestBidInfo,
        currentTurnPlayerId: nextPlayerId,
        phase: nextPhase,
      };

      transaction.update(gameDocRef, {
        currentRoundState: updatedRoundState,
        updatedAt: serverTimestamp(),
      });
    });
    logger.info('handlePlayerBid', 'Transaction successful', { gameId, userId });
  } catch (error) {
    logger.error('handlePlayerBid', 'Transaction failed', { gameId, userId, error });
    if (error instanceof Error) {
      throw error; // Rethrow specific validation errors
    }
    throw new Error('Failed to process bid due to a database issue.');
  }
};

/**
 * Handles the highest bidder selecting the trump suit.
 * Uses a transaction.
 * @param gameId The ID of the game.
 * @param userId The ID of the player selecting trump (must be the highest bidder).
 * @param selectedSuit The suit chosen as trump.
 * @throws Throws an error if the action is invalid.
 */
export const handleTrumpSelection = async (gameId: string, userId: string, selectedSuit: Suit): Promise<void> => {
  logger.info('handleTrumpSelection', 'Attempting transaction for trump selection', { gameId, userId, selectedSuit });
  const gameDocRef = doc(db, 'rangvaarGames', gameId);

  try {
    await runTransaction(db, async (transaction) => {
      const gameDoc = await transaction.get(gameDocRef);
      if (!gameDoc.exists()) throw new Error('Game not found.');
      const gameState = gameDoc.data() as RangvaarGameState;

      // --- Validations --- //
      if (gameState.status !== 'Playing') throw new Error('Game is not in Playing status.');
      if (!gameState.currentRoundState) throw new Error('Current round state is missing.');
      const roundState = gameState.currentRoundState;
      if (roundState.phase !== 'TrumpSelection') throw new Error('Not in Trump Selection phase.');
      if (roundState.currentTurnPlayerId !== userId) throw new Error('It is not your turn to select trump.');
      if (!roundState.highestBid || roundState.highestBid.playerId !== userId) {
        // This check is slightly redundant due to currentTurnPlayerId check, but good for safety
        throw new Error('Only the highest bidder can select trump.'); 
      }

      // --- Update State --- //
      const updatedRoundState: RoundState = {
        ...roundState,
        trumpSuit: selectedSuit,
        phase: 'DealingRest', // Move to phase where remaining cards are dealt
        // Keep currentTurnPlayerId as the bidder for now, they lead after cards are dealt
      };

      // --- Execute Transaction --- //
      transaction.update(gameDocRef, {
        currentRoundState: updatedRoundState,
        updatedAt: serverTimestamp(),
      });
      logger.info('handleTrumpSelection', 'Trump selected successfully', { gameId, trumpSuit: selectedSuit });
    });
  } catch (error) {
    logger.error('handleTrumpSelection', 'Transaction failed', { gameId, userId, error });
    if (error instanceof Error) throw error;
    throw new Error('Failed to select trump due to a database issue.');
  }
};

/**
 * Deals the remaining cards after trump selection.
 * Should be triggered after handleTrumpSelection (e.g., by an effect watching the phase change).
 * Uses a transaction.
 * @param gameId The ID of the game.
 * @throws Throws an error if the state is invalid or update fails.
 */
export const dealRemainingCards = async (gameId: string): Promise<void> => {
  logger.info('dealRemainingCards', 'Attempting transaction to deal remaining cards', { gameId });
  const gameDocRef = doc(db, 'rangvaarGames', gameId);

  try {
    await runTransaction(db, async (transaction) => {
      const gameDoc = await transaction.get(gameDocRef);
      if (!gameDoc.exists()) throw new Error('Game not found.');
      const gameState = gameDoc.data() as RangvaarGameState;

      // --- Validations --- //
      if (gameState.status !== 'Playing') throw new Error('Game is not in Playing status.');
      if (!gameState.currentRoundState) throw new Error('Current round state is missing.');
      const roundState = gameState.currentRoundState;
      // Ensure this runs only once after trump selection
      if (roundState.phase !== 'DealingRest') { 
        logger.warn('dealRemainingCards', 'Not in DealingRest phase, aborting.', { gameId, phase: roundState.phase });
        return; // Exit silently if not in correct phase (might be triggered multiple times)
      }
      if (!roundState.highestBid) throw new Error('Cannot deal cards, highest bidder info missing.');

      // --- Reconstruct Remaining Deck --- //
      // Create a full deck and remove cards already dealt in the initial phase
      const fullDeck = createDeck();
      const dealtCardIds = new Set<string>();
      Object.values(roundState.hands).forEach(hand => {
        hand.forEach(card => dealtCardIds.add(card.id));
      });
      
      const remainingDeckShuffled = shuffleDeck(fullDeck.filter(card => !dealtCardIds.has(card.id)));
      
      // Check if the deck size is correct
      const expectedRemaining = 52 - (gameState.players.length * INITIAL_DEAL_CARD_COUNT);
      if (remainingDeckShuffled.length !== expectedRemaining) {
          throw new Error(`Deck reconstruction error. Expected ${expectedRemaining} cards, found ${remainingDeckShuffled.length}`);
      }

      // --- Deal Remaining Cards --- //
      const updatedHands = { ...roundState.hands };
      for (let i = 0; i < FINAL_DEAL_CARD_COUNT; i++) {
          for (const player of gameState.players) {
              const card = remainingDeckShuffled.pop();
              if (card) {
                  updatedHands[player.userId].push(card);
              } else {
                  throw new Error('Deck ran out of cards unexpectedly during final deal.');
              }
          }
      }
      
      // Ensure all hands have 13 cards
      Object.values(updatedHands).forEach((hand, index) => {
        if (hand.length !== TOTAL_TRICKS_PER_ROUND) {
          throw new Error(`Player hand size incorrect after final deal for player ${index}. Expected ${TOTAL_TRICKS_PER_ROUND}, got ${hand.length}`);
        }
        // Optionally sort the hand for better UI presentation
        // updatedHands[gameState.players[index].userId] = sortHand(hand); 
      });

      // --- Update State for Trick Playing --- //
      const firstPlayerToLead = roundState.highestBid.playerId; // Highest bidder leads first trick

      const updatedRoundState: RoundState = {
        ...roundState,
        hands: updatedHands,
        phase: 'TrickPlaying',
        currentTurnPlayerId: firstPlayerToLead, 
        currentTrickNumber: 1, // Start the first trick
        currentTrickCards: [],
        completedTricks: [], // Reset completed tricks for the round
        teamTricksWonThisRound: { 1: 0, 2: 0 }, // Reset tricks won for the round
      };

      // --- Execute Transaction --- //
      transaction.update(gameDocRef, {
        currentRoundState: updatedRoundState,
        updatedAt: serverTimestamp(),
      });
      logger.info('dealRemainingCards', 'Remaining cards dealt, entering TrickPlaying phase', { gameId, firstPlayerToLead });
    });

  } catch (error) {
    logger.error('dealRemainingCards', 'Transaction failed', { gameId, error });
    if (error instanceof Error) throw error;
    throw new Error('Failed to deal remaining cards due to a database issue.');
  }
};

/**
 * Determines if a card is playable based on the player's hand and the current trick.
 * Exported for potential use in UI components.
 */
export const isCardPlayable = (cardToPlay: Card, hand: Card[], currentTrickCards: TrickCard[], trumpSuit: Suit | undefined): boolean => {
  if (!hand.some(c => c.id === cardToPlay.id)) {
    return false; // Card not in hand
  }

  if (currentTrickCards.length === 0) {
    return true; // Can lead with any card
  }

  const leadCard = currentTrickCards[0].card;
  const leadSuit = leadCard.suit;

  // Check if player has the lead suit
  const hasLeadSuit = hand.some(c => c.suit === leadSuit);

  if (hasLeadSuit) {
    // Must follow suit if possible
    return cardToPlay.suit === leadSuit;
  } else {
    // If cannot follow suit, can play any card (including trump)
    return true;
  }
};

/**
 * Handles a player playing a card during the TrickPlaying phase.
 * Determines trick winner, updates state, and handles round/game end.
 */
export const handlePlayCard = async (gameId: string, userId: string, cardId: string): Promise<void> => {
  logger.info('handlePlayCard', 'Attempting transaction to play card', { gameId, userId, cardId });
  const gameDocRef = doc(db, 'rangvaarGames', gameId);

  try {
    await runTransaction(db, async (transaction) => {
      const gameDoc = await transaction.get(gameDocRef);
      if (!gameDoc.exists()) throw new Error('Game not found.');
      const gameState = gameDoc.data() as RangvaarGameState;

      // --- Validations --- //
      if (gameState.status !== 'Playing') throw new Error('Game is not in Playing status.');
      if (!gameState.currentRoundState) throw new Error('Current round state is missing.');
      const roundState = gameState.currentRoundState;
      if (roundState.phase !== 'TrickPlaying') throw new Error('Not in Trick Playing phase.');
      if (roundState.currentTurnPlayerId !== userId) throw new Error('It is not your turn to play.');
      
      const playerHand = roundState.hands[userId];
      if (!playerHand) throw new Error('Player hand not found.');
      
      const cardToPlay = playerHand.find(c => c.id === cardId);
      if (!cardToPlay) throw new Error('Card not found in your hand.');
      
      if (!isCardPlayable(cardToPlay, playerHand, roundState.currentTrickCards, roundState.trumpSuit)) {
        const leadSuit = roundState.currentTrickCards.length > 0 ? roundState.currentTrickCards[0].card.suit : 'None';
        throw new Error(`Invalid move. You must follow the lead suit (${leadSuit}) if possible.`);
      }

      // --- Update State: Play Card --- //
      const updatedHand = playerHand.filter(c => c.id !== cardId);
      const updatedHands = { ...roundState.hands, [userId]: updatedHand };
      const updatedTrickCards = [...roundState.currentTrickCards, { playerId: userId, card: cardToPlay }];
      
      let nextPlayerId = getNextPlayerId(userId, gameState.players);
      let updatedRoundState: RoundState;
      let updatedGameState: Partial<RangvaarGameState> = {}; 

      // --- Check if Trick Ended --- //
      if (updatedTrickCards.length === MAX_PLAYERS) {
        logger.info('handlePlayCard', 'Trick completed', { gameId, trickNumber: roundState.currentTrickNumber });
        
        const trickWinnerId = determineWinnerOfTrick(updatedTrickCards, roundState.trumpSuit);
        const winningPlayerInfo = gameState.players.find(p => p.userId === trickWinnerId);
        if (!winningPlayerInfo) throw new Error('Could not find trick winner info.');
        const winningTeamId = winningPlayerInfo.teamId;

        const completedTrick: Trick = {
            cards: updatedTrickCards,
            leadSuit: updatedTrickCards[0].card.suit,
            winningPlayerId: trickWinnerId,
            trickNumber: roundState.currentTrickNumber
        };

        const updatedCompletedTricks = [...roundState.completedTricks, completedTrick];
        const updatedTeamTricksWon = { ...roundState.teamTricksWonThisRound };
        updatedTeamTricksWon[winningTeamId]++;

        // --- Check if Round Ended --- //
        if (roundState.currentTrickNumber === TOTAL_TRICKS_PER_ROUND) {
          logger.info('handlePlayCard', 'Round completed', { gameId, roundNumber: roundState.roundNumber });
          
          const team1PlayerId = gameState.teams[1].playerIds[0]; 
          const isTeam1Bidder = roundState.highestBid?.playerId === team1PlayerId || gameState.teams[1].playerIds.includes(roundState.highestBid?.playerId || '');
          
          const team1ScoreResult = calculateRoundScore(updatedTeamTricksWon[1], roundState.highestBid, isTeam1Bidder);
          const team2ScoreResult = calculateRoundScore(updatedTeamTricksWon[2], roundState.highestBid, !isTeam1Bidder);

          const finalRoundScores = { 1: team1ScoreResult.score, 2: team2ScoreResult.score };
          const penaltyAppliedThisRound = team1ScoreResult.penaltyApplied || team2ScoreResult.penaltyApplied;
          
          const updatedTeamsData = { 
              1: { ...gameState.teams[1], cumulativeScore: gameState.teams[1].cumulativeScore + finalRoundScores[1] }, 
              2: { ...gameState.teams[2], cumulativeScore: gameState.teams[2].cumulativeScore + finalRoundScores[2] }
          };
          updatedGameState.teams = updatedTeamsData;
          
          // --- Check if Game Ended --- //
          if (roundState.roundNumber === gameState.totalRounds) {
             logger.info('handlePlayCard', 'Game completed', { gameId });
             let winnerTeamId: TeamId | undefined = undefined;
             if (updatedTeamsData[1].cumulativeScore > updatedTeamsData[2].cumulativeScore) winnerTeamId = 1;
             else if (updatedTeamsData[2].cumulativeScore > updatedTeamsData[1].cumulativeScore) winnerTeamId = 2;
             
             updatedGameState.status = 'Finished';
             updatedGameState.winnerTeamId = winnerTeamId;
             
             updatedRoundState = {
                ...roundState,
                hands: updatedHands, 
                currentTrickCards: [], 
                completedTricks: updatedCompletedTricks,
                teamTricksWonThisRound: updatedTeamTricksWon,
                roundScores: finalRoundScores,
                penaltyApplied: penaltyAppliedThisRound,
                phase: 'RoundEnded', 
             };
             logger.info('handlePlayCard', 'Game ended processing complete', { gameId, winnerTeamId, finalScores: updatedTeamsData });
          } else {
             // Game continues, prepare for next round
             logger.info('handlePlayCard', 'Round ended, preparing for next round setup', { gameId, nextRound: roundState.roundNumber + 1 });
             updatedRoundState = {
                ...roundState, 
                hands: {}, 
                bids: [],
                currentTrickNumber: 0,
                currentTrickCards: [],
                completedTricks: [], 
                teamTricksWonThisRound: { 1: 0, 2: 0 }, 
                roundScores: finalRoundScores, 
                penaltyApplied: penaltyAppliedThisRound,
                phase: 'RoundEnded', 
                roundNumber: roundState.roundNumber, 
             };
          }
        } else {
          // Round continues, start next trick
           logger.info('handlePlayCard', 'Trick ended, starting next trick', { gameId, nextTrick: roundState.currentTrickNumber + 1, winnerId: trickWinnerId });
           updatedRoundState = {
            ...roundState,
            hands: updatedHands,
            currentTrickNumber: roundState.currentTrickNumber + 1,
            currentTrickCards: [], 
            completedTricks: updatedCompletedTricks,
            teamTricksWonThisRound: updatedTeamTricksWon,
            currentTurnPlayerId: trickWinnerId, 
          };
        }
      } else {
        // Trick continues, next player's turn
         logger.debug('handlePlayCard', 'Card played, trick continues', { gameId, nextPlayerId });
         updatedRoundState = {
          ...roundState,
          hands: updatedHands,
          currentTrickCards: updatedTrickCards,
          currentTurnPlayerId: nextPlayerId,
        };
      }

      // --- Execute Transaction --- //
      transaction.update(gameDocRef, {
        ...updatedGameState,
        currentRoundState: updatedRoundState,
        updatedAt: serverTimestamp(),
      });
    });

    logger.info('handlePlayCard', 'Transaction successful', { gameId, userId, cardId });

  } catch (error) {
    logger.error('handlePlayCard', 'Transaction failed', { gameId, userId, cardId, error });
    if (error instanceof Error) throw error;
    throw new Error('Failed to play card due to a database issue.');
  }
};

/**
 * Initializes the next round after one has ended.
 * Should be triggered when roundState.phase is 'RoundEnded' and game is not 'Finished'.
 * Uses a transaction.
 */
export const initializeNextRound = async (gameId: string): Promise<void> => {
  logger.info('initializeNextRound', 'Attempting transaction to start next round', { gameId });
  const gameDocRef = doc(db, 'rangvaarGames', gameId);

  try {
    await runTransaction(db, async (transaction) => {
      const gameDoc = await transaction.get(gameDocRef);
      if (!gameDoc.exists()) throw new Error('Game not found.');
      const gameState = gameDoc.data() as RangvaarGameState;

      // --- Validations --- //
      if (gameState.status === 'Finished' || gameState.status === 'Cancelled') {
          logger.warn('initializeNextRound', 'Game already finished or cancelled.', { gameId, status: gameState.status });
          return; 
      }
       if (gameState.status !== 'Playing') {
          // Should ideally only trigger if Playing and phase is RoundEnded
          logger.warn('initializeNextRound', 'Game not in expected state for starting next round.', { gameId, status: gameState.status });
           return;
      }
      if (!gameState.currentRoundState || gameState.currentRoundState.phase !== 'RoundEnded') {
          logger.warn('initializeNextRound', 'Previous round not ended yet.', { gameId, phase: gameState.currentRoundState?.phase });
          return; // Exit if previous round isn't marked as ended
      }
      if (gameState.currentRoundNumber >= gameState.totalRounds) {
          // This case should have been caught by handlePlayCard setting status to Finished
          logger.error('initializeNextRound', 'Attempting to start next round when game should be finished.', { gameId });
          // Optionally force status to Finished here as a fallback
           transaction.update(gameDocRef, { status: 'Finished', updatedAt: serverTimestamp() });
          return; 
      }

      // --- Initialize Next Round --- //
      const nextRoundNumber = gameState.currentRoundNumber + 1;
      const deck = shuffleDeck(createDeck());
      const hands: { [playerId: string]: Card[] } = {};
      gameState.players.forEach(player => { hands[player.userId] = []; });

      // Deal initial 5 cards
      for (let i = 0; i < INITIAL_DEAL_CARD_COUNT; i++) {
        for (const player of gameState.players) {
          const card = deck.pop();
          if (!card) throw new Error('Deck error during initial deal for next round.');
          hands[player.userId].push(card);
        }
      }
      
      // Determine next dealer and first bidder (rotates clockwise)
      const previousDealerPos = gameState.currentRoundState.dealerPosition;
      const previousDealerPosIndex = PLAYER_POSITIONS.indexOf(previousDealerPos);
      if (previousDealerPosIndex === -1) throw new Error ('Could not find previous dealer position.');
      
      const nextDealerPosIndex = (previousDealerPosIndex + 1) % MAX_PLAYERS;
      const nextDealerPosition = PLAYER_POSITIONS[nextDealerPosIndex];
      const nextFirstBidderIndex = (nextDealerPosIndex + 1) % MAX_PLAYERS;
      const nextFirstBidder = gameState.players.find(p => p.position === PLAYER_POSITIONS[nextFirstBidderIndex]);

      if (!nextFirstBidder) throw new Error('Could not determine the first bidder for the next round.');

      const nextRoundState: RoundState = {
        roundNumber: nextRoundNumber,
        phase: 'Bidding',
        dealerPosition: nextDealerPosition,
        currentTurnPlayerId: nextFirstBidder.userId,
        hands: hands,
        bids: [],
        currentTrickNumber: 0,
        currentTrickCards: [],
        completedTricks: [], // Reset tricks for new round
        teamTricksWonThisRound: { 1: 0, 2: 0 },
        roundScores: { 1: 0, 2: 0 }, // Reset scores for new round
        penaltyApplied: false,
      };

      transaction.update(gameDocRef, {
        status: 'Playing', // Ensure status remains Playing
        currentRoundNumber: nextRoundNumber,
        currentRoundState: nextRoundState,
        updatedAt: serverTimestamp(),
      });
       logger.info('initializeNextRound', 'Next round initialized', { gameId, nextRoundNumber, firstBidderId: nextFirstBidder.userId });
    });
  } catch (error) {
     logger.error('initializeNextRound', 'Transaction failed', { gameId, error });
    if (error instanceof Error) throw error;
    throw new Error('Failed to initialize next round due to a database issue.');
  }
};

/**
 * [DEBUG ONLY] Forces the end of the current round, assigning tricks and calculating scores.
 * @param gameId The ID of the game.
 * @param debugWinningTeamId The TeamId (1 or 2) that should be assigned 7 tricks.
 */
export const forceRoundEndDebug = async (gameId: string, debugWinningTeamId: TeamId): Promise<void> => {
  logger.warn('[DEBUG] forceRoundEndDebug', 'Attempting DEBUG transaction to force round end', { gameId, debugWinningTeamId });
  const gameDocRef = doc(db, 'rangvaarGames', gameId);

  try {
    await runTransaction(db, async (transaction) => {
      const gameDoc = await transaction.get(gameDocRef);
      if (!gameDoc.exists()) throw new Error('Game not found.');
      const gameState = gameDoc.data() as RangvaarGameState;

      // --- Validations --- //
      if (gameState.status !== 'Playing') throw new Error('Game is not in Playing status.');
      if (!gameState.currentRoundState) throw new Error('Current round state is missing.');
      // Allow forcing end even if not naturally at trick 13 for debugging
      // if (gameState.currentRoundState.phase !== 'TrickPlaying') throw new Error('Game not in TrickPlaying phase.');
      
      const roundState = gameState.currentRoundState;
      let updatedGameState: Partial<RangvaarGameState> = {};

      // --- Simulate Trick Counts --- //
      const team1Tricks = debugWinningTeamId === 1 ? 7 : 6;
      const team2Tricks = debugWinningTeamId === 2 ? 7 : 6;
      const updatedTeamTricksWon = { 1: team1Tricks, 2: team2Tricks };

      // --- Calculate Scores --- //
      const team1PlayerId = gameState.teams[1].playerIds[0];
      const isTeam1Bidder = roundState.highestBid?.playerId === team1PlayerId || gameState.teams[1].playerIds.includes(roundState.highestBid?.playerId || '');
      
      const team1ScoreResult = calculateRoundScore(team1Tricks, roundState.highestBid, isTeam1Bidder);
      const team2ScoreResult = calculateRoundScore(team2Tricks, roundState.highestBid, !isTeam1Bidder);

      const finalRoundScores = { 1: team1ScoreResult.score, 2: team2ScoreResult.score };
      const penaltyAppliedThisRound = team1ScoreResult.penaltyApplied || team2ScoreResult.penaltyApplied;
      
      const updatedTeamsData = {
          1: { ...gameState.teams[1], cumulativeScore: gameState.teams[1].cumulativeScore + finalRoundScores[1] },
          2: { ...gameState.teams[2], cumulativeScore: gameState.teams[2].cumulativeScore + finalRoundScores[2] }
      };
      updatedGameState.teams = updatedTeamsData;

      let finalRoundStatePartial: Partial<RoundState> = {};

      // --- Check if Game Ended --- //
      if (roundState.roundNumber >= gameState.totalRounds) { // Use >= for safety
         logger.warn('[DEBUG] forceRoundEndDebug', 'Forcing Game End', { gameId });
         let winnerTeamId: TeamId | undefined = undefined;
         if (updatedTeamsData[1].cumulativeScore > updatedTeamsData[2].cumulativeScore) winnerTeamId = 1;
         else if (updatedTeamsData[2].cumulativeScore > updatedTeamsData[1].cumulativeScore) winnerTeamId = 2;
         
         updatedGameState.status = 'Finished';
         updatedGameState.winnerTeamId = winnerTeamId;
         finalRoundStatePartial = { phase: 'RoundEnded' };
      } else {
         // Game continues, prepare for next round
         logger.warn('[DEBUG] forceRoundEndDebug', 'Forcing Round End, preparing next round setup', { gameId });
         finalRoundStatePartial = { phase: 'RoundEnded' };
      }
      
      // Create the final updated round state based on the partial updates
      const updatedRoundState: RoundState = {
          ...roundState,
          teamTricksWonThisRound: updatedTeamTricksWon,
          roundScores: finalRoundScores,
          penaltyApplied: penaltyAppliedThisRound,
          // Apply phase change and clear turn ID
          phase: finalRoundStatePartial.phase || roundState.phase, // Ensure phase is updated
          // Clear other fields if needed for RoundEnded state before next round init
          hands: {}, 
          currentTrickCards: [],
          currentTrickNumber: TOTAL_TRICKS_PER_ROUND, // Set trick number to max to signify end
      };

      // --- Execute Transaction --- //
      transaction.update(gameDocRef, {
        ...updatedGameState,
        currentRoundState: updatedRoundState,
        updatedAt: serverTimestamp(),
      });
    });
    logger.warn('[DEBUG] forceRoundEndDebug', 'Transaction successful', { gameId });
  } catch (error) {
    logger.error('[DEBUG] forceRoundEndDebug', 'Transaction failed', { gameId, error });
    if (error instanceof Error) throw error;
    throw new Error('[DEBUG] Failed to force round end.');
  }
};

/**
 * [CLIENT-SIDE] Processes the payout for a finished Rangvaar game.
 * Calculates winnings, applies platform fee (if any), and updates user balances.
 * SHOULD ONLY BE CALLED ONCE WHEN GAME STATUS IS 'Finished'.
 * @param gameId The ID of the finished game.
 * @param finalGameState The final game state object.
 */
export const processClientSideRangvaarPayout = async (gameId: string, finalGameState: RangvaarGameState): Promise<void> => {
  logger.info('processClientSideRangvaarPayout', 'Attempting client-side payout', { gameId });

  if (finalGameState.status !== 'Finished') {
    logger.warn('processClientSideRangvaarPayout', 'Game is not in Finished status. Aborting payout.', { gameId, status: finalGameState.status });
    // Throwing an error might be too aggressive if called speculatively, logging might be enough
    // throw new Error('Game is not finished.');
    return;
  }

  if (finalGameState.payoutProcessed) {
    logger.warn('processClientSideRangvaarPayout', 'Payout already processed for this game. Aborting.', { gameId });
    return; // Prevent double payout
  }

  const gameDocRef = doc(db, 'rangvaarGames', gameId);
  const winningTeamId = finalGameState.winnerTeamId;
  const wagerAmount = finalGameState.wagerPerPlayer;
  
  // Handle Draw (No winner - Optional: refund wager? Current logic assumes winner takes pot)
  if (!winningTeamId) {
      logger.warn('processClientSideRangvaarPayout', 'Game ended in a draw (no winnerTeamId). No payout processed.', { gameId });
      // Optionally, update game to mark payoutProcessed even for draw
       try {
          await runTransaction(db, async (transaction) => {
             transaction.update(gameDocRef, {
                  payoutProcessed: true, 
                  payoutTimestamp: serverTimestamp(), 
                  updatedAt: serverTimestamp() 
             });
          });
          logger.info('processClientSideRangvaarPayout', 'Marked draw game as processed.', { gameId });
      } catch (drawError) {
          logger.error('processClientSideRangvaarPayout', 'Failed to mark draw game as processed', { gameId, error: drawError });
      }
      return; 
  }
  
  if (typeof wagerAmount !== 'number' || wagerAmount <= 0) {
      logger.error('processClientSideRangvaarPayout', 'Invalid or missing wager amount. Cannot process payout.', { gameId, wagerAmount });
      throw new Error('Invalid wager amount for payout calculation.');
  }

  const winningTeamPlayerIds = finalGameState.teams[winningTeamId]?.playerIds;
  const losingTeamId = winningTeamId === 1 ? 2 : 1;
  const losingTeamPlayerIds = finalGameState.teams[losingTeamId]?.playerIds;

  if (!winningTeamPlayerIds || winningTeamPlayerIds.length !== 2 || !losingTeamPlayerIds || losingTeamPlayerIds.length !== 2) {
     logger.error('processClientSideRangvaarPayout', 'Could not determine winning/losing player IDs correctly.', { gameId, teams: finalGameState.teams });
     throw new Error('Failed to identify all players for payout.');
  }

  const allPlayerIds = [...winningTeamPlayerIds, ...losingTeamPlayerIds];

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Get all player documents
      const playerDocRefs = allPlayerIds.map(id => doc(db, 'users', id));
      const playerDocs = await Promise.all(playerDocRefs.map(ref => transaction.get(ref)));
      
      // Verify all players exist
      playerDocs.forEach((playerDoc, index) => {
          if (!playerDoc.exists()) {
              throw new Error(`User document for player ID ${allPlayerIds[index]} not found.`);
          }
      });

      // 2. Calculate payout
      const totalPool = wagerAmount * 4;
      const platformFee = 0; // TODO: Implement platform fee if needed for MVP (e.g., Math.floor(totalPool * 0.05)) 
      const totalWinnings = totalPool - platformFee;
      const winningsPerPlayer = totalWinnings / 2; // Split amongst 2 winners

      // 3. Update winning players' balances
      winningTeamPlayerIds.forEach(winnerId => {
          const winnerRef = doc(db, 'users', winnerId);
          transaction.update(winnerRef, { 
              realMoneyBalance: increment(winningsPerPlayer) // Use client-side increment
          });
          // TODO: Log transaction for winner payout (requires admin SDK or separate CF)
          // Since this is client-side, direct transaction logging is harder without admin privileges.
          // Consider adding a simplified game result record instead, or rely on balance changes.
      });
      
      // Note: Losing players' balances are implicitly handled as their wager was already deducted (or should have been - need debit logic)

      // 4. Mark game as processed
      transaction.update(gameDocRef, {
        payoutProcessed: true,
        payoutTimestamp: serverTimestamp(), // Use serverTimestamp() here
        updatedAt: serverTimestamp()
      });
      
      logger.info('processClientSideRangvaarPayout', 'Client-side payout transaction successful', { 
          gameId, 
          winningTeamId, 
          totalPool, 
          platformFee, 
          winningsPerPlayer 
      });
    });
  } catch (error) {
    logger.error('processClientSideRangvaarPayout', 'Client-side payout transaction failed', { gameId, error });
    if (error instanceof Error) throw error; // Re-throw the specific error
    throw new Error('Failed to process game payout due to a database issue.');
  }
};

// Note: Triggering logic for dealRemainingCards and initializeNextRound needs implementation (likely in hook).

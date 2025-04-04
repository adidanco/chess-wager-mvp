import { Card, Rank, Suit, TrickCard, BidInfo } from '../../types/rangvaar';
import { SUITS, RANKS } from '../../constants/rangvaarConstants';

/**
 * Creates a standard 52-card deck.
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  SUITS.forEach(suit => {
    RANKS.forEach(rank => {
      deck.push({
        suit,
        rank,
        id: `${suit.charAt(0)}${rank}` // e.g., H7, DA, S10
      });
    });
  });
  return deck;
}

/**
 * Shuffles a deck of cards using the Fisher-Yates (Knuth) algorithm.
 * Returns a new shuffled array, does not modify the original.
 * @param deck The deck of cards to shuffle.
 * @returns A new array containing the shuffled deck.
 */
export function shuffleDeck(deck: Card[]): Card[] {
  // Create a copy to avoid modifying the original deck
  const shuffledDeck = [...deck];
  for (let i = shuffledDeck.length - 1; i > 0; i--) {
    // Pick a random index from 0 to i (inclusive)
    const j = Math.floor(Math.random() * (i + 1));
    // Swap elements shuffledDeck[i] and shuffledDeck[j]
    [shuffledDeck[i], shuffledDeck[j]] = [shuffledDeck[j], shuffledDeck[i]];
  }
  return shuffledDeck;
}

// --- Placeholder for other utility functions --- //

/**
 * Gets the numerical value of a card rank for comparison.
 * Ace is high.
 */
export function getCardRankValue(rank: Rank): number {
  if (rank >= '2' && rank <= '9') return parseInt(rank, 10);
  if (rank === '10') return 10;
  if (rank === 'J') return 11;
  if (rank === 'Q') return 12;
  if (rank === 'K') return 13;
  if (rank === 'A') return 14;
  return 0; // Should not happen
}

/**
 * Determines the winning player ID for a completed trick.
 * @param trickCards Array of cards played in the trick, in order.
 * @param trumpSuit The trump suit for the current round.
 * @returns The userId of the player who won the trick.
 * @throws Error if trickCards is empty or invalid.
 */
export function determineWinnerOfTrick(
  trickCards: TrickCard[], 
  trumpSuit: Suit | undefined, // Trump might not be set if logic is called incorrectly
): string {
  if (!trickCards || trickCards.length === 0) {
    throw new Error("Cannot determine winner of an empty trick.");
  }

  const leadCard = trickCards[0].card;
  const leadSuit = leadCard.suit;
  let winningCard = leadCard;
  let winningPlayerId = trickCards[0].playerId;
  let winningValue = getCardRankValue(winningCard.rank);
  let highestTrumpValue = -1;

  // Check if the lead card is trump (if trump exists)
  if (trumpSuit && winningCard.suit === trumpSuit) {
    highestTrumpValue = winningValue;
  }

  // Iterate through the rest of the cards played
  for (let i = 1; i < trickCards.length; i++) {
    const currentCardInfo = trickCards[i];
    const currentCard = currentCardInfo.card;
    const currentValue = getCardRankValue(currentCard.rank);

    // Case 1: A trump card was played
    if (trumpSuit && currentCard.suit === trumpSuit) {
      if (currentValue > highestTrumpValue) {
        // This is the highest trump played so far
        highestTrumpValue = currentValue;
        winningCard = currentCard;
        winningPlayerId = currentCardInfo.playerId;
        winningValue = currentValue; // Update winning value for comparison against other trumps
      }
    }
    // Case 2: No trump played yet OR current card is not trump
    else if (highestTrumpValue === -1) {
      // Case 2a: Card follows the lead suit and is higher rank
      if (currentCard.suit === leadSuit && currentValue > winningValue) {
        winningCard = currentCard;
        winningPlayerId = currentCardInfo.playerId;
        winningValue = currentValue;
      }
      // Case 2b: Card does not follow lead suit and is not trump - cannot win
    }
    // Case 3: A trump has already won, and this card is not a higher trump - cannot win
  }

  return winningPlayerId;
}

/**
 * Calculates the score for a team for a completed round, applying penalties if necessary.
 * @param teamTricksWon Number of tricks won by the team.
 * @param bidInfo The highest bid made (by this team or the opponent).
 * @param didTeamMakeHighestBid True if this team made the highest bid.
 * @returns The calculated score for the round.
 */
export function calculateRoundScore(
  teamTricksWon: number,
  bidInfo: BidInfo | undefined,
  didTeamMakeHighestBid: boolean
): {
  score: number;
  penaltyApplied: boolean;
} {
  let score = teamTricksWon;
  let penaltyApplied = false;

  if (didTeamMakeHighestBid && bidInfo) {
    const bidAmount = bidInfo.bidAmount;
    if (teamTricksWon < bidAmount) {
      // Apply penalty: Score = 2 * TricksWon - BidAmount
      // This effectively subtracts the shortfall (Bid - Tricks) from the tricks won.
      score = (2 * teamTricksWon) - bidAmount;
      // Ensure score doesn't go below a certain threshold if desired (e.g., 0 or negative)
      // score = Math.max(score, -bidAmount); // Example: Limit penalty
      penaltyApplied = true;
    }
    // If teamTricksWon >= bidAmount, score remains teamTricksWon (no bonus, as per rules)
  }
  // If the team did *not* make the highest bid, their score is simply the tricks they won.

  return { score, penaltyApplied };
}
import { Card, CardPowerType } from '../types/scambodia';

/**
 * Determines the special power type based on a card's rank.
 * @param card The card object.
 * @returns The CardPowerType or null if it's not a special power card.
 */
export const determinePowerType = (card: Card | null): CardPowerType | null => {
  if (!card) return null;
  
  switch (card.rank) {
    case '7':
    case '8':
      return 'Peek_Own';
    case '9':
    case '10':
      return 'Peek_Opponent';
    case 'J': // Adjusted based on previous rules discussions
    case 'Q':
      return 'Blind_Swap';
    case 'K':
      return 'Seen_Swap';
    default:
      return null; // Not a special power card (or invalid card)
  }
}; 
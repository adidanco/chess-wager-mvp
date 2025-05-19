// Sample unit test for Scambodia core logic
import { dealCards } from '../utils/scambodiaUtils';
import { Card } from '../types/scambodia';

describe('Scambodia Game Logic', () => {
  it('should deal 4 cards to each player', () => {
    const deck: Card[] = [
      { id: 'h2', suit: 'Hearts', rank: '2', value: 2 },
      { id: 'h3', suit: 'Hearts', rank: '3', value: 3 },
      { id: 'h4', suit: 'Hearts', rank: '4', value: 4 },
      { id: 'h5', suit: 'Hearts', rank: '5', value: 5 },
      { id: 's2', suit: 'Spades', rank: '2', value: 2 },
      { id: 's3', suit: 'Spades', rank: '3', value: 3 },
      { id: 's4', suit: 'Spades', rank: '4', value: 4 },
      { id: 's5', suit: 'Spades', rank: '5', value: 5 },
    ];
    const players = ['A', 'B'];
    const hands = dealCards(deck, players, 4);
    expect(hands['A'].length).toBe(4);
    expect(hands['B'].length).toBe(4);
  });
}); 
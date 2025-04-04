import React from 'react';
import { Suit } from '../../types/rangvaar';
import { SUITS } from '../../constants/rangvaarConstants';

interface TrumpSelectionProps {
  selectTrump: (suit: Suit) => Promise<void>;
  isSubmitting: boolean; // To disable during action
}

// Helper to get suit symbol and color (similar to CardDisplay)
const getSuitDisplay = (suit: Suit): { symbol: string; colorClass: string } => {
  switch (suit) {
    case 'Hearts': return { symbol: '♥', colorClass: 'text-red-600' };
    case 'Diamonds': return { symbol: '♦', colorClass: 'text-red-600' };
    case 'Clubs': return { symbol: '♣', colorClass: 'text-black' };
    case 'Spades': return { symbol: '♠', colorClass: 'text-black' };
    default: return { symbol: '?', colorClass: 'text-gray-500' };
  }
};

const TrumpSelection: React.FC<TrumpSelectionProps> = ({ selectTrump, isSubmitting }) => {
  
  const handleSelect = (suit: Suit) => {
    if (!isSubmitting) {
      selectTrump(suit);
    }
  };

  return (
    <div className="p-3 bg-gray-50 rounded-lg shadow">
      <p className="text-sm font-medium text-center mb-3">Select Trump Suit</p>
      <div className="flex items-center justify-center gap-3">
        {SUITS.map(suit => {
          const { symbol, colorClass } = getSuitDisplay(suit);
          return (
            <button
              key={suit}
              onClick={() => handleSelect(suit)}
              disabled={isSubmitting}
              className={`border border-gray-300 rounded-md p-3 w-16 h-16 flex flex-col items-center justify-center 
                         hover:border-emerald-500 hover:shadow focus:outline-none focus:ring-2 focus:ring-emerald-400 
                         disabled:opacity-50 disabled:cursor-not-allowed ${colorClass}`}
              aria-label={`Select ${suit} as trump`}
            >
              <span className="text-3xl">{symbol}</span>
              <span className="text-xs mt-1">{suit}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TrumpSelection; 
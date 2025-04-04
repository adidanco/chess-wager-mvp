import React from 'react';
import { Card, Suit } from '../../types/rangvaar';

interface CardDisplayProps {
  card: Card;
  onClick?: (cardId: string) => void;
  isPlayable?: boolean; // Can this card be legally played now?
  isSelected?: boolean; // Is this card currently selected by the user?
  isDisabled?: boolean; // General disabled state (e.g., not player's turn)
  size?: 'small' | 'medium' | 'large'; // Optional size prop
}

// Helper to get suit color (Tailwind classes)
const getSuitColor = (suit: Suit): string => {
  return (suit === 'Hearts' || suit === 'Diamonds') ? 'text-red-600' : 'text-black';
};

// Helper to get suit symbol
const getSuitSymbol = (suit: Suit): string => {
  switch (suit) {
    case 'Hearts': return '♥';
    case 'Diamonds': return '♦';
    case 'Clubs': return '♣';
    case 'Spades': return '♠';
    default: return '?';
  }
};

const CardDisplay: React.FC<CardDisplayProps> = ({ 
  card, 
  onClick, 
  isPlayable = true, // Default to playable if not specified
  isSelected = false,
  isDisabled = false,
  size = 'medium' // Default size
}) => {
  
  const handleClick = () => {
    if (onClick && !isDisabled && isPlayable) {
      onClick(card.id);
    }
  };

  const suitColor = getSuitColor(card.suit);
  const suitSymbol = getSuitSymbol(card.suit);

  // Size variants using Tailwind classes
  let sizeClasses = '';
  let textSizeClasses = '';
  switch (size) {
    case 'small':
      sizeClasses = 'w-10 h-14 rounded text-xs p-1';
      textSizeClasses = 'text-sm';
      break;
    case 'large':
      sizeClasses = 'w-20 h-28 rounded-lg p-2 text-lg';
      textSizeClasses = 'text-2xl';
      break;
    case 'medium':
    default:
      sizeClasses = 'w-16 h-24 rounded-md p-1.5 text-base'; 
      textSizeClasses = 'text-xl';
      break;
  }

  return (
    <div
      onClick={handleClick}
      className={`bg-white border border-gray-300 shadow-md flex flex-col justify-between items-center relative ${sizeClasses}
                 ${onClick && !isDisabled && isPlayable ? 'cursor-pointer hover:border-emerald-500 hover:shadow-lg' : ''}
                 ${isDisabled ? 'opacity-70 cursor-not-allowed' : ''}
                 ${!isPlayable && !isDisabled ? 'opacity-50 cursor-not-allowed' : ''} // Dim if not playable
                 ${isSelected ? 'ring-2 ring-emerald-500 ring-offset-1' : ''}`}
    >
      {/* Top-left info */}
      <div className={`font-bold ${textSizeClasses} ${suitColor}`}>
        {card.rank}
        <span className="ml-1">{suitSymbol}</span>
      </div>
      {/* Center symbol (optional, can be larger) */}
      {/* <div className={`text-4xl ${suitColor}`}>{suitSymbol}</div> */}
      {/* Bottom-right info (rotated) */}
      <div className={`font-bold ${textSizeClasses} ${suitColor} self-end transform rotate-180`}>
        {card.rank}
        <span className="ml-1">{suitSymbol}</span>
      </div>

      {/* Optional overlay if not playable */}
      {/*!isPlayable && !isDisabled && (
        <div className="absolute inset-0 bg-black bg-opacity-20 rounded-md"></div>
      )*/}
    </div>
  );
};

export default CardDisplay; 
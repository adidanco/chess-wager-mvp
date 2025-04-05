import React from 'react';
import { Card } from '../../types/scambodia';

interface CardComponentProps {
  card?: Card | null; // Card data (null means discarded/removed)
  faceUp: boolean; // Whether card is face up or face down
  position: 0 | 1 | 2 | 3; // Position in 2x2 grid (0=top-left, 1=top-right, 2=bottom-left, 3=bottom-right)
  isPeeking: boolean; // Whether user is currently peeking at this card
  isSelected: boolean; // Whether card is selected for an action
  onClick?: () => void; // Click handler for the card
  disabled?: boolean; // Whether card is disabled/not selectable
}

/**
 * Component to render a single card in the Scambodia game.
 * Cards can be face-up or face-down, and can have various states (peeking, selected, disabled)
 */
const CardComponent: React.FC<CardComponentProps> = ({
  card,
  faceUp,
  position,
  isPeeking,
  isSelected,
  onClick,
  disabled = false
}) => {
  // Determine card label and styling
  const getSuitSymbol = (suit: string) => {
    switch (suit) {
      case 'Hearts': return '♥';
      case 'Diamonds': return '♦';
      case 'Clubs': return '♣';
      case 'Spades': return '♠';
      default: return '';
    }
  };

  const isRedSuit = card?.suit === 'Hearts' || card?.suit === 'Diamonds';
  
  // Determine the position-based class
  const getPositionClass = () => {
    switch (position) {
      case 0: return 'rounded-tl-lg';
      case 1: return 'rounded-tr-lg';
      case 2: return 'rounded-bl-lg';
      case 3: return 'rounded-br-lg';
      default: return '';
    }
  };

  // If card is null (discarded), show an empty space
  if (card === null) {
    return (
      <div 
        className={`w-20 h-28 bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center ${getPositionClass()}`}
      >
        <p className="text-xs text-gray-400">Discarded</p>
      </div>
    );
  }

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`
        w-20 h-28 perspective-500 cursor-pointer transition-transform duration-200
        ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105'}
        ${isSelected ? 'ring-2 ring-offset-2 ring-deep-purple' : ''}
        ${getPositionClass()}
      `}
    >
      <div className={`relative w-full h-full transition-all duration-500 transform-style-3d ${isPeeking || faceUp ? 'rotate-y-180' : ''}`}>
        {/* Card Back */}
        <div className="absolute w-full h-full backface-hidden bg-gradient-to-br from-deep-purple to-soft-pink rounded-lg shadow-md">
          <div className="absolute inset-1 bg-white rounded-lg flex items-center justify-center">
            <div className="w-12 h-16 bg-soft-lavender rounded-md flex items-center justify-center">
              <span className="text-deep-purple font-bold text-xl">S</span>
            </div>
          </div>
        </div>

        {/* Card Front */}
        <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-white rounded-lg shadow-md border border-gray-200">
          {card ? (
            <div className="w-full h-full p-1 flex flex-col">
              {/* Card Value/Suit in Top Left */}
              <div className={`text-left line-height-tight ${isRedSuit ? 'text-red-600' : 'text-gray-900'}`}>
                <div className="text-md font-bold leading-none">{card.rank}</div>
                <div className="text-lg leading-none">{getSuitSymbol(card.suit)}</div>
              </div>

              {/* Card Center */}
              <div className="flex-grow flex items-center justify-center">
                <span className={`text-3xl ${isRedSuit ? 'text-red-600' : 'text-gray-900'}`}>
                  {getSuitSymbol(card.suit)}
                </span>
              </div>

              {/* Card Value/Suit in Bottom Right (inverted) */}
              <div className={`text-right line-height-tight rotate-180 ${isRedSuit ? 'text-red-600' : 'text-gray-900'}`}>
                <div className="text-md font-bold leading-none">{card.rank}</div>
                <div className="text-lg leading-none">{getSuitSymbol(card.suit)}</div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-gray-400">No Card</p>
            </div>
          )}
        </div>
      </div>

      {/* Peeking Indicator */}
      {isPeeking && (
        <div className="absolute top-[-8px] right-[-8px] bg-deep-purple text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
          👁️
        </div>
      )}
    </div>
  );
};

export default CardComponent; 
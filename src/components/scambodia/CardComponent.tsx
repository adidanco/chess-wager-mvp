import React from 'react';
import { Card, Suit, Rank, CardPosition } from '../../types/scambodia';

interface CardComponentProps {
  card: Card | null;
  faceUp: boolean;
  position: CardPosition;
  onClick?: (position: CardPosition) => void;
  isSelected?: boolean;
  isPeeking?: boolean; // For initial peek styling/logic
  disabled?: boolean;
  isHighlighted?: boolean; // For targeting indication
  // Add props for power peeking
  isPowerPeeking?: boolean; // Is this card being peeked via power?
  powerPeekCardData?: Card | null; // The actual card data if being power-peeked by current user
}

/**
 * Component to render a single card in the Scambodia game.
 * Cards can be face-up or face-down, and can have various states (peeking, selected, disabled)
 */
const CardComponent: React.FC<CardComponentProps> = ({
  card,
  faceUp,
  position,
  onClick,
  isSelected = false,
  isPeeking = false,
  disabled = false,
  isHighlighted = false,
  // Destructure new props
  isPowerPeeking = false,
  powerPeekCardData = null,
}) => {
  const handleClick = () => {
    if (onClick && !disabled) {
      onClick(position);
    }
  };

  // Determine final card data and face-up status based on power peek
  const displayCard = isPowerPeeking && powerPeekCardData ? powerPeekCardData : card;
  const showFaceUp = isPowerPeeking && powerPeekCardData ? true : faceUp;

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

  const isRedSuit = displayCard?.suit === 'Hearts' || displayCard?.suit === 'Diamonds';
  
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
  if (displayCard === null) {
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
      onClick={handleClick}
      className={`
        w-20 h-28 card-container cursor-pointer transition-transform duration-200
        ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105'}
        ${isSelected ? 'ring-2 ring-offset-2 ring-deep-purple' : ''}
        ${getPositionClass()}
        ${showFaceUp ? 'card-flipped' : ''}
      `}
    >
      <div className="card-inner">
        {/* Card Back */}
        <div className="card-back">
          <div className="w-12 h-16 bg-soft-lavender rounded-md flex items-center justify-center">
            <span className="text-deep-purple font-bold text-xl">S</span>
          </div>
        </div>

        {/* Card Front */}
        <div className="card-front">
          {displayCard && showFaceUp ? (
            <div className="w-full h-full p-1 flex flex-col">
              {/* Card Value/Suit in Top Left */}
              <div className={`text-left line-height-tight ${isRedSuit ? 'text-red-600' : 'text-gray-900'}`}>
                <div className="text-md font-bold leading-none">{displayCard.rank}</div>
                <div className="text-lg leading-none">{getSuitSymbol(displayCard.suit)}</div>
              </div>

              {/* Card Center */}
              <div className="flex-grow flex items-center justify-center">
                <span className={`text-3xl ${isRedSuit ? 'text-red-600' : 'text-gray-900'}`}>
                  {getSuitSymbol(displayCard.suit)}
                </span>
              </div>

              {/* Card Value/Suit in Bottom Right (inverted) */}
              <div className={`text-right line-height-tight rotate-180 ${isRedSuit ? 'text-red-600' : 'text-gray-900'}`}>
                <div className="text-md font-bold leading-none">{displayCard.rank}</div>
                <div className="text-lg leading-none">{getSuitSymbol(displayCard.suit)}</div>
              </div>
            </div>
          ) : displayCard ? (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-gray-400">No Card</p>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-gray-400">Empty</p>
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
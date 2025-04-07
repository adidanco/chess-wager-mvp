import React from 'react';
import CardComponent from './CardComponent';
import { Card, CardPosition } from '../../types/scambodia';

interface PlayerHandProps {
  cards: (Card | null)[];  // Array of 4 cards in hand, null means discarded
  visibleCardPositions: CardPosition[];  // Positions of cards that are visible to the player
  selectedCardPosition?: CardPosition | null;  // Currently selected card position
  isMyTurn: boolean;  // Whether it's this player's turn
  onCardClick?: (position: CardPosition) => void;  // Card click handler
  canSelectCard: boolean;  // Whether player can select cards currently
  currentPhase: string;  // Current game phase
  isTargeting?: boolean;  // Is player targeting their own hand for a power?
}

/**
 * Component to render a player's hand of cards in a 2x2 grid.
 * Handles visibility rules based on game state.
 */
const PlayerHand: React.FC<PlayerHandProps> = ({
  cards,
  visibleCardPositions,
  selectedCardPosition,
  isMyTurn,
  onCardClick,
  canSelectCard,
  currentPhase,
  isTargeting
}) => {
  const handleCardClick = (position: CardPosition) => {
    if (isMyTurn && canSelectCard && onCardClick) {
      onCardClick(position);
    }
  };

  // Check if a card should be face up
  const isCardFaceUp = (position: CardPosition) => {
    return visibleCardPositions.includes(position);
  };

  return (
    <div className="relative">
      <div className="mb-3 text-center">
        <h3 className="text-deep-purple font-semibold text-lg">Your Hand</h3>
        <p className="text-xs text-gray-600">
          {currentPhase === 'Setup' && 'Starting the game - you can see your bottom two cards'}
          {currentPhase === 'Playing' && isMyTurn && 'Your turn - select a card to act on it'}
          {currentPhase === 'Playing' && !isMyTurn && 'Waiting for other player to take their turn'}
          {currentPhase === 'FinalTurn' && 'Final round after Scambodia was declared'}
          {currentPhase === 'Scoring' && 'Round ended - calculating scores'}
          {currentPhase === 'Complete' && 'Round complete'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
        {/* Top row (positions 0 and 1) */}
        <div>
          <CardComponent
            card={cards[0]}
            faceUp={isCardFaceUp(0)}
            position={0}
            isPeeking={false}
            isSelected={selectedCardPosition === 0}
            onClick={() => handleCardClick(0)}
            disabled={!canSelectCard || cards[0] === null}
          />
        </div>
        
        <div>
          <CardComponent
            card={cards[1]} 
            faceUp={isCardFaceUp(1)}
            position={1}
            isPeeking={false}
            isSelected={selectedCardPosition === 1}
            onClick={() => handleCardClick(1)}
            disabled={!canSelectCard || cards[1] === null}
          />
        </div>
        
        {/* Bottom row (positions 2 and 3) */}
        <div>
          <CardComponent
            card={cards[2]}
            faceUp={isCardFaceUp(2)}
            position={2}
            isPeeking={false}
            isSelected={selectedCardPosition === 2}
            onClick={() => handleCardClick(2)}
            disabled={!canSelectCard || cards[2] === null}
          />
        </div>
        
        <div>
          <CardComponent
            card={cards[3]}
            faceUp={isCardFaceUp(3)}
            position={3}
            isPeeking={false}
            isSelected={selectedCardPosition === 3}
            onClick={() => handleCardClick(3)}
            disabled={!canSelectCard || cards[3] === null}
          />
        </div>
      </div>

      {/* Turn indicator */}
      {isMyTurn && (
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full mb-2">
          <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-t-lg animate-pulse">
            Your Turn
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerHand; 
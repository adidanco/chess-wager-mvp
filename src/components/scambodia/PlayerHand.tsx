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
  isTargeting: boolean;
  peekedCardInfo: { 
    card: Card, 
    targetPosition: CardPosition, 
    targetPlayerId: string, 
    peekerId: string 
  } | null;
  isPeekingActive: boolean;
  currentUserId: string;
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
  isTargeting,
  peekedCardInfo,
  isPeekingActive,
  currentUserId
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
      {/* Turn indicator - positioned above the content with more spacing */}
      {isMyTurn && (
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full mb-6">
          <div className="bg-green-500 text-white px-4 py-1 rounded-lg font-medium animate-pulse">
            Your Turn
          </div>
        </div>
      )}

      {/* Add more top padding when it's the player's turn to create space after the Your Turn indicator */}
      <div className={`text-center ${isMyTurn ? 'mt-6' : 'mt-2'}`}>
        {/* Always show "Your Hand" heading, but with different styling based on turn */}
        <h3 className={`font-semibold text-lg mb-1 ${isMyTurn ? 'text-deep-purple' : 'text-gray-700'}`}>
          Your Hand
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
        {[0, 1, 2, 3].map((index) => {
          const position = index as CardPosition;
          const card = cards[position];
          const isVisible = visibleCardPositions.includes(position);
          const isSelected = selectedCardPosition === position;
          const isDisabled = !canSelectCard || card === null;

          // Check if this specific card is the target of the currently active peek
          const isTargetOfActivePeek = 
            isPeekingActive && 
            peekedCardInfo?.targetPlayerId === currentUserId && // Target is self
            peekedCardInfo?.targetPosition === position;

          // Check if the current user is the one who initiated the peek
          const showDataForActivePeek = 
            isTargetOfActivePeek && 
            currentUserId === peekedCardInfo?.peekerId;

          return (
            <div key={position}>
              <CardComponent
                card={card}
                faceUp={isVisible} // Base visibility
                position={position}
                onClick={() => handleCardClick(position)}
                isSelected={isSelected}
                disabled={isDisabled}
                isHighlighted={isTargeting} // Highlight all if targeting own hand
                isPowerPeeking={isTargetOfActivePeek} // Is THIS card being peeked?
                powerPeekCardData={showDataForActivePeek ? peekedCardInfo.card : null} // Pass data only if current user initiated peek
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlayerHand; 
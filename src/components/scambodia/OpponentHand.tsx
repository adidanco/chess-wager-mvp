import React from 'react';
import { Card, CardPosition, PlayerInfo } from '../../types/scambodia';
import CardComponent from './CardComponent';

interface OpponentHandProps {
  player: PlayerInfo;
  cards: (Card | null)[];
  onCardClick: (position: CardPosition, playerId: string) => void;
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

const OpponentHand: React.FC<OpponentHandProps> = ({
  player,
  cards,
  onCardClick,
  isTargeting,
  peekedCardInfo,
  isPeekingActive,
  currentUserId,
}) => {
  return (
    <div className={`bg-white p-4 rounded-lg shadow-sm border-2 transition-all duration-300
      ${isTargeting ? 'border-soft-pink shadow-soft-pink/50 animate-pulse' : 'border-transparent'}`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium">
          {player.username}
        </h3>
        <span className="text-xs text-gray-500">
          {cards.filter(card => card !== null).length} cards
        </span>
      </div>
      {isTargeting && (
        <p className="text-center text-xs text-soft-pink font-medium mb-2">
          Select a card to target
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
        {cards.map((card, index) => {
          const position = index as CardPosition;
          const isDisabled = !isTargeting;
          
          const isTargetOfActivePeek = 
            isPeekingActive && 
            peekedCardInfo?.targetPlayerId === player.userId &&
            peekedCardInfo?.targetPosition === position;
            
          const showDataForActivePeek = 
            isTargetOfActivePeek &&
            currentUserId === peekedCardInfo?.peekerId;

          return (
            <div 
              key={position} 
              className={`flex justify-center ${isDisabled ? 'cursor-default' : 'cursor-pointer'}`}
              onClick={() => !isDisabled && onCardClick(position, player.userId)}
            >
              <CardComponent
                card={card}
                faceUp={false}
                position={position}
                onClick={isTargeting ? () => onCardClick(position, player.userId) : undefined}
                disabled={isDisabled}
                isHighlighted={isTargeting}
                isPowerPeeking={isTargetOfActivePeek}
                powerPeekCardData={showDataForActivePeek ? peekedCardInfo.card : null}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OpponentHand; 
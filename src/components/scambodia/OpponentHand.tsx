import React from 'react';
import { Card, CardPosition, PlayerInfo } from '../../types/scambodia';

interface OpponentHandProps {
  player: PlayerInfo;
  cards: (Card | null)[];
  onCardClick: (position: CardPosition, playerId: string) => void;
  isTargeting: boolean;
}

const OpponentHand: React.FC<OpponentHandProps> = ({
  player,
  cards,
  onCardClick,
  isTargeting,
}) => {
  return (
    <div className={`bg-white p-4 rounded-lg shadow-sm border-2 ${isTargeting ? 'border-soft-pink' : 'border-transparent'}`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium">
          {player.username}
        </h3>
        <span className="text-xs text-gray-500">
          {cards.filter(card => card !== null).length} cards
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
        {Array.from({ length: 4 }).map((_, index) => {
          const hasCard = index < cards.length && cards[index] !== null;
          const position = index as CardPosition;
          const isDisabled = !isTargeting;
          return (
            <div 
              key={index} 
              className={`flex justify-center cursor-${isDisabled ? 'default' : 'pointer'}`}
              onClick={() => !isDisabled && onCardClick(position, player.userId)}
            >
              {hasCard ? (
                <div className={`w-14 h-20 bg-gradient-to-br from-deep-purple to-soft-pink rounded-md shadow-sm relative ${isTargeting ? 'hover:ring-2 hover:ring-soft-pink' : ''}`}>
                  <div className="absolute inset-1 bg-white rounded-sm flex items-center justify-center">
                    <div className="w-8 h-12 bg-soft-lavender rounded-sm flex items-center justify-center">
                      <span className="text-deep-purple font-bold text-sm">{index + 1}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-14 h-20 bg-gray-100 border border-dashed border-gray-300 rounded-md flex items-center justify-center">
                  <p className="text-xs text-gray-400">Empty</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OpponentHand; 
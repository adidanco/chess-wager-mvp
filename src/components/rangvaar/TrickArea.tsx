import React from 'react';
import { TrickCard, PlayerPosition, PlayerInfo } from '../../types/rangvaar';
import CardDisplay from './CardDisplay';

interface TrickAreaProps {
  trickCards: TrickCard[];
  players: PlayerInfo[]; // Needed to map card to position
}

// Helper to get position for a player ID
const getPositionForPlayer = (playerId: string, players: PlayerInfo[]): PlayerPosition | undefined => {
  return players.find(p => p.userId === playerId)?.position;
};

const TrickArea: React.FC<TrickAreaProps> = ({ trickCards, players }) => {
  // Determine the order/positioning based on PlayerPosition
  const cardPositions: { [key in PlayerPosition]?: TrickCard } = {};
  trickCards.forEach(tc => {
    const position = getPositionForPlayer(tc.playerId, players);
    if (position) {
      cardPositions[position] = tc;
    }
  });

  return (
    <div className="relative w-48 h-32 flex items-center justify-center"> 
      {/* Render cards based on their player's position */} 
      {/* Adjust absolute positioning based on your desired layout (North at top, South at bottom, etc.) */} 
      
      {/* South (Bottom) - Current Player's card often shown here? */}
      {cardPositions.South && (
        <div className="absolute bottom-[-20px] left-1/2 transform -translate-x-1/2 z-10">
          <CardDisplay card={cardPositions.South.card} size="small" />
        </div>
      )}
      
      {/* West (Left) */}
      {cardPositions.West && (
        <div className="absolute left-[-20px] top-1/2 transform -translate-y-1/2 z-10">
          <CardDisplay card={cardPositions.West.card} size="small" />
        </div>
      )}

      {/* North (Top) */}
      {cardPositions.North && (
        <div className="absolute top-[-20px] left-1/2 transform -translate-x-1/2 z-10">
          <CardDisplay card={cardPositions.North.card} size="small" />
        </div>
      )}

      {/* East (Right) */}
      {cardPositions.East && (
        <div className="absolute right-[-20px] top-1/2 transform -translate-y-1/2 z-10">
          <CardDisplay card={cardPositions.East.card} size="small" />
        </div>
      )}

      {trickCards.length === 0 && (
         <p className="text-gray-300 text-xs italic">Trick area is empty</p>
      )}
    </div>
  );
};

export default TrickArea; 
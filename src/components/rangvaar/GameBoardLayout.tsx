import React from 'react';
import { RangvaarGameState, PlayerPosition, PlayerInfo } from '../../types/rangvaar';
import TrickArea from './TrickArea';

interface GameBoardLayoutProps {
  gameState: RangvaarGameState;
  currentUserId: string | undefined; // ID of the user viewing the board
}

// Helper component for displaying opponent info
const OpponentDisplay: React.FC<{ player: PlayerInfo, cardCount: number, isMyTurn: boolean, position: 'top' | 'left' | 'right' }> = 
  ({ player, cardCount, isMyTurn, position }) => {
    let positionClasses = '';
    switch (position) {
        case 'top': positionClasses = 'absolute top-4 left-1/2 transform -translate-x-1/2'; break;
        case 'left': positionClasses = 'absolute left-4 top-1/2 transform -translate-y-1/2'; break;
        case 'right': positionClasses = 'absolute right-4 top-1/2 transform -translate-y-1/2'; break;
    }

    return (
      <div className={`p-2 bg-emerald-900/80 rounded shadow-lg text-white text-xs ${positionClasses} flex flex-col items-center min-w-[100px]`}>
        <img 
          src={player.photoURL || '/default-avatar.png'}
          alt={player.username}
          className="w-8 h-8 rounded-full mb-1 border-2 border-emerald-600 object-cover"
        />
        <p className="font-semibold truncate max-w-[80px]">{player.username}</p>
        <p>Cards: {cardCount}</p>
        {isMyTurn && <p className="mt-1 text-emerald-300 font-bold animate-pulse">Playing...</p>}
      </div>
    );
};

const GameBoardLayout: React.FC<GameBoardLayoutProps> = ({ gameState, currentUserId }) => {
  const roundState = gameState.currentRoundState;
  const players = gameState.players;
  const currentTrickCards = roundState?.currentTrickCards || [];

  // Find the current user's position
  const currentUserInfo = players.find(p => p.userId === currentUserId);
  const currentUserPosition = currentUserInfo?.position; // e.g., 'South'

  // Determine relative positions (North, East, West relative to current user)
  const getRelativePosition = (playerPosition: PlayerPosition): 'top' | 'left' | 'right' | 'bottom' => {
      if (playerPosition === currentUserPosition) return 'bottom';

      const positions: PlayerPosition[] = ['North', 'East', 'South', 'West'];
      const currentUserIndex = positions.indexOf(currentUserPosition || 'South');
      const playerIndex = positions.indexOf(playerPosition);

      const diff = (playerIndex - currentUserIndex + 4) % 4;
      if (diff === 1) return 'right'; // Player to the right
      if (diff === 2) return 'top';   // Player opposite (North)
      if (diff === 3) return 'left';  // Player to the left
      
      return 'bottom'; // Should not happen for opponents
  };

  return (
    <div className="w-full h-full relative flex items-center justify-center">
      {/* Display Opponents */}
      {players.filter(p => p.userId !== currentUserId).map(opponent => {
          const relativePos = getRelativePosition(opponent.position);
          if (relativePos === 'bottom') return null; // Skip self
          
          const isOpponentTurn = roundState?.currentTurnPlayerId === opponent.userId;
          const cardCount = roundState?.hands[opponent.userId]?.length ?? 'N/A';

          return (
             <OpponentDisplay 
               key={opponent.userId}
               player={opponent}
               cardCount={typeof cardCount === 'number' ? cardCount : 0}
               isMyTurn={isOpponentTurn}
               position={relativePos}
             />
          );
      })}
      
      {/* Display Trick Area in the Center */}
      <div className="z-20">
          <TrickArea trickCards={currentTrickCards} players={players} />
      </div>
      
      {/* Potentially add scoreboard or other elements absolutely positioned */}
    </div>
  );
};

export default GameBoardLayout; 
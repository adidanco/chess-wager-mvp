import React from 'react';
import { RangvaarGameState, RoundState, PlayerInfo } from '../../types/rangvaar';

interface GameStatusDisplayProps {
  gameState: RangvaarGameState;
}

const GameStatusDisplay: React.FC<GameStatusDisplayProps> = ({ gameState }) => {
  const roundState = gameState.currentRoundState;
  const players = gameState.players;
  
  const getPlayerUsername = (playerId: string | undefined): string => {
    if (!playerId) return 'N/A';
    return players.find(p => p.userId === playerId)?.username || 'Unknown';
  };

  return (
    <div className="text-xs space-y-1">
      {/* Round Info */}
      <div>
        <span className="font-semibold">Round:</span> {gameState.currentRoundNumber} / {gameState.totalRounds}
        <span className="mx-2">|</span>
        <span className="font-semibold">Phase:</span> {roundState?.phase || 'N/A'}
        {roundState?.phase !== 'Bidding' && roundState?.trumpSuit && (
          <>
            <span className="mx-2">|</span>
            <span className="font-semibold">Trump:</span> {roundState.trumpSuit}
          </>
        )}
      </div>

      {/* Bidding Info */}
      {roundState?.highestBid && (
        <div>
           <span className="font-semibold">Highest Bid:</span> {roundState.highestBid.bidAmount} by {getPlayerUsername(roundState.highestBid.playerId)}
        </div>
      )}

      {/* Turn Info */}
      {roundState?.currentTurnPlayerId && gameState.status === 'Playing' && (
        <div>
          <span className="font-semibold">Turn:</span> {getPlayerUsername(roundState.currentTurnPlayerId)}
        </div>
      )}

      {/* Score Info */}
      <div className="pt-1 border-t border-gray-200 mt-1">
        <span className="font-semibold">Scores:</span> 
        Team 1 ({getPlayerUsername(gameState.teams[1].playerIds[0])} / {getPlayerUsername(gameState.teams[1].playerIds[1])}): {gameState.teams[1].cumulativeScore} 
        <span className="mx-2">|</span>
        Team 2 ({getPlayerUsername(gameState.teams[2].playerIds[0])} / {getPlayerUsername(gameState.teams[2].playerIds[1])}): {gameState.teams[2].cumulativeScore}
      </div>
       {/* Current Round Tricks Won */} 
       {roundState && roundState.phase !== 'Bidding' && (
           <div className="text-gray-600">
               <span className="font-semibold">Tricks This Round:</span> 
               Team 1: {roundState.teamTricksWonThisRound[1]} | 
               Team 2: {roundState.teamTricksWonThisRound[2]}
           </div>
       )}
    </div>
  );
};

export default GameStatusDisplay; 
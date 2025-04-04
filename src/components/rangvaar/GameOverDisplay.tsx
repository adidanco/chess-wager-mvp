import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RangvaarGameState, TeamId } from '../../types/rangvaar';

interface GameOverDisplayProps {
  gameState: RangvaarGameState;
}

const GameOverDisplay: React.FC<GameOverDisplayProps> = ({ gameState }) => {
  const navigate = useNavigate();

  const getTeamPlayers = (teamId: TeamId): string => {
    const playerIds = gameState.teams[teamId]?.playerIds || [];
    return playerIds.map(id => gameState.players.find(p => p.userId === id)?.username || 'Unknown').join(' & ');
  };

  const team1Score = gameState.teams[1]?.cumulativeScore ?? 0;
  const team2Score = gameState.teams[2]?.cumulativeScore ?? 0;
  const winnerTeamId = gameState.winnerTeamId;

  let resultMessage = '';
  if (winnerTeamId) {
    resultMessage = `Team ${winnerTeamId} (${getTeamPlayers(winnerTeamId)}) wins!`;
  } else {
    resultMessage = "It's a Tie!";
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-emerald-50 p-6">
      <div className="bg-white p-8 rounded-lg shadow-xl text-center max-w-md">
        <h2 className="text-3xl font-bold mb-4 text-emerald-700">Game Over!</h2>
        
        <div className="mb-6 text-lg">
           <p className="mb-2">{resultMessage}</p>
           <p className="font-semibold">
             Final Score: Team 1 ({team1Score}) - Team 2 ({team2Score})
           </p>
        </div>

        <div className="space-y-2 text-sm mb-6 border-t pt-4">
            <p><strong>Team 1:</strong> {getTeamPlayers(1)}</p>
            <p><strong>Team 2:</strong> {getTeamPlayers(2)}</p>
        </div>

        {/* TODO: Add details about winnings/payouts once implemented */}
        
        <button
          onClick={() => navigate('/choose-game')}
          className="w-full bg-emerald-600 text-white py-2 px-5 rounded-md font-medium hover:bg-emerald-700 transition-colors"
        >
          Back to Games
        </button>
      </div>
    </div>
  );
};

export default GameOverDisplay; 
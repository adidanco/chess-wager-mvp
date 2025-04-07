import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ScambodiaGameState } from '../../types/scambodia';
import Button from '../common/Button';

interface GameOverDisplayProps {
  gameState: ScambodiaGameState;
  currentUserId: string;
}

/**
 * Component to display game over information, including:
 * - Final scores for all players
 * - Game winner
 * - Payouts information
 * - Option to go back to menu
 */
const GameOverDisplay: React.FC<GameOverDisplayProps> = ({
  gameState,
  currentUserId
}) => {
  const navigate = useNavigate();

  // Calculate total payout
  const totalPot = gameState.wagerPerPlayer * gameState.players.length;
  const didIWin = currentUserId === gameState.gameWinnerId;

  // Sort players by cumulative score (lowest first)
  const sortedPlayers = [...gameState.players].sort((a, b) => {
    const scoreA = gameState.cumulativeScores[a.userId] || 0;
    const scoreB = gameState.cumulativeScores[b.userId] || 0;
    return scoreA - scoreB;
  });

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-deep-purple mb-2">
            Game Over
          </h2>
          <p className="text-gray-600">
            {didIWin 
              ? '🎉 Congratulations! You won!' 
              : `Winner: ${gameState.players.find(p => p.userId === gameState.gameWinnerId)?.username || 'Unknown'}`
            }
          </p>
        </div>

        {/* Game statistics */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-700 mb-2">Final Scores</h3>
          <div className="bg-gray-50 rounded-lg p-3">
            <ul className="divide-y divide-gray-200">
              {sortedPlayers.map((player, index) => {
                const score = gameState.cumulativeScores[player.userId] || 0;
                const isWinner = player.userId === gameState.gameWinnerId;
                return (
                  <li 
                    key={player.userId} 
                    className={`py-2 flex justify-between items-center ${
                      isWinner ? 'font-bold text-soft-pink' : ''
                    }`}
                  >
                    <div className="flex items-center">
                      <div className="w-6 h-6 flex items-center justify-center bg-deep-purple/10 rounded-full mr-2 text-xs font-medium">
                        {index + 1}
                      </div>
                      <span>
                        {player.username} {player.userId === currentUserId && '(You)'}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span>{score} {isWinner && '🏆'}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Payout information */}
        <div className="bg-green-50 rounded-lg p-3 mb-6">
          <h3 className="font-semibold text-green-800 mb-2">Payout</h3>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-green-700">Total pot</p>
              <p className="text-sm text-gray-600">
                {gameState.players.length} players × ₹{gameState.wagerPerPlayer}/player
              </p>
            </div>
            <div className="text-xl font-bold text-green-700">
              ₹{totalPot}
            </div>
          </div>
          {gameState.payoutProcessed && (
            <div className="mt-2 text-sm text-green-600">
              Payout processed on {gameState.payoutTimestamp?.toDate().toLocaleString() || 'Unknown'}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => navigate('/')}
          >
            Back to Home
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => navigate('/create-scambodia-game')}
          >
            New Game
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GameOverDisplay; 
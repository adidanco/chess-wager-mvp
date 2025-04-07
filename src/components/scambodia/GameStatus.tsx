import React from 'react';
import { ScambodiaGameState } from '../../types/scambodia';

interface GameStatusProps {
  gameState: ScambodiaGameState;
  currentUserId: string;
  isMyTurn: boolean;
  isInitialPeekPhase?: boolean;
  peekCountdown?: number;
  currentPhase?: string;
}

/**
 * Component to display current game status information including:
 * - Current round number
 * - Game phase (Setup, Playing, FinalTurn, Scoring, etc.)
 * - Whose turn it is
 * - Declaration status (if someone declared Scambodia)
 */
const GameStatus: React.FC<GameStatusProps> = ({
  gameState,
  currentUserId,
  isMyTurn,
  isInitialPeekPhase,
  peekCountdown,
  currentPhase
}) => {
  const currentRound = gameState.rounds[gameState.currentRoundNumber];
  if (!currentRound) return null;

  // Get current player info
  const currentPlayer = gameState.players.find(
    p => p.userId === currentRound.currentTurnPlayerId
  );

  // Format the phase for display
  const formatPhase = (phase: string): string => {
    switch (phase) {
      case 'Setup': return 'Setting up game';
      case 'Playing': return 'Playing';
      case 'FinalTurn': return 'Final turns after Scambodia';
      case 'Scoring': return 'Calculating scores';
      case 'Complete': return 'Round complete';
      default: return phase;
    }
  };

  return (
    <div className="bg-white p-3 rounded-lg shadow-sm mb-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="flex items-center mb-2 md:mb-0">
          <div className="bg-deep-purple/10 px-3 py-1 rounded-full text-deep-purple font-medium mr-3">
            Round {gameState.currentRoundNumber + 1}/{gameState.totalRounds}
          </div>
          <div className="bg-soft-lavender/20 px-3 py-1 rounded-full text-soft-pink font-medium">
            {formatPhase(currentRound.phase)}
          </div>
        </div>
        
        <div className="flex items-center">
          {isInitialPeekPhase ? (
            <div className="flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium animate-pulse">
              <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
              Peek Phase ({peekCountdown}s)
            </div>
          ) : isMyTurn ? (
            <div className="flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium animate-pulse">
              <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
              Your Turn
            </div>
          ) : (
            <div className="flex items-center text-gray-600">
              <span className="font-medium mr-1">{currentPlayer?.username || 'Opponent'}'s</span> turn
            </div>
          )}
        </div>
      </div>

      {/* Initial peek phase message */}
      {isInitialPeekPhase && (
        <div className="mt-3 mb-2 bg-soft-pink/20 py-2 px-4 rounded-lg text-center">
          <p className="text-deep-purple font-medium text-md uppercase">INITIAL PEEK GOING ON</p>
          <p className="text-sm text-gray-600">WAITING FOR ALL PLAYERS TO PEEK</p>
        </div>
      )}

      {/* Additional game info */}
      <div className="mt-2 text-sm text-gray-600">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div>Wager: ₹{gameState.wagerPerPlayer}/player</div>
          <div>•</div>
          <div>Players: {gameState.players.length}</div>
          
          {currentRound.playerDeclaredScambodia && (
            <>
              <div>•</div>
              <div className="text-soft-pink font-medium">
                Scambodia declared by {
                  gameState.players.find(p => p.userId === currentRound.playerDeclaredScambodia)?.username || 'Unknown'
                }
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameStatus; 
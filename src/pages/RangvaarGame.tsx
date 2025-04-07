import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useRangvaarGame } from '../hooks/useRangvaarGame';
import { useAuth } from '../context/AuthContext';
import { logger } from '../utils/logger';
import PlayerHand from '../components/rangvaar/PlayerHand';
import BiddingInterface from '../components/rangvaar/BiddingInterface';
import TrumpSelection from '../components/rangvaar/TrumpSelection';
import GameBoardLayout from '../components/rangvaar/GameBoardLayout';
import TrickArea from '../components/rangvaar/TrickArea';
import GameStatusDisplay from '../components/rangvaar/GameStatusDisplay';
import GameOverDisplay from '../components/rangvaar/GameOverDisplay';

export default function RangvaarGame(): JSX.Element {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const {
    gameState,
    loading,
    error,
    placeBid,
    selectTrump,
    playCard,
    declareRoundWinDebug,
    logCurrentStateDebug
  } = useRangvaarGame(gameId);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const handleAction = async (actionFn: () => Promise<void>) => {
    setIsSubmittingAction(true);
    try {
      await actionFn();
    } finally {
      setIsSubmittingAction(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner message="Loading Game..." /></div>;
  }

  if (error || !gameState) {
    logger.error('RangvaarGame', 'Error loading game or game state null', { gameId, error, gameStateExists: !!gameState });
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center p-8 bg-white shadow-lg rounded-lg">
          <p className="text-red-600 mb-4">{error || 'Failed to load game data.'}</p>
          <button 
            onClick={() => navigate('/')} 
            className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const currentPhase = gameState.currentRoundState?.phase;
  const currentPlayerId = currentUser?.uid;
  const isMyTurn = gameState.currentRoundState?.currentTurnPlayerId === currentPlayerId;
  const myHand = gameState.currentRoundState?.hands[currentPlayerId || ''] || [];

  if (gameState.status === 'Finished') {
      return <GameOverDisplay gameState={gameState} />;
  }
  
  if (gameState.status === 'Cancelled') {
       return <div className="min-h-screen flex items-center justify-center"><p>Game Cancelled.</p></div>;
  }
  
  if (gameState.status === 'Waiting' || gameState.status === 'Starting') {
       logger.warn('RangvaarGame', 'Game page loaded but status is Waiting/Starting', { gameId, status: gameState.status });
       return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner message="Waiting for game to start..." /></div>;
  }
  
  if (!gameState.currentRoundState) {
       return <div className="min-h-screen flex items-center justify-center"><p>Error: Round state missing.</p></div>;
  }
  
  return (
    <div className="flex flex-col h-screen bg-gray-50 relative">
      {process.env.NODE_ENV === 'development' && gameState?.status === 'Playing' && (
        <div className="absolute top-1 right-1 z-50 bg-red-100 border border-red-300 p-2 rounded shadow-lg text-xs space-y-1">
          <p className="font-bold text-red-700 text-center">DEBUG</p>
          <button 
            onClick={() => logCurrentStateDebug()} 
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs"
          >
            Log State
          </button>
          <button 
            onClick={() => handleAction(() => declareRoundWinDebug(1))} 
            className="w-full bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs"
            disabled={isSubmittingAction}
           >
             Force T1 Win Rnd
          </button>
          <button 
            onClick={() => handleAction(() => declareRoundWinDebug(2))} 
            className="w-full bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs"
            disabled={isSubmittingAction}
          >
             Force T2 Win Rnd
          </button>
        </div>
      )}

      <div className="p-2 bg-white border-b border-gray-300 shadow-sm z-10">
          <GameStatusDisplay gameState={gameState} />
      </div>

      <div className="flex-grow relative bg-emerald-700 p-2 md:p-4 overflow-hidden">
          <GameBoardLayout gameState={gameState} currentUserId={currentPlayerId} />
      </div>

      <div className="p-4 bg-gray-100 border-t border-gray-300 shadow-inner">
          <PlayerHand 
              hand={myHand}
              playCard={(cardId) => handleAction(() => playCard(cardId))}
              isMyTurn={isMyTurn && currentPhase === 'TrickPlaying'}
              currentTrick={gameState.currentRoundState.currentTrickCards || []}
              trumpSuit={gameState.currentRoundState.trumpSuit}
              isSubmitting={isSubmittingAction} 
          /> 
      </div>

      <div className="p-2 bg-white border-t border-gray-300">
        {currentPhase === 'Bidding' && isMyTurn && (
          <BiddingInterface 
            placeBid={(bid) => handleAction(() => placeBid(bid))} 
            highestBidInfo={gameState.currentRoundState.highestBid}
            isSubmitting={isSubmittingAction} 
          />
        )}
        {currentPhase === 'TrumpSelection' && isMyTurn && (
           <TrumpSelection 
              selectTrump={(suit) => handleAction(() => selectTrump(suit))} 
              isSubmitting={isSubmittingAction} 
           />
        )}
        {!isMyTurn && 
         currentPhase !== 'RoundEnded' && 
         currentPhase !== 'DealingRest' && 
         currentPhase !== 'TrumpSelection' &&
         gameState.status === 'Playing' && (
             <div className="text-center p-3">
                 <p className="text-sm text-gray-600 italic">Waiting for {gameState.players.find(p => p.userId === gameState.currentRoundState?.currentTurnPlayerId)?.username || 'other player'}...</p>
             </div>
        )}
        {currentPhase === 'DealingRest' && (
             <div className="text-center p-3">
                 <p className="text-sm text-gray-600 italic">Dealing remaining cards...</p>
             </div>
        )}
         {currentPhase === 'RoundEnded' && gameState.status === 'Playing' && (
             <div className="text-center p-3">
                 <p className="text-sm text-gray-600 italic">Round ended. Preparing next round...</p>
             </div>
        )}
      </div>
    </div>
  );
}
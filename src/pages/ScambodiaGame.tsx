import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useScambodiaGame } from '../hooks/useScambodiaGame';
import { useAuth } from '../context/AuthContext';
import { logger } from '../utils/logger';
import { CardPosition, Card } from '../types/scambodia';

// Import our implemented components
import GameBoard from '../components/scambodia/GameBoard';
import GameControls from '../components/scambodia/GameControls';

// Note: Some components are not fully implemented yet
// import SpecialPower from '../components/scambodia/SpecialPower';
// import GameStatus from '../components/scambodia/GameStatus';
// import GameOverDisplay from '../components/scambodia/GameOverDisplay';

export default function ScambodiaGame(): JSX.Element {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const {
    gameState,
    loading,
    error,
    drawCard,
    exchangeCard,
    discardDrawnCard,
    attemptMatch,
    declareScambodia,
    usePower,
    endTurn,
    logGameState
  } = useScambodiaGame(gameId);

  // Local state for game interactions
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [selectedCardPosition, setSelectedCardPosition] = useState<CardPosition | null>(null);
  const [drawnCard, setDrawnCard] = useState<Card | null>(null);
  const [hasDrawnCard, setHasDrawnCard] = useState(false);
  const [drawnFromDiscard, setDrawnFromDiscard] = useState(false);

  // Action handler with loading state management
  const handleAction = async (actionFn: () => Promise<void>) => {
    setIsSubmittingAction(true);
    try {
      await actionFn();
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Card handlers
  const handleCardClick = (position: CardPosition) => {
    setSelectedCardPosition(position === selectedCardPosition ? null : position);
  };

  // Game action handlers
  const handleDrawFromDeck = async () => {
    await handleAction(async () => {
      await drawCard('deck');
      setHasDrawnCard(true);
      setDrawnFromDiscard(false);
      // In a real implementation, we'd set the drawn card from the result
      // For now, simulate with a dummy card
      setDrawnCard({
        id: 'drawn-card',
        suit: 'Hearts',
        rank: 'K',
        value: 13
      });
    });
  };

  const handleDrawFromDiscard = async () => {
    await handleAction(async () => {
      await drawCard('discard');
      setHasDrawnCard(true);
      setDrawnFromDiscard(true);
      // In a real implementation, we'd set the drawn card from the discard pile
      if (gameState?.rounds[gameState.currentRoundNumber]?.discardPile.length) {
        const discardTop = gameState.rounds[gameState.currentRoundNumber].discardPile[
          gameState.rounds[gameState.currentRoundNumber].discardPile.length - 1
        ];
        setDrawnCard(discardTop);
      }
    });
  };

  const handleExchangeCard = async (position: CardPosition) => {
    await handleAction(async () => {
      await exchangeCard(position);
      setSelectedCardPosition(null);
      setHasDrawnCard(false);
      setDrawnCard(null);
      setDrawnFromDiscard(false);
    });
  };

  const handleDiscardDrawnCard = async () => {
    await handleAction(async () => {
      await discardDrawnCard();
      setHasDrawnCard(false);
      setDrawnCard(null);
      setDrawnFromDiscard(false);
    });
  };

  const handleAttemptMatch = async (position: CardPosition) => {
    await handleAction(async () => {
      await attemptMatch(position);
      setSelectedCardPosition(null);
      setHasDrawnCard(false);
      setDrawnCard(null);
      setDrawnFromDiscard(false);
    });
  };

  const handleDeclareScambodia = async () => {
    await handleAction(async () => {
      await declareScambodia();
    });
  };

  // Loading state
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner message="Loading Game..." /></div>;
  }

  // Error state
  if (error || !gameState) {
    logger.error('ScambodiaGame', 'Error loading game or game state null', { gameId, error, gameStateExists: !!gameState });
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center p-8 bg-white shadow-lg rounded-lg">
          <p className="text-red-600 mb-4">{error || 'Failed to load game data.'}</p>
          <button 
            onClick={() => navigate('/choose-game')} 
            className="bg-deep-purple text-white px-4 py-2 rounded hover:bg-soft-pink"
          >
            Back to Games
          </button>
        </div>
      </div>
    );
  }

  // Game state validation
  const currentPlayerId = currentUser?.uid;
  const isMyTurn = gameState.rounds[gameState.currentRoundNumber]?.currentTurnPlayerId === currentPlayerId;
  const currentRound = gameState.rounds[gameState.currentRoundNumber];
  
  // Game finished state
  if (gameState.status === 'Finished') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center p-8 bg-white shadow-lg rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Game Over</h2>
          <p className="mb-4">
            {gameState.gameWinnerId === currentPlayerId 
              ? '🎉 Congratulations! You won the game!' 
              : `Game won by ${gameState.players.find(p => p.userId === gameState.gameWinnerId)?.username || 'Unknown'}`}
          </p>
          <button 
            onClick={() => navigate('/choose-game')} 
            className="bg-deep-purple text-white px-4 py-2 rounded hover:bg-soft-pink"
          >
            Back to Games
          </button>
        </div>
      </div>
    );
  }
  
  // Game cancelled state
  if (gameState.status === 'Cancelled') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Game Cancelled.</p>
      </div>
    );
  }
  
  // Waiting state
  if (gameState.status === 'Waiting') {
    logger.warn('ScambodiaGame', 'Game page loaded but status is Waiting', { gameId, status: gameState.status });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner message="Waiting for game to start..." />
      </div>
    );
  }
  
  // Validate round state
  if (!currentRound) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Error: Round state missing.</p>
      </div>
    );
  }

  // Determine if player can declare Scambodia
  const canDeclareScambodia = isMyTurn && !hasDrawnCard && !currentRound.playerDeclaredScambodia;

  // Main game UI with our new components
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Debug controls (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-1 right-1 z-50 bg-red-100 border border-red-300 p-2 rounded shadow-lg text-xs space-y-1">
          <p className="font-bold text-red-700 text-center">DEBUG</p>
          <button 
            onClick={() => logGameState()} 
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs"
          >
            Log State
          </button>
        </div>
      )}

      {/* Game Status Header */}
      <div className="p-2 bg-white border-b border-gray-300 shadow-sm z-10">
        <div className="text-center">
          <h2 className="text-xl font-bold text-deep-purple">Scambodia Game</h2>
          <p className="text-sm text-gray-600">
            Round {gameState.currentRoundNumber + 1} of {gameState.totalRounds} | 
            Phase: {currentRound.phase} | 
            {isMyTurn ? <span className="text-green-600 font-bold"> Your Turn</span> : 
              <span className="text-gray-600"> Waiting for {gameState.players.find(p => p.userId === currentRound.currentTurnPlayerId)?.username || 'other player'}</span>}
          </p>
        </div>
      </div>

      {/* Game Board with Player's Hand and Opponents */}
      <div className="flex-grow overflow-auto bg-soft-lavender/20 p-4">
        <GameBoard
          gameState={gameState}
          currentUserId={currentPlayerId || ''}
          selectedCardPosition={selectedCardPosition}
          onCardClick={handleCardClick}
          canSelectCard={isMyTurn && hasDrawnCard}
          drawnCard={drawnCard}
        />
      </div>

      {/* Game Controls Footer */}
      <div className="p-2 bg-white border-t border-gray-300">
        <GameControls
          isMyTurn={isMyTurn}
          currentPhase={currentRound.phase}
          selectedCardPosition={selectedCardPosition}
          hasDrawnCard={hasDrawnCard}
          drawnFromDiscard={drawnFromDiscard}
          isSubmittingAction={isSubmittingAction}
          onDrawFromDeck={handleDrawFromDeck}
          onDrawFromDiscard={handleDrawFromDiscard}
          onExchangeCard={handleExchangeCard}
          onDiscardDrawnCard={handleDiscardDrawnCard}
          onAttemptMatch={handleAttemptMatch}
          onDeclareScambodia={handleDeclareScambodia}
          onUseSpecialPower={() => {}}
          canDeclareScambodia={canDeclareScambodia}
        />
      </div>
    </div>
  );
} 
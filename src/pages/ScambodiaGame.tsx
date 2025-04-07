import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useScambodiaGame } from '../hooks/useScambodiaGame';
import { useAuth } from '../context/AuthContext';
import { logger } from '../utils/logger';
import { CardPosition, Card, CardPowerType, RoundState } from '../types/scambodia';
import { toast } from 'react-hot-toast';

// Correct import for determinePowerType
import { determinePowerType } from '../utils/scambodiaUtils'; 
// Correct import path for the service function
import { completeInitialPeek } from '../services/scambodiaService';

// Import our implemented components
import GameBoard from '../components/scambodia/GameBoard';
import GameControls from '../components/scambodia/GameControls';
import GameStatus from '../components/scambodia/GameStatus';
import SpecialPower from '../components/scambodia/SpecialPower';
import GameOverDisplay from '../components/scambodia/GameOverDisplay';

// Note: Some components are not fully implemented yet
// import SpecialPower from '../components/scambodia/SpecialPower';
// import GameStatus from '../components/scambodia/GameStatus';
// import GameOverDisplay from '../components/scambodia/GameOverDisplay';

const INITIAL_PEEK_DURATION = 10; // Seconds (reduced for testing)

export default function ScambodiaGame(): JSX.Element {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const currentPlayerId = currentUser?.uid; // Keep this potentially undefined temporarily

  const {
    gameState,
    loading,
    error,
    drawnCard,
    drawCard: drawCardAction,
    exchangeCard: exchangeCardAction,
    discardDrawnCard: discardDrawnCardAction,
    attemptMatch: attemptMatchAction,
    declareScambodia: declareScambodiaAction,
    usePower: usePowerAction,
    endTurn: endTurnAction,
    logGameState,
  } = useScambodiaGame(gameId);

  // Local state for game interactions
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [selectedCardPosition, setSelectedCardPosition] = useState<CardPosition | null>(null);
  const [hasDrawnCard, setHasDrawnCard] = useState(false);
  const [drawnFromDiscard, setDrawnFromDiscard] = useState(false);
  const [showSpecialPower, setShowSpecialPower] = useState(false);
  const [specialCard, setSpecialCard] = useState<Card | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);

  // State for special power target selections
  const [powerTarget_OpponentId, setPowerTarget_OpponentId] = useState<string | null>(null);
  const [powerTarget_OwnCardIndex, setPowerTarget_OwnCardIndex] = useState<CardPosition | null>(null);
  const [powerTarget_OpponentCardIndex, setPowerTarget_OpponentCardIndex] = useState<CardPosition | null>(null);

  // State for initial peek phase
  const [isInitialPeekPhase, setIsInitialPeekPhase] = useState(false);
  const [peekCountdown, setPeekCountdown] = useState(INITIAL_PEEK_DURATION);

  // Memoized values for game state
  const currentRound = useMemo(() => gameState?.rounds[gameState.currentRoundNumber], [gameState]) as RoundState | undefined;
  const isMyTurn = useMemo(() => !!currentPlayerId && currentRound?.currentTurnPlayerId === currentPlayerId, [currentRound, currentPlayerId]);
  const currentPhase = useMemo(() => currentRound?.phase, [currentRound]);

  // Network status detection
  useEffect(() => {
    const handleOnline = () => setOfflineMode(false);
    const handleOffline = () => setOfflineMode(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial status
    setOfflineMode(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Effect to handle drawn card state change
  useEffect(() => {
    setHasDrawnCard(!!drawnCard);
    if (drawnCard) {
      setSelectedCardPosition(null); 
    }
  }, [drawnCard]);

  // Handler for initiating the initial peek
  const handleInitialPeek = useCallback(() => {
    if (!currentRound || currentRound.phase !== 'Setup' || currentRound.initialPeekCompleted) {
      return toast.error("Cannot start peek phase at this time.");
    }
    
    setIsInitialPeekPhase(true);
    setPeekCountdown(INITIAL_PEEK_DURATION);
    
    // Start countdown
    const timer = setInterval(() => {
      setPeekCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Auto-complete after timeout
    setTimeout(async () => {
      setIsInitialPeekPhase(false);
      
      // Only complete the peek phase if we're the first player
      if (gameState && currentPlayerId && 
          gameState.players[0].userId === currentPlayerId && 
          gameId && gameState.currentRoundNumber) {
        try {
          await completeInitialPeek(gameId, gameState.currentRoundNumber);
          toast.success('Peek phase complete! Game starting.');
        } catch (error) {
          logger.error('ScambodiaGame', 'Failed to complete peek phase', { error });
          toast.error('Error ending peek phase.');
        }
      }
    }, INITIAL_PEEK_DURATION * 1000);
    
    toast.success(`Peeking at your bottom cards for ${INITIAL_PEEK_DURATION} seconds!`);
  }, [currentRound, gameState, currentPlayerId, gameId]);

  // Action handler with loading state management
  const handleAction = useCallback(async (actionFn: () => Promise<any>) => {
    if (isSubmittingAction) return;
    setIsSubmittingAction(true);
    try {
      await actionFn();
      if (!showSpecialPower) {
        setSelectedCardPosition(null);
      }
    } catch (err: any) {
      logger.error('ScambodiaGame', 'Action failed', { error: err });
      toast.error(err.message || 'An error occurred.');
    } finally {
      setIsSubmittingAction(false);
    }
  }, [isSubmittingAction, showSpecialPower]);

  // Card handlers
  const handleCardClick = (position: CardPosition, playerId?: string) => {
    if (isInitialPeekPhase) return;
    if (showSpecialPower && specialCard) {
      const powerType = determinePowerType(specialCard);
      if (playerId) { 
        if (powerType === 'Peek_Opponent' || powerType === 'Blind_Swap' || powerType === 'Seen_Swap') {
          setPowerTarget_OpponentId(playerId);
          setPowerTarget_OpponentCardIndex(position);
          toast(`Selected opponent ${gameState?.players.find(p => p.userId === playerId)?.username}'s card ${position + 1} for ${powerType}. Confirm in modal.`);
        }
      } else { 
        if (powerType === 'Peek_Own' || powerType === 'Blind_Swap' || powerType === 'Seen_Swap') {
          setPowerTarget_OwnCardIndex(position);
          toast(`Selected your card ${position + 1} for ${powerType}. Confirm in modal.`);
        }
      }
      return; 
    }
    if (isMyTurn && hasDrawnCard) {
      setSelectedCardPosition(position === selectedCardPosition ? null : position);
    }
  };

  // Game action handlers
  const handleDrawFromDeck = async () => {
    if (isInitialPeekPhase) return toast.error("Cannot draw during peek phase.");
    await handleAction(() => drawCardAction('deck'));
  };

  const handleDrawFromDiscard = async () => {
    if (isInitialPeekPhase) return toast.error("Cannot draw from discard during peek phase.");
    await handleAction(() => drawCardAction('discard'));
  };

  const handleExchangeCard = async () => {
    if (isInitialPeekPhase) return toast.error("Cannot exchange during peek phase.");
    if (selectedCardPosition === null) return toast.error('Select a card in your hand to exchange.');
    await handleAction(() => exchangeCardAction(selectedCardPosition));
  };

  const handleDiscardDrawnCard = async () => {
    if (isInitialPeekPhase) return toast.error("Cannot discard during peek phase.");
    await handleAction(async () => {
      const discarded = await discardDrawnCardAction();
      
      // Check if the discarded card has a special power
      if (discarded && ['J', 'Q', 'K'].includes(discarded.rank)) {
        setSpecialCard(discarded);
        setShowSpecialPower(true);
      }
    });
  };

  const handleAttemptMatch = async () => {
    if (isInitialPeekPhase) return toast.error("Cannot attempt match during peek phase.");
    if (selectedCardPosition === null) return toast.error('Select a card in your hand to attempt a match.');
    await handleAction(async () => {
      const succeeded = await attemptMatchAction(selectedCardPosition);
      if (succeeded !== null) {
        toast(succeeded ? '✅ Cards matched!' : '❌ Cards did not match');
      }
    });
  };

  const handleDeclareScambodia = async () => {
    if (isInitialPeekPhase) return toast.error("Cannot declare Scambodia during peek phase.");
    await handleAction(async () => {
      await declareScambodiaAction();
      toast.success('SCAMBODIA declared! Other players get one more turn.');
    });
  };

  const handleUseSpecialPower = async () => {
    if (isInitialPeekPhase) return;
    await handleAction(async () => {
      if (specialCard) {
        const powerType = determinePowerType(specialCard)!;
        let finalParams: any = {};
        switch (powerType) {
          case 'Peek_Own': finalParams = { cardIndex: powerTarget_OwnCardIndex }; break;
          case 'Peek_Opponent': finalParams = { targetPlayerId: powerTarget_OpponentId, cardIndex: powerTarget_OpponentCardIndex }; break;
          case 'Blind_Swap': case 'Seen_Swap': finalParams = { cardIndex: powerTarget_OwnCardIndex, targetPlayerId: powerTarget_OpponentId, targetCardIndex: powerTarget_OpponentCardIndex }; break;
        }
        if ((powerType === 'Peek_Own' && finalParams.cardIndex === null) || (powerType === 'Peek_Opponent' && (finalParams.targetPlayerId === null || finalParams.cardIndex === null)) || ((powerType === 'Blind_Swap' || powerType === 'Seen_Swap') && (finalParams.cardIndex === null || finalParams.targetPlayerId === null || finalParams.targetCardIndex === null))) {
          throw new Error('Missing target selection for the power.');
        }
        await usePowerAction(powerType, finalParams);
        toast.success(`Used ${specialCard.rank} special power!`);
        setShowSpecialPower(false);
        setSpecialCard(null);
        setPowerTarget_OwnCardIndex(null);
        setPowerTarget_OpponentId(null);
        setPowerTarget_OpponentCardIndex(null);
        await endTurnAction();
      } else {
        logger.warn('ScambodiaGame', 'handleUseSpecialPower called without specialCard state');
        toast.error('Action failed: No special card context.');
        setShowSpecialPower(false);
        setSpecialCard(null);
        setPowerTarget_OwnCardIndex(null);
        setPowerTarget_OpponentId(null);
        setPowerTarget_OpponentCardIndex(null);
      }
    });
  };

  const handleSkipSpecialPower = async () => {
    if (isInitialPeekPhase) return;
    setShowSpecialPower(false);
    setSpecialCard(null);
    setPowerTarget_OwnCardIndex(null);
    setPowerTarget_OpponentId(null);
    setPowerTarget_OpponentCardIndex(null);
    try {
      setIsSubmittingAction(true);
      await endTurnAction();
      toast('Special power skipped.');
    } catch(err: any) {
       logger.error('ScambodiaGame', 'Failed to end turn after skip', { error: err });
       toast.error(err.message || 'Failed to end turn.');
    } finally {
       setIsSubmittingAction(false);
    }
  };

  // Handler to clear power target selections
  const handleCancelSelection = () => {
    setPowerTarget_OwnCardIndex(null);
    setPowerTarget_OpponentId(null);
    setPowerTarget_OpponentCardIndex(null);
    toast('Target selection cleared.');
  };

  // Update the prop passed to GameBoard
  const powerTargetSelectionForBoard = useMemo(() => {
    if (!showSpecialPower || !specialCard) return undefined;

    const powerType = determinePowerType(specialCard);

    switch (powerType) {
      case 'Peek_Own':
      case 'Blind_Swap': // Might target own first, then opponent
      case 'Seen_Swap':  // Might target own first, then opponent
        // If targeting own card for swap, or peeking own
        if (!powerTarget_OwnCardIndex) { // Still need to select own card
           return { type: 'own' as const };
        }
        // If own card selected, and power needs opponent, target opponent
        if ((powerType === 'Blind_Swap' || powerType === 'Seen_Swap') && !powerTarget_OpponentId) {
          return { type: 'opponent' as const }; // General opponent target mode
        }
        // If own selected, opponent selected, target specific opponent card
        if ((powerType === 'Blind_Swap' || powerType === 'Seen_Swap') && powerTarget_OpponentId && !powerTarget_OpponentCardIndex) {
          return { type: 'opponent' as const, playerId: powerTarget_OpponentId };
        }
        break;
      case 'Peek_Opponent':
        // If opponent not selected yet
        if (!powerTarget_OpponentId) {
          return { type: 'opponent' as const }; // General opponent target mode
        }
        // If opponent selected, but card not yet
        if (powerTarget_OpponentId && !powerTarget_OpponentCardIndex) {
          return { type: 'opponent' as const, playerId: powerTarget_OpponentId };
        }
        break;
    }
    return undefined; // No targeting active
  }, [showSpecialPower, specialCard, powerTarget_OwnCardIndex, powerTarget_OpponentId, powerTarget_OpponentCardIndex]);

  // Logic to determine visible cards for the player during peek phase
  const visibleCardsForPlayer = useMemo(() => {
    if (!currentRound || !currentPlayerId) return [];
    
    // Only show cards during initial peek if peek phase is active
    if (currentRound.phase === 'Setup' && !currentRound.initialPeekCompleted) {
      if (isInitialPeekPhase) {
        // Only show bottom two cards (2, 3) during initial peek
        return [2, 3] as CardPosition[];
      } else {
        // No cards visible before the peek button is clicked
        return [] as CardPosition[];
      }
    }
    
    // Normal visibility from game state (filtering for own card positions)
    return (currentRound.visibleToPlayer[currentPlayerId] || []).filter((p): p is CardPosition => typeof p === 'number');
  }, [currentRound, currentPlayerId, isInitialPeekPhase]);

  // Loading state
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner message="Loading Game..." /></div>;
  }

  // Offline state
  if (offlineMode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center p-8 bg-white shadow-lg rounded-lg">
          <p className="text-amber-600 mb-4">You are currently offline. Please check your internet connection.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-deep-purple text-white px-4 py-2 rounded hover:bg-soft-pink"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !gameState) {
    logger.error('ScambodiaGame', 'Error loading game or game state null', { gameId, error, gameStateExists: !!gameState });
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center p-8 bg-white shadow-lg rounded-lg">
          <p className="text-red-600 mb-4">{error || 'Failed to load game data.'}</p>
          <button 
            onClick={() => navigate('/')} 
            className="bg-deep-purple text-white px-4 py-2 rounded hover:bg-soft-pink"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Game finished state
  if (gameState.status === 'Finished') {
    return (
      <GameOverDisplay
        gameState={gameState}
        currentUserId={currentPlayerId || ''}
      />
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
  const canDeclareScambodia = isMyTurn && !hasDrawnCard && !currentRound.playerDeclaredScambodia && currentPhase === 'Playing';

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
        <GameStatus
          gameState={gameState}
          currentUserId={currentPlayerId || ''}
          isMyTurn={isMyTurn}
          isInitialPeekPhase={isInitialPeekPhase}
          peekCountdown={peekCountdown}
          currentPhase={currentPhase || 'Setup'}
        />
      </div>

      {/* Game Board with Player's Hand and Opponents */}
      <div className="flex-grow overflow-auto bg-soft-lavender/20 p-4">
        <GameBoard
          gameState={gameState}
          currentUserId={currentPlayerId || ''}
          selectedCardPosition={selectedCardPosition}
          onCardClick={handleCardClick}
          canSelectCard={isMyTurn && hasDrawnCard && !isInitialPeekPhase}
          drawnCard={drawnCard}
          powerTargetSelection={powerTargetSelectionForBoard}
          visibleCardPositions={visibleCardsForPlayer}
        />
      </div>

      {/* Game Controls Footer */}
      <div className="p-2 bg-white border-t border-gray-300">
        <GameControls
          isMyTurn={isMyTurn}
          currentPhase={currentPhase || 'Setup'}
          selectedCardPosition={selectedCardPosition}
          hasDrawnCard={hasDrawnCard}
          drawnFromDiscard={drawnFromDiscard}
          isSubmitting={isSubmittingAction}
          onDrawFromDeck={handleDrawFromDeck}
          onDrawFromDiscard={handleDrawFromDiscard}
          onExchangeCard={handleExchangeCard}
          onDiscardDrawnCard={handleDiscardDrawnCard}
          onAttemptMatch={handleAttemptMatch}
          onDeclareScambodia={handleDeclareScambodia}
          canDeclareScambodia={canDeclareScambodia}
          disabled={!isMyTurn || isSubmittingAction}
          onInitialPeek={handleInitialPeek}
          isInitialPeekPhase={isInitialPeekPhase}
        />
      </div>

      {/* Special Power Modal */}
      {showSpecialPower && specialCard && gameState && (
        <SpecialPower
          specialCard={specialCard}
          isSubmitting={isSubmittingAction}
          onUseSpecialPower={handleUseSpecialPower}
          onSkipSpecialPower={handleSkipSpecialPower}
          onCancelSelection={handleCancelSelection}
          powerTarget_OwnCardIndex={powerTarget_OwnCardIndex}
          powerTarget_OpponentId={powerTarget_OpponentId}
          powerTarget_OpponentCardIndex={powerTarget_OpponentCardIndex}
          players={gameState.players}
          currentUserId={currentPlayerId || ''}
        />
      )}
    </div>
  );
} 
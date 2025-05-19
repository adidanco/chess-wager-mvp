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
    initiatePower,
    resolvePowerTarget,
    skipPower,
    ignorePendingPower,
    logGameState,
    forceGameEnd,
    forceScoreRound,
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

  // State for temporary power peeking - Updated Structure
  const [peekedCardInfo, setPeekedCardInfo] = useState<{ 
    card: Card, 
    targetPosition: CardPosition, 
    targetPlayerId: string, 
    peekerId: string 
  } | null>(null);
  const [isPeekingActive, setIsPeekingActive] = useState(false);

  // Handler to clear power target selections
  const handleCancelSelection = (): void => {
    setPowerTarget_OwnCardIndex(null);
    setPowerTarget_OpponentId(null);
    setPowerTarget_OpponentCardIndex(null);
    toast('Target selection cleared.');
  };

  // Effect to clear peeked card info when peek timer ends
  useEffect(() => {
    if (!isPeekingActive) {
      setPeekedCardInfo(null);
    }
  }, [isPeekingActive]);

  // Memoized values for game state
  const currentRound = useMemo(() => gameState?.rounds[gameState.currentRoundNumber], [gameState]) as RoundState | undefined;
  const isMyTurn = useMemo(() => !!currentPlayerId && currentRound?.currentTurnPlayerId === currentPlayerId, [currentRound, currentPlayerId]);
  const currentPhase = useMemo(() => currentRound?.phase, [currentRound]);
  const pendingPower = useMemo(() => currentRound?.pendingPowerDecision, [currentRound]);
  const activePower = useMemo(() => currentRound?.activePowerResolution, [currentRound]);
  const hasDrawnCardState = useMemo(() => !!currentRound?.drawnCard, [currentRound]);
  const drawnCardSource = useMemo(() => currentRound?.drawnCardSource, [currentRound]); // Get source from state

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

  // Handler for initiating the initial peek
  const handleInitialPeek = useCallback(() => {
    // Check if the round exists and is in the Setup phase
    if (!currentRound || currentRound.phase !== 'Setup') {
      toast.error("Cannot start peek phase at this time.");
      return;
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
      
      // Any player whose timer runs out should signal they've completed the peek
      if (gameState && currentPlayerId && gameId && gameState.currentRoundNumber) {
        try {
          // Pass the current player's ID
          await completeInitialPeek(gameId, currentPlayerId, gameState.currentRoundNumber);
          toast.success('Peek phase complete!'); // General message, backend decides if game starts
        } catch (error) {
          logger.error('ScambodiaGame', 'Failed to signal peek completion', { error });
          toast.error('Error completing peek phase.');
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
      if (!activePower) {
        setSelectedCardPosition(null);
        setPowerTarget_OwnCardIndex(null);
        setPowerTarget_OpponentId(null);
        setPowerTarget_OpponentCardIndex(null);
      }
    } catch (err: any) {
      logger.error('ScambodiaGame', 'Action failed', { error: err });
      toast.error(err.message || 'An error occurred.');
    } finally {
      setIsSubmittingAction(false);
    }
  }, [isSubmittingAction, activePower]);

  // Card handlers
  const handleCardClick = (position: CardPosition, playerId?: string) => {
    if (isInitialPeekPhase) return;
    
    // If actively resolving a power, handle target selection
    if (activePower && activePower.step === 'SelectingTarget') {
      const powerType = activePower.type;
      const currentPlayerId = currentUser?.uid; // Ensure we have current user ID
      
      if (!currentPlayerId) return; // Should not happen if playing

      // Logic similar to before, but updates local state for targets
      if (playerId && playerId !== currentPlayerId) { // Click on Opponent
          if (powerType === 'Peek_Opponent' || powerType === 'Blind_Swap' || powerType === 'Seen_Swap') { // Blind_Swap needs opponent target
            if (powerTarget_OpponentId !== playerId) {
              setPowerTarget_OpponentId(playerId);
              setPowerTarget_OpponentCardIndex(null); // Reset card for new opponent
              toast.success(`Selected opponent - now choose their card.`);
            } else {
              // We have selected the opponent, now select their card
              setPowerTarget_OpponentCardIndex(position);
              // Updated toast: Check if own card is selected before prompting confirmation
              toast.success(`Selected opponent's card ${position + 1}. ${powerTarget_OwnCardIndex !== null ? 'Confirm power.' : 'Now select your card.'}`); 
            }
          }
        } else { // Click on Own Hand
          if (powerType === 'Peek_Own' || powerType === 'Blind_Swap' || powerType === 'Seen_Swap') { // Blind_Swap needs own target
            setPowerTarget_OwnCardIndex(position);
            // Updated toast: Check if opponent card is selected before prompting confirmation for swap powers
            const opponentTargetSelected = powerTarget_OpponentId && powerTarget_OpponentCardIndex !== null;
            toast.success(`Selected your card ${position + 1}. ${powerType === 'Peek_Own' ? 'Confirm power.' : (opponentTargetSelected ? 'Confirm power.' : 'Now select opponent\'s card.')}`);
          }
        }
    } else if (isMyTurn && hasDrawnCardState) {
        // If already drawn, allow selecting own card for Exchange (including ignore power)
        if (!playerId) { 
           setSelectedCardPosition(position === selectedCardPosition ? null : position);
        }
    } else if (isMyTurn && !hasDrawnCardState) {
       // If NOT drawn yet, allow selecting own card for Attempt Match
        if (!playerId) {
            setSelectedCardPosition(position === selectedCardPosition ? null : position);
        }
    }
  };

  // Game action handlers
  const handleDrawFromDeck = async () => {
    if (isInitialPeekPhase) {
      toast.error("Cannot draw during peek phase.");
      return;
    }
    await handleAction(() => drawCardAction('deck'));
  };

  const handleDrawFromDiscard = async () => {
    if (isInitialPeekPhase) {
      toast.error("Cannot draw from discard during peek phase.");
      return;
    }
    await handleAction(() => drawCardAction('discard'));
  };

  const handleExchangeCard = async () => {
    if (isInitialPeekPhase) {
      toast.error("Cannot exchange during peek phase.");
      return;
    }
    if (selectedCardPosition === null) return toast.error('Select a card in your hand to exchange.');
    await handleAction(() => exchangeCardAction(selectedCardPosition));
  };

  const handleDiscardDrawnCard = async () => {
    if (isInitialPeekPhase) {
      toast.error("Cannot discard during peek phase.");
      return;
    }
    await handleAction(() => discardDrawnCardAction());
  };

  const handleAttemptMatch = async () => {
    if (isInitialPeekPhase) {
      toast.error("Cannot attempt match during peek phase.");
      return;
    }
    if (selectedCardPosition === null) {
      toast.error('Select a card in your hand to attempt a match.');
      return;
    }
    await handleAction(async () => {
      const succeeded = await attemptMatchAction(selectedCardPosition);
      if (succeeded !== null) {
        toast(succeeded ? '✅ Cards matched!' : '❌ Cards did not match');
      }
    });
  };

  const handleDeclareScambodia = async () => {
    if (isInitialPeekPhase) {
      toast.error("Cannot declare Scambodia during peek phase.");
      return;
    }
    await handleAction(async () => {
      await declareScambodiaAction();
      toast.success('SCAMBODIA declared! Other players get one more turn.');
    });
  };

  const handleRedeemPower = async () => {
    if (!pendingPower || !pendingPower.card) {
      toast.error("No pending power to redeem.");
      return;
    }
    const powerType = determinePowerType(pendingPower.card);
    if (!powerType) {
      toast.error("Invalid card for power.");
      return;
    }
    await handleAction(() => initiatePower(powerType));
  };

  const handleConfirmUsePower = async () => {
    if (!activePower || activePower.step !== 'SelectingTarget') {
      toast.error("No power to use.");
      return;
    }
    
    const powerType = activePower.type;
    let targetData: any = {};
    let peekTargetPlayerId: string | null = null; // Whose card is being peeked
    let peekTargetPosition: CardPosition | null = null; // Which position is being peeked

    try {
      switch (powerType) {
        case 'Peek_Own': 
          if (powerTarget_OwnCardIndex === null) throw new Error('Select own card.');
          if (!currentPlayerId) throw new Error('Current player ID is undefined.');
          targetData = { cardIndex: powerTarget_OwnCardIndex }; 
          peekTargetPlayerId = currentPlayerId; // Target is self
          peekTargetPosition = powerTarget_OwnCardIndex;
          break;
        case 'Peek_Opponent': 
          if (powerTarget_OpponentId === null || powerTarget_OpponentCardIndex === null) throw new Error('Select opponent card.');
          targetData = { targetPlayerId: powerTarget_OpponentId, cardIndex: powerTarget_OpponentCardIndex }; 
          peekTargetPlayerId = powerTarget_OpponentId; // Target is opponent
          peekTargetPosition = powerTarget_OpponentCardIndex;
          break;
        case 'Blind_Swap': case 'Seen_Swap': 
          if (powerTarget_OwnCardIndex === null || powerTarget_OpponentId === null || powerTarget_OpponentCardIndex === null) throw new Error('Select own and opponent card.');
          targetData = { cardIndex: powerTarget_OwnCardIndex, targetPlayerId: powerTarget_OpponentId, targetCardIndex: powerTarget_OpponentCardIndex }; 
          break;
        default: throw new Error('Invalid power type');
      }
    } catch (e: any) {
      toast.error(`Target Selection Error: ${e.message}`);
      return;
    }
    
    await handleAction(async () => {
      await resolvePowerTarget(targetData);
      
      // Initiate client-side peek if applicable
      if ((powerType === 'Peek_Own' || powerType === 'Peek_Opponent') && peekTargetPlayerId && peekTargetPosition !== null && currentRound && currentPlayerId) {
         const peekedCard = currentRound.playerCards?.[peekTargetPlayerId]?.[peekTargetPosition];
         if (peekedCard) {
           logger.info('handleConfirmUsePower', 'Initiating client-side peek', { peekTargetPlayerId, peekTargetPosition, card: peekedCard, peekerId: currentPlayerId });
           // Set state with new structure
           setPeekedCardInfo({ 
             card: peekedCard, 
             targetPosition: peekTargetPosition, 
             targetPlayerId: peekTargetPlayerId, 
             peekerId: currentPlayerId // Store who initiated the peek
           });
           setIsPeekingActive(true);
           setTimeout(() => { setIsPeekingActive(false); }, 5000); 
         } else {
            logger.warn('handleConfirmUsePower', 'Could not find card data for peek', { peekTargetPlayerId, peekTargetPosition });
         }
      }
    });
  };

  // Power action helpers
  const handleSkipPower = async () => {
    if (!pendingPower && !activePower) {
      toast.error("No power to skip.");
      return;
    }
    await handleAction(() => skipPower());
  };

  const handleIgnorePower = async () => {
    if (!pendingPower) {
      toast.error('No power to ignore.');
      return;
    }
    await handleAction(() => ignorePendingPower());
    setSelectedCardPosition(null);
  };

  // Update the prop passed to GameBoard
  const powerTargetSelectionForBoard = useMemo(() => {
    if (!activePower || !activePower.card) return undefined;

    const powerType = determinePowerType(activePower.card);

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
  }, [activePower, powerTarget_OwnCardIndex, powerTarget_OpponentId, powerTarget_OpponentCardIndex]);

  // Logic to determine visible cards for the player during peek phase
  const visibleCardsForPlayer = useMemo(() => {
    if (!currentRound || !currentPlayerId) return [];
    
    // Check if the round is in Setup phase
    if (currentRound.phase === 'Setup') {
      // Rely on the local isInitialPeekPhase state to show cards during the countdown
      if (isInitialPeekPhase) {
        // Only show bottom two cards (2, 3) during initial peek
        return [2, 3] as CardPosition[];
      } else {
        // No cards visible before the peek button is clicked or after timeout
        return [] as CardPosition[];
      }
    }
    
    // Normal visibility from game state (filtering for own card positions)
    return (currentRound.visibleToPlayer[currentPlayerId] || []).filter((p): p is CardPosition => typeof p === 'number');
  }, [currentRound, currentPlayerId, isInitialPeekPhase]);

  // Validate round state
  if (!currentRound) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Error: Round state missing.</p>
      </div>
    );
  }

  // Determine if player can declare Scambodia
  const canDeclareScambodia = isMyTurn && !hasDrawnCardState && !currentRound.playerDeclaredScambodia && currentPhase === 'Playing';

  // Determine precisely when cards can be selected for primary actions (Match/Exchange)
  const canSelectCardForAction = isMyTurn && !activePower && !pendingPower;

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
  
  // Main game UI with our new components
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Game Status Header */}
      <div data-cy="scambodia-game-status" className="p-2 bg-white border-b border-gray-300 shadow-sm z-10">
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
      <div data-cy="scambodia-board" className="flex-grow overflow-auto bg-soft-lavender/20 p-4">
        <GameBoard
          gameState={gameState}
          currentUserId={currentPlayerId || ''}
          selectedCardPosition={selectedCardPosition}
          onCardClick={handleCardClick}
          canSelectCard={canSelectCardForAction}
          powerTargetSelection={powerTargetSelectionForBoard}
          visibleCardPositions={visibleCardsForPlayer}
          peekedCardInfo={peekedCardInfo}
          isPeekingActive={isPeekingActive}
        />
      </div>

      {/* Game Controls Footer */}
      <div data-cy="scambodia-controls" className="p-2 bg-white border-t border-gray-300">
         {/* Conditionally render controls based on game state */}
         
         {/* State: Setup Phase - Show Peek Button */}
         {currentPhase === 'Setup' && !isInitialPeekPhase && (
             <GameControls
                isMyTurn={true} // Assume controls are relevant during setup
                currentPhase={currentPhase}
                onInitialPeek={handleInitialPeek} // Pass the peek handler
                isInitialPeekPhase={false}
                // Provide defaults/empty handlers for other props to satisfy type
                selectedCardPosition={null}
                hasDrawnCard={false}
                drawnFromDiscard={false}
                isSubmitting={isSubmittingAction}
                onDrawFromDeck={() => {}}
                onDrawFromDiscard={() => {}}
                onExchangeCard={() => {}}
                onDiscardDrawnCard={() => {}}
                onAttemptMatch={() => {}}
                onDeclareScambodia={() => {}}
                canDeclareScambodia={false}
                disabled={isSubmittingAction}
             />
         )}
         {/* Display message during peek countdown */}
         {currentPhase === 'Setup' && isInitialPeekPhase && (
             <div className="flex justify-center">
                <div className="px-4 py-2 bg-green-100 text-green-800 rounded-lg">
                    Peeking at bottom cards... ({peekCountdown}s)
                </div>
             </div>
         )}
         
         {/* State: Waiting to Draw (Playing Phase) */}
         {currentPhase !== 'Setup' && isMyTurn && !hasDrawnCardState && !pendingPower && !activePower && (
             <GameControls 
                isMyTurn={true}
                hasDrawnCard={false}
                onDrawFromDeck={handleDrawFromDeck}
                onDrawFromDiscard={handleDrawFromDiscard}
                onDeclareScambodia={handleDeclareScambodia}
                canDeclareScambodia={canDeclareScambodia}
                isSubmitting={isSubmittingAction}
                disabled={isSubmittingAction}
                currentPhase={currentPhase || ''}
                selectedCardPosition={selectedCardPosition}
                onAttemptMatch={handleAttemptMatch}
                drawnFromDiscard={false}
                onRedeemPower={() => {}}
                onExchangeCard={() => {}}
                onDiscardDrawnCard={() => {}}
             />
         )}
         
         {/* State: Pending Power Decision (Drew 7-K from Deck) */}
         {currentPhase !== 'Setup' && isMyTurn && hasDrawnCardState && pendingPower && pendingPower.card && (
             <GameControls 
                 isMyTurn={true}
                 hasDrawnCard={true}
                 onRedeemPower={handleRedeemPower}
                 onExchangeCard={handleExchangeCard}
                 onDiscardDrawnCard={handleDiscardDrawnCard}
                 onAttemptMatch={handleAttemptMatch}
                 currentPhase={currentPhase || ''}
                 onDrawFromDeck={() => {}}
                 onDrawFromDiscard={() => {}}
                 onDeclareScambodia={handleDeclareScambodia}
                 canDeclareScambodia={false}
                 selectedCardPosition={selectedCardPosition}
                 drawnFromDiscard={false}
                 isSubmitting={isSubmittingAction}
                 disabled={isSubmittingAction}
             />
         )}
         
         {/* State: Standard Action Needed (Drew non-power card) */}
          {currentPhase !== 'Setup' && isMyTurn && hasDrawnCardState && !pendingPower && !activePower && (
             <GameControls 
                 isMyTurn={true}
                 hasDrawnCard={true}
                 onExchangeCard={handleExchangeCard}
                 onDiscardDrawnCard={handleDiscardDrawnCard}
                 onAttemptMatch={handleAttemptMatch}
                 currentPhase={currentPhase || ''}
                 onDrawFromDeck={() => {}}
                 onDrawFromDiscard={() => {}}
                 onDeclareScambodia={() => {}}
                 canDeclareScambodia={false}
                 onRedeemPower={() => {}}
                 selectedCardPosition={selectedCardPosition}
                 drawnFromDiscard={drawnCardSource === 'discard'}
                 isSubmitting={isSubmittingAction}
                 disabled={isSubmittingAction}
             />
         )}
         
         {/* State: Waiting for Opponent */}
         {currentPhase !== 'Setup' && !isMyTurn && (
              <div className="flex justify-center"><div className="px-4 py-2 bg-gray-100 text-gray-500 rounded-lg">Waiting for opponent's turn</div></div>
         )}
         
         {/* Note: No controls shown if activePower is true (resolving power) */}
         
      </div>

      {/* Special Power Panel */}
      {/* Show when actively resolving power and selecting target */}
      {isMyTurn && activePower && activePower.step === 'SelectingTarget' && (
        <SpecialPower
          specialCard={activePower.card} 
          isSubmitting={isSubmittingAction}
          onUseSpecialPower={handleConfirmUsePower} 
          onSkipSpecialPower={handleSkipPower} 
          onCancelSelection={() => { setPowerTarget_OwnCardIndex(null); setPowerTarget_OpponentId(null); setPowerTarget_OpponentCardIndex(null); toast('Target selection cleared.'); }}
          powerTarget_OwnCardIndex={powerTarget_OwnCardIndex}
          powerTarget_OpponentId={powerTarget_OpponentId}
          powerTarget_OpponentCardIndex={powerTarget_OpponentCardIndex}
          players={gameState?.players || []}
          currentUserId={currentPlayerId || ''}
        />
      )}
    </div>
  );
} 
import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { RangvaarGameState, Suit, TeamId } from '../types/rangvaar';
import { logger } from '../utils/logger';
import { useAuth } from '../context/AuthContext';
import {
  handlePlayerBid,
  handleTrumpSelection,
  dealRemainingCards,
  initializeNextRound,
  handlePlayCard,
  forceRoundEndDebug,
  processClientSideRangvaarPayout
} from '../services/rangvaarService';
import { toast } from 'react-hot-toast';

interface UseRangvaarGameReturn {
  gameState: RangvaarGameState | null;
  loading: boolean;
  error: string | null;
  // Action functions
  placeBid: (bidAmount: number | null) => Promise<void>;
  selectTrump: (suit: Suit) => Promise<void>;
  playCard: (cardId: string) => Promise<void>;
  // Debug functions
  declareRoundWinDebug: (winningTeamId: TeamId) => Promise<void>;
  logCurrentStateDebug: () => void;
}

export const useRangvaarGame = (gameId: string | undefined): UseRangvaarGameReturn => {
  const { currentUser } = useAuth();
  const [gameState, setGameState] = useState<RangvaarGameState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPerformingAction, setIsPerformingAction] = useState<boolean>(false);
  
  // Refs to prevent effect triggers on initial load or redundant calls
  const currentPhaseRef = useRef<string | null>(null);
  const hasTriggeredDealRef = useRef<boolean>(false);
  const hasTriggeredNextRoundRef = useRef<number>(0);
  const hasAttemptedPayoutRef = useRef<boolean>(false);

  // --- Firestore Listener Effect --- //
  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      setError('No Game ID provided to the hook.');
      setGameState(null);
      return () => {}; // Return empty cleanup
    }

    setLoading(true);
    setError(null);
    currentPhaseRef.current = null; // Reset phase ref on new game ID
    hasTriggeredDealRef.current = false;
    hasTriggeredNextRoundRef.current = 0;
    hasAttemptedPayoutRef.current = false;
    logger.info('useRangvaarGame', 'Setting up listener for game', { gameId });

    const gameDocRef = doc(db, 'rangvaarGames', gameId);
    const unsubscribe = onSnapshot(gameDocRef, 
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Omit<RangvaarGameState, 'gameId'>;
          setGameState({ ...data, gameId } as RangvaarGameState);
          setError(null);
          logger.debug('useRangvaarGame', 'Received game update', { gameId, phase: data.currentRoundState?.phase });
          // Update phase ref after state is set
          currentPhaseRef.current = data.currentRoundState?.phase || null;
        } else {
          logger.warn('useRangvaarGame', 'Game document not found', { gameId });
          setError('Game not found.');
          setGameState(null);
        }
        setLoading(false);
      },
      (err) => {
        logger.error('useRangvaarGame', 'Error listening to game document', { gameId, error: err });
        setError('Failed to sync game state. Please try refreshing.');
        setGameState(null);
        setLoading(false);
      }
    );
    return () => {
      logger.info('useRangvaarGame', 'Cleaning up game listener', { gameId });
      unsubscribe();
    };
  }, [gameId]);

  // --- Automatic Action Trigger Effects --- //
  
  // Trigger Deal Remaining Cards
  useEffect(() => {
    const phase = gameState?.currentRoundState?.phase;
    if (gameId && phase === 'DealingRest' && !hasTriggeredDealRef.current) {
      logger.info('useRangvaarGame', 'Detected phase change to DealingRest, attempting to deal remaining cards', { gameId });
      hasTriggeredDealRef.current = true; // Attempt only once per phase detection
      dealRemainingCards(gameId).catch(err => {
        logger.error('useRangvaarGame', 'Auto-trigger dealRemainingCards failed', { gameId, error: err });
        toast.error(`Error dealing cards: ${(err as Error).message}`);
        hasTriggeredDealRef.current = false; // Allow retry if needed?
      });
    }
    // Reset trigger flag if phase changes away from DealingRest
    if (phase !== 'DealingRest') {
       hasTriggeredDealRef.current = false; 
    }
  }, [gameState?.currentRoundState?.phase, gameId]);

  // Trigger Initialize Next Round
  useEffect(() => {
    const phase = gameState?.currentRoundState?.phase;
    const status = gameState?.status;
    const currentRound = gameState?.currentRoundNumber;
    // STRICT CHECK: Ensure game is actually playing AND round phase is ended
    if (gameId && status === 'Playing' && phase === 'RoundEnded' && currentRound && hasTriggeredNextRoundRef.current < currentRound) {
      logger.info('useRangvaarGame', 'Detected phase change to RoundEnded, attempting to initialize next round', { gameId, currentRound, status });
      hasTriggeredNextRoundRef.current = currentRound; // Mark this round end as processed
      initializeNextRound(gameId).catch(err => {
        logger.error('useRangvaarGame', 'Auto-trigger initializeNextRound failed', { gameId, error: err });
        toast.error(`Error starting next round: ${(err as Error).message}`);
      });
    }
  }, [gameState?.currentRoundState?.phase, gameState?.status, gameState?.currentRoundNumber, gameId]);

  // --- Payout Trigger Effect --- //
  useEffect(() => {
    // Ensure we have the final game state and it's actually finished
    if (gameId && gameState && gameState.status === 'Finished') {
      // Check if payout hasn't been PROCESSED IN FIRESTORE yet AND we haven't ATTEMPTED it from this client yet
      if (!gameState.payoutProcessed && !hasAttemptedPayoutRef.current) {
        logger.info('useRangvaarGame', 'Detected game finished, attempting client-side payout (first attempt this session)', { gameId });
        hasAttemptedPayoutRef.current = true; // Mark that we are attempting the payout now
        
        processClientSideRangvaarPayout(gameId, gameState)
          .then(() => {
            logger.info('useRangvaarGame', 'Client-side payout function called successfully (transaction may still be processing/failed).', { gameId });
            // No need to reset hasAttemptedPayoutRef here, we only try once per game finish detection
          })
          .catch(err => {
            logger.error('useRangvaarGame', 'Error calling client-side payout function', { gameId, error: err });
            toast.error(`Error initiating payout: ${(err as Error).message}`);
            // If the call itself fails, allow a retry on next effect trigger? Maybe not desirable.
            // For now, we still keep hasAttemptedPayoutRef true.
          });
      } else if (gameState.payoutProcessed) {
        logger.info('useRangvaarGame', 'Detected game finished, and payout is already processed in Firestore.', { gameId });
        hasAttemptedPayoutRef.current = true; // Ensure flag is set if we load a game already processed
      } else if (hasAttemptedPayoutRef.current) {
        logger.info('useRangvaarGame', 'Detected game finished, payout not processed, but already attempted payout from this client.', { gameId });
      }
    }
  // Depend specifically on gameId, status, and payoutProcessed flag
  }, [gameId, gameState?.status, gameState?.payoutProcessed]);

  // --- Action Functions --- //

  const performAction = useCallback(async (actionName: string, actionFn: () => Promise<void>) => {
    if (!currentUser || !gameId || isPerformingAction) {
      logger.warn('useRangvaarGame', `Action ${actionName} prevented`, { hasUser: !!currentUser, gameId, isPerformingAction });
      return; // Prevent action if no user, no gameId, or already busy
    }
    setIsPerformingAction(true);
    try {
      await actionFn();
    } catch (err) {
      const error = err as Error;
      logger.error('useRangvaarGame', `Action ${actionName} failed`, { gameId, userId: currentUser.uid, error: error.message });
      toast.error(error.message || `Failed to perform action: ${actionName}`);
      // Rethrow maybe? Or handle specific errors?
    } finally {
      setIsPerformingAction(false);
    }
  }, [currentUser, gameId, isPerformingAction]); // Dependencies for the wrapper

  const placeBid = useCallback(async (bidAmount: number | null) => {
    await performAction('placeBid', () => handlePlayerBid(gameId!, currentUser!.uid, bidAmount));
  }, [performAction, gameId, currentUser]); // gameId/currentUser included for performAction deps

  const selectTrump = useCallback(async (suit: Suit) => {
    await performAction('selectTrump', () => handleTrumpSelection(gameId!, currentUser!.uid, suit));
  }, [performAction, gameId, currentUser]);

  const playCard = useCallback(async (cardId: string) => {
    await performAction('playCard', () => handlePlayCard(gameId!, currentUser!.uid, cardId));
  }, [performAction, gameId, currentUser]);

  // --- Debug Functions --- //
  const declareRoundWinDebug = useCallback(async (winningTeamId: TeamId) => {
    // No need to use performAction wrapper for debug usually, but can add if desired
    if (!gameId) return;
    logger.warn('useRangvaarGame', '[DEBUG] Manually declaring round win', { gameId, winningTeamId });
    setIsPerformingAction(true); // Reuse submitting state for feedback
    try {
        await forceRoundEndDebug(gameId, winningTeamId);
        toast.success(`[DEBUG] Round win declared for Team ${winningTeamId}`);
    } catch(err) {
        toast.error(`[DEBUG] Error declaring win: ${(err as Error).message}`);
    } finally {
        setIsPerformingAction(false);
    }
  }, [gameId]); // Depends only on gameId

  const logCurrentStateDebug = useCallback(() => {
      logger.info('logCurrentStateDebug', 'Current Game State:', { gameState });
      console.log('[DEBUG] Current Game State:', gameState);
      toast('Logged current game state to console.');
  }, [gameState]);

  return {
    gameState,
    loading,
    error,
    placeBid,
    selectTrump,
    playCard,
    declareRoundWinDebug,
    logCurrentStateDebug,
  };
}; 
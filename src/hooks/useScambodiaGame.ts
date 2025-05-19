import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { 
  ScambodiaGameState, 
  UseScambodiaGameReturn, 
  CardPosition, 
  CardPowerType,
  RoundState,
  Card
} from '../types/scambodia';
import {
  drawCard as drawCardService,
  exchangeCard as exchangeCardService,
  discardDrawnCard as discardDrawnCardService,
  attemptMatch as attemptMatchService,
  declareScambodia as declareScambodiaService,
  usePower as usePowerService,
  forceGameEndDebug as forceGameEndDebugService,
  forceRoundEndDebug as forceRoundEndDebugService,
  triggerScoreCalculation as triggerScoreCalculationService,
  transitionScambodiaRound as transitionScambodiaRoundService,
  forceScoreRoundDebug as forceScoreRoundDebugService,
  initiatePower as initiatePowerService,
  resolvePowerTarget as resolvePowerTargetService,
  skipPower as skipPowerService,
  ignorePendingPower as ignorePendingPowerService,
} from '../services/scambodiaService';

/**
 * Custom hook for Scambodia game state management and interactions.
 * Incorporates lessons learned from Rangvaar regarding authentication, state management, and error handling.
 * 
 * @param gameId The ID of the Scambodia game to manage
 * @returns An object with game state and functions to interact with the game
 */
export const useScambodiaGame = (gameId: string | undefined): UseScambodiaGameReturn => {
  // --- State Management ---
  const [gameState, setGameState] = useState<ScambodiaGameState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPerformingAction, setIsPerformingAction] = useState<boolean>(false);
  const [drawnCard, setDrawnCard] = useState<Card | null>(null);
  
  // --- Authentication ---
  const { currentUser } = useAuth();
  
  // --- Action Refs to Prevent Duplicates ---
  const hasAttemptedPayoutRef = useRef<boolean>(false); // Track if payout was attempted
  const hasTriggeredNextRoundRef = useRef<number>(0); // Track round transitions by number
  const lastTokenRefreshRef = useRef<number>(0); // Track last token refresh time
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null); // For reconnection

  // --- Cloud Functions ---
  const functions = getFunctions(undefined, 'us-central1'); // Explicitly specify region
  const processScambodiaPayoutFn = httpsCallable(functions, 'processScambodiaPayout');
  const transitionScambodiaRoundFn = httpsCallable(functions, 'transitionScambodiaRound');

  // --- Token Refresh Function ---
  // Ensures authentication token is fresh before performing sensitive operations
  const refreshTokenIfNeeded = useCallback(async (): Promise<boolean> => {
    if (!currentUser) return false;
    
    const now = Date.now();
    const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
    
    if (now - lastTokenRefreshRef.current > REFRESH_INTERVAL) {
      try {
        logger.info('useScambodiaGame', 'Refreshing authentication token', { userId: currentUser.uid });
        await currentUser.getIdToken(true);
        lastTokenRefreshRef.current = now;
        return true;
      } catch (err) {
        logger.error('useScambodiaGame', 'Error refreshing token', { error: err });
        return false;
      }
    }
    return true;
  }, [currentUser]);

  // --- Firestore Listener with Reconnection Logic ---
  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    logger.info('useScambodiaGame', 'Setting up Firestore listener', { gameId });
    
    // Reset refs on new game connection
    hasAttemptedPayoutRef.current = false;
    hasTriggeredNextRoundRef.current = 0;
    
    // Clear any existing reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const setupListener = () => {
      const gameDocRef = doc(db, 'scambodiaGames', gameId);
      return onSnapshot(
        gameDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as ScambodiaGameState;
            setGameState({ ...data, gameId: snapshot.id });
            
            // Clear error state on successful update
            if (error) setError(null);
            
            logger.info('useScambodiaGame', 'Game state updated', { 
              gameId, 
              status: data.status, 
              currentRound: data.currentRoundNumber 
            });
          } else {
            setError('Game not found');
            logger.error('useScambodiaGame', 'Game not found', { gameId });
          }
          setLoading(false);
        },
        (err) => {
          setError(`Error loading game: ${err.message}`);
          setLoading(false);
          logger.error('useScambodiaGame', 'Error in Firestore listener', { gameId, error: err });
          
          // Set up reconnection attempt
          reconnectTimeoutRef.current = setTimeout(() => {
            logger.info('useScambodiaGame', 'Attempting to reconnect', { gameId });
            setupListener();
          }, 5000); // Retry after 5 seconds
        }
      );
    };

    const unsubscribe = setupListener();

    // Cleanup listener on unmount
    return () => {
      logger.info('useScambodiaGame', 'Cleaning up Firestore listener', { gameId });
      unsubscribe();
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [gameId, error]);

  // Keep track of rounds for which scoring/transition has been triggered
  const scoringTriggeredRef = useRef<Set<number>>(new Set());
  const transitionTriggeredRef = useRef<Set<number>>(new Set());

  // --- Score Calculation Trigger Effect ---
  useEffect(() => {
    if (!gameId || !gameState || !currentUser) return;
    
    const currentRoundNumber = gameState.currentRoundNumber;
    const currentRoundState = gameState.rounds[currentRoundNumber];
    
    // Check if round is in Scoring phase and scoring hasn't been triggered yet for this round
    if (
      gameState.status === 'Playing' && 
      currentRoundState?.phase === 'Scoring' && 
      !scoringTriggeredRef.current.has(currentRoundNumber) // Check ref
    ) {
      logger.info('useScambodiaGame (Scoring Effect)', 'Detected Scoring phase, triggering calculation', { 
        gameId, 
        currentRoundNumber 
      });
      
      // Mark scoring as triggered for this round
      scoringTriggeredRef.current.add(currentRoundNumber);
      
      // Refresh token and call Cloud Function
      refreshTokenIfNeeded().then(success => {
        if (!success) {
          logger.error('useScambodiaGame (Scoring Effect)', 'Score calculation aborted: Failed to refresh token', { gameId });
          // Optionally reset ref if needed: scoringTriggeredRef.current.delete(currentRoundNumber);
          return;
        }
        
        triggerScoreCalculationService(gameId, currentRoundNumber)
          .then(() => {
            logger.info('useScambodiaGame (Scoring Effect)', 'Score calculation triggered successfully', { gameId, currentRoundNumber });
            // State update will eventually change phase to 'RoundComplete' triggering the next effect
          })
          .catch((err: any) => {
            logger.error('useScambodiaGame (Scoring Effect)', 'Error triggering score calculation', { 
              gameId, 
              currentRoundNumber, 
              error: err 
            });
            toast.error('Error calculating round scores.');
            // Optionally reset ref on error: scoringTriggeredRef.current.delete(currentRoundNumber);
          });
      });
    }
  }, [gameId, gameState, currentUser, refreshTokenIfNeeded, triggerScoreCalculationService]); // Add dependency

  // --- Round Transition Effect (Now triggered by RoundComplete) ---
  useEffect(() => {
    if (!gameId || !gameState || !currentUser) return;
    
    const currentRoundNumber = gameState.currentRoundNumber;
    const currentRoundState = gameState.rounds[currentRoundNumber];
    
    // Check for round in RoundComplete phase that needs transition
    if (
      gameState.status === 'Playing' && // Game must still be technically 'Playing' until finish or next round starts
      currentRoundState?.phase === 'Complete' && // Corrected from 'RoundComplete' to 'Complete'
      !transitionTriggeredRef.current.has(currentRoundNumber) // Check ref
    ) {
      logger.info('useScambodiaGame (Transition Effect)', 'Detected Complete phase, triggering transition', { 
        gameId, 
        currentRoundNumber 
      });
      
      // Mark this round transition as triggered
      transitionTriggeredRef.current.add(currentRoundNumber);
      
      // Refresh token and call Cloud Function
      refreshTokenIfNeeded().then(success => {
        if (!success) {
          logger.error('useScambodiaGame (Transition Effect)', 'Round transition aborted: Failed to refresh token', { gameId });
          // Optionally reset ref: transitionTriggeredRef.current.delete(currentRoundNumber);
          return;
        }
        
        // Call Cloud Function to handle transition
        transitionScambodiaRoundService({ gameId, currentRoundNumber })
          .then(() => {
            logger.info('useScambodiaGame (Transition Effect)', 'Round transition initiated successfully', { gameId, currentRoundNumber });
             // Clear the scoring triggered flag for the *next* potential round if needed, though refs reset on unmount
             // scoringTriggeredRef.current.delete(currentRoundNumber + 1); // Or handle differently
          })
          .catch((err: any) => { 
            logger.error('useScambodiaGame (Transition Effect)', 'Error triggering round transition', { 
              gameId, 
              currentRoundNumber, 
              error: err 
            });
            toast.error('Error transitioning to next round/ending game.');
            // Optionally reset ref on error: transitionTriggeredRef.current.delete(currentRoundNumber);
          });
      });
    }
  }, [gameId, gameState, currentUser, refreshTokenIfNeeded, transitionScambodiaRoundService]);

  // --- Payout Trigger Effect ---
  useEffect(() => {
    if (!gameId || !gameState || !currentUser) return;
    
    // Only attempt payout if game is finished, not yet processed, and we haven't tried yet
    if (
      gameState.status === 'Finished' && 
      !gameState.payoutProcessed && 
      !hasAttemptedPayoutRef.current
    ) {
      logger.info('useScambodiaGame', 'Detected finished game, attempting payout', { gameId });
      
      // Mark that we're attempting payout now (before async operations)
      hasAttemptedPayoutRef.current = true;
      
      const triggerPayout = async () => {
        try {
          // Force token refresh to ensure authentication is fresh
          const refreshSuccess = await refreshTokenIfNeeded();
          if (!refreshSuccess) {
            logger.error('useScambodiaGame', 'Payout aborted: Failed to refresh token', { gameId });
            toast.error('Authentication issue. Please try refreshing the page.');
            return;
          }
          
          // Call payout function
          logger.info('useScambodiaGame', 'Calling payout Cloud Function', { gameId });
          await processScambodiaPayoutFn({ gameId });
          
          logger.info('useScambodiaGame', 'Payout processing initiated successfully', { gameId });
          toast.success('Payout processing initiated');
        } catch (err: any) {
          logger.error('useScambodiaGame', 'Error triggering payout', { gameId, error: err });
          toast.error('Unable to process payout. Please contact support.');
          // Keep hasAttemptedPayoutRef true to prevent immediate retries
        }
      };
      
      triggerPayout();
    }
  }, [gameId, gameState, currentUser, refreshTokenIfNeeded, processScambodiaPayoutFn]);

  // --- Action Wrapper Function ---
  const performAction = useCallback(async (
    actionName: string, 
    actionFn: () => Promise<any>
  ) => {
    if (!currentUser || !gameId) {
      const errorMsg = !currentUser 
        ? 'You must be logged in to perform this action' 
        : 'Game ID is missing';
      logger.warn('useScambodiaGame', `Action ${actionName} prevented: ${errorMsg}`, { 
        hasUser: !!currentUser, 
        gameId
      });
      toast.error(errorMsg);
      return null;
    }
    
    if (isPerformingAction) {
      logger.warn('useScambodiaGame', `Action ${actionName} prevented: Another action in progress`);
      return null;
    }
    
    setIsPerformingAction(true);
    
    try {
      // Refresh token before every action
      const tokenRefreshed = await refreshTokenIfNeeded();
      if (!tokenRefreshed) {
        throw new Error('Failed to refresh authentication. Please try again.');
      }
      
      // Execute the action
      const result = await actionFn();
      return result;
    } catch (err) {
      const error = err as Error;
      logger.error('useScambodiaGame', `Action ${actionName} failed`, { 
        gameId, 
        userId: currentUser.uid, 
        error: error.message 
      });
      toast.error(error.message || `Failed to perform action: ${actionName}`);
      return null;
    } finally {
      setIsPerformingAction(false);
    }
  }, [currentUser, gameId, isPerformingAction, refreshTokenIfNeeded]);

  // --- Game Actions ---
  
  const drawCard = useCallback(async (source: 'deck' | 'discard') => {
    const card = await performAction('drawCard', async () => {
      const result = await drawCardService(gameId!, currentUser!.uid, source);
      // Store drawn card in local state to keep track of it
      if (result) setDrawnCard(result);
      return result;
    });
    return card;
  }, [performAction, gameId, currentUser]);

  const exchangeCard = useCallback(async (cardPosition: CardPosition) => {
    await performAction('exchangeCard', async () => {
      await exchangeCardService(gameId!, currentUser!.uid, cardPosition);
      // Clear drawn card after exchange
      setDrawnCard(null);
    });
  }, [performAction, gameId, currentUser]);

  const discardDrawnCard = useCallback(async () => {
    const card = await performAction('discardDrawnCard', async () => {
      const result = await discardDrawnCardService(gameId!, currentUser!.uid);
      // Clear drawn card after discard
      setDrawnCard(null);
      return result;
    });
    return card;
  }, [performAction, gameId, currentUser]);

  const attemptMatch = useCallback(async (cardPosition: CardPosition) => {
    const matchSuccess = await performAction('attemptMatch', async () => {
      const success = await attemptMatchService(gameId!, currentUser!.uid, cardPosition);
      // Clear drawn card after match attempt
      setDrawnCard(null);
      return success;
    });
    return matchSuccess;
  }, [performAction, gameId, currentUser]);

  const declareScambodia = useCallback(async () => {
    await performAction('declareScambodia', async () => {
      await declareScambodiaService(gameId!, currentUser!.uid);
    });
  }, [performAction, gameId, currentUser]);

  // NEW Callbacks for the refined power flow
  const initiatePower = useCallback(async (powerType: CardPowerType) => {
    return await performAction('initiatePower', async () => {
      if (!gameId) throw new Error('Game ID missing');
      await initiatePowerService(gameId, powerType);
      // Client UI state (like showing targeting) will update via Firestore listener
    });
  }, [performAction, gameId]);

  const resolvePowerTarget = useCallback(async (targetData: any) => {
    return await performAction('resolvePowerTarget', async () => {
      if (!gameId) throw new Error('Game ID missing');
      await resolvePowerTargetService(gameId, targetData);
      // Server handles effect, discard, and turn advancement
    });
  }, [performAction, gameId]);

  const skipPower = useCallback(async () => {
    // This is now intended to be called ONLY when actively selecting targets 
    // (i.e., after initiatePower was called)
    if (!gameState?.rounds[gameState.currentRoundNumber]?.activePowerResolution) {
        toast.error("No active power resolution to skip/cancel.");
        return;
    }
    await performAction('skipPower', async () => {
      if (!gameId) throw new Error('Game ID missing');
      await skipPowerService(gameId);
      // Server handles discard and turn advancement
    });
  }, [performAction, gameId, gameState]);

  const ignorePendingPower = useCallback(async () => {
    return await performAction('ignorePendingPower', async () => {
      if (!gameId) throw new Error('Game ID missing');
      await ignorePendingPowerService(gameId, currentUser!.uid);
    });
  }, [performAction, gameId, currentUser]);

  // --- Debug Function ---
  const logGameState = useCallback(() => {
    logger.info('logGameState', 'Current Game State:', { gameState, drawnCard });
    console.log('[DEBUG] Current Game State:', gameState);
    console.log('[DEBUG] Current Drawn Card:', drawnCard);
    toast('Logged current game state to console.');
  }, [gameState, drawnCard]);

  const forceGameEnd = useCallback(async (winningPlayerId: string) => {
    await performAction('forceGameEndDebug', async () => {
      await forceGameEndDebugService(gameId!, winningPlayerId);
    });
  }, [performAction, gameId]);

  const forceScoreRound = useCallback(async (winningPlayerId: string) => {
    if (!gameState) return;
    await performAction('forceScoreRoundDebug', async () => {
      await forceScoreRoundDebugService(gameId!, winningPlayerId, gameState.currentRoundNumber);
    });
  }, [performAction, gameId, gameState]);

  return {
    gameState,
    loading,
    error,
    drawCard,
    exchangeCard,
    discardDrawnCard,
    attemptMatch,
    declareScambodia,
    // Add new power functions
    initiatePower,
    resolvePowerTarget,
    skipPower,
    ignorePendingPower,
    logGameState,
    drawnCard, // Expose drawnCard to the component
    forceGameEnd,
    forceScoreRound,
  };
}; 
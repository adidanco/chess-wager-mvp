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
  endTurn as endTurnService
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

  // --- Round Transition Effect ---
  useEffect(() => {
    if (!gameId || !gameState || !currentUser) return;
    
    const currentRound = gameState.currentRoundNumber;
    const currentRoundState = gameState.rounds[currentRound];
    
    // Check for round in Scoring phase that needs transition
    if (
      gameState.status === 'Playing' && 
      currentRoundState?.phase === 'Scoring' && 
      hasTriggeredNextRoundRef.current < currentRound
    ) {
      logger.info('useScambodiaGame', 'Detected scoring phase, triggering round transition', { 
        gameId, 
        currentRound 
      });
      
      // Mark this round transition as triggered
      hasTriggeredNextRoundRef.current = currentRound;
      
      // Refresh token before calling Cloud Function
      refreshTokenIfNeeded().then(success => {
        if (!success) {
          logger.error('useScambodiaGame', 'Round transition aborted: Failed to refresh token', { gameId });
          return;
        }
        
        // Call Cloud Function to handle transition
        transitionScambodiaRoundFn({ gameId, currentRoundNumber: currentRound })
          .then(() => {
            logger.info('useScambodiaGame', 'Round transition initiated successfully', { gameId, currentRound });
          })
          .catch((err) => {
            logger.error('useScambodiaGame', 'Error triggering round transition', { 
              gameId, 
              currentRound, 
              error: err 
            });
            toast.error('Error transitioning to next round. Please try refreshing the page.');
          });
      });
    }
  }, [gameId, gameState, currentUser, refreshTokenIfNeeded, transitionScambodiaRoundFn]);

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

  const usePower = useCallback(async (powerType: CardPowerType, params: any) => {
    await performAction('usePower', async () => {
      await usePowerService(gameId!, currentUser!.uid, powerType, params);
    });
  }, [performAction, gameId, currentUser]);

  const endTurn = useCallback(async () => {
    await performAction('endTurn', async () => {
      await endTurnService(gameId!, currentUser!.uid);
      // Optionally clear drawn card state here if applicable after ending turn
      // setDrawnCard(null); 
    });
  }, [performAction, gameId, currentUser]);

  // --- Debug Function ---
  const logGameState = useCallback(() => {
    logger.info('logGameState', 'Current Game State:', { gameState, drawnCard });
    console.log('[DEBUG] Current Game State:', gameState);
    console.log('[DEBUG] Current Drawn Card:', drawnCard);
    toast('Logged current game state to console.');
  }, [gameState, drawnCard]);

  return {
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
    logGameState,
    drawnCard // Expose drawnCard to the component
  };
}; 
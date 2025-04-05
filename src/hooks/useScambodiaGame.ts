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
  RoundState
} from '../types/scambodia';
import {
  drawCard as drawCardService,
  exchangeCard as exchangeCardService,
  discardDrawnCard as discardDrawnCardService,
  attemptMatch as attemptMatchService,
  declareScambodia as declareScambodiaService,
  usePower as usePowerService
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
  
  // --- Authentication ---
  const { currentUser } = useAuth();
  
  // --- Action Refs to Prevent Duplicates ---
  const hasAttemptedPayoutRef = useRef<boolean>(false); // Track if payout was attempted
  const hasTriggeredNextRoundRef = useRef<number>(0); // Track round transitions by number
  const drawnCardRef = useRef<any>(null); // Track the currently drawn card

  // --- Cloud Functions ---
  const functions = getFunctions(undefined, 'us-central1'); // Explicitly specify region
  const processScambodiaPayoutFn = httpsCallable(functions, 'processScambodiaPayout');
  const transitionScambodiaRoundFn = httpsCallable(functions, 'transitionScambodiaRound');

  // --- Firestore Listener ---
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
    drawnCardRef.current = null;

    const gameDocRef = doc(db, 'scambodiaGames', gameId);
    const unsubscribe = onSnapshot(
      gameDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as ScambodiaGameState;
          setGameState({ ...data, gameId: snapshot.id });
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
      }
    );

    // Cleanup listener on unmount
    return () => {
      logger.info('useScambodiaGame', 'Cleaning up Firestore listener', { gameId });
      unsubscribe();
    };
  }, [gameId]);

  // --- Round Transition Effect ---
  useEffect(() => {
    if (!gameId || !gameState) return;
    
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
      
      // Check auth before calling Cloud Function
      if (!currentUser) {
        logger.error('useScambodiaGame', 'Round transition aborted: No authenticated user', { gameId });
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
    }
  }, [gameId, gameState, currentUser, transitionScambodiaRoundFn]);

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
          logger.info('useScambodiaGame', 'Forcing ID token refresh before payout', { gameId });
          await currentUser.getIdToken(true);
          
          // Call payout function
          logger.info('useScambodiaGame', 'Calling payout Cloud Function', { gameId });
          await processScambodiaPayoutFn({ gameId });
          
          logger.info('useScambodiaGame', 'Payout processing initiated successfully', { gameId });
          // Optional: toast.success('Payout processing initiated');
        } catch (err: any) {
          logger.error('useScambodiaGame', 'Error triggering payout', { gameId, error: err });
          toast.error('Sorry, unable to process payout for this game, we are fixing the bug soonest!');
          // Keep hasAttemptedPayoutRef true to prevent immediate retries
        }
      };
      
      triggerPayout();
    }
  }, [gameId, gameState, currentUser, processScambodiaPayoutFn]);

  // --- Action Wrapper Function ---
  const performAction = useCallback(async (
    actionName: string, 
    actionFn: () => Promise<void>
  ) => {
    if (!currentUser || !gameId || isPerformingAction) {
      logger.warn('useScambodiaGame', `Action ${actionName} prevented`, { 
        hasUser: !!currentUser, 
        gameId, 
        isPerformingAction 
      });
      return;
    }
    
    setIsPerformingAction(true);
    try {
      await actionFn();
    } catch (err) {
      const error = err as Error;
      logger.error('useScambodiaGame', `Action ${actionName} failed`, { 
        gameId, 
        userId: currentUser.uid, 
        error: error.message 
      });
      toast.error(error.message || `Failed to perform action: ${actionName}`);
    } finally {
      setIsPerformingAction(false);
    }
  }, [currentUser, gameId, isPerformingAction]);

  // --- Game Actions ---
  
  const drawCard = useCallback(async (source: 'deck' | 'discard') => {
    await performAction('drawCard', () => drawCardService(gameId!, currentUser!.uid, source));
  }, [performAction, gameId, currentUser]);

  const exchangeCard = useCallback(async (cardPosition: CardPosition) => {
    await performAction('exchangeCard', () => exchangeCardService(gameId!, currentUser!.uid, cardPosition));
  }, [performAction, gameId, currentUser]);

  const discardDrawnCard = useCallback(async () => {
    await performAction('discardDrawnCard', () => discardDrawnCardService(gameId!, currentUser!.uid));
  }, [performAction, gameId, currentUser]);

  const attemptMatch = useCallback(async (cardPosition: CardPosition) => {
    await performAction('attemptMatch', () => attemptMatchService(gameId!, currentUser!.uid, cardPosition));
  }, [performAction, gameId, currentUser]);

  const declareScambodia = useCallback(async () => {
    await performAction('declareScambodia', () => declareScambodiaService(gameId!, currentUser!.uid));
  }, [performAction, gameId, currentUser]);

  const usePower = useCallback(async (powerType: CardPowerType, params: any) => {
    await performAction('usePower', () => usePowerService(gameId!, currentUser!.uid, powerType, params));
  }, [performAction, gameId, currentUser]);

  const endTurn = useCallback(async () => {
    // Implementation would go here - typically advancing to the next player
    toast.error('Not implemented yet');
  }, []);

  // --- Debug Function ---
  const logGameState = useCallback(() => {
    logger.info('logGameState', 'Current Game State:', { gameState });
    console.log('[DEBUG] Current Game State:', gameState);
    toast('Logged current game state to console.');
  }, [gameState]);

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
  };
}; 
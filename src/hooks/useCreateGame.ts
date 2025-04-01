import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Chess } from "chess.js";
import { collection, addDoc, serverTimestamp, DocumentReference } from "firebase/firestore";
import { db } from "../firebase";
import { DEFAULT_TIMER, GAME_STATUS, TIMER_OPTIONS, TimeOption } from "../utils/constants";
import toast from "react-hot-toast";
import { logger } from "../utils/logger";
import { useAuth } from "../context/AuthContext";
import { GameData } from "chessTypes";

/**
 * Interface for the values returned by the useCreateGame hook
 */
interface CreateGameHook {
  wager: string;
  setWager: (wager: string) => void;
  timeOption: TimeOption;
  setTimeOption: (option: TimeOption) => void;
  isCreating: boolean;
  userBalance: number;
  isLoading: boolean;
  handleCreateGame: (e: FormEvent) => Promise<void>;
  cancelCreation: () => void;
}

/**
 * Custom hook to manage game creation logic
 */
const useCreateGame = (): CreateGameHook => {
  const [wager, setWager] = useState<string>("");
  const [timeOption, setTimeOption] = useState<TimeOption>("FIVE_MIN");
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const navigate = useNavigate();
  const { currentUser, balance, updateBalance, isAuthenticated } = useAuth();

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated) {
      logger.warn('useCreateGame', 'User not authenticated, redirecting to login');
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  /**
   * Handle game creation form submission
   */
  const handleCreateGame = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    
    if (!currentUser) {
      toast.error("You must be logged in to create a game");
      navigate("/login");
      return;
    }
    
    // Validate wager
    const wagerAmount = Number(wager);
    if (isNaN(wagerAmount) || wagerAmount <= 0) {
      toast.error("Please enter a valid wager amount");
      return;
    }
    
    // Check balance
    if (wagerAmount > balance) {
      toast.error("Insufficient balance!");
      return;
    }
    
    setIsCreating(true);
    
    try {
      logger.info('useCreateGame', 'Creating new game', { 
        userId: currentUser.uid,
        wager: wagerAmount,
        timeControl: timeOption
      });
      
      // Initialize a new chess instance for the initial FEN
      const chess = new Chess();
      const initialFen = chess.fen();
      
      // Get time control value in milliseconds
      const timeControl = TIMER_OPTIONS[timeOption];
      
      // Create the game in Firestore
      const newGame: Partial<GameData> = {
        whitePlayer: currentUser.uid,
        blackPlayer: null,
        wager: wagerAmount,
        status: GAME_STATUS.WAITING,
        createdAt: serverTimestamp(),
        fen: initialFen,
        currentTurn: "w",
        whiteTime: timeControl,
        blackTime: timeControl,
        timeControl: timeControl,
        moveHistory: []
      };
      
      const gameRef = await addDoc(collection(db, "games"), newGame);
      
      logger.info('useCreateGame', 'Game created successfully', { 
        gameId: gameRef.id,
        userId: currentUser.uid,
        timeControl: timeOption
      });
      
      // Deduct wager from user's balance
      await updateBalance(-wagerAmount, "game creation");
      
      toast.success("Game created! Waiting for opponent...");
      navigate(`/game/${gameRef.id}`);
    } catch (error) {
      const err = error as Error;
      logger.error('useCreateGame', 'Error creating game', { 
        error: err, 
        userId: currentUser?.uid 
      });
      toast.error("Error creating game!");
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Cancel game creation and navigate back
   */
  const cancelCreation = (): void => {
    logger.debug('useCreateGame', 'Cancelling game creation');
    navigate("/");
  };

  return {
    wager,
    setWager,
    timeOption,
    setTimeOption,
    isCreating,
    userBalance: balance,
    isLoading,
    handleCreateGame,
    cancelCreation
  };
};

export default useCreateGame; 
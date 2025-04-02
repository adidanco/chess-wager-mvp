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
import { setGameWagerType } from "../services/wagerService";

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
  useRealMoney: boolean;
  setUseRealMoney: (useRealMoney: boolean) => void;
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
  const [useRealMoney, setUseRealMoney] = useState<boolean>(false);
  
  const navigate = useNavigate();
  const { 
    currentUser, 
    balance, 
    realMoneyBalance,
    updateBalance,
    updateProfile,
    isAuthenticated 
  } = useAuth();

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
    
    // Check balance based on wager type
    const availableBalance = useRealMoney ? realMoneyBalance : balance;
    if (wagerAmount > (availableBalance || 0)) {
      toast.error(`Insufficient ${useRealMoney ? 'real money' : 'game currency'} balance!`);
      return;
    }
    
    setIsCreating(true);
    
    try {
      logger.info('useCreateGame', 'Creating new game', { 
        userId: currentUser.uid,
        wager: wagerAmount,
        timeControl: timeOption,
        useRealMoney
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
        player1Id: currentUser.uid, // Game creator ID
        player2Id: undefined, // Will be set when someone joins
        wager: wagerAmount,
        status: GAME_STATUS.WAITING,
        createdAt: serverTimestamp(),
        fen: initialFen,
        currentTurn: "w",
        whiteTime: timeControl,
        blackTime: timeControl,
        timeControl: timeControl,
        moveHistory: [],
        useRealMoney, // Add flag for real money games
        wagersDebited: false, // Will be set to true when wagers are debited
        payoutProcessed: false // Will be set to true when payout is processed
      };
      
      const gameRef = await addDoc(collection(db, "games"), newGame);
      
      logger.info('useCreateGame', 'Game created successfully', { 
        gameId: gameRef.id,
        userId: currentUser.uid,
        timeControl: timeOption,
        useRealMoney
      });
      
      // Set the game's wager type (real money or game currency)
      await setGameWagerType(gameRef.id, useRealMoney);
      
      // For game currency, we'll deduct the amount immediately
      // For real money, this will be handled when the game starts
      if (!useRealMoney) {
        // Deduct wager from user's balance
        await updateBalance(-wagerAmount, "game creation");
      }
      
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
    useRealMoney,
    setUseRealMoney,
    handleCreateGame,
    cancelCreation
  };
};

export default useCreateGame; 
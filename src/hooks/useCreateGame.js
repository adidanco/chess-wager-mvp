import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Chess } from "chess.js";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { DEFAULT_TIMER } from "../utils/constants";
import toast from "react-hot-toast";
import { logger } from "../utils/logger";
import { useAuth } from "../context/AuthContext";

/**
 * Custom hook to manage game creation logic
 */
const useCreateGame = () => {
  const [wager, setWager] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
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
  const handleCreateGame = async (e) => {
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
        wager: wagerAmount 
      });
      
      // Initialize a new chess instance for the initial FEN
      const chess = new Chess();
      const initialFen = chess.fen();
      
      // Create the game in Firestore
      const gameRef = await addDoc(collection(db, "games"), {
        whitePlayer: currentUser.uid,
        blackPlayer: null,
        wager: wagerAmount,
        status: "waiting",
        createdAt: serverTimestamp(),
        fen: initialFen,
        currentTurn: "w",
        whiteTime: DEFAULT_TIMER,
        blackTime: DEFAULT_TIMER,
        moveHistory: []
      });
      
      logger.info('useCreateGame', 'Game created successfully', { 
        gameId: gameRef.id,
        userId: currentUser.uid 
      });
      
      // Deduct wager from user's balance
      await updateBalance(-wagerAmount, "game creation");
      
      toast.success("Game created! Waiting for opponent...");
      navigate(`/game/${gameRef.id}`);
    } catch (error) {
      logger.error('useCreateGame', 'Error creating game', { 
        error, 
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
  const cancelCreation = () => {
    logger.debug('useCreateGame', 'Cancelling game creation');
    navigate("/");
  };

  return {
    wager,
    setWager,
    isCreating,
    userBalance: balance,
    isLoading,
    handleCreateGame,
    cancelCreation
  };
};

export default useCreateGame;

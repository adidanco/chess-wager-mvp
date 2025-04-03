import { useState, useContext } from "react";
import { Chess } from "chess.js";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { GAME_STATUS } from "../utils/constants";
import { toast } from "react-hot-toast";
import { logger, createLogger } from '../utils/logger'
// Create a component-specific logger
const useCreateGameLogger = createLogger('useCreateGame');
;
import { AuthContext } from "../context/AuthContext";
import { GameData } from "chessTypes";

interface GameOptions {
  title?: string;     // Made optional
  wager: number;
  isRealMoney: boolean;
  creatorColor: 'white' | 'black' | 'random';
  timeControl: number;
}

export const useCreateGame = () => {
  const [loading, setLoading] = useState(false);
  const { currentUser, userProfile } = useContext(AuthContext) || {};

  const createGame = async (options: GameOptions): Promise<string | null> => {
    if (!currentUser) {
      toast.error("You must be logged in to create a game");
      return null;
    }
    
    // Validate wager
    if (options.wager < 0) {
      toast.error("Please enter a valid wager amount");
      return null;
    }
    
    // Check real money balance
    const availableBalance = userProfile?.realMoneyBalance || 0;
        
    if (options.wager > availableBalance) {
      toast.error(`Insufficient balance for this wager`);
      return null;
    }
    
    setLoading(true);
    
    try {
      useCreateGameLogger.info('Creating new game', { 
        userId: currentUser.uid,
        wager: options.wager,
        timeControl: options.timeControl,
        isRealMoney: options.isRealMoney
      });
      
      // Initialize a new chess instance for the initial FEN
      const chess = new Chess();
      const initialFen = chess.fen();
      
      // Determine player colors
      let whitePlayerId = null; // Use null instead of undefined
      let blackPlayerId = null; // Use null instead of undefined
      
      if (options.creatorColor === 'white') {
        whitePlayerId = currentUser.uid;
      } else if (options.creatorColor === 'black') {
        blackPlayerId = currentUser.uid;
      } 
      // Random color will be assigned when someone joins
      
      // Create the game in Firestore - avoid undefined values
      const newGame: Record<string, any> = {
        title: options.title || `${userProfile?.username || 'Anonymous'}'s Game`,
        whitePlayer: whitePlayerId,
        blackPlayer: blackPlayerId,
        player1Id: currentUser.uid, // Game creator ID
        player2Id: null, // Will be set when someone joins
        wager: options.wager,
        status: GAME_STATUS.WAITING,
        createdAt: serverTimestamp(),
        fen: initialFen,
        currentTurn: "w", // White always starts in chess
        whiteTime: options.timeControl * 1000, // Convert to ms
        blackTime: options.timeControl * 1000, // Convert to ms
        timeControl: options.timeControl * 1000, // Convert to ms
        moveHistory: [],
        useRealMoney: true, // Always real money
        wagersDebited: false, // Will be set to true when wagers are debited
        payoutProcessed: false, // Will be set to true when payout is processed
        creatorPreferredColor: options.creatorColor
      };
      
      const gameRef = await addDoc(collection(db, "games"), newGame);
      
      useCreateGameLogger.info('Game created successfully', { 
        gameId: gameRef.id,
        userId: currentUser.uid,
        timeControl: options.timeControl,
        isRealMoney: options.isRealMoney
      });
      
      return gameRef.id;
    } catch (error) {
      const err = error as Error;
      useCreateGameLogger.error('Error creating game', { 
        error: err, 
        userId: currentUser?.uid 
      });
      toast.error(err.message || "Error creating game!");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createGame, loading };
}; 
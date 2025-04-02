import { useState, useContext } from "react";
import { Chess } from "chess.js";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { GAME_STATUS } from "../utils/constants";
import { toast } from "react-hot-toast";
import { logger } from "../utils/logger";
import { AuthContext } from "../context/AuthContext";
import { GameData } from "chessTypes";

interface GameOptions {
  title: string;
  wager: number;
  isRealMoney: boolean;
  creatorColor: 'white' | 'black' | 'random';
  timeControl: number;
}

export const useCreateGame = () => {
  const [loading, setLoading] = useState(false);
  const { currentUser, userProfile, updateBalance } = useContext(AuthContext) || {};

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
    
    // Check balance based on wager type
    if (options.wager > 0) {
      const availableBalance = options.isRealMoney 
        ? (userProfile?.realMoneyBalance || 0) 
        : (userProfile?.balance || 0);
        
      if (options.wager > availableBalance) {
        toast.error(`Insufficient ${options.isRealMoney ? 'real money' : 'game currency'} balance!`);
        return null;
      }
    }
    
    setLoading(true);
    
    try {
      logger.info('useCreateGame', 'Creating new game', { 
        userId: currentUser.uid,
        wager: options.wager,
        timeControl: options.timeControl,
        isRealMoney: options.isRealMoney
      });
      
      // Initialize a new chess instance for the initial FEN
      const chess = new Chess();
      const initialFen = chess.fen();
      
      // Determine player colors
      let whitePlayerId: string | undefined = undefined;
      let blackPlayerId: string | undefined = undefined;
      
      if (options.creatorColor === 'white') {
        whitePlayerId = currentUser.uid;
      } else if (options.creatorColor === 'black') {
        blackPlayerId = currentUser.uid;
      } else {
        // Random color assignment will happen when player joins
      }
      
      // Create the game in Firestore
      const newGame: Partial<GameData> = {
        title: options.title || `${currentUser.displayName || 'Anonymous'}'s Game`,
        whitePlayer: whitePlayerId,
        blackPlayer: blackPlayerId,
        player1Id: currentUser.uid, // Game creator ID
        player2Id: undefined, // Will be set when someone joins
        wager: options.wager,
        status: GAME_STATUS.WAITING,
        createdAt: serverTimestamp(),
        fen: initialFen,
        currentTurn: "w",
        whiteTime: options.timeControl * 1000, // Convert to ms
        blackTime: options.timeControl * 1000, // Convert to ms
        timeControl: options.timeControl * 1000, // Convert to ms
        moveHistory: [],
        useRealMoney: options.isRealMoney, // Add flag for real money games
        wagersDebited: false, // Will be set to true when wagers are debited
        payoutProcessed: false, // Will be set to true when payout is processed
        creatorPreferredColor: options.creatorColor
      };
      
      const gameRef = await addDoc(collection(db, "games"), newGame);
      
      logger.info('useCreateGame', 'Game created successfully', { 
        gameId: gameRef.id,
        userId: currentUser.uid,
        timeControl: options.timeControl,
        isRealMoney: options.isRealMoney
      });
      
      // For game currency, we'll deduct the amount immediately
      // For real money, this will be handled when the game starts via cloud functions
      if (options.wager > 0 && !options.isRealMoney) {
        // Deduct wager from user's balance
        await updateBalance?.(-options.wager, "game creation");
      }
      
      return gameRef.id;
    } catch (error) {
      const err = error as Error;
      logger.error('useCreateGame', 'Error creating game', { 
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
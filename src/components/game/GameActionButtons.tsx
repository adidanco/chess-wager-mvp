import React from "react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import toast from "react-hot-toast";
import { logger } from "../../utils/logger";
import { GAME_STATUS, PLAYER_COLORS, GameStatus, PlayerColor } from "../../utils/constants";
import { NavigateFunction } from "react-router-dom";
import { GameData } from "chessTypes";

/**
 * Interface for GameActionButtons props
 */
interface GameActionButtonsProps {
  gameData: GameData | null;
  gameId: string;
  userId: string | undefined;
  navigate: NavigateFunction;
  gameStatus?: GameStatus;
}

/**
 * Component for game action buttons (leave, cancel, draw, resign, etc.)
 */
const GameActionButtons = ({ 
  gameData, 
  gameId, 
  userId, 
  navigate,
  gameStatus
}: GameActionButtonsProps): JSX.Element => {
  const isCreator = gameData?.whitePlayer === userId;
  const userColor = userId === gameData?.whitePlayer ? PLAYER_COLORS.WHITE : PLAYER_COLORS.BLACK;

  const handleCancelGame = async (): Promise<void> => {
    try {
      const gameRef = doc(db, "games", gameId);
      await updateDoc(gameRef, {
        status: GAME_STATUS.CANCELLED,
        endTime: serverTimestamp()
      });
      toast.success("Game cancelled");
      navigate("/");
    } catch (error) {
      const err = error as Error;
      logger.error('Game', 'Error cancelling game', { error: err, gameId });
      toast.error("Error cancelling game!");
    }
  };

  const handleOfferDraw = async (): Promise<void> => {
    try {
      if (!gameData) {
        throw new Error("Game data is not available");
      }
      
      if (!gameData.whitePlayer || !gameData.blackPlayer) {
        throw new Error("Players not found");
      }
      
      const gameRef = doc(db, "games", gameId);
      await updateDoc(gameRef, {
        status: GAME_STATUS.FINISHED,
        winner: "draw",
        endTime: serverTimestamp()
      });

      // Refund wagers for draw
      const whiteUserRef = doc(db, "users", gameData.whitePlayer);
      const blackUserRef = doc(db, "users", gameData.blackPlayer);
      const [whiteSnap, blackSnap] = await Promise.all([
        getDoc(whiteUserRef),
        getDoc(blackUserRef)
      ]);
      
      if (whiteSnap.exists()) {
        const whiteData = whiteSnap.data();
        await updateDoc(whiteUserRef, {
          balance: (whiteData.balance || 0) + (gameData.wager || 0)
        });
      }
      
      if (blackSnap.exists()) {
        const blackData = blackSnap.data();
        await updateDoc(blackUserRef, {
          balance: (blackData.balance || 0) + (gameData.wager || 0)
        });
      }

      toast.success("Game ended in a draw!");
      navigate("/");
    } catch (error) {
      const err = error as Error;
      logger.error('Game', 'Error declaring draw', { error: err, gameId });
      toast.error("Error declaring draw!");
    }
  };

  const handleResign = async (): Promise<void> => {
    try {
      if (!gameData) {
        throw new Error("Game data is not available");
      }
      
      if (!gameData.currentTurn) {
        throw new Error("Current turn not set");
      }
      
      const winner = gameData.currentTurn === PLAYER_COLORS.WHITE ? PLAYER_COLORS.BLACK : PLAYER_COLORS.WHITE;
      const gameRef = doc(db, "games", gameId);
      await updateDoc(gameRef, {
        status: GAME_STATUS.FINISHED,
        winner: winner,
        endTime: serverTimestamp()
      });

      // Handle wager distribution for resignation
      const winnerId = winner === PLAYER_COLORS.WHITE ? gameData.whitePlayer : gameData.blackPlayer;
      if (!winnerId) {
        throw new Error("Winner ID not found");
      }
      
      const userRef = doc(db, "users", winnerId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        await updateDoc(userRef, {
          balance: (userData.balance || 0) + (gameData.wager || 0) * 2 // Winner gets double the wager
        });
      }

      toast.success("You resigned!");
      navigate("/");
    } catch (error) {
      const err = error as Error;
      logger.error('Game', 'Error resigning', { error: err, gameId });
      toast.error("Error resigning!");
    }
  };

  const handleDeclareWin = async (): Promise<void> => {
    try {
      if (!gameData) {
        throw new Error("Game data is not available");
      }
      
      // The winner is the player who clicked the button
      const winner = userColor;
      const gameRef = doc(db, "games", gameId);
      await updateDoc(gameRef, {
        status: GAME_STATUS.FINISHED,
        winner: winner,
        endTime: serverTimestamp()
      });

      // Handle wager distribution for win
      const winnerId = winner === PLAYER_COLORS.WHITE ? gameData.whitePlayer : gameData.blackPlayer;
      if (!winnerId) {
        throw new Error("Winner ID not found");
      }
      
      const userRef = doc(db, "users", winnerId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        await updateDoc(userRef, {
          balance: (userData.balance || 0) + (gameData.wager || 0) * 2 // Winner gets double the wager
        });
      }

      toast.success("You won!");
      navigate("/");
    } catch (error) {
      const err = error as Error;
      logger.error('Game', 'Error declaring win', { error: err, gameId });
      toast.error("Error declaring win!");
    }
  };

  // Basic button for every state
  const leaveButton = (
    <button
      onClick={() => navigate("/")}
      className="w-full min-h-[44px] bg-gray-100 text-gray-700 py-2 sm:py-3 px-3 sm:px-4 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center mb-3 border border-gray-300 touch-manipulation"
    >
      <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
      </svg>
      <span className="text-sm sm:text-base">Leave Game</span>
    </button>
  );

  // For waiting state
  if (gameStatus === GAME_STATUS.WAITING && isCreator) {
    return (
      <div className="space-y-3 p-3 sm:p-4 bg-white rounded-xl shadow-md">
        <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-3 sm:mb-4 text-center">Game Actions</h3>
        {leaveButton}
        <button
          onClick={handleCancelGame}
          className="w-full min-h-[44px] bg-red-500 text-white py-2 sm:py-3 px-3 sm:px-4 rounded-lg hover:bg-red-600 transition-colors shadow-sm flex items-center justify-center touch-manipulation"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
          <span className="text-sm sm:text-base">Cancel Game</span>
        </button>
      </div>
    );
  }

  // For in-progress state
  if (gameStatus === GAME_STATUS.IN_PROGRESS) {
    return (
      <div className="p-3 sm:p-4 bg-white rounded-xl shadow-md">
        <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-3 sm:mb-4 text-center">Game Actions</h3>
        {leaveButton}
        
        <div className="grid grid-cols-1 gap-2 sm:gap-3">
          <button
            onClick={handleOfferDraw}
            className="w-full min-h-[44px] bg-gradient-to-r from-yellow-400 to-yellow-500 text-white py-2 sm:py-3 px-3 sm:px-4 rounded-lg hover:from-yellow-500 hover:to-yellow-600 transition-colors shadow-sm flex items-center justify-center touch-manipulation"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16"></path>
            </svg>
            <span className="text-sm sm:text-base">Offer Draw</span>
          </button>
          
          <button
            onClick={handleResign}
            className="w-full min-h-[44px] bg-gradient-to-r from-red-400 to-red-500 text-white py-2 sm:py-3 px-3 sm:px-4 rounded-lg hover:from-red-500 hover:to-red-600 transition-colors shadow-sm flex items-center justify-center touch-manipulation"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
            <span className="text-sm sm:text-base">Resign</span>
          </button>
          
          <button
            onClick={handleDeclareWin}
            className="w-full min-h-[44px] bg-gradient-to-r from-green-400 to-green-500 text-white py-2 sm:py-3 px-3 sm:px-4 rounded-lg hover:from-green-500 hover:to-green-600 transition-colors shadow-sm flex items-center justify-center touch-manipulation"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span className="text-sm sm:text-base">Declare Win</span>
          </button>
        </div>
      </div>
    );
  }

  // Default state - just the leave button
  return (
    <div className="p-3 sm:p-4 bg-white rounded-xl shadow-md">
      <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-3 sm:mb-4 text-center">Game Actions</h3>
      {leaveButton}
    </div>
  );
};

export default GameActionButtons; 
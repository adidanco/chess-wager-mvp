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
      className="w-full bg-gray-500 text-white py-3 px-4 rounded-md hover:bg-gray-600 mb-2"
    >
      Leave Game
    </button>
  );

  // For waiting state
  if (gameStatus === GAME_STATUS.WAITING && isCreator) {
    return (
      <div className="space-y-2">
        {leaveButton}
        <button
          onClick={handleCancelGame}
          className="w-full bg-red-500 text-white py-3 px-4 rounded-md hover:bg-red-600"
        >
          Cancel Game
        </button>
      </div>
    );
  }

  // For in-progress state
  if (gameStatus === GAME_STATUS.IN_PROGRESS) {
    return (
      <div className="grid grid-cols-1 gap-2">
        {leaveButton}
        <button
          onClick={handleOfferDraw}
          className="w-full bg-yellow-500 text-white py-3 px-4 rounded-md hover:bg-yellow-600"
        >
          Offer Draw
        </button>
        <button
          onClick={handleResign}
          className="w-full bg-red-500 text-white py-3 px-4 rounded-md hover:bg-red-600"
        >
          Resign
        </button>
        <button
          onClick={handleDeclareWin}
          className="w-full bg-green-500 text-white py-3 px-4 rounded-md hover:bg-green-600"
        >
          SAMPLE BUTTON TO DECLARE WIN
        </button>
      </div>
    );
  }

  // Default state - just the leave button
  return <div>{leaveButton}</div>;
};

export default GameActionButtons; 
import React from "react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import toast from "react-hot-toast";
import { logger } from "../../utils/logger";
import { GAME_STATUS, PLAYER_COLORS } from "../../utils/constants";

/**
 * Component for game action buttons (leave, cancel, draw, resign, etc.)
 */
const GameActionButtons = ({ 
  gameData, 
  gameId, 
  userId, 
  navigate,
  gameStatus
}) => {
  const isCreator = gameData?.whitePlayer === userId;
  const userColor = userId === gameData?.whitePlayer ? PLAYER_COLORS.WHITE : PLAYER_COLORS.BLACK;

  const handleCancelGame = async () => {
    try {
      const gameRef = doc(db, "games", gameId);
      await updateDoc(gameRef, {
        status: GAME_STATUS.CANCELLED,
        endTime: serverTimestamp()
      });
      toast.success("Game cancelled");
      navigate("/");
    } catch (error) {
      logger.error('Game', 'Error cancelling game', { error, gameId });
      toast.error("Error cancelling game!");
    }
  };

  const handleOfferDraw = async () => {
    try {
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
          balance: (whiteData.balance || 0) + gameData.wager
        });
      }
      
      if (blackSnap.exists()) {
        const blackData = blackSnap.data();
        await updateDoc(blackUserRef, {
          balance: (blackData.balance || 0) + gameData.wager
        });
      }

      toast.success("Game ended in a draw!");
      navigate("/");
    } catch (error) {
      logger.error('Game', 'Error declaring draw', { error, gameId });
      toast.error("Error declaring draw!");
    }
  };

  const handleResign = async () => {
    try {
      const winner = gameData.currentTurn === PLAYER_COLORS.WHITE ? PLAYER_COLORS.BLACK : PLAYER_COLORS.WHITE;
      const gameRef = doc(db, "games", gameId);
      await updateDoc(gameRef, {
        status: GAME_STATUS.FINISHED,
        winner: winner,
        endTime: serverTimestamp()
      });

      // Handle wager distribution for resignation
      const winnerId = winner === PLAYER_COLORS.WHITE ? gameData.whitePlayer : gameData.blackPlayer;
      const userRef = doc(db, "users", winnerId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        await updateDoc(userRef, {
          balance: (userData.balance || 0) + gameData.wager * 2 // Winner gets double the wager
        });
      }

      toast.success("You resigned!");
      navigate("/");
    } catch (error) {
      logger.error('Game', 'Error resigning', { error, gameId });
      toast.error("Error resigning!");
    }
  };

  const handleDeclareWin = async () => {
    try {
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
      const userRef = doc(db, "users", winnerId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        await updateDoc(userRef, {
          balance: (userData.balance || 0) + gameData.wager * 2 // Winner gets double the wager
        });
      }

      toast.success("You won!");
      navigate("/");
    } catch (error) {
      logger.error('Game', 'Error declaring win', { error, gameId });
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
import React from "react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import toast from "react-hot-toast";
import { logger, createLogger } from '../../utils/logger'
// Create a component-specific logger
const GameActionButtonsLogger = createLogger('GameActionButtons');
;
import { GAME_STATUS, PLAYER_COLORS, GameStatus, PlayerColor } from "../../utils/constants";
import { NavigateFunction } from "react-router-dom";
import { GameData } from "chessTypes";
import { processGameEnd } from "../../services/wagerService";

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
  const isCreator = gameData?.player1Id === userId;
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
      GameActionButtonsLogger.error('Error cancelling game', { error: err, gameId });
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
      
      GameActionButtonsLogger.info('Offering draw', { 
        gameId, 
        userId, 
        gameData: {
          whitePlayer: gameData.whitePlayer,
          blackPlayer: gameData.blackPlayer,
          player1Id: gameData.player1Id,
          player2Id: gameData.player2Id
        }
      });
      
      const gameRef = doc(db, "games", gameId);
      await updateDoc(gameRef, {
        status: GAME_STATUS.FINISHED,
        winner: "draw",
        endTime: serverTimestamp(),
        payoutAttempted: true
      });

      // Process game end with draw
      const wager = gameData.wager || 0;
      const useRealMoney = gameData.useRealMoney || true;
      
      // Get player balances before payouts
      const player1Id = gameData.player1Id;
      const player2Id = gameData.player2Id;
      
      if (!player1Id || !player2Id) {
        GameActionButtonsLogger.error('Missing player IDs for draw payout', { 
          gameId,
          player1Id,
          player2Id
        });
        toast.error("Game ended in a draw but there was an issue with player identification.");
        navigate("/");
        return;
      }
      
      try {
        // Get player balances before payout
        const player1Ref = doc(db, "users", player1Id);
        const player2Ref = doc(db, "users", player2Id);
        const [player1Doc, player2Doc] = await Promise.all([
          getDoc(player1Ref),
          getDoc(player2Ref)
        ]);
        
        const player1PreBal = player1Doc.exists() ? (player1Doc.data().realMoneyBalance || 0) : 0;
        const player2PreBal = player2Doc.exists() ? (player2Doc.data().realMoneyBalance || 0) : 0;
        
        GameActionButtonsLogger.info('Processing draw payout', { 
          gameId,
          player1Id,
          player2Id,
          wager,
          useRealMoney,
          player1BalanceBefore: player1PreBal,
          player2BalanceBefore: player2PreBal
        });
        
        const result = await processGameEnd(
          gameId,
          null, // No winner for a draw
          null, // No loser for a draw
          true, // It's a draw
          wager,
          useRealMoney
        );
        
        if (result) {
          // Verify balances were updated
          const [player1DocAfter, player2DocAfter] = await Promise.all([
            getDoc(player1Ref),
            getDoc(player2Ref)
          ]);
          
          const player1PostBal = player1DocAfter.exists() ? (player1DocAfter.data().realMoneyBalance || 0) : 0;
          const player2PostBal = player2DocAfter.exists() ? (player2DocAfter.data().realMoneyBalance || 0) : 0;
          
          GameActionButtonsLogger.info('Draw payout processed', {
            gameId,
            player1BalanceBefore: player1PreBal,
            player1BalanceAfter: player1PostBal,
            player1Increase: player1PostBal - player1PreBal,
            player2BalanceBefore: player2PreBal,
            player2BalanceAfter: player2PostBal,
            player2Increase: player2PostBal - player2PreBal
          });
          
          if (player1PostBal <= player1PreBal || player2PostBal <= player2PreBal) {
            // Balances didn't increase, something went wrong
            GameActionButtonsLogger.warn('Draw: player balances not updated correctly', {
              gameId,
              player1BalanceBefore: player1PreBal,
              player1BalanceAfter: player1PostBal,
              player2BalanceBefore: player2PreBal,
              player2BalanceAfter: player2PostBal
            });
            
            // Mark for further review
            await updateDoc(gameRef, {
              payoutProcessed: false,
              needsPayout: true,
              player1BalanceBefore: player1PreBal,
              player2BalanceBefore: player2PreBal
            });
          }
        } else {
          GameActionButtonsLogger.error('Failed to process draw payout', {
            gameId,
            player1Id,
            player2Id,
            wager
          });
          
          // Mark for further review
          await updateDoc(gameRef, {
            payoutProcessed: false,
            needsPayout: true,
            player1BalanceBefore: player1PreBal,
            player2BalanceBefore: player2PreBal
          });
        }
      } catch (payoutError: any) {
        GameActionButtonsLogger.error('Error in draw payout', {
          error: payoutError?.message || payoutError,
          stack: payoutError?.stack,
          gameId
        });
        
        // Mark for further review
        await updateDoc(gameRef, {
          payoutProcessed: false,
          needsPayout: true,
          payoutError: payoutError?.message || "Unknown error"
        });
      }

      toast.success("Game ended in a draw!");
      navigate("/");
    } catch (error) {
      const err = error as Error;
      GameActionButtonsLogger.error('Error declaring draw', { 
        error: err, 
        stack: err?.stack,
        gameId 
      });
      toast.error("Error declaring draw!");
    }
  };

  const handleResign = async (): Promise<void> => {
    try {
      if (!gameData) {
        throw new Error("Game data is not available");
      }
      
      // The winner is the opponent of the player who clicked resign
      const winner = userColor === PLAYER_COLORS.WHITE ? PLAYER_COLORS.BLACK : PLAYER_COLORS.WHITE;
      const gameRef = doc(db, "games", gameId);
      
      GameActionButtonsLogger.info('Player resigning', { 
        gameId, 
        userId, 
        userColor,
        winnerColor: winner,
        gameData: {
          whitePlayer: gameData.whitePlayer,
          blackPlayer: gameData.blackPlayer,
          player1Id: gameData.player1Id,
          player2Id: gameData.player2Id
        }
      });
      
      await updateDoc(gameRef, {
        status: GAME_STATUS.FINISHED,
        winner: winner,
        endTime: serverTimestamp(),
        payoutAttempted: true
      });

      // Process game end with winner/loser
      const winnerId = winner === PLAYER_COLORS.WHITE ? gameData.whitePlayer : gameData.blackPlayer;
      const loserId = winner === PLAYER_COLORS.WHITE ? gameData.blackPlayer : gameData.whitePlayer;
      const wager = gameData.wager || 0;
      const useRealMoney = gameData.useRealMoney || true; // Default to true if undefined
      
      if (!winnerId) {
        GameActionButtonsLogger.error('Missing winner ID for resignation payout', { 
          gameId, 
          winnerColor: winner,
          whitePlayer: gameData.whitePlayer,
          blackPlayer: gameData.blackPlayer
        });
        toast.error("Game ended. There was an issue identifying the winner.");
        navigate("/");
        return;
      }
      
      try {
        // Get winner balance before payout
        const winnerRef = doc(db, "users", winnerId);
        const winnerDoc = await getDoc(winnerRef);
        const preBal = winnerDoc.exists() ? (winnerDoc.data().realMoneyBalance || 0) : 0;
        
        GameActionButtonsLogger.info('Processing resignation payout', { 
          gameId,
          winnerId, 
          loserId,
          wager,
          useRealMoney,
          winnerBalanceBefore: preBal
        });
        
        const result = await processGameEnd(
          gameId,
          winnerId,
          loserId || null,
          false, // Not a draw
          wager,
          useRealMoney
        );
        
        if (result) {
          // Verify the payout worked by checking the winner's balance
          const winnerDocAfter = await getDoc(winnerRef);
          const postBal = winnerDocAfter.exists() ? (winnerDocAfter.data().realMoneyBalance || 0) : 0;
          
          GameActionButtonsLogger.info('Resignation payout processed', {
            gameId,
            winnerId,
            wager,
            balanceBefore: preBal,
            balanceAfter: postBal,
            increase: postBal - preBal
          });
          
          if (postBal <= preBal) {
            // Balance didn't increase, something went wrong
            GameActionButtonsLogger.warn('Resignation: winner balance not updated correctly', {
              gameId,
              winnerId,
              balanceBefore: preBal,
              balanceAfter: postBal
            });
            
            // Mark for further review
            await updateDoc(gameRef, {
              payoutProcessed: false,
              needsPayout: true,
              winnerBalanceBefore: preBal
            });
          }
        } else {
          GameActionButtonsLogger.error('Failed to process resignation payout', {
            gameId,
            winnerId,
            loserId,
            wager
          });
          
          // Mark for further review
          await updateDoc(gameRef, {
            payoutProcessed: false,
            needsPayout: true,
            winnerBalanceBefore: preBal
          });
        }
      } catch (payoutError: any) {
        GameActionButtonsLogger.error('Error in resignation payout', {
          error: payoutError?.message || payoutError,
          stack: payoutError?.stack,
          gameId,
          winnerId,
          loserId
        });
        
        // Mark for further review
        await updateDoc(gameRef, {
          payoutProcessed: false,
          needsPayout: true,
          payoutError: payoutError?.message || "Unknown error"
        });
      }

      toast.success("You resigned. Your opponent won the game.");
      navigate("/");
    } catch (error) {
      const err = error as Error;
      GameActionButtonsLogger.error('Error resigning', { 
        error: err, 
        stack: err?.stack,
        gameId 
      });
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
      
      GameActionButtonsLogger.info('Declaring win', { 
        gameId, 
        userId, 
        userColor: winner,
        gameData: {
          whitePlayer: gameData.whitePlayer,
          blackPlayer: gameData.blackPlayer,
          player1Id: gameData.player1Id,
          player2Id: gameData.player2Id
        }
      });

      // First update the game status
      await updateDoc(gameRef, {
        status: GAME_STATUS.FINISHED,
        winner: winner,
        endTime: serverTimestamp(),
        payoutAttempted: true // Mark that we're attempting payout
      });

      // Process game end with winner/loser
      const winnerId = winner === PLAYER_COLORS.WHITE ? gameData.whitePlayer : gameData.blackPlayer;
      const loserId = winner === PLAYER_COLORS.WHITE ? gameData.blackPlayer : gameData.whitePlayer;
      const wager = gameData.wager || 0;
      const useRealMoney = gameData.useRealMoney || true; // Default to true if undefined
      
      // Check if we have the required IDs
      if (!winnerId) {
        GameActionButtonsLogger.error('Missing winner ID for payout', { 
          gameId, 
          userColor: winner,
          whitePlayer: gameData.whitePlayer,
          blackPlayer: gameData.blackPlayer
        });
        toast.error("Error: Could not determine winner ID");
        navigate("/");
        return;
      }
      
      try {
        GameActionButtonsLogger.info('Processing payout', { 
          gameId, 
          winnerId, 
          loserId,
          wager,
          useRealMoney
        });
        
        // Get the user balance before payout for validation
        const winnerRef = doc(db, "users", winnerId);
        const winnerDoc = await getDoc(winnerRef);
        const preBal = winnerDoc.exists() ? (winnerDoc.data().realMoneyBalance || 0) : 0;
        
        // Process the payout
        const result = await processGameEnd(
          gameId,
          winnerId,
          loserId || null, // Handle case where loserId might be undefined
          false, // Not a draw
          wager,
          useRealMoney
        );
        
        if (result) {
          // Verify the balance was actually updated
          const winnerDocAfter = await getDoc(winnerRef);
          const postBal = winnerDocAfter.exists() ? (winnerDocAfter.data().realMoneyBalance || 0) : 0;
          
          GameActionButtonsLogger.info('Payout processed successfully for declared win', {
            gameId,
            winnerId,
            wager,
            useRealMoney,
            balanceBefore: preBal,
            balanceAfter: postBal
          });
          
          if (postBal > preBal) {
            toast.success("You won and received your payout!");
          } else {
            // Balance didn't change, might be an issue
            GameActionButtonsLogger.warn('Payout processed but balance not updated', {
              gameId,
              winnerId,
              balanceBefore: preBal,
              balanceAfter: postBal
            });
            toast.success("You won! (Payout will be processed shortly)");
            
            // Update the game to ensure it's marked as needing payout
            await updateDoc(gameRef, {
              payoutProcessed: false,
              needsPayout: true,
              winnerBalanceBefore: preBal
            });
          }
        } else {
          GameActionButtonsLogger.error('Failed to process payout for declared win', {
            gameId,
            winnerId,
            loserId,
            wager
          });
          
          // Update the game to ensure it's marked as needing payout
          await updateDoc(gameRef, {
            payoutProcessed: false,
            needsPayout: true,
            winnerBalanceBefore: preBal
          });
          
          toast.error("You won! Game ended but there was an issue processing the payout. Our team will review this.");
        }
      } catch (payoutError: any) {
        GameActionButtonsLogger.error('Error in processGameEnd', {
          error: payoutError?.message || payoutError,
          stack: payoutError?.stack,
          gameId,
          winnerId,
          loserId
        });
        
        // Update the game to ensure it's marked as needing manual payout
        await updateDoc(gameRef, {
          payoutProcessed: false,
          needsPayout: true,
          payoutError: payoutError?.message || "Unknown error"
        });
        
        toast.error("You won! Game ended but there was an error processing the payout. Our team will review this.");
      }
      
      navigate("/");
    } catch (error: any) {
      const err = error as Error;
      GameActionButtonsLogger.error('Error declaring win', { 
        error: err?.message || err, 
        stack: err?.stack,
        gameId 
      });
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
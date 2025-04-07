import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ChessboardComponent from "../components/game/ChessboardComponent";
import ClockDisplay from "../components/game/ClockDisplay";
import MoveHistory from "../components/game/MoveHistory";
import GameInfo from "../components/game/GameInfo";
import GameActionButtons from "../components/game/GameActionButtons";
import useChessGame from "../hooks/useChessGame";
import LoadingSpinner from "../components/common/LoadingSpinner";
import PageLayout from "../components/common/PageLayout";
import { PlayerColor } from "../utils/constants";

type GameParams = {
  gameId?: string;
};

export default function Game(): JSX.Element {
  const params = useParams();
  const gameId = params.gameId || '';
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const {
    gameData,
    myColor,
    error,
    moveHistory,
    fen,
    isGameOver,
    whiteTime,
    blackTime,
    handleMove
  } = useChessGame(gameId, currentUser?.uid, navigate);

  // Show loading state if no fen is available yet
  if (!fen) {
    return <LoadingSpinner message="Loading game..." />;
  }

  const handlePieceDrop = (sourceSquare: string, targetSquare: string, piece: string): Promise<boolean> => {
    return handleMove(sourceSquare, targetSquare, piece);
  };

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-6 pb-safe">
        {/* Game title and status */}
        <div className="mb-4 sm:mb-6 text-center">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 mb-2">Chess Match</h1>
          {isGameOver && (
            <div className={`inline-block py-1 sm:py-2 px-3 sm:px-4 rounded-full text-white font-medium text-sm sm:text-base ${
              isGameOver.winner === myColor 
                ? 'bg-green-500' 
                : isGameOver.winner === 'draw' 
                  ? 'bg-yellow-500' 
                  : 'bg-red-500'
            }`}>
              {isGameOver.winner === myColor 
                ? 'You Won!' 
                : isGameOver.winner === 'draw' 
                  ? 'Game Drawn' 
                  : 'You Lost'}
            </div>
          )}
        </div>
        
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
          {/* Main game area */}
          <div className="lg:flex-1 space-y-4 sm:space-y-6">
            {/* Game info section */}
            <GameInfo
              gameId={gameId}
              currentTurn={gameData?.currentTurn}
              playerColor={myColor}
              wager={gameData?.wager || 0}
              timeControl={gameData?.timeControl}
              error={error}
            />

            {/* Clock display */}
            <ClockDisplay
              whiteTime={whiteTime}
              blackTime={blackTime}
              currentTurn={gameData?.currentTurn}
            />

            {/* Chessboard - Using max-width to ensure it fits on mobile */}
            <div className="bg-white p-2 sm:p-4 rounded-xl shadow-md">
              <div className="w-full mx-auto" style={{ maxWidth: 'min(calc(100vw - 32px), 560px)' }}>
                <ChessboardComponent
                  fen={fen}
                  onPieceDrop={handlePieceDrop}
                  orientation={myColor === "w" ? "white" : "black"}
                  isGameOver={isGameOver}
                  gameStatus={gameData?.status}
                />
              </div>
            </div>
          </div>

          {/* Side panel - Full width on mobile, fixed width on desktop */}
          <div className="w-full lg:w-96 space-y-4 sm:space-y-6">
            {/* Move History */}
            <MoveHistory moves={moveHistory} />
            
            {/* Game Actions */}
            <GameActionButtons
              gameData={gameData}
              gameId={gameId}
              userId={currentUser?.uid}
              navigate={navigate}
              gameStatus={gameData?.status}
            />
          </div>
        </div>
      </div>
    </PageLayout>
  );
} 
// ✅ ADDED: Game.jsx
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

export default function Game() {
  const { gameId } = useParams();
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

  const handlePieceDrop = (sourceSquare, targetSquare, piece) => {
    return handleMove(sourceSquare, targetSquare, piece);
  };

  return (
    <PageLayout title="Chess Game">
      <div className="container mx-auto px-4 flex flex-col md:flex-row gap-6">
        {/* Main game area */}
        <div className="md:flex-1">
          {/* Game info section */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <GameInfo
              gameId={gameId}
              currentTurn={gameData?.currentTurn}
              playerColor={myColor}
              wager={gameData?.wager || 0}
              error={error}
            />
          </div>

          {/* Chessboard */}
          <div className="mb-4">
            <ChessboardComponent
              fen={fen}
              onPieceDrop={handlePieceDrop}
              orientation={myColor === "w" ? "white" : "black"}
              isGameOver={isGameOver}
            />
          </div>

          {/* Clock display */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <ClockDisplay
              whiteTime={whiteTime}
              blackTime={blackTime}
              currentTurn={gameData?.currentTurn}
            />
          </div>
        </div>

        {/* Side panel */}
        <div className="md:w-96 bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-bold mb-4">Move History</h3>
          <MoveHistory moves={moveHistory} />
          
          <div className="mt-6">
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

import React from "react";
import { Chessboard } from "react-chessboard";
import { PlayerColor, GAME_STATUS } from "../../utils/constants";
import { toast } from "react-hot-toast";

/**
 * Interface for game over state
 */
interface GameOverState {
  winner: PlayerColor | 'draw' | null;
}

/**
 * Interface for ChessboardComponent props
 */
interface ChessboardComponentProps {
  fen: string;
  onPieceDrop: (sourceSquare: string, targetSquare: string, piece: string) => any;
  orientation: "white" | "black";
  isGameOver: GameOverState | false;
  gameStatus?: string;
}

/**
 * Chessboard component that handles the display and interaction with the chess board
 */
const ChessboardComponent = ({ 
  fen, 
  onPieceDrop, 
  orientation, 
  isGameOver,
  gameStatus
}: ChessboardComponentProps): JSX.Element => {
  // Function to handle attempted move while waiting for opponent
  const handlePieceDrop = (source: string, target: string, piece: string) => {
    if (gameStatus === GAME_STATUS.WAITING) {
      // Show toast notification when trying to move before game starts
      toast.error("Can't make moves yet. Waiting for another player to join...");
      return false;
    }
    
    return onPieceDrop(source, target, piece);
  };
  
  const isWaiting = gameStatus === GAME_STATUS.WAITING;
  
  return (
    <div className="relative w-full mx-auto">
      <div className="w-full aspect-square">
        <Chessboard
          position={fen}
          onPieceDrop={handlePieceDrop}
          boardOrientation={orientation}
          customBoardStyle={{
            borderRadius: '4px',
            boxShadow: '0 5px 15px rgba(0, 0, 0, 0.2)'
          }}
        />
      </div>
      
      {isGameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg z-10">
          <div className="bg-white p-6 rounded-lg shadow-xl text-center">
            <h3 className="text-2xl font-bold mb-2">Game Over!</h3>
            <p className="text-xl mb-4">
              {!isGameOver.winner ? "Game ended!" :
                isGameOver.winner === "draw" 
                  ? "It's a draw!" 
                  : `Winner: ${isGameOver.winner === "w" ? "White" : "Black"}`
              }
            </p>
          </div>
        </div>
      )}
      
      {isWaiting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg z-10">
          <div className="bg-white p-6 rounded-lg shadow-xl text-center">
            <div className="animate-pulse mb-3">
              <div className="h-8 w-8 mx-auto rounded-full bg-blue-500 flex items-center justify-center text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-bold mb-2 text-blue-600">Game Created!</h3>
            <p className="text-gray-700 font-medium">
              Waiting for another player to join...
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Share the game ID to invite a friend
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChessboardComponent; 
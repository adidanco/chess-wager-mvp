import React from "react";
import { Chessboard } from "react-chessboard";
import { PlayerColor } from "../../utils/constants";

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
}

/**
 * Chessboard component that handles the display and interaction with the chess board
 */
const ChessboardComponent = ({ 
  fen, 
  onPieceDrop, 
  orientation, 
  isGameOver 
}: ChessboardComponentProps): JSX.Element => {
  return (
    <div className="relative w-full mx-auto">
      <div className="w-full aspect-square">
        <Chessboard
          position={fen}
          onPieceDrop={onPieceDrop}
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
    </div>
  );
};

export default ChessboardComponent; 
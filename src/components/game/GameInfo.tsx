import React from "react";
import { CURRENCY_SYMBOL } from "../../utils/constants";
import { PlayerColor } from "../../utils/constants";

/**
 * Helper function to format time
 */
const formatTimeControl = (timeMs: number | undefined): string => {
  if (!timeMs) return "Unknown";
  const minutes = Math.floor(timeMs / 60000);
  return `${minutes} minutes`;
};

/**
 * Interface for GameInfo props
 */
interface GameInfoProps {
  gameId: string;
  currentTurn?: PlayerColor;
  playerColor?: PlayerColor | null;
  wager: number;
  timeControl?: number;
  error: string | null;
}

/**
 * Component to display basic game information
 */
const GameInfo = ({ 
  gameId, 
  currentTurn, 
  playerColor, 
  wager,
  timeControl,
  error 
}: GameInfoProps): JSX.Element => {
  return (
    <div>
      {error && <p className="text-red-500 mb-2 font-bold">{error}</p>}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-gray-600">Game ID:</p>
          <p className="font-medium">{gameId}</p>
        </div>
        
        <div>
          <p className="text-sm text-gray-600">Current Turn:</p>
          <p className="font-medium">{currentTurn === 'w' ? 'White' : 'Black'}</p>
        </div>
        
        <div>
          <p className="text-sm text-gray-600">You are playing:</p>
          <p className="font-medium">{playerColor === "w" ? "White" : "Black"}</p>
        </div>
        
        <div>
          <p className="text-sm text-gray-600">Wager:</p>
          <p className="font-medium text-green-600">{CURRENCY_SYMBOL}{wager}</p>
        </div>
        
        <div>
          <p className="text-sm text-gray-600">Time Control:</p>
          <p className="font-medium">{formatTimeControl(timeControl)}</p>
        </div>
      </div>
    </div>
  );
};

export default GameInfo; 
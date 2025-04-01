import React from "react";
import { CURRENCY_SYMBOL } from "../../utils/constants";

/**
 * Component to display basic game information
 */
const GameInfo = ({ gameId, currentTurn, playerColor, wager, error }) => {
  return (
    <div>
      {error && <p className="text-red-500 mb-2 font-bold">{error}</p>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>
    </div>
  );
};

export default GameInfo; 
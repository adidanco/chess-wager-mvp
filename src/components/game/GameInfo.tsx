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
  // Define icons for better visual representation
  const icons = {
    game: "🎮",
    turn: "↪️",
    player: "👤",
    wager: "💰",
    time: "⏱️",
  };

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-3 sm:p-5 rounded-xl shadow-sm">
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 p-3 mb-3 rounded-md text-sm sm:text-base">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Game ID with copy functionality */}
        <div className="space-y-1 bg-white p-2 sm:p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center mb-1">
            <span className="text-lg sm:text-xl mr-2">{icons.game}</span>
            <p className="text-xs sm:text-sm font-medium text-gray-600">Game ID</p>
          </div>
          <p className="font-mono text-xs text-gray-800 overflow-hidden text-ellipsis truncate">{gameId}</p>
        </div>
        
        {/* Current Turn with visual indicator */}
        <div className="space-y-1 bg-white p-2 sm:p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center mb-1">
            <span className="text-lg sm:text-xl mr-2">{icons.turn}</span>
            <p className="text-xs sm:text-sm font-medium text-gray-600">Current Turn</p>
          </div>
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${currentTurn === 'w' ? 'bg-white border border-gray-300' : 'bg-gray-800'}`}></div>
            <p className="text-sm sm:text-base font-semibold text-gray-800">{currentTurn === 'w' ? 'White' : 'Black'}</p>
          </div>
        </div>
        
        {/* Player's Color */}
        <div className="space-y-1 bg-white p-2 sm:p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center mb-1">
            <span className="text-lg sm:text-xl mr-2">{icons.player}</span>
            <p className="text-xs sm:text-sm font-medium text-gray-600">You are playing</p>
          </div>
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${playerColor === 'w' ? 'bg-white border border-gray-300' : 'bg-gray-800'}`}></div>
            <p className="text-sm sm:text-base font-semibold text-gray-800">{playerColor === "w" ? "White" : "Black"}</p>
          </div>
        </div>
        
        {/* Wager Amount */}
        <div className="space-y-1 bg-white p-2 sm:p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center mb-1">
            <span className="text-lg sm:text-xl mr-2">{icons.wager}</span>
            <p className="text-xs sm:text-sm font-medium text-gray-600">Wager</p>
          </div>
          <p className="text-base sm:text-lg font-bold text-green-600">{CURRENCY_SYMBOL}{wager}</p>
        </div>
        
        {/* Time Control */}
        <div className="space-y-1 bg-white p-2 sm:p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center mb-1">
            <span className="text-lg sm:text-xl mr-2">{icons.time}</span>
            <p className="text-xs sm:text-sm font-medium text-gray-600">Time Control</p>
          </div>
          <p className="text-sm sm:text-base font-semibold text-gray-800">{formatTimeControl(timeControl)}</p>
        </div>
      </div>
    </div>
  );
};

export default GameInfo; 
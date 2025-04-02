import React from "react";
import { PlayerColor } from "../../utils/constants";

/**
 * Helper function to format milliseconds into MM:SS
 */
const formatTime = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

/**
 * Interface for ClockDisplay props
 */
interface ClockDisplayProps {
  whiteTime: number;
  blackTime: number;
  currentTurn?: PlayerColor;
}

/**
 * Component to display chess clocks for both players
 */
const ClockDisplay = ({ 
  whiteTime, 
  blackTime, 
  currentTurn 
}: ClockDisplayProps): JSX.Element => {
  // Determine if time is low (under 30 seconds)
  const whiteTimeIsLow = whiteTime <= 30000;
  const blackTimeIsLow = blackTime <= 30000;

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full">
      {/* White Clock */}
      <div 
        className={`flex-1 p-3 sm:p-4 rounded-xl shadow-md transition-all duration-300 ${
          currentTurn === "w" 
            ? `bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-400 shadow-lg transform ${whiteTimeIsLow ? 'animate-pulse' : ''}` 
            : 'bg-gray-50'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-white border border-gray-300 rounded-full mr-2"></div>
            <span className="text-sm sm:text-base text-gray-800 font-medium">White</span>
          </div>
          {currentTurn === "w" && (
            <div className="bg-blue-600 text-white text-xs py-1 px-2 rounded-full animate-pulse">
              Active
            </div>
          )}
        </div>
        
        <div className={`text-center ${whiteTimeIsLow ? 'text-red-600' : 'text-gray-800'}`}>
          <div className={`text-3xl sm:text-4xl font-mono font-bold tracking-wide ${
            whiteTimeIsLow ? 'animate-pulse' : ''
          }`}>
            {formatTime(whiteTime)}
          </div>
          
          {/* Progress bar for time visualization */}
          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
            <div 
              className={`h-1.5 rounded-full ${whiteTimeIsLow ? 'bg-red-500' : 'bg-blue-500'}`} 
              style={{ width: `${Math.min(100, (whiteTime / 600000) * 100)}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      {/* Black Clock */}
      <div 
        className={`flex-1 p-3 sm:p-4 rounded-xl shadow-md transition-all duration-300 ${
          currentTurn === "b" 
            ? `bg-gradient-to-r from-gray-700 to-gray-800 text-white border-2 border-gray-500 shadow-lg transform ${blackTimeIsLow ? 'animate-pulse' : ''}` 
            : 'bg-gray-200'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gray-800 rounded-full mr-2"></div>
            <span className={`text-sm sm:text-base font-medium ${currentTurn === "b" ? 'text-white' : 'text-gray-800'}`}>Black</span>
          </div>
          {currentTurn === "b" && (
            <div className="bg-green-500 text-white text-xs py-1 px-2 rounded-full animate-pulse">
              Active
            </div>
          )}
        </div>
        
        <div className={`text-center ${
          blackTimeIsLow 
            ? 'text-red-400' 
            : currentTurn === "b" ? 'text-white' : 'text-gray-800'
        }`}>
          <div className={`text-3xl sm:text-4xl font-mono font-bold tracking-wide ${
            blackTimeIsLow ? 'animate-pulse' : ''
          }`}>
            {formatTime(blackTime)}
          </div>
          
          {/* Progress bar for time visualization */}
          <div className="w-full bg-gray-600 rounded-full h-1.5 mt-2">
            <div 
              className={`h-1.5 rounded-full ${blackTimeIsLow ? 'bg-red-500' : 'bg-green-500'}`} 
              style={{ width: `${Math.min(100, (blackTime / 600000) * 100)}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClockDisplay;
export { formatTime }; 
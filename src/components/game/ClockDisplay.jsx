import React from "react";

/**
 * Helper function to format milliseconds into MM:SS
 */
const formatTime = (ms) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

/**
 * Component to display chess clocks for both players
 */
const ClockDisplay = ({ whiteTime, blackTime, currentTurn }) => {
  return (
    <div className="grid grid-cols-2 gap-4 w-full text-center">
      <div 
        className={`py-3 px-4 rounded-lg ${
          currentTurn === "w" 
            ? "bg-blue-100 border-2 border-blue-500" 
            : "bg-gray-100"
        }`}
      >
        <div className="text-sm text-gray-600 mb-1">White</div>
        <div className="text-2xl font-bold">{formatTime(whiteTime)}</div>
      </div>
      
      <div 
        className={`py-3 px-4 rounded-lg ${
          currentTurn === "b" 
            ? "bg-blue-100 border-2 border-blue-500" 
            : "bg-gray-100"
        }`}
      >
        <div className="text-sm text-gray-600 mb-1">Black</div>
        <div className="text-2xl font-bold">{formatTime(blackTime)}</div>
      </div>
    </div>
  );
};

export default ClockDisplay;
export { formatTime }; 
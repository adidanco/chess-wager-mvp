import React from "react";

/**
 * Component to display user stats (wins, losses, draws)
 */
const UserStats = ({ stats = {} }) => {
  const { wins = 0, losses = 0, draws = 0 } = stats;
  
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Your Stats</h3>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-xl text-green-500 font-bold">{wins}</div>
          <div className="text-sm text-gray-500">Wins</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-xl text-red-500 font-bold">{losses}</div>
          <div className="text-sm text-gray-500">Losses</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-xl text-blue-500 font-bold">{draws}</div>
          <div className="text-sm text-gray-500">Draws</div>
        </div>
      </div>
    </div>
  );
};

export default UserStats; 
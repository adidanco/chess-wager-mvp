import React from "react";
import { UserStats as UserStatsType } from "chessTypes";
import { 
  getRatingClassification, 
  formatRating, 
  isProvisionalRating 
} from "../../utils/ratingSystem";

/**
 * Interface for UserStats props
 */
interface UserStatsProps {
  stats: UserStatsType;
}

/**
 * Component to display user stats (wins, losses, draws, ELO rating)
 */
const UserStats = ({ stats = { wins: 0, losses: 0, draws: 0, eloRating: 1200 } }: UserStatsProps): JSX.Element => {
  const { wins = 0, losses = 0, draws = 0, eloRating = 1200, ratingDeviation = 350 } = stats;
  const totalGames = wins + losses + draws;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const ratingClass = getRatingClassification(eloRating);
  const isProvisional = isProvisionalRating({ rating: eloRating, rd: ratingDeviation, vol: 0.06 });
  const formattedRating = formatRating({ rating: eloRating, rd: ratingDeviation, vol: 0.06 });
  
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Your Stats</h3>
      
      {/* ELO Rating */}
      <div className="mb-4 bg-blue-50 p-4 rounded-lg text-center">
        <div className="text-2xl font-bold text-blue-700">{formattedRating}</div>
        <div className="text-sm text-gray-600">Glicko-2 Rating</div>
        <div className="text-xs text-blue-500 font-medium mt-1">
          {ratingClass}
          {isProvisional && <span className="ml-1 text-orange-500">(Provisional)</span>}
        </div>
      </div>
      
      {/* Game Stats */}
      <div className="grid grid-cols-4 gap-2 text-center">
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
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-xl text-purple-500 font-bold">{winRate}%</div>
          <div className="text-sm text-gray-500">Win Rate</div>
        </div>
      </div>
      
      {/* Total Games */}
      <div className="mt-4 text-center text-sm text-gray-500">
        Total Games: {totalGames}
        {isProvisional && (
          <span className="block mt-1 text-xs text-orange-500">
            Play more games to establish an accurate rating
          </span>
        )}
      </div>
    </div>
  );
};

export default UserStats; 
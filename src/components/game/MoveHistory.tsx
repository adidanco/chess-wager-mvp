import React from "react";

/**
 * Interface for move history item
 */
interface MoveHistoryItem {
  number: number;
  white?: string;
  black?: string;
  timestamp?: string;
}

/**
 * Interface for MoveHistory props
 */
interface MoveHistoryProps {
  moves: MoveHistoryItem[];
}

/**
 * Component to display the history of chess moves
 */
const MoveHistory = ({ moves = [] }: MoveHistoryProps): JSX.Element => {
  if (!moves || moves.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 sm:p-6 text-center border border-gray-200">
        <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
        </svg>
        <p className="text-sm sm:text-base text-gray-600 font-medium">
          No moves yet. Make your first move!
        </p>
      </div>
    );
  }

  // Function to render move notation with highlighted special moves
  const renderMoveNotation = (notation: string | undefined) => {
    if (!notation) return null;
    
    // Highlight special moves with different colors
    const isCheck = notation.includes('+');
    const isCheckmate = notation.includes('#');
    const isCapture = notation.includes('x');
    const isCastle = notation === 'O-O' || notation === 'O-O-O';
    
    let classes = "font-mono text-xs sm:text-sm";
    
    if (isCheckmate) {
      classes += " text-red-600 font-bold";
    } else if (isCheck) {
      classes += " text-orange-600 font-semibold";
    } else if (isCapture) {
      classes += " text-blue-600";
    } else if (isCastle) {
      classes += " text-purple-600";
    }
    
    return <span className={classes}>{notation}</span>;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-2 sm:p-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
        <h3 className="text-sm sm:text-base text-gray-700 font-semibold text-center">Move History</h3>
      </div>
      
      <div className="max-h-[200px] sm:max-h-[300px] overflow-y-auto p-1 sm:p-2">
        <table className="w-full table-auto">
          <thead>
            <tr className="bg-gray-50">
              <th className="py-1 sm:py-2 px-2 sm:px-3 text-left w-8 sm:w-10 text-gray-600 text-xs sm:text-sm font-semibold">#</th>
              <th className="py-1 sm:py-2 px-2 sm:px-3 text-left text-gray-600 text-xs sm:text-sm font-semibold">
                <div className="flex items-center">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white border border-gray-300 rounded-full mr-1 sm:mr-2"></div>
                  <span className="text-xs sm:text-sm">White</span>
                </div>
              </th>
              <th className="py-1 sm:py-2 px-2 sm:px-3 text-left text-gray-600 text-xs sm:text-sm font-semibold">
                <div className="flex items-center">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-gray-800 rounded-full mr-1 sm:mr-2"></div>
                  <span className="text-xs sm:text-sm">Black</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {moves.map((move, index) => (
              <tr 
                key={index} 
                className={`border-b border-gray-100 ${
                  index === moves.length - 1 ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <td className="py-1 sm:py-2 px-2 sm:px-3 text-gray-500 text-xs sm:text-sm">{move.number}.</td>
                <td className="py-1 sm:py-2 px-2 sm:px-3">{renderMoveNotation(move.white)}</td>
                <td className="py-1 sm:py-2 px-2 sm:px-3">{renderMoveNotation(move.black)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {moves.length > 5 && (
        <div className="p-1 sm:p-2 border-t border-gray-200 bg-gray-50 text-center">
          <button className="text-blue-600 text-xs sm:text-sm hover:text-blue-800 font-medium py-1 px-3 rounded-full hover:bg-blue-50 transition-colors">
            Export PGN
          </button>
        </div>
      )}
    </div>
  );
};

export default MoveHistory; 
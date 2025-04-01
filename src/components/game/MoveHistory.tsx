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
      <div className="text-gray-500 italic">
        No moves yet. Make your first move!
      </div>
    );
  }

  return (
    <div className="max-h-[300px] overflow-y-auto">
      <table className="w-full table-auto">
        <thead>
          <tr className="border-b">
            <th className="py-2 text-left w-10">#</th>
            <th className="py-2 text-left">White</th>
            <th className="py-2 text-left">Black</th>
          </tr>
        </thead>
        <tbody>
          {moves.map((move, index) => (
            <tr key={index} className="border-b">
              <td className="py-2">{move.number}.</td>
              <td className="py-2">{move.white}</td>
              <td className="py-2">{move.black}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MoveHistory; 
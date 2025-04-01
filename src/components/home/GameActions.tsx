import React from "react";

/**
 * Interface for GameActions props
 */
interface GameActionsProps {
  onCreateGame: () => void;
  onJoinGame: () => void;
  onLogout: () => void;
}

/**
 * Component for game action buttons on the home page
 */
const GameActions = ({ 
  onCreateGame, 
  onJoinGame, 
  onLogout 
}: GameActionsProps): JSX.Element => {
  return (
    <div className="space-y-4">
      <button
        onClick={onCreateGame}
        className="w-full bg-blue-500 text-white py-3 px-4 rounded-md text-lg font-medium hover:bg-blue-600 transition-colors shadow-md"
      >
        Create New Game
      </button>
      <button
        onClick={onJoinGame}
        className="w-full bg-green-500 text-white py-3 px-4 rounded-md text-lg font-medium hover:bg-green-600 transition-colors shadow-md"
      >
        Join Game
      </button>
      <button
        onClick={onLogout}
        className="w-full bg-red-500 text-white py-3 px-4 rounded-md text-lg font-medium hover:bg-red-600 transition-colors shadow-md"
      >
        Logout
      </button>
    </div>
  );
};

export default GameActions; 
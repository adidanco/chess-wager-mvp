import React from "react";
import InfoCard from "../common/InfoCard";

/**
 * Interface for GameActions props
 */
interface GameActionsProps {
  onCreateGame: () => void;
  onJoinGame: () => void;
  onSettings: () => void;
  onLogout: () => void;
}

/**
 * Component for game action buttons on the home page
 * Improved with better layout and visual cues
 */
const GameActions = ({ 
  onCreateGame, 
  onJoinGame,
  onSettings,
  onLogout 
}: GameActionsProps): JSX.Element => {
  return (
    <div className="space-y-6 p-0.5">
      {/* Primary Game Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard
          title="Create Game"
          description="Create a new game room and invite friends to play"
          icon="fa-gamepad"
          iconBgColor="bg-deep-purple"
          actionText="Start Playing"
          onClick={onCreateGame}
          data-cy="home-action-create-game"
          className="border-2 border-deep-purple/10 hover:border-deep-purple/30"
        />

        <InfoCard
          title="Join Game"
          description="Join an existing game with a code or browse open games"
          icon="fa-sign-in-alt"
          iconBgColor="bg-soft-pink"
          actionText="Find Games"
          onClick={onJoinGame}
          className="border-2 border-soft-pink/10 hover:border-soft-pink/30"
        />
      </div>

      {/* Secondary Actions */}
      <div className="border-t border-white/10 pt-4 flex justify-between">
        <button
          onClick={onSettings}
          className="text-white/80 hover:text-white flex items-center px-3 py-2 rounded hover:bg-white/5 transition-colors"
        >
          <i className="fas fa-cog mr-2"></i>
          Settings
        </button>
        
        <button
          onClick={onLogout}
          className="text-white/80 hover:text-white flex items-center px-3 py-2 rounded hover:bg-white/5 transition-colors"
        >
          <i className="fas fa-sign-out-alt mr-2"></i>
          Logout
        </button>
      </div>
    </div>
  );
};

export default GameActions; 
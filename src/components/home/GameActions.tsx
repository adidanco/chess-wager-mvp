import React from "react";
import Button from "../common/Button";

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
 * Updated to use the Gam(e)Bit button component
 */
const GameActions = ({ 
  onCreateGame, 
  onJoinGame,
  onSettings,
  onLogout 
}: GameActionsProps): JSX.Element => {
  return (
    <div className="space-y-3">
      <Button
        variant="primary"
        size="large"
        fullWidth
        onClick={onCreateGame}
        leftIcon={<i className="fas fa-gamepad"></i>}
      >
        Choose Game
      </Button>
      
      <Button
        variant="secondary"
        size="large"
        fullWidth
        onClick={onJoinGame}
        leftIcon={<i className="fas fa-sign-in-alt"></i>}
      >
        Join Game
      </Button>
      
      <Button
        variant="outline"
        size="large"
        fullWidth
        onClick={onSettings}
        leftIcon={<i className="fas fa-cog"></i>}
        className="border-white text-white hover:bg-white/20"
      >
        Settings
      </Button>
      
      <Button
        variant="text"
        size="large"
        fullWidth
        onClick={onLogout}
        leftIcon={<i className="fas fa-sign-out-alt"></i>}
        className="text-white hover:bg-white/20"
      >
        Logout
      </Button>
    </div>
  );
};

export default GameActions; 
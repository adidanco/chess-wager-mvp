import React from 'react';
import { Card, Rank, CardPosition, PlayerInfo, CardPowerType } from '../../types/scambodia';
import Button from '../common/Button';
import { getPlayerUsername } from '../../utils/playerUtils'; // Helper to get username

interface SpecialPowerProps {
  specialCard: Card;
  isSubmitting: boolean;
  onUseSpecialPower: () => void; // No longer takes params
  onSkipSpecialPower: () => void;
  onCancelSelection: () => void; // To clear targets
  // Pass game state needed for display and context
  players: PlayerInfo[];
  currentUserId: string;
  // Pass current target selections
  powerTarget_OwnCardIndex: CardPosition | null;
  powerTarget_OpponentId: string | null;
  powerTarget_OpponentCardIndex: CardPosition | null;
}

// Helper to determine power type (can move to utils later)
const determinePowerType = (card: Card): CardPowerType | null => {
  switch (card.rank) {
    case '7':
    case '8':
      return 'Peek_Own';
    case '9':
    case '10':
      return 'Peek_Opponent';
    case 'J':
    case 'Q':
      return 'Blind_Swap';
    case 'K':
      return 'Seen_Swap';
    default:
      return null; // Should not happen
  }
};

/**
 * Modal for CONFIRMING special power usage after targets are selected on the board.
 */
const SpecialPower: React.FC<SpecialPowerProps> = ({
  specialCard,
  isSubmitting,
  onUseSpecialPower,
  onSkipSpecialPower,
  onCancelSelection,
  players,
  currentUserId, // Keep for potential future use, though opponent name comes via targetId
  powerTarget_OwnCardIndex,
  powerTarget_OpponentId,
  powerTarget_OpponentCardIndex
}) => {
  const powerType = determinePowerType(specialCard);

  const getPowerDescription = (type: CardPowerType | null): string => {
    switch (type) {
      case 'Peek_Own': return "Peek at one of your own face-down cards.";
      case 'Peek_Opponent': return "Peek at one face-down card of an opponent.";
      case 'Blind_Swap': return "Swap one of your cards with an opponent's card (blindly).";
      case 'Seen_Swap': return "Swap one of your cards with an opponent's card (revealing both)."; // Updated description
      default: return "Unknown power";
    }
  };

  // Determine if the necessary targets have been selected for the current power
  const targetsSelected = (): boolean => {
    switch (powerType) {
      case 'Peek_Own':
        return powerTarget_OwnCardIndex !== null;
      case 'Peek_Opponent':
        return powerTarget_OpponentId !== null && powerTarget_OpponentCardIndex !== null;
      case 'Blind_Swap':
      case 'Seen_Swap':
        return powerTarget_OwnCardIndex !== null && powerTarget_OpponentId !== null && powerTarget_OpponentCardIndex !== null;
      default:
        return false;
    }
  };

  const getTargetSummary = (): string => {
    if (!targetsSelected()) {
      // Add more detailed debugging info to help players understand what they need to select
      switch (powerType) {
        case 'Peek_Own':
          return `Select one of your cards to peek at. ${powerTarget_OwnCardIndex === null ? 'No card selected yet.' : ''}`;
        case 'Peek_Opponent':
          return `Select an opponent's card to peek at. ${powerTarget_OpponentId === null ? 'Select an opponent first.' : powerTarget_OpponentCardIndex === null ? 'Now select their card.' : ''}`;
        case 'Blind_Swap':
        case 'Seen_Swap':
          let msg = `Select one of your cards and one opponent's card to swap. `;
          if (powerTarget_OwnCardIndex === null) msg += 'Select your card first. ';
          else if (powerTarget_OpponentId === null) msg += 'Now select an opponent. ';
          else if (powerTarget_OpponentCardIndex === null) msg += 'Now select their card. ';
          return msg;
        default:
          return "Select target(s) by clicking on the game board.";
      }
    }

    const opponentUsername = powerTarget_OpponentId ? getPlayerUsername(players, powerTarget_OpponentId) : 'Opponent';

    switch (powerType) {
      case 'Peek_Own':
        return `You chose to peek at your card position ${powerTarget_OwnCardIndex! + 1}.`;
      case 'Peek_Opponent':
        return `You chose to peek at ${opponentUsername}'s card position ${powerTarget_OpponentCardIndex! + 1}.`;
      case 'Blind_Swap':
      case 'Seen_Swap':
        return `You chose to swap your card ${powerTarget_OwnCardIndex! + 1} with ${opponentUsername}'s card ${powerTarget_OpponentCardIndex! + 1}.`;
      default:
        return "Targets selected.";
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-40 p-4 flex justify-center pointer-events-none">
      <div className="bg-white/95 border-2 border-soft-pink rounded-lg p-5 max-w-md w-full shadow-lg pointer-events-auto">
        <div className="text-center mb-4">
          <span className="bg-soft-pink text-white px-3 py-1 rounded-full text-sm font-medium animate-pulse inline-block mb-2">SELECT TARGET ON GAME BOARD</span>
          <h3 className="text-xl font-bold text-deep-purple mb-1">Special Power: {specialCard.rank} of {specialCard.suit}</h3>
        </div>

        {/* Display Power Description */}
        <div className="bg-blue-50 p-3 rounded-md mb-3">
          <p className="text-blue-700 text-sm">
            <span className="font-medium">Effect: </span>
            {getPowerDescription(powerType)}
          </p>
        </div>

        {/* Display Target Summary */}
        <div className="bg-gray-50 p-3 rounded-md mb-3">
           <p className="text-gray-700 text-sm text-center">
             {getTargetSummary()}
           </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            className="w-full"
            onClick={onUseSpecialPower}
            disabled={isSubmitting || !powerType || !targetsSelected()} // Disable if targets not yet selected
          >
            {isSubmitting ? 'Using...' : `Confirm Use Power${!targetsSelected() ? ' (Select targets first)' : ''}`}
          </Button>
           <Button
            variant="secondary"
            className="w-full"
            onClick={onCancelSelection} // Button to clear the current selection
            disabled={isSubmitting}
          >
            Clear Selection / Change Target
          </Button>
          <Button
            variant="warning" // Changed skip to warning/secondary style
            className="w-full"
            onClick={onSkipSpecialPower}
            disabled={isSubmitting}
          >
            Skip Power Entirely
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SpecialPower;

// NOTE: Assumes existence of a helper function like this:
// src/utils/playerUtils.ts
// export const getPlayerUsername = (players: PlayerInfo[], userId: string): string => {
//   return players.find(p => p.userId === userId)?.username || 'Unknown Player';
// }; 
import React from 'react';
import { Card, Rank } from '../../types/scambodia';
import Button from '../common/Button';

interface SpecialPowerProps {
  specialCard: Card;
  isSubmitting: boolean;
  onUseSpecialPower: () => void;
  onSkipSpecialPower: () => void;
}

/**
 * Component to display and handle special power cards when they're discarded.
 * Shows the card and options to use or skip its power.
 */
const SpecialPower: React.FC<SpecialPowerProps> = ({
  specialCard,
  isSubmitting,
  onUseSpecialPower,
  onSkipSpecialPower
}) => {
  // Function to describe the power based on the card
  const getSpecialPowerDescription = (card: Card): string => {
    // Example power descriptions based on card rank
    switch (card.rank) {
      case 'J':
        return "Peek at any opponent's card";
      case 'Q':
        return "Exchange one of your cards with an opponent's card";
      case 'K':
        return "Protection from one card exchange attack";
      case '10':
        return "View all of your face-down cards";
      default:
        return "Use this card's special power";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-5 max-w-md w-full shadow-lg">
        <div className="text-center mb-4">
          <h3 className="text-xl font-bold text-deep-purple mb-2">Special Power Available!</h3>
          <p className="text-gray-600">You discarded a card with a special power.</p>
        </div>

        <div className="flex justify-center mb-6">
          {/* Display the special card */}
          <div className="w-24 h-36 bg-gradient-to-br from-deep-purple to-soft-pink rounded-lg shadow-md relative">
            <div className="absolute inset-1 bg-white rounded-md flex items-center justify-center">
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold text-deep-purple">
                  {specialCard.rank}
                </span>
                <span className="text-deep-purple text-xs">
                  {specialCard.suit}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 p-3 rounded-md mb-6">
          <p className="text-blue-700 text-sm">
            <span className="font-medium">Power: </span>
            {getSpecialPowerDescription(specialCard)}
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="primary"
            className="flex-1"
            onClick={onUseSpecialPower}
            disabled={isSubmitting}
          >
            Use Power
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onSkipSpecialPower}
            disabled={isSubmitting}
          >
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SpecialPower; 
import React from 'react';
import { CardPosition } from '../../types/scambodia';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';

interface GameControlsProps {
  isMyTurn: boolean;
  currentPhase: string;
  selectedCardPosition: CardPosition | null;
  hasDrawnCard: boolean;
  drawnFromDiscard: boolean; // Whether current drawn card is from discard pile
  isSubmittingAction: boolean;
  onDrawFromDeck: () => void;
  onDrawFromDiscard: () => void;
  onExchangeCard: (position: CardPosition) => void;
  onDiscardDrawnCard: () => void;
  onAttemptMatch: (position: CardPosition) => void;
  onDeclareScambodia: () => void;
  onUseSpecialPower: () => void;
  canDeclareScambodia: boolean;
}

/**
 * Component that provides action buttons based on the current game phase and selected card.
 */
const GameControls: React.FC<GameControlsProps> = ({
  isMyTurn,
  currentPhase,
  selectedCardPosition,
  hasDrawnCard,
  drawnFromDiscard,
  isSubmittingAction,
  onDrawFromDeck,
  onDrawFromDiscard,
  onExchangeCard,
  onDiscardDrawnCard,
  onAttemptMatch,
  onDeclareScambodia,
  onUseSpecialPower,
  canDeclareScambodia
}) => {
  if (!isMyTurn) {
    return (
      <div className="text-center p-3 bg-gray-50 rounded-lg">
        <p className="text-gray-600 italic">Waiting for other player's turn...</p>
      </div>
    );
  }

  if (isSubmittingAction) {
    return (
      <div className="text-center p-3 bg-gray-50 rounded-lg">
        <div className="flex justify-center items-center">
          <LoadingSpinner size="small" />
          <span className="ml-2 text-gray-600">Processing action...</span>
        </div>
      </div>
    );
  }

  // Initial draw phase
  if (currentPhase === 'Playing' && !hasDrawnCard) {
    return (
      <div className="p-3 bg-white rounded-lg shadow-sm">
        <h3 className="text-deep-purple font-semibold mb-2 text-center">Your Action</h3>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button
            variant="primary"
            onClick={onDrawFromDeck}
            disabled={isSubmittingAction}
          >
            Draw from Deck
          </Button>
          <Button
            variant="secondary"
            onClick={onDrawFromDiscard}
            disabled={isSubmittingAction}
          >
            Draw from Discard
          </Button>
          {canDeclareScambodia && (
            <Button
              variant="primary"
              onClick={onDeclareScambodia}
              disabled={isSubmittingAction}
            >
              Declare Scambodia
            </Button>
          )}
        </div>
      </div>
    );
  }

  // After drawing a card - Exchange or Discard
  if (currentPhase === 'Playing' && hasDrawnCard && selectedCardPosition === null) {
    return (
      <div className="p-3 bg-white rounded-lg shadow-sm">
        <h3 className="text-deep-purple font-semibold mb-2 text-center">
          {drawnFromDiscard ? 'Select a card to exchange with' : 'Select an action'}
        </h3>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {!drawnFromDiscard && (
            <Button
              variant="secondary"
              onClick={onDiscardDrawnCard}
              disabled={isSubmittingAction}
            >
              Discard Drawn Card
            </Button>
          )}
          <p className="text-sm text-gray-600 mt-2 text-center">
            {drawnFromDiscard 
              ? 'Click on one of your face-down cards to exchange with the drawn card' 
              : 'Select a face-down card to exchange, or discard the drawn card'}
          </p>
        </div>
      </div>
    );
  }

  // Card selected for action
  if (currentPhase === 'Playing' && hasDrawnCard && selectedCardPosition !== null) {
    return (
      <div className="p-3 bg-white rounded-lg shadow-sm">
        <h3 className="text-deep-purple font-semibold mb-2 text-center">Confirm Action</h3>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button
            variant="primary"
            onClick={() => onExchangeCard(selectedCardPosition)}
            disabled={isSubmittingAction}
          >
            Exchange with Card {selectedCardPosition + 1}
          </Button>
          <Button
            variant="secondary"
            onClick={() => onAttemptMatch(selectedCardPosition)}
            disabled={isSubmittingAction || drawnFromDiscard}
          >
            Try to Match Card {selectedCardPosition + 1}
          </Button>
        </div>
      </div>
    );
  }

  // Special powers
  if (currentPhase === 'SpecialPower') {
    return (
      <div className="p-3 bg-white rounded-lg shadow-sm">
        <h3 className="text-deep-purple font-semibold mb-2 text-center">Special Power</h3>
        <div className="text-center mb-2">
          <p className="text-sm text-gray-600">You discarded a special card! Would you like to use its power?</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button
            variant="primary"
            onClick={onUseSpecialPower}
            disabled={isSubmittingAction}
          >
            Use Power
          </Button>
          <Button
            variant="secondary"
            onClick={onDiscardDrawnCard}
            disabled={isSubmittingAction}
          >
            Skip
          </Button>
        </div>
      </div>
    );
  }

  // Other phases (Scoring, FinalTurn, etc.)
  return (
    <div className="text-center p-3 bg-gray-50 rounded-lg">
      <p className="text-gray-600 italic">
        {currentPhase === 'Setup' && 'Game is being set up...'}
        {currentPhase === 'FinalTurn' && 'Final turns after Scambodia was declared...'}
        {currentPhase === 'Scoring' && 'Calculating scores...'}
        {currentPhase === 'Complete' && 'Round complete. Preparing next round...'}
      </p>
    </div>
  );
};

export default GameControls;

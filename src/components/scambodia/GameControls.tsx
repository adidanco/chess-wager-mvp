import React from 'react';
import Button from '../common/Button';
import { CardPosition, RoundPhase } from '../../types/scambodia';

interface GameControlsProps {
  isMyTurn: boolean;
  currentPhase: string;
  selectedCardPosition: CardPosition | null;
  hasDrawnCard: boolean;
  drawnFromDiscard: boolean;
  isSubmitting: boolean;
  onDrawFromDeck: () => void;
  onDrawFromDiscard: () => void;
  onExchangeCard: () => void;
  onDiscardDrawnCard: () => void;
  onAttemptMatch: () => void;
  onDeclareScambodia: () => void;
  onInitialPeek?: () => void;
  onIgnorePower?: () => void;
  canDeclareScambodia: boolean;
  disabled: boolean;
  isInitialPeekPhase?: boolean;
  onRedeemPower?: () => void;
}

/**
 * Game controls for player actions.
 * Shows different controls based on game state and current player's turn.
 */
const GameControls: React.FC<GameControlsProps> = ({
  isMyTurn,
  currentPhase,
  selectedCardPosition,
  hasDrawnCard,
  drawnFromDiscard,
  isSubmitting,
  onDrawFromDeck,
  onDrawFromDiscard,
  onExchangeCard,
  onDiscardDrawnCard,
  onAttemptMatch,
  onDeclareScambodia,
  onInitialPeek,
  onIgnorePower,
  canDeclareScambodia,
  disabled,
  isInitialPeekPhase,
  onRedeemPower
}) => {
  // Setup phase (not yet playing)
  if (currentPhase === 'Setup') {
    return (
      <div className="flex justify-center space-x-2">
        {onInitialPeek && !isInitialPeekPhase && (
          <button
            onClick={onInitialPeek}
            disabled={isSubmitting}
            className="bg-deep-purple hover:bg-soft-pink text-white px-4 py-2 rounded-lg shadow transition-colors disabled:opacity-50"
          >
            Peek at Bottom Cards
          </button>
        )}
        {isInitialPeekPhase && (
          <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg">
            Peeking at bottom cards... {isInitialPeekPhase ? 'Wait for all players to peek' : 'Waiting for game to start'}
          </div>
        )}
      </div>
    );
  }

  // Don't show controls if not player's turn or not in playing phase
  if (!isMyTurn) {
    return (
      <div className="flex justify-center">
        <div className="px-4 py-2 bg-gray-100 text-gray-500 rounded-lg">
          Waiting for opponent's turn
        </div>
      </div>
    );
  }

  // --- Determine Current Action Set based on props --- 
  // Check explicitly if onRedeemPower function is provided to determine if power decision is pending
  const isPowerDecisionPending = typeof onRedeemPower === 'function';

  let actionSet: 'Draw/Declare' | 'Redeem/Ignore' | 'StandardActions' | 'Waiting' = 'Waiting';
  if (isMyTurn) {
    if (!hasDrawnCard) {
      actionSet = 'Draw/Declare';
    } else if (isPowerDecisionPending) { // Use the explicit check
      actionSet = 'Redeem/Ignore';
    } else {
      actionSet = 'StandardActions';
    }
  }

  // --- Render based on Action Set --- 

  // Render Draw / Declare Scambodia / Attempt Match Buttons
  if (actionSet === 'Draw/Declare') {
    return (
      <div className="flex flex-wrap justify-center items-center gap-3">
        <Button 
          variant="cta" 
          onClick={onDrawFromDeck} 
          disabled={disabled || isSubmitting}
          loading={isSubmitting}
          className="flex-grow sm:flex-grow-0"
        >
          Draw from Deck
        </Button>
        <Button 
          variant="secondary"
          onClick={onDrawFromDiscard} 
          disabled={disabled || isSubmitting}
          loading={isSubmitting}
          className="flex-grow sm:flex-grow-0"
        >
          Draw from Discard
        </Button>
        <Button 
          variant="secondary" 
          onClick={onAttemptMatch} 
          disabled={selectedCardPosition === null || disabled || isSubmitting} 
          loading={isSubmitting}
          className="flex-grow sm:flex-grow-0"
        >
          Attempt Match {selectedCardPosition !== null ? `(#${selectedCardPosition + 1})` : ''}
        </Button>
        {canDeclareScambodia && (
          <Button 
            variant="warning" 
            onClick={onDeclareScambodia} 
            disabled={disabled || isSubmitting}
            loading={isSubmitting}
            className="flex-grow sm:flex-grow-0"
          >
            Declare Scambodia
          </Button>
        )}
      </div>
    );
  }

  // Render Redeem Power / Ignore Action Buttons
  if (actionSet === 'Redeem/Ignore') {
    return (
      <div className="flex flex-wrap justify-center items-center gap-3">
        {/* Only show Redeem Power button if the handler exists */}
        {onRedeemPower && (
          <Button 
            variant="primary" 
            onClick={onRedeemPower}
            disabled={disabled || isSubmitting}
            loading={isSubmitting}
            className="flex-grow sm:flex-grow-0"
          >
            Redeem Power
          </Button>
        )}
        {/* Explicit Ignore Power */}
        {onIgnorePower && (
          <Button
            variant="danger"
            onClick={onIgnorePower}
            disabled={disabled || isSubmitting}
            loading={isSubmitting}
            className="flex-grow sm:flex-grow-0"
          >
            Ignore Power
          </Button>
        )}
        <Button 
          variant="secondary" 
          onClick={onExchangeCard} 
          disabled={(!hasDrawnCard) || selectedCardPosition === null || disabled || isSubmitting}
          loading={isSubmitting}
          className="flex-grow sm:flex-grow-0"
          title="Choose this to ignore the power"
        >
          Exchange Card {selectedCardPosition !== null ? `(#${selectedCardPosition + 1})` : ''} (Ignore Power)
        </Button>
        <Button 
          variant="secondary" 
          onClick={onDiscardDrawnCard} 
          disabled={!hasDrawnCard || disabled || isSubmitting}
          loading={isSubmitting}
          className="flex-grow sm:flex-grow-0"
          title="Choose this to ignore the power"
        >
          Discard Drawn (Ignore Power)
        </Button>
      </div>
    );
  }

  // Render Standard Action Buttons (Exchange, Discard, Match)
  if (actionSet === 'StandardActions') {
    return (
      <div className="flex flex-wrap justify-center items-center gap-3">
        <Button 
          variant="primary" 
          onClick={onExchangeCard} 
          disabled={(!hasDrawnCard) || selectedCardPosition === null || disabled || isSubmitting}
          loading={isSubmitting}
          className="flex-grow sm:flex-grow-0"
        >
          Exchange Card {selectedCardPosition !== null ? `(#${selectedCardPosition + 1})` : ''}
        </Button>
        <Button 
          variant="secondary" 
          onClick={onDiscardDrawnCard} 
          disabled={!hasDrawnCard || disabled || isSubmitting}
          loading={isSubmitting}
          className="flex-grow sm:flex-grow-0"
        >
          Discard Drawn
        </Button>
      </div>
    );
  }

  // Fallback / Waiting 
  return (
     <div className="text-center p-3">
        <p className="text-gray-500 italic">Waiting for action...</p>
      </div>
  );
};

export default GameControls;

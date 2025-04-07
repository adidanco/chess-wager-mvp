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
  canDeclareScambodia: boolean;
  disabled: boolean;
  isInitialPeekPhase?: boolean;
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
  canDeclareScambodia,
  disabled,
  isInitialPeekPhase
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

  // Show draw/declare actions if it IS the playing phase and card NOT drawn yet
  if (currentPhase === 'Playing' && !hasDrawnCard) {
    return (
      <div className="flex flex-wrap justify-center items-center gap-3">
        <Button 
          variant="primary" 
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

  // Show post-draw actions if card HAS been drawn (Playing or FinalTurn phase)
  if (hasDrawnCard) {
    return (
      <div className="flex flex-wrap justify-center items-center gap-3">
        <Button 
          variant="primary" 
          onClick={onExchangeCard} 
          // Disable if no card is selected in hand
          disabled={selectedCardPosition === null || disabled || isSubmitting}
          loading={isSubmitting}
          className="flex-grow sm:flex-grow-0"
        >
          Exchange Card {selectedCardPosition !== null ? `(#${selectedCardPosition + 1})` : ''}
        </Button>
        <Button 
          variant="secondary" 
          onClick={onDiscardDrawnCard} 
          // Can always discard the drawn card
          disabled={disabled || isSubmitting}
          loading={isSubmitting}
          className="flex-grow sm:flex-grow-0"
        >
          Discard Drawn
        </Button>
        <Button 
          variant="secondary" 
          onClick={onAttemptMatch} 
          // Disable if no card selected, or if drawn from discard (match only vs deck draw? Check rules)
          disabled={selectedCardPosition === null || disabled || isSubmitting || drawnFromDiscard} 
          loading={isSubmitting}
          className="flex-grow sm:flex-grow-0"
        >
          Attempt Match {selectedCardPosition !== null ? `(#${selectedCardPosition + 1})` : ''}
        </Button>
      </div>
    );
  }

  // Fallback for unexpected states
  return (
     <div className="text-center p-3">
        <p className="text-gray-500 italic">Waiting for action...</p>
      </div>
  );
};

export default GameControls;

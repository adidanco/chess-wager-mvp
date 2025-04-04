import React, { useState, useMemo } from 'react';
import { Card, TrickCard, Suit } from '../../types/rangvaar';
import CardDisplay from './CardDisplay';
import { isCardPlayable } from '../../services/rangvaarService'; // Import the validation logic helper if exposed

interface PlayerHandProps {
  hand: Card[];
  playCard: (cardId: string) => Promise<void>;
  isMyTurn: boolean;
  currentTrick: TrickCard[];
  trumpSuit?: Suit;
  isSubmitting: boolean; // Is an action currently being processed?
}

const PlayerHand: React.FC<PlayerHandProps> = ({ 
  hand, 
  playCard, 
  isMyTurn, 
  currentTrick,
  trumpSuit,
  isSubmitting
}) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Determine playability for each card only when relevant props change
  const playableStatus = useMemo(() => {
      const status: { [cardId: string]: boolean } = {};
      // Determine playability only if it's the player's turn
      if (isMyTurn) {
          hand.forEach(card => {
              // Use the imported validation function
              status[card.id] = isCardPlayable(card, hand, currentTrick, trumpSuit);
          });
      } else {
          hand.forEach(card => { status[card.id] = false; }); // Not playable if not turn
      }
      return status;
  }, [hand, isMyTurn, currentTrick, trumpSuit]); // Dependencies

  const handleCardClick = (cardId: string) => {
      if (isMyTurn && playableStatus[cardId]) {
          setSelectedCardId(prevId => prevId === cardId ? null : cardId); // Toggle selection
      }
  };

  const handlePlaySelectedCard = () => {
    if (selectedCardId && isMyTurn && !isSubmitting && playableStatus[selectedCardId]) {
      playCard(selectedCardId);
      setSelectedCardId(null); // Clear selection after playing
    }
  };

  // Sort hand for display (e.g., by suit then rank)
  // TODO: Implement sorting if desired
  const sortedHand = [...hand]; 

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-wrap justify-center gap-2 mb-4">
        {sortedHand.map(card => (
          <CardDisplay 
            key={card.id}
            card={card}
            onClick={handleCardClick}
            isSelected={selectedCardId === card.id}
            isPlayable={playableStatus[card.id]}
            isDisabled={!isMyTurn || isSubmitting} // Disable if not turn or action ongoing
            size="medium"
          />
        ))}
      </div>
      {isMyTurn && selectedCardId && (
        <button 
          onClick={handlePlaySelectedCard}
          disabled={isSubmitting || !playableStatus[selectedCardId]}
          className="bg-emerald-600 text-white py-2 px-6 rounded-md font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          Play Selected Card
        </button>
      )}
      {isMyTurn && !selectedCardId && (
         <p className="text-sm text-gray-600">Select a card to play.</p>
      )}
    </div>
  );
};

export default PlayerHand; 
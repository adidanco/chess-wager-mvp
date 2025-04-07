import React from 'react';
import PlayerHand from './PlayerHand';
import CardComponent from './CardComponent';
import OpponentHand from './OpponentHand';
import { ScambodiaGameState, Card, CardPosition, PlayerInfo } from '../../types/scambodia';

interface GameBoardProps {
  gameState: ScambodiaGameState;
  currentUserId: string;
  selectedCardPosition: CardPosition | null;
  onCardClick: (position: CardPosition, playerId?: string) => void;
  canSelectCard: boolean;
  drawnCard: Card | null;
  powerTargetSelection?: {
    type: 'own' | 'opponent';
    playerId?: string;
  };
  visibleCardPositions: CardPosition[];
}

/**
 * Main game board component.
 */
const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  currentUserId,
  selectedCardPosition,
  onCardClick,
  canSelectCard,
  drawnCard,
  powerTargetSelection,
  visibleCardPositions
}) => {
  const currentRound = gameState.rounds[gameState.currentRoundNumber];
  if (!currentRound) return null;

  const isMyTurn = currentRound.currentTurnPlayerId === currentUserId;
  const currentPhase = currentRound.phase;

  // Find the player's cards
  const myCards = currentRound.playerCards[currentUserId] || [];

  // Get all other players' cards
  const otherPlayers = gameState.players
    .filter(player => player.userId !== currentUserId)
    .map(player => ({
      ...player,
      cards: currentRound.playerCards[player.userId] || []
    }));

  const isTargetingOpponent = powerTargetSelection?.type === 'opponent';
  const isTargetingOwn = powerTargetSelection?.type === 'own';

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Center area (Deck and Discard pile) */}
      <div className="flex justify-center items-start gap-8 mb-8">
        {/* Deck */}
        <div className="text-center">
           <p className="text-sm text-gray-600 mb-1">Deck ({currentRound.drawPile.length})</p>
           <div className="w-20 h-28 bg-gradient-to-br from-deep-purple to-soft-pink rounded-lg shadow-md flex items-center justify-center text-white font-bold">
               DECK
           </div>
        </div>
        {/* Discard Pile */}
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-1">Discard</p>
          {currentRound.discardPile.length > 0 ? (
            <CardComponent
              card={currentRound.discardPile[currentRound.discardPile.length - 1]}
              faceUp={true}
              position={0}
              isPeeking={false}
              isSelected={false}
              disabled={true}
            />
          ) : (
            <div className="w-20 h-28 bg-gray-100 border border-dashed border-gray-300 rounded-lg flex items-center justify-center">
              <p className="text-xs text-gray-400">Empty</p>
            </div>
          )}
        </div>
        {/* Drawn Card */}
        {drawnCard && (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Drawn</p>
            <CardComponent card={drawnCard} faceUp={true} position={0} isPeeking={false} isSelected={false} disabled={true} />
          </div>
        )}
      </div>

      {/* Opponent hands */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {otherPlayers.map((player) => (
          <OpponentHand
            key={player.userId}
            player={player}
            cards={player.cards}
            onCardClick={onCardClick}
            isTargeting={isTargetingOpponent && powerTargetSelection?.playerId === player.userId}
          />
        ))}
      </div>

      {/* Player's hand */}
      <div className={`bg-white p-4 rounded-lg shadow-md border-2 ${isTargetingOwn ? 'border-soft-pink' : 'border-transparent'}`}>
        <h3 className="text-center text-sm font-medium mb-2">Your Hand {isTargetingOwn ? '(Select Card for Power)' : ''}</h3>
        <PlayerHand
          cards={myCards}
          visibleCardPositions={visibleCardPositions}
          selectedCardPosition={selectedCardPosition}
          isMyTurn={isMyTurn}
          onCardClick={onCardClick}
          canSelectCard={canSelectCard || isTargetingOwn}
          currentPhase={currentPhase}
          isTargeting={isTargetingOwn}
        />
      </div>

      {/* Game status indicators */}
      <div className="mt-4 text-center text-sm">
        <p className="text-gray-600">
          Round {gameState.currentRoundNumber + 1} of {gameState.totalRounds} | 
          Wager: ₹{gameState.wagerPerPlayer} | 
          {currentRound.playerDeclaredScambodia && (
            <span className="text-soft-pink font-medium">
              Scambodia declared by {gameState.players.find(p => p.userId === currentRound.playerDeclaredScambodia)?.username || 'Unknown'}
            </span>
          )}
        </p>
      </div>
    </div>
  );
};

export default GameBoard;
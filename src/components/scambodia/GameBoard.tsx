import React from 'react';
import PlayerHand from './PlayerHand';
import CardComponent from './CardComponent';
import { ScambodiaGameState, Card, CardPosition } from '../../types/scambodia';

interface GameBoardProps {
  gameState: ScambodiaGameState;
  currentUserId: string;
  selectedCardPosition: CardPosition | null;
  onCardClick: (position: CardPosition) => void;
  canSelectCard: boolean;
  drawnCard: Card | null;
}

/**
 * Main game board component that displays:
 * - Player's hand (face-down cards with visibility based on game rules)
 * - Opponent hands (face-down cards)
 * - Discard pile and deck
 * - Drawn card (if any)
 */
const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  currentUserId,
  selectedCardPosition,
  onCardClick,
  canSelectCard,
  drawnCard
}) => {
  const currentRound = gameState.rounds[gameState.currentRoundNumber];
  if (!currentRound) return null;

  const isMyTurn = currentRound.currentTurnPlayerId === currentUserId;
  const currentPhase = currentRound.phase;

  // Find the player's cards and visible cards
  const myCards = currentRound.playerCards[currentUserId] || [];
  const visibleCardPositions = currentRound.visibleToPlayer[currentUserId] || [];

  // Get all other players' cards
  const otherPlayers = gameState.players
    .filter(player => player.userId !== currentUserId)
    .map(player => ({
      userId: player.userId,
      username: player.username,
      cards: currentRound.playerCards[player.userId] || []
    }));

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Center area (Deck and Discard pile) */}
      <div className="flex justify-center items-center gap-8 mb-8">
        {/* Deck */}
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-1">Deck</p>
          <div className="relative">
            <div className="w-20 h-28 bg-gradient-to-br from-deep-purple to-soft-pink rounded-lg shadow-md">
              <div className="absolute inset-1 bg-white rounded-lg flex items-center justify-center">
                <div className="w-12 h-16 bg-soft-lavender rounded-md flex items-center justify-center">
                  <span className="text-deep-purple font-bold text-xl">S</span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-1 right-1 bg-white text-deep-purple text-xs font-bold px-1 rounded-full">
              {currentRound.drawPile.length}
            </div>
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

        {/* Drawn Card (if any) */}
        {drawnCard && (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Drawn Card</p>
            <CardComponent
              card={drawnCard}
              faceUp={true}
              position={0}
              isPeeking={false}
              isSelected={false}
              disabled={true}
            />
          </div>
        )}
      </div>

      {/* Opponent hands */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {otherPlayers.map(({ userId, username, cards }) => (
          <div key={userId} className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium">
                {username}
                {currentRound.currentTurnPlayerId === userId && (
                  <span className="ml-2 text-xs bg-green-500 text-white px-1 py-0.5 rounded-full animate-pulse">
                    Turn
                  </span>
                )}
              </h3>
              <span className="text-xs text-gray-500">
                {cards.filter(card => card !== null).length} cards
              </span>
            </div>
            
            {/* Display opponent cards (always face down) */}
            <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
              {/* We don't know the card content, just show face down cards */}
              {Array.from({ length: 4 }).map((_, index) => {
                const hasCard = index < cards.length && cards[index] !== null;
                return (
                  <div key={index} className="flex justify-center">
                    {hasCard ? (
                      <div className="w-14 h-20 bg-gradient-to-br from-deep-purple to-soft-pink rounded-md shadow-sm">
                        <div className="absolute inset-1 bg-white rounded-sm flex items-center justify-center">
                          <div className="w-8 h-12 bg-soft-lavender rounded-sm flex items-center justify-center">
                            <span className="text-deep-purple font-bold text-sm">S</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-14 h-20 bg-gray-100 border border-dashed border-gray-300 rounded-md flex items-center justify-center">
                        <p className="text-xs text-gray-400">Empty</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Player's hand */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        <PlayerHand
          cards={myCards}
          visibleCardPositions={visibleCardPositions}
          selectedCardPosition={selectedCardPosition}
          isMyTurn={isMyTurn}
          onCardClick={onCardClick}
          canSelectCard={canSelectCard}
          currentPhase={currentPhase}
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
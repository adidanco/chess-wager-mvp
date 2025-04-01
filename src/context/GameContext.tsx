import React, { createContext, useContext, useState, ReactNode } from 'react';
import { logger } from '../utils/logger';
import { GameData } from 'chessTypes';

interface GameContextValue {
  currentGame: GameData | null;
  isLoading: boolean;
  error: Error | string | null;
  updateGame: (game: GameData | null) => void;
  setLoading: (loading: boolean) => void;
  setGameError: (error: Error | string) => void;
  clearGame: () => void;
}

interface GameProviderProps {
  children: ReactNode;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

export function GameProvider({ children }: GameProviderProps): JSX.Element {
  const [currentGame, setCurrentGame] = useState<GameData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | string | null>(null);

  const updateGame = (game: GameData | null): void => {
    logger.info('GameContext', 'Updating game state', { gameId: game?.id });
    setCurrentGame(game);
  };

  const setLoading = (loading: boolean): void => {
    setIsLoading(loading);
  };

  const setGameError = (error: Error | string): void => {
    logger.error('GameContext', 'Game error', { error });
    setError(error);
  };

  const clearGame = (): void => {
    logger.info('GameContext', 'Clearing game state');
    setCurrentGame(null);
    setError(null);
  };

  const value: GameContextValue = {
    currentGame,
    isLoading,
    error,
    updateGame,
    setLoading,
    setGameError,
    clearGame
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
} 
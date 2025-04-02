import React, { createContext, useContext, useState } from 'react'
import { logger } from '../utils/logger'

const GameContext = createContext()

export function GameProvider({ children }) {
  const [currentGame, setCurrentGame] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const updateGame = (game) => {
    logger.info('GameContext', 'Updating game state', { gameId: game?.id })
    setCurrentGame(game)
  }

  const setLoading = (loading) => {
    setIsLoading(loading)
  }

  const setGameError = (error) => {
    logger.error('GameContext', 'Game error', { error })
    setError(error)
  }

  const clearGame = () => {
    logger.info('GameContext', 'Clearing game state')
    setCurrentGame(null)
    setError(null)
  }

  return (
    <GameContext.Provider value={{
      currentGame,
      isLoading,
      error,
      updateGame,
      setLoading,
      setGameError,
      clearGame
    }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGame must be used within a GameProvider')
  }
  return context
} 
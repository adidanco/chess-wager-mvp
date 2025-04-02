import { db } from "../firebase"
import { doc, getDoc, updateDoc, runTransaction, serverTimestamp } from "firebase/firestore"
import { logger } from "./logger"
import { networkHandler } from "./networkHandler"

class GameStateManager {
  constructor() {
    this.activeGames = new Map()
    this.setupCleanupInterval()
  }

  setupCleanupInterval() {
    // Clean up abandoned games every hour
    setInterval(() => {
      this.cleanupAbandonedGames()
    }, 60 * 60 * 1000)
  }

  async initializeGame(gameId) {
    logger.info('GameStateManager', 'Initializing game', { gameId })
    
    try {
      const gameRef = doc(db, "games", gameId)
      const gameSnap = await getDoc(gameRef)
      
      if (!gameSnap.exists()) {
        throw new Error("Game not found!")
      }
      
      const gameData = gameSnap.data()
      this.activeGames.set(gameId, {
        ...gameData,
        lastUpdate: Date.now(),
        moveHistory: gameData.moveHistory || [],
        clock: {
          white: gameData.whiteTime || 300000,
          black: gameData.blackTime || 300000,
          lastUpdate: Date.now()
        }
      })
      
      logger.info('GameStateManager', 'Game initialized', { gameId })
      return this.activeGames.get(gameId)
    } catch (error) {
      logger.error('GameStateManager', 'Error initializing game', { 
        error, 
        gameId 
      })
      throw error
    }
  }

  async updateGameState(gameId, newState, winner = null) {
    logger.info('GameStateManager', 'Updating game state', { 
      gameId, 
      newState, 
      winner 
    })
    
    try {
      await networkHandler.executeOperation(async () => {
        await runTransaction(db, async (transaction) => {
          const gameRef = doc(db, "games", gameId)
          const gameSnap = await transaction.get(gameRef)
          
          if (!gameSnap.exists()) {
            throw new Error("Game not found!")
          }
          
          const gameData = gameSnap.data()
          if (!this.validateStateTransition(gameData.status, newState)) {
            throw new Error("Invalid state transition!")
          }
          
          transaction.update(gameRef, {
            status: newState,
            winner: winner,
            updatedAt: serverTimestamp()
          })
        })
      })
      
      const game = this.activeGames.get(gameId)
      if (game) {
        game.status = newState
        game.winner = winner
        game.lastUpdate = Date.now()
      }
      
      logger.info('GameStateManager', 'Game state updated', { 
        gameId, 
        newState, 
        winner 
      })
      return true
    } catch (error) {
      logger.error('GameStateManager', 'Error updating game state', { 
        error, 
        gameId, 
        newState 
      })
      throw error
    }
  }

  validateStateTransition(currentState, newState) {
    const validTransitions = {
      waiting: ["in_progress", "cancelled"],
      in_progress: ["finished", "cancelled"],
      finished: [],
      cancelled: []
    }
    
    return validTransitions[currentState]?.includes(newState) || false
  }

  async updateClock(gameId, color, timeLeft) {
    const game = this.activeGames.get(gameId)
    if (!game) return
    
    const now = Date.now()
    const elapsed = now - game.clock.lastUpdate
    
    if (color === "w") {
      game.clock.white = Math.max(0, game.clock.white - elapsed)
    } else {
      game.clock.black = Math.max(0, game.clock.black - elapsed)
    }
    
    game.clock.lastUpdate = now
    
    try {
      await networkHandler.executeOperation(async () => {
        const gameRef = doc(db, "games", gameId)
        await updateDoc(gameRef, {
          [`${color}Time`]: game.clock[color],
          lastMoveTimestamp: serverTimestamp()
        })
      })
    } catch (error) {
      logger.error('GameStateManager', 'Error updating clock', { 
        error, 
        gameId, 
        color, 
        timeLeft 
      })
    }
  }

  async addMove(gameId, move) {
    const game = this.activeGames.get(gameId)
    if (!game) return
    
    game.moveHistory.push({
      ...move,
      timestamp: Date.now()
    })
    
    try {
      await networkHandler.executeOperation(async () => {
        const gameRef = doc(db, "games", gameId)
        await updateDoc(gameRef, {
          moveHistory: game.moveHistory,
          lastMoveTimestamp: serverTimestamp()
        })
      })
    } catch (error) {
      logger.error('GameStateManager', 'Error adding move', { 
        error, 
        gameId, 
        move 
      })
    }
  }

  async cleanupAbandonedGames() {
    logger.info('GameStateManager', 'Starting cleanup of abandoned games')
    
    try {
      const abandonedGames = Array.from(this.activeGames.entries())
        .filter(([_, game]) => {
          const age = Date.now() - game.lastUpdate
          return game.status === "waiting" && age > 24 * 60 * 60 * 1000
        })
      
      for (const [gameId, game] of abandonedGames) {
        await this.updateGameState(gameId, "cancelled")
        this.activeGames.delete(gameId)
      }
      
      logger.info('GameStateManager', 'Cleanup completed', { 
        gamesCleaned: abandonedGames.length 
      })
    } catch (error) {
      logger.error('GameStateManager', 'Error during cleanup', { error })
    }
  }

  getGameState(gameId) {
    return this.activeGames.get(gameId)
  }

  removeGame(gameId) {
    this.activeGames.delete(gameId)
  }
}

export const gameStateManager = new GameStateManager() 
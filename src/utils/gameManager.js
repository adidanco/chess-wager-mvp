import { db } from "../firebase"
import { doc, getDoc, updateDoc, runTransaction, serverTimestamp } from "firebase/firestore"
import { logger } from "./logger"
import { networkHandler } from "./networkHandler"
import { gameStateManager } from "./gameStateManager"
import { userManager } from "./userManager"
import Validation from "./validation"

class GameManager {
  constructor() {
    this.currentGame = null
  }
  
  async initializeGame(gameId) {
    logger.info('GameManager', 'Initializing game', { gameId })
    
    try {
      this.currentGame = await gameStateManager.initializeGame(gameId)
      logger.info('GameManager', 'Game initialized', { 
        gameId,
        status: this.currentGame.status,
        players: {
          white: this.currentGame.whitePlayer,
          black: this.currentGame.blackPlayer
        }
      })
      
      return this.currentGame
    } catch (error) {
      logger.error('GameManager', 'Error initializing game', { error, gameId })
      throw error
    }
  }
  
  async makeMove(move) {
    logger.info('GameManager', 'Making move', { 
      gameId: this.currentGame.id,
      move 
    })
    
    try {
      Validation.validateMove(move, this.currentGame)
      
      await networkHandler.executeOperation(async () => {
        await runTransaction(db, async (transaction) => {
          const gameRef = doc(db, "games", this.currentGame.id)
          const gameSnap = await transaction.get(gameRef)
          
          if (!gameSnap.exists()) {
            throw new Error("Game not found!")
          }
          
          const gameData = gameSnap.data()
          if (gameData.status !== 'in_progress') {
            throw new Error("Game is not in progress")
          }
          
          if (gameData.currentTurn !== move.color) {
            throw new Error("Not your turn")
          }
          
          transaction.update(gameRef, {
            moveHistory: [...gameData.moveHistory, move],
            currentTurn: move.color === 'w' ? 'b' : 'w',
            lastMoveTimestamp: serverTimestamp()
          })
        })
      })
      
      await gameStateManager.addMove(this.currentGame.id, move)
      this.currentGame.currentTurn = move.color === 'w' ? 'b' : 'w'
      
      logger.info('GameManager', 'Move made successfully', { 
        gameId: this.currentGame.id,
        currentTurn: this.currentGame.currentTurn
      })
      
      return true
    } catch (error) {
      logger.error('GameManager', 'Error making move', { 
        error, 
        gameId: this.currentGame.id,
        move 
      })
      throw error
    }
  }
  
  async resignGame(userId) {
    logger.info('GameManager', 'Resigning game', { 
      gameId: this.currentGame.id,
      userId 
    })
    
    try {
      const isWhite = this.currentGame.whitePlayer === userId
      const winner = isWhite ? this.currentGame.blackPlayer : this.currentGame.whitePlayer
      
      await gameStateManager.updateGameState(
        this.currentGame.id,
        'finished',
        winner
      )
      
      await userManager.updateStats(userId, false)
      await userManager.updateStats(winner, true)
      
      const wager = this.currentGame.wager
      await userManager.updateBalance(winner, wager)
      await userManager.updateBalance(userId, -wager)
      
      logger.info('GameManager', 'Game resigned', { 
        gameId: this.currentGame.id,
        winner,
        wager
      })
      
      return true
    } catch (error) {
      logger.error('GameManager', 'Error resigning game', { 
        error, 
        gameId: this.currentGame.id,
        userId 
      })
      throw error
    }
  }
  
  async offerDraw(userId) {
    logger.info('GameManager', 'Offering draw', { 
      gameId: this.currentGame.id,
      userId 
    })
    
    try {
      await networkHandler.executeOperation(async () => {
        const gameRef = doc(db, "games", this.currentGame.id)
        await updateDoc(gameRef, {
          drawOfferedBy: userId,
          updatedAt: serverTimestamp()
        })
      })
      
      this.currentGame.drawOfferedBy = userId
      
      logger.info('GameManager', 'Draw offered', { 
        gameId: this.currentGame.id,
        offeredBy: userId
      })
      
      return true
    } catch (error) {
      logger.error('GameManager', 'Error offering draw', { 
        error, 
        gameId: this.currentGame.id,
        userId 
      })
      throw error
    }
  }
  
  async acceptDraw(userId) {
    logger.info('GameManager', 'Accepting draw', { 
      gameId: this.currentGame.id,
      userId 
    })
    
    try {
      if (this.currentGame.drawOfferedBy === userId) {
        throw new Error("Cannot accept your own draw offer")
      }
      
      await gameStateManager.updateGameState(
        this.currentGame.id,
        'finished',
        null // null indicates a draw
      )
      
      await userManager.updateStats(userId, false)
      await userManager.updateStats(this.currentGame.drawOfferedBy, false)
      
      // Return wagers to both players
      const wager = this.currentGame.wager
      await userManager.updateBalance(userId, wager)
      await userManager.updateBalance(this.currentGame.drawOfferedBy, wager)
      
      logger.info('GameManager', 'Draw accepted', { 
        gameId: this.currentGame.id,
        wager
      })
      
      return true
    } catch (error) {
      logger.error('GameManager', 'Error accepting draw', { 
        error, 
        gameId: this.currentGame.id,
        userId 
      })
      throw error
    }
  }
  
  async cancelGame(userId) {
    logger.info('GameManager', 'Cancelling game', { 
      gameId: this.currentGame.id,
      userId 
    })
    
    try {
      if (this.currentGame.status !== 'waiting') {
        throw new Error("Can only cancel games that are waiting for players")
      }
      
      await gameStateManager.updateGameState(
        this.currentGame.id,
        'cancelled'
      )
      
      // Return wager to creator if game was cancelled
      if (this.currentGame.creator === userId) {
        await userManager.updateBalance(userId, this.currentGame.wager)
      }
      
      logger.info('GameManager', 'Game cancelled', { 
        gameId: this.currentGame.id,
        userId
      })
      
      return true
    } catch (error) {
      logger.error('GameManager', 'Error cancelling game', { 
        error, 
        gameId: this.currentGame.id,
        userId 
      })
      throw error
    }
  }
  
  getCurrentGame() {
    return this.currentGame
  }
  
  clearCurrentGame() {
    this.currentGame = null
  }
}

export const gameManager = new GameManager() 
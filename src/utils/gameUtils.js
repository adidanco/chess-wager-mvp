import { db } from "../firebase"
import { doc, getDoc, updateDoc, runTransaction, serverTimestamp } from "firebase/firestore"
import { logger } from "./logger"

export const validateGameState = (currentState, newState) => {
  const validTransitions = {
    waiting: ["in_progress", "cancelled"],
    in_progress: ["finished", "cancelled"],
    finished: [],
    cancelled: []
  }
  
  if (!validTransitions[currentState]?.includes(newState)) {
    logger.error('GameUtils', 'Invalid game state transition', { 
      currentState, 
      newState 
    })
    return false
  }
  return true
}

export const updateGameState = async (gameId, newState, winner = null) => {
  logger.info('GameUtils', 'Updating game state', { gameId, newState, winner })
  
  try {
    await runTransaction(db, async (transaction) => {
      const gameRef = doc(db, "games", gameId)
      const gameSnap = await transaction.get(gameRef)
      
      if (!gameSnap.exists()) {
        throw new Error("Game not found!")
      }
      
      const gameData = gameSnap.data()
      if (!validateGameState(gameData.status, newState)) {
        throw new Error("Invalid game state transition!")
      }
      
      transaction.update(gameRef, {
        status: newState,
        winner: winner,
        updatedAt: serverTimestamp()
      })
    })
    
    logger.info('GameUtils', 'Game state updated successfully', { gameId, newState })
    return true
  } catch (error) {
    logger.error('GameUtils', 'Error updating game state', { 
      error, 
      gameId, 
      newState 
    })
    throw error
  }
}

export const updateUserBalance = async (userId, amount, reason) => {
  logger.info('GameUtils', 'Updating user balance', { userId, amount, reason })
  
  try {
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, "users", userId)
      const userSnap = await transaction.get(userRef)
      
      if (!userSnap.exists()) {
        throw new Error("User not found!")
      }
      
      const userData = userSnap.data()
      const newBalance = (userData.balance || 0) + amount
      
      if (newBalance < 0) {
        throw new Error("Insufficient balance!")
      }
      
      transaction.update(userRef, {
        balance: newBalance,
        [`transactions.${Date.now()}`]: {
          amount,
          reason,
          timestamp: serverTimestamp()
        }
      })
    })
    
    logger.info('GameUtils', 'User balance updated successfully', { 
      userId, 
      amount, 
      reason 
    })
    return true
  } catch (error) {
    logger.error('GameUtils', 'Error updating user balance', { 
      error, 
      userId, 
      amount 
    })
    throw error
  }
}

export const handleGamePayout = async (gameId, winnerId, loserId, pot) => {
  logger.info('GameUtils', 'Processing game payout', { 
    gameId, 
    winnerId, 
    loserId, 
    pot 
  })
  
  try {
    await runTransaction(db, async (transaction) => {
      // Update winner's balance and stats
      const winnerRef = doc(db, "users", winnerId)
      const winnerSnap = await transaction.get(winnerRef)
      
      if (!winnerSnap.exists()) {
        throw new Error("Winner not found!")
      }
      
      const winnerData = winnerSnap.data()
      transaction.update(winnerRef, {
        balance: (winnerData.balance || 0) + pot,
        "stats.wins": (winnerData.stats?.wins || 0) + 1,
        [`transactions.${Date.now()}`]: {
          amount: pot,
          reason: "game_win",
          gameId,
          timestamp: serverTimestamp()
        }
      })
      
      // Update loser's stats
      const loserRef = doc(db, "users", loserId)
      const loserSnap = await transaction.get(loserRef)
      
      if (!loserSnap.exists()) {
        throw new Error("Loser not found!")
      }
      
      const loserData = loserSnap.data()
      transaction.update(loserRef, {
        "stats.losses": (loserData.stats?.losses || 0) + 1,
        [`transactions.${Date.now()}`]: {
          amount: -pot,
          reason: "game_loss",
          gameId,
          timestamp: serverTimestamp()
        }
      })
    })
    
    logger.info('GameUtils', 'Game payout processed successfully', { 
      gameId, 
      winnerId, 
      loserId, 
      pot 
    })
    return true
  } catch (error) {
    logger.error('GameUtils', 'Error processing game payout', { 
      error, 
      gameId, 
      winnerId, 
      loserId 
    })
    throw error
  }
}

export const handleDrawRefund = async (gameId, player1Id, player2Id, wager) => {
  logger.info('GameUtils', 'Processing draw refund', { 
    gameId, 
    player1Id, 
    player2Id, 
    wager 
  })
  
  try {
    await runTransaction(db, async (transaction) => {
      // Refund player1
      const player1Ref = doc(db, "users", player1Id)
      const player1Snap = await transaction.get(player1Ref)
      
      if (!player1Snap.exists()) {
        throw new Error("Player1 not found!")
      }
      
      const player1Data = player1Snap.data()
      transaction.update(player1Ref, {
        balance: (player1Data.balance || 0) + wager,
        "stats.draws": (player1Data.stats?.draws || 0) + 1,
        [`transactions.${Date.now()}`]: {
          amount: wager,
          reason: "draw_refund",
          gameId,
          timestamp: serverTimestamp()
        }
      })
      
      // Refund player2
      const player2Ref = doc(db, "users", player2Id)
      const player2Snap = await transaction.get(player2Ref)
      
      if (!player2Snap.exists()) {
        throw new Error("Player2 not found!")
      }
      
      const player2Data = player2Snap.data()
      transaction.update(player2Ref, {
        balance: (player2Data.balance || 0) + wager,
        "stats.draws": (player2Data.stats?.draws || 0) + 1,
        [`transactions.${Date.now()}`]: {
          amount: wager,
          reason: "draw_refund",
          gameId,
          timestamp: serverTimestamp()
        }
      })
    })
    
    logger.info('GameUtils', 'Draw refund processed successfully', { 
      gameId, 
      player1Id, 
      player2Id 
    })
    return true
  } catch (error) {
    logger.error('GameUtils', 'Error processing draw refund', { 
      error, 
      gameId, 
      player1Id, 
      player2Id 
    })
    throw error
  }
}

export const cleanupAbandonedGames = async () => {
  logger.info('GameUtils', 'Starting cleanup of abandoned games')
  
  try {
    const abandonedGamesRef = collection(db, "games")
    const q = query(
      abandonedGamesRef,
      where("status", "==", "waiting"),
      where("createdAt", "<=", new Date(Date.now() - 24 * 60 * 60 * 1000)) // 24 hours old
    )
    
    const snapshot = await getDocs(q)
    const batch = writeBatch(db)
    
    snapshot.forEach((doc) => {
      batch.update(doc.ref, {
        status: "cancelled",
        updatedAt: serverTimestamp()
      })
    })
    
    await batch.commit()
    logger.info('GameUtils', 'Cleanup completed', { 
      gamesCleaned: snapshot.size 
    })
    return snapshot.size
  } catch (error) {
    logger.error('GameUtils', 'Error cleaning up abandoned games', { error })
    throw error
  }
}

export const validateMove = (game, move) => {
  try {
    const chess = new Chess(game.currentFen)
    const result = chess.move(move)
    
    if (!result) {
      logger.warn('GameUtils', 'Invalid move attempted', { 
        gameId: game.id, 
        move 
      })
      return false
    }
    
    return true
  } catch (error) {
    logger.error('GameUtils', 'Error validating move', { 
      error, 
      gameId: game.id, 
      move 
    })
    return false
  }
} 
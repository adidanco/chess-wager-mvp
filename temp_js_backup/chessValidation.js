import { Chess } from 'chess.js'
import { logger } from './logger'

export const validateChessMove = (move, game) => {
  logger.debug('ChessValidation', 'Validating move', { 
    move, 
    gameId: game.id,
    currentTurn: game.currentTurn 
  })

  try {
    const chess = new Chess(game.fen)
    
    // Check if it's the correct player's turn
    if (move.color !== game.currentTurn) {
      throw new Error('Not your turn')
    }
    
    // Check if the move is legal
    const chessMove = chess.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion
    })
    
    if (!chessMove) {
      throw new Error('Illegal move')
    }
    
    // Check if the game is over
    if (chess.isGameOver()) {
      throw new Error('Game is over')
    }
    
    logger.debug('ChessValidation', 'Move validated successfully', { 
      move,
      gameId: game.id
    })
    
    return true
  } catch (error) {
    logger.error('ChessValidation', 'Move validation failed', { 
      error, 
      move, 
      gameId: game.id 
    })
    throw error
  }
} 
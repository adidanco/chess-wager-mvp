import { logger } from "./logger"

class Validation {
  static MIN_WAGER = 1
  static MAX_WAGER = 1000
  static MIN_USERNAME_LENGTH = 3
  static MAX_USERNAME_LENGTH = 20
  static USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/
  static MIN_PASSWORD_LENGTH = 6

  static validateWager(wager, userBalance) {
    logger.debug('Validation', 'Validating wager', { wager, userBalance })
    
    if (typeof wager !== 'number' || isNaN(wager)) {
      throw new Error('Wager must be a number')
    }
    
    if (wager < this.MIN_WAGER) {
      throw new Error(`Wager must be at least ${this.MIN_WAGER}`)
    }
    
    if (wager > this.MAX_WAGER) {
      throw new Error(`Wager cannot exceed ${this.MAX_WAGER}`)
    }
    
    if (wager > userBalance) {
      throw new Error('Insufficient balance')
    }
    
    return true
  }

  static validateUsername(username) {
    logger.debug('Validation', 'Validating username', { username })
    
    if (!username || typeof username !== 'string') {
      throw new Error('Username is required')
    }
    
    if (username.length < this.MIN_USERNAME_LENGTH) {
      throw new Error(`Username must be at least ${this.MIN_USERNAME_LENGTH} characters`)
    }
    
    if (username.length > this.MAX_USERNAME_LENGTH) {
      throw new Error(`Username cannot exceed ${this.MAX_USERNAME_LENGTH} characters`)
    }
    
    if (!this.USERNAME_PATTERN.test(username)) {
      throw new Error('Username can only contain letters, numbers, and underscores')
    }
    
    return true
  }

  static validatePassword(password) {
    logger.debug('Validation', 'Validating password')
    
    if (!password || typeof password !== 'string') {
      throw new Error('Password is required')
    }
    
    if (password.length < this.MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${this.MIN_PASSWORD_LENGTH} characters`)
    }
    
    return true
  }

  static validateGameState(game) {
    logger.debug('Validation', 'Validating game state', { gameId: game.id })
    
    if (!game) {
      throw new Error('Game is required')
    }
    
    if (!['waiting', 'in_progress', 'finished', 'cancelled'].includes(game.status)) {
      throw new Error('Invalid game status')
    }
    
    if (game.status === 'in_progress' && (!game.whitePlayer || !game.blackPlayer)) {
      throw new Error('Game cannot be in progress without both players')
    }
    
    if (game.status === 'finished' && !game.winner) {
      throw new Error('Finished game must have a winner')
    }
    
    return true
  }

  static validateMove(move, game) {
    logger.debug('Validation', 'Validating move', { 
      move, 
      gameId: game.id,
      currentTurn: game.currentTurn 
    })
    
    if (!move || typeof move !== 'object') {
      throw new Error('Invalid move format')
    }
    
    if (!move.from || !move.to) {
      throw new Error('Move must specify from and to positions')
    }
    
    if (game.status !== 'in_progress') {
      throw new Error('Cannot make moves in a game that is not in progress')
    }
    
    if (move.color !== game.currentTurn) {
      throw new Error('Not your turn')
    }
    
    return true
  }

  static validateTimeControl(timeControl) {
    logger.debug('Validation', 'Validating time control', { timeControl })
    
    if (!timeControl || typeof timeControl !== 'object') {
      throw new Error('Time control is required')
    }
    
    if (!timeControl.initial || timeControl.initial < 60) {
      throw new Error('Initial time must be at least 60 seconds')
    }
    
    if (timeControl.increment && timeControl.increment < 0) {
      throw new Error('Time increment cannot be negative')
    }
    
    return true
  }

  static sanitizeInput(input) {
    if (typeof input !== 'string') return input
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .slice(0, 1000) // Limit length
  }
}

export default Validation 
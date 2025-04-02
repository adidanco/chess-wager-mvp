import { db } from "../firebase"
import { doc, getDoc, updateDoc, runTransaction, increment, serverTimestamp } from "firebase/firestore"
import { logger } from "./logger"
import { networkHandler } from "./networkHandler"
import Validation from "./validation"

class UserManager {
  constructor() {
    this.userData = null
  }

  async initializeUser(userId) {
    logger.info('UserManager', 'Initializing user', { userId })
    
    try {
      const userRef = doc(db, "users", userId)
      const userSnap = await getDoc(userRef)
      
      if (!userSnap.exists()) {
        throw new Error("User not found!")
      }
      
      this.userData = userSnap.data()
      logger.info('UserManager', 'User initialized', { 
        userId,
        username: this.userData.username,
        balance: this.userData.balance
      })
      
      return this.userData
    } catch (error) {
      logger.error('UserManager', 'Error initializing user', { error, userId })
      throw error
    }
  }

  async updateBalance(userId, amount) {
    logger.info('UserManager', 'Updating balance', { userId, amount })
    
    try {
      await networkHandler.executeOperation(async () => {
        await runTransaction(db, async (transaction) => {
          const userRef = doc(db, "users", userId)
          const userSnap = await transaction.get(userRef)
          
          if (!userSnap.exists()) {
            throw new Error("User not found!")
          }
          
          const userData = userSnap.data()
          const newBalance = userData.balance + amount
          
          if (newBalance < 0) {
            throw new Error("Insufficient balance")
          }
          
          transaction.update(userRef, {
            balance: newBalance,
            updatedAt: serverTimestamp()
          })
        })
      })
      
      if (this.userData && this.userData.id === userId) {
        this.userData.balance += amount
      }
      
      logger.info('UserManager', 'Balance updated', { 
        userId, 
        newBalance: this.userData?.balance 
      })
      return true
    } catch (error) {
      logger.error('UserManager', 'Error updating balance', { error, userId, amount })
      throw error
    }
  }

  async updateStats(userId, isWinner) {
    logger.info('UserManager', 'Updating stats', { userId, isWinner })
    
    try {
      await networkHandler.executeOperation(async () => {
        const userRef = doc(db, "users", userId)
        await updateDoc(userRef, {
          gamesPlayed: increment(1),
          gamesWon: increment(isWinner ? 1 : 0),
          updatedAt: serverTimestamp()
        })
      })
      
      if (this.userData && this.userData.id === userId) {
        this.userData.gamesPlayed++
        if (isWinner) this.userData.gamesWon++
      }
      
      logger.info('UserManager', 'Stats updated', { 
        userId, 
        gamesPlayed: this.userData?.gamesPlayed,
        gamesWon: this.userData?.gamesWon
      })
      return true
    } catch (error) {
      logger.error('UserManager', 'Error updating stats', { error, userId, isWinner })
      throw error
    }
  }

  async updateProfile(userId, updates) {
    logger.info('UserManager', 'Updating profile', { userId, updates })
    
    try {
      if (updates.username) {
        Validation.validateUsername(updates.username)
      }
      
      await networkHandler.executeOperation(async () => {
        const userRef = doc(db, "users", userId)
        await updateDoc(userRef, {
          ...updates,
          updatedAt: serverTimestamp()
        })
      })
      
      if (this.userData && this.userData.id === userId) {
        this.userData = { ...this.userData, ...updates }
      }
      
      logger.info('UserManager', 'Profile updated', { userId })
      return true
    } catch (error) {
      logger.error('UserManager', 'Error updating profile', { error, userId, updates })
      throw error
    }
  }

  getUserData() {
    return this.userData
  }

  getBalance() {
    return this.userData?.balance || 0
  }

  getStats() {
    return {
      gamesPlayed: this.userData?.gamesPlayed || 0,
      gamesWon: this.userData?.gamesWon || 0,
      winRate: this.userData?.gamesPlayed 
        ? (this.userData.gamesWon / this.userData.gamesPlayed) * 100 
        : 0
    }
  }

  clearUserData() {
    this.userData = null
  }
}

export const userManager = new UserManager() 
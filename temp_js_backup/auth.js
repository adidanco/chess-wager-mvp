import { auth } from "../firebase"
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth"
import { logger } from "./logger"
import Validation from "./validation"

class AuthManager {
  constructor() {
    this.currentUser = null
    this.authStateUnsubscribe = null
    this.setupAuthStateListener()
  }

  setupAuthStateListener() {
    this.authStateUnsubscribe = onAuthStateChanged(auth, (user) => {
      this.currentUser = user
      logger.info('AuthManager', 'Auth state changed', { 
        userId: user?.uid,
        isAuthenticated: !!user 
      })
    })
  }

  async signUp(email, password, username) {
    logger.info('AuthManager', 'Attempting sign up', { email, username })
    
    try {
      Validation.validateUsername(username)
      Validation.validatePassword(password)
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      
      logger.info('AuthManager', 'Sign up successful', { 
        userId: user.uid,
        email: user.email 
      })
      
      return user
    } catch (error) {
      logger.error('AuthManager', 'Sign up failed', { error })
      throw this.handleAuthError(error)
    }
  }

  async signIn(email, password) {
    logger.info('AuthManager', 'Attempting sign in', { email })
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      
      logger.info('AuthManager', 'Sign in successful', { 
        userId: user.uid,
        email: user.email 
      })
      
      return user
    } catch (error) {
      logger.error('AuthManager', 'Sign in failed', { error })
      throw this.handleAuthError(error)
    }
  }

  async signOut() {
    logger.info('AuthManager', 'Attempting sign out')
    
    try {
      await signOut(auth)
      logger.info('AuthManager', 'Sign out successful')
    } catch (error) {
      logger.error('AuthManager', 'Sign out failed', { error })
      throw this.handleAuthError(error)
    }
  }

  getCurrentUser() {
    return this.currentUser
  }

  isAuthenticated() {
    return !!this.currentUser
  }

  handleAuthError(error) {
    let message = 'An error occurred during authentication'
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        message = 'This email is already registered'
        break
      case 'auth/invalid-email':
        message = 'Invalid email address'
        break
      case 'auth/operation-not-allowed':
        message = 'Email/password accounts are not enabled'
        break
      case 'auth/weak-password':
        message = 'Password is too weak'
        break
      case 'auth/user-disabled':
        message = 'This account has been disabled'
        break
      case 'auth/user-not-found':
        message = 'No account found with this email'
        break
      case 'auth/wrong-password':
        message = 'Incorrect password'
        break
      case 'auth/too-many-requests':
        message = 'Too many failed attempts. Please try again later'
        break
      case 'auth/network-request-failed':
        message = 'Network error. Please check your connection'
        break
      default:
        logger.error('AuthManager', 'Unhandled auth error', { error })
    }
    
    return new Error(message)
  }

  cleanup() {
    if (this.authStateUnsubscribe) {
      this.authStateUnsubscribe()
      this.authStateUnsubscribe = null
    }
  }
}

export const authManager = new AuthManager() 
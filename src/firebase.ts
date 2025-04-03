import { initializeApp } from "firebase/app"
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth"
import { getFirestore, enableIndexedDbPersistence, Firestore } from "firebase/firestore"
import { getFunctions, connectFunctionsEmulator } from "firebase/functions"
import { firebaseConfig } from "./firebaseConfig"
import { logger } from "./utils/logger"

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db: Firestore = getFirestore(app)

// Initialize Functions - use us-central1 region (default)
const functions = getFunctions(app)

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development' || 
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1';

// If in development mode, connect to emulator if available
if (isDevelopment) {
  try {
    // Uncomment this to use the Firebase emulator when running locally
    // connectFunctionsEmulator(functions, "localhost", 5001);
    logger.info("Firebase initialized in development mode")
  } catch (err) {
    const error = err as Error;
    logger.error("Error connecting to Functions emulator:", { message: error.message })
  }
}

// Set up auth persistence
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    logger.info("Firebase auth persistence enabled")
  })
  .catch((err: unknown) => {
    const error = err as Error;
    logger.error("Auth persistence error:", { message: error.message })
  })

// Enable Firestore persistence
enableIndexedDbPersistence(db).catch((err: { code: string }) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a time
    logger.warn('Firestore persistence failed: Multiple tabs open')
  } else if (err.code === 'unimplemented') {
    // The current browser doesn't support persistence
    logger.warn('Firestore persistence not available')
  }
})

// Force token refresh to ensure auth is valid when calling functions
auth.onAuthStateChanged(async (user) => {
  if (user) {
    try {
      // Force token refresh to ensure we have a fresh token when calling functions
      await user.getIdToken(true)
      logger.info("Auth token refreshed")
    } catch (err) {
      const error = err as Error;
      logger.error("Error refreshing auth token:", { message: error.message })
    }
  }
})

export { auth, db, functions } 
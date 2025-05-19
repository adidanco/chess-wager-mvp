import { initializeApp } from "firebase/app"
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth"
import { getFirestore, enableIndexedDbPersistence, Firestore } from "firebase/firestore"
import { getFunctions } from "firebase/functions"
import { firebaseConfig } from "./firebaseConfig"

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db: Firestore = getFirestore(app)
// Initialize Functions explicitly for us-central1
const functions = getFunctions(app, 'us-central1')

// Set up auth persistence
setPersistence(auth, browserLocalPersistence).catch((error: Error) => {
  console.error("Auth persistence error:", error)
})

// Enable Firestore persistence
enableIndexedDbPersistence(db).catch((err: { code: string }) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a time
    console.warn('Firestore persistence failed: Multiple tabs open')
  } else if (err.code === 'unimplemented') {
    // The current browser doesn't support persistence
    console.warn('Firestore persistence not available')
  }
})

export { auth, db, functions }
// src/firebase.js
import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { firebaseConfig } from "./firebaseConfig"

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Export services
export const auth = getAuth(app)
export const db = getFirestore(app)

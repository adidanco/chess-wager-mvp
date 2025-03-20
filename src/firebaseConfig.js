// src/firebaseConfig.js
import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

export const firebaseConfig = {
  apiKey: "AIzaSyC_UNXXoXMTKSHYvscImzjnLX_caRaq3fE",
  authDomain: "chess-wager-mvp.firebaseapp.com",
  projectId: "chess-wager-mvp",
  storageBucket: "chess-wager-mvp.appspot.com",
  messagingSenderId: "1024609648141",
  appId: "Y1:1024609648141:web:c1b360f32008eb7fe11f44",
  measurementId: "G-X6H6E8ZCX4"
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

export { auth, db }
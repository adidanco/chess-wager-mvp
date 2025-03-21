// ✅ ADDED: CreateGame page
import React, { useEffect, useState } from "react"  
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore"
import { auth, db } from "../firebase"
import { Chess } from "chess.js"
import { useNavigate } from "react-router-dom"
import { v4 as uuidv4 } from "uuid"   // for random game IDs
import { toast } from "react-hot-toast"

export default function CreateGame() {
  const navigate = useNavigate()
  // ✅ ADDED: Local state for the wager
  const [wager, setWager] = useState(5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const possibleWagers = [5, 10, 15, 30, 50]

  useEffect(() => {
    // If user is not logged in, redirect to login
    if (!auth.currentUser) {
      navigate("/login")
      return
    }
  }, [navigate])

  const handleCreateGame = async (e) => {
    e.preventDefault()
    if (!auth.currentUser) {
      toast.error("Please log in to create a game")
      return
    }

    try {
      // Single Firestore lookup for user data
      const userRef = doc(db, "users", auth.currentUser.uid)
      const userSnap = await getDoc(userRef)
      
      if (!userSnap.exists()) {
        toast.error("User data not found")
        return
      }

      const userData = userSnap.data()
      const currentBalance = userData.balance || 0

      // Validate wager amount
      if (wager <= 0) {
        toast.error("Wager must be greater than 0")
        return
      }

      if (wager > currentBalance) {
        toast.error("Insufficient balance")
        return
      }

      if (wager > 10000) {
        toast.error("Maximum wager is ₹10,000")
        return
      }

      // Create game with random color assignment
      const myColor = Math.random() < 0.5 ? "w" : "b"
      const gameRef = await addDoc(collection(db, "games"), {
        player1Id: auth.currentUser.uid,
        player1Color: myColor,
        player2Id: null,
        player2Color: myColor === "w" ? "b" : "w",
        wager: wager,
        pot: wager,
        status: "waiting",
        currentFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        currentTurn: "w",
        createdAt: serverTimestamp()
      })

      // Deduct wager from user's balance
      await updateDoc(userRef, {
        balance: currentBalance - wager
      })

      toast.success("Game created successfully!")
      navigate(`/game/${gameRef.id}`)
    } catch (err) {
      console.error("Error creating game:", err)
      toast.error("Failed to create game")
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold mb-4">Create New Game</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      
      <label className="mb-2">Select Wager:</label>
      <select
        className="border p-2 mb-4"
        value={wager}
        onChange={(e) => setWager(Number(e.target.value))}
        disabled={loading}
      >
        {possibleWagers.map((amt) => (
          <option key={amt} value={amt}>
            ₹{amt}
          </option>
        ))}
      </select>

      <div className="flex gap-2">
        <button
          onClick={handleCreateGame}
          disabled={loading}
          className={`bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loading ? 'Creating Game...' : 'Create a New Game'}
        </button>

        <button
          onClick={() => navigate("/")}
          disabled={loading}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

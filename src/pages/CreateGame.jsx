// ✅ ADDED: CreateGame page
import React, { useEffect } from "react"
import { doc, setDoc } from "firebase/firestore"
import { auth, db } from "../firebase"
import { Chess } from "chess.js"
import { useNavigate } from "react-router-dom"
import { v4 as uuidv4 } from "uuid"   // for random game IDs

export default function CreateGame() {
  const navigate = useNavigate()

  useEffect(() => {
    // If user is not logged in, redirect to login
    if (!auth.currentUser) {
      navigate("/login")
      return
    }
  }, [navigate])

  const handleCreateGame = async () => {
    try {
      // 1. Generate a unique game ID
      const gameId = uuidv4()

      // 2. Create a chess instance to get the standard start FEN
      const chess = new Chess()
      const startFen = chess.fen()

      // 3. Create the game doc in Firestore
      await setDoc(doc(db, "games", gameId), {
        player1Id: auth.currentUser.uid,
        player2Id: null,
        currentFen: startFen,
        status: "waiting",
      })

      // 4. Navigate to the game page (we'll implement next)
      navigate(`/game/${gameId}`)
    } catch (err) {
      console.error("Error creating game:", err)
    }
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <button
        onClick={handleCreateGame}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Create a New Game
      </button>
    </div>
  )
}

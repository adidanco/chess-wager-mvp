// ✅ ADDED: JoinGame page
import React, { useEffect, useState } from "react"
import { auth, db } from "../firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { useNavigate } from "react-router-dom"

export default function JoinGame() {
  const [gameIdInput, setGameIdInput] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    // If user is not logged in, redirect to login
    if (!auth.currentUser) {
      navigate("/login")
      return
    }
  }, [navigate])

  const handleJoin = async () => {
    if (!gameIdInput) return

    try {
      const gameRef = doc(db, "games", gameIdInput)
      const gameSnap = await getDoc(gameRef)
      if (!gameSnap.exists()) {
        alert("Game not found!")
        return
      }

      const gameData = gameSnap.data()
      // If there's already a player2Id, we can't join
      if (gameData.player2Id) {
        alert("Game already has two players!")
        return
      }

      // Check player2's balance against gameData.wager
      const userRef = doc(db, "users", auth.currentUser.uid)
      const userSnap = await getDoc(userRef)
      if (!userSnap.exists()) {
        alert("Your user record not found!")
        return
      }
      const player2Data = userSnap.data()
      const player2Balance = player2Data.balance || 0

      if (player2Balance < gameData.wager) {
        alert(`Insufficient balance! You only have ₹${player2Balance}`)
        return
      }

      // Deduct wager from player2
      await updateDoc(userRef, {
        balance: player2Balance - gameData.wager
      })

      // Mark game as ongoing
      await updateDoc(gameRef, {
        player2Id: auth.currentUser.uid,
        status: "ongoing"
      })

      // Go to the game page
      navigate(`/game/${gameIdInput}`)
    } catch (err) {
      console.error("Error joining game:", err)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <input
        className="border p-2 mb-4"
        placeholder="Enter Game ID"
        value={gameIdInput}
        onChange={(e) => setGameIdInput(e.target.value)}
      />
      <button
        onClick={handleJoin}
        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
      >
        Join Game
      </button>
    </div>
  )
}

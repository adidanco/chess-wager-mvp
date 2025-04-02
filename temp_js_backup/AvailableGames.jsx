import React, { useEffect, useState } from "react"
import { collection, query, where, onSnapshot, orderBy, getDocs } from "firebase/firestore"
import { db, auth } from "../firebase"
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"

export default function AvailableGames() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!auth.currentUser) {
      navigate("/login")
      return
    }

    // Query for waiting games, ordered by creation time
    const gamesRef = collection(db, "games")
    const q = query(
      gamesRef,
      where("status", "==", "waiting"),
      orderBy("createdAt", "desc")
    )

    // First, get initial data
    getDocs(q).then((snapshot) => {
      const gamesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setGames(gamesList)
      setLoading(false)
    }).catch((error) => {
      console.error("Error fetching games:", error)
      toast.error("Failed to load available games")
      setLoading(false)
    })

    // Then set up real-time listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const gamesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setGames(gamesList)
      setLoading(false)
    }, (error) => {
      console.error("Error in real-time listener:", error)
      toast.error("Error updating game list")
    })

    return () => unsubscribe()
  }, [navigate])

  const handleJoinGame = async (gameId) => {
    try {
      const gameRef = doc(db, "games", gameId)
      const gameSnap = await getDoc(gameRef)
      
      if (!gameSnap.exists()) {
        toast.error("Game not found")
        return
      }

      const gameData = gameSnap.data()
      
      // Check if game is still waiting
      if (gameData.status !== "waiting") {
        toast.error("This game is no longer available")
        return
      }

      // Check if user is trying to join their own game
      if (gameData.player1Id === auth.currentUser.uid) {
        toast.error("You cannot join your own game")
        return
      }

      const userRef = doc(db, "users", auth.currentUser.uid)
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) {
        toast.error("User data not found")
        return
      }

      const userData = userSnap.data()
      const currentBalance = userData.balance || 0

      if (currentBalance < gameData.wager) {
        toast.error("Insufficient balance to join this game")
        return
      }

      // Update game with player2 info
      await updateDoc(gameRef, {
        player2Id: auth.currentUser.uid,
        status: "in_progress"
      })

      // Deduct wager from player2's balance
      await updateDoc(userRef, {
        balance: currentBalance - gameData.wager
      })

      toast.success("Successfully joined game!")
      navigate(`/game/${gameId}`)
    } catch (err) {
      console.error("Error joining game:", err)
      toast.error("Failed to join game")
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-lg">Loading available games...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Available Games</h1>
      
      {games.length === 0 ? (
        <p className="text-gray-500 text-center">No available games at the moment</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <div key={game.id} className="bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between items-center mb-2">
                <span className="text-green-600 font-semibold">₹{game.wager}</span>
                <span className="text-sm text-gray-500">
                  {new Date(game.createdAt?.toDate()).toLocaleString()}
                </span>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Created by: {game.player1Id === auth.currentUser.uid ? "You" : "Another player"}
                </p>
              </div>
              <button
                onClick={() => handleJoinGame(game.id)}
                className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition-colors"
              >
                Join Game
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 
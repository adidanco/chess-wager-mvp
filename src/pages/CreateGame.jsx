// CreateGame.jsx
import React, { useEffect, useState } from "react"  
import { collection, addDoc, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore"
import { auth, db } from "../firebase"
import { useNavigate } from "react-router-dom"
import { toast } from "react-hot-toast"
import { logger } from "../utils/logger"
import { Chess } from "chess.js"

export default function CreateGame() {
  const navigate = useNavigate()
  const [wager, setWager] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [userBalance, setUserBalance] = useState(null)

  useEffect(() => {
    // Check authentication
    if (!auth.currentUser) {
      logger.warn('CreateGame', 'No authenticated user')
      navigate("/login")
      return
    }

    // Fetch user's balance
    const fetchBalance = async () => {
      try {
        const userRef = doc(db, "users", auth.currentUser.uid)
        const userDoc = await getDoc(userRef)
        if (userDoc.exists()) {
          setUserBalance(userDoc.data().balance || 0)
        } else {
          throw new Error('User document not found')
        }
      } catch (error) {
        logger.error('CreateGame', 'Error fetching user balance', { error })
        toast.error("Error fetching balance!")
        navigate("/")
      }
    }

    fetchBalance()
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!wager || isCreating) return

    setIsCreating(true)
    const wagerAmount = parseInt(wager)

    try {
      // Check user balance
      const userRef = doc(db, "users", auth.currentUser.uid)
      const userSnap = await getDoc(userRef)
      if (!userSnap.exists()) {
        throw new Error("User document not found")
      }
      const userData = userSnap.data()
      if (!userData.balance || userData.balance < wagerAmount) {
        toast.error("Insufficient balance!")
        return
      }

      // Create a new Chess instance for initial position
      const chess = new Chess()
      const initialFen = chess.fen()

      // Create game document
      const gamesRef = collection(db, "games")
      const newGameDoc = await addDoc(gamesRef, {
        whitePlayer: auth.currentUser.uid,
        blackPlayer: null,
        wager: wagerAmount,
        status: "waiting",
        createdAt: serverTimestamp(),
        fen: initialFen,
        currentTurn: "w",
        whiteTime: 300000,
        blackTime: 300000,
        moveHistory: []
      })

      // Deduct wager from user's balance
      await updateDoc(userRef, {
        balance: userData.balance - wagerAmount
      })

      logger.info('CreateGame', 'Game created successfully', { 
        gameId: newGameDoc.id,
        userId: auth.currentUser.uid,
        wager: wagerAmount
      })

      toast.success("Game created! Waiting for opponent...")
      navigate(`/game/${newGameDoc.id}`)
    } catch (error) {
      logger.error('CreateGame', 'Error creating game', { error })
      toast.error("Error creating game!")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">Create New Game</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wager Amount (₹)
            </label>
            <input
              type="number"
              value={wager}
              onChange={(e) => setWager(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter wager amount"
              min="1"
              required
            />
            {userBalance !== null && (
              <p className="mt-1 text-sm text-gray-500">
                Your balance: ₹{userBalance.toFixed(2)}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isCreating}
            className={`w-full py-2 px-4 rounded-md text-white font-medium ${
              isCreating
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isCreating ? "Creating..." : "Create Game"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  )
}

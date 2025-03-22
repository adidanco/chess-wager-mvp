// CreateGame.jsx
import React, { useEffect, useState } from "react"  
import { collection, addDoc, doc, getDoc, serverTimestamp, increment, runTransaction, deleteDoc } from "firebase/firestore"
import { auth, db } from "../firebase"
import { useNavigate } from "react-router-dom"
import { toast } from "react-hot-toast"
import { logger } from "../utils/logger"

export default function CreateGame() {
  const navigate = useNavigate()
  const [wager, setWager] = useState("")
  const [loading, setLoading] = useState(false)
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
    
    try {
      if (!auth.currentUser) {
        throw new Error('User not authenticated')
      }

      const wagerAmount = parseFloat(wager)
      if (isNaN(wagerAmount) || wagerAmount <= 0) {
        throw new Error('Invalid wager amount')
      }

      if (wagerAmount > userBalance) {
        throw new Error('Insufficient balance')
      }

      setLoading(true)
      logger.info('CreateGame', 'Creating new game', { wagerAmount })

      // First create the game
      const gameData = {
        whitePlayer: auth.currentUser.uid,
        blackPlayer: null,
        pot: wagerAmount * 2,
        wager: wagerAmount,
        status: "waiting",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        currentTurn: "w",
        whiteTime: 300000, // 5 minutes in milliseconds
        blackTime: 300000,
        moveHistory: [],
        createdAt: serverTimestamp(),
        lastMoveTime: serverTimestamp()
      }

      logger.debug('CreateGame', 'Creating game with data', { 
        gameData,
        userId: auth.currentUser.uid
      })

      const gamesRef = collection(db, "games")
      const newGameDoc = await addDoc(gamesRef, gameData)

      // Only after game is created successfully, update the balance
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", auth.currentUser.uid)
        const userDoc = await transaction.get(userRef)
        
        if (!userDoc.exists()) {
          // If balance update fails, we should delete the game
          await deleteDoc(doc(db, "games", newGameDoc.id))
          throw new Error('User document not found')
        }

        const currentBalance = userDoc.data().balance || 0
        if (currentBalance < wagerAmount) {
          // If balance update fails, we should delete the game
          await deleteDoc(doc(db, "games", newGameDoc.id))
          throw new Error('Insufficient balance')
        }

        // Update user balance
        transaction.update(userRef, {
          balance: increment(-wagerAmount)
        })
      })

      logger.info('CreateGame', 'Game created successfully', { 
        gameId: newGameDoc.id,
        wagerAmount 
      })

      toast.success("Game created!")
      navigate(`/game/${newGameDoc.id}`)
    } catch (error) {
      logger.error('CreateGame', 'Error creating game', { error })
      
      let errorMessage = "Error creating game!"
      if (error.message === 'Invalid wager amount') {
        errorMessage = "Please enter a valid wager amount!"
      } else if (error.message === 'Insufficient balance') {
        errorMessage = "Insufficient balance!"
      } else if (error.message === 'User not authenticated') {
        errorMessage = "Please login again!"
        navigate("/login")
      } else if (error.message === 'User document not found') {
        errorMessage = "User account not found!"
        navigate("/login")
      }
      
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">Create New Game</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Wager Amount
            </label>
            <input
              type="number"
              value={wager}
              onChange={(e) => setWager(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter wager amount"
              required
              min="1"
              step="0.01"
            />
            {userBalance !== null && (
              <p className="mt-1 text-sm text-gray-500">
                Your balance: ${userBalance.toFixed(2)}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Game"}
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

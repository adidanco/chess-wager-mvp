// ✅ ADDED: CreateGame page
import React, { useEffect, useState } from "react"  
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, serverTimestamp, increment } from "firebase/firestore"
import { auth, db } from "../firebase"
import { Chess } from "chess.js"
import { useNavigate } from "react-router-dom"
import { v4 as uuidv4 } from "uuid"   // for random game IDs
import { toast } from "react-hot-toast"
import { logger } from "../utils/logger"

export default function CreateGame() {
  const navigate = useNavigate()
  // ✅ ADDED: Local state for the wager
  const [wager, setWager] = useState("")
  const [loading, setLoading] = useState(false)
  const [userBalance, setUserBalance] = useState(null)
  const possibleWagers = [5, 10, 15, 30, 50]

  useEffect(() => {
    if (!auth.currentUser) {
      logger.warn('CreateGame', 'User not authenticated, redirecting to login')
      navigate("/login")
      return
    }

    logger.info('CreateGame', 'Initializing create game component', { 
      userId: auth.currentUser.uid 
    })

    // Fetch user's balance
    const userRef = doc(db, "users", auth.currentUser.uid)
    getDoc(userRef)
      .then((doc) => {
        if (doc.exists()) {
          const data = doc.data()
          logger.debug('CreateGame', 'User balance fetched', { 
            userId: auth.currentUser.uid,
            balance: data.balance 
          })
          setUserBalance(data.balance || 0)
        } else {
          logger.error('CreateGame', 'User document not found', { 
            userId: auth.currentUser.uid 
          })
          toast.error("User data not found!")
        }
      })
      .catch((error) => {
        logger.error('CreateGame', 'Error fetching user balance', { 
          error, 
          userId: auth.currentUser.uid 
        })
        toast.error("Error fetching balance!")
      })
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!auth.currentUser) {
      logger.warn('CreateGame', 'Create game attempted without authentication')
      navigate("/login")
      return
    }

    const wagerAmount = parseFloat(wager)
    if (isNaN(wagerAmount) || wagerAmount <= 0) {
      logger.warn('CreateGame', 'Invalid wager amount', { wager })
      toast.error("Please enter a valid wager amount!")
      return
    }

    if (wagerAmount > userBalance) {
      logger.warn('CreateGame', 'Insufficient balance', { 
        wagerAmount, 
        userBalance 
      })
      toast.error("Insufficient balance!")
      return
    }

    setLoading(true)
    logger.info('CreateGame', 'Creating new game', { 
      userId: auth.currentUser.uid,
      wagerAmount 
    })

    try {
      // Create game document
      const gameRef = doc(db, "games")
      await setDoc(gameRef, {
        player1Id: auth.currentUser.uid,
        player1Color: "w",
        wager: wagerAmount,
        pot: wagerAmount,
        status: "waiting",
        createdAt: new Date(),
        currentFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        currentTurn: "w",
        whiteTime: 300000,
        blackTime: 300000,
        lastMoveTimestamp: new Date()
      })

      logger.debug('CreateGame', 'Game document created', { 
        gameId: gameRef.id,
        userId: auth.currentUser.uid 
      })

      // Deduct wager from user's balance
      const userRef = doc(db, "users", auth.currentUser.uid)
      await updateDoc(userRef, {
        balance: increment(-wagerAmount)
      })

      logger.info('CreateGame', 'Game created successfully', { 
        gameId: gameRef.id,
        userId: auth.currentUser.uid 
      })

      toast.success("Game created!")
      navigate(`/game/${gameRef.id}`)
    } catch (error) {
      logger.error('CreateGame', 'Error creating game', { 
        error, 
        userId: auth.currentUser.uid,
        wagerAmount 
      })
      toast.error("Error creating game!")
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

//JoinGame.jsx
// ✅ ADDED: JoinGame page
import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, increment, orderBy, serverTimestamp } from "firebase/firestore"
import { db } from "../firebase"
import toast from "react-hot-toast"
import { logger } from "../utils/logger"
import { useAuth } from "../context/AuthContext"
import LoadingSpinner from "../components/common/LoadingSpinner"
import PageLayout from "../components/common/PageLayout"

export default function JoinGame() {
  const navigate = useNavigate()
  const [availableGames, setAvailableGames] = useState([])
  const [loading, setLoading] = useState(true)
  const { currentUser, balance, updateBalance, isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) {
      logger.warn('JoinGame', 'User not authenticated, redirecting to login')
      navigate("/login")
      return
    }

    logger.info('JoinGame', 'Initializing join game component', { 
      userId: currentUser.uid 
    })

    // Subscribe to available games
    const q = query(
      collection(db, "games"),
      where("status", "==", "waiting")
    )

    logger.debug('JoinGame', 'Setting up games query', { 
      userId: currentUser.uid,
      query: q
    })

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const games = []
        snapshot.forEach((doc) => {
          const gameData = doc.data()
          // Client-side filter to exclude user's own games
          if (gameData.whitePlayer !== currentUser.uid) {
            logger.debug('JoinGame', 'Found game', { 
              gameId: doc.id,
              status: gameData.status,
              whitePlayer: gameData.whitePlayer
            })
            games.push({ id: doc.id, ...gameData })
          }
        })
        logger.debug('JoinGame', 'Available games updated', { 
          count: games.length,
          games: games.map(g => ({ id: g.id, wager: g.wager }))
        })
        setAvailableGames(games)
        setLoading(false)
      },
      (error) => {
        logger.error('JoinGame', 'Error in games snapshot listener', { 
          error, 
          userId: currentUser.uid 
        })
        toast.error("Error fetching available games!")
        setLoading(false)
      }
    )

    return () => {
      logger.debug('JoinGame', 'Cleaning up join game component', { 
        userId: currentUser.uid 
      })
      unsubscribe()
    }
  }, [navigate, currentUser, isAuthenticated])

  const handleJoinGame = async (gameId, wager) => {
    if (wager > balance) {
      logger.warn('JoinGame', 'Insufficient balance', { 
        wager, 
        balance 
      })
      toast.error("Insufficient balance!")
      return
    }

    setLoading(true)
    logger.info('JoinGame', 'Attempting to join game', { 
      gameId, 
      userId: currentUser.uid,
      wager 
    })

    try {
      const gameRef = doc(db, "games", gameId)
      const gameSnap = await getDoc(gameRef)

      if (!gameSnap.exists()) {
        logger.error('JoinGame', 'Game not found', { gameId })
        toast.error("Game not found!")
        setLoading(false)
        return
      }

      const gameData = gameSnap.data()
      if (gameData.status !== "waiting") {
        logger.warn('JoinGame', 'Game is no longer available', { 
          gameId, 
          status: gameData.status 
        })
        toast.error("Game is no longer available!")
        setLoading(false)
        return
      }

      // Update game document
      await updateDoc(gameRef, {
        blackPlayer: currentUser.uid,
        status: "in_progress",
        whiteTime: 300000,
        blackTime: 300000,
        currentTurn: "w",
        lastMoveTime: serverTimestamp()
      })

      logger.debug('JoinGame', 'Game document updated', { 
        gameId, 
        userId: currentUser.uid 
      })

      // Deduct wager from user's balance using AuthContext
      await updateBalance(-wager, "joining game")

      logger.info('JoinGame', 'Successfully joined game', { 
        gameId, 
        userId: currentUser.uid 
      })

      toast.success("Joined game successfully!")
      navigate(`/game/${gameId}`)
    } catch (error) {
      logger.error('JoinGame', 'Error joining game', { 
        error, 
        gameId, 
        userId: currentUser.uid 
      })
      toast.error("Failed to join game")
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading available games..." />
  }

  return (
    <PageLayout title="Join a Game">
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Available Games</h1>
        
        {availableGames.length === 0 ? (
          <div className="text-center p-8 bg-white rounded-lg shadow">
            <p className="text-gray-600 mb-4">No games available to join.</p>
            <button
              onClick={() => navigate("/create-game")}
              className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            >
              Create a Game
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {availableGames.map((game) => (
              <div 
                key={game.id} 
                className="bg-white p-4 rounded-lg shadow-md border border-gray-200"
              >
                <div className="mb-3">
                  <span className="font-semibold">Wager: </span>
                  <span className="text-green-600 font-bold">${game.wager}</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Created: {game.createdAt?.toDate().toLocaleString() || "Just now"}
                </p>
                <button
                  onClick={() => handleJoinGame(game.id, game.wager)}
                  disabled={game.wager > balance}
                  className={`w-full py-2 px-4 rounded ${
                    game.wager > balance
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  } text-white`}
                >
                  {game.wager > balance ? "Insufficient Balance" : "Join Game"}
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate("/")}
            className="bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600"
          >
            Back to Home
          </button>
        </div>
      </div>
    </PageLayout>
  )
}

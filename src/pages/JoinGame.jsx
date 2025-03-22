//JoinGame.jsx
// ✅ ADDED: JoinGame page
import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, increment } from "firebase/firestore"
import { db, auth } from "../firebase"
import toast from "react-hot-toast"
import { logger } from "../utils/logger"

export default function JoinGame() {
  const navigate = useNavigate()
  const [availableGames, setAvailableGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [userBalance, setUserBalance] = useState(null)

  useEffect(() => {
    if (!auth.currentUser) {
      logger.warn('JoinGame', 'User not authenticated, redirecting to login')
      navigate("/login")
      return
    }

    logger.info('JoinGame', 'Initializing join game component', { 
      userId: auth.currentUser.uid 
    })

    // Fetch user's balance
    const userRef = doc(db, "users", auth.currentUser.uid)
    getDoc(userRef)
      .then((doc) => {
        if (doc.exists()) {
          const data = doc.data()
          logger.debug('JoinGame', 'User balance fetched', { 
            userId: auth.currentUser.uid,
            balance: data.balance 
          })
          setUserBalance(data.balance || 0)
        } else {
          logger.error('JoinGame', 'User document not found', { 
            userId: auth.currentUser.uid 
          })
          toast.error("User data not found!")
        }
      })
      .catch((error) => {
        logger.error('JoinGame', 'Error fetching user balance', { 
          error, 
          userId: auth.currentUser.uid 
        })
        toast.error("Error fetching balance!")
      })

    // Subscribe to available games
    const q = query(
      collection(db, "games"),
      where("status", "==", "waiting"),
      where("player1Id", "not-in", [auth.currentUser.uid, null])
    )

    logger.debug('JoinGame', 'Setting up games query', { 
      userId: auth.currentUser.uid,
      query: q
    })

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const games = []
        snapshot.forEach((doc) => {
          const gameData = doc.data()
          logger.debug('JoinGame', 'Found game', { 
            gameId: doc.id,
            status: gameData.status,
            player1Id: gameData.player1Id,
            player2Id: gameData.player2Id
          })
          games.push({ id: doc.id, ...gameData })
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
          userId: auth.currentUser.uid 
        })
        toast.error("Error fetching available games!")
        setLoading(false)
      }
    )

    return () => {
      logger.debug('JoinGame', 'Cleaning up join game component', { 
        userId: auth.currentUser.uid 
      })
      unsubscribe()
    }
  }, [navigate])

  const handleJoinGame = async (gameId, wager) => {
    if (!auth.currentUser) {
      logger.warn('JoinGame', 'Join game attempted without authentication')
      navigate("/login")
      return
    }

    if (wager > userBalance) {
      logger.warn('JoinGame', 'Insufficient balance', { 
        wager, 
        userBalance 
      })
      toast.error("Insufficient balance!")
      return
    }

    setLoading(true)
    logger.info('JoinGame', 'Attempting to join game', { 
      gameId, 
      userId: auth.currentUser.uid,
      wager 
    })

    try {
      const gameRef = doc(db, "games", gameId)
      const gameSnap = await getDoc(gameRef)

      if (!gameSnap.exists()) {
        logger.error('JoinGame', 'Game not found', { gameId })
        toast.error("Game not found!")
        return
      }

      const gameData = gameSnap.data()
      if (gameData.status !== "waiting") {
        logger.warn('JoinGame', 'Game is no longer available', { 
          gameId, 
          status: gameData.status 
        })
        toast.error("Game is no longer available!")
        return
      }

      // Update game document
      await updateDoc(gameRef, {
        player2Id: auth.currentUser.uid,
        player2Color: "b",
        status: "in_progress",
        pot: gameData.pot + wager
      })

      logger.debug('JoinGame', 'Game document updated', { 
        gameId, 
        userId: auth.currentUser.uid 
      })

      // Deduct wager from user's balance
      const userRef = doc(db, "users", auth.currentUser.uid)
      await updateDoc(userRef, {
        balance: increment(-wager)
      })

      logger.info('JoinGame', 'Successfully joined game', { 
        gameId, 
        userId: auth.currentUser.uid 
      })

      toast.success("Joined game successfully!")
      navigate(`/game/${gameId}`)
    } catch (error) {
      logger.error('JoinGame', 'Error joining game', { 
        error, 
        gameId, 
        userId: auth.currentUser.uid 
      })
      toast.error("Error joining game!")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">Available Games</h2>
        {loading ? (
          <p className="text-center">Loading available games...</p>
        ) : availableGames.length === 0 ? (
          <p className="text-center text-gray-500">No games available</p>
        ) : (
          <div className="space-y-4">
            {availableGames.map((game) => (
              <div
                key={game.id}
                className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium">Wager: ${game.wager}</p>
                  <p className="text-sm text-gray-500">
                    Created: {new Date(game.createdAt?.toDate()).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleJoinGame(game.id, game.wager)}
                  disabled={loading}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  Join Game
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => navigate("/")}
          className="w-full mt-4 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          Back to Home
        </button>
      </div>
    </div>
  )
}

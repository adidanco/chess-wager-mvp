import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  getDoc, 
  orderBy, 
  serverTimestamp,
  QuerySnapshot,
  DocumentData 
} from "firebase/firestore"
import { db } from "../firebase"
import toast from "react-hot-toast"
import { logger } from "../utils/logger"
import { useAuth } from "../context/AuthContext"
import LoadingSpinner from "../components/common/LoadingSpinner"
import PageLayout from "../components/common/PageLayout"
import { GameData } from "chessTypes"
import { GAME_STATUS, CURRENCY_SYMBOL } from "../utils/constants"

// Interface for game items in the available games list
interface GameItem extends GameData {
  id: string;
}

export default function JoinGame(): JSX.Element {
  const navigate = useNavigate()
  const [availableGames, setAvailableGames] = useState<GameItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const { currentUser, balance, updateBalance, isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) {
      logger.warn('JoinGame', 'User not authenticated, redirecting to login')
      navigate("/login")
      return
    }

    if (!currentUser) {
      return
    }

    logger.info('JoinGame', 'Initializing join game component', { 
      userId: currentUser.uid 
    })

    // Subscribe to available games
    const q = query(
      collection(db, "games"),
      where("status", "==", GAME_STATUS.WAITING)
    )

    logger.debug('JoinGame', 'Setting up games query', { 
      userId: currentUser.uid,
      query: q
    })

    const unsubscribe = onSnapshot(q, 
      (snapshot: QuerySnapshot<DocumentData>) => {
        const games: GameItem[] = []
        snapshot.forEach((doc) => {
          const gameData = doc.data() as GameData
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

  const handleJoinGame = async (gameId: string, wager: number): Promise<void> => {
    if (!currentUser) {
      toast.error("You must be logged in to join a game")
      navigate("/login")
      return
    }

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

      const gameData = gameSnap.data() as GameData
      if (gameData.status !== GAME_STATUS.WAITING) {
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
        player2Id: currentUser.uid,
        status: GAME_STATUS.IN_PROGRESS,
        whiteTime: gameData.timeControl,
        blackTime: gameData.timeControl,
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
      const err = error as Error
      logger.error('JoinGame', 'Error joining game', { 
        error: err, 
        gameId, 
        userId: currentUser?.uid 
      })
      toast.error("Failed to join game")
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading available games..." />
  }

  return (
    <PageLayout>
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Join a Game</h1>
        
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
                  <span className="text-green-600 font-bold">{CURRENCY_SYMBOL}{game.wager}</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Created: {game.createdAt?.toDate().toLocaleString() || "Just now"}
                </p>
                <button
                  onClick={() => handleJoinGame(game.id, game.wager || 0)}
                  disabled={(game.wager || 0) > balance}
                  className={`w-full py-2 px-4 rounded ${
                    (game.wager || 0) > balance
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  } text-white`}
                >
                  {(game.wager || 0) > balance ? "Insufficient Balance" : "Join Game"}
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
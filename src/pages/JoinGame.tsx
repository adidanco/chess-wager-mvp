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
  DocumentData,
  getDocs
} from "firebase/firestore"
import { db } from "../firebase"
import toast from "react-hot-toast"
import { logger } from "../utils/logger"
import { useAuth } from "../context/AuthContext"
import LoadingSpinner from "../components/common/LoadingSpinner"
import PageLayout from "../components/common/PageLayout"
import { GameData, UserProfile } from "chessTypes"
import { GAME_STATUS, CURRENCY_SYMBOL } from "../utils/constants"
import { RangvaarGameState } from "../types/rangvaar"
import { ScambodiaGameState } from "../types/scambodia"
import chessIcon from "../assets/Chess.png"
import rangvaarIcon from "../assets/Rangvaar.png"
import scambodiaIcon from "../assets/Scambodia.png"
import { joinRangvaarGame } from "../services/rangvaarService"
import { joinScambodiaGame } from "../services/scambodiaService"

// Unified interface for displaying games in the list
interface DisplayGameItem {
  id: string;
  gameType: 'Chess' | 'Rangvaar' | 'Scambodia'; // Differentiate game type
  wager: number;
  creatorUsername?: string; // Optional: Fetch if needed
  createdAt?: any; // Firestore Timestamp
  icon: string; // Path to the game icon
  creatorId?: string; // Store creator ID
}

export default function JoinGame(): JSX.Element {
  const navigate = useNavigate()
  const [availableGames, setAvailableGames] = useState<DisplayGameItem[]>([])
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

    // Define error handler first
    const handleSnapshotError = (error: Error) => {
      logger.error('JoinGame', 'Error in games snapshot listener', { error, userId: currentUser?.uid })
      toast.error("Error fetching available games!")
      setLoading(false) // Stop loading on error too
    }

    // Query for Chess games
    const chessQuery = query(
      collection(db, "games"), 
      where("status", "==", GAME_STATUS.WAITING)
    )
    
    // Query for Rangvaar games
    const rangvaarQuery = query(
      collection(db, "rangvaarGames"), 
      where("status", "==", "Waiting") // Use string status for Rangvaar
    )

    // Query for Scambodia games
    const scambodiaQuery = query(
      collection(db, "scambodiaGames"),
      where("status", "==", "Waiting")
    )

    logger.debug('JoinGame', 'Setting up game listeners', { userId: currentUser.uid })

    // Combine listeners
    const unsubChess = onSnapshot(chessQuery, 
      (snapshot: QuerySnapshot<DocumentData>) => processSnapshots(snapshot, null, null), 
      handleSnapshotError
    )
    
    const unsubRangvaar = onSnapshot(rangvaarQuery, 
      (snapshot: QuerySnapshot<DocumentData>) => processSnapshots(null, snapshot, null),
      handleSnapshotError
    )

    const unsubScambodia = onSnapshot(scambodiaQuery,
      (snapshot: QuerySnapshot<DocumentData>) => processSnapshots(null, null, snapshot),
      handleSnapshotError
    )

    let chessGames: DisplayGameItem[] = []
    let rangvaarGames: DisplayGameItem[] = []
    let scambodiaGames: DisplayGameItem[] = []
    let initialLoadComplete = { chess: false, rangvaar: false, scambodia: false }

    const processSnapshots = (
      chessSnap: QuerySnapshot<DocumentData> | null, 
      rangvaarSnap: QuerySnapshot<DocumentData> | null,
      scambodiaSnap: QuerySnapshot<DocumentData> | null
    ) => {
      if (chessSnap) {
        chessGames = chessSnap.docs
          .map(doc => ({
            id: doc.id,
            gameType: 'Chess' as const, // Explicitly type as literal
            wager: (doc.data() as GameData).wager || 0,
            createdAt: (doc.data() as GameData).createdAt,
            creatorId: (doc.data() as GameData).whitePlayer, // Assuming whitePlayer is creator
            icon: chessIcon,
          }))
          .filter(game => game.creatorId !== currentUser?.uid) // Exclude user's own games
        initialLoadComplete.chess = true
      }
      if (rangvaarSnap) {
        rangvaarGames = rangvaarSnap.docs
          .map(doc => ({
            id: doc.id,
            gameType: 'Rangvaar' as const, // Explicitly type as literal
            wager: (doc.data() as RangvaarGameState).wagerPerPlayer || 0,
            createdAt: (doc.data() as RangvaarGameState).createdAt,
            creatorId: (doc.data() as RangvaarGameState).players[0]?.userId, // First player is creator
            icon: rangvaarIcon,
          }))
          .filter(game => game.creatorId !== currentUser?.uid) // Exclude user's own games
        initialLoadComplete.rangvaar = true
      }
      if (scambodiaSnap) {
        scambodiaGames = scambodiaSnap.docs
          .map(doc => ({
            id: doc.id,
            gameType: 'Scambodia' as const,
            wager: (doc.data() as ScambodiaGameState).wagerPerPlayer || 0,
            createdAt: (doc.data() as ScambodiaGameState).createdAt,
            creatorId: (doc.data() as ScambodiaGameState).players[0]?.userId, // First player is creator
            icon: scambodiaIcon,
          }))
          .filter(game => game.creatorId !== currentUser?.uid) // Exclude user's own games
        initialLoadComplete.scambodia = true
      }

      // Combine and update state
      const combinedGames = [...chessGames, ...rangvaarGames, ...scambodiaGames]
      // Optional: Sort combined list, e.g., by creation time
      combinedGames.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
      
      setAvailableGames(combinedGames)
      logger.debug('JoinGame', 'Available games updated', { count: combinedGames.length })

      // Only stop loading indicator once both initial loads are done
      if (initialLoadComplete.chess && initialLoadComplete.rangvaar && initialLoadComplete.scambodia) {
        setLoading(false)
      }
    }
    
    // Initial fetch to set loading state correctly
    Promise.all([getDocs(chessQuery), getDocs(rangvaarQuery), getDocs(scambodiaQuery)])
      .then(([chessSnap, rangvaarSnap, scambodiaSnap]) => {
        processSnapshots(chessSnap, rangvaarSnap, scambodiaSnap)
      }).catch(handleSnapshotError)
      
    // Cleanup listeners
    return () => {
      logger.debug('JoinGame', 'Cleaning up join game component', { userId: currentUser?.uid })
      unsubChess()
      unsubRangvaar()
      unsubScambodia()
    }
  }, [navigate, currentUser, isAuthenticated])

  const handleJoinGame = async (gameId: string, wager: number, gameType: 'Chess' | 'Rangvaar' | 'Scambodia'): Promise<void> => {
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
    logger.info('JoinGame', `Attempting to join ${gameType} game`, { 
      gameId, 
      userId: currentUser.uid,
      wager 
    })

    if (gameType === 'Rangvaar') {
      // --- Handle Joining Rangvaar Game --- //
      try {
        await joinRangvaarGame(gameId, currentUser.uid)
        logger.info('JoinGame', 'Successfully joined Rangvaar game', { 
          gameId, 
          userId: currentUser.uid 
        })
        toast.success("Joined Rangvaar game!")
        navigate(`/game/rangvaar/${gameId}`)
      } catch (error) {
        const err = error as Error
        logger.error('JoinGame', 'Error joining Rangvaar game', { 
          error: err, 
          gameId, 
          userId: currentUser?.uid 
        })
        toast.error(`Failed to join Rangvaar game: ${err.message}`)
        setLoading(false)
      }
    } else if (gameType === 'Scambodia') {
      // --- Handle Joining Scambodia Game --- //
      try {
        await joinScambodiaGame(gameId, currentUser.uid)
        logger.info('JoinGame', 'Successfully joined Scambodia game', { 
          gameId, 
          userId: currentUser.uid 
        })
        toast.success("Joined Scambodia game!")
        navigate(`/game/scambodia/${gameId}`)
      } catch (error) {
        const err = error as Error
        logger.error('JoinGame', 'Error joining Scambodia game', { 
          error: err, 
          gameId, 
          userId: currentUser?.uid 
        })
        toast.error(`Failed to join Scambodia game: ${err.message}`)
        setLoading(false)
      }
    } else if (gameType === 'Chess') {
      // --- Handle Joining Chess Game (Existing Logic) --- //
      try {
        const gameRef = doc(db, "games", gameId)
        const gameSnap = await getDoc(gameRef)

        if (!gameSnap.exists()) {
          logger.error('JoinGame', 'Chess game not found', { gameId })
          throw new Error("Game not found!")
        }

        const gameData = gameSnap.data() as GameData
        if (gameData.status !== GAME_STATUS.WAITING) {
          logger.warn('JoinGame', 'Chess game is no longer available', { 
            gameId, 
            status: gameData.status 
          })
          throw new Error("Game is no longer available!")
        }

        // Update game document (Chess specific fields)
        await updateDoc(gameRef, {
          blackPlayer: currentUser.uid,
          player2Id: currentUser.uid,
          status: GAME_STATUS.IN_PROGRESS,
          whiteTime: gameData.timeControl,
          blackTime: gameData.timeControl,
          currentTurn: "w",
          lastMoveTime: serverTimestamp()
        })

        logger.debug('JoinGame', 'Chess game document updated', { 
          gameId, 
          userId: currentUser.uid 
        })

        // Deduct wager from user's balance using AuthContext (Chess specific)
        await updateBalance(-wager, "joining chess game")

        logger.info('JoinGame', 'Successfully joined Chess game', { 
          gameId, 
          userId: currentUser.uid 
        })
        toast.success("Joined Chess game successfully!")
        navigate(`/game/${gameId}`)
      } catch (error) {
        const err = error as Error
        logger.error('JoinGame', 'Error joining Chess game', { 
          error: err, 
          gameId, 
          userId: currentUser?.uid 
        })
        toast.error(`Failed to join Chess game: ${err.message}`)
        setLoading(false)
      }
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {availableGames.map((game) => (
              <div 
                key={game.id} 
                className="bg-white p-4 rounded-lg shadow-md border border-gray-200 flex flex-col justify-between"
                data-cy={`join-game-item-${game.gameType.toLowerCase()}`}
              >
                <div>
                  <div className="flex items-center mb-3">
                    <img src={game.icon} alt={game.gameType} className="w-8 h-8 mr-3 rounded object-contain" />
                    <span className="font-semibold text-lg text-emerald-700">{game.gameType}</span>
                  </div>
                  <div className="mb-3 text-sm">
                    <span className="font-medium">Wager: </span>
                    <span className="text-green-600 font-bold">{CURRENCY_SYMBOL}{game.wager}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Created: {game.createdAt?.toDate().toLocaleString() || "Just now"}
                  </p>
                </div>
                <button
                  onClick={() => handleJoinGame(game.id, game.wager, game.gameType)}
                  disabled={(game.wager || 0) > balance}
                  className={`w-full mt-2 py-2 px-4 rounded text-sm font-medium transition-colors ${
                    (game.wager || 0) > balance
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                  data-cy="join-game-btn"
                >
                  {(game.wager || 0) > balance ? "Insufficient Balance" : `Join ${game.gameType} Game`}
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
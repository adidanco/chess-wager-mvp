// ✅ ADDED: Game.jsx
import React, { useEffect, useState, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { doc, onSnapshot, updateDoc, getDoc, serverTimestamp, arrayUnion } from "firebase/firestore"
import { db, auth } from "../firebase"
import { Chess } from "chess.js"
import { Chessboard } from "react-chessboard"  // from react-chessboard
import toast from "react-hot-toast"
import { logger } from "../utils/logger"
import { useAuth } from "../context/AuthContext"

// Helper function to format milliseconds into MM:SS
const formatTime = (ms) => {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function Game() {
  const { gameId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [fen, setFen] = useState("")       // current board position
  const [gameData, setGameData] = useState(null) // store entire game doc
  const [currentTurn, setCurrentTurn] = useState("w") // current turn state
  const chessRef = useRef(null)            // ref to store a Chess instance
  const [myColor, setMyColor] = useState(null)
  const [error, setError] = useState(null)
  const [moveHistory, setMoveHistory] = useState([])
  const [whiteTimeDisplay, setWhiteTimeDisplay] = useState(300000)
  const [blackTimeDisplay, setBlackTimeDisplay] = useState(300000)
  const clockStartedRef = useRef(false)
  const intervalId = useRef(null)
  const [timeLeft, setTimeLeft] = useState(300000) // Add this state for clock management
  const [clockInterval, setClockInterval] = useState(null) // Add this state for clock interval

  useEffect(() => {
    if (!gameId || !user) return

    logger.info('Game', 'Initializing game component', { gameId, userId: user.uid })

    // Subscribe to game updates
    const gameRef = doc(db, "games", gameId)
    const unsubscribe = onSnapshot(gameRef, (doc) => {
      if (!doc.exists()) {
        logger.error('Game', 'Game document not found', { gameId })
        toast.error("Game not found!")
        navigate("/")
        return
      }

      const gameData = doc.data()
      logger.debug('Game', 'Game data updated', { 
        gameId,
        status: gameData.status,
        currentTurn: gameData.currentTurn,
        whitePlayer: gameData.whitePlayer,
        blackPlayer: gameData.blackPlayer
      })

      setGameData(gameData)
      setFen(gameData.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
      setMyColor(gameData.whitePlayer === user.uid ? "w" : "b")
      setError(null)
      setMoveHistory(gameData.moveHistory || [])
      setWhiteTimeDisplay(gameData.whiteTime || 300000)
      setBlackTimeDisplay(gameData.blackTime || 300000)
      setCurrentTurn(gameData.currentTurn || "w")

      // Start clock if game is in progress
      if (gameData.status === "in_progress") {
        startClock(gameData.currentTurn || "w", gameData.lastMoveTime?.toDate() || new Date())
      } else {
        stopClock()
      }
    })

    return () => {
      logger.debug('Game', 'Cleaning up game component', { gameId })
      unsubscribe()
      stopClock()
    }
  }, [gameId, user, navigate])

  const startClock = (turn, lastMoveTime) => {
    stopClock()
    const now = new Date()
    const elapsed = Math.floor((now - lastMoveTime) / 1000)
    const initialTime = turn === "w" ? whiteTimeDisplay : blackTimeDisplay
    const remainingTime = Math.max(0, initialTime - elapsed)

    if (remainingTime <= 0) {
      handleTimeUp(turn === "w" ? "b" : "w")
      return
    }

    setTimeLeft(remainingTime)
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleTimeUp(turn === "w" ? "b" : "w")
          return 0
        }
        return prev - 1
      })
    }, 1000)

    setClockInterval(timer)
  }

  const stopClock = () => {
    if (clockInterval) {
      clearInterval(clockInterval)
      setClockInterval(null)
    }
  }

  const handleTimeUp = async (winner) => {
    stopClock()
    try {
      const gameRef = doc(db, "games", gameId)
      await updateDoc(gameRef, {
        status: "finished",
        winner: winner,
        endTime: serverTimestamp()
      })
      toast.success(winner === myColor ? "You won on time!" : "You lost on time!")
    } catch (error) {
      logger.error('Game', 'Error updating game status for time up', { error, gameId })
      toast.error("Error updating game status!")
    }
  }

  const handleMove = async (move) => {
    if (!gameData || gameData.status !== "in_progress") return

    const isPlayerTurn = (gameData.currentTurn === "w" && gameData.whitePlayer === user.uid) || 
                        (gameData.currentTurn === "b" && gameData.blackPlayer === user.uid)
    
    if (!isPlayerTurn) {
      toast.error("It's not your turn!")
      return
    }

    try {
      const gameRef = doc(db, "games", gameId)
      const newTurn = gameData.currentTurn === "w" ? "b" : "w"
      const now = new Date()

      await updateDoc(gameRef, {
        fen: move.fen,
        currentTurn: newTurn,
        lastMoveTime: serverTimestamp(),
        [`${newTurn === "w" ? "white" : "black"}Time`]: timeLeft,
        moveHistory: arrayUnion({
          number: moveHistory.length + 1,
          white: move.color === "w" ? move.san : "",
          black: move.color === "b" ? move.san : "",
          timestamp: now.toISOString()
        })
      })

      logger.debug('Game', 'Move made', { 
        gameId,
        move: move.san,
        newTurn,
        timeLeft
      })

      startClock(newTurn, now)
    } catch (error) {
      logger.error('Game', 'Error making move', { error, gameId })
      toast.error("Error making move!")
    }
  }

  const handleGameOver = async (result) => {
    if (!gameData || gameData.status !== "in_progress") return

    try {
      const gameRef = doc(db, "games", gameId)
      await updateDoc(gameRef, {
        status: "finished",
        winner: result.winner,
        endTime: serverTimestamp()
      })
      toast.success(result.winner === myColor ? "You won!" : "You lost!")
    } catch (error) {
      logger.error('Game', 'Error updating game status', { error, gameId })
      toast.error("Error updating game status!")
    }
  }

  // If fen is empty or doc not loaded yet
  if (!fen) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-lg">Loading game...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-xl mb-4">Game ID: {gameId}</h2>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      {/* Show whose turn it is */}
      <p>Current Turn: {gameData?.currentTurn?.toUpperCase()}</p>
      {/* Show my color */}
      <p>You are playing: {myColor === "w" ? "White" : "Black"}</p>
      <p className="text-green-600 font-semibold mb-2">Wager: ₹{gameData?.wager}</p>

      {/* Add Clock Display */}
      <div className="flex gap-8 mb-4">
        <div className={`text-2xl font-bold ${gameData?.currentTurn === "w" ? "text-blue-600" : "text-gray-600"}`}>
          White: {formatTime(whiteTimeDisplay)}
        </div>
        <div className={`text-2xl font-bold ${gameData?.currentTurn === "b" ? "text-blue-600" : "text-gray-600"}`}>
          Black: {formatTime(blackTimeDisplay)}
        </div>
      </div>

      <div className="flex gap-8">
        <div className={`relative ${gameData?.status === "finished" ? "opacity-50 pointer-events-none" : ""}`}>
          <div className="w-[600px] h-[600px]">
      <Chessboard
        position={fen}
              onDrop={handleMove}
            />
          </div>
          {gameData?.status === "finished" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
              <div className="bg-white p-6 rounded-lg text-center">
                <h3 className="text-2xl font-bold mb-2">Game Over!</h3>
                <p className="text-xl">
                  {gameData.winner === "draw" 
                    ? "It's a draw!" 
                    : `Winner: ${gameData.winner === "w" ? "White" : "Black"}`
                  }
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Move History Panel */}
        <div className="w-64 bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Move History</h3>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {moveHistory.map((move, index) => (
              <div key={index} className="flex justify-between items-center text-sm">
                <span className="font-medium">{move.number}.</span>
                <div className="flex gap-4">
                  <span>{move.white}</span>
                  <span>{move.black}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => navigate("/")}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Leave Game
        </button>

        {gameData?.status !== "finished" && (
          <>
            <button
              onClick={async () => {
                const gameRef = doc(db, "games", gameId)
                
                // If no player has joined yet, just refund the wager
                if (!gameData.blackPlayer) {
                  try {
                    // Refund the wager to player1
                    const userRef = doc(db, "users", auth.currentUser.uid)
                    const userSnap = await getDoc(userRef)
                    if (userSnap.exists()) {
                      const userData = userSnap.data()
                      await updateDoc(userRef, {
                        balance: (userData.balance || 0) + gameData.wager
                      })
                    }
                    
                    // Update game status
                    await updateDoc(gameRef, {
                      status: "finished",
                      winner: "draw"
                    })
                    
                    toast.success("Game cancelled and wager refunded")
                    navigate("/")
                  } catch (err) {
                    console.error("Error cancelling game:", err)
                    toast.error("Failed to cancel game")
                  }
                  return
                }

                // If game is in progress, handle resignation
                const otherColor = myColor === "w" ? "b" : "w"
                await updateDoc(gameRef, {
                  status: "finished",
                  winner: otherColor
                })
                try {
                  await handleTimeUp(otherColor)
                  toast.success("Game Over! You resigned.")
                } catch (err) {
                  console.error("Payout error:", err)
                  toast.error("Game Over! Error processing payout.")
                }
              }}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              {gameData.blackPlayer ? "Resign" : "Cancel Game"}
            </button>

            {gameData.blackPlayer && (
              <button
                onClick={async () => {
                  const gameRef = doc(db, "games", gameId)
                  await updateDoc(gameRef, {
                    status: "finished",
                    winner: "draw"
                  })
                  try {
                    await handleTimeUp("draw")
                    toast.success("Game Over! Draw accepted.")
                  } catch (err) {
                    console.error("Refund error:", err)
                    toast.error("Game Over! Error processing refund.")
                  }
                }}
                className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
              >
                Offer Draw
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

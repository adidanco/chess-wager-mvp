// ✅ ADDED: Game.jsx
import React, { useEffect, useState, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { doc, onSnapshot, updateDoc, getDoc, serverTimestamp, arrayUnion } from "firebase/firestore"
import { db, auth } from "../firebase"
import { Chess } from "chess.js"
import { Chessboard } from "react-chessboard"
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
  const [gameData, setGameData] = useState(null)
  const [myColor, setMyColor] = useState(null)
  const [error, setError] = useState(null)
  const [moveHistory, setMoveHistory] = useState([])
  const [whiteTimeDisplay, setWhiteTimeDisplay] = useState(300000)
  const [blackTimeDisplay, setBlackTimeDisplay] = useState(300000)
  const [timeLeft, setTimeLeft] = useState(300000)
  const [clockInterval, setClockInterval] = useState(null)
  
  // Create a single Chess instance and store it in a ref
  const chessRef = useRef(null)
  const [fen, setFen] = useState("")

  // Initialize Chess instance only once
  useEffect(() => {
    if (!chessRef.current) {
      chessRef.current = new Chess()
      setFen(chessRef.current.fen())
    }
  }, [])

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

      // Load FEN into Chess instance and update state
      try {
        if (gameData.fen && chessRef.current) {
          // Only update if FEN is different to avoid unnecessary updates
          if (chessRef.current.fen() !== gameData.fen) {
            chessRef.current.load(gameData.fen)
            setFen(gameData.fen)
          }
        } else if (chessRef.current) {
          chessRef.current.reset()
          setFen(chessRef.current.fen())
        }
      } catch (error) {
        logger.error('Game', 'Error loading FEN', { error, gameId })
        toast.error("Error loading game position!")
      }

      setMyColor(gameData.whitePlayer === user.uid ? "w" : "b")
      setError(null)
      setMoveHistory(gameData.moveHistory || [])
      setWhiteTimeDisplay(gameData.whiteTime || 300000)
      setBlackTimeDisplay(gameData.blackTime || 300000)

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

      // Handle wager distribution
      if (winner !== "draw") {
        const winnerId = winner === "w" ? gameData.whitePlayer : gameData.blackPlayer
        const userRef = doc(db, "users", winnerId)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const userData = userSnap.data()
          await updateDoc(userRef, {
            balance: (userData.balance || 0) + gameData.wager * 2 // Winner gets double the wager
          })
        }
      } else {
        // Refund wagers for draw
        const whiteUserRef = doc(db, "users", gameData.whitePlayer)
        const blackUserRef = doc(db, "users", gameData.blackPlayer)
        const [whiteSnap, blackSnap] = await Promise.all([
          getDoc(whiteUserRef),
          getDoc(blackUserRef)
        ])
        
        if (whiteSnap.exists()) {
          const whiteData = whiteSnap.data()
          await updateDoc(whiteUserRef, {
            balance: (whiteData.balance || 0) + gameData.wager
          })
        }
        
        if (blackSnap.exists()) {
          const blackData = blackSnap.data()
          await updateDoc(blackUserRef, {
            balance: (blackData.balance || 0) + gameData.wager
          })
        }
      }

      toast.success(winner === myColor ? "You won on time!" : "You lost on time!")
    } catch (error) {
      logger.error('Game', 'Error updating game status for time up', { error, gameId })
      toast.error("Error updating game status!")
    }
  }

  // Update clock display when timeLeft changes
  useEffect(() => {
    if (gameData?.currentTurn === "w") {
      setWhiteTimeDisplay(timeLeft)
    } else {
      setBlackTimeDisplay(timeLeft)
    }
  }, [timeLeft, gameData?.currentTurn])

  // Handle game status changes
  useEffect(() => {
    if (gameData?.status === "finished") {
      stopClock()
    } else if (gameData?.status === "in_progress") {
      startClock(gameData.currentTurn || "w", gameData.lastMoveTime?.toDate() || new Date())
    }
  }, [gameData?.status, gameData?.currentTurn, gameData?.lastMoveTime])

  const handleMove = async (sourceSquare, targetSquare, piece) => {
    if (!gameData || gameData.status !== "in_progress" || !chessRef.current) return false

    // Check if it's the player's turn
    const isPlayerTurn = (
      (gameData.currentTurn === "w" && gameData.whitePlayer === user.uid) ||
      (gameData.currentTurn === "b" && gameData.blackPlayer === user.uid)
    )
    if (!isPlayerTurn) {
      toast.error("It's not your turn!")
      return false
    }

    // Check if the piece being moved belongs to the current player
    const pieceColor = piece[0] // 'w' or 'b'
    if (pieceColor !== gameData.currentTurn) {
      toast.error("You can only move your own pieces!")
      return false
    }

    try {
      // Validate move with Chess.js
      const result = chessRef.current.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q' // Always promote to queen for simplicity
      })

      if (result === null) {
        toast.error("Illegal move!")
        return false
      }

      // Get new position from Chess instance
      const newFen = chessRef.current.fen()
      const newTurn = gameData.currentTurn === "w" ? "b" : "w"

      // Optimistically update local state
      setFen(newFen)
      setMoveHistory(prev => [...prev, {
        number: moveHistory.length + 1,
        white: result.color === "w" ? result.san : "",
        black: result.color === "b" ? result.san : "",
        timestamp: new Date().toISOString()
      }])

      const gameRef = doc(db, "games", gameId)
      const now = new Date()

      // Update Firestore with retry logic
      let retries = 3
      while (retries > 0) {
        try {
          await updateDoc(gameRef, {
            fen: newFen,
            currentTurn: newTurn,
            lastMoveTime: serverTimestamp(),
            [`${newTurn === "w" ? "white" : "black"}Time`]: timeLeft,
            moveHistory: arrayUnion({
              number: moveHistory.length + 1,
              white: result.color === "w" ? result.san : "",
              black: result.color === "b" ? result.san : "",
              timestamp: now.toISOString()
            })
          })
          break
        } catch (error) {
          retries--
          if (retries === 0) throw error
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      logger.debug('Game', 'Move made', { 
        gameId,
        move: result.san,
        newTurn,
        timeLeft
      })

      startClock(newTurn, now)
      return true
    } catch (error) {
      logger.error('Game', 'Error making move', { error, gameId })
      // Revert optimistic update on error
      if (chessRef.current) {
        chessRef.current.undo()
        setFen(chessRef.current.fen())
      }
      toast.error("Error making move! Please try again.")
      return false
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
    <div className="flex flex-col items-center p-4">
      <h2 className="text-xl mb-4">Game ID: {gameId}</h2>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      <p>Current Turn: {gameData?.currentTurn?.toUpperCase()}</p>
      <p>You are playing: {myColor === "w" ? "White" : "Black"}</p>
      <p className="text-green-600 font-semibold mb-2">Wager: ₹{gameData?.wager}</p>

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 mb-4">
        <div className={`text-2xl font-bold ${gameData?.currentTurn === "w" ? "text-blue-600" : "text-gray-600"}`}>
          White: {formatTime(whiteTimeDisplay)}
        </div>
        <div className={`text-2xl font-bold ${gameData?.currentTurn === "b" ? "text-blue-600" : "text-gray-600"}`}>
          Black: {formatTime(blackTimeDisplay)}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 w-full max-w-7xl">
        <div className={`relative flex-1 ${gameData?.status === "finished" ? "opacity-50 pointer-events-none" : ""}`}>
          <div className="w-full max-w-[600px] aspect-square mx-auto">
            <Chessboard
              position={fen}
              onPieceDrop={handleMove}
              boardOrientation={myColor === "w" ? "white" : "black"}
              boardWidth={Math.min(window.innerWidth * 0.8, 600)}
              customBoardStyle={{
                borderRadius: '4px',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)'
              }}
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

        <div className="w-full lg:w-64 bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Move History</h3>
          <div className="space-y-1 max-h-[300px] lg:max-h-[400px] overflow-y-auto">
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
        {gameData?.status === "waiting" && gameData?.whitePlayer === user.uid && (
          <button
            onClick={async () => {
              try {
                const gameRef = doc(db, "games", gameId)
                await updateDoc(gameRef, {
                  status: "cancelled",
                  endTime: serverTimestamp()
                })
                toast.success("Game cancelled")
                navigate("/")
              } catch (error) {
                logger.error('Game', 'Error cancelling game', { error, gameId })
                toast.error("Error cancelling game!")
              }
            }}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Cancel Game
          </button>
        )}
        {gameData?.status === "in_progress" && (
          <>
            <button
              onClick={async () => {
                try {
                  const gameRef = doc(db, "games", gameId)
                  await updateDoc(gameRef, {
                    status: "finished",
                    winner: "draw",
                    endTime: serverTimestamp()
                  })

                  // Refund wagers for draw
                  const whiteUserRef = doc(db, "users", gameData.whitePlayer)
                  const blackUserRef = doc(db, "users", gameData.blackPlayer)
                  const [whiteSnap, blackSnap] = await Promise.all([
                    getDoc(whiteUserRef),
                    getDoc(blackUserRef)
                  ])
                  
                  if (whiteSnap.exists()) {
                    const whiteData = whiteSnap.data()
                    await updateDoc(whiteUserRef, {
                      balance: (whiteData.balance || 0) + gameData.wager
                    })
                  }
                  
                  if (blackSnap.exists()) {
                    const blackData = blackSnap.data()
                    await updateDoc(blackUserRef, {
                      balance: (blackData.balance || 0) + gameData.wager
                    })
                  }

                  toast.success("Game ended in a draw!")
                  navigate("/")
                } catch (error) {
                  logger.error('Game', 'Error declaring draw', { error, gameId })
                  toast.error("Error declaring draw!")
                }
              }}
              className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
            >
              Offer Draw
            </button>
            <button
              onClick={async () => {
                try {
                  const winner = gameData.currentTurn === "w" ? "b" : "w"
                  const gameRef = doc(db, "games", gameId)
                  await updateDoc(gameRef, {
                    status: "finished",
                    winner: winner,
                    endTime: serverTimestamp()
                  })

                  // Handle wager distribution for resignation
                  const winnerId = winner === "w" ? gameData.whitePlayer : gameData.blackPlayer
                  const userRef = doc(db, "users", winnerId)
                  const userSnap = await getDoc(userRef)
                  if (userSnap.exists()) {
                    const userData = userSnap.data()
                    await updateDoc(userRef, {
                      balance: (userData.balance || 0) + gameData.wager * 2 // Winner gets double the wager
                    })
                  }

                  toast.success("You resigned!")
                  navigate("/")
                } catch (error) {
                  logger.error('Game', 'Error resigning', { error, gameId })
                  toast.error("Error resigning!")
                }
              }}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Resign
            </button>
            <button
              onClick={async () => {
                try {
                  const winner = gameData.currentTurn === "w" ? "w" : "b"
                  const gameRef = doc(db, "games", gameId)
                  await updateDoc(gameRef, {
                    status: "finished",
                    winner: winner,
                    endTime: serverTimestamp()
                  })

                  // Handle wager distribution for win
                  const winnerId = winner === "w" ? gameData.whitePlayer : gameData.blackPlayer
                  const userRef = doc(db, "users", winnerId)
                  const userSnap = await getDoc(userRef)
                  if (userSnap.exists()) {
                    const userData = userSnap.data()
                    await updateDoc(userRef, {
                      balance: (userData.balance || 0) + gameData.wager * 2 // Winner gets double the wager
                    })
                  }

                  toast.success("You won!")
                  navigate("/")
                } catch (error) {
                  logger.error('Game', 'Error declaring win', { error, gameId })
                  toast.error("Error declaring win!")
                }
              }}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              SAMPLE BUTTON TO DECLARE WIN
            </button>
          </>
        )}
      </div>
    </div>
  )
}

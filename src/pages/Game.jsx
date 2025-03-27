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

  // We store each player's leftover time in ms:
  const [whiteLocalTime, setWhiteLocalTime] = useState(300000) // 5 min
  const [blackLocalTime, setBlackLocalTime] = useState(300000) // 5 min

  // We'll have one interval for the active side
  const clockIntervalRef = useRef(null)

  // Single Chess instance
  const chessRef = useRef(null)
  const [fen, setFen] = useState("")

  // Initialize Chess instance only once
  useEffect(() => {
    if (!chessRef.current) {
      chessRef.current = new Chess()
      setFen(chessRef.current.fen())
    }
  }, [])

  // Stop any ticking clock
  function stopClock() {
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current)
      clockIntervalRef.current = null
    }
  }

  // Start a local clock for whichever side is active
  function startClockForActiveSide(activeSide) {
    stopClock() // Just to be sure
    // We'll track last tick in a ref so we know how many ms pass each interval
    let lastTick = Date.now()

    clockIntervalRef.current = setInterval(() => {
      const now = Date.now()
      const elapsed = now - lastTick
      lastTick = now

      if (activeSide === "w") {
        setWhiteLocalTime((prev) => {
          const nextVal = Math.max(0, prev - elapsed)
          if (nextVal <= 0) {
            clearInterval(clockIntervalRef.current)
            clockIntervalRef.current = null
            handleTimeUp("b") // If white hits 0, black wins
            return 0
          }
          return nextVal
        })
      } else {
        setBlackLocalTime((prev) => {
          const nextVal = Math.max(0, prev - elapsed)
          if (nextVal <= 0) {
            clearInterval(clockIntervalRef.current)
            clockIntervalRef.current = null
            handleTimeUp("w") // If black hits 0, white wins
            return 0
          }
          return nextVal
        })
      }
    }, 250) // update 4 times/sec for smoother countdown
  }

  // Handle time up
  async function handleTimeUp(winner) {
    stopClock()
    try {
      if (!gameData) return

      const gameRef = doc(db, "games", gameId)
      // If currentTurn was 'w', we set whiteTime = 0, etc.
      const updateData = {
        status: "finished",
        winner: winner,
        endTime: serverTimestamp(),
      }

      // Optionally store leftover for the side that didn't lose on time
      // For the side that lost, set to 0
      if (gameData.currentTurn === "w") {
        updateData.whiteTime = 0
        updateData.blackTime = gameData.blackTime
      } else {
        updateData.blackTime = 0
        updateData.whiteTime = gameData.whiteTime
      }

      await updateDoc(gameRef, updateData)

      // Wager distribution
      if (winner !== "draw") {
        const winnerId = (winner === "w") ? gameData.whitePlayer : gameData.blackPlayer
        const userRef = doc(db, "users", winnerId)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const userData = userSnap.data()
          await updateDoc(userRef, {
            balance: (userData.balance || 0) + gameData.wager * 2
          })
        }
      }
      toast.success(winner === myColor ? "You won on time!" : "You lost on time!")
    } catch (error) {
      logger.error('Game', 'Error updating game status for time up', { error, gameId })
      toast.error("Error updating game status!")
    }
  }

  // Firestore subscription
  useEffect(() => {
    if (!gameId || !user) return

    logger.info('Game', 'Initializing game component', { gameId, userId: user.uid })
    const gameRef = doc(db, "games", gameId)
    const unsubscribe = onSnapshot(gameRef, (snapshot) => {
      if (!snapshot.exists()) {
        logger.error('Game', 'Game document not found', { gameId })
        toast.error("Game not found!")
        navigate("/")
        return
      }

      const newData = snapshot.data()
      setGameData(newData)

      // Load FEN
      try {
        if (newData.fen && chessRef.current) {
          if (chessRef.current.fen() !== newData.fen) {
            chessRef.current.load(newData.fen)
            setFen(newData.fen)
          }
        } else if (chessRef.current) {
          chessRef.current.reset()
          setFen(chessRef.current.fen())
        }
      } catch (err) {
        logger.error('Game', 'Error loading FEN', { err, gameId })
        toast.error("Error loading game position!")
      }

      setMyColor(newData.whitePlayer === user.uid ? "w" : "b")
      setError(null)
      setMoveHistory(newData.moveHistory || [])

      // If game is not in progress or both players haven't joined, stop clock
      if (newData.status !== "in_progress" || !newData.whitePlayer || !newData.blackPlayer) {
        stopClock()
        return
      }

      // Only update times if they've changed in Firestore
      // This prevents resetting times on every snapshot
      if (newData.whiteTime !== gameData?.whiteTime || newData.blackTime !== gameData?.blackTime) {
        // 1) Grab leftover times from doc in ms
        const docWhiteTime = newData.whiteTime ?? 300000
        const docBlackTime = newData.blackTime ?? 300000

        // 2) Compute how long since last move
        let elapsed = 0
        if (newData.lastMoveTime) {
          const lastMoveMillis = newData.lastMoveTime.toDate().getTime()
          const now = Date.now()
          elapsed = now - lastMoveMillis
        }

        // 3) If doc says it's white's turn, we reduce white's doc leftover by elapsed
        //    black stays frozen at docBlackTime
        if (newData.currentTurn === 'w') {
          const newWhiteLocal = Math.max(0, docWhiteTime - elapsed)
          setWhiteLocalTime(newWhiteLocal)
          setBlackLocalTime(docBlackTime) // freeze black
          // Then start ticking white only
          stopClock()
          startClockForActiveSide('w')
        } else {
          // black's turn
          const newBlackLocal = Math.max(0, docBlackTime - elapsed)
          setBlackLocalTime(newBlackLocal)
          setWhiteLocalTime(docWhiteTime) // freeze white
          stopClock()
          startClockForActiveSide('b')
        }
      } else if (newData.currentTurn !== gameData?.currentTurn) {
        // If only the turn changed, just switch which clock is ticking
        stopClock()
        startClockForActiveSide(newData.currentTurn)
      } else if (newData.status === "in_progress" && gameData?.status !== "in_progress" && newData.whitePlayer && newData.blackPlayer) {
        // Game just started and both players have joined, initialize times to 5 minutes
        setWhiteLocalTime(300000)
        setBlackLocalTime(300000)
        // Start clock for white (first player)
        stopClock()
        startClockForActiveSide('w')
      }
    })

    return () => {
      unsubscribe()
      stopClock()
    }
  }, [gameId, user, navigate])

  async function handleMove(sourceSquare, targetSquare, piece) {
    if (!gameData || gameData.status !== "in_progress" || !chessRef.current) return false

    const isPlayerTurn = (
      (gameData.currentTurn === "w" && gameData.whitePlayer === user.uid) ||
      (gameData.currentTurn === "b" && gameData.blackPlayer === user.uid)
    )
    if (!isPlayerTurn) {
      toast.error("It's not your turn!")
      return false
    }

    const pieceColor = piece[0] // 'w' or 'b'
    if (pieceColor !== gameData.currentTurn) {
      toast.error("You can only move your own pieces!")
      return false
    }

    try {
      // Stop the local clock while we finalize the move
      stopClock()

      const result = chessRef.current.move({
      from: sourceSquare,
      to: targetSquare,
        promotion: 'q'
      })
      if (result === null) {
        toast.error("Illegal move!")
        // If illegal, restart the clock for the same side
        if (gameData.currentTurn) {
          startClockForActiveSide(gameData.currentTurn)
        }
        return false
      }

      const isCheckmate = chessRef.current.isCheckmate()
      const isDraw = chessRef.current.isDraw()
      const gameStatus = isCheckmate ? "finished" : (isDraw ? "finished" : "in_progress")
      const winner = isCheckmate ? gameData.currentTurn : (isDraw ? "draw" : null)

      const newFen = chessRef.current.fen()
      const finishingSide = gameData.currentTurn // e.g. 'w'
      const newTurn = (finishingSide === 'w') ? 'b' : 'w'

      // Store both players' current times
      const finishingTime = (finishingSide === 'w')
        ? whiteLocalTime
        : blackLocalTime

      // Store the other player's time from local state too
      const otherSideTime = (finishingSide === 'w')
        ? blackLocalTime
        : whiteLocalTime

      // Update local state for Fen or history
      setFen(newFen)
      setMoveHistory(prev => [
        ...prev,
        {
          number: prev.length + 1,
          white: (result.color === 'w') ? result.san : '',
          black: (result.color === 'b') ? result.san : '',
          timestamp: new Date().toISOString()
        }
      ])

      const now = new Date()
      const gameRef = doc(db, "games", gameId)

      // We'll do a simple updateDoc
      let retries = 3
      while (retries > 0) {
        try {
          await updateDoc(gameRef, {
            fen: newFen,
            currentTurn: newTurn,
            lastMoveTime: serverTimestamp(),
            // Store both players' times
            whiteTime: finishingSide === 'w' ? finishingTime : otherSideTime,
            blackTime: finishingSide === 'b' ? finishingTime : otherSideTime,
            moveHistory: arrayUnion({
              number: moveHistory.length + 1,
              white: result.color === "w" ? result.san : "",
              black: result.color === "b" ? result.san : "",
              timestamp: now.toISOString()
            }),
            ...(isCheckmate || isDraw ? {
              status: "finished",
              winner: winner,
              endTime: serverTimestamp()
            } : {})
          })

          // If ended, handle payouts
          if (isCheckmate || isDraw) {
            if (winner === "draw") {
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
            } else {
              const winnerId = (winner === "w") ? gameData.whitePlayer : gameData.blackPlayer
              const userRef = doc(db, "users", winnerId)
              const userSnap = await getDoc(userRef)
              if (userSnap.exists()) {
                const userData = userSnap.data()
                await updateDoc(userRef, {
                  balance: (userData.balance || 0) + gameData.wager * 2
                })
              }
              toast.success(winnerId === user.uid ? "Checkmate! You won!" : "Checkmate! You lost!")
            }
          }
          break
        } catch (error) {
          retries--
          if (retries === 0) throw error
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      return true
    } catch (error) {
      logger.error('Game', 'Error making move', { error, gameId })
      if (chessRef.current) {
        chessRef.current.undo()
        setFen(chessRef.current.fen())
      }
      toast.error("Error making move! Please try again.")
      // If move fails, re–start clock for finishingSide
      if (gameData?.currentTurn) {
        startClockForActiveSide(gameData.currentTurn)
      }
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
          White: {formatTime(whiteLocalTime)}
        </div>
        <div className={`text-2xl font-bold ${gameData?.currentTurn === "b" ? "text-blue-600" : "text-gray-600"}`}>
          Black: {formatTime(blackLocalTime)}
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
                  // The winner is the player who clicked the button
                  const winner = user.uid === gameData.whitePlayer ? "w" : "b"
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

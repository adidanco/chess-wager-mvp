// ✅ ADDED: Game.jsx
import React, { useEffect, useState, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { doc, onSnapshot, updateDoc, getDoc, serverTimestamp } from "firebase/firestore"
import { db, auth } from "../firebase"
import { Chess } from "chess.js"
import { Chessboard } from "react-chessboard"  // from react-chessboard
import toast from "react-hot-toast"
import { logger } from "../utils/logger"

// Helper function to format milliseconds into MM:SS
const formatTime = (ms) => {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function Game() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const [fen, setFen] = useState("")       // current board position
  const [gameData, setGameData] = useState(null) // store entire game doc
  const chessRef = useRef(null)            // ref to store a Chess instance
  const [myColor, setMyColor] = useState(null)
  const [error, setError] = useState(null)
  const [moveHistory, setMoveHistory] = useState([])
  const [whiteTimeDisplay, setWhiteTimeDisplay] = useState(300000)
  const [blackTimeDisplay, setBlackTimeDisplay] = useState(300000)

  useEffect(() => {
    if (!gameId) {
      logger.error('Game', 'No game ID provided')
      toast.error("Invalid game URL!")
      navigate("/")
      return
    }

    if (!auth.currentUser) {
      logger.warn('Game', 'User not authenticated, redirecting to login')
      navigate("/login")
      return
    }

    logger.info('Game', 'Initializing game component', { gameId, userId: auth.currentUser.uid })

    // Initialize chess instance
    chessRef.current = new Chess()

    // Subscribe to game updates
    const gameRef = doc(db, "games", gameId)
    const unsubscribe = onSnapshot(gameRef, (doc) => {
      if (!doc.exists()) {
        logger.error('Game', 'Game not found', { gameId })
        toast.error("Game not found!")
        navigate("/")
        return
      }

      const data = doc.data()
      setGameData(data)
      setFen(data.currentFen)
      setMoveHistory(data.moveHistory || [])
      setWhiteTimeDisplay(data.whiteTime || 300000)
      setBlackTimeDisplay(data.blackTime || 300000)

      // Set player color
      if (data.player1Id === auth.currentUser.uid) {
        setMyColor("w")
      } else if (data.player2Id === auth.currentUser.uid) {
        setMyColor("b")
      }
    }, (error) => {
      logger.error('Game', 'Error subscribing to game updates', { error })
      toast.error("Error loading game!")
      navigate("/")
    })

    return () => unsubscribe()
  }, [gameId, navigate])

  // Helper function to handle payouts
  const handlePayout = async (winnerColor) => {
    if (!gameId) {
      logger.error('Game', 'Cannot process payout: no game ID')
      return
    }

    logger.info('Game', 'Processing payout', { gameId, winnerColor })
    try {
      const gameRef = doc(db, "games", gameId)
      const gameSnap = await getDoc(gameRef)
      if (!gameSnap.exists()) {
        logger.error('Game', 'Game not found during payout', { gameId })
        throw new Error("Game not found!")
      }

      const gameData = gameSnap.data()
      const pot = gameData.pot
      const winnerId = winnerColor === "w" ? gameData.player1Id : gameData.player2Id
      const loserId = winnerColor === "w" ? gameData.player2Id : gameData.player1Id

      logger.debug('Game', 'Payout details', { pot, winnerId, loserId })

      // Update winner's balance
      const winnerRef = doc(db, "users", winnerId)
      const winnerSnap = await getDoc(winnerRef)
      if (!winnerSnap.exists()) {
        logger.error('Game', 'Winner not found during payout', { winnerId })
        throw new Error("Winner not found!")
      }
      const winnerData = winnerSnap.data()
      await updateDoc(winnerRef, {
        balance: (winnerData.balance || 0) + pot,
        "stats.wins": (winnerData.stats?.wins || 0) + 1
      })

      // Update loser's stats
      const loserRef = doc(db, "users", loserId)
      const loserSnap = await getDoc(loserRef)
      if (!loserSnap.exists()) {
        logger.error('Game', 'Loser not found during payout', { loserId })
        throw new Error("Loser not found!")
      }
      const loserData = loserSnap.data()
      await updateDoc(loserRef, {
        "stats.losses": (loserData.stats?.losses || 0) + 1
      })

      logger.info('Game', 'Payout completed successfully', { gameId, winnerId, pot })
    } catch (err) {
      logger.error('Game', 'Payout failed', { error: err, gameId, winnerColor })
      throw err
    }
  }

  // Helper function to handle draw refunds
  const handleDrawRefund = async () => {
    logger.info('Game', 'Processing draw refund', { gameId })
    try {
      const gameRef = doc(db, "games", gameId)
      const gameSnap = await getDoc(gameRef)
      if (!gameSnap.exists()) {
        logger.error('Game', 'Game not found during draw refund', { gameId })
        throw new Error("Game not found!")
      }

      const gameData = gameSnap.data()
      const wager = gameData.wager

      logger.debug('Game', 'Draw refund details', { wager, player1Id: gameData.player1Id, player2Id: gameData.player2Id })

      // Refund player1
      const player1Ref = doc(db, "users", gameData.player1Id)
      const player1Snap = await getDoc(player1Ref)
      if (!player1Snap.exists()) {
        logger.error('Game', 'Player1 not found during draw refund', { player1Id: gameData.player1Id })
        throw new Error("Player1 not found!")
      }
      const player1Data = player1Snap.data()
      await updateDoc(player1Ref, {
        balance: (player1Data.balance || 0) + wager,
        "stats.draws": (player1Data.stats?.draws || 0) + 1
      })

      // Refund player2
      const player2Ref = doc(db, "users", gameData.player2Id)
      const player2Snap = await getDoc(player2Ref)
      if (!player2Snap.exists()) {
        logger.error('Game', 'Player2 not found during draw refund', { player2Id: gameData.player2Id })
        throw new Error("Player2 not found!")
      }
      const player2Data = player2Snap.data()
      await updateDoc(player2Ref, {
        balance: (player2Data.balance || 0) + wager,
        "stats.draws": (player2Data.stats?.draws || 0) + 1
      })

      logger.info('Game', 'Draw refund completed successfully', { gameId })
    } catch (err) {
      logger.error('Game', 'Draw refund failed', { error: err, gameId })
      throw err
    }
  }

  // Add clock tick effect
  useEffect(() => {
    if (!gameData || gameData.status === "finished") return

    logger.debug('Game', 'Starting clock tick', { 
      currentTurn: gameData.currentTurn,
      whiteTime: gameData.whiteTime,
      blackTime: gameData.blackTime
    })

    const intervalId = setInterval(() => {
      const now = Date.now()
      const elapsed = now - gameData.lastMoveTimestamp?.toDate().getTime()

      let whiteDisplay = gameData.whiteTime
      let blackDisplay = gameData.blackTime

      if (gameData.currentTurn === "w") {
        whiteDisplay = Math.max(0, whiteDisplay - elapsed)
      } else {
        blackDisplay = Math.max(0, blackDisplay - elapsed)
      }

      setWhiteTimeDisplay(whiteDisplay)
      setBlackTimeDisplay(blackDisplay)

      // Check for time out
      if (whiteDisplay <= 0 || blackDisplay <= 0) {
        const loserColor = whiteDisplay <= 0 ? "w" : "b"
        const winnerColor = loserColor === "w" ? "b" : "w"
        
        logger.info('Game', 'Time out detected', { 
          gameId, 
          loserColor, 
          winnerColor,
          whiteTime: whiteDisplay,
          blackTime: blackDisplay
        })
        
        const gameRef = doc(db, "games", gameId)
        updateDoc(gameRef, {
          status: "finished",
          winner: winnerColor
        }).then(() => {
          handlePayout(winnerColor)
          toast.success(`Game Over! ${winnerColor === "w" ? "White" : "Black"} wins on time!`)
        }).catch(err => {
          logger.error('Game', 'Error handling time out', { error: err, gameId })
          toast.error("Error processing time out")
        })
      }
    }, 100)

    return () => {
      logger.debug('Game', 'Cleaning up clock tick', { gameId })
      clearInterval(intervalId)
    }
  }, [gameData, gameId])

  const onDrop = async (sourceSquare, targetSquare) => {
    logger.debug('Game', 'Attempting move', { 
      gameId, 
      sourceSquare, 
      targetSquare, 
      currentTurn: gameData?.currentTurn,
      myColor 
    })

    if (!myColor) {
      logger.warn('Game', 'Move attempted without color assignment', { gameId })
      toast.error("Your color hasn't been assigned yet")
      return false
    }
    if (gameData?.currentTurn !== myColor) {
      logger.warn('Game', 'Move attempted out of turn', { 
        gameId, 
        currentTurn: gameData?.currentTurn,
        myColor 
      })
      toast.error("Not your turn!")
      return false
    }
    if (gameData?.status === "finished") {
      logger.warn('Game', 'Move attempted in finished game', { gameId })
      toast.error("Game is finished!")
      return false
    }
    if (gameData?.status === "waiting") {
      logger.warn('Game', 'Move attempted while waiting for opponent', { gameId })
      toast.error("Waiting for opponent to join!")
      return false
    }
    if (gameData?.status !== "in_progress") {
      logger.warn('Game', 'Move attempted in invalid game state', { 
        gameId, 
        status: gameData?.status 
      })
      toast.error("Game is not in progress!")
      return false
    }

    const move = chessRef.current.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q"
    })
    
    if (move == null) {
      logger.warn('Game', 'Illegal move attempted', { 
        gameId, 
        sourceSquare, 
        targetSquare 
      })
      toast.error("Illegal move!")
      return false
    } else {
      try {
        const newFen = chessRef.current.fen()
        const nextTurn = (myColor === "w") ? "b" : "w"
        const pgn = chessRef.current.pgn()
        const newMoveHistory = [...moveHistory, {
          number: moveHistory.length + 1,
          white: move.color === "w" ? pgn.split(" ").pop() : "",
          black: move.color === "b" ? pgn.split(" ").pop() : "",
          timestamp: new Date().toISOString()
        }]

        // Calculate time spent on move
        const now = Date.now()
        const timeSpent = now - gameData.lastMoveTimestamp?.toDate().getTime()

        let newWhiteTime = gameData.whiteTime
        let newBlackTime = gameData.blackTime

        if (gameData.currentTurn === "w") {
          newWhiteTime = Math.max(0, newWhiteTime - timeSpent)
        } else {
          newBlackTime = Math.max(0, newBlackTime - timeSpent)
        }

        logger.info('Game', 'Move successful', { 
          gameId, 
          move, 
          newFen, 
          nextTurn,
          whiteTime: newWhiteTime,
          blackTime: newBlackTime
        })

        const gameRef = doc(db, "games", gameId)
        await updateDoc(gameRef, {
          currentFen: newFen,
          currentTurn: nextTurn,
          moveHistory: newMoveHistory,
          pgn: pgn,
          whiteTime: newWhiteTime,
          blackTime: newBlackTime,
          lastMoveTimestamp: serverTimestamp()
        })

        if (chessRef.current.isGameOver()) {
          const checkmated = chessRef.current.isCheckmate()
          let gameResult = "draw"
          let winnerColor = null

          if (checkmated) {
            gameResult = myColor
            winnerColor = myColor
          }

          logger.info('Game', 'Game over detected', { 
            gameId, 
            checkmated, 
            gameResult, 
            winnerColor 
          })

          await updateDoc(gameRef, {
            status: "finished",
            winner: gameResult
          })

          if (checkmated) {
            try {
              await handlePayout(gameResult)
              toast.success(`Game Over! Winner: ${winnerColor === "w" ? "White" : "Black"}`)
            } catch (err) {
              logger.error('Game', 'Payout error after checkmate', { 
                error: err, 
                gameId, 
                gameResult 
              })
              toast.error("Game Over! Error processing payout.")
            }
          } else {
            try {
              await handleDrawRefund()
              toast.success("Game Over! It's a draw!")
            } catch (err) {
              logger.error('Game', 'Refund error after draw', { 
                error: err, 
                gameId 
              })
              toast.error("Game Over! Error processing refund.")
            }
          }
        }

        return true
      } catch (err) {
        logger.error('Game', 'Error updating game state', { 
          error: err, 
          gameId, 
          move 
        })
        toast.error("Failed to update game state")
        return false
      }
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
          <Chessboard
            position={fen}
            onDrop={onDrop}
          />
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
                if (!gameData.player2Id) {
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
                  await handlePayout(otherColor)
                  toast.success("Game Over! You resigned.")
                } catch (err) {
                  console.error("Payout error:", err)
                  toast.error("Game Over! Error processing payout.")
                }
              }}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              {gameData.player2Id ? "Resign" : "Cancel Game"}
            </button>

            {gameData.player2Id && (
              <button
                onClick={async () => {
                  const gameRef = doc(db, "games", gameId)
                  await updateDoc(gameRef, {
                    status: "finished",
                    winner: "draw"
                  })
                  try {
                    await handleDrawRefund()
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

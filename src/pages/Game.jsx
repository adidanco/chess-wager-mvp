// ✅ ADDED: Game.jsx
import React, { useEffect, useState, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { doc, onSnapshot, updateDoc, getDoc, serverTimestamp } from "firebase/firestore"
import { db, auth } from "../firebase"
import { Chess } from "chess.js"
import { Chessboard } from "react-chessboard"  // from react-chessboard
import toast from "react-hot-toast"

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

  // Helper function to handle payouts
  async function handlePayout(winnerColor) {
    const gameRef = doc(db, "games", gameId)
    const gameSnap = await getDoc(gameRef)

    if (!gameSnap.exists()) throw new Error("Game doc not found")

    const data = gameSnap.data()
    const { player1Id, player2Id, player1Color, player2Color, pot } = data

    // Identify the winner's UID based on color
    let winnerUid
    if (winnerColor === player1Color) {
      winnerUid = player1Id
    } else {
      winnerUid = player2Id
    }

    // 1) Add pot to winner's balance
    const winnerRef = doc(db, "users", winnerUid)
    const winnerSnap = await getDoc(winnerRef)
    if (!winnerSnap.exists()) throw new Error("Winner user doc not found!")

    const winnerData = winnerSnap.data()
    const currentBalance = winnerData.balance || 0

    await updateDoc(winnerRef, {
      balance: currentBalance + pot
    })

    // 2) Update winner's stats
    await updateDoc(winnerRef, {
      stats: {
        ...winnerData.stats,
        wins: (winnerData.stats?.wins || 0) + 1
      }
    })

    // 3) Update the loser's stats
    let loserUid
    if (winnerUid === player1Id) loserUid = player2Id
    else loserUid = player1Id

    if (loserUid) {
      const loserRef = doc(db, "users", loserUid)
      const loserSnap = await getDoc(loserRef)
      if (loserSnap.exists()) {
        const loserData = loserSnap.data()
        await updateDoc(loserRef, {
          stats: {
            ...loserData.stats,
            losses: (loserData.stats?.losses || 0) + 1
          }
        })
      }
    }
  }

  // Helper function to handle draw refunds
  async function handleDrawRefund() {
    const gameRef = doc(db, "games", gameId)
    const gameSnap = await getDoc(gameRef)
    if (!gameSnap.exists()) return

    const data = gameSnap.data()
    const { player1Id, player2Id, wager } = data

    async function refund(uid) {
      const userRef = doc(db, "users", uid)
      const userSnap = await getDoc(userRef)
      if (!userSnap.exists()) return
      const userData = userSnap.data()
      const currentBalance = userData.balance || 0
      await updateDoc(userRef, {
        balance: currentBalance + wager,
        stats: {
          ...userData.stats,
          draws: (userData.stats?.draws || 0) + 1
        }
      })
    }

    await refund(player1Id)
    await refund(player2Id)
  }

  useEffect(() => {
    if (!auth.currentUser) {
      navigate("/login")
      return
    }
    
    // Initialize chessRef once
    chessRef.current = new Chess()
    
    // Subscribe to game doc
    const gameRef = doc(db, "games", gameId)
    const unsubscribe = onSnapshot(gameRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data()
        setGameData(data)
        
        // Don't allow moves if game is finished
        if (data.status === "finished") {
          setError("Game is finished!")
          toast.error("Game is finished!")
        }
        
        if (data.currentFen) {
          setFen(data.currentFen)
          chessRef.current.load(data.currentFen)
        }

        // Update move history if available
        if (data.moveHistory) {
          setMoveHistory(data.moveHistory)
        }

        // Update time displays from Firestore
        if (data.whiteTime !== undefined) {
          setWhiteTimeDisplay(data.whiteTime)
        }
        if (data.blackTime !== undefined) {
          setBlackTimeDisplay(data.blackTime)
        }
      } else {
        setError("Game not found!")
        toast.error("Game not found!")
      }
    })
    
    // Figure out myColor once the doc is loaded
    const loadMyColor = async () => {
      try {
        const docSnap = await getDoc(gameRef)
        if (docSnap.exists()) {
          const gData = docSnap.data()
          if (gData.player1Id === auth.currentUser?.uid) {
            setMyColor(gData.player1Color)
          } else if (gData.player2Id === auth.currentUser?.uid) {
            setMyColor(gData.player2Color)
          } else {
            setError("You are not a player in this game!")
          }
        }
      } catch (err) {
        setError("Error loading game data")
        console.error(err)
      }
    }
    loadMyColor()

    return () => unsubscribe()
  }, [gameId, navigate])

  // Add clock tick effect
  useEffect(() => {
    if (!gameData || gameData.status === "finished") return

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
        
        const gameRef = doc(db, "games", gameId)
        updateDoc(gameRef, {
          status: "finished",
          winner: winnerColor
        }).then(() => {
          handlePayout(winnerColor)
          toast.success(`Game Over! ${winnerColor === "w" ? "White" : "Black"} wins on time!`)
        }).catch(err => {
          console.error("Error handling time out:", err)
          toast.error("Error processing time out")
        })
      }
    }, 100)

    return () => clearInterval(intervalId)
  }, [gameData, gameId])

  const onDrop = async (sourceSquare, targetSquare) => {
    if (!myColor) {
      toast.error("Your color hasn't been assigned yet")
      return false
    }
    if (gameData?.currentTurn !== myColor) {
      toast.error("Not your turn!")
      return false
    }
    if (gameData?.status === "finished") {
      toast.error("Game is finished!")
      return false
    }

    const move = chessRef.current.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q"
    })
    
    if (move == null) {
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

          await updateDoc(gameRef, {
            status: "finished",
            winner: gameResult
          })

          if (checkmated) {
            try {
              await handlePayout(gameResult)
              toast.success(`Game Over! Winner: ${winnerColor === "w" ? "White" : "Black"}`)
            } catch (err) {
              console.error("Payout error:", err)
              toast.error("Game Over! Error processing payout.")
            }
          } else {
            try {
              await handleDrawRefund()
              toast.success("Game Over! It's a draw!")
            } catch (err) {
              console.error("Refund error:", err)
              toast.error("Game Over! Error processing refund.")
            }
          }
        }

        return true
      } catch (err) {
        toast.error("Failed to update game state")
        console.error(err)
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
              Resign
            </button>

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
          </>
        )}
      </div>
    </div>
  )
}

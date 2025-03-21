// ✅ ADDED: Game.jsx
import React, { useEffect, useState, useRef } from "react"
import { useParams } from "react-router-dom"
import { doc, onSnapshot, updateDoc } from "firebase/firestore"
import { db, auth } from "../firebase"
import { Chess } from "chess.js"
import { Chessboard } from "react-chessboard"  // from react-chessboard

export default function Game() {
  const { gameId } = useParams()
  const [fen, setFen] = useState("")       // current board position
  const chessRef = useRef(null)            // ref to store a Chess instance

  useEffect(() => {
    if (!auth.currentUser) {
      // optionally redirect to login if no user
    }
    
    // Initialize chessRef once
    chessRef.current = new Chess()
    
    // Subscribe to game doc
    const gameRef = doc(db, "games", gameId)
    const unsubscribe = onSnapshot(gameRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data()
        // Update local FEN and update chessRef
        if (data.currentFen) {
          setFen(data.currentFen)
          chessRef.current.load(data.currentFen)
        }
      }
    })
    
    return () => unsubscribe()
  }, [gameId])

  const onDrop = async (sourceSquare, targetSquare) => {
    // Attempt a move in chessRef
    const move = chessRef.current.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q", // always promote to a queen for simplicity
    })
    
    if (move == null) {
      // Illegal move
      return false
    } else {
      // Legal move, update Firestore
      const newFen = chessRef.current.fen()
      const gameRef = doc(db, "games", gameId)
      await updateDoc(gameRef, { currentFen: newFen })
      return true
    }
  }

  // If fen is empty or doc not loaded yet
  if (!fen) {
    return <div className="p-4">Loading game...</div>
  }

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-xl mb-4">Game ID: {gameId}</h2>
      <Chessboard
        position={fen}
        onPieceDrop={onDrop}
      />
    </div>
  )
}

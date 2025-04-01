import { useState, useRef, useEffect, useCallback } from "react";
import { Chess } from "chess.js";
import { doc, onSnapshot, updateDoc, getDoc, serverTimestamp, arrayUnion, increment } from "firebase/firestore";
import { db } from "../firebase";
import { GAME_STATUS, PLAYER_COLORS, DEFAULT_TIMER } from "../utils/constants";
import toast from "react-hot-toast";
import { logger } from "../utils/logger";
import useChessClock from "./useChessClock";

/**
 * Custom hook to manage chess game logic
 */
const useChessGame = (gameId, userId, navigate) => {
  // Game state
  const [gameData, setGameData] = useState(null);
  const [myColor, setMyColor] = useState(null);
  const [error, setError] = useState(null);
  const [moveHistory, setMoveHistory] = useState([]);
  const [fen, setFen] = useState("");
  const [isGameOver, setIsGameOver] = useState(false);

  // Chess instance reference
  const chessRef = useRef(null);
  const gameDataRef = useRef(gameData); // Ref to access latest gameData in callbacks/effects
  const activeClockSideRef = useRef(null); // Track which clock ('w' or 'b') is currently ticking

  // Initialize chess clock
  const {
    whiteTime,
    blackTime,
    stopClock: stopClockInternal, // Rename internal clock functions
    startClockForActiveSide: startClockInternal,
    setTimes
  } = useChessClock(DEFAULT_TIMER, DEFAULT_TIMER);

  // Refs for clock times to access latest value in handleMove
  const whiteTimeRef = useRef(whiteTime);
  const blackTimeRef = useRef(blackTime);
  useEffect(() => {
    whiteTimeRef.current = whiteTime;
    blackTimeRef.current = blackTime;
  }, [whiteTime, blackTime]);

  // Update gameData ref whenever gameData state changes
  useEffect(() => {
    gameDataRef.current = gameData;
  }, [gameData]);

  // Initialize Chess instance
  useEffect(() => {
    if (!chessRef.current) {
      chessRef.current = new Chess();
      setFen(chessRef.current.fen());
    }
  }, []);

  // Stable stopClock function using useCallback
  const stopClock = useCallback(() => {
    stopClockInternal();
    activeClockSideRef.current = null; // Reset active side when stopped
    logger.debug('useChessGame', 'Clock stopped');
  }, [stopClockInternal]);

  // Stable callback for handleTimeUp
  const handleTimeUp = useCallback(async (winner) => {
    stopClock(); // Ensure clock is stopped
    const currentData = gameDataRef.current; // Use ref for latest data
    logger.info('useChessGame', 'Time up!', { winner, gameId });
    try {
      // Added check: Only proceed if game was actually in progress
      if (!currentData || currentData.status !== GAME_STATUS.IN_PROGRESS) {
          logger.warn('useChessGame', 'handleTimeUp called but game not in progress', { status: currentData?.status });
          return;
      }

      const gameRef = doc(db, "games", gameId);
      const loserSide = winner === PLAYER_COLORS.WHITE ? PLAYER_COLORS.BLACK : PLAYER_COLORS.WHITE;
      
      // Prepare update data
      const updateData = {
        status: GAME_STATUS.FINISHED,
        winner: winner,
        endTime: serverTimestamp(),
        // Set loser time to 0, keep winner time as is (from local ref)
        [`${loserSide}Time`]: 0, 
        [`${winner}Time`]: loserSide === PLAYER_COLORS.WHITE ? blackTimeRef.current : whiteTimeRef.current
      };
      
      await updateDoc(gameRef, updateData);

      // Handle wager distribution (Only if winner is not 'draw')
      if (winner !== "draw") {
         const winnerId = (winner === PLAYER_COLORS.WHITE) ? currentData.whitePlayer : currentData.blackPlayer;
         const loserId = (winner === PLAYER_COLORS.WHITE) ? currentData.blackPlayer : currentData.whitePlayer; // Need loser ID for stats potentially later
         
         // Ensure winnerId and loserId are valid before proceeding
         if (winnerId && loserId && currentData.wager > 0) { // Added wager check
            const winnerRef = doc(db, "users", winnerId);
             try {
                 // Use increment for balance updates
                 await updateDoc(winnerRef, { balance: increment(currentData.wager * 2) });
                 // TODO: Increment win count later
                 logger.info('useChessGame', 'Payout successful on time up', { winnerId, amount: currentData.wager * 2 });
             } catch (err) {
                 logger.error('useChessGame', 'Error updating winner balance on time up', { err, winnerId });
             }
             
            // TODO: Update loser stats later
         } else {
             logger.error('useChessGame', 'Missing player ID or zero wager for payout on time up', { winnerId, loserId, wager: currentData.wager });
         }
      }

      // Determine message based on whether the current user won or lost
      const playerColor = userId === currentData?.whitePlayer ? PLAYER_COLORS.WHITE : PLAYER_COLORS.BLACK;
      toast.success(winner === playerColor ? "You won on time!" : "You lost on time!");

    } catch (error) {
      logger.error('useChessGame', 'Error updating game status for time up', { error, gameId });
      toast.error("Error updating game status!");
    }
    // Removed setGameData from dependencies - relies on gameDataRef
  }, [gameId, userId, stopClock]); 

  // Stable startClock function
   const startClock = useCallback((side) => {
    if (activeClockSideRef.current === side) {
       // logger.debug('useChessGame', `Clock already running for side: ${side}`);
       return; // Don't restart if already running for the correct side
    }
    stopClock(); // Stop any existing clock first
    logger.debug('useChessGame', `Starting clock for side: ${side}`);
    startClockInternal(side, handleTimeUp); // Pass the stable handleTimeUp
    activeClockSideRef.current = side;
   }, [stopClock, startClockInternal, handleTimeUp]);

  // Handle move
  const handleMove = async (sourceSquare, targetSquare, piece) => {
    const currentData = gameDataRef.current; // Use ref
    // Check status using the ref
    if (!currentData || currentData.status !== GAME_STATUS.IN_PROGRESS || !chessRef.current) {
        logger.warn('handleMove', 'Move attempt while game not in progress or ready', { status: currentData?.status });
        return false;
    }

    const playerColor = userId === currentData.whitePlayer ? PLAYER_COLORS.WHITE : PLAYER_COLORS.BLACK;
    if (playerColor !== currentData.currentTurn) {
       toast.error("It's not your turn!");
       return false;
    }

    let result = null;
    try {
        result = chessRef.current.move({
            from: sourceSquare,
            to: targetSquare,
            promotion: 'q' // Assume promotion to queen for simplicity
        });

        if (result === null) {
            // This case should ideally be caught by react-chessboard's validation
            // but adding a toast here just in case.
            toast.error("Illegal move!"); 
            return false; // Don't proceed if move is illegal
        }

        // --- Move is legal, NOW stop clock and update Firestore ---
        stopClock(); // Correct position: Only stop if move is legal

        const isCheckmate = chessRef.current.isCheckmate();
        const isDraw = chessRef.current.isDraw();
        const gameEnded = isCheckmate || isDraw;
        // Winner is the one whose turn it *was* when checkmate/stalemate occurred
        const winner = isCheckmate ? currentData.currentTurn : (isDraw ? "draw" : null); 

        const newFen = chessRef.current.fen();
        const finishingSide = currentData.currentTurn;
        const newTurn = gameEnded ? null : (finishingSide === PLAYER_COLORS.WHITE) ? PLAYER_COLORS.BLACK : PLAYER_COLORS.WHITE;

        // *** Read times from Refs ***
        const finalWhiteTime = whiteTimeRef.current;
        const finalBlackTime = blackTimeRef.current;

        // Update local FEN immediately for responsiveness
        setFen(newFen);
        // Optimistically update move history (can be refined)
         setMoveHistory(prev => [
            ...(prev || []), 
            {
                number: (prev?.length || 0) + 1, 
                white: (result.color === PLAYER_COLORS.WHITE) ? result.san : '',
                black: (result.color === PLAYER_COLORS.BLACK) ? result.san : '',
                timestamp: new Date().toISOString() 
            }
        ]);

        const now = new Date(); // Consider using serverTimestamp for move timestamp if needed
        const gameRef = doc(db, "games", gameId);

        // Prepare Firestore update data
        const updateData = {
            fen: newFen,
            currentTurn: newTurn, // Set to null if game ended
            lastMoveTime: serverTimestamp(),
            whiteTime: finalWhiteTime,
            blackTime: finalBlackTime,
            moveHistory: arrayUnion({
                 number: (currentData.moveHistory?.length || 0) + 1, 
                 white: result.color === PLAYER_COLORS.WHITE ? result.san : "",
                 black: result.color === PLAYER_COLORS.BLACK ? result.san : "",
                 timestamp: now.toISOString() // Or serverTimestamp()
            }),
            ...(gameEnded && { // Conditionally add end game fields
                status: GAME_STATUS.FINISHED,
                winner: winner,
                endTime: serverTimestamp()
            })
        };

      // Perform Firestore update
      await updateDoc(gameRef, updateData);
      logger.info('useChessGame', 'Move successful, updated Firestore', { gameId, newTurn });

        // Handle payouts if game ended (only update state, payout handled by snapshot? No, do it here)
         if (gameEnded) {
            // setIsGameOver({ winner }); // Let snapshot handle this state

            // Payout logic 
             if (winner === "draw") {
                 if (currentData.wager > 0) {
                     const whiteUserRef = doc(db, "users", currentData.whitePlayer);
                     const blackUserRef = doc(db, "users", currentData.blackPlayer);
                     await updateDoc(whiteUserRef, { balance: increment(currentData.wager) });
                     await updateDoc(blackUserRef, { balance: increment(currentData.wager) });
                     toast.success("Game ended in a draw!");
                 }
             } else { // Checkmate
                 if (currentData.wager > 0) {
                     const winnerId = (winner === PLAYER_COLORS.WHITE) ? currentData.whitePlayer : currentData.blackPlayer;
                     const userRef = doc(db, "users", winnerId);
                     await updateDoc(userRef, { balance: increment(currentData.wager * 2) });
                     const userPlayerColor = userId === currentData.whitePlayer ? PLAYER_COLORS.WHITE : PLAYER_COLORS.BLACK;
                     toast.success(winner === userPlayerColor ? "Checkmate! You won!" : "Checkmate! You lost!");
                 }
             }
         }

        return true; // Indicate move was successful

    } catch (error) {
        logger.error('useChessGame', 'Error making move', { error, gameId });

        // Revert optimistic UI changes if Firestore update fails
        if (chessRef.current && result) {
             chessRef.current.undo();
             setFen(chessRef.current.fen());
             setMoveHistory(prev => prev?.slice(0, -1) || []); // Handle null case
        }

        toast.error("Error making move! Please try again.");
        
        // Attempt to restart clock for the player whose turn it was supposed to be
        if (currentData?.currentTurn) {
             startClock(currentData.currentTurn);
        }
        
        return false; // Indicate move failed
    }
  };

  // Firestore subscription
  useEffect(() => {
    if (!gameId || !userId) return;

    logger.info('useChessGame', 'Setting up Firestore subscription', { gameId, userId });
    const gameRef = doc(db, "games", gameId);

    const unsubscribe = onSnapshot(gameRef, (snapshot) => {
      if (!snapshot.exists()) {
        logger.error('useChessGame', 'Game document does not exist!', { gameId });
        toast.error("Game not found or deleted!");
        stopClock(); 
        navigate("/");
        return;
      }

      const newData = snapshot.data();
      // Store previous data state from ref *before* updating state/ref
      // const prevData = gameDataRef.current; 

      // --- Core State Updates --- (Triggers re-render)
      setGameData(newData);

      // --- FEN Update --- 
      if (newData.fen && chessRef.current && chessRef.current.fen() !== newData.fen) {
        try {
          chessRef.current.load(newData.fen);
          setFen(newData.fen);
        } catch (err) { 
             logger.error('useChessGame', 'Error loading FEN from snapshot', { err, gameId, fen: newData.fen });
             toast.error("Error loading game position!");
        }
      }

      // --- Derived State Updates ---
      setMyColor(newData.whitePlayer === userId ? PLAYER_COLORS.WHITE : PLAYER_COLORS.BLACK);
      setError(null); 
      setMoveHistory(newData.moveHistory || []); 
      
      // --- Game Over State --- 
      const isNowFinished = newData.status === GAME_STATUS.FINISHED;
      setIsGameOver(isNowFinished ? { winner: newData.winner } : false);

      // --- Clock and Interaction Logic --- 
      const gameIsActive = newData.status === GAME_STATUS.IN_PROGRESS &&
                           newData.whitePlayer &&
                           newData.blackPlayer;

      if (isNowFinished) {
        // No need to log here, handled by handleMove/handleTimeUp or could add specific log
        stopClock();
        return; // Stop processing if game is finished
      }

      if (!gameIsActive) {
        // logger.debug('useChessGame', 'Game not active, stopping clock', { status: newData.status });
        stopClock();
        return; // Stop if not in progress or players missing
      }

      // --- Game is Active: Synchronize Clock --- 
      const docWhiteTime = newData.whiteTime ?? DEFAULT_TIMER;
      const docBlackTime = newData.blackTime ?? DEFAULT_TIMER;
      let elapsed = 0;

      if (newData.lastMoveTime?.toDate) {
        const lastMoveMillis = newData.lastMoveTime.toDate().getTime();
        const now = Date.now();
        elapsed = Math.max(0, now - lastMoveMillis);
      } else if (newData.lastMoveTime) {
        // Log warning if lastMoveTime exists but isn't a Timestamp
        logger.warn('useChessGame', 'lastMoveTime is not a Firestore Timestamp in active game', { lastMoveTime: newData.lastMoveTime });
      }

      let targetWhiteTime = docWhiteTime;
      let targetBlackTime = docBlackTime;

      // Subtract elapsed time only from the player whose turn it was *at* lastMoveTime
      // We need to know whose turn it *was* before this snapshot. This is tricky.
      // Simpler approach: Subtract elapsed time from the player whose turn it IS NOT now.
      // Even simpler: Apply elapsed time based on whose turn it IS now. If White's turn, White's time = docTime - elapsed.
      if (newData.currentTurn === PLAYER_COLORS.WHITE) {
          targetWhiteTime = Math.max(0, docWhiteTime - elapsed);
          // Black's time remains as it was in the document
      } else if (newData.currentTurn === PLAYER_COLORS.BLACK) { 
          targetBlackTime = Math.max(0, docBlackTime - elapsed);
           // White's time remains as it was in the document
      }

      // logger.debug('useChessGame', 'Snapshot - Active Game Clock Sync', {
      //   newDataTurn: newData.currentTurn, elapsed, docWhiteTime, docBlackTime, targetWhiteTime, targetBlackTime, activeClockSide: activeClockSideRef.current
      // });

      // Update local clock display times 
      setTimes(targetWhiteTime, targetBlackTime);

      // Start the clock interval for the correct side
      startClock(newData.currentTurn); 

    }, (error) => { 
        logger.error('useChessGame', 'Firestore snapshot error', { error, gameId });
        setError('Error fetching game updates.');
        toast.error('Connection error. Please check your network.');
        stopClock();
    });

    // Cleanup function
    return () => {
      logger.info('useChessGame', 'Cleaning up Firestore subscription', { gameId });
      unsubscribe();
      stopClock(); 
    };
  // Minimal stable dependencies
  }, [gameId, userId, navigate, stopClock, startClock, setTimes, handleTimeUp]); 

  return {
    gameData,
    myColor,
    error,
    moveHistory,
    fen,
    isGameOver,
    whiteTime, 
    blackTime,
    handleMove,
  };
};

export default useChessGame; 
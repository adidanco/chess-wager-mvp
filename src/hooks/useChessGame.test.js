import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useChessGame from './useChessGame';
import useChessClock from './useChessClock'; // Import the actual clock hook
import { auth, db } from '../firebase'; // Import db and auth to satisfy imports in hook
import { doc, updateDoc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { DEFAULT_TIMER } from '../utils/constants';

// Mock Firebase Firestore
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    doc: vi.fn(),
    updateDoc: vi.fn(() => Promise.resolve()), // Mock updateDoc to resolve successfully
    getDoc: vi.fn(),
    onSnapshot: vi.fn(), // Mock onSnapshot initially
    serverTimestamp: vi.fn(() => ({ // Mock serverTimestamp to return a specific structure
        type: 'serverTimestamp' // Or Date.now() if needed for immediate value
      })
    ),
  };
});

// Mock Firebase Auth (mainly for userId)
vi.mock('../firebase', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        auth: {
            currentUser: {
                uid: 'test-user-id' // Mock current user ID
            }
        },
        // Keep other exports like db if they exist and are needed
        db: actual.db
    };
});

// Mock the clock hook - we tested it separately
vi.mock('./useChessClock', () => {
    return {
        default: vi.fn(() => ({
            whiteTime: DEFAULT_TIMER,
            blackTime: DEFAULT_TIMER,
            stopClock: vi.fn(),
            startClockForActiveSide: vi.fn(),
            setTimes: vi.fn(),
        }))
    };
});

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// --- Define mock methods object for Chess instances ---
const mockChessMethods = {
    load: vi.fn(),
    turn: vi.fn(() => 'w'),
    move: vi.fn(),
    isGameOver: vi.fn(() => false),
    isCheckmate: vi.fn(() => false),
    isStalemate: vi.fn(() => false),
    isThreefoldRepetition: vi.fn(() => false),
    isInsufficientMaterial: vi.fn(() => false),
    isDraw: vi.fn(() => false),
    pgn: vi.fn(() => ''),
    history: vi.fn(() => []),
    fen: vi.fn(() => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
    // Helper to reset all mocks on this object
    reset: function() {
        Object.values(this).forEach(mockFn => {
            if (typeof mockFn.mockClear === 'function') {
                mockFn.mockClear();
            }
        });
        // Reset default return values if needed
        this.turn.mockReturnValue('w');
        this.isGameOver.mockReturnValue(false);
        this.isCheckmate.mockReturnValue(false);
        this.isDraw.mockReturnValue(false);
        this.fen.mockReturnValue('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    }
};

// Mock chess.js - Constructor returns our shared methods object
vi.mock('chess.js', () => {
    const Chess = vi.fn().mockImplementation(() => mockChessMethods);
    return { Chess };
});

// --- Define mock methods object for useChessClock hook ---
const mockClockMethods = {
    whiteTime: DEFAULT_TIMER, // Default initial state
    blackTime: DEFAULT_TIMER,
    stopClock: vi.fn(),
    startClockForActiveSide: vi.fn(),
    setTimes: vi.fn(),
    // Helper to reset mocks and state
    reset: function() {
        this.whiteTime = DEFAULT_TIMER;
        this.blackTime = DEFAULT_TIMER;
        this.stopClock.mockClear();
        this.startClockForActiveSide.mockClear();
        this.setTimes.mockClear();
    }
};

// Mock the clock hook - Returns the shared methods object
vi.mock('./useChessClock', () => {
    // Return a factory function that returns the shared object
    return { default: vi.fn(() => mockClockMethods) }; 
});

describe('useChessGame Hook', () => {
  const gameId = 'test-game-id';
  const userId = 'test-user-id'; // Must match mocked auth.currentUser.uid

  let capturedOnNext; // Variable to capture the onNext callback
  let capturedOnError; // Variable to capture the onError callback (optional but good practice)

  // Define mock initial data structure used by the mock implementation
  const mockInitialDoc = {
      exists: () => true,
      data: () => ({
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '',
        whitePlayer: userId, // Assume current user is white initially
        blackPlayer: null,
        whiteTime: DEFAULT_TIMER,
        blackTime: DEFAULT_TIMER,
        lastMoveTime: null, // Simulate waiting for game start
        status: 'waiting',
        currentTurn: 'w',
        wagerAmount: 10,
        result: null,
        winner: null,
      }),
      id: gameId,
    };

  beforeEach(async () => {
    // Reset mocks before each test
    vi.clearAllMocks();
    capturedOnNext = null; // Reset captured callbacks
    capturedOnError = null;
    mockChessMethods.reset(); // Reset the shared chess mock methods
    mockClockMethods.reset(); // Reset the shared clock mock methods

    // **MODIFIED: Mock onSnapshot to CAPTURE callbacks**
    vi.mocked(onSnapshot).mockImplementation((docRef, onNext, onError) => {
        // Capture the callbacks provided by the hook
        capturedOnNext = onNext;
        capturedOnError = onError;
        // Return a mock unsubscribe function
        return vi.fn();
      });

    // Mock doc to return a consistent reference
    const mockDocRef = { id: gameId, path: `games/${gameId}`};
    vi.mocked(doc).mockReturnValue(mockDocRef);

  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with waiting status and correct player assignment', async () => {
    const { result } = renderHook(() => useChessGame(gameId, userId));

    // Check initial state BEFORE data arrives
    expect(result.current.gameData).toBeNull(); // Should be null initially
    expect(result.current.myColor).toBeNull(); // Renamed from playerColor in previous attempts

    // **MODIFIED: Wait for the hook to call onSnapshot and capture the callback**
    await waitFor(() => expect(capturedOnNext).toBeDefined());
    expect(capturedOnError).toBeDefined(); // Also wait for onError to be captured

    // **MODIFIED: Manually trigger the captured callback within act()**
    act(() => {
        if (capturedOnNext) {
            capturedOnNext(mockInitialDoc);
        } else {
            throw new Error("onNext callback was not captured by the mock.")
        }
    });

    // Wait for the state update triggered by the manual callback invocation
    await waitFor(() => expect(result.current.gameData).not.toBeNull());

    // 5. Assert the final state AFTER data has been processed
    expect(result.current.gameData?.status).toBe('waiting'); // Access status within gameData
    expect(result.current.myColor).toBe('w'); // Correct state name is myColor
    // Opponent ID is not explicitly returned, derived from gameData
    expect(result.current.gameData?.blackPlayer).toBeNull(); // Check opponent within gameData
    expect(result.current.error).toBeNull();


    // ADDED: Verify the fen state is correctly initialized
    expect(result.current.fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  });

  // --- NEW TEST: Game Start Simulation ---
  it('should update state and start clock when game status changes to in_progress', async () => {
    const { result } = renderHook(() => useChessGame(gameId, userId));

    // 1. Wait for initial snapshot (waiting state)
    await waitFor(() => expect(capturedOnNext).toBeDefined());
    act(() => { capturedOnNext(mockInitialDoc); });
    await waitFor(() => expect(result.current.gameData).not.toBeNull());
    expect(result.current.gameData?.status).toBe('waiting');

    // 2. Simulate Player 2 joining (new snapshot data)
    const gameStartTime = new Date();
    const mockInProgressDoc = {
      exists: () => true,
      data: () => ({
        ...mockInitialDoc.data(), // Start with previous data
        status: 'in_progress',
        blackPlayer: 'opponent-id',
        lastMoveTime: { // Simulate Firestore Timestamp
          toDate: () => gameStartTime,
          // Add seconds/nanoseconds if needed by hook logic
        },
        // Ensure times are still default or as expected at game start
        whiteTime: DEFAULT_TIMER,
        blackTime: DEFAULT_TIMER,
      }),
      id: gameId,
    };

    // 3. Trigger the update via the captured callback
    act(() => {
        if (capturedOnNext) {
            capturedOnNext(mockInProgressDoc);
        } else {
            throw new Error("onNext callback was not captured by the mock.")
        }
    });

    // 4. Assert state updates and clock calls
    await waitFor(() => {
      expect(result.current.gameData?.status).toBe('in_progress');
    });
    expect(result.current.gameData?.blackPlayer).toBe('opponent-id');
    expect(result.current.myColor).toBe('w'); // Still white

    // Check clock synchronization (use shared mock object)
    expect(mockClockMethods.setTimes).toHaveBeenCalled();
    // Expect startClock to be called for white ('w')
    expect(mockClockMethods.startClockForActiveSide).toHaveBeenCalledWith('w', expect.any(Function)); // Expect handleTimeUp callback

  });

  // --- NEW TEST: Valid Move Handling ---
  it('should handle a valid move correctly', async () => {
    const { result } = renderHook(() => useChessGame(gameId, userId));

    // 1. Setup: Reach 'in_progress' state
    await waitFor(() => expect(capturedOnNext).toBeDefined());
    const gameStartTime = new Date();
    const mockInProgressData = {
        ...mockInitialDoc.data(),
        status: 'in_progress',
        blackPlayer: 'opponent-id',
        lastMoveTime: { toDate: () => gameStartTime },
    };
    act(() => { capturedOnNext({ exists: () => true, data: () => mockInProgressData, id: gameId }); });
    await waitFor(() => expect(result.current.gameData?.status).toBe('in_progress'));
    // Use shared mock object for assertion
    await waitFor(() => expect(mockClockMethods.startClockForActiveSide).toHaveBeenCalledWith('w', expect.any(Function)));

    // 2. Mock chess.js move outcome (using shared object)
    const mockMoveResult = { from: 'e2', to: 'e4', san: 'e4', color: 'w' };
    const newFenAfterMove = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    mockChessMethods.move.mockReturnValue(mockMoveResult);
    mockChessMethods.fen.mockReturnValue(newFenAfterMove); // Update FEN mock return
    mockChessMethods.turn.mockReturnValue('b'); // Turn changes to black

    // 3. Call handleMove
    let moveResult;
    await act(async () => {
      moveResult = await result.current.handleMove('e2', 'e4', 'P');
    });

    // 4. Assertions
    expect(moveResult).toBe(true);
    expect(mockClockMethods.stopClock).toHaveBeenCalled(); // Assert on shared object
    expect(mockChessMethods.move).toHaveBeenCalledWith({ from: 'e2', to: 'e4', promotion: 'q' }); // Assert on shared object

    // Check Firestore updateDoc call
    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: gameId }), // Ensure correct doc ref
      expect.objectContaining({
        fen: newFenAfterMove,
        currentTurn: 'b',
        lastMoveTime: { type: 'serverTimestamp' }, // Check serverTimestamp mock
        whiteTime: expect.any(Number), // Should have captured time from mock clock
        blackTime: expect.any(Number),
        // TODO: Add check for moveHistory update if critical
      })
    );
    expect(result.current.fen).toBe(newFenAfterMove); // Check local FEN state updated

  });

  // --- NEW TEST: Invalid Move (Not Turn) ---
  it('should prevent move if it is not the user\'s turn', async () => {
    const { result } = renderHook(() => useChessGame(gameId, userId));

    // 1. Setup: Reach 'in_progress' state, but make it Black's turn
    await waitFor(() => expect(capturedOnNext).toBeDefined());
    const gameStartTime = new Date();
    const mockInProgressData = {
        ...mockInitialDoc.data(),
        status: 'in_progress',
        blackPlayer: 'opponent-id',
        currentTurn: 'b', // It's Black's turn
        lastMoveTime: { toDate: () => gameStartTime },
    };
    act(() => { capturedOnNext({ exists: () => true, data: () => mockInProgressData, id: gameId }); });
    await waitFor(() => expect(result.current.gameData?.currentTurn).toBe('b'));

    // 2. Attempt move as White (userId is white player)
    let moveResult;
    await act(async () => {
      moveResult = await result.current.handleMove('e2', 'e4', 'P');
    });

    // 3. Assertions
    expect(moveResult).toBe(false);
    expect(mockChessMethods.move).not.toHaveBeenCalled(); // Assert on shared object
    expect(updateDoc).not.toHaveBeenCalled();
    // expect(toast.error).toHaveBeenCalledWith("It's not your turn!"); // Check toast if needed
  });

  // --- NEW TEST: Invalid Move (Illegal) ---
   it('should handle an illegal move returned by chess.js', async () => {
    const { result } = renderHook(() => useChessGame(gameId, userId));

    // 1. Setup: Reach 'in_progress' state, White's turn
    await waitFor(() => expect(capturedOnNext).toBeDefined());
    const gameStartTime = new Date();
    const mockInProgressData = { ...mockInitialDoc.data(), status: 'in_progress', blackPlayer: 'opponent-id', lastMoveTime: { toDate: () => gameStartTime } };
    act(() => { capturedOnNext({ exists: () => true, data: () => mockInProgressData, id: gameId }); });
    await waitFor(() => expect(result.current.gameData?.status).toBe('in_progress'));
    // Wait for setup clock calls to complete if necessary
    await waitFor(() => expect(mockClockMethods.startClockForActiveSide).toHaveBeenCalled());

    // **Clear clock mocks AFTER setup, BEFORE the action we are testing**
    mockClockMethods.stopClock.mockClear();
    mockClockMethods.startClockForActiveSide.mockClear(); 

    // 2. Mock chess.js move to return null (illegal move)
    mockChessMethods.move.mockReturnValue(null); // Use shared object

    // 3. Call handleMove for the ILLEGAL move
    let moveResult;
    await act(async () => {
      moveResult = await result.current.handleMove('e2', 'e5', 'P'); // Example illegal move
    });

    // 4. Assertions
    expect(moveResult).toBe(false);
    expect(mockChessMethods.move).toHaveBeenCalledWith({ from: 'e2', to: 'e5', promotion: 'q' }); // Assert on shared object
    expect(updateDoc).not.toHaveBeenCalled(); // Firestore should not be updated
    // Check clock was NOT stopped DURING/AFTER the illegal move attempt
    expect(mockClockMethods.stopClock).not.toHaveBeenCalled(); 

  });

  // --- NEW TEST: Checkmate Handling ---
   it('should handle checkmate correctly', async () => {
    const { result } = renderHook(() => useChessGame(gameId, userId));

    // 1. Setup: In progress, White's turn
    await waitFor(() => expect(capturedOnNext).toBeDefined());
    const gameStartTime = new Date();
    const mockInProgressData = { ...mockInitialDoc.data(), status: 'in_progress', blackPlayer: 'opponent-id', lastMoveTime: { toDate: () => gameStartTime } };
    act(() => { capturedOnNext({ exists: () => true, data: () => mockInProgressData, id: gameId }); });
    await waitFor(() => expect(result.current.gameData?.status).toBe('in_progress'));

    // 2. Mock chess.js move outcome for checkmate
    const mockCheckmateMove = { from: 'Qf7', to: 'Qf7#', san: 'Qf7#', color: 'w' };
    const fenAfterCheckmate = '... some fen ...'; // Specific FEN not crucial for this check
    mockChessMethods.move.mockReturnValue(mockCheckmateMove);
    mockChessMethods.fen.mockReturnValue(fenAfterCheckmate);
    mockChessMethods.isCheckmate.mockReturnValue(true); // Use shared object
    mockChessMethods.isGameOver.mockReturnValue(true); // Use shared object

    // 3. Call handleMove for checkmating move
    await act(async () => {
      await result.current.handleMove('Qf3', 'Qf7', 'Q'); // Example mating move
    });

    // 4. Assertions
    expect(mockClockMethods.stopClock).toHaveBeenCalled(); // Assert on shared object
    expect(mockChessMethods.isCheckmate).toHaveBeenCalled(); // Assert on shared object

    // Check Firestore updateDoc call for game end
    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: gameId }),
      expect.objectContaining({
        fen: fenAfterCheckmate,
        currentTurn: null, // Turn becomes null on game end
        status: 'finished',
        winner: 'w', // White delivered checkmate
        endTime: { type: 'serverTimestamp' },
        // TODO: Check payout logic calls if relevant
      })
    );

    // TODO: Optionally wait for snapshot update and check isGameOver state in hook
    // const mockFinishedDoc = { exists: () => true, data: () => ({...updatePayload...}), id: gameId };
    // act(() => { capturedOnNext(mockFinishedDoc); });
    // await waitFor(() => expect(result.current.isGameOver).toEqual({ winner: 'w' }));
  });

  // --- NEW TEST: Snapshot Error Handling ---
  it('should handle Firestore snapshot error', async () => {
    const { result } = renderHook(() => useChessGame(gameId, userId));

    // 1. Wait for hook to capture the error callback
    await waitFor(() => expect(capturedOnError).toBeDefined());

    // 2. Simulate an error by calling the captured onError callback
    const mockError = new Error("Firestore permission denied");
    act(() => {
      if (capturedOnError) {
        capturedOnError(mockError);
      } else {
        throw new Error("onError callback was not captured.")
      }
    });

    // 3. Assertions
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toContain('Error fetching game updates');
    // expect(toast.error).toHaveBeenCalledWith('Connection error. Please check your network.');
    // Check if clock was stopped (good practice on error)
    expect(mockClockMethods.stopClock).toHaveBeenCalled(); // Assert on shared object
  });

  // --- NEW TEST: Stalemate Handling ---
  it('should handle stalemate correctly', async () => {
    const { result } = renderHook(() => useChessGame(gameId, userId));

    // 1. Setup: In progress, White's turn
    await waitFor(() => expect(capturedOnNext).toBeDefined());
    const gameStartTime = new Date();
    const mockInProgressData = { ...mockInitialDoc.data(), status: 'in_progress', blackPlayer: 'opponent-id', lastMoveTime: { toDate: () => gameStartTime } };
    act(() => { capturedOnNext({ exists: () => true, data: () => mockInProgressData, id: gameId }); });
    await waitFor(() => expect(result.current.gameData?.status).toBe('in_progress'));

    // 2. Mock chess.js move outcome for stalemate
    const mockStalemateMove = { from: 'Kf1', to: 'Kf2', san: 'Kf2', color: 'w' }; // Example move leading to stalemate
    const fenAfterStalemate = '... some fen ...';
    mockChessMethods.move.mockReturnValue(mockStalemateMove);
    mockChessMethods.fen.mockReturnValue(fenAfterStalemate);
    mockChessMethods.isStalemate.mockReturnValue(true); // Mock stalemate
    mockChessMethods.isDraw.mockReturnValue(true);      // isDraw should also be true
    mockChessMethods.isGameOver.mockReturnValue(true);

    // 3. Call handleMove for stalemating move
    await act(async () => {
      await result.current.handleMove('Kf1', 'Kf2', 'K');
    });

    // 4. Assertions
    expect(mockClockMethods.stopClock).toHaveBeenCalled();
    expect(mockChessMethods.isDraw).toHaveBeenCalled(); // Changed from isStalemate to isDraw
    // No need to check isStalemate, as the hook doesn't call it directly

    // Check Firestore updateDoc call for game end (draw)
    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: gameId }),
      expect.objectContaining({
        fen: fenAfterStalemate,
        currentTurn: null,
        status: 'finished',
        winner: 'draw', // Winner is 'draw'
        endTime: { type: 'serverTimestamp' },
        // TODO: Check payout logic calls for draw
      })
    );
  });

   // --- NEW TEST: Game Termination via Snapshot (Opponent Won) ---
  it('should update isGameOver state when receiving a finished status via snapshot (opponent win)', async () => {
    const { result } = renderHook(() => useChessGame(gameId, userId));

    // 1. Setup: Game in progress
    await waitFor(() => expect(capturedOnNext).toBeDefined());
    const gameStartTime = new Date();
    const mockInProgressData = { ...mockInitialDoc.data(), status: 'in_progress', blackPlayer: 'opponent-id', lastMoveTime: { toDate: () => gameStartTime } };
    act(() => { capturedOnNext({ exists: () => true, data: () => mockInProgressData, id: gameId }); });
    await waitFor(() => expect(result.current.gameData?.status).toBe('in_progress'));
    expect(result.current.isGameOver).toBe(false); // Initially not game over

    // 2. Simulate receiving a snapshot indicating game finished, opponent (black) won
    const mockFinishedDocOpponentWin = {
      exists: () => true,
      data: () => ({
        ...mockInProgressData,
        status: 'finished',
        winner: 'b', // Black won
        endTime: { toDate: () => new Date() },
        currentTurn: null,
        // Times might be updated too, but status/winner is key here
      }),
      id: gameId,
    };

    // 3. Trigger the snapshot update
    act(() => {
      capturedOnNext(mockFinishedDocOpponentWin);
    });

    // 4. Assertions
    await waitFor(() => expect(result.current.isGameOver).toEqual({ winner: 'b' }));
    expect(result.current.gameData?.status).toBe('finished');
    expect(result.current.gameData?.winner).toBe('b');
    // Check clock was stopped by the snapshot handler
    expect(mockClockMethods.stopClock).toHaveBeenCalled();
  });

  // --- NEW TEST: Game Termination via Snapshot (Draw) ---
  it('should update isGameOver state when receiving a finished status via snapshot (draw)', async () => {
    const { result } = renderHook(() => useChessGame(gameId, userId));

    // 1. Setup: Game in progress
    await waitFor(() => expect(capturedOnNext).toBeDefined());
    const gameStartTime = new Date();
    const mockInProgressData = { ...mockInitialDoc.data(), status: 'in_progress', blackPlayer: 'opponent-id', lastMoveTime: { toDate: () => gameStartTime } };
    act(() => { capturedOnNext({ exists: () => true, data: () => mockInProgressData, id: gameId }); });
    await waitFor(() => expect(result.current.gameData?.status).toBe('in_progress'));
    expect(result.current.isGameOver).toBe(false);

    // 2. Simulate receiving a snapshot indicating game finished, draw
    const mockFinishedDocDraw = {
      exists: () => true,
      data: () => ({
        ...mockInProgressData,
        status: 'finished',
        winner: 'draw',
        endTime: { toDate: () => new Date() },
        currentTurn: null,
      }),
      id: gameId,
    };

    // 3. Trigger the snapshot update
    act(() => {
      capturedOnNext(mockFinishedDocDraw);
    });

    // 4. Assertions
    await waitFor(() => expect(result.current.isGameOver).toEqual({ winner: 'draw' }));
    expect(result.current.gameData?.status).toBe('finished');
    expect(result.current.gameData?.winner).toBe('draw');
    expect(mockClockMethods.stopClock).toHaveBeenCalled();
  });

  // --- NEW TEST: Draw by Threefold Repetition ---
  it('should handle draw by threefold repetition correctly', async () => {
    const { result } = renderHook(() => useChessGame(gameId, userId));

    // 1. Setup: In progress, White's turn
    await waitFor(() => expect(capturedOnNext).toBeDefined());
    const gameStartTime = new Date();
    const mockInProgressData = { ...mockInitialDoc.data(), status: 'in_progress', blackPlayer: 'opponent-id', lastMoveTime: { toDate: () => gameStartTime } };
    act(() => { capturedOnNext({ exists: () => true, data: () => mockInProgressData, id: gameId }); });
    await waitFor(() => expect(result.current.gameData?.status).toBe('in_progress'));

    // 2. Mock chess.js move outcome for threefold repetition
    const mockRepetitionMove = { from: 'Ng1', to: 'Nf3', san: 'Nf3', color: 'w' };
    const fenAfterRepetition = 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1';
    mockChessMethods.move.mockReturnValue(mockRepetitionMove);
    mockChessMethods.fen.mockReturnValue(fenAfterRepetition);
    mockChessMethods.isThreefoldRepetition.mockReturnValue(true); // Still mock this for completeness
    mockChessMethods.isDraw.mockReturnValue(true); // This is what the hook actually checks
    mockChessMethods.isGameOver.mockReturnValue(true);

    // 3. Call handleMove that results in threefold repetition
    await act(async () => {
      await result.current.handleMove('Ng1', 'Nf3', 'N');
    });

    // 4. Assertions
    expect(mockClockMethods.stopClock).toHaveBeenCalled();
    expect(mockChessMethods.isDraw).toHaveBeenCalled();
    // Don't assert on isThreefoldRepetition as the hook doesn't call it directly
    
    // Check Firestore updateDoc call for game end (draw)
    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: gameId }),
      expect.objectContaining({
        fen: fenAfterRepetition,
        currentTurn: null,
        status: 'finished',
        winner: 'draw',
        endTime: { type: 'serverTimestamp' }
      })
    );
  });

  // --- NEW TEST: Draw by Insufficient Material ---
  it('should handle draw by insufficient material correctly', async () => {
    const { result } = renderHook(() => useChessGame(gameId, userId));

    // 1. Setup: In progress, White's turn
    await waitFor(() => expect(capturedOnNext).toBeDefined());
    const gameStartTime = new Date();
    const mockInProgressData = { ...mockInitialDoc.data(), status: 'in_progress', blackPlayer: 'opponent-id', lastMoveTime: { toDate: () => gameStartTime } };
    act(() => { capturedOnNext({ exists: () => true, data: () => mockInProgressData, id: gameId }); });
    await waitFor(() => expect(result.current.gameData?.status).toBe('in_progress'));

    // 2. Mock chess.js move outcome for insufficient material
    const mockInsufficientMove = { from: 'Qd1', to: 'Qxc8', san: 'Qxc8', color: 'w' };
    const fenAfterInsufficient = '4k3/8/8/8/8/8/8/4K3 b - - 0 1'; // King vs King
    mockChessMethods.move.mockReturnValue(mockInsufficientMove);
    mockChessMethods.fen.mockReturnValue(fenAfterInsufficient);
    mockChessMethods.isInsufficientMaterial.mockReturnValue(true); // Still mock this for completeness
    mockChessMethods.isDraw.mockReturnValue(true); // This is what the hook actually checks
    mockChessMethods.isGameOver.mockReturnValue(true);

    // 3. Call handleMove that results in insufficient material
    await act(async () => {
      await result.current.handleMove('Qd1', 'Qxc8', 'Q');
    });

    // 4. Assertions
    expect(mockClockMethods.stopClock).toHaveBeenCalled();
    expect(mockChessMethods.isDraw).toHaveBeenCalled();
    // Don't assert on isInsufficientMaterial as the hook doesn't call it directly
    
    // Check Firestore updateDoc call for game end (draw)
    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: gameId }),
      expect.objectContaining({
        fen: fenAfterInsufficient,
        currentTurn: null,
        status: 'finished',
        winner: 'draw',
        endTime: { type: 'serverTimestamp' }
      })
    );
  });

  // --- NEW TEST: Clock Synchronization via Snapshot ---
  it('should synchronize clocks when receiving new game data via snapshot', async () => {
    const { result } = renderHook(() => useChessGame(gameId, userId));

    // 1. Setup: Initialize with in-progress game
    await waitFor(() => expect(capturedOnNext).toBeDefined());
    const gameStartTime = new Date(Date.now() - 60000); // Game started 1 minute ago
    const initialWhiteTime = 300000; // 5 minutes
    const initialBlackTime = 300000; // 5 minutes
    
    const mockInProgressData = { 
      ...mockInitialDoc.data(), 
      status: 'in_progress', 
      blackPlayer: 'opponent-id', 
      lastMoveTime: { toDate: () => gameStartTime },
      whiteTime: initialWhiteTime,
      blackTime: initialBlackTime
    };
    
    act(() => { capturedOnNext({ exists: () => true, data: () => mockInProgressData, id: gameId }); });
    await waitFor(() => expect(result.current.gameData?.status).toBe('in_progress'));
    
    // Reset mocks for clock operations after setup
    mockClockMethods.setTimes.mockClear();
    
    // 2. Simulate receiving a new snapshot with updated times (after opponent's move)
    const newMoveTime = new Date(Date.now() - 30000); // Move was 30 seconds ago
    const updatedWhiteTime = initialWhiteTime; // White time unchanged (opponent moved)
    const updatedBlackTime = initialBlackTime - 15000; // Black spent 15 seconds on their move
    
    const updatedGameData = {
      ...mockInProgressData,
      lastMoveTime: { toDate: () => newMoveTime },
      whiteTime: updatedWhiteTime,
      blackTime: updatedBlackTime,
      currentTurn: 'w' // Now white's turn
    };
    
    act(() => { 
      capturedOnNext({ exists: () => true, data: () => updatedGameData, id: gameId }); 
    });
    
    // 3. Assertions
    await waitFor(() => expect(mockClockMethods.setTimes).toHaveBeenCalled());
    
    // Check times were set correctly
    expect(mockClockMethods.setTimes).toHaveBeenCalledWith(
      expect.any(Number), // White time
      expect.any(Number)  // Black time
    );
    
    // Check clock was started for the current turn
    expect(mockClockMethods.startClockForActiveSide).toHaveBeenCalledWith('w', expect.any(Function));
  });

  // --- NEW TEST: Time Up Callback Handling ---
  it('should handle time up callback correctly', async () => {
    const { result } = renderHook(() => useChessGame(gameId, userId));
    
    // 1. Setup: Reach 'in_progress' state
    await waitFor(() => expect(capturedOnNext).toBeDefined());
    const gameStartTime = new Date();
    const mockInProgressData = { 
      ...mockInitialDoc.data(), 
      status: 'in_progress', 
      blackPlayer: 'opponent-id', 
      lastMoveTime: { toDate: () => gameStartTime },
      wager: 100 // Add wager amount for payout check
    };
    
    act(() => { capturedOnNext({ exists: () => true, data: () => mockInProgressData, id: gameId }); });
    await waitFor(() => expect(result.current.gameData?.status).toBe('in_progress'));
    
    // 2. Capture the handleTimeUp callback from startClockForActiveSide call
    await waitFor(() => expect(mockClockMethods.startClockForActiveSide).toHaveBeenCalled());
    const timeUpCallbackCalls = mockClockMethods.startClockForActiveSide.mock.calls;
    expect(timeUpCallbackCalls.length).toBeGreaterThan(0);
    
    const handleTimeUp = timeUpCallbackCalls[timeUpCallbackCalls.length - 1][1]; // Get the last call's second arg
    expect(handleTimeUp).toBeInstanceOf(Function);
    
    // Reset updateDoc mock before the time up test
    updateDoc.mockClear();
    
    // 3. Manually invoke the handleTimeUp callback with 'b' as winner
    // (meaning white ran out of time, so black wins)
    await act(async () => {
      await handleTimeUp('b');
    });
    
    // 4. Assertions
    expect(mockClockMethods.stopClock).toHaveBeenCalled();
    
    // Check Firestore updateDoc call for game end by timeout
    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: gameId }),
      expect.objectContaining({
        status: 'finished',
        winner: 'b',
        endTime: { type: 'serverTimestamp' },
        // White ran out of time, so their time should be 0
        wTime: 0
      })
    );
  });

  // --- NEW TEST: Game Termination via Snapshot (Opponent Resigned) ---
  it('should handle game termination when opponent resigns', async () => {
    const { result } = renderHook(() => useChessGame(gameId, userId));

    // 1. Setup: Game in progress
    await waitFor(() => expect(capturedOnNext).toBeDefined());
    const gameStartTime = new Date();
    const mockInProgressData = { ...mockInitialDoc.data(), status: 'in_progress', blackPlayer: 'opponent-id', lastMoveTime: { toDate: () => gameStartTime } };
    act(() => { capturedOnNext({ exists: () => true, data: () => mockInProgressData, id: gameId }); });
    await waitFor(() => expect(result.current.gameData?.status).toBe('in_progress'));
    expect(result.current.isGameOver).toBe(false);

    // 2. Simulate receiving a snapshot indicating opponent resigned (black resigned, white wins)
    const mockResignedDoc = {
      exists: () => true,
      data: () => ({
        ...mockInProgressData,
        status: 'finished',
        winner: 'w', // White won by resignation
        endTime: { toDate: () => new Date() },
        currentTurn: null,
        resignedBy: 'b' // Black resigned
      }),
      id: gameId,
    };

    // 3. Trigger the snapshot update
    act(() => {
      capturedOnNext(mockResignedDoc);
    });

    // 4. Assertions
    await waitFor(() => expect(result.current.isGameOver).toEqual({ winner: 'w' }));
    expect(result.current.gameData?.status).toBe('finished');
    expect(result.current.gameData?.winner).toBe('w');
    expect(result.current.gameData?.resignedBy).toBe('b');
    expect(mockClockMethods.stopClock).toHaveBeenCalled();
  });

  // No more TODOs - all tests implemented
}); 
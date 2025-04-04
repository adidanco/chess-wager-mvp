import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import PageLayout from '../components/common/PageLayout';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { RangvaarGameState, PlayerInfo } from '../types/rangvaar';
import { logger } from '../utils/logger';
import { MAX_PLAYERS } from '../constants/rangvaarConstants';
// Import the actual join function
import { joinRangvaarGame, startGameAndInitializeRound } from '../services/rangvaarService';

// Helper to format Timestamp
const formatTimestamp = (timestamp: Timestamp | undefined): string => {
  return timestamp ? timestamp.toDate().toLocaleString() : 'N/A';
};

export default function RangvaarLobby(): JSX.Element {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useAuth();
  const [gameState, setGameState] = useState<RangvaarGameState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isJoining, setIsJoining] = useState<boolean>(false);
  
  // Ref to track if game start has been triggered by this client
  const startTriggeredRef = useRef<boolean>(false); 

  useEffect(() => {
    if (!gameId) {
      setError('No game ID provided.');
      setLoading(false);
      toast.error('Invalid game link.');
      navigate('/choose-game');
      return;
    }
    
    startTriggeredRef.current = false; // Reset on gameId change
    logger.info('RangvaarLobby', 'Setting up listener for game', { gameId });
    const gameDocRef = doc(db, 'rangvaarGames', gameId);

    const unsubscribe = onSnapshot(gameDocRef, 
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Omit<RangvaarGameState, 'gameId'>;
          const currentGameState = { ...data, gameId } as RangvaarGameState;
          setGameState(currentGameState);
          setError('');

          // --- Game Start Trigger --- //
          // Check if game is ready to start, user is host, and start hasn't been triggered yet
          if (
              currentGameState.status === 'Starting' && 
              currentGameState.players.length === MAX_PLAYERS &&
              currentUser && 
              currentGameState.players[0]?.userId === currentUser.uid && // Assuming player[0] is host
              !startTriggeredRef.current
          ) {
              logger.info('RangvaarLobby', 'Detected game ready to start, triggering initialization', { gameId });
              startTriggeredRef.current = true; // Mark as triggered to prevent multiple calls
              startGameAndInitializeRound(gameId).catch(err => {
                  logger.error('RangvaarLobby', 'Failed to trigger startGameAndInitializeRound', { gameId, error: err });
                  toast.error(`Error starting game: ${(err as Error).message}`);
                  startTriggeredRef.current = false; // Allow retry? Or handle error differently
              });
          }
          
          // --- Navigate to Game Play --- //
          // Check if game has actually started playing
          if (currentGameState.status === 'Playing') {
            logger.info('RangvaarLobby', 'Game is Playing, navigating to game screen', { gameId });
            // Cleanup listener before navigating away
            unsubscribe(); 
            navigate(`/game/rangvaar/play/${gameId}`);
          }

        } else {
          logger.warn('RangvaarLobby', 'Game document not found', { gameId });
          setError('Game not found. It might have been deleted or the link is incorrect.');
          setGameState(null);
          toast.error('Game not found.');
        }
        setLoading(false);
      },
      (err) => {
        logger.error('RangvaarLobby', 'Error listening to game document', { gameId, error: err });
        setError('Failed to load game data. Please try refreshing.');
        setLoading(false);
        toast.error('Error loading game details.');
      }
    );

    // Cleanup listener on component unmount
    return () => unsubscribe();
  }, [gameId, navigate, currentUser]);

  const handleJoinGame = async () => {
    if (!currentUser || !gameId || isJoining || gameState?.status !== 'Waiting') {
      toast.error('Cannot join game now.');
      return;
    }
    setIsJoining(true);
    logger.info('RangvaarLobby', 'Attempting to join game', { userId: currentUser.uid, gameId });
    try {
      // --- Call the actual service function --- 
      await joinRangvaarGame(gameId, currentUser.uid);
      logger.info('RangvaarLobby', 'Successfully joined game', { userId: currentUser.uid, gameId });
      toast.success('Successfully joined the game!');
      // No navigation needed, onSnapshot will update the UI
      // ---------------------------------------

      // --- Remove MVP Simulation ---
      // await new Promise(resolve => setTimeout(resolve, 500));
      // logger.info('RangvaarLobby', '[MVP Placeholder] Simulated joining game', { userId: currentUser.uid, gameId });
      // toast.success('[MVP Placeholder] Simulated joining game!');
      // -----------------------------

    } catch (err) {
      const error = err as Error;
      logger.error('RangvaarLobby', 'Failed to join game', { userId: currentUser.uid, gameId, error: error.message });
      // Display specific errors from the transaction
      toast.error(`Failed to join game: ${error.message}`); 
    } finally {
      setIsJoining(false);
    }
  };

  // Determine if the current user is already in the game
  const isCurrentUserInGame = gameState?.players.some(p => p.userId === currentUser?.uid);
  const canJoin = gameState?.status === 'Waiting' && 
                  gameState.players.length < MAX_PLAYERS && 
                  !isCurrentUserInGame && 
                  !authLoading && 
                  currentUser;
  const isHost = gameState?.players[0]?.userId === currentUser?.uid;

  if (loading) {
    return <PageLayout><LoadingSpinner message="Loading Game Lobby..." /></PageLayout>;
  }

  if (error) {
    return (
      <PageLayout>
        <div className="text-center p-8">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => navigate('/choose-game')} 
            className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700"
          >
            Back to Games
          </button>
        </div>
      </PageLayout>
    );
  }

  if (!gameState) {
    // Should be covered by error state, but as a fallback
    return <PageLayout><p className="text-center p-8">Game data unavailable.</p></PageLayout>;
  }

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <h1 className="text-2xl font-bold mb-2 text-center text-emerald-700">Rangvaar Game Lobby</h1>
        <p className="text-xs text-gray-500 text-center mb-6">Game ID: {gameId}</p>

        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-lg font-semibold mb-3 text-emerald-800">Game Details</h2>
          <div className="space-y-1 text-sm">
            <p><strong>Status:</strong> <span className={`font-medium ${gameState.status === 'Waiting' ? 'text-orange-600' : 'text-green-600'}`}>{gameState.status}</span></p>
            <p><strong>Wager:</strong> ₹{gameState.wagerPerPlayer} per player</p>
            <p><strong>Rounds:</strong> {gameState.totalRounds}</p>
            <p><strong>Created:</strong> {formatTimestamp(gameState.createdAt)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-lg font-semibold mb-3 text-emerald-800">Players ({gameState.players.length} / {MAX_PLAYERS})</h2>
          <ul className="space-y-3">
            {gameState.players.map((player, index) => (
              <li key={player.userId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center">
                  <img 
                    src={player.photoURL || '/default-avatar.png'} // Provide a default avatar
                    alt={player.username}
                    className="w-8 h-8 rounded-full mr-3 object-cover bg-gray-300"
                  />
                  <span className="font-medium text-gray-800">{player.username} {player.userId === currentUser?.uid ? '(You)' : ''}</span>
                </div>
                <span className="text-xs text-gray-500">Seat: {player.position} (Team {player.teamId})</span>
              </li>
            ))}
            {[...Array(MAX_PLAYERS - gameState.players.length)].map((_, i) => (
              <li key={`empty-${i}`} className="flex items-center p-2 text-gray-400 italic">
                <div className="w-8 h-8 rounded-full mr-3 bg-gray-200"></div>
                Waiting for player...
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="text-center space-y-3">
          {canJoin && (
            <button
              onClick={handleJoinGame}
              disabled={isJoining}
              className="w-full bg-emerald-600 text-white py-2 px-5 rounded-md font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJoining ? 'Joining...' : 'Join Game'}
            </button>
          )}
          {gameState.status === 'Waiting' && gameState.players.length === MAX_PLAYERS && isCurrentUserInGame && (
             <p className="text-green-700 font-semibold">Waiting for game to start...</p>
             // Could add a manual start button for host here if auto-start fails
          )}
          {gameState.status === 'Starting' && (
             <p className="text-blue-700 font-semibold animate-pulse">Starting game...</p>
          )}
          {gameState.status !== 'Waiting' && gameState.status !== 'Starting' && (
              // Show leave button only if game hasn't started or user is viewing unexpectedly
              <button
                  onClick={() => navigate('/choose-game')}
                  className="w-full bg-gray-200 text-gray-800 py-2 px-5 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Leave Lobby
              </button>
          )}
          {/* Always show Leave Lobby if game is just waiting? */}
          {gameState.status === 'Waiting' && (
                <button
                    onClick={() => navigate('/choose-game')}
                    className="w-full bg-gray-200 text-gray-800 py-2 px-5 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Leave Lobby
                </button>
          )}
        </div>

      </div>
    </PageLayout>
  );
} 
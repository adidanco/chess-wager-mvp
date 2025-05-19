import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-hot-toast';
import PageLayout from '../components/common/PageLayout';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { ScambodiaGameState } from '../types/scambodia';
import { startScambodiaGame, joinScambodiaGame } from '../services/scambodiaService';
import { logger } from '../utils/logger';

export default function ScambodiaLobby(): JSX.Element {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { currentUser, isAuthenticated } = useAuth();
  
  const [gameState, setGameState] = useState<ScambodiaGameState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [joining, setJoining] = useState<boolean>(false);
  const [starting, setStarting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [autoStartAttempted, setAutoStartAttempted] = useState<boolean>(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !loading) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate, loading]);

  // Join game handler
  const handleJoinGame = async () => {
    if (!currentUser || !gameId) return;
    
    setJoining(true);
    try {
      await joinScambodiaGame(gameId, currentUser.uid);
      toast.success('Successfully joined the game!');
    } catch (error) {
      const err = error as Error;
      logger.error('ScambodiaLobby', 'Failed to join game', { gameId, error: err });
      toast.error(`Failed to join: ${err.message}`);
    } finally {
      setJoining(false);
    }
  };

  // Start game handler - wrapped in useCallback to maintain reference stability
  const handleStartGame = useCallback(async () => {
    if (!gameId) return;
    
    logger.info('ScambodiaLobby', 'handleStartGame called', { 
      gameId, 
      userId: currentUser?.uid,
      alreadyStarting: starting
    });
    
    // Prevent multiple start attempts
    if (starting) {
      logger.warn('ScambodiaLobby', 'Start already in progress, ignoring call', { gameId });
      return;
    }
    
    setStarting(true);
    try {
      logger.info('ScambodiaLobby', 'Calling startScambodiaGame service', { gameId });
      await startScambodiaGame(gameId);
      logger.info('ScambodiaLobby', 'Game started successfully', { gameId });
      toast.success('Game started!');
      
      // Don't navigate here, let the game state listener handle navigation
    } catch (error) {
      const err = error as Error;
      logger.error('ScambodiaLobby', 'Failed to start game', { gameId, error: err });
      toast.error(`Failed to start game: ${err.message}`);
      setStarting(false); // Reset only on error, as success will navigate away
    }
  }, [gameId, currentUser?.uid, starting]);

  // Listen to game state
  useEffect(() => {
    if (!gameId) {
      setError('No game ID provided');
      setLoading(false);
      return;
    }

    logger.info('ScambodiaLobby', 'Setting up game listener', { 
      gameId,
      currentUserId: currentUser?.uid
    });
    
    const unsubscribe = onSnapshot(
      doc(db, 'scambodiaGames', gameId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as Omit<ScambodiaGameState, 'gameId'>;
          
          logger.debug('ScambodiaLobby', 'Game state updated', { 
            gameId,
            status: data.status,
            playerCount: data.players.length,
            currentUserId: currentUser?.uid,
            hostId: data.players[0]?.userId
          });
          
          setGameState({ ...data, gameId: snapshot.id });
          
          // Auto-navigate to game if it's started
          if (data.status === 'Playing') {
            logger.info('ScambodiaLobby', 'Game is now Playing, navigating to game', { gameId });
            unsubscribe(); // Unsubscribe BEFORE navigating
            navigate(`/game/scambodia/play/${gameId}`);
            return;
          }
          
          // Auto-start game if all 4 players have joined and user is host
          const isHost = data.players[0]?.userId === currentUser?.uid;
          const hasFullLobby = data.players.length === 4;
          const inWaitingStatus = data.status === 'Waiting';
          const shouldAutoStart = inWaitingStatus && hasFullLobby && isHost && !autoStartAttempted;
          
          logger.debug('ScambodiaLobby', 'Auto-start check', { 
            gameId,
            inWaitingStatus,
            hasFullLobby,
            isHost,
            autoStartAttempted,
            shouldAutoStart
          });
          
          if (shouldAutoStart) {
            logger.info('ScambodiaLobby', 'Auto-starting game with 4 players', { gameId });
            setAutoStartAttempted(true); // Prevent multiple auto-start attempts
            // Small delay to ensure all clients are updated
            setTimeout(() => {
              handleStartGame();
            }, 1000);
          }
        } else {
          setError('Game not found');
        }
        setLoading(false);
      },
      (err) => {
        logger.error('ScambodiaLobby', 'Error loading game', { gameId, error: err });
        setError(`Error loading game: ${err.message}`);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [gameId, navigate, currentUser?.uid, handleStartGame, autoStartAttempted]);

  // Check if current user is the host
  const isHost = gameState?.players[0]?.userId === currentUser?.uid;
  
  // Check if user has already joined
  const hasJoined = gameState?.players.some(p => p.userId === currentUser?.uid) || false;
  
  // Check if game can be started (at least 2 players and user is host)
  const canStartGame = isHost && (gameState?.players.length ?? 0) >= 2;

  if (loading) {
    return (
      <PageLayout>
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner message="Loading game lobby..." />
        </div>
      </PageLayout>
    );
  }

  if (error || !gameState) {
    return (
      <PageLayout>
        <div className="container mx-auto px-4 py-8 max-w-md">
          <Card variant="default" className="p-6">
            <h1 className="text-xl font-bold text-red-600 mb-4">Error</h1>
            <p className="mb-6">{error || 'Failed to load game data'}</p>
            <Button 
              variant="primary" 
              onClick={() => navigate('/')}
            >
              Back to Home
            </Button>
          </Card>
        </div>
      </PageLayout>
    );
  }

  if (gameState.status === 'Cancelled') {
    return (
      <PageLayout>
        <div className="container mx-auto px-4 py-8 max-w-md">
          <Card variant="default" className="p-6">
            <h1 className="text-xl font-bold text-deep-purple mb-4">Game Cancelled</h1>
            <p className="mb-6">This game has been cancelled.</p>
            <Button 
              variant="primary" 
              onClick={() => navigate('/')}
            >
              Back to Home
            </Button>
          </Card>
        </div>
      </PageLayout>
    );
  }

  // Safely access players array and length
  const playerCount = gameState.players?.length || 0;

  return (
    <PageLayout>
      <div data-cy="scambodia-lobby-main" className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 data-cy="scambodia-lobby-heading" className="text-2xl font-bold mb-6 text-center text-deep-purple">
          Scambodia Game Lobby
        </h1>

        <Card variant="default" className="p-6 mb-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-deep-purple">Game Details</h2>
            
            {/* MVP Notice */}
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700 font-bold">
                    MVP VERSION
                  </p>
                  <p className="text-sm text-yellow-700">
                    Betting feature is still being implemented, but you can play the game without real wagers.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-600">Game ID:</div>
              <div className="font-medium">{gameId}</div>
              <div className="text-gray-600">Wager Amount:</div>
              <div className="font-medium">₹{gameState.wagerPerPlayer} per player</div>
              <div className="text-gray-600">Total Rounds:</div>
              <div className="font-medium">{gameState.totalRounds} round{gameState.totalRounds > 1 ? 's' : ''}</div>
              <div className="text-gray-600">Status:</div>
              <div className="font-medium">{gameState.status}</div>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-deep-purple">
              Players ({playerCount}/4)
            </h2>
            <ul data-cy="lobby-player-list" className="space-y-2">
              {gameState.players.map((player) => (
                <li 
                  key={player.userId} 
                  className="flex items-center p-2 bg-gray-50 rounded-md border border-gray-200"
                >
                  {player.photoURL ? (
                    <img 
                      src={player.photoURL} 
                      alt={player.username} 
                      className="w-8 h-8 rounded-full mr-3"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-300 mr-3 flex items-center justify-center">
                      {player.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="flex-grow font-medium">
                    {player.username} 
                    {player.userId === currentUser?.uid && ' (You)'}
                  </span>
                  {player.position === 0 && (
                    <span className="text-xs bg-soft-pink text-white px-2 py-1 rounded-full">
                      Host
                    </span>
                  )}
                </li>
              ))}
              {Array.from({ length: 4 - playerCount }).map((_, i) => (
                <li 
                  key={`empty-${i}`} 
                  className="flex items-center p-2 bg-gray-50 rounded-md border border-gray-200 text-gray-400"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-200 mr-3"></div>
                  <span className="flex-grow italic">Waiting for player...</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            {!hasJoined && (
              <Button 
                data-cy="lobby-join-btn"
                variant="primary" 
                className="w-full"
                onClick={handleJoinGame}
                disabled={joining || playerCount >= 4}
              >
                {joining ? <LoadingSpinner size="small" /> : 'Join Game'}
              </Button>
            )}
            
            {canStartGame && (
              <Button 
                data-cy="lobby-start-btn"
                variant="success" 
                className="w-full"
                onClick={handleStartGame}
                disabled={starting}
              >
                {starting ? <LoadingSpinner size="small" /> : 'Start Game'}
              </Button>
            )}
            
            <Button 
              variant="primary" 
              onClick={() => navigate('/')}
            >
              Back to Home
            </Button>
          </div>
        </Card>

        <div className="bg-blue-50 p-4 rounded-md text-sm">
          <h3 className="font-medium text-blue-800 mb-1">Game Summary</h3>
          <ul className="text-blue-700 list-disc list-inside space-y-1">
            <li>Card memory game for 2-4 players</li>
            <li>Each player starts with 4 face-down cards in a 2x2 grid</li>
            <li>Players can peek at their bottom 2 cards initially</li>
            <li>Goal: Get the lowest total score or discard all cards</li>
            <li>{gameState.totalRounds} round{gameState.totalRounds > 1 ? 's' : ''} with ₹{gameState.wagerPerPlayer} wager per player</li>
          </ul>
        </div>
      </div>
    </PageLayout>
  );
} 
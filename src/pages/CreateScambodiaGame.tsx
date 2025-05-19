import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PageLayout from '../components/common/PageLayout';
import { toast } from 'react-hot-toast';
import { createScambodiaGame } from '../services/scambodiaService';
import { logger } from '../utils/logger';
import RulesModal from '../components/common/RulesModal';
import { scambodiaRules } from '../data/gameRules';

export default function CreateScambodiaGame(): JSX.Element {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [wagerAmount, setWagerAmount] = useState<number>(50);
  const [totalRounds, setTotalRounds] = useState<1 | 3 | 5>(3);
  const [creating, setCreating] = useState<boolean>(false);
  const [tokenRefreshed, setTokenRefreshed] = useState<boolean>(false);
  const [showRules, setShowRules] = useState<boolean>(false);

  // Check authentication
  useEffect(() => {
    if (!currentUser) {
      logger.warn('CreateScambodiaGame', 'No user authenticated, redirecting to login');
      toast.error('Please login to create a game');
      navigate('/login');
    } else {
      // Refresh token on component mount to ensure fresh authentication
      currentUser.getIdToken(true)
        .then(() => {
          setTokenRefreshed(true);
          logger.info('CreateScambodiaGame', 'Token refreshed successfully');
        })
        .catch(err => {
          logger.error('CreateScambodiaGame', 'Failed to refresh token', { error: err });
          toast.error('Authentication error. Please log out and log back in.');
        });
    }
  }, [currentUser, navigate]);

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      toast.error('Please login to create a game');
      navigate('/login');
      return;
    }
    
    if (!tokenRefreshed) {
      toast.error('Still initializing. Please try again in a moment.');
      return;
    }
    
    setCreating(true);
    
    try {
      // Perform one more token refresh for extra security
      await currentUser.getIdToken(true);
      
      // Validate inputs
      if (wagerAmount < 10) {
        throw new Error('Minimum wager is ₹10');
      }
      
      logger.info('CreateScambodiaGame', 'Creating new game', { 
        userId: currentUser.uid, 
        wagerAmount, 
        totalRounds 
      });
      
      // Create the game
      const gameId = await createScambodiaGame(currentUser.uid, wagerAmount, totalRounds);
      
      logger.info('CreateScambodiaGame', 'Game created successfully', { gameId });
      
      toast.success('Game created! Redirecting to game lobby...');
      navigate(`/game/scambodia/${gameId}`);
    } catch (error: any) {
      const err = error as Error;
      logger.error('CreateScambodiaGame', 'Failed to create game', { error: err });
      
      // Provide specific error messages based on the error type
      if (err.message?.includes('permission-denied')) {
        toast.error('Authentication error. Please log out and log back in.');
      } else if (err.message?.includes('insufficient balance')) {
        toast.error('Insufficient balance. Please add funds to your account.');
      } else {
        toast.error(err.message || 'Failed to create game. Please try again.');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-8 max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-deep-purple">
          Create Scambodia Game
        </h1>
        
        <Card variant="default" className="p-6">
          <form onSubmit={handleCreateGame}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Wager Amount (₹ per player)
              </label>
              <input
                data-cy="wager-input"
                type="number"
                min="10"
                max="1000"
                value={wagerAmount}
                onChange={(e) => setWagerAmount(Number(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Min: ₹10, Max: ₹1,000
              </p>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Rounds
              </label>
              <div data-cy="rounds-selector" className="flex gap-2">
                {[1, 3, 5].map((rounds) => (
                  <button
                    key={rounds}
                    type="button"
                    onClick={() => setTotalRounds(rounds as 1 | 3 | 5)}
                    className={`flex-1 py-2 border ${
                      totalRounds === rounds
                        ? 'bg-deep-purple text-white border-deep-purple'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    } rounded-md transition-colors`}
                  >
                    {rounds} {rounds === 1 ? 'Round' : 'Rounds'}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Button
                data-cy="create-game-submit"
                variant="success"
                type="submit"
                className="w-full"
                disabled={creating || !tokenRefreshed}
              >
                {creating ? <LoadingSpinner size="small" /> : 'Create Game'}
              </Button>
              
              <Button
                variant="secondary"
                type="button"
                className="w-full"
                onClick={() => navigate('/')}
                disabled={creating}
              >
                Cancel
              </Button>
              
              <Button
                variant="outline"
                type="button"
                className="w-full mt-2"
                onClick={() => setShowRules(true)}
              >
                How to Play
              </Button>
            </div>
          </form>
        </Card>
        
        <div className="mt-6 bg-blue-50 p-4 rounded-md text-sm">
          <h2 data-cy="about-scambodia" className="font-medium text-blue-800 mb-1">About Scambodia</h2>
          <ul className="text-blue-700 list-disc list-inside space-y-1">
            <li>Card memory game for 2-4 players</li>
            <li>Each player starts with 4 face-down cards</li>
            <li>Goal: Get the lowest total score or discard all cards</li>
            <li>Special powers with face cards (J, Q, K)</li>
            <li>Declare "Scambodia" when you think you have the lowest score</li>
          </ul>
        </div>
      </div>

      <RulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        gameType="Scambodia"
        rules={scambodiaRules}
      />
    </PageLayout>
  );
} 
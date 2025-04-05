import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import PageLayout from '../components/common/PageLayout';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { createScambodiaGame } from '../services/scambodiaService';
import { useAuth } from '../context/AuthContext';
import { logger } from '../utils/logger';

export default function CreateScambodiaGame(): JSX.Element {
  const navigate = useNavigate();
  const { currentUser, loading: authLoading, isAuthenticated } = useAuth();
  
  // Form state
  const [wagerAmount, setWagerAmount] = useState<number>(10);
  const [totalRounds, setTotalRounds] = useState<1 | 3 | 5>(3);
  const [creating, setCreating] = useState<boolean>(false);
  
  // Redirect if not authenticated
  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, navigate]);
  
  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      toast.error('You must be logged in to create a game');
      return;
    }
    
    if (wagerAmount <= 0) {
      toast.error('Wager amount must be greater than 0');
      return;
    }
    
    setCreating(true);
    try {
      const gameId = await createScambodiaGame(
        currentUser.uid,
        wagerAmount,
        totalRounds
      );
      
      logger.info('CreateScambodiaGame', 'Game created successfully', { gameId });
      toast.success('Game created successfully!');
      navigate(`/scambodia-lobby/${gameId}`);
    } catch (error) {
      const err = error as Error;
      logger.error('CreateScambodiaGame', 'Failed to create game', { error: err });
      toast.error(`Failed to create game: ${err.message}`);
    } finally {
      setCreating(false);
    }
  }, [currentUser, wagerAmount, totalRounds, navigate]);
  
  // Show loading if auth is loading
  if (authLoading) {
    return (
      <PageLayout>
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner message="Loading..." />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-8 max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-deep-purple">Create Scambodia Game</h1>
        
        <Card variant="default" className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Wager Amount</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                  ₹
                </span>
                <input
                  type="number"
                  min="10"
                  step="10"
                  value={wagerAmount}
                  onChange={(e) => setWagerAmount(Number(e.target.value))}
                  className="block w-full border border-gray-300 rounded-md shadow-sm pl-8 p-2 focus:ring-deep-purple focus:border-deep-purple"
                  required
                />
              </div>
              <p className="text-xs text-gray-500">
                This is the amount each player will wager to join the game.
              </p>
            </div>
            
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Number of Rounds</label>
              <select
                value={totalRounds}
                onChange={(e) => setTotalRounds(Number(e.target.value) as 1 | 3 | 5)}
                className="block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-deep-purple focus:border-deep-purple"
              >
                <option value={1}>1 Round (Quick Game)</option>
                <option value={3}>3 Rounds (Regular Game)</option>
                <option value={5}>5 Rounds (Extended Game)</option>
              </select>
              <p className="text-xs text-gray-500">
                The winner is determined by the lowest cumulative score across all rounds.
              </p>
            </div>
            
            <div className="mt-8 space-y-4">
              <div className="bg-blue-50 p-4 rounded-md text-sm">
                <h3 className="font-medium text-blue-800 mb-1">Game Summary</h3>
                <ul className="text-blue-700 list-disc list-inside space-y-1">
                  <li>Card memory game for 2-4 players</li>
                  <li>Each player starts with 4 face-down cards</li>
                  <li>Players can peek at their bottom 2 cards initially</li>
                  <li>Goal: Get the lowest total score or discard all cards</li>
                  <li>{totalRounds} round{totalRounds > 1 ? 's' : ''} with ₹{wagerAmount} wager per player</li>
                </ul>
              </div>
              
              <div className="flex justify-between">
                <Button 
                  variant="secondary"
                  onClick={() => navigate('/choose-game')}
                  disabled={creating}
                >
                  Cancel
                </Button>
                
                <Button 
                  variant="primary"
                  type="submit"
                  disabled={creating}
                  className="min-w-[120px]"
                >
                  {creating ? <LoadingSpinner size="small" /> : 'Create Game'}
                </Button>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </PageLayout>
  );
} 
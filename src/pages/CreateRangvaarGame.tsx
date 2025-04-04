import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import PageLayout from '../components/common/PageLayout';
import { useAuth } from '../context/AuthContext';
import { logger } from '../utils/logger';
// Import the actual service function
import { createRangvaarGame } from '../services/rangvaarService';

export default function CreateRangvaarGame(): JSX.Element {
  const navigate = useNavigate();
  const { currentUser, balance, loading: authLoading } = useAuth();
  const [wager, setWager] = useState<number>(10); // Default wager
  const [totalRounds, setTotalRounds] = useState<3 | 5>(3); // Default rounds
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Validate wager against balance when balance or wager changes
    if (!authLoading && balance !== null && wager > balance) {
      setError(`Insufficient balance. Your max wager is ₹${balance}.`);
    } else if (wager <= 0) {
      setError('Wager must be a positive amount.');
    } else {
      setError(''); // Clear error if valid
    }
  }, [wager, balance, authLoading]);

  const handleWagerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setWager(isNaN(value) ? 0 : value);
  };

  const handleRoundsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value, 10);
    if (value === 3 || value === 5) {
      setTotalRounds(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (error || !currentUser || authLoading) {
      logger.warn('CreateRangvaarGame', 'Submit prevented due to error, loading, or no user', { error, authLoading, currentUser: !!currentUser });
      toast.error(error || 'Cannot create game. Please try again.');
      return;
    }

    setIsSubmitting(true);
    logger.info('CreateRangvaarGame', 'Attempting to create Rangvaar game', { userId: currentUser.uid, wager, totalRounds });

    try {
      // --- Call the actual service function --- 
      const gameId = await createRangvaarGame(currentUser.uid, wager, totalRounds);
      logger.info('CreateRangvaarGame', 'Rangvaar game created successfully', { gameId });
      toast.success('Game created successfully! Redirecting to lobby...');
      navigate(`/game/rangvaar/${gameId}`); // Navigate to the specific game lobby
      // ---------------------------------------

      // --- Remove Placeholder behavior --- 
      // await new Promise(resolve => setTimeout(resolve, 1000)); 
      // const fakeGameId = `rangvaar_${Date.now()}`;
      // logger.info('CreateRangvaarGame', '[MVP Placeholder] Simulated Rangvaar game creation', { gameId: fakeGameId });
      // toast.success('[MVP Placeholder] Game creation simulated! Redirecting...');
      // navigate('/choose-game'); 
      // -------------------------------------
      
    } catch (err) {
      const error = err as Error;
      logger.error('CreateRangvaarGame', 'Failed to create Rangvaar game', { error: error.message });
      toast.error(`Failed to create game: ${error.message}`);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const potentialWinnings = wager * (4 - 1); // Winner takes all minus their own stake

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-8 max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-emerald-700">Create Rangvaar Game</h1>
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-6">
          
          <div>
            <label htmlFor="wager" className="block text-sm font-medium text-gray-700 mb-1">
              Wager per Player (₹)
            </label>
            <input
              type="number"
              id="wager"
              value={wager}
              onChange={handleWagerChange}
              min="1" 
              step="1"
              required
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-emerald-500 focus:border-emerald-500"
              disabled={isSubmitting || authLoading}
            />
            {balance !== null && !authLoading && (
              <p className="mt-1 text-xs text-gray-500">Your balance: ₹{balance}</p>
            )}
            {authLoading && (
              <p className="mt-1 text-xs text-gray-500">Loading balance...</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Total Pot: ₹{wager * 4} | Potential Winnings: ₹{potentialWinnings} (approx)
            </p>
          </div>

          <div>
            <label htmlFor="rounds" className="block text-sm font-medium text-gray-700 mb-1">
              Number of Rounds
            </label>
            <select
              id="rounds"
              value={totalRounds}
              onChange={handleRoundsChange}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
              disabled={isSubmitting}
            >
              <option value={3}>3 Rounds</option>
              <option value={5}>5 Rounds</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              The team with the highest score after {totalRounds} rounds wins.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
              {error}
            </p>
          )}

          <div className="mt-6 flex justify-between items-center pt-4 border-t border-gray-200">
            <button
              type="button" // Important: type="button" to prevent form submission
              onClick={() => navigate('/choose-game')}
              className="bg-gray-200 text-gray-800 py-2 px-5 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !!error || authLoading}
              className="bg-emerald-600 text-white py-2 px-5 rounded-md font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Game'}
            </button>
          </div>
        </form>
      </div>
    </PageLayout>
  );
} 
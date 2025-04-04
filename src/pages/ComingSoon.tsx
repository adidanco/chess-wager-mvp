import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../components/common/PageLayout';

export default function ComingSoon(): JSX.Element {
  const navigate = useNavigate();

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-16 max-w-md text-center">
        <h1 className="text-3xl font-bold mb-6">Coming Soon!</h1>
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="mb-8">
            <div className="text-6xl mb-4">🎮</div>
            <p className="text-xl text-gray-700 mb-4">
              We're working hard to bring this game to our platform.
            </p>
            <p className="text-gray-600">
              Stay tuned for updates and be the first to know when it launches!
            </p>
          </div>
          
          <div className="flex flex-col space-y-4">
            <button
              onClick={() => navigate('/choose-game')}
              className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors"
            >
              Back to Games
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
} 
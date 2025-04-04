import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../components/common/PageLayout';

export default function CreateScambodiaGame(): JSX.Element {
  const navigate = useNavigate();

  // TODO: Implement Scambodia game creation form

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-8 max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Create Scambodia Game</h1>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-center text-gray-600 mb-4">
            Scambodia game creation form will be here.
          </p>
          {/* Placeholder for form elements */}
          <div className="space-y-4">
             <div>
               <label className="block text-sm font-medium text-gray-700">Wager Amount (Placeholder)</label>
               <input type="number" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" disabled />
             </div>
             <div>
               <label className="block text-sm font-medium text-gray-700">Time Control (Placeholder)</label>
               <select className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" disabled>
                 <option>5 minutes</option>
                 <option>10 minutes</option>
               </select>
             </div>
          </div>
          <div className="mt-6 flex justify-between">
            <button
              onClick={() => navigate('/choose-game')} // Go back to game selection
              className="bg-gray-300 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
            <button
              // onClick={handleSubmit} // TODO: Implement submit
              disabled // Disabled for now
              className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              Create Game (Coming Soon)
            </button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
} 
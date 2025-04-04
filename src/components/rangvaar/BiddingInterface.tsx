import React, { useState, useMemo } from 'react';
import { BidInfo } from '../../types/rangvaar';
import { MIN_BID, MAX_BID } from '../../constants/rangvaarConstants';

interface BiddingInterfaceProps {
  placeBid: (bidAmount: number | null) => Promise<void>; // Pass null to signify passing
  highestBidInfo?: BidInfo;
  isSubmitting: boolean; // To disable buttons during action
}

const BiddingInterface: React.FC<BiddingInterfaceProps> = ({ 
  placeBid, 
  highestBidInfo, 
  isSubmitting
}) => {
  const currentHighestBid = highestBidInfo?.bidAmount || (MIN_BID - 1);
  const [selectedBid, setSelectedBid] = useState<number>(currentHighestBid + 1 >= MIN_BID ? currentHighestBid + 1 : MIN_BID);

  const possibleBids = useMemo(() => {
    const bids = [];
    const startBid = Math.max(currentHighestBid + 1, MIN_BID);
    for (let i = startBid; i <= MAX_BID; i++) {
      bids.push(i);
    }
    return bids;
  }, [currentHighestBid]);

  const handleBidSubmit = () => {
    if (selectedBid >= MIN_BID && selectedBid <= MAX_BID && !isSubmitting) {
      placeBid(selectedBid);
    }
  };

  const handlePass = () => {
    if (!isSubmitting) {
      placeBid(null); // Signal pass
    }
  };

  // Update selectedBid if possibleBids changes and current selection becomes invalid
  React.useEffect(() => {
      if (!possibleBids.includes(selectedBid) && possibleBids.length > 0) {
          setSelectedBid(possibleBids[0]);
      } else if (possibleBids.length === 0 && selectedBid <= MAX_BID) {
         // If no higher bids possible, reset selection state (though UI should prevent submit)
      }
  }, [possibleBids, selectedBid]);

  return (
    <div className="p-3 bg-gray-50 rounded-lg shadow">
      <p className="text-sm font-medium text-center mb-2">Your Turn to Bid</p>
      <p className="text-xs text-center text-gray-600 mb-3">
        Current Highest Bid: {currentHighestBid >= MIN_BID ? currentHighestBid : 'None'}
      </p>
      
      {possibleBids.length > 0 ? (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <select 
            value={selectedBid}
            onChange={(e) => setSelectedBid(parseInt(e.target.value, 10))}
            className="border border-gray-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white"
            disabled={isSubmitting}
          >
            {possibleBids.map(bid => (
              <option key={bid} value={bid}>{bid} Tricks</option>
            ))}
          </select>
          <button
            onClick={handleBidSubmit}
            disabled={isSubmitting}
            className="w-full sm:w-auto bg-emerald-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            Place Bid ({selectedBid})
          </button>
          <button
            onClick={handlePass}
            disabled={isSubmitting}
            className="w-full sm:w-auto bg-gray-400 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-500 disabled:opacity-50"
          >
            Pass
          </button>
        </div>
      ) : (
         <div className="flex items-center justify-center gap-3">
             <p className="text-sm text-gray-500">You must pass.</p>
             <button
                onClick={handlePass}
                disabled={isSubmitting}
                className="bg-gray-400 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-500 disabled:opacity-50"
             >
                Pass
             </button>
         </div>
      )}
    </div>
  );
};

export default BiddingInterface; 
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { logger } from "../../utils/logger";
import { CURRENCY_SYMBOL } from "../../utils/constants";
import { useAuth } from "../../context/AuthContext";

/**
 * Interface for BalanceDisplay props
 */
interface BalanceDisplayProps {
  balance: number;
}

/**
 * Component to display user balance and deposit options
 */
const BalanceDisplay = ({ balance = 0 }: BalanceDisplayProps): JSX.Element => {
  const [showDepositOptions, setShowDepositOptions] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const { updateBalance, balanceUpdating } = useAuth();
  
  const depositAmounts = [5, 10, 15, 20];

  const handleDeposit = async (amount: number): Promise<void> => {
    if (isProcessing || balanceUpdating) return;
    
    setIsProcessing(true);
    try {
      await updateBalance(amount, "deposit");
      logger.info('BalanceDisplay', 'Deposit successful', { amount });
      toast.success(`Successfully deposited ${CURRENCY_SYMBOL}${amount}`);
      setShowDepositOptions(false);
    } catch (error) {
      const err = error as Error;
      logger.error('BalanceDisplay', 'Error processing deposit', { error: err });
      toast.error(err.message || "Error processing deposit!");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-2">Balance</h3>
      <div className="text-2xl text-green-600 font-bold">
        {CURRENCY_SYMBOL}{balance.toFixed(2)}
      </div>
      <div className="relative">
        <button
          onClick={() => setShowDepositOptions(!showDepositOptions)}
          disabled={isProcessing || balanceUpdating}
          className={`mt-2 w-full ${
            isProcessing || balanceUpdating
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-green-500 hover:bg-green-600"
          } text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2`}
        >
          {isProcessing || balanceUpdating ? "Processing..." : "Deposit"}
        </button>
        {showDepositOptions && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10">
            {depositAmounts.map((amount) => (
              <button
                key={amount}
                onClick={() => handleDeposit(amount)}
                disabled={isProcessing || balanceUpdating}
                className={`w-full px-4 py-2 text-left ${
                  isProcessing || balanceUpdating
                    ? "text-gray-400 cursor-not-allowed"
                    : "hover:bg-gray-100"
                } focus:outline-none`}
              >
                {CURRENCY_SYMBOL}{amount}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BalanceDisplay; 
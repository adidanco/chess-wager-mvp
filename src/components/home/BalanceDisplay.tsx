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
 * Component to display user balance, deposit, and withdraw options
 */
const BalanceDisplay = ({ balance = 0 }: BalanceDisplayProps): JSX.Element => {
  const [showDepositOptions, setShowDepositOptions] = useState<boolean>(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const { updateBalance, balanceUpdating } = useAuth();
  
  const depositAmounts = [5, 10, 15, 20];
  
  // Close all menus
  const closeAllMenus = () => {
    setShowDepositOptions(false);
    setShowWithdrawForm(false);
    setCustomAmount("");
    setWithdrawAmount("");
  };

  const handleDeposit = async (amount: number): Promise<void> => {
    if (isProcessing || balanceUpdating) return;
    
    setIsProcessing(true);
    try {
      await updateBalance(amount, "deposit");
      logger.info('BalanceDisplay', 'Deposit successful', { amount });
      toast.success(`Successfully deposited ${CURRENCY_SYMBOL}${amount}`);
      closeAllMenus();
    } catch (error) {
      const err = error as Error;
      logger.error('BalanceDisplay', 'Error processing deposit', { error: err });
      toast.error(err.message || "Error processing deposit!");
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleCustomDeposit = async (): Promise<void> => {
    if (isProcessing || balanceUpdating) return;
    
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    await handleDeposit(amount);
  };
  
  const handleWithdraw = async (): Promise<void> => {
    if (isProcessing || balanceUpdating) return;
    
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    // Verify sufficient balance
    if (amount > balance) {
      toast.error("Insufficient balance for this withdrawal");
      return;
    }
    
    setIsProcessing(true);
    try {
      await updateBalance(-amount, "withdraw");
      logger.info('BalanceDisplay', 'Withdrawal successful', { amount });
      toast.success(`Successfully withdrew ${CURRENCY_SYMBOL}${amount}`);
      closeAllMenus();
    } catch (error) {
      const err = error as Error;
      logger.error('BalanceDisplay', 'Error processing withdrawal', { error: err });
      toast.error(err.message || "Error processing withdrawal!");
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Toggle options menus
  const toggleDepositOptions = () => {
    setShowWithdrawForm(false);
    setShowDepositOptions(!showDepositOptions);
    setCustomAmount("");
  };
  
  const toggleWithdrawForm = () => {
    setShowDepositOptions(false);
    setShowWithdrawForm(!showWithdrawForm);
    setWithdrawAmount("");
  };

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-2">Balance</h3>
      <div className="text-2xl text-green-600 font-bold mb-3">
        {CURRENCY_SYMBOL}{balance.toFixed(2)}
      </div>
      
      <div className="flex space-x-2 mb-2">
        <button
          onClick={toggleDepositOptions}
          disabled={isProcessing || balanceUpdating}
          className={`flex-1 ${
            isProcessing || balanceUpdating
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-green-500 hover:bg-green-600"
          } text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 min-h-[44px]`}
        >
          {isProcessing && showDepositOptions ? "Processing..." : "Deposit"}
        </button>
        
        <button
          onClick={toggleWithdrawForm}
          disabled={isProcessing || balanceUpdating || balance <= 0}
          className={`flex-1 ${
            isProcessing || balanceUpdating || balance <= 0
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-red-500 hover:bg-red-600"
          } text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 min-h-[44px]`}
        >
          {isProcessing && showWithdrawForm ? "Processing..." : "Withdraw"}
        </button>
      </div>
      
      {/* Deposit options menu */}
      {showDepositOptions && (
        <div className="bg-white rounded-md shadow-lg border border-gray-200 p-3 mb-3 z-10">
          <div className="grid grid-cols-2 gap-2 mb-2">
            {depositAmounts.map((amount) => (
              <button
                key={`deposit-${amount}`}
                onClick={() => handleDeposit(amount)}
                disabled={isProcessing || balanceUpdating}
                className={`w-full px-4 py-2 rounded-md min-h-[44px] ${
                  isProcessing || balanceUpdating
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-green-50 hover:bg-green-100 text-green-700"
                } focus:outline-none`}
              >
                {CURRENCY_SYMBOL}{amount}
              </button>
            ))}
          </div>
          
          {/* Custom amount section */}
          <div className="mt-3">
            <div className="flex space-x-2">
              <input
                type="number"
                inputMode="decimal"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="Enter custom amount"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                min="1"
                step="0.01"
              />
              <button
                onClick={handleCustomDeposit}
                disabled={isProcessing || balanceUpdating || !customAmount}
                className={`px-4 py-2 rounded-md min-w-[100px] min-h-[44px] ${
                  isProcessing || balanceUpdating || !customAmount
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-green-500 hover:bg-green-600 text-white"
                }`}
              >
                Deposit
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Withdraw form */}
      {showWithdrawForm && (
        <div className="bg-white rounded-md shadow-lg border border-gray-200 p-3 mb-3 z-10">
          <div className="flex flex-col">
            <label htmlFor="withdrawAmount" className="mb-1 text-sm font-medium text-gray-700">
              Withdrawal amount
            </label>
            <div className="flex space-x-2">
              <input
                id="withdrawAmount"
                type="number"
                inputMode="decimal"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder={`Max ${CURRENCY_SYMBOL}${balance.toFixed(2)}`}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                min="1"
                max={balance}
                step="0.01"
                autoFocus
              />
              <button
                onClick={handleWithdraw}
                disabled={isProcessing || balanceUpdating || !withdrawAmount || parseFloat(withdrawAmount) > balance}
                className={`px-4 py-2 rounded-md min-w-[100px] min-h-[44px] ${
                  isProcessing || balanceUpdating || !withdrawAmount || parseFloat(withdrawAmount) > balance
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-red-500 hover:bg-red-600 text-white"
                }`}
              >
                {isProcessing ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
          
          <p className="mt-2 text-xs text-gray-500">
            Withdrawals are processed within 1-3 business days.
          </p>
        </div>
      )}
    </div>
  );
};

export default BalanceDisplay; 
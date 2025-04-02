import React, { FormEvent, useEffect, useState } from "react";
import { CURRENCY_SYMBOL, TIME_DISPLAY_OPTIONS, TIMER_OPTIONS, TimeOption } from "../../utils/constants";
import { useAuth } from "../../context/AuthContext";

/**
 * Interface for WagerForm props
 */
interface WagerFormProps {
  wager: string;
  setWager: (wager: string) => void;
  userBalance: number;
  isSubmitting: boolean;
  onSubmit: (e: FormEvent) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  submittingLabel?: string;
  cancelLabel?: string;
  timeOption: TimeOption;
  setTimeOption: (option: TimeOption) => void;
  useRealMoney?: boolean;
  setUseRealMoney?: (useRealMoney: boolean) => void;
}

/**
 * Reusable component for the wager form
 */
const WagerForm = ({
  wager,
  setWager,
  userBalance,
  isSubmitting,
  onSubmit,
  onCancel,
  submitLabel = "Create Game",
  submittingLabel = "Creating...",
  cancelLabel = "Cancel",
  timeOption,
  setTimeOption,
  useRealMoney = false,
  setUseRealMoney = () => {},
}: WagerFormProps): JSX.Element => {
  const [sliderValue, setSliderValue] = useState<number>(parseInt(wager) || 10);
  const { realMoneyBalance } = useAuth();
  
  // Quick amount buttons
  const quickAmounts = [10, 50, 100, 500];
  
  // Effective balance based on whether using real money or game currency
  const effectiveBalance = useRealMoney ? (realMoneyBalance || 0) : userBalance;
  
  // Handle slider change
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setSliderValue(value);
    setWager(value.toString());
  };
  
  // Handle quick amount selection
  const handleQuickAmount = (amount: number) => {
    setSliderValue(amount);
    setWager(amount.toString());
  };
  
  // Update slider when wager changes externally
  useEffect(() => {
    const parsed = parseInt(wager);
    if (!isNaN(parsed)) {
      setSliderValue(parsed);
    }
  }, [wager]);
  
  // Toggle between real money and game currency
  const toggleWagerType = () => {
    setUseRealMoney(!useRealMoney);
  };
  
  return (
    <div className="bg-white p-4 sm:p-8 rounded-lg shadow-md w-full max-w-md">
      <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center text-gray-800">Create New Game</h2>
      
      <form onSubmit={onSubmit} className="space-y-6 sm:space-y-8">
        {/* Wager Type Toggle */}
        <div className="border-b pb-4">
          <label className="block text-base sm:text-lg font-semibold text-gray-700 mb-3">
            Wager Type
          </label>
          
          <div className="flex justify-center">
            <div className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={useRealMoney}
                onChange={toggleWagerType}
              />
              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="ml-3 text-sm font-medium text-gray-900">
                {useRealMoney ? 'Real Money ₹' : 'Game Currency ' + CURRENCY_SYMBOL}
              </span>
            </div>
          </div>
          
          {useRealMoney && (
            <div className="mt-2 text-center text-sm text-orange-600 bg-orange-50 p-2 rounded-md">
              You are using real money. Amounts will be deducted from your wallet balance.
            </div>
          )}
        </div>
        
        {/* Wager Amount Section */}
        <div className="space-y-3 sm:space-y-4">
          <label className="block text-base sm:text-lg font-semibold text-gray-700 mb-2">
            Wager Amount
          </label>
          
          {/* Display current wager with currency */}
          <div className="flex items-center justify-center mb-3 sm:mb-4">
            <span className="text-2xl sm:text-3xl font-bold text-green-600">
              {useRealMoney ? '₹' : CURRENCY_SYMBOL}{sliderValue}
            </span>
          </div>
          
          {/* Quick amount buttons */}
          <div className="grid grid-cols-4 gap-1 sm:gap-2 mb-3 sm:mb-4">
            {quickAmounts.map(amount => (
              <button
                key={amount}
                type="button"
                onClick={() => handleQuickAmount(amount)}
                className={`py-2 px-1 sm:px-3 min-h-[44px] rounded-md text-sm font-medium transition-colors touch-manipulation ${
                  sliderValue === amount 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } ${amount > effectiveBalance ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={amount > effectiveBalance}
              >
                {useRealMoney ? '₹' : CURRENCY_SYMBOL}{amount}
              </button>
            ))}
          </div>
          
          {/* Slider for wager amount */}
          <div className="space-y-2">
            <input
              type="range"
              min="1"
              max={Math.max(effectiveBalance, 1000)}
              value={sliderValue}
              onChange={handleSliderChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              style={{ touchAction: 'manipulation' }}
            />
            
            {/* Min/Max labels */}
            <div className="flex justify-between text-xs text-gray-500">
              <span>{useRealMoney ? '₹' : CURRENCY_SYMBOL}1</span>
              <span>{useRealMoney ? '₹' : CURRENCY_SYMBOL}{Math.max(effectiveBalance, 1000)}</span>
            </div>
            
            {/* Manual input */}
            <div className="mt-3 sm:mt-4">
              <input
                type="number"
                value={wager}
                onChange={(e) => setWager(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-medium"
                placeholder="Enter wager amount"
                min="1"
                max={effectiveBalance}
                required
              />
            </div>
          </div>
          
          {effectiveBalance !== null && (
            <p className="mt-2 text-sm text-gray-500 flex items-center justify-center">
              <span className="mr-1">💰</span> Your balance: 
              {useRealMoney ? ' ₹' + (realMoneyBalance || 0).toFixed(2) : ' ' + CURRENCY_SYMBOL + userBalance.toFixed(2)}
            </p>
          )}
        </div>
        
        {/* Time Control Section */}
        <div className="space-y-3 sm:space-y-4">
          <label className="block text-base sm:text-lg font-semibold text-gray-700 mb-2">
            Time Control
          </label>
          
          {/* Time option cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {[
              { value: "THREE_MIN", label: "3", icon: "⚡" },
              { value: "FIVE_MIN", label: "5", icon: "⏱️" },
              { value: "TEN_MIN", label: "10", icon: "🕙" }
            ].map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTimeOption(option.value as TimeOption)}
                className={`flex flex-col items-center justify-center py-3 px-2 sm:p-4 rounded-lg border-2 transition-all min-h-[70px] touch-manipulation ${
                  timeOption === option.value
                    ? 'border-blue-600 bg-blue-50 shadow-md transform scale-105'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <span className="text-xl sm:text-2xl mb-1">{option.icon}</span>
                <span className="text-lg sm:text-xl font-bold">{option.label}</span>
                <span className="text-xs text-gray-500">minutes</span>
              </button>
            ))}
          </div>
          
          <p className="mt-2 text-xs sm:text-sm text-gray-500 text-center">
            Each player will have this amount of time for the entire game
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="space-y-3 pt-2 sm:pt-4">
          <button
            type="submit"
            disabled={isSubmitting || parseInt(wager) > effectiveBalance}
            className={`w-full py-3 px-4 rounded-md text-white font-medium text-base sm:text-lg transition-colors min-h-[44px] ${
              isSubmitting || parseInt(wager) > effectiveBalance
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 shadow-md"
            }`}
          >
            {isSubmitting ? submittingLabel : submitLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-md hover:bg-gray-200 font-medium focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors min-h-[44px]"
          >
            {cancelLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

export default WagerForm;
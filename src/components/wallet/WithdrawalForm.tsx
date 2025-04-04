import React, { useState } from 'react';
import { requestWithdrawal } from '../../services/transactionService';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';
import Card from '../common/Card';
import Button from '../common/Button';

const WITHDRAWAL_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

export const WithdrawalForm: React.FC = () => {
  const { balance, withdrawableBalance, pendingWithdrawalAmount, userProfile } = useAuth();
  const [amount, setAmount] = useState<number>(0);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [upiId, setUpiId] = useState<string>(userProfile?.withdrawalUpiId || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  // Handle selection of predefined amount
  const handleAmountSelect = (value: number) => {
    setAmount(value);
    setCustomAmount('');
  };

  // Handle custom amount input
  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers
    if (/^\d*$/.test(value)) {
      setCustomAmount(value);
      setAmount(value ? parseInt(value, 10) : 0);
    }
  };

  // Handle UPI ID input
  const handleUpiIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUpiId(e.target.value);
  };

  // Validate UPI ID format
  const isValidUpiId = (upi: string): boolean => {
    // Basic UPI ID validation: username@provider format
    return /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+$/.test(upi);
  };

  // Handle withdrawal request
  const handleWithdrawalRequest = async () => {
    // Reset error state
    setError(null);
    
    // Validate amount
    if (amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    
    // Validate minimum withdrawal amount
    if (amount < 100) {
      setError('Minimum withdrawal amount is ₹100');
      return;
    }
    
    // Validate UPI ID
    if (!upiId.trim() || !isValidUpiId(upiId.trim())) {
      setError('Please enter a valid UPI ID (e.g. username@provider)');
      return;
    }
    
    // Check if user has enough withdrawable balance
    if (amount > withdrawableBalance) {
      setError('Insufficient withdrawable balance');
      return;
    }
    
    // Proceed with withdrawal request
    setLoading(true);
    
    try {
      const result = await requestWithdrawal(amount, upiId.trim());
      if (result.success) {
        setSuccess(true);
        toast.success('Withdrawal request submitted successfully!');
        // Reset form after success
        setTimeout(() => {
          setAmount(0);
          setCustomAmount('');
          setSuccess(false);
        }, 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit withdrawal request. Please try again.');
      toast.error('Withdrawal request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card variant="default" className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-deep-purple mb-2">Withdraw Money</h2>
        <p className="text-muted-violet">Get your winnings to your bank account</p>
      </div>
      
      {/* Balance Information */}
      <div className="bg-soft-lavender/10 rounded-lg p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div>
            <p className="text-sm text-muted-violet mb-1">Total Balance</p>
            <p className="text-xl font-bold text-deep-purple">₹{balance || 0}</p>
          </div>
          <div className="mt-3 md:mt-0 md:text-right">
            <p className="text-sm text-muted-violet mb-1">Withdrawable Balance</p>
            <p className="text-xl font-bold text-soft-pink">₹{withdrawableBalance || 0}</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-soft-lavender/20">
          <p className="text-xs text-gray-600">You can only withdraw winnings from games. Deposited amounts are for gameplay only.</p>
          {(pendingWithdrawalAmount || 0) > 0 && (
            <div className="mt-2 py-2 px-3 bg-muted-violet/10 rounded text-sm">
              <p className="flex items-center text-muted-violet">
                <i className="fas fa-clock mr-2"></i>
                Pending Withdrawal: <span className="font-medium ml-1">₹{pendingWithdrawalAmount}</span>
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Amount Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-deep-purple mb-2">
          Select Amount:
        </label>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {WITHDRAWAL_AMOUNTS.map((value) => (
            <Button 
              key={value}
              variant={amount === value ? "primary" : "outline"}
              onClick={() => handleAmountSelect(value)}
              className="h-12"
              disabled={value > withdrawableBalance}
            >
              ₹{value}
            </Button>
          ))}
        </div>
        
        <div className="mt-4">
          <label className="block text-sm font-medium text-deep-purple mb-2">
            Custom Amount:
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500">₹</span>
            </div>
            <input
              type="text"
              value={customAmount}
              onChange={handleCustomAmountChange}
              className="block w-full pl-7 pr-12 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-soft-pink focus:border-soft-pink"
              placeholder="Enter amount"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">Maximum: ₹{withdrawableBalance}</p>
        </div>
      </div>
      
      {/* UPI ID Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-deep-purple mb-2">
          Your UPI ID:
        </label>
        <input
          type="text"
          value={upiId}
          onChange={handleUpiIdChange}
          className="block w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-soft-pink focus:border-soft-pink"
          placeholder="username@provider"
        />
        <p className="mt-1 text-xs text-gray-500">
          Enter your UPI ID in the format username@provider (e.g., yourname@okicici)
        </p>
      </div>
      
      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <i className="fas fa-exclamation-circle text-red-400"></i>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <i className="fas fa-check-circle text-green-400"></i>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">
                Withdrawal request submitted! Our team will process it within 24 hours.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Submit Button */}
      <Button 
        variant="cta" 
        size="large"
        fullWidth
        onClick={handleWithdrawalRequest}
        disabled={loading || success || amount <= 0 || amount > withdrawableBalance}
        isLoading={loading}
        className="mt-4"
      >
        Request Withdrawal
      </Button>
      
      {/* Footer Note */}
      <div className="mt-8 pt-4 border-t border-gray-100 text-xs text-center text-gray-500">
        Note: Withdrawals are processed manually within 24 hours. 
        You will receive money at your provided UPI ID.
      </div>
    </Card>
  );
}; 
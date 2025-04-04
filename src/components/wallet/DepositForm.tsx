import React, { useState } from 'react';
import { confirmDeposit } from '../../services/transactionService';
import { useAuth } from '../../hooks/useAuth';
import QRCode from 'react-qr-code';
import { toast } from 'react-hot-toast';
import Card from '../common/Card';
import Button from '../common/Button';

const DEPOSIT_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

export const DepositForm: React.FC = () => {
  const { balance } = useAuth();
  const [amount, setAmount] = useState<number>(0);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [upiTransactionId, setUpiTransactionId] = useState<string>('');
  const [paymentStep, setPaymentStep] = useState<'select' | 'confirm'>('select');
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

  // Handle proceed to payment
  const handleProceedToPayment = () => {
    if (amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    
    setError(null);
    setPaymentStep('confirm');
  };

  // Generate UPI payment details
  const getUpiString = () => {
    // Format: upi://pay?pa=MERCHANT_UPI_ID&pn=MERCHANT_NAME&am=AMOUNT&cu=INR&tn=DESCRIPTION
    return `upi://pay?pa=your-business@upi&pn=GamEBit&am=${amount}&cu=INR&tn=Deposit${amount}`;
  };

  // Handle confirm deposit after payment
  const handleConfirmDeposit = async () => {
    if (!upiTransactionId.trim()) {
      setError('Please enter the UPI transaction ID from your payment app');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await confirmDeposit(amount, upiTransactionId);
      if (result.success) {
        setSuccess(true);
        toast.success(`₹${amount} added to your account!`);
        // Reset form after success
        setTimeout(() => {
          setAmount(0);
          setCustomAmount('');
          setUpiTransactionId('');
          setPaymentStep('select');
          setSuccess(false);
        }, 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process deposit. Please try again.');
      toast.error('Deposit failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle cancel and go back to amount selection
  const handleCancel = () => {
    setPaymentStep('select');
    setError(null);
  };

  return (
    <Card variant="default" className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-deep-purple mb-2">Add Money</h2>
        <p className="text-muted-violet">Current Balance: <span className="font-semibold">₹{balance || 0}</span></p>
      </div>
      
      {paymentStep === 'select' ? (
        <>
          <div className="mb-6">
            <label className="block text-sm font-medium text-deep-purple mb-2">
              Select Amount:
            </label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {DEPOSIT_AMOUNTS.map((value) => (
                <Button 
                  key={value}
                  variant={amount === value ? "primary" : "outline"}
                  onClick={() => handleAmountSelect(value)}
                  className="h-12"
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
            </div>
          </div>
          
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
          
          <Button 
            variant="cta" 
            size="large"
            fullWidth
            onClick={handleProceedToPayment}
            disabled={amount <= 0}
            rightIcon={<i className="fas fa-arrow-right"></i>}
            className="mt-4"
          >
            Proceed to Payment
          </Button>
        </>
      ) : (
        <>
          <div className="flex flex-col items-center mb-6">
            <div className="text-center mb-4">
              <p className="text-lg font-medium text-deep-purple mb-1">
                Scan QR code to pay ₹{amount}
              </p>
              <p className="text-sm text-gray-500">
                Use any UPI app like Google Pay, PhonePe, Paytm, etc.
              </p>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-md mb-6">
              <QRCode value={getUpiString()} size={200} />
            </div>
            
            <div className="w-full max-w-md mb-4">
              <label className="block text-sm font-medium text-deep-purple mb-2">
                UPI Transaction ID:
              </label>
              <input
                type="text"
                value={upiTransactionId}
                onChange={(e) => setUpiTransactionId(e.target.value)}
                className="block w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-soft-pink focus:border-soft-pink"
                placeholder="Enter the transaction ID from your payment app"
              />
              <p className="mt-1 text-sm text-gray-500">
                You can find this in the transaction details of your UPI app
              </p>
            </div>
          </div>
          
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
                  <p className="text-sm text-green-700">Deposit successful! Your balance has been updated.</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex gap-4">
            <Button 
              variant="outline" 
              onClick={handleCancel}
              disabled={loading}
              leftIcon={<i className="fas fa-arrow-left"></i>}
              className="flex-1"
            >
              Back
            </Button>
            <Button 
              variant="primary" 
              onClick={handleConfirmDeposit}
              disabled={loading || success}
              isLoading={loading}
              className="flex-1"
            >
              Confirm Deposit
            </Button>
          </div>
        </>
      )}
      
      <div className="mt-8 pt-4 border-t border-gray-100 text-xs text-center text-gray-500">
        Note: This is a simulated payment flow for demonstration purposes.
        In a production environment, a secure payment gateway would be used.
      </div>
    </Card>
  );
}; 
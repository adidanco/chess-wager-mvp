import React, { useState, useEffect } from 'react';
import { Box, Button, TextField, Typography, Paper, CircularProgress, Alert } from '@mui/material';
import { confirmDeposit, createOrder, verifyPayment } from '../../services/transactionService';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { razorpayConfig } from '../../firebaseConfig';

// Define Razorpay interface for TypeScript
declare global {
  interface Window {
    Razorpay: any;
  }
}

const DEPOSIT_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

export const DepositForm: React.FC = () => {
  const { realMoneyBalance, userProfile } = useAuth();
  const [amount, setAmount] = useState<number>(0);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  
  // Add Razorpay script when component mounts
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);

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
  const handleProceedToPayment = async () => {
    if (amount < 100) {
      setError('Minimum deposit amount is ₹100');
      return;
    }
    
    setError(null);
    setLoading(true);
    
    try {
      // Create Razorpay order
      const orderResponse = await createOrder(amount);
      
      if (!orderResponse.success || !orderResponse.orderId) {
        throw new Error('Failed to create payment order');
      }
      
      // Initialize Razorpay checkout
      const options = {
        key: razorpayConfig.key, // Using imported config
        amount: amount * 100, // amount in paise
        currency: 'INR',
        name: 'Chess Wager',
        description: `Deposit ₹${amount}`,
        order_id: orderResponse.orderId,
        prefill: {
          name: userProfile?.username || '',
          email: userProfile?.email || '',
        },
        handler: function(response: any) {
          handlePaymentSuccess({
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature
          });
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
          }
        },
        theme: {
          color: '#556cd6'
        }
      };
      
      const rzp = new window.Razorpay(options);
      rzp.open();
      
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to process payment. Please try again.');
      toast.error('Payment initialization failed. Please try again.');
    }
  };

  // Handle successful payment
  const handlePaymentSuccess = async (paymentData: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => {
    setLoading(true);
    
    try {
      // Verify payment on the server
      const verificationResult = await verifyPayment(paymentData);
      
      if (verificationResult.success) {
        setSuccess(true);
        toast.success(verificationResult.message || `₹${amount} added to your account!`);
        
        // Reset form after success
        setTimeout(() => {
          setAmount(0);
          setCustomAmount('');
          setSuccess(false);
        }, 3000);
      } else {
        throw new Error('Payment verification failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify payment. Please contact support.');
      toast.error('Payment verification failed. Please contact support.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, maxWidth: 500, mx: 'auto', my: 2 }}>
      <Typography variant="h5" component="h2" gutterBottom align="center">
        Add Money
      </Typography>
      
      <Typography variant="subtitle1" gutterBottom>
        Current Balance: ₹{realMoneyBalance || 0}
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Select Amount:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {DEPOSIT_AMOUNTS.map((value) => (
            <Button 
              key={value}
              variant={amount === value ? "contained" : "outlined"}
              onClick={() => handleAmountSelect(value)}
              sx={{ minWidth: '80px', flexGrow: 1 }}
            >
              ₹{value}
            </Button>
          ))}
        </Box>
        
        <TextField
          label="Custom Amount"
          value={customAmount}
          onChange={handleCustomAmountChange}
          fullWidth
          variant="outlined"
          placeholder="Enter amount (minimum ₹100)"
          sx={{ mt: 2 }}
          InputProps={{
            startAdornment: <Box component="span" sx={{ mr: 1 }}>₹</Box>,
          }}
        />
      </Box>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>Deposit successful!</Alert>}
      
      <Button 
        variant="contained" 
        color="primary" 
        fullWidth
        size="large"
        onClick={handleProceedToPayment}
        disabled={amount < 100 || loading}
      >
        {loading ? <CircularProgress size={24} /> : 'Pay with Razorpay'}
      </Button>
      
      <Typography variant="body2" color="textSecondary" align="center" sx={{ mt: 3 }}>
        Secured by Razorpay. You can use credit/debit cards, UPI, or net banking.
      </Typography>
    </Paper>
  );
}; 
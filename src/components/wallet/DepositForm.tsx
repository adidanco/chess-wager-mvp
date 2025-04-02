import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Paper, CircularProgress, Alert } from '@mui/material';
import { confirmDeposit } from '../../services/transactionService';
import { useAuth } from '../../hooks/useAuth';
import QRCode from 'react-qr-code';
import { toast } from 'react-hot-toast';

const DEPOSIT_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

export const DepositForm: React.FC = () => {
  const { realMoneyBalance } = useAuth();
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
    return `upi://pay?pa=your-business@upi&pn=ChessWager&am=${amount}&cu=INR&tn=Deposit${amount}`;
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
    <Paper elevation={3} sx={{ p: 3, maxWidth: 500, mx: 'auto', my: 2 }}>
      <Typography variant="h5" component="h2" gutterBottom align="center">
        Add Money
      </Typography>
      
      <Typography variant="subtitle1" gutterBottom>
        Current Balance: ₹{realMoneyBalance || 0}
      </Typography>
      
      {paymentStep === 'select' ? (
        <>
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
              placeholder="Enter amount"
              sx={{ mt: 2 }}
              InputProps={{
                startAdornment: <Box component="span" sx={{ mr: 1 }}>₹</Box>,
              }}
            />
          </Box>
          
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          
          <Button 
            variant="contained" 
            color="primary" 
            fullWidth
            size="large"
            onClick={handleProceedToPayment}
            disabled={amount <= 0}
          >
            Proceed to Payment
          </Button>
        </>
      ) : (
        <>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 2 }}>
            <Typography variant="subtitle1" gutterBottom align="center">
              Scan QR code to pay ₹{amount}
            </Typography>
            
            <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 1, mb: 2 }}>
              <QRCode value={getUpiString()} size={200} />
            </Box>
            
            <Typography variant="body2" color="textSecondary" align="center" sx={{ mb: 2 }}>
              After payment, enter the UPI transaction ID from your payment app
            </Typography>
            
            <TextField
              label="UPI Transaction ID"
              value={upiTransactionId}
              onChange={(e) => setUpiTransactionId(e.target.value)}
              fullWidth
              variant="outlined"
              sx={{ mb: 2 }}
            />
          </Box>
          
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>Deposit successful!</Alert>}
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button 
              variant="outlined" 
              color="secondary" 
              onClick={handleCancel}
              disabled={loading}
              sx={{ flexGrow: 1 }}
            >
              Cancel
            </Button>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleConfirmDeposit}
              disabled={loading || success}
              sx={{ flexGrow: 1 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Confirm Deposit'}
            </Button>
          </Box>
        </>
      )}
      
      <Typography variant="body2" color="textSecondary" align="center" sx={{ mt: 3 }}>
        Note: This is a simulated payment flow for demonstration purposes.
        In a production environment, a secure payment gateway would be used.
      </Typography>
    </Paper>
  );
}; 
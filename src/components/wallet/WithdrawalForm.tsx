import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Paper, CircularProgress, Alert } from '@mui/material';
import { requestWithdrawal } from '../../services/transactionService';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';

const WITHDRAWAL_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

export const WithdrawalForm: React.FC = () => {
  const { realMoneyBalance, pendingWithdrawalAmount, userProfile } = useAuth();
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
    
    // Check if user has enough balance
    if (amount > (realMoneyBalance || 0)) {
      setError('Insufficient balance');
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
    <Paper elevation={3} sx={{ p: 3, maxWidth: 500, mx: 'auto', my: 2 }}>
      <Typography variant="h5" component="h2" gutterBottom align="center">
        Withdraw Money
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Available Balance: ₹{realMoneyBalance || 0}
        </Typography>
        {(pendingWithdrawalAmount || 0) > 0 && (
          <Typography variant="subtitle2" color="text.secondary">
            Pending Withdrawal: ₹{pendingWithdrawalAmount}
          </Typography>
        )}
      </Box>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Select Amount:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {WITHDRAWAL_AMOUNTS.map((value) => (
            <Button 
              key={value}
              variant={amount === value ? "contained" : "outlined"}
              onClick={() => handleAmountSelect(value)}
              sx={{ minWidth: '80px', flexGrow: 1 }}
              disabled={value > (realMoneyBalance || 0)}
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
          sx={{ mt: 2, mb: 3 }}
          InputProps={{
            startAdornment: <Box component="span" sx={{ mr: 1 }}>₹</Box>,
          }}
        />
        
        <Typography variant="subtitle1" gutterBottom>
          UPI ID:
        </Typography>
        <TextField
          label="Your UPI ID"
          value={upiId}
          onChange={handleUpiIdChange}
          fullWidth
          variant="outlined"
          placeholder="username@provider"
          sx={{ mb: 1 }}
        />
        <Typography variant="caption" color="text.secondary">
          Enter your UPI ID in the format username@provider
        </Typography>
      </Box>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>
        Withdrawal request submitted! Our team will process it within 24 hours.
      </Alert>}
      
      <Button 
        variant="contained" 
        color="primary" 
        fullWidth
        size="large"
        onClick={handleWithdrawalRequest}
        disabled={loading || success || amount <= 0 || amount > (realMoneyBalance || 0)}
      >
        {loading ? <CircularProgress size={24} /> : 'Request Withdrawal'}
      </Button>
      
      <Typography variant="body2" color="textSecondary" align="center" sx={{ mt: 3 }}>
        Note: Withdrawals are processed manually within 24 hours. 
        You will receive money at your provided UPI ID.
      </Typography>
    </Paper>
  );
}; 
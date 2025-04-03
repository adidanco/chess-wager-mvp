import React, { useState, useContext } from 'react';
import { Box, Button, Typography, Paper, Divider, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Grid, Chip } from '@mui/material';
import { toast } from 'react-hot-toast';
import { AuthContext } from '../../context/AuthContext';
import { logger } from '../../utils/logger';

const QUICK_AMOUNTS = [25, 50, 100, 500];
const MIN_DEPOSIT = 25;
const MIN_WITHDRAW = 25;

const BalanceDisplay: React.FC = () => {
  // State for the deposit dialog
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // State for the withdrawal dialog
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [upiId, setUpiId] = useState('');

  const { userProfile, currentUser, updateBalance } = useContext(AuthContext) || {};

  const realMoneyBalance = userProfile?.realMoneyBalance || 0;
  const withdrawableAmount = userProfile?.withdrawableAmount || 0;

  const handleQuickDeposit = async (amount: number) => {
    if (!currentUser || !updateBalance) {
      toast.error('You must be logged in to deposit');
      return;
    }
    
    setIsProcessing(true);
    logger.info('Processing dummy deposit', { amount });
    
    try {
      // Call updateBalance without the isWinnings flag since this is a deposit
      const success = await updateBalance(amount, `Quick deposit of ₹${amount}`);
      
      if (success) {
        toast.success(`Successfully deposited ₹${amount}`);
        setIsDepositOpen(false);
        setDepositAmount('');
      }
    } catch (error) {
      toast.error('Failed to process deposit');
      logger.error('Deposit error', { error });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCustomDeposit = async () => {
    const amount = Number(depositAmount);
    
    if (isNaN(amount) || amount < MIN_DEPOSIT) {
      toast.error(`Minimum deposit amount is ₹${MIN_DEPOSIT}`);
      return;
    }
    
    if (!currentUser || !updateBalance) {
      toast.error('You must be logged in to deposit');
      return;
    }
    
    setIsProcessing(true);
    logger.info('Processing custom deposit', { amount });
    
    try {
      // Call updateBalance without the isWinnings flag
      const success = await updateBalance(amount, `Custom deposit of ₹${amount}`);
      
      if (success) {
        toast.success(`Successfully deposited ₹${amount}`);
        setIsDepositOpen(false);
        setDepositAmount('');
      }
    } catch (error) {
      toast.error('Failed to process deposit');
      logger.error('Custom deposit error', { error });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount);
    
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    if (amount < MIN_WITHDRAW) {
      toast.error(`Minimum withdrawal amount is ₹${MIN_WITHDRAW}`);
      return;
    }
    
    if (amount > withdrawableAmount) {
      toast.error('You can only withdraw your winnings');
      return;
    }
    
    if (!upiId) {
      toast.error('Please enter your UPI ID');
      return;
    }
    
    // Validate UPI ID format (basic validation)
    const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
    if (!upiRegex.test(upiId)) {
      toast.error('Please enter a valid UPI ID');
      return;
    }
    
    if (!currentUser || !updateBalance) {
      toast.error('You must be logged in to withdraw');
      return;
    }
    
    setIsProcessing(true);
    logger.info('Processing dummy withdrawal', { amount, upiId });
    
    try {
      // Call updateBalance with negative amount and isWinnings=true
      const success = await updateBalance(-amount, `Withdrawal to UPI: ${upiId}`, true);
      
      if (success) {
        toast.success(`Successfully withdrew ₹${amount}`);
        setIsWithdrawOpen(false);
        setWithdrawAmount('');
        setUpiId('');
      }
    } catch (error) {
      toast.error('Failed to process withdrawal');
      logger.error('Withdrawal error', { error, amount, upiId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseDeposit = () => {
    setIsDepositOpen(false);
    setDepositAmount('');
  };

  const handleCloseWithdraw = () => {
    setIsWithdrawOpen(false);
    setWithdrawAmount('');
    setUpiId('');
  };

  return (
    <>
      <Paper elevation={3} sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom align="center">
          Your Balance
        </Typography>
        
        <Box sx={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          my: 2
        }}>
          <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
            ₹{realMoneyBalance.toFixed(2)}
          </Typography>
        </Box>
        
        <Box sx={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2
        }}>
          <Chip 
            label={`Withdrawable: ₹${withdrawableAmount.toFixed(2)}`} 
            color="success" 
            variant="outlined" 
            size="small"
          />
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
          <Button 
            variant="contained" 
            color="primary" 
            fullWidth
            onClick={() => setIsDepositOpen(true)}
          >
            Deposit
          </Button>
          
          <Button 
            variant="outlined" 
            color="primary" 
            fullWidth
            onClick={() => setIsWithdrawOpen(true)}
            disabled={withdrawableAmount <= 0}
          >
            Withdraw
          </Button>
        </Box>
      </Paper>

      {/* Deposit Dialog */}
      <Dialog 
        open={isDepositOpen} 
        onClose={!isProcessing ? handleCloseDeposit : undefined}
      >
        <DialogTitle>Deposit Funds</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Quick deposit amounts:
          </Typography>
          <Grid container spacing={1} sx={{ mb: 3 }}>
            {QUICK_AMOUNTS.map((amount) => (
              <Grid item xs={6} key={amount}>
                <Button 
                  variant="outlined" 
                  fullWidth
                  onClick={() => handleQuickDeposit(amount)}
                  disabled={isProcessing}
                >
                  ₹{amount}
                </Button>
              </Grid>
            ))}
          </Grid>
          
          <Divider sx={{ my: 2 }}>
            <Typography variant="body2" color="text.secondary">OR</Typography>
          </Divider>
          
          <Typography variant="body2" sx={{ mb: 1 }}>
            Custom amount:
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Amount (₹)"
            type="number"
            fullWidth
            variant="outlined"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            InputProps={{
              inputProps: { min: MIN_DEPOSIT }
            }}
            disabled={isProcessing}
            sx={{ mb: 1 }}
          />
          <Typography variant="caption" color="text.secondary">
            Minimum deposit: ₹{MIN_DEPOSIT}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeposit} disabled={isProcessing}>
            Cancel
          </Button>
          <Button 
            onClick={handleCustomDeposit} 
            variant="contained" 
            color="primary"
            disabled={isProcessing || !depositAmount || Number(depositAmount) < MIN_DEPOSIT}
          >
            {isProcessing ? 'Processing...' : 'Deposit'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog 
        open={isWithdrawOpen} 
        onClose={!isProcessing ? handleCloseWithdraw : undefined}
      >
        <DialogTitle>Withdraw Funds</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Enter amount and UPI ID to withdraw funds
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            You can only withdraw your winnings: ₹{withdrawableAmount.toFixed(2)}
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Amount (₹)"
            type="number"
            fullWidth
            variant="outlined"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            InputProps={{
              inputProps: { min: MIN_WITHDRAW, max: withdrawableAmount }
            }}
            disabled={isProcessing}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="UPI ID"
            type="text"
            fullWidth
            variant="outlined"
            placeholder="example@upi"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            disabled={isProcessing}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseWithdraw} disabled={isProcessing}>
            Cancel
          </Button>
          <Button 
            onClick={handleWithdraw} 
            variant="contained" 
            color="primary"
            disabled={
              isProcessing || 
              !withdrawAmount || 
              Number(withdrawAmount) <= 0 || 
              Number(withdrawAmount) < MIN_WITHDRAW ||
              Number(withdrawAmount) > withdrawableAmount || 
              !upiId
            }
          >
            {isProcessing ? 'Processing...' : 'Withdraw'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default BalanceDisplay; 
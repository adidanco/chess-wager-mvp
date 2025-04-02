import React, { useState } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Paper, 
  Tabs, 
  Tab,
  Button
} from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import { DepositForm } from '../components/wallet/DepositForm';
import { WithdrawalForm } from '../components/wallet/WithdrawalForm';
import { TransactionHistory } from '../components/wallet/TransactionHistory';
import { useNavigate } from 'react-router-dom';

// Interface for tab panel props
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// Tab Panel component
const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`wallet-tabpanel-${index}`}
      aria-labelledby={`wallet-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

// Wallet Page Component
const Wallet: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, realMoneyBalance, pendingWithdrawalAmount } = useAuth();
  const [tabValue, setTabValue] = useState<number>(0);

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          My Wallet
        </Typography>
        
        <Paper elevation={3} sx={{ mb: 3, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" gutterBottom>
              Total Balance: ₹{realMoneyBalance || 0}
            </Typography>
            {(pendingWithdrawalAmount || 0) > 0 && (
              <Typography variant="body2" color="text.secondary">
                Pending Withdrawal: ₹{pendingWithdrawalAmount}
              </Typography>
            )}
          </Box>
          <Button 
            variant="contained"
            color="primary"
            onClick={() => navigate('/create-game')}
          >
            Play a Game
          </Button>
        </Paper>
        
        <Paper elevation={3} sx={{ mb: 3 }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            variant="fullWidth"
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab label="Add Money" />
            <Tab label="Withdraw" />
            <Tab label="Transactions" />
          </Tabs>
          
          <TabPanel value={tabValue} index={0}>
            <DepositForm />
          </TabPanel>
          
          <TabPanel value={tabValue} index={1}>
            <WithdrawalForm />
          </TabPanel>
          
          <TabPanel value={tabValue} index={2}>
            <TransactionHistory />
          </TabPanel>
        </Paper>
        
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Important Information
          </Typography>
          <Typography variant="body2" paragraph>
            • Deposits are processed immediately
          </Typography>
          <Typography variant="body2" paragraph>
            • Withdrawals are processed manually within 24 hours
          </Typography>
          <Typography variant="body2" paragraph>
            • Platform fee of 20% is charged on the winning amount
          </Typography>
          <Typography variant="body2" paragraph>
            • For any issues with transactions, please contact support
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
            Note: This is a simulated payment system for demonstration purposes only.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default Wallet; 
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { DepositForm } from '../components/wallet/DepositForm';
import { WithdrawalForm } from '../components/wallet/WithdrawalForm';
import { TransactionHistory } from '../components/wallet/TransactionHistory';
import PageLayout from '../components/common/PageLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';

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
        <div>
          {children}
        </div>
      )}
    </div>
  );
};

// Wallet Page Component
const Wallet: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, balance, withdrawableBalance, pendingWithdrawalAmount } = useAuth();
  const [tabValue, setTabValue] = useState<number>(0);

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  // Handle tab change
  const handleTabChange = (index: number) => {
    setTabValue(index);
  };

  return (
    <PageLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-deep-purple">My Wallet</h1>
          <p className="text-muted-violet mt-2">Manage your funds and transactions</p>
        </div>
        
        {/* Balance Card */}
        <Card 
          variant="accent"
          className="mb-6 relative overflow-hidden"
          title="Account Balance"
          footer={
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-violet">
                {(pendingWithdrawalAmount || 0) > 0 && (
                  <span className="font-medium">
                    Pending Withdrawal: ₹{pendingWithdrawalAmount}
                  </span>
                )}
              </span>
              <Button 
                variant="primary" 
                size="small"
                onClick={() => navigate('/')}
                leftIcon={<i className="fas fa-home"></i>}
              >
                Home
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col">
              <span className="text-muted-violet text-sm mb-1">Total Balance</span>
              <span className="text-3xl font-bold text-deep-purple mb-1">₹{balance || 0}</span>
              <span className="text-sm text-gray-600">Available for wagering in games</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-violet text-sm mb-1">Withdrawable Balance</span>
              <span className="text-3xl font-bold text-soft-pink mb-1">₹{withdrawableBalance || 0}</span>
              <span className="text-sm text-gray-600">Available for withdrawal to your account</span>
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 opacity-5">
            <svg viewBox="0 0 24 24" fill="currentColor" className="text-soft-pink w-full h-full">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"></path>
            </svg>
          </div>
        </Card>
        
        {/* Tabs Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex space-x-1">
            <button
              onClick={() => handleTabChange(0)}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                tabValue === 0 
                  ? 'border-soft-pink text-deep-purple' 
                  : 'border-transparent text-gray-500 hover:text-muted-violet hover:border-muted-violet/30'
              }`}
            >
              <i className="fas fa-plus-circle mr-2"></i>
              Add Money
            </button>
            <button
              onClick={() => handleTabChange(1)}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                tabValue === 1 
                  ? 'border-soft-pink text-deep-purple' 
                  : 'border-transparent text-gray-500 hover:text-muted-violet hover:border-muted-violet/30'
              }`}
            >
              <i className="fas fa-money-bill-wave mr-2"></i>
              Withdraw
            </button>
            <button
              onClick={() => handleTabChange(2)}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                tabValue === 2 
                  ? 'border-soft-pink text-deep-purple' 
                  : 'border-transparent text-gray-500 hover:text-muted-violet hover:border-muted-violet/30'
              }`}
            >
              <i className="fas fa-history mr-2"></i>
              Transactions
            </button>
          </div>
        </div>
        
        {/* Tab Content */}
        <div className="mb-8">
          <TabPanel value={tabValue} index={0}>
            <DepositForm />
          </TabPanel>
          
          <TabPanel value={tabValue} index={1}>
            <WithdrawalForm />
          </TabPanel>
          
          <TabPanel value={tabValue} index={2}>
            <TransactionHistory />
          </TabPanel>
        </div>
        
        {/* Important Information */}
        <Card 
          variant="default"
          title="Important Information"
          titleAction={<i className="fas fa-info-circle text-muted-violet"></i>}
        >
          <div className="space-y-3">
            <div className="flex items-start">
              <i className="fas fa-check-circle text-soft-pink mt-1 mr-3"></i>
              <p className="text-gray-700">Deposits are processed immediately</p>
            </div>
            <div className="flex items-start">
              <i className="fas fa-clock text-muted-violet mt-1 mr-3"></i>
              <p className="text-gray-700">Withdrawals are processed manually within 24 hours</p>
            </div>
            <div className="flex items-start">
              <i className="fas fa-percentage text-soft-lavender mt-1 mr-3"></i>
              <p className="text-gray-700">Platform fee of 20% is charged on the winning amount</p>
            </div>
            <div className="flex items-start">
              <i className="fas fa-headset text-muted-violet mt-1 mr-3"></i>
              <p className="text-gray-700">For any issues with transactions, please contact support</p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 text-sm text-gray-500 text-center">
              Note: This is a simulated payment system for demonstration purposes only.
            </div>
          </div>
        </Card>
      </div>
    </PageLayout>
  );
};

export default Wallet; 
import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { createOrder, verifyPayment, requestWithdrawal, getTransactionHistory } from '../services/transactionService';
import { Transaction } from 'chessTypes';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import WalletNavigation from '../components/wallet/WalletNavigation';
import PageLayout from '../components/common/PageLayout';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const Wallet: React.FC = () => {
  const { userProfile, currentUser } = useContext(AuthContext) || {};
  const [amount, setAmount] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState<number>(0);
  const [upiId, setUpiId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'history'>('deposit');
  const [validation, setValidation] = useState({ amountError: '', upiError: '' });
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    loadTransactions();
  }, [currentUser, navigate]);

  const loadTransactions = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      const transactionData = await getTransactionHistory(currentUser.uid);
      setTransactions(transactionData);
    } catch (error) {
      console.error("Failed to load transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const validateAmount = (value: number): boolean => {
    if (value <= 0) {
      setValidation(prev => ({ ...prev, amountError: 'Amount must be greater than 0' }));
      return false;
    }
    
    if (activeTab === 'withdraw' && value > (userProfile?.realMoneyBalance || 0)) {
      setValidation(prev => ({ ...prev, amountError: 'Amount exceeds your available balance' }));
      return false;
    }

    setValidation(prev => ({ ...prev, amountError: '' }));
    return true;
  };

  const validateUpi = (value: string): boolean => {
    // Simple UPI validation
    const upiRegex = /^[\w.-]+@[\w.-]+$/;
    if (!upiRegex.test(value)) {
      setValidation(prev => ({ ...prev, upiError: 'Invalid UPI ID format' }));
      return false;
    }
    
    setValidation(prev => ({ ...prev, upiError: '' }));
    return true;
  };

  const handleDeposit = async () => {
    if (!validateAmount(amount)) return;

    try {
      setLoading(true);
      
      // Create Razorpay order
      const orderData = await createOrder(amount * 100); // Convert to paise
      
      if (!orderData || !orderData.orderId) {
        throw new Error("Failed to create order");
      }
      
      // Initialize Razorpay
      const options = {
        key: 'rzp_test_KbdfYshEMu83sH', // Replace with your key
        amount: orderData.amount.toString(),
        currency: orderData.currency,
        name: 'Chess Wager',
        description: 'Deposit to Chess Wager Wallet',
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            // Verify the payment
            const result = await verifyPayment({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            });
            
            if (result && result.success) {
              toast.success(`Successfully deposited ₹${amount}`);
              loadTransactions();
            } else {
              toast.error("Payment verification failed");
            }
          } catch (error) {
            console.error("Payment verification failed:", error);
            toast.error("Payment verification failed");
          }
        },
        prefill: {
          name: userProfile?.displayName || '',
          email: currentUser?.email || '',
        },
        theme: {
          color: '#3399cc'
        }
      };
      
      const razorpay = new window.Razorpay(options);
      razorpay.open();
      
    } catch (error) {
      console.error("Deposit failed:", error);
      toast.error("Failed to process deposit");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawal = async () => {
    if (!validateAmount(withdrawalAmount) || !validateUpi(upiId)) return;
    
    try {
      setLoading(true);
      
      const result = await requestWithdrawal(withdrawalAmount, upiId);
      
      if (result && result.success) {
        toast.success("Withdrawal request submitted successfully");
        loadTransactions();
        // Reset form
        setWithdrawalAmount(0);
        setUpiId('');
      } else {
        toast.error("Failed to process withdrawal request");
      }
    } catch (error) {
      console.error("Withdrawal failed:", error);
      toast.error("Failed to process withdrawal");
    } finally {
      setLoading(false);
    }
  };

  const getTransactionStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="badge bg-success">Completed</span>;
      case 'pending':
        return <span className="badge bg-warning">Pending</span>;
      case 'failed':
        return <span className="badge bg-danger">Failed</span>;
      default:
        return <span className="badge bg-secondary">{status}</span>;
    }
  };

  const formatTransactionType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <PageLayout>
      <div className="container mt-4">
        <h2>My Wallet</h2>
        
        <div className="card mb-4">
          <div className="card-body">
            <h5 className="card-title">Balance</h5>
            <div className="row">
              <div className="col-md-6">
                <div className="card bg-light">
                  <div className="card-body">
                    <h6>Real Money Balance</h6>
                    <h3>₹{userProfile?.realMoneyBalance || 0}</h3>
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="card bg-light">
                  <div className="card-body">
                    <h6>Pending Withdrawals</h6>
                    <h3>₹{userProfile?.pendingWithdrawalAmount || 0}</h3>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <WalletNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
        
        {activeTab === 'deposit' && (
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Deposit Funds</h5>
              <div className="mb-3">
                <label htmlFor="depositAmount" className="form-label">Amount (₹)</label>
                <input 
                  type="number" 
                  className={`form-control ${validation.amountError ? 'is-invalid' : ''}`}
                  id="depositAmount" 
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  min="10"
                  step="1"
                />
                {validation.amountError && (
                  <div className="invalid-feedback">{validation.amountError}</div>
                )}
              </div>
              <button 
                className="btn btn-primary" 
                onClick={handleDeposit}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Deposit'}
              </button>
            </div>
          </div>
        )}
        
        {activeTab === 'withdraw' && (
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Withdraw Funds</h5>
              <div className="mb-3">
                <label htmlFor="withdrawalAmount" className="form-label">Amount (₹)</label>
                <input 
                  type="number" 
                  className={`form-control ${validation.amountError ? 'is-invalid' : ''}`}
                  id="withdrawalAmount" 
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(Number(e.target.value))}
                  min="10"
                  max={userProfile?.realMoneyBalance || 0}
                  step="1"
                />
                {validation.amountError && (
                  <div className="invalid-feedback">{validation.amountError}</div>
                )}
              </div>
              <div className="mb-3">
                <label htmlFor="upiId" className="form-label">UPI ID</label>
                <input 
                  type="text" 
                  className={`form-control ${validation.upiError ? 'is-invalid' : ''}`}
                  id="upiId" 
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="example@upi"
                />
                {validation.upiError && (
                  <div className="invalid-feedback">{validation.upiError}</div>
                )}
              </div>
              <button 
                className="btn btn-primary" 
                onClick={handleWithdrawal}
                disabled={loading || !userProfile?.realMoneyBalance || userProfile.realMoneyBalance <= 0}
              >
                {loading ? 'Processing...' : 'Request Withdrawal'}
              </button>
            </div>
          </div>
        )}
        
        {activeTab === 'history' && (
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Transaction History</h5>
              {loading ? (
                <p>Loading transactions...</p>
              ) : transactions.length === 0 ? (
                <p>No transactions found.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((transaction) => (
                        <tr key={transaction.id}>
                          <td>{transaction.timestamp ? format(new Date(transaction.timestamp.toDate()), 'PPP') : 'N/A'}</td>
                          <td>{formatTransactionType(transaction.type)}</td>
                          <td>₹{transaction.amount}</td>
                          <td>{getTransactionStatusBadge(transaction.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default Wallet; 
import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import PageLayout from '../components/common/PageLayout';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Transaction } from 'chessTypes';
import { format } from 'date-fns';

// Extend Transaction type to ensure id is always a string
interface TransactionWithRequiredId extends Omit<Transaction, 'id'> {
  id: string;
}

const AdminDashboard: React.FC = () => {
  const { currentUser, userProfile } = useContext(AuthContext) || {};
  const [transactions, setTransactions] = useState<TransactionWithRequiredId[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<TransactionWithRequiredId[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processingIds, setProcessingIds] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is admin
    if (!currentUser || !userProfile?.isAdmin) {
      navigate('/');
      toast.error('Access denied. Admin privileges required.');
      return;
    }

    loadTransactions();
  }, [currentUser, userProfile, navigate]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      
      // Get all pending withdrawal transactions
      const withdrawalQuery = query(
        collection(db, 'transactions'),
        where('type', '==', 'withdrawal_request'),
        where('status', '==', 'pending'),
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(withdrawalQuery);
      const withdrawalData = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as TransactionWithRequiredId[];
      
      setPendingWithdrawals(withdrawalData);
      
      // Get all transactions for admin view
      const transactionsQuery = query(
        collection(db, 'transactions'),
        orderBy('timestamp', 'desc')
      );
      
      const allTransactionsSnapshot = await getDocs(transactionsQuery);
      const allTransactionsData = allTransactionsSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as TransactionWithRequiredId[];
      
      setTransactions(allTransactionsData);
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error('Failed to load transaction data');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessWithdrawal = async (transactionId: string, approved: boolean) => {
    try {
      setProcessingIds(prev => [...prev, transactionId]);
      
      const processWithdrawalFn = httpsCallable(functions, 'processWithdrawal');
      const result = await processWithdrawalFn({ 
        transactionId, 
        approved,
        adminNotes: approved ? 'Approved by admin' : 'Rejected by admin' 
      });
      
      if (result.data && (result.data as any).success) {
        toast.success(
          approved 
            ? 'Withdrawal approved successfully' 
            : 'Withdrawal rejected successfully'
        );
        loadTransactions();
      } else {
        toast.error('Failed to process withdrawal');
      }
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      toast.error('An error occurred while processing the withdrawal');
    } finally {
      setProcessingIds(prev => prev.filter(id => id !== transactionId));
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
      case 'rejected':
        return <span className="badge bg-danger">Rejected</span>;
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
        <h2>Admin Dashboard</h2>
        
        <div className="card mb-4">
          <div className="card-header bg-primary text-white">
            <h5 className="mb-0">Pending Withdrawals</h5>
          </div>
          <div className="card-body">
            {loading ? (
              <p>Loading withdrawals...</p>
            ) : pendingWithdrawals.length === 0 ? (
              <p>No pending withdrawals found.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>UPI ID</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingWithdrawals.map(transaction => (
                      <tr key={transaction.id}>
                        <td>{transaction.userName || transaction.userId}</td>
                        <td>{transaction.timestamp?.toDate ? format(new Date(transaction.timestamp.toDate()), 'PPP') : 'N/A'}</td>
                        <td>₹{transaction.amount}</td>
                        <td>{transaction.withdrawalDetails?.upiId}</td>
                        <td>
                          <div className="btn-group" role="group">
                            <button 
                              className="btn btn-sm btn-success me-2" 
                              disabled={processingIds.includes(transaction.id)}
                              onClick={() => handleProcessWithdrawal(transaction.id, true)}
                            >
                              {processingIds.includes(transaction.id) ? 'Processing...' : 'Approve'}
                            </button>
                            <button 
                              className="btn btn-sm btn-danger" 
                              disabled={processingIds.includes(transaction.id)}
                              onClick={() => handleProcessWithdrawal(transaction.id, false)}
                            >
                              {processingIds.includes(transaction.id) ? 'Processing...' : 'Reject'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        
        <div className="card">
          <div className="card-header bg-dark text-white">
            <h5 className="mb-0">All Transactions</h5>
          </div>
          <div className="card-body">
            {loading ? (
              <p>Loading transactions...</p>
            ) : transactions.length === 0 ? (
              <p>No transactions found.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(transaction => (
                      <tr key={transaction.id}>
                        <td>{transaction.userName || transaction.userId}</td>
                        <td>{transaction.timestamp?.toDate ? format(new Date(transaction.timestamp.toDate()), 'PPP') : 'N/A'}</td>
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
      </div>
    </PageLayout>
  );
};

export default AdminDashboard; 
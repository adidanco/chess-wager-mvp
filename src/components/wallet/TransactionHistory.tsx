import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getUserTransactions } from '../../services/transactionService';
import { Transaction, TransactionType, TransactionStatus } from 'chessTypes';
import { format } from 'date-fns';
import Card from '../common/Card';
import Button from '../common/Button';

// Helper function to get transaction type label
const getTransactionTypeLabel = (type: TransactionType): string => {
  const labels: Record<TransactionType, string> = {
    deposit: 'Deposit',
    withdrawal_request: 'Withdrawal Request',
    withdrawal_complete: 'Withdrawal',
    wager_debit: 'Game Wager',
    wager_payout: 'Game Winnings',
    platform_fee: 'Platform Fee',
    wager_refund: 'Wager Refund'
  };
  return labels[type] || type;
};

// Helper function to get transaction status color
const getStatusColor = (status: TransactionStatus): string => {
  const colors: Record<TransactionStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

// Helper function to get transaction icon
const getTransactionIcon = (type: TransactionType): string => {
  const icons: Record<TransactionType, string> = {
    deposit: 'fa-money-bill-wave',
    withdrawal_request: 'fa-money-bill-wave-alt',
    withdrawal_complete: 'fa-money-bill-wave-alt',
    wager_debit: 'fa-gamepad',
    wager_payout: 'fa-trophy',
    platform_fee: 'fa-percent',
    wager_refund: 'fa-undo'
  };
  return icons[type] || 'fa-exchange-alt';
};

export const TransactionHistory: React.FC = () => {
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(5);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!currentUser?.uid) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const data = await getUserTransactions(currentUser.uid);
        setTransactions(data);
      } catch (err: any) {
        console.error('Failed to fetch transactions:', err);
        setError('Failed to load transaction history. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTransactions();
  }, [currentUser]);

  // Handle page change
  const handleChangePage = (newPage: number) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (value: number) => {
    setRowsPerPage(value);
    setPage(0);
  };

  // Get sign based on transaction type (+ or -)
  const getAmountSign = (type: TransactionType): string => {
    const creditTypes: TransactionType[] = ['deposit', 'wager_payout', 'wager_refund'];
    const debitTypes: TransactionType[] = ['withdrawal_request', 'withdrawal_complete', 'wager_debit', 'platform_fee'];
    
    if (creditTypes.includes(type)) return '+';
    if (debitTypes.includes(type)) return '-';
    return '';
  };

  // Get transaction description with additional details
  const getTransactionDescription = (transaction: Transaction): string => {
    switch (transaction.type) {
      case 'wager_debit':
        return `Wager for game ${transaction.relatedGameId?.slice(0, 8) || ''}`;
      case 'wager_payout':
        return `Winnings from game ${transaction.relatedGameId?.slice(0, 8) || ''}`;
      case 'wager_refund':
        return `Refund from game ${transaction.relatedGameId?.slice(0, 8) || ''}`;
      case 'withdrawal_request':
        return `Withdrawal to UPI: ${transaction.withdrawalDetails?.upiId || ''}`;
      default:
        return transaction.notes || getTransactionTypeLabel(transaction.type);
    }
  };

  return (
    <Card variant="default" className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-deep-purple">Transaction History</h2>
        <div className="text-sm text-muted-violet">
          <span className="mr-2">Showing</span>
          <select 
            value={rowsPerPage}
            onChange={(e) => handleChangeRowsPerPage(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-soft-pink"
          >
            {[5, 10, 25].map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <span className="ml-2">entries</span>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-soft-pink"></div>
        </div>
      ) : error ? (
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
      ) : transactions.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <i className="fas fa-history text-4xl text-muted-violet/30 mb-4"></i>
          <p className="text-lg text-muted-violet">No transactions yet</p>
          <p className="text-sm text-gray-500 mt-2">Add money or play games to see your transaction history</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-violet uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-violet uppercase tracking-wider">
                    Transaction
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-muted-violet uppercase tracking-wider">
                    Amount
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-muted-violet uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(
                          transaction.timestamp instanceof Date 
                            ? transaction.timestamp 
                            : new Date(transaction.timestamp), 
                          'MMM d, yyyy h:mm a'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-soft-lavender/10 flex items-center justify-center text-muted-violet">
                            <i className={`fas ${getTransactionIcon(transaction.type)}`}></i>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-deep-purple">
                              {getTransactionTypeLabel(transaction.type)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {getTransactionDescription(transaction)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${
                        getAmountSign(transaction.type) === '+' 
                          ? 'text-green-600' 
                          : getAmountSign(transaction.type) === '-' 
                            ? 'text-red-600' 
                            : 'text-gray-900'
                      }`}>
                        {getAmountSign(transaction.type)}₹{transaction.amount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(transaction.status)}`}>
                          {transaction.status}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{page * rowsPerPage + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min((page + 1) * rowsPerPage, transactions.length)}
                  </span>{' '}
                  of <span className="font-medium">{transactions.length}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => handleChangePage(page - 1)}
                    disabled={page === 0}
                    className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                      page === 0 
                        ? 'text-gray-300 cursor-not-allowed' 
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <i className="fas fa-chevron-left text-xs"></i>
                  </button>
                  
                  {Array.from({ length: Math.ceil(transactions.length / rowsPerPage) }).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => handleChangePage(index)}
                      className={`relative inline-flex items-center px-4 py-2 border ${
                        page === index
                          ? 'z-10 bg-soft-pink border-soft-pink text-white'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      } text-sm font-medium`}
                    >
                      {index + 1}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => handleChangePage(page + 1)}
                    disabled={page >= Math.ceil(transactions.length / rowsPerPage) - 1}
                    className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                      page >= Math.ceil(transactions.length / rowsPerPage) - 1
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <i className="fas fa-chevron-right text-xs"></i>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}; 
import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Chip,
  CircularProgress,
  TablePagination,
  Alert
} from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import { getTransactionHistory } from '../../services/transactionService';
import { Transaction, TransactionType, TransactionStatus } from 'chessTypes';
import { format } from 'date-fns';

// Helper function to get transaction type label
const getTransactionTypeLabel = (type: TransactionType): string => {
  const labels: Record<TransactionType, string> = {
    deposit: 'Deposit',
    deposit_initiated: 'Deposit Initiated',
    withdrawal_request: 'Withdrawal Request',
    withdrawal_complete: 'Withdrawal',
    withdrawal_cancelled: 'Withdrawal Cancelled',
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
    pending: 'warning',
    completed: 'success',
    failed: 'error',
    cancelled: 'default',
    rejected: 'error'
  };
  return colors[status] || 'default';
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
        const data = await getTransactionHistory(currentUser.uid);
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
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
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
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Transaction History
      </Typography>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : transactions.length === 0 ? (
        <Typography variant="body1" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
          No transactions yet. Add money or play games to see your transaction history.
        </Typography>
      ) : (
        <>
          <TableContainer>
            <Table sx={{ minWidth: 650 }} aria-label="transaction history table">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="center">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell component="th" scope="row">
                        {format(
                          transaction.timestamp instanceof Date 
                            ? transaction.timestamp 
                            : new Date(transaction.timestamp), 
                          'MMM d, yyyy h:mm a'
                        )}
                      </TableCell>
                      <TableCell>
                        {getTransactionDescription(transaction)}
                      </TableCell>
                      <TableCell align="right" sx={{
                        color: getAmountSign(transaction.type) === '+' 
                          ? 'success.main' 
                          : getAmountSign(transaction.type) === '-' 
                            ? 'error.main' 
                            : 'inherit'
                      }}>
                        {getAmountSign(transaction.type)}₹{transaction.amount}
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={transaction.status} 
                          color={getStatusColor(transaction.status) as any}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={transactions.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </>
      )}
    </Paper>
  );
}; 
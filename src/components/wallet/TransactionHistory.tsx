import React, { useEffect, useState, useContext } from 'react';
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
  TablePagination,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';
import { Transaction, TransactionStatus, TransactionType } from 'chessTypes';
import { getTransactionHistory } from '../../services/transactionService';
import { formatDistanceToNow } from 'date-fns';
import { AuthContext } from '../../context/AuthContext';
import { handleError, ErrorCategory } from '../../utils/errorHandler';

const statusColors: Record<TransactionStatus, string> = {
  pending: 'warning',
  completed: 'success',
  failed: 'error',
  cancelled: 'error',
  rejected: 'error'
};

const typeLabels: Record<TransactionType, string> = {
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

const TransactionHistory: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [indexError, setIndexError] = useState<boolean>(false);
  
  const { currentUser } = useContext(AuthContext) || {};
  
  const loadTransactions = async () => {
    if (!currentUser) {
      setLoading(false);
      setError("You must be logged in to view transactions");
      return;
    }
    
    setLoading(true);
    setError(null);
    setIndexError(false);
    
    try {
      const txns = await getTransactionHistory(currentUser.uid);
      setTransactions(txns);
    } catch (err: any) {
      if (err?.message?.includes('index') || err?.code === 'failed-precondition') {
        setIndexError(true);
      } else {
        handleError(err, "Failed to load transaction history", {
          category: ErrorCategory.DATABASE,
          context: { userId: currentUser.uid }
        });
        setError("Failed to load transactions. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadTransactions();
  }, [currentUser]);
  
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  const formatTimestamp = (timestamp: Date) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      return 'Unknown date';
    }
  };
  
  const formatAmount = (amount: number, type: TransactionType) => {
    // For debits (withdrawals, game wagers), show negative amount
    const isDebit = type === 'withdrawal_request' || 
                   type === 'withdrawal_complete' || 
                   type === 'wager_debit' || 
                   type === 'platform_fee';
    
    const sign = isDebit ? '-' : '+';
    return `${sign} ₹${Math.abs(amount).toFixed(2)}`;
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (indexError) {
    return (
      <Alert severity="warning" sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Database Index Required
        </Typography>
        <Typography variant="body2" gutterBottom>
          The transaction history requires a Firebase index that needs to be created.
        </Typography>
        <Typography variant="body2">
          Please click this link to create the required index:
          <Box component="div" sx={{ mt: 1 }}>
            <a 
              href="https://console.firebase.google.com/project/chess-wager-mvp/firestore/indexes?create_index=Eko4S29sbGVjdGlvbklkEAsSB3VzZXJJZBgBGgp0aW1lc3RhbXAYAhoNbGlhbmRyb2lkMjQ3OA" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                backgroundColor: '#1976d2',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '4px',
                textDecoration: 'none',
                display: 'inline-block'
              }}
            >
              Create Firebase Index
            </a>
          </Box>
        </Typography>
      </Alert>
    );
  }
  
  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }
  
  if (transactions.length === 0) {
    return (
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Transaction History
        </Typography>
        <Typography color="text.secondary">
          You have no transactions yet. Make a deposit to get started!
        </Typography>
      </Paper>
    );
  }
  
  return (
    <Paper elevation={2} sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ p: 2 }}>
        Transaction History
      </Typography>
      
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Notes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>
                    {typeLabels[transaction.type] || transaction.type}
                  </TableCell>
                  <TableCell sx={{ 
                    color: transaction.type === 'deposit' || transaction.type === 'wager_payout' || transaction.type === 'wager_refund'
                      ? 'success.main' 
                      : transaction.type === 'withdrawal_request' || transaction.type === 'withdrawal_complete' || transaction.type === 'wager_debit' || transaction.type === 'platform_fee'
                      ? 'error.main'
                      : 'inherit'
                  }}>
                    {formatAmount(transaction.amount, transaction.type)}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={transaction.status} 
                      color={statusColors[transaction.status] as any}
                      size="small" 
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </TableCell>
                  <TableCell>
                    {transaction.timestamp ? formatTimestamp(transaction.timestamp) : 'Unknown'}
                  </TableCell>
                  <TableCell>{transaction.notes || '-'}</TableCell>
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
    </Paper>
  );
};

export default TransactionHistory; 
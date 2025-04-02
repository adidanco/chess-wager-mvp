import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Button,
  Box,
  Tabs,
  Tab,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import PageLayout from '../components/common/PageLayout';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  updateDoc, 
  serverTimestamp,
  limit,
  getFirestore 
} from 'firebase/firestore';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { Transaction, UserProfile } from 'chessTypes';

// Extend the withdrawal details interface with additional properties
interface EnhancedWithdrawalDetails {
  upiId: string;
  username?: string;
  email?: string;
  processedAt?: any;
  processedBy?: string;
}

// Enhanced transaction type with extended withdrawal details
interface EnhancedTransaction extends Omit<Transaction, 'withdrawalDetails'> {
  withdrawalDetails?: EnhancedWithdrawalDetails;
}

// Interface for admin panel props
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// Admin roles constant
const ADMIN_ROLES = ['admin', 'super_admin'];

// Tab Panel component
const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
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

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, isAuthenticated } = useAuth();
  const [tabValue, setTabValue] = useState<number>(0);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<EnhancedTransaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<EnhancedTransaction[]>([]);
  const [activeUsers, setActiveUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<EnhancedTransaction | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState<boolean>(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState<boolean>(false);
  const [adminNote, setAdminNote] = useState<string>('');
  const db = getFirestore();

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Check if user is admin
  const isAdmin = userProfile?.role && ADMIN_ROLES.includes(userProfile.role);

  // Redirect if not admin or not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (isAuthenticated && !isAdmin) {
      navigate('/');
      toast('You do not have permission to access this page');
      return;
    }

    // Load pending withdrawals if on first tab
    if (tabValue === 0) {
      fetchPendingWithdrawals();
    } else if (tabValue === 1) {
      fetchRecentTransactions();
    } else if (tabValue === 2) {
      fetchActiveUsers();
    }
  }, [isAuthenticated, isAdmin, navigate, tabValue]);

  // Fetch pending withdrawals
  const fetchPendingWithdrawals = async () => {
    setLoading(true);
    try {
      const transactionsRef = collection(db, 'transactions');
      const q = query(
        transactionsRef,
        where('type', '==', 'withdrawal_request'),
        where('status', '==', 'pending'),
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const withdrawals: EnhancedTransaction[] = [];
      
      querySnapshot.forEach((doc) => {
        withdrawals.push({
          id: doc.id,
          ...doc.data() as Omit<EnhancedTransaction, 'id'>
        });
      });
      
      setPendingWithdrawals(withdrawals);
    } catch (error) {
      console.error('Error fetching pending withdrawals:', error);
      toast.error('Failed to load pending withdrawals');
    } finally {
      setLoading(false);
    }
  };

  // Fetch recent transactions
  const fetchRecentTransactions = async () => {
    setLoading(true);
    try {
      const transactionsRef = collection(db, 'transactions');
      const q = query(
        transactionsRef,
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      
      const querySnapshot = await getDocs(q);
      const transactions: EnhancedTransaction[] = [];
      
      querySnapshot.forEach((doc) => {
        transactions.push({
          id: doc.id,
          ...doc.data() as Omit<EnhancedTransaction, 'id'>
        });
      });
      
      setRecentTransactions(transactions);
    } catch (error) {
      console.error('Error fetching recent transactions:', error);
      toast.error('Failed to load recent transactions');
    } finally {
      setLoading(false);
    }
  };

  // Fetch active users
  const fetchActiveUsers = async () => {
    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        orderBy('updatedAt', 'desc'),
        limit(50)
      );
      
      const querySnapshot = await getDocs(q);
      const users: UserProfile[] = [];
      
      querySnapshot.forEach((doc) => {
        users.push({
          id: doc.id,
          ...doc.data() as Omit<UserProfile, 'id'>
        });
      });
      
      setActiveUsers(users);
    } catch (error) {
      console.error('Error fetching active users:', error);
      toast.error('Failed to load active users');
    } finally {
      setLoading(false);
    }
  };

  // Handle approve withdrawal
  const handleApproveWithdrawal = async () => {
    if (!selectedWithdrawal) return;
    
    try {
      const transactionRef = doc(db, 'transactions', selectedWithdrawal.id!);
      const userRef = doc(db, 'users', selectedWithdrawal.userId);
      
      // Create a new transaction for the completed withdrawal
      const completedTransactionRef = doc(collection(db, 'transactions'));
      
      // Update the original transaction
      await updateDoc(transactionRef, {
        status: 'completed',
        notes: `${selectedWithdrawal.notes || ''} | APPROVED by ${currentUser?.email} - ${adminNote}`,
        processedBy: currentUser?.uid,
        processedAt: serverTimestamp()
      });
      
      // Create a completed withdrawal transaction
      await updateDoc(completedTransactionRef, {
        userId: selectedWithdrawal.userId,
        type: 'withdrawal_complete',
        amount: selectedWithdrawal.amount,
        status: 'completed',
        timestamp: serverTimestamp(),
        withdrawalDetails: {
          ...selectedWithdrawal.withdrawalDetails,
          processedAt: serverTimestamp(),
          processedBy: currentUser?.uid
        },
        relatedTransactionId: selectedWithdrawal.id,
        notes: `Withdrawal completed. ${adminNote}`
      });
      
      // Update user's pending withdrawal amount
      await updateDoc(userRef, {
        pendingWithdrawalAmount: 0,
        updatedAt: serverTimestamp()
      });
      
      toast.success('Withdrawal approved successfully');
      setApproveDialogOpen(false);
      setSelectedWithdrawal(null);
      setAdminNote('');
      fetchPendingWithdrawals();
    } catch (error) {
      console.error('Error approving withdrawal:', error);
      toast.error('Failed to approve withdrawal');
    }
  };

  // Handle reject withdrawal
  const handleRejectWithdrawal = async () => {
    if (!selectedWithdrawal) return;
    
    try {
      const transactionRef = doc(db, 'transactions', selectedWithdrawal.id!);
      const userRef = doc(db, 'users', selectedWithdrawal.userId);
      
      // Update the transaction
      await updateDoc(transactionRef, {
        status: 'cancelled',
        notes: `${selectedWithdrawal.notes || ''} | REJECTED by ${currentUser?.email} - ${adminNote}`,
        processedBy: currentUser?.uid,
        processedAt: serverTimestamp()
      });
      
      // Refund the user's balance and clear pending withdrawal
      await updateDoc(userRef, {
        realMoneyBalance: (userProfile?.realMoneyBalance || 0) + selectedWithdrawal.amount,
        pendingWithdrawalAmount: 0,
        updatedAt: serverTimestamp()
      });
      
      toast.success('Withdrawal rejected and funds returned to user');
      setRejectDialogOpen(false);
      setSelectedWithdrawal(null);
      setAdminNote('');
      fetchPendingWithdrawals();
    } catch (error) {
      console.error('Error rejecting withdrawal:', error);
      toast.error('Failed to reject withdrawal');
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  // Get transaction type label
  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'Deposit';
      case 'withdrawal_request':
        return 'Withdrawal Request';
      case 'withdrawal_complete':
        return 'Withdrawal';
      case 'wager_debit':
        return 'Game Wager';
      case 'wager_payout':
        return 'Game Winnings';
      case 'platform_fee':
        return 'Platform Fee';
      case 'wager_refund':
        return 'Wager Refund';
      default:
        return type;
    }
  };

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <PageLayout>
      <Container maxWidth="lg">
        <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
          Admin Dashboard
        </Typography>

        <Paper elevation={3} sx={{ mb: 4 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="fullWidth"
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab label="Pending Withdrawals" />
            <Tab label="Recent Transactions" />
            <Tab label="Active Users" />
          </Tabs>

          {/* Pending Withdrawals Tab */}
          <TabPanel value={tabValue} index={0}>
            <Typography variant="h6" gutterBottom>
              Pending Withdrawal Requests
            </Typography>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : pendingWithdrawals.length === 0 ? (
              <Typography variant="body1" sx={{ p: 2, textAlign: 'center' }}>
                No pending withdrawal requests.
              </Typography>
            ) : (
              <TableContainer>
                <Table sx={{ minWidth: 650 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>User</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>UPI ID</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingWithdrawals.map((withdrawal) => (
                      <TableRow key={withdrawal.id}>
                        <TableCell>
                          {withdrawal.timestamp instanceof Date 
                            ? format(withdrawal.timestamp, 'MMM d, yyyy h:mm a')
                            : withdrawal.timestamp?.toDate 
                              ? format(withdrawal.timestamp.toDate(), 'MMM d, yyyy h:mm a')
                              : 'Unknown date'}
                        </TableCell>
                        <TableCell>
                          <div>{withdrawal.withdrawalDetails?.username || withdrawal.userId}</div>
                          <div style={{ fontSize: '0.8rem', color: 'gray' }}>
                            {withdrawal.withdrawalDetails?.email || ''}
                          </div>
                        </TableCell>
                        <TableCell>₹{withdrawal.amount}</TableCell>
                        <TableCell>{withdrawal.withdrawalDetails?.upiId || 'N/A'}</TableCell>
                        <TableCell>
                          <Chip 
                            label={withdrawal.status} 
                            color={getStatusColor(withdrawal.status) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              onClick={() => {
                                setSelectedWithdrawal(withdrawal);
                                setApproveDialogOpen(true);
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              onClick={() => {
                                setSelectedWithdrawal(withdrawal);
                                setRejectDialogOpen(true);
                              }}
                            >
                              Reject
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

          {/* Recent Transactions Tab */}
          <TabPanel value={tabValue} index={1}>
            <Typography variant="h6" gutterBottom>
              Recent Transactions
            </Typography>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : recentTransactions.length === 0 ? (
              <Typography variant="body1" sx={{ p: 2, textAlign: 'center' }}>
                No transactions found.
              </Typography>
            ) : (
              <TableContainer>
                <Table sx={{ minWidth: 650 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>User ID</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {transaction.timestamp instanceof Date 
                            ? format(transaction.timestamp, 'MMM d, yyyy h:mm a')
                            : transaction.timestamp?.toDate 
                              ? format(transaction.timestamp.toDate(), 'MMM d, yyyy h:mm a')
                              : 'Unknown date'}
                        </TableCell>
                        <TableCell>{transaction.userId}</TableCell>
                        <TableCell>{getTransactionTypeLabel(transaction.type)}</TableCell>
                        <TableCell>₹{transaction.amount}</TableCell>
                        <TableCell>
                          <Chip 
                            label={transaction.status} 
                            color={getStatusColor(transaction.status) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{transaction.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

          {/* Active Users Tab */}
          <TabPanel value={tabValue} index={2}>
            <Typography variant="h6" gutterBottom>
              Active Users
            </Typography>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : activeUsers.length === 0 ? (
              <Typography variant="body1" sx={{ p: 2, textAlign: 'center' }}>
                No active users found.
              </Typography>
            ) : (
              <TableContainer>
                <Table sx={{ minWidth: 650 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Game Balance</TableCell>
                      <TableCell>Real Money Balance</TableCell>
                      <TableCell>Pending Withdrawal</TableCell>
                      <TableCell>ELO Rating</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activeUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.username || 'Unknown'}</TableCell>
                        <TableCell>{user.email || 'No email'}</TableCell>
                        <TableCell>{user.balance || 0}</TableCell>
                        <TableCell>₹{user.realMoneyBalance || 0}</TableCell>
                        <TableCell>
                          {user.pendingWithdrawalAmount ? `₹${user.pendingWithdrawalAmount}` : '-'}
                        </TableCell>
                        <TableCell>{user.stats?.eloRating || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>
        </Paper>
      </Container>

      {/* Approve Withdrawal Dialog */}
      <Dialog
        open={approveDialogOpen}
        onClose={() => setApproveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Withdrawal Approval</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You are about to approve a withdrawal of ₹{selectedWithdrawal?.amount} to UPI ID: {selectedWithdrawal?.withdrawalDetails?.upiId}.
            This action cannot be undone.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Admin Note"
            fullWidth
            variant="outlined"
            value={adminNote}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdminNote(e.target.value)}
            sx={{ mt: 2 }}
            placeholder="Enter confirmation details (e.g., UTR number)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button 
            onClick={handleApproveWithdrawal} 
            color="primary" 
            variant="contained"
            disabled={!adminNote}
          >
            Approve Withdrawal
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Withdrawal Dialog */}
      <Dialog
        open={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Withdrawal Rejection</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You are about to reject the withdrawal request of ₹{selectedWithdrawal?.amount}.
            The funds will be returned to the user's balance.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Reason for Rejection"
            fullWidth
            variant="outlined"
            value={adminNote}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdminNote(e.target.value)}
            sx={{ mt: 2 }}
            placeholder="Enter reason for rejection"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button 
            onClick={handleRejectWithdrawal} 
            color="error" 
            variant="contained"
            disabled={!adminNote}
          >
            Reject Withdrawal
          </Button>
        </DialogActions>
      </Dialog>
    </PageLayout>
  );
};

export default AdminDashboard; 
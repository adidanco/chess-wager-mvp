// Global type definitions for the project

declare module 'chessTypes' {
  // Extend Window interface if needed
  export interface Window {
    // Add any global window properties here
  }

  // Firebase Firestore related types
  export interface FirebaseDoc {
    id: string;
    [key: string]: any;
  }

  // Game related types
  export interface GameData {
    id?: string;
    createdAt?: any; // Firestore Timestamp
    whitePlayer?: string;
    blackPlayer?: string | null;
    currentTurn?: 'w' | 'b';
    fen?: string;
    status?: import('../utils/constants').GameStatus;
    wager?: number;
    timeControl?: number;
    player1Id?: string; // Game creator ID
    player2Id?: string; // Game joiner ID
    moveHistory?: Array<{
      number: number;
      white?: string;
      black?: string;
      timestamp?: string;
    }>;
    winner?: 'w' | 'b' | 'draw' | null;
    whiteTime?: number;
    blackTime?: number;
    lastMoveTime?: {
      toDate: () => Date;
    } | any;
    endTime?: any;
    useRealMoney?: boolean; // Whether this game uses real money or game currency
    wagersDebited?: boolean; // Whether wagers have been debited from players
    payoutProcessed?: boolean; // Whether game payout has been processed
    wagerDebitTimestamp?: any; // When wagers were debited
    payoutTimestamp?: any; // When payout was processed
  }

  // User related types
  export interface UserProfile {
    id?: string;
    displayName?: string;
    email?: string;
    username?: string;
    balance?: number;
    withdrawableBalance?: number; // Added for tracking only the amount that can be withdrawn (from winnings)
    pendingWithdrawalAmount?: number; // Added for tracking withdrawal requests
    photoURL?: string;
    stats?: UserStats;
    eloRating?: number;
    wins?: number;
    losses?: number;
    draws?: number;
    createdAt?: any;
    updatedAt?: any;
    transactions?: Record<string, {
      amount: number;
      reason: string;
      timestamp: any;
    }>;
    emailVerified?: boolean;
    otpVerified?: boolean;
    lastOtpSent?: any;
    withdrawalUpiId?: string; // Added for storing user's preferred UPI ID
    role?: 'user' | 'admin' | 'super_admin'; // User role for permissions
  }

  // Stats related types
  export interface UserStats {
    wins: number;
    losses: number;
    draws: number;
    eloRating: number;
    // Glicko-2 rating components
    ratingDeviation?: number;     // RD - uncertainty in the rating
    volatility?: number;          // Vol - consistency of the player
    lastPlayedTimestamp?: number; // When the player last played a rated game
    eloHistory?: Record<string, number>; // Timestamp to rating mapping
  }

  // Auth context related types
  export interface AuthContextType {
    currentUser: {
      uid: string;
      email?: string | null;
      displayName?: string | null;
      photoURL?: string | null;
      emailVerified?: boolean;
    } | null; // Firebase Auth User
    userProfile: UserProfile | null;
    loading: boolean;
    profileLoading: boolean;
    isAuthenticated: boolean;
    balance: number;
    withdrawableBalance: number; // Amount that can be withdrawn (from winnings)
    pendingWithdrawalAmount?: number; // Added for tracking withdrawals
    username: string;
    stats: UserStats;
    updateProfile: (updates: Partial<UserProfile>) => Promise<boolean>;
    logout: () => Promise<void>;
    updateBalance: (amount: number, reason: string) => Promise<boolean>;
    balanceUpdating: boolean;
    emailVerified: boolean;
  }

  // Transaction related types
  export interface Transaction {
    id?: string;
    userId: string;
    type: TransactionType;
    amount: number;
    status: TransactionStatus;
    timestamp: any; // Firestore Timestamp
    relatedGameId?: string;
    upiTransactionId?: string;
    withdrawalDetails?: {
      upiId: string;
      username?: string;
      email?: string;
      processedAt?: any; // Timestamp when manually processed
      processedBy?: string; // Admin who processed it
    };
    notes?: string;
  }

  export type TransactionType = 
    | 'deposit' 
    | 'withdrawal_request' 
    | 'withdrawal_complete' 
    | 'wager_debit' 
    | 'wager_payout' 
    | 'platform_fee' 
    | 'wager_refund';

  export type TransactionStatus = 
    | 'pending' 
    | 'completed' 
    | 'failed' 
    | 'cancelled';
} 
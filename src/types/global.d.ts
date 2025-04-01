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
    status?: string;
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
  }

  // User related types
  export interface UserProfile {
    id?: string;
    displayName?: string;
    email?: string;
    username?: string;
    balance?: number;
    photoURL?: string;
    stats?: UserStats;
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
  }

  // Stats related types
  export interface UserStats {
    wins: number;
    losses: number;
    draws: number;
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
    username: string;
    stats: UserStats;
    updateProfile: (updates: Partial<UserProfile>) => Promise<boolean>;
    logout: () => Promise<void>;
    updateBalance: (amount: number, reason: string) => Promise<boolean>;
    balanceUpdating: boolean;
  }
} 
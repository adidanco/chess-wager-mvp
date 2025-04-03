import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { auth, db } from '../firebase'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import { 
  doc, 
  getDoc, 
  updateDoc, 
  runTransaction, 
  increment, 
  serverTimestamp, 
  onSnapshot,
  DocumentReference,
  Unsubscribe,
  collection
} from 'firebase/firestore'
import { logger, createLogger } from '../utils/logger'
// Create a component-specific logger
const AuthContextLogger = createLogger('AuthContext');

import toast from 'react-hot-toast'
import { UserProfile, UserStats, AuthContextType } from 'chessTypes'

// Create the auth context
export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [profileLoading, setProfileLoading] = useState<boolean>(false)
  const [balanceUpdating, setBalanceUpdating] = useState<boolean>(false)
  const [unsubscribeProfile, setUnsubscribeProfile] = useState<Unsubscribe | null>(null)

  // Clean up any listeners when unmounting
  useEffect(() => {
    return () => {
      if (unsubscribeProfile) {
        unsubscribeProfile()
      }
    }
  }, [unsubscribeProfile])

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        AuthContextLogger.info('User authenticated', { userId: user.uid })
        setCurrentUser(user)
        // Subscribe to user profile when authenticated
        subscribeToUserProfile(user.uid)
      } else {
        AuthContextLogger.info('User signed out')
        setCurrentUser(null)
        setUserProfile(null)
        
        // Unsubscribe from profile updates when signed out
        if (unsubscribeProfile) {
          unsubscribeProfile()
          setUnsubscribeProfile(null)
        }
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Set up real-time listener for user profile data
  const subscribeToUserProfile = (userId: string): void => {
    setProfileLoading(true)
    
    const userRef = doc(db, "users", userId)
    const unsubscribe = onSnapshot(
      userRef,
      (doc) => {
        if (doc.exists()) {
          const data = {
            ...doc.data(),
            id: doc.id
          } as UserProfile
          setUserProfile(data)
          AuthContextLogger.info('User profile updated', { 
            userId,
            balance: data.balance,
            username: data.username 
          })
        } else {
          AuthContextLogger.error('User document does not exist', { userId })
          toast.error("User profile not found. Please contact support.")
        }
        setProfileLoading(false)
      },
      (error) => {
        AuthContextLogger.error('Error fetching user profile', { error, userId })
        toast.error("Failed to load profile data")
        setProfileLoading(false)
      }
    )
    
    setUnsubscribeProfile(() => unsubscribe)
  }

  // Update user balance safely with transaction
  const updateBalance = async (
    amount: number, 
    reason: string, 
    isWinnings: boolean = false
  ): Promise<boolean> => {
    try {
      if (!currentUser) {
        const errorMessage = 'User must be logged in to update balance';
        logger.error(errorMessage);
        toast.error(errorMessage);
        return false;
      }

      setBalanceUpdating(true);
      
      // Get current data to ensure we have the latest balance
      const userDoc = doc(db, 'users', currentUser.uid);
      
      await runTransaction(db, async (transaction) => {
        const currentDoc = await transaction.get(userDoc);
        
        if (!currentDoc.exists()) {
          throw new Error('User document does not exist');
        }
        
        const userData = currentDoc.data() as UserProfile;
        const currentBalance = userData.realMoneyBalance || 0;
        const currentWithdrawable = userData.withdrawableAmount || 0;
        
        // Calculate new balances, ensure they don't go below 0
        const newBalance = Math.max(0, currentBalance + amount);
        
        // If this is winnings, add to withdrawable amount
        const newWithdrawable = isWinnings 
          ? Math.max(0, currentWithdrawable + amount) 
          : currentWithdrawable;
        
        // Update the user doc with new balance and withdrawable amount
        transaction.update(userDoc, {
          realMoneyBalance: newBalance,
          withdrawableAmount: newWithdrawable,
          updatedAt: serverTimestamp()
        });
        
        // Log the transaction for record-keeping
        const transactionRef = doc(collection(db, 'transactions'));
        transaction.set(transactionRef, {
          userId: currentUser.uid,
          type: amount > 0 
            ? (isWinnings ? 'game_winnings' : 'deposit') 
            : (isWinnings ? 'withdraw_winnings' : 'withdraw'),
          amount: Math.abs(amount),
          status: 'completed',
          timestamp: serverTimestamp(),
          notes: reason
        });
      });
      
      logger.info('Balance updated successfully', { amount, reason, isWinnings });
      
      // No need for toast here; let the calling component handle user feedback
      return true;
    } catch (error) {
      const err = error as Error;
      logger.error('Error updating balance', { error: err });
      toast.error(err.message || 'Error updating balance');
      return false;
    } finally {
      setBalanceUpdating(false);
    }
  };

  // Update user profile data
  const updateProfile = async (updates: Partial<UserProfile>): Promise<boolean> => {
    if (!currentUser) {
      toast.error("You must be logged in to update your profile")
      return false
    }
    
    const userId = currentUser.uid
    AuthContextLogger.info('Updating user profile', { userId, updates })
    
    try {
      const userRef = doc(db, "users", userId)
      await updateDoc(userRef, {
        ...updates,
        updatedAt: serverTimestamp()
      })
      
      AuthContextLogger.info('Profile updated successfully', { userId })
      toast.success("Profile updated successfully")
      return true
    } catch (error) {
      const err = error as Error
      AuthContextLogger.error('Error updating profile', { error: err, userId })
      toast.error("Failed to update profile")
      return false
    }
  }

  // Logout function
  const logout = async (): Promise<void> => {
    AuthContextLogger.info('Attempting sign out')
    try {
      await signOut(auth)
      // Clear local state immediately
      setCurrentUser(null)
      setUserProfile(null)
      if (unsubscribeProfile) {
        unsubscribeProfile()
        setUnsubscribeProfile(null)
      }
      AuthContextLogger.info('Sign out successful')
      toast.success("Logged out successfully")
    } catch (error) {
      const err = error as Error
      AuthContextLogger.error('Sign out failed', { error: err })
      toast.error("Logout failed. Please try again.")
      throw error // Re-throw for potential handling elsewhere
    }
  }

  // Get emailVerified status from both Firebase Auth and Firestore
  const emailVerified = currentUser?.emailVerified || (userProfile?.emailVerified === true)

  const value: AuthContextType = {
    currentUser,
    userProfile,
    loading,
    profileLoading,
    balanceUpdating,
    updateBalance,
    updateProfile,
    logout,
    // Computed properties for convenience
    isAuthenticated: !!currentUser,
    balance: userProfile?.balance || 0,
    realMoneyBalance: userProfile?.realMoneyBalance || 0,
    withdrawableAmount: userProfile?.withdrawableAmount || 0,
    pendingWithdrawalAmount: userProfile?.pendingWithdrawalAmount || 0,
    username: userProfile?.username || 'User',
    // Stats (if available in user profile)
    stats: userProfile?.stats || { wins: 0, losses: 0, draws: 0, eloRating: 1200 },
    // Email verification status - easier for UI to check
    emailVerified: emailVerified || false
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
} 
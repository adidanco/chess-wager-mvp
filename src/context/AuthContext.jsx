import React, { createContext, useContext, useState, useEffect } from 'react'
import { auth, db } from '../firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc, updateDoc, runTransaction, increment, serverTimestamp, onSnapshot } from 'firebase/firestore'
import { logger } from '../utils/logger'
import toast from 'react-hot-toast'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [balanceUpdating, setBalanceUpdating] = useState(false)
  const [unsubscribeProfile, setUnsubscribeProfile] = useState(null)

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
        logger.info('Auth', 'User authenticated', { userId: user.uid })
        setCurrentUser(user)
        // Subscribe to user profile when authenticated
        subscribeToUserProfile(user.uid)
      } else {
        logger.info('Auth', 'User signed out')
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
  const subscribeToUserProfile = (userId) => {
    setProfileLoading(true)
    
    const userRef = doc(db, "users", userId)
    const unsubscribe = onSnapshot(
      userRef,
      (doc) => {
        if (doc.exists()) {
          const data = {
            ...doc.data(),
            id: doc.id
          }
          setUserProfile(data)
          logger.info('Auth', 'User profile updated', { 
            userId,
            balance: data.balance,
            username: data.username 
          })
        } else {
          logger.error('Auth', 'User document does not exist', { userId })
          toast.error("User profile not found. Please contact support.")
        }
        setProfileLoading(false)
      },
      (error) => {
        logger.error('Auth', 'Error fetching user profile', { error, userId })
        toast.error("Failed to load profile data")
        setProfileLoading(false)
      }
    )
    
    setUnsubscribeProfile(() => unsubscribe)
  }

  // Update user balance safely with transaction
  const updateBalance = async (amount, reason = "manual adjustment") => {
    if (!currentUser) {
      logger.error('Auth', 'Cannot update balance: Not authenticated')
      throw new Error("You must be logged in to update balance")
    }
    
    const userId = currentUser.uid
    logger.info('Auth', 'Updating user balance', { userId, amount, reason })
    
    setBalanceUpdating(true)
    
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", userId)
        const userSnap = await transaction.get(userRef)
        
        if (!userSnap.exists()) {
          throw new Error("User not found")
        }
        
        const userData = userSnap.data()
        const newBalance = (userData.balance || 0) + amount
        
        if (newBalance < 0) {
          throw new Error("Insufficient balance")
        }
        
        transaction.update(userRef, {
          balance: newBalance,
          updatedAt: serverTimestamp(),
          [`transactions.${Date.now()}`]: {
            amount,
            reason,
            timestamp: serverTimestamp()
          }
        })
      })
      
      logger.info('Auth', 'Balance updated successfully', { 
        userId, 
        amount, 
        reason 
      })
      
      return true
    } catch (error) {
      logger.error('Auth', 'Error updating balance', { error, userId, amount })
      toast.error(error.message || "Failed to update balance")
      throw error
    } finally {
      setBalanceUpdating(false)
    }
  }

  // Update user profile data
  const updateProfile = async (updates) => {
    if (!currentUser) {
      toast.error("You must be logged in to update your profile")
      return false
    }
    
    const userId = currentUser.uid
    logger.info('Auth', 'Updating user profile', { userId, updates })
    
    try {
      const userRef = doc(db, "users", userId)
      await updateDoc(userRef, {
        ...updates,
        updatedAt: serverTimestamp()
      })
      
      logger.info('Auth', 'Profile updated successfully', { userId })
      toast.success("Profile updated successfully")
      return true
    } catch (error) {
      logger.error('Auth', 'Error updating profile', { error, userId })
      toast.error("Failed to update profile")
      return false
    }
  }

  // Logout function
  const logout = async () => {
    logger.info('Auth', 'Attempting sign out');
    try {
      await signOut(auth);
      // Clear local state immediately
      setCurrentUser(null);
      setUserProfile(null);
      if (unsubscribeProfile) {
        unsubscribeProfile();
        setUnsubscribeProfile(null);
      }
      logger.info('Auth', 'Sign out successful');
      toast.success("Logged out successfully");
    } catch (error) {
      logger.error('Auth', 'Sign out failed', { error });
      toast.error("Logout failed. Please try again.");
      throw error; // Re-throw for potential handling elsewhere
    }
  };

  const value = {
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
    username: userProfile?.username || 'User',
    // Stats (if available in user profile)
    stats: userProfile?.stats || { wins: 0, losses: 0, draws: 0 }
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
} 
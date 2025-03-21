import React, { createContext, useContext, useState, useEffect } from 'react'
import { auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { logger } from '../utils/logger'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        logger.info('Auth', 'User authenticated', { userId: user.uid })
        setUser(user)
      } else {
        logger.info('Auth', 'User signed out')
        setUser(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const value = {
    user,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
} 
import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "react-hot-toast"
import { logger } from "../utils/logger"
import { sendEmailVerification, User } from "firebase/auth"
import { auth, db } from "../firebase"
import { doc, updateDoc } from "firebase/firestore"
import BalanceDisplay from "../components/home/BalanceDisplay"
import GameActions from "../components/home/GameActions"
import LoadingSpinner from "../components/common/LoadingSpinner"
import PageLayout from "../components/common/PageLayout"
import Card from "../components/common/Card"
import Button from "../components/common/Button"
import { useAuth } from "../context/AuthContext"

export default function Home(): JSX.Element {
  const navigate = useNavigate()
  const { 
    currentUser, 
    userProfile, 
    loading, 
    profileLoading, 
    isAuthenticated, 
    balance,
    logout,
    emailVerified
  } = useAuth()
  
  const [verificationSending, setVerificationSending] = useState<boolean>(false)
  const [showVerificationInput, setShowVerificationInput] = useState<boolean>(false)
  const [verificationCode, setVerificationCode] = useState<string>("")
  const [verifying, setVerifying] = useState<boolean>(false)

  // For demo purposes - any 4 digit code will work
  const DEMO_CODE = "1234"

  useEffect(() => {
    if (!isAuthenticated && !loading) {
      logger.warn('Home', 'User not authenticated, redirecting to login')
      navigate("/login")
    }
  }, [isAuthenticated, loading, navigate])

  // Handle resending verification email
  const handleResendVerification = async (): Promise<void> => {
    if (!currentUser) return
    
    setVerificationSending(true)
    try {
      await sendEmailVerification(currentUser as User)
      toast.success(`Verification email sent! For demo, use code: ${DEMO_CODE}`)
      logger.info('Home', 'Verification email sent', { email: currentUser.email })
      setShowVerificationInput(true)
    } catch (error) {
      const err = error as Error
      logger.error('Home', 'Failed to send verification email', { error: err })
      toast.error("Failed to send verification email. Please try again later.")
    } finally {
      setVerificationSending(false)
    }
  }

  // Handle verification code submission
  const handleVerifyEmail = async (): Promise<void> => {
    if (!currentUser || !verificationCode) return
    
    if (verificationCode.length !== 4) {
      toast.error("Please enter a 4-digit verification code")
      return
    }
    
    setVerifying(true)
    try {
      // For demo purposes, we'll accept any 4-digit code
      // In a real app, this would validate against a code sent to the user's email
      
      // Update user document to mark email as verified
      if (currentUser.uid) {
        await updateDoc(doc(db, "users", currentUser.uid), {
          emailVerified: true,
          updatedAt: new Date()
        })
        
        logger.info('Home', 'Email verified in Firestore', { userId: currentUser.uid })
      }
      
      // Force refresh the user to get updated emailVerified status
      await (currentUser as User).reload()
      
      toast.success("Email verified successfully!")
      logger.info('Home', 'Email verified', { userId: currentUser.uid })
      
      // Reset UI state
      setShowVerificationInput(false)
      setVerificationCode("")
      
      // Refresh the page to update the context with the new emailVerified status
      window.location.reload()
    } catch (error) {
      const err = error as Error
      logger.error('Home', 'Email verification failed', { error: err })
      toast.error("Failed to verify email. Please try again.")
    } finally {
      setVerifying(false)
    }
  }

  // Handlers for GameActions component
  const handleChooseGame = (): void => {
    navigate("/categories");
  }

  const handleJoinGame = (): void => {
    navigate("/join-game")
  }

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
    } catch (error) {
      const err = error as Error;
      logger.error('Home', 'Logout failed', { error: err });
    }
  };

  const handleProfile = (): void => {
    navigate("/profile");
  };
  
  const handleSettings = (): void => {
    navigate("/settings");
  };

  // Show loading spinner if auth or profile is loading
  if (loading || profileLoading) {
    return (
      <PageLayout>
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner message="Loading..." />
        </div>
      </PageLayout>
    )
  }

  // Ensure we have a user profile
  if (!userProfile) {
    return (
      <PageLayout>
        <div className="text-center p-4">
          <p className="text-red-600 mb-4">Failed to load user profile.</p>
          <button 
            onClick={() => navigate('/login')} 
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Return to Login
          </button>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <div className="container mx-auto px-4 max-w-md">
        {/* Email verification banner */}
        {!emailVerified && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-grow">
                <p className="text-sm text-yellow-700">
                  Your email is not verified. Verify your email to get full access to all features.
                </p>
                
                {showVerificationInput ? (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-yellow-700 mb-1">
                      Enter verification code
                    </label>
                    <div className="flex">
                      <input
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                        placeholder="4-digit code"
                        className="w-full border border-yellow-300 bg-white rounded-l-md py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        maxLength={4}
                        inputMode="numeric"
                      />
                      <button
                        onClick={handleVerifyEmail}
                        disabled={verifying || verificationCode.length !== 4}
                        className="bg-yellow-400 text-white rounded-r-md py-2 px-4 text-sm font-medium hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50"
                      >
                        {verifying ? "Verifying..." : "Verify"}
                      </button>
                    </div>
                    <p className="text-xs text-yellow-600 mt-1">
                      For demo purposes, any 4-digit code will work
                    </p>
                    <div className="flex justify-between mt-2">
                      <button
                        onClick={() => setShowVerificationInput(false)}
                        className="text-xs text-yellow-700 hover:text-yellow-900"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleResendVerification}
                        disabled={verificationSending}
                        className="text-xs text-yellow-700 hover:text-yellow-900"
                      >
                        Resend code
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2">
                    <button
                      onClick={handleResendVerification}
                      disabled={verificationSending}
                      className="text-sm font-medium text-yellow-700 hover:text-yellow-600 border border-yellow-400 px-3 py-1 rounded-md hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
                    >
                      {verificationSending ? "Sending..." : "Resend Verification Email"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* User welcome card */}
        <Card
          variant="default"
          className="mb-6"
          isHoverable
          onClick={handleProfile}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-deep-purple">Welcome, {userProfile.username}!</h2>
              <p className="text-sm text-muted-violet">Tap to view profile</p>
            </div>
            <div className="flex items-center justify-center w-12 h-12 bg-gray-200 rounded-full overflow-hidden">
              {userProfile.photoURL ? (
                <img src={userProfile.photoURL} alt="Profile" className="w-12 h-12 object-cover" />
              ) : (
                <span className="text-lg font-bold text-gray-600">
                  {userProfile.username?.charAt(0).toUpperCase() || "U"}
                </span>
              )}
            </div>
          </div>
        </Card>
        
        {/* Balance display */}
        <Card
          variant="accent"
          className="mb-6"
          title="Your Balance"
          footer={
            <button 
              onClick={() => navigate('/wallet')} 
              className="text-muted-violet hover:text-deep-purple text-sm font-medium flex items-center justify-center w-full"
            >
              Manage Wallet <i className="fas fa-chevron-right ml-1 text-xs"></i>
            </button>
          }
        >
          <BalanceDisplay balance={balance} />
        </Card>
        
        {/* Game actions */}
        <Card
          variant="primary"
          className="mb-6 overflow-hidden"
          title="Game Options"
          titleAction={<div className="flex items-center"><i className="fas fa-gamepad text-white mr-2"></i><span className="text-white text-xs font-normal bg-white/10 rounded-full px-2 py-0.5">2 Available</span></div>}
          noPadding
        >
          <GameActions
            onCreateGame={handleChooseGame}
            onJoinGame={handleJoinGame}
            onSettings={handleSettings}
            onLogout={handleLogout}
          />
        </Card>
      </div>
    </PageLayout>
  )
} 
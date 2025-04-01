import React, { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "react-hot-toast"
import { logger } from "../utils/logger"
import UserStats from "../components/home/UserStats"
import BalanceDisplay from "../components/home/BalanceDisplay"
import GameActions from "../components/home/GameActions"
import LoadingSpinner from "../components/common/LoadingSpinner"
import PageLayout from "../components/common/PageLayout"
import { useAuth } from "../context/AuthContext"

export default function Home() {
  const navigate = useNavigate()
  const { 
    currentUser, 
    userProfile, 
    loading, 
    profileLoading, 
    isAuthenticated, 
    balance, 
    stats,
    logout
  } = useAuth()

  useEffect(() => {
    if (!isAuthenticated && !loading) {
      logger.warn('Home', 'User not authenticated, redirecting to login')
      navigate("/login")
    }
  }, [isAuthenticated, loading, navigate])

  // Handlers for GameActions component
  const handleCreateGame = () => {
    navigate("/create-game")
  }

  const handleJoinGame = () => {
    navigate("/join-game")
  }

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      logger.error('Home', 'Logout failed', { error });
    }
  };

  // Show loading spinner if auth or profile is loading
  if (loading || profileLoading) {
    return (
      <PageLayout title="Loading...">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </PageLayout>
    )
  }

  // Ensure we have a user profile
  if (!userProfile) {
    return (
      <PageLayout title="Error">
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
    <PageLayout title="Chess Wager">
      <div className="container mx-auto px-4 max-w-md">
        {/* User welcome card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Welcome, {userProfile.username}!</h2>
        </div>
        
        {/* Balance display */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <BalanceDisplay balance={balance} />
        </div>
        
        {/* User stats */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <UserStats stats={stats} />
        </div>
        
        {/* Game action buttons */}
        <div className="mb-6">
          <GameActions 
            onCreateGame={handleCreateGame} 
            onJoinGame={handleJoinGame}
            onLogout={handleLogout}
          />
        </div>
      </div>
    </PageLayout>
  )
}

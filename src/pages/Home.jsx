import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { auth, db } from "../firebase"
import { doc, getDoc, updateDoc, increment } from "firebase/firestore"
import { toast } from "react-hot-toast"
import { logger } from "../utils/logger"

export default function Home() {
  const navigate = useNavigate()
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showDepositOptions, setShowDepositOptions] = useState(false)
  const depositAmounts = [5, 10, 15, 20]

  useEffect(() => {
    if (!auth.currentUser) {
      logger.warn('Home', 'User not authenticated, redirecting to login')
      navigate("/login")
      return
    }

    const fetchUserData = async () => {
      try {
        const userRef = doc(db, "users", auth.currentUser.uid)
        const userSnap = await getDoc(userRef)
        
        if (userSnap.exists()) {
          const data = userSnap.data()
          logger.info('Home', 'User data fetched', {
            userId: auth.currentUser.uid,
            balance: data.balance
          })
          setUserData(data)
        } else {
          logger.error('Home', 'User document not found')
          toast.error("User data not found!")
        }
      } catch (error) {
        logger.error('Home', 'Error fetching user data', { error })
        toast.error("Error loading user data!")
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [navigate])

  const handleDeposit = async (amount) => {
    try {
      const userRef = doc(db, "users", auth.currentUser.uid)
      await updateDoc(userRef, {
        balance: increment(amount)
      })

      // Update local state
      setUserData(prev => ({
        ...prev,
        balance: (prev.balance || 0) + amount
      }))

      logger.info('Home', 'Deposit successful', {
        userId: auth.currentUser.uid,
        amount
      })

      toast.success(`Successfully deposited ₹${amount}`)
      setShowDepositOptions(false)
    } catch (error) {
      logger.error('Home', 'Error processing deposit', { error })
      toast.error("Error processing deposit!")
    }
  }

  const handleLogout = async () => {
    try {
      await auth.signOut()
      logger.info('Home', 'User logged out')
      navigate("/login")
    } catch (error) {
      logger.error('Home', 'Error signing out', { error })
      toast.error("Error signing out!")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
          <div className="bg-white p-8 rounded-lg shadow-md w-96">
            <h2 className="text-2xl font-bold mb-6 text-center">Welcome, {userData?.username || 'Player'}!</h2>
            
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Your Stats</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-green-500 font-bold">{userData?.gamesWon || 0}</div>
                  <div className="text-sm text-gray-500">Wins</div>
                </div>
                <div>
                  <div className="text-red-500 font-bold">{(userData?.gamesPlayed || 0) - (userData?.gamesWon || 0)}</div>
                  <div className="text-sm text-gray-500">Losses</div>
                </div>
                <div>
                  <div className="text-blue-500 font-bold">{userData?.draws || 0}</div>
                  <div className="text-sm text-gray-500">Draws</div>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-2">Balance</h3>
              <div className="text-2xl text-green-600 font-bold">₹{userData?.balance?.toFixed(2) || '0.00'}</div>
              <div className="relative">
                <button
                  onClick={() => setShowDepositOptions(!showDepositOptions)}
                  className="mt-2 w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  Deposit
                </button>
                {showDepositOptions && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10">
                    {depositAmounts.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => handleDeposit(amount)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:outline-none"
                      >
                        ₹{amount}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => navigate("/create-game")}
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Create New Game
              </button>
              <button
                onClick={() => navigate("/join-game")}
                className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                Join Game
              </button>
              <button
                onClick={handleLogout}
                className="w-full bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Logout
              </button>
            </div>
            <div className="mt-6 text-center">
              <div className="text-pink-500 font-bold text-xl bg-white/80 px-3 py-1 rounded-full shadow-sm inline-block">Boo Boo ❤️</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

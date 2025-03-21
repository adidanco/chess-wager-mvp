import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { auth, db } from "../firebase"
import { doc, getDoc } from "firebase/firestore"
import toast from "react-hot-toast"
import { logger } from "../utils/logger"

export default function Home() {
  const navigate = useNavigate()
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth.currentUser) {
      logger.warn('Home', 'User not authenticated, redirecting to login')
      navigate("/login")
      return
    }

    logger.info('Home', 'Initializing home component', { 
      userId: auth.currentUser.uid 
    })

    // Fetch user data
    const userRef = doc(db, "users", auth.currentUser.uid)
    getDoc(userRef)
      .then((doc) => {
        if (doc.exists()) {
          const data = doc.data()
          logger.debug('Home', 'User data fetched', { 
            userId: auth.currentUser.uid,
            username: data.username,
            balance: data.balance,
            stats: data.stats
          })
          setUserData(data)
        } else {
          logger.error('Home', 'User document not found', { 
            userId: auth.currentUser.uid 
          })
          toast.error("User data not found!")
        }
      })
      .catch((error) => {
        logger.error('Home', 'Error fetching user data', { 
          error, 
          userId: auth.currentUser.uid 
        })
        toast.error("Error fetching user data!")
      })
      .finally(() => {
        setLoading(false)
      })
  }, [navigate])

  const handleLogout = async () => {
    logger.info('Home', 'Attempting logout', { 
      userId: auth.currentUser.uid 
    })
    try {
      await auth.signOut()
      logger.info('Home', 'Logout successful')
      navigate("/login")
    } catch (error) {
      logger.error('Home', 'Logout failed', { 
        error, 
        userId: auth.currentUser.uid 
      })
      toast.error("Error logging out!")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">Welcome, {userData?.username || 'Player'}!</h2>
        
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Your Stats</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Wins</p>
              <p className="text-xl font-bold text-green-600">{userData?.stats?.wins || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Losses</p>
              <p className="text-xl font-bold text-red-600">{userData?.stats?.losses || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Draws</p>
              <p className="text-xl font-bold text-blue-600">{userData?.stats?.draws || 0}</p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Balance</h3>
          <p className="text-2xl font-bold text-green-600">${userData?.balance?.toFixed(2) || '0.00'}</p>
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
      </div>
    </div>
  )
}

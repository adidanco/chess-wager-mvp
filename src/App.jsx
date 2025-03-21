import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import ErrorBoundary from "./components/ErrorBoundary"
import { GameProvider } from "./context/GameContext"
import { networkHandler } from "./utils/networkHandler"
import { logger } from "./utils/logger"
import { auth } from "./firebase"
import { onAuthStateChanged } from "firebase/auth"
import { useEffect } from "react"

// Pages
import Home from "./pages/Home"
import Login from "./pages/Login"
import SignUp from "./pages/SignUp"
import Game from "./pages/Game"
import CreateGame from "./pages/CreateGame"
import JoinGame from "./pages/JoinGame"
import AvailableGames from "./pages/AvailableGames"

// Wrap Firestore operations with network check
const withNetworkCheck = async (operation) => {
  if (!networkHandler.isConnected()) {
    logger.error('App', 'No network connection')
    throw new Error('No network connection')
  }
  return operation()
}

// Log app initialization
logger.info('App', 'Initializing application')

function App() {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        logger.info('App', 'User authenticated', { userId: user.uid })
      } else {
        logger.info('App', 'User signed out')
      }
    })

    return () => unsubscribe()
  }, [])

  return (
    <ErrorBoundary>
      <GameProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-gray-100">
            <Toaster position="top-center" />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/game/:id" element={<Game />} />
              <Route path="/create-game" element={<CreateGame />} />
              <Route path="/join-game" element={<JoinGame />} />
              <Route path="/available-games" element={<AvailableGames />} />
            </Routes>
          </div>
        </BrowserRouter>
      </GameProvider>
    </ErrorBoundary>
  )
}

export default App

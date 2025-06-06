import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import ErrorBoundary from "./components/ErrorBoundary"
import { GameProvider } from "./context/GameContext"
import { AuthProvider } from "./context/AuthContext"
import { networkHandler } from "./utils/networkHandler"
import { logger } from "./utils/logger"

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
  return (
    <ErrorBoundary>
      <AuthProvider>
        <GameProvider>
          <BrowserRouter>
            <div className="min-h-screen bg-gray-100">
              <Toaster position="top-center" />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/game/:gameId" element={<Game />} />
                <Route path="/create-game" element={<CreateGame />} />
                <Route path="/join-game" element={<JoinGame />} />
                <Route path="/available-games" element={<AvailableGames />} />
              </Routes>
            </div>
          </BrowserRouter>
        </GameProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App

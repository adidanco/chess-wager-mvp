import React from 'react';
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
import Profile from "./pages/Profile"
import Settings from "./pages/Settings"
import ForgotPassword from "./pages/ForgotPassword"
import Wallet from "./pages/Wallet"
import AdminDashboard from "./pages/AdminDashboard"
import ContactUs from "./pages/ContactUs"
import TermsAndConditions from "./pages/TermsAndConditions"
import TestConstants from "./test-constants"

// Wrap Firestore operations with network check
const withNetworkCheck = async <T,>(operation: () => Promise<T>): Promise<T> => {
  if (!networkHandler.isConnected()) {
    logger.error('App', 'No network connection')
    throw new Error('No network connection')
  }
  return operation()
}

// Log app initialization
logger.info('App', 'Initializing application')

function App(): JSX.Element {
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
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/game/:gameId" element={<Game />} />
                <Route path="/create-game" element={<CreateGame />} />
                <Route path="/join-game" element={<JoinGame />} />
                <Route path="/available-games" element={<AvailableGames />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/wallet" element={<Wallet />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/ContactUs" element={<ContactUs />} />
                <Route path="/TermsAndConditions" element={<TermsAndConditions />} />
                <Route path="/test-constants" element={<TestConstants />} />
              </Routes>
            </div>
          </BrowserRouter>
        </GameProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App 
import React from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import ErrorBoundary from "./components/ErrorBoundary"
import { GameProvider } from "./context/GameContext"
import { AuthProvider } from "./context/AuthContext"
import { ThemeProvider } from "./context/ThemeContext"
import { AppStateProvider, useAppState } from "./context/AppStateContext"
import { networkHandler } from "./utils/networkHandler"
import { logger } from "./utils/logger"

// Components
import SplashScreen from "./components/common/SplashScreen"
import Onboarding from "./components/common/Onboarding"
import onboardingSlides from "./constants/onboardingConfig"
import CardShowcase from "./components/ui/CardShowcase"

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
import TestConstants from "./test-constants"
import TermsAndConditions from "./pages/TermsAndConditions"
import ContactUs from "./pages/ContactUs"
import ChooseGame from "./pages/ChooseGame"
import CreateRangvaarGame from "./pages/CreateRangvaarGame"
import CreateScambodiaGame from "./pages/CreateScambodiaGame"
import ComingSoon from "./pages/ComingSoon"
import RangvaarLobby from "./pages/RangvaarLobby"
import RangvaarGame from "./pages/RangvaarGame"
import DesignSystem from "./pages/DesignSystem"

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

// Force show splash screen & onboarding in development mode
// Set this to true to always show splash screen and onboarding
const FORCE_SHOW_ONBOARDING = false;

// Reset localStorage on initial load to force splash screen and onboarding to show
// This is for development purposes only - uncomment if needed for testing
/*
if (typeof window !== 'undefined') {
  localStorage.removeItem('hasSeenSplashScreen');
  localStorage.removeItem('hasCompletedOnboarding');
}
*/

// AppContent component - needed to use hooks inside the App's render tree
const AppContent = () => {
  const { 
    showSplashScreen, 
    showOnboarding, 
    completeSplashScreen, 
    completeOnboarding,
    resetAppState 
  } = useAppState();
  
  // For development and testing - add a reset button during development
  const isDev = process.env.NODE_ENV === 'development';
  
  // Show splash screen if needed
  if (showSplashScreen) {
    return (
      <>
        <SplashScreen onComplete={completeSplashScreen} />
        {isDev && (
          <button 
            onClick={resetAppState}
            className="fixed bottom-4 right-4 bg-deep-purple text-white p-2 rounded-full z-50 text-xs"
          >
            Reset App State
          </button>
        )}
      </>
    );
  }
  
  // Show onboarding if needed
  if (showOnboarding) {
    return (
      <>
        <Onboarding slides={onboardingSlides} onComplete={completeOnboarding} />
        {isDev && (
          <button 
            onClick={resetAppState}
            className="fixed bottom-4 right-4 bg-deep-purple text-white p-2 rounded-full z-50 text-xs"
          >
            Reset App State
          </button>
        )}
      </>
    );
  }
  
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-off-white">
        <Toaster 
          position="top-center"
          toastOptions={{
            style: {
              background: '#FEF3FF',
              color: '#231942',
              border: '1px solid #E0B1CB'
            }
          }} 
        />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/choose-game" element={<ChooseGame />} />
          <Route path="/game/:gameId" element={<Game />} />
          <Route path="/create-game" element={<CreateGame />} />
          <Route path="/create-rangvaar-game" element={<CreateRangvaarGame />} />
          <Route path="/game/rangvaar/:gameId" element={<RangvaarLobby />} />
          <Route path="/game/rangvaar/play/:gameId" element={<RangvaarGame />} />
          <Route path="/create-scambodia-game" element={<CreateScambodiaGame />} />
          <Route path="/coming-soon" element={<ComingSoon />} />
          <Route path="/join-game" element={<JoinGame />} />
          <Route path="/available-games" element={<AvailableGames />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/test-constants" element={<TestConstants />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
          <Route path="/contact-us" element={<ContactUs />} />
          <Route path="/design/cards" element={<CardShowcase />} />
          <Route path="/design-system" element={<DesignSystem />} />
        </Routes>
        {isDev && (
          <button 
            onClick={resetAppState}
            className="fixed bottom-4 right-4 bg-deep-purple text-white p-2 rounded-full z-50 text-xs"
          >
            Reset App State
          </button>
        )}
      </div>
    </BrowserRouter>
  );
};

function App(): JSX.Element {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppStateProvider forceShowOnboarding={FORCE_SHOW_ONBOARDING}>
          <AuthProvider>
            <GameProvider>
              <AppContent />
            </GameProvider>
          </AuthProvider>
        </AppStateProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App 
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define the type for app state
interface AppState {
  hasSeenSplashScreen: boolean;
  hasCompletedOnboarding: boolean;
  showSplashScreen: boolean;
  showOnboarding: boolean;
}

// Define the context type
interface AppStateContextType extends AppState {
  completeSplashScreen: () => void;
  completeOnboarding: () => void;
  resetAppState: () => void; // Add function to reset app state for testing
}

// Create context with default values
const AppStateContext = createContext<AppStateContextType>({
  hasSeenSplashScreen: false,
  hasCompletedOnboarding: false,
  showSplashScreen: true,
  showOnboarding: false,
  completeSplashScreen: () => {},
  completeOnboarding: () => {},
  resetAppState: () => {}
});

// Provider component
interface AppStateProviderProps {
  children: ReactNode;
  forceShowOnboarding?: boolean; // For development purposes
}

export const AppStateProvider: React.FC<AppStateProviderProps> = ({ 
  children,
  forceShowOnboarding = false 
}) => {
  // Initialize state from localStorage if available
  const [hasSeenSplashScreen, setHasSeenSplashScreen] = useState<boolean>(() => {
    // In development mode, you might want to force reset these values for testing
    // const isDevelopment = process.env.NODE_ENV === 'development';
    // if (isDevelopment) return false;
    
    const saved = localStorage.getItem('hasSeenSplashScreen');
    return saved ? JSON.parse(saved) : false;
  });

  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(() => {
    // In development mode, you might want to force reset these values for testing
    // const isDevelopment = process.env.NODE_ENV === 'development';
    // if (isDevelopment) return false;
    
    const saved = localStorage.getItem('hasCompletedOnboarding');
    const parsed = saved ? JSON.parse(saved) : false;
    return forceShowOnboarding ? false : parsed;
  });

  // Derived state
  const [showSplashScreen, setShowSplashScreen] = useState<boolean>(!hasSeenSplashScreen);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(forceShowOnboarding || (!hasCompletedOnboarding && hasSeenSplashScreen));

  // Effect to handle transitions
  useEffect(() => {
    if (!hasSeenSplashScreen) {
      setShowSplashScreen(true);
    } else if (!hasCompletedOnboarding || forceShowOnboarding) {
      setShowOnboarding(true);
    }
  }, [hasSeenSplashScreen, hasCompletedOnboarding, forceShowOnboarding]);

  // Handlers
  const completeSplashScreen = () => {
    setHasSeenSplashScreen(true);
    setShowSplashScreen(false);
    localStorage.setItem('hasSeenSplashScreen', 'true');
    
    // Show onboarding if it hasn't been completed
    if (!hasCompletedOnboarding || forceShowOnboarding) {
      setShowOnboarding(true);
    }
  };

  const completeOnboarding = () => {
    setHasCompletedOnboarding(true);
    setShowOnboarding(false);
    localStorage.setItem('hasCompletedOnboarding', 'true');
  };
  
  // Reset app state (useful for testing)
  const resetAppState = () => {
    localStorage.removeItem('hasSeenSplashScreen');
    localStorage.removeItem('hasCompletedOnboarding');
    setHasSeenSplashScreen(false);
    setHasCompletedOnboarding(false);
    setShowSplashScreen(true);
    setShowOnboarding(false);
  };

  // Value object for context
  const value = {
    hasSeenSplashScreen,
    hasCompletedOnboarding,
    showSplashScreen,
    showOnboarding,
    completeSplashScreen,
    completeOnboarding,
    resetAppState
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
};

// Custom hook for using app state
export const useAppState = (): AppStateContextType => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}; 
import React, { createContext, useContext, ReactNode } from 'react';

// Define the color theme for Gam(e)Bit
export const themeColors = {
  deepPurple: '#231942',
  softPink: '#E0B1CB',
  mutedViolet: '#5E548E',
  softLavender: '#9F86C0',
  offWhite: '#FEF3FF',
  
  // Add current theme colors for backward compatibility
  primary: '#10b981', // emerald-600
  primaryDark: '#065f46', // emerald-800
  secondary: '#0ea5e9', // sky-500
  accent: '#8b5cf6', // violet-500
  background: '#f3f4f6', // gray-100
  textPrimary: '#111827', // gray-900
  textSecondary: '#4b5563', // gray-600
};

// Define the theme context type
interface ThemeContextType {
  colors: typeof themeColors;
}

// Create the context with default values
const ThemeContext = createContext<ThemeContextType>({
  colors: themeColors
});

// Provider component
interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // The value state could be expanded later to support dynamic theme switching
  const value = {
    colors: themeColors
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook for using the theme
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 
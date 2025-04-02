import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { AuthContextType } from 'chessTypes';

// This hook can be removed since it's exported directly from AuthContext.tsx
// We're keeping it only for backward compatibility
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
} 
import React from "react";

/**
 * Props interface for LoadingSpinner component
 */
interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
}

/**
 * Common loading spinner component with Gam(e)Bit styling
 */
const LoadingSpinner = ({ 
  message = "Loading...",
  size = 'medium',
  fullScreen = false
}: LoadingSpinnerProps): JSX.Element => {
  const sizeClasses = {
    small: "h-6 w-6 border-2",
    medium: "h-12 w-12 border-2",
    large: "h-20 w-20 border-3"
  };
  
  const textSizeClasses = {
    small: "text-sm",
    medium: "text-lg",
    large: "text-xl"
  };

  const containerClasses = fullScreen 
    ? "flex flex-col items-center justify-center min-h-screen bg-off-white"
    : "flex flex-col items-center justify-center py-8";

  return (
    <div className={containerClasses}>
      <div className={`animate-spin rounded-full ${sizeClasses[size]} border-b-soft-pink border-r-soft-lavender border-t-muted-violet border-l-deep-purple`}></div>
      <p className={`${textSizeClasses[size]} mt-4 text-deep-purple font-medium`}>{message}</p>
    </div>
  );
};

export default LoadingSpinner; 
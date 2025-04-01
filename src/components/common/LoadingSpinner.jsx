import React from "react";

/**
 * Common loading spinner component for consistent loading UI
 */
const LoadingSpinner = ({ message = "Loading..." }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
      <p className="text-lg">{message}</p>
    </div>
  );
};

export default LoadingSpinner; 
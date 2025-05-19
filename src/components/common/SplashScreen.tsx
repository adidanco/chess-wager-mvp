import React, { useEffect, useState } from 'react';
import gamebitLogo from '../../assets/GamEBit.png';

interface SplashScreenProps {
  onComplete: () => void;
  minDisplayTime?: number;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ 
  onComplete, 
  minDisplayTime = 2000 // 2 seconds minimum display time 
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      
      // Add a short delay for the fade out animation
      setTimeout(() => {
        setIsVisible(false);
        onComplete();
      }, 500);
    }, minDisplayTime);

    // Clean up timer
    return () => {
      clearTimeout(timer);
    };
  }, [minDisplayTime, onComplete]);

  if (!isVisible) return null;

  return (
    <div className={`fixed inset-0 flex flex-col items-center justify-center bg-deep-purple transition-opacity duration-500 z-50 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
      {/* Logo Animation */}
      <div className="relative w-64 h-64 flex items-center justify-center">
        {/* Animated circles around the logo */}
        <div className="absolute w-56 h-56 rounded-full border-4 border-soft-pink opacity-20 animate-pulse"></div>
        <div className="absolute w-48 h-48 rounded-full border-4 border-soft-lavender opacity-30 animate-ping" style={{ animationDuration: '3s' }}></div>
        
        {/* Logo with subtle hover animation */}
        <div className="w-40 h-40 relative animate-pulse">
          <img 
            src={gamebitLogo} 
            alt="Gam(e)Bit" 
            className="w-full h-full object-contain"
          />
        </div>
      </div>
      
      {/* Text with animation */}
      <div className="mt-8 text-center transform transition-all duration-1000 ease-out">
        <h1 className="text-3xl font-bold text-white mb-2 font-poppins">Gam(e)Bit</h1>
        <p className="text-soft-pink text-lg tracking-wide">Your gateway to skill-based gaming</p>
      </div>
      
      {/* Loading indicator */}
      <div className="mt-16 flex space-x-2">
        <div className="w-3 h-3 rounded-full bg-soft-pink animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-3 h-3 rounded-full bg-soft-lavender animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-3 h-3 rounded-full bg-muted-violet animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      {/* Add a hidden button for E2E to skip splash */}
      <button data-cy="splash-complete" style={{ display: 'none' }} onClick={onComplete}>Skip Splash (E2E)</button>
    </div>
  );
};

export default SplashScreen; 
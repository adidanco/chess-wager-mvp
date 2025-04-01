import { useState, useRef, useEffect, useCallback } from "react";
import { CLOCK_UPDATE_FREQUENCY } from "../utils/constants";
import { PlayerColor } from "../utils/constants";

/**
 * Type for the return value of the hook
 */
interface ChessClockHook {
  whiteTime: number;
  blackTime: number;
  stopClock: () => void;
  startClockForActiveSide: (activeSide: PlayerColor, onTimeUp?: (winner: PlayerColor) => void) => void;
  setTimes: (newWhiteTime: number, newBlackTime: number) => void;
}

/**
 * Custom hook to manage chess clock logic
 */
const useChessClock = (initialWhiteTime: number, initialBlackTime: number): ChessClockHook => {
  const [whiteTime, setWhiteTime] = useState<number>(initialWhiteTime);
  const [blackTime, setBlackTime] = useState<number>(initialBlackTime);
  const clockIntervalRef = useRef<number | null>(null);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
    };
  }, []);

  // Stable stopClock function
  const stopClock = useCallback((): void => {
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
  }, []); // No dependencies needed as it only uses the stable ref

  // Stable startClockForActiveSide function
  const startClockForActiveSide = useCallback((
    activeSide: PlayerColor, 
    onTimeUp?: (winner: PlayerColor) => void
  ): void => {
    stopClock(); // Call the stable stopClock
    let lastTick = Date.now();

    clockIntervalRef.current = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastTick;
      lastTick = now;

      if (activeSide === "w") {
        setWhiteTime((prev) => {
          const nextVal = Math.max(0, prev - elapsed);
          if (nextVal <= 0) {
            stopClock(); // Call stable stopClock
            onTimeUp && onTimeUp("b"); // If white hits 0, black wins
            return 0;
          }
          return nextVal;
        });
      } else {
        setBlackTime((prev) => {
          const nextVal = Math.max(0, prev - elapsed);
          if (nextVal <= 0) {
            stopClock(); // Call stable stopClock
            onTimeUp && onTimeUp("w"); // If black hits 0, white wins
            return 0;
          }
          return nextVal;
        });
      }
    }, CLOCK_UPDATE_FREQUENCY);
    // Dependencies: stopClock is stable. onTimeUp might change if passed directly from
    // useChessGame's props, but we handle that stability in useChessGame's useCallback for handleTimeUp.
    // State setters (setWhiteTime, setBlackTime) are stable.
  }, [stopClock]); // Dependency on the stable stopClock

  // Stable setTimes function
  const setTimes = useCallback((newWhiteTime: number, newBlackTime: number): void => {
    setWhiteTime(newWhiteTime);
    setBlackTime(newBlackTime);
  }, []); // State setters are stable, no dependencies needed

  return {
    whiteTime,
    blackTime,
    stopClock,
    startClockForActiveSide,
    setTimes,
  };
};

export default useChessClock; 
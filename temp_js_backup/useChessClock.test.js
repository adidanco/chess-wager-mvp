import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useChessClock from './useChessClock';
import { DEFAULT_TIMER, CLOCK_UPDATE_FREQUENCY } from '../utils/constants';

describe('useChessClock Hook', () => {
  beforeEach(() => {
    // Tell Vitest to use mocked timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore real timers
    vi.restoreAllMocks();
  });

  it('should initialize with default times', () => {
    const { result } = renderHook(() => useChessClock(DEFAULT_TIMER, DEFAULT_TIMER));

    expect(result.current.whiteTime).toBe(DEFAULT_TIMER);
    expect(result.current.blackTime).toBe(DEFAULT_TIMER);
  });

  it('should decrease white time when white\'s clock is running', () => {
    const { result } = renderHook(() => useChessClock(5000, 5000));

    // Start clock for white
    act(() => {
      result.current.startClockForActiveSide('w');
    });

    // Advance time by slightly more than one interval
    act(() => {
      vi.advanceTimersByTime(CLOCK_UPDATE_FREQUENCY + 50);
    });

    // Check if white's time has decreased (allow for slight timing variations)
    expect(result.current.whiteTime).toBeLessThan(5000);
    expect(result.current.whiteTime).toBeGreaterThan(5000 - CLOCK_UPDATE_FREQUENCY * 2); // Allow for slight timing variance
    expect(result.current.blackTime).toBe(5000); // Black's time should not change
  });

  it('should decrease black time when black\'s clock is running', () => {
    const { result } = renderHook(() => useChessClock(5000, 5000));

    // Start clock for black
    act(() => {
      result.current.startClockForActiveSide('b');
    });

    // Advance time
    act(() => {
      vi.advanceTimersByTime(CLOCK_UPDATE_FREQUENCY + 50);
    });

    // Check if black's time has decreased
    expect(result.current.blackTime).toBeLessThan(5000);
    expect(result.current.blackTime).toBeGreaterThan(5000 - CLOCK_UPDATE_FREQUENCY * 2);
    expect(result.current.whiteTime).toBe(5000); // White's time should not change
  });

  it('should stop the clock when stopClock is called', () => {
    const { result } = renderHook(() => useChessClock(5000, 5000));

    // Start clock for white
    act(() => {
      result.current.startClockForActiveSide('w');
    });

    // Advance time slightly
    act(() => {
      vi.advanceTimersByTime(CLOCK_UPDATE_FREQUENCY / 2);
    });
    const timeBeforeStop = result.current.whiteTime;

    // Stop the clock
    act(() => {
      result.current.stopClock();
    });

    // Advance time significantly more
    act(() => {
      vi.advanceTimersByTime(CLOCK_UPDATE_FREQUENCY * 5);
    });

    // Time should not have changed after stopping
    expect(result.current.whiteTime).toBe(timeBeforeStop);
  });

  it('should switch running clock when startClockForActiveSide is called for the other side', () => {
    const { result } = renderHook(() => useChessClock(5000, 5000));

    // Start for white
    act(() => {
      result.current.startClockForActiveSide('w');
    });
    act(() => { vi.advanceTimersByTime(CLOCK_UPDATE_FREQUENCY + 50); });
    const whiteTimeAfterW = result.current.whiteTime;
    const blackTimeAfterW = result.current.blackTime;
    expect(whiteTimeAfterW).toBeLessThan(5000);
    expect(blackTimeAfterW).toBe(5000);

    // Start for black
    act(() => {
      result.current.startClockForActiveSide('b');
    });
    act(() => { vi.advanceTimersByTime(CLOCK_UPDATE_FREQUENCY + 50); });
    const whiteTimeAfterB = result.current.whiteTime;
    const blackTimeAfterB = result.current.blackTime;

    // White time should be unchanged from before, black time should decrease
    expect(whiteTimeAfterB).toBe(whiteTimeAfterW);
    expect(blackTimeAfterB).toBeLessThan(blackTimeAfterW);
  });

  it('should call onTimeUp with correct winner when white time runs out', () => {
    const handleTimeUp = vi.fn();
    const startTime = 100; // Very short time
    const { result } = renderHook(() => useChessClock(startTime, 5000));

    // Start clock for white
    act(() => {
      result.current.startClockForActiveSide('w', handleTimeUp);
    });

    // Advance time past white's limit
    act(() => {
      vi.advanceTimersByTime(startTime + CLOCK_UPDATE_FREQUENCY + 50);
    });

    expect(handleTimeUp).toHaveBeenCalledTimes(1);
    expect(handleTimeUp).toHaveBeenCalledWith('b'); // Black wins if white runs out
    expect(result.current.whiteTime).toBe(0);
  });

  it('should call onTimeUp with correct winner when black time runs out', () => {
    const handleTimeUp = vi.fn();
    const startTime = 100;
    const { result } = renderHook(() => useChessClock(5000, startTime));

    // Start clock for black
    act(() => {
      result.current.startClockForActiveSide('b', handleTimeUp);
    });

    // Advance time past black's limit
    act(() => {
      vi.advanceTimersByTime(startTime + CLOCK_UPDATE_FREQUENCY + 50);
    });

    expect(handleTimeUp).toHaveBeenCalledTimes(1);
    expect(handleTimeUp).toHaveBeenCalledWith('w'); // White wins if black runs out
    expect(result.current.blackTime).toBe(0);
  });

  it('should set times correctly when setTimes is called', () => {
    const { result } = renderHook(() => useChessClock(DEFAULT_TIMER, DEFAULT_TIMER));

    act(() => {
      result.current.setTimes(10000, 20000);
    });

    expect(result.current.whiteTime).toBe(10000);
    expect(result.current.blackTime).toBe(20000);
  });
}); 
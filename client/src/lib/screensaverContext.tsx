import React, { createContext, useContext, useState, useEffect } from 'react';

// Define available screensavers
export type ScreensaverType = 'clock' | 'rain' | 'starfield' | 'none';
export type ClockPosition = 'center' | 'corner';

// Valid timeout values in seconds
const VALID_TIMEOUTS = [10, 30, 60, 120, 300, 600] as const;
type TimeoutValue = typeof VALID_TIMEOUTS[number];

type ScreensaverContextType = {
  screensaver: ScreensaverType;
  setScreensaver: (type: ScreensaverType) => void;
  clockPosition: ClockPosition;
  setClockPosition: (position: ClockPosition) => void;
  timeout: TimeoutValue;
  setTimeout: (timeout: TimeoutValue) => void;
};

const ScreensaverContext = createContext<ScreensaverContextType | undefined>(undefined);

// Helper function to find the closest valid timeout value
function findClosestTimeout(value: number): TimeoutValue {
  return VALID_TIMEOUTS.reduce((prev, curr) => {
    return Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev;
  });
}

export function ScreensaverProvider({ children }: { children: React.ReactNode }) {
  // Check localStorage for saved preference, default to clock
  const [screensaver, setScreensaverState] = useState<ScreensaverType>(() => {
    const saved = localStorage.getItem('screensaver');
    // Handle migration from old types
    if (saved === 'matrix' || saved === 'bubbles') {
      return 'rain';
    }
    return (saved as ScreensaverType) || 'clock';
  });

  // Clock position preference
  const [clockPosition, setClockPositionState] = useState<ClockPosition>(() => {
    const saved = localStorage.getItem('clockPosition');
    return (saved as ClockPosition) || 'center';
  });

  // Timeout preference (in seconds)
  const [timeout, setTimeoutState] = useState<TimeoutValue>(() => {
    const saved = localStorage.getItem('screensaverTimeout');
    if (saved) {
      const value = parseInt(saved);
      // Handle migration from minutes to seconds
      if (value <= 10) {
        return findClosestTimeout(value * 60);
      }
      return findClosestTimeout(value);
    }
    return 120; // Default 2 minutes
  });

  // Save preferences to localStorage when they change
  useEffect(() => {
    localStorage.setItem('screensaver', screensaver);
  }, [screensaver]);

  useEffect(() => {
    localStorage.setItem('clockPosition', clockPosition);
  }, [clockPosition]);

  useEffect(() => {
    localStorage.setItem('screensaverTimeout', timeout.toString());
  }, [timeout]);

  const setScreensaver = (type: ScreensaverType) => {
    setScreensaverState(type);
  };

  const setClockPosition = (position: ClockPosition) => {
    setClockPositionState(position);
  };

  const setTimeout = (value: number) => {
    setTimeoutState(findClosestTimeout(value));
  };

  return (
    <ScreensaverContext.Provider value={{ 
      screensaver, 
      setScreensaver, 
      clockPosition, 
      setClockPosition,
      timeout,
      setTimeout
    }}>
      {children}
    </ScreensaverContext.Provider>
  );
}

export function useScreensaver() {
  const context = useContext(ScreensaverContext);
  if (context === undefined) {
    throw new Error('useScreensaver must be used within a ScreensaverProvider');
  }
  return context;
} 
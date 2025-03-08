import React, { createContext, useContext, useState, useEffect } from 'react';

// Define available screensavers
export type ScreensaverType = 'clock' | 'rain' | 'starfield' | 'none';
export type ClockPosition = 'center' | 'corner';

type ScreensaverContextType = {
  screensaver: ScreensaverType;
  setScreensaver: (type: ScreensaverType) => void;
  clockPosition: ClockPosition;
  setClockPosition: (position: ClockPosition) => void;
};

const ScreensaverContext = createContext<ScreensaverContextType | undefined>(undefined);

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

  // Save preferences to localStorage when they change
  useEffect(() => {
    localStorage.setItem('screensaver', screensaver);
  }, [screensaver]);

  useEffect(() => {
    localStorage.setItem('clockPosition', clockPosition);
  }, [clockPosition]);

  const setScreensaver = (type: ScreensaverType) => {
    setScreensaverState(type);
  };

  const setClockPosition = (position: ClockPosition) => {
    setClockPositionState(position);
  };

  return (
    <ScreensaverContext.Provider value={{ 
      screensaver, 
      setScreensaver, 
      clockPosition, 
      setClockPosition 
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
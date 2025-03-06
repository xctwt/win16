import React, { createContext, useContext, useState, useEffect } from 'react';
import { initOneko } from './oneko';

type OnekoContextType = {
  isOnekoEnabled: boolean;
  toggleOneko: () => void;
};

const OnekoContext = createContext<OnekoContextType | undefined>(undefined);

export function OnekoProvider({ children }: { children: React.ReactNode }) {
  // Check localStorage for saved preference, default to enabled
  const [isOnekoEnabled, setIsOnekoEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('onekoEnabled');
    return saved !== null ? saved === 'true' : true;
  });

  // Initialize or remove oneko when the state changes
  useEffect(() => {
    // Save preference to localStorage
    localStorage.setItem('onekoEnabled', isOnekoEnabled.toString());
    
    // Remove any existing oneko element
    const existingOneko = document.getElementById('oneko');
    if (existingOneko) {
      existingOneko.remove();
    }
    
    // Initialize oneko if enabled
    if (isOnekoEnabled) {
      initOneko();
    }
  }, [isOnekoEnabled]);

  const toggleOneko = () => {
    setIsOnekoEnabled(prev => !prev);
  };

  return (
    <OnekoContext.Provider value={{ isOnekoEnabled, toggleOneko }}>
      {children}
    </OnekoContext.Provider>
  );
}

export function useOneko() {
  const context = useContext(OnekoContext);
  if (context === undefined) {
    throw new Error('useOneko must be used within a OnekoProvider');
  }
  return context;
} 
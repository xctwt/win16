import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { initOneko } from './oneko';

type OnekoContextType = {
  isOnekoEnabled: boolean;
  toggleOneko: () => void;
};

const OnekoContext = createContext<OnekoContextType | undefined>(undefined);

export function OnekoProvider({ children }: { children: ReactNode }) {
  // Enabled by default
  const [isOnekoEnabled, setIsOnekoEnabled] = useState(() => localStorage.getItem('onekoEnabled') !== 'false');

  useEffect(() => {
    localStorage.setItem('onekoEnabled', String(isOnekoEnabled));
    if (isOnekoEnabled) return initOneko();
  }, [isOnekoEnabled]);

  const toggleOneko = () => setIsOnekoEnabled((prev) => !prev);

  return (
    <OnekoContext.Provider value={{ isOnekoEnabled, toggleOneko }}>
      {children}
    </OnekoContext.Provider>
  );
}

export function useOneko() {
  const context = useContext(OnekoContext);
  if (context === undefined) throw new Error('useOneko must be used within a OnekoProvider');
  return context;
}

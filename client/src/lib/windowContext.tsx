// lib/windowContext.tsx
import { createContext, useContext, useState, ReactNode } from 'react';

// Define window IDs type
export type WindowId = 'music' | 'info' | 'chat' | 'paint' | 'drawings' | 'clicker' | 'settings';

interface WindowStateItem {
  isOpen: boolean;
  zIndex: number;
}

interface WindowState {
  [K in WindowId]: WindowStateItem;
}

interface WindowContextType {
  windowStates: WindowState;
  openWindow: (id: WindowId) => void;
  closeWindow: (id: WindowId) => void;
  focusWindow: (id: WindowId) => void;
  toggleWindow: (id: WindowId) => void;
}

const WindowContext = createContext<WindowContextType | undefined>(undefined);

const initialWindowStates: WindowState = {
  music: { isOpen: true, zIndex: 1 },
  info: { isOpen: false, zIndex: 0 },
  chat: { isOpen: false, zIndex: 2 },
  paint: { isOpen: false, zIndex: 0 },
  drawings: { isOpen: false, zIndex: 0 },
  clicker: { isOpen: false, zIndex: 0 },
  settings: { isOpen: false, zIndex: 0 },
};

export function WindowProvider({ children }: { children: ReactNode }) {
  const [windowStates, setWindowStates] = useState<WindowState>(initialWindowStates);

  const openWindow = (id: WindowId) => {
    setWindowStates(prev => {
      const maxZ = Math.max(...Object.values(prev).map(w => w.zIndex));
      return {
        ...prev,
        [id]: { isOpen: true, zIndex: maxZ + 1 }
      };
    });
  };

  const closeWindow = (id: WindowId) => {
    setWindowStates(prev => ({
      ...prev,
      [id]: { ...prev[id], isOpen: false, zIndex: 0 }
    }));
  };

  const focusWindow = (id: WindowId) => {
    setWindowStates(prev => {
      const maxZ = Math.max(...Object.values(prev).map(w => w.zIndex));
      if (prev[id].zIndex === maxZ) return prev;
      return {
        ...prev,
        [id]: { ...prev[id], zIndex: maxZ + 1 }
      };
    });
  };

  const toggleWindow = (id: WindowId) => {
    setWindowStates(prev => {
      const maxZ = Math.max(...Object.values(prev).map(w => w.zIndex));
      return {
        ...prev,
        [id]: { 
          isOpen: !prev[id].isOpen, 
          zIndex: !prev[id].isOpen ? maxZ + 1 : 0 
        }
      };
    });
  };

  const value = {
    windowStates,
    openWindow,
    closeWindow,
    focusWindow,
    toggleWindow
  };

  return (
    <WindowContext.Provider value={value}>
      {children}
    </WindowContext.Provider>
  );
}

export function useWindowState() {
  const context = useContext(WindowContext);
  if (!context) {
    throw new Error('useWindowState must be used within a WindowProvider');
  }
  return context;
}

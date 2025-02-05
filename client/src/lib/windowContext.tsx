import { createContext, useContext, useState, ReactNode } from 'react';

interface WindowState {
  [key: string]: {
    isOpen: boolean;
    zIndex: number;
  };
}

interface WindowContextType {
  windowStates: WindowState;
  openWindow: (id: string) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  toggleWindow: (id: string) => void;
}

const WindowContext = createContext<WindowContextType | undefined>(undefined);

export function WindowProvider({ children }: { children: ReactNode }) {
  const [windowStates, setWindowStates] = useState<WindowState>({
    music: { isOpen: true, zIndex: 1 },
    info: { isOpen: false, zIndex: 0 },
    chat: { isOpen: false, zIndex: 2 },
    paint: { isOpen: false, zIndex: 0 },
    drawings: { isOpen: false, zIndex: 0 },
    clicker: { isOpen: false, zIndex: 0 }, // Add this line
  });

  const openWindow = (id: string) => {
    setWindowStates(prev => {
      const maxZ = Math.max(...Object.values(prev).map(w => w.zIndex));
      return {
        ...prev,
        [id]: { isOpen: true, zIndex: maxZ + 1 }
      };
    });
  };

  const closeWindow = (id: string) => {
    setWindowStates(prev => ({
      ...prev,
      [id]: { ...prev[id], isOpen: false, zIndex: 0 }
    }));
  };

  const focusWindow = (id: string) => {
    setWindowStates(prev => {
      const maxZ = Math.max(...Object.values(prev).map(w => w.zIndex));
      if (prev[id].zIndex === maxZ) return prev;
      return {
        ...prev,
        [id]: { ...prev[id], zIndex: maxZ + 1 }
      };
    });
  };

  const toggleWindow = (id: string) => {
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
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

// Define window IDs type
export type WindowId = 'music' | 'info' | 'chat' | 'paint' | 'drawings' | 'clicker' | 'settings' | 'contact';

interface WindowStateItem {
  isOpen: boolean;
  zIndex: number;
}

// Update the WindowState interface to be more explicit
export interface WindowState {
  music: WindowStateItem;
  info: WindowStateItem;
  chat: WindowStateItem;
  paint: WindowStateItem;
  drawings: WindowStateItem;
  clicker: WindowStateItem;
  settings: WindowStateItem;
  contact: WindowStateItem;
}

interface WindowContextType {
  windowStates: WindowState;
  openWindow: (id: WindowId) => void;
  closeWindow: (id: WindowId) => void;
  focusWindow: (id: WindowId) => void;
  toggleWindow: (id: WindowId) => void;
  handleActivity: () => void;
}

const WindowContext = createContext<WindowContextType | undefined>(undefined);

const initialWindowStates: WindowState = {
  music: { isOpen: false, zIndex: 1 },
  info: { isOpen: false, zIndex: 0 },
  chat: { isOpen: false, zIndex: 2 },
  paint: { isOpen: false, zIndex: 0 },
  drawings: { isOpen: false, zIndex: 0 },
  clicker: { isOpen: false, zIndex: 0 },
  settings: { isOpen: false, zIndex: 0 },
  contact: { isOpen: false, zIndex: 0 },
};

// Helper function to ensure a window state is valid
const ensureValidWindowState = (state: WindowState): WindowState => {
  const validState = { ...initialWindowStates };
  Object.keys(validState).forEach((key) => {
    const windowId = key as WindowId;
    if (state[windowId]) {
      validState[windowId] = {
        isOpen: Boolean(state[windowId].isOpen),
        zIndex: Number(state[windowId].zIndex) || 0
      };
    }
  });
  return validState;
};

export function WindowProvider({ children }: { children: ReactNode }) {
  const [windowStates, setWindowStates] = useState<WindowState>(() => {
    try {
      // Try to load saved window states from localStorage
      const savedStates = localStorage.getItem('windowStates');
      if (savedStates) {
        const parsed = JSON.parse(savedStates);
        return ensureValidWindowState(parsed);
      }
    } catch (error) {
      console.warn('Failed to load window states:', error);
    }
    return initialWindowStates;
  });

  // Save window states to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('windowStates', JSON.stringify(windowStates));
    } catch (error) {
      console.warn('Failed to save window states:', error);
    }
  }, [windowStates]);

  const openWindow = (id: WindowId) => {
    if (!windowStates[id]) return; // Guard against invalid window IDs
    setWindowStates(prev => {
      const maxZ = Math.max(...Object.values(prev).map(w => w.zIndex));
      return {
        ...prev,
        [id]: { isOpen: true, zIndex: maxZ + 1 }
      };
    });
  };

  const closeWindow = (id: WindowId) => {
    if (!windowStates[id]) return; // Guard against invalid window IDs
    setWindowStates(prev => ({
      ...prev,
      [id]: { ...prev[id], isOpen: false, zIndex: 0 }
    }));
  };

  const focusWindow = (id: WindowId) => {
    if (!windowStates[id]) return; // Guard against invalid window IDs
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
    if (!windowStates[id]) return; // Guard against invalid window IDs
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

  const handleActivity = () => {
    window.dispatchEvent(new Event('appActivity'));
  };

  const value = {
    windowStates,
    openWindow,
    closeWindow,
    focusWindow,
    toggleWindow,
    handleActivity
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
  // Ensure we always return valid window states
  return {
    ...context,
    windowStates: ensureValidWindowState(context.windowStates)
  };
}

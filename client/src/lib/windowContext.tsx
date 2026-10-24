import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';

export type WindowId = 'music' | 'info' | 'chat' | 'paint' | 'drawings' | 'clicker' | 'settings' | 'contact';

interface WindowStateItem {
  isOpen: boolean;
  zIndex: number;
}

export type WindowState = Record<WindowId, WindowStateItem>;

interface WindowContextType {
  windowStates: WindowState;
  openWindow: (id: WindowId) => void;
  closeWindow: (id: WindowId) => void;
  focusWindow: (id: WindowId) => void;
  toggleWindow: (id: WindowId) => void;
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

// Saved state may come from an older version, so only keep known windows.
function loadWindowStates(): WindowState {
  try {
    const saved = JSON.parse(localStorage.getItem('windowStates') ?? 'null');
    if (!saved || typeof saved !== 'object') return initialWindowStates;
    const state = { ...initialWindowStates };
    for (const id of Object.keys(state) as WindowId[]) {
      if (saved[id]) state[id] = { isOpen: Boolean(saved[id].isOpen), zIndex: Number(saved[id].zIndex) || 0 };
    }
    return state;
  } catch {
    return initialWindowStates;
  }
}

const topZ = (states: WindowState) => Math.max(...Object.values(states).map((w) => w.zIndex));

export function WindowProvider({ children }: { children: ReactNode }) {
  const [windowStates, setWindowStates] = useState<WindowState>(loadWindowStates);

  useEffect(() => {
    localStorage.setItem('windowStates', JSON.stringify(windowStates));
  }, [windowStates]);

  const openWindow = useCallback((id: WindowId) => {
    setWindowStates((prev) => ({ ...prev, [id]: { isOpen: true, zIndex: topZ(prev) + 1 } }));
  }, []);

  const closeWindow = useCallback((id: WindowId) => {
    setWindowStates((prev) => ({ ...prev, [id]: { isOpen: false, zIndex: 0 } }));
  }, []);

  const focusWindow = useCallback((id: WindowId) => {
    setWindowStates((prev) => {
      const max = topZ(prev);
      return prev[id].zIndex === max ? prev : { ...prev, [id]: { ...prev[id], zIndex: max + 1 } };
    });
  }, []);

  const toggleWindow = useCallback((id: WindowId) => {
    setWindowStates((prev) => {
      const isOpen = !prev[id].isOpen;
      return { ...prev, [id]: { isOpen, zIndex: isOpen ? topZ(prev) + 1 : 0 } };
    });
  }, []);

  const value = useMemo(
    () => ({ windowStates, openWindow, closeWindow, focusWindow, toggleWindow }),
    [windowStates, openWindow, closeWindow, focusWindow, toggleWindow],
  );

  return <WindowContext.Provider value={value}>{children}</WindowContext.Provider>;
}

export function useWindowState() {
  const context = useContext(WindowContext);
  if (!context) throw new Error('useWindowState must be used within a WindowProvider');
  return context;
}

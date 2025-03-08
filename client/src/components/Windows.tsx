// components/Windows.tsx
import React, { memo, useMemo } from 'react';
import Draggable from 'react-draggable';
import { X } from 'lucide-react';
import { useWindowState, WindowId } from '@/lib/windowContext';

interface WindowProps {
  title: string;
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  windowId: WindowId;
}

export const Window = memo(function Window({ title, children, defaultPosition = { x: 20, y: 20 }, windowId }: WindowProps) {
  const { closeWindow, focusWindow, windowStates } = useWindowState();
  const windowState = windowStates[windowId];

  if (!windowState) return null;

  const handleCloseClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    closeWindow(windowId);
  };

  const memoizedX = useMemo(() => <X size={14} />, []);

  return (
    <Draggable 
      handle=".cs-titlebar" 
      defaultPosition={defaultPosition}
      onStart={() => focusWindow(windowId)}
      onMouseDown={() => focusWindow(windowId)}
    >
      <div 
        className="cs-window" 
        style={{ zIndex: windowState.zIndex }}
        onMouseDown={() => focusWindow(windowId)}
      >
        <div className="cs-titlebar">
          <span>{title}</span>
          <button 
            className="cs-close-button" 
            onClick={handleCloseClick}
            onTouchEnd={handleCloseClick}
            style={{ touchAction: 'manipulation' }}
          >
            {memoizedX}
          </button>
        </div>
        <div className="cs-content">
          {children}
        </div>
      </div>
    </Draggable>
  );
});

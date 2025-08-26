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
  
  // Ensure we have a valid window state
  const windowState = windowStates?.[windowId] ?? { isOpen: false, zIndex: 0 };
  
  // If window state is invalid or window is not open, don't render
  if (!windowState || !windowState.isOpen) {
    return null;
  }

  const handleCloseClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    closeWindow(windowId);
  };

  const handleFocus = () => {
    try {
      focusWindow(windowId);
    } catch (error) {
      console.error('Error focusing window:', error);
    }
  };

  const memoizedX = useMemo(() => <X size={14} />, []);

  return (
    <Draggable 
      handle=".cs-titlebar" 
      defaultPosition={defaultPosition}
      onStart={handleFocus}
      onMouseDown={handleFocus}
    >
      <div 
        className="cs-window" 
        style={{ 
          zIndex: windowState.zIndex || 0,
          position: 'absolute',
          touchAction: 'none'
        }}
        onMouseDown={handleFocus}
        onTouchStart={handleFocus}
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

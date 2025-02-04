import React from 'react';
import Draggable from 'react-draggable';
import { X } from 'lucide-react';
import { useWindowState } from '@/lib/windowContext';

interface WindowProps {
  title: string;
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  windowId: string;
}

export function Window({ title, children, defaultPosition = { x: 20, y: 20 }, windowId }: WindowProps) {
  const { closeWindow, focusWindow, windowStates } = useWindowState();
  const windowState = windowStates[windowId];

  if (!windowState) return null;

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
          <button className="cs-close-button" onClick={() => closeWindow(windowId)}>
            <X size={14} />
          </button>
        </div>
        <div className="cs-content">
          {children}
        </div>
      </div>
    </Draggable>
  );
}
import { memo, useRef, type ReactNode } from 'react';
import Draggable from 'react-draggable';
import { X } from 'lucide-react';
import { useWindowState, type WindowId } from '@/lib/windowContext';

interface WindowProps {
  title: string;
  children: ReactNode;
  defaultPosition?: { x: number; y: number };
  windowId: WindowId;
}

const DEFAULT_POSITION = { x: 20, y: 20 };

export const Window = memo(function Window({ title, children, defaultPosition = DEFAULT_POSITION, windowId }: WindowProps) {
  const { closeWindow, focusWindow, windowStates } = useWindowState();
  const nodeRef = useRef<HTMLDivElement>(null);
  const windowState = windowStates[windowId];

  if (!windowState.isOpen) return null;

  const handleClose = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    closeWindow(windowId);
  };

  const handleFocus = () => focusWindow(windowId);

  return (
    <Draggable nodeRef={nodeRef} handle=".cs-titlebar" defaultPosition={defaultPosition}>
      <div
        ref={nodeRef}
        className="cs-window"
        style={{ zIndex: windowState.zIndex, position: 'absolute', touchAction: 'none' }}
        onMouseDownCapture={handleFocus}
        onTouchStartCapture={handleFocus}
      >
        <div className="cs-titlebar">
          <span>{title}</span>
          <button
            className="cs-close-button"
            onClick={handleClose}
            onTouchEnd={handleClose}
            style={{ touchAction: 'manipulation' }}
          >
            <X size={14} />
          </button>
        </div>
        <div className="cs-content">{children}</div>
      </div>
    </Draggable>
  );
});

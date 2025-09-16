import React, { memo } from 'react';
import { useWindowState, WindowId } from '@/lib/windowContext';
import { useTheme } from '@/lib/themeContext';

// Pre-define icons array outside component to avoid recreation
const DESKTOP_ICONS = [
  { id: 'music' as WindowId, label: 'player', icon: 'music' },
  { id: 'info' as WindowId, label: 'about', icon: 'readme' },
  { id: 'chat' as WindowId, label: 'chat', icon: 'chat' },
  { id: 'paint' as WindowId, label: 'paint', icon: 'paint' },
  { id: 'drawings' as WindowId, label: 'drawings', icon: 'images' },
  { id: 'settings' as WindowId, label: 'settings', icon: 'settings' },
  { id: 'clicker' as WindowId, label: 'clicker', icon: 'clicker' },
  { id: 'contact' as WindowId, label: 'contact', icon: 'message' },
] as const;

export const Desktop = memo(function Desktop() {
  const { openWindow } = useWindowState();
  const { theme } = useTheme();

  // Memoize filter style to avoid recalculation
  const filterStyle = React.useMemo(
    () => ({ filter: theme === 'light' ? 'invert(1)' : 'none' }),
    [theme]
  );

  return (
    <div className="desktop-icons">
      {DESKTOP_ICONS.map(({ id, label, icon }) => (
        <DesktopIcon
          key={id}
          id={id}
          label={label}
          icon={icon}
          filterStyle={filterStyle}
          onOpen={openWindow}
        />
      ))}
    </div>
  );
});

// Separate memoized component for individual icons
const DesktopIcon = memo(function DesktopIcon({
  id,
  label,
  icon,
  filterStyle,
  onOpen,
}: {
  id: WindowId;
  label: string;
  icon: string;
  filterStyle: React.CSSProperties;
  onOpen: (id: WindowId) => void;
}) {
  const handleClick = React.useCallback(() => onOpen(id), [id, onOpen]);
  
  return (
    <button className="desktop-icon" onClick={handleClick}>
      <div className="desktop-icon-image" style={filterStyle}>
        <img 
          src={`/assets/icons/${icon}.png`} 
          alt={label}
          className="w-full h-full object-contain"
          loading="eager"
          decoding="sync"
          draggable={false}
        />
      </div>
      <span className="desktop-icon-label">{label}</span>
    </button>
  );
});

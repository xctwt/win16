import React, { memo } from 'react';
import { useWindowState, WindowId } from '@/lib/windowContext';
import { useTheme } from '@/lib/themeContext';

export const Desktop = memo(function Desktop() {
  const { openWindow } = useWindowState();
  const { theme } = useTheme();

  const icons = [
    { id: 'music' as WindowId, label: 'player', icon: '/assets/icons/music.png' },
    { id: 'info' as WindowId, label: 'about', icon: '/assets/icons/readme.png' },
    { id: 'chat' as WindowId, label: 'chat', icon: '/assets/icons/chat.png' },
    { id: 'paint' as WindowId, label: 'paint', icon: '/assets/icons/paint.png' },
    { id: 'drawings' as WindowId, label: 'drawings', icon: '/assets/icons/images.png' },
    { id: 'settings' as WindowId, label: 'settings', icon: '/assets/icons/settings.png' },
    { id: 'clicker' as WindowId, label: 'clicker', icon: '/assets/icons/clicker.png' },
    { id: 'contact' as WindowId, label: 'contact', icon: '/assets/icons/message.png' },
  ];

  return (
    <div className="desktop-icons">
      {icons.map(({ id, label, icon }) => (
        <button
          key={id}
          className="desktop-icon"
          onClick={() => openWindow(id)}
        >
          <div className="desktop-icon-image" style={{ filter: theme === 'light' ? 'invert(1)' : 'none' }}>
            <img 
              src={icon} 
              alt={label}
              className="w-full h-full object-contain"
            />
          </div>
          <span className="desktop-icon-label">{label}</span>
        </button>
      ))}
    </div>
  );
});

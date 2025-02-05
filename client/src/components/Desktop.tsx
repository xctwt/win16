// components/Desktop.tsx
import { Music, MessageSquare, Info, Paintbrush, FolderOpen, Settings, Cookie } from 'lucide-react';
import { useWindowState } from '@/lib/windowContext';

export function Desktop() {
  const { openWindow } = useWindowState();

  const icons = [
    { id: 'music', label: 'player', Icon: Music },
    { id: 'info', label: 'about', Icon: Info },
    { id: 'chat', label: 'chat', Icon: MessageSquare },
    { id: 'paint', label: 'paint', Icon: Paintbrush },
    { id: 'drawings', label: 'drawings', Icon: FolderOpen },
    { id: 'settings', label: 'settings', Icon: Settings },
    { id: 'clicker', label: 'clicker', Icon: Cookie }, // Added back the clicker icon
  ];

  return (
    <div className="desktop-icons">
      {icons.map(({ id, label, Icon }) => (
        <button
          key={id}
          className="desktop-icon"
          onClick={() => openWindow(id)}
        >
          <div className="desktop-icon-image">
            <Icon className="w-full h-full" />
          </div>
          <span className="desktop-icon-label">{label}</span>
        </button>
      ))}
    </div>
  );
}

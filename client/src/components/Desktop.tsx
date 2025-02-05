import { Music, MessageSquare, Info, Paintbrush, FolderOpen, Mouse } from 'lucide-react';
import { useWindowState } from '@/lib/windowContext';

export function Desktop() {
  const { openWindow } = useWindowState();

  const icons = [
    { id: 'music', label: 'player', Icon: Music },
    { id: 'readme', label: 'about', Icon: Info },
    { id: 'chat', label: 'chat', Icon: MessageSquare },
    { id: 'paint', label: 'paint', Icon: Paintbrush },
    { id: 'drawings', label: 'drawings', Icon: FolderOpen },
    { id: 'clicker', label: 'clicker', Icon: Mouse }, // Add this line
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
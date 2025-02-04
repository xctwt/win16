import { Music, MessageSquare, Info, Paintbrush, FolderOpen } from 'lucide-react';
import { useWindowState } from '@/lib/windowContext';

export function Desktop() {
  const { openWindow } = useWindowState();

  const icons = [
    { id: 'music', label: 'Music Player', Icon: Music },
    { id: 'info', label: 'About Me', Icon: Info },
    { id: 'chat', label: 'Chat', Icon: MessageSquare },
    { id: 'paint', label: 'Paint', Icon: Paintbrush },
    { id: 'drawings', label: 'Drawings', Icon: FolderOpen },
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
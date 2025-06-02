// components/Desktop.tsx
import React, { memo } from "react";
import {
  Music,
  MessageSquare,
  Info,
  Paintbrush,
  FolderOpen,
  Settings,
  Cookie,
  Mail,
} from "lucide-react";
import { useWindowState, WindowId } from "@/lib/windowContext";

export const Desktop = memo(function Desktop() {
  const { openWindow } = useWindowState();

  const icons = [
    { id: "music" as WindowId, label: "player", Icon: Music },
    { id: "info" as WindowId, label: "about", Icon: Info },
    { id: "chat" as WindowId, label: "chat", Icon: MessageSquare },
    { id: "paint" as WindowId, label: "paint", Icon: Paintbrush },
    { id: "drawings" as WindowId, label: "drawings", Icon: FolderOpen },
    { id: "settings" as WindowId, label: "settings", Icon: Settings },
    { id: "clicker" as WindowId, label: "clicker", Icon: Cookie },
    { id: "contact" as WindowId, label: "contact", Icon: Mail },
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
});

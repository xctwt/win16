import {
  Music,
  MessageSquare,
  Info,
  Paintbrush,
  FolderOpen,
} from "lucide-react";
import { useWindowState } from "@/lib/windowContext";

export function Dock() {
  const { toggleWindow } = useWindowState();

  return (
    <div className="cs-dock">
      <button className="cs-dock-icon" onClick={() => toggleWindow("music")}>
        <Music className="w-full h-full" />
      </button>
      <button className="cs-dock-icon" onClick={() => toggleWindow("info")}>
        <Info className="w-full h-full" />
      </button>
      <button className="cs-dock-icon" onClick={() => toggleWindow("chat")}>
        <MessageSquare className="w-full h-full" />
      </button>
      <button className="cs-dock-icon" onClick={() => toggleWindow("paint")}>
        <Paintbrush className="w-full h-full" />
      </button>
      <button className="cs-dock-icon" onClick={() => toggleWindow("drawings")}>
        <FolderOpen className="w-full h-full" />
      </button>
    </div>
  );
}

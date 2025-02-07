import { useEffect, useState } from "react";
import { useWindowState } from "@/lib/windowContext";

export function Screensaver({ onActivity }: { onActivity: () => void }) {
  const [time, setTime] = useState(new Date());
  const { windowStates } = useWindowState();

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleActivity = () => {
    onActivity();
  };

  return (
    <div
      className="fixed inset-0 z-50 cursor-none"
      style={{ backgroundColor: "var(--cs-bg)" }}
      onClick={handleActivity}
      onMouseMove={handleActivity}
      onTouchStart={handleActivity}
    >
      <div
        className="absolute font-mono"
        style={{
          right: "20px",
          bottom: "20px",
          color: "var(--cs-text)",
        }}
      >
        <div className="text-4xl">{time.toLocaleTimeString()}</div>
        <div className="text-sm opacity-70">Move mouse or touch screen to exit</div>
      </div>
    </div>
  );
}

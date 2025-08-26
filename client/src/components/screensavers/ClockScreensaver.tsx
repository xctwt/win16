import { useEffect, useState } from "react";
import { useTheme } from "@/lib/themeContext";
import { useScreensaver } from "@/lib/screensaverContext";
import { MouseEvent, TouchEvent } from "react";

export function ClockScreensaver({
  onActivity,
}: {
  onActivity: (e: Event) => void;
}) {
  const [time, setTime] = useState(new Date());
  const { theme } = useTheme();
  const { clockPosition } = useScreensaver();

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleMouseActivity = (e: MouseEvent) => {
    onActivity(e.nativeEvent);
  };

  const handleTouchActivity = (e: TouchEvent) => {
    onActivity(e.nativeEvent);
  };

  // Clock position styles
  const getClockStyles = () => {
    if (clockPosition === "center") {
      return {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
      };
    } else {
      return {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        width: "100%",
        height: "100%",
        padding: "20px",
      };
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 cursor-none"
      style={{ backgroundColor: "var(--cs-bg)" }}
      onClick={handleMouseActivity}
      onMouseMove={handleMouseActivity}
      onTouchStart={handleTouchActivity}
    >
      <div style={getClockStyles()}>
        <div
          className={`${clockPosition === "corner" ? "text-right" : "text-center"}`}
        >
          <div
            className={
              clockPosition === "center"
                ? "text-8xl font-mono"
                : "text-4xl font-mono"
            }
            style={{ color: "var(--cs-text)" }}
          >
            {time.toLocaleTimeString()}
          </div>
          <div
            className={`opacity-70 font-mono ${clockPosition === "center" ? "text-xl mt-4" : "text-sm mt-2"}`}
            style={{ color: "var(--cs-text)" }}
          >
            {time.toLocaleDateString()}
          </div>
          {clockPosition === "center" && (
            <div
              className="text-sm mt-8 opacity-70"
              style={{ color: "var(--cs-text)" }}
            >
              Double click or press any key to exit
            </div>
          )}
        </div>
      </div>

      {clockPosition === "corner" && (
        <div
          className="absolute text-sm opacity-70"
          style={{
            right: "20px",
            bottom: "20px",
            color: "var(--cs-text)",
          }}
        >
          Double click or press any key to exit
        </div>
      )}
    </div>
  );
}

import { useScreensaver } from "@/lib/screensaverContext";
import { ClockScreensaver } from "./screensavers/ClockScreensaver";
import { RainScreensaver } from "./screensavers/RainScreensaver";
import { StarfieldScreensaver } from "./screensavers/StarfieldScreensaver";

export function Screensaver({
  onActivity,
}: {
  onActivity: (e: Event) => void;
}) {
  const { screensaver } = useScreensaver();

  // Render the selected screensaver
  switch (screensaver) {
    case "rain":
      return <RainScreensaver onActivity={onActivity} />;
    case "starfield":
      return <StarfieldScreensaver onActivity={onActivity} />;
    case "none":
      return null;
    case "clock":
    default:
      return <ClockScreensaver onActivity={onActivity} />;
  }
}

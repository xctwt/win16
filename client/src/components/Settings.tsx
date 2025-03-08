// components/Settings.tsx
import { Window } from './Windows';
import { useTheme } from '@/lib/themeContext';
import { useOneko } from '@/lib/onekoContext';
import { useScreensaver } from '@/lib/screensaverContext';
import { Sun, Moon, Cat, Clock, CloudRain, Stars, Ban, LayoutTemplate, LayoutDashboard } from 'lucide-react';
import { useMemo } from 'react';

export function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { isOnekoEnabled, toggleOneko } = useOneko();
  const { screensaver, setScreensaver, clockPosition, setClockPosition } = useScreensaver();

  const defaultPosition = useMemo(() => ({ x: 75, y: 505 }), []);

  return (
    <Window title="settings" windowId="settings" defaultPosition={defaultPosition}>
      <div className="w-80 p-4 space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-bold mb-2">Theme</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              className={`cs-button flex items-center justify-center gap-2 p-2
                         ${theme === 'dark' ? 'cs-button-active' : ''}`}
              onClick={() => theme === 'light' && toggleTheme()}
            >
              <Moon className="w-4 h-4" />
              <span>Dark</span>
            </button>
            <button
              className={`cs-button flex items-center justify-center gap-2 p-2
                         ${theme === 'light' ? 'cs-button-active' : ''}`}
              onClick={() => theme === 'dark' && toggleTheme()}
            >
              <Sun className="w-4 h-4" />
              <span>Light</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-bold mb-2">Screensaver</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              className={`cs-button flex items-center justify-center gap-2 p-2
                         ${screensaver === 'clock' ? 'cs-button-active' : ''}`}
              onClick={() => setScreensaver('clock')}
            >
              <Clock className="w-4 h-4" />
              <span>Clock</span>
            </button>
            <button
              className={`cs-button flex items-center justify-center gap-2 p-2
                         ${screensaver === 'rain' ? 'cs-button-active' : ''}`}
              onClick={() => setScreensaver('rain')}
            >
              <CloudRain className="w-4 h-4" />
              <span>Rain</span>
            </button>
            <button
              className={`cs-button flex items-center justify-center gap-2 p-2
                         ${screensaver === 'starfield' ? 'cs-button-active' : ''}`}
              onClick={() => setScreensaver('starfield')}
            >
              <Stars className="w-4 h-4" />
              <span>Starfield</span>
            </button>
            <button
              className={`cs-button flex items-center justify-center gap-2 p-2
                         ${screensaver === 'none' ? 'cs-button-active' : ''}`}
              onClick={() => setScreensaver('none')}
            >
              <Ban className="w-4 h-4" />
              <span>None</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-bold mb-2">Clock Position</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              className={`cs-button flex items-center justify-center gap-2 p-2
                         ${clockPosition === 'center' ? 'cs-button-active' : ''}`}
              onClick={() => setClockPosition('center')}
            >
              <LayoutTemplate className="w-4 h-4" />
              <span>Center</span>
            </button>
            <button
              className={`cs-button flex items-center justify-center gap-2 p-2
                         ${clockPosition === 'corner' ? 'cs-button-active' : ''}`}
              onClick={() => setClockPosition('corner')}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Corner</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-bold mb-2">Features</div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="oneko-toggle"
              checked={isOnekoEnabled}
              onChange={toggleOneko}
              className="cs-checkbox"
            />
            <label htmlFor="oneko-toggle" className="flex items-center gap-2 cursor-pointer">
              <Cat className="w-4 h-4" />
              <span>oneko</span>
            </label>
          </div>
        </div>
      </div>
    </Window>
  );
}
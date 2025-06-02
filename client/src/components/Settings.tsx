import { Window } from './Windows';
import { useTheme } from '@/lib/themeContext';
import { useOneko } from '@/lib/onekoContext';
import { useScreensaver } from '@/lib/screensaverContext';
import { Sun, Moon, Cat, Clock, CloudRain, Stars, Ban, LayoutTemplate, LayoutDashboard, Save, Check } from 'lucide-react';
import { useMemo, useState } from 'react';

const TIMEOUT_OPTIONS = [
  { value: 10, label: '10 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
] as const;

type TimeoutValue = typeof TIMEOUT_OPTIONS[number]['value'];

export function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { isOnekoEnabled, toggleOneko } = useOneko();
  const { screensaver, setScreensaver, clockPosition, setClockPosition, timeout, setTimeout } = useScreensaver();
  const [selectedTimeout, setSelectedTimeout] = useState<TimeoutValue>(timeout);

  const defaultPosition = useMemo(() => ({ x: 75, y: 505 }), []);

  const handleTimeoutChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) return;
    
    const newValue = Number(value);
    if (!isNaN(newValue) && TIMEOUT_OPTIONS.some(option => option.value === newValue)) {
      setSelectedTimeout(newValue as TimeoutValue);
    }
  };

  const handleSaveTimeout = () => {
    setTimeout(selectedTimeout);
  };

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
              className={`cs-button flex items-center justify-center gap-2 p-2 relative
                         ${screensaver === 'clock' ? 'cs-button-active' : ''}`}
              onClick={() => setScreensaver('clock')}
            >
              <Clock className="w-4 h-4" />
              <span>Clock</span>
              {screensaver === 'clock' && (
                <Check className="w-3 h-3 absolute top-1 right-1" />
              )}
            </button>
            <button
              className={`cs-button flex items-center justify-center gap-2 p-2 relative
                         ${screensaver === 'rain' ? 'cs-button-active' : ''}`}
              onClick={() => setScreensaver('rain')}
            >
              <CloudRain className="w-4 h-4" />
              <span>Rain</span>
              {screensaver === 'rain' && (
                <Check className="w-3 h-3 absolute top-1 right-1" />
              )}
            </button>
            <button
              className={`cs-button flex items-center justify-center gap-2 p-2 relative
                         ${screensaver === 'starfield' ? 'cs-button-active' : ''}`}
              onClick={() => setScreensaver('starfield')}
            >
              <Stars className="w-4 h-4" />
              <span>Starfield</span>
              {screensaver === 'starfield' && (
                <Check className="w-3 h-3 absolute top-1 right-1" />
              )}
            </button>
            <button
              className={`cs-button flex items-center justify-center gap-2 p-2 relative
                         ${screensaver === 'none' ? 'cs-button-active' : ''}`}
              onClick={() => setScreensaver('none')}
            >
              <Ban className="w-4 h-4" />
              <span>None</span>
              {screensaver === 'none' && (
                <Check className="w-3 h-3 absolute top-1 right-1" />
              )}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-bold mb-2">Screensaver Timeout</div>
          <div className="flex gap-2">
            <select
              value={selectedTimeout}
              onChange={handleTimeoutChange}
              className="cs-select flex-1"
            >
              {TIMEOUT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              className={`cs-button flex items-center justify-center gap-2 p-2 ${selectedTimeout === timeout ? 'opacity-50' : ''}`}
              onClick={handleSaveTimeout}
              disabled={selectedTimeout === timeout}
            >
              <Save className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-bold mb-2">Clock Position</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              className={`cs-button flex items-center justify-center gap-2 p-2 relative
                         ${clockPosition === 'center' ? 'cs-button-active' : ''}`}
              onClick={() => setClockPosition('center')}
            >
              <LayoutTemplate className="w-4 h-4" />
              <span>Center</span>
              {clockPosition === 'center' && (
                <Check className="w-3 h-3 absolute top-1 right-1" />
              )}
            </button>
            <button
              className={`cs-button flex items-center justify-center gap-2 p-2 relative
                         ${clockPosition === 'corner' ? 'cs-button-active' : ''}`}
              onClick={() => setClockPosition('corner')}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Corner</span>
              {clockPosition === 'corner' && (
                <Check className="w-3 h-3 absolute top-1 right-1" />
              )}
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
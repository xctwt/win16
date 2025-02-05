// components/Settings.tsx
import { Window } from './Windows';
import { useTheme } from '@/lib/themeContext';
import { Sun, Moon } from 'lucide-react';

export function Settings() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Window title="settings" windowId="settings" defaultPosition={{ x: 200, y: 200 }}>
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
      </div>
    </Window>
  );
}

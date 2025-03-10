import { useEffect, useState, useCallback, memo } from 'react';
import { MusicPlayer } from '@/components/MusicPlayer';
import { InfoWindow } from '@/components/InfoWindow';
import { ChatWindow } from '@/components/ChatWindow';
import { Paint } from '@/components/Paint';
import { DrawingsViewer } from '@/components/DrawingsViewer';
import { Clicker } from '@/components/Clicker';
import { Desktop } from '@/components/Desktop';
import { useWindowState, WindowId } from '@/lib/windowContext';
import { Screensaver } from '@/components/Screensaver';
import { Settings } from '@/components/Settings';
import { Contact } from '@/components/Contact';
import { useScreensaver } from '@/lib/screensaverContext';

const Windows = memo(function Windows() {
  const { windowStates } = useWindowState();

  // Ensure we have valid window states
  const safeWindowStates = {
    music: windowStates?.music ?? { isOpen: false, zIndex: 0 },
    info: windowStates?.info ?? { isOpen: false, zIndex: 0 },
    chat: windowStates?.chat ?? { isOpen: false, zIndex: 0 },
    paint: windowStates?.paint ?? { isOpen: false, zIndex: 0 },
    drawings: windowStates?.drawings ?? { isOpen: false, zIndex: 0 },
    clicker: windowStates?.clicker ?? { isOpen: false, zIndex: 0 },
    settings: windowStates?.settings ?? { isOpen: false, zIndex: 0 },
    contact: windowStates?.contact ?? { isOpen: false, zIndex: 0 },
  };

  return (
    <>
      {safeWindowStates.music.isOpen && <MusicPlayer />}
      {safeWindowStates.info.isOpen && <InfoWindow />}
      {safeWindowStates.chat.isOpen && <ChatWindow />}
      {safeWindowStates.paint.isOpen && <Paint />}
      {safeWindowStates.drawings.isOpen && <DrawingsViewer />}
      {safeWindowStates.clicker.isOpen && <Clicker />}
      {safeWindowStates.settings.isOpen && <Settings />}
      {safeWindowStates.contact.isOpen && <Contact />}
    </>
  );
});

export default function Home() {
  const [isScreensaverActive, setIsScreensaverActive] = useState(false);
  const { timeout } = useScreensaver();
  let idleTimer: NodeJS.Timeout;

  // Reset timer on user activity
  const resetTimer = useCallback(() => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      setIsScreensaverActive(true);
    }, timeout * 1000);
  }, [timeout]);

  // Handle user activity
  const handleActivity = useCallback((e: Event) => {
    if (isScreensaverActive) {
      // Only deactivate screensaver on double click or keyboard press
      if (e.type === 'dblclick' || e.type === 'keydown') {
        setIsScreensaverActive(false);
        resetTimer();
      }
    } else {
      resetTimer();
    }
  }, [isScreensaverActive, resetTimer]);

  useEffect(() => {
    // Add event listeners for user activity
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('dblclick', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    // Start initial timer
    resetTimer();

    // Cleanup
    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('dblclick', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [handleActivity, resetTimer]);

  return (
    <div className="h-screen w-screen overflow-hidden">
      <Desktop />
      <Windows />
      {isScreensaverActive && (
        <Screensaver onActivity={handleActivity} />
      )}
    </div>
  );
}

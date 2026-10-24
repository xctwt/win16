import { useEffect, useState, useCallback, useRef, memo, lazy, Suspense } from 'react';
import { Desktop } from '@/components/Desktop';
import { useWindowState } from '@/lib/windowContext';
import { Screensaver } from '@/components/Screensaver';
import { useScreensaver } from '@/lib/screensaverContext';

// Windows are loaded on first open to keep the initial bundle small.
const MusicPlayer = lazy(() => import('@/components/MusicPlayer').then((m) => ({ default: m.MusicPlayer })));
const InfoWindow = lazy(() => import('@/components/InfoWindow').then((m) => ({ default: m.InfoWindow })));
const ChatWindow = lazy(() => import('@/components/ChatWindow').then((m) => ({ default: m.ChatWindow })));
const Paint = lazy(() => import('@/components/Paint').then((m) => ({ default: m.Paint })));
const DrawingsViewer = lazy(() => import('@/components/DrawingsViewer').then((m) => ({ default: m.DrawingsViewer })));
const Clicker = lazy(() => import('@/components/Clicker').then((m) => ({ default: m.Clicker })));
const Settings = lazy(() => import('@/components/Settings').then((m) => ({ default: m.Settings })));
const Contact = lazy(() => import('@/components/Contact').then((m) => ({ default: m.Contact })));

const Windows = memo(function Windows() {
  const { windowStates } = useWindowState();

  return (
    <>
      {windowStates.music.isOpen && <Suspense fallback={null}><MusicPlayer /></Suspense>}
      {windowStates.info.isOpen && <Suspense fallback={null}><InfoWindow /></Suspense>}
      {windowStates.chat.isOpen && <Suspense fallback={null}><ChatWindow /></Suspense>}
      {windowStates.paint.isOpen && <Suspense fallback={null}><Paint /></Suspense>}
      {windowStates.drawings.isOpen && <Suspense fallback={null}><DrawingsViewer /></Suspense>}
      {windowStates.clicker.isOpen && <Suspense fallback={null}><Clicker /></Suspense>}
      {windowStates.settings.isOpen && <Suspense fallback={null}><Settings /></Suspense>}
      {windowStates.contact.isOpen && <Suspense fallback={null}><Contact /></Suspense>}
    </>
  );
});

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'dblclick', 'touchstart'] as const;

export default function Home() {
  const [isScreensaverActive, setIsScreensaverActive] = useState(false);
  const { timeout } = useScreensaver();
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const resetTimer = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIsScreensaverActive(true), timeout * 1000);
  }, [timeout]);

  const handleActivity = useCallback((e: Event) => {
    if (isScreensaverActive) {
      // Only a double click or key press dismisses the screensaver
      if (e.type === 'dblclick' || e.type === 'keydown') {
        setIsScreensaverActive(false);
        resetTimer();
      }
    } else {
      resetTimer();
    }
  }, [isScreensaverActive, resetTimer]);

  useEffect(() => {
    ACTIVITY_EVENTS.forEach((type) => window.addEventListener(type, handleActivity, { passive: true }));
    resetTimer();
    return () => {
      clearTimeout(idleTimer.current);
      ACTIVITY_EVENTS.forEach((type) => window.removeEventListener(type, handleActivity));
    };
  }, [handleActivity, resetTimer]);

  return (
    <div className="h-screen w-screen overflow-hidden">
      <Desktop />
      <Windows />
      {isScreensaverActive && <Screensaver onActivity={handleActivity} />}
    </div>
  );
}

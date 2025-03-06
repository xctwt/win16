import { useEffect, useState, useCallback } from 'react';
import { MusicPlayer } from '@/components/MusicPlayer';
import { InfoWindow } from '@/components/InfoWindow';
import { ChatWindow } from '@/components/ChatWindow';
import { Paint } from '@/components/Paint';
import { DrawingsViewer } from '@/components/DrawingsViewer';
import { Clicker } from '@/components/Clicker';
import { Desktop } from '@/components/Desktop';
import { useWindowState } from '@/lib/windowContext';
import { Screensaver } from '@/components/Screensaver';
import { Settings } from '@/components/Settings';

function Windows() {
  const { windowStates } = useWindowState();

  return (
    <>
      {windowStates.music.isOpen && <MusicPlayer />}
      {windowStates.info.isOpen && <InfoWindow />}
      {windowStates.chat.isOpen && <ChatWindow />}
      {windowStates.paint.isOpen && <Paint />}
      {windowStates.drawings.isOpen && <DrawingsViewer />}
      {windowStates.clicker.isOpen && <Clicker />}
      {windowStates.settings.isOpen && <Settings />}
    </>
  );
}

const IDLE_TIME = 2 * 60 * 1000; // 2 minutes in milliseconds

export default function Home() {
  const [showScreensaver, setShowScreensaver] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());

  const updateLastActivity = useCallback(() => {
    setLastActivity(Date.now());
    setShowScreensaver(false);
  }, []);

  // Activity tracking
  useEffect(() => {
    const checkIdle = () => {
      // Only check for idle if screensaver isn't already showing
      if (!showScreensaver && Date.now() - lastActivity >= IDLE_TIME) {
        setShowScreensaver(true);
      }
    };

    // Set up idle checker
    const idleCheck = setInterval(checkIdle, 1000);

    // Set up activity listeners
    const activityEvents = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'click',
      'input'
    ];

    // Add listeners for all activity events
    activityEvents.forEach(event => {
      window.addEventListener(event, updateLastActivity);
    });

    // Create custom event for app-specific activity
    window.addEventListener('appActivity', updateLastActivity);

    // Cleanup
    return () => {
      clearInterval(idleCheck);
      activityEvents.forEach(event => {
        window.removeEventListener(event, updateLastActivity);
      });
      window.removeEventListener('appActivity', updateLastActivity);
    };
  }, [lastActivity, showScreensaver, updateLastActivity]);

  return (
    <div className="app min-h-screen p-4">
      <Desktop />
      <Windows />
      {showScreensaver && (
        <Screensaver 
          onActivity={() => {
            setLastActivity(Date.now());
            setShowScreensaver(false);
          }}
        />
      )}
    </div>
  );
}

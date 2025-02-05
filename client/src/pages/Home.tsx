import { useEffect, useState } from 'react';
import { MusicPlayer } from '@/components/MusicPlayer';
import { InfoWindow } from '@/components/InfoWindow';
import { ChatWindow } from '@/components/ChatWindow';
import { Paint } from '@/components/Paint';
import { DrawingsViewer } from '@/components/DrawingsViewer';
import { Clicker } from '@/components/Clicker'; // Add this import
import { Desktop } from '@/components/Desktop';
import { WindowProvider, useWindowState } from '@/lib/windowContext';
import { initOneko } from '@/lib/oneko';
import { Screensaver } from '@/components/Screensaver';

function Windows() {
  const { windowStates } = useWindowState();

  return (
    <>
      {windowStates.music.isOpen && <MusicPlayer />}
      {windowStates.info.isOpen && <InfoWindow />}
      {windowStates.chat.isOpen && <ChatWindow />}
      {windowStates.paint.isOpen && <Paint />}
      {windowStates.drawings.isOpen && <DrawingsViewer />}
      {windowStates.clicker.isOpen && <Clicker />} {/* Add this line */}
    </>
  );
}

const IDLE_TIME = 2 * 60 * 1000; // 2 minutes in milliseconds

export default function Home() {
  const [showScreensaver, setShowScreensaver] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());

  useEffect(() => {
    initOneko();
  }, []);

  // Idle detection
  useEffect(() => {
    const handleActivity = () => {
      setLastActivity(Date.now());
      setShowScreensaver(false);
    };

    const checkIdle = () => {
      if (Date.now() - lastActivity >= IDLE_TIME) {
        setShowScreensaver(true);
      }
    };

    // Check for idle state every second
    const idleCheck = setInterval(checkIdle, 1000);

    // Add activity listeners
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('scroll', handleActivity);

    return () => {
      clearInterval(idleCheck);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [lastActivity]);

  return (
    <WindowProvider>
      <div className="min-h-screen bg-black p-4">
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
    </WindowProvider>
  );
}
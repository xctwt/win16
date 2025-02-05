import { useEffect, useState } from 'react';
import { MusicPlayer } from '@/components/MusicPlayer';
import { InfoWindow } from '@/components/InfoWindow';
import { ChatWindow } from '@/components/ChatWindow';
import { Paint } from '@/components/Paint';
import { DrawingsViewer } from '@/components/DrawingsViewer';
import { Clicker } from '@/components/Clicker';
import { Desktop } from '@/components/Desktop';
import { useWindowState } from '@/lib/windowContext';
import { initOneko } from '@/lib/oneko';
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

const IDLE_TIME = 10 * 1000; // 2 minutes in milliseconds

export default function Home() {
  const [showScreensaver, setShowScreensaver] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());

  useEffect(() => {
    initOneko();
  }, []);

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

    const idleCheck = setInterval(checkIdle, 1000);

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

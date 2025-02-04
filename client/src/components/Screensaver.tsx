import { useEffect, useState } from 'react';
import { useWindowState } from '@/lib/windowContext';

export function Screensaver({ onActivity }: { onActivity: () => void }) {
  const [time, setTime] = useState(new Date());
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [direction, setDirection] = useState({ x: 1, y: 1 });
  const { windowStates } = useWindowState();
  
  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Bouncing animation
  useEffect(() => {
    const animate = () => {
      setPosition(prev => {
        const newPos = {
          x: prev.x + direction.x * 2,
          y: prev.y + direction.y * 2
        };

        let newDirection = { ...direction };
        if (newPos.x <= 0 || newPos.x >= window.innerWidth - 300) {
          newDirection.x *= -1;
        }
        if (newPos.y <= 0 || newPos.y >= window.innerHeight - 100) {
          newDirection.y *= -1;
        }
        setDirection(newDirection);

        return {
          x: Math.max(0, Math.min(window.innerWidth - 300, newPos.x)),
          y: Math.max(0, Math.min(window.innerHeight - 100, newPos.y))
        };
      });
    };

    const animationFrame = requestAnimationFrame(function loop() {
      animate();
      requestAnimationFrame(loop);
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [direction]);

  const handleActivity = () => {
    onActivity();
  };

  return (
    <div
      className="fixed inset-0 bg-black z-50 cursor-none"
      onClick={handleActivity}
      onMouseMove={handleActivity}
      onTouchStart={handleActivity}
    >
      <div
        className="absolute text-white font-mono"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          transition: 'transform 0.05s linear'
        }}
      >
        <div className="text-4xl mb-2">
          {time.toLocaleTimeString()}
        </div>
        <div className="text-sm opacity-70">
          Move mouse or touch screen to exit
        </div>
      </div>

      {/* CS 1.6-style decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-16 h-16 border border-white opacity-20" />
        <div className="absolute top-0 right-0 w-16 h-16 border border-white opacity-20" />
        <div className="absolute bottom-0 left-0 w-16 h-16 border border-white opacity-20" />
        <div className="absolute bottom-0 right-0 w-16 h-16 border border-white opacity-20" />
      </div>
    </div>
  );
}

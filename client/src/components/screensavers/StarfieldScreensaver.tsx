import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/themeContext";
import { useScreensaver } from "@/lib/screensaverContext";
import { MouseEvent, TouchEvent } from "react";

interface Star {
  x: number;
  y: number;
  z: number;
  prevZ: number;
}

export function StarfieldScreensaver({ onActivity }: { onActivity: (e: Event) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const { clockPosition } = useScreensaver();
  const [time, setTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleMouseActivity = (e: MouseEvent) => {
    onActivity(e.nativeEvent);
  };

  const handleTouchActivity = (e: TouchEvent) => {
    onActivity(e.nativeEvent);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions to match window
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Create stars
    const starCount = 400;
    const stars: Star[] = [];
    const speed = 2.5; // Significantly increased speed (was 1.2)
    
    // Get colors based on theme
    const getStarColor = () => {
      return theme === 'dark' ? '#ffffff' : '#000000';
    };
    
    const getBgColor = () => {
      return theme === 'dark' ? '#000000' : '#ffffff';
    };

    // Initialize stars
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * canvas.width - canvas.width / 2,
        y: Math.random() * canvas.height - canvas.height / 2,
        z: Math.random() * 1000,
        prevZ: 0
      });
    }

    // Animation loop
    const draw = () => {
      // Fill background
      ctx.fillStyle = getBgColor();
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Move to center of screen
      ctx.translate(canvas.width / 2, canvas.height / 2);
      
      // Draw and update each star
      stars.forEach(star => {
        // Save previous position
        star.prevZ = star.z;
        
        // Update z position (move star closer)
        star.z = star.z - speed;
        
        // Reset star if it's too close
        if (star.z <= 0) {
          star.x = Math.random() * canvas.width - canvas.width / 2;
          star.y = Math.random() * canvas.height - canvas.height / 2;
          star.z = 1000;
          star.prevZ = 1000;
        }
        
        // Calculate star position
        const sx = star.x / star.z * 100;
        const sy = star.y / star.z * 100;
        const px = star.x / star.prevZ * 100;
        const py = star.y / star.prevZ * 100;
        
        // Calculate star size based on z position
        const size = (1 - star.z / 1000) * 2;
        
        // Draw star
        ctx.beginPath();
        ctx.strokeStyle = getStarColor();
        ctx.lineWidth = size;
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      });
      
      // Reset transformation
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };

    // Run animation at higher frame rate for smoother motion
    const interval = setInterval(draw, 16); // ~60fps (was 33ms)

    // Cleanup
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [theme]);

  // Clock position styles
  const getClockStyles = () => {
    if (clockPosition === 'center') {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        textAlign: "center" as const
      };
    } else {
      return {
        top: "20px",
        right: "20px",
        textAlign: "right" as const
      };
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 cursor-none"
      onClick={handleMouseActivity}
      onMouseMove={handleMouseActivity}
      onTouchStart={handleTouchActivity}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
      
      {/* Clock overlay */}
      <div 
        className="absolute font-mono"
        style={{
          ...getClockStyles(),
          color: theme === 'dark' ? "rgba(255, 255, 255, 0.8)" : "rgba(0, 0, 0, 0.8)",
          textShadow: theme === 'dark' 
            ? "0 0 10px rgba(100, 100, 255, 0.5)" 
            : "0 0 10px rgba(0, 0, 100, 0.5)"
        }}
      >
        <div className={clockPosition === 'center' ? "text-8xl" : "text-4xl"}>
          {time.toLocaleTimeString()}
        </div>
        <div className={`mt-2 opacity-70 ${clockPosition === 'center' ? "text-xl" : "text-sm"}`}>
          {time.toLocaleDateString()}
        </div>
      </div>
      
      <div 
        className="absolute text-sm opacity-70"
        style={{
          right: "20px",
          bottom: "20px",
          color: theme === 'dark' ? "rgba(255, 255, 255, 0.6)" : "rgba(0, 0, 0, 0.6)"
        }}
      >
        Double click or press any key to exit
      </div>
    </div>
  );
} 
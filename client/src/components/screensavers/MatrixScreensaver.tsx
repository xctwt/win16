import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/themeContext";

export function MatrixScreensaver({ onActivity }: { onActivity: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

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

    // Matrix effect variables
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = [];
    
    // Initialize drops at random positions
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.floor(Math.random() * canvas.height / fontSize);
    }

    // Characters to display (can be customized)
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789$+-*/=%\"'#&_(),.;:?!\\|{}<>[]^~";
    
    // Set color based on theme
    const getColor = () => {
      return theme === 'dark' ? '#0f0' : '#006600';
    };
    
    const getBgColor = () => {
      return theme === 'dark' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
    };

    // Animation loop
    const draw = () => {
      // Semi-transparent background to create fade effect
      ctx.fillStyle = getBgColor();
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = getColor();
      ctx.font = `${fontSize}px monospace`;
      
      // Loop through each column
      for (let i = 0; i < drops.length; i++) {
        // Get random character
        const text = chars[Math.floor(Math.random() * chars.length)];
        
        // Draw the character
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        
        // Move drop down or reset to top
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        
        drops[i]++;
      }
    };

    // Run animation
    const interval = setInterval(draw, 33);

    // Cleanup
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [theme]);

  const handleActivity = () => {
    onActivity();
  };

  return (
    <div
      className="fixed inset-0 z-50 cursor-none"
      onClick={handleActivity}
      onMouseMove={handleActivity}
      onTouchStart={handleActivity}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
} 
import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/themeContext";

interface Bubble {
  x: number;
  y: number;
  radius: number;
  dx: number;
  dy: number;
  color: string;
  alpha: number;
}

export function BubblesScreensaver({ onActivity }: { onActivity: () => void }) {
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

    // Create bubbles
    const bubbleCount = 50;
    const bubbles: Bubble[] = [];

    // Get colors based on theme
    const getColors = () => {
      return theme === "dark"
        ? ["#3498db", "#9b59b6", "#2ecc71", "#f1c40f", "#e74c3c"]
        : ["#2980b9", "#8e44ad", "#27ae60", "#f39c12", "#c0392b"];
    };

    const getBgColor = () => {
      return theme === "dark"
        ? "rgba(0, 0, 0, 0.2)"
        : "rgba(255, 255, 255, 0.2)";
    };

    // Initialize bubbles
    for (let i = 0; i < bubbleCount; i++) {
      const colors = getColors();
      const radius = Math.random() * 40 + 10;
      bubbles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: radius,
        dx: (Math.random() - 0.5) * 2,
        dy: (Math.random() - 0.5) * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.5 + 0.1,
      });
    }

    // Animation loop
    const draw = () => {
      // Semi-transparent background to create fade effect
      ctx.fillStyle = getBgColor();
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw and update each bubble
      bubbles.forEach((bubble) => {
        // Draw bubble
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
        ctx.fillStyle =
          bubble.color +
          Math.floor(bubble.alpha * 255)
            .toString(16)
            .padStart(2, "0");
        ctx.fill();

        // Update position
        bubble.x += bubble.dx;
        bubble.y += bubble.dy;

        // Bounce off edges
        if (
          bubble.x + bubble.radius > canvas.width ||
          bubble.x - bubble.radius < 0
        ) {
          bubble.dx = -bubble.dx;
        }

        if (
          bubble.y + bubble.radius > canvas.height ||
          bubble.y - bubble.radius < 0
        ) {
          bubble.dy = -bubble.dy;
        }
      });
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

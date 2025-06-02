import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/themeContext";
import { useScreensaver } from "@/lib/screensaverContext";
import { MouseEvent, TouchEvent } from "react";

interface Spark {
  x: number;
  y: number;
  age: number;
  acceleration: number;
  color: string;
  opacity: number;
  go: () => void;
}

export function RainScreensaver({
  onActivity,
}: {
  onActivity: (e: Event) => void;
}) {
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

    // Configuration options
    const OPT = {
      amount: 5000,
      speed: 0.05, // pixels per frame
      lifetime: 200,
      direction: { x: -0.5, y: 1 },
      size: [2, 2],
      maxopacity: 1,
      color: theme === "dark" ? "255, 255, 255" : "0, 0, 0", // Black and white based on theme
      randColor: false,
      acceleration: [5, 40],
    };

    // Adjust for mobile if needed
    if (window.innerWidth < 520) {
      OPT.speed = 0.05;
    }

    // Set canvas dimensions to match window
    const setCanvasWidth = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    setCanvasWidth();
    window.addEventListener("resize", setCanvasWidth);

    // Helper function for random numbers
    const rand = (min: number, max: number) => {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    // Spark constructor
    function createSpark(x: number, y: number): Spark {
      const age = 0;
      const acceleration = rand(OPT.acceleration[0], OPT.acceleration[1]);
      const color = OPT.color;
      const opacity = OPT.maxopacity - age / (OPT.lifetime * rand(1, 10));

      return {
        x,
        y,
        age,
        acceleration,
        color,
        opacity,
        go: function () {
          this.x += (OPT.speed * OPT.direction.x * this.acceleration) / 2;
          this.y += (OPT.speed * OPT.direction.y * this.acceleration) / 2;

          this.opacity = OPT.maxopacity - ++this.age / OPT.lifetime;
        },
      };
    }

    // Add a new spark
    function addSpark(sparks: Spark[]) {
      let x = rand(-200, window.innerWidth + 200);
      let y = rand(-200, window.innerHeight + 200);
      sparks.push(createSpark(x, y));
    }

    // Draw a spark
    function drawSpark(ctx: CanvasRenderingContext2D, spark: Spark) {
      let x = spark.x,
        y = spark.y;

      spark.go();

      ctx.beginPath();
      ctx.fillStyle = `rgba(${spark.color}, ${spark.opacity})`;
      ctx.rect(x, y, OPT.size[0], OPT.size[1]);
      ctx.fill();
    }

    // Initialize sparks array
    let sparks: Spark[] = [];

    // Add sparks at a controlled rate
    const sparkInterval = setInterval(() => {
      if (sparks.length < OPT.amount) {
        addSpark(sparks);
      }
    }, 1000 / OPT.amount);

    // Animation loop
    function draw() {
      if (!ctx || !canvas) return;

      ctx.fillStyle =
        theme === "dark" ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      sparks.forEach((spark, i, array) => {
        if (spark.opacity <= 0) {
          array.splice(i, 1);
        } else {
          drawSpark(ctx, spark);
        }
      });

      animationFrame = window.requestAnimationFrame(draw);
    }

    // Start the animation
    let animationFrame = window.requestAnimationFrame(draw);

    // Cleanup
    return () => {
      clearInterval(sparkInterval);
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", setCanvasWidth);
    };
  }, [theme]);

  // Clock position styles
  const getClockStyles = () => {
    if (clockPosition === "center") {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        textAlign: "center" as const,
      };
    } else {
      return {
        top: "20px",
        right: "20px",
        textAlign: "right" as const,
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
          color:
            theme === "dark"
              ? "rgba(255, 255, 255, 0.8)"
              : "rgba(0, 0, 0, 0.8)",
          textShadow:
            theme === "dark"
              ? "0 0 10px rgba(255, 255, 255, 0.3)"
              : "0 0 10px rgba(0, 0, 0, 0.3)",
        }}
      >
        <div className={clockPosition === "center" ? "text-8xl" : "text-4xl"}>
          {time.toLocaleTimeString()}
        </div>
        <div
          className={`mt-2 opacity-70 ${clockPosition === "center" ? "text-xl" : "text-sm"}`}
        >
          {time.toLocaleDateString()}
        </div>
      </div>

      <div
        className="absolute text-sm opacity-70"
        style={{
          right: "20px",
          bottom: "20px",
          color:
            theme === "dark"
              ? "rgba(255, 255, 255, 0.6)"
              : "rgba(0, 0, 0, 0.6)",
        }}
      >
        Double click or press any key to exit
      </div>
    </div>
  );
}

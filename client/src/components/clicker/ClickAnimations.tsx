import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Particle {
  id: number;
  value: number;
  x: number;
  y: number;
  isCritical: boolean;
  createdAt: number;
}

const PARTICLE_LIFETIME_MS = 1000;

/** One floating "+N" number. */
function ClickAnimation({
  value,
  x,
  y,
  isCritical = false,
}: {
  value: number;
  x: number;
  y: number;
  isCritical?: boolean;
}) {
  const [opacity, setOpacity] = useState(1);
  const [posY, setPosY] = useState(y);
  const [posX, setPosX] = useState(x);
  const [scale, setScale] = useState(1);

  // Generate random values for this specific animation instance
  const randomFactors = useRef({
    xSpeed: Math.random() * 2 - 1, // Random value between -1 and 1
    ySpeed: -(Math.random() * 0.5 + 0.5), // Random upward speed
    wobble: Math.random() * 6 + 2, // Random wobble frequency
    wobbleAmount: Math.random() * 15 + 5, // Random wobble amount
    path: Math.floor(Math.random() * 3), // Random path type (0, 1, or 2)
  });

  useEffect(() => {
    // Use requestAnimationFrame for smoother animation
    let animationFrameId: number;
    let startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      // Complete animation in 800ms
      const progress = Math.min(elapsed / 800, 1);

      setOpacity(1 - progress);

      // Apply different movement patterns based on random path type
      const { xSpeed, ySpeed, wobble, wobbleAmount, path } =
        randomFactors.current;

      // Base vertical movement (always goes up)
      const baseYMovement = y + ySpeed * progress * 100;

      // Different horizontal movement patterns
      let newX;
      if (path === 0) {
        // Zigzag pattern
        newX = x + Math.sin(progress * wobble) * wobbleAmount;
      } else if (path === 1) {
        // Curved path
        newX = x + xSpeed * progress * 40;
      } else {
        // Spiral-like
        newX = x + Math.sin(progress * wobble) * wobbleAmount * (1 - progress);
      }

      setPosY(baseYMovement);
      setPosX(newX);
      setScale(1 + progress * 0.5); // Grow slightly as it rises

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [x, y]);

  if (opacity <= 0) return null;

  return (
    <div
      className={`fixed pointer-events-none font-bold ${
        isCritical ? "text-yellow-400 dark:text-yellow-400" : "text-foreground"
      }`}
      style={{
        left: posX,
        top: posY,
        opacity,
        transform: `scale(${isCritical ? 1.5 * scale : scale})`,
        zIndex: 10000,
        textShadow: isCritical
          ? "0 0 8px rgba(255, 215, 0, 0.8)"
          : "0 0 4px rgba(128, 128, 128, 0.5)",
        fontSize: "16px",
      }}
    >
      +{value}
    </div>
  );
}

/** Floating "+N" numbers shown where the player clicks. */
export function useClickAnimations() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const nextId = useRef(0);

  // Drop particles once their animation is over.
  useEffect(() => {
    if (!particles.length) return;
    const timer = setTimeout(() => {
      const cutoff = Date.now() - PARTICLE_LIFETIME_MS;
      setParticles((list) => list.filter((p) => p.createdAt > cutoff));
    }, 100);
    return () => clearTimeout(timer);
  }, [particles]);

  const spawn = useCallback((x: number, y: number, value: number, isCritical: boolean, multiplier: number) => {
    const createdAt = Date.now();
    const particle = (value: number, dx = 0, dy = 0): Particle => ({
      id: nextId.current++,
      value,
      x: x + dx,
      y: y + dy,
      isCritical,
      createdAt,
    });

    // The first particle always shows the real value.
    const batch = [particle(value)];
    if (isCritical && value >= 10) {
      // Bigger crits burst into more particles, each showing 25-75% of the value.
      const count = 3 + Math.min(4, Math.floor(Math.log10(value)));
      const min = Math.max(2, Math.floor(value * 0.25));
      const max = Math.floor(value * 0.75);
      for (let i = 1; i < count; i++) {
        const shown = Math.floor(Math.random() * (max - min + 1) + min);
        batch.push(particle(shown, Math.random() * 60 - 30, Math.random() * 40 - 20));
      }
    } else if (!isCritical && value > 10) {
      // Big regular hits get a couple of smaller particles showing 33-66%.
      const count = multiplier > 100 ? 3 : multiplier > 10 ? 2 : 1;
      for (let i = 1; i < count; i++) {
        const shown = Math.floor(value * (0.33 + Math.random() * 0.33));
        batch.push(particle(shown, Math.random() * 30 - 15, Math.random() * 20 - 10));
      }
    }
    setParticles((list) => [...list, ...batch]);
  }, []);

  // Portaled to <body>: inside the draggable window, `fixed` would be relative to the window.
  const layer = createPortal(
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 10000 }}>
      {particles.map((p) => (
        <ClickAnimation key={p.id} value={p.value} x={p.x} y={p.y} isCritical={p.isCritical} />
      ))}
    </div>,
    document.body,
  );

  return { layer, spawn };
}

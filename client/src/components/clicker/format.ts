import { PRESTIGE_LEVELS } from "@shared/clicker";

export function formatCount(num: number | null | undefined): string {
  if (num == null || Number.isNaN(num)) return "0";
  return num > 99_000_000 ? num.toExponential(2) : num.toLocaleString();
}

// Spelled out in full so Tailwind generates them; one per entry in PRESTIGE_LEVELS.
const PRESTIGE_CLASSES = [
  "text-foreground",
  "text-amber-600",
  "text-gray-300",
  "text-yellow-400",
  "text-cyan-200",
  "text-blue-300",
  "text-purple-400",
  "text-red-500",
];

/** Tailwind class for a prestige level's colour. */
export const prestigeClass = (prestige: number) => PRESTIGE_CLASSES[Math.min(prestige, PRESTIGE_CLASSES.length - 1)];

/** Tailwind class for a leaderboard entry's stored colour. */
export function scoreColorClass(color?: string): string {
  if (!color) return "";
  if (color === "theme-adaptive") return "text-foreground";
  const level = PRESTIGE_LEVELS.findIndex((l) => l.color === color);
  return level === -1 ? "" : PRESTIGE_CLASSES[level];
}

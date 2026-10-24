// The clicker's rules, shared by the browser and the server. The browser plays
// with them; the server replays the same moves to work out the real score, so
// a score can only be as high as the clicks and the clock allow.
//
// Everything here must be deterministic: same state + same events = same result.

export const UPGRADES = ["multiplier", "autoClicker", "autoSpeed", "critChance", "critDamage"] as const;
export type Upgrade = (typeof UPGRADES)[number];
export type Action = "click" | Upgrade | "prestige";

/** Actions travel as small numbers to keep event batches compact. */
export const ACTION_CODES: readonly Action[] = ["click", ...UPGRADES, "prestige"];

/** `[time, action]`: time is game milliseconds since the session started. */
export type ClickerEvent = [t: number, code: number];

export interface ClickerState {
  /** Game time in ms. Only advances while the game is open. */
  t: number;
  count: number;
  multiplier: number;
  autoClickers: number;
  /** Auto-clicker ticks per second. */
  autoSpeed: number;
  critChance: number;
  critDamage: number;
  prestige: number;
  /** Fraction of the next auto-clicker tick already elapsed. */
  tickProgress: number;
  /** PRNG state for critical hits. */
  rng: number;
}

export const PRESTIGE_LEVELS = [
  { name: "None", color: "foreground" },
  { name: "Bronze", color: "amber-600" },
  { name: "Silver", color: "gray-300" },
  { name: "Gold", color: "yellow-400" },
  { name: "Platinum", color: "cyan-200" },
  { name: "Diamond", color: "blue-300" },
  { name: "Master", color: "purple-400" },
  { name: "Grandmaster", color: "red-500" },
] as const;

export const prestigeLevel = (prestige: number) => PRESTIGE_LEVELS[Math.min(prestige, PRESTIGE_LEVELS.length - 1)];

/** Fastest a person can plausibly click, enforced by the server. */
export const MAX_CLICKS_PER_SECOND = 20;

export function newGame(seed: number, prestige = 0): ClickerState {
  return {
    t: 0,
    count: 0,
    multiplier: 1,
    autoClickers: 0,
    autoSpeed: 1,
    critChance: 0.05,
    critDamage: 5,
    prestige,
    tickProgress: 0,
    rng: seed | 0,
  };
}

/** Start over after saving a score. Prestige carries over; its bonuses don't. */
export const resetGame = (s: ClickerState): ClickerState => ({
  ...newGame(s.rng, s.prestige),
  t: s.t,
});

export function upgradeCost(s: ClickerState, upgrade: Upgrade): number {
  switch (upgrade) {
    case "multiplier":
      return Math.floor(s.multiplier * 100 * 1.2 ** s.multiplier);
    case "autoClicker":
      return Math.floor((s.autoClickers + 1) * 50 * 1.3 ** s.autoClickers);
    case "autoSpeed":
      return Math.floor(s.autoSpeed * 200 * 2 ** s.autoSpeed);
    case "critChance":
      return Math.floor(s.critChance * 10000 * 1.5 ** (s.critChance * 10));
    case "critDamage":
      return Math.floor(s.critDamage * 300 * 1.4 ** (s.critDamage - 5));
  }
}

export const prestigeCost = (s: ClickerState) => 1_000_000 * 10 ** s.prestige;

export const MAX_CRIT_CHANCE = 0.5;

export function canBuy(s: ClickerState, upgrade: Upgrade): boolean {
  if (s.count < upgradeCost(s, upgrade)) return false;
  if (upgrade === "autoSpeed") return s.autoClickers > 0;
  if (upgrade === "critChance") return s.critChance < MAX_CRIT_CHANCE;
  return true;
}

/** Run the auto-clickers up to game time `t`. */
export function advance(s: ClickerState, t: number): ClickerState {
  if (t <= s.t) return s;
  let tickProgress = s.tickProgress + ((t - s.t) * s.autoSpeed) / 1000;
  const ticks = Math.floor(tickProgress);
  tickProgress -= ticks;
  return { ...s, t, tickProgress, count: s.count + ticks * s.autoClickers * s.multiplier };
}

/** mulberry32 */
function random(seed: number): [value: number, seed: number] {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

export interface ApplyResult {
  state: ClickerState;
  /** Points a click earned, and whether it was a critical hit. */
  click?: { value: number; critical: boolean };
}

/**
 * Apply one event. Returns null when the move isn't allowed
 * (time going backwards, not enough points, unknown action).
 */
export function apply(prev: ClickerState, [t, code]: ClickerEvent): ApplyResult | null {
  const action = ACTION_CODES[code];
  if (!action || !Number.isInteger(t) || t < prev.t) return null;
  const s = advance(prev, t);

  if (action === "click") {
    const [roll, rng] = random(s.rng);
    const critical = roll < s.critChance;
    const value = critical ? s.multiplier * s.critDamage : s.multiplier;
    return { state: { ...s, rng, count: s.count + value }, click: { value, critical } };
  }

  if (action === "prestige") {
    if (s.count < prestigeCost(s)) return null;
    const prestige = s.prestige + 1;
    return {
      state: {
        ...s,
        prestige,
        count: 0,
        multiplier: 1 + Math.floor(prestige / 2),
        autoClickers: 0,
        autoSpeed: 1,
        critChance: 0.05 + prestige * 0.01,
        critDamage: 5 + prestige,
      },
    };
  }

  if (!canBuy(s, action)) return null;
  const next = { ...s, count: s.count - upgradeCost(s, action) };
  switch (action) {
    case "multiplier":
      next.multiplier += 1;
      break;
    case "autoClicker":
      next.autoClickers += 1;
      break;
    case "autoSpeed":
      next.autoSpeed += 0.5;
      break;
    case "critChance":
      next.critChance = Math.min(s.critChance + 0.05, MAX_CRIT_CHANCE);
      break;
    case "critDamage":
      next.critDamage += 1;
      break;
  }
  return { state: next };
}

/** Score sent to the leaderboard. */
export const finalScore = (s: ClickerState) => Math.floor(s.count);

import { z } from "zod";
import type { BunRequest } from "bun";
import {
  ACTION_CODES,
  MAX_CLICKS_PER_SECOND,
  advance,
  apply,
  finalScore,
  newGame,
  prestigeLevel,
  resetGame,
  type ClickerEvent,
  type ClickerState,
} from "@shared/clicker";
import type { ClickerSession } from "@shared/types";
import { db } from "../lib/db";
import { clientIp, fail, json, parseJson, type AppServer } from "../lib/http";
import { RateLimiter } from "../lib/rate-limit";
import { recordScore } from "./scores";

/** Allowance for the browser's clock running slightly ahead of ours. */
const CLOCK_SLACK_MS = 5_000;
const SESSION_TTL_MS = 60 * 24 * 60 * 60_000;

interface Session {
  id: string;
  createdAt: number;
  game: ClickerState;
  /** Game times of the latest clicks, for the click-rate check. */
  recentClicks: number[];
}

const selectSession = db.query<{ id: string; created_at: number; state: string }, [string]>(
  "SELECT id, created_at, state FROM clicker_sessions WHERE id = ?",
);
const insertSession = db.query(
  "INSERT INTO clicker_sessions (id, created_at, updated_at, state) VALUES ($id, $now, $now, $state)",
);
const updateSession = db.query("UPDATE clicker_sessions SET state = $state, updated_at = $now WHERE id = $id");

function load(id: string): Session | null {
  const row = selectSession.get(id);
  if (!row) return null;
  const { game, recentClicks } = JSON.parse(row.state);
  return { id: row.id, createdAt: row.created_at, game, recentClicks };
}

function store(s: Session) {
  updateSession.run({ id: s.id, now: Date.now(), state: JSON.stringify({ game: s.game, recentClicks: s.recentClicks }) });
}

const pruneSessions = () =>
  db.query("DELETE FROM clicker_sessions WHERE updated_at < ?").run(Date.now() - SESSION_TTL_MS);
pruneSessions();
setInterval(pruneSessions, 60 * 60_000).unref();

/**
 * Replay a batch of moves on the session. Stops at the first move that isn't
 * allowed: the game clock running ahead of the real one, clicking faster than
 * a person can, or buying something the player can't afford.
 */
function play(s: Session, events: ClickerEvent[]): boolean {
  const realElapsed = Date.now() - s.createdAt + CLOCK_SLACK_MS;
  for (const event of events) {
    const [t] = event;
    if (t > realElapsed) return false;
    if (ACTION_CODES[event[1]] === "click") {
      const window = s.recentClicks;
      if (window.length >= MAX_CLICKS_PER_SECOND && t - window[window.length - MAX_CLICKS_PER_SECOND] < 1000) {
        return false;
      }
      window.push(t);
      if (window.length > MAX_CLICKS_PER_SECOND) window.shift();
    }
    const result = apply(s.game, event);
    if (!result) return false;
    s.game = result.state;
  }
  return true;
}

const eventsSchema = z
  .array(z.tuple([z.number().int().min(0), z.number().int().min(0).max(ACTION_CODES.length - 1)]))
  .max(2000);

const sessionCreations = new RateLimiter(30, 60 * 60_000);
const saves = new RateLimiter(10, 60 * 60_000);

const reply = (s: Session, status = 200, error?: string) =>
  json({ ...(error && { error }), id: s.id, state: s.game } satisfies ClickerSession & { error?: string }, status);

const desync = (s: Session) => reply(s, 409, "That move wasn't allowed; your game was synced with the server.");

export const clickerRoutes = {
  "/api/clicker": {
    POST: (req: BunRequest, server: AppServer) => {
      if (!sessionCreations.take(clientIp(req, server))) return fail(429, "Too many new games. Try again later.");
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      const s: Session = { id: crypto.randomUUID(), createdAt: Date.now(), game: newGame(seed), recentClicks: [] };
      insertSession.run({ id: s.id, now: s.createdAt, state: JSON.stringify({ game: s.game, recentClicks: [] }) });
      return reply(s);
    },
  },

  "/api/clicker/:id": {
    GET: (req: BunRequest<"/api/clicker/:id">) => {
      const s = load(req.params.id);
      return s ? reply(s) : fail(404, "Game not found");
    },
  },

  "/api/clicker/:id/events": {
    POST: async (req: BunRequest<"/api/clicker/:id/events">) => {
      const body = await parseJson(req, z.object({ events: eventsSchema }));
      if (!body) return fail(400, "Invalid events");
      const s = load(req.params.id);
      if (!s) return fail(404, "Game not found");

      const ok = play(s, body.events);
      store(s);
      return ok ? reply(s) : desync(s);
    },
  },

  "/api/clicker/:id/save": {
    POST: async (req: BunRequest<"/api/clicker/:id/save">, server: AppServer) => {
      // The browser sends its pending moves to /events first, then the current
      // game time, so auto-clicker points since the last move count too.
      const body = await parseJson(req, z.object({ name: z.string().trim().min(1).max(50), t: z.number().int().min(0) }));
      if (!body) return fail(400, "Invalid score data");
      const s = load(req.params.id);
      if (!s) return fail(404, "Game not found");
      s.game = advance(s.game, Math.min(body.t, Date.now() - s.createdAt + CLOCK_SLACK_MS));

      const score = finalScore(s.game);
      if (score <= 0) return fail(400, "Score is 0, nothing to save.");
      if (!saves.take(clientIp(req, server))) return fail(429, "Too many score submissions. Try again later.");

      const { color } = prestigeLevel(s.game.prestige);
      const error = recordScore({
        name: body.name,
        score,
        prestige: s.game.prestige,
        color: color === "foreground" ? "theme-adaptive" : color,
      });
      if (error) return fail(400, error);

      s.game = resetGame(s.game);
      store(s);
      return reply(s);
    },
  },

  "/api/clicker/:id/reset": {
    POST: (req: BunRequest<"/api/clicker/:id/reset">) => {
      const s = load(req.params.id);
      if (!s) return fail(404, "Game not found");
      s.game = resetGame(s.game);
      store(s);
      return reply(s);
    },
  },
};

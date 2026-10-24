import { join } from "node:path";
import { z } from "zod";
import type { BunRequest } from "bun";
import type { Score, SeasonsResponse } from "@shared/types";
import { DATA_DIR } from "../config";
import { JsonStore } from "../lib/json-store";
import { clientIp, fail, json, parseJson, sha256, type AppServer } from "../lib/http";
import { RateLimiter } from "../lib/rate-limit";

interface ScoresData {
  seasons: Record<string, Score[]>;
  currentSeason: number;
}

const TOKEN_MAX_AGE_MS = 10 * 60_000;

const store = await JsonStore.open<ScoresData>(join(DATA_DIR, "scores.json"), (raw) => {
  // Season 1 was stored as a bare array.
  if (Array.isArray(raw)) return { seasons: { "1": raw, "2": [] }, currentSeason: 2 };
  const data = raw as Partial<ScoresData> | undefined;
  if (!data?.seasons) return { seasons: { "1": [], "2": [] }, currentSeason: 2 };
  return { seasons: data.seasons, currentSeason: data.currentSeason ?? 2 };
});

const submissions = new RateLimiter(10, 60 * 60_000);

const byPrestigeThenScore = (a: Score, b: Score) =>
  (b.prestige || 0) - (a.prestige || 0) || b.score - a.score;

const isValidScore = (s: unknown): s is Score =>
  !!s && typeof s === "object" && typeof (s as Score).score === "number" && !Number.isNaN((s as Score).score);

const submitSchema = z.object({
  name: z.string().trim().min(1).max(50),
  score: z.number().min(0).max(Number.MAX_SAFE_INTEGER),
  prestige: z.number().int().min(0).max(1000).default(0),
  color: z.string().regex(/^[a-z0-9-]{1,32}$/).optional(),
  timestamp: z.number().optional(),
  token: z.string().optional(),
});

export const scoreRoutes = {
  "/api/seasons": {
    GET: () => {
      const seasons = Object.keys(store.data.seasons)
        .map(Number)
        .filter((n) => !Number.isNaN(n))
        .sort((a, b) => a - b);
      if (!seasons.includes(1)) seasons.unshift(1);
      return json({ seasons, currentSeason: store.data.currentSeason } satisfies SeasonsResponse);
    },
  },

  "/api/scores": {
    GET: (req: BunRequest) => {
      const param = new URL(req.url).searchParams.get("season") ?? "current";
      const key = param === "current" ? String(store.data.currentSeason) : param;
      const season = store.data.seasons[key];
      if (!season) return fail(404, "Season not found");

      // Keep each player's best score only.
      const best = new Map<string, Score>();
      for (const s of Array.isArray(season) ? season.filter(isValidScore) : []) {
        const prev = best.get(s.name);
        if (!prev || s.score > prev.score) best.set(s.name, s);
      }

      const scores = [...best.values()].sort(byPrestigeThenScore).map((s) => ({
        name: s.name || "Unknown",
        score: s.score,
        date: s.date || new Date().toISOString(),
        prestige: typeof s.prestige === "number" ? s.prestige : 0,
        color: s.color || "theme-adaptive",
      }));
      return json(scores);
    },

    POST: async (req: BunRequest, server: AppServer) => {
      if (!submissions.take(clientIp(req, server))) {
        return fail(429, "Too many score submissions. Try again later.");
      }

      const body = await parseJson(req, submitSchema);
      if (!body) return fail(400, "Invalid score data");
      const { name, score, prestige, color, timestamp, token } = body;

      let verificationStatus = "none";
      if (timestamp && token) {
        if (token !== sha256(`${timestamp}:${score}`)) return fail(403, "Score verification failed");
        if (Date.now() - timestamp > TOKEN_MAX_AGE_MS) return fail(403, "Verification token expired");
        verificationStatus = "success";
      }

      const key = String(store.data.currentSeason);
      const season = Array.isArray(store.data.seasons[key]) ? store.data.seasons[key] : [];
      store.data.seasons[key] = season;

      const entry: Score = {
        name,
        score,
        date: new Date().toISOString(),
        prestige,
        color: !color || color === "foreground" ? "theme-adaptive" : color,
      };

      const existing = season.findIndex((s) => s.name === name);
      if (existing !== -1) {
        if (score <= season[existing].score) {
          return fail(400, "A score with this name and higher score already exists. Please enter a different name.");
        }
        season[existing] = entry;
      } else {
        season.push(entry);
      }
      season.sort(byPrestigeThenScore);
      store.save();

      return json({ success: true, verificationStatus });
    },
  },
};

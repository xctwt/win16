import type { BunRequest } from "bun";
import type { Score, SeasonsResponse } from "@shared/types";
import { db, meta } from "../lib/db";
import { fail, json } from "../lib/http";

const currentSeason = () => Number(meta.get("current_season"));

const listSeasons = db.query<{ id: number }, []>("SELECT id FROM seasons ORDER BY id");
const seasonExists = db.query<{ id: number }, [number]>("SELECT id FROM seasons WHERE id = ?");
const listScores = db.query<Score, [number]>(`
  SELECT name, score, date, prestige, color FROM scores
  WHERE season = ? ORDER BY prestige DESC, score DESC, rowid
`);
const bestScore = db.query<{ score: number }, [number, string]>(
  "SELECT score FROM scores WHERE season = ? AND name = ?",
);
const upsertScore = db.query(`
  INSERT INTO scores (season, name, score, prestige, color, date) VALUES ($season, $name, $score, $prestige, $color, $date)
  ON CONFLICT (season, name) DO UPDATE SET score = excluded.score, prestige = excluded.prestige,
    color = excluded.color, date = excluded.date
`);

/**
 * Put a score on the current season's leaderboard. Each name keeps one entry,
 * which can only be replaced by a higher score. Returns an error message on failure.
 */
export function recordScore(entry: Omit<Score, "date">): string | null {
  const season = currentSeason();
  const existing = bestScore.get(season, entry.name);
  if (existing && entry.score <= existing.score) {
    return "A score with this name and higher score already exists. Please enter a different name.";
  }
  db.transaction(() => {
    db.query("INSERT OR IGNORE INTO seasons (id) VALUES (?)").run(season);
    upsertScore.run({ season, ...entry, date: new Date().toISOString() });
  })();
  return null;
}

export const scoreRoutes = {
  "/api/seasons": {
    GET: () =>
      json({ seasons: listSeasons.all().map((s) => s.id), currentSeason: currentSeason() } satisfies SeasonsResponse),
  },

  "/api/scores": {
    GET: (req: BunRequest) => {
      const param = new URL(req.url).searchParams.get("season") ?? "current";
      const season = param === "current" ? currentSeason() : /^[1-9]\d{0,8}$/.test(param) ? Number(param) : NaN;
      if (!seasonExists.get(season)) return fail(404, "Season not found");

      const scores = listScores.all(season).map((s) => ({
        name: s.name || "Unknown",
        score: s.score,
        date: s.date || new Date().toISOString(),
        prestige: s.prestige,
        color: s.color || "theme-adaptive",
      }));
      return json(scores);
    },

    // Scores are saved through a clicker session now (see clicker.ts), so the
    // server can check them. Tell pages still running the old code to reload.
    POST: () => fail(410, "The clicker was updated. Reload the page to save your score."),
  },
};

import { Database } from "bun:sqlite";
import { mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR, UPLOADS_DIR } from "../config";

mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(join(DATA_DIR, "win16.db"), { create: true, strict: true });

db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA synchronous = NORMAL");
db.run("PRAGMA busy_timeout = 5000");

db.run(`
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY
  );
  CREATE TABLE IF NOT EXISTS scores (
    season   INTEGER NOT NULL,
    name     TEXT NOT NULL,
    score    REAL NOT NULL,
    prestige INTEGER NOT NULL DEFAULT 0,
    color    TEXT,
    date     TEXT,
    PRIMARY KEY (season, name)
  );
  CREATE TABLE IF NOT EXISTS messages (
    id        INTEGER PRIMARY KEY,
    nickname  TEXT NOT NULL,
    content   TEXT NOT NULL,
    timestamp TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS drawings (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    author     TEXT NOT NULL,
    image_data TEXT NOT NULL,
    timestamp  TEXT NOT NULL,
    upvotes    INTEGER NOT NULL DEFAULT 0,
    downvotes  INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS votes (
    drawing_id INTEGER NOT NULL,
    ip         TEXT NOT NULL,
    client_id  TEXT NOT NULL,
    vote_type  TEXT NOT NULL,
    timestamp  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS votes_by_ip ON votes (drawing_id, ip);
  CREATE INDEX IF NOT EXISTS votes_by_client ON votes (drawing_id, client_id);
  CREATE TABLE IF NOT EXISTS clicker_sessions (
    id         TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    state      TEXT NOT NULL
  );
`);

const getMeta = db.query<{ value: string }, [string]>("SELECT value FROM meta WHERE key = ?");
const setMeta = db.query<void, [string, string]>(
  "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
);

export const meta = {
  get: (key: string): string | undefined => getMeta.get(key)?.value,
  set: (key: string, value: string | number) => void setMeta.run(key, String(value)),
};

// ---- One-time import of the JSON files older versions kept ----

type Row = Record<string, unknown>;
const rows = (v: unknown): Row[] => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);
const str = (v: unknown) => (typeof v === "string" ? v : null);
const num = (v: unknown) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);

/** Imports `file` once, then renames it to `*.migrated` so it stays around as a backup. */
async function importOnce(name: string, file: string, load: (raw: unknown) => void) {
  if (meta.get(`imported:${name}`)) return;
  const f = Bun.file(file);
  if (await f.exists()) {
    const raw = await f.json().catch(() => undefined);
    db.transaction(() => {
      load(raw);
      meta.set(`imported:${name}`, new Date().toISOString());
    })();
    renameSync(file, `${file}.migrated`);
    console.log(`Imported ${file} into SQLite`);
  } else {
    meta.set(`imported:${name}`, "none");
  }
}

await importOnce("scores", join(DATA_DIR, "scores.json"), (raw) => {
  // Season 1 was stored as a bare array.
  const data = (Array.isArray(raw) ? { seasons: { 1: raw, 2: [] }, currentSeason: 2 } : raw) as
    | { seasons?: Record<string, unknown>; currentSeason?: number }
    | undefined;
  const seasons = data?.seasons ?? { 1: [], 2: [] };
  meta.set("current_season", data?.currentSeason ?? 2);
  const addSeason = db.query("INSERT OR IGNORE INTO seasons (id) VALUES (?)");
  // Keep each player's best score; on ties the first entry wins, like before.
  const add = db.query(`
    INSERT INTO scores (season, name, score, prestige, color, date) VALUES ($season, $name, $score, $prestige, $color, $date)
    ON CONFLICT (season, name) DO UPDATE SET score = excluded.score, prestige = excluded.prestige,
      color = excluded.color, date = excluded.date
    WHERE excluded.score > scores.score
  `);
  for (const [key, list] of Object.entries(seasons)) {
    const season = Number(key);
    if (!Number.isInteger(season)) continue;
    addSeason.run(season);
    for (const s of rows(list)) {
      if (typeof s.score !== "number" || Number.isNaN(s.score)) continue;
      add.run({
        season,
        name: str(s.name) ?? "",
        score: s.score,
        prestige: num(s.prestige),
        color: str(s.color),
        date: str(s.date),
      });
    }
  }
});

await importOnce("messages", join(DATA_DIR, "messages.json"), (raw) => {
  // Older versions stored a bare array.
  const list = Array.isArray(raw) ? raw : (raw as { messages?: unknown } | undefined)?.messages;
  const add = db.query("INSERT OR IGNORE INTO messages (id, nickname, content, timestamp) VALUES (?, ?, ?, ?)");
  for (const m of rows(list)) {
    if (typeof m.id !== "number") continue;
    add.run(m.id, String(m.nickname ?? ""), String(m.content ?? ""), String(m.timestamp ?? new Date().toISOString()));
  }
});

await importOnce("drawings", join(UPLOADS_DIR, "metadata.json"), (raw) => {
  const data = raw as { drawings?: unknown; lastDrawingId?: unknown } | undefined;
  const add = db.query(`
    INSERT OR IGNORE INTO drawings (id, name, author, image_data, timestamp, upvotes, downvotes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  let maxId = 0;
  for (const d of rows(data?.drawings)) {
    const image = str(d.imageData);
    if (typeof d.id !== "number" || !image?.split("/").pop()!.startsWith("drawing-")) continue;
    add.run(d.id, String(d.name ?? ""), String(d.author ?? ""), image, String(d.timestamp ?? ""), num(d.upvotes), num(d.downvotes));
    maxId = Math.max(maxId, d.id);
  }
  // Ids are never reused, so a new drawing can't overwrite an old file.
  meta.set("next_drawing_id", Math.max(Number(data?.lastDrawingId) || 1, maxId + 1));
});

await importOnce("votes", join(DATA_DIR, "vote-records.json"), (raw) => {
  const add = db.query("INSERT INTO votes (drawing_id, ip, client_id, vote_type, timestamp) VALUES (?, ?, ?, ?, ?)");
  for (const v of rows(raw)) {
    if (typeof v.drawingId !== "number") continue;
    add.run(v.drawingId, String(v.ipAddress ?? ""), String(v.clientId ?? ""), String(v.voteType ?? "up"), String(v.timestamp ?? ""));
  }
});

if (!meta.get("current_season")) meta.set("current_season", 2);
db.run("INSERT OR IGNORE INTO seasons (id) VALUES (1), (?)", [Number(meta.get("current_season"))]);

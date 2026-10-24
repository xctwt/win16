import { join } from "node:path";
import { z } from "zod";
import type { BunRequest } from "bun";
import type { Drawing, PowChallenge, PowPayload } from "@shared/types";
import { UPLOADS_DIR } from "../config";
import { db, meta } from "../lib/db";
import { clientIp, fail, json, parseJson, sha256, type AppServer } from "../lib/http";
import { RateLimiter } from "../lib/rate-limit";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const POW_DIFFICULTY = 4; // leading zero hex chars
const POW_TTL_MS = 5 * 60_000;

const DRAWING_COLUMNS = `id, name, author, image_data AS imageData, timestamp,
  upvotes - downvotes AS score, upvotes, downvotes`;
const listByDate = db.query<Drawing, []>(`SELECT ${DRAWING_COLUMNS} FROM drawings ORDER BY timestamp, id`);
const listByScore = db.query<Drawing, []>(`SELECT ${DRAWING_COLUMNS} FROM drawings ORDER BY score DESC, id`);
const getDrawing = db.query<Drawing, [number]>(`SELECT ${DRAWING_COLUMNS} FROM drawings WHERE id = ?`);
const insertDrawing = db.query(`
  INSERT INTO drawings (id, name, author, image_data, timestamp) VALUES ($id, $name, $author, $imageData, $timestamp)
`);
const hasVoted = db.query<{ found: number }, [number, string, number, string]>(`
  SELECT 1 AS found WHERE EXISTS (SELECT 1 FROM votes WHERE drawing_id = ? AND ip = ?)
    OR EXISTS (SELECT 1 FROM votes WHERE drawing_id = ? AND client_id = ?)
`);
const insertVote = db.query(`
  INSERT INTO votes (drawing_id, ip, client_id, vote_type, timestamp) VALUES ($drawingId, $ip, $clientId, $voteType, $timestamp)
`);
const countVote = {
  up: db.query<void, [number]>("UPDATE drawings SET upvotes = upvotes + 1 WHERE id = ?"),
  down: db.query<void, [number]>("UPDATE drawings SET downvotes = downvotes + 1 WHERE id = ?"),
};

/** Ids are never reused, so a new drawing can't overwrite an old file. */
function takeDrawingId(): number {
  const id = Number(meta.get("next_drawing_id") ?? 1);
  meta.set("next_drawing_id", id + 1);
  return id;
}

const challenges = new Map<string, PowChallenge & { ip: string }>();
setInterval(() => {
  const now = Date.now();
  for (const [id, c] of challenges) if (c.expiresAt < now) challenges.delete(id);
}, 60_000).unref();

const voteLimiter = new RateLimiter(15, 60_000);

const randomId = (len: number) => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
};

function verifyPow(c: PowChallenge, pow: PowPayload, clientId: string): boolean {
  if (Date.now() > c.expiresAt) return false;
  const hash = sha256(`${c.prefix}:${pow.challengeId}:${clientId}:${pow.nonce}`);
  return hash === pow.hash && hash.startsWith("0".repeat(c.difficulty));
}

const IMAGE_TYPES: Record<string, string> = { png: "png", jpeg: "jpg", webp: "webp" };

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  author: z.string().trim().max(100).optional(),
  image: z.string().regex(/^data:image\/(png|jpeg|webp);base64,/),
});

const voteSchema = z.object({
  voteType: z.enum(["up", "down"]),
  clientId: z.string().min(1).max(100),
  pow: z.object({ challengeId: z.string(), nonce: z.number().int().min(0), hash: z.string() }),
});

export const drawingRoutes = {
  "/api/vote/pow-challenge": {
    GET: (req: BunRequest, server: AppServer) => {
      const challenge: PowChallenge = {
        challengeId: randomId(16),
        prefix: randomId(24),
        difficulty: POW_DIFFICULTY,
        expiresAt: Date.now() + POW_TTL_MS,
      };
      challenges.set(challenge.challengeId, { ...challenge, ip: clientIp(req, server) });
      return json(challenge);
    },
  },

  "/api/drawings": {
    GET: (req: BunRequest) => {
      const sortBy = new URL(req.url).searchParams.get("sortBy");
      return json(sortBy === "score" ? listByScore.all() : listByDate.all());
    },

    POST: async (req: BunRequest) => {
      const body = await parseJson(req, createSchema);
      if (!body) return fail(400, "Invalid drawing data");

      const [header, base64] = body.image.split(",", 2);
      const ext = IMAGE_TYPES[header.slice("data:image/".length, header.indexOf(";"))];
      const bytes = Buffer.from(base64, "base64");
      if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return fail(400, "Invalid image size");

      const id = takeDrawingId();
      const fileName = `drawing-${id}.${ext}`;
      await Bun.write(join(UPLOADS_DIR, fileName), bytes);

      insertDrawing.run({
        id,
        name: body.name,
        author: body.author || "Anonymous",
        imageData: `/uploads/${fileName}`,
        timestamp: new Date().toISOString(),
      });
      return json(getDrawing.get(id));
    },
  },

  "/api/drawings/:id/vote": {
    POST: async (req: BunRequest<"/api/drawings/:id/vote">, server: AppServer) => {
      const drawingId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(drawingId)) return fail(400, "Invalid drawing ID");

      const body = await parseJson(req, voteSchema);
      if (!body) return fail(400, "Invalid vote data");
      const { voteType, clientId, pow } = body;

      const ip = clientIp(req, server);
      if (!voteLimiter.allowed(ip)) return fail(429, "Too many votes from this IP. Please slow down.");

      const challenge = challenges.get(pow.challengeId);
      if (!challenge) return fail(400, "Unknown challenge");
      if (challenge.ip !== ip) return fail(400, "Challenge/IP mismatch");
      if (!verifyPow(challenge, pow, clientId)) return fail(400, "Invalid PoW");
      challenges.delete(challenge.challengeId);

      if (!getDrawing.get(drawingId)) return fail(404, "Drawing not found");

      // One vote per drawing per IP and per client id. Votes are final; repeat
      // votes just return the current state.
      if (!hasVoted.get(drawingId, ip, drawingId, clientId)) {
        db.transaction(() => {
          insertVote.run({ drawingId, ip, clientId, voteType, timestamp: new Date().toISOString() });
          countVote[voteType].run(drawingId);
        })();
        voteLimiter.record(ip);
      }
      return json(getDrawing.get(drawingId));
    },
  },
};

import { join } from "node:path";
import { z } from "zod";
import type { BunRequest } from "bun";
import type { Drawing, PowChallenge, PowPayload } from "@shared/types";
import { DATA_DIR, UPLOADS_DIR } from "../config";
import { JsonStore } from "../lib/json-store";
import { clientIp, fail, json, parseJson, sha256, type AppServer } from "../lib/http";
import { RateLimiter } from "../lib/rate-limit";

interface DrawingsMeta {
  drawings: Drawing[];
  /** Next id to assign (the field name is kept for compatibility with existing data). */
  lastDrawingId: number;
}

interface VoteRecord {
  drawingId: number;
  ipAddress: string;
  clientId: string;
  timestamp: string;
  voteType: "up" | "down";
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const POW_DIFFICULTY = 4; // leading zero hex chars
const POW_TTL_MS = 5 * 60_000;

const meta = await JsonStore.open<DrawingsMeta>(join(UPLOADS_DIR, "metadata.json"), (raw) => {
  const data = raw as Partial<DrawingsMeta> | undefined;
  const drawings = (Array.isArray(data?.drawings) ? data.drawings : [])
    .filter((d) => typeof d?.imageData === "string" && d.imageData.split("/").pop()!.startsWith("drawing-"))
    .map((d) => ({ ...d, score: d.score || 0, upvotes: d.upvotes || 0, downvotes: d.downvotes || 0 }));
  const maxId = drawings.reduce((m, d) => Math.max(m, d.id), 0);
  return { drawings, lastDrawingId: Math.max(Number(data?.lastDrawingId) || 1, maxId + 1) };
});

const votes = await JsonStore.open<VoteRecord[]>(join(DATA_DIR, "vote-records.json"), (raw) =>
  Array.isArray(raw) ? raw : [],
);

// One vote per drawing per IP and per client id.
const voted = new Set<string>();
for (const v of votes.data) {
  voted.add(`${v.drawingId}:ip:${v.ipAddress}`);
  voted.add(`${v.drawingId}:client:${v.clientId}`);
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
      const list = [...meta.data.drawings];
      if (sortBy === "score") list.sort((a, b) => b.score - a.score);
      else list.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
      return json(list);
    },

    POST: async (req: BunRequest) => {
      const body = await parseJson(req, createSchema);
      if (!body) return fail(400, "Invalid drawing data");

      const [header, base64] = body.image.split(",", 2);
      const ext = IMAGE_TYPES[header.slice("data:image/".length, header.indexOf(";"))];
      const bytes = Buffer.from(base64, "base64");
      if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return fail(400, "Invalid image size");

      const id = meta.data.lastDrawingId++;
      const fileName = `drawing-${id}.${ext}`;
      await Bun.write(join(UPLOADS_DIR, fileName), bytes);

      const drawing: Drawing = {
        id,
        name: body.name,
        author: body.author || "Anonymous",
        imageData: `/uploads/${fileName}`,
        timestamp: new Date().toISOString(),
        score: 0,
        upvotes: 0,
        downvotes: 0,
      };
      meta.data.drawings.push(drawing);
      meta.save();
      return json(drawing);
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

      const drawing = meta.data.drawings.find((d) => d.id === drawingId);
      if (!drawing) return fail(404, "Drawing not found");

      // Votes are final; repeat votes just return the current state.
      if (voted.has(`${drawingId}:ip:${ip}`) || voted.has(`${drawingId}:client:${clientId}`)) {
        return json(drawing);
      }

      voted.add(`${drawingId}:ip:${ip}`);
      voted.add(`${drawingId}:client:${clientId}`);
      votes.data.push({ drawingId, ipAddress: ip, clientId, timestamp: new Date().toISOString(), voteType });
      votes.save();

      if (voteType === "up") drawing.upvotes++;
      else drawing.downvotes++;
      drawing.score = drawing.upvotes - drawing.downvotes;
      meta.save();

      voteLimiter.record(ip);
      return json(drawing);
    },
  },
};

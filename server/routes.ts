import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertDrawingSchema, type InsertDrawing, type VoteRequest, type PowPayload } from "@shared/schema";
import path from "path";
import fs from "fs";

// Simple in-memory PoW challenge store
interface PowChallenge {
  id: string;
  prefix: string; // random prefix to include in hash input
  difficulty: number; // number of leading zero nybbles required
  expiresAt: number; // epoch ms
  ip: string;
}

const powChallenges = new Map<string, PowChallenge>();

// Basic rate limiting per IP (votes per time window)
const VOTE_WINDOW_MS = 60_000; // 1 minute
const MAX_VOTES_PER_WINDOW = 15; // per IP
const voteTimestampsPerIp = new Map<string, number[]>();

function cleanOldVotes(ip: string) {
  const now = Date.now();
  const arr = voteTimestampsPerIp.get(ip) || [];
  const filtered = arr.filter(ts => now - ts < VOTE_WINDOW_MS);
  voteTimestampsPerIp.set(ip, filtered);
  return filtered;
}

function canVote(ip: string) {
  const arr = cleanOldVotes(ip);
  return arr.length < MAX_VOTES_PER_WINDOW;
}

function recordVote(ip: string) {
  const arr = cleanOldVotes(ip);
  arr.push(Date.now());
  voteTimestampsPerIp.set(ip, arr);
}

function randomId(len = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Issue a PoW challenge
function createPowChallenge(ip: string, difficulty = 4): PowChallenge { // difficulty = leading zero hex nybbles
  const id = randomId();
  const prefix = randomId(24);
  const expiresAt = Date.now() + 5 * 60_000; // 5 minutes
  const challenge: PowChallenge = { id, prefix, difficulty, expiresAt, ip };
  powChallenges.set(id, challenge);
  return challenge;
}

// Verify PoW
import crypto from 'crypto';
function verifyPow(challenge: PowChallenge, payload: PowPayload, clientId: string): boolean {
  if (challenge.id !== payload.challengeId) return false;
  if (Date.now() > challenge.expiresAt) return false;
  // Input string includes prefix + drawing + voteType + clientId + nonce
  const base = `${challenge.prefix}:${payload.challengeId}:${clientId}:${payload.nonce}`;
  const hash = crypto.createHash('sha256').update(base).digest('hex');
  if (hash !== payload.hash) return false;
  // Check difficulty (leading zero nybbles)
  const requiredZeros = challenge.difficulty; // each nybble is a hex char
  for (let i = 0; i < requiredZeros; i++) {
    if (hash[i] !== '0') return false;
  }
  return true;
}

export function registerRoutes(app: Express): Server {
  // Get PoW challenge
  app.get('/api/vote/pow-challenge', (req: Request, res: Response) => {
    try {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const challenge = createPowChallenge(ip);
      res.json({ challengeId: challenge.id, prefix: challenge.prefix, difficulty: challenge.difficulty, expiresAt: challenge.expiresAt });
    } catch (e) {
      res.status(500).json({ error: 'Failed to create challenge' });
    }
  });

  // Get all drawings with optional sorting
  app.get("/api/drawings", async (req: Request, res: Response) => {
    try {
      const sortBy = (req.query.sortBy as string) === 'score' ? 'score' : 'timestamp';
      const drawings = await storage.getDrawingsSorted(sortBy);
      res.json(drawings);
    } catch (error) {
      console.error('Error fetching drawings:', error);
      res.status(500).json({ error: "Failed to fetch drawings" });
    }
  });

  // Create a new drawing
  app.post("/api/drawings", async (req: Request, res: Response) => {
    try {
      const drawingData: InsertDrawing = {
        name: req.body.name,
        author: req.body.author,
        image: req.body.image
      };
      const result = insertDrawingSchema.safeParse({
        name: drawingData.name,
        author: drawingData.author,
        imageData: drawingData.image
      });
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid drawing format",
          details: result.error.format()
        });
      }
      const drawing = await storage.createDrawing(drawingData);
      res.json(drawing);
    } catch (error) {
      console.error('Error creating drawing:', error);
      res.status(500).json({ error: "Failed to create drawing" });
    }
  });

  // Vote on a drawing (with PoW and rate limiting)
  app.post("/api/drawings/:id/vote", async (req: Request, res: Response) => {
    try {
      const drawingId = parseInt(req.params.id);
      if (isNaN(drawingId)) {
        return res.status(400).json({ error: "Invalid drawing ID" });
      }

      const { voteType, clientId, pow } = req.body as { voteType: 'up' | 'down'; clientId: string; pow: PowPayload };
      if (voteType !== 'up' && voteType !== 'down') return res.status(400).json({ error: 'Invalid vote type' });
      if (!clientId || typeof clientId !== 'string') return res.status(400).json({ error: 'Invalid client ID' });
      if (!pow || typeof pow !== 'object') return res.status(400).json({ error: 'Missing PoW data' });

      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      if (!canVote(ip)) return res.status(429).json({ error: 'Too many votes from this IP. Please slow down.' });

      const challenge = powChallenges.get(pow.challengeId);
      if (!challenge) return res.status(400).json({ error: 'Unknown challenge' });
      if (challenge.ip !== ip) return res.status(400).json({ error: 'Challenge/IP mismatch' });

      if (!verifyPow(challenge, pow, clientId)) return res.status(400).json({ error: 'Invalid PoW' });

      powChallenges.delete(challenge.id);

      const voteRequest: VoteRequest = { drawingId, voteType, clientId, pow };
      const updatedDrawing = await storage.voteDrawing(voteRequest, ip);
      recordVote(ip);
      res.json(updatedDrawing);
    } catch (error) {
      console.error('Error processing vote:', error);
      res.status(500).json({ error: "Failed to process vote" });
    }
  });

  return createServer(app);
}
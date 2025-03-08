import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertDrawingSchema, type InsertDrawing, type VoteRequest } from "@shared/schema";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load environment variables from .env file
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log('Loading environment variables from:', envPath);
  dotenv.config({ path: envPath });
} else {
  console.warn('No .env file found at:', envPath);
}

// Cloudflare Turnstile secret key from environment variables
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

// Check if Turnstile key is properly configured
if (!TURNSTILE_SECRET_KEY) {
  console.warn('WARNING: Turnstile secret key not found in environment variables. Voting will not work correctly.');
  console.warn('Please ensure your .env file contains TURNSTILE_SECRET_KEY=your_secret_key');
} else {
  console.log('Turnstile secret key loaded successfully');
}

export function registerRoutes(app: Express): Server {
  // Note: Message routes are now handled by messagesRouter in server/api/messages.ts
  
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
      // Create a drawing object that matches the InsertDrawing interface
      const drawingData: InsertDrawing = {
        name: req.body.name,
        author: req.body.author,
        image: req.body.image
      };
      
      // Validate with schema
      const result = insertDrawingSchema.safeParse({
        name: drawingData.name,
        author: drawingData.author,
        imageData: drawingData.image // Map 'image' to 'imageData' for schema validation
      });
      
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid drawing format",
          details: result.error.format()
        });
      }
      
      // Pass the validated data to storage
      const drawing = await storage.createDrawing(drawingData);
      res.json(drawing);
    } catch (error) {
      console.error('Error creating drawing:', error);
      res.status(500).json({ error: "Failed to create drawing" });
    }
  });

  // Vote on a drawing
  app.post("/api/drawings/:id/vote", async (req: Request, res: Response) => {
    try {
      const drawingId = parseInt(req.params.id);
      if (isNaN(drawingId)) {
        return res.status(400).json({ error: "Invalid drawing ID" });
      }

      const { voteType, clientId, turnstileToken } = req.body;
      
      // Validate vote type
      if (voteType !== 'up' && voteType !== 'down') {
        return res.status(400).json({ error: "Invalid vote type" });
      }
      
      // Validate client ID
      if (!clientId || typeof clientId !== 'string') {
        return res.status(400).json({ error: "Invalid client ID" });
      }
      
      // Validate Turnstile token
      if (!turnstileToken) {
        return res.status(400).json({ error: "Turnstile verification required" });
      }
      
      // Verify Turnstile token
      try {
        // Create form data
        const params = new URLSearchParams();
        params.append('secret', TURNSTILE_SECRET_KEY || '');
        params.append('response', turnstileToken);
        if (req.ip) params.append('remoteip', req.ip);

        // Make the request with the correct content type
        const turnstileResponse = await axios({
          method: 'post',
          url: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
          data: params,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        if (!turnstileResponse.data.success) {
          console.error('Turnstile verification failed:', turnstileResponse.data);
          return res.status(400).json({ 
            error: "Turnstile verification failed",
            details: turnstileResponse.data
          });
        }
      } catch (error) {
        console.error('Error verifying Turnstile token:', error);
        return res.status(400).json({ error: "Failed to verify Turnstile token" });
      }
      
      // Process the vote
      const voteRequest: VoteRequest = {
        drawingId,
        voteType,
        clientId,
        turnstileToken
      };
      
      const updatedDrawing = await storage.voteDrawing(voteRequest, req.ip || '');
      res.json(updatedDrawing);
    } catch (error) {
      console.error('Error processing vote:', error);
      res.status(500).json({ error: "Failed to process vote" });
    }
  });

  return createServer(app);
}
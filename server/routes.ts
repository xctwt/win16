import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertDrawingSchema, type InsertDrawing } from "@shared/schema";

export function registerRoutes(app: Express): Server {
  // Note: Message routes are now handled by messagesRouter in server/api/messages.ts
  
  // Get all drawings
  app.get("/api/drawings", async (_req: Request, res: Response) => {
    try {
      const drawings = await storage.getDrawings();
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

  return createServer(app);
}
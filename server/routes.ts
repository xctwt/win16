import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMessageSchema, insertDrawingSchema } from "@shared/schema";

export function registerRoutes(app: Express): Server {
  app.get("/api/messages", async (_req, res) => {
    const messages = await storage.getMessages();
    res.json(messages);
  });

  app.post("/api/messages", async (req, res) => {
    const result = insertMessageSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid message format" });
    }
    const message = await storage.createMessage(result.data);
    res.json(message);
  });

  app.get("/api/drawings", async (_req, res) => {
    const drawings = await storage.getDrawings();
    res.json(drawings);
  });

  app.post("/api/drawings", async (req, res) => {
    const result = insertDrawingSchema.safeParse({
      name: req.body.name,
      author: req.body.author,
      imageData: req.body.image
    });
    if (!result.success) {
      return res.status(400).json({ error: "Invalid drawing format" });
    }
    const drawing = await storage.createDrawing(result.data);
    res.json(drawing);
  });

  return createServer(app);
}
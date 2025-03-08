import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  nickname: text("nickname").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const drawings = pgTable("drawings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  author: text("author").notNull(),
  imageData: text("image_data").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  nickname: true,
  content: true,
});

export const insertDrawingSchema = createInsertSchema(drawings).pick({
  name: true,
  author: true,
  imageData: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;


export interface Drawing {
  id: number;
  name: string;
  author: string;
  imageData: string; // Now stores the file path instead of base64
  timestamp: Date;
  score: number; // Total score (upvotes - downvotes)
  upvotes: number; // Number of upvotes
  downvotes: number; // Number of downvotes
}

export interface InsertDrawing {
  name: string;
  author: string;
  image: string; // Still accepts base64 from client
}

// Interface for vote tracking to prevent abuse
export interface VoteRecord {
  drawingId: number;
  ipAddress: string;
  clientId: string; // Cookie-based identifier
  timestamp: Date;
  voteType: 'up' | 'down';
}

// Interface for vote request
export interface VoteRequest {
  drawingId: number;
  voteType: 'up' | 'down';
  clientId: string;
  turnstileToken: string; // Cloudflare Turnstile token
}
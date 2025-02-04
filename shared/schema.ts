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
export type InsertDrawing = z.infer<typeof insertDrawingSchema>;
export type Drawing = typeof drawings.$inferSelect;
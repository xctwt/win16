import { messages, drawings, type Message, type InsertMessage, type Drawing, type InsertDrawing } from "@shared/schema";

export interface IStorage {
  getMessages(): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  getDrawings(): Promise<Drawing[]>;
  createDrawing(drawing: InsertDrawing): Promise<Drawing>;
}

export class MemStorage implements IStorage {
  private messages: Message[];
  private drawings: Drawing[];
  private messageId: number;
  private drawingId: number;

  constructor() {
    this.messages = [];
    this.drawings = [];
    this.messageId = 1;
    this.drawingId = 1;
  }

  async getMessages(): Promise<Message[]> {
    return this.messages.slice(-50);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const message: Message = {
      id: this.messageId++,
      ...insertMessage,
      timestamp: new Date(),
    };
    this.messages.push(message);

    if (this.messages.length > 100) {
      this.messages = this.messages.slice(-100);
    }

    return message;
  }

  async getDrawings(): Promise<Drawing[]> {
    return this.drawings;
  }

  async createDrawing(insertDrawing: InsertDrawing): Promise<Drawing> {
    const drawing: Drawing = {
      id: this.drawingId++,
      ...insertDrawing,
      timestamp: new Date(),
    };
    this.drawings.push(drawing);
    return drawing;
  }
}

export const storage = new MemStorage();
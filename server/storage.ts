import { writeFile, readdir, readFile, unlink } from 'fs/promises';
import path from 'path';
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
  private uploadsDir: string;
  private metadataFile: string;

  constructor() {
    this.messages = [];
    this.drawings = [];
    this.messageId = 1;
    this.drawingId = 1;
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.metadataFile = path.join(this.uploadsDir, 'metadata.json');
    this.initStorage();
  }

  private async initStorage() {
    try {
      // Read metadata file if it exists
      try {
        const metadata = JSON.parse(
          await readFile(this.metadataFile, 'utf-8')
        );
        this.drawings = metadata.drawings || [];
        this.drawingId = metadata.lastDrawingId || 1;
      } catch (error) {
        // If file doesn't exist or is invalid, start fresh
        this.drawings = [];
        this.drawingId = 1;
      }

      // Verify all files exist and clean up missing ones
      this.drawings = this.drawings.filter(drawing => {
        const fileName = path.basename(drawing.imageData);
        return fileName.startsWith('drawing-');
      });

      // Save clean metadata
      await this.saveMetadata();
    } catch (error) {
      console.error('Error initializing storage:', error);
    }
  }

  private async saveMetadata() {
    try {
      const metadata = {
        drawings: this.drawings,
        lastDrawingId: this.drawingId,
      };
      await writeFile(
        this.metadataFile,
        JSON.stringify(metadata, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Error saving metadata:', error);
    }
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
    const drawingId = this.drawingId++;
    const fileName = `drawing-${drawingId}.jpg`;
    const filePath = path.join(this.uploadsDir, fileName);

    // Convert base64 to buffer and save as JPEG
    const base64Data = insertDrawing.image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    await writeFile(filePath, imageBuffer);

    // Create drawing record with file path instead of base64 data
    const drawing: Drawing = {
      id: drawingId,
      name: insertDrawing.name,
      author: insertDrawing.author,
      imageData: `/uploads/${fileName}`,
      timestamp: new Date(),
    };
    
    this.drawings.push(drawing);
    await this.saveMetadata();
    return drawing;
  }

  async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000) { // 7 days
    const now = new Date().getTime();
    
    // Create a new array to store the filtered drawings
    const newDrawings: Drawing[] = [];
    
    // Process each drawing
    for (const drawing of this.drawings) {
      if (now - new Date(drawing.timestamp).getTime() > maxAge) {
        try {
          const filePath = path.join(this.uploadsDir, path.basename(drawing.imageData));
          await unlink(filePath);
        } catch (error) {
          console.error('Error deleting file:', error);
          newDrawings.push(drawing); // Keep the drawing if deletion fails
        }
      } else {
        newDrawings.push(drawing); // Keep drawings that aren't too old
      }
    }

    this.drawings = newDrawings;
    await this.saveMetadata();
  }
}

export const storage = new MemStorage();

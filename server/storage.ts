import { writeFile, readdir, readFile, unlink } from 'fs/promises';
import path from 'path';
import { messages, drawings, type Message, type InsertMessage, type Drawing, type InsertDrawing } from "@shared/schema";

// Maximum number of messages to keep
const MAX_MESSAGES = 69;

// Path to messages.json file
const MESSAGES_FILE = path.join(process.cwd(), 'data/messages.json');

// Interface for messages.json data
interface MessagesData {
  messages: Message[];
  lastUpdated: string;
}

export interface IStorage {
  getMessages(): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  getDrawings(): Promise<Drawing[]>;
  createDrawing(drawing: InsertDrawing): Promise<Drawing>;
  cleanup(maxAge?: number): Promise<void>;
  saveMessagesToFile(): Promise<void>;
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
    this.initStorage().catch(err => {
      console.error('Failed to initialize storage:', err);
    });
  }

  private async initStorage(): Promise<void> {
    try {
      // Read metadata file if it exists
      try {
        const metadata = JSON.parse(
          await readFile(this.metadataFile, 'utf-8')
        );
        
        if (metadata && typeof metadata === 'object') {
          this.drawings = Array.isArray(metadata.drawings) ? metadata.drawings : [];
          this.drawingId = typeof metadata.lastDrawingId === 'number' ? metadata.lastDrawingId : 1;
        } else {
          this.drawings = [];
          this.drawingId = 1;
        }
      } catch (error) {
        // If file doesn't exist or is invalid, start fresh
        this.drawings = [];
        this.drawingId = 1;
      }

      // Verify all files exist and clean up missing ones
      this.drawings = this.drawings.filter(drawing => {
        if (!drawing || !drawing.imageData || typeof drawing.imageData !== 'string') {
          return false;
        }
        const fileName = path.basename(drawing.imageData);
        return fileName.startsWith('drawing-');
      });

      // Save clean metadata
      await this.saveMetadata();
      
      // Load messages from messages.json if it exists
      await this.loadMessagesFromFile();
    } catch (error) {
      console.error('Error initializing storage:', error);
      // Initialize with empty state to prevent further errors
      this.drawings = [];
      this.drawingId = 1;
    }
  }

  private async loadMessagesFromFile(): Promise<void> {
    try {
      console.log(`Loading messages from file: ${MESSAGES_FILE}`);
      // Ensure data directory exists
      await writeFile(path.join(process.cwd(), 'data', '.gitkeep'), '', { flag: 'a' });
      
      try {
        const data = await readFile(MESSAGES_FILE, 'utf-8');
        const messagesData = JSON.parse(data);
        
        if (messagesData && typeof messagesData === 'object' && Array.isArray(messagesData.messages)) {
          this.messages = messagesData.messages;
          console.log(`Loaded ${this.messages.length} messages from file`);
          
          // Find the highest message ID to continue from
          if (this.messages.length > 0) {
            const maxId = Math.max(...this.messages.map(m => m.id));
            this.messageId = maxId + 1;
            console.log(`Setting next message ID to ${this.messageId}`);
          }
        } else if (Array.isArray(messagesData)) {
          // Handle old format (direct array)
          this.messages = messagesData;
          console.log(`Loaded ${this.messages.length} messages from file (old format)`);
          
          // Find the highest message ID to continue from
          if (this.messages.length > 0) {
            const maxId = Math.max(...this.messages.map(m => m.id));
            this.messageId = maxId + 1;
            console.log(`Setting next message ID to ${this.messageId}`);
          }
        }
      } catch (error) {
        console.log('No existing messages file or invalid format, creating new one');
        // Create empty messages file
        const initialData: MessagesData = {
          messages: [],
          lastUpdated: new Date().toISOString()
        };
        await writeFile(MESSAGES_FILE, JSON.stringify(initialData, null, 2));
      }
    } catch (error) {
      console.error('Error loading messages from file:', error);
    }
  }

  async saveMessagesToFile(): Promise<void> {
    try {
      console.log(`Saving ${this.messages.length} messages to file`);
      const messagesData: MessagesData = {
        messages: this.messages.slice(-MAX_MESSAGES), // Keep only the last MAX_MESSAGES
        lastUpdated: new Date().toISOString()
      };
      await writeFile(MESSAGES_FILE, JSON.stringify(messagesData, null, 2));
      console.log('Messages saved to file successfully');
    } catch (error) {
      console.error('Error saving messages to file:', error);
    }
  }

  private async saveMetadata(): Promise<void> {
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
      throw new Error('Failed to save metadata');
    }
  }

  async getMessages(): Promise<Message[]> {
    return this.messages.slice(-MAX_MESSAGES);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    if (!insertMessage || typeof insertMessage !== 'object') {
      throw new Error('Invalid message data');
    }
    
    const message: Message = {
      id: this.messageId++,
      ...insertMessage,
      timestamp: new Date(),
    };
    this.messages.push(message);

    // Keep only the last MAX_MESSAGES messages
    if (this.messages.length > MAX_MESSAGES) {
      this.messages = this.messages.slice(-MAX_MESSAGES);
    }

    // Note: We no longer save to file on every message
    // Messages will be saved when the server shuts down

    return message;
  }

  async getDrawings(): Promise<Drawing[]> {
    return this.drawings;
  }

  async createDrawing(insertDrawing: InsertDrawing): Promise<Drawing> {
    if (!insertDrawing || !insertDrawing.image || !insertDrawing.name) {
      throw new Error('Invalid drawing data');
    }
    
    const drawingId = this.drawingId++;
    const fileName = `drawing-${drawingId}.jpg`;
    const filePath = path.join(this.uploadsDir, fileName);

    try {
      // Convert base64 to buffer and save as JPEG
      const base64Data = insertDrawing.image.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      await writeFile(filePath, imageBuffer);

      // Create drawing record with file path instead of base64 data
      const drawing: Drawing = {
        id: drawingId,
        name: insertDrawing.name,
        author: insertDrawing.author || 'Anonymous',
        imageData: `/uploads/${fileName}`,
        timestamp: new Date(),
      };
      
      this.drawings.push(drawing);
      await this.saveMetadata();
      return drawing;
    } catch (error) {
      console.error('Error creating drawing:', error);
      throw new Error('Failed to create drawing');
    }
  }

  async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> { // 7 days
    const now = new Date().getTime();
    
    // Create a new array to store the filtered drawings
    const newDrawings: Drawing[] = [];
    const deletionErrors: Error[] = [];
    
    // Process each drawing
    for (const drawing of this.drawings) {
      if (!drawing || !drawing.timestamp) {
        continue;
      }
      
      const drawingTime = drawing.timestamp instanceof Date 
        ? drawing.timestamp.getTime() 
        : new Date(drawing.timestamp).getTime();
      
      if (now - drawingTime > maxAge) {
        try {
          if (drawing.imageData && typeof drawing.imageData === 'string') {
            const filePath = path.join(this.uploadsDir, path.basename(drawing.imageData));
            await unlink(filePath);
          }
        } catch (error) {
          console.error('Error deleting file:', error);
          deletionErrors.push(error as Error);
          newDrawings.push(drawing); // Keep the drawing if deletion fails
        }
      } else {
        newDrawings.push(drawing); // Keep drawings that aren't too old
      }
    }

    this.drawings = newDrawings;
    await this.saveMetadata();
    
    if (deletionErrors.length > 0) {
      console.warn(`Failed to delete ${deletionErrors.length} files during cleanup`);
    }
  }
}

export const storage = new MemStorage();

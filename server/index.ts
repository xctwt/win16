import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import scoresRouter from './api/scores';
import musicRouter from './api/music';
import messagesRouter from './api/messages';
import contactRouter from './api/contact';
import path from "path";
import { storage } from './storage';
import { mkdir } from 'fs/promises';
import fs from 'fs/promises';
import crypto from 'crypto';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import type { Message } from '@shared/schema';

const app = express();

// Configure Express to trust proxies for real IP addresses
app.set('trust proxy', true);

// Add a flag to control whether to enforce secure verification
const ENFORCE_SECURE_VERIFICATION = false; // Set to false during transition period

// Configure middleware
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(express.json({ limit: '10mb' })); // Limit payload size
app.use(express.urlencoded({ extended: false }));

// Serve static files from the public directory
app.use('/assets', express.static(path.join(process.cwd(), 'client/public/assets')));

// Register API routes
app.use('/api', scoresRouter);
app.use('/api', musicRouter);
app.use('/api', messagesRouter);
app.use('/api/contact', contactRouter);

// Drawings API endpoint
app.post('/api/drawings', async (req, res) => {
  try {
    const { name, author, image } = req.body;
    
    // Validate image data
    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image format' });
    }

    const drawing = await storage.createDrawing({ name, author, image });
    res.json(drawing);
  } catch (error) {
    console.error('Error saving drawing:', error);
    res.status(500).json({ error: 'Failed to save drawing' });
  }
});

// Secure hash function for verification
function hashString(str: string): string {
  return crypto
    .createHash('sha256')
    .update(str)
    .digest('hex');
}

// Scores API endpoint
app.post('/api/scores', async (req, res) => {
  try {
    
    const { name, score, prestige = 0, color, timestamp, token } = req.body;
    
    // Basic validation
    if (!name || typeof score !== 'number') {
      console.warn('Invalid score data:', { name, score });
      return res.status(400).json({ error: 'Invalid score data' });
    }
    
    // Verify the submission if token and timestamp are provided
    let verificationStatus = 'none';
    
    if (timestamp && token) {
      try {
        // Generate the token data using the timestamp and score from the request
        const tokenData = `${timestamp}:${score}`;
        
        // Hash the token data using the same algorithm as the client
        const expectedToken = hashString(tokenData);
        
        
        // Compare the provided token with the expected token
        const isValid = token === expectedToken;
        verificationStatus = isValid ? 'success' : 'failed';
        
        
        if (!isValid) {
          console.warn('Invalid score token detected:', { 
            name, 
            score, 
            prestige, 
            timestamp,
            token: token
          });
          
          // TEMPORARY: Accept all tokens for debugging
          // return res.status(403).json({ error: 'Score verification failed' });
          console.warn('ALLOWING INVALID TOKEN FOR DEBUGGING');
        }
        
        // Check if the timestamp is too old (more than 10 minutes)
        const now = Date.now();
        if (now - timestamp > 600000) {
          verificationStatus = 'expired';
          console.warn('Timestamp too old:', { timestamp, now, diff: now - timestamp });
          return res.status(403).json({ error: 'Verification token expired' });
        }
      } catch (error) {
        verificationStatus = 'error';
        console.error('Error during verification:', error);
        return res.status(500).json({ error: 'Verification error' });
      }
    } else {
      // Only allow submissions without verification if not enforcing secure verification
      if (ENFORCE_SECURE_VERIFICATION) {
        console.warn('Rejecting submission without verification (secure verification enforced)');
        return res.status(403).json({ error: 'Verification required' });
      }
    }

    // Map the color correctly for storage
    // If the color is 'foreground', store it as a special value that will work in both themes
    const storedColor = color === 'foreground' ? 'theme-adaptive' : color;

    // Get the current scores
    const SCORES_FILE = path.join(process.cwd(), 'data/scores.json');
    const data = await fs.readFile(SCORES_FILE, 'utf-8');
    const scoresData = JSON.parse(data);
    
    const currentSeason = scoresData.currentSeason.toString();
    
    // Ensure the season array exists
    if (!scoresData.seasons[currentSeason]) {
      scoresData.seasons[currentSeason] = [];
    }
    
    let scores = scoresData.seasons[currentSeason];
    
    // Ensure scores is an array
    if (!Array.isArray(scores)) {
      console.error('Scores is not an array:', scores);
      scores = [];
      scoresData.seasons[currentSeason] = scores;
    }

    // Check if a score with the same name already exists in the current season
    const existingScoreIndex = scores.findIndex((s: { name: string }) => s.name === name);
    
    if (existingScoreIndex !== -1) {
      const existingScore = scores[existingScoreIndex];
      if (score <= existingScore.score) {
        return res.status(400).json({
          error: 'A score with this name and higher score already exists. Please enter a different name.'
        });
      }
      
      // Update the existing score if the new one is higher
      scores[existingScoreIndex] = {
        name,
        score,
        date: new Date().toISOString(),
        prestige,
        color: storedColor
      };
    } else {
      // Add new score
      scores.push({
        name,
        score,
        date: new Date().toISOString(),
        prestige,
        color: storedColor
      });
    }

    // Sort by prestige first (higher first), then by score (higher first)
    scores.sort((a: { prestige?: number; score: number }, b: { prestige?: number; score: number }) => {
      // First sort by prestige
      const prestigeDiff = (b.prestige || 0) - (a.prestige || 0);
      if (prestigeDiff !== 0) return prestigeDiff;
      
      // Then sort by score
      return b.score - a.score;
    });
    
    // Update the scores for the current season
    scoresData.seasons[currentSeason] = scores;
    
    await fs.writeFile(SCORES_FILE, JSON.stringify(scoresData, null, 2));
    res.json({ 
      success: true,
      verificationStatus
    });
  } catch (error) {
    console.error('Error saving score:', error);
    res.status(500).json({ error: 'Failed to save score' });
  }
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Start the server
(async () => {
  const server = registerRoutes(app);
  
  // Setup WebSocket server on a specific path
  const wss = new WebSocketServer({ 
    server,
    path: '/ws/chat'
  });
  
  // Store connected clients
  const clients = new Set<WebSocket>();
  
  // WebSocket connection handler
  wss.on('connection', (ws: WebSocket, req) => {
    clients.add(ws);
    
    // Send recent messages to newly connected client
    storage.getMessages().then(messages => {
      ws.send(JSON.stringify({
        type: 'initial_messages',
        messages: messages.slice(-50) // Send last 50 messages
      }));
    }).catch(err => {
      console.error('Error sending initial messages:', err);
    });
    
    // Handle incoming messages
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'chat_message') {
          const { nickname, content } = message;
          
          // Validate input
          if (!nickname || typeof nickname !== 'string' || !content || typeof content !== 'string') {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message data' }));
            return;
          }
          
          // Save message to storage
          const newMessage = await storage.createMessage({ nickname, content });
          
          // Broadcast to all connected clients
          const broadcastMessage = JSON.stringify({
            type: 'new_message',
            message: newMessage
          });
          
          clients.forEach(client => {
            if (client.readyState === client.OPEN) {
              client.send(broadcastMessage);
            }
          });
          
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });
    
    // Handle connection close
    ws.on('close', () => {
      clients.delete(ws);
    });
    
    // Handle connection errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    console.error(err);
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  
  // Create uploads directory if it doesn't exist
  const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
  await mkdir(UPLOADS_DIR, { recursive: true });
  
  // Setup graceful shutdown handler
  const handleShutdown = async () => {
    console.log('Server is shutting down, saving messages to file...');
    try {
      await storage.saveMessagesToFile();
      console.log('Messages saved successfully');
    } catch (error) {
      console.error('Error saving messages during shutdown:', error);
    }
    process.exit(0);
  };

  // Register shutdown handlers
  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);
  process.on('SIGUSR2', handleShutdown); // For Nodemon restarts
  
  // ALWAYS serve the app on port 5000
  // this serves both the API and the client
  const PORT = 5000;
  server.listen(PORT, "0.0.0.0", () => {
    log(`Server running on port ${PORT}`);
  });
})();
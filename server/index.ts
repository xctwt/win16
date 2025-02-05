import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import scoresRouter from './api/scores';
import musicRouter from './api/music';
import path from "path";
import { storage } from './storage'; // Import storage
import { mkdir } from 'fs/promises';

const app = express();


app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '10mb' })); // Limit payload size
// Serve static files from the public directory
app.use('/assets', express.static(path.join(process.cwd(), 'client/public/assets')));

app.use('/api', scoresRouter);
app.use('/api', musicRouter);

app.post('/api/drawings', async (req, res) => {
  try {
    const { name, author, image } = req.body;
    
    // Validate image data
    if (!image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image format' });
    }

    const drawing = await storage.createDrawing({ name, author, image });
    res.json(drawing);
  } catch (error) {
    console.error('Error saving drawing:', error);
    res.status(500).json({ error: 'Failed to save drawing' });
  }
});

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

(async () => {
  const server = registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
  await mkdir(UPLOADS_DIR, { recursive: true });
  // ALWAYS serve the app on port 5000
  // this serves both the API and the client
  const PORT = 5000;
  server.listen(PORT, "0.0.0.0", () => {
    log(`serving on port ${PORT}`);
  });
})();
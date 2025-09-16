import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server | null) {
  const serverOptions = {
    middlewareMode: true,
    hmr: server ? { server } : { port: 24678 }, // Use specific HMR port for Ultimate Express
    host: true, // Allow external connections
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });
  
  // Add Vite's dev middleware
  app.use(vite.middlewares);
  
  // Handle SPA fallback for HTML routes only - be more specific to avoid interfering with assets
  app.get("/", async (req, res, next) => {
    await handleSPARoute(req, res, next, vite);
  });
  
  // Handle other HTML routes that should serve the SPA
  app.get(/^\/(?!api|assets|ws).*/, async (req, res, next) => {
    await handleSPARoute(req, res, next, vite);
  });
}

// Extract SPA route handler for reuse
async function handleSPARoute(req: any, res: any, next: any, vite: any) {
  const url = req.originalUrl;

  try {
    const clientTemplate = path.resolve(
      __dirname,
      "..",
      "client",
      "index.html",
    );

    // always reload the index.html file from disk incase it changes
    let template = await fs.promises.readFile(clientTemplate, "utf-8");
    template = template.replace(
      `src="/src/main.tsx"`,
      `src="/src/main.tsx?v=${nanoid()}"`,
    );
    const page = await vite.transformIndexHtml(url, template);
    res.status(200).set({ "Content-Type": "text/html" }).end(page);
  } catch (e) {
    vite.ssrFixStacktrace(e as Error);
    next(e);
  }
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

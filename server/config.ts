import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

export const PORT = Number(process.env.PORT ?? 5000);
// nginx proxies to localhost, so don't expose the app port publicly.
export const HOST = process.env.HOST ?? "127.0.0.1";

export const DATA_DIR = join(ROOT, "data");
export const UPLOADS_DIR = join(ROOT, "uploads");
/** Built client (vite build). */
export const DIST_DIR = join(ROOT, "dist/public");
/** Raw public assets; served as a fallback so music dropped in on the server works without a rebuild. */
export const PUBLIC_DIR = join(ROOT, "client/public");
export const MUSIC_DIR = join(PUBLIC_DIR, "assets/music");

export const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

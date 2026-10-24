import { join, resolve, sep } from "node:path";
import { DIST_DIR, PUBLIC_DIR, UPLOADS_DIR } from "./config";

const ONE_YEAR = "public, max-age=31536000, immutable";
const ONE_WEEK = "public, max-age=604800";

/** Resolve `urlPath` inside `root`, refusing anything that escapes it. */
function safeJoin(root: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const full = resolve(join(root, decoded));
  return full === root || full.startsWith(root + sep) ? full : null;
}

async function fileResponse(req: Request, path: string, cacheControl: string): Promise<Response | null> {
  const file = Bun.file(path);
  const info = await file.stat().catch(() => null);
  if (!info?.isFile()) return null;

  const lastModified = info.mtime.toUTCString();
  const headers: Record<string, string> = {
    "Cache-Control": cacheControl,
    "Last-Modified": lastModified,
    "Accept-Ranges": "bytes",
    "Content-Type": file.type,
  };

  const since = req.headers.get("if-modified-since");
  if (since && Date.parse(since) >= Math.floor(info.mtime.getTime() / 1000) * 1000) {
    return new Response(null, { status: 304, headers });
  }

  // Byte ranges, so the music player can seek.
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const size = info.size;
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    return new Response(file.slice(start, end + 1), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}` },
    });
  }

  return new Response(file, { headers });
}

/** Vite emits content-hashed bundles like /assets/index-B1x2y3z4.js. */
const isHashedBundle = (p: string) => /^\/assets\/[^/]+-[\w-]{8,}\.(js|css)$/.test(p);

export async function serveStatic(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url);

  if (pathname.startsWith("/uploads/")) {
    const path = safeJoin(UPLOADS_DIR, pathname.slice("/uploads".length));
    return (path && (await fileResponse(req, path, ONE_WEEK))) || new Response("Not found", { status: 404 });
  }

  if (pathname !== "/") {
    const cache = isHashedBundle(pathname) ? ONE_YEAR : ONE_WEEK;
    for (const root of [DIST_DIR, PUBLIC_DIR]) {
      const path = safeJoin(root, pathname);
      const res = path && (await fileResponse(req, path, cache));
      if (res) return res;
    }
    // Missing files shouldn't get the SPA shell.
    if (pathname.startsWith("/assets/")) return new Response("Not found", { status: 404 });
  }

  // SPA fallback
  const index = await fileResponse(req, join(DIST_DIR, "index.html"), "no-cache");
  return index ?? new Response("Client not built. Run `bun run build` (or use `bun run dev`).", { status: 503 });
}

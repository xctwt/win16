import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseFile } from "music-metadata";
import type { Track } from "@shared/types";
import { MUSIC_DIR } from "../config";
import { json } from "../lib/http";

// Parsing tags is the expensive part, so cache the list until the folder changes.
let cache: { mtimeMs: number; tracks: Track[] } | undefined;

async function loadTracks(): Promise<Track[]> {
  const dir = await stat(MUSIC_DIR).catch(() => null);
  if (!dir) return [];
  if (cache?.mtimeMs === dir.mtimeMs) return cache.tracks;

  const files = (await readdir(MUSIC_DIR)).filter((f) => f.toLowerCase().endsWith(".mp3"));
  const tracks = await Promise.all(
    files.map(async (file): Promise<Track> => {
      const fallback = file.replace(/\.mp3$/i, "");
      const url = `/assets/music/${encodeURIComponent(file)}`;
      try {
        const { common } = await parseFile(join(MUSIC_DIR, file), { duration: false, skipCovers: true });
        return { title: common.title || fallback, artist: common.artist || "Unknown Artist", url };
      } catch (err) {
        console.error(`Failed to read tags for ${file}:`, err);
        return { title: fallback, artist: "Unknown Artist", url };
      }
    }),
  );
  tracks.sort((a, b) => a.title.localeCompare(b.title));
  cache = { mtimeMs: dir.mtimeMs, tracks };
  return tracks;
}

export const musicRoutes = {
  "/api/tracks": { GET: async () => json(await loadTracks()) },
};

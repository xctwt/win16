import { Router } from 'express';
import { promises as fs } from 'fs';
import { join } from 'path';
import * as mm from 'music-metadata';

const router = Router();
const MUSIC_DIR = join(process.cwd(), 'client/public/assets/music');

interface Track {
  title: string;
  artist: string;
  url: string;
}

router.get('/tracks', async (req, res) => {
  try {
    const files = await fs.readdir(MUSIC_DIR);
    const tracks: Track[] = [];

    for (const file of files) {
      if (file.endsWith('.mp3')) {
        try {
          const filePath = join(MUSIC_DIR, file);
          const metadata = await mm.parseFile(filePath);
          
          tracks.push({
            title: metadata.common.title || file.replace('.mp3', ''),
            artist: metadata.common.artist || 'Unknown Artist',
            url: `/assets/music/${file}`
          });
        } catch (error) {
          console.error(`Error parsing metadata for ${file}:`, error);
          // Add file even if metadata parsing fails
          tracks.push({
            title: file.replace('.mp3', ''),
            artist: 'Unknown Artist',
            url: `/assets/music/${file}`
          });
        }
      }
    }

    res.json(tracks);
  } catch (error) {
    console.error('Error reading music directory:', error);
    res.status(500).json({ error: 'Failed to load tracks' });
  }
});

export default router;

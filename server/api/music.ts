import { Router } from 'ultimate-express';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IAudioMetadata, parseBuffer } from 'music-metadata';

const router = Router();
const MUSIC_DIR = join(process.cwd(), 'client/public/assets/music');

interface Track {
  title: string;
  artist: string;
  url: string;
}

// Ensure music directory exists
async function ensureMusicDirectory(): Promise<void> {
  try {
    await fs.mkdir(MUSIC_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating music directory:', error);
    throw new Error('Failed to create music directory');
  }
}

// Initialize music directory
ensureMusicDirectory().catch(err => {
  console.error('Failed to initialize music directory:', err);
});

router.get('/tracks', async (req, res) => {
  try {
    // Check if directory exists
    try {
      await fs.access(MUSIC_DIR);
    } catch (error) {
      console.error('Music directory does not exist:', error);
      await ensureMusicDirectory();
      return res.json([]);
    }
    
    const files = await fs.readdir(MUSIC_DIR);
    const tracks: Track[] = [];
    const errors: string[] = [];

    for (const file of files) {
      if (file.endsWith('.mp3')) {
        try {
          const filePath = join(MUSIC_DIR, file);
          const fileBuffer = await fs.readFile(filePath);
          const metadata = await parseBuffer(fileBuffer);
          
          tracks.push({
            title: metadata.common.title || file.replace('.mp3', ''),
            artist: metadata.common.artist || 'Unknown Artist',
            url: `/assets/music/${file}`
          });
        } catch (error) {
          console.error(`Error parsing metadata for ${file}:`, error);
          errors.push(`Failed to parse metadata for ${file}`);
          
          // Add file even if metadata parsing fails
          tracks.push({
            title: file.replace('.mp3', ''),
            artist: 'Unknown Artist',
            url: `/assets/music/${file}`
          });
        }
      }
    }

    // Sort tracks alphabetically by title
    tracks.sort((a, b) => a.title.localeCompare(b.title));

    res.json(tracks);
  } catch (error) {
    console.error('Error reading music directory:', error);
    res.status(500).json({ error: 'Failed to load tracks' });
  }
});

export default router;

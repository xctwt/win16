import { promises as fs } from 'fs';
import { join } from 'path';
import { Router } from 'express';

const router = Router();
const SCORES_FILE = join(process.cwd(), 'data/scores.json');

// Ensure the data directory and scores file exist
async function ensureScoresFile() {
  try {
    await fs.mkdir(join(process.cwd(), 'data'), { recursive: true });
    try {
      await fs.access(SCORES_FILE);
    } catch {
      await fs.writeFile(SCORES_FILE, '[]');
    }
  } catch (error) {
    console.error('Error ensuring scores file:', error);
  }
}

ensureScoresFile();

// Get high scores
router.get('/scores', async (req, res) => {
  try {
    const data = await fs.readFile(SCORES_FILE, 'utf-8');
    const scores = JSON.parse(data);
    // Sort by score descending and limit to top 10
    const topScores = scores
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 10);
    res.json(topScores);
  } catch (error) {
    console.error('Error reading scores:', error);
    res.json([]);
  }
});

// Save new score
router.post('/scores', async (req, res) => {
  try {
    const { name, score } = req.body;
    if (!name || typeof score !== 'number') {
      return res.status(400).json({ error: 'Invalid score data' });
    }

    let scores = [];
    try {
      const data = await fs.readFile(SCORES_FILE, 'utf-8');
      scores = JSON.parse(data);
    } catch {
      // File doesn't exist yet, start with empty array
    }

    scores.push({
      name,
      score,
      date: new Date().toISOString(),
    });

    // Sort by score descending
    scores.sort((a: any, b: any) => b.score - a.score);

    await fs.writeFile(SCORES_FILE, JSON.stringify(scores, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving score:', error);
    res.status(500).json({ error: 'Failed to save score' });
  }
});

export default router;

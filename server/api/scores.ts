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
    let scores = JSON.parse(data);

    // Group scores by name and keep only the highest score for each player
    const highestScores: { [name: string]: any } = {};
    scores.forEach((score: any) => {
      if (
        !highestScores[score.name] ||
        score.score > highestScores[score.name].score
      ) {
        highestScores[score.name] = score;
      }
    });

    // Convert the object back to an array
    scores = Object.values(highestScores);

    // Sort by score descending
    scores.sort((a: any, b: any) => b.score - a.score);

    res.json(scores);
  } catch (error) {
    console.error('Error reading scores:', error);
    res.status(500).json({ error: 'Failed to read scores' });
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

    // Check if a score with the same name already exists
    const existingScore = scores.find((s: any) => s.name === name);

    if (existingScore && score <= existingScore.score) {
      return res.status(400).json({
        error:
          'A score with this name and higher score already exists. Please enter a different name.',
      });
    }

    scores.push({
      name,
      score,
      date: new Date().toISOString(),
    });

    // Group scores by name and keep only the highest score for each player
    const highestScores: { [name: string]: any } = {};
    scores.forEach((score: any) => {
      if (
        !highestScores[score.name] ||
        score.score > highestScores[score.name].score
      ) {
        highestScores[score.name] = score;
      }
    });

    // Convert the object back to an array
    scores = Object.values(highestScores);

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

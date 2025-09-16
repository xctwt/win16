import { promises as fs } from 'fs';
import { join } from 'path';
import { Router } from 'ultimate-express';
import crypto from 'crypto';

const router = Router();
const SCORES_FILE = join(process.cwd(), 'data/scores.json');

// Secret key for score verification - in a real app, this would be in an environment variable
const SECRET_KEY = 'clicker-game-secret-key-2025';

// Rate limiting for score submissions
const rateLimits: { [ip: string]: { lastSubmission: number, count: number } } = {};

// Type definitions
interface Score {
  name: string;
  score: number;
  date: string;
  prestige?: number; // New field for Season 2
  color?: string; // New field for Season 2
}

interface ScoresData {
  seasons: {
    [key: string]: Score[];
  };
  currentSeason: number;
}

// Ensure the data directory and scores file exist
async function ensureScoresFile(): Promise<void> {
  try {
    await fs.mkdir(join(process.cwd(), 'data'), { recursive: true });
    try {
      await fs.access(SCORES_FILE);
      // Validate and migrate if needed
      const data = await fs.readFile(SCORES_FILE, 'utf-8');
      let scoresData: any;

      try {
        scoresData = JSON.parse(data);

        // Check if it's the old format (array) and migrate if needed
        if (Array.isArray(scoresData)) {
          const newData: ScoresData = {
            seasons: {
              '1': scoresData,
              '2': [],
            },
            currentSeason: 2,
          };
          await fs.writeFile(SCORES_FILE, JSON.stringify(newData, null, 2));
        } else if (!scoresData.seasons) {
          // If it's not in the correct format, initialize it
          const newData: ScoresData = {
            seasons: {
              '1': [],
              '2': [],
            },
            currentSeason: 2,
          };
          await fs.writeFile(SCORES_FILE, JSON.stringify(newData, null, 2));
        }
      } catch (e) {
        // If JSON parsing fails, initialize with empty data
        const newData: ScoresData = {
          seasons: {
            '1': [],
            '2': [],
          },
          currentSeason: 2,
        };
        await fs.writeFile(SCORES_FILE, JSON.stringify(newData, null, 2));
      }
    } catch {
      // File doesn't exist, create it with initial structure
      const initialData: ScoresData = {
        seasons: {
          '1': [],
          '2': [],
        },
        currentSeason: 2,
      };
      await fs.writeFile(SCORES_FILE, JSON.stringify(initialData, null, 2));
    }
  } catch (error) {
    console.error('Error ensuring scores file:', error);
    throw new Error('Failed to initialize scores file');
  }
}

// Initialize scores file
ensureScoresFile().catch((err) => {
  console.error('Failed to initialize scores file:', err);
});

// Generate a verification token for the client
router.get('/verify', (req, res) => {
  try {
    const timestamp = Date.now();
    // Create a token that includes the timestamp and is signed with the secret key
    const token = generateVerificationToken(timestamp);

    console.log('Generated verification token:', {
      timestamp,
      token: token.substring(0, 10) + '...',
    });

    // Send the response with both timestamp and token
    res.json({
      timestamp,
      token,
      success: true,
    });
  } catch (error) {
    console.error('Error generating verification token:', error);
    res.status(500).json({ error: 'Failed to generate verification token' });
  }
});

// Generate a verification token
function generateVerificationToken(timestamp: number, score?: number): string {
  // If score is provided, include it in the token data
  const tokenData = score !== undefined ? `${timestamp}:${score}` : `${timestamp}`;
  return crypto.createHash('sha256').update(tokenData).digest('hex');
}

// Verify a score submission
function verifyScoreSubmission(score: number, timestamp: number, token: string): boolean {
  try {
    if (typeof score !== 'number' || typeof timestamp !== 'number' || typeof token !== 'string') {
      return false;
    }

    // Generate the expected token using the timestamp and score
    const expectedToken = generateVerificationToken(timestamp, score);

    // Simple string comparison
    return token === expectedToken;
  } catch (error) {
    console.error('Error verifying token:', error);
    return false;
  }
}

// Rate limiting middleware
function checkRateLimit(req: any, res: any, next: any) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  // Initialize rate limit data for this IP if it doesn't exist
  if (!rateLimits[ip]) {
    rateLimits[ip] = { lastSubmission: now, count: 1 };
    return next();
  }

  const limit = rateLimits[ip];

  // Reset count if it's been more than 1 hour
  if (now - limit.lastSubmission > 3600000) {
    limit.count = 1;
    limit.lastSubmission = now;
    return next();
  }

  // Check if too many submissions in the last hour
  if (limit.count >= 10) {
    return res.status(429).json({ error: 'Too many score submissions. Try again later.' });
  }

  // Update rate limit data
  limit.count++;
  limit.lastSubmission = now;
  next();
}

// Get high scores for a specific season
router.get('/scores', async (req, res) => {
  try {
    const season = req.query.season || 'current';

    const data = await fs.readFile(SCORES_FILE, 'utf-8');
    const scoresData: ScoresData = JSON.parse(data);

    let seasonKey: string;
    if (season === 'current') {
      seasonKey = scoresData.currentSeason.toString();
    } else {
      seasonKey = season.toString();
    }

    if (!scoresData.seasons[seasonKey]) {
      console.warn(`Season ${seasonKey} not found in scores data.`);
      return res.status(404).json({ error: 'Season not found' });
    }

    let scores = scoresData.seasons[seasonKey] || [];

    // Ensure scores is an array
    if (!Array.isArray(scores)) {
      console.error('Scores is not an array:', scores);
      scores = [];
      return res.json(scores);
    }

    // Enhanced filtering to remove invalid scores
    scores = scores.filter((score) => {
      // Filter out null score entries
      if (score === null || score === undefined) {
        console.warn('Found null/undefined score entry, filtering it out');
        return false;
      }
      
      // Make sure score is an object
      if (typeof score !== 'object') {
        console.warn('Found non-object score entry, filtering it out:', score);
        return false;
      }
      
      // Filter out scores with invalid score values
      if (score.score === null || score.score === undefined || typeof score.score !== 'number' || isNaN(score.score)) {
        console.warn('Found invalid score value, filtering it out:', score);
        return false;
      }
      
      return true;
    });

    // Group scores by name and keep only the highest score for each player
    const highestScores: { [name: string]: Score } = {};
    scores.forEach((score) => {
      try {
        if (
          !highestScores[score.name] ||
          score.score > highestScores[score.name].score
        ) {
          highestScores[score.name] = score;
        }
      } catch (error) {
        console.error('Error processing score:', score, error);
        // Skip this score if there's an error
      }
    });

    // Convert the object back to an array
    scores = Object.values(highestScores);

    // Sort by prestige first (higher first), then by score (higher first)
    scores.sort((a, b) => {
      try {
        // First sort by prestige
        const prestigeDiff = (b.prestige || 0) - (a.prestige || 0);
        if (prestigeDiff !== 0) return prestigeDiff;

        // Then sort by score
        return b.score - a.score;
      } catch (error) {
        console.error('Error sorting scores:', a, b, error);
        return 0; // Keep original order if there's an error
      }
    });

    // Final validation to ensure no null scores are sent to the client
    const validatedScores = scores.map(score => {
      // Create a new object with validated properties
      return {
        name: score.name || 'Unknown',
        score: typeof score.score === 'number' ? score.score : 0,
        date: score.date || new Date().toISOString(),
        prestige: typeof score.prestige === 'number' ? score.prestige : 0,
        color: score.color || 'theme-adaptive'
      };
    });

    res.json(validatedScores);
  } catch (error) {
    console.error('Error reading scores:', error);
    res.status(500).json({ error: 'Failed to read scores' });
  }
});

// Get available seasons
router.get('/seasons', async (req, res) => {
  try {
    const data = await fs.readFile(SCORES_FILE, 'utf-8');
    const scoresData: ScoresData = JSON.parse(data);

    // Ensure we have valid seasons data
    if (!scoresData.seasons) {
      console.error('Invalid seasons data:', scoresData);
      return res.json({
        seasons: [1, 2],
        currentSeason: 2,
      });
    }

    // Get all season keys and convert to numbers
    const seasons = Object.keys(scoresData.seasons)
      .map(Number)
      .filter((season) => !isNaN(season)) // Filter out any NaN values
      .sort((a, b) => a - b);

    // Ensure we have at least seasons 1 and 2
    if (seasons.length === 0) {
      seasons.push(1, 2);
    } else if (!seasons.includes(1)) {
      seasons.unshift(1);
    }

    res.json({
      seasons,
      currentSeason: scoresData.currentSeason || 2,
    });
  } catch (error) {
    console.error('Error reading seasons:', error);
    // Return default seasons if there's an error
    res.json({
      seasons: [1, 2],
      currentSeason: 2,
    });
  }
});

// Save new score with verification
router.post('/scores', checkRateLimit, async (req, res) => {
  try {
    const { name, score, prestige = 0, color, timestamp, token } = req.body;

    // Log the received score data for debugging
    console.log('Received score data:', { name, score, prestige, color, timestamp, token });

    // Enhanced validation for score
    if (!name || typeof name !== 'string') {
      console.warn('Invalid name received:', name);
      return res.status(400).json({ error: 'Invalid name' });
    }
    
    // Check if score is valid - must be a number and not null/undefined/NaN
    if (score === null || score === undefined || typeof score !== 'number' || isNaN(score)) {
      console.warn('Invalid score received:', score);
      return res.status(400).json({ error: 'Invalid score value' });
    }
    
    // Limit maximum score value to prevent issues with extremely large numbers
    // Using Number.MAX_SAFE_INTEGER (9007199254740991) as the upper limit
    const MAX_ALLOWED_SCORE = Number.MAX_SAFE_INTEGER;
    
    if (score > MAX_ALLOWED_SCORE) {
      console.warn('Score exceeds maximum allowed value:', score);
      return res.status(400).json({ 
        error: 'Score exceeds maximum allowed value',
        maxAllowed: MAX_ALLOWED_SCORE
      });
    }

    // Verify the submission if token and timestamp are provided
    let verificationStatus = 'none';

    if (timestamp && token) {
      try {
        // Generate the token data using the timestamp and score from the request
        const isValid = verifyScoreSubmission(score, timestamp, token);
        verificationStatus = isValid ? 'success' : 'failed';

        if (!isValid) {
          console.warn('Score verification failed for submission:', { name, score, timestamp, token });
          return res.status(403).json({ error: 'Score verification failed' });
        }

        // Check if the timestamp is too old (more than 10 minutes)
        const now = Date.now();
        if (now - timestamp > 600000) {
          verificationStatus = 'expired';
          console.warn('Verification token expired for submission:', { name, score, timestamp, token });
          return res.status(403).json({ error: 'Verification token expired' });
        }
      } catch (error) {
        verificationStatus = 'error';
        console.error('Error during verification:', error);
        return res.status(500).json({ error: 'Verification error' });
      }
    }

    // Map the color correctly for storage
    // If the color is 'foreground', store it as a special value that will work in both themes
    const storedColor = color === 'foreground' ? 'theme-adaptive' : color;

    try {
      // Get the current scores
      const data = await fs.readFile(SCORES_FILE, 'utf-8');
      const scoresData: ScoresData = JSON.parse(data);

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
      const existingScoreIndex = scores.findIndex((s: Score) => s.name === name);

      if (existingScoreIndex !== -1) {
        const existingScore = scores[existingScoreIndex];
        if (score <= existingScore.score) {
          console.warn('A score with this name and higher score already exists. Submission rejected.');
          return res.status(400).json({
            error:
              'A score with this name and higher score already exists. Please enter a different name.',
          });
        }

        // Update the existing score if the new one is higher
        scores[existingScoreIndex] = {
          name,
          score,
          date: new Date().toISOString(),
          prestige,
          color: storedColor,
        };
      } else {
        // Add new score
        scores.push({
          name,
          score,
          date: new Date().toISOString(),
          prestige,
          color: storedColor,
        });
      }

      // Sort by prestige first (higher first), then by score (higher first)
      scores.sort((a: Score, b: Score) => {
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
        verificationStatus,
      });
    } catch (error) {
      console.error('Error saving score:', error);
      res.status(500).json({ error: 'Failed to save score' });
    }
  } catch (error) {
    console.error('Unexpected error in score submission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Debug endpoint to test verification
router.get('/verify-test', (req, res) => {
  try {
    const timestamp = Date.now();
    const token = generateVerificationToken(timestamp);

    // Test verification
    const isValid = verifyScoreSubmission(0, timestamp, token);

    res.json({
      timestamp,
      token: token.substring(0, 10) + '...',
      tokenLength: token.length,
      isValid,
      success: true,
    });
  } catch (error) {
    console.error('Error testing verification:', error);
    res.status(500).json({ error: 'Failed to test verification' });
  }
});

export default router;

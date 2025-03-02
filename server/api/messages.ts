import { promises as fs } from 'fs';
import { join } from 'path';
import { Router } from 'express';

const router = Router();
const MESSAGES_FILE = join(process.cwd(), 'data/messages.json');

// Ensure the data directory and messages file exist
async function ensureMessagesFile() {
  try {
    await fs.mkdir(join(process.cwd(), 'data'), { recursive: true });
    try {
      await fs.access(MESSAGES_FILE);
    } catch {
      await fs.writeFile(MESSAGES_FILE, '[]');
    }
  } catch (error) {
    console.error('Error ensuring messages file:', error);
  }
}

ensureMessagesFile();

// Get messages
router.get('/messages', async (req, res) => {
  try {
    const data = await fs.readFile(MESSAGES_FILE, 'utf-8');
    const messages = JSON.parse(data);
    res.json(messages);
  } catch (error) {
    console.error('Error reading messages:', error);
    res.status(500).json({ error: 'Failed to read messages' });
  }
});

// Save new message
router.post('/messages', async (req, res) => {
  try {
    const { nickname, content } = req.body;
    if (!nickname || !content) {
      return res.status(400).json({ error: 'Invalid message data' });
    }

    const newMessage = {
      id: Date.now(),
      nickname,
      content,
      timestamp: new Date().toISOString(),
    };

    let messages = [];
    try {
      const data = await fs.readFile(MESSAGES_FILE, 'utf-8');
      messages = JSON.parse(data);
    } catch {
      // File doesn't exist yet, start with empty array
    }

    messages.push(newMessage);

    await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

export default router;

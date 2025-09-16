import { promises as fs } from 'fs';
import { join } from 'path';
import { Router } from 'ultimate-express';
import { storage } from '../storage';

const router = Router();

// Get messages
router.get('/messages', async (req, res) => {
  console.log('GET /api/messages - Retrieving messages');
  try {
    // Get messages from storage
    const messages = await storage.getMessages();
    console.log(`Returning ${messages.length} messages`);
    res.json(messages);
  } catch (error) {
    console.error('Error reading messages:', error);
    res.status(500).json({ error: 'Failed to read messages' });
  }
});

// Save new message
router.post('/messages', async (req, res) => {
  console.log('POST /api/messages - Saving new message');
  console.log('Request body:', req.body);
  
  try {
    const { nickname, content } = req.body;
    
    // Validate input
    if (!nickname || typeof nickname !== 'string' || !content || typeof content !== 'string') {
      console.error('Invalid message data:', { nickname, content });
      return res.status(400).json({ error: 'Invalid message data' });
    }

    // Create message using storage
    const newMessage = await storage.createMessage({ nickname, content });
    console.log('Created new message:', newMessage);

    // Get total message count
    const allMessages = await storage.getMessages();
    
    res.json({ 
      success: true, 
      message: newMessage,
      totalMessages: allMessages.length
    });
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

export default router;

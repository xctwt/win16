import { Router } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

const router = Router();
const upload = multer();

// Discord webhook URL from environment variables
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

router.post('/', async (req, res) => {
  try {
    const { message } = req.body;


    if (!DISCORD_WEBHOOK_URL) {
      console.error('Discord webhook URL is not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Send to Discord webhook
    await axios.post(DISCORD_WEBHOOK_URL, {
      content: message
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error sending to Discord webhook:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Handle image uploads
router.post('/upload', upload.single('file'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!DISCORD_WEBHOOK_URL) {
      console.error('Discord webhook URL is not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Create form data for Discord
    const formData = new FormData();
    formData.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);

    // Upload to Discord webhook
    const response = await axios.post(DISCORD_WEBHOOK_URL, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      }
    });

    // Discord returns the attachment URL in the response
    const attachmentUrl = response.data.attachments?.[0]?.url;
    if (!attachmentUrl) {
      throw new Error('Failed to get attachment URL from Discord');
    }

    res.status(200).json({ url: attachmentUrl });
  } catch (error) {
    console.error('Error uploading to Discord webhook:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

export default router; 
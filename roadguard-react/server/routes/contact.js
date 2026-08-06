import express from 'express';
import { db } from '../db.js';

const router = express.Router();

router.post('/', (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const newMessage = db.addContactMessage({ name, email, subject, message });
    res.status(201).json({ message: 'Thank you! Your message has been sent to the RoadGuard team.', data: newMessage });
  } catch (err) {
    console.error('Error saving contact message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;

import express from 'express';
import { db } from '../db.js';

const router = express.Router();

router.get('/stats', (req, res) => {
  try {
    const stats = db.getDashboardStats();
    res.json(stats);
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

export default router;

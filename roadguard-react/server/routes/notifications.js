import express from 'express';
import { db } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  try {
    const notifications = db.getNotificationsForUser(req.user.id);
    const unreadCount = notifications.filter(n => !n.is_read).length;
    res.json({ notifications, unread_count: unreadCount });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.put('/:id/read', authenticateToken, (req, res) => {
  try {
    const updated = db.markNotificationRead(req.params.id, req.user.id);
    if (!updated) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ message: 'Notification marked as read', notification: updated });
  } catch (err) {
    console.error('Error marking notification read:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

export default router;

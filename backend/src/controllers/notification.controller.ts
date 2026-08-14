import type { Request, Response } from 'express';
import { notificationService } from '../services/notification.service.js';
import { notificationIdSchema } from '../validations/notification.schema.js';


export const notificationController = {
  async list(req: Request, res: Response) {
    const data = await notificationService.listForUser(req.user!.id);
    res.json({ success: true, data });
  },

  async markRead(req: Request, res: Response) {
    const { id } = notificationIdSchema.parse(req.params);
    const data = await notificationService.markRead(req.user!.id, id);
    res.json({ success: true, message: 'Marked as read', data });
  },

  async markAllRead(req: Request, res: Response) {
    const data = await notificationService.markAllRead(req.user!.id);
    res.json({ success: true, message: 'All notifications marked as read', data });
  },
};

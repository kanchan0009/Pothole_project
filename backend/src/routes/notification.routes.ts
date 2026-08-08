import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const notificationRoutes = Router();

// Every notification endpoint requires a session.
notificationRoutes.use(authenticateToken);

notificationRoutes.get('/', asyncHandler(notificationController.list));
// Declared before /:id/read so "read-all" is never captured as an id.
notificationRoutes.put('/read-all', asyncHandler(notificationController.markAllRead));
notificationRoutes.put('/:id/read', asyncHandler(notificationController.markRead));

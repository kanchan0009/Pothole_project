import { Router } from 'express';
import { reportController } from '../controllers/report.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  checkDuplicateSchema,
  createReportSchema,
  updateReportSchema,
} from '../validations/report.schema.js';

export const reportRoutes = Router();

// Step-2 AI gate — declared early so it is never captured by a /:id route.
reportRoutes.post(
  '/detect',
  authenticateToken,
  upload.single('image'),
  asyncHandler(reportController.detect)
);

// Must be declared before any /:id route (POST vs GET methods, but keep it explicit).
reportRoutes.post(
  '/check-duplicate',
  authenticateToken,
  validateBody(checkDuplicateSchema),
  asyncHandler(reportController.checkDuplicate)
);

// Public read — the landing map and dashboards can render reports without login.
reportRoutes.get('/', asyncHandler(reportController.list));
// Authenticated "my reports" — forces filters.userId to the caller (never public).
reportRoutes.get('/mine', authenticateToken, asyncHandler(reportController.mine));
// Declared before /:id so "stats" is never captured as an id.
reportRoutes.get('/mine/stats', authenticateToken, asyncHandler(reportController.mineStats));
reportRoutes.get('/:id/timeline', asyncHandler(reportController.timeline));
// Owner/admin-only PDF receipt (authenticated, declared before the public detail route).
reportRoutes.get('/:id/receipt', authenticateToken, asyncHandler(reportController.receipt));
reportRoutes.get('/:id', asyncHandler(reportController.detail));

// Mutations
reportRoutes.post(
  '/',
  authenticateToken,
  upload.single('image'),
  validateBody(createReportSchema),
  asyncHandler(reportController.create)
);
reportRoutes.put(
  '/:id',
  authenticateToken,
  upload.single('image'),
  validateBody(updateReportSchema),
  asyncHandler(reportController.update)
);
reportRoutes.post(
  '/:id/remove-user',
  authenticateToken,
  asyncHandler(reportController.removeForUser)
);
reportRoutes.delete(
  '/:id',
  authenticateToken,
  requireRole('ADMIN'),
  asyncHandler(reportController.remove)
);

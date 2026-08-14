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


reportRoutes.post(
  '/detect',
  authenticateToken,
  upload.single('image'),
  asyncHandler(reportController.detect)
);


reportRoutes.post(
  '/check-duplicate',
  authenticateToken,
  validateBody(checkDuplicateSchema),
  asyncHandler(reportController.checkDuplicate)
);


reportRoutes.get('/', asyncHandler(reportController.list));

reportRoutes.get('/mine', authenticateToken, asyncHandler(reportController.mine));

reportRoutes.get('/mine/stats', authenticateToken, asyncHandler(reportController.mineStats));
reportRoutes.get('/:id/timeline', asyncHandler(reportController.timeline));

reportRoutes.get('/:id/receipt', authenticateToken, asyncHandler(reportController.receipt));
reportRoutes.get('/:id', asyncHandler(reportController.detail));


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

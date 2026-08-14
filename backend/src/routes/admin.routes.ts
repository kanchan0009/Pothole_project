import { Router } from 'express';
import { adminController } from '../controllers/admin.controller.js';
import { contactController } from '../controllers/contact.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { adminLoginLimiter } from '../middleware/rateLimit.js';
import { upload } from '../middleware/upload.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { aiVerificationSchema, assignSchema, statusUpdateSchema, updateUserSchema } from '../validations/admin.schema.js';
import { loginSchema } from '../validations/auth.schema.js';

export const adminRoutes = Router();


adminRoutes.post(
  '/login',
  adminLoginLimiter,
  validateBody(loginSchema),
  asyncHandler(adminController.login)
);

const adminOnly = [authenticateToken, requireRole('ADMIN')] as const;
adminRoutes.use(...adminOnly);


adminRoutes.get('/dashboard', asyncHandler(adminController.dashboard));
adminRoutes.get('/statistics', asyncHandler(adminController.statistics));


adminRoutes.get('/priority-queue', asyncHandler(adminController.priorityQueue));
adminRoutes.post('/priority-queue/process-next', asyncHandler(adminController.dispatchNext));


adminRoutes.get('/reports', asyncHandler(adminController.reports));
adminRoutes.get('/reports/:id', asyncHandler(adminController.reportDetail));

adminRoutes.get('/reports/:id/route', asyncHandler(adminController.reportRoute));

adminRoutes.put(
  '/reports/:id/status',
  upload.single('image'),
  validateBody(statusUpdateSchema),
  asyncHandler(adminController.updateStatus)
);
adminRoutes.post('/reports/:id/assign', validateBody(assignSchema), asyncHandler(adminController.assignWorker));

adminRoutes.post(
  '/reports/:id/ai-verify',
  validateBody(aiVerificationSchema),
  asyncHandler(adminController.verifyAi)
);


adminRoutes.get('/users', asyncHandler(adminController.users));
adminRoutes.put('/users/:id', validateBody(updateUserSchema), asyncHandler(adminController.updateUser));
adminRoutes.get('/workers', asyncHandler(adminController.workers));


adminRoutes.get('/logs', asyncHandler(adminController.logs));


adminRoutes.get('/contact-messages', asyncHandler(contactController.list));
adminRoutes.post('/contact-messages/:id/reply', asyncHandler(contactController.reply));


adminRoutes.get('/export/:format', asyncHandler(adminController.exportReports));

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

/**
 * Admin API.
 * - /login is public but rate-limited (slow credential stuffing).
 * - every other endpoint requires a valid ADMIN access token, enforced once
 *   here at the router level instead of per-route.
 */
adminRoutes.post(
  '/login',
  adminLoginLimiter,
  validateBody(loginSchema),
  asyncHandler(adminController.login)
);

const adminOnly = [authenticateToken, requireRole('ADMIN')] as const;
adminRoutes.use(...adminOnly);

// Overview + analytics
adminRoutes.get('/dashboard', asyncHandler(adminController.dashboard));
adminRoutes.get('/statistics', asyncHandler(adminController.statistics));

// Priority queue (max heap) — snapshot + dispatch the peak.
adminRoutes.get('/priority-queue', asyncHandler(adminController.priorityQueue));
adminRoutes.post('/priority-queue/process-next', asyncHandler(adminController.dispatchNext));

// Report management
adminRoutes.get('/reports', asyncHandler(adminController.reports));
adminRoutes.get('/reports/:id', asyncHandler(adminController.reportDetail));
// Dijkstra route from the crew to the pothole (displayed on the admin map).
adminRoutes.get('/reports/:id/route', asyncHandler(adminController.reportRoute));
// Multipart: fields (status, remarks, workerId?, assignedTo?) + optional completion image.
adminRoutes.put(
  '/reports/:id/status',
  upload.single('image'),
  validateBody(statusUpdateSchema),
  asyncHandler(adminController.updateStatus)
);
adminRoutes.post('/reports/:id/assign', validateBody(assignSchema), asyncHandler(adminController.assignWorker));
// Verify-AI — admin confirms or rejects the detection; rejection rejects the report.
adminRoutes.post(
  '/reports/:id/ai-verify',
  validateBody(aiVerificationSchema),
  asyncHandler(adminController.verifyAi)
);

// User management + field crews
adminRoutes.get('/users', asyncHandler(adminController.users));
adminRoutes.put('/users/:id', validateBody(updateUserSchema), asyncHandler(adminController.updateUser));
adminRoutes.get('/workers', asyncHandler(adminController.workers));

// Audit trail
adminRoutes.get('/logs', asyncHandler(adminController.logs));

// Contact form submissions
adminRoutes.get('/contact-messages', asyncHandler(contactController.list));

// Exports (CSV / XLSX / PDF)
adminRoutes.get('/export/:format', asyncHandler(adminController.exportReports));

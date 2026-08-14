import { Router } from 'express';
import { env } from '../config/env.js';
import { contactController } from '../controllers/contact.controller.js';
import { contactLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { contactSchema } from '../validations/contact.schema.js';


export const publicRoutes = Router();

publicRoutes.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'Smart Pothole System API',
      timestamp: new Date().toISOString(),
      env: env.NODE_ENV,
    },
  });
});

publicRoutes.post('/contact', contactLimiter, validateBody(contactSchema), asyncHandler(contactController.submit));

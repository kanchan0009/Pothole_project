import path from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { publicRoutes } from './routes/public.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { reportRoutes } from './routes/report.routes.js';
import { notificationRoutes } from './routes/notification.routes.js';

/**
 * Builds the Express application (no listen here — keeps it testable).
 * Feature routers are mounted in later phases.
 */
export function createApp(): express.Express {
  const app = express();

  // Security headers
  app.use(helmet());

  // Trust the configured number of reverse-proxy hops (0 = none, 1 = Railway/
  // Render/Vercel/nginx) so req.ip is the real client for rate limiting.
  app.set('trust proxy', env.TRUST_PROXY);

  // CORS allowlist (comma-separated origins from env)
  const origins = env.CORS_ORIGIN.split(',').map((s) => s.trim());
  app.use(cors({ origin: origins, credentials: true }));

  // Body parsing
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Local image fallback storage (when Cloudinary credentials are not configured)
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

  // Root banner
  app.get('/', (_req, res) => {
    res.json({ service: 'Smart Pothole Detection & Reporting System API', api: '/api', health: '/api/health' });
  });

  // API routes
  app.use('/api', publicRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/notifications', notificationRoutes);

  // 404 + centralized error handling (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

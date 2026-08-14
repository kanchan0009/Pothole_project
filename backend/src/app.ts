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


export function createApp(): express.Express {
  const app = express();

  
  app.use(helmet());

  
  
  app.set('trust proxy', env.TRUST_PROXY);

  
  const origins = env.CORS_ORIGIN.split(',').map((s) => s.trim());
  app.use(cors({ origin: origins, credentials: true }));

  
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

  
  app.get('/', (_req, res) => {
    res.json({ service: 'Smart Pothole Detection & Reporting System API', api: '/api', health: '/api/health' });
  });

  
  app.use('/api', publicRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/notifications', notificationRoutes);

  
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

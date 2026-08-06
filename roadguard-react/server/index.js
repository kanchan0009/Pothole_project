import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initDb } from './db.js';

import authRoutes from './routes/auth.js';
import reportRoutes from './routes/reports.js';
import dashboardRoutes from './routes/dashboard.js';
import notificationRoutes from './routes/notifications.js';
import contactRoutes from './routes/contact.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Database & Seeding
initDb();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'RoadGuard REST API', timestamp: new Date() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/contact', contactRoutes);

// 404 Handler for API
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 RoadGuard Backend Server Running`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`=================================`);
});

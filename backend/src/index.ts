import 'dotenv/config';
import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log('==========================================');
  console.log('🚀 Smart Pothole System API running');
  console.log(`📍 http://localhost:${env.PORT}`);
  console.log(`🩺 Health: http://localhost:${env.PORT}/api/health`);
  console.log('==========================================');
});

// Graceful shutdown
function shutdown(signal: string): void {
  console.log(`\n🛑 ${signal} received, shutting down…`);
  server.close(() => process.exit(0));
  // Safety timeout in case connections linger
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

/**
 * Runs before every test file so env vars are ready before modules import.
 * dotenv will NOT override these (it only fills unset variables).
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789';
// Supertest drives the app in-process (never calls listen), so any valid port works.
process.env.PORT = '5100';

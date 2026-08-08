import type { Express } from 'express';
import express from 'express';
import request from 'supertest';
import { apiRateLimit } from '../../src/middleware/rateLimit.js';

/**
 * The named limiters skip enforcement under NODE_ENV=test (see rateLimit.ts) so
 * the existing suites stay deterministic. These tests force `skip: () => false`
 * on a fresh limiter to exercise the shared factory + 429 envelope directly.
 */
function makeApp(limit: number): Express {
  const app = express();
  app.use(express.json());
  app.post('/test', apiRateLimit({ windowMs: 60_000, limit, skip: () => false }), (_req, res) =>
    res.json({ ok: true })
  );
  return app;
}

describe('apiRateLimit', () => {
  it('allows requests under the limit', async () => {
    const app = makeApp(5);
    await request(app).post('/test').expect(200);
    await request(app).post('/test').expect(200);
    await request(app).post('/test').expect(200);
  });

  it('returns the 429 JSON envelope once the limit is exceeded', async () => {
    const app = makeApp(2);
    await request(app).post('/test').expect(200);
    await request(app).post('/test').expect(200);
    const res = await request(app).post('/test').expect(429);
    expect(res.body).toMatchObject({ success: false, error: { code: 'RATE_LIMITED' } });
    expect(res.body.error.message).toMatch(/too many requests/i);
  });

  it('advertises the limit in standard RateLimit headers', async () => {
    const app = makeApp(5);
    const res = await request(app).post('/test').expect(200);
    expect(res.headers['ratelimit-limit']).toBe('5');
    expect(res.headers['ratelimit-remaining']).toBe('4');
  });

  it('accepts a custom message', async () => {
    const app = express();
    app.post('/test', apiRateLimit({ windowMs: 60_000, limit: 1, skip: () => false, message: 'Slow down, friend.' }), (_req, res) =>
      res.json({ ok: true })
    );
    await request(app).post('/test').expect(200);
    const res = await request(app).post('/test').expect(429);
    expect(res.body.error.message).toBe('Slow down, friend.');
  });
});

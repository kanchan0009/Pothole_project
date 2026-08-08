import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/** Human-readable 429 body — kept consistent across every limited endpoint. */
function sendRateLimited(res: Response, message: string): void {
  res.status(429).json({
    success: false,
    error: { message, code: 'RATE_LIMITED' },
  });
}

/**
 * Skipped under tests so the suites stay deterministic; the real limits apply
 * in development and production. The rate-limit spec forces `skip: () => false`
 * to exercise the limiter itself.
 */
const skipInTest = (): boolean => env.NODE_ENV === 'test';

export interface RateLimitConfig {
  windowMs: number;
  limit: number;
  message?: string;
  /** Overrides the test-skip (used by the rate-limit spec). */
  skip?: (req: Request) => boolean;
}

/** Builds a per-endpoint limiter using the API's standard 429 JSON envelope. */
export function apiRateLimit({ windowMs, limit, message, skip }: RateLimitConfig) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skip ?? skipInTest,
    handler: (_req, res) => sendRateLimited(res, message ?? 'Too many requests. Please try again later.'),
  });
}

// ---- Named per-endpoint limiters ------------------------------------------

/** Login — slows credential stuffing / password spraying. */
export const authLoginLimiter = apiRateLimit({ windowMs: 15 * 60_000, limit: 20 });

/** Registration — blocks scripted mass account creation. */
export const authRegisterLimiter = apiRateLimit({ windowMs: 60 * 60_000, limit: 5 });

/** Password-reset emails — prevents inbox bombing of a target address. */
export const authForgotLimiter = apiRateLimit({ windowMs: 60 * 60_000, limit: 5 });

/** Password-reset submission — same window, prevents token brute-forcing. */
export const authResetLimiter = apiRateLimit({ windowMs: 60 * 60_000, limit: 5 });

/** Admin login — matches the previous limiter but returns the JSON envelope. */
export const adminLoginLimiter = apiRateLimit({ windowMs: 15 * 60_000, limit: 20 });

/** Public contact form — public forms are a spam magnet; same window as register. */
export const contactLimiter = apiRateLimit({ windowMs: 60 * 60_000, limit: 5 });

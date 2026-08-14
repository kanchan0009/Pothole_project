import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';


function sendRateLimited(res: Response, message: string): void {
  res.status(429).json({
    success: false,
    error: { message, code: 'RATE_LIMITED' },
  });
}


const skipInTest = (): boolean => env.NODE_ENV === 'test';

export interface RateLimitConfig {
  windowMs: number;
  limit: number;
  message?: string;
  
  skip?: (req: Request) => boolean;
}


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




export const authLoginLimiter = apiRateLimit({ windowMs: 15 * 60_000, limit: 20 });


export const authRegisterLimiter = apiRateLimit({ windowMs: 60 * 60_000, limit: 5 });


export const authForgotLimiter = apiRateLimit({ windowMs: 60 * 60_000, limit: 5 });


export const authResetLimiter = apiRateLimit({ windowMs: 60 * 60_000, limit: 5 });


export const adminLoginLimiter = apiRateLimit({ windowMs: 15 * 60_000, limit: 20 });


export const contactLimiter = apiRateLimit({ windowMs: 60 * 60_000, limit: 5 });
